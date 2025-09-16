use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap};
use std::cmp::Ordering;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use anyhow::Result;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum TaskPriority {
    Critical = 1,
    High = 2,
    Normal = 5,
    Low = 8,
    Background = 10,
}

impl TaskPriority {
    pub fn from_u32(value: u32) -> Self {
        match value {
            1 => TaskPriority::Critical,
            2..=3 => TaskPriority::High,
            4..=6 => TaskPriority::Normal,
            7..=9 => TaskPriority::Low,
            _ => TaskPriority::Background,
        }
    }
    
    pub fn to_u32(self) -> u32 {
        self as u32
    }
}

impl PartialOrd for TaskPriority {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for TaskPriority {
    fn cmp(&self, other: &Self) -> Ordering {
        // Lower number = higher priority, so reverse the comparison
        (other as &u8).cmp(&(self as &u8))
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum TaskStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Timeout,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingTask {
    pub id: String,
    pub model_name: String,
    pub task_type: String,
    pub priority: TaskPriority,
    pub created_at: DateTime<Utc>,
    pub timeout_ms: u64,
    pub estimated_vram_gb: f64,
    pub status: TaskStatus,
}

// Internal task wrapper for priority queue
#[derive(Debug, Clone)]
struct QueuedTask {
    task: ProcessingTask,
    enqueue_time: DateTime<Utc>,
}

impl PartialEq for QueuedTask {
    fn eq(&self, other: &Self) -> bool {
        self.task.priority == other.task.priority && self.enqueue_time == other.enqueue_time
    }
}

impl Eq for QueuedTask {}

impl PartialOrd for QueuedTask {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for QueuedTask {
    fn cmp(&self, other: &Self) -> Ordering {
        // Primary: Priority (higher priority first)
        match self.task.priority.cmp(&other.task.priority) {
            Ordering::Equal => {
                // Secondary: Earlier enqueue time first (FIFO for same priority)
                other.enqueue_time.cmp(&self.enqueue_time)
            }
            other => other,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[napi_derive::napi(object)]
pub struct QueueStats {
    pub total_queued: u32,
    pub running_tasks: u32,
    pub completed_tasks: u32,
    pub failed_tasks: u32,
    pub average_wait_time_ms: f64,
    pub queue_length_by_priority: Vec<(String, u32)>,
}

pub struct TaskQueue {
    queue: Arc<RwLock<BinaryHeap<QueuedTask>>>,
    active_tasks: Arc<RwLock<HashMap<String, ProcessingTask>>>,
    completed_tasks: Arc<RwLock<HashMap<String, ProcessingTask>>>,
    failed_tasks: Arc<RwLock<HashMap<String, ProcessingTask>>>,
    
    // Metrics
    total_queued: Arc<RwLock<u32>>,
    wait_times: Arc<RwLock<Vec<u64>>>, // Wait times in milliseconds
}

impl TaskQueue {
    pub fn new() -> Self {
        Self {
            queue: Arc::new(RwLock::new(BinaryHeap::new())),
            active_tasks: Arc::new(RwLock::new(HashMap::new())),
            completed_tasks: Arc::new(RwLock::new(HashMap::new())),
            failed_tasks: Arc::new(RwLock::new(HashMap::new())),
            total_queued: Arc::new(RwLock::new(0)),
            wait_times: Arc::new(RwLock::new(Vec::new())),
        }
    }
    
    pub async fn enqueue(&self, mut task: ProcessingTask) -> Result<()> {
        task.status = TaskStatus::Queued;
        
        let queued_task = QueuedTask {
            task: task.clone(),
            enqueue_time: Utc::now(),
        };
        
        {
            let mut queue = self.queue.write().await;
            queue.push(queued_task);
        }
        
        {
            let mut total = self.total_queued.write().await;
            *total += 1;
        }
        
        tracing::info!(
            "Task {} enqueued with priority {:?} (queue length: {})",
            task.id,
            task.priority,
            self.get_queue_length().await
        );
        
        Ok(())
    }
    
    pub async fn dequeue(&self) -> Option<ProcessingTask> {
        let queued_task = {
            let mut queue = self.queue.write().await;
            queue.pop()
        };
        
        if let Some(queued_task) = queued_task {
            let mut task = queued_task.task;
            task.status = TaskStatus::Running;
            
            // Record wait time
            let wait_time = Utc::now()
                .signed_duration_since(queued_task.enqueue_time)
                .num_milliseconds() as u64;
            
            {
                let mut wait_times = self.wait_times.write().await;
                wait_times.push(wait_time);
                
                // Keep only last 1000 wait times
                if wait_times.len() > 1000 {
                    wait_times.remove(0);
                }
            }
            
            // Add to active tasks
            {
                let mut active = self.active_tasks.write().await;
                active.insert(task.id.clone(), task.clone());
            }
            
            tracing::info!(
                "Task {} dequeued after {}ms wait (priority: {:?})",
                task.id,
                wait_time,
                task.priority
            );
            
            Some(task)
        } else {
            None
        }
    }
    
    pub async fn update_task_status(&self, task_id: &str, status: TaskStatus) -> Result<()> {
        // Update in active tasks if it's there
        let task = {
            let mut active = self.active_tasks.write().await;
            if let Some(mut task) = active.remove(task_id) {
                task.status = status;
                Some(task)
            } else {
                None
            }
        };
        
        if let Some(task) = task {
            match status {
                TaskStatus::Completed => {
                    let mut completed = self.completed_tasks.write().await;
                    completed.insert(task_id.to_string(), task);
                    tracing::info!("Task {} marked as completed", task_id);
                }
                TaskStatus::Failed | TaskStatus::Timeout | TaskStatus::Cancelled => {
                    let mut failed = self.failed_tasks.write().await;
                    failed.insert(task_id.to_string(), task);
                    tracing::warn!("Task {} marked as failed: {:?}", task_id, status);
                }
                TaskStatus::Running => {
                    // Put back in active tasks
                    let mut active = self.active_tasks.write().await;
                    active.insert(task_id.to_string(), task);
                }
                TaskStatus::Queued => {
                    // This shouldn't happen, but handle it gracefully
                    return Err(anyhow::anyhow!(
                        "Cannot update active task {} back to queued status",
                        task_id
                    ));
                }
            }
            Ok(())
        } else {
            Err(anyhow::anyhow!("Task {} not found in active tasks", task_id))
        }
    }
    
    pub async fn get_task_status(&self, task_id: &str) -> Option<TaskStatus> {
        // Check active tasks first
        {
            let active = self.active_tasks.read().await;
            if let Some(task) = active.get(task_id) {
                return Some(task.status);
            }
        }
        
        // Check completed tasks
        {
            let completed = self.completed_tasks.read().await;
            if completed.contains_key(task_id) {
                return Some(TaskStatus::Completed);
            }
        }
        
        // Check failed tasks
        {
            let failed = self.failed_tasks.read().await;
            if failed.contains_key(task_id) {
                return Some(TaskStatus::Failed);
            }
        }
        
        // Check queue
        {
            let queue = self.queue.read().await;
            for queued_task in queue.iter() {
                if queued_task.task.id == task_id {
                    return Some(TaskStatus::Queued);
                }
            }
        }
        
        None
    }
    
    pub async fn cancel_task(&self, task_id: &str) -> Result<bool> {
        // Try to remove from queue first
        {
            let mut queue = self.queue.write().await;
            let original_queue: Vec<_> = queue.drain().collect();
            let mut found = false;
            
            for queued_task in original_queue {
                if queued_task.task.id == task_id {
                    found = true;
                    tracing::info!("Task {} cancelled (was queued)", task_id);
                } else {
                    queue.push(queued_task);
                }
            }
            
            if found {
                return Ok(true);
            }
        }
        
        // Try to cancel active task
        {
            let mut active = self.active_tasks.write().await;
            if let Some(mut task) = active.remove(task_id) {
                task.status = TaskStatus::Cancelled;
                let mut failed = self.failed_tasks.write().await;
                failed.insert(task_id.to_string(), task);
                tracing::info!("Task {} cancelled (was running)", task_id);
                return Ok(true);
            }
        }
        
        Ok(false)
    }
    
    pub async fn get_queue_length(&self) -> u32 {
        let queue = self.queue.read().await;
        queue.len() as u32
    }
    
    pub async fn get_active_tasks(&self) -> u32 {
        let active = self.active_tasks.read().await;
        active.len() as u32
    }
    
    pub async fn get_queue_stats(&self) -> QueueStats {
        let queue_length = self.get_queue_length().await;
        let running_tasks = self.get_active_tasks().await;
        
        let completed_tasks = {
            let completed = self.completed_tasks.read().await;
            completed.len() as u32
        };
        
        let failed_tasks = {
            let failed = self.failed_tasks.read().await;
            failed.len() as u32
        };
        
        let total_queued = *self.total_queued.read().await;
        
        let average_wait_time = {
            let wait_times = self.wait_times.read().await;
            if wait_times.is_empty() {
                0.0
            } else {
                let sum: u64 = wait_times.iter().sum();
                sum as f64 / wait_times.len() as f64
            }
        };
        
        // Count queue length by priority
        let queue_length_by_priority = {
            let mut by_priority = HashMap::new();
            let queue = self.queue.read().await;
            
            for queued_task in queue.iter() {
                let priority_str = format!("{:?}", queued_task.task.priority);
                *by_priority.entry(priority_str).or_insert(0) += 1;
            }
            
            by_priority.into_iter().collect()
        };
        
        QueueStats {
            total_queued,
            running_tasks,
            completed_tasks,
            failed_tasks,
            average_wait_time_ms: average_wait_time,
            queue_length_by_priority,
        }
    }
    
    pub async fn cleanup_expired_tasks(&self) -> Result<()> {
        let now = Utc::now();
        let mut expired_tasks = Vec::new();
        
        // Check active tasks for timeouts
        {
            let active = self.active_tasks.read().await;
            for (task_id, task) in active.iter() {
                let elapsed = now
                    .signed_duration_since(task.created_at)
                    .num_milliseconds() as u64;
                
                if elapsed > task.timeout_ms {
                    expired_tasks.push(task_id.clone());
                }
            }
        }
        
        // Move expired tasks to failed
        for task_id in expired_tasks {
            if let Err(e) = self.update_task_status(&task_id, TaskStatus::Timeout).await {
                tracing::warn!("Failed to mark task {} as timed out: {}", task_id, e);
            }
        }
        
        // Clean up old completed/failed tasks (keep last 1000 of each)
        {
            let mut completed = self.completed_tasks.write().await;
            if completed.len() > 1000 {
                let to_remove = completed.len() - 1000;
                let keys_to_remove: Vec<_> = completed.keys().take(to_remove).cloned().collect();
                for key in keys_to_remove {
                    completed.remove(&key);
                }
            }
        }
        
        {
            let mut failed = self.failed_tasks.write().await;
            if failed.len() > 1000 {
                let to_remove = failed.len() - 1000;
                let keys_to_remove: Vec<_> = failed.keys().take(to_remove).cloned().collect();
                for key in keys_to_remove {
                    failed.remove(&key);
                }
            }
        }
        
        Ok(())
    }
    
    pub async fn clear_queue(&self) -> Result<u32> {
        let mut queue = self.queue.write().await;
        let count = queue.len() as u32;
        queue.clear();
        
        tracing::info!("Cleared {} tasks from queue", count);
        Ok(count)
    }
    
    pub async fn get_queued_tasks(&self) -> Vec<ProcessingTask> {
        let queue = self.queue.read().await;
        queue.iter().map(|qt| qt.task.clone()).collect()
    }
    
    pub async fn get_active_tasks_list(&self) -> Vec<ProcessingTask> {
        let active = self.active_tasks.read().await;
        active.values().cloned().collect()
    }
    
    pub async fn peek_next_task(&self) -> Option<ProcessingTask> {
        let queue = self.queue.read().await;
        queue.peek().map(|qt| qt.task.clone())
    }
    
    pub async fn get_task_position(&self, task_id: &str) -> Option<usize> {
        let queue = self.queue.read().await;
        let tasks: Vec<_> = queue.iter().collect();
        
        // Tasks are ordered by priority, so position 0 is next to execute
        for (index, queued_task) in tasks.iter().enumerate() {
            if queued_task.task.id == task_id {
                return Some(index);
            }
        }
        
        None
    }
    
    pub async fn estimate_wait_time(&self, task_id: &str) -> Option<u64> {
        if let Some(position) = self.get_task_position(task_id).await {
            let average_wait = {
                let wait_times = self.wait_times.read().await;
                if wait_times.is_empty() {
                    5000 // Default 5 seconds
                } else {
                    let sum: u64 = wait_times.iter().sum();
                    sum / wait_times.len() as u64
                }
            };
            
            // Estimate based on position in queue and average processing time
            Some((position as u64 + 1) * average_wait)
        } else {
            None
        }
    }
}
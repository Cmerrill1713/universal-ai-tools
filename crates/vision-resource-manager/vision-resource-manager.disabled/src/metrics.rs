use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize)]
#[napi_derive::napi(object)]
pub struct PerformanceMetrics {
    pub total_tasks_executed: u32,
    pub successful_tasks: u32,
    pub failed_tasks: u32,
    pub average_execution_time_ms: f64,
    pub median_execution_time_ms: f64,
    pub p95_execution_time_ms: f64,
    pub p99_execution_time_ms: f64,
    pub peak_vram_usage_gb: f64,
    pub average_vram_usage_gb: f64,
    pub current_vram_usage_gb: f64,
    pub throughput_tasks_per_minute: f64,
    pub error_rate_percent: f64,
    pub uptime_seconds: u32,
    pub last_updated: String,
}

#[derive(Debug, Clone)]
struct TaskExecutionRecord {
    timestamp: DateTime<Utc>,
    execution_time_ms: u64,
    vram_used_gb: f64,
    success: bool,
}

#[derive(Debug, Clone)]
struct VramUsageRecord {
    timestamp: DateTime<Utc>,
    vram_used_gb: f64,
}

pub struct MetricsCollector {
    // Configuration
    collection_interval_ms: u64,
    max_records: usize,
    
    // State
    running: Arc<AtomicBool>,
    start_time: DateTime<Utc>,
    
    // Execution metrics
    execution_records: Arc<RwLock<VecDeque<TaskExecutionRecord>>>,
    vram_usage_records: Arc<RwLock<VecDeque<VramUsageRecord>>>,
    
    // Atomic counters
    total_tasks: Arc<AtomicU64>,
    successful_tasks: Arc<AtomicU64>,
    failed_tasks: Arc<AtomicU64>,
    
    // Cached metrics
    cached_metrics: Arc<RwLock<Option<PerformanceMetrics>>>,
    last_calculation: Arc<RwLock<DateTime<Utc>>>,
}

impl MetricsCollector {
    pub fn new(collection_interval_ms: u64) -> Self {
        Self {
            collection_interval_ms,
            max_records: 10000, // Keep last 10k records
            running: Arc::new(AtomicBool::new(false)),
            start_time: Utc::now(),
            execution_records: Arc::new(RwLock::new(VecDeque::new())),
            vram_usage_records: Arc::new(RwLock::new(VecDeque::new())),
            total_tasks: Arc::new(AtomicU64::new(0)),
            successful_tasks: Arc::new(AtomicU64::new(0)),
            failed_tasks: Arc::new(AtomicU64::new(0)),
            cached_metrics: Arc::new(RwLock::new(None)),
            last_calculation: Arc::new(RwLock::new(Utc::now())),
        }
    }
    
    pub async fn start_collection(&self) {
        self.running.store(true, Ordering::Relaxed);
        
        // Start background metrics calculation
        let running = Arc::clone(&self.running);
        let execution_records = Arc::clone(&self.execution_records);
        let vram_records = Arc::clone(&self.vram_usage_records);
        let cached_metrics = Arc::clone(&self.cached_metrics);
        let last_calculation = Arc::clone(&self.last_calculation);
        let total_tasks = Arc::clone(&self.total_tasks);
        let successful_tasks = Arc::clone(&self.successful_tasks);
        let failed_tasks = Arc::clone(&self.failed_tasks);
        let start_time = self.start_time;
        let max_records = self.max_records;
        let interval_ms = self.collection_interval_ms;
        
        tokio::spawn(async move {
            while running.load(Ordering::Relaxed) {
                // Calculate and cache metrics
                let metrics = Self::calculate_metrics(
                    &execution_records,
                    &vram_records,
                    &total_tasks,
                    &successful_tasks,
                    &failed_tasks,
                    start_time,
                    max_records,
                ).await;
                
                *cached_metrics.write().await = Some(metrics);
                *last_calculation.write().await = Utc::now();
                
                // Clean up old records
                Self::cleanup_old_records(&execution_records, max_records).await;
                Self::cleanup_old_records_vram(&vram_records, max_records).await;
                
                tokio::time::sleep(tokio::time::Duration::from_millis(interval_ms)).await;
            }
        });
        
        tracing::info!("Metrics collection started (interval: {}ms)", self.collection_interval_ms);
    }
    
    pub async fn stop_collection(&self) {
        self.running.store(false, Ordering::Relaxed);
        tracing::info!("Metrics collection stopped");
    }
    
    pub async fn record_task_execution(&self, execution_time_ms: u64, vram_used_gb: f64) {
        self.total_tasks.fetch_add(1, Ordering::Relaxed);
        self.successful_tasks.fetch_add(1, Ordering::Relaxed);
        
        let record = TaskExecutionRecord {
            timestamp: Utc::now(),
            execution_time_ms,
            vram_used_gb,
            success: true,
        };
        
        {
            let mut records = self.execution_records.write().await;
            records.push_back(record);
        }
        
        self.record_vram_usage(vram_used_gb).await;
    }
    
    pub async fn record_task_failure(&self, execution_time_ms: u64, vram_used_gb: f64) {
        self.total_tasks.fetch_add(1, Ordering::Relaxed);
        self.failed_tasks.fetch_add(1, Ordering::Relaxed);
        
        let record = TaskExecutionRecord {
            timestamp: Utc::now(),
            execution_time_ms,
            vram_used_gb,
            success: false,
        };
        
        {
            let mut records = self.execution_records.write().await;
            records.push_back(record);
        }
        
        self.record_vram_usage(vram_used_gb).await;
    }
    
    pub async fn record_vram_usage(&self, vram_used_gb: f64) {
        let record = VramUsageRecord {
            timestamp: Utc::now(),
            vram_used_gb,
        };
        
        {
            let mut records = self.vram_usage_records.write().await;
            records.push_back(record);
        }
    }
    
    pub async fn get_current_metrics(&self) -> PerformanceMetrics {
        // Return cached metrics if available and recent
        {
            let cached = self.cached_metrics.read().await;
            let last_calc = *self.last_calculation.read().await;
            
            if let Some(metrics) = cached.as_ref() {
                let age = Utc::now()
                    .signed_duration_since(last_calc)
                    .num_milliseconds();
                
                if age < (self.collection_interval_ms as i64) {
                    return metrics.clone();
                }
            }
        }
        
        // Calculate fresh metrics
        Self::calculate_metrics(
            &self.execution_records,
            &self.vram_usage_records,
            &self.total_tasks,
            &self.successful_tasks,
            &self.failed_tasks,
            self.start_time,
            self.max_records,
        ).await
    }
    
    pub async fn get_average_execution_time(&self) -> f64 {
        let records = self.execution_records.read().await;
        if records.is_empty() {
            return 0.0;
        }
        
        let sum: u64 = records.iter().map(|r| r.execution_time_ms).sum();
        sum as f64 / records.len() as f64
    }
    
    pub async fn get_peak_vram_usage(&self) -> f64 {
        let records = self.vram_usage_records.read().await;
        records
            .iter()
            .map(|r| r.vram_used_gb)
            .fold(0.0, |acc, x| acc.max(x))
    }
    
    pub async fn get_throughput(&self) -> f64 {
        let now = Utc::now();
        let uptime_minutes = now
            .signed_duration_since(self.start_time)
            .num_minutes() as f64;
        
        if uptime_minutes <= 0.0 {
            return 0.0;
        }
        
        let total = self.total_tasks.load(Ordering::Relaxed) as f64;
        total / uptime_minutes
    }
    
    async fn calculate_metrics(
        execution_records: &Arc<RwLock<VecDeque<TaskExecutionRecord>>>,
        vram_records: &Arc<RwLock<VecDeque<VramUsageRecord>>>,
        total_tasks: &Arc<AtomicU64>,
        successful_tasks: &Arc<AtomicU64>,
        failed_tasks: &Arc<AtomicU64>,
        start_time: DateTime<Utc>,
        _max_records: usize,
    ) -> PerformanceMetrics {
        let now = Utc::now();
        let uptime_seconds = now
            .signed_duration_since(start_time)
            .num_seconds() as u32;
        
        let total = total_tasks.load(Ordering::Relaxed) as u32;
        let successful = successful_tasks.load(Ordering::Relaxed) as u32;
        let failed = failed_tasks.load(Ordering::Relaxed) as u32;
        
        let error_rate = if total > 0 {
            (failed as f64 / total as f64) * 100.0
        } else {
            0.0
        };
        
        // Calculate execution time statistics
        let (avg_exec, median_exec, p95_exec, p99_exec) = {
            let records = execution_records.read().await;
            if records.is_empty() {
                (0.0, 0.0, 0.0, 0.0)
            } else {
                let mut times: Vec<u64> = records.iter().map(|r| r.execution_time_ms).collect();
                times.sort_unstable();
                
                let sum: u64 = times.iter().sum();
                let avg = sum as f64 / times.len() as f64;
                
                let median = Self::percentile(&times, 50.0);
                let p95 = Self::percentile(&times, 95.0);
                let p99 = Self::percentile(&times, 99.0);
                
                (avg, median, p95, p99)
            }
        };
        
        // Calculate VRAM usage statistics
        let (peak_vram, avg_vram, current_vram) = {
            let records = vram_records.read().await;
            if records.is_empty() {
                (0.0, 0.0, 0.0)
            } else {
                let peak = records.iter().map(|r| r.vram_used_gb).fold(0.0, |acc, x| acc.max(x));
                let sum: f64 = records.iter().map(|r| r.vram_used_gb).sum();
                let avg = sum / records.len() as f64;
                let current = records.back().map(|r| r.vram_used_gb).unwrap_or(0.0);
                
                (peak, avg, current)
            }
        };
        
        // Calculate throughput (tasks per minute)
        let throughput = if uptime_seconds > 0 {
            (total as f64 / uptime_seconds as f64) * 60.0
        } else {
            0.0
        };
        
        PerformanceMetrics {
            total_tasks_executed: total,
            successful_tasks: successful,
            failed_tasks: failed,
            average_execution_time_ms: avg_exec,
            median_execution_time_ms: median_exec,
            p95_execution_time_ms: p95_exec,
            p99_execution_time_ms: p99_exec,
            peak_vram_usage_gb: peak_vram,
            average_vram_usage_gb: avg_vram,
            current_vram_usage_gb: current_vram,
            throughput_tasks_per_minute: throughput,
            error_rate_percent: error_rate,
            uptime_seconds,
            last_updated: now.to_rfc3339(),
        }
    }
    
    async fn cleanup_old_records(
        records: &Arc<RwLock<VecDeque<TaskExecutionRecord>>>,
        max_records: usize,
    ) {
        let mut records = records.write().await;
        while records.len() > max_records {
            records.pop_front();
        }
    }
    
    async fn cleanup_old_records_vram(
        records: &Arc<RwLock<VecDeque<VramUsageRecord>>>,
        max_records: usize,
    ) {
        let mut records = records.write().await;
        while records.len() > max_records {
            records.pop_front();
        }
    }
    
    fn percentile(sorted_data: &[u64], percentile: f64) -> f64 {
        if sorted_data.is_empty() {
            return 0.0;
        }
        
        let index = (percentile / 100.0) * (sorted_data.len() - 1) as f64;
        let lower = index.floor() as usize;
        let upper = index.ceil() as usize;
        
        if lower == upper {
            sorted_data[lower] as f64
        } else {
            let weight = index - lower as f64;
            let lower_value = sorted_data[lower] as f64;
            let upper_value = sorted_data[upper] as f64;
            lower_value + weight * (upper_value - lower_value)
        }
    }
    
    pub async fn reset_metrics(&self) {
        self.total_tasks.store(0, Ordering::Relaxed);
        self.successful_tasks.store(0, Ordering::Relaxed);
        self.failed_tasks.store(0, Ordering::Relaxed);
        
        {
            let mut exec_records = self.execution_records.write().await;
            exec_records.clear();
        }
        
        {
            let mut vram_records = self.vram_usage_records.write().await;
            vram_records.clear();
        }
        
        {
            let mut cached = self.cached_metrics.write().await;
            *cached = None;
        }
        
        tracing::info!("Metrics reset");
    }
    
    pub async fn get_execution_history(&self, limit: Option<usize>) -> Vec<(String, u64, f64, bool)> {
        let records = self.execution_records.read().await;
        let limit = limit.unwrap_or(100).min(records.len());
        
        records
            .iter()
            .rev()
            .take(limit)
            .map(|r| {
                (
                    r.timestamp.to_rfc3339(),
                    r.execution_time_ms,
                    r.vram_used_gb,
                    r.success,
                )
            })
            .collect()
    }
    
    pub async fn get_vram_history(&self, limit: Option<usize>) -> Vec<(String, f64)> {
        let records = self.vram_usage_records.read().await;
        let limit = limit.unwrap_or(100).min(records.len());
        
        records
            .iter()
            .rev()
            .take(limit)
            .map(|r| (r.timestamp.to_rfc3339(), r.vram_used_gb))
            .collect()
    }
    
    pub async fn export_metrics_json(&self) -> String {
        let metrics = self.get_current_metrics().await;
        let execution_history = self.get_execution_history(Some(1000)).await;
        let vram_history = self.get_vram_history(Some(1000)).await;
        
        let export = serde_json::json!({
            "metrics": metrics,
            "execution_history": execution_history,
            "vram_history": vram_history,
            "exported_at": Utc::now().to_rfc3339()
        });
        
        serde_json::to_string_pretty(&export).unwrap_or_else(|_| "{}".to_string())
    }
}
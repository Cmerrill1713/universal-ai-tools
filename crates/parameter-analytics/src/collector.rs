use crate::database::DatabaseManager;
use crate::types::*;
use crate::AnalyticsError;
use arc_swap::ArcSwap;
use dashmap::DashMap;
use parking_lot::RwLock;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{interval, Instant};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

const BUFFER_SIZE: usize = 1000;
const FLUSH_INTERVAL_SECONDS: u64 = 30;
const MAX_BATCH_SIZE: usize = 100;

pub struct ExecutionCollector {
    database: Arc<DatabaseManager>,
    buffer: Arc<RwLock<Vec<ParameterExecution>>>,
    buffer_sender: mpsc::UnboundedSender<ParameterExecution>,
    buffer_receiver: Arc<RwLock<Option<mpsc::UnboundedReceiver<ParameterExecution>>>>,
    real_time_cache: Arc<DashMap<String, ParameterEffectiveness>>,
    metrics: Arc<ArcSwap<CollectorMetrics>>,
    config: CollectorConfig,
}

#[derive(Debug, Clone)]
pub struct CollectorConfig {
    pub buffer_size: usize,
    pub flush_interval: Duration,
    pub max_batch_size: usize,
    pub cache_expiry: Duration,
    pub enable_real_time_updates: bool,
    pub enable_metrics: bool,
}

impl Default for CollectorConfig {
    fn default() -> Self {
        Self {
            buffer_size: BUFFER_SIZE,
            flush_interval: Duration::from_secs(FLUSH_INTERVAL_SECONDS),
            max_batch_size: MAX_BATCH_SIZE,
            cache_expiry: Duration::from_secs(300), // 5 minutes
            enable_real_time_updates: true,
            enable_metrics: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CollectorMetrics {
    pub total_collected: u64,
    pub successful_flushes: u64,
    pub failed_flushes: u64,
    pub average_flush_time: f64,
    pub buffer_utilization: f64,
    pub cache_hit_rate: f64,
    pub last_flush: Option<chrono::DateTime<chrono::Utc>>,
}

impl Default for CollectorMetrics {
    fn default() -> Self {
        Self {
            total_collected: 0,
            successful_flushes: 0,
            failed_flushes: 0,
            average_flush_time: 0.0,
            buffer_utilization: 0.0,
            cache_hit_rate: 0.0,
            last_flush: None,
        }
    }
}

impl ExecutionCollector {
    pub fn new(database: Arc<DatabaseManager>, config: Option<CollectorConfig>) -> Self {
        let config = config.unwrap_or_default();
        let (buffer_sender, buffer_receiver) = mpsc::unbounded_channel();

        Self {
            database,
            buffer: Arc::new(RwLock::new(Vec::with_capacity(config.buffer_size))),
            buffer_sender,
            buffer_receiver: Arc::new(RwLock::new(Some(buffer_receiver))),
            real_time_cache: Arc::new(DashMap::new()),
            metrics: Arc::new(ArcSwap::new(Arc::new(CollectorMetrics::default()))),
            config,
        }
    }

    pub async fn start(&self) -> Result<(), AnalyticsError> {
        info!("Starting execution collector with config: {:?}", self.config);

        // Start the buffer processing task
        self.start_buffer_processor().await?;

        // Start periodic flush task
        self.start_periodic_flush().await;

        // Start cache cleanup task
        if self.config.enable_real_time_updates {
            self.start_cache_cleanup().await;
        }

        info!("Execution collector started successfully");
        Ok(())
    }

    pub async fn collect_execution(&self, execution: ParameterExecution) -> Result<(), AnalyticsError> {
        // Update metrics
        if self.config.enable_metrics {
            let mut metrics = (*self.metrics.load()).clone();
            metrics.total_collected += 1;
            self.metrics.store(Arc::new(metrics));
        }

        // Send to buffer processor
        self.buffer_sender.send(execution.clone())
            .map_err(|e| AnalyticsError::CacheError { 
                error: format!("Failed to send execution to buffer: {}", e) 
            })?;

        // Update real-time cache
        if self.config.enable_real_time_updates {
            self.update_real_time_cache(&execution).await;
        }

        debug!("Collected execution: {}", execution.id);
        Ok(())
    }

    pub async fn collect_execution_simple(
        &self,
        task_type: TaskType,
        user_input: String,
        parameters: TaskParameters,
        model: String,
        provider: String,
        request_id: String,
        execution_time: u64,
        token_usage: TokenUsage,
        success: bool,
    ) -> Result<String, AnalyticsError> {
        let execution_id = format!("exec_{}_{}", 
            chrono::Utc::now().timestamp_millis(), 
            Uuid::new_v4().simple()
        );

        let execution = ParameterExecution {
            id: execution_id.clone(),
            task_type,
            user_input,
            parameters,
            model,
            provider,
            user_id: None,
            request_id,
            timestamp: chrono::Utc::now(),
            execution_time,
            token_usage,
            response_length: 0, // Will be updated if available
            response_quality: None,
            user_satisfaction: None,
            success,
            error_type: None,
            retry_count: 0,
            complexity: Complexity::Medium, // Default complexity
            domain: None,
            endpoint: "unknown".to_string(),
        };

        self.collect_execution(execution).await?;
        Ok(execution_id)
    }

    pub async fn update_execution_feedback(
        &self,
        execution_id: &str,
        satisfaction: Option<f32>,
        quality_rating: Option<f32>,
    ) -> Result<(), AnalyticsError> {
        // Update in database
        self.database.update_execution_feedback(execution_id, satisfaction, quality_rating).await?;

        debug!("Updated feedback for execution: {}", execution_id);
        Ok(())
    }

    pub fn get_real_time_effectiveness(&self, task_type: TaskType) -> Vec<ParameterEffectiveness> {
        if !self.config.enable_real_time_updates {
            return Vec::new();
        }

        self.real_time_cache
            .iter()
            .filter_map(|entry| {
                let effectiveness = entry.value();
                if effectiveness.task_type == task_type {
                    Some(effectiveness.clone())
                } else {
                    None
                }
            })
            .collect()
    }

    pub fn get_collector_metrics(&self) -> CollectorMetrics {
        let metrics = self.metrics.load();
        let buffer_size = self.buffer.read().len();
        let mut updated_metrics = (**metrics).clone();
        updated_metrics.buffer_utilization = buffer_size as f64 / self.config.buffer_size as f64;
        updated_metrics
    }

    pub async fn force_flush(&self) -> Result<(), AnalyticsError> {
        self.flush_buffer().await
    }

    async fn start_buffer_processor(&self) -> Result<(), AnalyticsError> {
        let mut receiver = self.buffer_receiver.write()
            .take()
            .ok_or_else(|| AnalyticsError::ConfigError { 
                error: "Buffer processor already started".to_string() 
            })?;

        let buffer = self.buffer.clone();
        let config = self.config.clone();

        tokio::spawn(async move {
            while let Some(execution) = receiver.recv().await {
                let mut buffer_guard = buffer.write();
                buffer_guard.push(execution);

                // Check if buffer needs flushing
                if buffer_guard.len() >= config.max_batch_size {
                    drop(buffer_guard);
                    // Note: In a real implementation, we'd trigger a flush here
                    // For now, rely on periodic flush
                }
            }
        });

        Ok(())
    }

    async fn start_periodic_flush(&self) {
        let database = self.database.clone();
        let buffer = self.buffer.clone();
        let metrics = self.metrics.clone();
        let flush_interval = self.config.flush_interval;

        tokio::spawn(async move {
            let mut interval_timer = interval(flush_interval);
            
            loop {
                interval_timer.tick().await;
                
                let flush_start = Instant::now();
                let mut buffer_guard = buffer.write();
                
                if buffer_guard.is_empty() {
                    continue;
                }

                let executions: Vec<ParameterExecution> = buffer_guard.drain(..).collect();
                drop(buffer_guard);

                match database.batch_insert_executions(&executions).await {
                    Ok(_) => {
                        let flush_time = flush_start.elapsed().as_secs_f64();
                        
                        let mut current_metrics = (**metrics.load()).clone();
                        current_metrics.successful_flushes += 1;
                        current_metrics.average_flush_time = 
                            (current_metrics.average_flush_time * (current_metrics.successful_flushes - 1) as f64 + flush_time)
                            / current_metrics.successful_flushes as f64;
                        current_metrics.last_flush = Some(chrono::Utc::now());
                        metrics.store(Arc::new(current_metrics));

                        debug!("Flushed {} executions in {:.3}s", executions.len(), flush_time);
                    }
                    Err(e) => {
                        error!("Failed to flush executions: {}", e);
                        
                        let mut current_metrics = (**metrics.load()).clone();
                        current_metrics.failed_flushes += 1;
                        metrics.store(Arc::new(current_metrics));

                        // Put executions back in buffer for retry
                        let mut buffer_guard = buffer.write();
                        for execution in executions.into_iter().rev() {
                            buffer_guard.insert(0, execution);
                        }
                        
                        // Prevent buffer from growing too large
                        if buffer_guard.len() > buffer_guard.capacity() * 2 {
                            warn!("Buffer overflow, dropping oldest executions");
                            buffer_guard.truncate(buffer_guard.capacity());
                        }
                    }
                }
            }
        });
    }

    async fn start_cache_cleanup(&self) {
        let cache = self.real_time_cache.clone();
        let cache_expiry = self.config.cache_expiry;

        tokio::spawn(async move {
            let mut cleanup_interval = interval(Duration::from_secs(300)); // 5 minutes
            
            loop {
                cleanup_interval.tick().await;
                
                let cutoff_time = chrono::Utc::now() - chrono::Duration::from_std(cache_expiry).unwrap();
                let mut removed_count = 0;

                cache.retain(|_, effectiveness| {
                    if effectiveness.last_updated < cutoff_time {
                        removed_count += 1;
                        false
                    } else {
                        true
                    }
                });

                if removed_count > 0 {
                    debug!("Cleaned up {} expired cache entries", removed_count);
                }
            }
        });
    }

    async fn update_real_time_cache(&self, execution: &ParameterExecution) {
        let cache_key = format!("{}_{}", execution.task_type.as_str(), execution.parameter_hash());

        self.real_time_cache
            .entry(cache_key.clone())
            .and_modify(|effectiveness| {
                // Update existing entry
                let total = effectiveness.total_executions as f64;
                let new_total = total + 1.0;

                effectiveness.total_executions += 1;
                effectiveness.success_rate = (effectiveness.success_rate * total + if execution.success { 1.0 } else { 0.0 }) / new_total;
                effectiveness.avg_execution_time = (effectiveness.avg_execution_time * total + execution.execution_time as f64) / new_total;
                effectiveness.avg_token_usage = (effectiveness.avg_token_usage * total + execution.token_usage.total_tokens as f64) / new_total;
                
                if let Some(quality) = execution.response_quality {
                    effectiveness.avg_response_quality = (effectiveness.avg_response_quality * total + quality as f64) / new_total;
                }
                
                if let Some(satisfaction) = execution.user_satisfaction {
                    effectiveness.avg_user_satisfaction = (effectiveness.avg_user_satisfaction * total + satisfaction as f64) / new_total;
                }

                effectiveness.last_updated = chrono::Utc::now();
                effectiveness.confidence_score = (new_total / 100.0).min(0.95);
                effectiveness.sample_size_adequacy = new_total >= 10.0;
            })
            .or_insert_with(|| {
                // Create new entry
                ParameterEffectiveness {
                    task_type: execution.task_type,
                    parameter_set: execution.parameter_hash(),
                    parameters: execution.parameters.clone(),
                    total_executions: 1,
                    success_rate: if execution.success { 1.0 } else { 0.0 },
                    avg_execution_time: execution.execution_time as f64,
                    avg_token_usage: execution.token_usage.total_tokens as f64,
                    avg_response_quality: execution.response_quality.unwrap_or(0.0) as f64,
                    avg_user_satisfaction: execution.user_satisfaction.unwrap_or(0.0) as f64,
                    quality_trend: 0.0,
                    speed_trend: 0.0,
                    cost_efficiency_trend: 0.0,
                    execution_time_variance: 0.0,
                    quality_variance: 0.0,
                    p95_execution_time: execution.execution_time as f64,
                    p99_execution_time: execution.execution_time as f64,
                    last_updated: chrono::Utc::now(),
                    confidence_score: 0.1, // Low confidence with single data point
                    sample_size_adequacy: false,
                }
            });
    }

    async fn flush_buffer(&self) -> Result<(), AnalyticsError> {
        let mut buffer_guard = self.buffer.write();
        
        if buffer_guard.is_empty() {
            return Ok(());
        }

        let executions: Vec<ParameterExecution> = buffer_guard.drain(..).collect();
        drop(buffer_guard);

        self.database.batch_insert_executions(&executions).await?;

        // Update metrics
        if self.config.enable_metrics {
            let mut current_metrics = (**self.metrics.load()).clone();
            current_metrics.successful_flushes += 1;
            current_metrics.last_flush = Some(chrono::Utc::now());
            self.metrics.store(Arc::new(current_metrics));
        }

        info!("Force flushed {} executions", executions.len());
        Ok(())
    }
}
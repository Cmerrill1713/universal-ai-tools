use crate::config::Config;
use anyhow::Result;
use dashmap::DashMap;
use std::{collections::HashMap, sync::Arc, time::Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

pub struct MetricsCollector {
    config: Config,
    system_metrics: Arc<RwLock<SystemMetrics>>,
    model_metrics: Arc<DashMap<String, ModelMetrics>>,
    inference_metrics: Arc<RwLock<InferenceMetrics>>,
    training_metrics: Arc<RwLock<TrainingMetricsCollection>>,
    collection_start_time: Instant,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
struct SystemMetrics {
    memory_usage_bytes: u64,
    cpu_usage_percent: f64,
    gpu_usage_percent: Option<f64>,
    gpu_memory_usage_bytes: Option<u64>,
    disk_usage_bytes: u64,
    network_bytes_sent: u64,
    network_bytes_received: u64,
    uptime_seconds: u64,
    last_updated: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
struct ModelMetrics {
    model_id: String,
    load_count: u64,
    inference_count: u64,
    total_inference_time_ms: u64,
    average_inference_time_ms: f64,
    last_used: Option<chrono::DateTime<chrono::Utc>>,
    memory_usage_bytes: Option<u64>,
    error_count: u64,
    success_rate: f64,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
struct InferenceMetrics {
    total_requests: u64,
    successful_requests: u64,
    failed_requests: u64,
    average_latency_ms: f64,
    p95_latency_ms: f64,
    p99_latency_ms: f64,
    requests_per_second: f64,
    concurrent_requests: u64,
    queue_size: u64,
    last_updated: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
struct TrainingMetricsCollection {
    active_jobs: u64,
    completed_jobs: u64,
    failed_jobs: u64,
    total_training_time_hours: f64,
    average_job_completion_time_hours: f64,
    resource_utilization_percent: f64,
    last_updated: Option<chrono::DateTime<chrono::Utc>>,
}

impl MetricsCollector {
    pub async fn new(config: &Config) -> Result<Self> {
        Ok(Self {
            config: config.clone(),
            system_metrics: Arc::new(RwLock::new(SystemMetrics::default())),
            model_metrics: Arc::new(DashMap::new()),
            inference_metrics: Arc::new(RwLock::new(InferenceMetrics::default())),
            training_metrics: Arc::new(RwLock::new(TrainingMetricsCollection::default())),
            collection_start_time: Instant::now(),
        })
    }

    pub async fn start_collection(&self) {
        info!("Starting metrics collection");
        
        let system_metrics = self.system_metrics.clone();
        let config = self.config.clone();
        
        // System metrics collection task
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
            
            loop {
                interval.tick().await;
                
                if let Err(e) = Self::collect_system_metrics(system_metrics.clone()).await {
                    error!("Failed to collect system metrics: {}", e);
                }
            }
        });

        // Inference metrics aggregation task
        let inference_metrics = self.inference_metrics.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                
                if let Err(e) = Self::aggregate_inference_metrics(inference_metrics.clone()).await {
                    error!("Failed to aggregate inference metrics: {}", e);
                }
            }
        });

        // Training metrics aggregation task
        let training_metrics = self.training_metrics.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                
                if let Err(e) = Self::aggregate_training_metrics(training_metrics.clone()).await {
                    error!("Failed to aggregate training metrics: {}", e);
                }
            }
        });

        // Model metrics cleanup task
        let model_metrics = self.model_metrics.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(300)); // 5 minutes
            
            loop {
                interval.tick().await;
                
                Self::cleanup_stale_model_metrics(model_metrics.clone()).await;
            }
        });
    }

    async fn collect_system_metrics(system_metrics: Arc<RwLock<SystemMetrics>>) -> Result<()> {
        debug!("Collecting system metrics");
        
        let mut metrics = system_metrics.write().await;
        
        // Collect memory usage
        if let Ok(memory_info) = sys_info::mem_info() {
            let total_kb = memory_info.total;
            let available_kb = memory_info.avail;
            let used_kb = total_kb - available_kb;
            metrics.memory_usage_bytes = used_kb * 1024;
        }

        // Collect CPU usage
        if let Ok(load_avg) = sys_info::loadavg() {
            // Convert load average to rough CPU percentage (this is approximate)
            metrics.cpu_usage_percent = (load_avg.one * 100.0).min(100.0);
        }

        // Collect disk usage
        if let Ok(disk_info) = sys_info::disk_info() {
            let used_bytes = disk_info.total - disk_info.free;
            metrics.disk_usage_bytes = used_bytes;
        }

        // GPU metrics (if available) - would need GPU-specific libraries
        // For now, we'll simulate some values
        if cfg!(feature = "gpu-metrics") {
            metrics.gpu_usage_percent = Some(25.0); // Mock value
            metrics.gpu_memory_usage_bytes = Some(2_147_483_648); // Mock 2GB
        }

        // Network metrics (would need network interface libraries)
        // For now, we'll use mock values
        metrics.network_bytes_sent += 1024 * 1024; // Mock 1MB
        metrics.network_bytes_received += 2 * 1024 * 1024; // Mock 2MB

        // Uptime - using a simplified approach
        metrics.uptime_seconds = 3600; // Mock 1 hour uptime

        metrics.last_updated = Some(chrono::Utc::now());
        
        debug!("System metrics collected successfully");
        Ok(())
    }

    async fn aggregate_inference_metrics(inference_metrics: Arc<RwLock<InferenceMetrics>>) -> Result<()> {
        debug!("Aggregating inference metrics");
        
        let mut metrics = inference_metrics.write().await;
        
        // In a real implementation, these would be collected from actual inference operations
        // For now, we'll simulate some realistic metrics
        
        metrics.total_requests += 100; // Mock: 100 requests in last minute
        metrics.successful_requests += 95; // Mock: 95% success rate
        metrics.failed_requests += 5;
        
        // Calculate success rate
        if metrics.total_requests > 0 {
            metrics.requests_per_second = metrics.total_requests as f64 / 60.0; // Last minute
            metrics.average_latency_ms = 150.0 + (rand::random::<f64>() - 0.5) * 50.0;
            metrics.p95_latency_ms = metrics.average_latency_ms * 1.5;
            metrics.p99_latency_ms = metrics.average_latency_ms * 2.0;
        }
        
        metrics.concurrent_requests = 10 + (rand::random::<u64>() % 20); // Mock 10-30 concurrent
        metrics.queue_size = if metrics.concurrent_requests > 25 { 5 } else { 0 };
        metrics.last_updated = Some(chrono::Utc::now());
        
        debug!("Inference metrics aggregated successfully");
        Ok(())
    }

    async fn aggregate_training_metrics(training_metrics: Arc<RwLock<TrainingMetricsCollection>>) -> Result<()> {
        debug!("Aggregating training metrics");
        
        let mut metrics = training_metrics.write().await;
        
        // In a real implementation, these would be collected from training coordinator
        // For now, we'll simulate some realistic metrics
        
        use rand::Rng;
        let mut rng = rand::thread_rng();
        
        metrics.active_jobs = 2 + (rng.gen::<u64>() % 3); // Mock 2-4 active jobs
        metrics.resource_utilization_percent = 60.0 + (rng.gen::<f64>() * 30.0);
        
        // Simulate job completions
        if rng.gen::<f64>() > 0.8 { // 20% chance of job completion per minute
            metrics.completed_jobs += 1;
            metrics.total_training_time_hours += 2.5; // Mock average 2.5 hours per job
            
            if metrics.completed_jobs > 0 {
                metrics.average_job_completion_time_hours = 
                    metrics.total_training_time_hours / metrics.completed_jobs as f64;
            }
        }
        
        // Simulate occasional failures
        if rng.gen::<f64>() > 0.95 { // 5% chance of job failure per minute
            metrics.failed_jobs += 1;
        }
        
        metrics.last_updated = Some(chrono::Utc::now());
        
        debug!("Training metrics aggregated successfully");
        Ok(())
    }

    async fn cleanup_stale_model_metrics(model_metrics: Arc<DashMap<String, ModelMetrics>>) {
        debug!("Cleaning up stale model metrics");
        
        let cutoff = chrono::Utc::now() - chrono::Duration::hours(24);
        let mut removed_count = 0;
        
        let stale_models: Vec<String> = model_metrics.iter()
            .filter_map(|entry| {
                if let Some(last_used) = entry.value().last_used {
                    if last_used < cutoff {
                        Some(entry.key().clone())
                    } else {
                        None
                    }
                } else {
                    // Remove metrics without last_used timestamp
                    Some(entry.key().clone())
                }
            })
            .collect();

        for model_id in stale_models {
            model_metrics.remove(&model_id);
            removed_count += 1;
        }

        if removed_count > 0 {
            debug!("Cleaned up {} stale model metrics", removed_count);
        }
    }

    pub async fn record_model_inference(&self, model_id: &str, duration_ms: u64, success: bool) {
        let model_id = model_id.to_string();
        
        self.model_metrics.entry(model_id.clone())
            .and_modify(|metrics| {
                metrics.inference_count += 1;
                metrics.total_inference_time_ms += duration_ms;
                metrics.average_inference_time_ms = 
                    metrics.total_inference_time_ms as f64 / metrics.inference_count as f64;
                metrics.last_used = Some(chrono::Utc::now());
                
                if !success {
                    metrics.error_count += 1;
                }
                
                metrics.success_rate = 
                    (metrics.inference_count - metrics.error_count) as f64 / metrics.inference_count as f64;
            })
            .or_insert_with(|| {
                ModelMetrics {
                    model_id: model_id.clone(),
                    load_count: 0,
                    inference_count: 1,
                    total_inference_time_ms: duration_ms,
                    average_inference_time_ms: duration_ms as f64,
                    last_used: Some(chrono::Utc::now()),
                    memory_usage_bytes: None,
                    error_count: if success { 0 } else { 1 },
                    success_rate: if success { 1.0 } else { 0.0 },
                }
            });
    }

    pub async fn record_model_load(&self, model_id: &str, memory_usage_bytes: Option<u64>) {
        let model_id = model_id.to_string();
        
        self.model_metrics.entry(model_id.clone())
            .and_modify(|metrics| {
                metrics.load_count += 1;
                metrics.memory_usage_bytes = memory_usage_bytes;
                metrics.last_used = Some(chrono::Utc::now());
            })
            .or_insert_with(|| {
                ModelMetrics {
                    model_id: model_id.clone(),
                    load_count: 1,
                    inference_count: 0,
                    total_inference_time_ms: 0,
                    average_inference_time_ms: 0.0,
                    last_used: Some(chrono::Utc::now()),
                    memory_usage_bytes,
                    error_count: 0,
                    success_rate: 1.0,
                }
            });
    }

    pub async fn get_all_metrics(&self) -> Result<HashMap<String, serde_json::Value>> {
        let mut all_metrics = HashMap::new();
        
        // System metrics
        let system_metrics = self.system_metrics.read().await;
        all_metrics.insert("system".to_string(), serde_json::to_value(&*system_metrics)?);
        
        // Inference metrics
        let inference_metrics = self.inference_metrics.read().await;
        all_metrics.insert("inference".to_string(), serde_json::to_value(&*inference_metrics)?);
        
        // Training metrics
        let training_metrics = self.training_metrics.read().await;
        all_metrics.insert("training".to_string(), serde_json::to_value(&*training_metrics)?);
        
        // Model metrics summary
        let model_count = self.model_metrics.len();
        let total_inferences: u64 = self.model_metrics.iter()
            .map(|entry| entry.value().inference_count)
            .sum();
        
        all_metrics.insert("models".to_string(), serde_json::json!({
            "total_models": model_count,
            "total_inferences": total_inferences,
            "active_models": self.model_metrics.iter()
                .filter(|entry| {
                    entry.value().last_used.map_or(false, |last_used| {
                        chrono::Utc::now() - last_used < chrono::Duration::hours(1)
                    })
                })
                .count()
        }));
        
        // Service uptime
        all_metrics.insert("service".to_string(), serde_json::json!({
            "uptime_seconds": self.collection_start_time.elapsed().as_secs(),
            "start_time": chrono::Utc::now() - chrono::Duration::seconds(self.collection_start_time.elapsed().as_secs() as i64)
        }));
        
        Ok(all_metrics)
    }

    pub async fn get_model_metrics(&self, model_id: &str) -> Result<HashMap<String, serde_json::Value>> {
        if let Some(metrics) = self.model_metrics.get(model_id) {
            let metrics_json = serde_json::to_value(&*metrics)?;
            let mut result = HashMap::new();
            result.insert("model_metrics".to_string(), metrics_json);
            Ok(result)
        } else {
            Ok(HashMap::new())
        }
    }

    pub async fn get_summary_metrics(&self) -> Result<serde_json::Value> {
        let system_metrics = self.system_metrics.read().await;
        let inference_metrics = self.inference_metrics.read().await;
        let training_metrics = self.training_metrics.read().await;
        
        Ok(serde_json::json!({
            "timestamp": chrono::Utc::now(),
            "service_uptime_seconds": self.collection_start_time.elapsed().as_secs(),
            "system": {
                "memory_usage_gb": system_metrics.memory_usage_bytes as f64 / (1024.0 * 1024.0 * 1024.0),
                "cpu_usage_percent": system_metrics.cpu_usage_percent,
                "disk_usage_gb": system_metrics.disk_usage_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
            },
            "inference": {
                "requests_per_second": inference_metrics.requests_per_second,
                "average_latency_ms": inference_metrics.average_latency_ms,
                "success_rate": if inference_metrics.total_requests > 0 {
                    inference_metrics.successful_requests as f64 / inference_metrics.total_requests as f64
                } else {
                    1.0
                }
            },
            "training": {
                "active_jobs": training_metrics.active_jobs,
                "resource_utilization_percent": training_metrics.resource_utilization_percent,
                "average_job_time_hours": training_metrics.average_job_completion_time_hours
            },
            "models": {
                "total_loaded": self.model_metrics.len(),
                "total_inferences": self.model_metrics.iter()
                    .map(|entry| entry.value().inference_count)
                    .sum::<u64>()
            }
        }))
    }

    pub async fn reset_metrics(&self) -> Result<()> {
        info!("Resetting all metrics");
        
        // Reset system metrics
        let mut system_metrics = self.system_metrics.write().await;
        *system_metrics = SystemMetrics::default();
        
        // Reset inference metrics
        let mut inference_metrics = self.inference_metrics.write().await;
        *inference_metrics = InferenceMetrics::default();
        
        // Reset training metrics
        let mut training_metrics = self.training_metrics.write().await;
        *training_metrics = TrainingMetricsCollection::default();
        
        // Clear model metrics
        self.model_metrics.clear();
        
        info!("All metrics have been reset");
        Ok(())
    }
}
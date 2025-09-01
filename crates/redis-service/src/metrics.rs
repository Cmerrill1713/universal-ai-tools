use crate::types::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info};

pub struct MetricsCollector {
    operation_metrics: Arc<RwLock<HashMap<String, OperationMetrics>>>,
    cache_statistics: Arc<RwLock<CacheStatistics>>,
    start_time: Instant,
    collection_interval: Duration,
}

impl MetricsCollector {
    pub fn new(collection_interval: Duration) -> Self {
        Self {
            operation_metrics: Arc::new(RwLock::new(HashMap::new())),
            cache_statistics: Arc::new(RwLock::new(CacheStatistics::new())),
            start_time: Instant::now(),
            collection_interval,
        }
    }

    pub async fn record_operation(
        &self,
        operation_type: &str,
        duration: Duration,
        success: bool,
        timeout: bool,
    ) {
        let mut metrics = self.operation_metrics.write().await;
        
        let entry = metrics.entry(operation_type.to_string())
            .or_insert_with(|| OperationMetrics::new(operation_type.to_string()));
        
        entry.count += 1;
        entry.total_duration += duration;
        
        if entry.min_duration.is_none() || duration < entry.min_duration.unwrap() {
            entry.min_duration = Some(duration);
        }
        
        if entry.max_duration.is_none() || duration > entry.max_duration.unwrap() {
            entry.max_duration = Some(duration);
        }
        
        if success {
            entry.success_count += 1;
        } else {
            entry.failure_count += 1;
        }
        
        if timeout {
            entry.timeout_count += 1;
        }
        
        entry.recalculate_averages();
        
        debug!(
            "Recorded {} operation: duration={:?}, success={}, timeout={}",
            operation_type, duration, success, timeout
        );
    }

    pub async fn record_cache_hit(&self) {
        let mut stats = self.cache_statistics.write().await;
        stats.hit_count += 1;
        stats.recalculate_rates();
    }

    pub async fn record_cache_miss(&self) {
        let mut stats = self.cache_statistics.write().await;
        stats.miss_count += 1;
        stats.recalculate_rates();
    }

    pub async fn record_eviction(&self) {
        let mut stats = self.cache_statistics.write().await;
        stats.eviction_count += 1;
    }

    pub async fn record_compression(&self, original_size: usize, compressed_size: usize) {
        let mut stats = self.cache_statistics.write().await;
        stats.compression_count += 1;
        
        // Update compression ratio
        let ratio = compressed_size as f64 / original_size as f64;
        if stats.compression_ratio == 0.0 {
            stats.compression_ratio = ratio;
        } else {
            // Moving average
            stats.compression_ratio = (stats.compression_ratio * 0.9) + (ratio * 0.1);
        }
    }

    pub async fn record_decompression(&self) {
        let mut stats = self.cache_statistics.write().await;
        stats.decompression_count += 1;
    }

    pub async fn update_cache_size(&self, total_entries: usize, total_size_bytes: usize) {
        let mut stats = self.cache_statistics.write().await;
        stats.total_entries = total_entries;
        stats.total_size_bytes = total_size_bytes;
        
        if total_entries > 0 {
            stats.average_entry_size = total_size_bytes as f64 / total_entries as f64;
        }
    }

    pub async fn get_operation_metrics(&self) -> HashMap<String, OperationMetrics> {
        self.operation_metrics.read().await.clone()
    }

    pub async fn get_cache_statistics(&self) -> CacheStatistics {
        let mut stats = self.cache_statistics.read().await.clone();
        stats.uptime = chrono::Duration::from_std(self.start_time.elapsed())
            .unwrap_or(chrono::Duration::seconds(0));
        stats
    }

    pub async fn get_summary(&self) -> MetricsSummary {
        let operation_metrics = self.get_operation_metrics().await;
        let cache_statistics = self.get_cache_statistics().await;
        
        let total_operations: u64 = operation_metrics.values().map(|m| m.count).sum();
        let total_successes: u64 = operation_metrics.values().map(|m| m.success_count).sum();
        let total_failures: u64 = operation_metrics.values().map(|m| m.failure_count).sum();
        let total_timeouts: u64 = operation_metrics.values().map(|m| m.timeout_count).sum();
        
        let avg_duration = if total_operations > 0 {
            let total_duration: Duration = operation_metrics.values()
                .map(|m| m.total_duration)
                .sum();
            total_duration / total_operations as u32
        } else {
            Duration::from_millis(0)
        };
        
        MetricsSummary {
            total_operations,
            total_successes,
            total_failures,
            total_timeouts,
            success_rate: if total_operations > 0 {
                total_successes as f64 / total_operations as f64
            } else {
                0.0
            },
            average_operation_duration: avg_duration,
            cache_hit_rate: cache_statistics.hit_rate,
            cache_miss_rate: cache_statistics.miss_rate,
            compression_ratio: cache_statistics.compression_ratio,
            total_cache_entries: cache_statistics.total_entries,
            total_cache_size_bytes: cache_statistics.total_size_bytes,
            uptime: cache_statistics.uptime,
        }
    }

    pub async fn reset_metrics(&self) {
        let mut operation_metrics = self.operation_metrics.write().await;
        let mut cache_statistics = self.cache_statistics.write().await;
        
        operation_metrics.clear();
        *cache_statistics = CacheStatistics::new();
        
        info!("Metrics reset");
    }

    pub async fn export_prometheus(&self) -> String {
        let summary = self.get_summary().await;
        let mut output = String::new();
        
        // Operation metrics
        output.push_str("# HELP redis_service_operations_total Total number of operations\n");
        output.push_str("# TYPE redis_service_operations_total counter\n");
        output.push_str(&format!("redis_service_operations_total {}\n", summary.total_operations));
        
        output.push_str("# HELP redis_service_success_rate Operation success rate\n");
        output.push_str("# TYPE redis_service_success_rate gauge\n");
        output.push_str(&format!("redis_service_success_rate {}\n", summary.success_rate));
        
        // Cache metrics
        output.push_str("# HELP redis_service_cache_hit_rate Cache hit rate\n");
        output.push_str("# TYPE redis_service_cache_hit_rate gauge\n");
        output.push_str(&format!("redis_service_cache_hit_rate {}\n", summary.cache_hit_rate));
        
        output.push_str("# HELP redis_service_cache_size_bytes Total cache size in bytes\n");
        output.push_str("# TYPE redis_service_cache_size_bytes gauge\n");
        output.push_str(&format!("redis_service_cache_size_bytes {}\n", summary.total_cache_size_bytes));
        
        output.push_str("# HELP redis_service_compression_ratio Average compression ratio\n");
        output.push_str("# TYPE redis_service_compression_ratio gauge\n");
        output.push_str(&format!("redis_service_compression_ratio {}\n", summary.compression_ratio));
        
        // Per-operation metrics
        let operation_metrics = self.get_operation_metrics().await;
        for (op_type, metrics) in operation_metrics {
            let op_label = op_type.to_lowercase().replace(" ", "_");
            
            output.push_str(&format!(
                "redis_service_operation_count{{operation=\"{}\"}} {}\n",
                op_label, metrics.count
            ));
            
            output.push_str(&format!(
                "redis_service_operation_success_rate{{operation=\"{}\"}} {}\n",
                op_label, metrics.success_rate
            ));
            
            if let Some(avg) = metrics.avg_duration {
                output.push_str(&format!(
                    "redis_service_operation_duration_seconds{{operation=\"{}\"}} {}\n",
                    op_label, avg.as_secs_f64()
                ));
            }
        }
        
        output
    }
}

#[derive(Debug, Clone)]
pub struct MetricsSummary {
    pub total_operations: u64,
    pub total_successes: u64,
    pub total_failures: u64,
    pub total_timeouts: u64,
    pub success_rate: f64,
    pub average_operation_duration: Duration,
    pub cache_hit_rate: f64,
    pub cache_miss_rate: f64,
    pub compression_ratio: f64,
    pub total_cache_entries: usize,
    pub total_cache_size_bytes: usize,
    pub uptime: chrono::Duration,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_metrics_collection() {
        let collector = MetricsCollector::new(Duration::from_secs(60));
        
        // Record some operations
        collector.record_operation("get", Duration::from_millis(10), true, false).await;
        collector.record_operation("get", Duration::from_millis(20), true, false).await;
        collector.record_operation("get", Duration::from_millis(15), false, false).await;
        collector.record_operation("set", Duration::from_millis(5), true, false).await;
        
        // Record cache events
        collector.record_cache_hit().await;
        collector.record_cache_hit().await;
        collector.record_cache_miss().await;
        
        // Get metrics
        let operation_metrics = collector.get_operation_metrics().await;
        assert_eq!(operation_metrics.get("get").unwrap().count, 3);
        assert_eq!(operation_metrics.get("get").unwrap().success_count, 2);
        assert_eq!(operation_metrics.get("set").unwrap().count, 1);
        
        let cache_stats = collector.get_cache_statistics().await;
        assert_eq!(cache_stats.hit_count, 2);
        assert_eq!(cache_stats.miss_count, 1);
        assert!(cache_stats.hit_rate > 0.6);
    }

    #[tokio::test]
    async fn test_prometheus_export() {
        let collector = MetricsCollector::new(Duration::from_secs(60));
        
        collector.record_operation("get", Duration::from_millis(10), true, false).await;
        collector.record_cache_hit().await;
        
        let prometheus_output = collector.export_prometheus().await;
        assert!(prometheus_output.contains("redis_service_operations_total"));
        assert!(prometheus_output.contains("redis_service_cache_hit_rate"));
    }
}
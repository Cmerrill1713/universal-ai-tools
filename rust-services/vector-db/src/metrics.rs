// Metrics and monitoring service for the vector database
// Provides Prometheus metrics, performance tracking, and observability

use anyhow::Result;
use parking_lot::RwLock;
use prometheus::{
    Gauge, HistogramVec, IntCounter, IntCounterVec,
    IntGauge, IntGaugeVec, Registry, TextEncoder, Encoder,
};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::types::{VectorMetrics, PerformanceMetrics};

/// Metrics service for collecting and exposing performance data
#[derive(Debug)]
pub struct MetricsService {
    registry: Registry,

    // Vector operation metrics
    vector_operations_total: IntCounterVec,
    vector_search_duration: HistogramVec,
    vector_insert_duration: HistogramVec,
    active_vectors: IntGauge,

    // Index metrics
    index_operations_total: IntCounterVec,
    index_size_bytes: IntGaugeVec,
    index_build_duration: HistogramVec,

    // GPU metrics
    gpu_operations_total: IntCounter,
    gpu_utilization: Gauge,
    gpu_memory_usage: Gauge,

    // Storage metrics
    storage_operations_total: IntCounterVec,
    storage_duration: HistogramVec,
    storage_size_bytes: IntGauge,

    // Cache metrics
    cache_operations_total: IntCounterVec,
    cache_hit_rate: Gauge,
    cache_size: IntGauge,

    // System metrics
    memory_usage_bytes: Gauge,
    cpu_usage_percent: Gauge,
    request_duration: HistogramVec,
    concurrent_requests: IntGauge,

    // Performance tracking
    performance_data: Arc<RwLock<PerformanceData>>,
}

/// Internal performance data tracking
#[derive(Debug, Default)]
struct PerformanceData {
    search_times: Vec<f64>,
    insert_times: Vec<f64>,
    total_searches: u64,
    total_inserts: u64,
    cache_hits: u64,
    cache_misses: u64,
    start_time: Option<Instant>,
    // Memory bandwidth tracking
    memory_operations: Vec<(Instant, usize)>, // (timestamp, bytes_transferred)
    total_memory_bytes: u64,
}

impl PerformanceData {
    fn add_search_time(&mut self, duration: f64) {
        self.search_times.push(duration);
        self.total_searches += 1;

        // Keep only recent measurements (last 1000)
        if self.search_times.len() > 1000 {
            self.search_times.remove(0);
        }
    }

    fn add_insert_time(&mut self, duration: f64) {
        self.insert_times.push(duration);
        self.total_inserts += 1;

        // Keep only recent measurements (last 1000)
        if self.insert_times.len() > 1000 {
            self.insert_times.remove(0);
        }
    }

    fn record_memory_operation(&mut self, bytes: usize) {
        let now = Instant::now();
        self.memory_operations.push((now, bytes));
        self.total_memory_bytes += bytes as u64;

        // Keep only recent memory operations (last 1000)
        if self.memory_operations.len() > 1000 {
            self.memory_operations.remove(0);
        }
    }

    fn calculate_memory_bandwidth(&self) -> f64 {
        let now = Instant::now();
        let window_duration = Duration::from_secs(60); // 1 minute window

        // Calculate memory bandwidth over the last minute
        let recent_operations: Vec<&(Instant, usize)> = self.memory_operations
            .iter()
            .filter(|(timestamp, _)| now.duration_since(*timestamp) <= window_duration)
            .collect();

        if recent_operations.is_empty() {
            return 0.0;
        }

        let total_bytes: usize = recent_operations.iter().map(|(_, bytes)| bytes).sum();
        let window_seconds = window_duration.as_secs_f64();

        // Convert to MB/s
        (total_bytes as f64 / window_seconds) / (1024.0 * 1024.0)
    }

    fn calculate_percentile(values: &[f64], percentile: f64) -> f64 {
        if values.is_empty() {
            return 0.0;
        }

        let mut sorted = values.to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let index = (percentile / 100.0 * (sorted.len() - 1) as f64) as usize;
        sorted[index.min(sorted.len() - 1)]
    }

    fn get_performance_metrics(&self) -> PerformanceMetrics {
        let avg_search_time = if self.search_times.is_empty() {
            0.0
        } else {
            self.search_times.iter().sum::<f64>() / self.search_times.len() as f64
        };

        let p95_search_time = Self::calculate_percentile(&self.search_times, 95.0);
        let p99_search_time = Self::calculate_percentile(&self.search_times, 99.0);

        let uptime_seconds = self.start_time
            .map(|start| start.elapsed().as_secs_f64())
            .unwrap_or(0.0);

        let throughput = if uptime_seconds > 0.0 {
            self.total_searches as f64 / uptime_seconds
        } else {
            0.0
        };

        PerformanceMetrics {
            avg_search_time_ms: avg_search_time,
            p95_search_time_ms: p95_search_time,
            p99_search_time_ms: p99_search_time,
            throughput_ops_per_sec: throughput,
            memory_bandwidth_mb_per_sec: self.calculate_memory_bandwidth(),
        }
    }
}

impl MetricsService {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();

        // Vector operation metrics
        let vector_operations_total = IntCounterVec::new(
            prometheus::Opts::new("vector_operations_total", "Total number of vector operations"),
            &["operation_type", "status"],
        )?;
        registry.register(Box::new(vector_operations_total.clone()))?;

        let vector_search_duration = HistogramVec::new(
            prometheus::HistogramOpts::new("vector_search_duration_seconds", "Vector search duration"),
            &["index_type", "similarity_metric"],
        )?;
        registry.register(Box::new(vector_search_duration.clone()))?;

        let vector_insert_duration = HistogramVec::new(
            prometheus::HistogramOpts::new("vector_insert_duration_seconds", "Vector insert duration"),
            &["batch_size"],
        )?;
        registry.register(Box::new(vector_insert_duration.clone()))?;

        let active_vectors = IntGauge::new("active_vectors", "Number of vectors in the database")?;
        registry.register(Box::new(active_vectors.clone()))?;

        // Index metrics
        let index_operations_total = IntCounterVec::new(
            prometheus::Opts::new("index_operations_total", "Total number of index operations"),
            &["operation", "index_type"],
        )?;
        registry.register(Box::new(index_operations_total.clone()))?;

        let index_size_bytes = IntGaugeVec::new(
            prometheus::Opts::new("index_size_bytes", "Size of indexes in bytes"),
            &["index_name", "index_type"],
        )?;
        registry.register(Box::new(index_size_bytes.clone()))?;

        let index_build_duration = HistogramVec::new(
            prometheus::HistogramOpts::new("index_build_duration_seconds", "Index build duration"),
            &["index_type"],
        )?;
        registry.register(Box::new(index_build_duration.clone()))?;

        // GPU metrics
        let gpu_operations_total = IntCounter::new("gpu_operations_total", "Total GPU operations")?;
        registry.register(Box::new(gpu_operations_total.clone()))?;

        let gpu_utilization = Gauge::new("gpu_utilization_percent", "GPU utilization percentage")?;
        registry.register(Box::new(gpu_utilization.clone()))?;

        let gpu_memory_usage = Gauge::new("gpu_memory_usage_bytes", "GPU memory usage in bytes")?;
        registry.register(Box::new(gpu_memory_usage.clone()))?;

        // Storage metrics
        let storage_operations_total = IntCounterVec::new(
            prometheus::Opts::new("storage_operations_total", "Total storage operations"),
            &["operation", "backend"],
        )?;
        registry.register(Box::new(storage_operations_total.clone()))?;

        let storage_duration = HistogramVec::new(
            prometheus::HistogramOpts::new("storage_duration_seconds", "Storage operation duration"),
            &["operation", "backend"],
        )?;
        registry.register(Box::new(storage_duration.clone()))?;

        let storage_size_bytes = IntGauge::new("storage_size_bytes", "Total storage size in bytes")?;
        registry.register(Box::new(storage_size_bytes.clone()))?;

        // Cache metrics
        let cache_operations_total = IntCounterVec::new(
            prometheus::Opts::new("cache_operations_total", "Total cache operations"),
            &["operation", "result"],
        )?;
        registry.register(Box::new(cache_operations_total.clone()))?;

        let cache_hit_rate = Gauge::new("cache_hit_rate", "Cache hit rate percentage")?;
        registry.register(Box::new(cache_hit_rate.clone()))?;

        let cache_size = IntGauge::new("cache_size", "Number of items in cache")?;
        registry.register(Box::new(cache_size.clone()))?;

        // System metrics
        let memory_usage_bytes = Gauge::new("memory_usage_bytes", "Memory usage in bytes")?;
        registry.register(Box::new(memory_usage_bytes.clone()))?;

        let cpu_usage_percent = Gauge::new("cpu_usage_percent", "CPU usage percentage")?;
        registry.register(Box::new(cpu_usage_percent.clone()))?;

        let request_duration = HistogramVec::new(
            prometheus::HistogramOpts::new("http_request_duration_seconds", "HTTP request duration"),
            &["method", "endpoint", "status"],
        )?;
        registry.register(Box::new(request_duration.clone()))?;

        let concurrent_requests = IntGauge::new("concurrent_requests", "Number of concurrent requests")?;
        registry.register(Box::new(concurrent_requests.clone()))?;

        let mut performance_data = PerformanceData::default();
        performance_data.start_time = Some(Instant::now());

        Ok(Self {
            registry,
            vector_operations_total,
            vector_search_duration,
            vector_insert_duration,
            active_vectors,
            index_operations_total,
            index_size_bytes,
            index_build_duration,
            gpu_operations_total,
            gpu_utilization,
            gpu_memory_usage,
            storage_operations_total,
            storage_duration,
            storage_size_bytes,
            cache_operations_total,
            cache_hit_rate,
            cache_size,
            memory_usage_bytes,
            cpu_usage_percent,
            request_duration,
            concurrent_requests,
            performance_data: Arc::new(RwLock::new(performance_data)),
        })
    }

    /// Record a vector search operation
    pub fn record_search(&self, duration: Duration, index_type: &str, metric: &str, success: bool) {
        let status = if success { "success" } else { "error" };

        self.vector_operations_total
            .with_label_values(&["search", status])
            .inc();

        self.vector_search_duration
            .with_label_values(&[index_type, metric])
            .observe(duration.as_secs_f64());

        self.performance_data
            .write()
            .add_search_time(duration.as_millis() as f64);
    }

    /// Record a vector insert operation
    pub fn record_insert(&self, duration: Duration, batch_size: usize, success: bool) {
        let status = if success { "success" } else { "error" };

        self.vector_operations_total
            .with_label_values(&["insert", status])
            .inc();

        self.vector_insert_duration
            .with_label_values(&[&batch_size.to_string()])
            .observe(duration.as_secs_f64());

        self.performance_data
            .write()
            .add_insert_time(duration.as_millis() as f64);
    }

    /// Record GPU operation
    pub fn record_gpu_operation(&self) {
        self.gpu_operations_total.inc();
    }


    /// Record search time (synchronous)
    pub fn record_search_time(&self, duration: Duration) {
        self.performance_data
            .write()
            .add_search_time(duration.as_millis() as f64);
    }

    /// Update GPU utilization
    pub fn update_gpu_utilization(&self, utilization: f64) {
        self.gpu_utilization.set(utilization);
    }

    /// Update GPU memory usage
    pub fn update_gpu_memory(&self, bytes: f64) {
        self.gpu_memory_usage.set(bytes);
    }

    /// Record storage operation
    pub fn record_storage_operation(&self, operation: &str, backend: &str, duration: Duration, success: bool) {
        let _status = if success { "success" } else { "error" };

        self.storage_operations_total
            .with_label_values(&[operation, backend])
            .inc();

        self.storage_duration
            .with_label_values(&[operation, backend])
            .observe(duration.as_secs_f64());
    }

    /// Record cache operation
    pub fn record_cache_hit(&self) {
        self.cache_operations_total
            .with_label_values(&["get", "hit"])
            .inc();

        self.performance_data.write().cache_hits += 1;
        self.update_cache_hit_rate();
    }

    /// Record cache miss
    pub fn record_cache_miss(&self) {
        self.cache_operations_total
            .with_label_values(&["get", "miss"])
            .inc();

        self.performance_data.write().cache_misses += 1;
        self.update_cache_hit_rate();
    }

    /// Update cache hit rate
    fn update_cache_hit_rate(&self) {
        let data = self.performance_data.read();
        let total = data.cache_hits + data.cache_misses;

        if total > 0 {
            let hit_rate = (data.cache_hits as f64 / total as f64) * 100.0;
            self.cache_hit_rate.set(hit_rate);
        }
    }

    /// Update vector count
    pub fn update_vector_count(&self, count: i64) {
        self.active_vectors.set(count);
    }

    /// Update index size
    pub fn update_index_size(&self, index_name: &str, index_type: &str, size_bytes: i64) {
        self.index_size_bytes
            .with_label_values(&[index_name, index_type])
            .set(size_bytes);
    }

    /// Record index build operation
    pub fn record_index_build(&self, index_type: &str, duration: Duration, success: bool) {
        let _status = if success { "success" } else { "error" };

        self.index_operations_total
            .with_label_values(&["build", index_type])
            .inc();

        self.index_build_duration
            .with_label_values(&[index_type])
            .observe(duration.as_secs_f64());
    }

    /// Record HTTP request
    pub fn record_request(&self, method: &str, endpoint: &str, status: u16, duration: Duration) {
        self.request_duration
            .with_label_values(&[method, endpoint, &status.to_string()])
            .observe(duration.as_secs_f64());
    }

    /// Increment concurrent requests counter
    pub fn inc_concurrent_requests(&self) {
        self.concurrent_requests.inc();
    }

    /// Decrement concurrent requests counter
    pub fn dec_concurrent_requests(&self) {
        self.concurrent_requests.dec();
    }

    /// Update system memory usage
    pub fn update_memory_usage(&self, bytes: f64) {
        self.memory_usage_bytes.set(bytes);
    }

    /// Update CPU usage
    pub fn update_cpu_usage(&self, percent: f64) {
        self.cpu_usage_percent.set(percent);
    }

    /// Record memory operation for bandwidth calculation
    pub fn record_memory_operation(&self, bytes: usize) {
        if let Ok(mut data) = self.performance_data.write() {
            data.record_memory_operation(bytes);
        }
    }

    /// Get comprehensive vector metrics
    pub fn get_vector_metrics(&self, total_vectors: usize, index_size_bytes: usize) -> VectorMetrics {
        let performance = self.performance_data.read().get_performance_metrics();
        let data = self.performance_data.read();

        let hit_rate = {
            let total = data.cache_hits + data.cache_misses;
            if total > 0 {
                (data.cache_hits as f32 / total as f32) * 100.0
            } else {
                0.0
            }
        };

        VectorMetrics {
            total_vectors,
            index_size_bytes,
            average_search_time_ms: performance.avg_search_time_ms,
            total_searches: data.total_searches,
            total_inserts: data.total_inserts,
            cache_hit_rate: hit_rate,
            gpu_utilization: Some(self.gpu_utilization.get() as f32),
        }
    }

    /// Export metrics in Prometheus format
    pub fn export_metrics(&self) -> Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut output = Vec::new();
        encoder.encode(&metric_families, &mut output)?;
        Ok(String::from_utf8(output)?)
    }

    /// Start background metrics collection
    pub async fn start_background_collection(&self) {
        let memory_gauge = self.memory_usage_bytes.clone();
        let cpu_gauge = self.cpu_usage_percent.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));

            loop {
                interval.tick().await;

                // Update system metrics
                if let Ok(memory) = get_memory_usage_bytes() {
                    memory_gauge.set(memory);
                }

                if let Ok(cpu) = get_cpu_usage_percent() {
                    cpu_gauge.set(cpu);
                }
            }
        });
    }
}

/// Get current memory usage in bytes
fn get_memory_usage_bytes() -> Result<f64> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("ps")
            .args(&["-o", "rss=", "-p"])
            .arg(std::process::id().to_string())
            .output()?;

        let memory_kb = String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse::<f64>()?;

        Ok(memory_kb * 1024.0) // Convert KB to bytes
    }

    #[cfg(not(target_os = "macos"))]
    Ok(0.0) // Fallback for other platforms
}

/// Get current CPU usage percentage
fn get_cpu_usage_percent() -> Result<f64> {
    // This is a simplified implementation
    // For production, you'd want to use proper system monitoring libraries
    Ok(0.0) // Placeholder
}

/// Metrics middleware for HTTP requests
pub struct MetricsMiddleware {
    metrics: Arc<MetricsService>,
}

impl MetricsMiddleware {
    pub fn new(metrics: Arc<MetricsService>) -> Self {
        Self { metrics }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_metrics_service_creation() {
        let metrics = MetricsService::new().unwrap();
        assert!(!metrics.export_metrics().unwrap().is_empty());
    }

    #[test]
    fn test_search_metrics() {
        let metrics = MetricsService::new().unwrap();

        metrics.record_search(Duration::from_millis(100), "hnsw", "cosine", true); // cspell:disable-line
        metrics.record_search(Duration::from_millis(150), "lsh", "euclidean", false);

        let exported = metrics.export_metrics().unwrap();
        assert!(exported.contains("vector_operations_total"));
        assert!(exported.contains("vector_search_duration_seconds"));
    }

    #[test]
    fn test_cache_metrics() {
        let metrics = MetricsService::new().unwrap();

        metrics.record_cache_hit();
        metrics.record_cache_hit();
        metrics.record_cache_miss();

        // Hit rate should be 66.67%
        let hit_rate = metrics.cache_hit_rate.get();
        assert!((hit_rate - 66.67).abs() < 0.1);
    }

    #[test]
    fn test_performance_data() {
        let mut perf_data = PerformanceData::default();

        perf_data.add_search_time(100.0);
        perf_data.add_search_time(200.0);
        perf_data.add_search_time(300.0);

        let metrics = perf_data.get_performance_metrics();
        assert_eq!(metrics.avg_search_time_ms, 200.0);
    }
}

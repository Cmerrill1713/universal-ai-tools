//! Metrics Collection - Prometheus metrics for AI Core service

use prometheus::{
    Counter, Gauge, GaugeVec, Histogram, HistogramVec, IntCounter, IntCounterVec,
    IntGauge, IntGaugeVec, Registry,
};

/// Comprehensive metrics collection for AI Core service
pub struct Metrics {
    pub registry: Registry,
    
    // Request metrics
    pub requests_total: IntCounterVec,
    pub requests_duration: HistogramVec,
    pub inference_duration: HistogramVec,
    pub tokens_processed_total: IntCounterVec,
    
    // Provider metrics
    pub provider_requests_total: IntCounterVec,
    pub provider_errors_total: IntCounterVec,
    pub provider_latency: HistogramVec,
    pub provider_health: IntGaugeVec,
    
    // Model metrics
    pub models_loaded: IntGauge,
    pub model_load_duration: HistogramVec,
    pub model_memory_usage: GaugeVec,
    pub model_requests_total: IntCounterVec,
    
    // Memory metrics
    pub memory_usage_bytes: Gauge,
    pub memory_available_bytes: Gauge,
    pub memory_optimizations_total: IntCounter,
    pub memory_freed_bytes_total: Counter,
    pub gc_duration_seconds: Histogram,
    pub gc_count_total: IntCounter,
    
    // Cache metrics
    pub cache_hits_total: IntCounterVec,
    pub cache_misses_total: IntCounterVec,
    pub cache_size_bytes: GaugeVec,
    pub cache_evictions_total: IntCounterVec,
    
    // System metrics
    pub cpu_usage_percent: Gauge,
    pub uptime_seconds: IntGauge,
    pub health_checks_total: IntCounter,
    pub connections_active: IntGauge,
    
    // Error metrics
    pub errors_total: IntCounterVec,
    pub timeouts_total: IntCounterVec,
    pub rate_limits_total: IntCounterVec,
    
    // Performance metrics
    pub response_size_bytes: Histogram,
    pub concurrent_requests: IntGauge,
    pub queue_depth: IntGauge,
}

impl Metrics {
    /// Create new metrics registry
    pub fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let registry = Registry::new();

        // Request metrics
        let requests_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_requests_total", "Total number of requests processed"),
            &["status", "provider"],
        )?;

        let requests_duration = HistogramVec::new(
            prometheus::HistogramOpts::new("ai_core_request_duration_seconds", "Request duration in seconds"),
            &["method", "status"],
        )?;

        let inference_duration = HistogramVec::new(
            prometheus::HistogramOpts::new("ai_core_inference_duration_seconds", "Inference duration in seconds")
                .buckets(vec![0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]),
            &["provider"],
        )?;

        let tokens_processed_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_tokens_processed_total", "Total tokens processed"),
            &["provider"],
        )?;

        // Provider metrics
        let provider_requests_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_provider_requests_total", "Total requests per provider"),
            &["provider", "model"],
        )?;

        let provider_errors_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_provider_errors_total", "Total errors per provider"),
            &["provider", "error_type"],
        )?;

        let provider_latency = HistogramVec::new(
            prometheus::HistogramOpts::new("ai_core_provider_latency_seconds", "Provider response latency")
                .buckets(vec![0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]),
            &["provider"],
        )?;

        let provider_health = IntGaugeVec::new(
            prometheus::Opts::new("ai_core_provider_health", "Provider health status (1=healthy, 0=unhealthy)"),
            &["provider"],
        )?;

        // Model metrics
        let models_loaded = IntGauge::new(
            "ai_core_models_loaded",
            "Number of models currently loaded in memory",
        )?;

        let model_load_duration = HistogramVec::new(
            prometheus::HistogramOpts::new("ai_core_model_load_duration_seconds", "Model loading duration")
                .buckets(vec![1.0, 5.0, 10.0, 30.0, 60.0, 180.0, 300.0]),
            &["model"],
        )?;

        let model_memory_usage = GaugeVec::new(
            prometheus::Opts::new("ai_core_model_memory_bytes", "Memory usage per model"),
            &["model"],
        )?;

        let model_requests_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_model_requests_total", "Total requests per model"),
            &["model", "provider"],
        )?;

        // Memory metrics
        let memory_usage_bytes = Gauge::new(
            "ai_core_memory_usage_bytes",
            "Current memory usage in bytes",
        )?;

        let memory_available_bytes = Gauge::new(
            "ai_core_memory_available_bytes",
            "Available memory in bytes",
        )?;

        let memory_optimizations_total = IntCounter::new(
            "ai_core_memory_optimizations_total",
            "Total number of memory optimizations performed",
        )?;

        let memory_freed_bytes_total = Counter::new(
            "ai_core_memory_freed_bytes_total",
            "Total bytes freed by memory optimizations",
        )?;

        let gc_duration_seconds = Histogram::with_opts(
            prometheus::HistogramOpts::new("ai_core_gc_duration_seconds", "Garbage collection duration")
                .buckets(vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]),
        )?;

        let gc_count_total = IntCounter::new(
            "ai_core_gc_count_total",
            "Total number of garbage collections",
        )?;

        // Cache metrics
        let cache_hits_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_cache_hits_total", "Total cache hits"),
            &["cache_type"],
        )?;

        let cache_misses_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_cache_misses_total", "Total cache misses"),
            &["cache_type"],
        )?;

        let cache_size_bytes = GaugeVec::new(
            prometheus::Opts::new("ai_core_cache_size_bytes", "Cache size in bytes"),
            &["cache_type"],
        )?;

        let cache_evictions_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_cache_evictions_total", "Total cache evictions"),
            &["cache_type"],
        )?;

        // System metrics
        let cpu_usage_percent = Gauge::new(
            "ai_core_cpu_usage_percent",
            "CPU usage percentage",
        )?;

        let uptime_seconds = IntGauge::new(
            "ai_core_uptime_seconds",
            "Service uptime in seconds",
        )?;

        let health_checks_total = IntCounter::new(
            "ai_core_health_checks_total",
            "Total health checks performed",
        )?;

        let connections_active = IntGauge::new(
            "ai_core_connections_active",
            "Number of active connections",
        )?;

        // Error metrics
        let errors_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_errors_total", "Total errors by type"),
            &["error_type", "component"],
        )?;

        let timeouts_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_timeouts_total", "Total timeouts by component"),
            &["component"],
        )?;

        let rate_limits_total = IntCounterVec::new(
            prometheus::Opts::new("ai_core_rate_limits_total", "Total rate limit hits"),
            &["provider"],
        )?;

        // Performance metrics
        let response_size_bytes = Histogram::with_opts(
            prometheus::HistogramOpts::new("ai_core_response_size_bytes", "Response size in bytes")
                .buckets(vec![100.0, 1000.0, 10000.0, 100000.0, 1000000.0]),
        )?;

        let concurrent_requests = IntGauge::new(
            "ai_core_concurrent_requests",
            "Number of concurrent requests being processed",
        )?;

        let queue_depth = IntGauge::new(
            "ai_core_queue_depth",
            "Current queue depth for pending requests",
        )?;

        // Register all metrics
        registry.register(Box::new(requests_total.clone()))?;
        registry.register(Box::new(requests_duration.clone()))?;
        registry.register(Box::new(inference_duration.clone()))?;
        registry.register(Box::new(tokens_processed_total.clone()))?;
        
        registry.register(Box::new(provider_requests_total.clone()))?;
        registry.register(Box::new(provider_errors_total.clone()))?;
        registry.register(Box::new(provider_latency.clone()))?;
        registry.register(Box::new(provider_health.clone()))?;
        
        registry.register(Box::new(models_loaded.clone()))?;
        registry.register(Box::new(model_load_duration.clone()))?;
        registry.register(Box::new(model_memory_usage.clone()))?;
        registry.register(Box::new(model_requests_total.clone()))?;
        
        registry.register(Box::new(memory_usage_bytes.clone()))?;
        registry.register(Box::new(memory_available_bytes.clone()))?;
        registry.register(Box::new(memory_optimizations_total.clone()))?;
        registry.register(Box::new(memory_freed_bytes_total.clone()))?;
        registry.register(Box::new(gc_duration_seconds.clone()))?;
        registry.register(Box::new(gc_count_total.clone()))?;
        
        registry.register(Box::new(cache_hits_total.clone()))?;
        registry.register(Box::new(cache_misses_total.clone()))?;
        registry.register(Box::new(cache_size_bytes.clone()))?;
        registry.register(Box::new(cache_evictions_total.clone()))?;
        
        registry.register(Box::new(cpu_usage_percent.clone()))?;
        registry.register(Box::new(uptime_seconds.clone()))?;
        registry.register(Box::new(health_checks_total.clone()))?;
        registry.register(Box::new(connections_active.clone()))?;
        
        registry.register(Box::new(errors_total.clone()))?;
        registry.register(Box::new(timeouts_total.clone()))?;
        registry.register(Box::new(rate_limits_total.clone()))?;
        
        registry.register(Box::new(response_size_bytes.clone()))?;
        registry.register(Box::new(concurrent_requests.clone()))?;
        registry.register(Box::new(queue_depth.clone()))?;

        Ok(Metrics {
            registry,
            requests_total,
            requests_duration,
            inference_duration,
            tokens_processed_total,
            provider_requests_total,
            provider_errors_total,
            provider_latency,
            provider_health,
            models_loaded,
            model_load_duration,
            model_memory_usage,
            model_requests_total,
            memory_usage_bytes,
            memory_available_bytes,
            memory_optimizations_total,
            memory_freed_bytes_total,
            gc_duration_seconds,
            gc_count_total,
            cache_hits_total,
            cache_misses_total,
            cache_size_bytes,
            cache_evictions_total,
            cpu_usage_percent,
            uptime_seconds,
            health_checks_total,
            connections_active,
            errors_total,
            timeouts_total,
            rate_limits_total,
            response_size_bytes,
            concurrent_requests,
            queue_depth,
        })
    }

    /// Record a successful request
    pub fn record_request_success(&self, provider: &str, duration_seconds: f64, tokens: u64) {
        self.requests_total
            .with_label_values(&["success", provider])
            .inc();
        
        self.inference_duration
            .with_label_values(&[provider])
            .observe(duration_seconds);
        
        self.tokens_processed_total
            .with_label_values(&[provider])
            .inc_by(tokens);
    }

    /// Record a failed request
    pub fn record_request_error(&self, provider: &str, error_type: &str) {
        self.requests_total
            .with_label_values(&["error", provider])
            .inc();
        
        self.provider_errors_total
            .with_label_values(&[provider, error_type])
            .inc();
    }

    /// Record provider health status
    pub fn record_provider_health(&self, provider: &str, healthy: bool) {
        self.provider_health
            .with_label_values(&[provider])
            .set(if healthy { 1 } else { 0 });
    }

    /// Record model loading
    pub fn record_model_load(&self, model: &str, duration_seconds: f64, memory_bytes: f64) {
        self.model_load_duration
            .with_label_values(&[model])
            .observe(duration_seconds);
        
        self.model_memory_usage
            .with_label_values(&[model])
            .set(memory_bytes);
        
        self.models_loaded.inc();
    }

    /// Record model unloading
    pub fn record_model_unload(&self, model: &str) {
        self.model_memory_usage
            .with_label_values(&[model])
            .set(0.0);
        
        self.models_loaded.dec();
    }

    /// Record memory optimization
    pub fn record_memory_optimization(&self, freed_bytes: f64) {
        self.memory_optimizations_total.inc();
        self.memory_freed_bytes_total.inc_by(freed_bytes);
    }

    /// Record garbage collection
    pub fn record_gc(&self, duration_seconds: f64) {
        self.gc_count_total.inc();
        self.gc_duration_seconds.observe(duration_seconds);
    }

    /// Record cache hit
    pub fn record_cache_hit(&self, cache_type: &str) {
        self.cache_hits_total
            .with_label_values(&[cache_type])
            .inc();
    }

    /// Record cache miss
    pub fn record_cache_miss(&self, cache_type: &str) {
        self.cache_misses_total
            .with_label_values(&[cache_type])
            .inc();
    }

    /// Update memory usage
    pub fn update_memory_usage(&self, usage_bytes: f64, available_bytes: f64) {
        self.memory_usage_bytes.set(usage_bytes);
        self.memory_available_bytes.set(available_bytes);
    }

    /// Update CPU usage
    pub fn update_cpu_usage(&self, percent: f64) {
        self.cpu_usage_percent.set(percent);
    }

    /// Update uptime
    pub fn update_uptime(&self, seconds: i64) {
        self.uptime_seconds.set(seconds);
    }

    /// Record concurrent request change
    pub fn add_concurrent_request(&self) {
        self.concurrent_requests.inc();
    }

    pub fn remove_concurrent_request(&self) {
        self.concurrent_requests.dec();
    }

    /// Update queue depth
    pub fn update_queue_depth(&self, depth: i64) {
        self.queue_depth.set(depth);
    }

    /// Record timeout
    pub fn record_timeout(&self, component: &str) {
        self.timeouts_total
            .with_label_values(&[component])
            .inc();
    }

    /// Record rate limit hit
    pub fn record_rate_limit(&self, provider: &str) {
        self.rate_limits_total
            .with_label_values(&[provider])
            .inc();
    }

    /// Record response size
    pub fn record_response_size(&self, bytes: f64) {
        self.response_size_bytes.observe(bytes);
    }

    /// Get metrics summary
    pub fn get_summary(&self) -> MetricsSummary {
        // In a real implementation, this would gather current metric values
        MetricsSummary {
            total_requests: 0, // Would get from actual metric
            total_errors: 0,
            average_latency_ms: 0.0,
            memory_usage_mb: 0.0,
            models_loaded: 0,
            cache_hit_rate: 0.0,
        }
    }
}

/// Summary of key metrics
#[derive(Debug, Clone, serde::Serialize)]
pub struct MetricsSummary {
    pub total_requests: u64,
    pub total_errors: u64,
    pub average_latency_ms: f64,
    pub memory_usage_mb: f64,
    pub models_loaded: i64,
    pub cache_hit_rate: f64,
}
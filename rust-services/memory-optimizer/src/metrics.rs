//! Prometheus metrics for Memory Optimization Service

use prometheus::{Counter, Gauge, Histogram, HistogramOpts, Opts, Registry};

pub struct Metrics {
    pub registry: Registry,
    
    // Request metrics
    pub health_checks_total: Counter,
    pub analysis_requests_total: Counter,
    pub optimization_requests_total: Counter,
    pub analysis_errors_total: Counter,
    pub optimization_errors_total: Counter,
    
    // Performance metrics
    pub analysis_duration_seconds: Histogram,
    pub optimization_duration_seconds: Histogram,
    
    // Memory metrics
    pub current_memory_mb: Gauge,
    pub memory_pressure: Gauge,
    pub memory_freed_mb: Histogram,
    pub gc_operations_total: Counter,
    pub gc_duration_seconds: Histogram,
    
    // Service health metrics
    pub monitored_services_count: Gauge,
    pub unhealthy_services_count: Gauge,
    pub optimization_recommendations_total: Counter,
}

impl Metrics {
    pub fn new() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let registry = Registry::new();
        
        // Request metrics
        let health_checks_total = Counter::with_opts(Opts::new(
            "memory_optimizer_health_checks_total",
            "Total number of health checks performed"
        ))?;
        
        let analysis_requests_total = Counter::with_opts(Opts::new(
            "memory_optimizer_analysis_requests_total",
            "Total number of memory analysis requests"
        ))?;
        
        let optimization_requests_total = Counter::with_opts(Opts::new(
            "memory_optimizer_optimization_requests_total",
            "Total number of optimization requests"
        ))?;
        
        let analysis_errors_total = Counter::with_opts(Opts::new(
            "memory_optimizer_analysis_errors_total",
            "Total number of analysis errors"
        ))?;
        
        let optimization_errors_total = Counter::with_opts(Opts::new(
            "memory_optimizer_optimization_errors_total",
            "Total number of optimization errors"
        ))?;
        
        // Performance metrics
        let analysis_duration_seconds = Histogram::with_opts(HistogramOpts::new(
            "memory_optimizer_analysis_duration_seconds",
            "Time spent analyzing memory usage"
        ))?;
        
        let optimization_duration_seconds = Histogram::with_opts(HistogramOpts::new(
            "memory_optimizer_optimization_duration_seconds",
            "Time spent optimizing memory"
        ))?;
        
        // Memory metrics
        let current_memory_mb = Gauge::with_opts(Opts::new(
            "memory_optimizer_current_memory_mb",
            "Current system memory usage in MB"
        ))?;
        
        let memory_pressure = Gauge::with_opts(Opts::new(
            "memory_optimizer_memory_pressure",
            "Current memory pressure (0.0 to 1.0)"
        ))?;
        
        let memory_freed_mb = Histogram::with_opts(HistogramOpts::new(
            "memory_optimizer_memory_freed_mb",
            "Amount of memory freed during optimization in MB"
        ))?;
        
        let gc_operations_total = Counter::with_opts(Opts::new(
            "memory_optimizer_gc_operations_total",
            "Total number of garbage collection operations triggered"
        ))?;
        
        let gc_duration_seconds = Histogram::with_opts(HistogramOpts::new(
            "memory_optimizer_gc_duration_seconds",
            "Time spent in garbage collection operations"
        ))?;
        
        // Service health metrics
        let monitored_services_count = Gauge::with_opts(Opts::new(
            "memory_optimizer_monitored_services_count",
            "Number of services being monitored"
        ))?;
        
        let unhealthy_services_count = Gauge::with_opts(Opts::new(
            "memory_optimizer_unhealthy_services_count",
            "Number of services with memory issues"
        ))?;
        
        let optimization_recommendations_total = Counter::with_opts(Opts::new(
            "memory_optimizer_recommendations_total",
            "Total number of optimization recommendations generated"
        ))?;
        
        // Register all metrics
        registry.register(Box::new(health_checks_total.clone()))?;
        registry.register(Box::new(analysis_requests_total.clone()))?;
        registry.register(Box::new(optimization_requests_total.clone()))?;
        registry.register(Box::new(analysis_errors_total.clone()))?;
        registry.register(Box::new(optimization_errors_total.clone()))?;
        registry.register(Box::new(analysis_duration_seconds.clone()))?;
        registry.register(Box::new(optimization_duration_seconds.clone()))?;
        registry.register(Box::new(current_memory_mb.clone()))?;
        registry.register(Box::new(memory_pressure.clone()))?;
        registry.register(Box::new(memory_freed_mb.clone()))?;
        registry.register(Box::new(gc_operations_total.clone()))?;
        registry.register(Box::new(gc_duration_seconds.clone()))?;
        registry.register(Box::new(monitored_services_count.clone()))?;
        registry.register(Box::new(unhealthy_services_count.clone()))?;
        registry.register(Box::new(optimization_recommendations_total.clone()))?;
        
        Ok(Metrics {
            registry,
            health_checks_total,
            analysis_requests_total,
            optimization_requests_total,
            analysis_errors_total,
            optimization_errors_total,
            analysis_duration_seconds,
            optimization_duration_seconds,
            current_memory_mb,
            memory_pressure,
            memory_freed_mb,
            gc_operations_total,
            gc_duration_seconds,
            monitored_services_count,
            unhealthy_services_count,
            optimization_recommendations_total,
        })
    }
}
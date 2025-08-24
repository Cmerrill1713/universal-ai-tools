//! Prometheus metrics for the LLM Router service

use prometheus::{
    CounterVec, GaugeVec, HistogramVec, Registry, Opts, Counter, Gauge, Histogram,
};

/// Metrics collection for the LLM Router service
pub struct Metrics {
    pub registry: Registry,
    
    // Request metrics
    pub requests_total: CounterVec,
    pub request_duration: HistogramVec,
    pub request_tokens: HistogramVec,
    
    // Provider metrics
    pub provider_requests: CounterVec,
    pub provider_latency: HistogramVec,
    pub provider_errors: CounterVec,
    
    // Circuit breaker metrics
    pub circuit_breaker_state: GaugeVec,
    pub circuit_breaker_trips: CounterVec,
    
    // System metrics
    pub healthy_providers: Gauge,
    pub active_connections: Gauge,
    pub memory_usage: Gauge,
    pub health_checks_total: Counter,
    
    // Routing metrics
    pub routing_decisions: CounterVec,
    pub routing_latency: Histogram,
}

impl Metrics {
    pub fn new() -> Result<Self, prometheus::Error> {
        let registry = Registry::new();

        // Request metrics
        let requests_total = CounterVec::new(
            Opts::new("llm_router_requests_total", "Total number of LLM requests"),
            &["status", "provider"],
        )?;

        let request_duration = HistogramVec::new(
            prometheus::HistogramOpts::new(
                "llm_router_request_duration_seconds",
                "Request duration in seconds",
            ),
            &["provider"],
        )?;

        let request_tokens = HistogramVec::new(
            prometheus::HistogramOpts::new(
                "llm_router_request_tokens",
                "Number of tokens processed per request",
            )
            .buckets(vec![10.0, 50.0, 100.0, 500.0, 1000.0, 2000.0, 5000.0, 10000.0]),
            &["provider", "model"],
        )?;

        // Provider metrics
        let provider_requests = CounterVec::new(
            Opts::new("llm_router_provider_requests_total", "Requests per provider"),
            &["provider", "model"],
        )?;

        let provider_latency = HistogramVec::new(
            prometheus::HistogramOpts::new(
                "llm_router_provider_latency_seconds",
                "Provider response latency",
            ),
            &["provider"],
        )?;

        let provider_errors = CounterVec::new(
            Opts::new("llm_router_provider_errors_total", "Provider error count"),
            &["provider", "error_type"],
        )?;

        // Circuit breaker metrics
        let circuit_breaker_state = GaugeVec::new(
            Opts::new("llm_router_circuit_breaker_state", "Circuit breaker state (0=closed, 1=half-open, 2=open)"),
            &["provider"],
        )?;

        let circuit_breaker_trips = CounterVec::new(
            Opts::new("llm_router_circuit_breaker_trips_total", "Circuit breaker trip count"),
            &["provider"],
        )?;

        // System metrics
        let healthy_providers = Gauge::new(
            "llm_router_healthy_providers",
            "Number of healthy providers",
        )?;

        let active_connections = Gauge::new(
            "llm_router_active_connections",
            "Number of active connections",
        )?;

        let memory_usage = Gauge::new(
            "llm_router_memory_usage_bytes",
            "Memory usage in bytes",
        )?;

        let health_checks_total = Counter::new(
            "llm_router_health_checks_total",
            "Total number of health checks performed",
        )?;

        // Routing metrics
        let routing_decisions = CounterVec::new(
            Opts::new("llm_router_routing_decisions_total", "Routing decisions by strategy"),
            &["strategy", "provider"],
        )?;

        let routing_latency = Histogram::with_opts(
            prometheus::HistogramOpts::new(
                "llm_router_routing_latency_seconds",
                "Time spent on routing decisions",
            )
            .buckets(vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]),
        )?;

        // Register all metrics
        registry.register(Box::new(requests_total.clone()))?;
        registry.register(Box::new(request_duration.clone()))?;
        registry.register(Box::new(request_tokens.clone()))?;
        registry.register(Box::new(provider_requests.clone()))?;
        registry.register(Box::new(provider_latency.clone()))?;
        registry.register(Box::new(provider_errors.clone()))?;
        registry.register(Box::new(circuit_breaker_state.clone()))?;
        registry.register(Box::new(circuit_breaker_trips.clone()))?;
        registry.register(Box::new(healthy_providers.clone()))?;
        registry.register(Box::new(active_connections.clone()))?;
        registry.register(Box::new(memory_usage.clone()))?;
        registry.register(Box::new(health_checks_total.clone()))?;
        registry.register(Box::new(routing_decisions.clone()))?;
        registry.register(Box::new(routing_latency.clone()))?;

        Ok(Self {
            registry,
            requests_total,
            request_duration,
            request_tokens,
            provider_requests,
            provider_latency,
            provider_errors,
            circuit_breaker_state,
            circuit_breaker_trips,
            healthy_providers,
            active_connections,
            memory_usage,
            health_checks_total,
            routing_decisions,
            routing_latency,
        })
    }

    /// Update memory usage metrics
    pub fn update_memory_usage(&self) {
        #[cfg(feature = "jemalloc")]
        {
            use tikv_jemalloc_ctl::{stats, epoch};
            
            if let (Ok(allocated), Ok(_)) = (epoch::advance(), stats::allocated::read()) {
                self.memory_usage.set(allocated as f64);
            }
        }
    }

    /// Record circuit breaker state change
    pub fn record_circuit_breaker_state(&self, provider: &str, state: u8) {
        self.circuit_breaker_state
            .with_label_values(&[provider])
            .set(state as f64);
    }

    /// Record circuit breaker trip
    pub fn record_circuit_breaker_trip(&self, provider: &str) {
        self.circuit_breaker_trips
            .with_label_values(&[provider])
            .inc();
    }

    /// Record routing decision
    pub fn record_routing_decision(&self, strategy: &str, provider: &str) {
        self.routing_decisions
            .with_label_values(&[strategy, provider])
            .inc();
    }

    /// Record provider error
    pub fn record_provider_error(&self, provider: &str, error_type: &str) {
        self.provider_errors
            .with_label_values(&[provider, error_type])
            .inc();
    }
}
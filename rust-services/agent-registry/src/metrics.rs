//! Prometheus metrics for the Agent Registry Service

use anyhow::Result;
use prometheus::{
    Gauge, Histogram, IntCounter, IntGauge, Registry, TextEncoder,
    opts, register_gauge_with_registry,
    register_histogram_with_registry, register_int_counter_with_registry,
    register_int_gauge_with_registry,
};
use std::sync::Arc;

/// Metrics collection for the Agent Registry service
pub struct Metrics {
    /// Prometheus metrics registry
    pub registry: Arc<Registry>,
    
    // HTTP metrics
    /// Total HTTP requests received
    pub http_requests_total: IntCounter,
    /// HTTP request duration
    pub http_request_duration_seconds: Histogram,
    /// HTTP responses by status code
    pub http_responses_total: IntCounter,

    // Agent metrics
    /// Total agent registrations
    pub agent_registrations_total: IntCounter,
    /// Agent registration errors
    pub agent_registration_errors_total: IntCounter,
    /// Agent unregistrations
    pub agent_unregistrations_total: IntCounter,
    /// Agent updates
    pub agent_updates_total: IntCounter,
    /// Total registered agents
    pub registered_agents_total: Gauge,
    /// Active agents
    pub active_agents_total: Gauge,
    /// Inactive agents
    pub inactive_agents_total: Gauge,
    /// Busy agents
    pub busy_agents_total: Gauge,
    /// Error state agents
    pub error_agents_total: Gauge,

    // Execution metrics
    /// Total agent executions
    pub agent_executions_total: IntCounter,
    /// Agent execution errors
    pub agent_execution_errors_total: IntCounter,
    /// Agent execution duration
    pub agent_execution_duration_seconds: Histogram,
    /// Concurrent executions gauge
    pub concurrent_executions: IntGauge,
    /// Agent execution queue length
    pub execution_queue_length: IntGauge,

    // Health check metrics
    /// Total health checks performed
    pub health_checks_total: IntCounter,
    /// Health check failures
    pub health_check_failures_total: IntCounter,
    /// Health check duration
    pub health_check_duration_seconds: Histogram,

    // Database metrics
    /// Database connection pool size
    pub db_connections_total: IntGauge,
    /// Database connection pool active connections
    pub db_connections_active: IntGauge,
    /// Database query duration
    pub db_query_duration_seconds: Histogram,
    /// Database operation errors
    pub db_errors_total: IntCounter,

    // Cache metrics
    /// Cache hits
    pub cache_hits_total: IntCounter,
    /// Cache misses
    pub cache_misses_total: IntCounter,
    /// Cache size
    pub cache_size: IntGauge,
    /// Cache evictions
    pub cache_evictions_total: IntCounter,

    // System metrics
    /// Memory usage in bytes
    pub memory_usage_bytes: Gauge,
    /// CPU usage percentage
    pub cpu_usage_percent: Gauge,
    /// Goroutines/async tasks count
    pub async_tasks_total: IntGauge,
    /// Open file descriptors
    pub open_file_descriptors: IntGauge,

    // Business metrics
    /// Agent list requests
    pub agent_list_requests_total: IntCounter,
    /// Agent search requests
    pub agent_search_requests_total: IntCounter,
    /// Workflow executions
    pub workflow_executions_total: IntCounter,
    /// Workflow execution errors
    pub workflow_execution_errors_total: IntCounter,

    // Performance metrics
    /// Response time percentiles
    pub response_time_p50: Gauge,
    pub response_time_p95: Gauge,
    pub response_time_p99: Gauge,
    /// Throughput (requests per second)
    pub throughput_rps: Gauge,
    /// Error rate percentage
    pub error_rate_percent: Gauge,
}

impl Metrics {
    /// Create a new metrics instance
    pub fn new() -> Result<Self> {
        let registry = Arc::new(Registry::new());

        // HTTP metrics
        let http_requests_total = register_int_counter_with_registry!(
            opts!("agent_registry_http_requests_total", "Total HTTP requests received"),
            registry.clone()
        )?;

        let http_request_duration_seconds = register_histogram_with_registry!(
            "agent_registry_http_request_duration_seconds",
            "HTTP request duration in seconds",
            vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
            registry.clone()
        )?;

        let http_responses_total = register_int_counter_with_registry!(
            opts!("agent_registry_http_responses_total", "Total HTTP responses by status code"),
            registry.clone()
        )?;

        // Agent metrics
        let agent_registrations_total = register_int_counter_with_registry!(
            opts!("agent_registry_registrations_total", "Total agent registrations"),
            registry.clone()
        )?;

        let agent_registration_errors_total = register_int_counter_with_registry!(
            opts!("agent_registry_registration_errors_total", "Agent registration errors"),
            registry.clone()
        )?;

        let agent_unregistrations_total = register_int_counter_with_registry!(
            opts!("agent_registry_unregistrations_total", "Total agent unregistrations"),
            registry.clone()
        )?;

        let agent_updates_total = register_int_counter_with_registry!(
            opts!("agent_registry_updates_total", "Total agent updates"),
            registry.clone()
        )?;

        let registered_agents_total = register_gauge_with_registry!(
            opts!("agent_registry_registered_agents_total", "Total registered agents"),
            registry.clone()
        )?;

        let active_agents_total = register_gauge_with_registry!(
            opts!("agent_registry_active_agents_total", "Active agents"),
            registry.clone()
        )?;

        let inactive_agents_total = register_gauge_with_registry!(
            opts!("agent_registry_inactive_agents_total", "Inactive agents"),
            registry.clone()
        )?;

        let busy_agents_total = register_gauge_with_registry!(
            opts!("agent_registry_busy_agents_total", "Busy agents"),
            registry.clone()
        )?;

        let error_agents_total = register_gauge_with_registry!(
            opts!("agent_registry_error_agents_total", "Agents in error state"),
            registry.clone()
        )?;

        // Execution metrics
        let agent_executions_total = register_int_counter_with_registry!(
            opts!("agent_registry_executions_total", "Total agent executions"),
            registry.clone()
        )?;

        let agent_execution_errors_total = register_int_counter_with_registry!(
            opts!("agent_registry_execution_errors_total", "Agent execution errors"),
            registry.clone()
        )?;

        let agent_execution_duration_seconds = register_histogram_with_registry!(
            "agent_registry_execution_duration_seconds",
            "Agent execution duration in seconds",
            vec![0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0],
            registry.clone()
        )?;

        let concurrent_executions = register_int_gauge_with_registry!(
            opts!("agent_registry_concurrent_executions", "Current concurrent executions"),
            registry.clone()
        )?;

        let execution_queue_length = register_int_gauge_with_registry!(
            opts!("agent_registry_execution_queue_length", "Agent execution queue length"),
            registry.clone()
        )?;

        // Health check metrics
        let health_checks_total = register_int_counter_with_registry!(
            opts!("agent_registry_health_checks_total", "Total health checks performed"),
            registry.clone()
        )?;

        let health_check_failures_total = register_int_counter_with_registry!(
            opts!("agent_registry_health_check_failures_total", "Health check failures"),
            registry.clone()
        )?;

        let health_check_duration_seconds = register_histogram_with_registry!(
            "agent_registry_health_check_duration_seconds",
            "Health check duration in seconds",
            vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0],
            registry.clone()
        )?;

        // Database metrics
        let db_connections_total = register_int_gauge_with_registry!(
            opts!("agent_registry_db_connections_total", "Database connection pool size"),
            registry.clone()
        )?;

        let db_connections_active = register_int_gauge_with_registry!(
            opts!("agent_registry_db_connections_active", "Active database connections"),
            registry.clone()
        )?;

        let db_query_duration_seconds = register_histogram_with_registry!(
            "agent_registry_db_query_duration_seconds",
            "Database query duration in seconds",
            vec![0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0],
            registry.clone()
        )?;

        let db_errors_total = register_int_counter_with_registry!(
            opts!("agent_registry_db_errors_total", "Database operation errors"),
            registry.clone()
        )?;

        // Cache metrics
        let cache_hits_total = register_int_counter_with_registry!(
            opts!("agent_registry_cache_hits_total", "Cache hits"),
            registry.clone()
        )?;

        let cache_misses_total = register_int_counter_with_registry!(
            opts!("agent_registry_cache_misses_total", "Cache misses"),
            registry.clone()
        )?;

        let cache_size = register_int_gauge_with_registry!(
            opts!("agent_registry_cache_size", "Current cache size"),
            registry.clone()
        )?;

        let cache_evictions_total = register_int_counter_with_registry!(
            opts!("agent_registry_cache_evictions_total", "Cache evictions"),
            registry.clone()
        )?;

        // System metrics
        let memory_usage_bytes = register_gauge_with_registry!(
            opts!("agent_registry_memory_usage_bytes", "Memory usage in bytes"),
            registry.clone()
        )?;

        let cpu_usage_percent = register_gauge_with_registry!(
            opts!("agent_registry_cpu_usage_percent", "CPU usage percentage"),
            registry.clone()
        )?;

        let async_tasks_total = register_int_gauge_with_registry!(
            opts!("agent_registry_async_tasks_total", "Total async tasks"),
            registry.clone()
        )?;

        let open_file_descriptors = register_int_gauge_with_registry!(
            opts!("agent_registry_open_file_descriptors", "Open file descriptors"),
            registry.clone()
        )?;

        // Business metrics
        let agent_list_requests_total = register_int_counter_with_registry!(
            opts!("agent_registry_list_requests_total", "Agent list requests"),
            registry.clone()
        )?;

        let agent_search_requests_total = register_int_counter_with_registry!(
            opts!("agent_registry_search_requests_total", "Agent search requests"),
            registry.clone()
        )?;

        let workflow_executions_total = register_int_counter_with_registry!(
            opts!("agent_registry_workflow_executions_total", "Workflow executions"),
            registry.clone()
        )?;

        let workflow_execution_errors_total = register_int_counter_with_registry!(
            opts!("agent_registry_workflow_execution_errors_total", "Workflow execution errors"),
            registry.clone()
        )?;

        // Performance metrics
        let response_time_p50 = register_gauge_with_registry!(
            opts!("agent_registry_response_time_p50_seconds", "50th percentile response time"),
            registry.clone()
        )?;

        let response_time_p95 = register_gauge_with_registry!(
            opts!("agent_registry_response_time_p95_seconds", "95th percentile response time"),
            registry.clone()
        )?;

        let response_time_p99 = register_gauge_with_registry!(
            opts!("agent_registry_response_time_p99_seconds", "99th percentile response time"),
            registry.clone()
        )?;

        let throughput_rps = register_gauge_with_registry!(
            opts!("agent_registry_throughput_rps", "Throughput in requests per second"),
            registry.clone()
        )?;

        let error_rate_percent = register_gauge_with_registry!(
            opts!("agent_registry_error_rate_percent", "Error rate percentage"),
            registry.clone()
        )?;

        Ok(Self {
            registry,
            http_requests_total,
            http_request_duration_seconds,
            http_responses_total,
            agent_registrations_total,
            agent_registration_errors_total,
            agent_unregistrations_total,
            agent_updates_total,
            registered_agents_total,
            active_agents_total,
            inactive_agents_total,
            busy_agents_total,
            error_agents_total,
            agent_executions_total,
            agent_execution_errors_total,
            agent_execution_duration_seconds,
            concurrent_executions,
            execution_queue_length,
            health_checks_total,
            health_check_failures_total,
            health_check_duration_seconds,
            db_connections_total,
            db_connections_active,
            db_query_duration_seconds,
            db_errors_total,
            cache_hits_total,
            cache_misses_total,
            cache_size,
            cache_evictions_total,
            memory_usage_bytes,
            cpu_usage_percent,
            async_tasks_total,
            open_file_descriptors,
            agent_list_requests_total,
            agent_search_requests_total,
            workflow_executions_total,
            workflow_execution_errors_total,
            response_time_p50,
            response_time_p95,
            response_time_p99,
            throughput_rps,
            error_rate_percent,
        })
    }

    /// Record HTTP request metrics
    pub fn record_http_request(&self, duration_seconds: f64, status_code: u16) {
        self.http_requests_total.inc();
        self.http_request_duration_seconds.observe(duration_seconds);
        
        if status_code >= 400 {
            self.http_responses_total.inc();
        }
    }

    /// Record agent execution metrics
    pub fn record_agent_execution(&self, duration_seconds: f64, success: bool) {
        self.agent_executions_total.inc();
        self.agent_execution_duration_seconds.observe(duration_seconds);
        
        if !success {
            self.agent_execution_errors_total.inc();
        }
    }

    /// Record health check metrics
    pub fn record_health_check(&self, duration_seconds: f64, success: bool) {
        self.health_checks_total.inc();
        self.health_check_duration_seconds.observe(duration_seconds);
        
        if !success {
            self.health_check_failures_total.inc();
        }
    }

    /// Record database query metrics
    pub fn record_db_query(&self, duration_seconds: f64, success: bool) {
        self.db_query_duration_seconds.observe(duration_seconds);
        
        if !success {
            self.db_errors_total.inc();
        }
    }

    /// Record cache metrics
    pub fn record_cache_hit(&self) {
        self.cache_hits_total.inc();
    }

    pub fn record_cache_miss(&self) {
        self.cache_misses_total.inc();
    }

    pub fn record_cache_eviction(&self) {
        self.cache_evictions_total.inc();
    }

    /// Update system metrics
    pub fn update_system_metrics(&self, memory_bytes: f64, cpu_percent: f64, async_tasks: i64, file_descriptors: i64) {
        self.memory_usage_bytes.set(memory_bytes);
        self.cpu_usage_percent.set(cpu_percent);
        self.async_tasks_total.set(async_tasks);
        self.open_file_descriptors.set(file_descriptors);
    }

    /// Update performance metrics
    pub fn update_performance_metrics(
        &self,
        p50_seconds: f64,
        p95_seconds: f64,
        p99_seconds: f64,
        throughput_rps: f64,
        error_rate_percent: f64,
    ) {
        self.response_time_p50.set(p50_seconds);
        self.response_time_p95.set(p95_seconds);
        self.response_time_p99.set(p99_seconds);
        self.throughput_rps.set(throughput_rps);
        self.error_rate_percent.set(error_rate_percent);
    }

    /// Get metrics as Prometheus text format
    pub fn export(&self) -> Result<String> {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        Ok(encoder.encode_to_string(&metric_families)?)
    }

    /// Get basic metrics summary
    pub fn summary(&self) -> MetricsSummary {
        MetricsSummary {
            total_agents: self.registered_agents_total.get() as u64,
            active_agents: self.active_agents_total.get() as u64,
            total_executions: self.agent_executions_total.get(),
            execution_errors: self.agent_execution_errors_total.get(),
            total_requests: self.http_requests_total.get(),
            health_checks: self.health_checks_total.get(),
            health_check_failures: self.health_check_failures_total.get(),
            memory_usage_mb: (self.memory_usage_bytes.get() / 1024.0 / 1024.0) as u64,
            cpu_usage_percent: self.cpu_usage_percent.get() as u8,
        }
    }
}

/// Basic metrics summary for health checks and monitoring
#[derive(Debug, Clone)]
pub struct MetricsSummary {
    pub total_agents: u64,
    pub active_agents: u64,
    pub total_executions: u64,
    pub execution_errors: u64,
    pub total_requests: u64,
    pub health_checks: u64,
    pub health_check_failures: u64,
    pub memory_usage_mb: u64,
    pub cpu_usage_percent: u8,
}

impl std::fmt::Display for MetricsSummary {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Agents: {}/{} active, Executions: {} ({} errors), Requests: {}, Health: {}/{} checks, Resources: {}MB/{}% CPU",
            self.active_agents,
            self.total_agents,
            self.total_executions,
            self.execution_errors,
            self.total_requests,
            self.health_checks - self.health_check_failures,
            self.health_checks,
            self.memory_usage_mb,
            self.cpu_usage_percent
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_creation() {
        let metrics = Metrics::new().unwrap();
        assert_eq!(metrics.http_requests_total.get(), 0);
        assert_eq!(metrics.agent_registrations_total.get(), 0);
    }

    #[test]
    fn test_record_http_request() {
        let metrics = Metrics::new().unwrap();
        metrics.record_http_request(0.1, 200);
        assert_eq!(metrics.http_requests_total.get(), 1);
    }

    #[test]
    fn test_record_agent_execution() {
        let metrics = Metrics::new().unwrap();
        metrics.record_agent_execution(1.5, true);
        assert_eq!(metrics.agent_executions_total.get(), 1);
        assert_eq!(metrics.agent_execution_errors_total.get(), 0);

        metrics.record_agent_execution(2.0, false);
        assert_eq!(metrics.agent_executions_total.get(), 2);
        assert_eq!(metrics.agent_execution_errors_total.get(), 1);
    }

    #[test]
    fn test_metrics_export() {
        let metrics = Metrics::new().unwrap();
        metrics.http_requests_total.inc();
        
        let exported = metrics.export().unwrap();
        assert!(exported.contains("agent_registry_http_requests_total"));
    }

    #[test]
    fn test_metrics_summary() {
        let metrics = Metrics::new().unwrap();
        metrics.registered_agents_total.set(10.0);
        metrics.active_agents_total.set(8.0);
        
        let summary = metrics.summary();
        assert_eq!(summary.total_agents, 10);
        assert_eq!(summary.active_agents, 8);
        
        let summary_str = summary.to_string();
        assert!(summary_str.contains("Agents: 8/10 active"));
    }
}
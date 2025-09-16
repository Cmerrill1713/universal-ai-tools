//! Metrics collection for LLM Router

use prometheus::{Encoder, TextEncoder, register_counter, register_histogram, register_gauge};
use prometheus::{Counter, Histogram, Gauge};
use std::collections::HashMap;
use lazy_static::lazy_static;
use tokio::sync::RwLock;

lazy_static! {
    static ref REQUESTS_TOTAL: Counter = register_counter!(
        "llm_router_requests_total",
        "Total number of requests processed"
    ).expect("Can't create metrics");

    static ref REQUEST_DURATION: Histogram = register_histogram!(
        "llm_router_request_duration_seconds",
        "Request duration in seconds"
    ).expect("Can't create metrics");

    static ref ACTIVE_REQUESTS: Gauge = register_gauge!(
        "llm_router_active_requests",
        "Number of currently active requests"
    ).expect("Can't create metrics");

    static ref PROVIDER_REQUESTS: RwLock<HashMap<String, Counter>> = RwLock::new(HashMap::new());
    static ref PROVIDER_ERRORS: RwLock<HashMap<String, Counter>> = RwLock::new(HashMap::new());
}

pub struct RouterMetrics {
    encoder: TextEncoder,
}

impl RouterMetrics {
    pub fn new() -> Self {
        Self {
            encoder: TextEncoder::new(),
        }
    }

    pub fn increment_requests(&self) {
        REQUESTS_TOTAL.inc();
    }

    pub fn record_request_duration(&self, duration: f64) {
        REQUEST_DURATION.observe(duration);
    }

    pub fn increment_active_requests(&self) {
        ACTIVE_REQUESTS.inc();
    }

    pub fn decrement_active_requests(&self) {
        ACTIVE_REQUESTS.dec();
    }

    pub async fn increment_provider_requests(&self, provider_name: &str) {
        let mut requests = PROVIDER_REQUESTS.write().await;
        let counter = requests.entry(provider_name.to_string()).or_insert_with(|| {
            register_counter!(
                &format!("llm_router_provider_requests_total{{provider=\"{}\"}}", provider_name),
                &format!("Requests for provider {}", provider_name)
            ).unwrap()
        });
        counter.inc();
    }

    pub async fn increment_provider_errors(&self, provider_name: &str) {
        let mut errors = PROVIDER_ERRORS.write().await;
        let counter = errors.entry(provider_name.to_string()).or_insert_with(|| {
            register_counter!(
                &format!("llm_router_provider_errors_total{{provider=\"{}\"}}", provider_name),
                &format!("Errors for provider {}", provider_name)
            ).unwrap()
        });
        counter.inc();
    }

    pub fn gather(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let metric_families = prometheus::gather();
        let mut buffer = Vec::new();
        self.encoder.encode(&metric_families, &mut buffer)?;
        Ok(String::from_utf8(buffer)?)
    }
}

impl Default for RouterMetrics {
    fn default() -> Self {
        Self::new()
    }
}

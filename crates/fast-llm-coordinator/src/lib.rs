pub mod coordinator;
pub mod load_balancer;
pub mod routing;
pub mod services;
pub mod metrics;

#[cfg(feature = "napi")]
pub mod napi_bridge;

pub use coordinator::FastLLMCoordinator;
pub use routing::{RoutingDecision, CoordinationContext, ServiceType};
pub use load_balancer::LoadBalancer;
pub use metrics::PerformanceMetrics;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum CoordinatorError {
    #[error("Service unavailable: {service}")]
    ServiceUnavailable { service: String },
    #[error("Routing decision failed: {reason}")]
    RoutingFailed { reason: String },
    #[error("Load balancing error: {error}")]
    LoadBalancingError { error: String },
    #[error("Network error: {error}")]
    NetworkError { error: String },
    #[error("Serialization error: {error}")]
    SerializationError { error: String },
    #[error("Configuration error: {error}")]
    ConfigError { error: String },
}
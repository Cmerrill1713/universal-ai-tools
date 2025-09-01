//! LLM Router Service - High-Performance Model Routing
//! 
//! Rust implementation of the LLM Router Service providing intelligent
//! routing between multiple LLM providers with health monitoring,
//! automatic failover, and dynamic model selection.

pub mod config;
pub mod health;
pub mod models;
pub mod providers;
pub mod router;
pub mod cache;
pub mod metrics;
pub mod context;

#[cfg(feature = "napi")]
pub mod napi_bridge;

pub use config::{RouterConfig, ProviderConfig, ModelConfig};
pub use health::{HealthMonitor, ProviderHealth};
pub use models::{ModelTier, ModelCapability, Message, Response};
pub use providers::{Provider, ProviderType, ProviderClient};
pub use router::{LLMRouter, RoutingStrategy};
pub use cache::ModelCache;
pub use metrics::RouterMetrics;
pub use context::ContextManager;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum RouterError {
    #[error("Provider error: {0}")]
    ProviderError(String),
    
    #[error("No healthy providers available")]
    NoHealthyProviders,
    
    #[error("Model not found: {0}")]
    ModelNotFound(String),
    
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    #[error("Request timeout after {0} seconds")]
    Timeout(u64),
    
    #[error("Rate limit exceeded for provider {0}")]
    RateLimited(String),
    
    #[error("Context enhancement failed: {0}")]
    ContextError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
}

/// Initialize the LLM Router with default configuration
pub async fn initialize() -> Result<LLMRouter, RouterError> {
    let config = RouterConfig::default();
    LLMRouter::new(config).await
}
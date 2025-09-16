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
pub mod guardrails;
pub mod smart_router;
pub mod intelligent_cache;
pub mod smart_monitoring;
pub mod token_manager;
pub mod context_manager;
pub mod librarian_context;
pub mod unlimited_context;
pub mod context_degradation;
pub mod service_integration;
pub mod keychain;

#[cfg(test)]
pub mod test_context;
// pub mod edge_cases; // Temporarily disabled: incomplete implementation

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
pub use guardrails::{GuardrailsManager, GuardrailsError, GuardrailsMetrics, validate_request, execute_with_guardrails};
pub use token_manager::{TokenBudgetManager, UserTier, TaskComplexity, TokenUsage, TokenBudgetResult, TokenLimitError, detect_task_complexity};
// pub use edge_cases::{EdgeCaseHandler, EdgeCase, EdgeCaseConfig, EdgeCaseStats, get_edge_case_metrics};

use thiserror::Error;

#[derive(Error, Debug, Clone)]
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

    #[error("Context too large: {0}")]
    ContextTooLarge(String),
    #[error("Authentication error: {0}")]
    AuthenticationError(String),
    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),
}

/// Initialize the LLM Router with default configuration
pub async fn initialize() -> Result<LLMRouter, RouterError> {
    let config = RouterConfig::default();
    LLMRouter::new(config).await
}

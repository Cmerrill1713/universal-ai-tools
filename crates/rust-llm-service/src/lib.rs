pub mod llm_coordinator;
pub mod models;
pub mod providers;
pub mod routing;
pub mod metrics;
pub mod error;

// NAPI bridge will be added later
// #[cfg(feature = "napi")]
// pub mod napi_bridge;

pub use llm_coordinator::LLMCoordinator;
pub use models::*;
pub use providers::*;
pub use routing::*;
pub use error::LLMServiceError;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("Provider unavailable: {provider}")]
    ProviderUnavailable { provider: String },
    #[error("Model not found: {model}")]
    ModelNotFound { model: String },
    #[error("Request failed: {reason}")]
    RequestFailed { reason: String },
    #[error("Rate limit exceeded")]
    RateLimitExceeded,
    #[error("Authentication failed")]
    AuthenticationFailed,
    #[error("Configuration error: {error}")]
    ConfigurationError { error: String },
}
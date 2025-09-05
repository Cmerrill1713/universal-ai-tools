use thiserror::Error;

#[derive(Error, Debug)]
pub enum LLMServiceError {
    #[error("Provider error: {message}")]
    Provider { message: String },
    
    #[error("Model error: {message}")]
    Model { message: String },
    
    #[error("Request error: {message}")]
    Request { message: String },
    
    #[error("Rate limit exceeded for provider: {provider}")]
    RateLimit { provider: String },
    
    #[error("Authentication failed for provider: {provider}")]
    Authentication { provider: String },
    
    #[error("Network error: {message}")]
    Network { message: String },
    
    #[error("Serialization error: {message}")]
    Serialization { message: String },
    
    #[error("Routing error: {message}")]
    Routing { message: String },
    
    #[error("Timeout error: {message}")]
    Timeout { message: String },
}

impl From<reqwest::Error> for LLMServiceError {
    fn from(error: reqwest::Error) -> Self {
        LLMServiceError::Network {
            message: error.to_string(),
        }
    }
}

impl From<serde_json::Error> for LLMServiceError {
    fn from(error: serde_json::Error) -> Self {
        LLMServiceError::Serialization {
            message: error.to_string(),
        }
    }
}
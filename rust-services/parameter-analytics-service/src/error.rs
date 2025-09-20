//! Error handling for Parameter Analytics Service

use thiserror::Error;

pub type Result<T> = std::result::Result<T, AnalyticsError>;

#[derive(Error, Debug)]
pub enum AnalyticsError {
    #[error("Cache error: {0}")]
    Cache(#[from] redis::RedisError),
    
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("Analytics computation error: {message}")]
    Computation { message: String },
    
    #[error("Insufficient data for analysis: {required} samples required, {available} available")]
    InsufficientData { required: u64, available: u64 },
    
    #[error("Invalid parameter configuration: {0}")]
    InvalidParameters(String),
    
    #[error("Service not initialized")]
    NotInitialized,
    
    #[error("Service shutting down")]
    ShuttingDown,
    
    #[error("Timeout waiting for {operation}")]
    Timeout { operation: String },
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Internal error: {0}")]
    Internal(String),
}

impl AnalyticsError {
    pub fn computation(message: impl Into<String>) -> Self {
        Self::Computation {
            message: message.into(),
        }
    }
    
    pub fn insufficient_data(required: u64, available: u64) -> Self {
        Self::InsufficientData { required, available }
    }
    
    pub fn invalid_parameters(message: impl Into<String>) -> Self {
        Self::InvalidParameters(message.into())
    }
    
    pub fn timeout(operation: impl Into<String>) -> Self {
        Self::Timeout {
            operation: operation.into(),
        }
    }
    
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal(message.into())
    }
}
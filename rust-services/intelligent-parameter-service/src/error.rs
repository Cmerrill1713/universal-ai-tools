//! Error handling for intelligent parameter service

use thiserror::Error;

pub type Result<T> = std::result::Result<T, ParameterError>;

#[derive(Error, Debug)]
pub enum ParameterError {
    #[error("Optimization failed: {0}")]
    OptimizationError(String),
    
    #[error("Invalid parameters: {0}")]
    InvalidParameters(String),
    
    #[error("Cache error: {0}")]
    CacheError(String),
    
    #[error("Learning error: {0}")]
    LearningError(String),
    
    #[error("Model not found: {0}")]
    ModelNotFound(String),
    
    #[error("Insufficient data for optimization")]
    InsufficientData,
    
    #[error("Redis error: {0}")]
    RedisError(#[from] redis::RedisError),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Internal error: {0}")]
    InternalError(String),
}

impl ParameterError {
    pub fn optimization(msg: impl Into<String>) -> Self {
        Self::OptimizationError(msg.into())
    }
    
    pub fn invalid_params(msg: impl Into<String>) -> Self {
        Self::InvalidParameters(msg.into())
    }
    
    pub fn cache(msg: impl Into<String>) -> Self {
        Self::CacheError(msg.into())
    }
    
    pub fn learning(msg: impl Into<String>) -> Self {
        Self::LearningError(msg.into())
    }
    
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::InternalError(msg.into())
    }
}
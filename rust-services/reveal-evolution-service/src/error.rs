//! Error types for ReVeal Evolution Service

use thiserror::Error;

/// Evolution-specific errors
#[derive(Error, Debug)]
pub enum EvolutionError {
    #[error("Initialization error: {0}")]
    InitializationError(String),
    
    #[error("Evolution failed: {0}")]
    EvolutionFailed(String),
    
    #[error("Verification failed: {0}")]
    VerificationFailed(String),
    
    #[error("Generation failed: {0}")]
    GenerationFailed(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Cache error: {0}")]
    CacheError(String),
    
    #[error("MCTS integration error: {0}")]
    MCTSError(String),
    
    #[error("Timeout error: operation took too long")]
    TimeoutError,
    
    #[error("Resource limit exceeded: {0}")]
    ResourceLimitExceeded(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Redis error: {0}")]
    RedisError(#[from] redis::RedisError),
}

/// Result type for evolution operations
pub type EvolutionResult<T> = Result<T, EvolutionError>;
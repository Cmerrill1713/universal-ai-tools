//! Error types for the AB-MCTS service
//! 
//! Comprehensive error handling for all components of the MCTS implementation,
//! with proper error propagation to TypeScript.

use std::time::Duration;

/// Main error type for AB-MCTS operations
#[derive(Debug, thiserror::Error)]
pub enum MCTSError {
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
    
    #[error("Search timeout after {0:?}")]
    SearchTimeout(Duration),
    
    #[error("Node not found: {0}")]
    NodeNotFound(String),
    
    #[error("Agent execution failed: {0}")]
    AgentExecutionFailed(String),
    
    #[error("Thompson sampling error: {0}")]
    ThompsonSamplingError(String),
    
    #[error("UCB calculation error: {0}")]
    UCBCalculationError(String),
    
    #[error("Bayesian model error: {0}")]
    BayesianModelError(String),
    
    #[error("Redis connection error: {0}")]
    RedisError(String),
    
    #[error("Cache operation failed: {0}")]
    CacheError(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Initialization error: {0}")]
    InitializationError(String),
    
    #[error("Memory allocation failed: {0}")]
    MemoryError(String),
    
    #[error("Mathematical operation failed: {0}")]
    MathError(String),
    
    #[error("Concurrent access error: {0}")]
    ConcurrencyError(String),
    
    #[error("FFI bridge error: {0}")]
    FFIError(String),
    
    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl MCTSError {
    /// Create a configuration error
    pub fn config_error(msg: impl Into<String>) -> Self {
        Self::InvalidConfig(msg.into())
    }
    
    /// Create a timeout error
    pub fn timeout_error(duration: Duration) -> Self {
        Self::SearchTimeout(duration)
    }
    
    /// Create a node not found error
    pub fn node_not_found(node_id: impl Into<String>) -> Self {
        Self::NodeNotFound(node_id.into())
    }
    
    /// Create an agent execution error
    pub fn agent_error(msg: impl Into<String>) -> Self {
        Self::AgentExecutionFailed(msg.into())
    }
    
    /// Create a Thompson sampling error
    pub fn sampling_error(msg: impl Into<String>) -> Self {
        Self::ThompsonSamplingError(msg.into())
    }
    
    /// Create a UCB calculation error
    pub fn ucb_error(msg: impl Into<String>) -> Self {
        Self::UCBCalculationError(msg.into())
    }
    
    /// Create a Bayesian model error
    pub fn bayesian_error(msg: impl Into<String>) -> Self {
        Self::BayesianModelError(msg.into())
    }
    
    /// Create a Redis error
    pub fn redis_error(msg: impl Into<String>) -> Self {
        Self::RedisError(msg.into())
    }
    
    /// Create a cache error
    pub fn cache_error(msg: impl Into<String>) -> Self {
        Self::CacheError(msg.into())
    }
    
    /// Create a memory error
    pub fn memory_error(msg: impl Into<String>) -> Self {
        Self::MemoryError(msg.into())
    }
    
    /// Create a math error
    pub fn math_error(msg: impl Into<String>) -> Self {
        Self::MathError(msg.into())
    }
    
    /// Create a concurrency error
    pub fn concurrency_error(msg: impl Into<String>) -> Self {
        Self::ConcurrencyError(msg.into())
    }
    
    /// Create an FFI bridge error
    pub fn ffi_error(msg: impl Into<String>) -> Self {
        Self::FFIError(msg.into())
    }
    
    /// Convert to a JSON-serializable error for TypeScript
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "type": self.error_type(),
            "message": self.to_string(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })
    }
    
    /// Get the error type as a string
    pub fn error_type(&self) -> &'static str {
        match self {
            Self::InvalidConfig(_) => "InvalidConfig",
            Self::SearchTimeout(_) => "SearchTimeout",
            Self::NodeNotFound(_) => "NodeNotFound",
            Self::AgentExecutionFailed(_) => "AgentExecutionFailed",
            Self::ThompsonSamplingError(_) => "ThompsonSamplingError",
            Self::UCBCalculationError(_) => "UCBCalculationError",
            Self::BayesianModelError(_) => "BayesianModelError",
            Self::RedisError(_) => "RedisError",
            Self::CacheError(_) => "CacheError",
            Self::SerializationError(_) => "SerializationError",
            Self::IoError(_) => "IoError",
            Self::InitializationError(_) => "InitializationError",
            Self::MemoryError(_) => "MemoryError",
            Self::MathError(_) => "MathError",
            Self::ConcurrencyError(_) => "ConcurrencyError",
            Self::FFIError(_) => "FFIError",
            Self::Unknown(_) => "Unknown",
        }
    }
    
    /// Check if the error is recoverable
    pub fn is_recoverable(&self) -> bool {
        match self {
            Self::SearchTimeout(_) |
            Self::RedisError(_) |
            Self::CacheError(_) |
            Self::IoError(_) |
            Self::ConcurrencyError(_) => true,
            Self::InvalidConfig(_) |
            Self::NodeNotFound(_) |
            Self::SerializationError(_) |
            Self::MemoryError(_) |
            Self::MathError(_) => false,
            _ => false,
        }
    }
}

// Convert from Redis errors
impl From<redis::RedisError> for MCTSError {
    fn from(err: redis::RedisError) -> Self {
        Self::RedisError(err.to_string())
    }
}

// Result type alias for convenience
pub type MCTSResult<T> = Result<T, MCTSError>;

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_error_creation() {
        let config_err = MCTSError::config_error("Invalid max_iterations");
        assert_eq!(config_err.error_type(), "InvalidConfig");
        assert!(!config_err.is_recoverable());
        
        let timeout_err = MCTSError::timeout_error(Duration::from_secs(30));
        assert_eq!(timeout_err.error_type(), "SearchTimeout");
        assert!(timeout_err.is_recoverable());
    }
    
    #[test]
    fn test_json_serialization() {
        let err = MCTSError::agent_error("Test agent failed");
        let json = err.to_json();
        
        assert_eq!(json["type"], "AgentExecutionFailed");
        assert_eq!(json["message"], "Agent execution failed: Test agent failed");
        assert!(json["timestamp"].is_string());
    }
    
    #[test]
    fn test_error_recovery_classification() {
        assert!(MCTSError::SearchTimeout(Duration::from_secs(1)).is_recoverable());
        assert!(MCTSError::redis_error("Connection failed").is_recoverable());
        assert!(!MCTSError::config_error("Invalid config").is_recoverable());
        assert!(!MCTSError::memory_error("Out of memory").is_recoverable());
    }
}
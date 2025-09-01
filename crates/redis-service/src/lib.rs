//! Redis Service - Rust Implementation
//! 
//! High-performance Redis client with in-memory fallback, advanced caching strategies,
//! and distributed data operations. Provides significant performance improvements over
//! the TypeScript implementation through efficient memory management and connection pooling.

pub mod cache;
pub mod client;
pub mod compression;
pub mod fallback;
pub mod metrics;
#[cfg(feature = "napi")]
pub mod napi_bridge;
pub mod pool;
pub mod pubsub;
pub mod session;
pub mod types;

pub use cache::CacheManager;
pub use client::RedisClient;
pub use compression::{CompressionManager, CompressionAlgorithm};
pub use fallback::InMemoryFallback;
pub use metrics::MetricsCollector;
pub use pool::ConnectionPool;
pub use pubsub::PubSubManager;
pub use session::SessionManager;
pub use types::*;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum RedisServiceError {
    #[error("Redis connection error: {error}")]
    ConnectionError { error: String },
    
    #[error("Serialization error: {error}")]
    SerializationError { error: String },
    
    #[error("Deserialization error: {error}")]
    DeserializationError { error: String },
    
    #[error("Key not found: {key}")]
    KeyNotFound { key: String },
    
    #[error("Operation timeout: {operation}")]
    OperationTimeout { operation: String },
    
    #[error("Pool exhausted")]
    PoolExhausted,
    
    #[error("Invalid TTL: {ttl}")]
    InvalidTTL { ttl: i64 },
    
    #[error("Compression error: {error}")]
    CompressionError { error: String },
    
    #[error("Cluster error: {error}")]
    ClusterError { error: String },
    
    #[error("Transaction error: {error}")]
    TransactionError { error: String },
    
    #[error("PubSub error: {error}")]
    PubSubError { error: String },
    
    #[error("Session error: {error}")]
    SessionError { error: String },
}
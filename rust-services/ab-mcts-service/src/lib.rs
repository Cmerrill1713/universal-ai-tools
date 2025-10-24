//! # AB-MCTS Service
//! 
//! High-performance Adaptive Bandit Monte Carlo Tree Search service for AI orchestration.
//! 
//! This library provides a Rust implementation of the AB-MCTS algorithm with Thompson Sampling
//! for intelligent agent selection and coordination. It offers significant performance improvements
//! over the TypeScript version through optimized memory management and mathematical operations.
//! 
//! ## Features
//! 
//! - Monte Carlo Tree Search with UCB1 selection
//! - Thompson Sampling with Beta distributions
//! - Bayesian model integration for learning
//! - Redis-based tree persistence
//! - TypeScript FFI bridge for seamless integration
//! - Parallel simulation support
//! - Comprehensive error handling and logging

pub mod types;
pub mod engine;
pub mod sampling;
pub mod models;
pub mod bridge;
pub mod cache;
pub mod error;
pub mod http_server;

// FFI bindings for integration with TypeScript/Node.js
#[cfg(feature = "ffi")]
pub mod ffi;

// Re-export FFI functions when feature is enabled
#[cfg(feature = "ffi")]
pub use ffi::*;

// Re-export main types for easier usage
pub use types::{MCTSNode, MCTSAction, MCTSReward, AgentContext, SearchOptions, SearchResult};
pub use engine::MCTSEngine;
pub use sampling::ThompsonSampler;
pub use error::MCTSError;

// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const DESCRIPTION: &str = env!("CARGO_PKG_DESCRIPTION");

/// Initialize the AB-MCTS service with logging and metrics
pub fn init() -> Result<(), MCTSError> {
    // Initialize tracing subscriber for structured logging
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init()
        .map_err(|e| MCTSError::InitializationError(e.to_string()))?;

    tracing::info!("AB-MCTS Service v{} initialized", VERSION);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_info() {
        assert!(!VERSION.is_empty());
        assert!(!DESCRIPTION.is_empty());
    }

    #[tokio::test]
    async fn test_initialization() {
        // This might fail if already initialized, which is fine
        let _ = init();
    }
}
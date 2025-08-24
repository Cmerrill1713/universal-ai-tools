//! Vector Database Library
//! 
//! High-performance vector database service with GPU acceleration for Universal AI Tools.
//! This library provides vector similarity search, indexing, and storage capabilities.

// Re-export core modules for testing and external use
pub mod config;
pub mod simple_engine;
pub mod simple_api;
pub mod storage;
pub mod accelerator;
pub mod types;
pub mod metrics;

// Re-export commonly used types
pub use types::*;
pub use config::Config;
pub use simple_engine::SimpleVectorEngine;
pub use metrics::MetricsService;

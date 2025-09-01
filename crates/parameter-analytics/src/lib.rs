//! Parameter Analytics Service - Rust Implementation
//! 
//! High-performance analytics service for tracking parameter effectiveness
//! and providing real-time optimization insights for AI model parameters.
//! 
//! This Rust implementation provides significant performance improvements over
//! the TypeScript version for data-intensive analytics operations.

pub mod analytics;
pub mod collector;
pub mod database;
pub mod insights;
pub mod metrics;
pub mod napi_bridge;
pub mod recommendations;
pub mod types;

pub use analytics::ParameterAnalytics;
pub use collector::ExecutionCollector;
pub use insights::InsightGenerator;
pub use metrics::MetricsCalculator;
pub use recommendations::RecommendationEngine;
pub use types::*;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum AnalyticsError {
    #[error("Database error: {error}")]
    DatabaseError { error: String },
    
    #[error("Serialization error: {error}")]
    SerializationError { error: String },
    
    #[error("Invalid parameter: {parameter}")]
    InvalidParameter { parameter: String },
    
    #[error("Insufficient data for analysis: {reason}")]
    InsufficientData { reason: String },
    
    #[error("Configuration error: {error}")]
    ConfigError { error: String },
    
    #[error("Statistical analysis error: {error}")]
    StatisticalError { error: String },
    
    #[error("Cache error: {error}")]
    CacheError { error: String },
}
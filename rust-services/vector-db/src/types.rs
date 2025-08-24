// Core data types for the vector database service

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Vector document stored in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorDocument {
    pub id: String,
    pub content: String,
    pub embedding: Vec<f32>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl VectorDocument {
    pub fn new(content: String, embedding: Vec<f32>, metadata: Option<serde_json::Value>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            content,
            embedding,
            metadata: metadata.unwrap_or(serde_json::Value::Null),
            created_at: now,
            updated_at: now,
        }
    }
}

/// Search result with similarity score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub content: String,
    pub score: f32,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Search query parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query_vector: Vec<f32>,
    pub limit: Option<usize>,
    pub threshold: Option<f32>,
    pub filter: Option<serde_json::Value>,
    pub include_metadata: Option<bool>,
}

/// Insert request for new documents
#[derive(Debug, Deserialize)]
pub struct InsertRequest {
    pub content: String,
    pub embedding: Vec<f32>,
    pub metadata: Option<serde_json::Value>,
}

/// Batch insert request
#[derive(Debug, Deserialize)]
pub struct BatchInsertRequest {
    pub documents: Vec<InsertRequest>,
}

/// Vector index configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexConfig {
    pub name: String,
    pub dimensions: usize,
    pub metric: SimilarityMetric,
    pub index_type: IndexType,
    pub parameters: IndexParameters,
}

/// Similarity metrics supported
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SimilarityMetric {
    Cosine,
    Euclidean,
    DotProduct,
    Manhattan,
}

/// Vector index types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IndexType {
    /// Exact search with brute force
    Exact,
    /// LSH (Locality Sensitive Hashing) for approximate search
    LSH,
    /// HNSW (Hierarchical Navigable Small World) graph
    HNSW,
    /// IVF (Inverted File Index) with quantization
    IVF,
}

/// Index-specific parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexParameters {
    pub lsh_tables: Option<usize>,
    pub lsh_hash_size: Option<usize>,
    pub hnsw_m: Option<usize>,
    pub hnsw_ef_construction: Option<usize>,
    pub ivf_nlist: Option<usize>,
    pub ivf_nprobe: Option<usize>,
}

impl Default for IndexParameters {
    fn default() -> Self {
        Self {
            lsh_tables: Some(5),
            lsh_hash_size: Some(10),
            hnsw_m: Some(16),
            hnsw_ef_construction: Some(200),
            ivf_nlist: Some(100),
            ivf_nprobe: Some(10),
        }
    }
}

/// Vector operation metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorMetrics {
    pub total_vectors: usize,
    pub index_size_bytes: usize,
    pub average_search_time_ms: f64,
    pub total_searches: u64,
    pub total_inserts: u64,
    pub cache_hit_rate: f32,
    pub gpu_utilization: Option<f32>,
}

/// GPU acceleration result
#[derive(Debug, Clone)]
pub struct AcceleratedResult {
    pub results: Vec<SearchResult>,
    pub compute_time_ms: f64,
    pub was_accelerated: bool,
    pub fallback_reason: Option<String>,
}

/// Vector similarity operation result
#[derive(Debug, Clone)]
pub struct SimilarityResult {
    pub index: usize,
    pub similarity: f32,
    pub vector_id: String,
}

/// Index statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    pub name: String,
    pub total_vectors: usize,
    pub dimensions: usize,
    pub index_type: IndexType,
    pub memory_usage_bytes: usize,
    pub build_time_ms: Option<f64>,
    pub last_updated: DateTime<Utc>,
    pub performance_metrics: PerformanceMetrics,
}

/// Performance metrics for operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub avg_search_time_ms: f64,
    pub p95_search_time_ms: f64,
    pub p99_search_time_ms: f64,
    pub throughput_ops_per_sec: f64,
    pub memory_bandwidth_mb_per_sec: f64,
}

/// Error types for vector operations
#[derive(Debug, thiserror::Error)]
pub enum VectorError {
    #[error("Index not found: {name}")]
    IndexNotFound { name: String },
    
    #[error("Dimension mismatch: expected {expected}, got {actual}")]
    DimensionMismatch { expected: usize, actual: usize },
    
    #[error("Invalid vector: {reason}")]
    InvalidVector { reason: String },
    
    #[error("GPU acceleration error: {message}")]
    GPUError { message: String },
    
    #[error("Storage error: {0}")]
    StorageError(#[from] anyhow::Error),
    
    #[error("Configuration error: {message}")]
    ConfigError { message: String },
    
    #[error("Index build failed: {reason}")]
    IndexBuildError { reason: String },
}

/// Vector database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorConfig {
    pub dimensions: usize,
    pub index_type: String,
    pub similarity_metric: String,
    pub max_vectors: usize,
    pub gpu_acceleration: bool,
    pub batch_size: usize,
    pub cache_size: usize,
}

impl Default for VectorConfig {
    fn default() -> Self {
        Self {
            dimensions: 768,
            index_type: "hnsw".to_string(),
            similarity_metric: "cosine".to_string(),
            max_vectors: 1_000_000,
            gpu_acceleration: true,
            batch_size: 1000,
            cache_size: 10_000,
        }
    }
}
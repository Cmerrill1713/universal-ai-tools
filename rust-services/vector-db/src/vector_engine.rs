// High-performance vector engine with GPU acceleration and multiple indexing strategies

use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use dashmap::DashMap;
use tracing::{info, warn, instrument, debug};
use rayon::prelude::*;
use ndarray::{Array1, Array2};
use parking_lot::Mutex;

use crate::config::Config;
use crate::types::*;
use crate::storage::StorageBackend;
use crate::metrics::MetricsService;
use crate::accelerator::VectorAccelerator;

#[cfg(feature = "metal-acceleration")]
use crate::accelerator::metal::MetalAccelerator;

/// Main vector engine for high-performance similarity search
pub struct VectorEngine {
    config: Config,
    storage: Arc<dyn StorageBackend + Send + Sync>,
    indexes: Arc<DashMap<String, Arc<VectorIndex>>>,
    metrics: Arc<MetricsService>,
    
    #[cfg(feature = "metal-acceleration")]
    accelerator: Option<Arc<MetalAccelerator>>,
    
    #[cfg(not(feature = "metal-acceleration"))]
    accelerator: Option<Arc<()>>,
    
    cache: Arc<lru::LruCache<String, Vec<SearchResult>>>,
    cache_mutex: Arc<Mutex<()>>,
}

/// Vector index implementation with multiple algorithms
pub struct VectorIndex {
    pub name: String,
    pub config: IndexConfig,
    pub vectors: Arc<RwLock<Vec<Array1<f32>>>>,
    pub metadata: Arc<RwLock<Vec<VectorDocument>>>,
    pub index_data: Arc<RwLock<IndexData>>,
    pub stats: Arc<RwLock<IndexStats>>,
}

/// Index-specific data structures
#[derive(Debug)]
pub enum IndexData {
    Exact,
    LSH {
        tables: Vec<LSHTable>,
        hash_functions: Vec<RandomProjection>,
    },
    HNSW {
        graph: HNSWGraph,
        entry_point: Option<usize>,
    },
    IVF {
        centroids: Vec<Array1<f32>>,
        clusters: Vec<Vec<usize>>,
    },
}

/// LSH table for approximate search
#[derive(Debug)]
pub struct LSHTable {
    pub buckets: DashMap<String, Vec<usize>>,
    pub hash_func: RandomProjection,
}

/// Random projection for LSH
#[derive(Debug)]
pub struct RandomProjection {
    pub matrix: Array2<f32>,
    pub bias: Array1<f32>,
}

/// HNSW graph structure
#[derive(Debug)]
pub struct HNSWGraph {
    pub levels: Vec<Vec<Vec<usize>>>, // levels[node][level] = neighbors
    pub node_levels: Vec<usize>,
}

impl VectorEngine {
    #[instrument(skip(config, accelerator, metrics))]
    pub async fn new(
        config: Config,
        #[cfg(feature = "metal-acceleration")]
        accelerator: Option<Arc<MetalAccelerator>>,
        #[cfg(not(feature = "metal-acceleration"))]
        accelerator: Option<Arc<()>>,
        metrics: Arc<MetricsService>,
    ) -> Result<Self> {
        info!("Initializing vector engine");
        
        // Initialize storage backend
        let storage = crate::storage::StorageFactory::create_storage(&config).await?;
        
        // Initialize cache
        let cache = Arc::new(Mutex::new(lru::LruCache::<String, VectorDocument>::new(
            std::num::NonZeroUsize::new(config.vector.cache_size).unwrap()
        )));
        
        let engine = Self {
            config,
            storage,
            indexes: Arc::new(DashMap::new()),
            metrics,
            accelerator,
            cache: Arc::new(lru::LruCache::new(
                std::num::NonZeroUsize::new(1000).unwrap()
            )),
            cache_mutex: Arc::new(Mutex::new(())),
        };
        
        // Create default index
        engine.create_default_index().await?;
        
        info!("Vector engine initialized successfully");
        Ok(engine)
    }
    
    /// Create default vector index
    async fn create_default_index(&self) -> Result<()> {
        let index_config = IndexConfig {
            name: "default".to_string(),
            dimensions: self.config.vector.dimensions,
            metric: SimilarityMetric::Cosine,
            index_type: match self.config.vector.index_type.as_str() {
                "exact" => IndexType::Exact,
                "lsh" => IndexType::LSH,
                "hnsw" => IndexType::HNSW,
                "ivf" => IndexType::IVF,
                _ => IndexType::HNSW, // Default to HNSW
            },
            parameters: IndexParameters::default(),
        };
        
        self.create_index(index_config).await?;
        Ok(())
    }
    
    /// Create a new vector index
    #[instrument(skip(self))]
    pub async fn create_index(&self, config: IndexConfig) -> Result<()> {
        info!("Creating vector index: {}", config.name);
        
        let index_data = match config.index_type {
            IndexType::Exact => IndexData::Exact,
            IndexType::LSH => {
                let tables = (0..config.parameters.lsh_tables.unwrap_or(5))
                    .map(|_| LSHTable {
                        buckets: DashMap::new(),
                        hash_func: RandomProjection::new(
                            config.dimensions,
                            config.parameters.lsh_hash_size.unwrap_or(10),
                        ),
                    })
                    .collect();
                
                IndexData::LSH {
                    tables,
                    hash_functions: vec![],
                }
            },
            IndexType::HNSW => IndexData::HNSW {
                graph: HNSWGraph {
                    levels: vec![],
                    node_levels: vec![],
                },
                entry_point: None,
            },
            IndexType::IVF => IndexData::IVF {
                centroids: vec![],
                clusters: vec![],
            },
        };
        
        let stats = IndexStats {
            name: config.name.clone(),
            total_vectors: 0,
            dimensions: config.dimensions,
            index_type: config.index_type.clone(),
            memory_usage_bytes: 0,
            build_time_ms: None,
            last_updated: chrono::Utc::now(),
            performance_metrics: PerformanceMetrics {
                avg_search_time_ms: 0.0,
                p95_search_time_ms: 0.0,
                p99_search_time_ms: 0.0,
                throughput_ops_per_sec: 0.0,
                memory_bandwidth_mb_per_sec: 0.0,
            },
        };
        
        let index = Arc::new(VectorIndex {
            name: config.name.clone(),
            config,
            vectors: Arc::new(RwLock::new(Vec::new())),
            metadata: Arc::new(RwLock::new(Vec::new())),
            index_data: Arc::new(RwLock::new(index_data)),
            stats: Arc::new(RwLock::new(stats)),
        });
        
        let index_name = index.name.clone();
        self.indexes.insert(index_name.clone(), index);
        
        info!("Vector index created successfully: {}", index_name);
        Ok(())
    }
    
    /// Insert a vector document
    #[instrument(skip(self, document))]
    pub async fn insert(&self, index_name: &str, document: VectorDocument) -> Result<String> {
        let start_time = std::time::Instant::now();
        
        // Validate vector dimensions
        let index = self.get_index(index_name)?;
        if document.embedding.len() != index.config.dimensions {
            return Err(VectorError::DimensionMismatch {
                expected: index.config.dimensions,
                actual: document.embedding.len(),
            }.into());
        }
        
        // Convert to ndarray
        let vector = Array1::from_vec(document.embedding.clone());
        
        // Store in persistence layer
        let doc_id = self.storage.insert(&document).await?;
        
        // Add to index
        {
            let mut vectors = index.vectors.write().await;
            let mut metadata = index.metadata.write().await;
            
            vectors.push(vector);
            metadata.push(document);
        }
        
        // Update index structure
        self.update_index_structure(&index).await?;
        
        // Update metrics
        let duration = start_time.elapsed();
        self.metrics.record_insert(duration, 1, true);
        
        // Clear relevant cache entries
        self.invalidate_cache().await;
        
        debug!("Vector inserted in {}ms", duration.as_millis());
        Ok(doc_id)
    }
    
    /// Search for similar vectors
    #[instrument(skip(self, query))]
    pub async fn search(&self, index_name: &str, query: SearchQuery) -> Result<Vec<SearchResult>> {
        let start_time = std::time::Instant::now();
        
        // Check cache first
        let cache_key = self.generate_cache_key(index_name, &query);
        if let Some(cached_results) = self.get_cached_results(&cache_key).await {
            self.metrics.record_cache_hit();
            return Ok(cached_results);
        }
        
        let index = self.get_index(index_name)?;
        let limit = query.limit.unwrap_or(10).min(1000);
        let threshold = query.threshold.unwrap_or(0.0);
        
        // Validate query vector dimensions
        if query.query_vector.len() != index.config.dimensions {
            return Err(VectorError::DimensionMismatch {
                expected: index.config.dimensions,
                actual: query.query_vector.len(),
            }.into());
        }
        
        let query_vector = Array1::from_vec(query.query_vector);
        
        // Choose search strategy based on GPU availability and batch size
        let results = if self.should_use_gpu(&index, 1).await {
            self.gpu_accelerated_search(&index, &query_vector, limit, threshold).await?
        } else {
            self.cpu_search(&index, &query_vector, limit, threshold).await?
        };
        
        // Cache results
        self.cache_results(&cache_key, &results).await;
        
        // Update metrics
        let duration = start_time.elapsed();
        self.metrics.record_search_time(duration);
        
        info!("Search completed in {}ms, {} results", duration.as_millis(), results.len());
        Ok(results)
    }
    
    /// GPU-accelerated search
    #[cfg(feature = "metal-acceleration")]
    async fn gpu_accelerated_search(
        &self,
        index: &VectorIndex,
        query_vector: &Array1<f32>,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        if let Some(accelerator) = &self.accelerator {
            let vectors = index.vectors.read().await;
            let metadata = index.metadata.read().await;
            
            // Convert to GPU format
            let query_gpu = query_vector.as_slice().unwrap().to_vec();
            let candidates_gpu: Vec<Vec<f32>> = vectors
                .iter()
                .map(|v| v.as_slice().unwrap().to_vec())
                .collect();
            
            // Perform GPU similarity search
            let gpu_results = accelerator.batch_similarity_search(
                query_gpu,
                candidates_gpu,
                threshold,
            ).await?;
            
            // Convert back to SearchResult format
            let mut results = Vec::new();
            for gpu_result in gpu_results.into_iter().take(limit) {
                if let Some(doc) = metadata.get(gpu_result.index) {
                    results.push(SearchResult {
                        id: doc.id.clone(),
                        content: doc.content.clone(),
                        score: gpu_result.similarity,
                        metadata: doc.metadata.clone(),
                        created_at: doc.created_at,
                    });
                }
            }
            
            Ok(results)
        } else {
            self.cpu_search(index, query_vector, limit, threshold).await
        }
    }
    
    /// CPU-based search with optimized algorithms
    async fn cpu_search(
        &self,
        index: &VectorIndex,
        query_vector: &Array1<f32>,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        let index_data = index.index_data.read().await;
        let vectors = index.vectors.read().await;
        let metadata = index.metadata.read().await;
        
        match &*index_data {
            IndexData::Exact => {
                self.exact_search(&vectors, &metadata, query_vector, limit, threshold).await
            },
            IndexData::LSH { tables, .. } => {
                self.lsh_search(tables, &vectors, &metadata, query_vector, limit, threshold).await
            },
            IndexData::HNSW { graph, entry_point } => {
                self.hnsw_search(graph, entry_point, &vectors, &metadata, query_vector, limit, threshold).await
            },
            IndexData::IVF { centroids, clusters } => {
                self.ivf_search(centroids, clusters, &vectors, &metadata, query_vector, limit, threshold).await
            },
        }
    }
    
    /// Exact brute-force search with SIMD optimization
    async fn exact_search(
        &self,
        vectors: &[Array1<f32>],
        metadata: &[VectorDocument],
        query_vector: &Array1<f32>,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        // Use parallel processing for large vector sets
        let similarities: Vec<(usize, f32)> = vectors
            .par_iter()
            .enumerate()
            .map(|(idx, vector)| {
                let similarity = self.compute_similarity(query_vector, vector);
                (idx, similarity)
            })
            .filter(|(_, sim)| *sim >= threshold)
            .collect();
        
        // Sort by similarity and take top results
        let mut sorted_similarities = similarities;
        sorted_similarities.par_sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        let results = sorted_similarities
            .into_iter()
            .take(limit)
            .filter_map(|(idx, score)| {
                metadata.get(idx).map(|doc| SearchResult {
                    id: doc.id.clone(),
                    content: doc.content.clone(),
                    score,
                    metadata: doc.metadata.clone(),
                    created_at: doc.created_at,
                })
            })
            .collect();
        
        Ok(results)
    }
    
    /// LSH-based approximate search
    async fn lsh_search(
        &self,
        tables: &[LSHTable],
        vectors: &[Array1<f32>],
        metadata: &[VectorDocument],
        query_vector: &Array1<f32>,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        let mut candidates = std::collections::HashSet::new();
        
        // Get candidates from LSH tables
        for table in tables {
            let hash = table.hash_func.hash(query_vector);
            if let Some(bucket) = table.buckets.get(&hash) {
                candidates.extend(bucket.iter());
            }
        }
        
        // Compute exact similarities for candidates
        let similarities: Vec<(usize, f32)> = candidates
            .into_iter()
            .filter_map(|&idx| {
                vectors.get(idx).map(|vector| {
                    let similarity = self.compute_similarity(query_vector, vector);
                    (idx, similarity)
                })
            })
            .filter(|(_, sim)| *sim >= threshold)
            .collect();
        
        // Sort and return top results
        let mut sorted_similarities = similarities;
        sorted_similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        let results = sorted_similarities
            .into_iter()
            .take(limit)
            .filter_map(|(idx, score)| {
                metadata.get(idx).map(|doc| SearchResult {
                    id: doc.id.clone(),
                    content: doc.content.clone(),
                    score,
                    metadata: doc.metadata.clone(),
                    created_at: doc.created_at,
                })
            })
            .collect();
        
        Ok(results)
    }
    
    /// HNSW graph-based search
    async fn hnsw_search(
        &self,
        _graph: &HNSWGraph,
        _entry_point: &Option<usize>,
        vectors: &[Array1<f32>],
        metadata: &[VectorDocument],
        query_vector: &Array1<f32>,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        // Simplified HNSW implementation - fall back to exact search for now
        // In production, this would implement the full HNSW algorithm
        self.exact_search(vectors, metadata, query_vector, limit, threshold).await
    }
    
    /// IVF (Inverted File) search
    async fn ivf_search(
        &self,
        _centroids: &[Array1<f32>],
        _clusters: &[Vec<usize>],
        vectors: &[Array1<f32>],
        metadata: &[VectorDocument],
        query_vector: &Array1<f32>,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        // Simplified IVF implementation - fall back to exact search for now
        // In production, this would implement the full IVF algorithm
        self.exact_search(vectors, metadata, query_vector, limit, threshold).await
    }
    
    /// Compute similarity between two vectors
    fn compute_similarity(&self, a: &Array1<f32>, b: &Array1<f32>) -> f32 {
        // Cosine similarity implementation
        let dot_product = a.dot(b);
        let norm_a = a.dot(a).sqrt();
        let norm_b = b.dot(b).sqrt();
        
        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            dot_product / (norm_a * norm_b)
        }
    }
    
    /// Helper methods
    fn get_index(&self, name: &str) -> Result<Arc<VectorIndex>> {
        self.indexes
            .get(name)
            .map(|entry| entry.value().clone())
            .ok_or_else(|| VectorError::IndexNotFound { name: name.to_string() }.into())
    }
    
    async fn should_use_gpu(&self, _index: &VectorIndex, _batch_size: usize) -> bool {
        #[cfg(feature = "metal-acceleration")]
        {
            self.accelerator.is_some() && self.config.is_gpu_enabled()
        }
        
        #[cfg(not(feature = "metal-acceleration"))]
        false
    }
    
    async fn update_index_structure(&self, _index: &VectorIndex) -> Result<()> {
        // Update index-specific structures when new vectors are added
        // Implementation depends on index type
        Ok(())
    }
    
    fn generate_cache_key(&self, index_name: &str, query: &SearchQuery) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        index_name.hash(&mut hasher);
        query.query_vector.len().hash(&mut hasher);
        query.limit.hash(&mut hasher);
        format!("{}_{}", index_name, hasher.finish())
    }
    
    async fn get_cached_results(&self, _cache_key: &str) -> Option<Vec<SearchResult>> {
        // Simplified cache implementation
        None
    }
    
    async fn cache_results(&self, _cache_key: &str, _results: &[SearchResult]) {
        // Simplified cache implementation
    }
    
    async fn invalidate_cache(&self) {
        // Clear cache when new vectors are added
    }
    
    /// Get index statistics
    pub async fn get_index_stats(&self, index_name: &str) -> Result<IndexStats> {
        let index = self.get_index(index_name)?;
        let stats = index.stats.read().await;
        Ok(stats.clone())
    }
    
    /// List all indexes
    pub async fn list_indexes(&self) -> Vec<String> {
        self.indexes.iter().map(|entry| entry.key().clone()).collect()
    }
}

impl RandomProjection {
    fn new(input_dim: usize, output_dim: usize) -> Self {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        
        let matrix = Array2::from_shape_fn((output_dim, input_dim), |_| {
            rng.gen_range(-1.0..1.0)
        });
        
        let bias = Array1::from_shape_fn(output_dim, |_| rng.gen_range(0.0..1.0));
        
        Self { matrix, bias }
    }
    
    fn hash(&self, vector: &Array1<f32>) -> String {
        let projection = self.matrix.dot(vector) + &self.bias;
        projection
            .iter()
            .map(|&x| if x > 0.0 { '1' } else { '0' })
            .collect()
    }
}

// GPU acceleration stub for non-Metal builds
#[cfg(not(feature = "metal-acceleration"))]
impl VectorEngine {
    async fn gpu_accelerated_search(
        &self,
        index: &VectorIndex,
        query_vector: &Array1<f32>,
        limit: usize,
        threshold: f32,
    ) -> Result<Vec<SearchResult>> {
        self.cpu_search(index, query_vector, limit, threshold).await
    }
}
// Simplified vector engine for initial testing and benchmarking
// This version focuses on correctness over advanced features

use anyhow::Result;
use dashmap::DashMap;
use ndarray::Array1;
use tokio::sync::RwLock;
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, instrument};

use crate::config::Config;
use crate::types::*;
use crate::storage::{StorageBackend, StorageFactory};
use crate::metrics::MetricsService;
use crate::accelerator::{VectorAccelerator, AcceleratorFactory};

/// Simplified vector index structure
#[derive(Debug)]
pub struct SimpleVectorIndex {
    pub name: String,
    pub vectors: Arc<RwLock<Vec<(String, Array1<f32>)>>>,
    pub config: IndexConfig,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Simplified vector engine implementation
pub struct SimpleVectorEngine {
    config: Config,
    storage: Arc<dyn StorageBackend + Send + Sync>,
    indexes: Arc<DashMap<String, Arc<SimpleVectorIndex>>>,
    metrics: Arc<MetricsService>,
    accelerator: Option<Box<dyn VectorAccelerator + Send + Sync>>,
    default_index: Arc<SimpleVectorIndex>,
}

impl SimpleVectorEngine {
    /// Create a new simple vector engine
    pub async fn new(
        config: Config,
        metrics: Arc<MetricsService>,
    ) -> Result<Self> {
        info!("Initializing simple vector engine");
        
        // Initialize storage backend
        let storage = StorageFactory::create_storage(&config).await?;
        
        // Initialize accelerator
        let accelerator = AcceleratorFactory::create_best_available().await.ok();
        
        // Create default index
        let default_index = Arc::new(SimpleVectorIndex {
            name: "default".to_string(),
            vectors: Arc::new(RwLock::new(Vec::new())),
            config: IndexConfig {
                name: "default".to_string(),
                dimensions: config.vector.dimensions,
                metric: SimilarityMetric::Cosine,
                index_type: IndexType::Exact,
                parameters: IndexParameters::default(),
            },
            created_at: chrono::Utc::now(),
        });
        
        let indexes = Arc::new(DashMap::new());
        indexes.insert("default".to_string(), default_index.clone());
        
        Ok(Self {
            config,
            storage,
            indexes,
            metrics,
            accelerator,
            default_index,
        })
    }
    
    /// Insert a vector document
    #[instrument(skip(self, document))]
    pub async fn insert_document(&self, document: VectorDocument) -> Result<String> {
        let start_time = Instant::now();
        
        // Validate vector dimensions
        if document.embedding.len() != self.config.vector.dimensions {
            return Err(VectorError::DimensionMismatch {
                expected: self.config.vector.dimensions,
                actual: document.embedding.len(),
            }.into());
        }
        
        // Store in persistence layer
        let doc_id = self.storage.insert(&document).await?;
        
        // Add to default index
        let vector = Array1::from_vec(document.embedding.clone());
        {
            let mut vectors = self.default_index.vectors.write().await;
            vectors.push((doc_id.clone(), vector));
        }
        
        // Update metrics
        let duration = start_time.elapsed();
        self.metrics.record_insert(duration, 1, true);
        
        info!("Document inserted: {}", doc_id);
        Ok(doc_id)
    }
    
    /// Batch insert multiple documents
    #[instrument(skip(self, documents))]
    pub async fn batch_insert_documents(&self, documents: Vec<VectorDocument>) -> Result<Vec<String>> {
        let start_time = Instant::now();
        let batch_size = documents.len();
        
        // Validate all vectors
        for doc in &documents {
            if doc.embedding.len() != self.config.vector.dimensions {
                return Err(VectorError::DimensionMismatch {
                    expected: self.config.vector.dimensions,
                    actual: doc.embedding.len(),
                }.into());
            }
        }
        
        // Batch insert to storage
        let doc_ids = self.storage.batch_insert(&documents).await?;
        
        // Add all to default index
        {
            let mut vectors = self.default_index.vectors.write().await;
            for (id, doc) in doc_ids.iter().zip(documents.iter()) {
                let vector = Array1::from_vec(doc.embedding.clone());
                vectors.push((id.clone(), vector));
            }
        }
        
        // Update metrics
        let duration = start_time.elapsed();
        self.metrics.record_insert(duration, batch_size, true);
        
        info!("Batch inserted {} documents", batch_size);
        Ok(doc_ids)
    }
    
    /// Search for similar vectors
    #[instrument(skip(self, query))]
    pub async fn search(&self, query: &SearchQuery) -> Result<Vec<SearchResult>> {
        let start_time = Instant::now();
        
        // Validate query vector dimensions
        if query.query_vector.len() != self.config.vector.dimensions {
            return Err(VectorError::DimensionMismatch {
                expected: self.config.vector.dimensions,
                actual: query.query_vector.len(),
            }.into());
        }
        
        let query_vector = Array1::from_vec(query.query_vector.clone());
        let limit = query.limit.unwrap_or(10);
        let threshold = query.threshold.unwrap_or(0.0);
        
        // Get vectors from index
        let vectors = self.default_index.vectors.read().await;
        let candidate_vectors: Vec<Array1<f32>> = vectors.iter().map(|(_, v)| v.clone()).collect();
        let candidate_ids: Vec<String> = vectors.iter().map(|(id, _)| id.clone()).collect();
        drop(vectors);
        
        // Compute similarities
        let similarities = if let Some(ref accelerator) = self.accelerator {
            accelerator.compute_similarities(&query_vector, &candidate_vectors, "cosine").await?
        } else {
            // CPU fallback
            self.compute_similarities_cpu(&query_vector, &candidate_vectors).await?
        };
        
        // Create results with scores
        let mut scored_results: Vec<(usize, f32)> = similarities
            .into_iter()
            .enumerate()
            .filter(|(_, score)| *score >= threshold)
            .collect();
        
        // Sort by similarity (descending)
        scored_results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        // Limit results
        scored_results.truncate(limit);
        
        // Get document IDs and fetch from storage
        let result_ids: Vec<String> = scored_results
            .iter()
            .map(|(idx, _)| candidate_ids[*idx].clone())
            .collect();
        
        let documents = self.storage.get_by_ids(&result_ids).await?;
        
        // Create search results
        let mut results = Vec::new();
        for ((_, score), doc) in scored_results.into_iter().zip(documents.into_iter()) {
            results.push(SearchResult {
                id: doc.id,
                content: doc.content,
                score,
                metadata: doc.metadata,
                created_at: doc.created_at,
            });
        }
        
        // Update metrics
        let duration = start_time.elapsed();
        self.metrics.record_search(duration, "exact", "cosine", true);
        
        info!("Search completed: {} results", results.len());
        Ok(results)
    }
    
    /// CPU-based similarity computation fallback
    async fn compute_similarities_cpu(
        &self,
        query: &Array1<f32>,
        candidates: &[Array1<f32>],
    ) -> Result<Vec<f32>> {
        use rayon::prelude::*;
        
        let similarities = candidates
            .par_iter()
            .map(|candidate| self.cosine_similarity(query, candidate))
            .collect();
        
        Ok(similarities)
    }
    
    /// Compute cosine similarity between two vectors
    fn cosine_similarity(&self, a: &Array1<f32>, b: &Array1<f32>) -> f32 {
        let dot_product = a.dot(b);
        let norm_a = a.dot(a).sqrt();
        let norm_b = b.dot(b).sqrt();
        
        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            dot_product / (norm_a * norm_b)
        }
    }
    
    /// Get a document by ID
    #[instrument(skip(self))]
    pub async fn get_document(&self, id: &str) -> Result<Option<VectorDocument>> {
        self.storage.get(id).await
    }
    
    /// Delete a document by ID
    #[instrument(skip(self))]
    pub async fn delete_document(&self, id: &str) -> Result<bool> {
        let deleted = self.storage.delete(id).await?;
        
        if deleted {
            // Remove from index
            let mut vectors = self.default_index.vectors.write().await;
            vectors.retain(|(doc_id, _)| doc_id != id);
        }
        
        Ok(deleted)
    }
    
    /// Get total number of vectors
    pub async fn get_total_vectors(&self) -> Result<usize> {
        self.storage.count().await
    }
    
    /// Get engine metrics
    pub async fn get_metrics(&self) -> Result<VectorMetrics> {
        let total_vectors = self.get_total_vectors().await?;
        let index_size = self.default_index.vectors.read().await.len() * self.config.vector.dimensions * 4; // 4 bytes per f32
        
        Ok(self.metrics.get_vector_metrics(total_vectors, index_size))
    }
    
    /// Check if GPU acceleration is enabled
    pub fn is_gpu_enabled(&self) -> bool {
        self.accelerator.is_some()
    }
    
    /// Clear all data (for testing)
    pub async fn clear_all(&self) -> Result<()> {
        self.storage.clear().await?;
        self.default_index.vectors.write().await.clear();
        Ok(())
    }
    
    /// Create backup
    pub async fn create_backup(&self, path: &str) -> Result<()> {
        self.storage.backup(path).await
    }
    
    /// Restore from backup
    pub async fn restore_backup(&self, path: &str) -> Result<()> {
        self.storage.restore(path).await?;
        
        // Rebuild index from storage
        let documents = self.storage.get_all().await?;
        let mut vectors = self.default_index.vectors.write().await;
        vectors.clear();
        
        for doc in documents {
            let vector = Array1::from_vec(doc.embedding);
            vectors.push((doc.id, vector));
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    
    async fn create_test_engine() -> Result<SimpleVectorEngine> {
        let temp_dir = tempdir()?;
        let mut config = Config::default();
        config.storage.local_path = Some(temp_dir.path().to_str().unwrap().to_string());
        config.vector.dimensions = 3;
        
        let metrics = Arc::new(MetricsService::new()?);
        SimpleVectorEngine::new(config, metrics).await
    }
    
    #[tokio::test]
    async fn test_insert_and_search() -> Result<()> {
        let engine = create_test_engine().await?;
        
        // Insert test documents
        let doc1 = VectorDocument::new(
            "test document 1".to_string(),
            vec![1.0, 0.0, 0.0],
            None,
        );
        let doc2 = VectorDocument::new(
            "test document 2".to_string(),
            vec![0.0, 1.0, 0.0],
            None,
        );
        let doc3 = VectorDocument::new(
            "test document 3".to_string(),
            vec![1.0, 0.0, 0.0], // Similar to doc1
            None,
        );
        
        engine.insert_document(doc1).await?;
        engine.insert_document(doc2).await?;
        engine.insert_document(doc3).await?;
        
        // Search for similar vectors
        let query = SearchQuery {
            query_vector: vec![1.0, 0.0, 0.0],
            limit: Some(2),
            threshold: Some(0.9),
            filter: None,
            include_metadata: Some(true),
        };
        
        let results = engine.search(&query).await?;
        
        // Should find 2 similar documents (doc1 and doc3)
        assert_eq!(results.len(), 2);
        assert!(results[0].score >= 0.9);
        assert!(results[1].score >= 0.9);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_batch_operations() -> Result<()> {
        let engine = create_test_engine().await?;
        
        // Create batch of documents
        let documents = vec![
            VectorDocument::new("doc1".to_string(), vec![1.0, 0.0, 0.0], None),
            VectorDocument::new("doc2".to_string(), vec![0.0, 1.0, 0.0], None),
            VectorDocument::new("doc3".to_string(), vec![0.0, 0.0, 1.0], None),
        ];
        
        // Batch insert
        let ids = engine.batch_insert_documents(documents).await?;
        assert_eq!(ids.len(), 3);
        
        // Verify total count
        let total = engine.get_total_vectors().await?;
        assert_eq!(total, 3);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_delete_document() -> Result<()> {
        let engine = create_test_engine().await?;
        
        // Insert a document
        let doc = VectorDocument::new(
            "test document".to_string(),
            vec![1.0, 0.0, 0.0],
            None,
        );
        let id = engine.insert_document(doc).await?;
        
        // Verify it exists
        let retrieved = engine.get_document(&id).await?;
        assert!(retrieved.is_some());
        
        // Delete it
        let deleted = engine.delete_document(&id).await?;
        assert!(deleted);
        
        // Verify it's gone
        let retrieved = engine.get_document(&id).await?;
        assert!(retrieved.is_none());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_backup_restore() -> Result<()> {
        let engine = create_test_engine().await?;
        
        // Insert test data
        let doc = VectorDocument::new(
            "backup test".to_string(),
            vec![1.0, 0.5, 0.0],
            Some(serde_json::json!({"test": true})),
        );
        engine.insert_document(doc).await?;
        
        // Create backup
        let backup_path = "/tmp/vector_test_backup.json";
        engine.create_backup(backup_path).await?;
        
        // Clear data
        engine.clear_all().await?;
        assert_eq!(engine.get_total_vectors().await?, 0);
        
        // Restore from backup
        engine.restore_backup(backup_path).await?;
        assert_eq!(engine.get_total_vectors().await?, 1);
        
        // Cleanup
        std::fs::remove_file(backup_path).ok();
        
        Ok(())
    }
}
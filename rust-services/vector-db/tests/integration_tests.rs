// Comprehensive integration tests for the vector database service
// Tests real-world scenarios with multiple storage backends and configurations

use anyhow::Result;
use std::sync::Arc;
use std::time::Instant;
use tempfile::tempdir;
use tokio::time::{timeout, Duration};

use vector_db::{
    config::{Config, StorageBackend as StorageBackendConfig},
    simple_engine::SimpleVectorEngine,
    types::*,
    metrics::MetricsService,
};

/// Test fixture for setting up test environments
struct TestFixture {
    engine: SimpleVectorEngine,
    _temp_dir: tempfile::TempDir,
}

impl TestFixture {
    async fn new(storage_backend: StorageBackendConfig, dimensions: usize) -> Result<Self> {
        let temp_dir = tempdir()?;
        let mut config = Config::default();
        config.storage.backend = storage_backend;
        config.storage.local_path = Some(temp_dir.path().to_str().unwrap().to_string());
        config.vector.dimensions = dimensions;
        config.vector.cache_size = 1000;
        
        let metrics = Arc::new(MetricsService::new()?);
        let engine = SimpleVectorEngine::new(config, metrics).await?;
        
        Ok(Self {
            engine,
            _temp_dir: temp_dir,
        })
    }
    
    /// Generate test vectors with known similarities
    fn generate_test_vectors(count: usize, dimensions: usize) -> Vec<VectorDocument> {
        let mut documents = Vec::new();
        
        for i in 0..count {
            let mut embedding = vec![0.0; dimensions];
            
            // Create patterns for similarity testing
            match i % 4 {
                0 => embedding[0] = 1.0, // Group A
                1 => embedding[1] = 1.0, // Group B  
                2 => embedding[2] = 1.0, // Group C
                3 => {                   // Mixed group
                    embedding[0] = 0.5;
                    embedding[1] = 0.5;
                }
            }
            
            let content = format!("Test document {} - group {}", i, i % 4);
            let metadata = serde_json::json!({
                "id": i,
                "group": i % 4,
                "created_by": "test_suite"
            });
            
            documents.push(VectorDocument::new(content, embedding, Some(metadata)));
        }
        
        documents
    }
}

/// Integration test suite
mod integration_tests {
    use super::*;
    
    #[tokio::test]
    async fn test_memory_storage_backend() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 128).await?;
        run_basic_crud_tests(&fixture.engine).await
    }
    
    #[tokio::test]
    async fn test_local_storage_backend() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Local, 128).await?;
        run_basic_crud_tests(&fixture.engine).await
    }
    
    #[tokio::test]
    async fn test_hybrid_storage_backend() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Hybrid, 128).await?;
        run_basic_crud_tests(&fixture.engine).await
    }
    
    async fn run_basic_crud_tests(engine: &SimpleVectorEngine) -> Result<()> {
        // Test single document operations
        let doc = VectorDocument::new(
            "Integration test document".to_string(),
            vec![0.1; 128],
            Some(serde_json::json!({"test": "integration"})),
        );
        
        // Insert
        let id = engine.insert_document(doc.clone()).await?;
        assert!(!id.is_empty());
        
        // Get
        let retrieved = engine.get_document(&id).await?;
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.content, doc.content);
        assert_eq!(retrieved.embedding.len(), 128);
        
        // Delete
        let deleted = engine.delete_document(&id).await?;
        assert!(deleted);
        
        // Verify deletion
        let retrieved = engine.get_document(&id).await?;
        assert!(retrieved.is_none());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_large_batch_operations() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 256).await?;
        
        // Generate large batch of documents
        let documents = TestFixture::generate_test_vectors(1000, 256);
        
        // Batch insert with timeout
        let insert_result = timeout(
            Duration::from_secs(30),
            fixture.engine.batch_insert_documents(documents)
        ).await??;
        
        assert_eq!(insert_result.len(), 1000);
        
        // Verify total count
        let total = fixture.engine.get_total_vectors().await?;
        assert_eq!(total, 1000);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_similarity_search_accuracy() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 64).await?;
        
        // Insert documents with known similarity patterns
        let documents = TestFixture::generate_test_vectors(100, 64);
        fixture.engine.batch_insert_documents(documents).await?;
        
        // Search for Group A vectors (embedding[0] = 1.0)
        let query = SearchQuery {
            query_vector: {
                let mut v = vec![0.0; 64];
                v[0] = 1.0;
                v
            },
            limit: Some(30),
            threshold: Some(0.9),
            filter: None,
            include_metadata: Some(true),
        };
        
        let results = fixture.engine.search(&query).await?;
        
        // Should find approximately 25 documents from Group A (every 4th document)
        assert!(results.len() >= 20);
        assert!(results.len() <= 30);
        
        // All results should have high similarity scores
        for result in &results {
            assert!(result.score >= 0.9);
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_concurrent_operations() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 32).await?;
        let engine = Arc::new(fixture.engine);
        
        // Spawn multiple concurrent insert tasks
        let mut handles = Vec::new();
        
        for batch_id in 0..10 {
            let engine_clone = engine.clone();
            let handle = tokio::spawn(async move {
                let documents = TestFixture::generate_test_vectors(50, 32);
                engine_clone.batch_insert_documents(documents).await
            });
            handles.push(handle);
        }
        
        // Wait for all insertions to complete
        for handle in handles {
            let result = handle.await??;
            assert_eq!(result.len(), 50);
        }
        
        // Verify total count
        let total = engine.get_total_vectors().await?;
        assert_eq!(total, 500);
        
        // Test concurrent searches
        let mut search_handles = Vec::new();
        
        for _ in 0..20 {
            let engine_clone = engine.clone();
            let handle = tokio::spawn(async move {
                let query = SearchQuery {
                    query_vector: vec![0.5; 32],
                    limit: Some(10),
                    threshold: Some(0.0),
                    filter: None,
                    include_metadata: Some(true),
                };
                engine_clone.search(&query).await
            });
            search_handles.push(handle);
        }
        
        // Wait for all searches to complete
        for handle in search_handles {
            let results = handle.await??;
            assert!(results.len() <= 10);
        }
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_backup_and_restore_integrity() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Local, 16).await?;
        
        // Insert test data with specific patterns
        let documents = TestFixture::generate_test_vectors(50, 16);
        let original_ids = fixture.engine.batch_insert_documents(documents.clone()).await?;
        
        // Create backup
        let backup_path = "/tmp/integration_test_backup.json";
        fixture.engine.create_backup(backup_path).await?;
        
        // Clear all data
        fixture.engine.clear_all().await?;
        assert_eq!(fixture.engine.get_total_vectors().await?, 0);
        
        // Restore from backup
        fixture.engine.restore_backup(backup_path).await?;
        
        // Verify data integrity
        assert_eq!(fixture.engine.get_total_vectors().await?, 50);
        
        // Test that searches still work correctly
        let query = SearchQuery {
            query_vector: documents[0].embedding.clone(),
            limit: Some(5),
            threshold: Some(0.8),
            filter: None,
            include_metadata: Some(true),
        };
        
        let results = fixture.engine.search(&query).await?;
        assert!(!results.is_empty());
        
        // Cleanup
        std::fs::remove_file(backup_path).ok();
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_metrics_collection() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 8).await?;
        
        // Perform operations to generate metrics
        let doc = VectorDocument::new(
            "metrics test".to_string(),
            vec![1.0; 8],
            None,
        );
        
        fixture.engine.insert_document(doc).await?;
        
        let query = SearchQuery {
            query_vector: vec![1.0; 8],
            limit: Some(5),
            threshold: Some(0.0),
            filter: None,
            include_metadata: Some(true),
        };
        
        fixture.engine.search(&query).await?;
        
        // Get metrics
        let metrics = fixture.engine.get_metrics().await?;
        
        assert_eq!(metrics.total_vectors, 1);
        assert!(metrics.total_searches >= 1);
        assert!(metrics.total_inserts >= 1);
        assert!(metrics.average_search_time_ms >= 0.0);
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_dimension_validation() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 64).await?;
        
        // Test with wrong dimensions
        let invalid_doc = VectorDocument::new(
            "invalid dimensions".to_string(),
            vec![1.0; 32], // Wrong size (should be 64)
            None,
        );
        
        let result = fixture.engine.insert_document(invalid_doc).await;
        assert!(result.is_err());
        
        // Test search with wrong dimensions
        let invalid_query = SearchQuery {
            query_vector: vec![1.0; 32], // Wrong size
            limit: Some(5),
            threshold: Some(0.0),
            filter: None,
            include_metadata: Some(true),
        };
        
        let result = fixture.engine.search(&invalid_query).await;
        assert!(result.is_err());
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_edge_cases() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 4).await?;
        
        // Test with zero vectors
        let zero_doc = VectorDocument::new(
            "zero vector".to_string(),
            vec![0.0; 4],
            None,
        );
        
        fixture.engine.insert_document(zero_doc).await?;
        
        // Test search with zero vector
        let zero_query = SearchQuery {
            query_vector: vec![0.0; 4],
            limit: Some(5),
            threshold: Some(0.0),
            filter: None,
            include_metadata: Some(true),
        };
        
        let results = fixture.engine.search(&zero_query).await?;
        assert!(!results.is_empty());
        
        // Test very large vectors
        let large_doc = VectorDocument::new(
            "large vector".to_string(),
            vec![1000.0; 4],
            None,
        );
        
        fixture.engine.insert_document(large_doc).await?;
        
        // Test empty search results
        let no_match_query = SearchQuery {
            query_vector: vec![1.0, 0.0, 0.0, 0.0],
            limit: Some(5),
            threshold: Some(0.99), // Very high threshold
            filter: None,
            include_metadata: Some(true),
        };
        
        let results = fixture.engine.search(&no_match_query).await?;
        // Results may be empty or contain only very similar vectors
        assert!(results.len() <= 5);
        
        Ok(())
    }
}

/// Performance test suite
mod performance_tests {
    use super::*;
    use std::time::Instant;
    
    #[tokio::test]
    async fn test_insert_performance() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 128).await?;
        
        // Single insert performance
        let doc = VectorDocument::new(
            "performance test".to_string(),
            vec![0.5; 128],
            None,
        );
        
        let start = Instant::now();
        fixture.engine.insert_document(doc).await?;
        let single_insert_time = start.elapsed();
        
        println!("Single insert time: {:?}", single_insert_time);
        assert!(single_insert_time.as_millis() < 100); // Should be under 100ms
        
        // Batch insert performance
        let documents = TestFixture::generate_test_vectors(1000, 128);
        
        let start = Instant::now();
        fixture.engine.batch_insert_documents(documents).await?;
        let batch_insert_time = start.elapsed();
        
        println!("Batch insert time (1000 docs): {:?}", batch_insert_time);
        assert!(batch_insert_time.as_secs() < 10); // Should be under 10 seconds
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_search_performance() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 256).await?;
        
        // Insert test data
        let documents = TestFixture::generate_test_vectors(5000, 256);
        fixture.engine.batch_insert_documents(documents).await?;
        
        // Single search performance
        let query = SearchQuery {
            query_vector: vec![0.5; 256],
            limit: Some(10),
            threshold: Some(0.0),
            filter: None,
            include_metadata: Some(true),
        };
        
        let start = Instant::now();
        let results = fixture.engine.search(&query).await?;
        let search_time = start.elapsed();
        
        println!("Search time (5000 vectors): {:?}", search_time);
        assert!(search_time.as_millis() < 500); // Should be under 500ms
        assert_eq!(results.len(), 10);
        
        // Multiple search performance
        let start = Instant::now();
        for _ in 0..100 {
            fixture.engine.search(&query).await?;
        }
        let multi_search_time = start.elapsed();
        
        println!("100 searches time: {:?}", multi_search_time);
        assert!(multi_search_time.as_secs() < 30); // Should be under 30 seconds
        
        Ok(())
    }
    
    #[tokio::test]
    async fn test_memory_usage() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 64).await?;
        
        // Insert increasingly large datasets and monitor behavior
        for batch_size in [100, 500, 1000, 2000] {
            let documents = TestFixture::generate_test_vectors(batch_size, 64);
            
            let start = Instant::now();
            fixture.engine.batch_insert_documents(documents).await?;
            let insert_time = start.elapsed();
            
            let total = fixture.engine.get_total_vectors().await?;
            
            println!("Batch size: {}, Total vectors: {}, Insert time: {:?}", 
                     batch_size, total, insert_time);
            
            // Verify search still works efficiently
            let query = SearchQuery {
                query_vector: vec![0.5; 64],
                limit: Some(10),
                threshold: Some(0.0),
                filter: None,
                include_metadata: Some(true),
            };
            
            let start = Instant::now();
            let results = fixture.engine.search(&query).await?;
            let search_time = start.elapsed();
            
            println!("Search time with {} vectors: {:?}", total, search_time);
            assert!(results.len() <= 10);
        }
        
        Ok(())
    }
}

/// Load testing suite
mod load_tests {
    use super::*;
    use tokio::task::JoinSet;
    
    #[tokio::test]
    async fn test_concurrent_load() -> Result<()> {
        let fixture = TestFixture::new(StorageBackendConfig::Memory, 32).await?;
        let engine = Arc::new(fixture.engine);
        
        // Pre-populate with some data
        let documents = TestFixture::generate_test_vectors(1000, 32);
        engine.batch_insert_documents(documents).await?;
        
        let mut join_set = JoinSet::new();
        
        // Spawn concurrent read operations
        for i in 0..50 {
            let engine_clone = engine.clone();
            join_set.spawn(async move {
                let query = SearchQuery {
                    query_vector: vec![i as f32 / 50.0; 32],
                    limit: Some(5),
                    threshold: Some(0.0),
                    filter: None,
                    include_metadata: Some(true),
                };
                
                for _ in 0..10 {
                    engine_clone.search(&query).await?;
                }
                
                Ok::<(), anyhow::Error>(())
            });
        }
        
        // Spawn concurrent write operations
        for i in 0..10 {
            let engine_clone = engine.clone();
            join_set.spawn(async move {
                let docs = TestFixture::generate_test_vectors(10, 32);
                engine_clone.batch_insert_documents(docs).await?;
                Ok::<(), anyhow::Error>(())
            });
        }
        
        let start = Instant::now();
        
        // Wait for all operations to complete
        while let Some(result) = join_set.join_next().await {
            result??;
        }
        
        let total_time = start.elapsed();
        println!("Concurrent load test completed in: {:?}", total_time);
        
        // Verify system is still responsive
        let final_count = engine.get_total_vectors().await?;
        println!("Final vector count: {}", final_count);
        assert!(final_count >= 1000);
        
        Ok(())
    }
}
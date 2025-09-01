use redis_service::*;
use std::time::Duration;
use tokio;

#[tokio::test]
async fn test_cache_manager_basic_operations() {
    // Initialize with in-memory fallback only
    let cache_config = CacheConfig {
        strategy: CacheStrategy::LRU,
        max_entries: 100,
        max_size_bytes: 1024 * 1024, // 1MB
        default_ttl: Some(Duration::from_secs(60)),
        enable_compression: true,
        compression_threshold: 100,
        ..Default::default()
    };

    let cache_manager = CacheManager::new(None, cache_config)
        .await
        .expect("Failed to create cache manager");

    // Test set and get
    let key = "test_key";
    let value = "test_value";
    
    cache_manager.set(key, &value, None)
        .await
        .expect("Failed to set value");

    let retrieved: Option<String> = cache_manager.get(key)
        .await
        .expect("Failed to get value");

    assert_eq!(retrieved, Some(value.to_string()));

    // Test exists
    let exists = cache_manager.exists(key)
        .await
        .expect("Failed to check existence");
    assert!(exists);

    // Test delete
    let deleted = cache_manager.delete(key)
        .await
        .expect("Failed to delete key");
    assert!(deleted);

    // Verify deletion
    let exists_after_delete = cache_manager.exists(key)
        .await
        .expect("Failed to check existence after delete");
    assert!(!exists_after_delete);
}

#[tokio::test]
async fn test_cache_ttl_expiration() {
    let cache_config = CacheConfig::default();
    let cache_manager = CacheManager::new(None, cache_config)
        .await
        .expect("Failed to create cache manager");

    let key = "ttl_key";
    let value = "ttl_value";
    let ttl = Duration::from_millis(100);

    cache_manager.set(key, &value, Some(ttl))
        .await
        .expect("Failed to set value with TTL");

    // Value should exist immediately
    let exists = cache_manager.exists(key)
        .await
        .expect("Failed to check existence");
    assert!(exists);

    // Wait for TTL to expire
    tokio::time::sleep(Duration::from_millis(150)).await;

    // Value should be expired
    let retrieved: Option<String> = cache_manager.get(key)
        .await
        .expect("Failed to get expired value");
    assert_eq!(retrieved, None);
}

#[tokio::test]
async fn test_cache_statistics() {
    let cache_config = CacheConfig::default();
    let cache_manager = CacheManager::new(None, cache_config)
        .await
        .expect("Failed to create cache manager");

    // Perform some operations
    cache_manager.set("key1", &"value1", None).await.unwrap();
    cache_manager.set("key2", &"value2", None).await.unwrap();
    let _: Option<String> = cache_manager.get("key1").await.unwrap();
    let _: Option<String> = cache_manager.get("key3").await.unwrap(); // miss

    let stats = cache_manager.get_statistics().await;
    
    assert!(stats.total_entries > 0);
    assert!(stats.hit_count > 0 || stats.miss_count > 0);
}

#[tokio::test]
async fn test_compression_manager() {
    use redis_service::compression::{CompressionManager, CompressionAlgorithm};

    let manager = CompressionManager::new(100); // 100 bytes threshold

    let small_data = b"small";
    let large_data = vec![b'a'; 1000];

    // Small data shouldn't be compressed
    assert!(!manager.should_compress(small_data));

    // Large data should be compressed
    assert!(manager.should_compress(&large_data));

    // Test LZ4 compression
    let compressed_lz4 = manager.compress(&large_data, CompressionAlgorithm::LZ4)
        .expect("LZ4 compression failed");
    
    let decompressed_lz4 = manager.decompress(&compressed_lz4, CompressionAlgorithm::LZ4)
        .expect("LZ4 decompression failed");
    
    assert_eq!(large_data, decompressed_lz4);

    // Test Zstd compression
    let compressed_zstd = manager.compress(&large_data, CompressionAlgorithm::Zstd)
        .expect("Zstd compression failed");
    
    let decompressed_zstd = manager.decompress(&compressed_zstd, CompressionAlgorithm::Zstd)
        .expect("Zstd decompression failed");
    
    assert_eq!(large_data, decompressed_zstd);

    // Verify compression actually reduces size
    assert!(compressed_lz4.len() < large_data.len());
    assert!(compressed_zstd.len() < large_data.len());
}

#[tokio::test]
async fn test_session_manager() {
    let cache_config = CacheConfig::default();
    let cache_manager = std::sync::Arc::new(
        CacheManager::new(None, cache_config)
            .await
            .expect("Failed to create cache manager")
    );

    let session_manager = std::sync::Arc::new(
        SessionManager::new(cache_manager, Duration::from_secs(3600))
    );

    // Create a session
    let session = session_manager.create_session(
        "test-session-id".to_string(),
        Some("user123".to_string()),
        None,
    ).await.expect("Failed to create session");

    assert_eq!(session.session_id, "test-session-id");
    assert_eq!(session.user_id, Some("user123".to_string()));

    // Get the session
    let retrieved = session_manager.get_session("test-session-id")
        .await
        .expect("Failed to get session");
    
    assert!(retrieved.is_some());
    let retrieved_session = retrieved.unwrap();
    assert_eq!(retrieved_session.session_id, "test-session-id");

    // Update session data
    session_manager.update_session(
        "test-session-id",
        "key1".to_string(),
        serde_json::json!("value1"),
    ).await.expect("Failed to update session");

    // Delete the session
    let deleted = session_manager.delete_session("test-session-id")
        .await
        .expect("Failed to delete session");
    
    assert!(deleted);

    // Verify deletion
    let retrieved_after_delete = session_manager.get_session("test-session-id")
        .await
        .expect("Failed to get session after delete");
    
    assert!(retrieved_after_delete.is_none());
}

#[tokio::test]
async fn test_metrics_collector() {
    use redis_service::metrics::MetricsCollector;

    let collector = MetricsCollector::new(Duration::from_secs(60));

    // Record operations
    collector.record_operation("get", Duration::from_millis(10), true, false).await;
    collector.record_operation("get", Duration::from_millis(15), true, false).await;
    collector.record_operation("get", Duration::from_millis(20), false, false).await;
    collector.record_operation("set", Duration::from_millis(5), true, false).await;
    collector.record_operation("set", Duration::from_millis(8), false, true).await;

    // Record cache events
    collector.record_cache_hit().await;
    collector.record_cache_hit().await;
    collector.record_cache_miss().await;
    collector.record_eviction().await;

    // Get metrics
    let operation_metrics = collector.get_operation_metrics().await;
    
    assert_eq!(operation_metrics.get("get").unwrap().count, 3);
    assert_eq!(operation_metrics.get("get").unwrap().success_count, 2);
    assert_eq!(operation_metrics.get("get").unwrap().failure_count, 1);
    
    assert_eq!(operation_metrics.get("set").unwrap().count, 2);
    assert_eq!(operation_metrics.get("set").unwrap().timeout_count, 1);

    let cache_stats = collector.get_cache_statistics().await;
    assert_eq!(cache_stats.hit_count, 2);
    assert_eq!(cache_stats.miss_count, 1);
    assert_eq!(cache_stats.eviction_count, 1);

    // Test summary
    let summary = collector.get_summary().await;
    assert_eq!(summary.total_operations, 5);
    assert_eq!(summary.total_successes, 3);
    assert_eq!(summary.total_failures, 2);
    assert_eq!(summary.total_timeouts, 1);

    // Test Prometheus export
    let prometheus_output = collector.export_prometheus().await;
    assert!(prometheus_output.contains("redis_service_operations_total"));
    assert!(prometheus_output.contains("redis_service_cache_hit_rate"));
}

#[tokio::test]
async fn test_complex_data_types() {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct User {
        id: u64,
        name: String,
        email: String,
        metadata: std::collections::HashMap<String, String>,
    }

    let cache_config = CacheConfig::default();
    let cache_manager = CacheManager::new(None, cache_config)
        .await
        .expect("Failed to create cache manager");

    let mut metadata = std::collections::HashMap::new();
    metadata.insert("role".to_string(), "admin".to_string());
    metadata.insert("department".to_string(), "engineering".to_string());

    let user = User {
        id: 123,
        name: "John Doe".to_string(),
        email: "john@example.com".to_string(),
        metadata,
    };

    // Store complex object
    cache_manager.set("user:123", &user, None)
        .await
        .expect("Failed to set user");

    // Retrieve complex object
    let retrieved: Option<User> = cache_manager.get("user:123")
        .await
        .expect("Failed to get user");

    assert_eq!(retrieved, Some(user));
}

#[tokio::test]
async fn test_concurrent_operations() {
    let cache_config = CacheConfig::default();
    let cache_manager = std::sync::Arc::new(
        CacheManager::new(None, cache_config)
            .await
            .expect("Failed to create cache manager")
    );

    let mut handles = vec![];

    // Spawn multiple concurrent operations
    for i in 0..10 {
        let cache = cache_manager.clone();
        let handle = tokio::spawn(async move {
            let key = format!("concurrent_key_{}", i);
            let value = format!("concurrent_value_{}", i);
            
            cache.set(&key, &value, None).await.unwrap();
            
            let retrieved: Option<String> = cache.get(&key).await.unwrap();
            assert_eq!(retrieved, Some(value));
        });
        handles.push(handle);
    }

    // Wait for all operations to complete
    for handle in handles {
        handle.await.expect("Task failed");
    }

    // Verify all keys exist
    for i in 0..10 {
        let key = format!("concurrent_key_{}", i);
        let exists = cache_manager.exists(&key).await.unwrap();
        assert!(exists);
    }
}
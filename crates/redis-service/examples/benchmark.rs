use redis_service::*;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Redis Service Benchmark");
    println!("=======================\n");

    // Configure cache
    let cache_config = CacheConfig {
        strategy: CacheStrategy::LRU,
        max_entries: 10000,
        max_size_bytes: 100 * 1024 * 1024, // 100MB
        default_ttl: Some(Duration::from_secs(300)),
        enable_compression: true,
        compression_threshold: 1024, // 1KB
        ..Default::default()
    };

    // Try to connect to Redis if available
    let redis_config = RedisConfig {
        url: "redis://localhost:6379".to_string(),
        max_connections: 20,
        min_idle: 5,
        connection_timeout: Duration::from_secs(5),
        command_timeout: Duration::from_secs(2),
        max_retries: 3,
        retry_delay: Duration::from_millis(100),
        ..Default::default()
    };

    let cache_manager = Arc::new(
        CacheManager::new(Some(redis_config), cache_config)
            .await
            .expect("Failed to create cache manager")
    );

    println!("Cache Manager initialized");
    println!("Redis available: {}\n", cache_manager.is_redis_available().await);

    // Benchmark 1: Sequential writes
    println!("Benchmark 1: Sequential Writes");
    println!("-------------------------------");
    let num_writes = 1000;
    let write_start = Instant::now();
    
    for i in 0..num_writes {
        let key = format!("bench_key_{}", i);
        let value = format!("benchmark_value_{}_with_some_additional_data_to_make_it_larger", i);
        cache_manager.set(&key, &value, None).await?;
    }
    
    let write_duration = write_start.elapsed();
    let writes_per_sec = num_writes as f64 / write_duration.as_secs_f64();
    println!("Wrote {} entries in {:?}", num_writes, write_duration);
    println!("Rate: {:.0} writes/second\n", writes_per_sec);

    // Benchmark 2: Sequential reads
    println!("Benchmark 2: Sequential Reads");
    println!("------------------------------");
    let num_reads = 1000;
    let read_start = Instant::now();
    
    for i in 0..num_reads {
        let key = format!("bench_key_{}", i);
        let _: Option<String> = cache_manager.get(&key).await?;
    }
    
    let read_duration = read_start.elapsed();
    let reads_per_sec = num_reads as f64 / read_duration.as_secs_f64();
    println!("Read {} entries in {:?}", num_reads, read_duration);
    println!("Rate: {:.0} reads/second\n", reads_per_sec);

    // Benchmark 3: Concurrent operations
    println!("Benchmark 3: Concurrent Operations");
    println!("-----------------------------------");
    let concurrent_ops = 100;
    let ops_per_task = 10;
    let concurrent_start = Instant::now();
    
    let mut handles = vec![];
    
    for i in 0..concurrent_ops {
        let cache = cache_manager.clone();
        let handle = tokio::spawn(async move {
            for j in 0..ops_per_task {
                let key = format!("concurrent_{}_{}", i, j);
                let value = format!("concurrent_value_{}_{}", i, j);
                
                // Mix of operations
                cache.set(&key, &value, None).await.unwrap();
                let _: Option<String> = cache.get(&key).await.unwrap();
                cache.exists(&key).await.unwrap();
            }
        });
        handles.push(handle);
    }
    
    for handle in handles {
        handle.await?;
    }
    
    let concurrent_duration = concurrent_start.elapsed();
    let total_ops = concurrent_ops * ops_per_task * 3; // set, get, exists
    let ops_per_sec = total_ops as f64 / concurrent_duration.as_secs_f64();
    println!("Performed {} operations in {:?}", total_ops, concurrent_duration);
    println!("Rate: {:.0} operations/second\n", ops_per_sec);

    // Benchmark 4: Compression efficiency
    println!("Benchmark 4: Compression Efficiency");
    println!("------------------------------------");
    let large_value = "x".repeat(10000); // 10KB of data
    let compression_manager = redis_service::compression::CompressionManager::new(1024);
    
    let lz4_start = Instant::now();
    let compressed_lz4 = compression_manager.compress(
        large_value.as_bytes(),
        redis_service::compression::CompressionAlgorithm::LZ4
    )?;
    let lz4_duration = lz4_start.elapsed();
    
    let zstd_start = Instant::now();
    let compressed_zstd = compression_manager.compress(
        large_value.as_bytes(),
        redis_service::compression::CompressionAlgorithm::Zstd
    )?;
    let zstd_duration = zstd_start.elapsed();
    
    println!("Original size: {} bytes", large_value.len());
    println!("LZ4 compressed: {} bytes (ratio: {:.2}%, time: {:?})",
        compressed_lz4.len(),
        (compressed_lz4.len() as f64 / large_value.len() as f64) * 100.0,
        lz4_duration
    );
    println!("Zstd compressed: {} bytes (ratio: {:.2}%, time: {:?})",
        compressed_zstd.len(),
        (compressed_zstd.len() as f64 / large_value.len() as f64) * 100.0,
        zstd_duration
    );
    println!();

    // Benchmark 5: Session management
    println!("Benchmark 5: Session Management");
    println!("--------------------------------");
    let session_manager = Arc::new(
        SessionManager::new(cache_manager.clone(), Duration::from_secs(3600))
    );
    
    let session_start = Instant::now();
    let num_sessions = 100;
    
    for i in 0..num_sessions {
        let session_id = format!("session_{}", i);
        let user_id = format!("user_{}", i);
        
        session_manager.create_session(
            session_id.clone(),
            Some(user_id),
            None
        ).await?;
        
        // Simulate some session operations
        session_manager.update_session(
            &session_id,
            "last_activity".to_string(),
            serde_json::json!(Instant::now())
        ).await?;
        
        session_manager.get_session(&session_id).await?;
    }
    
    let session_duration = session_start.elapsed();
    let sessions_per_sec = (num_sessions * 3) as f64 / session_duration.as_secs_f64();
    println!("Created and operated on {} sessions in {:?}", num_sessions, session_duration);
    println!("Rate: {:.0} session operations/second\n", sessions_per_sec);

    // Get final statistics
    println!("Final Statistics");
    println!("----------------");
    let stats = cache_manager.get_statistics().await;
    println!("Total entries: {}", stats.total_entries);
    println!("Total size: {} bytes", stats.total_size_bytes);
    println!("Hit rate: {:.2}%", stats.hit_rate * 100.0);
    println!("Miss rate: {:.2}%", stats.miss_rate * 100.0);
    println!("Compression ratio: {:.2}", stats.compression_ratio);
    println!("Average entry size: {:.0} bytes", stats.average_entry_size);

    // Connection status
    let conn_status = cache_manager.get_connection_status().await;
    println!("\nConnection Status");
    println!("-----------------");
    println!("Connected: {}", conn_status.connected);
    println!("URL: {}", conn_status.url);
    println!("Active connections: {}", conn_status.active_connections);
    println!("Using fallback: {}", conn_status.using_fallback);

    println!("\nBenchmark completed successfully!");

    Ok(())
}
use crate::types::*;
use crate::RedisServiceError;
use moka::future::Cache;
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// In-memory fallback cache using Moka for high-performance caching with TTL support
pub struct InMemoryFallback {
    cache: Cache<String, Vec<u8>>,
    config: CacheConfig,
    statistics: Arc<RwLock<CacheStatistics>>,
    start_time: Instant,
}

impl InMemoryFallback {
    pub fn new(config: CacheConfig) -> Self {
        let cache = Cache::builder()
            .max_capacity(config.max_entries as u64)
            .time_to_live(config.default_ttl.unwrap_or(Duration::from_secs(3600)))
            .time_to_idle(Duration::from_secs(1800)) // 30 minutes idle time
            .build();

        info!("In-memory fallback cache initialized with capacity: {}", config.max_entries);

        Self {
            cache,
            config,
            statistics: Arc::new(RwLock::new(CacheStatistics::new())),
            start_time: Instant::now(),
        }
    }

    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, RedisServiceError> {
        let mut stats = self.statistics.write().await;
        
        match self.cache.get(key).await {
            Some(data) => {
                stats.record_hit();
                debug!("Cache hit for key: {}", key);
                
                let deserialized = bincode::deserialize(&data)
                    .map_err(|e| RedisServiceError::DeserializationError {
                        error: format!("Failed to deserialize cached value: {}", e),
                    })?;
                
                Ok(Some(deserialized))
            }
            None => {
                stats.record_miss();
                debug!("Cache miss for key: {}", key);
                Ok(None)
            }
        }
    }

    pub async fn get_raw(&self, key: &str) -> Option<Vec<u8>> {
        let mut stats = self.statistics.write().await;
        
        match self.cache.get(key).await {
            Some(data) => {
                stats.record_hit();
                Some(data)
            }
            None => {
                stats.record_miss();
                None
            }
        }
    }

    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Option<Duration>) -> Result<(), RedisServiceError> {
        let serialized = bincode::serialize(value)
            .map_err(|e| RedisServiceError::SerializationError {
                error: format!("Failed to serialize value for cache: {}", e),
            })?;

        self.set_raw(key, serialized, ttl).await;
        Ok(())
    }

    pub async fn set_raw(&self, key: &str, value: Vec<u8>, ttl: Option<Duration>) {
        let size = value.len();
        
        // Check if compression is needed
        let final_value = if self.config.enable_compression && size > self.config.compression_threshold {
            match self.compress_value(&value).await {
                Ok(compressed) => {
                    let mut stats = self.statistics.write().await;
                    stats.record_compression(size, compressed.len());
                    compressed
                }
                Err(e) => {
                    warn!("Failed to compress value: {}", e);
                    value
                }
            }
        } else {
            value
        };

        // Set with custom TTL if provided
        if let Some(ttl_duration) = ttl {
            self.cache.insert(key.to_string(), final_value).await;
            // Moka doesn't support per-entry TTL directly, so we'll use the cache's default
            // This is a limitation of the in-memory fallback
        } else {
            self.cache.insert(key.to_string(), final_value).await;
        }

        debug!("Cached value for key: {} (size: {} bytes)", key, size);
        
        // Update statistics
        let mut stats = self.statistics.write().await;
        let entry_count = self.cache.entry_count();
        let weighted_size = self.cache.weighted_size();
        stats.update_entry_stats(entry_count as usize, weighted_size as usize);
    }

    pub async fn delete(&self, key: &str) -> bool {
        self.cache.invalidate(key).await;
        debug!("Deleted key from cache: {}", key);
        true
    }

    pub async fn exists(&self, key: &str) -> bool {
        self.cache.contains_key(key)
    }

    pub async fn clear(&self) {
        self.cache.invalidate_all();
        info!("Cleared all entries from in-memory cache");
        
        let mut stats = self.statistics.write().await;
        stats.update_entry_stats(0, 0);
    }

    pub async fn keys(&self, pattern: &str) -> Vec<String> {
        // Note: Moka doesn't provide direct iteration over keys
        // This is a simplified implementation that doesn't support pattern matching
        warn!("Pattern matching not supported in fallback cache, returning empty list");
        vec![]
    }

    pub async fn get_statistics(&self) -> CacheStatistics {
        let mut stats = self.statistics.read().await.clone();
        stats.uptime = chrono::Duration::from_std(self.start_time.elapsed())
            .unwrap_or(chrono::Duration::seconds(0));
        stats
    }

    pub async fn run_maintenance(&self) {
        // Moka handles eviction automatically, but we can trigger it manually
        self.cache.run_pending_tasks().await;
        
        let entry_count = self.cache.entry_count();
        let weighted_size = self.cache.weighted_size();
        
        let mut stats = self.statistics.write().await;
        stats.update_entry_stats(entry_count as usize, weighted_size as usize);
        
        debug!("Maintenance completed. Entries: {}, Size: {} bytes", entry_count, weighted_size);
    }

    async fn compress_value(&self, value: &[u8]) -> Result<Vec<u8>, RedisServiceError> {
        // Use LZ4 for fast compression
        let compressed = lz4::block::compress(value, None, true)
            .map_err(|e| RedisServiceError::CompressionError {
                error: format!("LZ4 compression failed: {}", e),
            })?;
        
        Ok(compressed)
    }

    async fn decompress_value(&self, compressed: &[u8]) -> Result<Vec<u8>, RedisServiceError> {
        let decompressed = lz4::block::decompress(compressed, None)
            .map_err(|e| RedisServiceError::CompressionError {
                error: format!("LZ4 decompression failed: {}", e),
            })?;
        
        Ok(decompressed)
    }

    pub fn is_healthy(&self) -> bool {
        // In-memory cache is always healthy
        true
    }

    pub fn entry_count(&self) -> u64 {
        self.cache.entry_count()
    }

    pub fn weighted_size(&self) -> u64 {
        self.cache.weighted_size()
    }
}

/// Thread-safe wrapper for fallback cache
pub struct FallbackManager {
    fallback: Arc<InMemoryFallback>,
    maintenance_interval: Duration,
}

impl FallbackManager {
    pub fn new(config: CacheConfig) -> Self {
        let fallback = Arc::new(InMemoryFallback::new(config));
        let maintenance_interval = Duration::from_secs(60); // Run maintenance every minute
        
        let manager = Self {
            fallback: fallback.clone(),
            maintenance_interval,
        };
        
        // Start maintenance task
        manager.start_maintenance_task();
        
        manager
    }

    pub fn get_fallback(&self) -> Arc<InMemoryFallback> {
        self.fallback.clone()
    }

    fn start_maintenance_task(&self) {
        let fallback = self.fallback.clone();
        let interval = self.maintenance_interval;
        
        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);
            
            loop {
                interval_timer.tick().await;
                fallback.run_maintenance().await;
            }
        });
    }
}
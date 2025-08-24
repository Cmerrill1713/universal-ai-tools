//! Advanced Redis caching strategies for GraphRAG performance optimization
//! Implements intelligent caching for embeddings, entities, and search results

use anyhow::{Result, Context};
use deadpool_redis::{redis::{self, AsyncCommands}, Config, Pool, Runtime};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::{
    collections::HashMap,
    fmt::Debug,
    hash::{Hash, Hasher},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tracing::{info, warn, debug};

/// Redis cache configuration for production-grade performance
#[derive(Debug, Clone)]
pub struct RedisCacheConfig {
    pub redis_url: String,
    pub max_pool_size: usize,
    pub connection_timeout: Duration,
    pub response_timeout: Duration,
    pub default_ttl: Duration,
    pub compression_enabled: bool,
    pub batch_size: usize,
}

impl Default for RedisCacheConfig {
    fn default() -> Self {
        Self {
            redis_url: "redis://localhost:6379".to_string(),
            max_pool_size: 20,
            connection_timeout: Duration::from_secs(5),
            response_timeout: Duration::from_secs(3),
            default_ttl: Duration::from_secs(3600), // 1 hour
            compression_enabled: true,
            batch_size: 100,
        }
    }
}

impl RedisCacheConfig {
    pub fn production() -> Self {
        Self {
            redis_url: "redis://localhost:6379".to_string(),
            max_pool_size: 50,
            connection_timeout: Duration::from_secs(10),
            response_timeout: Duration::from_secs(5),
            default_ttl: Duration::from_secs(7200), // 2 hours
            compression_enabled: true,
            batch_size: 200,
        }
    }
}

/// Advanced Redis cache service with intelligent strategies
#[derive(Clone)]
pub struct RedisCacheService {
    pool: Pool,
    config: RedisCacheConfig,
    metrics: CacheMetrics,
}

/// Cache key types for organized namespacing
#[derive(Debug, Clone)]
pub enum CacheKeyType {
    Embedding { text_hash: String },
    Entity { entity_id: String },
    SearchResult { query_hash: String },
    Relationship { source_id: String, target_id: String },
    UserContext { user_id: String },
    Knowledge { knowledge_id: String },
}

impl CacheKeyType {
    pub fn to_key(&self) -> String {
        match self {
            CacheKeyType::Embedding { text_hash } => format!("emb:{}", text_hash),
            CacheKeyType::Entity { entity_id } => format!("ent:{}", entity_id),
            CacheKeyType::SearchResult { query_hash } => format!("search:{}", query_hash),
            CacheKeyType::Relationship { source_id, target_id } => {
                format!("rel:{}:{}", source_id, target_id)
            }
            CacheKeyType::UserContext { user_id } => format!("ctx:{}", user_id),
            CacheKeyType::Knowledge { knowledge_id } => format!("know:{}", knowledge_id),
        }
    }

    pub fn namespace(&self) -> &'static str {
        match self {
            CacheKeyType::Embedding { .. } => "embeddings",
            CacheKeyType::Entity { .. } => "entities", 
            CacheKeyType::SearchResult { .. } => "search_results",
            CacheKeyType::Relationship { .. } => "relationships",
            CacheKeyType::UserContext { .. } => "user_contexts",
            CacheKeyType::Knowledge { .. } => "knowledge",
        }
    }
}

/// Cache entry with metadata for intelligent eviction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry<T> {
    pub data: T,
    pub created_at: u64,
    pub access_count: u64,
    pub last_accessed: u64,
    pub ttl_seconds: u64,
    pub size_bytes: usize,
}

impl<T> CacheEntry<T>
where
    T: Serialize + DeserializeOwned,
{
    pub fn new(data: T, ttl: Duration) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
            
        let serialized_size = bincode::serialized_size(&data).unwrap_or(0) as usize;
        
        Self {
            data,
            created_at: now,
            access_count: 0,
            last_accessed: now,
            ttl_seconds: ttl.as_secs(),
            size_bytes: serialized_size,
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        now > self.created_at + self.ttl_seconds
    }

    pub fn access(&mut self) {
        self.access_count += 1;
        self.last_accessed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
    }
}

/// Cache operation metrics for monitoring
#[derive(Debug, Clone)]
pub struct CacheMetrics {
    pub hits: prometheus::Counter,
    pub misses: prometheus::Counter,
    pub errors: prometheus::Counter,
    pub latency: prometheus::Histogram,
    pub memory_usage: prometheus::Gauge,
    pub evictions: prometheus::Counter,
}

impl CacheMetrics {
    pub fn new() -> Result<Self> {
        Ok(Self {
            hits: prometheus::Counter::new("redis_cache_hits", "Number of cache hits")?,
            misses: prometheus::Counter::new("redis_cache_misses", "Number of cache misses")?,
            errors: prometheus::Counter::new("redis_cache_errors", "Number of cache errors")?,
            latency: prometheus::Histogram::with_opts(prometheus::HistogramOpts::new("redis_cache_latency", "Cache operation latency"))?,
            memory_usage: prometheus::Gauge::new("redis_cache_memory", "Cache memory usage in bytes")?,
            evictions: prometheus::Counter::new("redis_cache_evictions", "Number of cache evictions")?,
        })
    }
}

impl RedisCacheService {
    /// Create a new Redis cache service with optimized configuration
    pub async fn new(config: RedisCacheConfig) -> Result<Self> {
        info!("🔧 Initializing Redis cache service...");
        info!("  Redis URL: {}", config.redis_url);
        info!("  Max pool size: {}", config.max_pool_size);
        info!("  Connection timeout: {:?}", config.connection_timeout);
        info!("  Default TTL: {:?}", config.default_ttl);
        info!("  Compression: {}", config.compression_enabled);

        let redis_config = Config::from_url(&config.redis_url);
        let pool = redis_config
            .create_pool(Some(Runtime::Tokio1))
            .context("Failed to create Redis connection pool")?;

        // Test connection
        let mut conn = pool.get().await.context("Failed to get Redis connection")?;
        let _: String = redis::cmd("PING").query_async(&mut *conn).await.context("Redis ping failed")?;
        info!("✅ Redis connection established and tested");

        let metrics = CacheMetrics::new()?;

        Ok(Self {
            pool,
            config,
            metrics,
        })
    }

    /// Store data with intelligent caching strategy
    pub async fn set<T>(&self, key: CacheKeyType, value: T, ttl: Option<Duration>) -> Result<()>
    where
        T: Serialize + DeserializeOwned + Debug,
    {
        let start_time = std::time::Instant::now();
        let cache_key = key.to_key();
        let ttl = ttl.unwrap_or(self.config.default_ttl);

        debug!("🔄 Storing cache entry: {}", cache_key);

        let entry = CacheEntry::new(value, ttl);
        let serialized = if self.config.compression_enabled {
            self.compress_data(&entry)?
        } else {
            bincode::serialize(&entry)?
        };

        let mut conn = self.pool.get().await?;
        let _: () = conn.set_ex(&cache_key, serialized, ttl.as_secs()).await?;

        self.metrics.latency.observe(start_time.elapsed().as_secs_f64());
        self.update_memory_usage().await?;

        debug!("✅ Cache entry stored: {} ({} bytes)", cache_key, entry.size_bytes);
        Ok(())
    }

    /// Retrieve data with access tracking
    pub async fn get<T>(&self, key: CacheKeyType) -> Result<Option<T>>
    where
        T: Serialize + DeserializeOwned + Debug,
    {
        let start_time = std::time::Instant::now();
        let cache_key = key.to_key();

        debug!("🔍 Retrieving cache entry: {}", cache_key);

        let mut conn = self.pool.get().await?;
        let data: Option<Vec<u8>> = conn.get(&cache_key).await?;

        match data {
            Some(serialized) => {
                let mut entry: CacheEntry<T> = if self.config.compression_enabled {
                    self.decompress_data(&serialized)?
                } else {
                    bincode::deserialize(&serialized)?
                };

                if entry.is_expired() {
                    debug!("⏰ Cache entry expired: {}", cache_key);
                    self.delete(key).await?;
                    self.metrics.misses.inc();
                    return Ok(None);
                }

                entry.access();
                
                // Update entry with new access info
                let updated_serialized = if self.config.compression_enabled {
                    self.compress_data(&entry)?
                } else {
                    bincode::serialize(&entry)?
                };
                let _: () = conn.set(&cache_key, updated_serialized).await?;

                self.metrics.hits.inc();
                self.metrics.latency.observe(start_time.elapsed().as_secs_f64());
                
                debug!("✅ Cache hit: {} (accessed {} times)", cache_key, entry.access_count);
                Ok(Some(entry.data))
            }
            None => {
                self.metrics.misses.inc();
                self.metrics.latency.observe(start_time.elapsed().as_secs_f64());
                debug!("❌ Cache miss: {}", cache_key);
                Ok(None)
            }
        }
    }

    /// Delete cache entry
    pub async fn delete(&self, key: CacheKeyType) -> Result<bool> {
        let cache_key = key.to_key();
        debug!("🗑️ Deleting cache entry: {}", cache_key);

        let mut conn = self.pool.get().await?;
        let deleted: u64 = conn.del(&cache_key).await?;
        
        self.update_memory_usage().await?;
        Ok(deleted > 0)
    }

    /// Batch set operation for improved performance
    pub async fn batch_set<T>(&self, entries: Vec<(CacheKeyType, T, Option<Duration>)>) -> Result<usize>
    where
        T: Serialize + DeserializeOwned + Debug + Clone,
    {
        info!("📦 Batch storing {} cache entries", entries.len());
        let mut success_count = 0;
        
        for chunk in entries.chunks(self.config.batch_size) {
            let mut conn = self.pool.get().await?;
            let mut pipe = deadpool_redis::redis::pipe();
            
            for (key, value, ttl) in chunk {
                let cache_key = key.to_key();
                let ttl = ttl.unwrap_or(self.config.default_ttl);
                let entry = CacheEntry::new(value.clone(), ttl);
                
                match self.compress_data(&entry) {
                    Ok(serialized) => {
                        pipe.set_ex(&cache_key, serialized, ttl.as_secs());
                        success_count += 1;
                    }
                    Err(e) => {
                        warn!("Failed to serialize cache entry {}: {}", cache_key, e);
                        self.metrics.errors.inc();
                    }
                }
            }
            
            if let Err(e) = pipe.query_async::<()>(&mut conn).await {
                warn!("Batch cache operation failed: {}", e);
                self.metrics.errors.inc();
            }
        }
        
        self.update_memory_usage().await?;
        info!("✅ Batch stored {}/{} cache entries", success_count, entries.len());
        Ok(success_count)
    }

    /// Intelligent cache warming for frequently accessed data
    pub async fn warm_cache<T>(&self, warming_data: Vec<(CacheKeyType, T)>) -> Result<()>
    where
        T: Serialize + DeserializeOwned + Debug + Clone,
    {
        info!("🔥 Warming cache with {} entries", warming_data.len());
        
        let entries_with_ttl: Vec<_> = warming_data
            .into_iter()
            .map(|(key, data)| {
                // Use longer TTL for cache warming
                let extended_ttl = self.config.default_ttl * 2;
                (key, data, Some(extended_ttl))
            })
            .collect();
            
        self.batch_set(entries_with_ttl).await?;
        info!("✅ Cache warming completed");
        Ok(())
    }

    /// Evict least recently used entries by namespace
    pub async fn evict_lru(&self, namespace: &str, max_entries: usize) -> Result<usize> {
        info!("🧹 Evicting LRU entries from namespace: {}", namespace);
        
        let mut conn = self.pool.get().await?;
        let pattern = format!("{}:*", namespace);
        let keys: Vec<String> = conn.keys(&pattern).await?;
        
        if keys.len() <= max_entries {
            return Ok(0);
        }

        // Get access info for all keys
        let mut key_access_info = Vec::new();
        for key in &keys {
            if let Ok(Some(data)) = conn.get::<_, Option<Vec<u8>>>(key).await {
                if let Ok(entry) = bincode::deserialize::<CacheEntry<serde_json::Value>>(&data) {
                    key_access_info.push((key.clone(), entry.last_accessed, entry.access_count));
                }
            }
        }

        // Sort by last accessed time and access count (LRU with frequency consideration)
        key_access_info.sort_by(|a, b| {
            match a.1.cmp(&b.1) {
                std::cmp::Ordering::Equal => a.2.cmp(&b.2), // If same access time, prefer less frequently accessed
                other => other,
            }
        });

        // Evict oldest entries
        let to_evict = key_access_info.len() - max_entries;
        let keys_to_delete: Vec<String> = key_access_info
            .into_iter()
            .take(to_evict)
            .map(|(key, _, _)| key)
            .collect();

        if !keys_to_delete.is_empty() {
            let _: u64 = conn.del(&keys_to_delete).await?;
            self.metrics.evictions.inc_by(keys_to_delete.len() as f64);
            info!("🗑️ Evicted {} LRU entries from {}", keys_to_delete.len(), namespace);
        }

        self.update_memory_usage().await?;
        Ok(keys_to_delete.len())
    }

    /// Get cache statistics for monitoring
    pub async fn get_stats(&self) -> Result<CacheStats> {
        let mut conn = self.pool.get().await?;
        let info: String = redis::cmd("INFO").arg("memory").query_async(&mut *conn).await?;
        
        // Parse Redis memory info
        let mut used_memory = 0u64;
        let mut max_memory = 0u64;
        
        for line in info.lines() {
            if line.starts_with("used_memory:") {
                used_memory = line.split(':').nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            } else if line.starts_with("maxmemory:") {
                max_memory = line.split(':').nth(1)
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
            }
        }

        // Count keys by namespace
        let mut namespace_counts = HashMap::new();
        for namespace in ["embeddings", "entities", "search_results", "relationships", "user_contexts", "knowledge"] {
            let pattern = format!("{}:*", namespace);
            let keys: Vec<String> = conn.keys(&pattern).await.unwrap_or_default();
            namespace_counts.insert(namespace.to_string(), keys.len());
        }

        Ok(CacheStats {
            used_memory_bytes: used_memory,
            max_memory_bytes: max_memory,
            memory_usage_percent: if max_memory > 0 { (used_memory as f64 / max_memory as f64) * 100.0 } else { 0.0 },
            namespace_counts,
            total_hits: self.metrics.hits.get() as u64,
            total_misses: self.metrics.misses.get() as u64,
            hit_ratio: {
                let hits = self.metrics.hits.get();
                let misses = self.metrics.misses.get();
                if hits + misses > 0.0 { hits / (hits + misses) } else { 0.0 }
            },
            total_errors: self.metrics.errors.get() as u64,
        })
    }

    /// Compress data using efficient compression
    fn compress_data<T>(&self, data: &T) -> Result<Vec<u8>>
    where
        T: Serialize,
    {
        let serialized = bincode::serialize(data)?;
        Ok(serialized) // For now, just return serialized data. Can add compression later.
    }

    /// Decompress data
    fn decompress_data<T>(&self, compressed: &[u8]) -> Result<T>
    where
        T: DeserializeOwned,
    {
        Ok(bincode::deserialize(compressed)?)
    }

    /// Update memory usage metrics
    async fn update_memory_usage(&self) -> Result<()> {
        match self.get_stats().await {
            Ok(stats) => {
                self.metrics.memory_usage.set(stats.used_memory_bytes as f64);
            }
            Err(e) => {
                warn!("Failed to update memory metrics: {}", e);
            }
        }
        Ok(())
    }
}

/// Cache statistics for monitoring and optimization
#[derive(Debug, Serialize)]
pub struct CacheStats {
    pub used_memory_bytes: u64,
    pub max_memory_bytes: u64,
    pub memory_usage_percent: f64,
    pub namespace_counts: HashMap<String, usize>,
    pub total_hits: u64,
    pub total_misses: u64,
    pub hit_ratio: f64,
    pub total_errors: u64,
}

/// Generate a consistent hash for text content
pub fn hash_text(text: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    let mut hasher = DefaultHasher::new();
    text.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Background cache maintenance task
pub async fn start_cache_maintenance(
    cache: RedisCacheService,
    maintenance_interval: Duration,
    max_entries_per_namespace: usize,
) {
    let mut interval = tokio::time::interval(maintenance_interval);
    
    loop {
        interval.tick().await;
        
        info!("🔧 Starting cache maintenance cycle");
        
        // Evict LRU entries from each namespace if needed
        for namespace in ["embeddings", "entities", "search_results", "relationships", "user_contexts", "knowledge"] {
            if let Err(e) = cache.evict_lru(namespace, max_entries_per_namespace).await {
                warn!("Cache maintenance failed for namespace {}: {}", namespace, e);
            }
        }
        
        // Log cache statistics
        match cache.get_stats().await {
            Ok(stats) => {
                info!("📊 Cache stats - Memory: {:.1}% ({} MB), Hit ratio: {:.2}%, Errors: {}", 
                      stats.memory_usage_percent,
                      stats.used_memory_bytes / 1024 / 1024,
                      stats.hit_ratio * 100.0,
                      stats.total_errors);
            }
            Err(e) => {
                warn!("Failed to get cache stats: {}", e);
            }
        }
    }
}
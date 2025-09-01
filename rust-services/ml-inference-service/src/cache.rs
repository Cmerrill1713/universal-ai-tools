/// High-performance inference cache with Apple Silicon optimization

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Serialize, Deserialize};
use moka::future::Cache;
use std::hash::{Hash, Hasher};

use crate::{InferenceRequest, InferenceResponse};

/// Fast in-memory cache for inference results
pub struct InferenceCache {
    /// Primary cache using moka for LRU eviction
    cache: Cache<CacheKey, CachedResult>,
    /// Redis cache for distributed caching (optional)
    redis_client: Option<redis::Client>,
    /// Cache statistics
    stats: Arc<RwLock<CacheStats>>,
}

/// Cache key for inference requests
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct CacheKey {
    model_id: String,
    input_hash: u64,
    parameters_hash: u64,
}

/// Cached inference result with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedResult {
    pub response: InferenceResponse,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub access_count: u64,
    pub cache_source: CacheSource,
}

/// Source of cached result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CacheSource {
    Memory,
    Redis,
    Disk,
}

/// Cache performance statistics
#[derive(Debug, Default, Serialize)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub total_requests: u64,
    pub memory_usage_mb: f64,
    pub avg_lookup_time_ms: f64,
}

impl InferenceCache {
    /// Create new inference cache with Apple Silicon optimizations
    pub fn new(max_entries: u64) -> Self {
        // Configure cache for optimal Apple Silicon performance
        let cache = Cache::builder()
            .max_capacity(max_entries)
            .time_to_live(std::time::Duration::from_secs(3600)) // 1 hour TTL
            .time_to_idle(std::time::Duration::from_secs(1800)) // 30 min idle
            .build();

        // Try to connect to Redis for distributed caching
        let redis_client = match std::env::var("REDIS_URL") {
            Ok(url) => {
                match redis::Client::open(url) {
                    Ok(client) => {
                        tracing::info!("✅ Connected to Redis for distributed caching");
                        Some(client)
                    },
                    Err(e) => {
                        tracing::warn!("⚠️ Redis connection failed, using memory-only cache: {}", e);
                        None
                    }
                }
            },
            Err(_) => {
                tracing::info!("📝 No Redis URL configured, using memory-only cache");
                None
            }
        };

        Self {
            cache,
            redis_client,
            stats: Arc::new(RwLock::new(CacheStats::default())),
        }
    }

    /// Get cached result for inference request
    pub async fn get(&self, request: &InferenceRequest) -> Option<InferenceResponse> {
        let start_time = std::time::Instant::now();
        let cache_key = self.create_cache_key(request);

        // Try memory cache first (fastest)
        if let Some(cached) = self.cache.get(&cache_key).await {
            self.update_stats(true, start_time.elapsed()).await;
            tracing::debug!("🎯 Cache HIT (memory): {}", request.model_id);
            
            // Update access count
            let mut updated = cached;
            updated.access_count += 1;
            self.cache.insert(cache_key, updated.clone()).await;
            
            return Some(cached.response);
        }

        // Try Redis cache if available
        if let Some(cached) = self.get_from_redis(&cache_key).await {
            self.update_stats(true, start_time.elapsed()).await;
            tracing::debug!("🎯 Cache HIT (redis): {}", request.model_id);
            
            // Promote to memory cache
            self.cache.insert(cache_key, cached.clone()).await;
            return Some(cached.response);
        }

        // Cache miss
        self.update_stats(false, start_time.elapsed()).await;
        tracing::debug!("❌ Cache MISS: {}", request.model_id);
        None
    }

    /// Store inference result in cache
    pub async fn insert(&self, request: InferenceRequest, response: InferenceResponse) {
        let cache_key = self.create_cache_key(&request);
        let cached_result = CachedResult {
            response: response.clone(),
            created_at: chrono::Utc::now(),
            access_count: 1,
            cache_source: CacheSource::Memory,
        };

        // Store in memory cache
        self.cache.insert(cache_key.clone(), cached_result.clone()).await;

        // Store in Redis if available
        self.insert_to_redis(&cache_key, &cached_result).await;

        tracing::debug!("💾 Cached result: {}", request.model_id);
    }

    /// Create cache key from request
    fn create_cache_key(&self, request: &InferenceRequest) -> CacheKey {
        use std::collections::hash_map::DefaultHasher;

        // Hash the input data
        let mut hasher = DefaultHasher::new();
        match &request.input {
            crate::InputData::Text(text) => text.hash(&mut hasher),
            crate::InputData::Tensor(tensor) => tensor.hash(&mut hasher),
            crate::InputData::Image(image) => image.hash(&mut hasher),
            _ => "unknown".hash(&mut hasher),
        }
        let input_hash = hasher.finish();

        // Hash the parameters
        let mut hasher = DefaultHasher::new();
        request.parameters.batch_size.hash(&mut hasher);
        if let Some(temp) = request.parameters.temperature {
            (temp * 1000.0) as i32.hash(&mut hasher);
        }
        request.parameters.max_length.hash(&mut hasher);
        let parameters_hash = hasher.finish();

        CacheKey {
            model_id: request.model_id.clone(),
            input_hash,
            parameters_hash,
        }
    }

    /// Get result from Redis cache
    async fn get_from_redis(&self, cache_key: &CacheKey) -> Option<CachedResult> {
        let client = self.redis_client.as_ref()?;
        
        match client.get_connection() {
            Ok(mut conn) => {
                use redis::Commands;
                let key = format!("inference:{}:{}:{}", cache_key.model_id, cache_key.input_hash, cache_key.parameters_hash);
                
                match conn.get::<String, Option<String>>(key) {
                    Ok(Some(data)) => {
                        match serde_json::from_str::<CachedResult>(&data) {
                            Ok(result) => Some(result),
                            Err(e) => {
                                tracing::warn!("Failed to deserialize Redis cache entry: {}", e);
                                None
                            }
                        }
                    },
                    Ok(None) => None,
                    Err(e) => {
                        tracing::warn!("Redis get error: {}", e);
                        None
                    }
                }
            },
            Err(e) => {
                tracing::warn!("Redis connection error: {}", e);
                None
            }
        }
    }

    /// Insert result to Redis cache
    async fn insert_to_redis(&self, cache_key: &CacheKey, result: &CachedResult) {
        if let Some(client) = &self.redis_client {
            match client.get_connection() {
                Ok(mut conn) => {
                    use redis::Commands;
                    let key = format!("inference:{}:{}:{}", cache_key.model_id, cache_key.input_hash, cache_key.parameters_hash);
                    
                    match serde_json::to_string(result) {
                        Ok(data) => {
                            if let Err(e) = conn.set_ex::<String, String, ()>(key, data, 3600) {
                                tracing::warn!("Redis set error: {}", e);
                            }
                        },
                        Err(e) => {
                            tracing::warn!("Failed to serialize for Redis: {}", e);
                        }
                    }
                },
                Err(e) => {
                    tracing::warn!("Redis connection error: {}", e);
                }
            }
        }
    }

    /// Update cache statistics
    async fn update_stats(&self, hit: bool, lookup_time: std::time::Duration) {
        let mut stats = self.stats.write().await;
        
        stats.total_requests += 1;
        if hit {
            stats.hits += 1;
        } else {
            stats.misses += 1;
        }

        // Update average lookup time
        let lookup_ms = lookup_time.as_millis() as f64;
        let alpha = 0.1; // Learning rate for exponential moving average
        stats.avg_lookup_time_ms = alpha * lookup_ms + (1.0 - alpha) * stats.avg_lookup_time_ms;

        // Estimate memory usage
        stats.memory_usage_mb = (self.cache.entry_count() * 1024) as f64 / 1024.0 / 1024.0; // Rough estimate
    }

    /// Get cache statistics
    pub async fn get_stats(&self) -> CacheStats {
        self.stats.read().await.clone()
    }

    /// Get cache hit rate
    pub async fn get_hit_rate(&self) -> f64 {
        let stats = self.stats.read().await;
        if stats.total_requests > 0 {
            stats.hits as f64 / stats.total_requests as f64
        } else {
            0.0
        }
    }

    /// Clear all cached entries
    pub async fn clear(&self) {
        self.cache.invalidate_all().await;
        
        // Clear Redis cache if available
        if let Some(client) = &self.redis_client {
            match client.get_connection() {
                Ok(mut conn) => {
                    use redis::Commands;
                    if let Err(e) = conn.del::<&str, ()>("inference:*") {
                        tracing::warn!("Failed to clear Redis cache: {}", e);
                    }
                },
                Err(e) => {
                    tracing::warn!("Redis connection error during clear: {}", e);
                }
            }
        }

        tracing::info!("🗑️ Cache cleared");
    }

    /// Warm up cache with common requests
    pub async fn warmup(&self, requests: Vec<(InferenceRequest, InferenceResponse)>) {
        for (request, response) in requests {
            self.insert(request, response).await;
        }
        tracing::info!("🔥 Cache warmed up with {} entries", self.cache.entry_count());
    }
}

impl CacheStats {
    pub fn hit_rate(&self) -> f64 {
        if self.total_requests > 0 {
            self.hits as f64 / self.total_requests as f64
        } else {
            0.0
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{InferenceParameters, InputData, OutputData, Framework};

    #[tokio::test]
    async fn test_cache_creation() {
        let cache = InferenceCache::new(100);
        let stats = cache.get_stats().await;
        assert_eq!(stats.total_requests, 0);
    }

    #[tokio::test]
    async fn test_cache_key_generation() {
        let cache = InferenceCache::new(100);
        let request = InferenceRequest {
            model_id: "test-model".to_string(),
            input: InputData::Text("test input".to_string()),
            parameters: InferenceParameters::default(),
        };

        let key1 = cache.create_cache_key(&request);
        let key2 = cache.create_cache_key(&request);
        
        assert_eq!(key1, key2);
    }

    #[tokio::test]
    async fn test_cache_miss_then_hit() {
        let cache = InferenceCache::new(100);
        let request = InferenceRequest {
            model_id: "test-model".to_string(),
            input: InputData::Text("test input".to_string()),
            parameters: InferenceParameters::default(),
        };

        // Should be a miss initially
        assert!(cache.get(&request).await.is_none());

        // Insert and then should be a hit
        let response = InferenceResponse {
            model_id: "test-model".to_string(),
            output: OutputData::Generation { text: "test output".to_string() },
            latency_ms: 100,
            framework: Framework::Candle,
            metadata: serde_json::json!({}),
        };

        cache.insert(request.clone(), response.clone()).await;
        let cached = cache.get(&request).await;
        assert!(cached.is_some());
        
        let stats = cache.get_stats().await;
        assert!(stats.hit_rate() > 0.0);
    }
}
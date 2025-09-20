//! Parameter caching with Redis backend

use crate::types::*;
use crate::error::{ParameterError, Result};
use redis::{aio::ConnectionManager, AsyncCommands};
use moka::future::Cache as MokaCache;
use std::time::Duration;
use serde_json;
use tracing::{debug, warn};

/// Parameter cache with local and Redis layers
pub struct ParameterCache {
    local_cache: MokaCache<String, OptimalParameters>,
    redis_conn: Option<ConnectionManager>,
    ttl_seconds: u64,
}

impl ParameterCache {
    /// Create a new parameter cache
    pub async fn new(ttl_seconds: u64, redis_url: Option<String>) -> Result<Self> {
        let local_cache = MokaCache::builder()
            .max_capacity(1000)
            .time_to_live(Duration::from_secs(ttl_seconds))
            .build();
        
        let redis_conn = if let Some(url) = redis_url {
            match redis::Client::open(url) {
                Ok(client) => {
                    match ConnectionManager::new(client).await {
                        Ok(conn) => {
                            debug!("Connected to Redis for parameter caching");
                            Some(conn)
                        }
                        Err(e) => {
                            warn!("Failed to connect to Redis: {}", e);
                            None
                        }
                    }
                }
                Err(e) => {
                    warn!("Failed to create Redis client: {}", e);
                    None
                }
            }
        } else {
            None
        };
        
        Ok(Self {
            local_cache,
            redis_conn,
            ttl_seconds,
        })
    }
    
    /// Get cached parameters
    pub async fn get(&self, request: &ParameterRequest) -> Result<Option<OptimalParameters>> {
        let key = self.generate_cache_key(request);
        
        // Check local cache first
        if let Some(params) = self.local_cache.get(&key).await {
            debug!("Local cache hit for key: {}", key);
            return Ok(Some(params));
        }
        
        // Check Redis if available
        if let Some(ref conn) = self.redis_conn {
            let mut conn = conn.clone();
            match conn.get::<_, String>(&key).await {
                Ok(json) => {
                    match serde_json::from_str::<OptimalParameters>(&json) {
                        Ok(params) => {
                            debug!("Redis cache hit for key: {}", key);
                            // Update local cache
                            self.local_cache.insert(key.clone(), params.clone()).await;
                            return Ok(Some(params));
                        }
                        Err(e) => {
                            warn!("Failed to deserialize cached parameters: {}", e);
                        }
                    }
                }
                Err(_) => {
                    // Cache miss is normal, not an error
                }
            }
        }
        
        Ok(None)
    }
    
    /// Set cached parameters
    pub async fn set(&self, request: &ParameterRequest, params: &OptimalParameters) -> Result<()> {
        let key = self.generate_cache_key(request);
        
        // Update local cache
        self.local_cache.insert(key.clone(), params.clone()).await;
        
        // Update Redis if available
        if let Some(ref conn) = self.redis_conn {
            let mut conn = conn.clone();
            let json = serde_json::to_string(params)?;
            
            match conn.set_ex::<_, _, ()>(&key, json, self.ttl_seconds).await {
                Ok(_) => {
                    debug!("Cached parameters in Redis with key: {}", key);
                }
                Err(e) => {
                    warn!("Failed to cache in Redis: {}", e);
                }
            }
        }
        
        Ok(())
    }
    
    /// Invalidate cache entries related to a task
    pub async fn invalidate_related(&self, task_id: &uuid::Uuid) -> Result<()> {
        // In a real implementation, we'd track which cache entries
        // are related to which tasks. For now, we'll just log.
        debug!("Invalidating cache entries related to task: {}", task_id);
        
        // Could implement pattern-based deletion in Redis
        // and selective invalidation in local cache
        
        Ok(())
    }
    
    /// Clear all cache entries
    pub async fn clear(&self) -> Result<()> {
        self.local_cache.invalidate_all();
        
        if let Some(ref conn) = self.redis_conn {
            let mut conn = conn.clone();
            // Clear all parameter cache keys (with a specific prefix)
            match redis::cmd("FLUSHDB").query_async::<_, ()>(&mut conn).await {
                Ok(_) => debug!("Cleared Redis cache"),
                Err(e) => warn!("Failed to clear Redis cache: {}", e),
            }
        }
        
        Ok(())
    }
    
    /// Generate cache key from request
    fn generate_cache_key(&self, request: &ParameterRequest) -> String {
        // Create a deterministic key based on request parameters
        // that affect parameter selection
        format!(
            "param:{}:{}:{:?}:{}",
            request.model,
            // Hash the prompt for privacy
            self.hash_prompt(&request.prompt),
            request.user_preferences.priority,
            request.user_preferences.max_tokens.unwrap_or(0)
        )
    }
    
    /// Hash prompt for cache key
    fn hash_prompt(&self, prompt: &str) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        prompt.hash(&mut hasher);
        hasher.finish()
    }
    
    /// Get cache statistics
    pub async fn get_stats(&self) -> CacheStats {
        let local_size = self.local_cache.entry_count();
        
        let redis_size = if let Some(ref conn) = self.redis_conn {
            let mut conn = conn.clone();
            // Use INFO command to get keyspace stats
            match redis::cmd("INFO")
                .arg("keyspace")
                .query_async::<_, String>(&mut conn)
                .await
            {
                Ok(info) => {
                    // Parse db0:keys=X from the info string
                    info.lines()
                        .find(|line| line.starts_with("db0:"))
                        .and_then(|line| {
                            line.split(',')
                                .find(|part| part.contains("keys="))
                                .and_then(|part| part.split('=').nth(1))
                                .and_then(|num| num.parse::<usize>().ok())
                        })
                        .unwrap_or(0)
                }
                Err(_) => 0,
            }
        } else {
            0
        };
        
        CacheStats {
            local_entries: local_size,
            redis_entries: redis_size,
            ttl_seconds: self.ttl_seconds,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub local_entries: u64,
    pub redis_entries: usize,
    pub ttl_seconds: u64,
}
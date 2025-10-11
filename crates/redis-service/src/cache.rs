use crate::client::RedisClient;
use crate::fallback::{FallbackManager, InMemoryFallback};
use crate::types::*;
use crate::RedisServiceError;
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// High-level cache manager that coordinates between Redis and in-memory fallback
pub struct CacheManager {
    redis_client: Option<Arc<RedisClient>>,
    fallback: Arc<InMemoryFallback>,
    config: CacheConfig,
    redis_available: Arc<RwLock<bool>>,
    statistics: Arc<RwLock<CacheStatistics>>,
}

impl CacheManager {
    pub async fn new(redis_config: Option<RedisConfig>, cache_config: CacheConfig) -> Result<Self, RedisServiceError> {
        // Initialize fallback cache
        let fallback_manager = FallbackManager::new(cache_config.clone());
        let fallback = fallback_manager.get_fallback();

        // Try to initialize Redis client
        let (redis_client, redis_available) = if let Some(config) = redis_config {
            match RedisClient::new(config).await {
                Ok(client) => {
                    info!("Redis client initialized successfully");
                    (Some(Arc::new(client)), true)
                }
                Err(e) => {
                    warn!("Failed to initialize Redis client, using fallback only: {}", e);
                    (None, false)
                }
            }
        } else {
            info!("No Redis configuration provided, using in-memory cache only");
            (None, false)
        };

        Ok(Self {
            redis_client,
            fallback,
            config: cache_config,
            redis_available: Arc::new(RwLock::new(redis_available)),
            statistics: Arc::new(RwLock::new(CacheStatistics::new())),
        })
    }

    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, RedisServiceError> {
        let use_redis = *self.redis_available.read().await;

        if use_redis {
            if let Some(client) = &self.redis_client {
                // Try Redis first
                match client.get::<T>(key).await {
                    Ok(Some(value)) => {
                        debug!("Retrieved from Redis: {}", key);
                        let mut stats = self.statistics.write().await;
                        stats.record_hit();
                        return Ok(Some(value));
                    }
                    Ok(None) => {
                        // Not in Redis, check fallback
                        debug!("Not found in Redis, checking fallback: {}", key);
                    }
                    Err(e) => {
                        warn!("Redis get failed, falling back to memory: {}", e);
                        *self.redis_available.write().await = false;
                    }
                }
            }
        }

        // Use fallback
        self.fallback.get(key).await
    }

    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Option<Duration>) -> Result<(), RedisServiceError> {
        let use_redis = *self.redis_available.read().await;

        // Always set in fallback for redundancy
        self.fallback.set(key, value, ttl).await?;

        if use_redis {
            if let Some(client) = &self.redis_client {
                // Try to set in Redis
                match client.set(key, value, ttl).await {
                    Ok(_) => {
                        debug!("Stored in Redis and fallback: {}", key);
                    }
                    Err(e) => {
                        warn!("Redis set failed, stored in fallback only: {}", e);
                        *self.redis_available.write().await = false;
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn delete(&self, key: &str) -> Result<bool, RedisServiceError> {
        let use_redis = *self.redis_available.read().await;
        let mut deleted = false;

        // Delete from fallback
        if self.fallback.delete(key).await {
            deleted = true;
        }

        if use_redis {
            if let Some(client) = &self.redis_client {
                // Try to delete from Redis
                match client.delete(key).await {
                    Ok(redis_deleted) => {
                        deleted = deleted || redis_deleted;
                        debug!("Deleted from Redis: {}", key);
                    }
                    Err(e) => {
                        warn!("Redis delete failed: {}", e);
                        *self.redis_available.write().await = false;
                    }
                }
            }
        }

        Ok(deleted)
    }

    pub async fn exists(&self, key: &str) -> Result<bool, RedisServiceError> {
        let use_redis = *self.redis_available.read().await;

        // Check fallback first (faster)
        if self.fallback.exists(key).await {
            return Ok(true);
        }

        if use_redis {
            if let Some(client) = &self.redis_client {
                // Check Redis
                match client.exists(key).await {
                    Ok(exists) => return Ok(exists),
                    Err(e) => {
                        warn!("Redis exists check failed: {}", e);
                        *self.redis_available.write().await = false;
                    }
                }
            }
        }

        Ok(false)
    }

    pub async fn flush_all(&self) -> Result<(), RedisServiceError> {
        let use_redis = *self.redis_available.read().await;

        // Clear fallback
        self.fallback.clear().await;

        if use_redis {
            if let Some(client) = &self.redis_client {
                // Clear Redis
                match client.flush_all().await {
                    Ok(_) => {
                        info!("Flushed all data from Redis and fallback");
                    }
                    Err(e) => {
                        warn!("Redis flush_all failed: {}", e);
                        *self.redis_available.write().await = false;
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn get_statistics(&self) -> CacheStatistics {
        let mut combined_stats = self.fallback.get_statistics().await;

        // Add Redis statistics if available
        if let Some(client) = &self.redis_client {
            let metrics = client.get_operation_metrics().await;
            // Merge Redis metrics into combined stats
            for metric in metrics {
                combined_stats.hit_count += metric.success_count;
                combined_stats.miss_count += metric.failure_count;
            }
        }

        combined_stats
    }

    pub async fn is_redis_available(&self) -> bool {
        if let Some(client) = &self.redis_client {
            match client.ping().await {
                Ok(true) => {
                    *self.redis_available.write().await = true;
                    true
                }
                _ => {
                    *self.redis_available.write().await = false;
                    false
                }
            }
        } else {
            false
        }
    }

    pub async fn get_connection_status(&self) -> ConnectionStatus {
        if let Some(client) = &self.redis_client {
            client.get_status().await
        } else {
            let mut status = ConnectionStatus::new("none".to_string());
            status.using_fallback = true;
            status
        }
    }

    pub async fn reconnect_redis(&self) -> Result<(), RedisServiceError> {
        if let Some(client) = &self.redis_client {
            client.connect().await?;
            *self.redis_available.write().await = true;
            info!("Redis reconnected successfully");
            Ok(())
        } else {
            Err(RedisServiceError::ConnectionError {
                error: "No Redis client configured".to_string(),
            })
        }
    }

    pub fn get_config(&self) -> &CacheConfig {
        &self.config
    }

    /// Synchronize data from fallback to Redis (useful after reconnection)
    pub async fn sync_to_redis(&self) -> Result<u32, RedisServiceError> {
        if !*self.redis_available.read().await {
            return Err(RedisServiceError::ConnectionError {
                error: "Redis not available".to_string(),
            });
        }

        let _client = self.redis_client.as_ref()
            .ok_or_else(|| RedisServiceError::ConnectionError {
                error: "No Redis client configured".to_string(),
            })?;

        // Note: Since Moka doesn't provide iteration over entries,
        // this is a placeholder for the sync logic
        // In a real implementation, you'd need to track keys separately

        warn!("Sync to Redis not fully implemented due to Moka limitations");
        Ok(0)
    }
}

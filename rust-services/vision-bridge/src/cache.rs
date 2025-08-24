use moka::future::Cache;
use std::time::Duration;
use serde_json;
use crate::types::*;

/// High-performance async cache for vision results using JSON serialization
#[derive(Clone)]
pub struct VisionCache {
    cache: Cache<String, String>, // Store serialized JSON
}

impl VisionCache {
    pub async fn new(max_size: u64, ttl_seconds: u64) -> Self {
        let ttl = Duration::from_secs(ttl_seconds);
        
        Self {
            cache: Cache::builder()
                .max_capacity(max_size)
                .time_to_live(ttl)
                .time_to_idle(ttl / 2)
                .build(),
        }
    }

    /// Get a cached value and deserialize it
    pub async fn get<T>(&self, key: &str) -> Option<VisionResponse<T>>
    where
        T: serde::de::DeserializeOwned,
    {
        if let Some(json_str) = self.cache.get(key).await {
            if let Ok(value) = serde_json::from_str::<VisionResponse<T>>(&json_str) {
                return Some(value);
            }
        }
        None
    }

    /// Insert a value by serializing it to JSON
    pub async fn insert<T>(&self, key: String, mut value: VisionResponse<T>)
    where
        T: serde::Serialize,
    {
        // Mark as cached
        value.cached = true;
        
        if let Ok(json_str) = serde_json::to_string(&value) {
            self.cache.insert(key, json_str).await;
        }
    }

    /// Get the total number of cached items
    pub async fn size(&self) -> usize {
        self.cache.entry_count() as usize
    }

    /// Clear all cached items
    pub async fn clear(&self) {
        self.cache.invalidate_all();
    }

    /// Remove a specific key from cache
    pub async fn remove(&self, key: &str) {
        self.cache.invalidate(key).await;
    }

    /// Get cache statistics
    pub async fn stats(&self) -> CacheStats {
        CacheStats {
            size: self.size().await,
            max_capacity: 1000, // Default from config
            hit_count: 0, // Moka doesn't expose this directly
            miss_count: 0,
        }
    }
}

/// Cache statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheStats {
    pub size: usize,
    pub max_capacity: u64,
    pub hit_count: u64,
    pub miss_count: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cache_operations() {
        let cache = VisionCache::new(100, 3600).await;
        
        // Test inserting and retrieving
        let test_response = VisionResponse {
            success: true,
            data: Some("test_data".to_string()),
            error: None,
            processing_time_ms: 100,
            model: "test_model".to_string(),
            cached: false,
        };
        
        cache.insert("test_key".to_string(), test_response.clone()).await;
        
        let retrieved: Option<VisionResponse<String>> = cache.get("test_key").await;
        assert!(retrieved.is_some());
        
        let retrieved_value = retrieved.unwrap();
        assert_eq!(retrieved_value.model, "test_model");
        assert!(retrieved_value.cached); // Should be marked as cached
    }

    #[tokio::test]
    async fn test_cache_miss() {
        let cache = VisionCache::new(100, 3600).await;
        
        let result: Option<VisionResponse<String>> = cache.get("nonexistent_key").await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_cache_clear() {
        let cache = VisionCache::new(100, 3600).await;
        
        let test_response = VisionResponse {
            success: true,
            data: Some("test_data".to_string()),
            error: None,
            processing_time_ms: 100,
            model: "test_model".to_string(),
            cached: false,
        };
        
        cache.insert("test_key".to_string(), test_response).await;
        assert_eq!(cache.size().await, 1);
        
        cache.clear().await;
        assert_eq!(cache.size().await, 0);
    }
}
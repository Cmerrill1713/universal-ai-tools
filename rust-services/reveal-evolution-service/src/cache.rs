//! Caching module for ReVeal Evolution Service

use crate::{error::*, types::*};
use redis::AsyncCommands;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Evolution cache for storing results
pub struct EvolutionCache {
    redis_client: Option<Arc<RwLock<redis::aio::Connection>>>,
    local_cache: Arc<RwLock<std::collections::HashMap<String, EvolutionResult>>>,
    enabled: bool,
}

impl EvolutionCache {
    pub async fn new(redis_url: Option<&str>) -> EvolutionResult<Self> {
        let redis_client = if let Some(url) = redis_url {
            match redis::Client::open(url) {
                Ok(client) => {
                    match client.get_async_connection().await {
                        Ok(conn) => Some(Arc::new(RwLock::new(conn))),
                        Err(_) => None,
                    }
                }
                Err(_) => None,
            }
        } else {
            None
        };
        
        Ok(Self {
            redis_client,
            local_cache: Arc::new(RwLock::new(std::collections::HashMap::new())),
            enabled: redis_client.is_some(),
        })
    }
    
    pub async fn get(&self, key: &str) -> Option<EvolutionResult> {
        if !self.enabled {
            return None;
        }
        
        // Check local cache first
        {
            let cache = self.local_cache.read().await;
            if let Some(result) = cache.get(key) {
                return Some(result.clone());
            }
        }
        
        // Check Redis cache
        if let Some(redis_client) = &self.redis_client {
            let mut conn = redis_client.write().await;
            if let Ok(data): Result<String, _> = conn.get(key).await {
                    if let Ok(result) = serde_json::from_str::<EvolutionResult>(&data) {
                        // Store in local cache
                        {
                            let mut cache = self.local_cache.write().await;
                            cache.insert(key.to_string(), result.clone());
                        }
                        return Some(result);
                    }
                }
        }
        
        None
    }
    
    pub async fn set(&self, key: &str, result: &EvolutionResult) -> EvolutionResult<()> {
        if !self.enabled {
            return Ok(());
        }
        
        // Store in local cache
        {
            let mut cache = self.local_cache.write().await;
            cache.insert(key.to_string(), result.clone());
        }
        
        // Store in Redis cache
        if let Some(redis_client) = &self.redis_client {
            let mut conn = redis_client.write().await;
            if let Ok(data) = serde_json::to_string(result) {
                let _: Result<(), _> = conn.set_ex(key, data, 3600).await; // 1 hour TTL
            }
        }
        
        Ok(())
    }
    
    pub fn generate_cache_key(&self, problem: &str, context: &EvolutionContext) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        problem.hash(&mut hasher);
        context.task_type.hash(&mut hasher);
        context.domain.hash(&mut hasher);
        
        format!("reveal_evolution:{}", hasher.finish())
    }
}

impl Default for EvolutionCache {
    fn default() -> Self {
        Self {
            redis_client: None,
            local_cache: Arc::new(RwLock::new(std::collections::HashMap::new())),
            enabled: false,
        }
    }
}
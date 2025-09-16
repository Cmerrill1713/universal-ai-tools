//! Response caching for LLM Router

use moka::future::Cache;
use serde::{Deserialize, Serialize};
use std::hash::{Hash, Hasher};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheKey {
    pub model: String,
    pub messages_hash: u64,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

impl Hash for CacheKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.model.hash(state);
        self.messages_hash.hash(state);
        if let Some(temp) = self.temperature {
            ((temp * 100.0) as i32).hash(state);
        }
        self.max_tokens.hash(state);
    }
}

impl PartialEq for CacheKey {
    fn eq(&self, other: &Self) -> bool {
        self.model == other.model
            && self.messages_hash == other.messages_hash
            && self.temperature == other.temperature
            && self.max_tokens == other.max_tokens
    }
}

impl Eq for CacheKey {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedResponse {
    pub content: String,
    pub timestamp: std::time::SystemTime,
    pub ttl: Duration,
}

pub struct ModelCache {
    cache: Cache<CacheKey, CachedResponse>,
}

impl ModelCache {
    pub fn new(max_capacity: u64, ttl: Duration) -> Self {
        let cache = Cache::builder()
            .max_capacity(max_capacity)
            .time_to_live(ttl)
            .build();

        Self { cache }
    }

    pub async fn get(&self, key: &CacheKey) -> Option<CachedResponse> {
        self.cache.get(key).await
    }

    pub async fn put(&self, key: CacheKey, response: CachedResponse) {
        self.cache.insert(key, response).await;
    }

    pub async fn invalidate(&self, key: &CacheKey) {
        self.cache.invalidate(key).await;
    }

    pub async fn clear(&self) {
        self.cache.invalidate_all();
        self.cache.run_pending_tasks().await;
    }

    pub fn size(&self) -> u64 {
        self.cache.entry_count()
    }
}

impl Default for ModelCache {
    fn default() -> Self {
        Self::new(1000, Duration::from_secs(3600)) // 1 hour TTL
    }
}

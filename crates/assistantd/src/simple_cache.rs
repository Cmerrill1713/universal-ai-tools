use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::{Duration, Instant};
use anyhow::Result;

#[derive(Debug, Clone)]
pub struct CacheEntry {
    pub response: String,
    pub model: String,
    pub created_at: Instant,
    pub access_count: u32,
}

pub struct SimpleCache {
    cache: Arc<RwLock<HashMap<String, CacheEntry>>>,
    max_size: usize,
    ttl: Duration,
}

impl SimpleCache {
    pub fn new(max_size: usize, ttl: Duration) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            max_size,
            ttl,
        }
    }

    pub async fn get(&self, query: &str) -> Option<(String, String)> {
        let query_hash = self.hash_query(query);
        let mut cache = self.cache.write().await;

        if let Some(entry) = cache.get(&query_hash) {
            if entry.created_at.elapsed() < self.ttl {
                // Clone the entry data before updating
                let response = entry.response.clone();
                let model = entry.model.clone();

                // Update access count
                let mut updated_entry = entry.clone();
                updated_entry.access_count += 1;
                cache.insert(query_hash, updated_entry);

                return Some((response, model));
            } else {
                // Expired entry
                cache.remove(&query_hash);
            }
        }

        None
    }

    pub async fn set(&self, query: &str, response: &str, model: &str) -> Result<()> {
        let query_hash = self.hash_query(query);
        let mut cache = self.cache.write().await;

        // Check cache size limit
        if cache.len() >= self.max_size {
            self.evict_least_used(&mut cache).await;
        }

        let entry = CacheEntry {
            response: response.to_string(),
            model: model.to_string(),
            created_at: Instant::now(),
            access_count: 0,
        };

        cache.insert(query_hash, entry);
        Ok(())
    }

    async fn evict_least_used(&self, cache: &mut HashMap<String, CacheEntry>) {
        if let Some(key) = cache.iter()
            .min_by(|(_, a), (_, b)| a.access_count.cmp(&b.access_count))
            .map(|(k, _)| k.clone()) {
            cache.remove(&key);
        }
    }

    fn hash_query(&self, query: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        query.to_lowercase().hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    pub async fn get_stats(&self) -> CacheStats {
        let cache = self.cache.read().await;
        CacheStats {
            size: cache.len(),
            total_hits: cache.values().map(|e| e.access_count).sum(),
        }
    }
}

#[derive(Debug, serde::Serialize)]
pub struct CacheStats {
    pub size: usize,
    pub total_hits: u32,
}

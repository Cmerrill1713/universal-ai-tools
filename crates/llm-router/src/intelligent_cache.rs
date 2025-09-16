// Intelligent Caching System with Supabase pgvector integration
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedResponse {
    pub id: String,
    pub prompt_hash: String,
    pub prompt_embedding: Vec<f32>,
    pub response: String,
    pub model: String,
    pub response_time: f32,
    pub quality_score: f32,
    pub created_at: u64,
    pub access_count: u32,
    pub last_accessed: u64,
    pub expires_at: u64,
}

#[derive(Debug, Clone)]
pub struct CacheHit {
    pub cached_response: CachedResponse,
    pub similarity_score: f32,
    pub is_exact_match: bool,
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub total_entries: u32,
    pub cache_hits: u32,
    pub cache_misses: u32,
    pub hit_rate: f32,
    pub avg_response_time: f32,
    pub memory_usage_mb: f32,
}

#[derive(Debug)]
pub struct IntelligentCache {
    // In-memory cache for fast access
    memory_cache: Arc<RwLock<HashMap<String, CachedResponse>>>,

    // Configuration
    similarity_threshold: f32,
    #[allow(dead_code)]
    exact_match_threshold: f32,
    cache_ttl_hours: u64,
    max_cache_size: usize,

    // Statistics
    stats: Arc<RwLock<CacheStats>>,

    // Embedding model (simplified for demo)
    embedding_dimension: usize,
}

impl IntelligentCache {
    pub fn new() -> Self {
        Self {
            memory_cache: Arc::new(RwLock::new(HashMap::new())),
            similarity_threshold: 0.85,
            exact_match_threshold: 0.95,
            cache_ttl_hours: 24,
            max_cache_size: 10000,
            stats: Arc::new(RwLock::new(CacheStats {
                total_entries: 0,
                cache_hits: 0,
                cache_misses: 0,
                hit_rate: 0.0,
                avg_response_time: 0.0,
                memory_usage_mb: 0.0,
            })),
            embedding_dimension: 384, // All-MiniLM-L6-v2 dimension
        }
    }

    pub async fn get_cached_response(&self, prompt: &str, model: &str) -> Option<CacheHit> {
        let prompt_hash = self.generate_prompt_hash(prompt);
        let prompt_embedding = self.embed_prompt(prompt).await;

        // First, try exact match
        if let Some(exact_match) = self.get_exact_match(&prompt_hash, model).await {
            self.update_stats(true).await;
            return Some(CacheHit {
                cached_response: exact_match,
                similarity_score: 1.0,
                is_exact_match: true,
            });
        }

        // Then, try semantic similarity
        if let Some(semantic_match) = self.get_semantic_match(&prompt_embedding, model).await {
            self.update_stats(true).await;
            return Some(semantic_match);
        }

        self.update_stats(false).await;
        None
    }

    pub async fn cache_response(
        &self,
        prompt: &str,
        response: &str,
        model: &str,
        response_time: f32,
        quality_score: f32,
    ) -> Result<String> {
        let prompt_hash = self.generate_prompt_hash(prompt);
        let prompt_embedding = self.embed_prompt(prompt).await;
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();

        let cached_response = CachedResponse {
            id: uuid::Uuid::new_v4().to_string(),
            prompt_hash: prompt_hash.clone(),
            prompt_embedding,
            response: response.to_string(),
            model: model.to_string(),
            response_time,
            quality_score,
            created_at: now,
            access_count: 0,
            last_accessed: now,
            expires_at: now + (self.cache_ttl_hours * 3600),
        };

        // Store in memory cache
        {
            let mut cache = self.memory_cache.write().await;

            // Check cache size limit
            if cache.len() >= self.max_cache_size {
                self.cleanup_old_entries(&mut cache).await;
            }

            cache.insert(prompt_hash, cached_response.clone());
        }

        // Update statistics
        {
            let mut stats = self.stats.write().await;
            stats.total_entries = self.memory_cache.read().await.len() as u32;
        }

        // In a real implementation, also store in Supabase
        // self.store_in_supabase(&cached_response).await?;

        Ok(cached_response.id)
    }

    async fn get_exact_match(&self, prompt_hash: &str, model: &str) -> Option<CachedResponse> {
        let cache = self.memory_cache.read().await;

        if let Some(cached) = cache.get(prompt_hash) {
            // Check if it's for the same model and not expired
            if cached.model == model && cached.expires_at > SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() {
                return Some(cached.clone());
            }
        }

        None
    }

    async fn get_semantic_match(&self, prompt_embedding: &[f32], model: &str) -> Option<CacheHit> {
        let cache = self.memory_cache.read().await;
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

        let mut best_match: Option<(CachedResponse, f32)> = None;

        for (_, cached) in cache.iter() {
            // Check if it's for the same model and not expired
            if cached.model != model || cached.expires_at <= now {
                continue;
            }

            // Calculate cosine similarity
            let similarity = self.calculate_cosine_similarity(prompt_embedding, &cached.prompt_embedding);

            if similarity >= self.similarity_threshold {
                if let Some((_, best_similarity)) = &best_match {
                    if similarity > *best_similarity {
                        best_match = Some((cached.clone(), similarity));
                    }
                } else {
                    best_match = Some((cached.clone(), similarity));
                }
            }
        }

        if let Some((cached_response, similarity_score)) = best_match {
            Some(CacheHit {
                cached_response,
                similarity_score,
                is_exact_match: false,
            })
        } else {
            None
        }
    }

    fn generate_prompt_hash(&self, prompt: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        prompt.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    async fn embed_prompt(&self, prompt: &str) -> Vec<f32> {
        // Simplified embedding - in a real implementation, use a proper embedding model
        // For now, create a simple hash-based embedding
        let mut embedding = vec![0.0; self.embedding_dimension];

        for (i, word) in prompt.split_whitespace().enumerate() {
            if i < self.embedding_dimension {
                let hash = word.len() as f32;
                embedding[i] = (hash / 10.0).sin(); // Simple hash-based embedding
            }
        }

        embedding
    }

    fn calculate_cosine_similarity(&self, a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm_a == 0.0 || norm_b == 0.0 {
            0.0
        } else {
            dot_product / (norm_a * norm_b)
        }
    }

    async fn cleanup_old_entries(&self, cache: &mut HashMap<String, CachedResponse>) {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();

        // Remove expired entries
        cache.retain(|_, cached| cached.expires_at > now);

        // If still over limit, remove oldest entries
        if cache.len() > self.max_cache_size {
            // Clone keys with their last_accessed to avoid mutable borrow conflict
            let mut entries: Vec<(String, u64)> = cache
                .iter()
                .map(|(k, v)| (k.clone(), v.last_accessed))
                .collect();
            entries.sort_by_key(|(_, last)| *last);

            let to_remove = cache.len() - self.max_cache_size;
            for (key, _) in entries.iter().take(to_remove) {
                cache.remove(key);
            }
        }
    }

    async fn update_stats(&self, is_hit: bool) {
        let mut stats = self.stats.write().await;

        if is_hit {
            stats.cache_hits += 1;
        } else {
            stats.cache_misses += 1;
        }

        let total_requests = stats.cache_hits + stats.cache_misses;
        stats.hit_rate = if total_requests > 0 {
            stats.cache_hits as f32 / total_requests as f32
        } else {
            0.0
        };
    }

    pub async fn get_stats(&self) -> CacheStats {
        let stats = self.stats.read().await;
        stats.clone()
    }

    pub async fn cleanup_expired(&self) {
        let mut cache = self.memory_cache.write().await;
        self.cleanup_old_entries(&mut cache).await;
    }

    pub async fn clear_cache(&self) {
        let mut cache = self.memory_cache.write().await;
        cache.clear();

        let mut stats = self.stats.write().await;
        stats.total_entries = 0;
        stats.cache_hits = 0;
        stats.cache_misses = 0;
        stats.hit_rate = 0.0;
    }
}

// Supabase integration (placeholder for future implementation)
pub struct SupabaseCache {
    #[allow(dead_code)]
    supabase_url: String,
    #[allow(dead_code)]
    supabase_key: String,
}

impl SupabaseCache {
    pub fn new(url: String, key: String) -> Self {
        Self {
            supabase_url: url,
            supabase_key: key,
        }
    }

    pub async fn store_response(&self, response: &CachedResponse) -> Result<()> {
        // In a real implementation, this would store the response in Supabase
        // using pgvector for similarity search
        tracing::info!("Storing response in Supabase: {}", response.id);
        Ok(())
    }

    pub async fn search_similar(&self, _embedding: &[f32], _model: &str, _threshold: f32) -> Result<Vec<CachedResponse>> {
        // In a real implementation, this would search Supabase using pgvector
        tracing::info!("Searching similar responses in Supabase");
        Ok(vec![])
    }
}

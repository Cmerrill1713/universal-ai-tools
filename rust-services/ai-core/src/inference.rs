//! Inference Engine - Core AI processing logic

use std::collections::HashMap;
use std::sync::Arc;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{info, warn, error, instrument};
use uuid::Uuid;
use redis::aio::ConnectionManager;

use crate::{
    memory::MemoryManager,
    models::ModelManager,
    providers::ProviderRouter,
};

/// Inference request structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub max_tokens: u32,
    pub temperature: f32,
    pub stream: bool,
    pub provider_preference: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Message structure for chat completions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// Inference response structure
#[derive(Debug, Clone, Serialize)]
pub struct InferenceResponse {
    pub id: String,
    pub model: String,
    pub content: String,
    pub finish_reason: String,
    pub usage: TokenUsage,
    pub provider: String,
    pub cached: bool,
    pub processing_time_ms: u64,
}

/// Token usage tracking
#[derive(Debug, Clone, Serialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Streaming inference chunk
#[derive(Debug, Clone, Serialize)]
pub struct InferenceChunk {
    pub id: String,
    pub delta: String,
    pub finish_reason: Option<String>,
    pub usage: Option<TokenUsage>,
}

/// Cache entry for inference results
#[derive(Debug, Clone)]
struct CacheEntry {
    response: InferenceResponse,
    created_at: SystemTime,
    ttl_seconds: u64,
}

/// Main inference engine
pub struct InferenceEngine {
    model_manager: Arc<ModelManager>,
    provider_router: Arc<ProviderRouter>,
    memory_manager: Arc<MemoryManager>,
    cache: Arc<RwLock<HashMap<String, CacheEntry>>>,  // Local cache for hot data
    redis_cache: Option<ConnectionManager>,           // Redis cache for distributed caching
    cache_ttl_seconds: u64,
}

impl InferenceEngine {
    /// Create new inference engine
    pub async fn new(
        model_manager: Arc<ModelManager>,
        provider_router: Arc<ProviderRouter>,
        memory_manager: Arc<MemoryManager>,
    ) -> Self {
        // Try to connect to Redis for distributed caching
        let redis_cache = Self::init_redis_cache().await;
        
        Self {
            model_manager,
            provider_router,
            memory_manager,
            cache: Arc::new(RwLock::new(HashMap::new())),
            redis_cache,
            cache_ttl_seconds: 3600, // 1 hour default
        }
    }

    /// Initialize Redis cache connection
    async fn init_redis_cache() -> Option<ConnectionManager> {
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6380".to_string());
        
        match redis::Client::open(redis_url.as_str()) {
            Ok(client) => {
                match ConnectionManager::new(client).await {
                    Ok(conn) => {
                        info!("Connected to Redis cache at {}", redis_url);
                        Some(conn)
                    }
                    Err(e) => {
                        warn!("Failed to create Redis connection manager: {}. Using local cache only.", e);
                        None
                    }
                }
            }
            Err(e) => {
                warn!("Failed to connect to Redis at {}: {}. Using local cache only.", redis_url, e);
                None
            }
        }
    }

    /// Process a completion request
    #[instrument(skip(self, request), fields(model = %request.model, messages = request.messages.len()))]
    pub async fn complete(&self, request: InferenceRequest) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = SystemTime::now();
        let request_id = Uuid::new_v4().to_string();

        info!(
            request_id = %request_id,
            model = %request.model,
            message_count = request.messages.len(),
            "Starting inference request"
        );

        // Check cache first
        let cache_key = self.generate_cache_key(&request);
        if let Some(cached_response) = self.get_from_cache(&cache_key).await {
            info!(request_id = %request_id, "Returning cached response");
            return Ok(cached_response);
        }

        // Check memory pressure before processing
        if self.memory_manager.is_memory_pressure_high().await {
            warn!(request_id = %request_id, "High memory pressure, optimizing before inference");
            if let Err(e) = self.memory_manager.optimize().await {
                error!(request_id = %request_id, error = %e, "Memory optimization failed");
            }
        }

        // Get optimal provider for the model
        let provider = match self.provider_router.route_request(&request.model, request.provider_preference.as_deref()).await {
            Ok(provider) => provider,
            Err(e) => {
                error!(request_id = %request_id, error = %e, "Provider routing failed");
                return Err(e);
            }
        };

        info!(request_id = %request_id, provider = %provider, "Routed to provider");

        // Execute inference
        let inference_result = self.execute_inference(&request, &provider, &request_id).await?;

        // Cache successful results
        if !inference_result.content.is_empty() {
            self.cache_response(&cache_key, &inference_result).await;
        }

        let total_time = start_time.elapsed().unwrap().as_millis() as u64;
        info!(
            request_id = %request_id,
            provider = %provider,
            tokens = inference_result.usage.total_tokens,
            processing_time_ms = total_time,
            "Inference completed successfully"
        );

        Ok(inference_result)
    }

    /// Process a streaming completion request
    #[instrument(skip(self, request))]
    pub async fn stream_complete(
        &self,
        request: InferenceRequest,
    ) -> Result<tokio_stream::wrappers::ReceiverStream<InferenceChunk>, Box<dyn std::error::Error + Send + Sync>> {
        let request_id = Uuid::new_v4().to_string();
        
        info!(
            request_id = %request_id,
            model = %request.model,
            "Starting streaming inference"
        );

        // Get provider for streaming
        let provider = self.provider_router.route_request(&request.model, request.provider_preference.as_deref()).await?;

        // Create channel for streaming chunks
        let (tx, rx) = tokio::sync::mpsc::channel(100);

        // Spawn streaming task
        let provider_router = self.provider_router.clone();
        let request_clone = request.clone();
        tokio::spawn(async move {
            if let Err(e) = provider_router.stream_inference(request_clone, provider, tx).await {
                error!(request_id = %request_id, error = %e, "Streaming inference failed");
            }
        });

        Ok(tokio_stream::wrappers::ReceiverStream::new(rx))
    }

    /// Execute inference with the selected provider
    async fn execute_inference(
        &self,
        request: &InferenceRequest,
        provider: &str,
        request_id: &str,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        // Validate model availability
        if !self.model_manager.is_model_available(&request.model).await {
            return Err(format!("Model {} not available", request.model).into());
        }

        // Execute inference via provider router
        match self.provider_router.execute_inference(request.clone(), provider).await {
            Ok(mut response) => {
                response.id = request_id.to_string();
                Ok(response)
            }
            Err(e) => {
                error!(
                    request_id = %request_id,
                    provider = %provider,
                    error = %e,
                    "Inference execution failed"
                );
                Err(e)
            }
        }
    }

    /// Generate cache key for request
    fn generate_cache_key(&self, request: &InferenceRequest) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        request.model.hash(&mut hasher);
        request.messages.iter().for_each(|msg| {
            msg.role.hash(&mut hasher);
            msg.content.hash(&mut hasher);
        });
        request.max_tokens.hash(&mut hasher);
        ((request.temperature * 1000.0) as u32).hash(&mut hasher);

        format!("inference_{:x}", hasher.finish())
    }

    /// Get response from cache
    async fn get_from_cache(&self, cache_key: &str) -> Option<InferenceResponse> {
        let cache = self.cache.read().await;
        
        if let Some(entry) = cache.get(cache_key) {
            let now = SystemTime::now();
            let age = now.duration_since(entry.created_at).unwrap_or_default().as_secs();
            
            if age < entry.ttl_seconds {
                let mut response = entry.response.clone();
                response.cached = true;
                return Some(response);
            }
        }
        
        None
    }

    /// Cache inference response
    async fn cache_response(&self, cache_key: &str, response: &InferenceResponse) {
        let entry = CacheEntry {
            response: response.clone(),
            created_at: SystemTime::now(),
            ttl_seconds: self.cache_ttl_seconds,
        };

        let mut cache = self.cache.write().await;
        cache.insert(cache_key.to_string(), entry);

        // Clean expired entries periodically
        self.clean_expired_cache(&mut cache).await;
    }

    /// Clean expired cache entries
    async fn clean_expired_cache(&self, cache: &mut HashMap<String, CacheEntry>) {
        let now = SystemTime::now();
        cache.retain(|_, entry| {
            let age = now.duration_since(entry.created_at).unwrap_or_default().as_secs();
            age < entry.ttl_seconds
        });
    }

    /// Get cache statistics
    pub async fn get_cache_stats(&self) -> (usize, usize) {
        let cache = self.cache.read().await;
        let total_entries = cache.len();
        
        let now = SystemTime::now();
        let expired_entries = cache.values().filter(|entry| {
            let age = now.duration_since(entry.created_at).unwrap_or_default().as_secs();
            age >= entry.ttl_seconds
        }).count();

        (total_entries, expired_entries)
    }

    /// Clear cache
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
        info!("Inference cache cleared");
    }
}
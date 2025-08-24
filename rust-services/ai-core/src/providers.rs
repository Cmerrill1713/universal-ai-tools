//! Provider Router - Multi-provider AI service routing and load balancing

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use tokio::sync::{mpsc, RwLock};
use tracing::{info, warn, instrument};

use crate::{
    config::{Config, ProviderConfig},
    inference::{InferenceRequest, InferenceResponse, InferenceChunk, TokenUsage},
};

/// Provider health status
#[derive(Debug, Clone, PartialEq)]
pub enum ProviderHealth {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Provider statistics
#[derive(Debug, Clone)]
pub struct ProviderStats {
    pub provider: String,
    pub total_requests: u64,
    pub successful_requests: u64,
    pub average_latency_ms: f64,
    pub health: ProviderHealth,
    pub last_health_check: SystemTime,
    pub error_rate_1h: f64,
    pub rate_limit_remaining: Option<u64>,
}

/// Provider router for intelligent request routing
pub struct ProviderRouter {
    config: Arc<Config>,
    http_client: Client,
    provider_stats: Arc<RwLock<HashMap<String, ProviderStats>>>,
    providers: HashMap<String, ProviderConfig>,
}

impl ProviderRouter {
    /// Create new provider router
    pub async fn new(config: Arc<Config>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // Enhanced HTTP client with connection pooling and performance optimizations
        let http_client = Client::builder()
            .timeout(Duration::from_secs(60))
            .pool_max_idle_per_host(20)       // Connection pooling: max 20 idle connections per host
            .pool_idle_timeout(Duration::from_secs(30))  // Keep connections alive for 30s
            .connect_timeout(Duration::from_secs(10))     // 10s connect timeout
            .tcp_keepalive(Duration::from_secs(30))       // TCP keepalive for long-lived connections
            .tcp_nodelay(true)                            // Disable Nagle's algorithm for lower latency
            .gzip(true)                                   // Enable gzip compression
            .brotli(true)                                 // Enable brotli compression
            .deflate(true)                                // Enable deflate compression
            .user_agent("ai-core/1.0.0 (rust)")          // Proper user agent identification
            .build()?;

        let mut providers = HashMap::new();
        
        // Add configured providers
        if let Some(ref openai) = config.providers.openai {
            if openai.enabled {
                providers.insert("openai".to_string(), openai.clone());
            }
        }
        
        if let Some(ref anthropic) = config.providers.anthropic {
            if anthropic.enabled {
                providers.insert("anthropic".to_string(), anthropic.clone());
            }
        }
        
        if let Some(ref ollama) = config.providers.ollama {
            if ollama.enabled {
                providers.insert("ollama".to_string(), ollama.clone());
            }
        }

        if let Some(ref local) = config.providers.local {
            if local.enabled {
                providers.insert("local".to_string(), local.clone());
            }
        }

        let router = Self {
            config,
            http_client,
            provider_stats: Arc::new(RwLock::new(HashMap::new())),
            providers,
        };

        // Initialize provider stats
        router.initialize_provider_stats().await;

        // Start health monitoring
        router.start_health_monitoring();

        Ok(router)
    }

    /// Route request to optimal provider
    #[instrument(skip(self), fields(model = %model, preference = ?provider_preference))]
    pub async fn route_request(
        &self,
        model: &str,
        provider_preference: Option<&str>,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        // If specific provider requested, validate and use it
        if let Some(preferred) = provider_preference {
            if self.is_provider_available(preferred).await {
                info!(provider = %preferred, "Using preferred provider");
                return Ok(preferred.to_string());
            } else {
                warn!(provider = %preferred, "Preferred provider not available, falling back to optimal routing");
            }
        }

        // Determine provider based on model
        let possible_providers = self.get_providers_for_model(model);
        if possible_providers.is_empty() {
            return Err(format!("No providers available for model: {}", model).into());
        }

        // Select best provider based on health and performance
        let optimal_provider = self.select_optimal_provider(&possible_providers).await?;
        
        info!(
            model = %model,
            provider = %optimal_provider,
            "Routed to optimal provider"
        );

        Ok(optimal_provider)
    }

    /// Execute inference request with provider
    #[instrument(skip(self, request), fields(provider = %provider))]
    pub async fn execute_inference(
        &self,
        request: InferenceRequest,
        provider: &str,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        let start_time = SystemTime::now();
        
        let result = match provider {
            "openai" => self.execute_openai_request(&request).await,
            "anthropic" => self.execute_anthropic_request(&request).await,
            "ollama" => self.execute_ollama_request(&request).await,
            "local" => self.execute_local_request(&request).await,
            _ => Err(format!("Unknown provider: {}", provider).into()),
        };

        let latency = start_time.elapsed().unwrap().as_millis() as u64;
        let success = result.is_ok();

        // Update provider stats
        self.update_provider_stats(provider, latency, success).await;

        result
    }

    /// Execute streaming inference
    pub async fn stream_inference(
        &self,
        request: InferenceRequest,
        provider: String,
        tx: mpsc::Sender<InferenceChunk>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        match provider.as_str() {
            "openai" => self.stream_openai_request(&request, tx).await,
            "anthropic" => self.stream_anthropic_request(&request, tx).await,
            "ollama" => self.stream_ollama_request(&request, tx).await,
            _ => Err(format!("Streaming not supported for provider: {}", provider).into()),
        }
    }

    /// Execute OpenAI API request
    async fn execute_openai_request(
        &self,
        request: &InferenceRequest,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        let provider_config = self.providers.get("openai")
            .ok_or("OpenAI provider not configured")?;

        let api_key = provider_config.api_key.as_ref()
            .ok_or("OpenAI API key not configured")?;

        let default_url = "https://api.openai.com/v1".to_string();
        let base_url = provider_config.base_url.as_ref()
            .unwrap_or(&default_url);

        let payload = json!({
            "model": request.model,
            "messages": request.messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "stream": false
        });

        let response = self.http_client
            .post(format!("{}/chat/completions", base_url))
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("OpenAI API error: {}", error_text).into());
        }

        let response_data: Value = response.json().await?;
        self.parse_openai_response(response_data, "openai".to_string())
    }

    /// Execute Anthropic API request
    async fn execute_anthropic_request(
        &self,
        request: &InferenceRequest,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        let provider_config = self.providers.get("anthropic")
            .ok_or("Anthropic provider not configured")?;

        let api_key = provider_config.api_key.as_ref()
            .ok_or("Anthropic API key not configured")?;

        let default_url = "https://api.anthropic.com".to_string();
        let base_url = provider_config.base_url.as_ref()
            .unwrap_or(&default_url);

        // Convert messages to Anthropic format
        let system_message = request.messages.iter()
            .find(|m| m.role == "system")
            .map(|m| m.content.clone());

        let user_messages: Vec<_> = request.messages.iter()
            .filter(|m| m.role != "system")
            .collect();

        let mut payload = json!({
            "model": request.model,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "messages": user_messages
        });

        if let Some(system) = system_message {
            payload["system"] = json!(system);
        }

        let response = self.http_client
            .post(format!("{}/v1/messages", base_url))
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Anthropic API error: {}", error_text).into());
        }

        let response_data: Value = response.json().await?;
        self.parse_anthropic_response(response_data, "anthropic".to_string())
    }

    /// Execute Ollama request
    async fn execute_ollama_request(
        &self,
        request: &InferenceRequest,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        let provider_config = self.providers.get("ollama")
            .ok_or("Ollama provider not configured")?;

        let default_url = "http://localhost:11434".to_string();
        let base_url = provider_config.base_url.as_ref()
            .unwrap_or(&default_url);

        let payload = json!({
            "model": request.model,
            "messages": request.messages,
            "stream": false,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens
            }
        });

        let response = self.http_client
            .post(format!("{}/api/chat", base_url))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Ollama API error: {}", error_text).into());
        }

        let response_data: Value = response.json().await?;
        self.parse_ollama_response(response_data, "ollama".to_string())
    }

    /// Execute local model request (placeholder)
    async fn execute_local_request(
        &self,
        _request: &InferenceRequest,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        // Placeholder for local model execution
        // In a real implementation, this would use local inference libraries
        Err("Local inference not yet implemented".into())
    }

    /// Stream OpenAI request
    async fn stream_openai_request(
        &self,
        request: &InferenceRequest,
        tx: mpsc::Sender<InferenceChunk>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Placeholder for streaming implementation
        // Would use Server-Sent Events (SSE) parsing
        let _ = (request, tx);
        Err("Streaming not yet implemented".into())
    }

    /// Stream Anthropic request
    async fn stream_anthropic_request(
        &self,
        request: &InferenceRequest,
        tx: mpsc::Sender<InferenceChunk>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let _ = (request, tx);
        Err("Anthropic streaming not yet implemented".into())
    }

    /// Stream Ollama request
    async fn stream_ollama_request(
        &self,
        request: &InferenceRequest,
        tx: mpsc::Sender<InferenceChunk>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let _ = (request, tx);
        Err("Ollama streaming not yet implemented".into())
    }

    /// Parse OpenAI response
    fn parse_openai_response(
        &self,
        response: Value,
        provider: String,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        let id = response["id"].as_str().unwrap_or("unknown").to_string();
        let model = response["model"].as_str().unwrap_or("unknown").to_string();
        
        let choice = &response["choices"][0];
        let content = choice["message"]["content"].as_str().unwrap_or("").to_string();
        let finish_reason = choice["finish_reason"].as_str().unwrap_or("stop").to_string();

        let usage = &response["usage"];
        let token_usage = TokenUsage {
            prompt_tokens: usage["prompt_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: usage["completion_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: usage["total_tokens"].as_u64().unwrap_or(0) as u32,
        };

        Ok(InferenceResponse {
            id,
            model,
            content,
            finish_reason,
            usage: token_usage,
            provider,
            cached: false,
            processing_time_ms: 0, // Will be set by caller
        })
    }

    /// Parse Anthropic response
    fn parse_anthropic_response(
        &self,
        response: Value,
        provider: String,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        let id = response["id"].as_str().unwrap_or("unknown").to_string();
        let model = response["model"].as_str().unwrap_or("unknown").to_string();
        
        let content = response["content"][0]["text"].as_str().unwrap_or("").to_string();
        let finish_reason = response["stop_reason"].as_str().unwrap_or("end_turn").to_string();

        let usage = &response["usage"];
        let token_usage = TokenUsage {
            prompt_tokens: usage["input_tokens"].as_u64().unwrap_or(0) as u32,
            completion_tokens: usage["output_tokens"].as_u64().unwrap_or(0) as u32,
            total_tokens: (usage["input_tokens"].as_u64().unwrap_or(0) + 
                         usage["output_tokens"].as_u64().unwrap_or(0)) as u32,
        };

        Ok(InferenceResponse {
            id,
            model,
            content,
            finish_reason,
            usage: token_usage,
            provider,
            cached: false,
            processing_time_ms: 0,
        })
    }

    /// Parse Ollama response
    fn parse_ollama_response(
        &self,
        response: Value,
        provider: String,
    ) -> Result<InferenceResponse, Box<dyn std::error::Error + Send + Sync>> {
        let model = response["model"].as_str().unwrap_or("unknown").to_string();
        let content = response["message"]["content"].as_str().unwrap_or("").to_string();

        // Ollama doesn't provide detailed token usage, so we estimate
        let prompt_tokens = 50; // Rough estimate
        let completion_tokens = content.split_whitespace().count() as u32;
        
        let token_usage = TokenUsage {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens + completion_tokens,
        };

        Ok(InferenceResponse {
            id: uuid::Uuid::new_v4().to_string(),
            model,
            content,
            finish_reason: "stop".to_string(),
            usage: token_usage,
            provider,
            cached: false,
            processing_time_ms: 0,
        })
    }

    /// Get providers that support a model
    fn get_providers_for_model(&self, model: &str) -> Vec<String> {
        let mut providers = Vec::new();
        
        // OpenAI models
        if model.starts_with("gpt-") {
            providers.push("openai".to_string());
        }
        
        // Anthropic models
        if model.starts_with("claude-") {
            providers.push("anthropic".to_string());
        }
        
        // Ollama models (local)
        if model.contains(':') || model.starts_with("llama") || model.starts_with("mistral") {
            providers.push("ollama".to_string());
        }

        // Filter by available providers
        providers.into_iter()
            .filter(|p| self.providers.contains_key(p))
            .collect()
    }

    /// Select optimal provider based on health and performance
    async fn select_optimal_provider(
        &self,
        providers: &[String],
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        if providers.is_empty() {
            return Err("No providers available".into());
        }

        let stats = self.provider_stats.read().await;
        
        // Score providers based on health, latency, and priority
        let mut best_provider = providers[0].clone();
        let mut best_score = 0.0;

        for provider in providers {
            let mut score = 0.0;
            
            // Base priority from config
            if let Some(config) = self.providers.get(provider) {
                score += config.priority as f64;
            }

            // Health bonus
            if let Some(stat) = stats.get(provider) {
                match stat.health {
                    ProviderHealth::Healthy => score += 100.0,
                    ProviderHealth::Degraded => score += 50.0,
                    ProviderHealth::Unhealthy => score -= 100.0,
                    ProviderHealth::Unknown => score += 25.0,
                }

                // Latency penalty (prefer lower latency)
                if stat.average_latency_ms > 0.0 {
                    score -= stat.average_latency_ms / 100.0;
                }

                // Error rate penalty
                score -= stat.error_rate_1h * 200.0;
            }

            if score > best_score {
                best_score = score;
                best_provider = provider.clone();
            }
        }

        Ok(best_provider)
    }

    /// Check if provider is available
    async fn is_provider_available(&self, provider: &str) -> bool {
        if !self.providers.contains_key(provider) {
            return false;
        }

        let stats = self.provider_stats.read().await;
        if let Some(stat) = stats.get(provider) {
            stat.health != ProviderHealth::Unhealthy
        } else {
            true // Assume available if no stats yet
        }
    }

    /// Update provider statistics
    async fn update_provider_stats(&self, provider: &str, latency_ms: u64, success: bool) {
        let mut stats = self.provider_stats.write().await;
        let stat = stats.entry(provider.to_string()).or_insert_with(|| ProviderStats {
            provider: provider.to_string(),
            total_requests: 0,
            successful_requests: 0,
            average_latency_ms: 0.0,
            health: ProviderHealth::Unknown,
            last_health_check: SystemTime::now(),
            error_rate_1h: 0.0,
            rate_limit_remaining: None,
        });

        stat.total_requests += 1;
        if success {
            stat.successful_requests += 1;
        }

        // Update rolling average latency
        let total_latency = stat.average_latency_ms * (stat.total_requests - 1) as f64 + latency_ms as f64;
        stat.average_latency_ms = total_latency / stat.total_requests as f64;

        // Update health based on recent performance
        let success_rate = stat.successful_requests as f64 / stat.total_requests as f64;
        stat.health = if success_rate > 0.95 {
            ProviderHealth::Healthy
        } else if success_rate > 0.80 {
            ProviderHealth::Degraded
        } else {
            ProviderHealth::Unhealthy
        };
    }

    /// Initialize provider statistics
    async fn initialize_provider_stats(&self) {
        let mut stats = self.provider_stats.write().await;
        
        for provider_name in self.providers.keys() {
            stats.insert(provider_name.clone(), ProviderStats {
                provider: provider_name.clone(),
                total_requests: 0,
                successful_requests: 0,
                average_latency_ms: 0.0,
                health: ProviderHealth::Unknown,
                last_health_check: SystemTime::now(),
                error_rate_1h: 0.0,
                rate_limit_remaining: None,
            });
        }
    }

    /// Start health monitoring background task
    fn start_health_monitoring(&self) {
        let provider_stats = self.provider_stats.clone();
        let providers = self.providers.clone();
        let http_client = self.http_client.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                
                for (provider_name, provider_config) in &providers {
                    let health = Self::check_provider_health(&http_client, provider_config).await;
                    
                    let mut stats = provider_stats.write().await;
                    if let Some(stat) = stats.get_mut(provider_name) {
                        stat.health = health;
                        stat.last_health_check = SystemTime::now();
                    }
                }
            }
        });
    }

    /// Check individual provider health
    async fn check_provider_health(
        client: &Client,
        config: &ProviderConfig,
    ) -> ProviderHealth {
        if let Some(ref base_url) = config.base_url {
            // Simple health check - try to reach the provider
            let health_url = format!("{}/health", base_url);
            match client.get(&health_url).send().await {
                Ok(response) if response.status().is_success() => ProviderHealth::Healthy,
                Ok(_) => ProviderHealth::Degraded,
                Err(_) => ProviderHealth::Unhealthy,
            }
        } else {
            ProviderHealth::Unknown
        }
    }

    /// Get active providers count
    pub async fn get_active_providers_count(&self) -> usize {
        let stats = self.provider_stats.read().await;
        stats.values()
            .filter(|stat| stat.health == ProviderHealth::Healthy || stat.health == ProviderHealth::Degraded)
            .count()
    }

    /// Get provider statistics
    pub async fn get_provider_stats(&self) -> Vec<ProviderStats> {
        let stats = self.provider_stats.read().await;
        stats.values().cloned().collect()
    }
}
//! Main LLM Router implementation

use crate::config::RouterConfig;
use crate::models::{Message, Response, Usage, GenerationOptions};
use crate::providers::{Provider, OllamaProvider, MLXProvider, FastVLMProvider, ProviderConfig, ProviderType};
use crate::token_manager::{TokenBudgetManager, UserTier, TokenUsage, detect_task_complexity};
use crate::context_manager::{ContextManager, TruncationStrategy};
use crate::librarian_context::LibrarianStrategy;
use crate::unlimited_context::UnlimitedContextManager;
use crate::RouterError;
use std::collections::HashMap;
use std::sync::Arc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone)]
pub enum RoutingStrategy {
    RoundRobin,
    LeastLoaded,
    FastestResponse,
    CostOptimized,
}

#[derive(Debug)]
pub struct LLMRouter {
    _config: RouterConfig,
    providers: HashMap<String, Arc<dyn Provider>>,
    strategy: RoutingStrategy,
    token_manager: TokenBudgetManager,
    context_manager: ContextManager,
    unlimited_context_manager: Option<UnlimitedContextManager>,
    use_unlimited_context: bool,
}

impl LLMRouter {
    pub async fn new(config: RouterConfig) -> Result<Self, RouterError> {
        let mut router = Self {
            _config: config,
            providers: HashMap::new(),
            strategy: RoutingStrategy::RoundRobin,
            token_manager: TokenBudgetManager::new(),
            context_manager: ContextManager::new()
                .with_strategy(TruncationStrategy::KeepSystemAndRecent)
                .with_librarian(
                    "http://localhost:8080".to_string(), // Librarian service URL
                    LibrarianStrategy::SummarizeOldKeepRecent
                ),
            unlimited_context_manager: Some(UnlimitedContextManager::new(
                "http://localhost:8080".to_string()
            )),
            use_unlimited_context: true,
        };

        // Initialize Ollama provider (with default URL if not set)
        let ollama_url = env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
        println!("Initializing Ollama provider at: {}", ollama_url);
        let ollama_config = ProviderConfig {
            provider_type: ProviderType::Ollama,
            api_key: None,
            base_url: ollama_url,
            timeout: std::time::Duration::from_secs(30),
            models: vec!["llama3.2:3b".to_string()],
        };
        let ollama_provider = OllamaProvider::new(ollama_config);
        router.add_provider("ollama".to_string(), Arc::new(ollama_provider));
        println!("Ollama provider initialized successfully");

        // Initialize MLX provider if available
        println!("Checking MLX provider availability...");
        if let Ok(_) = reqwest::Client::new()
            .get("http://localhost:8002/health")
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
        {
            println!("HRM-MLX provider is available, initializing...");
            let mlx_config = ProviderConfig {
                provider_type: ProviderType::MLX,
                api_key: None,
                base_url: "http://localhost:8002".to_string(),
                timeout: std::time::Duration::from_secs(120), // Increased timeout for HRM processing
                models: vec!["hrm-mlx".to_string()],
            };
            let mlx_provider = MLXProvider::new(mlx_config);
            router.add_provider("mlx".to_string(), Arc::new(mlx_provider));
            println!("HRM-MLX provider initialized successfully");
        } else {
            println!("HRM-MLX provider not available, skipping...");
        }

        // Initialize FastVLM provider if available
        println!("Checking FastVLM provider availability...");
        if let Ok(_) = reqwest::Client::new()
            .get("http://localhost:8003/health")
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await
        {
            println!("FastVLM provider is available, initializing...");
            let fastvlm_config = ProviderConfig {
                provider_type: ProviderType::FastVLM,
                api_key: None,
                base_url: "http://localhost:8003".to_string(),
                timeout: std::time::Duration::from_secs(60), // Reasonable timeout for vision processing
                models: vec!["fastvlm-0.5b".to_string(), "fastvlm-7b".to_string()],
            };
            let fastvlm_provider = FastVLMProvider::new(fastvlm_config);
            router.add_provider("fastvlm".to_string(), Arc::new(fastvlm_provider));
            println!("FastVLM provider initialized successfully");
        } else {
            println!("FastVLM provider not available, skipping...");
        }

        Ok(router)
    }
    
    async fn determine_provider_for_model(&self, model_name: Option<&str>) -> Result<String, RouterError> {
        if let Some(model) = model_name {
            for (provider_name, provider) in &self.providers {
                if let Ok(available_models) = provider.list_models().await {
                    if available_models.iter().any(|m| m == model) {
                        return Ok(provider_name.clone());
                    }
                }
            }
        }
        // Default to Ollama if no specific model or provider is found
        Ok("ollama".to_string())
    }

    pub fn with_strategy(mut self, strategy: RoutingStrategy) -> Self {
        self.strategy = strategy;
        self
    }
    
    pub fn enable_unlimited_context(mut self, librarian_url: String) -> Self {
        self.unlimited_context_manager = Some(UnlimitedContextManager::new(librarian_url));
        self.use_unlimited_context = true;
        self
    }
    
    pub fn disable_unlimited_context(mut self) -> Self {
        self.unlimited_context_manager = None;
        self.use_unlimited_context = false;
        self
    }

    pub async fn route_request(
        &mut self,
        messages: Vec<Message>,
        options: Option<GenerationOptions>,
    ) -> Result<Response, RouterError> {
        // Extract model name from options
        let model_name = options
            .as_ref()
            .and_then(|o| o.model.as_ref())
            .map(|s| s.as_str());

        // Get provider name first
        let provider_name = self.determine_provider_for_model(model_name).await?;
        
        // Process context with unlimited context management if enabled
        let validated_messages = if self.use_unlimited_context {
            if let Some(ref mut unlimited_manager) = self.unlimited_context_manager {
                // Generate session ID from messages (simple hash for now)
                let session_id = format!("session_{}", messages.len());
                
                // Get context limits for the provider
                let limits = self.context_manager.limits.get_limits_or_default(&provider_name, model_name.unwrap_or("default"));
                
                // Process with unlimited context
                unlimited_manager.process_unlimited_context(
                    &session_id,
                    messages.clone(),
                    limits.effective_input_limit(),
                ).await?
            } else {
                // Fallback to regular context management
                self.context_manager.validate_and_truncate(
                    messages.clone(),
                    &provider_name,
                    model_name.unwrap_or("default"),
                ).await?
            }
        } else {
            // Use regular context management
            self.context_manager.validate_and_truncate(
                messages.clone(),
                &provider_name,
                model_name.unwrap_or("default"),
            ).await?
        };

        // Log context usage statistics
        let stats = self.context_manager.get_context_stats(
            &validated_messages,
            &provider_name,
            model_name.unwrap_or("default"),
        );
        
        if stats.is_critical() {
            tracing::warn!(
                "Critical context usage: {:.1}% ({}/{} tokens) - Dynamic management: {}",
                stats.usage_percentage,
                stats.estimated_tokens,
                stats.max_tokens,
                stats.is_dynamic_management_active
            );
        } else if stats.is_warning() {
            tracing::info!(
                "High context usage: {:.1}% ({}/{} tokens) - Dynamic threshold: {:.1}%",
                stats.usage_percentage,
                stats.estimated_tokens,
                stats.max_tokens,
                stats.dynamic_threshold_percentage
            );
        }

        // Try to find a healthy provider that supports the requested model
        let mut healthy_providers = Vec::new();

        for (name, provider) in &self.providers {
            match provider.health_check().await {
                Ok(_) => {
                    tracing::debug!("Provider {} is healthy", name);
                    healthy_providers.push((name.clone(), provider));
                }
                Err(e) => {
                    tracing::warn!("Provider {} health check failed: {}", name, e);
                }
            }
        }

        // Try healthy providers first
        for (name, provider) in healthy_providers {
            // Check if this provider supports the requested model
            if let Some(model) = model_name {
                if let Ok(available_models) = provider.list_models().await {
                    if available_models.iter().any(|m| m == model) {
                        tracing::info!("Routing request for model {} to provider {}", model, name);
                        match provider.generate(validated_messages.clone(), options.clone()).await {
                            Ok(response) => return Ok(response),
                            Err(e) => {
                                tracing::warn!("Provider {} failed for model {}: {}", name, model, e);
                                continue; // Try next provider
                            }
                        }
                    }
                }
            } else {
                // No specific model requested, use this provider
                tracing::info!("Routing request to provider {} (no specific model)", name);
                match provider.generate(validated_messages.clone(), options.clone()).await {
                    Ok(response) => return Ok(response),
                    Err(e) => {
                        tracing::warn!("Provider {} failed: {}", name, e);
                        continue; // Try next provider
                    }
                }
            }
        }

        // Fallback to direct Ollama call if no providers are healthy
        if let Some(ollama_url) = env::var("OLLAMA_URL").ok() {
            tracing::info!("Falling back to direct Ollama call at {}", ollama_url);
            return call_ollama(&ollama_url, &messages, options).await;
        }

        Err(RouterError::NoHealthyProviders)
    }

    pub async fn route_stream(
        &self,
        messages: Vec<Message>,
        options: Option<GenerationOptions>,
    ) -> Result<Box<dyn futures_util::Stream<Item = Result<String, RouterError>> + Send + Unpin>, RouterError> {
        // Try to find a healthy provider that supports streaming
        let mut healthy_providers = Vec::new();

        for (name, provider) in &self.providers {
            match provider.health_check().await {
                Ok(_) => {
                    tracing::debug!("Provider {} is healthy for streaming", name);
                    healthy_providers.push((name.clone(), provider));
                }
                Err(e) => {
                    tracing::warn!("Provider {} health check failed for streaming: {}", name, e);
                }
            }
        }

        // Try healthy providers first
        for (name, provider) in healthy_providers {
            tracing::info!("Attempting to stream with provider {}", name);
            match provider.generate_stream(messages.clone(), options.clone()).await {
                Ok(stream) => {
                    tracing::info!("Successfully created stream with provider {}", name);
                    return Ok(stream);
                }
                Err(e) => {
                    tracing::warn!("Provider {} streaming failed: {}", name, e);
                    continue;
                }
            }
        }

        Err(RouterError::NoHealthyProviders)
    }

    pub fn add_provider(&mut self, name: String, provider: Arc<dyn Provider>) {
        self.providers.insert(name, provider);
    }

    pub fn providers(&self) -> &HashMap<String, Arc<dyn Provider>> {
        &self.providers
    }

    pub async fn list_models(&self) -> Result<Vec<String>, RouterError> {
        let mut all_models = Vec::new();
        for provider in self.providers.values() {
            if let Ok(models) = provider.list_models().await {
                all_models.extend(models);
            }
        }
        Ok(all_models)
    }

    pub async fn get_provider_health(&self) -> HashMap<String, bool> {
        let mut health_status = HashMap::new();
        for (name, provider) in &self.providers {
            let is_healthy = provider.health_check().await.is_ok();
            health_status.insert(name.clone(), is_healthy);
        }
        health_status
    }

    pub async fn get_healthy_providers(&self) -> Vec<String> {
        let mut healthy_providers = Vec::new();
        for (name, provider) in &self.providers {
            if provider.health_check().await.is_ok() {
                healthy_providers.push(name.clone());
            }
        }
        healthy_providers
    }
}

// Minimal Ollama client using native /api/chat endpoint (non-streaming)
#[derive(Debug, Serialize)]
struct OllamaChatRequest<'a> {
    model: &'a str,
    messages: Vec<OllamaMessage<'a>>,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct OllamaMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    model: String,
    message: OllamaResponseMessage,
    #[allow(dead_code)]
    total_duration: Option<u64>,
    prompt_eval_count: Option<u32>,
    eval_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaResponseMessage {
    #[allow(dead_code)]
    role: String,
    content: String,
}

async fn call_ollama(
    base_url: &str,
    messages: &[Message],
    options: Option<GenerationOptions>,
) -> Result<Response, RouterError> {
    // Choose a reasonable default local model
    let model = options
        .as_ref()
        .and_then(|o| o.model.as_ref())
        .unwrap_or(&"llama3.2:3b".to_string())
        .clone();

    let client = Client::new();

    // Map our Message to OllamaMessage (only user/assistant supported here)
    let mapped: Vec<OllamaMessage> = messages
        .iter()
        .map(|m| OllamaMessage {
            role: match m.role {
                crate::context::MessageRole::User => "user",
                crate::context::MessageRole::Assistant => "assistant",
                crate::context::MessageRole::System => "system",
                _ => "user", // tools/context -> user for now
            },
            content: m.content.as_str(),
        })
        .collect();

    let req = OllamaChatRequest {
        model: &model,
        messages: mapped,
        stream: false,
    };

    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));
    let resp = client
        .post(&url)
        .json(&req)
        .send()
        .await
        .map_err(|e| RouterError::NetworkError(format!("Ollama request failed: {}", e)))?;

    if !resp.status().is_success() {
        return Err(RouterError::ProviderError(format!(
            "Ollama returned status {}",
            resp.status()
        )));
    }

    let data: OllamaChatResponse = resp
        .json()
        .await
        .map_err(|e| RouterError::SerializationError(format!("Invalid Ollama response: {}", e)))?;

    Ok(Response {
        content: data.message.content,
        model: data.model,
        provider: "ollama".to_string(),
        usage: Some(Usage {
            prompt_tokens: data.prompt_eval_count.unwrap_or(0),
            completion_tokens: data.eval_count.unwrap_or(0),
            total_tokens: data
                .prompt_eval_count
                .unwrap_or(0)
                .saturating_add(data.eval_count.unwrap_or(0)),
        }),
        metadata: None,
    })
}

impl LLMRouter {
    /// Intelligent request handling with token budgeting and adaptive model selection
    pub async fn route_with_budget(
        &mut self,
        messages: Vec<Message>,
        user_id: &str,
        user_tier: UserTier,
        max_tokens: Option<u32>,
    ) -> Result<Response, RouterError> {
        // Extract message content for analysis
        let message_contents: Vec<String> = messages.iter().map(|m| m.content.clone()).collect();

        // Detect task complexity
        let complexity = detect_task_complexity(&message_contents);

        // Estimate token usage (rough estimation)
        let total_chars: usize = message_contents.iter().map(|m| m.len()).sum();
        let _estimated_tokens = (total_chars / 4) as u32; // Rough estimation: 4 chars per token

        // Use requested max_tokens or complexity-based suggestion
        let requested_tokens = max_tokens.unwrap_or_else(|| complexity.suggested_token_limit(&user_tier));

        // Check token budget
        let budget_result = self.token_manager.check_request_budget(
            user_id,
            user_tier.clone(),
            complexity.clone(),
            requested_tokens,
        ).map_err(|e| RouterError::ProviderError(format!("Token limit exceeded: {}", e)))?;

        // Select optimal model based on budget result
        let model = budget_result.suggested_model;

        // Route the request
        let options = Some(GenerationOptions {
            model: Some(model.clone()),
            temperature: None,
            max_tokens: Some(requested_tokens),
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
            stop_sequences: None,
            stream: None,
            user_id: Some(user_id.to_string()),
            request_id: None,
            include_context: None,
            context_types: None,
            capabilities: None,
        });
        let response = self.route_request(messages, options).await?;

        // Record actual token usage
        if let Some(usage) = &response.usage {
            self.token_manager.record_request_usage(user_id, user_tier, usage.total_tokens);
        }

        Ok(response)
    }

    /// Get token usage statistics for a user
    pub fn get_user_token_stats(&self, user_id: &str) -> Option<&TokenUsage> {
        self.token_manager.get_user_stats(user_id)
    }

    /// Get all token usage statistics (for monitoring)
    pub fn get_all_token_stats(&self) -> &HashMap<String, TokenUsage> {
        self.token_manager.get_all_stats()
    }
}

//! LLM Provider implementations

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::Arc;
use tokio::sync::RwLock;
use reqwest::Client;
use crate::models::{Message, Response, Usage, GenerationOptions, ResponseMetadata};
use crate::RouterError;
use crate::context::MessageRole;
use futures_util::stream::StreamExt;
use tokio_stream::Stream;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProviderType {
    OpenAI,
    Anthropic,
    Google,
    Local,
    Ollama,
    LMStudio,
    MLX,
    FastVLM,
}

impl fmt::Display for ProviderType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProviderType::OpenAI => write!(f, "OpenAI"),
            ProviderType::Anthropic => write!(f, "Anthropic"),
            ProviderType::Google => write!(f, "Google"),
            ProviderType::Local => write!(f, "Local"),
            ProviderType::Ollama => write!(f, "Ollama"),
            ProviderType::LMStudio => write!(f, "LMStudio"),
            ProviderType::MLX => write!(f, "MLX"),
            ProviderType::FastVLM => write!(f, "FastVLM"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ProviderConfig {
    pub provider_type: ProviderType,
    pub api_key: Option<String>,
    pub base_url: String,
    pub timeout: std::time::Duration,
    pub models: Vec<String>,
}

impl Default for ProviderConfig {
    fn default() -> Self {
        Self {
            provider_type: ProviderType::Ollama,
            api_key: None,
            base_url: "http://localhost:11434".to_string(),
            timeout: std::time::Duration::from_secs(30),
            models: vec!["llama3.2:3b".to_string()],
        }
    }
}

#[async_trait]
pub trait Provider: Send + Sync + std::fmt::Debug {
    fn provider_type(&self) -> ProviderType;
    fn name(&self) -> &str;
    async fn health_check(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;
    async fn generate(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Response, RouterError>;
    async fn generate_stream(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Box<dyn Stream<Item = Result<String, RouterError>> + Send + Unpin>, RouterError>;
    async fn list_models(&self) -> Result<Vec<String>, RouterError>;
}

#[derive(Debug)]
pub struct ProviderClient {
    config: ProviderConfig,
}

impl ProviderClient {
    pub fn new(config: ProviderConfig) -> Self {
        Self { config }
    }

    pub fn config(&self) -> &ProviderConfig {
        &self.config
    }
}

#[async_trait]
impl Provider for ProviderClient {
    fn provider_type(&self) -> ProviderType {
        self.config.provider_type.clone()
    }

    fn name(&self) -> &str {
        match self.config.provider_type {
            ProviderType::OpenAI => "openai",
            ProviderType::Anthropic => "anthropic",
            ProviderType::Google => "google",
            ProviderType::Local => "local",
            ProviderType::Ollama => "ollama",
            ProviderType::LMStudio => "lmstudio",
            ProviderType::MLX => "mlx",
            ProviderType::FastVLM => "fastvlm",
        }
    }

    async fn health_check(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Basic health check implementation
        Ok(())
    }

    async fn generate(&self, _messages: Vec<Message>, _options: Option<GenerationOptions>) -> Result<Response, RouterError> {
        Err(RouterError::ProviderError("Not implemented".to_string()))
    }

    async fn generate_stream(&self, _messages: Vec<Message>, _options: Option<GenerationOptions>) -> Result<Box<dyn Stream<Item = Result<String, RouterError>> + Send + Unpin>, RouterError> {
        Err(RouterError::ProviderError("Not implemented".to_string()))
    }

    async fn list_models(&self) -> Result<Vec<String>, RouterError> {
        Ok(self.config.models.clone())
    }
}

/// LM Studio provider implementation
#[derive(Debug)]
pub struct LMStudioProvider {
    config: ProviderConfig,
    client: Client,
    health_status: Arc<RwLock<bool>>,
}

impl LMStudioProvider {
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            config,
            client: Client::new(),
            health_status: Arc::new(RwLock::new(false)),
        }
    }

    async fn check_health(&self) -> bool {
        match self.client
            .get(&format!("{}/health", self.config.base_url))
            .timeout(self.config.timeout)
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    async fn get_models(&self) -> Result<Vec<String>, RouterError> {
        let response = self.client
            .get(&format!("{}/v1/models", self.config.base_url))
            .timeout(self.config.timeout)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(RouterError::ProviderError("Failed to fetch models".to_string()));
        }

        let models_response: serde_json::Value = response.json().await
            .map_err(|e| RouterError::SerializationError(e.to_string()))?;

        let models = models_response["data"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|model| model["id"].as_str().map(|s| s.to_string()))
            .collect();

        Ok(models)
    }
}

#[async_trait]
impl Provider for LMStudioProvider {
    fn provider_type(&self) -> ProviderType {
        ProviderType::LMStudio
    }

    fn name(&self) -> &str {
        "lmstudio"
    }

    async fn health_check(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.check_health().await {
            Ok(())
        } else {
            Err("Service not healthy".into())
        }
    }

    async fn generate(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Response, RouterError> {
        // Check health first
        let is_healthy = self.check_health().await;
        {
            let mut status = self.health_status.write().await;
            *status = is_healthy;
        }

        if !is_healthy {
            return Err(RouterError::ProviderError("Service not healthy".to_string()));
        }

        let options = options.unwrap_or_default();
        let model = options.model.unwrap_or_else(|| "qwen/qwen3-coder-30b".to_string());

        // Convert messages to LM Studio format
        let lm_messages: Vec<serde_json::Value> = messages
            .into_iter()
            .map(|m| {
                serde_json::json!({
                    "role": match m.role {
                        MessageRole::System => "system",
                        MessageRole::User => "user",
                        MessageRole::Assistant => "assistant",
                        MessageRole::Tool { .. } => "user",
                        MessageRole::Context { .. } => "system",
                    },
                    "content": m.content
                })
            })
            .collect();

        let request_body = serde_json::json!({
            "model": model,
            "messages": lm_messages,
            "temperature": options.temperature.unwrap_or(0.7),
            "max_tokens": options.max_tokens.unwrap_or(1000),
            "stream": false
        });

        let response = self.client
            .post(&format!("{}/v1/chat/completions", self.config.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .timeout(self.config.timeout)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(RouterError::ProviderError(format!("HTTP error: {}", response.status())));
        }

        let lm_response: serde_json::Value = response.json().await
            .map_err(|e| RouterError::SerializationError(e.to_string()))?;

        let content = lm_response["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let usage = lm_response["usage"].as_object().map(|u| Usage {
            prompt_tokens: u.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            completion_tokens: u.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            total_tokens: u.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        });

        Ok(Response {
            content,
            model: model.clone(),
            provider: "LMStudio".to_string(),
            usage,
              metadata: Some(ResponseMetadata {
                duration_ms: 0, // TODO: Calculate actual duration
                confidence: None,
                reasoning: None,
                cached: None,
                health_score: None,
            }),
        })
    }

    async fn generate_stream(&self, _messages: Vec<Message>, _options: Option<GenerationOptions>) -> Result<Box<dyn Stream<Item = Result<String, RouterError>> + Send + Unpin>, RouterError> {
        Err(RouterError::ProviderError("Streaming not implemented for LM Studio".to_string()))
    }

    async fn list_models(&self) -> Result<Vec<String>, RouterError> {
        self.get_models().await
    }

}

/// MLX provider implementation
#[derive(Debug)]
pub struct MLXProvider {
    config: ProviderConfig,
    client: Client,
    health_status: Arc<RwLock<bool>>,
}

impl MLXProvider {
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            config,
            client: Client::new(),
            health_status: Arc::new(RwLock::new(false)),
        }
    }

    async fn check_health(&self) -> bool {
        match self.client
            .get(&format!("{}/health", self.config.base_url))
            .timeout(self.config.timeout)
            .send()
            .await
        {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }
}

#[async_trait]
impl Provider for MLXProvider {
    fn provider_type(&self) -> ProviderType {
        ProviderType::MLX
    }

    fn name(&self) -> &str {
        "mlx"
    }

    async fn health_check(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.check_health().await {
            Ok(())
        } else {
            Err("Service not healthy".into())
        }
    }

    async fn generate(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Response, RouterError> {
        // Check health first
        let is_healthy = self.check_health().await;
        {
            let mut status = self.health_status.write().await;
            *status = is_healthy;
        }

        if !is_healthy {
            return Err(RouterError::ProviderError("Service not healthy".to_string()));
        }

        let options = options.unwrap_or_default();

        // HRM service uses a different API format
        let prompt = messages.last()
            .map(|m| m.content.as_str())
            .unwrap_or("");

        let request_body = serde_json::json!({
            "input": prompt,
            "taskType": "reasoning",
            "complexity": "auto"
        });

        let response = self.client
            .post(&format!("{}/hrm/process", self.config.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .timeout(self.config.timeout)
            .send()
            .await
            .map_err(|e| {
                tracing::warn!("HRM request failed: {}", e);
                RouterError::NetworkError(format!("HRM service timeout or error: {}", e))
            })?;

        if !response.status().is_success() {
            return Err(RouterError::ProviderError(format!("HTTP error: {}", response.status())));
        }

        let hrm_response: serde_json::Value = response.json().await
            .map_err(|e| RouterError::SerializationError(e.to_string()))?;

        let content = hrm_response["output"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let performance_data = hrm_response["performance"].as_object();
        let tokens_generated = performance_data
            .and_then(|p| p.get("tokens_generated").and_then(|v| v.as_u64()))
            .unwrap_or(0) as u32;

        let usage = Some(Usage {
            prompt_tokens: 0, // HRM doesn't provide this
            completion_tokens: tokens_generated,
            total_tokens: tokens_generated,
        });

        Ok(Response {
            content,
            model: options.model.as_deref().unwrap_or("hrm-mlx").to_string(),
            provider: "MLX".to_string(),
            usage,
            metadata: Some(ResponseMetadata {
                duration_ms: 0, // TODO: Calculate actual duration
                confidence: hrm_response["metadata"]["reasoning_quality"].as_f64().map(|f| f as f32),
                reasoning: hrm_response["reasoning"].as_str().map(|s| s.to_string()),
                cached: Some(hrm_response["cached"].as_bool().unwrap_or(false)),
                health_score: hrm_response["performance"]["tokens_per_second"].as_f64().map(|f| f as f32),
            }),
        })
    }

    async fn generate_stream(&self, _messages: Vec<Message>, _options: Option<GenerationOptions>) -> Result<Box<dyn Stream<Item = Result<String, RouterError>> + Send + Unpin>, RouterError> {
        Err(RouterError::ProviderError("Streaming not implemented for MLX".to_string()))
    }

    async fn list_models(&self) -> Result<Vec<String>, RouterError> {
        // HRM-MLX service doesn't have a /models endpoint
        // Return the configured models instead
        Ok(self.config.models.clone())
    }

}

/// Ollama provider implementation with SSE streaming support
#[derive(Debug)]
pub struct OllamaProvider {
    config: ProviderConfig,
    client: Client,
    health_status: Arc<RwLock<bool>>,
}

impl OllamaProvider {
    pub fn new(config: ProviderConfig) -> Self {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            config,
            client,
            health_status: Arc::new(RwLock::new(false)),
        }
    }

    pub fn with_default_config() -> Self {
        Self::new(ProviderConfig::default())
    }

    async fn check_health_internal(&self) -> bool {
        let url = format!("{}/api/tags", self.config.base_url);
        match self.client.get(&url).send().await {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    async fn call_ollama_chat(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Response, RouterError> {
        let model = options
            .as_ref()
            .and_then(|o| o.model.as_ref())
            .or_else(|| self.config.models.first())
            .ok_or_else(|| RouterError::ConfigError("No model specified".to_string()))?;

        let url = format!("{}/api/chat", self.config.base_url);

        let ollama_messages: Vec<OllamaMessage> = messages
            .iter()
            .map(|m| OllamaMessage {
                role: match m.role {
                    MessageRole::System => "system".to_string(),
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                    MessageRole::Tool { .. } => "user".to_string(),
                    MessageRole::Context { .. } => "system".to_string(),
                },
                content: m.content.clone(),
            })
            .collect();

        let request = OllamaChatRequest {
            model: model.clone(),
            messages: ollama_messages,
            stream: false,
            options: options.as_ref().map(|o| OllamaOptions {
                temperature: o.temperature,
                top_p: o.top_p,
                max_tokens: o.max_tokens,
            }),
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Ollama request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(RouterError::ProviderError(format!(
                "Ollama returned status {}",
                response.status()
            )));
        }

        let data: OllamaChatResponse = response
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

    async fn call_ollama_stream(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Box<dyn Stream<Item = Result<String, RouterError>> + Send + Unpin>, RouterError> {
        let model = options
            .as_ref()
            .and_then(|o| o.model.as_ref())
            .or_else(|| self.config.models.first())
            .ok_or_else(|| RouterError::ConfigError("No model specified".to_string()))?;

        let url = format!("{}/api/chat", self.config.base_url);

        let ollama_messages: Vec<OllamaMessage> = messages
            .iter()
            .map(|m| OllamaMessage {
                role: match m.role {
                    MessageRole::System => "system".to_string(),
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                    MessageRole::Tool { .. } => "user".to_string(),
                    MessageRole::Context { .. } => "system".to_string(),
                },
                content: m.content.clone(),
            })
            .collect();

        let request = OllamaChatRequest {
            model: model.clone(),
            messages: ollama_messages,
            stream: true,
            options: options.as_ref().map(|o| OllamaOptions {
                temperature: o.temperature,
                top_p: o.top_p,
                max_tokens: o.max_tokens,
            }),
        };

        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Ollama stream request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(RouterError::ProviderError(format!(
                "Ollama returned status {}",
                response.status()
            )));
        }

        let stream = response
            .bytes_stream()
            .map(|chunk_result| {
                chunk_result
                    .map_err(|e| RouterError::NetworkError(format!("Stream error: {}", e)))
                    .and_then(|chunk| {
                        let text = String::from_utf8(chunk.to_vec())
                            .map_err(|e| RouterError::SerializationError(format!("Invalid UTF-8: {}", e)))?;

                        // Parse SSE format
                        let lines: Vec<&str> = text.split('\n').collect();
                        for line in lines {
                            if line.starts_with("data: ") {
                                let data = &line[6..];
                                if data == "[DONE]" {
                                    break;
                                }

                                if let Ok(stream_data) = serde_json::from_str::<OllamaStreamResponse>(data) {
                                    if let Some(content) = stream_data.message.content {
                                        return Ok(content);
                                    }
                                }
                            }
                        }

                        Ok(String::new())
                    })
            });

        Ok(Box::new(stream))
    }
}

#[async_trait]
impl Provider for OllamaProvider {
    fn provider_type(&self) -> ProviderType {
        ProviderType::Ollama
    }

    fn name(&self) -> &str {
        "ollama"
    }

    async fn health_check(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let is_healthy = self.check_health_internal().await;
        {
            let mut status = self.health_status.write().await;
            *status = is_healthy;
        }

        if is_healthy {
            Ok(())
        } else {
            Err("Ollama service is not healthy".into())
        }
    }

    async fn generate(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Response, RouterError> {
        self.call_ollama_chat(messages, options).await
    }

    async fn generate_stream(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Box<dyn Stream<Item = Result<String, RouterError>> + Send + Unpin>, RouterError> {
        self.call_ollama_stream(messages, options).await
    }

    async fn list_models(&self) -> Result<Vec<String>, RouterError> {
        let url = format!("{}/api/tags", self.config.base_url);
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Failed to list models: {}", e)))?;

        if !response.status().is_success() {
            return Err(RouterError::ProviderError(format!(
                "Failed to list models: {}",
                response.status()
            )));
        }

        let data: OllamaModelsResponse = response
            .json()
            .await
            .map_err(|e| RouterError::SerializationError(format!("Invalid models response: {}", e)))?;

        Ok(data.models.into_iter().map(|m| m.name).collect())
    }
}

// Ollama API types
#[derive(Debug, Serialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    options: Option<OllamaOptions>,
}

#[derive(Debug, Serialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    temperature: Option<f32>,
    top_p: Option<f32>,
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    model: String,
    message: OllamaResponseMessage,
    prompt_eval_count: Option<u32>,
    eval_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OllamaResponseMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamResponse {
    message: OllamaStreamMessage,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaModelsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

// FastVLM Provider Implementation
#[derive(Debug)]
pub struct FastVLMProvider {
    config: ProviderConfig,
    client: Client,
    health_status: Arc<RwLock<bool>>,
}

impl FastVLMProvider {
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            config,
            client: Client::new(),
            health_status: Arc::new(RwLock::new(false)),
        }
    }
}

#[async_trait]
impl Provider for FastVLMProvider {
    async fn health_check(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let response = self.client
            .get(&format!("{}/health", self.config.base_url))
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| Box::new(RouterError::NetworkError(e.to_string())) as Box<dyn std::error::Error + Send + Sync>)?;

        if response.status().is_success() {
            let mut status = self.health_status.write().await;
            *status = true;
            Ok(())
        } else {
            let mut status = self.health_status.write().await;
            *status = false;
            Err(Box::new(RouterError::ProviderError("Service not healthy".to_string())) as Box<dyn std::error::Error + Send + Sync>)
        }
    }

    fn provider_type(&self) -> ProviderType {
        ProviderType::FastVLM
    }

    fn name(&self) -> &str {
        "FastVLM"
    }

    async fn list_models(&self) -> Result<Vec<String>, RouterError> {
        // FastVLM service provides its own models endpoint
        let response = self.client
            .get(&format!("{}/models", self.config.base_url))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(RouterError::ProviderError(format!("HTTP error: {}", response.status())));
        }

        let models_response: serde_json::Value = response.json().await
            .map_err(|e| RouterError::SerializationError(e.to_string()))?;

        let models = models_response["models"]
            .as_array()
            .ok_or_else(|| RouterError::SerializationError("Invalid models response format".to_string()))?
            .iter()
            .filter_map(|model| model["id"].as_str().map(|s| s.to_string()))
            .collect();

        Ok(models)
    }

    async fn generate(&self, messages: Vec<Message>, options: Option<GenerationOptions>) -> Result<Response, RouterError> {
        // Check health first
        let is_healthy = self.check_health().await;
        {
            let mut status = self.health_status.write().await;
            *status = is_healthy;
        }

        if !is_healthy {
            return Err(RouterError::ProviderError("Service not healthy".to_string()));
        }

        let options = options.unwrap_or_default();

        // Convert messages to OpenAI format for FastVLM service
        let openai_messages: Vec<serde_json::Value> = messages
            .into_iter()
            .map(|msg| {
                serde_json::json!({
                    "role": match msg.role {
                        MessageRole::System => "system",
                        MessageRole::User => "user",
                        MessageRole::Assistant => "assistant",
                        MessageRole::Tool { .. } => "tool",
                        MessageRole::Context { .. } => "context",
                    },
                    "content": msg.content
                })
            })
            .collect();

        let request_body = serde_json::json!({
            "messages": openai_messages,
            "model": options.model.as_deref().unwrap_or("fastvlm-7b"),
            "temperature": options.temperature.unwrap_or(0.7),
            "max_tokens": options.max_tokens.unwrap_or(512),
            "stream": false
        });

        let response = self.client
            .post(&format!("{}/v1/chat/completions", self.config.base_url))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .timeout(self.config.timeout)
            .send()
            .await
            .map_err(|e| {
                tracing::warn!("FastVLM request failed: {}", e);
                RouterError::NetworkError(format!("FastVLM service timeout or error: {}", e))
            })?;

        if !response.status().is_success() {
            return Err(RouterError::ProviderError(format!("HTTP error: {}", response.status())));
        }

        let fastvlm_response: serde_json::Value = response.json().await
            .map_err(|e| RouterError::SerializationError(e.to_string()))?;

        let content = fastvlm_response["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let usage = fastvlm_response["usage"].as_object().map(|usage| Usage {
            prompt_tokens: usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            completion_tokens: usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            total_tokens: usage.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
        });

        Ok(Response {
            content,
            model: options.model.as_deref().unwrap_or("fastvlm-7b").to_string(),
            provider: "FastVLM".to_string(),
            usage,
            metadata: Some(ResponseMetadata {
                duration_ms: 0, // TODO: Calculate actual duration
                confidence: None,
                reasoning: None,
                cached: Some(false),
                health_score: Some(1.0),
            }),
        })
    }

    async fn generate_stream(
        &self,
        _messages: Vec<Message>,
        _options: Option<GenerationOptions>,
    ) -> Result<Box<dyn Stream<Item = Result<String, RouterError>> + Send + Unpin>, RouterError> {
        // FastVLM service doesn't support streaming yet
        Err(RouterError::ProviderError("Streaming not supported by FastVLM provider".to_string()))
    }
}

impl FastVLMProvider {
    async fn check_health(&self) -> bool {
        self.health_check().await.is_ok()
    }
}


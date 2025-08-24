//! LLM provider implementations with OpenTelemetry tracing

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use tracing::{instrument, info, warn, error};

use crate::tracing_setup::{create_provider_span, record_performance_metrics, record_error};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmRequest {
    pub model: String,
    pub prompt: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmResponse {
    pub id: String,
    pub model: String,
    pub text: String,
    pub provider: String,
    pub usage: TokenUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

pub type RouterResult<T> = Result<T, RouterError>;

#[derive(Debug, thiserror::Error)]
pub enum RouterError {
    #[error("Provider error: {0}")]
    ProviderError(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Timeout error")]
    TimeoutError,
    #[error("Rate limit exceeded")]
    RateLimitError,
    #[error("Authentication error")]
    AuthError,
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn execute(&self, request: &LlmRequest) -> RouterResult<LlmResponse>;
    async fn health_check(&self) -> RouterResult<bool>;
    fn name(&self) -> &str;
    fn supports_model(&self, model: &str) -> bool;
}

/// Ollama provider implementation
pub struct OllamaProvider {
    name: String,
    endpoint: String,
    client: reqwest::Client,
    supported_models: Vec<String>,
}

impl OllamaProvider {
    pub fn new(name: String, endpoint: String, models: Vec<String>) -> Self {
        Self {
            name,
            endpoint,
            client: reqwest::Client::new(),
            supported_models: models,
        }
    }
}

#[async_trait]
impl LlmProvider for OllamaProvider {
    #[instrument(skip(self, request), fields(provider = %self.name, model = %request.model))]
    async fn execute(&self, request: &LlmRequest) -> RouterResult<LlmResponse> {
        let span = create_provider_span(&self.name, "execute");
        let _enter = span.enter();
        let start_time = Instant::now();

        info!(
            provider = self.name,
            model = request.model,
            prompt_length = request.prompt.len(),
            "Executing LLM request"
        );

        // Prepare Ollama-specific request
        let ollama_request = serde_json::json!({
            "model": request.model,
            "prompt": request.prompt,
            "options": {
                "num_predict": request.max_tokens,
                "temperature": request.temperature
            },
            "stream": false
        });

        let response = self
            .client
            .post(&format!("{}/api/generate", self.endpoint))
            .json(&ollama_request)
            .send()
            .await
            .map_err(|e| {
                record_error(&span, &e.to_string(), Some("network"));
                RouterError::NetworkError(e.to_string())
            })?;

        if !response.status().is_success() {
            let error_msg = format!("Ollama API error: {}", response.status());
            record_error(&span, &error_msg, Some("api_error"));
            return Err(RouterError::ProviderError(error_msg));
        }

        let ollama_response: serde_json::Value = response
            .json()
            .await
            .map_err(|e| RouterError::ProviderError(e.to_string()))?;

        let response_text = ollama_response["response"]
            .as_str()
            .unwrap_or("")
            .to_string();

        // Estimate token usage (Ollama doesn't always provide exact counts)
        let prompt_tokens = request.prompt.split_whitespace().count() as u32;
        let completion_tokens = response_text.split_whitespace().count() as u32;
        let total_tokens = prompt_tokens + completion_tokens;

        let duration_ms = start_time.elapsed().as_millis() as u64;
        record_performance_metrics(&span, duration_ms, Some(total_tokens), Some(&self.name));

        info!(
            provider = self.name,
            model = request.model,
            tokens_used = total_tokens,
            duration_ms = duration_ms,
            "LLM request completed successfully"
        );

        Ok(LlmResponse {
            id: format!("ollama-{}", uuid::Uuid::new_v4()),
            model: request.model.clone(),
            text: response_text,
            provider: self.name.clone(),
            usage: TokenUsage {
                prompt_tokens,
                completion_tokens,
                total_tokens,
            },
        })
    }

    #[instrument(skip(self), fields(provider = %self.name))]
    async fn health_check(&self) -> RouterResult<bool> {
        let span = create_provider_span(&self.name, "health_check");
        let _enter = span.enter();

        match self
            .client
            .get(&format!("{}/api/tags", self.endpoint))
            .send()
            .await
        {
            Ok(response) => {
                let is_healthy = response.status().is_success();
                info!(
                    provider = self.name,
                    healthy = is_healthy,
                    "Health check completed"
                );
                Ok(is_healthy)
            }
            Err(e) => {
                warn!(
                    provider = self.name,
                    error = %e,
                    "Health check failed"
                );
                record_error(&span, &e.to_string(), Some("health_check"));
                Ok(false)
            }
        }
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn supports_model(&self, model: &str) -> bool {
        self.supported_models.contains(&model.to_string())
    }
}

/// Mock provider for testing and development
pub struct MockProvider {
    name: String,
    latency_ms: u64,
    should_fail: bool,
}

impl MockProvider {
    pub fn new(name: String, latency_ms: u64, should_fail: bool) -> Self {
        Self {
            name,
            latency_ms,
            should_fail,
        }
    }
}

#[async_trait]
impl LlmProvider for MockProvider {
    #[instrument(skip(self, request), fields(provider = %self.name, model = %request.model))]
    async fn execute(&self, request: &LlmRequest) -> RouterResult<LlmResponse> {
        let span = create_provider_span(&self.name, "execute");
        let _enter = span.enter();
        let start_time = Instant::now();

        // Simulate processing delay
        tokio::time::sleep(tokio::time::Duration::from_millis(self.latency_ms)).await;

        if self.should_fail {
            record_error(&span, "Mock provider failure", Some("mock_error"));
            return Err(RouterError::ProviderError("Mock provider failure".to_string()));
        }

        let mock_response = format!("Mock response to: {}", request.prompt);
        let tokens = (request.prompt.len() / 4) as u32; // Rough token estimation

        let duration_ms = start_time.elapsed().as_millis() as u64;
        record_performance_metrics(&span, duration_ms, Some(tokens), Some(&self.name));

        Ok(LlmResponse {
            id: format!("mock-{}", uuid::Uuid::new_v4()),
            model: request.model.clone(),
            text: mock_response,
            provider: self.name.clone(),
            usage: TokenUsage {
                prompt_tokens: tokens / 2,
                completion_tokens: tokens / 2,
                total_tokens: tokens,
            },
        })
    }

    async fn health_check(&self) -> RouterResult<bool> {
        Ok(!self.should_fail)
    }

    fn name(&self) -> &str {
        &self.name
    }

    fn supports_model(&self, _model: &str) -> bool {
        true
    }
}

// Add uuid dependency for generating IDs
use uuid;
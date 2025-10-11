use crate::routing::ServiceType;
use crate::CoordinatorError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::time::timeout;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub content: String,
    pub model: String,
    pub provider: String,
    pub tokens_used: u32,
    pub execution_time: u64,
    pub confidence: f64,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct ServiceExecutor {
    http_client: Client,
    service_urls: HashMap<ServiceType, String>,
    timeouts: HashMap<ServiceType, Duration>,
}

impl ServiceExecutor {
    pub fn new() -> Self {
        let mut service_urls = HashMap::new();
        service_urls.insert(ServiceType::LFM2, "http://localhost:5902".to_string());
        service_urls.insert(ServiceType::Ollama, "http://localhost:11434".to_string());
        service_urls.insert(ServiceType::LMStudio, "http://localhost:5901".to_string());
        service_urls.insert(ServiceType::OpenAI, "https://api.openai.com".to_string());
        service_urls.insert(ServiceType::Anthropic, "https://api.anthropic.com".to_string());
        
        let mut timeouts = HashMap::new();
        timeouts.insert(ServiceType::LFM2, Duration::from_secs(5));
        timeouts.insert(ServiceType::Ollama, Duration::from_secs(30));
        timeouts.insert(ServiceType::LMStudio, Duration::from_secs(30));
        timeouts.insert(ServiceType::OpenAI, Duration::from_secs(60));
        timeouts.insert(ServiceType::Anthropic, Duration::from_secs(60));
        
        Self {
            http_client: Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .expect("Failed to create HTTP client"),
            service_urls,
            timeouts,
        }
    }
    
    pub async fn execute_request(
        &self,
        service: &ServiceType,
        user_request: &str,
    ) -> Result<ExecutionResult, CoordinatorError> {
        let start_time = Instant::now();
        
        match service {
            ServiceType::LFM2 => self.execute_lfm2(user_request, start_time).await,
            ServiceType::Ollama => self.execute_ollama(user_request, start_time).await,
            ServiceType::LMStudio => self.execute_lm_studio(user_request, start_time).await,
            ServiceType::OpenAI => self.execute_openai(user_request, start_time).await,
            ServiceType::Anthropic => self.execute_anthropic(user_request, start_time).await,
        }
    }
    
    async fn execute_lfm2(
        &self,
        user_request: &str,
        start_time: Instant,
    ) -> Result<ExecutionResult, CoordinatorError> {
        tracing::info!("Executing request with LFM2");
        
        // For now, simulate LFM2 execution (would integrate with actual LFM2 bridge)
        let processing_time = Duration::from_millis(50 + (user_request.len() as u64));
        tokio::time::sleep(processing_time).await;
        
        let execution_time = start_time.elapsed().as_millis() as u64;
        let estimated_tokens = (user_request.len() as f64 / 4.0).ceil() as u32;
        
        Ok(ExecutionResult {
            content: format!("LFM2 response to: {}", user_request),
            model: "LFM2-1.2B".to_string(),
            provider: "local".to_string(),
            tokens_used: estimated_tokens.min(100), // LFM2 is optimized for short responses
            execution_time,
            confidence: 0.85,
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("backend_type".to_string(), "rust".to_string());
                meta.insert("model_size".to_string(), "1.2B".to_string());
                meta
            },
        })
    }
    
    async fn execute_ollama(
        &self,
        user_request: &str,
        start_time: Instant,
    ) -> Result<ExecutionResult, CoordinatorError> {
        let url = self.service_urls.get(&ServiceType::Ollama)
            .ok_or_else(|| CoordinatorError::ConfigError { 
                error: "Ollama URL not configured".to_string() 
            })?;
        
        let request_body = serde_json::json!({
            "model": "llama3.2:3b",
            "messages": [
                {
                    "role": "user",
                    "content": user_request
                }
            ],
            "stream": false
        });
        
        let service_timeout = self.timeouts.get(&ServiceType::Ollama)
            .copied()
            .unwrap_or(Duration::from_secs(30));
        
        let response = timeout(
            service_timeout,
            self.http_client.post(&format!("{}/v1/chat/completions", url))
                .json(&request_body)
                .send()
        ).await
            .map_err(|_| CoordinatorError::NetworkError { 
                error: "Ollama request timed out".to_string() 
            })?
            .map_err(|e| CoordinatorError::NetworkError { 
                error: format!("Ollama request failed: {}", e) 
            })?;
        
        if !response.status().is_success() {
            return Err(CoordinatorError::ServiceUnavailable { 
                service: "Ollama".to_string() 
            });
        }
        
        let response_data: OllamaResponse = response.json().await
            .map_err(|e| CoordinatorError::SerializationError { 
                error: format!("Failed to parse Ollama response: {}", e) 
            })?;
        
        let execution_time = start_time.elapsed().as_millis() as u64;
        
        Ok(ExecutionResult {
            content: response_data.message.content,
            model: response_data.model,
            provider: "ollama".to_string(),
            tokens_used: response_data.usage.total_tokens,
            execution_time,
            confidence: 0.90,
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("backend_type".to_string(), "ollama".to_string());
                meta.insert("prompt_tokens".to_string(), response_data.usage.prompt_tokens.to_string());
                meta.insert("completion_tokens".to_string(), response_data.usage.completion_tokens.to_string());
                meta
            },
        })
    }
    
    async fn execute_lm_studio(
        &self,
        user_request: &str,
        start_time: Instant,
    ) -> Result<ExecutionResult, CoordinatorError> {
        let url = self.service_urls.get(&ServiceType::LMStudio)
            .ok_or_else(|| CoordinatorError::ConfigError { 
                error: "LM Studio URL not configured".to_string() 
            })?;
        
        let request_body = serde_json::json!({
            "messages": [
                {
                    "role": "user",
                    "content": user_request
                }
            ],
            "temperature": 0.7,
            "max_tokens": 2000,
            "stream": false
        });
        
        let service_timeout = self.timeouts.get(&ServiceType::LMStudio)
            .copied()
            .unwrap_or(Duration::from_secs(30));
        
        let response = timeout(
            service_timeout,
            self.http_client.post(&format!("{}/v1/chat/completions", url))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
        ).await
            .map_err(|_| CoordinatorError::NetworkError { 
                error: "LM Studio request timed out".to_string() 
            })?
            .map_err(|e| CoordinatorError::NetworkError { 
                error: format!("LM Studio request failed: {}", e) 
            })?;
        
        if !response.status().is_success() {
            return Err(CoordinatorError::ServiceUnavailable { 
                service: "LM Studio".to_string() 
            });
        }
        
        let response_data: LMStudioResponse = response.json().await
            .map_err(|e| CoordinatorError::SerializationError { 
                error: format!("Failed to parse LM Studio response: {}", e) 
            })?;
        
        let execution_time = start_time.elapsed().as_millis() as u64;
        let content = response_data.choices.first()
            .and_then(|choice| choice.message.content.as_ref())
            .unwrap_or(&"No response content".to_string())
            .clone();
        
        Ok(ExecutionResult {
            content,
            model: response_data.model,
            provider: "lm-studio".to_string(),
            tokens_used: response_data.usage.total_tokens,
            execution_time,
            confidence: 0.88,
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("backend_type".to_string(), "lm-studio".to_string());
                meta.insert("finish_reason".to_string(), 
                    response_data.choices.first()
                        .map(|c| c.finish_reason.clone())
                        .unwrap_or_else(|| "unknown".to_string())
                );
                meta
            },
        })
    }
    
    async fn execute_openai(
        &self,
        user_request: &str,
        start_time: Instant,
    ) -> Result<ExecutionResult, CoordinatorError> {
        // This would integrate with the existing OpenAI service
        tracing::info!("Executing request with OpenAI");
        
        // Simulate network latency and processing
        tokio::time::sleep(Duration::from_millis(1000)).await;
        
        let execution_time = start_time.elapsed().as_millis() as u64;
        let estimated_tokens = (user_request.len() as f64 / 3.0).ceil() as u32;
        
        Ok(ExecutionResult {
            content: format!("OpenAI response to: {}", user_request),
            model: "gpt-4".to_string(),
            provider: "openai".to_string(),
            tokens_used: estimated_tokens,
            execution_time,
            confidence: 0.92,
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("backend_type".to_string(), "external".to_string());
                meta.insert("api_version".to_string(), "v1".to_string());
                meta
            },
        })
    }
    
    async fn execute_anthropic(
        &self,
        user_request: &str,
        start_time: Instant,
    ) -> Result<ExecutionResult, CoordinatorError> {
        // This would integrate with the existing Anthropic service
        tracing::info!("Executing request with Anthropic");
        
        // Simulate network latency and processing
        tokio::time::sleep(Duration::from_millis(1200)).await;
        
        let execution_time = start_time.elapsed().as_millis() as u64;
        let estimated_tokens = (user_request.len() as f64 / 3.5).ceil() as u32;
        
        Ok(ExecutionResult {
            content: format!("Anthropic response to: {}", user_request),
            model: "claude-3-sonnet".to_string(),
            provider: "anthropic".to_string(),
            tokens_used: estimated_tokens,
            execution_time,
            confidence: 0.93,
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("backend_type".to_string(), "external".to_string());
                meta.insert("api_version".to_string(), "2023-06-01".to_string());
                meta
            },
        })
    }
    
    pub async fn health_check(&self, service: &ServiceType) -> bool {
        let url = match self.service_urls.get(service) {
            Some(url) => url,
            None => return false,
        };
        
        let health_endpoint = match service {
            ServiceType::LFM2 => format!("{}/health", url),
            ServiceType::Ollama => format!("{}/api/tags", url), // Ollama's health endpoint
            ServiceType::LMStudio => format!("{}/v1/models", url),
            ServiceType::OpenAI | ServiceType::Anthropic => {
                // External services - assume healthy (would check API status)
                return true;
            }
        };
        
        let health_timeout = Duration::from_secs(5);
        
        match timeout(
            health_timeout,
            self.http_client.get(&health_endpoint).send()
        ).await {
            Ok(Ok(response)) => response.status().is_success(),
            _ => false,
        }
    }
}

// Response types for different services
#[derive(Debug, Deserialize)]
struct OllamaResponse {
    model: String,
    message: OllamaMessage,
    usage: TokenUsage,
}

#[derive(Debug, Deserialize)]
struct OllamaMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct LMStudioResponse {
    model: String,
    choices: Vec<LMStudioChoice>,
    usage: TokenUsage,
}

#[derive(Debug, Deserialize)]
struct LMStudioChoice {
    message: LMStudioMessage,
    finish_reason: String,
}

#[derive(Debug, Deserialize)]
struct LMStudioMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

impl Default for ServiceExecutor {
    fn default() -> Self {
        Self::new()
    }
}
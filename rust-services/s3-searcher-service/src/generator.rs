use anyhow::{Result, anyhow};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{info, debug, warn};
use std::time::Instant;

use crate::models::{Document, GeneratorResult};
use crate::config::GeneratorModel;

/// Trait for generator implementations
#[async_trait]
pub trait GeneratorClient: Send + Sync {
    /// Generate an answer given a question and supporting documents
    async fn generate_answer(&self, question: &str, documents: &[Document]) -> Result<GeneratorResult>;
    
    /// Evaluate a prompt (for GBR calculation)
    async fn evaluate(&self, prompt: &str) -> Result<String>;
}

/// Multi-model generator that can use different LLMs
pub struct MultiModelGenerator {
    models: Vec<GeneratorModel>,
    default_model_name: String,
    client: reqwest::Client,
}

impl MultiModelGenerator {
    pub fn new(models: Vec<GeneratorModel>, default_model: String) -> Self {
        Self {
            models,
            default_model_name: default_model,
            client: reqwest::Client::new(),
        }
    }
    
    /// Get a specific model by name
    fn get_model(&self, name: &str) -> Option<&GeneratorModel> {
        self.models.iter().find(|m| m.name == name)
    }
    
    /// Format documents for inclusion in prompt
    fn format_documents(&self, documents: &[Document]) -> String {
        if documents.is_empty() {
            return "No supporting documents available.".to_string();
        }
        
        documents.iter()
            .enumerate()
            .map(|(i, doc)| {
                format!("Document {}:\n{}\n", i + 1, doc.content)
            })
            .collect::<Vec<_>>()
            .join("\n---\n")
    }
}

#[async_trait]
impl GeneratorClient for MultiModelGenerator {
    async fn generate_answer(&self, question: &str, documents: &[Document]) -> Result<GeneratorResult> {
        let model = self.get_model(&self.default_model_name)
            .ok_or_else(|| anyhow!("Default model {} not found", self.default_model_name))?;
        
        let prompt = format!(
            "Answer the following question based on the provided documents.\n\n\
             Question: {}\n\n\
             Supporting Documents:\n{}\n\n\
             Please provide a comprehensive answer based on the information in the documents. \
             If the documents don't contain enough information, say so.",
            question,
            self.format_documents(documents)
        );
        
        let start = Instant::now();
        
        let answer = match model.name.as_str() {
            "ollama" => self.generate_ollama(&prompt, model).await?,
            "gpt-4" => self.generate_openai(&prompt, model).await?,
            "claude-3-haiku" => self.generate_anthropic(&prompt, model).await?,
            _ => return Err(anyhow!("Unknown model type: {}", model.name)),
        };
        
        let latency_ms = start.elapsed().as_millis() as u64;
        
        // Simple confidence estimation based on document relevance
        let confidence = if documents.is_empty() {
            0.1
        } else {
            let avg_relevance = documents.iter()
                .map(|d| d.relevance_score)
                .sum::<f32>() / documents.len() as f32;
            (avg_relevance * 0.8 + 0.2).min(1.0)
        };
        
        Ok(GeneratorResult {
            answer,
            confidence,
            model_used: model.name.clone(),
            tokens_used: 0, // Would need to parse from API responses
            latency_ms,
        })
    }
    
    async fn evaluate(&self, prompt: &str) -> Result<String> {
        let model = self.get_model(&self.default_model_name)
            .ok_or_else(|| anyhow!("Default model not found"))?;
        
        match model.name.as_str() {
            "ollama" => self.generate_ollama(prompt, model).await,
            "gpt-4" => self.generate_openai(prompt, model).await,
            "claude-3-haiku" => self.generate_anthropic(prompt, model).await,
            _ => Err(anyhow!("Unknown model type")),
        }
    }
}

impl MultiModelGenerator {
    /// Generate using Ollama API
    async fn generate_ollama(&self, prompt: &str, model: &GeneratorModel) -> Result<String> {
        #[derive(Deserialize)]
        struct OllamaResponse {
            response: String,
        }
        
        let response = self.client
            .post(&format!("{}/api/generate", model.endpoint))
            .json(&json!({
                "model": "llama3.2:3b", // Or any model available in Ollama
                "prompt": prompt,
                "stream": false,
                "options": {
                    "temperature": 0.3,
                    "max_tokens": 1024,
                }
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Ollama API error: {}", response.status()));
        }
        
        let result: OllamaResponse = response.json().await?;
        Ok(result.response)
    }
    
    /// Generate using OpenAI API
    async fn generate_openai(&self, prompt: &str, model: &GeneratorModel) -> Result<String> {
        let api_key = if let Some(key_env) = &model.api_key_env {
            std::env::var(key_env)?
        } else {
            return Err(anyhow!("OpenAI API key not configured"));
        };
        
        #[derive(Deserialize)]
        struct OpenAIResponse {
            choices: Vec<OpenAIChoice>,
        }
        
        #[derive(Deserialize)]
        struct OpenAIChoice {
            message: OpenAIMessage,
        }
        
        #[derive(Deserialize)]
        struct OpenAIMessage {
            content: String,
        }
        
        let response = self.client
            .post(&format!("{}/chat/completions", model.endpoint))
            .header("Authorization", format!("Bearer {}", api_key))
            .json(&json!({
                "model": "gpt-4-turbo-preview",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 1024,
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("OpenAI API error: {}", response.status()));
        }
        
        let result: OpenAIResponse = response.json().await?;
        Ok(result.choices.first()
            .ok_or_else(|| anyhow!("No response from OpenAI"))?
            .message.content.clone())
    }
    
    /// Generate using Anthropic API
    async fn generate_anthropic(&self, prompt: &str, model: &GeneratorModel) -> Result<String> {
        let api_key = if let Some(key_env) = &model.api_key_env {
            std::env::var(key_env)?
        } else {
            return Err(anyhow!("Anthropic API key not configured"));
        };
        
        #[derive(Deserialize)]
        struct AnthropicResponse {
            content: Vec<AnthropicContent>,
        }
        
        #[derive(Deserialize)]
        struct AnthropicContent {
            text: String,
        }
        
        let response = self.client
            .post(&format!("{}/messages", model.endpoint))
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&json!({
                "model": "claude-3-haiku-20240307",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 1024,
                "temperature": 0.3,
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Anthropic API error: {}", response.status()));
        }
        
        let result: AnthropicResponse = response.json().await?;
        Ok(result.content.first()
            .ok_or_else(|| anyhow!("No response from Anthropic"))?
            .text.clone())
    }
}

/// Local generator using LM Studio or similar
pub struct LocalGenerator {
    endpoint: String,
    model_name: String,
    client: reqwest::Client,
}

impl LocalGenerator {
    pub fn new(endpoint: String, model_name: String) -> Self {
        Self {
            endpoint,
            model_name,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl GeneratorClient for LocalGenerator {
    async fn generate_answer(&self, question: &str, documents: &[Document]) -> Result<GeneratorResult> {
        let prompt = format!(
            "Question: {}\n\nDocuments:\n{}\n\nAnswer:",
            question,
            documents.iter()
                .map(|d| &d.content)
                .collect::<Vec<_>>()
                .join("\n\n")
        );
        
        let start = Instant::now();
        
        let response = self.client
            .post(&format!("{}/v1/completions", self.endpoint))
            .json(&json!({
                "model": self.model_name,
                "prompt": prompt,
                "max_tokens": 1024,
                "temperature": 0.3,
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Local generator error: {}", response.status()));
        }
        
        #[derive(Deserialize)]
        struct LocalResponse {
            choices: Vec<LocalChoice>,
        }
        
        #[derive(Deserialize)]
        struct LocalChoice {
            text: String,
        }
        
        let result: LocalResponse = response.json().await?;
        let answer = result.choices.first()
            .ok_or_else(|| anyhow!("No response from local generator"))?
            .text.clone();
        
        Ok(GeneratorResult {
            answer,
            confidence: 0.7,
            model_used: self.model_name.clone(),
            tokens_used: 0,
            latency_ms: start.elapsed().as_millis() as u64,
        })
    }
    
    async fn evaluate(&self, prompt: &str) -> Result<String> {
        let response = self.client
            .post(&format!("{}/v1/completions", self.endpoint))
            .json(&json!({
                "model": self.model_name,
                "prompt": prompt,
                "max_tokens": 256,
                "temperature": 0.1,
            }))
            .send()
            .await?;
        
        if !response.status().is_success() {
            return Err(anyhow!("Local generator error"));
        }
        
        #[derive(Deserialize)]
        struct LocalResponse {
            choices: Vec<LocalChoice>,
        }
        
        #[derive(Deserialize)]
        struct LocalChoice {
            text: String,
        }
        
        let result: LocalResponse = response.json().await?;
        Ok(result.choices.first()
            .ok_or_else(|| anyhow!("No response"))?
            .text.clone())
    }
}

/// Mock generator for testing
pub struct MockGenerator {
    response: String,
}

impl MockGenerator {
    pub fn new(response: String) -> Self {
        Self { response }
    }
}

#[async_trait]
impl GeneratorClient for MockGenerator {
    async fn generate_answer(&self, _question: &str, _documents: &[Document]) -> Result<GeneratorResult> {
        Ok(GeneratorResult {
            answer: self.response.clone(),
            confidence: 0.8,
            model_used: "mock".to_string(),
            tokens_used: 100,
            latency_ms: 10,
        })
    }
    
    async fn evaluate(&self, _prompt: &str) -> Result<String> {
        Ok(json!({
            "score": 0.8,
            "reasoning": "Mock evaluation"
        }).to_string())
    }
}
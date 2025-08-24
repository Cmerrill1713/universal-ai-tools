//! Embedding generation service for vector search
//! Supports multiple embedding models and caching

use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::RwLock;
use reqwest::Client;

/// Embedding service for generating vector representations
pub struct EmbeddingService {
    client: Client,
    model: String,
    api_key: Option<String>,
    cache: RwLock<HashMap<String, Vec<f32>>>,
    dimension: usize,
}

impl EmbeddingService {
    /// Create a new embedding service
    pub async fn new(model: &str, api_key: Option<String>) -> Result<Self> {
        let dimension = match model {
            "text-embedding-ada-002" => 1536,
            "text-embedding-3-small" => 1536,
            "text-embedding-3-large" => 3072,
            "all-MiniLM-L6-v2" => 384,
            _ => 768, // Default dimension
        };

        Ok(Self {
            client: Client::new(),
            model: model.to_string(),
            api_key,
            cache: RwLock::new(HashMap::new()),
            dimension,
        })
    }

    /// Generate embeddings for text
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        // Check cache first
        {
            let cache = self.cache.read().await;
            if let Some(embedding) = cache.get(text) {
                return Ok(embedding.clone());
            }
        }

        // Generate new embedding
        let embedding = if self.model.starts_with("text-embedding") {
            self.generate_openai_embedding(text).await?
        } else {
            self.generate_local_embedding(text).await?
        };

        // Cache the result
        {
            let mut cache = self.cache.write().await;
            cache.insert(text.to_string(), embedding.clone());
        }

        Ok(embedding)
    }

    /// Generate embeddings using OpenAI API
    async fn generate_openai_embedding(&self, text: &str) -> Result<Vec<f32>> {
        #[derive(Serialize)]
        struct OpenAIRequest {
            model: String,
            input: String,
        }

        #[derive(Deserialize)]
        struct OpenAIResponse {
            data: Vec<EmbeddingData>,
        }

        #[derive(Deserialize)]
        struct EmbeddingData {
            embedding: Vec<f32>,
        }

        let request = OpenAIRequest {
            model: self.model.clone(),
            input: text.to_string(),
        };

        let response = self.client
            .post("https://api.openai.com/v1/embeddings")
            .header("Authorization", format!("Bearer {}", self.api_key.as_ref().unwrap_or(&String::new())))
            .json(&request)
            .send()
            .await
            .context("Failed to call OpenAI API")?;

        let data: OpenAIResponse = response.json().await
            .context("Failed to parse OpenAI response")?;

        data.data.first()
            .map(|d| d.embedding.clone())
            .ok_or_else(|| anyhow::anyhow!("No embedding returned"))
    }

    /// Generate embeddings using local model (Ollama)
    async fn generate_local_embedding(&self, text: &str) -> Result<Vec<f32>> {
        #[derive(Serialize)]
        struct OllamaRequest {
            model: String,
            prompt: String,
        }

        #[derive(Deserialize)]
        struct OllamaResponse {
            embedding: Vec<f32>,
        }

        let request = OllamaRequest {
            model: self.model.clone(),
            prompt: text.to_string(),
        };

        let response = self.client
            .post("http://localhost:11434/api/embeddings")
            .json(&request)
            .send()
            .await
            .context("Failed to call Ollama API")?;

        let data: OllamaResponse = response.json().await
            .context("Failed to parse Ollama response")?;

        Ok(data.embedding)
    }

    /// Get embedding dimension for the current model
    pub fn dimension(&self) -> usize {
        self.dimension
    }

    /// Batch embed multiple texts
    pub async fn batch_embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        let mut embeddings = Vec::new();
        
        for text in texts {
            embeddings.push(self.embed(text).await?);
        }
        
        Ok(embeddings)
    }
}
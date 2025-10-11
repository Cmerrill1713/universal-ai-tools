use actix_web::{web, App, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use dashmap::DashMap;

/// ML inference request structure
#[derive(Deserialize, Debug)]
pub struct InferenceRequest {
    pub model_id: String,
    pub input: serde_json::Value,
    pub parameters: Option<serde_json::Value>,
    pub request_id: Option<String>,
    pub task_type: Option<String>, // "text_generation", "embedding", "classification", etc.
}

/// ML inference response structure
#[derive(Serialize, Debug)]
pub struct InferenceResponse {
    pub success: bool,
    pub result: serde_json::Value,
    pub processing_time_ms: u64,
    pub request_id: String,
    pub model_id: String,
    pub task_type: String,
    pub error: Option<String>,
    pub metadata: serde_json::Value,
}

/// Model information structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub task_type: String,
    pub description: String,
    pub parameters: u64,
    pub memory_usage_mb: u64,
    pub loaded: bool,
    pub load_time: Option<chrono::DateTime<chrono::Utc>>,
}

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: String,
    pub service: String,
    pub framework: String,
    pub version: String,
    pub memory_usage_mb: u64,
    pub uptime_seconds: u64,
    pub loaded_models: usize,
}

/// ML inference service state
pub struct MLInferenceService {
    pub start_time: std::time::Instant,
    pub request_count: Arc<RwLock<u64>>,
    pub loaded_models: Arc<DashMap<String, ModelInfo>>,
    pub inference_cache: Arc<DashMap<String, serde_json::Value>>,
}

impl MLInferenceService {
    pub fn new() -> Self {
        let mut service = Self {
            start_time: std::time::Instant::now(),
            request_count: Arc::new(RwLock::new(0)),
            loaded_models: Arc::new(DashMap::new()),
            inference_cache: Arc::new(DashMap::new()),
        };

        // Load default models
        service.initialize_default_models();
        service
    }

    /// Initialize default models for common tasks
    fn initialize_default_models(&mut self) {
        let default_models = vec![
            ModelInfo {
                id: "llama3.2:3b".to_string(),
                name: "Llama 3.2 3B".to_string(),
                task_type: "text_generation".to_string(),
                description: "Small language model for text generation".to_string(),
                parameters: 3_000_000_000,
                memory_usage_mb: 2048,
                loaded: false,
                load_time: None,
            },
            ModelInfo {
                id: "llama3.1:8b".to_string(),
                name: "Llama 3.1 8B".to_string(),
                task_type: "text_generation".to_string(),
                description: "Large language model for advanced text generation".to_string(),
                parameters: 8_000_000_000,
                memory_usage_mb: 4096,
                loaded: false,
                load_time: None,
            },
            ModelInfo {
                id: "gpt-oss:20b".to_string(),
                name: "GPT-OSS 20B".to_string(),
                task_type: "text_generation".to_string(),
                description: "Open source GPT model for text generation".to_string(),
                parameters: 20_000_000_000,
                memory_usage_mb: 8192,
                loaded: false,
                load_time: None,
            },
            ModelInfo {
                id: "nomic-embed-text:latest".to_string(),
                name: "Nomic Embed Text".to_string(),
                task_type: "embedding".to_string(),
                description: "Fast, efficient embeddings (768 dimensions)".to_string(),
                parameters: 274_000_000,
                memory_usage_mb: 256,
                loaded: false,
                load_time: None,
            },
            ModelInfo {
                id: "snowflake-arctic-embed2:latest".to_string(),
                name: "Snowflake Arctic Embed2".to_string(),
                task_type: "embedding".to_string(),
                description: "High-quality embeddings (1024 dimensions)".to_string(),
                parameters: 1_100_000_000,
                memory_usage_mb: 1024,
                loaded: false,
                load_time: None,
            },
            ModelInfo {
                id: "mxbai-embed-large:latest".to_string(),
                name: "MXBAI Embed Large".to_string(),
                task_type: "embedding".to_string(),
                description: "Large embedding model (1024 dimensions)".to_string(),
                parameters: 669_000_000,
                memory_usage_mb: 512,
                loaded: false,
                load_time: None,
            },
            ModelInfo {
                id: "distilbert-base-uncased".to_string(),
                name: "DistilBERT Base".to_string(),
                task_type: "classification".to_string(),
                description: "Text classification model".to_string(),
                parameters: 66_900_000,
                memory_usage_mb: 512,
                loaded: false,
                load_time: None,
            },
        ];

        for model in default_models {
            self.loaded_models.insert(model.id.clone(), model);
        }
    }

    /// Perform ML inference
    pub async fn infer(&self, request: InferenceRequest) -> Result<InferenceResponse, anyhow::Error> {
        let start_time = std::time::Instant::now();
        let request_id = request.request_id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
        let task_type = request.task_type.clone().unwrap_or_else(|| self.infer_task_type(&request.model_id));

        // Increment request counter
        {
            let mut count = self.request_count.write().await;
            *count += 1;
        }

        // Check if model is available
        let model_info = self.loaded_models.get(&request.model_id)
            .ok_or_else(|| anyhow::anyhow!("Model not found: {}", request.model_id))?;

        // Generate cache key for potential caching
        let cache_key = format!("{}:{}:{}",
            request.model_id,
            serde_json::to_string(&request.input).unwrap_or_default(),
            serde_json::to_string(&request.parameters).unwrap_or_default()
        );

        // Check cache first
        if let Some(cached_result) = self.inference_cache.get(&cache_key) {
            let processing_time = start_time.elapsed().as_millis() as u64;
            return Ok(InferenceResponse {
                success: true,
                result: cached_result.clone(),
                processing_time_ms: processing_time,
                request_id,
                model_id: request.model_id,
                task_type,
                error: None,
                metadata: serde_json::json!({
                    "cached": true,
                    "cache_key": cache_key
                }),
            });
        }

        // Perform actual inference based on task type
        let result = match task_type.as_str() {
            "text_generation" => self.text_generation(&request).await?,
            "embedding" => self.generate_embedding(&request).await?,
            "classification" => self.text_classification(&request).await?,
            "question_answering" => self.question_answering(&request).await?,
            _ => return Err(anyhow::anyhow!("Unsupported task type: {}", task_type)),
        };

        // Cache the result (with TTL in production)
        self.inference_cache.insert(cache_key.clone(), result.clone());

        let processing_time = start_time.elapsed().as_millis() as u64;

        Ok(InferenceResponse {
            success: true,
            result,
            processing_time_ms: processing_time,
            request_id,
            model_id: request.model_id,
            task_type,
            error: None,
            metadata: serde_json::json!({
                "cached": false,
                "model_parameters": model_info.parameters,
                "memory_usage_mb": model_info.memory_usage_mb
            }),
        })
    }

    /// Infer task type from model ID
    fn infer_task_type(&self, model_id: &str) -> String {
        if model_id.contains("llama") || model_id.contains("gpt") {
            "text_generation".to_string()
        } else if model_id.contains("sentence-transformers") || model_id.contains("embed") {
            "embedding".to_string()
        } else if model_id.contains("bert") && !model_id.contains("sentence") {
            "classification".to_string()
        } else {
            "text_generation".to_string() // Default
        }
    }

    /// Text generation implementation using Ollama
    async fn text_generation(&self, request: &InferenceRequest) -> Result<serde_json::Value, anyhow::Error> {
        let prompt = request.input.as_str()
            .ok_or_else(|| anyhow::anyhow!("Input must be a string for text generation"))?;

        let params = request.parameters.as_ref().unwrap_or(&serde_json::Value::Null);
        let max_tokens = params.get("max_tokens").and_then(|v| v.as_u64()).unwrap_or(100);
        let temperature = params.get("temperature").and_then(|v| v.as_f64()).unwrap_or(0.7);

        // Use Ollama for actual text generation
        let ollama_url = std::env::var("OLLAMA_URL").unwrap_or_else(|_| "http://localhost:11434".to_string());
        let client = reqwest::Client::new();

        let ollama_request = serde_json::json!({
            "model": request.model_id,
            "prompt": prompt,
            "stream": false,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        });

        let response = client
            .post(&format!("{}/api/generate", ollama_url))
            .json(&ollama_request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Ollama returned status: {}", response.status()));
        }

        let ollama_response: serde_json::Value = response.json().await?;
        let generated_text = ollama_response.get("response")
            .and_then(|v| v.as_str())
            .unwrap_or("No response from Ollama");

        Ok(serde_json::json!({
            "text": generated_text,
            "prompt": prompt,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "finish_reason": "stop",
            "usage": {
                "prompt_tokens": prompt.split_whitespace().count(),
                "completion_tokens": generated_text.split_whitespace().count(),
                "total_tokens": prompt.split_whitespace().count() + generated_text.split_whitespace().count()
            }
        }))
    }

    /// Embedding generation implementation using local embedding service
    async fn generate_embedding(&self, request: &InferenceRequest) -> Result<serde_json::Value, anyhow::Error> {
        let text = request.input.as_str()
            .ok_or_else(|| anyhow::anyhow!("Input must be a string for embedding generation"))?;

        // Use our local embedding service
        let embedding_url = std::env::var("EMBEDDING_SERVICE_URL").unwrap_or_else(|_| "http://localhost:8092".to_string());
        let client = reqwest::Client::new();

        let embedding_request = serde_json::json!({
            "text": text,
            "model": request.model_id
        });

        let response = client
            .post(&format!("{}/embed", embedding_url))
            .json(&embedding_request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Embedding service returned status: {}", response.status()));
        }

        let embedding_response: serde_json::Value = response.json().await?;
        let embedding = embedding_response.get("embedding")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow::anyhow!("Invalid embedding response"))?;

        Ok(serde_json::json!({
            "embedding": embedding,
            "text": text,
            "model": request.model_id,
            "dimensions": embedding.len(),
            "usage": {
                "prompt_tokens": text.split_whitespace().count(),
                "total_tokens": text.split_whitespace().count()
            }
        }))
    }

    /// Text classification implementation
    async fn text_classification(&self, request: &InferenceRequest) -> Result<serde_json::Value, anyhow::Error> {
        let text = request.input.as_str()
            .ok_or_else(|| anyhow::anyhow!("Input must be a string for text classification"))?;

        // Classification model integration planned for text categorization
        // Currently returns mock results - real classification model integration pending
        let classifications = vec![
            serde_json::json!({"label": "POSITIVE", "score": 0.8}),
            serde_json::json!({"label": "NEGATIVE", "score": 0.2}),
        ];

        Ok(serde_json::json!({
            "classifications": classifications,
            "text": text,
            "model": request.model_id,
            "top_k": classifications.len()
        }))
    }

    /// Question answering implementation
    async fn question_answering(&self, request: &InferenceRequest) -> Result<serde_json::Value, anyhow::Error> {
        let question = request.input.get("question")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Question is required for question answering"))?;

        let context = request.input.get("context")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Context is required for question answering"))?;

        // Question-answering model integration planned for document comprehension
        // Currently returns mock answer - real QA model integration pending
        let answer = format!("Based on the context, the answer to '{}' is found in the provided text.", question);

        Ok(serde_json::json!({
            "answer": answer,
            "question": question,
            "context": context,
            "confidence": 0.85,
            "start": 0,
            "end": answer.len()
        }))
    }

    /// Load a model
    pub async fn load_model(&self, model_id: String) -> Result<(), anyhow::Error> {
        if let Some(mut model) = self.loaded_models.get_mut(&model_id) {
            model.loaded = true;
            model.load_time = Some(chrono::Utc::now());
            Ok(())
        } else {
            Err(anyhow::anyhow!("Model not found: {}", model_id))
        }
    }

    /// Unload a model
    pub async fn unload_model(&self, model_id: &str) -> Result<(), anyhow::Error> {
        if let Some(mut model) = self.loaded_models.get_mut(model_id) {
            model.loaded = false;
            model.load_time = None;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Model not found: {}", model_id))
        }
    }

    /// List available models
    pub async fn list_models(&self) -> Vec<ModelInfo> {
        self.loaded_models.iter().map(|entry| entry.value().clone()).collect()
    }

    /// Get service health information
    pub async fn get_health(&self) -> HealthResponse {
        let uptime = self.start_time.elapsed().as_secs();
        let _request_count = *self.request_count.read().await;
        let loaded_models = self.loaded_models.len();

        // Get memory usage (approximate)
        let memory_usage = get_memory_usage_mb();

        HealthResponse {
            status: "healthy".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            service: "ml-inference".to_string(),
            framework: "Basic SmartCore ML Service".to_string(),
            version: "1.0.0".to_string(),
            memory_usage_mb: memory_usage,
            uptime_seconds: uptime,
            loaded_models,
        }
    }
}

/// Get approximate memory usage in MB
fn get_memory_usage_mb() -> u64 {
    match std::fs::read_to_string("/proc/self/status") {
        Ok(content) => {
            for line in content.lines() {
                if line.starts_with("VmRSS:") {
                    if let Some(kb_str) = line.split_whitespace().nth(1) {
                        if let Ok(kb) = kb_str.parse::<u64>() {
                            return kb / 1024;
                        }
                    }
                }
            }
        }
        Err(_) => return 0,
    }
    0
}

/// HTTP handlers
pub mod handlers {
    use super::*;
    use actix_web::{web, HttpResponse};

    /// Health check endpoint
    pub async fn health_check(
        service: web::Data<MLInferenceService>,
    ) -> Result<HttpResponse, actix_web::Error> {
        let health = service.get_health().await;
        let response = HealthResponse {
            status: "healthy".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            service: "ml-inference-basic".to_string(),
            framework: "Basic SmartCore ML Service".to_string(),
            version: "1.0.0".to_string(),
            memory_usage_mb: health.memory_usage_mb,
            uptime_seconds: health.uptime_seconds,
            loaded_models: health.loaded_models,
        };
        Ok(HttpResponse::Ok().json(response))
    }

    /// Inference endpoint
    pub async fn infer(
        service: web::Data<MLInferenceService>,
        request: web::Json<InferenceRequest>,
    ) -> Result<HttpResponse, actix_web::Error> {
        match service.infer(request.into_inner()).await {
            Ok(response) => Ok(HttpResponse::Ok().json(response)),
            Err(e) => {
                let error_response = InferenceResponse {
                    success: false,
                    result: serde_json::Value::Null,
                    processing_time_ms: 0,
                    request_id: Uuid::new_v4().to_string(),
                    model_id: "unknown".to_string(),
                    task_type: "unknown".to_string(),
                    error: Some(e.to_string()),
                    metadata: serde_json::Value::Null,
                };
                Ok(HttpResponse::InternalServerError().json(error_response))
            }
        }
    }

    /// List models endpoint
    pub async fn list_models(
        service: web::Data<MLInferenceService>,
    ) -> Result<HttpResponse, actix_web::Error> {
        let models = service.list_models().await;
        Ok(HttpResponse::Ok().json(serde_json::json!({
            "models": models,
            "total": models.len(),
            "timestamp": chrono::Utc::now().to_rfc3339()
        })))
    }

    /// Load model endpoint
    pub async fn load_model(
        service: web::Data<MLInferenceService>,
        path: web::Path<String>,
    ) -> Result<HttpResponse, actix_web::Error> {
        let model_id = path.into_inner();

        match service.load_model(model_id.clone()).await {
            Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": format!("Model {} loaded successfully", model_id),
                "model_id": model_id,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }))),
            Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "error": e.to_string(),
                "model_id": model_id
            })))
        }
    }

    /// Unload model endpoint
    pub async fn unload_model(
        service: web::Data<MLInferenceService>,
        path: web::Path<String>,
    ) -> Result<HttpResponse, actix_web::Error> {
        let model_id = path.into_inner();

        match service.unload_model(&model_id).await {
            Ok(_) => Ok(HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "message": format!("Model {} unloaded successfully", model_id),
                "model_id": model_id,
                "timestamp": chrono::Utc::now().to_rfc3339()
            }))),
            Err(e) => Ok(HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "error": e.to_string(),
                "model_id": model_id
            })))
        }
    }

    /// Get service statistics
    pub async fn get_stats(
        service: web::Data<MLInferenceService>,
    ) -> Result<HttpResponse, actix_web::Error> {
        let request_count = *service.request_count.read().await;
        let uptime = service.start_time.elapsed().as_secs();
        let loaded_models = service.loaded_models.len();
        let cache_size = service.inference_cache.len();

        let stats = serde_json::json!({
            "service": "ml-inference",
            "uptime_seconds": uptime,
            "total_requests": request_count,
            "requests_per_second": if uptime > 0 { request_count as f64 / uptime as f64 } else { 0.0 },
            "memory_usage_mb": get_memory_usage_mb(),
            "loaded_models": loaded_models,
            "cache_size": cache_size,
            "timestamp": chrono::Utc::now().to_rfc3339()
        });

        Ok(HttpResponse::Ok().json(stats))
    }
}


/// Application configuration
pub fn create_app(service: web::Data<MLInferenceService>) -> App<impl actix_web::dev::ServiceFactory<
    actix_web::dev::ServiceRequest,
    Config = (),
    Response = actix_web::dev::ServiceResponse,
    Error = actix_web::Error,
    InitError = (),
>> {
    App::new()
        .app_data(service)
        .route("/health", web::get().to(handlers::health_check))
        .route("/infer", web::post().to(handlers::infer))
        .route("/models", web::get().to(handlers::list_models))
        .route("/models/{model_id}/load", web::post().to(handlers::load_model))
        .route("/models/{model_id}/unload", web::post().to(handlers::unload_model))
        .route("/stats", web::get().to(handlers::get_stats))
}

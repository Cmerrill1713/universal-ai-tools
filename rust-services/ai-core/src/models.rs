//! Model Management - AI model lifecycle and metadata

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tracing::{info, warn, instrument};

use crate::config::Config;

/// Model information and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub context_length: u32,
    pub pricing: ModelPricing,
    pub capabilities: Vec<String>,
    pub size_mb: Option<u64>,
    pub architecture: Option<String>,
    pub created_at: SystemTime,
}

/// Model pricing information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    pub input_cost_per_1k: f64,
    pub output_cost_per_1k: f64,
}

/// Model performance metrics
#[derive(Debug, Clone, Serialize)]
pub struct ModelMetrics {
    pub model_id: String,
    pub total_requests: u64,
    pub total_tokens: u64,
    pub average_latency_ms: f64,
    pub error_rate: f64,
    pub cache_hit_rate: f64,
    pub last_used: SystemTime,
    pub load_time_ms: Option<u64>,
    pub memory_usage_mb: Option<f64>,
}

/// Model loading status
#[derive(Debug, Clone, PartialEq)]
pub enum ModelStatus {
    Available,
    Loading,
    Loaded,
    Unloading,
    Error(String),
}

/// Loaded model instance
#[derive(Debug)]
struct LoadedModel {
    info: ModelInfo,
    status: ModelStatus,
    loaded_at: Instant,
    last_used: Instant,
    usage_count: u64,
    memory_usage_mb: f64,
}

/// Model manager for lifecycle and metadata
pub struct ModelManager {
    config: Arc<Config>,
    available_models: Arc<RwLock<HashMap<String, ModelInfo>>>,
    loaded_models: Arc<RwLock<HashMap<String, LoadedModel>>>,
    model_metrics: Arc<RwLock<HashMap<String, ModelMetrics>>>,
}

impl ModelManager {
    /// Create new model manager
    pub async fn new(config: Arc<Config>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let manager = Self {
            config,
            available_models: Arc::new(RwLock::new(HashMap::new())),
            loaded_models: Arc::new(RwLock::new(HashMap::new())),
            model_metrics: Arc::new(RwLock::new(HashMap::new())),
        };

        // Initialize with default models
        manager.initialize_default_models().await?;

        // Start background tasks
        manager.start_background_tasks();

        Ok(manager)
    }

    /// Initialize default model catalog
    async fn initialize_default_models(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut models = self.available_models.write().await;

        // OpenAI Models
        models.insert("gpt-4o".to_string(), ModelInfo {
            id: "gpt-4o".to_string(),
            name: "GPT-4 Omni".to_string(),
            provider: "openai".to_string(),
            context_length: 128000,
            pricing: ModelPricing { input_cost_per_1k: 5.0, output_cost_per_1k: 15.0 },
            capabilities: vec!["text".to_string(), "vision".to_string(), "audio".to_string()],
            size_mb: None,
            architecture: Some("transformer".to_string()),
            created_at: SystemTime::now(),
        });

        models.insert("gpt-4-turbo".to_string(), ModelInfo {
            id: "gpt-4-turbo".to_string(),
            name: "GPT-4 Turbo".to_string(),
            provider: "openai".to_string(),
            context_length: 128000,
            pricing: ModelPricing { input_cost_per_1k: 10.0, output_cost_per_1k: 30.0 },
            capabilities: vec!["text".to_string(), "vision".to_string()],
            size_mb: None,
            architecture: Some("transformer".to_string()),
            created_at: SystemTime::now(),
        });

        models.insert("gpt-3.5-turbo".to_string(), ModelInfo {
            id: "gpt-3.5-turbo".to_string(),
            name: "GPT-3.5 Turbo".to_string(),
            provider: "openai".to_string(),
            context_length: 16385,
            pricing: ModelPricing { input_cost_per_1k: 0.5, output_cost_per_1k: 1.5 },
            capabilities: vec!["text".to_string()],
            size_mb: None,
            architecture: Some("transformer".to_string()),
            created_at: SystemTime::now(),
        });

        // Anthropic Models
        models.insert("claude-3-5-sonnet-20241022".to_string(), ModelInfo {
            id: "claude-3-5-sonnet-20241022".to_string(),
            name: "Claude 3.5 Sonnet".to_string(),
            provider: "anthropic".to_string(),
            context_length: 200000,
            pricing: ModelPricing { input_cost_per_1k: 3.0, output_cost_per_1k: 15.0 },
            capabilities: vec!["text".to_string(), "vision".to_string(), "reasoning".to_string()],
            size_mb: None,
            architecture: Some("constitutional_ai".to_string()),
            created_at: SystemTime::now(),
        });

        models.insert("claude-3-haiku-20240307".to_string(), ModelInfo {
            id: "claude-3-haiku-20240307".to_string(),
            name: "Claude 3 Haiku".to_string(),
            provider: "anthropic".to_string(),
            context_length: 200000,
            pricing: ModelPricing { input_cost_per_1k: 0.25, output_cost_per_1k: 1.25 },
            capabilities: vec!["text".to_string()],
            size_mb: None,
            architecture: Some("constitutional_ai".to_string()),
            created_at: SystemTime::now(),
        });

        // Ollama Local Models
        models.insert("llama3.2:3b".to_string(), ModelInfo {
            id: "llama3.2:3b".to_string(),
            name: "Llama 3.2 3B".to_string(),
            provider: "ollama".to_string(),
            context_length: 8192,
            pricing: ModelPricing { input_cost_per_1k: 0.0, output_cost_per_1k: 0.0 },
            capabilities: vec!["text".to_string(), "local".to_string()],
            size_mb: Some(2048),
            architecture: Some("llama".to_string()),
            created_at: SystemTime::now(),
        });

        models.insert("mistral:7b".to_string(), ModelInfo {
            id: "mistral:7b".to_string(),
            name: "Mistral 7B".to_string(),
            provider: "ollama".to_string(),
            context_length: 32768,
            pricing: ModelPricing { input_cost_per_1k: 0.0, output_cost_per_1k: 0.0 },
            capabilities: vec!["text".to_string(), "local".to_string(), "multilingual".to_string()],
            size_mb: Some(4096),
            architecture: Some("mistral".to_string()),
            created_at: SystemTime::now(),
        });

        info!(model_count = models.len(), "Initialized default model catalog");
        Ok(())
    }

    /// Check if model is available
    #[instrument(skip(self), fields(model_id = %model_id))]
    pub async fn is_model_available(&self, model_id: &str) -> bool {
        let models = self.available_models.read().await;
        models.contains_key(model_id)
    }

    /// Get model information
    pub async fn get_model_info(&self, model_id: &str) -> Option<ModelInfo> {
        let models = self.available_models.read().await;
        models.get(model_id).cloned()
    }

    /// Get all available models
    pub async fn get_available_models(&self) -> Vec<ModelInfo> {
        let models = self.available_models.read().await;
        models.values().cloned().collect()
    }

    /// Get models by provider
    pub async fn get_models_by_provider(&self, provider: &str) -> Vec<ModelInfo> {
        let models = self.available_models.read().await;
        models.values()
            .filter(|model| model.provider == provider)
            .cloned()
            .collect()
    }

    /// Get models by capability
    pub async fn get_models_by_capability(&self, capability: &str) -> Vec<ModelInfo> {
        let models = self.available_models.read().await;
        models.values()
            .filter(|model| model.capabilities.contains(&capability.to_string()))
            .cloned()
            .collect()
    }

    /// Load a model (for local models)
    #[instrument(skip(self), fields(model_id = %model_id))]
    pub async fn load_model(&self, model_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let model_info = {
            let models = self.available_models.read().await;
            models.get(model_id).cloned()
                .ok_or_else(|| format!("Model {} not found", model_id))?
        };

        // Check if already loaded
        {
            let loaded = self.loaded_models.read().await;
            if loaded.contains_key(model_id) {
                info!(model_id = %model_id, "Model already loaded");
                return Ok(());
            }
        }

        info!(model_id = %model_id, provider = %model_info.provider, "Loading model");

        // Check memory limits before loading
        if self.config.models.auto_load {
            if let Err(e) = self.check_memory_constraints(&model_info).await {
                warn!(model_id = %model_id, error = %e, "Memory constraint check failed");
                return Err(e);
            }
        }

        let start_time = Instant::now();

        // Create loaded model entry
        let loaded_model = LoadedModel {
            info: model_info.clone(),
            status: ModelStatus::Loading,
            loaded_at: start_time,
            last_used: start_time,
            usage_count: 0,
            memory_usage_mb: model_info.size_mb.unwrap_or(1024) as f64,
        };

        // Add to loaded models
        {
            let mut loaded = self.loaded_models.write().await;
            loaded.insert(model_id.to_string(), loaded_model);
        }

        // Simulate loading process (in real implementation, this would load the model)
        tokio::time::sleep(Duration::from_millis(500)).await;

        // Update status to loaded
        {
            let mut loaded = self.loaded_models.write().await;
            if let Some(model) = loaded.get_mut(model_id) {
                model.status = ModelStatus::Loaded;
            }
        }

        let load_time = start_time.elapsed().as_millis() as u64;
        info!(
            model_id = %model_id,
            load_time_ms = load_time,
            "Model loaded successfully"
        );

        Ok(())
    }

    /// Unload a model
    #[instrument(skip(self), fields(model_id = %model_id))]
    pub async fn unload_model(&self, model_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut loaded = self.loaded_models.write().await;
        
        if let Some(mut model) = loaded.remove(model_id) {
            model.status = ModelStatus::Unloading;
            info!(
                model_id = %model_id,
                usage_count = model.usage_count,
                "Model unloaded"
            );
        }

        Ok(())
    }

    /// Record model usage
    pub async fn record_usage(&self, model_id: &str, tokens_used: u32, latency_ms: u64, success: bool) {
        // Update loaded model usage
        {
            let mut loaded = self.loaded_models.write().await;
            if let Some(model) = loaded.get_mut(model_id) {
                model.last_used = Instant::now();
                model.usage_count += 1;
            }
        }

        // Update metrics
        {
            let mut metrics = self.model_metrics.write().await;
            let metric = metrics.entry(model_id.to_string()).or_insert_with(|| ModelMetrics {
                model_id: model_id.to_string(),
                total_requests: 0,
                total_tokens: 0,
                average_latency_ms: 0.0,
                error_rate: 0.0,
                cache_hit_rate: 0.0,
                last_used: SystemTime::now(),
                load_time_ms: None,
                memory_usage_mb: None,
            });

            metric.total_requests += 1;
            metric.total_tokens += tokens_used as u64;
            metric.last_used = SystemTime::now();

            // Update rolling average latency
            let total_latency = metric.average_latency_ms * (metric.total_requests - 1) as f64 + latency_ms as f64;
            metric.average_latency_ms = total_latency / metric.total_requests as f64;

            // Update error rate
            if !success {
                let total_errors = metric.error_rate * (metric.total_requests - 1) as f64 + 1.0;
                metric.error_rate = total_errors / metric.total_requests as f64;
            }
        }
    }

    /// Get model metrics
    pub async fn get_model_metrics(&self, model_id: &str) -> Option<ModelMetrics> {
        let metrics = self.model_metrics.read().await;
        metrics.get(model_id).cloned()
    }

    /// Get all model metrics
    pub async fn get_all_metrics(&self) -> Vec<ModelMetrics> {
        let metrics = self.model_metrics.read().await;
        metrics.values().cloned().collect()
    }

    /// Get loaded models count
    pub async fn get_loaded_models_count(&self) -> usize {
        let loaded = self.loaded_models.read().await;
        loaded.len()
    }

    /// Check memory constraints before loading
    async fn check_memory_constraints(&self, model_info: &ModelInfo) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let loaded = self.loaded_models.read().await;
        
        // Check max loaded models
        if loaded.len() >= self.config.models.max_loaded_models {
            return Err("Maximum number of loaded models reached".into());
        }

        // Check memory usage
        if let Some(model_size) = model_info.size_mb {
            let current_memory: u64 = loaded.values()
                .map(|m| m.memory_usage_mb as u64)
                .sum();
            
            if current_memory + model_size > self.config.models.model_cache_size_mb {
                return Err("Model cache size limit exceeded".into());
            }
        }

        Ok(())
    }

    /// Start background maintenance tasks
    fn start_background_tasks(&self) {
        let loaded_models = self.loaded_models.clone();
        let config = self.config.clone();

        // Automatic model unloading task
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            
            loop {
                interval.tick().await;
                
                let mut to_unload = Vec::new();
                {
                    let loaded = loaded_models.read().await;
                    let now = Instant::now();
                    
                    for (model_id, model) in loaded.iter() {
                        let idle_time = now.duration_since(model.last_used);
                        if idle_time > Duration::from_secs(config.models.offload_unused_after_seconds) {
                            to_unload.push(model_id.clone());
                        }
                    }
                }

                // Unload idle models
                if !to_unload.is_empty() {
                    let mut loaded = loaded_models.write().await;
                    for model_id in to_unload {
                        if let Some(_model) = loaded.remove(&model_id) {
                            info!(
                                model_id = %model_id,
                                idle_time_s = config.models.offload_unused_after_seconds,
                                "Auto-unloaded idle model"
                            );
                        }
                    }
                }
            }
        });
    }
}
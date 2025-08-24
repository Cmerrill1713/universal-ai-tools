use crate::{config::Config, InferenceRequest, InferenceResponse, InferenceOutput, InferenceMetadata};
use anyhow::Result;
use dashmap::DashMap;
use std::{collections::HashMap, sync::Arc, time::Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub struct InferenceEngine {
    config: Config,
    loaded_models: Arc<DashMap<String, LoadedModel>>,
    inference_history: Arc<RwLock<Vec<InferenceResponse>>>,
    active_inferences: Arc<DashMap<String, ActiveInference>>,
}

struct LoadedModel {
    model_id: String,
    model_path: String,
    framework: String,
    last_used: std::time::Instant,
    inference_count: u64,
}

struct ActiveInference {
    id: String,
    model_id: String,
    started_at: Instant,
    request: InferenceRequest,
}

impl InferenceEngine {
    pub async fn new(config: &Config) -> Result<Self> {
        Ok(Self {
            config: config.clone(),
            loaded_models: Arc::new(DashMap::new()),
            inference_history: Arc::new(RwLock::new(Vec::new())),
            active_inferences: Arc::new(DashMap::new()),
        })
    }

    pub async fn run_inference(&self, request: InferenceRequest) -> Result<InferenceResponse> {
        let inference_id = Uuid::new_v4().to_string();
        let start_time = Instant::now();
        
        info!("Starting inference {} for model {}", inference_id, request.model_id);

        // Track active inference
        let active_inference = ActiveInference {
            id: inference_id.clone(),
            model_id: request.model_id.clone(),
            started_at: start_time,
            request: request.clone(),
        };
        self.active_inferences.insert(inference_id.clone(), active_inference);

        // Check if we've exceeded concurrent inference limit
        if self.active_inferences.len() > self.config.ml.max_concurrent_inferences {
            self.active_inferences.remove(&inference_id);
            return Err(anyhow::anyhow!("Too many concurrent inferences"));
        }

        let result = self.perform_inference(&request).await;
        
        // Clean up active inference
        self.active_inferences.remove(&inference_id);
        
        let processing_time = start_time.elapsed();
        
        let response = match result {
            Ok(output) => {
                info!("Inference {} completed in {:?}", inference_id, processing_time);
                
                InferenceResponse {
                    id: inference_id,
                    model_id: request.model_id.clone(),
                    output,
                    metadata: InferenceMetadata {
                        processing_time_ms: processing_time.as_millis() as u64,
                        tokens_used: None, // Could be calculated based on model type
                        cost_estimate: None, // Could be calculated based on usage
                        confidence_score: None, // Model-specific
                    },
                    created_at: chrono::Utc::now(),
                }
            }
            Err(e) => {
                error!("Inference {} failed: {}", inference_id, e);
                return Err(e);
            }
        };

        // Store in history
        let mut history = self.inference_history.write().await;
        history.push(response.clone());
        
        // Keep only recent history to prevent memory issues
        if history.len() > 1000 {
            history.truncate(500);
        }

        Ok(response)
    }

    async fn perform_inference(&self, request: &InferenceRequest) -> Result<InferenceOutput> {
        // Load model if not already loaded
        self.ensure_model_loaded(&request.model_id).await?;
        
        // Update model usage
        if let Some(mut model) = self.loaded_models.get_mut(&request.model_id) {
            model.last_used = Instant::now();
            model.inference_count += 1;
        }

        // Perform inference based on model type and framework
        match self.get_model_framework(&request.model_id).await?.as_str() {
            "huggingface" => self.run_huggingface_inference(request).await,
            "candle" => self.run_candle_inference(request).await,
            "mlx" => self.run_mlx_inference(request).await,
            "pytorch" => self.run_pytorch_inference(request).await,
            "onnx" => self.run_onnx_inference(request).await,
            framework => {
                warn!("Unsupported framework: {}", framework);
                self.run_mock_inference(request).await
            }
        }
    }

    async fn ensure_model_loaded(&self, model_id: &str) -> Result<()> {
        if self.loaded_models.contains_key(model_id) {
            return Ok(());
        }

        info!("Loading model: {}", model_id);
        
        let model_path = self.config.get_model_path(model_id);
        if !model_path.exists() {
            return Err(anyhow::anyhow!("Model {} not found", model_id));
        }

        // For now, we'll create a simple loaded model entry
        // In a real implementation, this would load the actual model into memory
        let loaded_model = LoadedModel {
            model_id: model_id.to_string(),
            model_path: model_path.to_string_lossy().to_string(),
            framework: "huggingface".to_string(), // Would be determined from model metadata
            last_used: Instant::now(),
            inference_count: 0,
        };

        self.loaded_models.insert(model_id.to_string(), loaded_model);
        info!("Model {} loaded successfully", model_id);
        
        Ok(())
    }

    async fn get_model_framework(&self, model_id: &str) -> Result<String> {
        if let Some(model) = self.loaded_models.get(model_id) {
            Ok(model.framework.clone())
        } else {
            Ok("huggingface".to_string()) // Default
        }
    }

    async fn run_huggingface_inference(&self, request: &InferenceRequest) -> Result<InferenceOutput> {
        debug!("Running HuggingFace inference for model {}", request.model_id);
        
        // Mock HuggingFace inference
        if let Some(text) = &request.input.text {
            Ok(InferenceOutput {
                text: Some(format!("HF Response to: {}", text)),
                embeddings: None,
                classification: None,
                data: None,
            })
        } else {
            Ok(InferenceOutput {
                text: Some("HuggingFace model response".to_string()),
                embeddings: None,
                classification: None,
                data: None,
            })
        }
    }

    async fn run_candle_inference(&self, request: &InferenceRequest) -> Result<InferenceOutput> {
        debug!("Running Candle inference for model {}", request.model_id);
        
        // Mock Candle inference using Rust-native ML
        if let Some(text) = &request.input.text {
            Ok(InferenceOutput {
                text: Some(format!("Candle Response: {}", text)),
                embeddings: Some(vec![0.1, 0.2, 0.3, 0.4, 0.5]), // Mock embeddings
                classification: None,
                data: None,
            })
        } else {
            Ok(InferenceOutput {
                text: Some("Candle model response".to_string()),
                embeddings: None,
                classification: None,
                data: None,
            })
        }
    }

    async fn run_mlx_inference(&self, request: &InferenceRequest) -> Result<InferenceOutput> {
        debug!("Running MLX inference for model {}", request.model_id);
        
        if !cfg!(target_os = "macos") {
            return Err(anyhow::anyhow!("MLX is only supported on macOS"));
        }

        // Mock MLX inference for Apple Silicon
        if let Some(text) = &request.input.text {
            Ok(InferenceOutput {
                text: Some(format!("MLX (Apple Silicon) Response: {}", text)),
                embeddings: None,
                classification: None,
                data: Some(serde_json::json!({
                    "device": "mps",
                    "optimization": "apple_silicon"
                })),
            })
        } else {
            Ok(InferenceOutput {
                text: Some("MLX model response".to_string()),
                embeddings: None,
                classification: None,
                data: None,
            })
        }
    }

    async fn run_pytorch_inference(&self, request: &InferenceRequest) -> Result<InferenceOutput> {
        debug!("Running PyTorch inference for model {}", request.model_id);
        
        // Mock PyTorch inference
        if let Some(text) = &request.input.text {
            Ok(InferenceOutput {
                text: Some(format!("PyTorch Response: {}", text)),
                embeddings: None,
                classification: Some({
                    let mut classification = HashMap::new();
                    classification.insert("positive".to_string(), 0.7);
                    classification.insert("negative".to_string(), 0.3);
                    classification
                }),
                data: None,
            })
        } else {
            Ok(InferenceOutput {
                text: Some("PyTorch model response".to_string()),
                embeddings: None,
                classification: None,
                data: None,
            })
        }
    }

    async fn run_onnx_inference(&self, request: &InferenceRequest) -> Result<InferenceOutput> {
        debug!("Running ONNX inference for model {}", request.model_id);
        
        // Mock ONNX inference
        if let Some(text) = &request.input.text {
            Ok(InferenceOutput {
                text: Some(format!("ONNX Response: {}", text)),
                embeddings: None,
                classification: None,
                data: Some(serde_json::json!({
                    "runtime": "onnx",
                    "optimization_level": "all"
                })),
            })
        } else {
            Ok(InferenceOutput {
                text: Some("ONNX model response".to_string()),
                embeddings: None,
                classification: None,
                data: None,
            })
        }
    }

    async fn run_mock_inference(&self, request: &InferenceRequest) -> Result<InferenceOutput> {
        debug!("Running mock inference for model {}", request.model_id);
        
        // Simulate processing time
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        
        if let Some(text) = &request.input.text {
            Ok(InferenceOutput {
                text: Some(format!("Mock response to: {}", text)),
                embeddings: Some(vec![0.1, 0.2, 0.3, 0.4, 0.5]),
                classification: Some({
                    let mut classification = HashMap::new();
                    classification.insert("mock_class_a".to_string(), 0.6);
                    classification.insert("mock_class_b".to_string(), 0.4);
                    classification
                }),
                data: Some(serde_json::json!({
                    "framework": "mock",
                    "processing_mode": "development"
                })),
            })
        } else {
            Ok(InferenceOutput {
                text: Some("Mock model response".to_string()),
                embeddings: None,
                classification: None,
                data: None,
            })
        }
    }

    pub async fn get_history(&self, limit: usize, offset: usize) -> Result<Vec<InferenceResponse>> {
        let history = self.inference_history.read().await;
        let start = offset.min(history.len());
        let end = (offset + limit).min(history.len());
        
        Ok(history[start..end].to_vec())
    }

    pub async fn get_active_inferences(&self) -> Vec<String> {
        self.active_inferences.iter()
            .map(|entry| entry.key().clone())
            .collect()
    }

    pub async fn get_loaded_models(&self) -> Vec<String> {
        self.loaded_models.iter()
            .map(|entry| entry.key().clone())
            .collect()
    }

    pub async fn unload_model(&self, model_id: &str) -> Result<()> {
        if let Some(_model) = self.loaded_models.remove(model_id) {
            info!("Unloaded model: {}", model_id);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Model {} not loaded", model_id))
        }
    }

    pub async fn warm_models(&self, model_ids: Vec<String>) -> Result<()> {
        info!("Warming up {} models", model_ids.len());
        
        for model_id in model_ids {
            if let Err(e) = self.ensure_model_loaded(&model_id).await {
                warn!("Failed to warm up model {}: {}", model_id, e);
            }
        }
        
        Ok(())
    }

    pub async fn cleanup_unused_models(&self, max_idle_minutes: u64) -> Result<usize> {
        let cutoff = Instant::now() - std::time::Duration::from_secs(max_idle_minutes * 60);
        let mut unloaded_count = 0;
        
        let models_to_unload: Vec<String> = self.loaded_models.iter()
            .filter_map(|entry| {
                if entry.value().last_used < cutoff {
                    Some(entry.key().clone())
                } else {
                    None
                }
            })
            .collect();

        for model_id in models_to_unload {
            if let Some(_model) = self.loaded_models.remove(&model_id) {
                info!("Cleaned up unused model: {}", model_id);
                unloaded_count += 1;
            }
        }

        if unloaded_count > 0 {
            info!("Cleaned up {} unused models", unloaded_count);
        }

        Ok(unloaded_count)
    }
}
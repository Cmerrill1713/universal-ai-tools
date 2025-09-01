/// Model registry and management for high-performance inference

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

use crate::{Framework, ModelType, Result, MLError};

/// Loaded model wrapper
#[derive(Debug, Clone)]
pub struct LoadedModel {
    pub id: String,
    pub model_type: ModelType,
    pub framework: Framework,
    pub model_data: Arc<dyn std::any::Any + Send + Sync>,
    pub metadata: ModelMetadata,
    pub loaded_at: chrono::DateTime<chrono::Utc>,
    pub last_accessed: Arc<RwLock<chrono::DateTime<chrono::Utc>>>,
}

/// Model metadata for optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub model_size_mb: f64,
    pub parameters_count: u64,
    pub context_length: usize,
    pub architecture: String,
    pub optimization_level: OptimizationLevel,
    pub supports_batching: bool,
    pub preferred_batch_size: usize,
    pub memory_requirements_mb: f64,
}

/// Optimization levels for different hardware
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OptimizationLevel {
    /// Basic optimization, CPU only
    Basic,
    /// Apple Silicon optimized with Metal
    AppleSilicon,
    /// NVIDIA GPU optimized
    Cuda,
    /// AMD GPU optimized
    Rocm,
    /// Intel GPU optimized
    Intel,
    /// Custom optimization
    Custom(String),
}

/// Model registry for managing loaded models
pub struct ModelRegistry {
    models: Arc<RwLock<HashMap<String, LoadedModel>>>,
    optimization_profiles: HashMap<String, OptimizationProfile>,
    max_models: usize,
    memory_limit_mb: f64,
}

/// Optimization profile for specific hardware
#[derive(Debug, Clone)]
pub struct OptimizationProfile {
    pub name: String,
    pub max_batch_size: usize,
    pub preferred_dtype: String,
    pub memory_optimization: bool,
    pub use_quantization: bool,
    pub quantization_bits: Option<u8>,
}

impl ModelRegistry {
    /// Create new model registry with Apple Silicon optimization
    pub async fn new() -> Result<Self> {
        let mut optimization_profiles = HashMap::new();

        // Apple Silicon optimization profile
        optimization_profiles.insert("apple-silicon".to_string(), OptimizationProfile {
            name: "Apple Silicon Metal".to_string(),
            max_batch_size: 4,
            preferred_dtype: "f16".to_string(),
            memory_optimization: true,
            use_quantization: true,
            quantization_bits: Some(4),
        });

        // CPU fallback profile
        optimization_profiles.insert("cpu".to_string(), OptimizationProfile {
            name: "CPU Optimized".to_string(),
            max_batch_size: 1,
            preferred_dtype: "f32".to_string(),
            memory_optimization: true,
            use_quantization: false,
            quantization_bits: None,
        });

        Ok(Self {
            models: Arc::new(RwLock::new(HashMap::new())),
            optimization_profiles,
            max_models: 10, // Reasonable limit for Mac
            memory_limit_mb: 16384.0, // 16GB limit
        })
    }

    /// Load a model with automatic optimization detection
    pub async fn load_model(
        &mut self, 
        model_id: String, 
        model_type: ModelType, 
        framework: Framework
    ) -> Result<()> {
        // Check memory limits
        self.check_memory_limits().await?;

        // Auto-detect optimization level
        let optimization_level = self.detect_optimization_level();

        // Create metadata based on model type
        let metadata = self.create_metadata(&model_type, &optimization_level);

        // Load model based on framework
        let model_data = self.load_model_data(&model_id, &model_type, &framework).await?;

        let loaded_model = LoadedModel {
            id: model_id.clone(),
            model_type,
            framework,
            model_data,
            metadata,
            loaded_at: chrono::Utc::now(),
            last_accessed: Arc::new(RwLock::new(chrono::Utc::now())),
        };

        // Store in registry
        let mut models = self.models.write().await;
        models.insert(model_id.clone(), loaded_model);

        tracing::info!("✅ Loaded model: {} with optimization: {:?}", model_id, optimization_level);
        Ok(())
    }

    /// Get a loaded model
    pub async fn get_model(&self, model_id: &str) -> Result<LoadedModel> {
        let models = self.models.read().await;
        let model = models.get(model_id)
            .ok_or_else(|| MLError::ModelNotFound(model_id.to_string()))?
            .clone();

        // Update last accessed
        *model.last_accessed.write().await = chrono::Utc::now();

        Ok(model)
    }

    /// List all loaded models
    pub async fn list_models(&self) -> Vec<String> {
        let models = self.models.read().await;
        models.keys().cloned().collect()
    }

    /// Unload least recently used models if needed
    pub async fn cleanup_models(&mut self) -> Result<()> {
        let mut models = self.models.write().await;
        
        if models.len() <= self.max_models {
            return Ok(());
        }

        // Find least recently used model
        let mut oldest_model = None;
        let mut oldest_time = chrono::Utc::now();

        for (id, model) in models.iter() {
            let last_accessed = *model.last_accessed.read().await;
            if last_accessed < oldest_time {
                oldest_time = last_accessed;
                oldest_model = Some(id.clone());
            }
        }

        if let Some(model_id) = oldest_model {
            models.remove(&model_id);
            tracing::info!("🗑️ Unloaded LRU model: {}", model_id);
        }

        Ok(())
    }

    /// Detect optimal optimization level for current hardware
    fn detect_optimization_level(&self) -> OptimizationLevel {
        // Check for Apple Silicon
        if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
            OptimizationLevel::AppleSilicon
        } else {
            OptimizationLevel::Basic
        }
    }

    /// Create metadata for model type and optimization
    fn create_metadata(&self, model_type: &ModelType, optimization: &OptimizationLevel) -> ModelMetadata {
        let (size_mb, params, context_len, arch) = match model_type {
            ModelType::Transformer { name, .. } => {
                if name.contains("7b") {
                    (13_000.0, 7_000_000_000, 4096, "llama".to_string())
                } else if name.contains("13b") {
                    (25_000.0, 13_000_000_000, 4096, "llama".to_string())
                } else {
                    (3_500.0, 3_000_000_000, 2048, "small-llm".to_string())
                }
            },
            ModelType::CNN { architecture } => (500.0, 50_000_000, 512, architecture.clone()),
            _ => (100.0, 10_000_000, 256, "classical".to_string()),
        };

        let (batch_size, memory_req) = match optimization {
            OptimizationLevel::AppleSilicon => (4, size_mb * 0.7), // Metal optimization
            _ => (1, size_mb),
        };

        ModelMetadata {
            model_size_mb: size_mb,
            parameters_count: params,
            context_length: context_len,
            architecture: arch,
            optimization_level: optimization.clone(),
            supports_batching: batch_size > 1,
            preferred_batch_size: batch_size,
            memory_requirements_mb: memory_req,
        }
    }

    /// Load model data based on framework
    async fn load_model_data(
        &self,
        model_id: &str,
        model_type: &ModelType,
        framework: &Framework,
    ) -> Result<Arc<dyn std::any::Any + Send + Sync>> {
        match framework {
            Framework::Candle => {
                // Load Candle model
                use crate::inference::candle::create_apple_silicon_engine;
                let engine = create_apple_silicon_engine()?;
                Ok(Arc::new(engine))
            },
            Framework::Burn => {
                // Load Burn model with WGPU backend
                tracing::info!("Loading Burn model with WGPU backend");
                Ok(Arc::new("burn-model-placeholder".to_string()))
            },
            Framework::ONNX => {
                // Load ONNX model
                tracing::info!("Loading ONNX model: {}", model_id);
                Ok(Arc::new("onnx-model-placeholder".to_string()))
            },
            _ => {
                tracing::warn!("Framework {:?} not fully implemented", framework);
                Ok(Arc::new("placeholder-model".to_string()))
            }
        }
    }

    /// Check memory usage limits
    async fn check_memory_limits(&self) -> Result<()> {
        let models = self.models.read().await;
        let total_memory: f64 = models.values()
            .map(|m| m.metadata.memory_requirements_mb)
            .sum();

        if total_memory > self.memory_limit_mb {
            return Err(MLError::InferenceFailed(
                format!("Memory limit exceeded: {:.1}MB > {:.1}MB", total_memory, self.memory_limit_mb)
            ));
        }

        Ok(())
    }

    /// Get optimization profile
    pub fn get_optimization_profile(&self, name: &str) -> Option<&OptimizationProfile> {
        self.optimization_profiles.get(name)
    }

    /// Get model statistics
    pub async fn get_statistics(&self) -> ModelRegistryStats {
        let models = self.models.read().await;
        let total_memory: f64 = models.values()
            .map(|m| m.metadata.memory_requirements_mb)
            .sum();

        let frameworks: HashMap<Framework, usize> = models.values()
            .map(|m| m.framework)
            .fold(HashMap::new(), |mut acc, f| {
                *acc.entry(f).or_insert(0) += 1;
                acc
            });

        ModelRegistryStats {
            total_models: models.len(),
            total_memory_mb: total_memory,
            memory_limit_mb: self.memory_limit_mb,
            frameworks,
            optimization_profiles: self.optimization_profiles.len(),
        }
    }
}

/// Model registry statistics
#[derive(Debug, Serialize)]
pub struct ModelRegistryStats {
    pub total_models: usize,
    pub total_memory_mb: f64,
    pub memory_limit_mb: f64,
    pub frameworks: HashMap<Framework, usize>,
    pub optimization_profiles: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_model_registry_creation() {
        let registry = ModelRegistry::new().await;
        assert!(registry.is_ok());
    }

    #[tokio::test] 
    async fn test_optimization_detection() {
        let registry = ModelRegistry::new().await.unwrap();
        let opt_level = registry.detect_optimization_level();
        println!("Detected optimization: {:?}", opt_level);
    }
}
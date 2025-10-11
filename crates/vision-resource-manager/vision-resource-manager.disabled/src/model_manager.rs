use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{DateTime, Utc};
use anyhow::{Result, Context};
use rand::Rng;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ModelType {
    Analysis,    // Object detection, classification
    Generation,  // Image generation, enhancement
    Embedding,   // Feature extraction, similarity
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ModelState {
    Unloaded,
    Loading,
    Loaded,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[napi_derive::napi(object)]
pub struct ModelInfo {
    pub name: String,
    pub model_type: String, // Serialized ModelType for JS
    pub size_gb: f64,
    pub load_time_ms: u32,
    pub last_used: String, // ISO timestamp
    pub state: String, // Serialized ModelState for JS
    pub priority: u32,
    pub estimated_inference_time_ms: u32,
    pub supported_formats: Vec<String>,
}

#[derive(Debug, Clone)]
struct InternalModelInfo {
    pub name: String,
    pub model_type: ModelType,
    pub size_gb: f64,
    pub load_time_ms: u32,
    pub last_used: DateTime<Utc>,
    pub state: ModelState,
    pub priority: u32,
    pub estimated_inference_time_ms: u32,
    pub supported_formats: Vec<String>,
}

impl From<InternalModelInfo> for ModelInfo {
    fn from(internal: InternalModelInfo) -> Self {
        ModelInfo {
            name: internal.name,
            model_type: match internal.model_type {
                ModelType::Analysis => "analysis".to_string(),
                ModelType::Generation => "generation".to_string(),
                ModelType::Embedding => "embedding".to_string(),
            },
            size_gb: internal.size_gb,
            load_time_ms: internal.load_time_ms,
            last_used: internal.last_used.to_rfc3339(),
            state: match internal.state {
                ModelState::Unloaded => "unloaded".to_string(),
                ModelState::Loading => "loading".to_string(),
                ModelState::Loaded => "loaded".to_string(),
                ModelState::Error => "error".to_string(),
            },
            priority: internal.priority,
            estimated_inference_time_ms: internal.estimated_inference_time_ms,
            supported_formats: internal.supported_formats,
        }
    }
}

pub struct ModelManager {
    models: Arc<RwLock<HashMap<String, InternalModelInfo>>>,
    max_vram_gb: f64,
    current_vram_usage: Arc<RwLock<f64>>,
    loading_models: Arc<RwLock<std::collections::HashSet<String>>>,
}

impl ModelManager {
    pub fn new(max_vram_gb: f64) -> Self {
        Self {
            models: Arc::new(RwLock::new(HashMap::new())),
            max_vram_gb,
            current_vram_usage: Arc::new(RwLock::new(0.0)),
            loading_models: Arc::new(RwLock::new(std::collections::HashSet::new())),
        }
    }
    
    pub async fn initialize_default_models(&self) -> Result<()> {
        tracing::info!("Initializing default vision models");
        
        let default_models = vec![
            InternalModelInfo {
                name: "yolo-v8n".to_string(),
                model_type: ModelType::Analysis,
                size_gb: 0.006, // 6MB
                load_time_ms: 500,
                last_used: Utc::now(),
                state: ModelState::Unloaded,
                priority: 1,
                estimated_inference_time_ms: 150,
                supported_formats: vec!["jpg".to_string(), "png".to_string(), "bmp".to_string()],
            },
            InternalModelInfo {
                name: "clip-vit-b32".to_string(),
                model_type: ModelType::Embedding,
                size_gb: 0.4, // 400MB
                load_time_ms: 2000,
                last_used: Utc::now(),
                state: ModelState::Unloaded,
                priority: 2,
                estimated_inference_time_ms: 300,
                supported_formats: vec!["jpg".to_string(), "png".to_string(), "webp".to_string()],
            },
            InternalModelInfo {
                name: "sd3b".to_string(),
                model_type: ModelType::Generation,
                size_gb: 6.0, // 6GB
                load_time_ms: 15000,
                last_used: Utc::now(),
                state: ModelState::Unloaded,
                priority: 3,
                estimated_inference_time_ms: 3500,
                supported_formats: vec!["png".to_string(), "jpg".to_string()],
            },
            InternalModelInfo {
                name: "sdxl-refiner".to_string(),
                model_type: ModelType::Generation,
                size_gb: 2.5, // 2.5GB for Q4_1 quantized
                load_time_ms: 10000,
                last_used: Utc::now(),
                state: ModelState::Unloaded,
                priority: 4,
                estimated_inference_time_ms: 2000,
                supported_formats: vec!["png".to_string(), "jpg".to_string()],
            },
        ];
        
        let mut models = self.models.write().await;
        for model in default_models {
            models.insert(model.name.clone(), model);
        }
        
        tracing::info!(
            "Initialized {} default models, max VRAM: {:.2} GB",
            models.len(),
            self.max_vram_gb
        );
        
        Ok(())
    }
    
    pub async fn ensure_model_loaded(&self, model_name: &str) -> Result<()> {
        // Check if already loaded
        {
            let models = self.models.read().await;
            if let Some(model) = models.get(model_name) {
                if model.state == ModelState::Loaded {
                    tracing::debug!("Model {} already loaded", model_name);
                    return Ok(());
                }
            } else {
                return Err(anyhow::anyhow!("Unknown model: {}", model_name));
            }
        }
        
        // Check if currently loading
        {
            let loading = self.loading_models.read().await;
            if loading.contains(model_name) {
                tracing::info!("Model {} is already loading, waiting...", model_name);
                
                // Wait for loading to complete (with timeout)
                for _ in 0..600 { // 60 second timeout
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    
                    let models = self.models.read().await;
                    if let Some(model) = models.get(model_name) {
                        match model.state {
                            ModelState::Loaded => return Ok(()),
                            ModelState::Error => return Err(anyhow::anyhow!("Model loading failed")),
                            _ => continue,
                        }
                    }
                }
                
                return Err(anyhow::anyhow!("Model loading timeout"));
            }
        }
        
        // Mark as loading
        {
            let mut loading = self.loading_models.write().await;
            loading.insert(model_name.to_string());
        }
        
        let result = self.load_model_internal(model_name).await;
        
        // Remove from loading set
        {
            let mut loading = self.loading_models.write().await;
            loading.remove(model_name);
        }
        
        result
    }
    
    async fn load_model_internal(&self, model_name: &str) -> Result<()> {
        let model_size = {
            let models = self.models.read().await;
            let model = models.get(model_name)
                .ok_or_else(|| anyhow::anyhow!("Model not found: {}", model_name))?;
            
            // Update state to loading
            drop(models);
            let mut models = self.models.write().await;
            if let Some(model) = models.get_mut(model_name) {
                model.state = ModelState::Loading;
            }
            
            model.size_gb
        };
        
        // Check if we need to free up space
        let current_usage = *self.current_vram_usage.read().await;
        if current_usage + model_size > self.max_vram_gb {
            let space_needed = current_usage + model_size - self.max_vram_gb + 0.1; // Small buffer
            self.free_vram_space(space_needed).await
                .context("Failed to free sufficient VRAM space")?;
        }
        
        let load_start = std::time::Instant::now();
        
        tracing::info!(
            "Loading model {} ({:.2} GB)...",
            model_name,
            model_size
        );
        
        // Simulate model loading (in real implementation, this would load the actual model)
        let load_time = {
            let models = self.models.read().await;
            models.get(model_name).unwrap().load_time_ms
        };
        
        tokio::time::sleep(tokio::time::Duration::from_millis(load_time)).await;
        
        // Simulate potential loading failure (5% chance)
        if rand::thread_rng().gen::<f64>() < 0.05 {
            let mut models = self.models.write().await;
            if let Some(model) = models.get_mut(model_name) {
                model.state = ModelState::Error;
            }
            return Err(anyhow::anyhow!("Simulated model loading failure"));
        }
        
        let actual_load_time = load_start.elapsed();
        
        // Update model state and VRAM usage
        {
            let mut models = self.models.write().await;
            if let Some(model) = models.get_mut(model_name) {
                model.state = ModelState::Loaded;
                model.last_used = Utc::now();
                model.load_time_ms = actual_load_time.as_millis() as u32; // Update with actual time
            }
            
            let mut current_usage = self.current_vram_usage.write().await;
            *current_usage += model_size;
        }
        
        tracing::info!(
            "Model {} loaded successfully in {:?} (VRAM: {:.2} GB)",
            model_name,
            actual_load_time,
            current_usage + model_size
        );
        
        Ok(())
    }
    
    async fn free_vram_space(&self, space_needed: f64) -> Result<()> {
        tracing::info!("Freeing {:.2} GB of VRAM space", space_needed);
        
        let mut space_freed = 0.0;
        let models_to_unload = {
            let models = self.models.read().await;
            
            // Find loaded models sorted by LRU (least recently used first)
            let mut loaded_models: Vec<_> = models
                .values()
                .filter(|m| m.state == ModelState::Loaded)
                .collect();
            
            loaded_models.sort_by_key(|m| m.last_used);
            
            // Select models to unload
            let mut to_unload = Vec::new();
            for model in loaded_models {
                to_unload.push((model.name.clone(), model.size_gb));
                space_freed += model.size_gb;
                
                if space_freed >= space_needed {
                    break;
                }
            }
            
            to_unload
        };
        
        if space_freed < space_needed {
            return Err(anyhow::anyhow!(
                "Cannot free sufficient VRAM space: need {:.2} GB, can free {:.2} GB",
                space_needed,
                space_freed
            ));
        }
        
        // Unload selected models
        for (model_name, model_size) in models_to_unload {
            self.unload_model(&model_name).await
                .context(format!("Failed to unload model {}", model_name))?;
        }
        
        tracing::info!("Freed {:.2} GB of VRAM space", space_freed);
        Ok(())
    }
    
    pub async fn unload_model(&self, model_name: &str) -> Result<()> {
        let (model_size, was_loaded) = {
            let mut models = self.models.write().await;
            if let Some(model) = models.get_mut(model_name) {
                let was_loaded = model.state == ModelState::Loaded;
                let size = model.size_gb;
                
                if was_loaded {
                    model.state = ModelState::Unloaded;
                    tracing::info!("Unloading model {}", model_name);
                    
                    // Simulate unloading delay
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
                
                (size, was_loaded)
            } else {
                return Err(anyhow::anyhow!("Model not found: {}", model_name));
            }
        };
        
        if was_loaded {
            let mut current_usage = self.current_vram_usage.write().await;
            *current_usage -= model_size;
            
            tracing::info!(
                "Model {} unloaded, freed {:.2} GB VRAM",
                model_name,
                model_size
            );
        }
        
        Ok(())
    }
    
    pub async fn unload_all_models(&self) -> Result<()> {
        tracing::info!("Unloading all models");
        
        let model_names: Vec<String> = {
            let models = self.models.read().await;
            models
                .values()
                .filter(|m| m.state == ModelState::Loaded)
                .map(|m| m.name.clone())
                .collect()
        };
        
        for model_name in model_names {
            if let Err(e) = self.unload_model(&model_name).await {
                tracing::warn!("Failed to unload model {}: {}", model_name, e);
            }
        }
        
        // Reset VRAM usage
        *self.current_vram_usage.write().await = 0.0;
        
        tracing::info!("All models unloaded");
        Ok(())
    }
    
    pub async fn get_model_info(&self, model_name: &str) -> Option<ModelInfo> {
        let models = self.models.read().await;
        models.get(model_name).map(|m| m.clone().into())
    }
    
    pub async fn get_loaded_models(&self) -> Vec<String> {
        let models = self.models.read().await;
        models
            .values()
            .filter(|m| m.state == ModelState::Loaded)
            .map(|m| m.name.clone())
            .collect()
    }
    
    pub async fn get_all_models(&self) -> Vec<ModelInfo> {
        let models = self.models.read().await;
        models
            .values()
            .map(|m| m.clone().into())
            .collect()
    }
    
    pub async fn update_model_usage(&self, model_name: &str) -> Result<()> {
        let mut models = self.models.write().await;
        if let Some(model) = models.get_mut(model_name) {
            model.last_used = Utc::now();
            Ok(())
        } else {
            Err(anyhow::anyhow!("Model not found: {}", model_name))
        }
    }
    
    pub async fn get_current_vram_usage(&self) -> f64 {
        *self.current_vram_usage.read().await
    }
    
    pub async fn get_available_vram(&self) -> f64 {
        let current = *self.current_vram_usage.read().await;
        (self.max_vram_gb - current).max(0.0)
    }
    
    pub async fn can_load_model(&self, model_name: &str) -> Result<bool> {
        let models = self.models.read().await;
        if let Some(model) = models.get(model_name) {
            if model.state == ModelState::Loaded {
                return Ok(true);
            }
            
            let current_usage = *self.current_vram_usage.read().await;
            let available = self.max_vram_gb - current_usage;
            
            Ok(available >= model.size_gb)
        } else {
            Err(anyhow::anyhow!("Model not found: {}", model_name))
        }
    }
    
    pub async fn get_model_recommendations(&self, task_type: ModelType) -> Vec<String> {
        let models = self.models.read().await;
        let mut matching_models: Vec<_> = models
            .values()
            .filter(|m| m.model_type == task_type)
            .collect();
        
        // Sort by priority (lower number = higher priority)
        matching_models.sort_by_key(|m| m.priority);
        
        matching_models
            .into_iter()
            .map(|m| m.name.clone())
            .collect()
    }
    
    pub async fn get_memory_stats(&self) -> (f64, f64, f64) {
        let current_usage = *self.current_vram_usage.read().await;
        let available = (self.max_vram_gb - current_usage).max(0.0);
        (self.max_vram_gb, current_usage, available)
    }
}
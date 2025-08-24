use crate::{config::Config, ModelInfo, Dataset};
use anyhow::Result;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

pub struct ModelRegistry {
    config: Config,
    models: Arc<DashMap<String, ModelInfo>>,
    datasets: Arc<DashMap<String, Dataset>>,
    model_metadata_cache: Arc<RwLock<std::collections::HashMap<String, serde_json::Value>>>,
}

impl ModelRegistry {
    pub async fn new(config: &Config) -> Result<Self> {
        let registry = Self {
            config: config.clone(),
            models: Arc::new(DashMap::new()),
            datasets: Arc::new(DashMap::new()),
            model_metadata_cache: Arc::new(RwLock::new(std::collections::HashMap::new())),
        };

        // Load existing models and datasets from storage
        registry.load_existing_models().await?;
        registry.load_existing_datasets().await?;

        Ok(registry)
    }

    async fn load_existing_models(&self) -> Result<()> {
        let models_dir = &self.config.storage.models_dir;
        
        if !models_dir.exists() {
            tokio::fs::create_dir_all(models_dir).await?;
            return Ok(());
        }

        let mut entries = tokio::fs::read_dir(models_dir).await?;
        let mut loaded_count = 0;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let model_id = entry.file_name().to_string_lossy().to_string();
                
                match self.load_model_metadata(&model_id).await {
                    Ok(Some(model_info)) => {
                        self.models.insert(model_id.clone(), model_info);
                        loaded_count += 1;
                        debug!("Loaded model: {}", model_id);
                    }
                    Ok(None) => {
                        warn!("Model metadata not found for: {}", model_id);
                    }
                    Err(e) => {
                        error!("Failed to load model {}: {}", model_id, e);
                    }
                }
            }
        }

        if loaded_count > 0 {
            info!("Loaded {} existing models from storage", loaded_count);
        }

        Ok(())
    }

    async fn load_existing_datasets(&self) -> Result<()> {
        let datasets_dir = &self.config.storage.datasets_dir;
        
        if !datasets_dir.exists() {
            tokio::fs::create_dir_all(datasets_dir).await?;
            return Ok(());
        }

        let mut entries = tokio::fs::read_dir(datasets_dir).await?;
        let mut loaded_count = 0;

        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_dir() {
                let dataset_id = entry.file_name().to_string_lossy().to_string();
                
                match self.load_dataset_metadata(&dataset_id).await {
                    Ok(Some(dataset)) => {
                        self.datasets.insert(dataset_id.clone(), dataset);
                        loaded_count += 1;
                        debug!("Loaded dataset: {}", dataset_id);
                    }
                    Ok(None) => {
                        warn!("Dataset metadata not found for: {}", dataset_id);
                    }
                    Err(e) => {
                        error!("Failed to load dataset {}: {}", dataset_id, e);
                    }
                }
            }
        }

        if loaded_count > 0 {
            info!("Loaded {} existing datasets from storage", loaded_count);
        }

        Ok(())
    }

    async fn load_model_metadata(&self, model_id: &str) -> Result<Option<ModelInfo>> {
        let metadata_path = self.config.get_model_path(model_id).join("metadata.json");
        
        if !metadata_path.exists() {
            return Ok(None);
        }

        let content = tokio::fs::read_to_string(&metadata_path).await?;
        let model_info: ModelInfo = serde_json::from_str(&content)?;
        
        Ok(Some(model_info))
    }

    async fn load_dataset_metadata(&self, dataset_id: &str) -> Result<Option<Dataset>> {
        let metadata_path = self.config.get_dataset_path(dataset_id).join("metadata.json");
        
        if !metadata_path.exists() {
            return Ok(None);
        }

        let content = tokio::fs::read_to_string(&metadata_path).await?;
        let dataset: Dataset = serde_json::from_str(&content)?;
        
        Ok(Some(dataset))
    }

    pub async fn register_model(&self, model_info: ModelInfo) -> Result<()> {
        let model_id = model_info.id.clone();
        
        // Save metadata to disk
        self.save_model_metadata(&model_info).await?;
        
        // Store in memory
        self.models.insert(model_id.clone(), model_info);
        
        info!("Registered model: {}", model_id);
        Ok(())
    }

    pub async fn register_dataset(&self, dataset: Dataset) -> Result<()> {
        let dataset_id = dataset.id.clone();
        
        // Save metadata to disk
        self.save_dataset_metadata(&dataset).await?;
        
        // Store in memory
        self.datasets.insert(dataset_id.clone(), dataset);
        
        info!("Registered dataset: {}", dataset_id);
        Ok(())
    }

    async fn save_model_metadata(&self, model_info: &ModelInfo) -> Result<()> {
        let model_dir = self.config.get_model_path(&model_info.id);
        tokio::fs::create_dir_all(&model_dir).await?;
        
        let metadata_path = model_dir.join("metadata.json");
        let content = serde_json::to_string_pretty(model_info)?;
        tokio::fs::write(&metadata_path, content).await?;
        
        Ok(())
    }

    async fn save_dataset_metadata(&self, dataset: &Dataset) -> Result<()> {
        let dataset_dir = self.config.get_dataset_path(&dataset.id);
        tokio::fs::create_dir_all(&dataset_dir).await?;
        
        let metadata_path = dataset_dir.join("metadata.json");
        let content = serde_json::to_string_pretty(dataset)?;
        tokio::fs::write(&metadata_path, content).await?;
        
        Ok(())
    }

    pub async fn list_models(&self) -> Result<Vec<ModelInfo>> {
        let models: Vec<ModelInfo> = self.models.iter()
            .map(|entry| entry.value().clone())
            .collect();
        
        Ok(models)
    }

    pub async fn list_datasets(&self) -> Result<Vec<Dataset>> {
        let datasets: Vec<Dataset> = self.datasets.iter()
            .map(|entry| entry.value().clone())
            .collect();
        
        Ok(datasets)
    }

    pub async fn get_model(&self, model_id: &str) -> Result<Option<ModelInfo>> {
        if let Some(model) = self.models.get(model_id) {
            Ok(Some(model.clone()))
        } else {
            // Try to load from disk if not in memory
            self.load_model_metadata(model_id).await
        }
    }

    pub async fn get_dataset(&self, dataset_id: &str) -> Result<Option<Dataset>> {
        if let Some(dataset) = self.datasets.get(dataset_id) {
            Ok(Some(dataset.clone()))
        } else {
            // Try to load from disk if not in memory
            self.load_dataset_metadata(dataset_id).await
        }
    }

    pub async fn update_model(&self, model_info: ModelInfo) -> Result<()> {
        let model_id = model_info.id.clone();
        
        // Update in memory
        self.models.insert(model_id.clone(), model_info.clone());
        
        // Save to disk
        self.save_model_metadata(&model_info).await?;
        
        info!("Updated model: {}", model_id);
        Ok(())
    }

    pub async fn update_dataset(&self, dataset: Dataset) -> Result<()> {
        let dataset_id = dataset.id.clone();
        
        // Update in memory
        self.datasets.insert(dataset_id.clone(), dataset.clone());
        
        // Save to disk
        self.save_dataset_metadata(&dataset).await?;
        
        info!("Updated dataset: {}", dataset_id);
        Ok(())
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<()> {
        // Remove from memory
        self.models.remove(model_id);
        
        // Remove from disk
        let model_dir = self.config.get_model_path(model_id);
        if model_dir.exists() {
            tokio::fs::remove_dir_all(&model_dir).await?;
        }
        
        // Clear from cache
        let mut cache = self.model_metadata_cache.write().await;
        cache.remove(model_id);
        
        info!("Deleted model: {}", model_id);
        Ok(())
    }

    pub async fn delete_dataset(&self, dataset_id: &str) -> Result<()> {
        // Remove from memory
        self.datasets.remove(dataset_id);
        
        // Remove from disk
        let dataset_dir = self.config.get_dataset_path(dataset_id);
        if dataset_dir.exists() {
            tokio::fs::remove_dir_all(&dataset_dir).await?;
        }
        
        info!("Deleted dataset: {}", dataset_id);
        Ok(())
    }

    pub async fn search_models(&self, query: &str) -> Result<Vec<ModelInfo>> {
        let query_lower = query.to_lowercase();
        let models: Vec<ModelInfo> = self.models.iter()
            .filter_map(|entry| {
                let model = entry.value();
                if model.name.to_lowercase().contains(&query_lower) ||
                   model.metadata.description.as_ref()
                       .map_or(false, |desc| desc.to_lowercase().contains(&query_lower)) ||
                   model.metadata.tags.iter()
                       .any(|tag| tag.to_lowercase().contains(&query_lower)) {
                    Some(model.clone())
                } else {
                    None
                }
            })
            .collect();
        
        Ok(models)
    }

    pub async fn search_datasets(&self, query: &str) -> Result<Vec<Dataset>> {
        let query_lower = query.to_lowercase();
        let datasets: Vec<Dataset> = self.datasets.iter()
            .filter_map(|entry| {
                let dataset = entry.value();
                if dataset.name.to_lowercase().contains(&query_lower) ||
                   dataset.metadata.description.as_ref()
                       .map_or(false, |desc| desc.to_lowercase().contains(&query_lower)) {
                    Some(dataset.clone())
                } else {
                    None
                }
            })
            .collect();
        
        Ok(datasets)
    }

    pub async fn get_models_by_type(&self, model_type: &str) -> Result<Vec<ModelInfo>> {
        let models: Vec<ModelInfo> = self.models.iter()
            .filter_map(|entry| {
                let model = entry.value();
                let type_matches = match model_type {
                    "language_model" => matches!(model.model_type, crate::ModelType::LanguageModel),
                    "embedding_model" => matches!(model.model_type, crate::ModelType::EmbeddingModel),
                    "vision_model" => matches!(model.model_type, crate::ModelType::VisionModel),
                    "audio_model" => matches!(model.model_type, crate::ModelType::AudioModel),
                    "multimodal" => matches!(model.model_type, crate::ModelType::Multimodal),
                    "custom" => matches!(model.model_type, crate::ModelType::Custom),
                    _ => false,
                };
                
                if type_matches {
                    Some(model.clone())
                } else {
                    None
                }
            })
            .collect();
        
        Ok(models)
    }

    pub async fn get_models_by_framework(&self, framework: &str) -> Result<Vec<ModelInfo>> {
        let models: Vec<ModelInfo> = self.models.iter()
            .filter_map(|entry| {
                let model = entry.value();
                let framework_matches = match framework {
                    "pytorch" => matches!(model.framework, crate::MLFramework::PyTorch),
                    "tensorflow" => matches!(model.framework, crate::MLFramework::TensorFlow),
                    "onnx" => matches!(model.framework, crate::MLFramework::ONNX),
                    "huggingface" => matches!(model.framework, crate::MLFramework::HuggingFace),
                    "candle" => matches!(model.framework, crate::MLFramework::Candle),
                    "mlx" => matches!(model.framework, crate::MLFramework::MLX),
                    "custom" => matches!(model.framework, crate::MLFramework::Custom),
                    _ => false,
                };
                
                if framework_matches {
                    Some(model.clone())
                } else {
                    None
                }
            })
            .collect();
        
        Ok(models)
    }

    pub async fn get_registry_stats(&self) -> Result<serde_json::Value> {
        let model_count = self.models.len();
        let dataset_count = self.datasets.len();
        
        // Calculate storage usage
        let mut total_model_size = 0u64;
        let mut total_dataset_size = 0u64;
        
        for entry in self.models.iter() {
            total_model_size += entry.value().file_size;
        }
        
        for entry in self.datasets.iter() {
            total_dataset_size += entry.value().size;
        }
        
        // Model type breakdown
        let mut model_types = std::collections::HashMap::new();
        for entry in self.models.iter() {
            let type_name = match entry.value().model_type {
                crate::ModelType::LanguageModel => "language_model",
                crate::ModelType::EmbeddingModel => "embedding_model",
                crate::ModelType::VisionModel => "vision_model",
                crate::ModelType::AudioModel => "audio_model",
                crate::ModelType::Multimodal => "multimodal",
                crate::ModelType::Custom => "custom",
            };
            *model_types.entry(type_name.to_string()).or_insert(0) += 1;
        }
        
        // Framework breakdown
        let mut frameworks = std::collections::HashMap::new();
        for entry in self.models.iter() {
            let framework_name = match entry.value().framework {
                crate::MLFramework::PyTorch => "pytorch",
                crate::MLFramework::TensorFlow => "tensorflow",
                crate::MLFramework::ONNX => "onnx",
                crate::MLFramework::HuggingFace => "huggingface",
                crate::MLFramework::Candle => "candle",
                crate::MLFramework::MLX => "mlx",
                crate::MLFramework::Custom => "custom",
            };
            *frameworks.entry(framework_name.to_string()).or_insert(0) += 1;
        }
        
        Ok(serde_json::json!({
            "models": {
                "total_count": model_count,
                "total_size_bytes": total_model_size,
                "types": model_types,
                "frameworks": frameworks
            },
            "datasets": {
                "total_count": dataset_count,
                "total_size_bytes": total_dataset_size
            },
            "storage": {
                "models_dir": self.config.storage.models_dir,
                "datasets_dir": self.config.storage.datasets_dir,
                "total_size_bytes": total_model_size + total_dataset_size,
                "max_model_size_bytes": (self.config.storage.max_model_size_gb * 1024.0 * 1024.0 * 1024.0) as u64,
                "max_dataset_size_bytes": (self.config.storage.max_dataset_size_gb * 1024.0 * 1024.0 * 1024.0) as u64
            }
        }))
    }

    pub async fn cleanup_orphaned_files(&self) -> Result<usize> {
        let mut cleaned_count = 0;
        
        // Check models directory for orphaned files
        if let Ok(mut entries) = tokio::fs::read_dir(&self.config.storage.models_dir).await {
            while let Some(entry) = entries.next_entry().await? {
                if entry.file_type().await?.is_dir() {
                    let dir_name = entry.file_name().to_string_lossy().to_string();
                    if !self.models.contains_key(&dir_name) {
                        // This directory doesn't have a corresponding model in memory
                        match tokio::fs::remove_dir_all(entry.path()).await {
                            Ok(_) => {
                                info!("Cleaned up orphaned model directory: {}", dir_name);
                                cleaned_count += 1;
                            }
                            Err(e) => {
                                warn!("Failed to clean up orphaned model directory {}: {}", dir_name, e);
                            }
                        }
                    }
                }
            }
        }
        
        // Check datasets directory for orphaned files
        if let Ok(mut entries) = tokio::fs::read_dir(&self.config.storage.datasets_dir).await {
            while let Some(entry) = entries.next_entry().await? {
                if entry.file_type().await?.is_dir() {
                    let dir_name = entry.file_name().to_string_lossy().to_string();
                    if !self.datasets.contains_key(&dir_name) {
                        // This directory doesn't have a corresponding dataset in memory
                        match tokio::fs::remove_dir_all(entry.path()).await {
                            Ok(_) => {
                                info!("Cleaned up orphaned dataset directory: {}", dir_name);
                                cleaned_count += 1;
                            }
                            Err(e) => {
                                warn!("Failed to clean up orphaned dataset directory {}: {}", dir_name, e);
                            }
                        }
                    }
                }
            }
        }
        
        if cleaned_count > 0 {
            info!("Cleaned up {} orphaned files/directories", cleaned_count);
        }
        
        Ok(cleaned_count)
    }
}
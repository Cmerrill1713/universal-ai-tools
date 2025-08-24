use crate::{config::Config, ModelInfo, Dataset, ModelMetadata, DatasetMetadata, ModelType, MLFramework, ModelStatus, DatasetType, DatasetFormat, HardwareRequirements};
use anyhow::Result;
use axum::extract::Multipart;
use chrono::Utc;
use std::{collections::HashMap, path::Path};
use tokio::{fs, io::AsyncWriteExt};
use tracing::{debug, error, info, warn};
use uuid::Uuid;
use sha2::{Sha256, Digest};

pub struct ModelManager {
    config: Config,
}

impl ModelManager {
    pub async fn new(config: &Config) -> Result<Self> {
        Ok(Self {
            config: config.clone(),
        })
    }

    pub async fn upload_model(&mut self, mut multipart: Multipart) -> Result<ModelInfo> {
        let model_id = Uuid::new_v4().to_string();
        let model_dir = self.config.get_model_path(&model_id);
        fs::create_dir_all(&model_dir).await?;
        
        let mut model_info = ModelInfo {
            id: model_id.clone(),
            name: "".to_string(),
            version: "1.0.0".to_string(),
            model_type: ModelType::Custom,
            framework: MLFramework::Custom,
            status: ModelStatus::Uploading,
            file_path: None,
            file_size: 0,
            checksum: "".to_string(),
            metadata: ModelMetadata {
                description: None,
                author: None,
                license: None,
                tags: Vec::new(),
                parameters: HashMap::new(),
                performance_metrics: HashMap::new(),
                hardware_requirements: HardwareRequirements {
                    min_memory_gb: 1.0,
                    recommended_memory_gb: 4.0,
                    gpu_required: false,
                    gpu_memory_gb: None,
                    cpu_cores: Some(2),
                    storage_gb: 1.0,
                },
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        info!("Starting model upload: {}", model_id);

        let mut model_file_path = None;
        let mut total_size = 0u64;
        let mut hasher = Sha256::new();

        while let Some(field) = multipart.next_field().await? {
            let field_name = field.name().unwrap_or("unknown").to_string();
            
            match field_name.as_str() {
                "model_file" => {
                    let filename = field.file_name()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "model.bin".to_string());
                    
                    let file_path = model_dir.join(&filename);
                    let mut file = fs::File::create(&file_path).await?;
                    
                    let bytes = field.bytes().await?;
                    total_size += bytes.len() as u64;
                    
                    // Check file size limit
                    if total_size > (self.config.storage.max_model_size_gb * 1024.0 * 1024.0 * 1024.0) as u64 {
                        return Err(anyhow::anyhow!("Model file too large"));
                    }
                    
                    hasher.update(&bytes);
                    file.write_all(&bytes).await?;
                    
                    model_file_path = Some(file_path.to_string_lossy().to_string());
                    info!("Uploaded model file: {} ({} bytes)", filename, bytes.len());
                },
                "name" => {
                    let bytes = field.bytes().await?;
                    model_info.name = String::from_utf8(bytes.to_vec())?;
                },
                "description" => {
                    let bytes = field.bytes().await?;
                    model_info.metadata.description = Some(String::from_utf8(bytes.to_vec())?);
                },
                "model_type" => {
                    let bytes = field.bytes().await?;
                    let type_str = String::from_utf8(bytes.to_vec())?;
                    model_info.model_type = match type_str.as_str() {
                        "language_model" => ModelType::LanguageModel,
                        "embedding_model" => ModelType::EmbeddingModel,
                        "vision_model" => ModelType::VisionModel,
                        "audio_model" => ModelType::AudioModel,
                        "multimodal" => ModelType::Multimodal,
                        _ => ModelType::Custom,
                    };
                },
                "framework" => {
                    let bytes = field.bytes().await?;
                    let framework_str = String::from_utf8(bytes.to_vec())?;
                    model_info.framework = match framework_str.as_str() {
                        "pytorch" => MLFramework::PyTorch,
                        "tensorflow" => MLFramework::TensorFlow,
                        "onnx" => MLFramework::ONNX,
                        "huggingface" => MLFramework::HuggingFace,
                        "candle" => MLFramework::Candle,
                        "mlx" => MLFramework::MLX,
                        _ => MLFramework::Custom,
                    };
                },
                "author" => {
                    let bytes = field.bytes().await?;
                    model_info.metadata.author = Some(String::from_utf8(bytes.to_vec())?);
                },
                "license" => {
                    let bytes = field.bytes().await?;
                    model_info.metadata.license = Some(String::from_utf8(bytes.to_vec())?);
                },
                "version" => {
                    let bytes = field.bytes().await?;
                    model_info.version = String::from_utf8(bytes.to_vec())?;
                },
                _ => {
                    debug!("Ignoring unknown field: {}", field_name);
                }
            }
        }

        if model_file_path.is_none() {
            return Err(anyhow::anyhow!("No model file provided"));
        }

        model_info.file_path = model_file_path;
        model_info.file_size = total_size;
        model_info.checksum = format!("{:x}", hasher.finalize());
        model_info.status = ModelStatus::Processing;

        // Analyze model
        self.analyze_model(&mut model_info).await?;
        
        model_info.status = ModelStatus::Ready;
        model_info.updated_at = Utc::now();

        info!("Model upload completed: {} ({})", model_info.name, model_info.id);
        Ok(model_info)
    }

    pub async fn delete_model(&mut self, model_id: &str) -> Result<()> {
        let model_dir = self.config.get_model_path(model_id);
        
        if model_dir.exists() {
            fs::remove_dir_all(&model_dir).await?;
            info!("Deleted model directory: {:?}", model_dir);
        }

        Ok(())
    }

    async fn analyze_model(&self, model_info: &mut ModelInfo) -> Result<()> {
        info!("Analyzing model: {}", model_info.id);
        
        if let Some(file_path) = &model_info.file_path {
            let path = Path::new(file_path);
            
            // Determine model type based on file extension or content
            if let Some(extension) = path.extension() {
                match extension.to_str() {
                    Some("safetensors") | Some("bin") => {
                        model_info.framework = MLFramework::HuggingFace;
                        self.analyze_huggingface_model(model_info).await?;
                    },
                    Some("onnx") => {
                        model_info.framework = MLFramework::ONNX;
                        self.analyze_onnx_model(model_info).await?;
                    },
                    Some("pt") | Some("pth") => {
                        model_info.framework = MLFramework::PyTorch;
                        self.analyze_pytorch_model(model_info).await?;
                    },
                    Some("pb") => {
                        model_info.framework = MLFramework::TensorFlow;
                        self.analyze_tensorflow_model(model_info).await?;
                    },
                    Some("mlpackage") => {
                        model_info.framework = MLFramework::MLX;
                        self.analyze_mlx_model(model_info).await?;
                    },
                    _ => {
                        warn!("Unknown model format for file: {}", file_path);
                    }
                }
            }

            // Set hardware requirements based on model size and type
            self.estimate_hardware_requirements(model_info);
        }

        Ok(())
    }

    async fn analyze_huggingface_model(&self, model_info: &mut ModelInfo) -> Result<()> {
        // Basic analysis for HuggingFace models
        if model_info.file_size > 1024 * 1024 * 1024 { // > 1GB
            model_info.model_type = ModelType::LanguageModel;
        } else if model_info.file_size > 100 * 1024 * 1024 { // > 100MB
            model_info.model_type = ModelType::EmbeddingModel;
        }

        model_info.metadata.parameters.insert(
            "estimated_parameters".to_string(),
            serde_json::Value::Number(serde_json::Number::from((model_info.file_size / 1024 / 1024) as u64)),
        );

        Ok(())
    }

    async fn analyze_onnx_model(&self, _model_info: &mut ModelInfo) -> Result<()> {
        // ONNX model analysis would go here
        Ok(())
    }

    async fn analyze_pytorch_model(&self, _model_info: &mut ModelInfo) -> Result<()> {
        // PyTorch model analysis would go here
        Ok(())
    }

    async fn analyze_tensorflow_model(&self, _model_info: &mut ModelInfo) -> Result<()> {
        // TensorFlow model analysis would go here
        Ok(())
    }

    async fn analyze_mlx_model(&self, model_info: &mut ModelInfo) -> Result<()> {
        if cfg!(target_os = "macos") {
            // MLX model analysis for Apple Silicon
            model_info.metadata.parameters.insert(
                "device".to_string(),
                serde_json::Value::String("mps".to_string()),
            );
        }
        Ok(())
    }

    fn estimate_hardware_requirements(&self, model_info: &mut ModelInfo) {
        let size_gb = model_info.file_size as f64 / (1024.0 * 1024.0 * 1024.0);
        
        model_info.metadata.hardware_requirements = HardwareRequirements {
            min_memory_gb: (size_gb * 1.2).max(1.0),
            recommended_memory_gb: (size_gb * 2.0).max(4.0),
            gpu_required: size_gb > 0.5,
            gpu_memory_gb: if size_gb > 0.5 { Some((size_gb * 1.5).max(2.0)) } else { None },
            cpu_cores: Some(if size_gb > 2.0 { 8 } else { 4 }),
            storage_gb: size_gb * 1.1,
        };
    }

    pub async fn upload_dataset(&mut self, mut multipart: Multipart) -> Result<Dataset> {
        let dataset_id = Uuid::new_v4().to_string();
        let dataset_dir = self.config.get_dataset_path(&dataset_id);
        fs::create_dir_all(&dataset_dir).await?;
        
        let mut dataset = Dataset {
            id: dataset_id.clone(),
            name: "".to_string(),
            dataset_type: DatasetType::Text,
            format: DatasetFormat::JSON,
            size: 0,
            sample_count: 0,
            file_path: "".to_string(),
            metadata: DatasetMetadata {
                description: None,
                source: None,
                license: None,
                schema: None,
                statistics: HashMap::new(),
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        info!("Starting dataset upload: {}", dataset_id);

        while let Some(field) = multipart.next_field().await? {
            let field_name = field.name().unwrap_or("unknown").to_string();
            
            match field_name.as_str() {
                "dataset_file" => {
                    let filename = field.file_name()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "dataset.json".to_string());
                    
                    let file_path = dataset_dir.join(&filename);
                    let mut file = fs::File::create(&file_path).await?;
                    
                    let bytes = field.bytes().await?;
                    
                    if bytes.len() > (self.config.storage.max_dataset_size_gb * 1024.0 * 1024.0 * 1024.0) as usize {
                        return Err(anyhow::anyhow!("Dataset file too large"));
                    }
                    
                    file.write_all(&bytes).await?;
                    
                    dataset.file_path = file_path.to_string_lossy().to_string();
                    dataset.size = bytes.len() as u64;
                    
                    // Determine format from filename
                    if filename.ends_with(".json") {
                        dataset.format = DatasetFormat::JSON;
                    } else if filename.ends_with(".jsonl") {
                        dataset.format = DatasetFormat::JSONL;
                    } else if filename.ends_with(".csv") {
                        dataset.format = DatasetFormat::CSV;
                    } else if filename.ends_with(".parquet") {
                        dataset.format = DatasetFormat::Parquet;
                    }
                    
                    info!("Uploaded dataset file: {} ({} bytes)", filename, bytes.len());
                },
                "name" => {
                    let bytes = field.bytes().await?;
                    dataset.name = String::from_utf8(bytes.to_vec())?;
                },
                "description" => {
                    let bytes = field.bytes().await?;
                    dataset.metadata.description = Some(String::from_utf8(bytes.to_vec())?);
                },
                "dataset_type" => {
                    let bytes = field.bytes().await?;
                    let type_str = String::from_utf8(bytes.to_vec())?;
                    dataset.dataset_type = match type_str.as_str() {
                        "text" => DatasetType::Text,
                        "image" => DatasetType::Image,
                        "audio" => DatasetType::Audio,
                        "multimodal" => DatasetType::Multimodal,
                        "structured" => DatasetType::Structured,
                        _ => DatasetType::Text,
                    };
                },
                _ => {
                    debug!("Ignoring unknown field: {}", field_name);
                }
            }
        }

        // Analyze dataset
        self.analyze_dataset(&mut dataset).await?;

        info!("Dataset upload completed: {} ({})", dataset.name, dataset.id);
        Ok(dataset)
    }

    async fn analyze_dataset(&self, dataset: &mut Dataset) -> Result<()> {
        info!("Analyzing dataset: {}", dataset.id);
        
        // Basic analysis - count samples, validate format
        match dataset.format {
            DatasetFormat::JSON => {
                if let Ok(content) = fs::read_to_string(&dataset.file_path).await {
                    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(array) = json_value.as_array() {
                            dataset.sample_count = array.len() as u32;
                        }
                    }
                }
            },
            DatasetFormat::JSONL => {
                if let Ok(content) = fs::read_to_string(&dataset.file_path).await {
                    dataset.sample_count = content.lines().count() as u32;
                }
            },
            DatasetFormat::CSV => {
                if let Ok(content) = fs::read_to_string(&dataset.file_path).await {
                    let line_count = content.lines().count();
                    dataset.sample_count = if line_count > 0 { line_count as u32 - 1 } else { 0 }; // Exclude header
                }
            },
            _ => {
                // For other formats, we'll estimate
                dataset.sample_count = (dataset.size / 100) as u32; // Rough estimate
            }
        }

        dataset.metadata.statistics.insert(
            "file_size_bytes".to_string(),
            serde_json::Value::Number(serde_json::Number::from(dataset.size)),
        );
        dataset.metadata.statistics.insert(
            "estimated_samples".to_string(),
            serde_json::Value::Number(serde_json::Number::from(dataset.sample_count)),
        );

        Ok(())
    }
}
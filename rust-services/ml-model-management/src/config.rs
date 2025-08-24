use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub ml: MLConfig,
    pub storage: StorageConfig,
    pub database: DatabaseConfig,
    pub cache: CacheConfig,
    pub training: TrainingConfig,
    pub inference: InferenceConfig,
    pub monitoring: MonitoringConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
    pub request_timeout_seconds: u64,
    pub max_request_size_mb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLConfig {
    pub frameworks: Vec<String>,
    pub model_cache_size: u64,
    pub max_concurrent_inferences: usize,
    pub default_device: String,
    pub enable_gpu: bool,
    pub enable_quantization: bool,
    pub mlx_enabled: bool,
    pub huggingface_cache_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub models_dir: PathBuf,
    pub datasets_dir: PathBuf,
    pub checkpoints_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub max_model_size_gb: f64,
    pub max_dataset_size_gb: f64,
    pub cleanup_interval_hours: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub connection_timeout_seconds: u64,
    pub enable_migrations: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub redis_url: String,
    pub default_ttl_seconds: u64,
    pub max_memory_mb: u64,
    pub eviction_policy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingConfig {
    pub max_concurrent_jobs: usize,
    pub default_checkpoint_frequency: u32,
    pub max_training_time_hours: u64,
    pub enable_distributed_training: bool,
    pub auto_resume: bool,
    pub resource_limits: ResourceLimits,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub memory_gb: f64,
    pub cpu_cores: u32,
    pub gpu_memory_gb: Option<f64>,
    pub storage_gb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceConfig {
    pub max_batch_size: u32,
    pub default_timeout_seconds: u64,
    pub enable_streaming: bool,
    pub cache_predictions: bool,
    pub auto_scale: bool,
    pub warm_models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub enable_metrics: bool,
    pub metrics_port: u16,
    pub enable_tracing: bool,
    pub log_level: String,
    pub health_check_interval_seconds: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 8088,
                workers: num_cpus::get(),
                request_timeout_seconds: 300,
                max_request_size_mb: 1024,
            },
            ml: MLConfig {
                frameworks: vec![
                    "pytorch".to_string(),
                    "huggingface".to_string(),
                    "candle".to_string(),
                    "mlx".to_string(),
                ],
                model_cache_size: 10 * 1024 * 1024 * 1024, // 10GB
                max_concurrent_inferences: 10,
                default_device: "auto".to_string(),
                enable_gpu: true,
                enable_quantization: true,
                mlx_enabled: cfg!(target_os = "macos"),
                huggingface_cache_dir: PathBuf::from("./models/huggingface_cache"),
            },
            storage: StorageConfig {
                models_dir: PathBuf::from("./storage/models"),
                datasets_dir: PathBuf::from("./storage/datasets"),
                checkpoints_dir: PathBuf::from("./storage/checkpoints"),
                temp_dir: PathBuf::from("./storage/temp"),
                max_model_size_gb: 50.0,
                max_dataset_size_gb: 100.0,
                cleanup_interval_hours: 24,
            },
            database: DatabaseConfig {
                url: std::env::var("DATABASE_URL")
                    .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/ml_models".to_string()),
                max_connections: 20,
                connection_timeout_seconds: 30,
                enable_migrations: true,
            },
            cache: CacheConfig {
                redis_url: std::env::var("REDIS_URL")
                    .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
                default_ttl_seconds: 3600,
                max_memory_mb: 512,
                eviction_policy: "allkeys-lru".to_string(),
            },
            training: TrainingConfig {
                max_concurrent_jobs: 3,
                default_checkpoint_frequency: 100,
                max_training_time_hours: 24,
                enable_distributed_training: false,
                auto_resume: true,
                resource_limits: ResourceLimits {
                    memory_gb: 32.0,
                    cpu_cores: 8,
                    gpu_memory_gb: Some(16.0),
                    storage_gb: 500.0,
                },
            },
            inference: InferenceConfig {
                max_batch_size: 32,
                default_timeout_seconds: 60,
                enable_streaming: true,
                cache_predictions: false,
                auto_scale: true,
                warm_models: Vec::new(),
            },
            monitoring: MonitoringConfig {
                enable_metrics: true,
                metrics_port: 9090,
                enable_tracing: true,
                log_level: "info".to_string(),
                health_check_interval_seconds: 30,
            },
        }
    }
}

impl Config {
    pub async fn new() -> Result<Self> {
        let config_path = std::env::var("ML_CONFIG_PATH")
            .unwrap_or_else(|_| "./config/ml-model-management.toml".to_string());
        
        if std::path::Path::new(&config_path).exists() {
            Self::from_file(&config_path).await
        } else {
            tracing::info!("Config file not found, using default configuration");
            Ok(Self::default())
        }
    }

    pub async fn from_file(path: &str) -> Result<Self> {
        let content = tokio::fs::read_to_string(path).await?;
        let config: Config = toml::from_str(&content)?;
        
        config.ensure_directories().await?;
        
        tracing::info!("Configuration loaded from: {}", path);
        Ok(config)
    }

    async fn ensure_directories(&self) -> Result<()> {
        // Create storage directories
        for dir in [
            &self.storage.models_dir,
            &self.storage.datasets_dir,
            &self.storage.checkpoints_dir,
            &self.storage.temp_dir,
            &self.ml.huggingface_cache_dir,
        ] {
            if !dir.exists() {
                tokio::fs::create_dir_all(dir).await?;
                tracing::info!("Created directory: {:?}", dir);
            }
        }

        Ok(())
    }

    pub fn validate(&self) -> Result<()> {
        if self.server.port == 0 {
            return Err(anyhow::anyhow!("Server port must be greater than 0"));
        }

        if self.server.workers == 0 {
            return Err(anyhow::anyhow!("Server workers must be greater than 0"));
        }

        if self.ml.max_concurrent_inferences == 0 {
            return Err(anyhow::anyhow!("Max concurrent inferences must be greater than 0"));
        }

        if self.training.max_concurrent_jobs == 0 {
            return Err(anyhow::anyhow!("Max concurrent training jobs must be greater than 0"));
        }

        if self.storage.max_model_size_gb <= 0.0 {
            return Err(anyhow::anyhow!("Max model size must be greater than 0"));
        }

        if self.storage.max_dataset_size_gb <= 0.0 {
            return Err(anyhow::anyhow!("Max dataset size must be greater than 0"));
        }

        if self.database.max_connections == 0 {
            return Err(anyhow::anyhow!("Database max connections must be greater than 0"));
        }

        Ok(())
    }

    pub fn get_model_path(&self, model_id: &str) -> PathBuf {
        self.storage.models_dir.join(model_id)
    }

    pub fn get_dataset_path(&self, dataset_id: &str) -> PathBuf {
        self.storage.datasets_dir.join(dataset_id)
    }

    pub fn get_checkpoint_path(&self, job_id: &str) -> PathBuf {
        self.storage.checkpoints_dir.join(job_id)
    }

    pub fn get_temp_path(&self, id: &str) -> PathBuf {
        self.storage.temp_dir.join(id)
    }

    pub fn is_mlx_enabled(&self) -> bool {
        self.ml.mlx_enabled && cfg!(target_os = "macos")
    }

    pub fn get_device(&self) -> String {
        if self.ml.enable_gpu && self.is_mlx_enabled() {
            "mps".to_string() // Apple Metal Performance Shaders
        } else if self.ml.enable_gpu {
            "cuda".to_string()
        } else {
            "cpu".to_string()
        }
    }
}
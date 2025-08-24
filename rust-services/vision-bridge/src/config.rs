use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::env;

/// Vision Bridge Service Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionConfig {
    pub server: ServerConfig,
    pub python: PythonConfig,
    pub models: ModelConfig,
    pub cache: CacheConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub timeout_seconds: u64,
    pub max_retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub yolo_model: String,
    pub clip_model: String,
    pub sd_model: String,
    pub cache_dir: String,
    pub device: String,
    pub use_metal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub max_size: u64,
    pub ttl_seconds: u64,
    pub enable_persistence: bool,
}

impl Default for VisionConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8084,
                workers: num_cpus::get(),
            },
            python: PythonConfig {
                enabled: true,
                endpoint: "http://localhost:8000".to_string(),
                timeout_seconds: 30,
                max_retries: 3,
            },
            models: ModelConfig {
                yolo_model: "yolo-v8n".to_string(),
                clip_model: "clip-vit-b32".to_string(),
                sd_model: "sd3b".to_string(),
                cache_dir: "/tmp/vision-models".to_string(),
                device: "auto".to_string(),
                use_metal: cfg!(target_os = "macos"),
            },
            cache: CacheConfig {
                max_size: 1000,
                ttl_seconds: 3600, // 1 hour
                enable_persistence: false,
            },
        }
    }
}

impl VisionConfig {
    /// Load configuration from environment variables and defaults
    pub fn load() -> Result<Self> {
        let mut config = Self::default();

        // Server configuration
        if let Ok(port) = env::var("VISION_BRIDGE_PORT") {
            config.server.port = port.parse()?;
        }
        
        if let Ok(host) = env::var("VISION_BRIDGE_HOST") {
            config.server.host = host;
        }

        if let Ok(workers) = env::var("VISION_BRIDGE_WORKERS") {
            config.server.workers = workers.parse()?;
        }

        // Python configuration
        if let Ok(enabled) = env::var("PYTHON_BRIDGE_ENABLED") {
            config.python.enabled = enabled.parse().unwrap_or(true);
        }

        if let Ok(endpoint) = env::var("PYTHON_VISION_ENDPOINT") {
            config.python.endpoint = endpoint;
        }

        if let Ok(timeout) = env::var("PYTHON_TIMEOUT_SECONDS") {
            config.python.timeout_seconds = timeout.parse()?;
        }

        // Model configuration
        if let Ok(device) = env::var("VISION_DEVICE") {
            config.models.device = device;
        }

        if let Ok(cache_dir) = env::var("MODEL_CACHE_DIR") {
            config.models.cache_dir = cache_dir;
        }

        // Cache configuration
        if let Ok(max_size) = env::var("VISION_CACHE_MAX_SIZE") {
            config.cache.max_size = max_size.parse()?;
        }

        if let Ok(ttl) = env::var("VISION_CACHE_TTL_SECONDS") {
            config.cache.ttl_seconds = ttl.parse()?;
        }

        Ok(config)
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        if self.server.port == 0 {
            anyhow::bail!("Server port must be greater than 0");
        }

        if self.server.workers == 0 {
            anyhow::bail!("Worker count must be greater than 0");
        }

        if self.python.enabled && self.python.endpoint.is_empty() {
            anyhow::bail!("Python bridge enabled but no endpoint specified");
        }

        if self.python.timeout_seconds == 0 {
            anyhow::bail!("Python timeout must be greater than 0");
        }

        if self.cache.max_size == 0 {
            anyhow::bail!("Cache max size must be greater than 0");
        }

        Ok(())
    }
}
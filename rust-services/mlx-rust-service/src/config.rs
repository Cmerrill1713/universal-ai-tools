use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub mlx: MLXConfig,
    pub logging: LoggingConfig,
    pub metrics: MetricsConfig,
    pub health: HealthConfig,
    pub python: PythonConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub grpc_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MLXConfig {
    pub model_path: String,
    pub device: String,
    pub max_tokens: usize,
    pub temperature: f32,
    pub top_p: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub format: String,
    pub enable_console: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    pub enable: bool,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthConfig {
    pub enable: bool,
    pub check_interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PythonConfig {
    pub enable_ffi: bool,
    pub python_path: String,
}

impl Config {
    pub fn load() -> crate::error::Result<Self> {
        let config_path = std::env::var("CONFIG_PATH")
            .unwrap_or_else(|_| "config/default.toml".to_string());

        let config = config::Config::builder()
            .add_source(config::File::with_name(&config_path))
            .add_source(config::Environment::with_prefix("MLX"))
            .build()
            .map_err(|e| crate::error::MLXError::Config(e.to_string()))?;

        config
            .try_deserialize()
            .map_err(|e| crate::error::MLXError::Config(e.to_string()))
    }
}
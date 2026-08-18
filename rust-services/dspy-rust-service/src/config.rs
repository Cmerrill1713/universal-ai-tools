use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub dspy: DSPyConfig,
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
pub struct DSPyConfig {
    pub max_agents: usize,
    pub orchestration_timeout: u64,
    pub reasoning_depth: u32,
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
            .add_source(config::Environment::with_prefix("DSPY"))
            .build()
            .map_err(|e| crate::error::DSPyError::Config(e.to_string()))?;

        config
            .try_deserialize()
            .map_err(|e| crate::error::DSPyError::Config(e.to_string()))
    }
}
// Configuration management for the vector database service

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::types::VectorConfig;

/// Main application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub vector: VectorConfig,
    pub storage: StorageConfig,
    pub gpu: GPUConfig,
    pub metrics: MetricsConfig,
    pub logging: LoggingConfig,
}

/// HTTP server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: Option<usize>,
    pub max_connections: usize,
    pub timeout_seconds: u64,
    pub cors_origins: Vec<String>,
}

/// Storage backend configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub backend: StorageBackend,
    pub postgres_url: Option<String>,
    pub redis_url: Option<String>,
    pub qdrant_url: Option<String>,
    pub local_path: Option<String>,
    pub backup_enabled: bool,
    pub backup_interval_hours: u64,
}

/// Storage backend options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageBackend {
    Memory,
    Local,
    Postgres,
    Qdrant,
    Hybrid,
}

/// GPU acceleration configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GPUConfig {
    pub enabled: bool,
    pub device_id: Option<u32>,
    pub max_memory_mb: Option<usize>,
    pub batch_threshold: usize,
    pub fallback_cpu: bool,
}

/// Metrics and monitoring configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub update_interval_seconds: u64,
    pub prometheus_port: Option<u16>,
    pub opentelemetry_endpoint: Option<String>,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub format: LogFormat,
    pub file_path: Option<String>,
    pub max_file_size_mb: usize,
    pub max_files: usize,
}

/// Log output formats
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogFormat {
    Json,
    Pretty,
    Compact,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8082,
                workers: None,
                max_connections: 1000,
                timeout_seconds: 30,
                cors_origins: vec!["*".to_string()],
            },
            vector: VectorConfig::default(),
            storage: StorageConfig {
                backend: StorageBackend::Hybrid,
                postgres_url: None,
                redis_url: Some("redis://localhost:6379".to_string()),
                qdrant_url: Some("http://localhost:6333".to_string()),
                local_path: Some("./vector_data".to_string()),
                backup_enabled: true,
                backup_interval_hours: 24,
            },
            gpu: GPUConfig {
                enabled: true,
                device_id: None,
                max_memory_mb: None,
                batch_threshold: 100,
                fallback_cpu: true,
            },
            metrics: MetricsConfig {
                enabled: true,
                endpoint: "/metrics".to_string(),
                update_interval_seconds: 60,
                prometheus_port: Some(9090),
                opentelemetry_endpoint: Some("http://localhost:4317".to_string()),
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                format: LogFormat::Json,
                file_path: None,
                max_file_size_mb: 100,
                max_files: 10,
            },
        }
    }
}

impl Config {
    /// Load configuration from file with environment variable overrides
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        
        // Start with defaults
        let mut config = if path.exists() {
            let content = std::fs::read_to_string(path)?;
            toml::from_str(&content)?
        } else {
            tracing::warn!("Config file {:?} not found, using defaults", path);
            Self::default()
        };
        
        // Override with environment variables
        config.apply_env_overrides();
        
        // Validate configuration
        config.validate()?;
        
        Ok(config)
    }
    
    /// Apply environment variable overrides
    fn apply_env_overrides(&mut self) {
        if let Ok(port) = std::env::var("VECTOR_DB_PORT") {
            if let Ok(port) = port.parse() {
                self.server.port = port;
            }
        }
        
        if let Ok(host) = std::env::var("VECTOR_DB_HOST") {
            self.server.host = host;
        }
        
        if let Ok(dimensions) = std::env::var("VECTOR_DIMENSIONS") {
            if let Ok(dimensions) = dimensions.parse() {
                self.vector.dimensions = dimensions;
            }
        }
        
        if let Ok(gpu_enabled) = std::env::var("GPU_ACCELERATION") {
            self.gpu.enabled = gpu_enabled.to_lowercase() == "true";
        }
        
        if let Ok(postgres_url) = std::env::var("POSTGRES_URL") {
            self.storage.postgres_url = Some(postgres_url);
        }
        
        if let Ok(redis_url) = std::env::var("REDIS_URL") {
            self.storage.redis_url = Some(redis_url);
        }
        
        if let Ok(qdrant_url) = std::env::var("QDRANT_URL") {
            self.storage.qdrant_url = Some(qdrant_url);
        }
        
        if let Ok(log_level) = std::env::var("LOG_LEVEL") {
            self.logging.level = log_level;
        }
        
        if let Ok(otel_endpoint) = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT") {
            self.metrics.opentelemetry_endpoint = Some(otel_endpoint);
        }
    }
    
    /// Validate configuration values
    fn validate(&self) -> Result<()> {
        if self.server.port == 0 {
            return Err(anyhow::anyhow!("Server port must be greater than 0"));
        }
        
        if self.vector.dimensions == 0 {
            return Err(anyhow::anyhow!("Vector dimensions must be greater than 0"));
        }
        
        if self.vector.dimensions > 8192 {
            return Err(anyhow::anyhow!("Vector dimensions cannot exceed 8192"));
        }
        
        if self.server.max_connections == 0 {
            return Err(anyhow::anyhow!("Max connections must be greater than 0"));
        }
        
        if self.gpu.batch_threshold == 0 {
            return Err(anyhow::anyhow!("GPU batch threshold must be greater than 0"));
        }
        
        // Validate storage backend configuration
        match self.storage.backend {
            StorageBackend::Postgres => {
                if self.storage.postgres_url.is_none() {
                    return Err(anyhow::anyhow!("Postgres URL required for Postgres backend"));
                }
            }
            StorageBackend::Qdrant => {
                if self.storage.qdrant_url.is_none() {
                    return Err(anyhow::anyhow!("Qdrant URL required for Qdrant backend"));
                }
            }
            StorageBackend::Local => {
                if self.storage.local_path.is_none() {
                    return Err(anyhow::anyhow!("Local path required for Local backend"));
                }
            }
            StorageBackend::Hybrid | StorageBackend::Memory => {
                // These backends don't require specific validation
            }
        }
        
        Ok(())
    }
    
    /// Get database URL based on storage backend
    pub fn get_database_url(&self) -> Option<&str> {
        match self.storage.backend {
            StorageBackend::Postgres | StorageBackend::Hybrid => {
                self.storage.postgres_url.as_deref()
            }
            _ => None,
        }
    }
    
    /// Get Redis URL if configured
    pub fn get_redis_url(&self) -> Option<&str> {
        self.storage.redis_url.as_deref()
    }
    
    /// Get Qdrant URL if configured
    pub fn get_qdrant_url(&self) -> Option<&str> {
        self.storage.qdrant_url.as_deref()
    }
    
    /// Check if GPU acceleration is enabled and available
    pub fn is_gpu_enabled(&self) -> bool {
        self.gpu.enabled && cfg!(feature = "metal-acceleration")
    }
    
    /// Get optimal batch size for operations
    pub fn get_batch_size(&self) -> usize {
        if self.is_gpu_enabled() {
            self.vector.batch_size.max(self.gpu.batch_threshold)
        } else {
            self.vector.batch_size.min(100) // Smaller batches for CPU
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.server.port, 8082);
        assert_eq!(config.vector.dimensions, 768);
        assert!(config.gpu.enabled);
    }

    #[test]
    fn test_config_validation() {
        let mut config = Config::default();
        config.server.port = 0;
        assert!(config.validate().is_err());
        
        config.server.port = 8080;
        config.vector.dimensions = 0;
        assert!(config.validate().is_err());
        
        config.vector.dimensions = 10000;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_config_from_file() -> Result<()> {
        let mut temp_file = NamedTempFile::new()?;
        writeln!(temp_file, r#"
        [server]
        port = 9090
        host = "127.0.0.1"
        
        [vector]
        dimensions = 512
        
        [gpu]
        enabled = false
        "#)?;
        
        let config = Config::load(temp_file.path())?;
        assert_eq!(config.server.port, 9090);
        assert_eq!(config.server.host, "127.0.0.1");
        assert_eq!(config.vector.dimensions, 512);
        assert!(!config.gpu.enabled);
        
        Ok(())
    }
}
//! Configuration management for the Agent Registry Service

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{env, time::Instant};

/// Agent Registry service configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Server listening port
    pub port: u16,
    
    /// Database connection URL
    pub database_url: String,
    
    /// Redis connection URL for caching
    pub redis_url: Option<String>,
    
    /// Maximum number of concurrent agent executions
    pub max_concurrent_executions: usize,
    
    /// Default agent execution timeout in seconds
    pub default_execution_timeout_seconds: u64,
    
    /// Agent health check interval in seconds
    pub health_check_interval_seconds: u64,
    
    /// Inactive agent cleanup interval in seconds
    pub cleanup_interval_seconds: u64,
    
    /// Maximum agent execution history to retain
    pub max_execution_history: usize,
    
    /// OpenTelemetry configuration
    pub telemetry: TelemetryConfig,
    
    /// Security configuration
    pub security: SecurityConfig,
    
    /// Performance configuration
    pub performance: PerformanceConfig,
    
    /// Service start time for uptime calculations
    #[serde(skip, default = "Instant::now")]
    pub start_time: Instant,
}

/// OpenTelemetry and observability configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryConfig {
    /// OTLP endpoint for traces and metrics
    pub otlp_endpoint: String,
    
    /// Service name for telemetry
    pub service_name: String,
    
    /// Service version
    pub service_version: String,
    
    /// Environment (development, staging, production)
    pub environment: String,
    
    /// Trace sampling ratio (0.0 to 1.0)
    pub trace_sampling_ratio: f64,
    
    /// Enable metrics collection
    pub enable_metrics: bool,
    
    /// Enable distributed tracing
    pub enable_tracing: bool,
    
    /// Enable structured logging
    pub enable_structured_logging: bool,
}

/// Security configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// JWT secret key for authentication
    pub jwt_secret: String,
    
    /// JWT token expiration time in seconds
    pub jwt_expiration_seconds: u64,
    
    /// API rate limiting (requests per minute)
    pub rate_limit_rpm: u32,
    
    /// Enable CORS
    pub enable_cors: bool,
    
    /// Allowed origins for CORS
    pub cors_origins: Vec<String>,
    
    /// Enable API key authentication
    pub enable_api_key_auth: bool,
    
    /// Valid API keys
    pub valid_api_keys: Vec<String>,
    
    /// Enable request logging
    pub enable_request_logging: bool,
}

/// Performance and resource configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    /// Database connection pool size
    pub db_pool_size: u32,
    
    /// Database connection timeout in seconds
    pub db_connection_timeout_seconds: u64,
    
    /// HTTP client timeout in seconds
    pub http_client_timeout_seconds: u64,
    
    /// Agent cache size (number of agents to keep in memory)
    pub agent_cache_size: usize,
    
    /// Agent cache TTL in seconds
    pub agent_cache_ttl_seconds: u64,
    
    /// Background task interval in seconds
    pub background_task_interval_seconds: u64,
    
    /// Maximum request body size in bytes
    pub max_request_body_size: usize,
    
    /// Enable response compression
    pub enable_compression: bool,
    
    /// Memory limit in MB (for monitoring)
    pub memory_limit_mb: Option<u64>,
    
    /// CPU limit in cores (for monitoring)
    pub cpu_limit_cores: Option<f64>,
}

impl Config {
    /// Load configuration from environment variables
    pub fn load() -> Result<Self> {
        let port = env::var("PORT")
            .unwrap_or_else(|_| "8083".to_string())
            .parse()
            .context("Invalid PORT value")?;

        let database_url = env::var("DATABASE_URL")
            .context("DATABASE_URL environment variable is required")?;

        let redis_url = env::var("REDIS_URL").ok();

        let telemetry = TelemetryConfig {
            otlp_endpoint: env::var("OTLP_ENDPOINT")
                .unwrap_or_else(|_| "http://otel-collector:4317".to_string()),
            service_name: env::var("SERVICE_NAME")
                .unwrap_or_else(|_| "agent-registry".to_string()),
            service_version: env::var("SERVICE_VERSION")
                .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string()),
            environment: env::var("ENVIRONMENT")
                .unwrap_or_else(|_| "development".to_string()),
            trace_sampling_ratio: env::var("TRACE_SAMPLING_RATIO")
                .unwrap_or_else(|_| "1.0".to_string())
                .parse()
                .unwrap_or(1.0),
            enable_metrics: env::var("ENABLE_METRICS")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            enable_tracing: env::var("ENABLE_TRACING")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            enable_structured_logging: env::var("ENABLE_STRUCTURED_LOGGING")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        };

        let security = SecurityConfig {
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "default-secret-change-in-production".to_string()),
            jwt_expiration_seconds: env::var("JWT_EXPIRATION_SECONDS")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()
                .unwrap_or(3600),
            rate_limit_rpm: env::var("RATE_LIMIT_RPM")
                .unwrap_or_else(|_| "1000".to_string())
                .parse()
                .unwrap_or(1000),
            enable_cors: env::var("ENABLE_CORS")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            cors_origins: env::var("CORS_ORIGINS")
                .unwrap_or_else(|_| "*".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            enable_api_key_auth: env::var("ENABLE_API_KEY_AUTH")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            valid_api_keys: env::var("VALID_API_KEYS")
                .unwrap_or_default()
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect(),
            enable_request_logging: env::var("ENABLE_REQUEST_LOGGING")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        };

        let performance = PerformanceConfig {
            db_pool_size: env::var("DB_POOL_SIZE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
            db_connection_timeout_seconds: env::var("DB_CONNECTION_TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
            http_client_timeout_seconds: env::var("HTTP_CLIENT_TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
            agent_cache_size: env::var("AGENT_CACHE_SIZE")
                .unwrap_or_else(|_| "10000".to_string())
                .parse()
                .unwrap_or(10000),
            agent_cache_ttl_seconds: env::var("AGENT_CACHE_TTL_SECONDS")
                .unwrap_or_else(|_| "3600".to_string())
                .parse()
                .unwrap_or(3600),
            background_task_interval_seconds: env::var("BACKGROUND_TASK_INTERVAL_SECONDS")
                .unwrap_or_else(|_| "60".to_string())
                .parse()
                .unwrap_or(60),
            max_request_body_size: env::var("MAX_REQUEST_BODY_SIZE")
                .unwrap_or_else(|_| "10485760".to_string()) // 10MB
                .parse()
                .unwrap_or(10485760),
            enable_compression: env::var("ENABLE_COMPRESSION")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            memory_limit_mb: env::var("MEMORY_LIMIT_MB")
                .ok()
                .and_then(|s| s.parse().ok()),
            cpu_limit_cores: env::var("CPU_LIMIT_CORES")
                .ok()
                .and_then(|s| s.parse().ok()),
        };

        Ok(Self {
            port,
            database_url,
            redis_url,
            max_concurrent_executions: env::var("MAX_CONCURRENT_EXECUTIONS")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
            default_execution_timeout_seconds: env::var("DEFAULT_EXECUTION_TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
            health_check_interval_seconds: env::var("HEALTH_CHECK_INTERVAL_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
            cleanup_interval_seconds: env::var("CLEANUP_INTERVAL_SECONDS")
                .unwrap_or_else(|_| "300".to_string())
                .parse()
                .unwrap_or(300),
            max_execution_history: env::var("MAX_EXECUTION_HISTORY")
                .unwrap_or_else(|_| "10000".to_string())
                .parse()
                .unwrap_or(10000),
            telemetry,
            security,
            performance,
            start_time: Instant::now(),
        })
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        if self.port == 0 {
            return Err(anyhow::anyhow!("Port must be greater than 0"));
        }

        if self.database_url.is_empty() {
            return Err(anyhow::anyhow!("Database URL cannot be empty"));
        }

        if self.max_concurrent_executions == 0 {
            return Err(anyhow::anyhow!("Max concurrent executions must be greater than 0"));
        }

        if self.default_execution_timeout_seconds == 0 {
            return Err(anyhow::anyhow!("Default execution timeout must be greater than 0"));
        }

        if self.telemetry.trace_sampling_ratio < 0.0 || self.telemetry.trace_sampling_ratio > 1.0 {
            return Err(anyhow::anyhow!("Trace sampling ratio must be between 0.0 and 1.0"));
        }

        if self.security.jwt_expiration_seconds == 0 {
            return Err(anyhow::anyhow!("JWT expiration must be greater than 0"));
        }

        if self.performance.db_pool_size == 0 {
            return Err(anyhow::anyhow!("Database pool size must be greater than 0"));
        }

        if self.performance.agent_cache_size == 0 {
            return Err(anyhow::anyhow!("Agent cache size must be greater than 0"));
        }

        Ok(())
    }

    /// Get environment-specific configuration overrides
    pub fn with_environment_overrides(mut self) -> Self {
        match self.telemetry.environment.as_str() {
            "production" => {
                // Production optimizations
                self.telemetry.trace_sampling_ratio = 0.1; // Reduced sampling
                self.performance.agent_cache_size = 50000; // Larger cache
                self.security.enable_request_logging = false; // Reduced logging
            }
            "staging" => {
                // Staging optimizations
                self.telemetry.trace_sampling_ratio = 0.5;
                self.performance.agent_cache_size = 20000;
            }
            "development" => {
                // Development optimizations
                self.telemetry.trace_sampling_ratio = 1.0; // Full sampling
                self.performance.agent_cache_size = 1000; // Smaller cache
                self.security.enable_request_logging = true; // Full logging
            }
            _ => {
                // Default configuration
            }
        }

        self
    }

    /// Get configuration summary for logging
    pub fn summary(&self) -> String {
        format!(
            "Agent Registry Config: port={}, env={}, db_pool={}, cache_size={}, max_concurrent={}",
            self.port,
            self.telemetry.environment,
            self.performance.db_pool_size,
            self.performance.agent_cache_size,
            self.max_concurrent_executions
        )
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: 8083,
            database_url: "postgresql://localhost:5432/agent_registry".to_string(),
            redis_url: None,
            max_concurrent_executions: 100,
            default_execution_timeout_seconds: 30,
            health_check_interval_seconds: 30,
            cleanup_interval_seconds: 300,
            max_execution_history: 10000,
            telemetry: TelemetryConfig {
                otlp_endpoint: "http://otel-collector:4317".to_string(),
                service_name: "agent-registry".to_string(),
                service_version: env!("CARGO_PKG_VERSION").to_string(),
                environment: "development".to_string(),
                trace_sampling_ratio: 1.0,
                enable_metrics: true,
                enable_tracing: true,
                enable_structured_logging: true,
            },
            security: SecurityConfig {
                jwt_secret: "default-secret-change-in-production".to_string(),
                jwt_expiration_seconds: 3600,
                rate_limit_rpm: 1000,
                enable_cors: true,
                cors_origins: vec!["*".to_string()],
                enable_api_key_auth: false,
                valid_api_keys: Vec::new(),
                enable_request_logging: true,
            },
            performance: PerformanceConfig {
                db_pool_size: 10,
                db_connection_timeout_seconds: 30,
                http_client_timeout_seconds: 30,
                agent_cache_size: 10000,
                agent_cache_ttl_seconds: 3600,
                background_task_interval_seconds: 60,
                max_request_body_size: 10485760, // 10MB
                enable_compression: true,
                memory_limit_mb: None,
                cpu_limit_cores: None,
            },
            start_time: Instant::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_validation() {
        let mut config = Config::default();
        assert!(config.validate().is_ok());

        config.port = 0;
        assert!(config.validate().is_err());

        config.port = 8080;
        config.database_url = String::new();
        assert!(config.validate().is_err());

        config.database_url = "postgresql://localhost:5432/test".to_string();
        config.telemetry.trace_sampling_ratio = 1.5;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_environment_overrides() {
        let mut config = Config::default();
        config.telemetry.environment = "production".to_string();
        
        let config = config.with_environment_overrides();
        assert_eq!(config.telemetry.trace_sampling_ratio, 0.1);
        assert_eq!(config.performance.agent_cache_size, 50000);
    }

    #[test]
    fn test_config_summary() {
        let config = Config::default();
        let summary = config.summary();
        assert!(summary.contains("Agent Registry Config"));
        assert!(summary.contains("port=8083"));
    }
}
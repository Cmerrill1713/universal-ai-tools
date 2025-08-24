use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub gateway: GatewayConfig,
    pub load_balancer: LoadBalancerConfig,
    pub health_checker: HealthCheckerConfig,
    pub rate_limiter: RateLimiterConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    pub max_concurrent_requests: usize,
    pub request_timeout_seconds: u64,
    pub retry_attempts: u32,
    pub circuit_breaker_threshold: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadBalancerConfig {
    pub algorithm: String, // "round_robin", "least_connections", "weighted"
    pub health_check_interval_seconds: u64,
    pub unhealthy_threshold: u32,
    pub healthy_threshold: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckerConfig {
    pub interval_seconds: u64,
    pub timeout_seconds: u64,
    pub failure_threshold: u32,
    pub success_threshold: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimiterConfig {
    pub requests_per_minute: u64,
    pub burst_size: u64,
    pub enabled: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                port: 8080,
                host: "127.0.0.1".to_string(),
                timeout_seconds: 30,
            },
            gateway: GatewayConfig {
                max_concurrent_requests: 1000,
                request_timeout_seconds: 30,
                retry_attempts: 3,
                circuit_breaker_threshold: 5,
            },
            load_balancer: LoadBalancerConfig {
                algorithm: "round_robin".to_string(),
                health_check_interval_seconds: 30,
                unhealthy_threshold: 3,
                healthy_threshold: 2,
            },
            health_checker: HealthCheckerConfig {
                interval_seconds: 30,
                timeout_seconds: 10,
                failure_threshold: 3,
                success_threshold: 2,
            },
            rate_limiter: RateLimiterConfig {
                requests_per_minute: 1000,
                burst_size: 100,
                enabled: true,
            },
        }
    }
}

impl Config {
    pub async fn load() -> Result<Self> {
        // Try to load from config file, fall back to defaults
        let config_path = PathBuf::from("config/gateway.yml");
        
        if config_path.exists() {
            let content = tokio::fs::read_to_string(&config_path).await?;
            let config: Config = serde_yaml::from_str(&content)?;
            Ok(config)
        } else {
            tracing::info!("Config file not found, using default configuration");
            Ok(Config::default())
        }
    }
}
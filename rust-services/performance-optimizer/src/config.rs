use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub monitoring: MonitoringConfig,
    pub optimization: OptimizationConfig,
    pub services: HashMap<String, ServiceConfig>,
    pub thresholds: PerformanceThresholds,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub collection_interval_seconds: u64,
    pub analysis_interval_seconds: u64,
    pub retention_hours: u64,
    pub prometheus_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationConfig {
    pub max_concurrent_optimizations: usize,
    pub optimization_timeout_seconds: u64,
    pub auto_optimization_enabled: bool,
    pub safety_mode: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub name: String,
    pub endpoint: String,
    pub health_check: String,
    pub metrics_endpoint: Option<String>,
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceThresholds {
    pub cpu_warning: f64,
    pub cpu_critical: f64,
    pub memory_warning: f64,
    pub memory_critical: f64,
    pub response_time_warning: f64,
    pub response_time_critical: f64,
    pub error_rate_warning: f64,
    pub error_rate_critical: f64,
}

impl Config {
    pub async fn new() -> Result<Self> {
        // Default configuration
        let config = Config {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8085,
                workers: Some(4),
            },
            monitoring: MonitoringConfig {
                collection_interval_seconds: 30,
                analysis_interval_seconds: 60,
                retention_hours: 24,
                prometheus_enabled: true,
            },
            optimization: OptimizationConfig {
                max_concurrent_optimizations: 5,
                optimization_timeout_seconds: 300,
                auto_optimization_enabled: false,
                safety_mode: true,
            },
            services: Self::default_services(),
            thresholds: PerformanceThresholds {
                cpu_warning: 70.0,
                cpu_critical: 90.0,
                memory_warning: 80.0,
                memory_critical: 95.0,
                response_time_warning: 1000.0, // ms
                response_time_critical: 5000.0, // ms
                error_rate_warning: 5.0, // %
                error_rate_critical: 10.0, // %
            },
        };

        Ok(config)
    }

    fn default_services() -> HashMap<String, ServiceConfig> {
        let mut services = HashMap::new();
        
        services.insert("orchestration-hub".to_string(), ServiceConfig {
            name: "orchestration-hub".to_string(),
            endpoint: "http://localhost:8100".to_string(),
            health_check: "http://localhost:8100/health".to_string(),
            metrics_endpoint: None,
            priority: "critical".to_string(),
        });

        services.insert("api-gateway".to_string(), ServiceConfig {
            name: "api-gateway".to_string(),
            endpoint: "http://localhost:8082".to_string(),
            health_check: "http://localhost:8082/api/health".to_string(),
            metrics_endpoint: Some("http://localhost:8082/metrics".to_string()),
            priority: "critical".to_string(),
        });

        services.insert("tech-scanner".to_string(), ServiceConfig {
            name: "tech-scanner".to_string(),
            endpoint: "http://localhost:8084".to_string(),
            health_check: "http://localhost:8084/health".to_string(),
            metrics_endpoint: None,
            priority: "high".to_string(),
        });

        services.insert("llm-router".to_string(), ServiceConfig {
            name: "llm-router".to_string(),
            endpoint: "http://localhost:8080".to_string(),
            health_check: "http://localhost:8080/health".to_string(),
            metrics_endpoint: None,
            priority: "high".to_string(),
        });

        services
    }
}
//! Configuration management for Memory Optimization Service

use serde::{Deserialize, Serialize};
use std::env;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub port: u16,
    pub monitoring_interval_seconds: u64,
    pub optimization_enabled: bool,
    pub auto_optimization_enabled: bool,
    pub memory_pressure_threshold: f64,
    pub gc_threshold_mb: u64,
    pub max_optimization_frequency_minutes: u64,
    pub start_time: Instant,
    
    // OpenTelemetry configuration
    pub otlp_endpoint: String,
    pub service_name: String,
    pub service_version: String,
    pub environment: String,
    
    // Service discovery
    pub service_registry_url: Option<String>,
    pub monitored_services: Vec<String>,
    
    // Optimization settings
    pub aggressive_optimization_threshold: f64,
    pub conservative_optimization_threshold: f64,
    pub max_memory_threshold_mb: u64,
}

impl Config {
    pub fn load() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Config {
            port: env::var("MEMORY_OPTIMIZER_PORT")
                .unwrap_or_else(|_| "8005".to_string())
                .parse()?,
            monitoring_interval_seconds: env::var("MONITORING_INTERVAL_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()?,
            optimization_enabled: env::var("OPTIMIZATION_ENABLED")
                .unwrap_or_else(|_| "true".to_string())
                .parse()?,
            auto_optimization_enabled: env::var("AUTO_OPTIMIZATION_ENABLED")
                .unwrap_or_else(|_| "true".to_string())
                .parse()?,
            memory_pressure_threshold: env::var("MEMORY_PRESSURE_THRESHOLD")
                .unwrap_or_else(|_| "0.8".to_string())
                .parse()?,
            gc_threshold_mb: env::var("GC_THRESHOLD_MB")
                .unwrap_or_else(|_| "1024".to_string())
                .parse()?,
            max_optimization_frequency_minutes: env::var("MAX_OPTIMIZATION_FREQUENCY_MINUTES")
                .unwrap_or_else(|_| "5".to_string())
                .parse()?,
            start_time: Instant::now(),
            
            // OpenTelemetry
            otlp_endpoint: env::var("OTLP_ENDPOINT")
                .unwrap_or_else(|_| "otel-collector:4317".to_string()),
            service_name: env::var("SERVICE_NAME")
                .unwrap_or_else(|_| "memory-optimizer".to_string()),
            service_version: env::var("SERVICE_VERSION")
                .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string()),
            environment: env::var("ENVIRONMENT")
                .unwrap_or_else(|_| "development".to_string()),
            
            // Service discovery
            service_registry_url: env::var("SERVICE_REGISTRY_URL").ok(),
            monitored_services: env::var("MONITORED_SERVICES")
                .unwrap_or_else(|_| "llm-router,websocket-service,go-api-gateway,vector-db".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            
            // Optimization thresholds
            aggressive_optimization_threshold: env::var("AGGRESSIVE_OPTIMIZATION_THRESHOLD")
                .unwrap_or_else(|_| "0.9".to_string())
                .parse()?,
            conservative_optimization_threshold: env::var("CONSERVATIVE_OPTIMIZATION_THRESHOLD")
                .unwrap_or_else(|_| "0.7".to_string())
                .parse()?,
            max_memory_threshold_mb: env::var("MAX_MEMORY_THRESHOLD_MB")
                .unwrap_or_else(|_| "8192".to_string())
                .parse()?,
        })
    }
}
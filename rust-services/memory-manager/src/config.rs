//! Configuration for Memory Management Service

use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Serialize)]
pub struct Config {
    pub port: u16,
    pub environment: String,
    pub memory_thresholds: MemoryThresholds,
    pub optimization: OptimizationConfig,
    pub monitoring: MonitoringConfig,
    #[serde(skip)]
    pub start_time: Instant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryThresholds {
    pub warning_percentage: f64,
    pub critical_percentage: f64,
    pub emergency_percentage: f64,
    pub auto_optimize_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationConfig {
    pub enable_aggressive_mode: bool,
    pub max_optimization_frequency_seconds: u64,
    pub preserve_essential_processes: bool,
    pub target_memory_reduction_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub collection_interval_seconds: u64,
    pub history_retention_count: usize,
    pub enable_detailed_process_info: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            port: 8002,
            environment: "development".to_string(),
            memory_thresholds: MemoryThresholds::default(),
            optimization: OptimizationConfig::default(),
            monitoring: MonitoringConfig::default(),
            start_time: Instant::now(),
        }
    }
}

impl Default for MemoryThresholds {
    fn default() -> Self {
        Self {
            warning_percentage: 75.0,
            critical_percentage: 85.0,
            emergency_percentage: 95.0,
            auto_optimize_threshold: 90.0,
        }
    }
}

impl Default for OptimizationConfig {
    fn default() -> Self {
        Self {
            enable_aggressive_mode: true,
            max_optimization_frequency_seconds: 300, // 5 minutes
            preserve_essential_processes: true,
            target_memory_reduction_percentage: 20.0,
        }
    }
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            collection_interval_seconds: 10,
            history_retention_count: 1000,
            enable_detailed_process_info: true,
        }
    }
}

impl Config {
    /// Load configuration from environment variables with defaults
    pub fn load() -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let mut config = Config::default();

        // Override with environment variables if present
        if let Ok(port) = std::env::var("MEMORY_MANAGER_PORT") {
            config.port = port.parse()?;
        }

        if let Ok(env) = std::env::var("NODE_ENV") {
            config.environment = env;
        }

        // Memory thresholds
        if let Ok(warning) = std::env::var("MEMORY_WARNING_THRESHOLD") {
            config.memory_thresholds.warning_percentage = warning.parse()?;
        }

        if let Ok(critical) = std::env::var("MEMORY_CRITICAL_THRESHOLD") {
            config.memory_thresholds.critical_percentage = critical.parse()?;
        }

        if let Ok(emergency) = std::env::var("MEMORY_EMERGENCY_THRESHOLD") {
            config.memory_thresholds.emergency_percentage = emergency.parse()?;
        }

        // Optimization settings
        if let Ok(aggressive) = std::env::var("ENABLE_AGGRESSIVE_OPTIMIZATION") {
            config.optimization.enable_aggressive_mode = aggressive.parse().unwrap_or(true);
        }

        if let Ok(freq) = std::env::var("OPTIMIZATION_FREQUENCY_SECONDS") {
            config.optimization.max_optimization_frequency_seconds = freq.parse()?;
        }

        // Monitoring settings
        if let Ok(interval) = std::env::var("MONITORING_INTERVAL_SECONDS") {
            config.monitoring.collection_interval_seconds = interval.parse()?;
        }

        Ok(config)
    }
}
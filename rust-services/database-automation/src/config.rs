use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub databases: HashMap<String, DatabaseConfig>,
    pub backup: BackupConfig,
    pub monitoring: MonitoringConfig,
    pub thresholds: ThresholdConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
    pub max_connections: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub database_type: DatabaseType,
    pub connection_string: String,
    pub max_connections: u32,
    pub backup_enabled: bool,
    pub optimization_enabled: bool,
    pub health_check_interval: u64, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DatabaseType {
    #[serde(rename = "postgresql")]
    PostgreSQL,
    #[serde(rename = "mysql")]
    MySQL,
    #[serde(rename = "sqlite")]
    SQLite,
    #[serde(rename = "mongodb")]
    MongoDB,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub storage_path: String,
    pub retention_days: u32,
    pub compression_enabled: bool,
    pub encryption_enabled: bool,
    pub schedule_full: String,      // cron expression
    pub schedule_incremental: String, // cron expression
    pub max_backup_size_gb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub metrics_interval: u64,      // seconds
    pub retention_hours: u32,
    pub alert_thresholds: AlertThresholds,
    pub prometheus_enabled: bool,
    pub prometheus_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertThresholds {
    pub connection_count_warning: u32,
    pub connection_count_critical: u32,
    pub slow_query_threshold_ms: f64,
    pub error_rate_warning: f64,
    pub error_rate_critical: f64,
    pub disk_usage_warning: f64,
    pub disk_usage_critical: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThresholdConfig {
    pub connection_count_warning: u32,
    pub connection_count_critical: u32,
    pub query_time_warning: f64,    // milliseconds
    pub query_time_critical: f64,   // milliseconds
    pub error_rate_warning: f64,    // percentage
    pub error_rate_critical: f64,   // percentage
    pub cache_hit_ratio_warning: f64, // percentage
    pub disk_usage_warning: f64,    // percentage
    pub disk_usage_critical: f64,   // percentage
}

impl Config {
    pub async fn new() -> Result<Self> {
        // Load from environment variables or use defaults
        let config = Self {
            server: ServerConfig {
                host: std::env::var("DATABASE_AUTOMATION_HOST")
                    .unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: std::env::var("DATABASE_AUTOMATION_PORT")
                    .unwrap_or_else(|_| "8086".to_string())
                    .parse()
                    .unwrap_or(8086),
                workers: std::env::var("DATABASE_AUTOMATION_WORKERS")
                    .unwrap_or_else(|_| "4".to_string())
                    .parse()
                    .unwrap_or(4),
                max_connections: 1000,
            },
            databases: Self::load_database_configs().await?,
            backup: BackupConfig {
                storage_path: std::env::var("BACKUP_STORAGE_PATH")
                    .unwrap_or_else(|_| "./backups".to_string()),
                retention_days: 30,
                compression_enabled: true,
                encryption_enabled: true,
                schedule_full: "0 2 * * 0".to_string(), // Weekly full backup at 2 AM Sunday
                schedule_incremental: "0 2 * * 1-6".to_string(), // Daily incremental
                max_backup_size_gb: 100.0,
            },
            monitoring: MonitoringConfig {
                metrics_interval: 30,
                retention_hours: 168, // 1 week
                alert_thresholds: AlertThresholds {
                    connection_count_warning: 80,
                    connection_count_critical: 95,
                    slow_query_threshold_ms: 1000.0,
                    error_rate_warning: 1.0,
                    error_rate_critical: 5.0,
                    disk_usage_warning: 80.0,
                    disk_usage_critical: 90.0,
                },
                prometheus_enabled: true,
                prometheus_port: 9091,
            },
            thresholds: ThresholdConfig {
                connection_count_warning: 80,
                connection_count_critical: 95,
                query_time_warning: 500.0,
                query_time_critical: 1000.0,
                error_rate_warning: 1.0,
                error_rate_critical: 5.0,
                cache_hit_ratio_warning: 85.0,
                disk_usage_warning: 80.0,
                disk_usage_critical: 90.0,
            },
        };

        Ok(config)
    }

    async fn load_database_configs() -> Result<HashMap<String, DatabaseConfig>> {
        let mut databases = HashMap::new();

        // Primary PostgreSQL database
        if let Ok(postgres_url) = std::env::var("POSTGRESQL_URL") {
            databases.insert("primary_postgres".to_string(), DatabaseConfig {
                database_type: DatabaseType::PostgreSQL,
                connection_string: postgres_url,
                max_connections: 20,
                backup_enabled: true,
                optimization_enabled: true,
                health_check_interval: 30,
            });
        }

        // Default development database
        databases.insert("dev_postgres".to_string(), DatabaseConfig {
            database_type: DatabaseType::PostgreSQL,
            connection_string: "postgresql://postgres:postgres@localhost:5432/universal_ai_tools".to_string(),
            max_connections: 10,
            backup_enabled: true,
            optimization_enabled: true,
            health_check_interval: 60,
        });

        // Cache database (Redis as SQLite for demo)
        databases.insert("cache_db".to_string(), DatabaseConfig {
            database_type: DatabaseType::SQLite,
            connection_string: "sqlite:./cache.db".to_string(),
            max_connections: 5,
            backup_enabled: false,
            optimization_enabled: true,
            health_check_interval: 300,
        });

        Ok(databases)
    }

    pub fn get_database_config(&self, database_name: &str) -> Option<&DatabaseConfig> {
        self.databases.get(database_name)
    }

    pub fn get_all_database_names(&self) -> Vec<String> {
        self.databases.keys().cloned().collect()
    }

    pub fn is_backup_enabled(&self, database_name: &str) -> bool {
        self.databases.get(database_name)
            .map(|config| config.backup_enabled)
            .unwrap_or(false)
    }

    pub fn is_optimization_enabled(&self, database_name: &str) -> bool {
        self.databases.get(database_name)
            .map(|config| config.optimization_enabled)
            .unwrap_or(false)
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 8086,
                workers: 4,
                max_connections: 1000,
            },
            databases: HashMap::new(),
            backup: BackupConfig {
                storage_path: "./backups".to_string(),
                retention_days: 30,
                compression_enabled: true,
                encryption_enabled: false,
                schedule_full: "0 2 * * 0".to_string(),
                schedule_incremental: "0 2 * * 1-6".to_string(),
                max_backup_size_gb: 100.0,
            },
            monitoring: MonitoringConfig {
                metrics_interval: 30,
                retention_hours: 168,
                alert_thresholds: AlertThresholds {
                    connection_count_warning: 80,
                    connection_count_critical: 95,
                    slow_query_threshold_ms: 1000.0,
                    error_rate_warning: 1.0,
                    error_rate_critical: 5.0,
                    disk_usage_warning: 80.0,
                    disk_usage_critical: 90.0,
                },
                prometheus_enabled: true,
                prometheus_port: 9091,
            },
            thresholds: ThresholdConfig {
                connection_count_warning: 80,
                connection_count_critical: 95,
                query_time_warning: 500.0,
                query_time_critical: 1000.0,
                error_rate_warning: 1.0,
                error_rate_critical: 5.0,
                cache_hit_ratio_warning: 85.0,
                disk_usage_warning: 80.0,
                disk_usage_critical: 90.0,
            },
        }
    }
}
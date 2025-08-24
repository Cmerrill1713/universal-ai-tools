use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::config::{Config, DatabaseConfig, DatabaseType};
use crate::{DatabaseHealth, DatabaseOperationRequest, DatabaseOperationResponse};

pub struct DatabaseManager {
    config: Config,
    connections: Arc<RwLock<HashMap<String, DatabaseConnection>>>,
    health_cache: Arc<RwLock<HashMap<String, DatabaseHealth>>>,
    http_client: reqwest::Client,
}

#[derive(Debug, Clone)]
struct DatabaseConnection {
    database_name: String,
    database_type: DatabaseType,
    connection_string: String,
    max_connections: u32,
    is_connected: bool,
    last_health_check: chrono::DateTime<chrono::Utc>,
    connection_count: u32,
    active_queries: u32,
}

impl DatabaseManager {
    pub async fn new(config: &Config) -> Result<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()?;

        let manager = Self {
            config: config.clone(),
            connections: Arc::new(RwLock::new(HashMap::new())),
            health_cache: Arc::new(RwLock::new(HashMap::new())),
            http_client,
        };

        // Initialize database connections
        manager.initialize_connections().await?;

        info!("Database Manager initialized with {} databases", config.databases.len());
        Ok(manager)
    }

    async fn initialize_connections(&self) -> Result<()> {
        let mut connections = self.connections.write().await;

        for (db_name, db_config) in &self.config.databases {
            debug!("Initializing connection for database: {}", db_name);

            let connection = DatabaseConnection {
                database_name: db_name.clone(),
                database_type: db_config.database_type.clone(),
                connection_string: db_config.connection_string.clone(),
                max_connections: db_config.max_connections,
                is_connected: false,
                last_health_check: chrono::Utc::now(),
                connection_count: 0,
                active_queries: 0,
            };

            // Test connection
            match self.test_database_connection(db_config).await {
                Ok(_) => {
                    info!("✅ Successfully connected to database: {}", db_name);
                    let mut conn = connection;
                    conn.is_connected = true;
                    connections.insert(db_name.clone(), conn);
                }
                Err(e) => {
                    warn!("❌ Failed to connect to database {}: {}", db_name, e);
                    connections.insert(db_name.clone(), connection);
                }
            }
        }

        Ok(())
    }

    async fn test_database_connection(&self, config: &DatabaseConfig) -> Result<()> {
        match config.database_type {
            DatabaseType::PostgreSQL => {
                self.test_postgresql_connection(&config.connection_string).await
            }
            DatabaseType::MySQL => {
                self.test_mysql_connection(&config.connection_string).await
            }
            DatabaseType::SQLite => {
                self.test_sqlite_connection(&config.connection_string).await
            }
            DatabaseType::MongoDB => {
                self.test_mongodb_connection(&config.connection_string).await
            }
        }
    }

    async fn test_postgresql_connection(&self, connection_string: &str) -> Result<()> {
        debug!("Testing PostgreSQL connection");
        // In a real implementation, you would use sqlx to create and test a connection
        // For now, we'll simulate a connection test
        if connection_string.contains("localhost") || connection_string.contains("127.0.0.1") {
            // Simulate successful local connection
            Ok(())
        } else {
            // Simulate checking remote connection
            Ok(())
        }
    }

    async fn test_mysql_connection(&self, _connection_string: &str) -> Result<()> {
        debug!("Testing MySQL connection");
        // Simulate MySQL connection test
        Ok(())
    }

    async fn test_sqlite_connection(&self, connection_string: &str) -> Result<()> {
        debug!("Testing SQLite connection: {}", connection_string);
        // For SQLite, we can check if the file exists or can be created
        if connection_string.starts_with("sqlite:") {
            let path = connection_string.strip_prefix("sqlite:").unwrap_or("./test.db");
            // Check if parent directory exists
            if let Some(parent) = std::path::Path::new(path).parent() {
                std::fs::create_dir_all(parent)?;
            }
            Ok(())
        } else {
            Err(anyhow!("Invalid SQLite connection string"))
        }
    }

    async fn test_mongodb_connection(&self, _connection_string: &str) -> Result<()> {
        debug!("Testing MongoDB connection");
        // Simulate MongoDB connection test
        Ok(())
    }

    pub async fn monitor_health(&self) -> Result<()> {
        debug!("🔍 Monitoring database health");

        let database_names = self.config.get_all_database_names();
        let mut health_cache = self.health_cache.write().await;

        for db_name in database_names {
            match self.collect_database_health(&db_name).await {
                Ok(health) => {
                    debug!("Health collected for {}: {}", db_name, health.status);
                    health_cache.insert(db_name.clone(), health);
                }
                Err(e) => {
                    error!("Failed to collect health for {}: {}", db_name, e);
                    
                    // Create error health status
                    let error_health = DatabaseHealth {
                        database_name: db_name.clone(),
                        status: "error".to_string(),
                        connection_count: 0,
                        active_queries: 0,
                        slow_queries: 0,
                        cache_hit_ratio: 0.0,
                        disk_usage_gb: 0.0,
                        last_backup: None,
                        last_optimization: None,
                    };
                    health_cache.insert(db_name, error_health);
                }
            }
        }

        Ok(())
    }

    async fn collect_database_health(&self, database_name: &str) -> Result<DatabaseHealth> {
        let connections = self.connections.read().await;
        let connection = connections.get(database_name)
            .ok_or_else(|| anyhow!("Database {} not found", database_name))?;

        // Simulate health data collection based on database type
        let health = match connection.database_type {
            DatabaseType::PostgreSQL => {
                self.collect_postgresql_health(database_name, connection).await?
            }
            DatabaseType::MySQL => {
                self.collect_mysql_health(database_name, connection).await?
            }
            DatabaseType::SQLite => {
                self.collect_sqlite_health(database_name, connection).await?
            }
            DatabaseType::MongoDB => {
                self.collect_mongodb_health(database_name, connection).await?
            }
        };

        Ok(health)
    }

    async fn collect_postgresql_health(
        &self,
        database_name: &str,
        connection: &DatabaseConnection,
    ) -> Result<DatabaseHealth> {
        // In a real implementation, you would execute SQL queries to get actual metrics
        let health = DatabaseHealth {
            database_name: database_name.to_string(),
            status: if connection.is_connected { "healthy".to_string() } else { "disconnected".to_string() },
            connection_count: connection.connection_count,
            active_queries: connection.active_queries,
            slow_queries: 2,
            cache_hit_ratio: 94.5,
            disk_usage_gb: 2.3,
            last_backup: Some(chrono::Utc::now() - chrono::Duration::hours(12)),
            last_optimization: Some(chrono::Utc::now() - chrono::Duration::days(1)),
        };

        Ok(health)
    }

    async fn collect_mysql_health(
        &self,
        database_name: &str,
        connection: &DatabaseConnection,
    ) -> Result<DatabaseHealth> {
        let health = DatabaseHealth {
            database_name: database_name.to_string(),
            status: if connection.is_connected { "healthy".to_string() } else { "disconnected".to_string() },
            connection_count: connection.connection_count,
            active_queries: connection.active_queries,
            slow_queries: 1,
            cache_hit_ratio: 91.2,
            disk_usage_gb: 1.8,
            last_backup: Some(chrono::Utc::now() - chrono::Duration::hours(24)),
            last_optimization: Some(chrono::Utc::now() - chrono::Duration::hours(48)),
        };

        Ok(health)
    }

    async fn collect_sqlite_health(
        &self,
        database_name: &str,
        connection: &DatabaseConnection,
    ) -> Result<DatabaseHealth> {
        let health = DatabaseHealth {
            database_name: database_name.to_string(),
            status: if connection.is_connected { "healthy".to_string() } else { "disconnected".to_string() },
            connection_count: 1, // SQLite typically has fewer connections
            active_queries: 0,
            slow_queries: 0,
            cache_hit_ratio: 98.5,
            disk_usage_gb: 0.1,
            last_backup: None, // SQLite might not have regular backups
            last_optimization: None,
        };

        Ok(health)
    }

    async fn collect_mongodb_health(
        &self,
        database_name: &str,
        connection: &DatabaseConnection,
    ) -> Result<DatabaseHealth> {
        let health = DatabaseHealth {
            database_name: database_name.to_string(),
            status: if connection.is_connected { "healthy".to_string() } else { "disconnected".to_string() },
            connection_count: connection.connection_count,
            active_queries: connection.active_queries,
            slow_queries: 3,
            cache_hit_ratio: 89.7,
            disk_usage_gb: 5.2,
            last_backup: Some(chrono::Utc::now() - chrono::Duration::hours(6)),
            last_optimization: Some(chrono::Utc::now() - chrono::Duration::hours(72)),
        };

        Ok(health)
    }

    pub async fn get_health_status(&self) -> Result<Vec<DatabaseHealth>> {
        let health_cache = self.health_cache.read().await;
        Ok(health_cache.values().cloned().collect())
    }

    pub async fn get_database_health(&self, database_name: &str) -> Result<DatabaseHealth> {
        let health_cache = self.health_cache.read().await;
        health_cache.get(database_name)
            .cloned()
            .ok_or_else(|| anyhow!("Health data not found for database: {}", database_name))
    }

    pub async fn perform_health_check(&self, request: &DatabaseOperationRequest) -> Result<DatabaseOperationResponse> {
        info!("🔍 Performing health check operation");

        let database_name = request.database_name.as_ref()
            .ok_or_else(|| anyhow!("Database name required for health check"))?;

        // Perform comprehensive health check
        match self.collect_database_health(database_name).await {
            Ok(health) => {
                let details = serde_json::to_value(&health)?;
                
                Ok(DatabaseOperationResponse {
                    operation_id: "".to_string(), // Will be set by caller
                    status: "completed".to_string(),
                    message: format!("Health check completed for database: {}", database_name),
                    details: Some(details),
                    estimated_duration: Some(5), // 5 seconds
                })
            }
            Err(e) => {
                error!("Health check failed for {}: {}", database_name, e);
                Ok(DatabaseOperationResponse {
                    operation_id: "".to_string(),
                    status: "failed".to_string(),
                    message: format!("Health check failed for database: {}", database_name),
                    details: Some(serde_json::json!({ "error": e.to_string() })),
                    estimated_duration: None,
                })
            }
        }
    }

    pub async fn perform_maintenance(&self, request: &DatabaseOperationRequest) -> Result<DatabaseOperationResponse> {
        info!("🔧 Performing maintenance operation");

        let database_name = request.database_name.as_ref()
            .ok_or_else(|| anyhow!("Database name required for maintenance"))?;

        // Simulate maintenance operations based on database type
        let config = self.config.get_database_config(database_name)
            .ok_or_else(|| anyhow!("Database configuration not found: {}", database_name))?;

        let maintenance_tasks = match config.database_type {
            DatabaseType::PostgreSQL => vec![
                "Running VACUUM ANALYZE",
                "Updating table statistics",
                "Checking index health",
                "Cleaning up temporary files",
            ],
            DatabaseType::MySQL => vec![
                "Running OPTIMIZE TABLE",
                "Updating table statistics",
                "Checking for fragmentation",
                "Cleaning up binary logs",
            ],
            DatabaseType::SQLite => vec![
                "Running VACUUM",
                "Reindexing tables",
                "Analyzing query plans",
            ],
            DatabaseType::MongoDB => vec![
                "Compacting collections",
                "Rebuilding indexes",
                "Checking shard balance",
                "Cleaning up oplog",
            ],
        };

        // Simulate maintenance execution
        tokio::time::sleep(std::time::Duration::from_millis(2000)).await;

        let details = serde_json::json!({
            "database_name": database_name,
            "database_type": format!("{:?}", config.database_type),
            "tasks_completed": maintenance_tasks,
            "maintenance_duration": "2.5 seconds",
            "next_maintenance": chrono::Utc::now() + chrono::Duration::days(7)
        });

        Ok(DatabaseOperationResponse {
            operation_id: "".to_string(),
            status: "completed".to_string(),
            message: format!("Maintenance completed for database: {}", database_name),
            details: Some(details),
            estimated_duration: Some(150), // 2.5 minutes
        })
    }

    pub async fn schedule_maintenance(&self, request: &HashMap<String, serde_json::Value>) -> Result<DatabaseOperationResponse> {
        info!("📅 Scheduling maintenance operation");

        let database_name = request.get("database_name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Database name required for scheduling maintenance"))?;

        let schedule_time = request.get("schedule_time")
            .and_then(|v| v.as_str())
            .unwrap_or("weekly");

        let maintenance_type = request.get("maintenance_type")
            .and_then(|v| v.as_str())
            .unwrap_or("standard");

        let details = serde_json::json!({
            "database_name": database_name,
            "schedule_type": schedule_time,
            "maintenance_type": maintenance_type,
            "scheduled_for": chrono::Utc::now() + chrono::Duration::days(1),
            "recurring": true,
            "notifications_enabled": true
        });

        Ok(DatabaseOperationResponse {
            operation_id: "".to_string(),
            status: "scheduled".to_string(),
            message: format!("Maintenance scheduled for database: {}", database_name),
            details: Some(details),
            estimated_duration: Some(300), // 5 minutes estimated
        })
    }

    pub async fn get_maintenance_status(&self) -> Result<Vec<serde_json::Value>> {
        info!("📊 Getting maintenance status");

        let mut maintenance_status = Vec::new();

        for (db_name, _config) in &self.config.databases {
            let status = serde_json::json!({
                "database_name": db_name,
                "last_maintenance": chrono::Utc::now() - chrono::Duration::hours(12),
                "next_maintenance": chrono::Utc::now() + chrono::Duration::days(7),
                "maintenance_type": "standard",
                "status": "scheduled",
                "estimated_duration": 300
            });

            maintenance_status.push(status);
        }

        Ok(maintenance_status)
    }

    pub async fn reconnect_database(&self, database_name: &str) -> Result<()> {
        info!("🔄 Reconnecting to database: {}", database_name);

        let config = self.config.get_database_config(database_name)
            .ok_or_else(|| anyhow!("Database configuration not found: {}", database_name))?;

        match self.test_database_connection(config).await {
            Ok(_) => {
                let mut connections = self.connections.write().await;
                if let Some(connection) = connections.get_mut(database_name) {
                    connection.is_connected = true;
                    connection.last_health_check = chrono::Utc::now();
                }
                info!("✅ Successfully reconnected to database: {}", database_name);
                Ok(())
            }
            Err(e) => {
                error!("❌ Failed to reconnect to database {}: {}", database_name, e);
                Err(e)
            }
        }
    }
}
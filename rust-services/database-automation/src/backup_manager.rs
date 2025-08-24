use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::config::{Config, DatabaseType};
use crate::{DatabaseOperationRequest, DatabaseOperationResponse, BackupInfo, BackupType, BackupStatus};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupJob {
    pub id: String,
    pub database_name: String,
    pub backup_type: BackupType,
    pub scheduled_at: chrono::DateTime<chrono::Utc>,
    pub status: BackupStatus,
    pub progress: f64,
    pub estimated_size_gb: f64,
    pub location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupSchedule {
    pub database_name: String,
    pub full_backup_cron: String,
    pub incremental_backup_cron: String,
    pub retention_days: u32,
    pub enabled: bool,
}

pub struct BackupManager {
    config: Config,
    backup_storage_path: PathBuf,
    active_backups: Arc<RwLock<HashMap<String, BackupJob>>>,
    backup_history: Arc<RwLock<HashMap<String, Vec<BackupInfo>>>>,
    backup_schedules: Arc<RwLock<HashMap<String, BackupSchedule>>>,
}

impl BackupManager {
    pub async fn new(config: &Config) -> Result<Self> {
        let backup_storage_path = PathBuf::from(&config.backup.storage_path);
        
        // Create backup directory if it doesn't exist
        if !backup_storage_path.exists() {
            std::fs::create_dir_all(&backup_storage_path)?;
            info!("📁 Created backup storage directory: {:?}", backup_storage_path);
        }

        let manager = Self {
            config: config.clone(),
            backup_storage_path,
            active_backups: Arc::new(RwLock::new(HashMap::new())),
            backup_history: Arc::new(RwLock::new(HashMap::new())),
            backup_schedules: Arc::new(RwLock::new(HashMap::new())),
        };

        // Initialize backup schedules
        manager.initialize_backup_schedules().await?;
        
        // Load existing backup history
        manager.load_backup_history().await?;

        info!("🚀 Backup Manager initialized");
        Ok(manager)
    }

    async fn initialize_backup_schedules(&self) -> Result<()> {
        let mut schedules = self.backup_schedules.write().await;
        
        for (database_name, database_config) in &self.config.databases {
            if database_config.backup_enabled {
                let schedule = BackupSchedule {
                    database_name: database_name.clone(),
                    full_backup_cron: self.config.backup.schedule_full.clone(),
                    incremental_backup_cron: self.config.backup.schedule_incremental.clone(),
                    retention_days: self.config.backup.retention_days,
                    enabled: true,
                };
                
                schedules.insert(database_name.clone(), schedule);
                info!("📅 Initialized backup schedule for database: {}", database_name);
            }
        }

        Ok(())
    }

    async fn load_backup_history(&self) -> Result<()> {
        debug!("📚 Loading backup history");
        
        let mut history = self.backup_history.write().await;
        history.clear();

        // In a real implementation, this would scan the backup directory
        // and load metadata from existing backup files
        for (database_name, _config) in &self.config.databases {
            let sample_backups = vec![
                BackupInfo {
                    backup_id: format!("backup_{}_20240820_020000", database_name),
                    database_name: database_name.clone(),
                    backup_type: BackupType::Full,
                    size_gb: 2.5,
                    created_at: chrono::Utc::now() - chrono::Duration::days(7),
                    status: BackupStatus::Completed,
                    location: format!("{}/full_backup_{}_20240820.sql.gz", 
                        self.config.backup.storage_path, database_name),
                },
                BackupInfo {
                    backup_id: format!("backup_{}_20240821_020000", database_name),
                    database_name: database_name.clone(),
                    backup_type: BackupType::Incremental,
                    size_gb: 0.3,
                    created_at: chrono::Utc::now() - chrono::Duration::days(1),
                    status: BackupStatus::Completed,
                    location: format!("{}/incremental_backup_{}_20240821.sql.gz", 
                        self.config.backup.storage_path, database_name),
                },
            ];

            history.insert(database_name.clone(), sample_backups);
        }

        let total_backups: usize = history.values().map(|v| v.len()).sum();
        info!("📚 Loaded {} backup records", total_backups);
        Ok(())
    }

    pub async fn create_backup(&self, request: &DatabaseOperationRequest) -> Result<DatabaseOperationResponse> {
        info!("🔄 Creating backup operation");

        let database_name = request.database_name.as_ref()
            .ok_or_else(|| anyhow!("Database name required for backup"))?;

        let backup_type = request.parameters.as_ref()
            .and_then(|p| p.get("backup_type"))
            .and_then(|v| v.as_str())
            .unwrap_or("full");

        let backup_type = match backup_type {
            "full" => BackupType::Full,
            "incremental" => BackupType::Incremental,
            "differential" => BackupType::Differential,
            _ => BackupType::Full,
        };

        // Create backup job
        let backup_id = format!("backup_{}_{}", database_name, chrono::Utc::now().format("%Y%m%d_%H%M%S"));
        let backup_job = BackupJob {
            id: backup_id.clone(),
            database_name: database_name.clone(),
            backup_type: backup_type.clone(),
            scheduled_at: chrono::Utc::now(),
            status: BackupStatus::Running,
            progress: 0.0,
            estimated_size_gb: self.estimate_backup_size(database_name, &backup_type).await?,
            location: self.generate_backup_location(database_name, &backup_type).await?,
        };

        // Store active backup
        {
            let mut active_backups = self.active_backups.write().await;
            active_backups.insert(backup_id.clone(), backup_job.clone());
        }

        // Execute backup asynchronously
        let manager = self.clone();
        let backup_id_for_spawn = backup_id.clone();
        tokio::spawn(async move {
            if let Err(e) = manager.execute_backup_job(&backup_id_for_spawn).await {
                error!("Backup execution failed for {}: {}", backup_id_for_spawn, e);
            }
        });

        let details = serde_json::json!({
            "backup_id": backup_id,
            "backup_type": format!("{:?}", backup_type),
            "database_name": database_name,
            "estimated_size_gb": backup_job.estimated_size_gb,
            "location": backup_job.location
        });

        Ok(DatabaseOperationResponse {
            operation_id: "".to_string(),
            status: "running".to_string(),
            message: format!("Backup started for database: {}", database_name),
            details: Some(details),
            estimated_duration: Some(300), // 5 minutes
        })
    }

    async fn estimate_backup_size(&self, database_name: &str, backup_type: &BackupType) -> Result<f64> {
        // In a real implementation, this would query the database for size information
        let base_size = match self.config.get_database_config(database_name)
            .map(|c| &c.database_type)
        {
            Some(DatabaseType::PostgreSQL) => 2.5,
            Some(DatabaseType::MySQL) => 1.8,
            Some(DatabaseType::SQLite) => 0.1,
            Some(DatabaseType::MongoDB) => 3.2,
            None => 1.0,
        };

        let size_multiplier = match backup_type {
            BackupType::Full => 1.0,
            BackupType::Incremental => 0.1,
            BackupType::Differential => 0.3,
        };

        Ok(base_size * size_multiplier)
    }

    async fn generate_backup_location(&self, database_name: &str, backup_type: &BackupType) -> Result<String> {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let backup_type_str = match backup_type {
            BackupType::Full => "full",
            BackupType::Incremental => "incremental", 
            BackupType::Differential => "differential",
        };

        let filename = format!("{}_{}_backup_{}.sql.gz", 
            backup_type_str, database_name, timestamp);
        let location = self.backup_storage_path.join(filename);
        
        Ok(location.to_string_lossy().to_string())
    }

    async fn execute_backup_job(&self, backup_id: &str) -> Result<()> {
        info!("🔧 Executing backup job: {}", backup_id);

        let backup_job = {
            let active_backups = self.active_backups.read().await;
            active_backups.get(backup_id).cloned()
                .ok_or_else(|| anyhow!("Backup job {} not found", backup_id))?
        };

        // Get database configuration
        let db_config = self.config.get_database_config(&backup_job.database_name)
            .ok_or_else(|| anyhow!("Database configuration not found: {}", backup_job.database_name))?;

        // Execute backup based on database type
        let backup_result = match db_config.database_type {
            DatabaseType::PostgreSQL => {
                self.execute_postgresql_backup(&backup_job).await
            }
            DatabaseType::MySQL => {
                self.execute_mysql_backup(&backup_job).await
            }
            DatabaseType::SQLite => {
                self.execute_sqlite_backup(&backup_job).await
            }
            DatabaseType::MongoDB => {
                self.execute_mongodb_backup(&backup_job).await
            }
        };

        match backup_result {
            Ok(backup_info) => {
                self.complete_backup_job(backup_id, backup_info).await?;
                info!("✅ Backup job {} completed successfully", backup_id);
            }
            Err(e) => {
                self.fail_backup_job(backup_id, &e.to_string()).await?;
                error!("❌ Backup job {} failed: {}", backup_id, e);
            }
        }

        Ok(())
    }

    async fn execute_postgresql_backup(&self, backup_job: &BackupJob) -> Result<BackupInfo> {
        info!("🐘 Executing PostgreSQL backup for: {}", backup_job.database_name);

        // Update progress
        self.update_backup_progress(&backup_job.id, 10.0).await?;

        // In a real implementation, you would execute pg_dump or similar
        // Simulate backup execution with progress updates
        for progress in [25.0, 50.0, 75.0, 90.0] {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            self.update_backup_progress(&backup_job.id, progress).await?;
        }

        // Create backup info
        let backup_info = BackupInfo {
            backup_id: backup_job.id.clone(),
            database_name: backup_job.database_name.clone(),
            backup_type: backup_job.backup_type.clone(),
            size_gb: backup_job.estimated_size_gb,
            created_at: chrono::Utc::now(),
            status: BackupStatus::Completed,
            location: backup_job.location.clone(),
        };

        // Simulate file creation
        if self.config.backup.compression_enabled {
            debug!("📦 Compressing backup file");
        }

        Ok(backup_info)
    }

    async fn execute_mysql_backup(&self, backup_job: &BackupJob) -> Result<BackupInfo> {
        info!("🐬 Executing MySQL backup for: {}", backup_job.database_name);

        // Update progress
        self.update_backup_progress(&backup_job.id, 15.0).await?;

        // Simulate mysqldump execution
        for progress in [30.0, 60.0, 85.0, 95.0] {
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            self.update_backup_progress(&backup_job.id, progress).await?;
        }

        let backup_info = BackupInfo {
            backup_id: backup_job.id.clone(),
            database_name: backup_job.database_name.clone(),
            backup_type: backup_job.backup_type.clone(),
            size_gb: backup_job.estimated_size_gb * 0.9, // MySQL typically compresses better
            created_at: chrono::Utc::now(),
            status: BackupStatus::Completed,
            location: backup_job.location.clone(),
        };

        Ok(backup_info)
    }

    async fn execute_sqlite_backup(&self, backup_job: &BackupJob) -> Result<BackupInfo> {
        info!("🗄️ Executing SQLite backup for: {}", backup_job.database_name);

        // SQLite backup is typically faster
        self.update_backup_progress(&backup_job.id, 50.0).await?;
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        self.update_backup_progress(&backup_job.id, 90.0).await?;

        let backup_info = BackupInfo {
            backup_id: backup_job.id.clone(),
            database_name: backup_job.database_name.clone(),
            backup_type: backup_job.backup_type.clone(),
            size_gb: backup_job.estimated_size_gb,
            created_at: chrono::Utc::now(),
            status: BackupStatus::Completed,
            location: backup_job.location.clone(),
        };

        Ok(backup_info)
    }

    async fn execute_mongodb_backup(&self, backup_job: &BackupJob) -> Result<BackupInfo> {
        info!("🍃 Executing MongoDB backup for: {}", backup_job.database_name);

        // Update progress for mongodump
        for progress in [20.0, 40.0, 60.0, 80.0, 95.0] {
            tokio::time::sleep(std::time::Duration::from_millis(600)).await;
            self.update_backup_progress(&backup_job.id, progress).await?;
        }

        let backup_info = BackupInfo {
            backup_id: backup_job.id.clone(),
            database_name: backup_job.database_name.clone(),
            backup_type: backup_job.backup_type.clone(),
            size_gb: backup_job.estimated_size_gb * 1.1, // MongoDB can be larger
            created_at: chrono::Utc::now(),
            status: BackupStatus::Completed,
            location: backup_job.location.clone(),
        };

        Ok(backup_info)
    }

    async fn update_backup_progress(&self, backup_id: &str, progress: f64) -> Result<()> {
        let mut active_backups = self.active_backups.write().await;
        if let Some(job) = active_backups.get_mut(backup_id) {
            job.progress = progress;
            debug!("📊 Backup {} progress: {:.1}%", backup_id, progress);
        }
        Ok(())
    }

    async fn complete_backup_job(&self, backup_id: &str, backup_info: BackupInfo) -> Result<()> {
        // Update active backup status
        {
            let mut active_backups = self.active_backups.write().await;
            if let Some(job) = active_backups.get_mut(backup_id) {
                job.status = BackupStatus::Completed;
                job.progress = 100.0;
            }
        }

        // Add to backup history
        {
            let mut history = self.backup_history.write().await;
            let database_backups = history.entry(backup_info.database_name.clone())
                .or_insert_with(Vec::new);
            database_backups.push(backup_info);

            // Sort by creation time
            database_backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        }

        Ok(())
    }

    async fn fail_backup_job(&self, backup_id: &str, error_message: &str) -> Result<()> {
        let mut active_backups = self.active_backups.write().await;
        if let Some(job) = active_backups.get_mut(backup_id) {
            job.status = BackupStatus::Failed;
            warn!("❌ Backup job {} failed: {}", backup_id, error_message);
        }
        Ok(())
    }

    pub async fn list_backups(&self) -> Result<Vec<BackupInfo>> {
        let history = self.backup_history.read().await;
        let mut all_backups = Vec::new();

        for backups in history.values() {
            all_backups.extend(backups.iter().cloned());
        }

        // Sort by creation time (newest first)
        all_backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(all_backups)
    }

    pub async fn create_backup_info(&self, request: &HashMap<String, serde_json::Value>) -> Result<BackupInfo> {
        let database_name = request.get("database_name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Database name required"))?;

        let backup_type = request.get("backup_type")
            .and_then(|v| v.as_str())
            .unwrap_or("full");

        let backup_type = match backup_type {
            "full" => BackupType::Full,
            "incremental" => BackupType::Incremental,
            "differential" => BackupType::Differential,
            _ => BackupType::Full,
        };

        // Generate backup info
        let backup_id = format!("backup_{}_{}", database_name, chrono::Utc::now().format("%Y%m%d_%H%M%S"));
        let size_gb = self.estimate_backup_size(database_name, &backup_type).await?;
        let location = self.generate_backup_location(database_name, &backup_type).await?;

        let backup_info = BackupInfo {
            backup_id,
            database_name: database_name.to_string(),
            backup_type,
            size_gb,
            created_at: chrono::Utc::now(),
            status: BackupStatus::Scheduled,
            location,
        };

        Ok(backup_info)
    }

    pub async fn restore_backup(&self, request: &DatabaseOperationRequest) -> Result<DatabaseOperationResponse> {
        info!("🔄 Restoring backup operation");

        let backup_id = request.parameters.as_ref()
            .and_then(|p| p.get("backup_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Backup ID required for restore"))?;

        // Find the backup
        let backup_info = self.find_backup_by_id(backup_id).await?;

        // Execute restore
        let restore_result = self.execute_restore(&backup_info).await?;

        let details = serde_json::json!({
            "backup_id": backup_id,
            "database_name": backup_info.database_name,
            "restored_from": backup_info.location,
            "restore_time": chrono::Utc::now(),
            "success": restore_result
        });

        Ok(DatabaseOperationResponse {
            operation_id: "".to_string(),
            status: if restore_result { "completed".to_string() } else { "failed".to_string() },
            message: format!("Restore {} for backup: {}", 
                if restore_result { "completed" } else { "failed" }, backup_id),
            details: Some(details),
            estimated_duration: Some(600), // 10 minutes
        })
    }

    pub async fn restore_backup_by_id(&self, backup_id: &str) -> Result<DatabaseOperationResponse> {
        info!("🔄 Restoring backup by ID: {}", backup_id);

        let backup_info = self.find_backup_by_id(backup_id).await?;
        let restore_result = self.execute_restore(&backup_info).await?;

        let details = serde_json::json!({
            "backup_id": backup_id,
            "database_name": backup_info.database_name,
            "restored_from": backup_info.location,
            "restore_time": chrono::Utc::now(),
            "success": restore_result
        });

        Ok(DatabaseOperationResponse {
            operation_id: "".to_string(),
            status: if restore_result { "completed".to_string() } else { "failed".to_string() },
            message: format!("Restore {} for backup: {}", 
                if restore_result { "completed" } else { "failed" }, backup_id),
            details: Some(details),
            estimated_duration: Some(600),
        })
    }

    async fn find_backup_by_id(&self, backup_id: &str) -> Result<BackupInfo> {
        let history = self.backup_history.read().await;
        
        for backups in history.values() {
            if let Some(backup) = backups.iter().find(|b| b.backup_id == backup_id) {
                return Ok(backup.clone());
            }
        }

        Err(anyhow!("Backup {} not found", backup_id))
    }

    async fn execute_restore(&self, backup_info: &BackupInfo) -> Result<bool> {
        info!("🔧 Executing restore for backup: {}", backup_info.backup_id);

        // Check if backup file exists
        let backup_path = std::path::Path::new(&backup_info.location);
        if !backup_path.exists() {
            return Err(anyhow!("Backup file not found: {}", backup_info.location));
        }

        // Get database configuration
        let db_config = self.config.get_database_config(&backup_info.database_name)
            .ok_or_else(|| anyhow!("Database configuration not found: {}", backup_info.database_name))?;

        // Execute restore based on database type
        let success = match db_config.database_type {
            DatabaseType::PostgreSQL => {
                debug!("🐘 Restoring PostgreSQL backup");
                // In real implementation: psql < backup_file
                tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
                true
            }
            DatabaseType::MySQL => {
                debug!("🐬 Restoring MySQL backup");
                // In real implementation: mysql < backup_file
                tokio::time::sleep(std::time::Duration::from_millis(1800)).await;
                true
            }
            DatabaseType::SQLite => {
                debug!("🗄️ Restoring SQLite backup");
                // In real implementation: copy backup file over database file
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                true
            }
            DatabaseType::MongoDB => {
                debug!("🍃 Restoring MongoDB backup");
                // In real implementation: mongorestore
                tokio::time::sleep(std::time::Duration::from_millis(2500)).await;
                true
            }
        };

        if success {
            info!("✅ Restore completed successfully for backup: {}", backup_info.backup_id);
        } else {
            error!("❌ Restore failed for backup: {}", backup_info.backup_id);
        }

        Ok(success)
    }

    pub async fn check_scheduled_backups(&self) -> Result<()> {
        debug!("📅 Checking scheduled backups");
        
        let schedules = self.backup_schedules.read().await;
        
        for (database_name, schedule) in schedules.iter() {
            if !schedule.enabled {
                continue;
            }

            // In a real implementation, you would check cron expressions
            // and determine if a backup should be triggered
            debug!("📅 Checked schedule for database: {}", database_name);
        }

        Ok(())
    }
}

// Implement Clone for BackupManager (needed for async spawn)
impl Clone for BackupManager {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            backup_storage_path: self.backup_storage_path.clone(),
            active_backups: Arc::clone(&self.active_backups),
            backup_history: Arc::clone(&self.backup_history),
            backup_schedules: Arc::clone(&self.backup_schedules),
        }
    }
}
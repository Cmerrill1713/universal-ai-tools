use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use walkdir::WalkDir;

use crate::config::Config;
use crate::{DatabaseOperationRequest, DatabaseOperationResponse, MigrationStatus, MigrationState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Migration {
    pub id: String,
    pub database_name: String,
    pub version: String,
    pub description: String,
    pub filename: String,
    pub content: String,
    pub checksum: String,
    pub applied_at: Option<chrono::DateTime<chrono::Utc>>,
    pub rollback_content: Option<String>,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationPlan {
    pub migrations_to_apply: Vec<Migration>,
    pub estimated_duration: u64,
    pub rollback_plan: Vec<String>,
    pub validation_checks: Vec<String>,
}

pub struct MigrationEngine {
    config: Config,
    migrations_path: PathBuf,
    applied_migrations: RwLock<HashMap<String, MigrationStatus>>,
    available_migrations: RwLock<HashMap<String, Migration>>,
}

impl MigrationEngine {
    pub async fn new(config: &Config) -> Result<Self> {
        let migrations_path = PathBuf::from("./migrations");
        
        // Create migrations directory if it doesn't exist
        if !migrations_path.exists() {
            std::fs::create_dir_all(&migrations_path)?;
            info!("📁 Created migrations directory: {:?}", migrations_path);
        }

        let engine = Self {
            config: config.clone(),
            migrations_path,
            applied_migrations: RwLock::new(HashMap::new()),
            available_migrations: RwLock::new(HashMap::new()),
        };

        // Load existing migrations
        engine.load_available_migrations().await?;
        engine.load_applied_migrations().await?;

        info!("🚀 Migration Engine initialized");
        Ok(engine)
    }

    async fn load_available_migrations(&self) -> Result<()> {
        debug!("📚 Loading available migrations from {:?}", self.migrations_path);

        let mut available = self.available_migrations.write().await;
        available.clear();

        for entry in WalkDir::new(&self.migrations_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if let Some(extension) = entry.path().extension() {
                if extension == "sql" {
                    match self.parse_migration_file(entry.path()).await {
                        Ok(migration) => {
                            debug!("📄 Loaded migration: {} ({})", migration.id, migration.version);
                            available.insert(migration.id.clone(), migration);
                        }
                        Err(e) => {
                            warn!("⚠️ Failed to parse migration {:?}: {}", entry.path(), e);
                        }
                    }
                }
            }
        }

        info!("📚 Loaded {} available migrations", available.len());
        Ok(())
    }

    async fn parse_migration_file(&self, path: &std::path::Path) -> Result<Migration> {
        let content = tokio::fs::read_to_string(path).await?;
        let filename = path.file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| anyhow!("Invalid filename"))?
            .to_string();

        // Parse migration metadata from filename and content
        // Format: YYYYMMDD_HHMMSS_database_description.sql
        let parts: Vec<&str> = filename.split('_').collect();
        if parts.len() < 4 {
            return Err(anyhow!("Invalid migration filename format: {}", filename));
        }

        let version = format!("{}_{}", parts[0], parts[1]);
        let database_name = parts[2].to_string();
        let description = parts[3..].join("_").replace(".sql", "");

        // Calculate checksum
        use md5::{Md5, Digest};
        let mut hasher = Md5::new();
        hasher.update(&content);
        let checksum = format!("{:x}", hasher.finalize());

        // Look for rollback content (-- ROLLBACK section)
        let rollback_content = self.extract_rollback_content(&content);

        // Extract dependencies from comments
        let dependencies = self.extract_dependencies(&content);

        let migration = Migration {
            id: format!("{}_{}", version, database_name),
            database_name,
            version,
            description,
            filename,
            content,
            checksum,
            applied_at: None,
            rollback_content,
            dependencies,
        };

        Ok(migration)
    }

    fn extract_rollback_content(&self, content: &str) -> Option<String> {
        let lines: Vec<&str> = content.lines().collect();
        let mut rollback_start = None;
        let mut rollback_end = lines.len();

        for (i, line) in lines.iter().enumerate() {
            if line.trim().starts_with("-- ROLLBACK") || line.trim().starts_with("-- DOWN") {
                rollback_start = Some(i + 1);
            } else if rollback_start.is_some() && line.trim().starts_with("-- END") {
                rollback_end = i;
                break;
            }
        }

        if let Some(start) = rollback_start {
            let rollback_lines = &lines[start..rollback_end];
            Some(rollback_lines.join("\n"))
        } else {
            None
        }
    }

    fn extract_dependencies(&self, content: &str) -> Vec<String> {
        let mut dependencies = Vec::new();

        for line in content.lines() {
            if line.trim().starts_with("-- DEPENDS:") {
                let deps: Vec<String> = line.trim()
                    .strip_prefix("-- DEPENDS:")
                    .unwrap_or("")
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                dependencies.extend(deps);
            }
        }

        dependencies
    }

    async fn load_applied_migrations(&self) -> Result<()> {
        debug!("📊 Loading applied migrations status");

        let mut applied = self.applied_migrations.write().await;
        applied.clear();

        // In a real implementation, this would query the database
        // For now, we'll simulate some applied migrations
        for database_name in self.config.get_all_database_names() {
            // Create some sample applied migration statuses
            let sample_migrations = vec![
                MigrationStatus {
                    migration_id: format!("20240101_120000_{}", database_name),
                    database_name: database_name.clone(),
                    version: "20240101_120000".to_string(),
                    status: MigrationState::Completed,
                    applied_at: Some(chrono::Utc::now() - chrono::Duration::days(30)),
                    rollback_available: true,
                },
                MigrationStatus {
                    migration_id: format!("20240115_140000_{}", database_name),
                    database_name: database_name.clone(),
                    version: "20240115_140000".to_string(),
                    status: MigrationState::Completed,
                    applied_at: Some(chrono::Utc::now() - chrono::Duration::days(15)),
                    rollback_available: true,
                },
            ];

            for migration in sample_migrations {
                applied.insert(migration.migration_id.clone(), migration);
            }
        }

        info!("📊 Loaded {} applied migration records", applied.len());
        Ok(())
    }

    pub async fn execute_migration(&self, request: &DatabaseOperationRequest) -> Result<DatabaseOperationResponse> {
        info!("🚀 Executing migration operation");

        let database_name = request.database_name.as_ref()
            .ok_or_else(|| anyhow!("Database name required for migration"))?;

        let migration_id = request.parameters.as_ref()
            .and_then(|p| p.get("migration_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Migration ID required"))?;

        // Get the migration to execute
        let available = self.available_migrations.read().await;
        let migration = available.get(migration_id)
            .ok_or_else(|| anyhow!("Migration {} not found", migration_id))?
            .clone();

        if migration.database_name != *database_name {
            return Err(anyhow!("Migration {} is not for database {}", migration_id, database_name));
        }

        // Check dependencies
        self.validate_migration_dependencies(&migration).await?;

        // Execute the migration
        let result = self.apply_migration(&migration).await?;

        // Update applied migrations
        let mut applied = self.applied_migrations.write().await;
        applied.insert(migration_id.to_string(), result.clone());

        let details = serde_json::to_value(&result)?;

        Ok(DatabaseOperationResponse {
            operation_id: "".to_string(),
            status: "completed".to_string(),
            message: format!("Migration {} applied successfully", migration_id),
            details: Some(details),
            estimated_duration: Some(30), // 30 seconds
        })
    }

    async fn validate_migration_dependencies(&self, migration: &Migration) -> Result<()> {
        let applied = self.applied_migrations.read().await;

        for dependency in &migration.dependencies {
            if !applied.contains_key(dependency) {
                return Err(anyhow!("Migration dependency {} not satisfied", dependency));
            }
            
            let dep_status = applied.get(dependency).unwrap();
            if dep_status.status != MigrationState::Completed {
                return Err(anyhow!("Migration dependency {} not in completed state", dependency));
            }
        }

        Ok(())
    }

    async fn apply_migration(&self, migration: &Migration) -> Result<MigrationStatus> {
        info!("📝 Applying migration: {} to database: {}", migration.id, migration.database_name);

        // Simulate migration execution
        debug!("Executing SQL content for migration {}", migration.id);
        debug!("Migration description: {}", migration.description);

        // In a real implementation, you would:
        // 1. Begin a transaction
        // 2. Execute the migration SQL
        // 3. Update the migrations table
        // 4. Commit the transaction

        // Simulate execution time
        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;

        let status = MigrationStatus {
            migration_id: migration.id.clone(),
            database_name: migration.database_name.clone(),
            version: migration.version.clone(),
            status: MigrationState::Completed,
            applied_at: Some(chrono::Utc::now()),
            rollback_available: migration.rollback_content.is_some(),
        };

        info!("✅ Migration {} applied successfully", migration.id);
        Ok(status)
    }

    pub async fn get_migration_status(&self) -> Result<Vec<MigrationStatus>> {
        let applied = self.applied_migrations.read().await;
        Ok(applied.values().cloned().collect())
    }

    pub async fn apply_migration_from_request(&self, request: &HashMap<String, serde_json::Value>) -> Result<MigrationStatus> {
        info!("🚀 Applying migration from request");

        let migration_id = request.get("migration_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Migration ID required"))?;

        let database_name = request.get("database_name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Database name required"))?;

        // Get the migration
        let available = self.available_migrations.read().await;
        let migration = available.get(migration_id)
            .ok_or_else(|| anyhow!("Migration {} not found", migration_id))?
            .clone();

        // Apply the migration
        let status = self.apply_migration(&migration).await?;

        // Update applied migrations
        let mut applied = self.applied_migrations.write().await;
        applied.insert(migration_id.to_string(), status.clone());

        Ok(status)
    }

    pub async fn rollback_migration(&self, migration_id: &str) -> Result<MigrationStatus> {
        info!("🔙 Rolling back migration: {}", migration_id);

        // Get the applied migration
        let mut applied = self.applied_migrations.write().await;
        let migration_status = applied.get(migration_id)
            .ok_or_else(|| anyhow!("Migration {} not found in applied migrations", migration_id))?
            .clone();

        if !migration_status.rollback_available {
            return Err(anyhow!("Migration {} does not support rollback", migration_id));
        }

        // Get the migration with rollback content
        let available = self.available_migrations.read().await;
        let migration = available.get(migration_id)
            .ok_or_else(|| anyhow!("Migration {} not found", migration_id))?;

        let rollback_content = migration.rollback_content.as_ref()
            .ok_or_else(|| anyhow!("Migration {} has no rollback content", migration_id))?;

        // Execute rollback
        debug!("Executing rollback SQL for migration {}", migration_id);
        debug!("Rollback SQL: {}", rollback_content);

        // Simulate rollback execution
        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

        // Update status
        let mut rolled_back_status = migration_status;
        rolled_back_status.status = MigrationState::RolledBack;
        rolled_back_status.applied_at = None;

        applied.insert(migration_id.to_string(), rolled_back_status.clone());

        info!("✅ Migration {} rolled back successfully", migration_id);
        Ok(rolled_back_status)
    }

    pub async fn create_migration_plan(&self, database_name: &str, target_version: Option<&str>) -> Result<MigrationPlan> {
        info!("📋 Creating migration plan for database: {}", database_name);

        let available = self.available_migrations.read().await;
        let applied = self.applied_migrations.read().await;

        // Get migrations for this database
        let mut database_migrations: Vec<Migration> = available.values()
            .filter(|m| m.database_name == database_name)
            .cloned()
            .collect();

        // Sort by version
        database_migrations.sort_by(|a, b| a.version.cmp(&b.version));

        // Find migrations to apply
        let mut migrations_to_apply = Vec::new();
        for migration in database_migrations {
            // Check if already applied
            if let Some(status) = applied.get(&migration.id) {
                if status.status == MigrationState::Completed {
                    continue; // Already applied
                }
            }

            // Check version target
            if let Some(target) = target_version {
                if migration.version.as_str() > target {
                    break; // Don't apply migrations beyond target version
                }
            }

            migrations_to_apply.push(migration);
        }

        // Calculate estimated duration (30 seconds per migration)
        let estimated_duration = migrations_to_apply.len() as u64 * 30;

        // Create rollback plan (reverse order of applied migrations)
        let rollback_plan: Vec<String> = migrations_to_apply.iter()
            .rev()
            .filter(|m| m.rollback_content.is_some())
            .map(|m| m.id.clone())
            .collect();

        // Validation checks
        let validation_checks = vec![
            "Check database connectivity".to_string(),
            "Validate migration dependencies".to_string(),
            "Verify rollback content availability".to_string(),
            "Check database schema compatibility".to_string(),
            "Validate data integrity constraints".to_string(),
        ];

        let plan = MigrationPlan {
            migrations_to_apply,
            estimated_duration,
            rollback_plan,
            validation_checks,
        };

        info!("📋 Created migration plan with {} migrations", plan.migrations_to_apply.len());
        Ok(plan)
    }

    pub async fn generate_migration(&self, database_name: &str, description: &str, content: &str) -> Result<Migration> {
        info!("📝 Generating new migration for database: {}", database_name);

        // Generate version timestamp
        let now = chrono::Utc::now();
        let version = now.format("%Y%m%d_%H%M%S").to_string();
        let migration_id = format!("{}_{}", version, database_name);

        // Generate filename
        let safe_description = description.replace(' ', "_").to_lowercase();
        let filename = format!("{}_{}.sql", version, safe_description);

        // Calculate checksum
        use md5::{Md5, Digest};
        let mut hasher = Md5::new();
        hasher.update(content);
        let checksum = format!("{:x}", hasher.finalize());

        let migration = Migration {
            id: migration_id,
            database_name: database_name.to_string(),
            version,
            description: description.to_string(),
            filename: filename.clone(),
            content: content.to_string(),
            checksum,
            applied_at: None,
            rollback_content: None,
            dependencies: Vec::new(),
        };

        // Write to file
        let migration_file_path = self.migrations_path.join(&filename);
        tokio::fs::write(&migration_file_path, content).await?;

        // Add to available migrations
        let mut available = self.available_migrations.write().await;
        available.insert(migration.id.clone(), migration.clone());

        info!("✅ Generated migration: {} in file: {}", migration.id, filename);
        Ok(migration)
    }
}
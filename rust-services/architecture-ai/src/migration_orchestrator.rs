use crate::config::Config;
use crate::code_generator::CodeGenerator;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error, debug};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct MigrationOrchestrator {
    config: Config,
    code_generator: Arc<CodeGenerator>,
    active_migrations: Arc<RwLock<HashMap<String, MigrationExecution>>>,
    execution_queue: Arc<RwLock<Vec<QueuedMigration>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MigrationExecution {
    migration_id: String,
    decision_id: String,
    status: MigrationStatus,
    current_phase: Option<String>,
    started_at: chrono::DateTime<chrono::Utc>,
    completed_at: Option<chrono::DateTime<chrono::Utc>>,
    progress: MigrationProgress,
    logs: Vec<MigrationLogEntry>,
    rollback_info: Option<RollbackInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum MigrationStatus {
    Queued,
    InProgress,
    Completed,
    Failed,
    RolledBack,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MigrationProgress {
    total_phases: u32,
    completed_phases: u32,
    current_phase_progress: f64,
    overall_progress: f64,
    estimated_remaining_minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MigrationLogEntry {
    timestamp: chrono::DateTime<chrono::Utc>,
    level: String,
    message: String,
    phase: Option<String>,
    task: Option<String>,
    metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RollbackInfo {
    reason: String,
    triggered_at: chrono::DateTime<chrono::Utc>,
    rollback_steps: Vec<RollbackStep>,
    recovery_status: RecoveryStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RollbackStep {
    step_id: String,
    description: String,
    status: StepStatus,
    executed_at: Option<chrono::DateTime<chrono::Utc>>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum StepStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum RecoveryStatus {
    NotStarted,
    InProgress,
    Completed,
    Failed,
    PartialRecovery,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct QueuedMigration {
    migration_id: String,
    decision_id: String,
    priority: u32,
    queued_at: chrono::DateTime<chrono::Utc>,
    estimated_start_time: chrono::DateTime<chrono::Utc>,
}

impl MigrationOrchestrator {
    pub async fn new(config: &Config) -> Result<Self> {
        info!("🔄 Initializing Migration Orchestrator");

        let code_generator = Arc::new(CodeGenerator::new(&config.migration.templates_directory).await?);

        // Ensure required directories exist
        tokio::fs::create_dir_all(&config.migration.output_directory).await?;
        tokio::fs::create_dir_all(&config.migration.backup_directory).await?;

        info!("✅ Migration orchestrator initialized");

        Ok(Self {
            config: config.clone(),
            code_generator,
            active_migrations: Arc::new(RwLock::new(HashMap::new())),
            execution_queue: Arc::new(RwLock::new(Vec::new())),
        })
    }

    pub async fn execute_decision(&self, decision_id: &str) -> Result<serde_json::Value> {
        info!("🚀 Executing architecture decision: {}", decision_id);

        // This would normally fetch the decision from database
        // For now, simulate starting the execution
        let migration_id = Uuid::new_v4().to_string();
        
        let migration_execution = MigrationExecution {
            migration_id: migration_id.clone(),
            decision_id: decision_id.to_string(),
            status: MigrationStatus::Queued,
            current_phase: None,
            started_at: chrono::Utc::now(),
            completed_at: None,
            progress: MigrationProgress {
                total_phases: 4,
                completed_phases: 0,
                current_phase_progress: 0.0,
                overall_progress: 0.0,
                estimated_remaining_minutes: 120,
            },
            logs: vec![
                MigrationLogEntry {
                    timestamp: chrono::Utc::now(),
                    level: "info".to_string(),
                    message: "Migration execution queued".to_string(),
                    phase: None,
                    task: None,
                    metadata: HashMap::new(),
                }
            ],
            rollback_info: None,
        };

        // Add to active migrations
        {
            let mut active = self.active_migrations.write().await;
            active.insert(migration_id.clone(), migration_execution);
        }

        // Queue for execution
        let queued_migration = QueuedMigration {
            migration_id: migration_id.clone(),
            decision_id: decision_id.to_string(),
            priority: 1,
            queued_at: chrono::Utc::now(),
            estimated_start_time: chrono::Utc::now() + chrono::Duration::minutes(1),
        };

        {
            let mut queue = self.execution_queue.write().await;
            queue.push(queued_migration);
            queue.sort_by_key(|m| m.priority);
        }

        // Start execution in background
        let orchestrator = self.clone();
        let migration_id_clone = migration_id.clone();
        tokio::spawn(async move {
            if let Err(e) = orchestrator.execute_migration(&migration_id_clone).await {
                error!("❌ Migration execution failed: {}", e);
            }
        });

        Ok(serde_json::json!({
            "migration_id": migration_id,
            "status": "queued",
            "estimated_start_time": chrono::Utc::now() + chrono::Duration::minutes(1),
            "estimated_duration_minutes": 120
        }))
    }

    async fn execute_migration(&self, migration_id: &str) -> Result<()> {
        info!("🔄 Starting migration execution: {}", migration_id);

        // Update status to in progress
        self.update_migration_status(migration_id, MigrationStatus::InProgress, None).await?;
        self.add_migration_log(migration_id, "info", "Migration execution started", None, None).await?;

        // Execute phases
        let phases = vec![
            ("preparation", "Preparing migration environment"),
            ("code_generation", "Generating new service code"),
            ("deployment", "Deploying new service"),
            ("validation", "Validating migration success"),
        ];

        for (i, (phase_id, phase_description)) in phases.iter().enumerate() {
            info!("📋 Executing phase: {} - {}", phase_id, phase_description);
            
            self.update_migration_phase(migration_id, Some(phase_id.to_string())).await?;
            self.add_migration_log(
                migration_id, 
                "info", 
                &format!("Starting phase: {}", phase_description), 
                Some(phase_id.to_string()), 
                None
            ).await?;

            // Simulate phase execution
            let success = self.execute_phase(migration_id, phase_id).await?;
            
            if success {
                self.update_migration_progress(
                    migration_id, 
                    i as u32 + 1, 
                    100.0, 
                    ((i + 1) as f64 / phases.len() as f64) * 100.0,
                    (phases.len() - i - 1) as u32 * 20
                ).await?;
                
                self.add_migration_log(
                    migration_id, 
                    "info", 
                    &format!("Completed phase: {}", phase_description), 
                    Some(phase_id.to_string()), 
                    None
                ).await?;
            } else {
                error!("❌ Phase failed: {}", phase_id);
                self.update_migration_status(migration_id, MigrationStatus::Failed, None).await?;
                self.add_migration_log(
                    migration_id, 
                    "error", 
                    &format!("Phase failed: {}", phase_description), 
                    Some(phase_id.to_string()), 
                    None
                ).await?;
                
                // Trigger rollback
                self.initiate_rollback(migration_id, &format!("Phase {} failed", phase_id)).await?;
                return Ok(());
            }
        }

        // Mark migration as completed
        self.update_migration_status(migration_id, MigrationStatus::Completed, Some(chrono::Utc::now())).await?;
        self.add_migration_log(migration_id, "info", "Migration completed successfully", None, None).await?;

        info!("✅ Migration execution completed: {}", migration_id);
        Ok(())
    }

    async fn execute_phase(&self, migration_id: &str, phase_id: &str) -> Result<bool> {
        match phase_id {
            "preparation" => {
                // Create backup directories, validate prerequisites
                self.prepare_migration_environment(migration_id).await
            }
            "code_generation" => {
                // Generate new service code from templates
                self.generate_migration_code(migration_id).await
            }
            "deployment" => {
                // Deploy new service, update configurations
                self.deploy_migrated_service(migration_id).await
            }
            "validation" => {
                // Validate that migration was successful
                self.validate_migration(migration_id).await
            }
            _ => {
                warn!("⚠️ Unknown migration phase: {}", phase_id);
                Ok(false)
            }
        }
    }

    async fn prepare_migration_environment(&self, migration_id: &str) -> Result<bool> {
        debug!("🔧 Preparing migration environment for: {}", migration_id);
        
        // Simulate preparation work
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        
        // Create backup directory for this migration
        let backup_path = format!("{}/migration_{}", self.config.migration.backup_directory, migration_id);
        tokio::fs::create_dir_all(&backup_path).await?;
        
        self.add_migration_log(
            migration_id, 
            "info", 
            &format!("Created backup directory: {}", backup_path), 
            Some("preparation".to_string()), 
            None
        ).await?;

        Ok(true)
    }

    async fn generate_migration_code(&self, migration_id: &str) -> Result<bool> {
        debug!("🔧 Generating migration code for: {}", migration_id);
        
        // Use code generator to create new service
        let template_params = HashMap::from([
            ("service_name".to_string(), serde_json::json!("migrated_service")),
            ("migration_id".to_string(), serde_json::json!(migration_id)),
        ]);

        match self.code_generator.generate_service("rust_service", template_params).await {
            Ok(generated_files) => {
                self.add_migration_log(
                    migration_id, 
                    "info", 
                    &format!("Generated {} files", generated_files.len()), 
                    Some("code_generation".to_string()), 
                    None
                ).await?;
                Ok(true)
            }
            Err(e) => {
                error!("Failed to generate migration code: {}", e);
                self.add_migration_log(
                    migration_id, 
                    "error", 
                    &format!("Code generation failed: {}", e), 
                    Some("code_generation".to_string()), 
                    None
                ).await?;
                Ok(false)
            }
        }
    }

    async fn deploy_migrated_service(&self, migration_id: &str) -> Result<bool> {
        debug!("🚀 Deploying migrated service for: {}", migration_id);
        
        // Simulate deployment
        tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
        
        self.add_migration_log(
            migration_id, 
            "info", 
            "Service deployment completed", 
            Some("deployment".to_string()), 
            None
        ).await?;

        Ok(true)
    }

    async fn validate_migration(&self, migration_id: &str) -> Result<bool> {
        debug!("✅ Validating migration for: {}", migration_id);
        
        // Simulate validation checks
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
        
        // Run health checks, performance tests, etc.
        let validation_passed = true; // Simulate success
        
        if validation_passed {
            self.add_migration_log(
                migration_id, 
                "info", 
                "All validation checks passed", 
                Some("validation".to_string()), 
                None
            ).await?;
        } else {
            self.add_migration_log(
                migration_id, 
                "error", 
                "Validation checks failed", 
                Some("validation".to_string()), 
                None
            ).await?;
        }

        Ok(validation_passed)
    }

    async fn initiate_rollback(&self, migration_id: &str, reason: &str) -> Result<()> {
        warn!("🔄 Initiating rollback for migration: {} - Reason: {}", migration_id, reason);

        let rollback_info = RollbackInfo {
            reason: reason.to_string(),
            triggered_at: chrono::Utc::now(),
            rollback_steps: vec![
                RollbackStep {
                    step_id: Uuid::new_v4().to_string(),
                    description: "Stop new service".to_string(),
                    status: StepStatus::Pending,
                    executed_at: None,
                    error: None,
                },
                RollbackStep {
                    step_id: Uuid::new_v4().to_string(),
                    description: "Restore previous version".to_string(),
                    status: StepStatus::Pending,
                    executed_at: None,
                    error: None,
                },
                RollbackStep {
                    step_id: Uuid::new_v4().to_string(),
                    description: "Cleanup temporary files".to_string(),
                    status: StepStatus::Pending,
                    executed_at: None,
                    error: None,
                },
            ],
            recovery_status: RecoveryStatus::InProgress,
        };

        // Update migration with rollback info
        {
            let mut active = self.active_migrations.write().await;
            if let Some(migration) = active.get_mut(migration_id) {
                migration.rollback_info = Some(rollback_info);
            }
        }

        // Execute rollback steps
        self.execute_rollback_steps(migration_id).await?;

        Ok(())
    }

    async fn execute_rollback_steps(&self, migration_id: &str) -> Result<()> {
        info!("🔄 Executing rollback steps for migration: {}", migration_id);

        // Simulate rollback execution
        tokio::time::sleep(tokio::time::Duration::from_secs(15)).await;

        self.update_migration_status(migration_id, MigrationStatus::RolledBack, Some(chrono::Utc::now())).await?;
        self.add_migration_log(migration_id, "info", "Rollback completed successfully", None, None).await?;

        Ok(())
    }

    pub async fn rollback_decision(&self, decision_id: &str) -> Result<serde_json::Value> {
        info!("🔄 Rolling back decision: {}", decision_id);

        // Find migrations for this decision
        let migration_ids: Vec<String> = {
            let active = self.active_migrations.read().await;
            active.values()
                .filter(|m| m.decision_id == decision_id)
                .map(|m| m.migration_id.clone())
                .collect()
        };

        let mut rollback_results = Vec::new();

        for migration_id in migration_ids {
            match self.initiate_rollback(&migration_id, "Manual decision rollback").await {
                Ok(()) => {
                    rollback_results.push(serde_json::json!({
                        "migration_id": migration_id,
                        "status": "rollback_initiated"
                    }));
                }
                Err(e) => {
                    error!("Failed to rollback migration {}: {}", migration_id, e);
                    rollback_results.push(serde_json::json!({
                        "migration_id": migration_id,
                        "status": "rollback_failed",
                        "error": e.to_string()
                    }));
                }
            }
        }

        Ok(serde_json::json!({
            "decision_id": decision_id,
            "rollback_results": rollback_results
        }))
    }

    pub async fn get_all_migration_status(&self) -> Result<serde_json::Value> {
        let active = self.active_migrations.read().await;
        let migrations: Vec<_> = active.values().cloned().collect();
        Ok(serde_json::json!({
            "total_migrations": migrations.len(),
            "migrations": migrations
        }))
    }

    pub async fn get_migration_logs(&self, migration_id: &str) -> Result<serde_json::Value> {
        let active = self.active_migrations.read().await;
        if let Some(migration) = active.get(migration_id) {
            Ok(serde_json::json!({
                "migration_id": migration_id,
                "logs": migration.logs
            }))
        } else {
            Err(anyhow::anyhow!("Migration not found: {}", migration_id))
        }
    }

    pub async fn list_available_templates(&self) -> Result<serde_json::Value> {
        let templates = self.code_generator.list_templates().await?;
        Ok(serde_json::json!({
            "templates": templates
        }))
    }

    pub async fn generate_code(&self, template_id: &str, parameters: HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let generated_files = self.code_generator.generate_service(template_id, parameters).await?;
        Ok(serde_json::json!({
            "template_id": template_id,
            "generated_files": generated_files
        }))
    }

    // Helper methods for updating migration state

    async fn update_migration_status(&self, migration_id: &str, status: MigrationStatus, completed_at: Option<chrono::DateTime<chrono::Utc>>) -> Result<()> {
        let mut active = self.active_migrations.write().await;
        if let Some(migration) = active.get_mut(migration_id) {
            migration.status = status;
            if let Some(completed) = completed_at {
                migration.completed_at = Some(completed);
            }
        }
        Ok(())
    }

    async fn update_migration_phase(&self, migration_id: &str, phase: Option<String>) -> Result<()> {
        let mut active = self.active_migrations.write().await;
        if let Some(migration) = active.get_mut(migration_id) {
            migration.current_phase = phase;
        }
        Ok(())
    }

    async fn update_migration_progress(&self, migration_id: &str, completed_phases: u32, current_phase_progress: f64, overall_progress: f64, estimated_remaining: u32) -> Result<()> {
        let mut active = self.active_migrations.write().await;
        if let Some(migration) = active.get_mut(migration_id) {
            migration.progress.completed_phases = completed_phases;
            migration.progress.current_phase_progress = current_phase_progress;
            migration.progress.overall_progress = overall_progress;
            migration.progress.estimated_remaining_minutes = estimated_remaining;
        }
        Ok(())
    }

    async fn add_migration_log(&self, migration_id: &str, level: &str, message: &str, phase: Option<String>, task: Option<String>) -> Result<()> {
        let mut active = self.active_migrations.write().await;
        if let Some(migration) = active.get_mut(migration_id) {
            migration.logs.push(MigrationLogEntry {
                timestamp: chrono::Utc::now(),
                level: level.to_string(),
                message: message.to_string(),
                phase,
                task,
                metadata: HashMap::new(),
            });
        }
        Ok(())
    }
}
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

mod config;
mod database_manager;
mod migration_engine;
mod backup_manager;
mod query_optimizer;

use config::Config;
use database_manager::DatabaseManager;
use migration_engine::MigrationEngine;
use backup_manager::BackupManager;
use query_optimizer::QueryOptimizer;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseOperationRequest {
    pub operation_type: OperationType,
    pub database_name: Option<String>,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub priority: OperationPriority,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum OperationType {
    #[serde(rename = "migration")]
    Migration,
    #[serde(rename = "backup")]
    Backup,
    #[serde(rename = "restore")]
    Restore,
    #[serde(rename = "optimization")]
    Optimization,
    #[serde(rename = "health_check")]
    HealthCheck,
    #[serde(rename = "maintenance")]
    Maintenance,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OperationPriority {
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "critical")]
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseOperationResponse {
    pub operation_id: String,
    pub status: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub estimated_duration: Option<u64>, // seconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseHealth {
    pub database_name: String,
    pub status: String,
    pub connection_count: u32,
    pub active_queries: u32,
    pub slow_queries: u32,
    pub cache_hit_ratio: f64,
    pub disk_usage_gb: f64,
    pub last_backup: Option<chrono::DateTime<chrono::Utc>>,
    pub last_optimization: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationStatus {
    pub migration_id: String,
    pub database_name: String,
    pub version: String,
    pub status: MigrationState,
    pub applied_at: Option<chrono::DateTime<chrono::Utc>>,
    pub rollback_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MigrationState {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "rolled_back")]
    RolledBack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub backup_id: String,
    pub database_name: String,
    pub backup_type: BackupType,
    pub size_gb: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub status: BackupStatus,
    pub location: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BackupType {
    #[serde(rename = "full")]
    Full,
    #[serde(rename = "incremental")]
    Incremental,
    #[serde(rename = "differential")]
    Differential,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BackupStatus {
    #[serde(rename = "scheduled")]
    Scheduled,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
}

#[derive(Clone)]
struct AppState {
    config: Config,
    database_manager: Arc<DatabaseManager>,
    migration_engine: Arc<MigrationEngine>,
    backup_manager: Arc<BackupManager>,
    query_optimizer: Arc<QueryOptimizer>,
    active_operations: Arc<RwLock<HashMap<String, DatabaseOperationResponse>>>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .init();

    info!("🚀 Starting Database Automation Service");

    // Load configuration
    let config = Config::new().await?;
    info!("Configuration loaded successfully");

    // Initialize components
    let database_manager = Arc::new(DatabaseManager::new(&config).await?);
    let migration_engine = Arc::new(MigrationEngine::new(&config).await?);
    let backup_manager = Arc::new(BackupManager::new(&config).await?);
    let query_optimizer = Arc::new(QueryOptimizer::new(&config).await?);
    let active_operations = Arc::new(RwLock::new(HashMap::new()));

    let app_state = AppState {
        config: config.clone(),
        database_manager,
        migration_engine,
        backup_manager,
        query_optimizer,
        active_operations,
    };

    info!("🗄️ Database automation components initialized");

    // Start background tasks
    start_background_tasks(app_state.clone()).await;

    // Build the router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/database/health", get(get_database_health))
        .route("/api/database/health/:database", get(get_specific_database_health))
        .route("/api/operations/execute", post(execute_database_operation))
        .route("/api/operations/status/:id", get(get_operation_status))
        .route("/api/operations/history", get(get_operation_history))
        .route("/api/migrations/status", get(get_migration_status))
        .route("/api/migrations/apply", post(apply_migration))
        .route("/api/migrations/rollback/:id", post(rollback_migration))
        .route("/api/backups/list", get(list_backups))
        .route("/api/backups/create", post(create_backup))
        .route("/api/backups/restore/:id", post(restore_backup))
        .route("/api/optimization/analyze", get(analyze_database_performance))
        .route("/api/optimization/optimize", post(optimize_database))
        .route("/api/maintenance/schedule", post(schedule_maintenance))
        .route("/api/maintenance/status", get(get_maintenance_status))
        .with_state(app_state);

    info!("📊 Background monitoring tasks started");

    let addr = format!("{}:{}", config.server.host, config.server.port);
    info!("🌐 Database Automation Service starting on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn start_background_tasks(state: AppState) {
    // Start health monitoring task
    let health_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            if let Err(e) = health_state.database_manager.monitor_health().await {
                error!("Health monitoring error: {}", e);
            }
        }
    });

    // Start backup scheduling task
    let backup_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300)); // 5 minutes
        loop {
            interval.tick().await;
            if let Err(e) = backup_state.backup_manager.check_scheduled_backups().await {
                error!("Backup scheduling error: {}", e);
            }
        }
    });

    // Start query optimization monitoring
    let optimization_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(e) = optimization_state.query_optimizer.monitor_queries().await {
                error!("Query monitoring error: {}", e);
            }
        }
    });
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "Database Automation Service",
        "timestamp": chrono::Utc::now(),
        "components": {
            "database_manager": "operational",
            "migration_engine": "operational",
            "backup_manager": "operational",
            "query_optimizer": "operational"
        }
    }))
}

async fn get_database_health(
    State(state): State<AppState>,
) -> Result<Json<Vec<DatabaseHealth>>, StatusCode> {
    match state.database_manager.get_health_status().await {
        Ok(health) => Ok(Json(health)),
        Err(e) => {
            error!("Error getting database health: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_specific_database_health(
    Path(database): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<DatabaseHealth>, StatusCode> {
    match state.database_manager.get_database_health(&database).await {
        Ok(health) => Ok(Json(health)),
        Err(e) => {
            error!("Error getting health for database {}: {}", database, e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

async fn execute_database_operation(
    State(state): State<AppState>,
    Json(request): Json<DatabaseOperationRequest>,
) -> Result<Json<DatabaseOperationResponse>, StatusCode> {
    let operation_id = Uuid::new_v4().to_string();
    
    info!("🔧 Executing database operation: {:?} (ID: {})", request.operation_type, operation_id);
    
    let response = match request.operation_type {
        OperationType::Migration => {
            state.migration_engine.execute_migration(&request).await
        },
        OperationType::Backup => {
            state.backup_manager.create_backup(&request).await
        },
        OperationType::Restore => {
            state.backup_manager.restore_backup(&request).await
        },
        OperationType::Optimization => {
            state.query_optimizer.optimize_database(&request).await
        },
        OperationType::HealthCheck => {
            state.database_manager.perform_health_check(&request).await
        },
        OperationType::Maintenance => {
            state.database_manager.perform_maintenance(&request).await
        },
    };

    match response {
        Ok(mut op_response) => {
            op_response.operation_id = operation_id.clone();
            
            // Store operation in history
            let mut operations = state.active_operations.write().await;
            operations.insert(operation_id, op_response.clone());
            
            Ok(Json(op_response))
        },
        Err(e) => {
            error!("Database operation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_operation_status(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<DatabaseOperationResponse>, StatusCode> {
    let operations = state.active_operations.read().await;
    match operations.get(&id) {
        Some(status) => Ok(Json(status.clone())),
        None => {
            warn!("Operation status not found for ID: {}", id);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

async fn get_operation_history(
    State(state): State<AppState>,
) -> Result<Json<Vec<DatabaseOperationResponse>>, StatusCode> {
    let operations = state.active_operations.read().await;
    let history: Vec<DatabaseOperationResponse> = operations.values().cloned().collect();
    Ok(Json(history))
}

async fn get_migration_status(
    State(state): State<AppState>,
) -> Result<Json<Vec<MigrationStatus>>, StatusCode> {
    match state.migration_engine.get_migration_status().await {
        Ok(migrations) => Ok(Json(migrations)),
        Err(e) => {
            error!("Error getting migration status: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn apply_migration(
    State(state): State<AppState>,
    Json(request): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<MigrationStatus>, StatusCode> {
    match state.migration_engine.apply_migration_from_request(&request).await {
        Ok(status) => Ok(Json(status)),
        Err(e) => {
            error!("Migration application failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn rollback_migration(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<MigrationStatus>, StatusCode> {
    match state.migration_engine.rollback_migration(&id).await {
        Ok(status) => Ok(Json(status)),
        Err(e) => {
            error!("Migration rollback failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn list_backups(
    State(state): State<AppState>,
) -> Result<Json<Vec<BackupInfo>>, StatusCode> {
    match state.backup_manager.list_backups().await {
        Ok(backups) => Ok(Json(backups)),
        Err(e) => {
            error!("Error listing backups: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn create_backup(
    State(state): State<AppState>,
    Json(request): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<BackupInfo>, StatusCode> {
    match state.backup_manager.create_backup_info(&request).await {
        Ok(backup) => Ok(Json(backup)),
        Err(e) => {
            error!("Backup creation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn restore_backup(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<DatabaseOperationResponse>, StatusCode> {
    match state.backup_manager.restore_backup_by_id(&id).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            error!("Backup restore failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn analyze_database_performance(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.query_optimizer.analyze_performance().await {
        Ok(analysis) => Ok(Json(analysis)),
        Err(e) => {
            error!("Performance analysis failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn optimize_database(
    State(state): State<AppState>,
    Json(request): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<DatabaseOperationResponse>, StatusCode> {
    match state.query_optimizer.optimize_database_queries(&request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            error!("Database optimization failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn schedule_maintenance(
    State(state): State<AppState>,
    Json(request): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<DatabaseOperationResponse>, StatusCode> {
    match state.database_manager.schedule_maintenance(&request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            error!("Maintenance scheduling failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_maintenance_status(
    State(state): State<AppState>,
) -> Result<Json<Vec<serde_json::Value>>, StatusCode> {
    match state.database_manager.get_maintenance_status().await {
        Ok(status) => Ok(Json(status)),
        Err(e) => {
            error!("Error getting maintenance status: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
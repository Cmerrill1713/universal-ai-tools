use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing::{info, warn, error};

mod config;
mod decision_engine;
mod code_generator;
mod migration_orchestrator;
mod risk_analyzer;
mod metrics;

use config::Config;
use decision_engine::DecisionEngine;
use migration_orchestrator::MigrationOrchestrator;
use metrics::ArchitectureMetrics;

#[derive(Clone)]
pub struct AppState {
    decision_engine: Arc<DecisionEngine>,
    migration_orchestrator: Arc<MigrationOrchestrator>,
    metrics: Arc<ArchitectureMetrics>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchitectureDecisionRequest {
    pub migration_recommendations: Vec<MigrationRecommendation>,
    pub system_constraints: SystemConstraints,
    pub priority_factors: PriorityFactors,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MigrationRecommendation {
    pub from_technology: String,
    pub to_technology: String,
    pub confidence_score: f64,
    pub benefits: Vec<String>,
    pub risks: Vec<String>,
    pub estimated_effort_days: u32,
    pub affected_services: Vec<String>,
    pub dependency_impact: DependencyImpact,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DependencyImpact {
    pub direct_dependencies: Vec<String>,
    pub transitive_dependencies: Vec<String>,
    pub breaking_changes: bool,
    pub backward_compatibility: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemConstraints {
    pub available_effort_days: u32,
    pub max_concurrent_migrations: u32,
    pub critical_services: Vec<String>,
    pub deployment_windows: Vec<DeploymentWindow>,
    pub resource_limits: ResourceLimits,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeploymentWindow {
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub max_risk_level: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_gb: u32,
    pub max_cpu_cores: u32,
    pub max_storage_gb: u32,
    pub network_bandwidth_mbps: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PriorityFactors {
    pub performance_weight: f64,
    pub security_weight: f64,
    pub maintenance_weight: f64,
    pub innovation_weight: f64,
    pub cost_weight: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ArchitectureDecision {
    pub decision_id: String,
    pub approved_migrations: Vec<ApprovedMigration>,
    pub rejected_migrations: Vec<RejectedMigration>,
    pub execution_plan: ExecutionPlan,
    pub risk_assessment: RiskAssessment,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApprovedMigration {
    pub migration: MigrationRecommendation,
    pub approval_score: f64,
    pub execution_priority: u32,
    pub prerequisites: Vec<String>,
    pub success_criteria: Vec<String>,
    pub rollback_plan: RollbackPlan,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RejectedMigration {
    pub migration: MigrationRecommendation,
    pub rejection_reasons: Vec<String>,
    pub rejection_score: f64,
    pub reconsider_conditions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionPlan {
    pub phases: Vec<ExecutionPhase>,
    pub estimated_duration_days: u32,
    pub resource_requirements: ResourceLimits,
    pub monitoring_checkpoints: Vec<MonitoringCheckpoint>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionPhase {
    pub phase_id: String,
    pub name: String,
    pub description: String,
    pub tasks: Vec<ExecutionTask>,
    pub dependencies: Vec<String>,
    pub estimated_duration_hours: u32,
    pub success_criteria: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionTask {
    pub task_id: String,
    pub name: String,
    pub task_type: TaskType,
    pub parameters: HashMap<String, serde_json::Value>,
    pub estimated_duration_minutes: u32,
    pub automation_level: AutomationLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskType {
    CodeGeneration,
    DependencyUpdate,
    ServiceMigration,
    DatabaseMigration,
    ConfigurationUpdate,
    TestExecution,
    Deployment,
    Validation,
    Rollback,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AutomationLevel {
    FullyAutomated,
    SemiAutomated,
    ManualApprovalRequired,
    ManualOnly,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitoringCheckpoint {
    pub checkpoint_id: String,
    pub phase_id: String,
    pub metrics_to_monitor: Vec<String>,
    pub success_thresholds: HashMap<String, f64>,
    pub failure_thresholds: HashMap<String, f64>,
    pub alert_conditions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RollbackPlan {
    pub rollback_triggers: Vec<String>,
    pub rollback_steps: Vec<ExecutionTask>,
    pub rollback_duration_minutes: u32,
    pub data_recovery_required: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub overall_risk_score: f64,
    pub risk_factors: Vec<RiskFactor>,
    pub mitigation_strategies: Vec<String>,
    pub contingency_plans: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RiskFactor {
    pub factor_type: String,
    pub severity: String,
    pub probability: f64,
    pub impact: String,
    pub mitigation: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("architecture_ai=debug,tower_http=debug")
        .init();

    info!("🏗️ Starting Architecture AI Decision Engine");

    // Load configuration
    let config = Config::from_env()?;
    info!("Configuration loaded from environment");

    // Initialize metrics
    let metrics = Arc::new(ArchitectureMetrics::new()?);
    info!("📊 Metrics system initialized");

    // Initialize decision engine
    let decision_engine = Arc::new(DecisionEngine::new(&config).await?);
    info!("🧠 Decision engine initialized with AI models");

    // Initialize migration orchestrator
    let migration_orchestrator = Arc::new(MigrationOrchestrator::new(&config).await?);
    info!("🔄 Migration orchestrator initialized");

    // Create application state
    let app_state = AppState {
        decision_engine,
        migration_orchestrator,
        metrics: metrics.clone(),
    };

    // Build application routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(export_metrics))
        .route("/api/decisions", post(make_architecture_decision))
        .route("/api/decisions/:decision_id", get(get_decision_status))
        .route("/api/decisions/:decision_id/execute", post(execute_decision))
        .route("/api/decisions/:decision_id/rollback", post(rollback_decision))
        .route("/api/migrations/status", get(get_migration_status))
        .route("/api/migrations/:migration_id/logs", get(get_migration_logs))
        .route("/api/system/constraints", get(get_system_constraints))
        .route("/api/templates", get(list_code_templates))
        .route("/api/templates/:template_id/generate", post(generate_code))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start server
    let port = config.server.port;
    let listener = TcpListener::bind(&format!("0.0.0.0:{}", port)).await?;
    
    info!("🚀 Architecture AI server listening on port {}", port);
    info!("📡 Ready to process architecture decisions and orchestrate migrations");

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "service": "architecture-ai",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now(),
        "capabilities": [
            "architecture_decision_making",
            "migration_orchestration", 
            "risk_assessment",
            "code_generation",
            "autonomous_execution"
        ]
    })))
}

async fn export_metrics(State(state): State<AppState>) -> Result<String, StatusCode> {
    state.metrics.export_metrics()
        .map_err(|e| {
            error!("Failed to export metrics: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

async fn make_architecture_decision(
    State(state): State<AppState>,
    Json(request): Json<ArchitectureDecisionRequest>,
) -> Result<Json<ArchitectureDecision>, StatusCode> {
    info!("🤔 Processing architecture decision request with {} migration recommendations", 
          request.migration_recommendations.len());

    state.metrics.decisions_total.inc();
    let _timer = state.metrics.decision_duration_seconds.start_timer();

    match state.decision_engine.make_decision(request).await {
        Ok(decision) => {
            info!("✅ Architecture decision completed: {} approved, {} rejected", 
                  decision.approved_migrations.len(), decision.rejected_migrations.len());
            Ok(Json(decision))
        }
        Err(e) => {
            error!("❌ Failed to make architecture decision: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_decision_status(
    State(state): State<AppState>,
    Path(decision_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.decision_engine.get_decision_status(&decision_id).await {
        Ok(status) => Ok(Json(status)),
        Err(e) => {
            error!("Failed to get decision status for {}: {}", decision_id, e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

async fn execute_decision(
    State(state): State<AppState>,
    Path(decision_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("🚀 Executing architecture decision: {}", decision_id);

    match state.migration_orchestrator.execute_decision(&decision_id).await {
        Ok(execution_result) => {
            info!("✅ Decision execution initiated successfully");
            Ok(Json(execution_result))
        }
        Err(e) => {
            error!("❌ Failed to execute decision {}: {}", decision_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn rollback_decision(
    State(state): State<AppState>,
    Path(decision_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    warn!("🔄 Rolling back architecture decision: {}", decision_id);

    match state.migration_orchestrator.rollback_decision(&decision_id).await {
        Ok(rollback_result) => {
            info!("✅ Decision rollback completed successfully");
            Ok(Json(rollback_result))
        }
        Err(e) => {
            error!("❌ Failed to rollback decision {}: {}", decision_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_migration_status(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.migration_orchestrator.get_all_migration_status().await {
        Ok(status) => Ok(Json(status)),
        Err(e) => {
            error!("Failed to get migration status: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_migration_logs(
    State(state): State<AppState>,
    Path(migration_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.migration_orchestrator.get_migration_logs(&migration_id).await {
        Ok(logs) => Ok(Json(logs)),
        Err(e) => {
            error!("Failed to get migration logs for {}: {}", migration_id, e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

async fn get_system_constraints(State(state): State<AppState>) -> Result<Json<SystemConstraints>, StatusCode> {
    match state.decision_engine.get_current_system_constraints().await {
        Ok(constraints) => Ok(Json(constraints)),
        Err(e) => {
            error!("Failed to get system constraints: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn list_code_templates(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.migration_orchestrator.list_available_templates().await {
        Ok(templates) => Ok(Json(templates)),
        Err(e) => {
            error!("Failed to list code templates: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn generate_code(
    State(state): State<AppState>,
    Path(template_id): Path<String>,
    Json(parameters): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("🔧 Generating code from template: {}", template_id);

    match state.migration_orchestrator.generate_code(&template_id, parameters).await {
        Ok(generated_code) => {
            info!("✅ Code generation completed successfully");
            Ok(Json(generated_code))
        }
        Err(e) => {
            error!("❌ Failed to generate code from template {}: {}", template_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
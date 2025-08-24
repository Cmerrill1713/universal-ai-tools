use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing::{info, warn, error, debug};

mod chaos_scenarios;
mod system_monitor;
mod safety_guard;
mod metrics;

use chaos_scenarios::ChaosScenarios;
use system_monitor::SystemMonitor;
use safety_guard::SafetyGuard;
use metrics::ChaosMetrics;

#[derive(Clone)]
pub struct AppState {
    chaos_scenarios: Arc<ChaosScenarios>,
    system_monitor: Arc<SystemMonitor>,
    safety_guard: Arc<SafetyGuard>,
    metrics: Arc<ChaosMetrics>,
    active_experiments: Arc<Mutex<HashMap<String, ChaosExperiment>>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChaosRequest {
    pub scenario: String,
    pub target: String,
    pub duration: u64, // milliseconds
    pub intensity: String, // low, medium, high
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub safety_mode: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChaosExperiment {
    pub id: String,
    pub scenario: String,
    pub target: String,
    pub duration: u64,
    pub intensity: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub status: ExperimentStatus,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub results: Option<ExperimentResults>,
    pub safety_mode: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ExperimentStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
    SafetyAborted,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExperimentResults {
    pub metrics_before: HashMap<String, f64>,
    pub metrics_during: HashMap<String, f64>,
    pub metrics_after: HashMap<String, f64>,
    pub impact_assessment: ImpactAssessment,
    pub recovery_time: Option<u64>,
    pub lessons_learned: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImpactAssessment {
    pub severity: String, // minimal, moderate, significant, severe
    pub affected_services: Vec<String>,
    pub performance_impact: f64, // percentage degradation
    pub availability_impact: f64, // percentage downtime
    pub user_impact_score: f64, // 0.0 to 1.0
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChaosResponse {
    pub experiment_id: String,
    pub status: String,
    pub message: String,
    pub estimated_completion: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct ListExperimentsQuery {
    pub status: Option<String>,
    pub scenario: Option<String>,
    pub limit: Option<usize>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("chaos_engine=debug,tower_http=debug")
        .init();

    info!("🌪️ Starting Chaos Engineering Engine");

    // Initialize components
    let chaos_scenarios = Arc::new(ChaosScenarios::new().await?);
    let system_monitor = Arc::new(SystemMonitor::new().await?);
    let safety_guard = Arc::new(SafetyGuard::new().await?);
    let metrics = Arc::new(ChaosMetrics::new()?);

    info!("🛡️ Safety mechanisms initialized");
    info!("📊 System monitoring active");
    info!("🎯 Chaos scenarios loaded");

    // Create application state
    let app_state = AppState {
        chaos_scenarios,
        system_monitor,
        safety_guard,
        metrics: metrics.clone(),
        active_experiments: Arc::new(Mutex::new(HashMap::new())),
    };

    // Build application routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(export_metrics))
        .route("/api/chaos/inject", post(inject_chaos))
        .route("/api/chaos/experiments", get(list_experiments))
        .route("/api/chaos/experiments/:experiment_id", get(get_experiment))
        .route("/api/chaos/experiments/:experiment_id/cancel", post(cancel_experiment))
        .route("/api/chaos/scenarios", get(list_scenarios))
        .route("/api/chaos/system/status", get(get_system_status))
        .route("/api/automation/handle", post(handle_automation_event))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start background tasks
    let metrics_clone = metrics.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(e) = metrics_clone.update_system_metrics().await {
                error!("Failed to update system metrics: {}", e);
            }
        }
    });

    // Start server
    let port = std::env::var("CHAOS_ENGINE_PORT")
        .unwrap_or_else(|_| "8087".to_string())
        .parse::<u16>()
        .unwrap_or(8087);

    let listener = TcpListener::bind(&format!("0.0.0.0:{}", port)).await?;
    
    info!("🚀 Chaos Engine server listening on port {}", port);
    info!("⚠️ SAFETY MODE: Enabled by default - All experiments are monitored");
    info!("🔬 Ready to conduct controlled chaos experiments");

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "service": "chaos-engine",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now(),
        "capabilities": [
            "fault_injection",
            "network_chaos",
            "resource_stress",
            "service_disruption",
            "safety_monitoring",
            "impact_assessment"
        ],
        "safety_mode": true,
        "max_blast_radius": 0.3
    })))
}

async fn export_metrics(State(state): State<AppState>) -> Result<String, StatusCode> {
    state.metrics.export_prometheus()
        .map_err(|e| {
            error!("Failed to export metrics: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })
}

async fn inject_chaos(
    State(state): State<AppState>,
    Json(request): Json<ChaosRequest>,
) -> Result<Json<ChaosResponse>, StatusCode> {
    info!("🌪️ Chaos injection requested: {} on {}", request.scenario, request.target);

    // Validate request
    if !state.chaos_scenarios.is_scenario_available(&request.scenario) {
        warn!("❌ Unknown chaos scenario: {}", request.scenario);
        return Ok(Json(ChaosResponse {
            experiment_id: "".to_string(),
            status: "rejected".to_string(),
            message: format!("Unknown scenario: {}", request.scenario),
            estimated_completion: None,
        }));
    }

    // Safety check
    let safety_check = state.safety_guard.evaluate_safety(&request).await
        .map_err(|e| {
            error!("Safety evaluation failed: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !safety_check.is_safe {
        warn!("🛑 Experiment rejected by safety guard: {}", safety_check.reason);
        return Ok(Json(ChaosResponse {
            experiment_id: "".to_string(),
            status: "safety_rejected".to_string(),
            message: format!("Safety rejection: {}", safety_check.reason),
            estimated_completion: None,
        }));
    }

    // Create experiment
    let experiment_id = uuid::Uuid::new_v4().to_string();
    let experiment = ChaosExperiment {
        id: experiment_id.clone(),
        scenario: request.scenario.clone(),
        target: request.target.clone(),
        duration: request.duration,
        intensity: request.intensity.clone(),
        parameters: request.parameters.unwrap_or_default(),
        status: ExperimentStatus::Pending,
        start_time: SystemTime::now().duration_since(UNIX_EPOCH)
            .unwrap().as_secs(),
        end_time: None,
        results: None,
        safety_mode: request.safety_mode.unwrap_or(true),
    };

    // Store experiment
    {
        let mut experiments = state.active_experiments.lock().unwrap();
        experiments.insert(experiment_id.clone(), experiment);
    }

    // Execute experiment asynchronously
    let state_clone = state.clone();
    let experiment_id_clone = experiment_id.clone();
    tokio::spawn(async move {
        if let Err(e) = execute_chaos_experiment(state_clone, experiment_id_clone).await {
            error!("Chaos experiment execution failed: {}", e);
        }
    });

    info!("✅ Chaos experiment {} queued for execution", experiment_id);

    Ok(Json(ChaosResponse {
        experiment_id,
        status: "accepted".to_string(),
        message: "Experiment queued for execution".to_string(),
        estimated_completion: Some(
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() 
            + (request.duration / 1000) + 30 // Add buffer for setup/teardown
        ),
    }))
}

async fn execute_chaos_experiment(
    state: AppState,
    experiment_id: String,
) -> anyhow::Result<()> {
    // Get experiment details
    let experiment = {
        let experiments = state.active_experiments.lock().unwrap();
        experiments.get(&experiment_id).cloned()
            .ok_or_else(|| anyhow::anyhow!("Experiment not found: {}", experiment_id))?
    };

    info!("🔬 Starting chaos experiment: {}", experiment_id);

    // Update status to running
    {
        let mut experiments = state.active_experiments.lock().unwrap();
        if let Some(exp) = experiments.get_mut(&experiment_id) {
            exp.status = ExperimentStatus::Running;
        }
    }

    // Collect baseline metrics
    let metrics_before = state.system_monitor.collect_metrics().await?;
    debug!("📊 Baseline metrics collected for experiment {}", experiment_id);

    // Execute chaos scenario
    let execution_result = state.chaos_scenarios.execute_scenario(
        &experiment.scenario,
        &experiment.target,
        experiment.duration,
        &experiment.intensity,
        &experiment.parameters,
    ).await;

    match execution_result {
        Ok(scenario_results) => {
            info!("✅ Chaos scenario completed successfully: {}", experiment_id);

            // Collect metrics after chaos
            let metrics_after = state.system_monitor.collect_metrics().await
                .unwrap_or_else(|_| HashMap::new());

            // Calculate impact assessment
            let impact = calculate_impact_assessment(&metrics_before, &metrics_after);

            // Create results
            let results = ExperimentResults {
                metrics_before,
                metrics_during: scenario_results.metrics_during,
                metrics_after,
                impact_assessment: impact,
                recovery_time: scenario_results.recovery_time,
                lessons_learned: scenario_results.lessons_learned,
            };

            // Update experiment with results
            {
                let mut experiments = state.active_experiments.lock().unwrap();
                if let Some(exp) = experiments.get_mut(&experiment_id) {
                    exp.status = ExperimentStatus::Completed;
                    exp.end_time = Some(SystemTime::now().duration_since(UNIX_EPOCH)
                        .unwrap().as_secs());
                    exp.results = Some(results);
                }
            }

            // Update metrics
            state.metrics.record_experiment_completion(&experiment.scenario, true);

            info!("📈 Experiment {} completed with results", experiment_id);
        },
        Err(e) => {
            error!("❌ Chaos experiment failed: {}: {}", experiment_id, e);

            // Update status to failed
            {
                let mut experiments = state.active_experiments.lock().unwrap();
                if let Some(exp) = experiments.get_mut(&experiment_id) {
                    exp.status = ExperimentStatus::Failed;
                    exp.end_time = Some(SystemTime::now().duration_since(UNIX_EPOCH)
                        .unwrap().as_secs());
                }
            }

            // Update metrics
            state.metrics.record_experiment_completion(&experiment.scenario, false);
        }
    }

    Ok(())
}

fn calculate_impact_assessment(
    before: &HashMap<String, f64>,
    after: &HashMap<String, f64>,
) -> ImpactAssessment {
    let mut performance_impact = 0.0;
    let mut availability_impact = 0.0;

    // Calculate performance degradation
    if let (Some(cpu_before), Some(cpu_after)) = (before.get("cpu_usage"), after.get("cpu_usage")) {
        performance_impact = ((cpu_after - cpu_before) / cpu_before * 100.0).max(0.0);
    }

    // Calculate availability impact based on response times
    if let (Some(resp_before), Some(resp_after)) = (before.get("response_time"), after.get("response_time")) {
        availability_impact = ((resp_after - resp_before) / resp_before * 100.0).max(0.0);
    }

    let severity = match performance_impact.max(availability_impact) {
        x if x < 5.0 => "minimal",
        x if x < 15.0 => "moderate", 
        x if x < 30.0 => "significant",
        _ => "severe"
    };

    ImpactAssessment {
        severity: severity.to_string(),
        affected_services: vec![], // Would be populated based on actual monitoring
        performance_impact,
        availability_impact,
        user_impact_score: (performance_impact + availability_impact) / 200.0, // 0-1 scale
    }
}

async fn list_experiments(
    State(state): State<AppState>,
    Query(query): Query<ListExperimentsQuery>,
) -> Result<Json<Vec<ChaosExperiment>>, StatusCode> {
    let experiments = state.active_experiments.lock().unwrap();
    
    let filtered: Vec<ChaosExperiment> = experiments
        .values()
        .filter(|exp| {
            if let Some(status_filter) = &query.status {
                format!("{:?}", exp.status).to_lowercase() == status_filter.to_lowercase()
            } else {
                true
            }
        })
        .filter(|exp| {
            if let Some(scenario_filter) = &query.scenario {
                exp.scenario == *scenario_filter
            } else {
                true
            }
        })
        .take(query.limit.unwrap_or(50))
        .cloned()
        .collect();

    Ok(Json(filtered))
}

async fn get_experiment(
    State(state): State<AppState>,
    Path(experiment_id): Path<String>,
) -> Result<Json<ChaosExperiment>, StatusCode> {
    let experiments = state.active_experiments.lock().unwrap();
    
    match experiments.get(&experiment_id) {
        Some(experiment) => Ok(Json(experiment.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn cancel_experiment(
    State(state): State<AppState>,
    Path(experiment_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut experiments = state.active_experiments.lock().unwrap();
    
    match experiments.get_mut(&experiment_id) {
        Some(experiment) => {
            if matches!(experiment.status, ExperimentStatus::Pending | ExperimentStatus::Running) {
                experiment.status = ExperimentStatus::Cancelled;
                experiment.end_time = Some(SystemTime::now().duration_since(UNIX_EPOCH)
                    .unwrap().as_secs());
                
                info!("🛑 Experiment {} cancelled by user request", experiment_id);
                
                Ok(Json(serde_json::json!({
                    "status": "cancelled",
                    "experiment_id": experiment_id,
                    "message": "Experiment cancelled successfully"
                })))
            } else {
                Ok(Json(serde_json::json!({
                    "status": "error",
                    "message": "Cannot cancel experiment in current status"
                })))
            }
        },
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn list_scenarios(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    let scenarios = state.chaos_scenarios.list_available_scenarios().await
        .map_err(|e| {
            error!("Failed to list scenarios: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "scenarios": scenarios,
        "total_count": scenarios.len()
    })))
}

async fn get_system_status(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    let system_metrics = state.system_monitor.collect_metrics().await
        .map_err(|e| {
            error!("Failed to collect system metrics: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let active_count = {
        let experiments = state.active_experiments.lock().unwrap();
        experiments.values()
            .filter(|exp| matches!(exp.status, ExperimentStatus::Running))
            .count()
    };

    Ok(Json(serde_json::json!({
        "system_metrics": system_metrics,
        "active_experiments": active_count,
        "safety_status": "enabled",
        "last_updated": chrono::Utc::now()
    })))
}

async fn handle_automation_event(
    State(state): State<AppState>,
    Json(event): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("📨 Received automation event from orchestration hub");

    let event_type = event.get("type").and_then(|v| v.as_str()).unwrap_or("");
    let payload = event.get("payload").unwrap_or(&serde_json::Value::Null);

    match event_type {
        "chaos.inject" => {
            // Extract chaos parameters from automation event
            if let Ok(chaos_request) = serde_json::from_value::<ChaosRequest>(payload.clone()) {
                match inject_chaos(State(state), Json(chaos_request)).await {
                    Ok(response) => Ok(Json(serde_json::json!({
                        "status": "handled",
                        "response": response.0
                    }))),
                    Err(e) => {
                        error!("Failed to handle chaos injection: {:?}", e);
                        Ok(Json(serde_json::json!({
                            "status": "error",
                            "message": "Failed to process chaos injection request"
                        })))
                    }
                }
            } else {
                warn!("Invalid chaos injection payload received");
                Ok(Json(serde_json::json!({
                    "status": "error",
                    "message": "Invalid payload for chaos injection"
                })))
            }
        },
        _ => {
            debug!("Ignoring non-chaos automation event: {}", event_type);
            Ok(Json(serde_json::json!({
                "status": "ignored",
                "message": "Event type not handled by chaos engine"
            })))
        }
    }
}
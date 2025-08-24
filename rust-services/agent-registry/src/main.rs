//! Agent Registry Service for Universal AI Tools
//! High-performance Rust service for agent management, orchestration, and lifecycle control

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put, delete},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{net::TcpListener, time::interval};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{error, info, instrument, warn};
use uuid::Uuid;

mod agent;
mod config;
mod metrics;
mod registry;
mod tracing_setup;

use crate::{
    agent::{AgentCapability, AgentConfig, AgentDefinition, AgentStatus, AgentType},
    config::Config,
    metrics::Metrics,
    registry::AgentRegistryCore,
    tracing_setup::init_tracing,
};

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub registry: Arc<AgentRegistryCore>,
    pub metrics: Arc<Metrics>,
    #[allow(dead_code)]
    pub config: Arc<Config>,
}

/// Agent registration request
#[derive(Debug, Deserialize)]
pub struct RegisterAgentRequest {
    pub name: String,
    pub agent_type: AgentType,
    pub description: String,
    pub capabilities: Vec<AgentCapability>,
    pub config: AgentConfig,
    pub version: String,
    pub endpoint: Option<String>,
}

/// Agent update request
#[derive(Debug, Deserialize)]
pub struct UpdateAgentRequest {
    pub description: Option<String>,
    pub capabilities: Option<Vec<AgentCapability>>,
    pub config: Option<AgentConfig>,
    pub status: Option<AgentStatus>,
}

/// Agent query parameters
#[derive(Debug, Deserialize)]
pub struct AgentQuery {
    pub agent_type: Option<AgentType>,
    pub status: Option<AgentStatus>,
    pub capability: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Agent execution request
#[derive(Debug, Deserialize)]
pub struct ExecuteAgentRequest {
    pub input: serde_json::Value,
    pub context: Option<HashMap<String, serde_json::Value>>,
    pub timeout_seconds: Option<u64>,
}

/// Agent execution response
#[derive(Debug, Serialize)]
pub struct ExecuteAgentResponse {
    pub success: bool,
    pub output: serde_json::Value,
    pub execution_time_ms: u64,
    pub agent_id: Uuid,
    pub agent_name: String,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    registered_agents: usize,
    active_agents: usize,
    total_executions: u64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize OpenTelemetry tracing
    init_tracing().await?;

    // Load configuration
    let config = Arc::new(Config::load()?);
    
    info!(
        service_name = "agent-registry",
        version = env!("CARGO_PKG_VERSION"),
        port = config.port,
        "Starting Agent Registry service"
    );

    // Initialize components
    let registry = Arc::new(AgentRegistryCore::new(config.clone()).await?);
    let metrics = Arc::new(Metrics::new()?);

    // Create application state
    let app_state = AppState {
        registry: registry.clone(),
        metrics: metrics.clone(),
        config: config.clone(),
    };

    // Start background tasks
    let health_check_state = app_state.clone();
    tokio::spawn(async move {
        background_health_monitoring(health_check_state).await;
    });

    let cleanup_state = app_state.clone();
    tokio::spawn(async move {
        background_cleanup_task(cleanup_state).await;
    });

    // Build the application routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_endpoint))
        .route("/agents", get(list_agents))
        .route("/agents", post(register_agent))
        .route("/agents/:id", get(get_agent))
        .route("/agents/:id", put(update_agent))
        .route("/agents/:id", delete(unregister_agent))
        .route("/agents/:id/execute", post(execute_agent))
        .route("/agents/:id/status", get(get_agent_status))
        .route("/agents/:id/health", post(check_agent_health))
        .route("/agents/search", get(search_agents))
        .route("/agents/types", get(get_agent_types))
        .route("/agents/capabilities", get(get_capabilities))
        .route("/orchestration/workflow", post(execute_workflow))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = TcpListener::bind(addr).await?;

    info!(addr = %addr, "Agent Registry service listening");

    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>, StatusCode> {
    let registry_stats = state.registry.get_stats().await;
    let uptime = state.config.start_time.elapsed().as_secs();
    
    let response = HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        registered_agents: registry_stats.total_agents,
        active_agents: registry_stats.active_agents,
        total_executions: registry_stats.total_executions,
    };

    // Record metrics
    state.metrics.health_checks_total.inc();
    state.metrics.registered_agents_total.set(registry_stats.total_agents as f64);
    state.metrics.active_agents_total.set(registry_stats.active_agents as f64);

    Ok(Json(response))
}

/// List agents with optional filtering
#[instrument(skip(state))]
async fn list_agents(
    State(state): State<AppState>,
    Query(params): Query<AgentQuery>,
) -> Result<Json<Vec<AgentDefinition>>, StatusCode> {
    let agents = match state.registry
        .list_agents(
            params.agent_type,
            params.status,
            params.capability.as_deref(),
            params.limit.unwrap_or(50),
            params.offset.unwrap_or(0),
        )
        .await
    {
        Ok(agents) => agents,
        Err(e) => {
            error!("Failed to list agents: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    state.metrics.agent_list_requests_total.inc();
    Ok(Json(agents))
}

/// Register a new agent
#[instrument(skip(state))]
async fn register_agent(
    State(state): State<AppState>,
    Json(request): Json<RegisterAgentRequest>,
) -> Result<Json<AgentDefinition>, StatusCode> {
    info!(
        agent_name = %request.name,
        agent_type = ?request.agent_type,
        capabilities_count = request.capabilities.len(),
        "Registering new agent"
    );

    let params = crate::registry::RegisterAgentParams {
        name: request.name,
        agent_type: request.agent_type,
        description: request.description,
        capabilities: request.capabilities,
        config: request.config,
        version: request.version,
        endpoint: request.endpoint,
    };

    let agent_definition = match state.registry
        .register_agent(params)
        .await
    {
        Ok(definition) => definition,
        Err(e) => {
            error!("Failed to register agent: {}", e);
            state.metrics.agent_registration_errors_total.inc();
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    state.metrics.agent_registrations_total.inc();
    Ok(Json(agent_definition))
}

/// Get agent details
#[instrument(skip(state))]
async fn get_agent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<AgentDefinition>, StatusCode> {
    match state.registry.get_agent(id).await {
        Ok(Some(agent)) => Ok(Json(agent)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get agent {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Update agent configuration
#[instrument(skip(state))]
async fn update_agent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateAgentRequest>,
) -> Result<Json<AgentDefinition>, StatusCode> {
    let updated_agent = match state.registry
        .update_agent(id, request.description, request.capabilities, request.config, request.status)
        .await
    {
        Ok(agent) => agent,
        Err(e) => {
            error!("Failed to update agent {}: {}", id, e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    state.metrics.agent_updates_total.inc();
    Ok(Json(updated_agent))
}

/// Unregister an agent
#[instrument(skip(state))]
async fn unregister_agent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.registry.unregister_agent(id).await {
        Ok(true) => {
            state.metrics.agent_unregistrations_total.inc();
            Ok(Json(serde_json::json!({
                "success": true,
                "message": "Agent unregistered successfully"
            })))
        }
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to unregister agent {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Execute an agent
#[instrument(skip(state))]
async fn execute_agent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<ExecuteAgentRequest>,
) -> Result<Json<ExecuteAgentResponse>, StatusCode> {
    let start_time = Instant::now();
    
    info!(agent_id = %id, "Executing agent");

    let execution_result = match state.registry
        .execute_agent(
            id,
            request.input,
            request.context.unwrap_or_default(),
            Duration::from_secs(request.timeout_seconds.unwrap_or(30)),
        )
        .await
    {
        Ok(result) => result,
        Err(e) => {
            error!("Agent execution failed for {}: {}", id, e);
            state.metrics.agent_execution_errors_total.inc();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let execution_time = start_time.elapsed().as_millis() as u64;
    
    // Record metrics
    state.metrics.agent_executions_total.inc();
    state.metrics.agent_execution_duration_seconds.observe(execution_time as f64 / 1000.0);

    let response = ExecuteAgentResponse {
        success: execution_result.success,
        output: execution_result.output,
        execution_time_ms: execution_time,
        agent_id: id,
        agent_name: execution_result.agent_name,
        metadata: execution_result.metadata,
    };

    Ok(Json(response))
}

/// Get agent status
#[instrument(skip(state))]
async fn get_agent_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.registry.get_agent_status(id).await {
        Ok(status) => Ok(Json(serde_json::json!({
            "agent_id": id,
            "status": status.status,
            "last_seen": status.last_seen,
            "health_score": status.health_score,
            "execution_count": status.execution_count,
            "error_count": status.error_count
        }))),
        Err(e) => {
            error!("Failed to get agent status for {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Check agent health
#[instrument(skip(state))]
async fn check_agent_health(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.registry.check_agent_health(id).await {
        Ok(health) => Ok(Json(serde_json::json!({
            "agent_id": id,
            "healthy": health.healthy,
            "response_time_ms": health.response_time_ms,
            "last_check": health.last_check,
            "error_message": health.error_message
        }))),
        Err(e) => {
            error!("Health check failed for agent {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Search agents by capabilities or other criteria
#[instrument(skip(state))]
async fn search_agents(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<AgentDefinition>>, StatusCode> {
    let search_query = params.get("q").map(|s| s.as_str()).unwrap_or("");
    
    match state.registry.search_agents(search_query).await {
        Ok(agents) => Ok(Json(agents)),
        Err(e) => {
            error!("Agent search failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get available agent types
#[instrument(skip(state))]
async fn get_agent_types(State(state): State<AppState>) -> Result<Json<Vec<AgentType>>, StatusCode> {
    let types = state.registry.get_agent_types().await;
    Ok(Json(types))
}

/// Get available capabilities
#[instrument(skip(state))]
async fn get_capabilities(State(state): State<AppState>) -> Result<Json<Vec<AgentCapability>>, StatusCode> {
    let capabilities = state.registry.get_capabilities().await;
    Ok(Json(capabilities))
}

/// Execute a workflow with multiple agents
#[instrument(skip(state))]
async fn execute_workflow(
    State(state): State<AppState>,
    Json(workflow): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.registry.execute_workflow(workflow).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Workflow execution failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Metrics endpoint
#[instrument(skip(state))]
async fn metrics_endpoint(State(state): State<AppState>) -> Result<String, StatusCode> {
    let encoder = prometheus::TextEncoder::new();
    let metric_families = state.metrics.registry.gather();
    
    match encoder.encode_to_string(&metric_families) {
        Ok(output) => Ok(output),
        Err(e) => {
            error!("Failed to encode metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Background health monitoring task
async fn background_health_monitoring(state: AppState) {
    let mut interval = interval(Duration::from_secs(30));
    
    info!("Starting background health monitoring task");
    
    loop {
        interval.tick().await;
        
        if let Err(e) = state.registry.perform_health_checks().await {
            warn!("Health check cycle failed: {}", e);
        }
    }
}

/// Background cleanup task
async fn background_cleanup_task(state: AppState) {
    let mut interval = interval(Duration::from_secs(300)); // Every 5 minutes
    
    info!("Starting background cleanup task");
    
    loop {
        interval.tick().await;
        
        if let Err(e) = state.registry.cleanup_inactive_agents().await {
            warn!("Cleanup cycle failed: {}", e);
        }
    }
}
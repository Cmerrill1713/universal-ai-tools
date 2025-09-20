use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{info, warn};
use uuid::Uuid;

mod agent_registry;
mod collaboration;
mod types;

use agent_registry::AgentRegistry;
use collaboration::CollaborationMesh;
use types::*;

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    agent_registry: Arc<RwLock<AgentRegistry>>,
    collaboration_mesh: Arc<RwLock<CollaborationMesh>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            agent_registry: Arc::new(RwLock::new(AgentRegistry::new())),
            collaboration_mesh: Arc::new(RwLock::new(CollaborationMesh::new())),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("agent_coordination_service=debug,info")
        .init();

    info!("Starting Agent Coordination Service");

    // Initialize application state
    let state = AppState::new();

    // Build the application router
    let app = Router::new()
        // Agent Registry routes
        .route("/api/v1/agents", get(list_agents))
        .route("/api/v1/agents/:name", get(get_agent))
        .route("/api/v1/agents/:name/load", post(load_agent))
        .route("/api/v1/agents/:name/unload", post(unload_agent))

        // Collaboration routes
        .route("/api/v1/collaboration/request", post(request_collaboration))
        .route("/api/v1/collaboration/:session_id", get(get_collaboration_status))
        .route("/api/v1/collaboration/:session_id/complete", post(complete_collaboration))

        // Health check
        .route("/health", get(health_check))

        // Add CORS support
        .layer(CorsLayer::permissive())

        // Share state across handlers
        .with_state(state);

    // Start the server
    let port = std::env::var("PORT").unwrap_or_else(|_| "3034".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("Agent Coordination Service listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check endpoint
async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "agent-coordination-service",
        "timestamp": chrono::Utc::now()
    }))
}

/// List all available agents
async fn list_agents(State(state): State<AppState>) -> Result<Json<Vec<AgentDefinition>>, StatusCode> {
    let registry = state.agent_registry.read().await;
    let agents = registry.list_agents().await;

    match agents {
        Ok(agents) => Ok(Json(agents)),
        Err(e) => {
            warn!("Failed to list agents: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get specific agent information
async fn get_agent(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<AgentDefinition>, StatusCode> {
    let registry = state.agent_registry.read().await;

    match registry.get_agent_definition(&name).await {
        Ok(Some(agent)) => Ok(Json(agent)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            warn!("Failed to get agent {}: {}", name, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Load an agent
async fn load_agent(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<AgentLoadResponse>, StatusCode> {
    let mut registry = state.agent_registry.write().await;

    match registry.load_agent(&name).await {
        Ok(agent_id) => Ok(Json(AgentLoadResponse {
            agent_id,
            name,
            status: "loaded".to_string(),
            timestamp: chrono::Utc::now(),
        })),
        Err(e) => {
            warn!("Failed to load agent {}: {}", name, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Unload an agent
async fn unload_agent(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut registry = state.agent_registry.write().await;

    match registry.unload_agent(&name).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "name": name,
            "status": "unloaded",
            "timestamp": chrono::Utc::now()
        }))),
        Err(e) => {
            warn!("Failed to unload agent {}: {}", name, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Request agent collaboration
async fn request_collaboration(
    State(state): State<AppState>,
    Json(request): Json<CollaborationRequest>,
) -> Result<Json<CollaborationResponse>, StatusCode> {
    let mut mesh = state.collaboration_mesh.write().await;

    match mesh.request_collaboration(request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            warn!("Failed to request collaboration: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get collaboration status
async fn get_collaboration_status(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<CollaborationStatus>, StatusCode> {
    let mesh = state.collaboration_mesh.read().await;

    match mesh.get_collaboration_status(session_id).await {
        Ok(Some(status)) => Ok(Json(status)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            warn!("Failed to get collaboration status for {}: {}", session_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Complete collaboration session
async fn complete_collaboration(
    State(state): State<AppState>,
    Path(session_id): Path<Uuid>,
    Json(result): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut mesh = state.collaboration_mesh.write().await;

    match mesh.complete_collaboration(session_id, result).await {
        Ok(_) => Ok(Json(serde_json::json!({
            "session_id": session_id,
            "status": "completed",
            "timestamp": chrono::Utc::now()
        }))),
        Err(e) => {
            warn!("Failed to complete collaboration {}: {}", session_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

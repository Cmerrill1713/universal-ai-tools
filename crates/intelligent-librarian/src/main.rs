//! Intelligent Librarian API Server

use intelligent_librarian::*;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};
use tracing_subscriber;

/// API state
#[derive(Clone)]
pub struct ApiState {
    pub librarian: Arc<RwLock<IntelligentLibrarian>>,
}

/// Health check endpoint
async fn health_handler() -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "service": "intelligent-librarian",
        "timestamp": chrono::Utc::now()
    }))
}

/// Get available agents
async fn agents_handler(State(state): State<ApiState>) -> Result<Json<Value>, StatusCode> {
    match state.librarian.read().await.get_available_agents().await {
        Ok(agents) => {
            let agents_json: Vec<Value> = agents.into_iter().map(|agent| {
                json!({
                    "id": agent.id,
                    "name": agent.name,
                    "agent_type": agent.agent_type,
                    "capabilities": agent.capabilities,
                    "status": agent.status,
                    "max_context_tokens": agent.max_context_tokens
                })
            }).collect();

            Ok(Json(json!({
                "agents": agents_json,
                "count": agents_json.len()
            })))
        }
        Err(e) => {
            error!("Failed to get agents: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get unlimited context across agents
async fn context_handler(
    State(state): State<ApiState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let query = payload.get("query")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;

    let max_tokens = payload.get("max_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(20000) as usize;

    let target_agents: Option<Vec<uuid::Uuid>> = payload.get("target_agents")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .filter_map(|s| uuid::Uuid::parse_str(s).ok())
                .collect()
        });

    match state.librarian.read().await.get_unlimited_context_across_agents(
        query, max_tokens, target_agents
    ).await {
        Ok(result) => {
            Ok(Json(json!({
                "unlimited_context": result.unlimited_context,
                "total_tokens_used": result.total_tokens_used,
                "agents_visited": result.agents_visited,
                "traversal_time_ms": result.traversal_time_ms,
                "quality_score": result.quality_score,
                "errors": result.errors
            })))
        }
        Err(e) => {
            error!("Failed to get unlimited context: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get analytics
async fn analytics_handler(State(state): State<ApiState>) -> Result<Json<Value>, StatusCode> {
    match state.librarian.read().await.get_analytics().await {
        Ok(analytics) => {
            Ok(Json(json!({
                "total_documents": analytics.total_documents,
                "total_categories": analytics.total_categories,
                "knowledge_graph_nodes": analytics.knowledge_graph_nodes,
                "knowledge_graph_edges": analytics.knowledge_graph_edges,
                "curated_collections": analytics.curated_collections,
                "average_quality_score": analytics.average_quality_score,
                "search_performance": analytics.search_performance,
                "last_updated": analytics.last_updated
            })))
        }
        Err(e) => {
            error!("Failed to get analytics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Add document
async fn add_document_handler(
    State(state): State<ApiState>,
    Json(document): Json<Document>,
) -> Result<Json<Value>, StatusCode> {
    match state.librarian.read().await.add_document(document).await {
        Ok(document_id) => {
            Ok(Json(json!({
                "document_id": document_id,
                "status": "added"
            })))
        }
        Err(e) => {
            error!("Failed to add document: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Create API router
fn create_router() -> Router<ApiState> {
    Router::new()
        .route("/health", get(health_handler))
        .route("/agents", get(agents_handler))
        .route("/context", post(context_handler))
        .route("/analytics", get(analytics_handler))
        .route("/documents", post(add_document_handler))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    info!("🚀 Starting Intelligent Librarian API Server");
    info!("=============================================");

    // Create librarian
    info!("Initializing Intelligent Librarian...");
    let librarian = IntelligentLibrarian::new().await?;
    info!("✅ Librarian initialized successfully!");

    // Create API state
    let state = ApiState {
        librarian: Arc::new(RwLock::new(librarian)),
    };

    // Create router
    let app = create_router().with_state(state);

    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8082").await?;
    info!("🌐 Server listening on http://0.0.0.0:8082");
    info!("");
    info!("Available endpoints:");
    info!("  GET  /health      - Health check");
    info!("  GET  /agents       - Get available agents");
    info!("  POST /context     - Get unlimited context across agents");
    info!("  GET  /analytics    - Get system analytics");
    info!("  POST /documents    - Add document to system");
    info!("");
    info!("Example context request:");
    info!("  POST /context");
    info!("  {{");
    info!("    \"query\": \"machine learning optimization\",");
    info!("    \"max_tokens\": 20000,");
    info!("    \"target_agents\": [\"agent-uuid-1\", \"agent-uuid-2\"]");
    info!("  }}");
    info!("");
    info!("Test with: curl http://localhost:8082/health");
    info!("");
    info!("🎯 The librarian provides UNLIMITED CONTEXT through intelligent");
    info!("   agent traversal with token management!");

    axum::serve(listener, app).await?;

    Ok(())
}

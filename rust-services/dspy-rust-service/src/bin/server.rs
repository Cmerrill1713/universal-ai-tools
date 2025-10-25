use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use dspy_rust_service::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber;

#[derive(Clone)]
struct AppState {
    dspy_orchestrator: Arc<DSPyOrchestrator>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let dspy_orchestrator = Arc::new(DSPyOrchestrator::new());
    let app_state = AppState { dspy_orchestrator };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/orchestrate", post(orchestrate_handler))
        .route("/orchestrate/:id", get(get_orchestration_handler))
        .route("/agents", get(agents_handler))
        .route("/knowledge/extract", post(extract_knowledge_handler))
        .route("/pipeline/create", post(create_pipeline_handler))
        .route("/reasoning", post(cognitive_reasoning_handler))
        .with_state(app_state)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive()),
        );

    let port = std::env::var("DSPY_PORT").unwrap_or_else(|_| "8002".to_string());
    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("🚀 DSPy Orchestrator starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler(State(state): State<AppState>) -> Json<Value> {
    let status = state.dspy_orchestrator.get_health_status().await;
    Json(json!({
        "success": true,
        "service": "DSPy Orchestrator",
        "status": "healthy",
        "data": status
    }))
}

async fn orchestrate_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let request = OrchestrationRequest {
        task: payload.get("task")
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string(),
        context: payload.get("context")
            .and_then(|c| c.as_str())
            .map(|s| s.to_string()),
        user_id: payload.get("user_id")
            .and_then(|u| u.as_str())
            .unwrap_or("anonymous")
            .to_string(),
        priority: payload.get("priority")
            .and_then(|p| p.as_str())
            .map(|s| s.to_string()),
        metadata: payload.get("metadata")
            .and_then(|m| m.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect()
            }),
    };

    match state.dspy_orchestrator.orchestrate(request).await {
        Ok(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn get_orchestration_handler(
    State(state): State<AppState>,
    Path(orchestration_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match state.dspy_orchestrator.get_orchestration(&orchestration_id).await {
        Some(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        None => Err(StatusCode::NOT_FOUND)
    }
}

async fn agents_handler(State(state): State<AppState>) -> Result<Json<Value>, StatusCode> {
    match state.dspy_orchestrator.get_agents().await {
        Ok(agents) => Ok(Json(json!({
            "success": true,
            "data": agents,
            "count": agents.len(),
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn extract_knowledge_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let request = KnowledgeRequest {
        query: payload.get("query")
            .and_then(|q| q.as_str())
            .unwrap_or("")
            .to_string(),
        context: payload.get("context")
            .and_then(|c| c.as_str())
            .map(|s| s.to_string()),
        user_id: payload.get("user_id")
            .and_then(|u| u.as_str())
            .unwrap_or("anonymous")
            .to_string(),
        knowledge_type: payload.get("knowledge_type")
            .and_then(|k| k.as_str())
            .map(|s| s.to_string()),
    };

    match state.dspy_orchestrator.extract_knowledge(request).await {
        Ok(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn create_pipeline_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let request = DevelopmentPipelineRequest {
        task: payload.get("task")
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string(),
        requirements: payload.get("requirements")
            .and_then(|r| r.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default(),
        user_id: payload.get("user_id")
            .and_then(|u| u.as_str())
            .unwrap_or("anonymous")
            .to_string(),
        priority: payload.get("priority")
            .and_then(|p| p.as_str())
            .map(|s| s.to_string()),
    };

    match state.dspy_orchestrator.create_development_pipeline(request).await {
        Ok(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn cognitive_reasoning_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let request = CognitiveReasoningRequest {
        problem: payload.get("problem")
            .and_then(|p| p.as_str())
            .unwrap_or("")
            .to_string(),
        context: payload.get("context")
            .and_then(|c| c.as_str())
            .map(|s| s.to_string()),
        reasoning_type: payload.get("reasoning_type")
            .and_then(|r| r.as_str())
            .map(|s| s.to_string()),
        user_id: payload.get("user_id")
            .and_then(|u| u.as_str())
            .unwrap_or("anonymous")
            .to_string(),
    };

    match state.dspy_orchestrator.perform_cognitive_reasoning(request).await {
        Ok(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}
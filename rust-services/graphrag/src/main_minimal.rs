//! Minimal GraphRAG Service for debugging type issues

use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;

/// Minimal application state for testing
#[derive(Clone)]
struct MinimalAppState {
    version: String,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    message: String,
}

/// Simple test request
#[derive(Deserialize)]
struct TestRequest {
    message: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("graphrag_service=info")
        .init();

    info!("🚀 Starting Minimal GraphRAG Service v0.1.0");

    let state = MinimalAppState {
        version: "0.1.0".to_string(),
    };

    // Create router
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/test", post(test_handler))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let port = std::env::var("GRAPHRAG_PORT")
        .unwrap_or_else(|_| "8000".to_string())
        .parse::<u16>()
        .unwrap_or(8000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("🎯 Minimal GraphRAG Service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_handler(State(state): State<MinimalAppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: state.version,
        message: "Minimal GraphRAG service is running".to_string(),
    })
}

async fn test_handler(
    State(_state): State<MinimalAppState>,
    Json(request): Json<TestRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("Received test message: {}", request.message);
    
    Ok(Json(serde_json::json!({
        "status": "success",
        "echo": request.message,
        "timestamp": chrono::Utc::now()
    })))
}
//! Debug GraphRAG Service to isolate Qdrant type issues

use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use qdrant_client::Qdrant;
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;

/// Debug application state with just Qdrant client
#[derive(Clone)]
struct DebugAppState {
    qdrant: Arc<Qdrant>,
    version: String,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    qdrant_connected: bool,
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

    info!("🚀 Starting Debug GraphRAG Service v0.1.0");

    // Initialize Qdrant client - test if this compiles
    let qdrant_url = std::env::var("QDRANT_URL")
        .unwrap_or_else(|_| "http://localhost:6333".to_string());
    
    let qdrant_config = Qdrant::from_url(&qdrant_url);
    let qdrant_client = Arc::new(Qdrant::new(qdrant_config)?);
    info!("✅ Qdrant client created");

    let state = DebugAppState {
        qdrant: qdrant_client,
        version: "0.1.0".to_string(),
    };

    // Create router
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/test", post(test_handler))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8004));
    info!("🎯 Debug GraphRAG Service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_handler(State(state): State<DebugAppState>) -> Json<HealthResponse> {
    // Test if we can call methods on the Qdrant client
    let qdrant_connected = state.qdrant.list_collections().await.is_ok();
    
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: state.version,
        qdrant_connected,
    })
}

async fn test_handler(
    State(_state): State<DebugAppState>,
    Json(request): Json<TestRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("Received test message: {}", request.message);
    
    Ok(Json(serde_json::json!({
        "status": "success",
        "echo": request.message,
        "timestamp": chrono::Utc::now()
    })))
}
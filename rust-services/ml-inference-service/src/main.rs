/// Basic ML Inference Service
/// Simplified version with SmartCore support
use axum::{
    response::Json,
    routing::get,
    Router,
};
use tower_http::cors::CorsLayer;
use serde_json::json;
use std::sync::Arc;
use tracing::{info};

// Import from local lib
use ml_inference_service::SimpleMLService;

/// Application state
#[derive(Clone)]
struct AppState {
    ml_service: Arc<SimpleMLService>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("ml_inference_service=info")
        .init();

    info!("🚀 Starting Basic ML Inference Service");

    // Initialize simple ML service
    let ml_service = Arc::new(SimpleMLService::new());
    info!("✅ ML Service initialized: {}", ml_service.get_name());

    // Create application state
    let app_state = AppState { ml_service };

    // Build the router
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/models", get(list_models_handler))
        .route("/stats", get(stats_handler))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start server
    let port = std::env::var("PORT").unwrap_or_else(|_| "8084".to_string());
    let addr = format!("0.0.0.0:{}", port);

    info!("🌐 Server starting on http://{}", addr);
    info!("📊 Available endpoints:");
    info!("   GET /health - Health check");
    info!("   GET /models - List available models");
    info!("   GET /stats - Service statistics");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check handler
async fn health_handler(
    axum::extract::State(state): axum::extract::State<AppState>
) -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "ml-inference-basic",
        "version": "1.0.0",
        "framework": state.ml_service.get_name(),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

/// List available models handler
async fn list_models_handler(
    axum::extract::State(_state): axum::extract::State<AppState>
) -> Json<serde_json::Value> {
    Json(json!({
        "models": [
            "smartcore-linear-regression",
            "smartcore-decision-tree",
            "smartcore-random-forest"
        ],
        "status": "available"
    }))
}

/// Service statistics handler
async fn stats_handler(
    axum::extract::State(state): axum::extract::State<AppState>
) -> Json<serde_json::Value> {
    Json(json!({
        "service": state.ml_service.get_name(),
        "status": "operational",
        "framework": "SmartCore",
        "architecture": std::env::consts::ARCH,
        "os": std::env::consts::OS,
        "models_available": 3,
        "uptime_seconds": 0
    }))
}

use crate::trainer::{RLVRTrainer, TrainingConfig, TrainingStats};
use crate::verifier::DefaultVerifier;
use crate::generator::DefaultGenerator;
use crate::experience::ExperienceManager;
use crate::metrics::MetricsAggregator;
use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error};

/// Simple HTTP server state
#[derive(Clone)]
pub struct SimpleRLVRState {
    trainer: Arc<RwLock<RLVRTrainer>>,
    experience_manager: Arc<RwLock<ExperienceManager>>,
    metrics_aggregator: Arc<RwLock<MetricsAggregator>>,
}

impl SimpleRLVRState {
    pub fn new() -> Self {
        let generator = Box::new(DefaultGenerator::new("http://localhost:3033".to_string()));
        let verifier = Box::new(DefaultVerifier::new("http://localhost:3033".to_string()));
        let config = TrainingConfig::default();

        Self {
            trainer: Arc::new(RwLock::new(RLVRTrainer::new(generator, verifier, config))),
            experience_manager: Arc::new(RwLock::new(ExperienceManager::new())),
            metrics_aggregator: Arc::new(RwLock::new(MetricsAggregator::new())),
        }
    }
}

/// Health check endpoint
async fn health_handler() -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "service": "rlvr-service",
        "version": "0.1.0",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Get training statistics endpoint
async fn training_stats_handler(State(state): State<SimpleRLVRState>) -> Result<Json<TrainingStats>, StatusCode> {
    info!("📈 Training stats request received");

    let trainer = state.trainer.read().await;

    match trainer.get_training_stats().await {
        Ok(stats) => {
            info!("✅ Training stats retrieved successfully");
            Ok(Json(stats))
        }
        Err(e) => {
            error!("❌ Failed to get training stats: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get system info endpoint
async fn system_info_handler() -> Json<Value> {
    Json(json!({
        "service": "RLVR Service",
        "version": "0.1.0",
        "status": "running",
        "components": {
            "generator": "MockGenerator",
            "verifier": "DefaultVerifier",
            "trainer": "RLVRTrainer",
            "experience_manager": "ExperienceManager",
            "metrics_aggregator": "MetricsAggregator"
        },
        "endpoints": {
            "health": "GET /health",
            "training_stats": "GET /training-stats",
            "system_info": "GET /system-info"
        },
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// Create the simple HTTP router
pub fn create_simple_rlvr_router() -> Router {
    let state = SimpleRLVRState::new();

    Router::new()
        .route("/health", get(health_handler))
        .route("/training-stats", get(training_stats_handler))
        .route("/system-info", get(system_info_handler))
        .with_state(state)
}

/// Start the simple HTTP server
pub async fn start_simple_http_server(port: u16) -> Result<()> {
    let app = create_simple_rlvr_router();

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    info!("🌐 RLVR Simple HTTP server starting on port {}", port);
    info!("📚 Available endpoints:");
    info!("  GET  /health                    - Health check");
    info!("  GET  /training-stats            - Get training statistics");
    info!("  GET  /system-info               - Get system information");

    axum::serve(listener, app).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_endpoint() {
        let response = health_handler().await;
        let json: Value = response.0;

        assert_eq!(json["status"], "healthy");
        assert_eq!(json["service"], "rlvr-service");
    }

    #[tokio::test]
    async fn test_system_info_endpoint() {
        let response = system_info_handler().await;
        let json: Value = response.0;

        assert_eq!(json["service"], "RLVR Service");
        assert_eq!(json["status"], "running");
    }

    #[tokio::test]
    async fn test_state_creation() {
        let state = SimpleRLVRState::new();
        assert!(true); // Basic test that state can be created
    }
}

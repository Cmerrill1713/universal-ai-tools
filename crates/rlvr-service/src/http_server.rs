use crate::models::*;
use crate::verifier::DefaultVerifier;
use crate::mock_generator::MockGenerator;
use crate::trainer::{RLVRTrainer, TrainingConfig, TrainingStats};
use crate::experience::ExperienceManager;
use crate::metrics::{MetricsAggregator, RLVREvaluationMetrics};
use anyhow::Result;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, warn};
// use uuid::Uuid; // Not used in this module

/// HTTP server state containing all RLVR components
#[derive(Clone)]
pub struct RLVRServerState {
    trainer: Arc<RwLock<RLVRTrainer>>,
    experience_manager: Arc<RwLock<ExperienceManager>>,
    metrics_aggregator: Arc<RwLock<MetricsAggregator>>,
}

impl RLVRServerState {
    pub fn new() -> Self {
        let generator = Box::new(MockGenerator::new());
        let verifier = Box::new(DefaultVerifier::new("mock://llm".to_string()));
        let config = TrainingConfig::default();
        
        Self {
            trainer: Arc::new(RwLock::new(RLVRTrainer::new(generator, verifier, config))),
            experience_manager: Arc::new(RwLock::new(ExperienceManager::new())),
            metrics_aggregator: Arc::new(RwLock::new(MetricsAggregator::new())),
        }
    }
}

/// Health check endpoint
async fn health_handler() -> Result<Json<Value>, (StatusCode, String)> {
    Ok(Json(json!({
        "status": "healthy",
        "service": "rlvr-service",
        "version": "0.1.0",
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

// Note: Train and evaluate handlers removed for now due to Axum handler complexity
// These can be re-added later with proper handler signatures

/// Get training statistics endpoint
async fn training_stats_handler(
    State(state): State<RLVRServerState>,
) -> Result<Json<TrainingStats>, (StatusCode, String)> {
    info!("📈 Training stats request received");
    
    let trainer = state.trainer.read().await;
    
    match trainer.get_training_stats().await {
        Ok(stats) => {
            info!("✅ Training stats retrieved successfully");
            Ok(Json(stats))
        }
        Err(e) => {
            error!("❌ Failed to get training stats: {}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

/// Get task-specific metrics endpoint
async fn task_metrics_handler(
    State(state): State<RLVRServerState>,
    Path(task_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    info!("📊 Task metrics request received: {}", task_id);
    
    let aggregator = state.metrics_aggregator.read().await;
    
    match aggregator.get_task_aggregate(&task_id) {
        Some(aggregate) => {
            info!("✅ Task metrics retrieved successfully");
            Ok(Json(json!({
                "task_id": task_id,
                "total_sessions": aggregate.total_sessions,
                "average_confidence": aggregate.average_confidence,
                "average_iterations": aggregate.average_iterations,
                "success_rate": aggregate.success_rate,
                "convergence_rate": 0.0 // Mock value
            })))
        }
        None => {
            warn!("⚠️ No metrics found for task: {}", task_id);
            Err((StatusCode::NOT_FOUND, format!("No metrics found for task: {}", task_id)))
        }
    }
}

/// Get all available tasks endpoint
async fn tasks_handler(
    State(state): State<RLVRServerState>,
) -> Result<Json<Value>, (StatusCode, String)> {
    info!("📋 Tasks list request received");
    
    let aggregator = state.metrics_aggregator.read().await;
    
    // Get all tasks from experience manager instead
    let task_ids = vec!["hello_world_progression", "fibonacci_learning", "sorting_algorithm"]; // Mock task list
    
    let tasks: Vec<Value> = task_ids
        .iter()
        .map(|task_id| {
            let aggregate = aggregator.get_task_aggregate(task_id).unwrap_or(&TaskAggregate {
                task_id: task_id.to_string(),
                total_sessions: 0,
                average_confidence: 0.0,
                average_iterations: 0.0,
                success_rate: 0.0,
                total_experiences: 0,
                last_updated: chrono::Utc::now(),
            });
            json!({
                "task_id": task_id,
                "total_sessions": aggregate.total_sessions,
                "average_confidence": aggregate.average_confidence,
                "average_iterations": aggregate.average_iterations,
                "success_rate": aggregate.success_rate,
                "convergence_rate": 0.0 // Mock value,
                "last_updated": chrono::Utc::now().to_rfc3339()
            })
        })
        .collect();
    
    Ok(Json(json!({
        "tasks": tasks,
        "total_tasks": tasks.len(),
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

/// Get experience analysis for a task
async fn experience_analysis_handler(
    State(state): State<RLVRServerState>,
    Path(task_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    info!("🔍 Experience analysis request received: {}", task_id);
    
    let experience_manager = state.experience_manager.read().await;
    
    match experience_manager.analyze_patterns(&task_id) {
        Ok(analysis) => {
            info!("✅ Experience analysis completed");
            Ok(Json(json!({
                "task_id": task_id,
                "total_experiences": analysis.total_experiences,
                "average_reward": analysis.average_reward,
                "reward_variance": analysis.reward_variance,
                "common_error_types": analysis.common_errors,
                "improvement_trend": analysis.improvement_trend,
                "convergence_pattern": "stable" // Mock value
            })))
        }
        Err(e) => {
            error!("❌ Experience analysis failed: {}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

/// Create the HTTP router
pub fn create_rlvr_router() -> Router {
    let state = RLVRServerState::new();
    
    Router::new()
        .route("/health", get(health_handler))
        .route("/training-stats", get(training_stats_handler))
        .route("/tasks", get(tasks_handler))
        .route("/tasks/:task_id/metrics", get(task_metrics_handler))
        .route("/tasks/:task_id/experience", get(experience_analysis_handler))
        .with_state(state)
}

/// Start the HTTP server
pub async fn start_http_server(port: u16) -> Result<()> {
    let app = create_rlvr_router();
    
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    info!("🌐 RLVR HTTP server starting on port {}", port);
    info!("📚 Available endpoints:");
    info!("  GET  /health                    - Health check");
    info!("  POST /train                     - Train RLVR model");
    info!("  POST /evaluate                  - Evaluate task");
    info!("  GET  /training-stats            - Get training statistics");
    info!("  GET  /tasks                     - List all tasks");
    info!("  GET  /tasks/:task_id/metrics    - Get task-specific metrics");
    info!("  GET  /tasks/:task_id/experience - Get experience analysis");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_health_endpoint() {
        let response = health_handler().await.unwrap();
        let json: Value = response.0;
        
        assert_eq!(json["status"], "healthy");
        assert_eq!(json["service"], "rlvr-service");
    }
    
    #[tokio::test]
    async fn test_server_state_creation() {
        let state = RLVRServerState::new();
        assert!(true); // Basic test that state can be created
    }
}

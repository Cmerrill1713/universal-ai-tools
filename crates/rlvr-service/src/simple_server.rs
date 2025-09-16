use crate::models::*;
use crate::trainer::{RLVRTrainer, TrainingConfig};
use crate::verifier::DefaultVerifier;
use crate::generator::DefaultGenerator;
use crate::metrics::{RLVREvaluationMetrics, MetricsAggregator};
use crate::experience::ExperienceManager;
use anyhow::Result;
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

/// RLVR service state
pub struct RLVRServiceState {
    pub trainer: Arc<RwLock<RLVRTrainer>>,
    pub experience_manager: Arc<RwLock<ExperienceManager>>,
    pub metrics_aggregator: Arc<RwLock<MetricsAggregator>>,
}

/// Initialize RLVR service
pub async fn create_rlvr_service(llm_endpoint: String) -> Result<RLVRServiceState> {
    info!("Initializing RLVR service with LLM endpoint: {}", llm_endpoint);

    // Create generator and verifier
    let generator = Box::new(DefaultGenerator::new(llm_endpoint.clone()));
    let verifier = Box::new(DefaultVerifier::new(llm_endpoint));

    // Create trainer with default config
    let trainer = RLVRTrainer::new(generator, verifier, TrainingConfig::default());

    let state = RLVRServiceState {
        trainer: Arc::new(RwLock::new(trainer)),
        experience_manager: Arc::new(RwLock::new(ExperienceManager::new())),
        metrics_aggregator: Arc::new(RwLock::new(MetricsAggregator::new())),
    };

    info!("RLVR service initialized successfully");
    Ok(state)
}

/// Create API router
pub fn create_router(state: Arc<RLVRServiceState>) -> Router {
    Router::new()
        .route("/health", get(health_handler))
        .route("/train", post(train_handler))
        .route("/evaluate", post(evaluate_handler))
        .route("/metrics", get(metrics_handler))
        .route("/experiences/:task_id", get(get_experiences_handler))
        .route("/analysis/:task_id", get(analyze_task_handler))
        .route("/stats", get(training_stats_handler))
        .with_state(state)
}

/// Health check endpoint
async fn health_handler() -> Json<Value> {
    Json(json!({
        "status": "healthy",
        "service": "rlvr-service",
        "timestamp": chrono::Utc::now()
    }))
}

/// Main RLVR training endpoint
#[axum::debug_handler]
async fn train_handler(
    State(state): State<Arc<RLVRServiceState>>,
    Json(request): Json<RLVRRequest>,
) -> Result<Json<RLVRResponse>, (StatusCode, String)> {
    info!("Received RLVR training request for task: {}", request.task_id);

    let mut evaluation_metrics = RLVREvaluationMetrics::new(uuid::Uuid::new_v4(), request.task_id.clone());

    let _task_id = request.task_id.clone();

    match {
        let trainer = state.trainer.read().await;
        trainer.train_rlvr(request).await
    } {
        Ok(response) => {
            // Calculate evaluation metrics
            evaluation_metrics.calculate_from_training_data(&response.training_data, &response.metrics);

            // Store experiences
            {
                let mut exp_manager = state.experience_manager.write().await;
                for example in &response.training_data {
                    exp_manager.add_experience(&response.session_id.to_string(), example.clone());
                }
            }

            // Store metrics
            {
                let mut metrics_agg = state.metrics_aggregator.write().await;
                metrics_agg.add_session(evaluation_metrics);
            }

            info!("RLVR training completed successfully for session: {}", response.session_id);
            Ok(Json(response))
        }
        Err(e) => {
            error!("RLVR training failed: {}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

/// Evaluation endpoint for analyzing RLVR performance
async fn evaluate_handler(
    State(state): State<Arc<RLVRServiceState>>,
    Json(request): Json<RLVRRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    info!("Received evaluation request for task: {}", request.task_id);
    let task_id = request.task_id.clone();

    match {
        let trainer = state.trainer.read().await;
        trainer.train_rlvr(request).await
    } {
        Ok(response) => {
            let mut evaluation_metrics = RLVREvaluationMetrics::new(response.session_id, task_id);
            evaluation_metrics.calculate_from_training_data(&response.training_data, &response.metrics);

            let report = evaluation_metrics.generate_report();

            info!("Evaluation completed for session: {}", response.session_id);
            Ok(Json(json!(report)))
        }
        Err(e) => {
            error!("Evaluation failed: {}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

/// Get training metrics
async fn metrics_handler(
    State(state): State<Arc<RLVRServiceState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let metrics_agg = state.metrics_aggregator.read().await;
    let aggregates = metrics_agg.get_all_aggregates();

    Ok(Json(json!({
        "task_aggregates": aggregates,
        "timestamp": chrono::Utc::now()
    })))
}

/// Get experiences for a specific task
async fn get_experiences_handler(
    State(state): State<Arc<RLVRServiceState>>,
    axum::extract::Path(task_id): axum::extract::Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let exp_manager = state.experience_manager.read().await;

    match exp_manager.export_experiences(&task_id) {
        Ok(experiences) => {
            Ok(Json(json!({
                "task_id": task_id,
                "experiences": experiences,
                "count": experiences.len()
            })))
        }
        Err(e) => {
            error!("Failed to export experiences: {}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

/// Analyze task performance
async fn analyze_task_handler(
    State(state): State<Arc<RLVRServiceState>>,
    axum::extract::Path(task_id): axum::extract::Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let exp_manager = state.experience_manager.read().await;

    match exp_manager.analyze_patterns(&task_id) {
        Ok(analysis) => {
            Ok(Json(json!({
                "task_id": task_id,
                "analysis": analysis
            })))
        }
        Err(e) => {
            error!("Failed to analyze task: {}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

/// Get current training statistics
async fn training_stats_handler(
    State(state): State<Arc<RLVRServiceState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    match {
        let trainer = state.trainer.read().await;
        trainer.get_training_stats().await
    } {
        Ok(stats) => {
            let exp_manager = state.experience_manager.read().await;
            let global_stats = exp_manager.get_global_stats();

            Ok(Json(json!({
                "training_stats": stats,
                "global_stats": global_stats,
                "timestamp": chrono::Utc::now()
            })))
        }
        Err(e) => {
            error!("Failed to get training stats: {}", e);
            Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

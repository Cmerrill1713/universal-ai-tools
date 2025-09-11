use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};
use uuid::Uuid;
use std::time::Instant;

use crate::models::{SearchRequest, SearchResponse, SearchSession};
use crate::searcher::S3Searcher;
use crate::config::Config;

/// Application state shared across handlers
pub struct AppState {
    pub searcher: Arc<S3Searcher>,
    pub sessions: Arc<RwLock<std::collections::HashMap<Uuid, SearchSession>>>,
    pub config: Config,
}

/// Create the API router
pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        // Health check
        .route("/health", get(health_check))
        
        // Search endpoints
        .route("/search", post(search))
        .route("/search/:session_id", get(get_session))
        .route("/search/:session_id/documents", get(get_session_documents))
        
        // Training endpoints
        .route("/train/start", post(start_training))
        .route("/train/status", get(training_status))
        
        // Configuration endpoints
        .route("/config", get(get_config))
        .route("/config", post(update_config))
        
        // Metrics
        .route("/metrics", get(get_metrics))
        
        .with_state(state)
}

/// Health check endpoint
async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// Main search endpoint
async fn search(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SearchRequest>,
) -> Result<Json<SearchResponse>, AppError> {
    let start = Instant::now();
    
    info!("Received search request for: {}", request.question);
    
    // Perform the search
    let session = state.searcher
        .search(request.clone())
        .await
        .map_err(|e| {
            error!("Search failed: {}", e);
            AppError::InternalError(e.to_string())
        })?;
    
    // Store session for later retrieval
    let session_id = session.id;
    state.sessions.write().await.insert(session_id, session.clone());
    
    // Prepare response
    let response = SearchResponse {
        session_id,
        answer: generate_answer_from_session(&session),
        documents: session.final_documents.clone(),
        turns: if request.return_reasoning {
            Some(session.turns.clone())
        } else {
            None
        },
        gbr_score: session.gbr_reward,
        latency_ms: start.elapsed().as_millis() as u64,
    };
    
    info!("Search completed in {}ms with {} documents", 
          response.latency_ms, response.documents.len());
    
    Ok(Json(response))
}

/// Get a search session by ID
async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<SearchSession>, AppError> {
    let sessions = state.sessions.read().await;
    
    sessions.get(&session_id)
        .cloned()
        .map(Json)
        .ok_or(AppError::NotFound(format!("Session {} not found", session_id)))
}

/// Get documents from a search session
async fn get_session_documents(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Vec<crate::models::Document>>, AppError> {
    let sessions = state.sessions.read().await;
    
    sessions.get(&session_id)
        .map(|s| Json(s.final_documents.clone()))
        .ok_or(AppError::NotFound(format!("Session {} not found", session_id)))
}

/// Start training job
async fn start_training(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<TrainingRequest>,
) -> Result<Json<TrainingResponse>, AppError> {
    // In production, this would start an async training job
    info!("Starting training with {} examples", request.num_examples);
    
    Ok(Json(TrainingResponse {
        job_id: Uuid::new_v4(),
        status: "started".to_string(),
        message: "Training job started successfully".to_string(),
    }))
}

/// Get training status
async fn training_status(
    State(_state): State<Arc<AppState>>,
    Query(params): Query<TrainingStatusQuery>,
) -> Result<Json<TrainingStatusResponse>, AppError> {
    // In production, would query actual training job status
    Ok(Json(TrainingStatusResponse {
        job_id: params.job_id,
        status: "running".to_string(),
        epoch: 5,
        total_epochs: 15,
        current_gbr: 0.042,
        best_gbr: 0.051,
        examples_processed: 1200,
    }))
}

/// Get current configuration
async fn get_config(
    State(state): State<Arc<AppState>>,
) -> Json<ConfigResponse> {
    Json(ConfigResponse {
        searcher: state.config.searcher.clone(),
        generator: state.config.generator.clone(),
        retriever: state.config.retriever.clone(),
    })
}

/// Update configuration
async fn update_config(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<ConfigUpdateRequest>,
) -> Result<Json<ConfigUpdateResponse>, AppError> {
    // In production, would validate and apply config changes
    info!("Configuration update requested: {:?}", request.section);
    
    Ok(Json(ConfigUpdateResponse {
        success: true,
        message: "Configuration updated successfully".to_string(),
    }))
}

/// Get metrics
async fn get_metrics(
    State(state): State<Arc<AppState>>,
) -> Json<MetricsResponse> {
    let sessions = state.sessions.read().await;
    
    // Calculate metrics
    let total_searches = sessions.len();
    let avg_documents = if total_searches > 0 {
        sessions.values()
            .map(|s| s.final_documents.len())
            .sum::<usize>() as f32 / total_searches as f32
    } else {
        0.0
    };
    
    let avg_turns = if total_searches > 0 {
        sessions.values()
            .map(|s| s.turns.len())
            .sum::<usize>() as f32 / total_searches as f32
    } else {
        0.0
    };
    
    let avg_gbr = sessions.values()
        .filter_map(|s| s.gbr_reward)
        .sum::<f32>() / sessions.values()
        .filter(|s| s.gbr_reward.is_some())
        .count()
        .max(1) as f32;
    
    Json(MetricsResponse {
        total_searches,
        avg_documents_per_search: avg_documents,
        avg_turns_per_search: avg_turns,
        avg_gbr_score: avg_gbr,
        cache_hit_rate: 0.0, // Would calculate from actual cache stats
    })
}

/// Generate answer from session (placeholder - would use generator)
fn generate_answer_from_session(session: &SearchSession) -> String {
    format!(
        "Based on {} documents found through {} search iterations, here is the synthesized answer to your question.",
        session.final_documents.len(),
        session.turns.len()
    )
}

// Request/Response types

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

#[derive(Deserialize)]
struct TrainingRequest {
    num_examples: usize,
    validation_split: f32,
    checkpoint_path: Option<String>,
}

#[derive(Serialize)]
struct TrainingResponse {
    job_id: Uuid,
    status: String,
    message: String,
}

#[derive(Deserialize)]
struct TrainingStatusQuery {
    job_id: Uuid,
}

#[derive(Serialize)]
struct TrainingStatusResponse {
    job_id: Uuid,
    status: String,
    epoch: usize,
    total_epochs: usize,
    current_gbr: f32,
    best_gbr: f32,
    examples_processed: usize,
}

#[derive(Serialize)]
struct ConfigResponse {
    searcher: crate::config::SearcherSettings,
    generator: crate::config::GeneratorSettings,
    retriever: crate::config::RetrieverSettings,
}

#[derive(Deserialize)]
struct ConfigUpdateRequest {
    section: String,
    updates: serde_json::Value,
}

#[derive(Serialize)]
struct ConfigUpdateResponse {
    success: bool,
    message: String,
}

#[derive(Serialize)]
struct MetricsResponse {
    total_searches: usize,
    avg_documents_per_search: f32,
    avg_turns_per_search: f32,
    avg_gbr_score: f32,
    cache_hit_rate: f32,
}

// Error handling

#[derive(Debug)]
enum AppError {
    NotFound(String),
    BadRequest(String),
    InternalError(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, message) = match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::InternalError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };
        
        (status, Json(ErrorResponse { error: message })).into_response()
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}
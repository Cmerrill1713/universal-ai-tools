// Simplified REST API handlers for the vector database service
// Maps to SimpleVectorEngine methods only

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, error, instrument};

use crate::types::{
    VectorDocument, SearchQuery, SearchResult, InsertRequest, BatchInsertRequest, VectorMetrics,
};
use crate::simple_engine::SimpleVectorEngine;
use crate::metrics::MetricsService;

/// API response wrapper
#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            timestamp: chrono::Utc::now(),
        }
    }
    
    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            timestamp: chrono::Utc::now(),
        }
    }
}

/// Health check response
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub gpu_available: bool,
    pub total_vectors: usize,
    pub memory_usage_mb: f64,
}


/// Application state shared between handlers
#[derive(Clone)]
pub struct AppState {
    pub vector_engine: Arc<SimpleVectorEngine>,
    pub metrics: Arc<MetricsService>,
    pub start_time: std::time::Instant,
}

/// Create the simplified API router
pub fn create_router(
    vector_engine: Arc<SimpleVectorEngine>,
    metrics: Arc<MetricsService>,
) -> Router {
    let state = AppState {
        vector_engine,
        metrics,
        start_time: std::time::Instant::now(),
    };
    
    Router::new()
        // Health and status endpoints
        .route("/health", get(health_check))
        .route("/metrics", get(get_metrics))
        
        // Vector operations
        .route("/vectors", post(insert_vector))
        .route("/vectors/batch", post(batch_insert_vectors))
        .route("/vectors/:id", get(get_vector))
        .route("/vectors/:id", delete(delete_vector))
        
        // Search operations
        .route("/search", post(search_vectors))
        
        // Utility operations
        .route("/clear", post(clear_all))
        .route("/backup", post(create_backup))
        .route("/restore", post(restore_backup))
        
        .with_state(state)
}

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Result<Json<ApiResponse<HealthResponse>>, StatusCode> {
    let total_vectors = state.vector_engine.get_total_vectors().await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let response = HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: state.start_time.elapsed().as_secs(),
        gpu_available: state.vector_engine.is_gpu_enabled(),
        total_vectors,
        memory_usage_mb: 0.0, // Simplified - could add actual memory tracking
    };
    
    Ok(Json(ApiResponse::success(response)))
}

/// Get metrics endpoint  
#[instrument(skip(state))]
async fn get_metrics(State(state): State<AppState>) -> Result<Json<ApiResponse<VectorMetrics>>, StatusCode> {
    match state.vector_engine.get_metrics().await {
        Ok(metrics) => Ok(Json(ApiResponse::success(metrics))),
        Err(e) => {
            error!("Failed to get metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Insert a single vector
#[instrument(skip(state, request))]
async fn insert_vector(
    State(state): State<AppState>,
    Json(request): Json<InsertRequest>,
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    let document = VectorDocument::new(
        request.content,
        request.embedding,
        request.metadata,
    );
    
    match state.vector_engine.insert_document(document).await {
        Ok(id) => {
            info!("Vector inserted: {}", id);
            Ok(Json(ApiResponse::success(id)))
        },
        Err(e) => {
            error!("Failed to insert vector: {}", e);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

/// Batch insert vectors
#[instrument(skip(state, request))]
async fn batch_insert_vectors(
    State(state): State<AppState>,
    Json(request): Json<BatchInsertRequest>,
) -> Result<Json<ApiResponse<Vec<String>>>, StatusCode> {
    let documents: Vec<VectorDocument> = request.documents.into_iter().map(|req| {
        VectorDocument::new(req.content, req.embedding, req.metadata)
    }).collect();
    
    match state.vector_engine.batch_insert_documents(documents).await {
        Ok(ids) => {
            info!("Batch inserted {} vectors", ids.len());
            Ok(Json(ApiResponse::success(ids)))
        },
        Err(e) => {
            error!("Failed to batch insert vectors: {}", e);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

/// Get a vector by ID
#[instrument(skip(state))]
async fn get_vector(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<VectorDocument>>, StatusCode> {
    match state.vector_engine.get_document(&id).await {
        Ok(Some(document)) => Ok(Json(ApiResponse::success(document))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get vector {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Delete a vector by ID
#[instrument(skip(state))]
async fn delete_vector(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<bool>>, StatusCode> {
    match state.vector_engine.delete_document(&id).await {
        Ok(deleted) => {
            if deleted {
                info!("Vector deleted: {}", id);
                Ok(Json(ApiResponse::success(true)))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        },
        Err(e) => {
            error!("Failed to delete vector {}: {}", id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Search for similar vectors
#[instrument(skip(state, query))]
async fn search_vectors(
    State(state): State<AppState>,
    Json(query): Json<SearchQuery>,
) -> Result<Json<ApiResponse<Vec<SearchResult>>>, StatusCode> {
    match state.vector_engine.search(&query).await {
        Ok(results) => {
            info!("Search completed: {} results", results.len());
            Ok(Json(ApiResponse::success(results)))
        },
        Err(e) => {
            error!("Search failed: {}", e);
            Err(StatusCode::BAD_REQUEST)
        }
    }
}

/// Clear all data
#[instrument(skip(state))]
async fn clear_all(State(state): State<AppState>) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.vector_engine.clear_all().await {
        Ok(_) => {
            info!("All data cleared");
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to clear all: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Create backup
#[derive(Debug, Deserialize)]
struct BackupRequest {
    path: String,
}

#[instrument(skip(state))]
async fn create_backup(
    State(state): State<AppState>,
    Json(request): Json<BackupRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.vector_engine.create_backup(&request.path).await {
        Ok(_) => {
            info!("Backup created: {}", request.path);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to create backup: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Restore from backup
#[instrument(skip(state))]
async fn restore_backup(
    State(state): State<AppState>,
    Json(request): Json<BackupRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.vector_engine.restore_backup(&request.path).await {
        Ok(_) => {
            info!("Backup restored: {}", request.path);
            Ok(Json(ApiResponse::success(())))
        },
        Err(e) => {
            error!("Failed to restore backup: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
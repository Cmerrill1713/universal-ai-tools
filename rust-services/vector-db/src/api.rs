// REST API handlers for the vector database service
// Provides HTTP endpoints for vector operations, search, and management

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn, error, instrument};
use uuid::Uuid;

use crate::types::{
    VectorDocument, SearchQuery, SearchResult, InsertRequest, BatchInsertRequest,
    IndexConfig, IndexStats, VectorMetrics, VectorError,
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

/// Search request parameters
#[derive(Debug, Deserialize)]
pub struct SearchParams {
    pub limit: Option<usize>,
    pub threshold: Option<f32>,
    pub include_metadata: Option<bool>,
    pub metric: Option<String>,
}

/// Batch search request
#[derive(Debug, Deserialize)]
pub struct BatchSearchRequest {
    pub queries: Vec<SearchQuery>,
}

/// Index creation request
#[derive(Debug, Deserialize)]
pub struct CreateIndexRequest {
    pub name: String,
    pub config: IndexConfig,
}

/// Application state shared between handlers
#[derive(Clone)]
pub struct AppState {
    pub vector_engine: Arc<SimpleVectorEngine>,
    pub metrics: Arc<MetricsService>,
    pub start_time: std::time::Instant,
}

/// Create the API router with all endpoints
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
        .route("/status", get(get_status))
        
        // Document management endpoints
        .route("/documents", post(insert_document))
        .route("/documents/batch", post(batch_insert_documents))
        .route("/documents/:id", get(get_document))
        .route("/documents/:id", put(update_document))
        .route("/documents/:id", delete(delete_document))
        .route("/documents", get(list_documents))
        
        // Search endpoints
        .route("/search", post(search_vectors))
        .route("/search/batch", post(batch_search_vectors))
        .route("/search/knn", post(knn_search))
        .route("/search/similar/:id", get(find_similar))
        
        // Index management endpoints
        .route("/indexes", get(list_indexes))
        .route("/indexes", post(create_index))
        .route("/indexes/:name", get(get_index_info))
        .route("/indexes/:name", delete(delete_index))
        .route("/indexes/:name/rebuild", post(rebuild_index))
        .route("/indexes/:name/stats", get(get_index_stats))
        
        // Administrative endpoints
        .route("/admin/clear", post(clear_all_data))
        .route("/admin/backup", post(create_backup))
        .route("/admin/restore", post(restore_backup))
        .route("/admin/optimize", post(optimize_indexes))
        
        .with_state(state)
}

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Result<Json<ApiResponse<HealthResponse>>, StatusCode> {
    let uptime = state.start_time.elapsed().as_secs();
    let total_vectors = state.vector_engine.get_total_vectors().await
        .unwrap_or(0);
    
    // Get memory usage (simplified)
    let memory_usage_mb = get_memory_usage_mb();
    
    let response = HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        gpu_available: state.vector_engine.is_gpu_enabled(),
        total_vectors,
        memory_usage_mb,
    };
    
    Ok(Json(ApiResponse::success(response)))
}

/// Get system metrics
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

/// Get detailed status information
#[instrument(skip(state))]
async fn get_status(State(state): State<AppState>) -> Result<Json<ApiResponse<HashMap<String, serde_json::Value>>>, StatusCode> {
    let mut status = HashMap::new();
    
    status.insert("uptime_seconds".to_string(), serde_json::Value::Number(
        state.start_time.elapsed().as_secs().into()
    ));
    status.insert("gpu_enabled".to_string(), serde_json::Value::Bool(
        state.vector_engine.is_gpu_enabled()
    ));
    status.insert("total_vectors".to_string(), serde_json::Value::Number(
        state.vector_engine.get_total_vectors().await.unwrap_or(0).into()
    ));
    
    Ok(Json(ApiResponse::success(status)))
}

/// Insert a single document
#[instrument(skip(state, request))]
async fn insert_document(
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
            info!("Document inserted with ID: {}", id);
            Ok(Json(ApiResponse::success(id)))
        }
        Err(e) => {
            error!("Failed to insert document: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Insert multiple documents in batch
#[instrument(skip(state, request))]
async fn batch_insert_documents(
    State(state): State<AppState>,
    Json(request): Json<BatchInsertRequest>,
) -> Result<Json<ApiResponse<Vec<String>>>, StatusCode> {
    let documents: Vec<VectorDocument> = request.documents
        .into_iter()
        .map(|req| VectorDocument::new(req.content, req.embedding, req.metadata))
        .collect();
    
    match state.vector_engine.batch_insert_documents(documents).await {
        Ok(ids) => {
            info!("Batch inserted {} documents", ids.len());
            Ok(Json(ApiResponse::success(ids)))
        }
        Err(e) => {
            error!("Failed to batch insert documents: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Get a document by ID
#[instrument(skip(state))]
async fn get_document(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<VectorDocument>>, StatusCode> {
    match state.vector_engine.get_document(&id).await {
        Ok(Some(document)) => Ok(Json(ApiResponse::success(document))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get document {}: {}", id, e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Update a document
#[instrument(skip(state, document))]
async fn update_document(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(mut document): Json<VectorDocument>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    document.id = id;
    document.updated_at = chrono::Utc::now();
    
    match state.vector_engine.update_document(document).await {
        Ok(_) => Ok(Json(ApiResponse::success(()))),
        Err(e) => {
            error!("Failed to update document: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Delete a document by ID
#[instrument(skip(state))]
async fn delete_document(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<bool>>, StatusCode> {
    match state.vector_engine.delete_document(&id).await {
        Ok(deleted) => {
            if deleted {
                info!("Document {} deleted", id);
            } else {
                warn!("Document {} not found for deletion", id);
            }
            Ok(Json(ApiResponse::success(deleted)))
        }
        Err(e) => {
            error!("Failed to delete document {}: {}", id, e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// List all documents with pagination
#[instrument(skip(state))]
async fn list_documents(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<VectorDocument>>>, StatusCode> {
    let limit = params.get("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(100);
    let offset = params.get("offset")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    
    match state.vector_engine.list_documents(limit, offset).await {
        Ok(documents) => Ok(Json(ApiResponse::success(documents))),
        Err(e) => {
            error!("Failed to list documents: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
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
            info!("Search returned {} results", results.len());
            Ok(Json(ApiResponse::success(results)))
        }
        Err(e) => {
            error!("Search failed: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Batch search for multiple queries
#[instrument(skip(state, request))]
async fn batch_search_vectors(
    State(state): State<AppState>,
    Json(request): Json<BatchSearchRequest>,
) -> Result<Json<ApiResponse<Vec<Vec<SearchResult>>>>, StatusCode> {
    match state.vector_engine.batch_search(&request.queries).await {
        Ok(results) => {
            info!("Batch search completed for {} queries", request.queries.len());
            Ok(Json(ApiResponse::success(results)))
        }
        Err(e) => {
            error!("Batch search failed: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// K-nearest neighbors search
#[instrument(skip(state, query))]
async fn knn_search(
    State(state): State<AppState>,
    Json(query): Json<SearchQuery>,
) -> Result<Json<ApiResponse<Vec<SearchResult>>>, StatusCode> {
    let k = query.limit.unwrap_or(10);
    
    match state.vector_engine.knn_search(&query.query_vector, k).await {
        Ok(results) => {
            info!("KNN search returned {} results", results.len());
            Ok(Json(ApiResponse::success(results)))
        }
        Err(e) => {
            error!("KNN search failed: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Find similar documents to a given document ID
#[instrument(skip(state))]
async fn find_similar(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<SearchParams>,
) -> Result<Json<ApiResponse<Vec<SearchResult>>>, StatusCode> {
    let limit = params.limit.unwrap_or(10);
    let threshold = params.threshold.unwrap_or(0.0);
    
    match state.vector_engine.find_similar(&id, limit, threshold).await {
        Ok(results) => {
            info!("Found {} similar documents to {}", results.len(), id);
            Ok(Json(ApiResponse::success(results)))
        }
        Err(e) => {
            error!("Failed to find similar documents: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// List all available indexes
#[instrument(skip(state))]
async fn list_indexes(State(state): State<AppState>) -> Result<Json<ApiResponse<Vec<String>>>, StatusCode> {
    match state.vector_engine.list_indexes().await {
        Ok(indexes) => Ok(Json(ApiResponse::success(indexes))),
        Err(e) => {
            error!("Failed to list indexes: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Create a new index
#[instrument(skip(state, request))]
async fn create_index(
    State(state): State<AppState>,
    Json(request): Json<CreateIndexRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.vector_engine.create_index(&request.name, request.config).await {
        Ok(_) => {
            info!("Index '{}' created successfully", request.name);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to create index '{}': {}", request.name, e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Get index information
#[instrument(skip(state))]
async fn get_index_info(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<IndexConfig>>, StatusCode> {
    match state.vector_engine.get_index_info(&name).await {
        Ok(Some(info)) => Ok(Json(ApiResponse::success(info))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get index info for '{}': {}", name, e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Delete an index
#[instrument(skip(state))]
async fn delete_index(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<bool>>, StatusCode> {
    match state.vector_engine.delete_index(&name).await {
        Ok(deleted) => {
            if deleted {
                info!("Index '{}' deleted", name);
            } else {
                warn!("Index '{}' not found for deletion", name);
            }
            Ok(Json(ApiResponse::success(deleted)))
        }
        Err(e) => {
            error!("Failed to delete index '{}': {}", name, e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Rebuild an index
#[instrument(skip(state))]
async fn rebuild_index(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.vector_engine.rebuild_index(&name).await {
        Ok(_) => {
            info!("Index '{}' rebuilt successfully", name);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to rebuild index '{}': {}", name, e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Get index statistics
#[instrument(skip(state))]
async fn get_index_stats(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<ApiResponse<IndexStats>>, StatusCode> {
    match state.vector_engine.get_index_stats(&name).await {
        Ok(Some(stats)) => Ok(Json(ApiResponse::success(stats))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get index stats for '{}': {}", name, e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Clear all data (admin endpoint)
#[instrument(skip(state))]
async fn clear_all_data(State(state): State<AppState>) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.vector_engine.clear_all().await {
        Ok(_) => {
            warn!("All data cleared by admin request");
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to clear all data: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Create backup (admin endpoint)
#[instrument(skip(state))]
async fn create_backup(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    let path = params.get("path")
        .cloned()
        .unwrap_or_else(|| format!("backup_{}.json", chrono::Utc::now().timestamp()));
    
    match state.vector_engine.create_backup(&path).await {
        Ok(_) => {
            info!("Backup created at: {}", path);
            Ok(Json(ApiResponse::success(path)))
        }
        Err(e) => {
            error!("Failed to create backup: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Restore from backup (admin endpoint)
#[instrument(skip(state))]
async fn restore_backup(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    let path = params.get("path")
        .ok_or_else(|| StatusCode::BAD_REQUEST)?;
    
    match state.vector_engine.restore_backup(path).await {
        Ok(_) => {
            info!("Data restored from backup: {}", path);
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to restore backup: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Optimize indexes (admin endpoint)
#[instrument(skip(state))]
async fn optimize_indexes(State(state): State<AppState>) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match state.vector_engine.optimize_indexes().await {
        Ok(_) => {
            info!("Index optimization completed");
            Ok(Json(ApiResponse::success(())))
        }
        Err(e) => {
            error!("Failed to optimize indexes: {}", e);
            Ok(Json(ApiResponse::error(e.to_string())))
        }
    }
}

/// Get current memory usage in MB (simplified implementation)
fn get_memory_usage_mb() -> f64 {
    // This is a simplified implementation
    // In a real system, you'd use platform-specific APIs
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if let Ok(output) = Command::new("ps")
            .args(&["-o", "rss=", "-p"])
            .arg(std::process::id().to_string())
            .output()
        {
            if let Ok(memory_kb) = String::from_utf8_lossy(&output.stdout)
                .trim()
                .parse::<f64>()
            {
                return memory_kb / 1024.0; // Convert KB to MB
            }
        }
    }
    
    0.0 // Fallback
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use axum_test::TestServer;
    use std::sync::Arc;
    
    // Mock implementations for testing
    // Note: In real tests, you'd use a test database and proper mocking
    
    #[tokio::test]
    async fn test_health_endpoint() {
        // This would require proper setup with mock vector engine
        // Implementation depends on your testing strategy
    }
    
    #[tokio::test]
    async fn test_insert_and_get_document() {
        // Test document insertion and retrieval
        // Implementation depends on your testing strategy
    }
    
    #[tokio::test]
    async fn test_search_endpoint() {
        // Test vector search functionality
        // Implementation depends on your testing strategy
    }
}
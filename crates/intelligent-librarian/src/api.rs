//! API module for the Intelligent Librarian

use crate::models::*;
use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde_json::json;
use std::sync::Arc;
use tokio::sync::RwLock;

/// API state
#[derive(Clone)]
pub struct LibrarianApiState {
    pub librarian: Arc<RwLock<crate::IntelligentLibrarian>>,
}

/// Create API router
pub fn create_router() -> Router<LibrarianApiState> {
    Router::new()
        .route("/health", get(health_handler))
        .route("/search", post(search_handler))
        .route("/recommend", post(recommend_handler))
        .route("/analytics", get(analytics_handler))
        .route("/knowledge-graph", get(knowledge_graph_handler))
}

/// Health check handler
async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "intelligent-librarian",
        "timestamp": chrono::Utc::now()
    }))
}

/// Search handler
async fn search_handler(
    State(state): State<LibrarianApiState>,
    Json(query): Json<SearchQuery>,
) -> Result<Json<SearchResults>, StatusCode> {
    let librarian = state.librarian.read().await;
    match librarian.search(query).await {
        Ok(results) => Ok(Json(results)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Recommendation handler
async fn recommend_handler(
    State(state): State<LibrarianApiState>,
    Json(context): Json<RecommendationContext>,
) -> Result<Json<Vec<DocumentRecommendation>>, StatusCode> {
    let librarian = state.librarian.read().await;
    match librarian.recommend(context).await {
        Ok(recommendations) => Ok(Json(recommendations)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Analytics handler
async fn analytics_handler(
    State(state): State<LibrarianApiState>,
) -> Result<Json<LibrarianAnalytics>, StatusCode> {
    let librarian = state.librarian.read().await;
    match librarian.get_analytics().await {
        Ok(analytics) => Ok(Json(analytics)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

/// Knowledge graph handler
async fn knowledge_graph_handler(
    State(state): State<LibrarianApiState>,
    Json(filters): Json<Option<GraphFilters>>,
) -> Result<Json<KnowledgeGraphData>, StatusCode> {
    let librarian = state.librarian.read().await;
    match librarian.get_knowledge_graph(filters).await {
        Ok(graph_data) => Ok(Json(graph_data)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

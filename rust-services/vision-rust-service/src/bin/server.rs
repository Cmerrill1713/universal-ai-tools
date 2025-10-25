use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use vision_rust_service::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber;

#[derive(Clone)]
struct AppState {
    vision_service: Arc<VisionService>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let vision_service = Arc::new(VisionService::new());
    let app_state = AppState { vision_service };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/status", get(status_handler))
        .route("/process", post(process_image_handler))
        .route("/vision/analyze", post(analyze_image_handler))
        .route("/analyze", post(analyze_image_handler))
        .route("/vision/ocr", post(ocr_handler))
        .route("/capabilities", get(capabilities_handler))
        .route("/jobs/:job_id", get(get_job_handler))
        .with_state(app_state)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive()),
        );

    let port = std::env::var("VISION_PORT").unwrap_or_else(|_| "8003".to_string());
    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("🚀 Vision Service starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler(State(state): State<AppState>) -> Json<Value> {
    let status = state.vision_service.get_health_status().await;
    Json(json!({
        "success": true,
        "service": "Vision Service",
        "status": "healthy",
        "data": status
    }))
}

async fn status_handler(State(state): State<AppState>) -> Json<Value> {
    let status = state.vision_service.get_health_status().await;
    Json(json!({
        "success": true,
        "service": "Vision Service",
        "status": "operational",
        "data": status
    }))
}

async fn process_image_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let request = VisionRequest {
        image_data: payload.get("image_data")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string()),
        image_url: payload.get("image_url")
            .and_then(|u| u.as_str())
            .map(|s| s.to_string()),
        operation: payload.get("operation")
            .and_then(|o| o.as_str())
            .unwrap_or("analyze")
            .to_string(),
        parameters: payload.get("parameters")
            .and_then(|p| p.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect()
            }),
        user_id: payload.get("user_id")
            .and_then(|u| u.as_str())
            .unwrap_or("anonymous")
            .to_string(),
    };

    match state.vision_service.process_image(request).await {
        Ok(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn analyze_image_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let request = ImageAnalysisRequest {
        image_data: payload.get("image_data")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string()),
        image_url: payload.get("image_url")
            .and_then(|u| u.as_str())
            .map(|s| s.to_string()),
        analysis_type: payload.get("analysis_type")
            .and_then(|t| t.as_str())
            .unwrap_or("general")
            .to_string(),
        user_id: payload.get("user_id")
            .and_then(|u| u.as_str())
            .unwrap_or("anonymous")
            .to_string(),
    };

    match state.vision_service.analyze_image(request).await {
        Ok(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn ocr_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let request = OCRRequest {
        image_data: payload.get("image_data")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string()),
        image_url: payload.get("image_url")
            .and_then(|u| u.as_str())
            .map(|s| s.to_string()),
        language: payload.get("language")
            .and_then(|l| l.as_str())
            .map(|s| s.to_string()),
        user_id: payload.get("user_id")
            .and_then(|u| u.as_str())
            .unwrap_or("anonymous")
            .to_string(),
    };

    match state.vision_service.perform_ocr(request).await {
        Ok(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn capabilities_handler() -> Json<Value> {
    Json(json!({
        "capabilities": [
            {
                "name": "image_analysis",
                "description": "General image analysis and object detection",
                "supported_formats": ["jpg", "jpeg", "png", "bmp", "gif", "webp"],
                "max_size": "10MB"
            },
            {
                "name": "ocr",
                "description": "Optical Character Recognition",
                "supported_languages": ["en", "es", "fr", "de", "it", "pt", "ru", "zh", "ja", "ko"],
                "max_size": "10MB"
            },
            {
                "name": "face_detection",
                "description": "Face detection and analysis",
                "supported_formats": ["jpg", "jpeg", "png"],
                "max_size": "5MB"
            },
            {
                "name": "object_detection",
                "description": "Object detection and classification",
                "supported_formats": ["jpg", "jpeg", "png", "bmp"],
                "max_size": "10MB"
            }
        ],
        "service": "Vision Service",
        "version": "1.0.0"
    }))
}

async fn get_job_handler(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match state.vision_service.get_processing_job(&job_id).await {
        Some(response) => Ok(Json(json!({
            "success": true,
            "data": response,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        None => Err(StatusCode::NOT_FOUND)
    }
}
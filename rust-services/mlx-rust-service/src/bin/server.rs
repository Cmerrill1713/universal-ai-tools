use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, delete},
    Router,
};
use mlx_rust_service::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber;

#[derive(Clone)]
struct AppState {
    mlx_service: Arc<MLXService>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let config = MLXConfig {
        model_path: std::env::var("MLX_MODEL_PATH").unwrap_or_else(|_| "models/".to_string()),
        device: std::env::var("MLX_DEVICE").unwrap_or_else(|_| "cpu".to_string()),
        max_tokens: 512,
        temperature: 0.7,
        top_p: 0.9,
    };

    let mlx_service = Arc::new(MLXService::new(config));
    let app_state = AppState { mlx_service };

    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/models", get(models_handler))
        .route("/v1/chat/completions", post(chat_completions_handler))
        .route("/v1/vision", post(vision_handler))
        .route("/v1/tts", post(tts_handler))
        .route("/fine-tune", post(create_fine_tuning_job))
        .route("/fine-tune", get(list_fine_tuning_jobs))
        .route("/fine-tune/:job_id", get(get_fine_tuning_job))
        .route("/fine-tune/:job_id/cancel", post(cancel_fine_tuning_job))
        .route("/fine-tune/:job_id", delete(delete_fine_tuning_job))
        .with_state(app_state)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive()),
        );

    let port = std::env::var("MLX_PORT").unwrap_or_else(|_| "8001".to_string());
    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("🚀 MLX Service starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler(State(state): State<AppState>) -> Json<Value> {
    let status = state.mlx_service.get_health_status().await;
    Json(json!({
        "success": true,
        "service": "MLX Service",
        "status": "healthy",
        "data": status
    }))
}

async fn models_handler() -> Json<Value> {
    Json(json!({
        "models": [
            {
                "id": "fastvlm-0.5b",
                "name": "Apple FastVLM-0.5B",
                "type": "vision_language",
                "capabilities": ["vision", "text", "reasoning"],
                "apple_optimized": true,
                "context_length": 8192,
                "max_tokens": 512
            },
            {
                "id": "fastvlm-7b",
                "name": "Apple FastVLM-7B",
                "type": "vision_language",
                "capabilities": ["vision", "text", "reasoning"],
                "apple_optimized": true,
                "context_length": 8192,
                "max_tokens": 1024
            }
        ]
    }))
}

async fn chat_completions_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let messages = payload.get("messages")
        .and_then(|m| m.as_array())
        .ok_or(StatusCode::BAD_REQUEST)?;

    let model = payload.get("model")
        .and_then(|m| m.as_str())
        .unwrap_or("fastvlm-7b");

    let max_tokens = payload.get("max_tokens")
        .and_then(|m| m.as_u64())
        .unwrap_or(512) as usize;

    let temperature = payload.get("temperature")
        .and_then(|t| t.as_f64())
        .unwrap_or(0.7) as f32;

    // Find the last user message
    let user_message = messages.iter()
        .rev()
        .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("user"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;

    // Check for image content
    let mut image_data = None;
    if let Some(content) = payload.get("messages").and_then(|m| m.as_array()) {
        for message in content {
            if let Some(content_array) = message.get("content").and_then(|c| c.as_array()) {
                for content_item in content_array {
                    if content_item.get("type").and_then(|t| t.as_str()) == Some("image_url") {
                        image_data = content_item.get("image_url")
                            .and_then(|url| url.get("url"))
                            .and_then(|url| url.as_str());
                        break;
                    }
                }
            }
        }
    }

    let vision_request = VisionRequest {
        prompt: user_message.to_string(),
        image_data: image_data.map(|s| s.to_string()),
        image_url: None,
        max_tokens: Some(max_tokens),
        temperature: Some(temperature),
    };

    match state.mlx_service.process_vision(vision_request).await {
        Ok(response) => {
            let usage = json!({
                "prompt_tokens": user_message.split_whitespace().count(),
                "completion_tokens": response.tokens_used,
                "total_tokens": user_message.split_whitespace().count() + response.tokens_used
            });

            Ok(Json(json!({
                "id": format!("chatcmpl-{}", chrono::Utc::now().timestamp()),
                "object": "chat.completion",
                "created": chrono::Utc::now().timestamp(),
                "model": model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response.response
                    },
                    "finish_reason": "stop"
                }],
                "usage": usage
            })))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn vision_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let vision_request = VisionRequest {
        prompt: payload.get("prompt")
            .and_then(|p| p.as_str())
            .unwrap_or("")
            .to_string(),
        image_data: payload.get("image_data")
            .and_then(|d| d.as_str())
            .map(|s| s.to_string()),
        image_url: payload.get("image_url")
            .and_then(|u| u.as_str())
            .map(|s| s.to_string()),
        max_tokens: payload.get("max_tokens")
            .and_then(|t| t.as_u64())
            .map(|t| t as usize),
        temperature: payload.get("temperature")
            .and_then(|t| t.as_f64())
            .map(|t| t as f32),
    };

    match state.mlx_service.process_vision(vision_request).await {
        Ok(response) => Ok(Json(serde_json::to_value(response).unwrap())),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn tts_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let tts_request = TTSRequest {
        text: payload.get("text")
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string(),
        voice: payload.get("voice")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        speed: payload.get("speed")
            .and_then(|s| s.as_f64())
            .map(|s| s as f32),
        pitch: payload.get("pitch")
            .and_then(|p| p.as_f64())
            .map(|p| p as f32),
    };

    match state.mlx_service.process_tts(tts_request).await {
        Ok(response) => Ok(Json(serde_json::to_value(response).unwrap())),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn create_fine_tuning_job(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let request = FineTuningRequest {
        name: payload.get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("")
            .to_string(),
        description: payload.get("description")
            .and_then(|d| d.as_str())
            .unwrap_or("")
            .to_string(),
        base_model: payload.get("base_model")
            .and_then(|m| m.as_str())
            .unwrap_or("")
            .to_string(),
        training_data: payload.get("training_data")
            .and_then(|t| t.as_array())
            .map(|arr| arr.iter().cloned().collect())
            .unwrap_or_default(),
        config: serde_json::from_value(
            payload.get("config").cloned().unwrap_or(json!({}))
        ).unwrap_or_default(),
        user_id: payload.get("user_id")
            .and_then(|u| u.as_str())
            .unwrap_or("")
            .to_string(),
    };

    match state.mlx_service.create_fine_tuning_job(request).await {
        Ok(job) => Ok(Json(json!({
            "success": true,
            "data": job,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn list_fine_tuning_jobs(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, StatusCode> {
    let user_id = params.get("user_id").map(|s| s.as_str());
    let jobs = state.mlx_service.list_jobs(user_id).await;

    Ok(Json(json!({
        "success": true,
        "data": jobs,
        "count": jobs.len(),
        "timestamp": chrono::Utc::now().to_rfc3339()
    })))
}

async fn get_fine_tuning_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match state.mlx_service.get_job(&job_id).await {
        Some(job) => Ok(Json(json!({
            "success": true,
            "data": job,
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        None => Err(StatusCode::NOT_FOUND)
    }
}

async fn cancel_fine_tuning_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match state.mlx_service.cancel_job(&job_id).await {
        true => Ok(Json(json!({
            "success": true,
            "message": "Job cancelled successfully",
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        false => Err(StatusCode::BAD_REQUEST)
    }
}

async fn delete_fine_tuning_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    match state.mlx_service.delete_job(&job_id).await {
        true => Ok(Json(json!({
            "success": true,
            "message": "Job deleted successfully",
            "timestamp": chrono::Utc::now().to_rfc3339()
        }))),
        false => Err(StatusCode::NOT_FOUND)
    }
}
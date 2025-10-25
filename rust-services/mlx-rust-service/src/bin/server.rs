use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use mlx_rust_service::*;
use std::collections::HashMap;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "mlx_rust_service=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::load().map_err(|e| {
        error!("Failed to load configuration: {}", e);
        e
    })?;

    info!("Starting MLX Rust Service with config: {:?}", config);

    // Initialize service
    let mlx_config = MLXConfig {
        model_path: config.mlx.model_path.clone(),
        device: config.mlx.device.clone(),
        max_tokens: config.mlx.max_tokens,
        temperature: config.mlx.temperature,
        top_p: config.mlx.top_p,
    };

    let service = Arc::new(MLXService::new(mlx_config));

    // Build HTTP router
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/v1/chat/completions", post(chat_completions_handler))
        .route("/v1/vision", post(vision_handler))
        .route("/fine-tune", post(create_fine_tuning_job_handler))
        .route("/jobs/:job_id", get(get_job_handler))
        .route("/jobs", get(list_jobs_handler))
        .route("/jobs/:job_id/cancel", post(cancel_job_handler))
        .route("/jobs/:job_id", axum::http::Method::DELETE, delete_job_handler)
        .route("/tts", post(tts_handler))
        .with_state(service.clone())
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any)),
        );

    // Start HTTP server
    let http_addr = format!("{}:{}", config.server.host, config.server.port);
    let http_listener = tokio::net::TcpListener::bind(&http_addr).await?;
    
    info!("HTTP server listening on {}", http_addr);

    // Start gRPC server
    let grpc_addr = format!("{}:{}", config.server.host, config.server.grpc_port);
    let grpc_service = grpc::MLXGrpcService::new(service, config.clone());
    let grpc_server = tonic::transport::Server::builder()
        .add_service(grpc_service.into_server())
        .serve(grpc_addr.parse()?);

    info!("gRPC server listening on {}", grpc_addr);

    // Run both servers concurrently
    tokio::select! {
        result = axum::serve(http_listener, app) => {
            if let Err(e) = result {
                error!("HTTP server error: {}", e);
            }
        }
        result = grpc_server => {
            if let Err(e) = result {
                error!("gRPC server error: {}", e);
            }
        }
    }

    Ok(())
}

async fn health_handler(State(service): State<Arc<MLXService>>) -> Json<HashMap<String, serde_json::Value>> {
    Json(service.get_health_status().await)
}

async fn chat_completions_handler(
    State(service): State<Arc<MLXService>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Handle chat completions
    Ok(Json(serde_json::json!({
        "choices": [{
            "message": {
                "role": "assistant",
                "content": "This is a mock response from the MLX Rust service"
            }
        }]
    })))
}

async fn vision_handler(
    State(service): State<Arc<MLXService>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<VisionResponse>, StatusCode> {
    let request = VisionRequest {
        prompt: payload["prompt"].as_str().unwrap_or("").to_string(),
        image_data: payload["image_data"].as_str().map(|s| s.to_string()),
        image_url: payload["image_url"].as_str().map(|s| s.to_string()),
        max_tokens: payload["max_tokens"].as_u64().map(|t| t as usize),
        temperature: payload["temperature"].as_f64().map(|t| t as f32),
    };

    match service.process_vision(request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            error!("Vision processing failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn create_fine_tuning_job_handler(
    State(service): State<Arc<MLXService>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<FineTuningJob>, StatusCode> {
    let request = FineTuningRequest {
        name: payload["name"].as_str().unwrap_or("").to_string(),
        description: payload["description"].as_str().unwrap_or("").to_string(),
        base_model: payload["base_model"].as_str().unwrap_or("").to_string(),
        training_data: payload["training_data"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
            .unwrap_or_default(),
        config: FineTuningConfig::default(),
        user_id: payload["user_id"].as_str().unwrap_or("default").to_string(),
    };

    match service.create_fine_tuning_job(request).await {
        Ok(job) => Ok(Json(job)),
        Err(e) => {
            error!("Fine-tuning job creation failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_job_handler(
    State(service): State<Arc<MLXService>>,
    Path(job_id): Path<String>,
) -> Result<Json<FineTuningJob>, StatusCode> {
    match service.get_job(&job_id).await {
        Some(job) => Ok(Json(job)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn list_jobs_handler(
    State(service): State<Arc<MLXService>>,
    Query(params): Query<HashMap<String, String>>,
) -> Json<Vec<FineTuningJob>> {
    let user_id = params.get("user_id").map(|s| s.as_str());
    Json(service.list_jobs(user_id).await)
}

async fn cancel_job_handler(
    State(service): State<Arc<MLXService>>,
    Path(job_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let success = service.cancel_job(&job_id).await;
    Ok(Json(serde_json::json!({ "success": success })))
}

async fn delete_job_handler(
    State(service): State<Arc<MLXService>>,
    Path(job_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let success = service.delete_job(&job_id).await;
    Ok(Json(serde_json::json!({ "success": success })))
}

async fn tts_handler(
    State(service): State<Arc<MLXService>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<TTSResponse>, StatusCode> {
    let request = TTSRequest {
        text: payload["text"].as_str().unwrap_or("").to_string(),
        voice: payload["voice"].as_str().map(|s| s.to_string()),
        speed: payload["speed"].as_f64().map(|s| s as f32),
        pitch: payload["pitch"].as_f64().map(|p| p as f32),
    };

    match service.process_tts(request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            error!("TTS processing failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
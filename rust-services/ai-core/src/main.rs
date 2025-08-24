//! AI Core Service
//! High-performance Rust service for AI processing, model management, and inference

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{Json, Sse},
    routing::{get, post},
    Router,
};
use futures::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::SystemTime,
};
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, error, instrument, Span};
use tracing_subscriber::prelude::*;

mod config;
mod inference;
mod memory;
mod metrics;
mod models;
mod providers;

use crate::{
    config::Config,
    inference::{InferenceEngine, InferenceRequest, Message as InferenceMessage},
    memory::MemoryManager,
    metrics::Metrics,
    models::ModelManager,
    providers::ProviderRouter,
};

/// Application state
#[derive(Clone)]
pub struct AppState {
    inference_engine: Arc<InferenceEngine>,
    model_manager: Arc<ModelManager>,
    provider_router: Arc<ProviderRouter>,
    memory_manager: Arc<MemoryManager>,
    metrics: Arc<Metrics>,
    config: Arc<Config>,
}

/// AI completion request
#[derive(Debug, Deserialize)]
struct CompletionRequest {
    model: Option<String>,
    messages: Vec<Message>,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    stream: Option<bool>,
    provider: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

/// AI completion response
#[derive(Debug, Serialize)]
struct CompletionResponse {
    id: String,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
    provider: String,
    processing_time_ms: u64,
    cached: bool,
}

#[derive(Debug, Serialize)]
struct Choice {
    message: Message,
    index: u32,
    finish_reason: String,
}

#[derive(Debug, Serialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

/// Model information
#[derive(Debug, Serialize)]
struct ModelInfo {
    id: String,
    name: String,
    provider: String,
    context_length: u32,
    pricing: ModelPricing,
    capabilities: Vec<String>,
    status: String,
}

#[derive(Debug, Serialize)]
struct ModelPricing {
    input_cost_per_1k: f64,
    output_cost_per_1k: f64,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    models_loaded: usize,
    providers_active: usize,
    memory_usage_mb: f64,
}

/// AI completion endpoint
#[instrument(skip(state, request), fields(model = %request.model.as_deref().unwrap_or("default")))]
async fn ai_completion(
    State(state): State<AppState>,
    Json(request): Json<CompletionRequest>,
) -> Result<Json<CompletionResponse>, StatusCode> {
    let start_time = SystemTime::now();
    let span = Span::current();
    
    span.record("service.name", "ai-core");
    span.record("ai.model", request.model.as_deref().unwrap_or("default"));
    span.record("ai.max_tokens", request.max_tokens.unwrap_or(0));
    span.record("ai.temperature", request.temperature.unwrap_or(0.0));

    info!(
        model = request.model.as_deref().unwrap_or("default"),
        message_count = request.messages.len(),
        max_tokens = request.max_tokens.unwrap_or(1000),
        temperature = request.temperature.unwrap_or(0.7),
        "Processing AI completion request"
    );

    // Convert to internal request format
    let inference_request = InferenceRequest {
        model: request.model.unwrap_or_else(|| "gpt-3.5-turbo".to_string()),
        messages: request.messages.into_iter().map(|msg| InferenceMessage {
            role: msg.role,
            content: msg.content,
        }).collect(),
        max_tokens: request.max_tokens.unwrap_or(1000),
        temperature: request.temperature.unwrap_or(0.7),
        stream: request.stream.unwrap_or(false),
        provider_preference: request.provider,
        metadata: HashMap::new(),
    };

    // Route to appropriate provider and perform inference
    let inference_result = state.inference_engine.complete(inference_request).await;

    match inference_result {
        Ok(response) => {
            let processing_time = start_time.elapsed().unwrap().as_millis() as u64;
            
            // Record metrics
            state.metrics.requests_total
                .with_label_values(&["success", &response.provider])
                .inc();
            state.metrics.inference_duration
                .with_label_values(&[&response.provider])
                .observe(processing_time as f64 / 1000.0);
            state.metrics.tokens_processed_total
                .with_label_values(&[&response.provider])
                .inc_by(response.usage.total_tokens as u64);

            span.record("ai.provider", &response.provider);
            span.record("ai.tokens.total", response.usage.total_tokens);
            span.record("processing.time_ms", processing_time);

            info!(
                provider = response.provider,
                tokens_used = response.usage.total_tokens,
                processing_time_ms = processing_time,
                cached = response.cached,
                "AI completion successful"
            );

            let completion_response = CompletionResponse {
                id: response.id,
                model: response.model,
                choices: vec![Choice {
                    message: Message {
                        role: "assistant".to_string(),
                        content: response.content,
                    },
                    index: 0,
                    finish_reason: response.finish_reason,
                }],
                usage: Usage {
                    prompt_tokens: response.usage.prompt_tokens,
                    completion_tokens: response.usage.completion_tokens,
                    total_tokens: response.usage.total_tokens,
                },
                provider: response.provider,
                processing_time_ms: processing_time,
                cached: response.cached,
            };

            Ok(Json(completion_response))
        }
        Err(e) => {
            let processing_time = start_time.elapsed().unwrap().as_millis() as u64;
            
            state.metrics.requests_total
                .with_label_values(&["error", "unknown"])
                .inc();

            span.record("error", true);
            span.record("error.message", &e.to_string());

            error!(
                error = %e,
                processing_time_ms = processing_time,
                "AI completion failed"
            );

            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Streaming AI completion endpoint
#[instrument(skip(state, request))]
async fn ai_completion_stream(
    State(state): State<AppState>,
    Json(request): Json<CompletionRequest>,
) -> Result<Sse<impl Stream<Item = Result<axum::response::sse::Event, std::convert::Infallible>>>, StatusCode> {
    let inference_request = InferenceRequest {
        model: request.model.unwrap_or_else(|| "gpt-3.5-turbo".to_string()),
        messages: request.messages.into_iter().map(|msg| InferenceMessage {
            role: msg.role,
            content: msg.content,
        }).collect(),
        max_tokens: request.max_tokens.unwrap_or(1000),
        temperature: request.temperature.unwrap_or(0.7),
        stream: true,
        provider_preference: request.provider,
        metadata: HashMap::new(),
    };

    match state.inference_engine.stream_complete(inference_request).await {
        Ok(stream) => {
            let event_stream = stream.map(|chunk| {
                Ok(axum::response::sse::Event::default().data(serde_json::to_string(&chunk).unwrap_or_default()))
            });

            Ok(Sse::new(event_stream))
        }
        Err(e) => {
            error!(error = %e, "Streaming completion failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get available models
#[instrument(skip(state))]
async fn list_models(State(state): State<AppState>) -> Result<Json<Vec<ModelInfo>>, StatusCode> {
    let models = state.model_manager.get_available_models().await;
    
    let model_infos: Vec<ModelInfo> = models.into_iter().map(|model| {
        ModelInfo {
            id: model.id.clone(),
            name: model.name,
            provider: model.provider,
            context_length: model.context_length,
            pricing: ModelPricing {
                input_cost_per_1k: model.pricing.input_cost_per_1k,
                output_cost_per_1k: model.pricing.output_cost_per_1k,
            },
            capabilities: model.capabilities,
            status: "available".to_string(),
        }
    }).collect();

    info!(model_count = model_infos.len(), "Listed available models");

    Ok(Json(model_infos))
}

/// Get model performance metrics
#[instrument(skip(state))]
async fn model_metrics(
    State(state): State<AppState>,
    Path(model_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.model_manager.get_model_metrics(&model_id).await {
        Some(metrics) => Ok(Json(serde_json::to_value(metrics).unwrap_or_default())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Memory optimization endpoint
#[instrument(skip(state))]
async fn optimize_memory(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    match state.memory_manager.optimize().await {
        Ok(result) => {
            info!(
                memory_freed_mb = result.memory_freed_mb,
                optimization_time_ms = result.duration_ms,
                "Memory optimization completed"
            );
            Ok(Json(serde_json::to_value(result).unwrap_or_default()))
        }
        Err(e) => {
            error!(error = %e, "Memory optimization failed");
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>, StatusCode> {
    let models_count = state.model_manager.get_loaded_models_count().await;
    let providers_count = state.provider_router.get_active_providers_count().await;
    let memory_usage = state.memory_manager.get_current_usage_mb().await;
    let uptime = state.config.start_time.elapsed().as_secs();

    let response = HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        models_loaded: models_count,
        providers_active: providers_count,
        memory_usage_mb: memory_usage,
    };

    state.metrics.health_checks_total.inc();

    info!(
        models_loaded = models_count,
        providers_active = providers_count,
        memory_usage_mb = memory_usage,
        uptime_seconds = uptime,
        "Health check completed"
    );

    Ok(Json(response))
}

/// Metrics endpoint
#[instrument(skip(state))]
async fn metrics_endpoint(State(state): State<AppState>) -> Result<String, StatusCode> {
    let encoder = prometheus::TextEncoder::new();
    let metric_families = state.metrics.registry.gather();
    
    match encoder.encode_to_string(&metric_families) {
        Ok(output) => Ok(output),
        Err(e) => {
            error!("Failed to encode metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "ai_core=info,tower_http=debug".into())
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Arc::new(Config::load()?);
    
    info!(
        service_name = "ai-core",
        version = env!("CARGO_PKG_VERSION"),
        port = config.port,
        "Starting AI Core service"
    );

    // Initialize components
    let metrics = Arc::new(Metrics::new()?);
    let memory_manager = Arc::new(MemoryManager::new());
    let model_manager = Arc::new(ModelManager::new(config.clone()).await?);
    let provider_router = Arc::new(ProviderRouter::new(config.clone()).await?);
    let inference_engine = Arc::new(InferenceEngine::new(
        model_manager.clone(),
        provider_router.clone(),
        memory_manager.clone(),
    ).await);

    // Create application state
    let app_state = AppState {
        inference_engine,
        model_manager,
        provider_router,
        memory_manager,
        metrics,
        config: config.clone(),
    };

    // Build the application routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_endpoint))
        .route("/v1/chat/completions", post(ai_completion))
        .route("/v1/chat/completions/stream", post(ai_completion_stream))
        .route("/v1/models", get(list_models))
        .route("/v1/models/:model_id/metrics", get(model_metrics))
        .route("/memory/optimize", post(optimize_memory))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
        )
        .with_state(app_state);

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    info!(addr = %addr, "AI Core service listening");

    axum::serve(listener, app).await?;

    Ok(())
}
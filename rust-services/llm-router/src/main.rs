//! LLM Router Service with OpenTelemetry Distributed Tracing
//! High-performance Rust service for routing LLM requests with intelligent load balancing

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::time::timeout;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn, error, instrument, Span};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod config;
mod metrics;
mod providers;
mod router;
mod tracing_setup;

use crate::{
    auth::{jwt_auth_middleware, create_auth_state, AuthenticatedUser},
    config::Config,
    metrics::Metrics,
    providers::{LlmProvider, LlmRequest, LlmResponse},
    router::LlmRouter,
    tracing_setup::init_tracing,
};

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    router: Arc<LlmRouter>,
    metrics: Arc<Metrics>,
    config: Arc<Config>,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    providers_healthy: usize,
    total_providers: usize,
}

/// LLM completion request
#[derive(Debug, Deserialize)]
struct CompletionRequest {
    model: Option<String>,
    prompt: String,
    max_tokens: Option<u32>,
    temperature: Option<f32>,
    stream: Option<bool>,
}

/// LLM completion response
#[derive(Debug, Serialize)]
struct CompletionResponse {
    id: String,
    model: String,
    choices: Vec<Choice>,
    usage: Usage,
    provider: String,
    response_time_ms: u64,
}

#[derive(Debug, Serialize)]
struct Choice {
    text: String,
    index: u32,
    finish_reason: String,
}

#[derive(Debug, Serialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>, StatusCode> {
    let span = Span::current();
    span.record("service.name", "llm-router");
    span.record("health_check", true);

    let router = &state.router;
    let config = &state.config;
    
    // Check provider health
    let providers_status = router.check_providers_health().await;
    let healthy_count = providers_status.iter().filter(|(_, healthy)| **healthy).count();
    let total_count = providers_status.len();

    // Calculate uptime
    let uptime = config.start_time.elapsed().as_secs();

    let response = HealthResponse {
        status: if healthy_count > 0 { "healthy".to_string() } else { "degraded".to_string() },
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        providers_healthy: healthy_count,
        total_providers: total_count,
    };

    // Record metrics
    state.metrics.health_checks_total.inc();
    state.metrics.healthy_providers.set(healthy_count as f64);

    info!(
        healthy_providers = healthy_count,
        total_providers = total_count,
        uptime_seconds = uptime,
        "Health check completed"
    );

    Ok(Json(response))
}

/// LLM completion endpoint
#[instrument(skip(state, request), fields(model = %request.model.as_deref().unwrap_or("default")))]
async fn llm_completion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CompletionRequest>,
) -> Result<Json<CompletionResponse>, StatusCode> {
    let start_time = Instant::now();
    let span = Span::current();
    
    // Add tracing attributes
    span.record("service.name", "llm-router");
    span.record("llm.model", request.model.as_deref().unwrap_or("default"));
    span.record("llm.max_tokens", request.max_tokens.unwrap_or(0));
    span.record("llm.temperature", request.temperature.unwrap_or(0.0));
    
    // Extract request ID for correlation
    let request_id = headers
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown");
    span.record("request.id", request_id);

    info!(
        request_id = request_id,
        model = request.model.as_deref().unwrap_or("default"),
        prompt_length = request.prompt.len(),
        "Processing LLM completion request"
    );

    // Convert to internal request format
    let llm_request = LlmRequest {
        model: request.model.clone().unwrap_or_else(|| "default".to_string()),
        prompt: request.prompt.clone(),
        max_tokens: request.max_tokens.unwrap_or(1000),
        temperature: request.temperature.unwrap_or(0.7),
        metadata: HashMap::new(),
    };

    // Route the request with timeout
    let router_result = timeout(
        Duration::from_secs(30),
        state.router.route_request(&llm_request)
    ).await;

    let response = match router_result {
        Ok(Ok(llm_response)) => {
            let response_time = start_time.elapsed().as_millis() as u64;
            
            // Record successful request metrics
            state.metrics.requests_total
                .with_label_values(&["success", &llm_response.provider])
                .inc();
            state.metrics.request_duration
                .with_label_values(&[&llm_response.provider])
                .observe(response_time as f64 / 1000.0);

            // Add tracing attributes for response
            span.record("llm.provider", &llm_response.provider);
            span.record("llm.tokens.total", llm_response.usage.total_tokens);
            span.record("response.time_ms", response_time);

            info!(
                request_id = request_id,
                provider = llm_response.provider,
                tokens_used = llm_response.usage.total_tokens,
                response_time_ms = response_time,
                "LLM completion successful"
            );

            CompletionResponse {
                id: llm_response.id,
                model: llm_response.model,
                choices: vec![Choice {
                    text: llm_response.text,
                    index: 0,
                    finish_reason: "stop".to_string(),
                }],
                usage: Usage {
                    prompt_tokens: llm_response.usage.prompt_tokens,
                    completion_tokens: llm_response.usage.completion_tokens,
                    total_tokens: llm_response.usage.total_tokens,
                },
                provider: llm_response.provider,
                response_time_ms: response_time,
            }
        }
        Ok(Err(e)) => {
            let response_time = start_time.elapsed().as_millis() as u64;
            
            // Record failed request metrics
            state.metrics.requests_total
                .with_label_values(&["error", "unknown"])
                .inc();

            span.record("error", true);
            span.record("error.message", &e.to_string());

            error!(
                request_id = request_id,
                error = %e,
                response_time_ms = response_time,
                "LLM completion failed"
            );

            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
        Err(_) => {
            // Timeout occurred
            state.metrics.requests_total
                .with_label_values(&["timeout", "unknown"])
                .inc();

            span.record("error", true);
            span.record("error.message", "Request timeout");

            warn!(
                request_id = request_id,
                "LLM completion timeout"
            );

            return Err(StatusCode::REQUEST_TIMEOUT);
        }
    };

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

/// Provider status endpoint
#[instrument(skip(state))]
async fn provider_status(State(state): State<AppState>) -> Result<Json<HashMap<String, bool>>, StatusCode> {
    let span = Span::current();
    span.record("service.name", "llm-router");
    
    let status = state.router.check_providers_health().await;
    Ok(Json(status))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize OpenTelemetry tracing
    let _guard = init_tracing().await?;

    // Load configuration
    let config = Arc::new(Config::load()?);
    
    info!(
        service_name = "llm-router",
        version = env!("CARGO_PKG_VERSION"),
        port = config.port,
        "Starting LLM Router service"
    );

    // Initialize metrics
    let metrics = Arc::new(Metrics::new()?);

    // Initialize router with providers
    let router = Arc::new(LlmRouter::new(config.clone()).await?);

    // Create authentication state
    let auth_state = create_auth_state();

    // Create application state
    let app_state = AppState {
        router,
        metrics,
        config: config.clone(),
    };

    // Build the application routes with JWT authentication
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_endpoint))
        .route("/v1/completions", post(llm_completion))
        .route("/providers/status", get(provider_status))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
                .layer(axum::middleware::from_fn_with_state(
                    auth_state.clone(),
                    jwt_auth_middleware,
                ))
        )
        .with_state(app_state);

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    info!(addr = %addr, "LLM Router service listening");

    axum::serve(listener, app).await?;

    Ok(())
}
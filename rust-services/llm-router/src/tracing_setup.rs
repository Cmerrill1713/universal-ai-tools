//! OpenTelemetry tracing setup for the LLM Router service

use opentelemetry::{
    global,
    KeyValue,
};
use opentelemetry_sdk::{trace as sdktrace, Resource};
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_semantic_conventions as semcov;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use std::time::Duration;

/// Initialize OpenTelemetry tracing with OTLP export
pub async fn init_tracing() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Get service configuration from environment variables
    let service_name = std::env::var("SERVICE_NAME").unwrap_or_else(|_| "llm-router".to_string());
    let service_version = std::env::var("SERVICE_VERSION").unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());
    let otlp_endpoint = std::env::var("OTLP_ENDPOINT").unwrap_or_else(|_| "http://otel-collector:4317".to_string());

    // Create OpenTelemetry tracer
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(otlp_endpoint)
                .with_timeout(Duration::from_secs(3)),
        )
        .with_trace_config(
            sdktrace::config()
                .with_sampler(sdktrace::Sampler::AlwaysOn)
                .with_resource(Resource::new(vec![
                    KeyValue::new(semcov::resource::SERVICE_NAME, service_name.clone()),
                    KeyValue::new(semcov::resource::SERVICE_VERSION, service_version),
                    KeyValue::new(semcov::resource::SERVICE_NAMESPACE, "universal-ai-tools"),
                    KeyValue::new(semcov::resource::DEPLOYMENT_ENVIRONMENT, 
                        std::env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string())),
                    KeyValue::new("service.component", "llm-router"),
                    KeyValue::new("service.language", "rust"),
                ])),
        )
        .install_batch(opentelemetry_sdk::runtime::Tokio)?;

    // Initialize tracing subscriber with OpenTelemetry layer
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().json())
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .init();

    tracing::info!(
        service_name = service_name,
        otlp_endpoint = std::env::var("OTLP_ENDPOINT").unwrap_or_else(|_| "http://otel-collector:4317".to_string()),
        "OpenTelemetry tracing initialized"
    );

    Ok(())
}

/// Shutdown tracing and flush any pending spans
pub fn shutdown_tracing() {
    global::shutdown_tracer_provider();
}

/// Create a custom span with service-specific attributes
pub fn create_service_span(operation: &str) -> tracing::Span {
    tracing::info_span!(
        "llm_router_operation",
        service.name = "llm-router",
        service.version = env!("CARGO_PKG_VERSION"),
        operation.name = operation,
        component = "llm-router"
    )
}

/// Record performance metrics in the current span
pub fn record_performance_metrics(
    span: &tracing::Span,
    duration_ms: u64,
    tokens_processed: Option<u32>,
    provider: Option<&str>,
) {
    span.record("performance.duration_ms", duration_ms);
    
    if let Some(tokens) = tokens_processed {
        span.record("llm.tokens.processed", tokens);
    }
    
    if let Some(provider_name) = provider {
        span.record("llm.provider", provider_name);
    }
}

/// Add error information to the current span
pub fn record_error(span: &tracing::Span, error: &str, error_type: Option<&str>) {
    span.record("error", true);
    span.record("error.message", error);
    
    if let Some(err_type) = error_type {
        span.record("error.type", err_type);
    }
}

/// Create a child span for provider operations
pub fn create_provider_span(provider_name: &str, operation: &str) -> tracing::Span {
    tracing::info_span!(
        "llm_provider_operation",
        service.name = "llm-router",
        llm.provider = provider_name,
        operation.name = operation,
        component = "provider"
    )
}
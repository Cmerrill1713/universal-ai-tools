//! Enhanced OpenTelemetry tracing setup for the LLM Router service
//! Includes proper OTLP configuration, context propagation, and Qdrant integration

use opentelemetry::{
    global,
    trace::{TraceError, TracerProvider},
    KeyValue,
};
use opentelemetry_sdk::{
    propagation::TraceContextPropagator,
    trace::{self as sdktrace, RandomIdGenerator, Sampler},
    Resource,
};
use opentelemetry_otlp::{Protocol, WithExportConfig};
use opentelemetry_semantic_conventions as semcov;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use std::time::Duration;

/// Initialize enhanced OpenTelemetry tracing with proper OTLP configuration
pub async fn init_tracing() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Set global propagator for W3C Trace Context
    global::set_text_map_propagator(TraceContextPropagator::new());
    
    // Get service configuration from environment
    let service_name = std::env::var("OTEL_SERVICE_NAME")
        .or_else(|_| std::env::var("SERVICE_NAME"))
        .unwrap_or_else(|_| "llm-router".to_string());
    
    let service_version = std::env::var("SERVICE_VERSION")
        .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());
    
    let environment = std::env::var("ENVIRONMENT")
        .unwrap_or_else(|_| "development".to_string());
    
    // Configure OTLP endpoint with fallback
    let otlp_endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .or_else(|_| std::env::var("OTLP_ENDPOINT"))
        .unwrap_or_else(|_| "http://otel-collector:4317".to_string());
    
    let otlp_protocol = std::env::var("OTEL_EXPORTER_OTLP_PROTOCOL")
        .unwrap_or_else(|_| "grpc".to_string());

    // Configure resource attributes
    let resource = Resource::new(vec![
        KeyValue::new(semcov::resource::SERVICE_NAME, service_name.clone()),
        KeyValue::new(semcov::resource::SERVICE_VERSION, service_version.clone()),
        KeyValue::new(semcov::resource::SERVICE_NAMESPACE, "universal-ai-tools"),
        KeyValue::new(semcov::resource::SERVICE_INSTANCE_ID, 
            format!("{}_{}", hostname::get()?.to_string_lossy(), std::process::id())),
        KeyValue::new(semcov::resource::DEPLOYMENT_ENVIRONMENT, environment.clone()),
        KeyValue::new("service.component", "llm-router"),
        KeyValue::new("service.language", "rust"),
        KeyValue::new("service.runtime", "tokio"),
        KeyValue::new("telemetry.sdk.name", "opentelemetry"),
        KeyValue::new("telemetry.sdk.language", "rust"),
        KeyValue::new("telemetry.sdk.version", opentelemetry::version()),
        KeyValue::new("qdrant.enabled", std::env::var("QDRANT_URL").is_ok().to_string()),
    ]);

    // Configure sampling based on environment
    let sampler = match environment.as_str() {
        "production" => Sampler::TraceIdRatioBased(0.1), // Sample 10% in production
        "staging" => Sampler::TraceIdRatioBased(0.5),    // Sample 50% in staging
        _ => Sampler::AlwaysOn,                          // Sample everything in dev
    };

    // Create OTLP exporter based on protocol
    let exporter = match otlp_protocol.as_str() {
        "http/protobuf" => {
            opentelemetry_otlp::new_exporter()
                .http()
                .with_endpoint(otlp_endpoint.clone())
                .with_timeout(Duration::from_secs(10))
                .with_headers(get_otlp_headers())
                .build_span_exporter()?
        },
        _ => {
            // Default to gRPC
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(otlp_endpoint.clone())
                .with_timeout(Duration::from_secs(10))
                .with_metadata(get_otlp_metadata()?)
                .build_span_exporter()?
        }
    };

    // Build the tracer provider with batch processor
    let trace_config = sdktrace::Config::default()
        .with_sampler(sampler)
        .with_id_generator(RandomIdGenerator::default())
        .with_max_events_per_span(128)
        .with_max_attributes_per_span(128)
        .with_max_links_per_span(128)
        .with_resource(resource);

    let tracer_provider = sdktrace::TracerProvider::builder()
        .with_batch_exporter(exporter, opentelemetry_sdk::runtime::Tokio)
        .with_config(trace_config)
        .build();

    // Set global tracer provider
    let tracer = tracer_provider.tracer("llm-router");
    global::set_tracer_provider(tracer_provider);

    // Initialize tracing subscriber with multiple layers
    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    
    let fmt_layer = tracing_subscriber::fmt::layer()
        .json()
        .with_current_span(true)
        .with_span_list(true)
        .with_target(true)
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_file(true)
        .with_line_number(true);

    let env_filter = EnvFilter::try_from_default_env()
        .or_else(|_| EnvFilter::try_new("info"))
        .unwrap();

    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(telemetry_layer)
        .init();

    tracing::info!(
        service_name = service_name,
        service_version = service_version,
        environment = environment,
        otlp_endpoint = otlp_endpoint,
        otlp_protocol = otlp_protocol,
        "OpenTelemetry tracing initialized successfully"
    );

    Ok(())
}

/// Get OTLP headers for HTTP transport
fn get_otlp_headers() -> HashMap<String, String> {
    let mut headers = HashMap::new();
    
    if let Ok(auth_header) = std::env::var("OTEL_EXPORTER_OTLP_HEADERS") {
        for header in auth_header.split(',') {
            if let Some((key, value)) = header.split_once('=') {
                headers.insert(key.to_string(), value.to_string());
            }
        }
    }
    
    headers
}

/// Get OTLP metadata for gRPC transport
fn get_otlp_metadata() -> Result<tonic::metadata::MetadataMap, Box<dyn std::error::Error + Send + Sync>> {
    let mut metadata = tonic::metadata::MetadataMap::new();
    
    if let Ok(auth_header) = std::env::var("OTEL_EXPORTER_OTLP_HEADERS") {
        for header in auth_header.split(',') {
            if let Some((key, value)) = header.split_once('=') {
                metadata.insert(
                    key.parse()?,
                    value.parse()?
                );
            }
        }
    }
    
    Ok(metadata)
}

/// Shutdown tracing and ensure all spans are flushed
pub fn shutdown_tracing() {
    tracing::info!("Shutting down OpenTelemetry tracing");
    global::shutdown_tracer_provider();
}

use std::collections::HashMap;

/// Create a custom span with comprehensive service attributes
#[tracing::instrument(skip_all)]
pub fn create_service_span(operation: &str) -> tracing::Span {
    tracing::info_span!(
        "llm_router.operation",
        otel.name = operation,
        otel.kind = "server",
        service.name = "llm-router",
        service.version = env!("CARGO_PKG_VERSION"),
        operation.name = operation,
        operation.type = "llm_routing",
        component = "llm-router",
        span.type = "web"
    )
}

/// Record comprehensive performance metrics
pub fn record_performance_metrics(
    span: &tracing::Span,
    duration_ms: u64,
    tokens_processed: Option<u32>,
    provider: Option<&str>,
    model: Option<&str>,
    cache_hit: bool,
) {
    span.record("performance.duration_ms", duration_ms);
    span.record("performance.throughput_rps", 1000.0 / duration_ms as f64);
    
    if let Some(tokens) = tokens_processed {
        span.record("llm.tokens.processed", tokens);
        span.record("llm.tokens.per_second", 
            (tokens as f64 * 1000.0) / duration_ms as f64);
    }
    
    if let Some(provider_name) = provider {
        span.record("llm.provider", provider_name);
    }
    
    if let Some(model_name) = model {
        span.record("llm.model", model_name);
    }
    
    span.record("cache.hit", cache_hit);
}

/// Record detailed error information
pub fn record_error(
    span: &tracing::Span, 
    error: &str, 
    error_type: Option<&str>,
    error_code: Option<i32>,
) {
    span.record("otel.status_code", "ERROR");
    span.record("otel.status_description", error);
    span.record("error", true);
    span.record("error.message", error);
    
    if let Some(err_type) = error_type {
        span.record("error.type", err_type);
    }
    
    if let Some(code) = error_code {
        span.record("error.code", code);
    }
}

/// Create a child span for LLM provider operations
#[tracing::instrument(skip_all)]
pub fn create_provider_span(
    provider_name: &str, 
    operation: &str,
    model: Option<&str>,
) -> tracing::Span {
    let mut span = tracing::info_span!(
        "llm.provider.call",
        otel.name = format!("{} {}", provider_name, operation),
        otel.kind = "client",
        service.name = "llm-router",
        llm.provider = provider_name,
        llm.operation = operation,
        operation.name = operation,
        component = "provider",
        span.type = "llm"
    );
    
    if let Some(model_name) = model {
        span.record("llm.model", model_name);
    }
    
    span
}

/// Create a span for Qdrant vector operations
#[tracing::instrument(skip_all)]
pub fn create_qdrant_span(operation: &str, collection: Option<&str>) -> tracing::Span {
    let mut span = tracing::info_span!(
        "qdrant.operation",
        otel.name = format!("Qdrant {}", operation),
        otel.kind = "client",
        service.name = "llm-router",
        db.system = "qdrant",
        db.operation = operation,
        operation.name = operation,
        component = "vector_db",
        span.type = "db"
    );
    
    if let Some(coll) = collection {
        span.record("db.collection", coll);
    }
    
    span
}

/// Extract trace context from HTTP headers
pub fn extract_trace_context(headers: &axum::http::HeaderMap) -> opentelemetry::Context {
    use opentelemetry::propagation::TextMapPropagator;
    use tracing_opentelemetry::OpenTelemetrySpanExt;
    
    let extractor = HeaderExtractor(headers);
    let propagator = TraceContextPropagator::new();
    propagator.extract(&extractor)
}

/// Inject trace context into HTTP headers
pub fn inject_trace_context(headers: &mut axum::http::HeaderMap) {
    use opentelemetry::propagation::TextMapPropagator;
    use tracing_opentelemetry::OpenTelemetrySpanExt;
    
    let mut injector = HeaderInjector(headers);
    let propagator = TraceContextPropagator::new();
    propagator.inject_context(&tracing::Span::current().context(), &mut injector);
}

// Helper structs for context propagation
struct HeaderExtractor<'a>(&'a axum::http::HeaderMap);

impl<'a> opentelemetry::propagation::Extractor for HeaderExtractor<'a> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|v| v.to_str().ok())
    }
    
    fn keys(&self) -> Vec<&str> {
        self.0.keys().filter_map(|k| k.as_str()).collect()
    }
}

struct HeaderInjector<'a>(&'a mut axum::http::HeaderMap);

impl<'a> opentelemetry::propagation::Injector for HeaderInjector<'a> {
    fn set(&mut self, key: &str, value: String) {
        if let Ok(name) = axum::http::HeaderName::from_bytes(key.as_bytes()) {
            if let Ok(val) = axum::http::HeaderValue::from_str(&value) {
                self.0.insert(name, val);
            }
        }
    }
}
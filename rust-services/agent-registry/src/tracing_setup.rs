//! OpenTelemetry tracing setup for Agent Registry Service

use opentelemetry::trace::TraceError;
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{runtime, trace as sdktrace, Resource};
use std::env;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Initialize OpenTelemetry tracing for the Agent Registry service
pub async fn init_tracing() -> Result<(), TraceError> {
    // Get configuration from environment
    let otlp_endpoint = env::var("OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://otel-collector:4317".to_string());
    let service_name = env::var("SERVICE_NAME")
        .unwrap_or_else(|_| "agent-registry".to_string());
    let service_version = env::var("SERVICE_VERSION")
        .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());
    let environment = env::var("ENVIRONMENT")
        .unwrap_or_else(|_| "development".to_string());

    // Create OTLP exporter
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(otlp_endpoint),
        )
        .with_trace_config(
            sdktrace::Config::default()
                .with_resource(Resource::new(vec![
                    KeyValue::new("service.name", service_name.clone()),
                    KeyValue::new("service.version", service_version),
                    KeyValue::new("service.namespace", "universal-ai-tools"),
                    KeyValue::new("deployment.environment", environment),
                    KeyValue::new("service.component", "agent-registry"),
                    KeyValue::new("service.language", "rust"),
                    KeyValue::new("service.instance.id", uuid::Uuid::new_v4().to_string()),
                ]))
                .with_sampler(sdktrace::Sampler::AlwaysOn),
        )
        .install_batch(runtime::Tokio)?;

    // Set up tracing subscriber with OpenTelemetry layer
    let telemetry_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(telemetry_layer)
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!(
        service_name = %service_name,
        "OpenTelemetry tracing initialized for Agent Registry"
    );

    Ok(())
}


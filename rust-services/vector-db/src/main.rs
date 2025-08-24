// High-performance Vector Database Service for Universal AI Tools
// Provides GPU-accelerated vector similarity search and indexing

use anyhow::Result;
use clap::Parser;
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::{info, instrument};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod config;
// mod vector_engine;  // Temporarily disabled
mod simple_engine;
// mod api;  // Temporarily disabled
mod simple_api;
mod storage;
mod accelerator;
mod types;
mod metrics;

use config::Config;
use simple_engine::SimpleVectorEngine;
use simple_api::create_router;
use metrics::MetricsService;

#[cfg(feature = "metal-acceleration")]
use accelerator::metal::MetalAccelerator;

// Use jemalloc for better memory performance
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

#[derive(Parser, Debug)]
#[command(name = "vector-db")]
#[command(about = "High-performance vector database service")]
struct Args {
    #[arg(short, long, default_value = "config.toml")]
    config: String,

    #[arg(short, long, default_value = "8082")]
    port: u16,

    #[arg(long)]
    disable_gpu: bool,

    #[arg(long)]
    log_level: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    // Initialize observability
    init_tracing(&args).await?;

    info!(
        "🚀 Starting Universal AI Tools Vector Database Service v{}, port: {}, GPU disabled: {}",
        env!("CARGO_PKG_VERSION"),
        args.port,
        args.disable_gpu
    );

    // Load configuration
    let config = Config::load(&args.config)?;

    // Initialize metrics service
    let metrics = Arc::new(MetricsService::new()?);

    // Initialize GPU acceleration if available
    #[cfg(feature = "metal-acceleration")]
    let _accelerator = if !args.disable_gpu {
        Some(Arc::new(MetalAccelerator::new().await?))
    } else {
        None
    };

    #[cfg(not(feature = "metal-acceleration"))]
    let _accelerator: Option<Arc<()>> = None;

    // Initialize simple vector engine
    let vector_engine = Arc::new(
        SimpleVectorEngine::new(config.clone(), metrics.clone()).await?
    );

    // Log initialization success
    info!(
        "✅ Simple vector engine initialized - GPU: {}, Dimensions: {}",
        vector_engine.is_gpu_enabled(),
        config.vector.dimensions
    );

    // Create HTTP server
    let app = create_router(vector_engine.clone(), metrics.clone());

    let addr = format!("0.0.0.0:{}", args.port);
    let listener = TcpListener::bind(&addr).await?;

    info!("🌐 Vector database server starting on {}", addr);

    // Start the server
    axum::serve(listener, app).await?;

    Ok(())
}

#[instrument]
async fn init_tracing(args: &Args) -> Result<()> {
    let log_level = args.log_level.as_deref().unwrap_or("info");

    // Initialize OpenTelemetry with proper configuration
    let otlp_endpoint = std::env::var("OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://localhost:4317".to_string());

    let tracer = if let Ok(endpoint) = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(otlp_endpoint)
        )
        .with_trace_config(
            opentelemetry_sdk::trace::config()
                .with_resource(opentelemetry_sdk::Resource::new(vec![
                    opentelemetry::KeyValue::new("service.name", "vector-db"),
                    opentelemetry::KeyValue::new("service.version", env!("CARGO_PKG_VERSION")),
                ]))
        )
        .install_batch(opentelemetry_sdk::runtime::Tokio) {
        Some(endpoint)
    } else {
        None
    };

    // Create tracing subscriber with OpenTelemetry integration
    let mut subscriber = tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| format!("vector_db={}", log_level).into())
        )
        .with(tracing_subscriber::fmt::layer().json());

    // Add OpenTelemetry layer if available
    if let Some(tracer) = tracer {
        subscriber = subscriber.with(tracing_opentelemetry::layer().with_tracer(tracer));
        info!("📊 OpenTelemetry tracing enabled with endpoint: {}", otlp_endpoint);
    } else {
        info!("📊 OpenTelemetry tracing disabled, using local tracing only");
    }

    subscriber.init();

    info!("📊 Observability initialized successfully");

    Ok(())
}

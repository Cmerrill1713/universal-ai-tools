//! Memory Management Service
//! High-performance Rust service for intelligent memory optimization and monitoring

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use sysinfo::{System, ProcessRefreshKind};
use tokio::{time::interval, sync::RwLock};
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{info, warn, error, instrument, Span};
use tracing_subscriber::prelude::*;

mod config;
mod metrics;
mod optimizer;

use crate::{
    config::Config,
    metrics::Metrics,
    optimizer::{MemoryOptimizer, OptimizationResult},
};

/// Application state
#[derive(Clone)]
pub struct AppState {
    system_info: Arc<RwLock<System>>,
    memory_optimizer: Arc<MemoryOptimizer>,
    metrics: Arc<Metrics>,
    config: Arc<Config>,
    optimization_history: Arc<RwLock<Vec<OptimizationResult>>>,
}

/// Memory metrics response
#[derive(Debug, Serialize)]
struct MemoryMetrics {
    timestamp: u64,
    heap_used_mb: f64,
    heap_total_mb: f64,
    system_used_mb: f64,
    system_total_mb: f64,
    swap_used_mb: f64,
    swap_total_mb: f64,
    available_mb: f64,
    usage_percentage: f64,
    processes: Vec<ProcessInfo>,
}

#[derive(Debug, Serialize)]
struct ProcessInfo {
    pid: u32,
    name: String,
    memory_mb: f64,
    cpu_usage: f32,
}

/// Memory optimization request
#[derive(Debug, Deserialize)]
struct OptimizationRequest {
    aggressive: Option<bool>,
    target_mb: Option<f64>,
    preserve_processes: Option<Vec<String>>,
}

/// Memory alert
#[derive(Debug, Serialize)]
struct MemoryAlert {
    id: String,
    level: String,
    message: String,
    timestamp: u64,
    current_usage_mb: f64,
    threshold_mb: f64,
    recommendations: Vec<String>,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    memory_pressure: String,
    optimization_active: bool,
}

/// Get current memory metrics
#[instrument(skip(state))]
async fn memory_metrics(State(state): State<AppState>) -> Result<Json<MemoryMetrics>, StatusCode> {
    let span = Span::current();
    span.record("service.name", "memory-manager");
    span.record("endpoint", "memory_metrics");

    let mut system = state.system_info.write().await;
    system.refresh_memory();
    system.refresh_processes_specifics(ProcessRefreshKind::new().with_memory());

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Get system memory info
    let total_memory = system.total_memory() as f64 / (1024.0 * 1024.0);
    let used_memory = system.used_memory() as f64 / (1024.0 * 1024.0);
    let available_memory = system.available_memory() as f64 / (1024.0 * 1024.0);
    let total_swap = system.total_swap() as f64 / (1024.0 * 1024.0);
    let used_swap = system.used_swap() as f64 / (1024.0 * 1024.0);
    
    let usage_percentage = (used_memory / total_memory) * 100.0;

    // Get top memory consuming processes
    let mut processes: Vec<_> = system.processes()
        .values()
        .map(|proc| ProcessInfo {
            pid: proc.pid().as_u32(),
            name: proc.name().to_string(),
            memory_mb: proc.memory() as f64 / (1024.0 * 1024.0),
            cpu_usage: proc.cpu_usage(),
        })
        .collect();

    // Sort by memory usage and take top 10
    processes.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap());
    processes.truncate(10);

    let top_process_name = processes.first().map(|p| p.name.as_str()).unwrap_or("none");

    // Record metrics
    state.metrics.memory_usage_total.set(used_memory);
    state.metrics.memory_usage_percentage.set(usage_percentage);
    state.metrics.system_memory_total.set(total_memory);

    let response = MemoryMetrics {
        timestamp,
        heap_used_mb: used_memory,
        heap_total_mb: total_memory,
        system_used_mb: used_memory,
        system_total_mb: total_memory,
        swap_used_mb: used_swap,
        swap_total_mb: total_swap,
        available_mb: available_memory,
        usage_percentage,
        processes,
    };

    info!(
        memory_used_mb = used_memory,
        memory_total_mb = total_memory,
        usage_percentage = usage_percentage,
        top_process = top_process_name,
        "Memory metrics collected"
    );

    Ok(Json(response))
}

/// Perform memory optimization
#[instrument(skip(state, request))]
async fn optimize_memory(
    State(state): State<AppState>,
    Json(request): Json<OptimizationRequest>,
) -> Result<Json<OptimizationResult>, StatusCode> {
    let span = Span::current();
    span.record("service.name", "memory-manager");
    span.record("endpoint", "optimize_memory");
    span.record("aggressive", request.aggressive.unwrap_or(false));

    info!(
        aggressive = request.aggressive.unwrap_or(false),
        target_mb = request.target_mb,
        "Starting memory optimization"
    );

    let system = state.system_info.read().await;
    let result = state.memory_optimizer.optimize(
        &*system,
        request.aggressive.unwrap_or(false),
        request.target_mb,
        request.preserve_processes.unwrap_or_default(),
    ).await;

    match result {
        Ok(optimization_result) => {
            // Record optimization in history
            let mut history = state.optimization_history.write().await;
            history.push(optimization_result.clone());
            
            // Keep only last 100 optimizations
            if history.len() > 100 {
                history.remove(0);
            }

            // Update metrics
            state.metrics.optimizations_total.inc();
            state.metrics.memory_freed_mb.observe(optimization_result.memory_freed_mb);

            info!(
                memory_freed_mb = optimization_result.memory_freed_mb,
                actions_taken = optimization_result.actions.len(),
                duration_ms = optimization_result.duration_ms,
                "Memory optimization completed"
            );

            Ok(Json(optimization_result))
        }
        Err(e) => {
            error!(error = %e, "Memory optimization failed");
            state.metrics.optimization_errors_total.inc();
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Get memory optimization history
#[instrument(skip(state))]
async fn get_optimization_history(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<OptimizationResult>>, StatusCode> {
    let limit = params.get("limit")
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(10);

    let history = state.optimization_history.read().await;
    let recent_history: Vec<_> = history
        .iter()
        .rev()
        .take(limit)
        .cloned()
        .collect();

    Ok(Json(recent_history))
}

/// Get memory pressure alerts
#[instrument(skip(state))]
async fn memory_alerts(State(state): State<AppState>) -> Result<Json<Vec<MemoryAlert>>, StatusCode> {
    let system = state.system_info.read().await;
    let mut alerts = Vec::new();

    let total_memory = system.total_memory() as f64 / (1024.0 * 1024.0);
    let used_memory = system.used_memory() as f64 / (1024.0 * 1024.0);
    let usage_percentage = (used_memory / total_memory) * 100.0;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Critical threshold: >90% memory usage
    if usage_percentage > 90.0 {
        alerts.push(MemoryAlert {
            id: format!("critical_{}", timestamp),
            level: "critical".to_string(),
            message: format!("Critical memory usage: {:.1}%", usage_percentage),
            timestamp,
            current_usage_mb: used_memory,
            threshold_mb: total_memory * 0.9,
            recommendations: vec![
                "Immediately run aggressive memory optimization".to_string(),
                "Consider scaling up system memory".to_string(),
                "Terminate non-essential processes".to_string(),
            ],
        });
    }
    // Warning threshold: >75% memory usage
    else if usage_percentage > 75.0 {
        alerts.push(MemoryAlert {
            id: format!("warning_{}", timestamp),
            level: "warning".to_string(),
            message: format!("High memory usage: {:.1}%", usage_percentage),
            timestamp,
            current_usage_mb: used_memory,
            threshold_mb: total_memory * 0.75,
            recommendations: vec![
                "Run memory optimization soon".to_string(),
                "Monitor memory-intensive processes".to_string(),
                "Clear unnecessary caches".to_string(),
            ],
        });
    }

    Ok(Json(alerts))
}

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>, StatusCode> {
    let system = state.system_info.read().await;
    let total_memory = system.total_memory() as f64 / (1024.0 * 1024.0);
    let used_memory = system.used_memory() as f64 / (1024.0 * 1024.0);
    let usage_percentage = (used_memory / total_memory) * 100.0;

    let memory_pressure = if usage_percentage > 90.0 {
        "critical"
    } else if usage_percentage > 75.0 {
        "high"
    } else if usage_percentage > 50.0 {
        "medium"
    } else {
        "low"
    };

    let uptime = state.config.start_time.elapsed().as_secs();

    let response = HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        memory_pressure: memory_pressure.to_string(),
        optimization_active: false, // Would check if optimization is currently running
    };

    // Record health check
    state.metrics.health_checks_total.inc();

    info!(
        memory_pressure = memory_pressure,
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

/// Background memory monitoring task
async fn memory_monitoring_task(state: AppState) {
    let mut interval = interval(Duration::from_secs(10));
    
    loop {
        interval.tick().await;
        
        // Update system info
        {
            let mut system = state.system_info.write().await;
            system.refresh_memory();
        }

        // Check for memory pressure and auto-optimize if needed
        let system = state.system_info.read().await;
        let total_memory = system.total_memory() as f64 / (1024.0 * 1024.0);
        let used_memory = system.used_memory() as f64 / (1024.0 * 1024.0);
        let usage_percentage = (used_memory / total_memory) * 100.0;

        // Auto-optimize if memory usage is critical (>95%)
        if usage_percentage > 95.0 {
            warn!(
                usage_percentage = usage_percentage,
                "Critical memory usage detected, triggering auto-optimization"
            );

            if let Err(e) = state.memory_optimizer.optimize(
                &*system,
                true, // aggressive mode
                Some(total_memory * 0.8), // target 80% usage
                vec![], // no processes to preserve
            ).await {
                error!(error = %e, "Auto-optimization failed");
            }
        }

        // Update metrics
        state.metrics.memory_usage_total.set(used_memory);
        state.metrics.memory_usage_percentage.set(usage_percentage);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "memory_manager=info,tower_http=debug".into())
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Arc::new(Config::load()?);
    
    info!(
        service_name = "memory-manager",
        version = env!("CARGO_PKG_VERSION"),
        port = config.port,
        "Starting Memory Management service"
    );

    // Initialize system info
    let system_info = Arc::new(RwLock::new(System::new_all()));

    // Initialize components
    let metrics = Arc::new(Metrics::new()?);
    let memory_optimizer = Arc::new(MemoryOptimizer::new());
    let optimization_history = Arc::new(RwLock::new(Vec::new()));

    // Create application state
    let app_state = AppState {
        system_info: system_info.clone(),
        memory_optimizer,
        metrics,
        config: config.clone(),
        optimization_history,
    };

    // Start background monitoring task
    let monitoring_state = app_state.clone();
    tokio::spawn(async move {
        memory_monitoring_task(monitoring_state).await;
    });

    // Build the application routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_endpoint))
        .route("/memory/current", get(memory_metrics))
        .route("/memory/optimize", post(optimize_memory))
        .route("/memory/history", get(get_optimization_history))
        .route("/memory/alerts", get(memory_alerts))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(CorsLayer::permissive())
        )
        .with_state(app_state);

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    info!(addr = %addr, "Memory Manager service listening");

    axum::serve(listener, app).await?;

    Ok(())
}
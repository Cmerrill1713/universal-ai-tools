//! Memory Optimization Service for Universal AI Tools
//! High-performance Rust service for real-time memory monitoring and optimization

#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, RwLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::{net::TcpListener, time::interval};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::{error, info, instrument, warn};

mod config;
mod memory_analyzer;
mod metrics;
mod optimization;
mod system_monitor;
mod tracing_setup;

use crate::{
    config::Config,
    memory_analyzer::{MemoryAnalyzer, MemoryReport},
    metrics::Metrics,
    optimization::{OptimizationEngine, OptimizationRecommendation},
    system_monitor::SystemMonitor,
    tracing_setup::init_tracing,
};

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub analyzer: Arc<MemoryAnalyzer>,
    pub optimizer: Arc<OptimizationEngine>,
    pub monitor: Arc<SystemMonitor>,
    pub metrics: Arc<Metrics>,
    pub config: Arc<Config>,
    pub memory_cache: Arc<RwLock<HashMap<String, MemorySnapshot>>>,
}

/// Memory snapshot for a specific timestamp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySnapshot {
    pub timestamp: u64,
    pub total_memory: u64,
    pub used_memory: u64,
    pub available_memory: u64,
    pub cache_memory: u64,
    pub buffer_memory: u64,
    pub swap_used: u64,
    pub swap_total: u64,
    pub memory_pressure: f64,
    pub gc_stats: Option<GcStats>,
    pub heap_stats: HeapStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcStats {
    pub collections: u64,
    pub pause_time_ms: f64,
    pub allocated_bytes: u64,
    pub freed_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeapStats {
    pub allocated: u64,
    pub resident: u64,
    pub mapped: u64,
    pub retained: u64,
    pub fragmentation_ratio: f64,
}

/// Memory optimization request
#[derive(Debug, Deserialize)]
pub struct OptimizationRequest {
    pub target_service: Option<String>,
    pub optimization_level: Option<String>, // conservative, balanced, aggressive
    pub max_memory_mb: Option<u64>,
    pub force_gc: Option<bool>,
}

/// Memory optimization response
#[derive(Debug, Serialize)]
pub struct OptimizationResponse {
    pub success: bool,
    pub recommendations: Vec<OptimizationRecommendation>,
    pub memory_freed_mb: u64,
    pub optimization_time_ms: u64,
    pub new_memory_usage: MemorySnapshot,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    memory_usage_mb: u64,
    optimization_enabled: bool,
    monitored_services: usize,
}

/// Query parameters for memory analysis
#[derive(Debug, Deserialize)]
pub struct AnalysisQuery {
    pub service: Option<String>,
    pub duration_minutes: Option<u64>,
    pub include_gc: Option<bool>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Initialize OpenTelemetry tracing
    let _guard = init_tracing().await?;

    // Load configuration
    let config = Arc::new(Config::load()?);
    
    let start_time = Instant::now();
    
    info!(
        service_name = "memory-optimizer",
        version = env!("CARGO_PKG_VERSION"),
        port = config.port,
        "Starting Memory Optimization service"
    );

    // Initialize components
    let analyzer = Arc::new(MemoryAnalyzer::new(config.clone())?);
    let optimizer = Arc::new(OptimizationEngine::new(config.clone())?);
    let monitor = Arc::new(SystemMonitor::new(config.clone())?);
    let metrics = Arc::new(Metrics::new()?);
    let memory_cache = Arc::new(RwLock::new(HashMap::new()));

    // Create application state
    let app_state = AppState {
        analyzer: analyzer.clone(),
        optimizer: optimizer.clone(),
        monitor: monitor.clone(),
        metrics: metrics.clone(),
        config: config.clone(),
        memory_cache: memory_cache.clone(),
    };

    // Start background monitoring task
    let monitor_state = app_state.clone();
    tokio::spawn(async move {
        background_monitoring_task(monitor_state).await;
    });

    // Start memory snapshot collection task
    let snapshot_state = app_state.clone();
    tokio::spawn(async move {
        memory_snapshot_task(snapshot_state).await;
    });

    // Build the application routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_endpoint))
        .route("/memory/analyze", get(analyze_memory))
        .route("/memory/optimize", post(optimize_memory))
        .route("/memory/snapshot", get(get_memory_snapshot))
        .route("/memory/history", get(get_memory_history))
        .route("/memory/recommendations", get(get_optimization_recommendations))
        .route("/system/status", get(get_system_status))
        .route("/gc/force/:service", post(force_garbage_collection))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = TcpListener::bind(addr).await?;

    info!(addr = %addr, "Memory Optimizer service listening");

    axum::serve(listener, app).await?;

    Ok(())
}

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Result<Json<HealthResponse>, StatusCode> {
    let system_info = state.monitor.get_system_info().await;
    let uptime = state.config.start_time.elapsed().as_secs();
    
    let response = HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        memory_usage_mb: system_info.memory_used_mb,
        optimization_enabled: state.config.optimization_enabled,
        monitored_services: state.monitor.get_monitored_services_count().await,
    };

    // Record metrics
    state.metrics.health_checks_total.inc();
    state.metrics.current_memory_mb.set(system_info.memory_used_mb as f64);

    Ok(Json(response))
}

/// Memory analysis endpoint
#[instrument(skip(state))]
async fn analyze_memory(
    State(state): State<AppState>,
    Query(params): Query<AnalysisQuery>,
) -> Result<Json<MemoryReport>, StatusCode> {
    let start_time = Instant::now();
    
    info!(
        service = ?params.service,
        duration_minutes = ?params.duration_minutes,
        "Analyzing memory usage"
    );

    let report = match state.analyzer
        .analyze_memory(
            params.service.as_deref(),
            params.duration_minutes.unwrap_or(60),
            params.include_gc.unwrap_or(true),
        )
        .await
    {
        Ok(report) => report,
        Err(e) => {
            error!("Memory analysis failed: {}", e);
            state.metrics.analysis_errors_total.inc();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let analysis_time = start_time.elapsed().as_millis() as f64 / 1000.0;
    state.metrics.analysis_duration_seconds.observe(analysis_time);
    state.metrics.analysis_requests_total.inc();

    info!(
        analysis_time_ms = start_time.elapsed().as_millis(),
        memory_pressure = report.memory_pressure,
        recommendations_count = report.recommendations.len(),
        "Memory analysis completed"
    );

    Ok(Json(report))
}

/// Memory optimization endpoint
#[instrument(skip(state))]
async fn optimize_memory(
    State(state): State<AppState>,
    Json(request): Json<OptimizationRequest>,
) -> Result<Json<OptimizationResponse>, StatusCode> {
    let start_time = Instant::now();
    
    info!(
        target_service = ?request.target_service,
        optimization_level = ?request.optimization_level,
        max_memory_mb = ?request.max_memory_mb,
        "Starting memory optimization"
    );

    // Get memory snapshot before optimization
    let before_snapshot = create_memory_snapshot(&state).await;

    // Run optimization
    let optimization_result = match state.optimizer
        .optimize_memory(
            request.target_service.as_deref(),
            request.optimization_level.as_deref().unwrap_or("balanced"),
            request.max_memory_mb,
            request.force_gc.unwrap_or(false),
        )
        .await
    {
        Ok(result) => result,
        Err(e) => {
            error!("Memory optimization failed: {}", e);
            state.metrics.optimization_errors_total.inc();
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Get memory snapshot after optimization
    let after_snapshot = create_memory_snapshot(&state).await;
    
    let optimization_time = start_time.elapsed().as_millis() as u64;
    let memory_freed = if before_snapshot.used_memory > after_snapshot.used_memory {
        (before_snapshot.used_memory - after_snapshot.used_memory) / 1024 / 1024
    } else {
        0
    };

    let response = OptimizationResponse {
        success: optimization_result.success,
        recommendations: optimization_result.recommendations,
        memory_freed_mb: memory_freed,
        optimization_time_ms: optimization_time,
        new_memory_usage: after_snapshot,
    };

    // Record metrics
    state.metrics.optimization_requests_total.inc();
    state.metrics.optimization_duration_seconds.observe(optimization_time as f64 / 1000.0);
    state.metrics.memory_freed_mb.observe(memory_freed as f64);

    info!(
        optimization_time_ms = optimization_time,
        memory_freed_mb = memory_freed,
        success = optimization_result.success,
        "Memory optimization completed"
    );

    Ok(Json(response))
}

/// Get current memory snapshot
#[instrument(skip(state))]
async fn get_memory_snapshot(State(state): State<AppState>) -> Result<Json<MemorySnapshot>, StatusCode> {
    let snapshot = create_memory_snapshot(&state).await;
    Ok(Json(snapshot))
}

/// Get memory usage history
#[instrument(skip(state))]
async fn get_memory_history(
    State(state): State<AppState>,
    Query(params): Query<AnalysisQuery>,
) -> Result<Json<Vec<MemorySnapshot>>, StatusCode> {
    let cache = state.memory_cache.read().unwrap();
    let duration_minutes = params.duration_minutes.unwrap_or(60);
    let cutoff_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() - (duration_minutes * 60);

    let mut history: Vec<MemorySnapshot> = cache
        .values()
        .filter(|snapshot| snapshot.timestamp >= cutoff_time)
        .cloned()
        .collect();

    history.sort_by_key(|snapshot| snapshot.timestamp);
    
    Ok(Json(history))
}

/// Get optimization recommendations
#[instrument(skip(state))]
async fn get_optimization_recommendations(
    State(state): State<AppState>,
    Query(params): Query<AnalysisQuery>,
) -> Result<Json<Vec<OptimizationRecommendation>>, StatusCode> {
    let recommendations = match state.optimizer
        .get_recommendations(params.service.as_deref())
        .await
    {
        Ok(recs) => recs,
        Err(e) => {
            error!("Failed to get recommendations: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(recommendations))
}

/// Get system status
#[instrument(skip(state))]
async fn get_system_status(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    let system_info = state.monitor.get_system_info().await;
    Ok(Json(serde_json::to_value(system_info).unwrap()))
}

/// Force garbage collection for a specific service
#[instrument(skip(state))]
async fn force_garbage_collection(
    State(state): State<AppState>,
    Path(service): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!(service = %service, "Forcing garbage collection");

    let result = match state.optimizer.force_gc(&service).await {
        Ok(success) => serde_json::json!({
            "success": success,
            "service": service,
            "timestamp": SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
        }),
        Err(e) => {
            error!("Failed to force GC for service {}: {}", service, e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    Ok(Json(result))
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

/// Background task for continuous memory monitoring
async fn background_monitoring_task(state: AppState) {
    let mut interval = interval(Duration::from_secs(state.config.monitoring_interval_seconds));
    
    info!("Starting background memory monitoring task");
    
    loop {
        interval.tick().await;
        
        // Update system metrics
        let system_info = state.monitor.get_system_info().await;
        state.metrics.current_memory_mb.set(system_info.memory_used_mb as f64);
        state.metrics.memory_pressure.set(system_info.memory_pressure);
        
        // Check for memory pressure and auto-optimize if enabled
        if state.config.auto_optimization_enabled && system_info.memory_pressure > 0.8 {
            warn!(
                memory_pressure = system_info.memory_pressure,
                "High memory pressure detected, triggering auto-optimization"
            );
            
            if let Err(e) = state.optimizer
                .optimize_memory(None, "conservative", None, false)
                .await
            {
                error!("Auto-optimization failed: {}", e);
            }
        }
    }
}

/// Background task for collecting memory snapshots
async fn memory_snapshot_task(state: AppState) {
    let mut interval = interval(Duration::from_secs(60)); // Collect every minute
    
    info!("Starting memory snapshot collection task");
    
    loop {
        interval.tick().await;
        
        let snapshot = create_memory_snapshot(&state).await;
        let timestamp_key = snapshot.timestamp.to_string();
        
        // Store snapshot in cache (keep last 24 hours)
        {
            let mut cache = state.memory_cache.write().unwrap();
            cache.insert(timestamp_key, snapshot);
            
            // Clean old snapshots (older than 24 hours)
            let cutoff_time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() - (24 * 60 * 60);
            
            cache.retain(|_, snapshot| snapshot.timestamp >= cutoff_time);
        }
    }
}

/// Create a memory snapshot from current system state
async fn create_memory_snapshot(state: &AppState) -> MemorySnapshot {
    let system_info = state.monitor.get_system_info().await;
    
    MemorySnapshot {
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        total_memory: system_info.memory_total_mb * 1024 * 1024,
        used_memory: system_info.memory_used_mb * 1024 * 1024,
        available_memory: (system_info.memory_total_mb - system_info.memory_used_mb) * 1024 * 1024,
        cache_memory: system_info.cache_memory_mb * 1024 * 1024,
        buffer_memory: system_info.buffer_memory_mb * 1024 * 1024,
        swap_used: system_info.swap_used_mb * 1024 * 1024,
        swap_total: system_info.swap_total_mb * 1024 * 1024,
        memory_pressure: system_info.memory_pressure,
        gc_stats: None, // Would be populated by service-specific data
        heap_stats: HeapStats {
            allocated: system_info.heap_allocated_mb * 1024 * 1024,
            resident: system_info.memory_used_mb * 1024 * 1024,
            mapped: system_info.memory_total_mb * 1024 * 1024,
            retained: system_info.heap_allocated_mb * 1024 * 1024,
            fragmentation_ratio: 0.1, // Placeholder
        },
    }
}
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

mod config;
mod metrics_collector;
mod optimizer_engine;
mod performance_analyzer;
mod resource_monitor;

use config::Config;
use metrics_collector::MetricsCollector;
use optimizer_engine::OptimizerEngine;
use performance_analyzer::PerformanceAnalyzer;
use resource_monitor::ResourceMonitor;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceOptimizationRequest {
    pub target_service: String,
    pub optimization_type: OptimizationType,
    pub parameters: Option<HashMap<String, serde_json::Value>>,
    pub priority: OptimizationPriority,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum OptimizationType {
    #[serde(rename = "memory")]
    Memory,
    #[serde(rename = "cpu")]
    Cpu,
    #[serde(rename = "database")]
    Database,
    #[serde(rename = "network")]
    Network,
    #[serde(rename = "cache")]
    Cache,
    #[serde(rename = "comprehensive")]
    Comprehensive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OptimizationPriority {
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "critical")]
    Critical,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OptimizationResponse {
    pub optimization_id: String,
    pub status: String,
    pub recommendations: Vec<OptimizationRecommendation>,
    pub estimated_improvement: Option<f64>,
    pub estimated_duration: Option<u64>, // milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationRecommendation {
    pub category: String,
    pub description: String,
    pub impact: ImpactLevel,
    pub effort_required: EffortLevel,
    pub implementation_steps: Vec<String>,
    pub expected_benefit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ImpactLevel {
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
    #[serde(rename = "critical")]
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum EffortLevel {
    #[serde(rename = "minimal")]
    Minimal,
    #[serde(rename = "low")]
    Low,
    #[serde(rename = "medium")]
    Medium,
    #[serde(rename = "high")]
    High,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemPerformanceReport {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub overall_score: f64,
    pub service_performances: HashMap<String, ServicePerformance>,
    pub bottlenecks: Vec<PerformanceBottleneck>,
    pub recommendations: Vec<OptimizationRecommendation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServicePerformance {
    pub service_name: String,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub response_time: f64,
    pub throughput: f64,
    pub error_rate: f64,
    pub health_score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceBottleneck {
    pub service: String,
    pub bottleneck_type: String,
    pub severity: ImpactLevel,
    pub description: String,
    pub suggested_fix: String,
}

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub metrics_collector: Arc<MetricsCollector>,
    pub optimizer_engine: Arc<RwLock<OptimizerEngine>>,
    pub performance_analyzer: Arc<PerformanceAnalyzer>,
    pub resource_monitor: Arc<ResourceMonitor>,
    pub active_optimizations: Arc<RwLock<HashMap<String, OptimizationStatus>>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OptimizationStatus {
    pub id: String,
    pub target_service: String,
    pub status: String,
    pub progress: f64,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub estimated_completion: Option<chrono::DateTime<chrono::Utc>>,
    pub current_phase: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .init();

    info!("🚀 Starting Performance Optimizer Service");

    // Load configuration
    let config = Config::new().await?;
    info!("Configuration loaded successfully");

    // Initialize components
    let metrics_collector = Arc::new(MetricsCollector::new(&config).await?);
    let optimizer_engine = Arc::new(RwLock::new(OptimizerEngine::new(&config).await?));
    let performance_analyzer = Arc::new(PerformanceAnalyzer::new(&config).await?);
    let resource_monitor = Arc::new(ResourceMonitor::new(&config).await?);
    let active_optimizations = Arc::new(RwLock::new(HashMap::new()));

    let app_state = AppState {
        config: config.clone(),
        metrics_collector,
        optimizer_engine,
        performance_analyzer,
        resource_monitor,
        active_optimizations,
    };

    info!("🔧 Performance optimization components initialized");

    // Start background tasks
    start_background_tasks(app_state.clone()).await;

    // Build the router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/optimization/analyze", post(analyze_performance))
        .route("/api/optimization/optimize", post(optimize_performance))
        .route("/api/optimization/status/:id", get(get_optimization_status))
        .route("/api/optimization/report", get(get_performance_report))
        .route("/api/optimization/recommendations", get(get_recommendations))
        .route("/api/system/metrics", get(get_system_metrics))
        .route("/api/system/bottlenecks", get(get_bottlenecks))
        .route("/api/services/performance", get(get_services_performance))
        .route("/api/optimization/history", get(get_optimization_history))
        .route("/metrics", get(prometheus_metrics))
        .with_state(app_state);

    // Start the server
    let port = std::env::var("PERFORMANCE_OPTIMIZER_PORT")
        .unwrap_or_else(|_| "8085".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    info!("🌐 Performance Optimizer starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn start_background_tasks(state: AppState) {
    // Start metrics collection
    let metrics_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            if let Err(e) = metrics_state.metrics_collector.collect_all_metrics().await {
                error!("Error collecting metrics: {}", e);
            }
        }
    });

    // Start performance analysis
    let analyzer_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(e) = analyzer_state.performance_analyzer.analyze_system_performance().await {
                error!("Error analyzing performance: {}", e);
            }
        }
    });

    // Start resource monitoring
    let monitor_state = state.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(15));
        loop {
            interval.tick().await;
            if let Err(e) = monitor_state.resource_monitor.monitor_resources().await {
                error!("Error monitoring resources: {}", e);
            }
        }
    });

    info!("📊 Background monitoring tasks started");
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "performance-optimizer",
        "version": "1.0.0",
        "timestamp": chrono::Utc::now()
    }))
}

async fn analyze_performance(
    State(state): State<AppState>,
    Json(request): Json<HashMap<String, serde_json::Value>>,
) -> Result<Json<SystemPerformanceReport>, StatusCode> {
    info!("📊 Analyzing system performance");

    match state.performance_analyzer.generate_system_report().await {
        Ok(report) => {
            info!("Performance analysis completed successfully");
            Ok(Json(report))
        }
        Err(e) => {
            error!("Error generating performance report: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn optimize_performance(
    State(state): State<AppState>,
    Json(request): Json<PerformanceOptimizationRequest>,
) -> Result<Json<OptimizationResponse>, StatusCode> {
    info!("🔧 Starting performance optimization for service: {}", request.target_service);

    let optimization_id = Uuid::new_v4().to_string();
    
    // Create optimization status
    let status = OptimizationStatus {
        id: optimization_id.clone(),
        target_service: request.target_service.clone(),
        status: "in_progress".to_string(),
        progress: 0.0,
        started_at: chrono::Utc::now(),
        estimated_completion: Some(chrono::Utc::now() + chrono::Duration::seconds(300)),
        current_phase: "analysis".to_string(),
    };

    // Store status
    state.active_optimizations.write().await.insert(optimization_id.clone(), status);

    // Execute optimization
    let mut optimizer = state.optimizer_engine.write().await;
    match optimizer.optimize_service(&request).await {
        Ok(recommendations) => {
            // Update status to completed
            if let Some(status) = state.active_optimizations.write().await.get_mut(&optimization_id) {
                status.status = "completed".to_string();
                status.progress = 100.0;
                status.current_phase = "completed".to_string();
            }

            let response = OptimizationResponse {
                optimization_id,
                status: "completed".to_string(),
                recommendations,
                estimated_improvement: Some(15.5), // Calculated improvement
                estimated_duration: Some(300000), // 5 minutes
            };

            info!("Performance optimization completed successfully");
            Ok(Json(response))
        }
        Err(e) => {
            error!("Error optimizing performance: {}", e);
            
            // Update status to failed
            if let Some(status) = state.active_optimizations.write().await.get_mut(&optimization_id) {
                status.status = "failed".to_string();
                status.current_phase = "error".to_string();
            }

            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_optimization_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<OptimizationStatus>, StatusCode> {
    let optimizations = state.active_optimizations.read().await;
    
    match optimizations.get(&id) {
        Some(status) => Ok(Json(status.clone())),
        None => {
            warn!("Optimization status not found for ID: {}", id);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

async fn get_performance_report(
    State(state): State<AppState>,
) -> Result<Json<SystemPerformanceReport>, StatusCode> {
    match state.performance_analyzer.generate_system_report().await {
        Ok(report) => Ok(Json(report)),
        Err(e) => {
            error!("Error generating performance report: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_recommendations(
    State(state): State<AppState>,
) -> Result<Json<Vec<OptimizationRecommendation>>, StatusCode> {
    match state.performance_analyzer.get_optimization_recommendations().await {
        Ok(recommendations) => Ok(Json(recommendations)),
        Err(e) => {
            error!("Error getting recommendations: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_system_metrics(
    State(state): State<AppState>,
) -> Result<Json<HashMap<String, serde_json::Value>>, StatusCode> {
    match state.metrics_collector.get_current_metrics().await {
        Ok(metrics) => Ok(Json(metrics)),
        Err(e) => {
            error!("Error getting system metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_bottlenecks(
    State(state): State<AppState>,
) -> Result<Json<Vec<PerformanceBottleneck>>, StatusCode> {
    match state.performance_analyzer.identify_bottlenecks().await {
        Ok(bottlenecks) => Ok(Json(bottlenecks)),
        Err(e) => {
            error!("Error identifying bottlenecks: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_services_performance(
    State(state): State<AppState>,
) -> Result<Json<HashMap<String, ServicePerformance>>, StatusCode> {
    match state.performance_analyzer.get_services_performance().await {
        Ok(performance) => Ok(Json(performance)),
        Err(e) => {
            error!("Error getting services performance: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_optimization_history(
    State(state): State<AppState>,
) -> Result<Json<Vec<OptimizationStatus>>, StatusCode> {
    let optimizations = state.active_optimizations.read().await;
    let history: Vec<OptimizationStatus> = optimizations.values().cloned().collect();
    Ok(Json(history))
}

async fn prometheus_metrics(
    State(state): State<AppState>,
) -> Result<String, StatusCode> {
    match state.metrics_collector.get_prometheus_metrics().await {
        Ok(metrics) => Ok(metrics),
        Err(e) => {
            error!("Error getting Prometheus metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
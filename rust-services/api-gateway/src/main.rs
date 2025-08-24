use axum::{
    extract::{Path, State},
    http::{StatusCode, Method, Uri},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc, time::Duration};
use tokio::sync::RwLock;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{error, info, warn, debug};
use anyhow::Result;
use reqwest::Client;
use uuid::Uuid;

mod config;
mod service_registry;
mod load_balancer;
mod health_checker;
mod rate_limiter;
mod self_healing;
mod hrm_enhanced_self_healing;
mod error_agent_spawner;
mod intelligent_log_analyzer;
mod agent_coordination;
mod proactive_code_analyzer;
mod auto_fix_agents;
mod port_discovery_agent;

use config::Config;
use service_registry::ServiceRegistry;
use load_balancer::LoadBalancer;
use health_checker::HealthChecker;
use rate_limiter::RateLimiter;
use hrm_enhanced_self_healing::{HRMEnhancedSelfHealingEngine, HRMSelfHealingConfig};
use proactive_code_analyzer::{ProactiveCodeAnalyzer, ProactiveCodeAnalyzerConfig};

// Core data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInfo {
    pub id: String,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub health_endpoint: String,
    pub status: ServiceStatus,
    pub last_health_check: Option<chrono::DateTime<chrono::Utc>>,
    pub response_time_ms: Option<u64>,
    pub load_score: f64,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ServiceStatus {
    #[serde(rename = "healthy")]
    Healthy,
    #[serde(rename = "unhealthy")]
    Unhealthy,
    #[serde(rename = "unknown")]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingRule {
    pub path_pattern: String,
    pub target_service: String,
    pub method: Option<String>,
    pub priority: u8,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyRequest {
    pub target_service: String,
    pub path: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayMetrics {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub average_response_time_ms: f64,
    pub requests_per_second: f64,
    pub active_connections: u64,
    pub service_health_scores: HashMap<String, f64>,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

// Application state
#[derive(Clone)]
struct AppState {
    config: Config,
    service_registry: Arc<ServiceRegistry>,
    load_balancer: Arc<LoadBalancer>,
    health_checker: Arc<HealthChecker>,
    rate_limiter: Arc<RateLimiter>,
    hrm_self_healing: Arc<RwLock<Option<HRMEnhancedSelfHealingEngine>>>,
    proactive_code_analyzer: Arc<RwLock<Option<ProactiveCodeAnalyzer>>>,
    client: Client,
    metrics: Arc<RwLock<GatewayMetrics>>,
    routing_rules: Arc<RwLock<Vec<RoutingRule>>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .json()
        .init();

    info!("🌐 Starting API Gateway Service");

    // Load configuration
    let config = Config::load().await?;
    info!("Configuration loaded successfully");

    // Initialize HTTP client
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .build()?;

    // Initialize components
    let service_registry = Arc::new(ServiceRegistry::new(&config).await?);
    let load_balancer = Arc::new(LoadBalancer::new(&config).await?);
    let health_checker = Arc::new(HealthChecker::new(&config, client.clone()).await?);
    let rate_limiter = Arc::new(RateLimiter::new(&config).await?);
    
    // Initialize Local LLM-Enhanced Self-Healing System
    let hrm_config = HRMSelfHealingConfig {
        // Local LLM endpoints (Ollama and LM Studio)
        ollama_url: "http://localhost:11434".to_string(),     // Standard Ollama port
        lm_studio_url: "http://localhost:1234".to_string(),   // Standard LM Studio port  
        preferred_model: "llama3.1:8b".to_string(),          // Primary local model
        fallback_model: "codellama:7b".to_string(),          // Backup model
        
        // Decision caching and performance
        decision_cache_ttl: chrono::Duration::minutes(5),
        min_confidence_threshold: 0.7,
        max_llm_timeout: chrono::Duration::seconds(15),      // Local LLMs need more time
        enable_fallback: true,
        pattern_learning_rate: 0.1,
        
        // Local LLM optimized settings  
        temperature: 0.1,        // Deterministic responses for system operations
        max_tokens: 2048,        // Reasonable response length
        context_window: 4096,    // Standard context window
    };
    
    let hrm_self_healing = match HRMEnhancedSelfHealingEngine::new(hrm_config).await {
        Ok(engine) => {
            info!("🧠 HRM-Enhanced Self-Healing Engine initialized successfully");
            Arc::new(RwLock::new(Some(engine)))
        }
        Err(e) => {
            warn!("⚠️ Failed to initialize HRM Self-Healing Engine: {}. Continuing with basic self-healing.", e);
            Arc::new(RwLock::new(None))
        }
    };

    // Initialize ProactiveCodeAnalyzer with local LLM integration
    let analyzer_config = ProactiveCodeAnalyzerConfig {
        // Local LLM endpoints (same as HRM)
        ollama_url: "http://localhost:11434".to_string(),
        lm_studio_url: "http://localhost:1234".to_string(),
        preferred_model: "llama3.2:3b".to_string(),    // Using the actual available model
        
        // Code analysis settings
        analysis_interval_minutes: 15,                  // Check for issues every 15 minutes
        max_auto_fixes_per_run: 10,
        enable_auto_fix: true,
        
        // Source directories and safety settings
        source_directories: vec![
            std::env::current_dir()?.to_string_lossy().to_string(),
            "src/".to_string(),
        ],
        excluded_patterns: vec![
            "target/".to_string(),
            ".git/".to_string(), 
            "*.log".to_string(),
        ],
        
        // LLM settings
        llm_timeout_seconds: 10,
    };
    
    let proactive_code_analyzer = match ProactiveCodeAnalyzer::new(analyzer_config).await {
        Ok(analyzer) => {
            info!("🔍 Proactive Code Analyzer initialized successfully");
            Arc::new(RwLock::new(Some(analyzer)))
        }
        Err(e) => {
            warn!("⚠️ Failed to initialize Proactive Code Analyzer: {}. Code quality monitoring disabled.", e);
            Arc::new(RwLock::new(None))
        }
    };

    info!("🔧 API Gateway components initialized");

    // Initialize metrics
    let metrics = Arc::new(RwLock::new(GatewayMetrics {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        average_response_time_ms: 0.0,
        requests_per_second: 0.0,
        active_connections: 0,
        service_health_scores: HashMap::new(),
        last_updated: chrono::Utc::now(),
    }));

    // Initialize default routing rules
    let routing_rules = Arc::new(RwLock::new(vec![
        RoutingRule {
            path_pattern: "/api/database/*".to_string(),
            target_service: "database-automation".to_string(),
            method: None,
            priority: 1,
            enabled: true,
        },
        RoutingRule {
            path_pattern: "/api/documentation/*".to_string(),
            target_service: "documentation-generator".to_string(),
            method: None,
            priority: 1,
            enabled: true,
        },
        RoutingRule {
            path_pattern: "/api/ml/*".to_string(),
            target_service: "ml-model-management".to_string(),
            method: None,
            priority: 1,
            enabled: true,
        },
    ]));

    // Register known services
    register_known_services(&service_registry).await?;

    // Create application state
    let app_state = AppState {
        config: config.clone(),
        service_registry: service_registry.clone(),
        load_balancer: load_balancer.clone(),
        health_checker: health_checker.clone(),
        rate_limiter,
        hrm_self_healing: hrm_self_healing.clone(),
        proactive_code_analyzer: proactive_code_analyzer.clone(),
        client,
        metrics: metrics.clone(),
        routing_rules,
    };

    // Start background health checking with port monitoring integration
    start_health_monitoring(health_checker.clone(), service_registry.clone(), proactive_code_analyzer.clone()).await;

    // Start HRM-enhanced self-healing monitoring
    start_hrm_self_healing_monitoring(
        hrm_self_healing.clone(), 
        service_registry.clone()
    ).await;

    // Start proactive code quality monitoring
    start_proactive_code_monitoring(proactive_code_analyzer.clone()).await;

    // Start metrics collection
    start_metrics_collection(metrics.clone()).await;

    info!("📈 Background monitoring started");

    // Build the application router
    let app = Router::new()
        // Health endpoint
        .route("/health", get(health))
        
        // Service registry endpoints (commonly requested)
        .route("/api/services", get(list_services))
        .route("/metrics", get(get_metrics))
        .route("/api/registry/services", get(list_services))
        
        // Gateway management endpoints
        .route("/api/gateway/services", get(list_services).post(register_service))
        .route("/api/gateway/services/:id", get(get_service).delete(unregister_service))
        .route("/api/gateway/metrics", get(get_metrics))
        .route("/api/gateway/routing", get(get_routing_rules).post(update_routing_rules))
        .route("/api/gateway/self-healing", get(get_hrm_self_healing_status))
        .route("/api/gateway/code-quality", get(get_code_quality_status))
        .route("/api/gateway/port-discovery", get(get_port_discovery_status))
        .route("/api/gateway/port-suggestion", post(suggest_optimal_port))
        
        // Proxy endpoints - catch all requests and route them
        .fallback(proxy_request)
        
        .with_state(app_state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any));

    let addr = SocketAddr::from(([127, 0, 0, 1], config.server.port));
    info!("🌐 API Gateway starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

// Health check endpoint
async fn health(State(state): State<AppState>) -> Json<serde_json::Value> {
    let services = state.service_registry.list_services().await.unwrap_or_default();
    let healthy_count = services.iter().filter(|s| s.status == ServiceStatus::Healthy).count();
    let total_count = services.len();

    Json(serde_json::json!({
        "service": "API Gateway",
        "version": "1.0.0",
        "status": if healthy_count > 0 { "healthy" } else { "degraded" },
        "timestamp": chrono::Utc::now(),
        "registered_services": total_count,
        "healthy_services": healthy_count,
        "components": {
            "service_registry": "operational",
            "load_balancer": "operational",
            "health_checker": "operational", 
            "rate_limiter": "operational"
        }
    }))
}

// Service management endpoints
async fn list_services(State(state): State<AppState>) -> Result<Json<Vec<ServiceInfo>>, StatusCode> {
    match state.service_registry.list_services().await {
        Ok(services) => Ok(Json(services)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_service(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ServiceInfo>, StatusCode> {
    match state.service_registry.get_service(&id).await {
        Ok(Some(service)) => Ok(Json(service)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn register_service(
    State(state): State<AppState>,
    Json(service): Json<ServiceInfo>,
) -> Result<Json<ServiceInfo>, StatusCode> {
    match state.service_registry.register_service(service.clone()).await {
        Ok(_) => {
            info!("Registered new service: {} at {}:{}", service.name, service.address, service.port);
            
            // Also register with port discovery system for monitoring
            let analyzer_lock = state.proactive_code_analyzer.read().await;
            if let Some(ref analyzer) = *analyzer_lock {
                if let Err(e) = analyzer.register_service_for_port_monitoring(&service).await {
                    warn!("Failed to register service for port monitoring: {}", e);
                }
            }
            
            Ok(Json(service))
        }
        Err(e) => {
            error!("Failed to register service: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn unregister_service(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    match state.service_registry.unregister_service(&id).await {
        Ok(_) => {
            info!("Unregistered service: {}", id);
            Ok(StatusCode::NO_CONTENT)
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// Metrics endpoint
async fn get_metrics(State(state): State<AppState>) -> Json<GatewayMetrics> {
    let metrics = state.metrics.read().await;
    Json(metrics.clone())
}

// Routing rules management
async fn get_routing_rules(State(state): State<AppState>) -> Json<Vec<RoutingRule>> {
    let rules = state.routing_rules.read().await;
    Json(rules.clone())
}

async fn update_routing_rules(
    State(state): State<AppState>,
    Json(new_rules): Json<Vec<RoutingRule>>,
) -> Result<StatusCode, StatusCode> {
    let mut rules = state.routing_rules.write().await;
    *rules = new_rules;
    info!("Updated routing rules");
    Ok(StatusCode::OK)
}

// HRM Self-Healing status endpoint
async fn get_hrm_self_healing_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    let hrm_available = {
        let hrm_lock = state.hrm_self_healing.read().await;
        hrm_lock.is_some()
    };
    
    let services = state.service_registry.list_services().await.unwrap_or_default();
    let system_health_score = if services.is_empty() {
        0.0
    } else {
        let healthy_count = services.iter().filter(|s| s.status == ServiceStatus::Healthy).count();
        healthy_count as f64 / services.len() as f64
    };
    
    Json(serde_json::json!({
        "hrm_enhanced_self_healing": {
            "enabled": hrm_available,
            "service_url": "http://localhost:8085",
            "confidence_threshold": 0.7,
            "decision_cache_enabled": true,
            "cache_ttl_minutes": 5,
            "max_timeout_seconds": 3
        },
        "system_status": {
            "overall_health_score": system_health_score,
            "total_services": services.len(),
            "healthy_services": services.iter().filter(|s| s.status == ServiceStatus::Healthy).count(),
            "unhealthy_services": services.iter().filter(|s| s.status == ServiceStatus::Unhealthy).count()
        },
        "decision_types": [
            "anomaly_analysis",
            "recovery_strategy_selection", 
            "root_cause_analysis",
            "failure_prediction",
            "resource_scaling",
            "system_optimization"
        ],
        "integration_status": if hrm_available {
            "HRM decision intelligence active - using Rust execution with HRM reasoning"
        } else {
            "Fallback mode - using Rust-only self-healing"
        },
        "timestamp": chrono::Utc::now()
    }))
}

// Main proxy functionality
async fn proxy_request(
    State(state): State<AppState>,
    method: Method,
    uri: Uri,
    headers: axum::http::HeaderMap,
    body: axum::body::Bytes,
) -> Result<axum::response::Response, StatusCode> {
    let path = uri.path();
    debug!("Proxying request: {} {}", method, path);

    // Update metrics
    {
        let mut metrics = state.metrics.write().await;
        metrics.total_requests += 1;
        metrics.active_connections += 1;
    }

    // Find matching routing rule
    let (target_service, rewritten_path) = match find_target_service_with_rewrite(&state, path).await {
        Some((service, rewritten)) => (service, rewritten),
        None => {
            warn!("No routing rule found for path: {}", path);
            return Err(StatusCode::NOT_FOUND);
        }
    };

    // Get healthy service instance from service registry
    let service_instance = match state.service_registry.get_service_by_name(&target_service).await {
        Ok(Some(instance)) if instance.status == ServiceStatus::Healthy => instance,
        Ok(Some(_)) => {
            warn!("Service {} is not healthy", target_service);
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        Ok(None) => {
            warn!("Service {} not found in registry", target_service);
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
        Err(e) => {
            error!("Service registry error: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Build target URL
    let target_url = format!("http://{}:{}{}", service_instance.address, service_instance.port, rewritten_path);

    // Forward request
    let start_time = std::time::Instant::now();
    let response = match forward_request(&state.client, &method, &target_url, headers, body.to_vec()).await {
        Ok(resp) => resp,
        Err(e) => {
            error!("Failed to forward request to {}: {}", target_url, e);
            let mut metrics = state.metrics.write().await;
            metrics.failed_requests += 1;
            metrics.active_connections = metrics.active_connections.saturating_sub(1);
            return Err(StatusCode::BAD_GATEWAY);
        }
    };

    // Update metrics
    let duration = start_time.elapsed().as_millis() as u64;
    {
        let mut metrics = state.metrics.write().await;
        metrics.successful_requests += 1;
        metrics.active_connections = metrics.active_connections.saturating_sub(1);
        
        // Update average response time (simple moving average)
        let total_requests = metrics.successful_requests as f64;
        metrics.average_response_time_ms = 
            (metrics.average_response_time_ms * (total_requests - 1.0) + duration as f64) / total_requests;
    }

    Ok(response)
}

// Helper functions
async fn find_target_service(state: &AppState, path: &str) -> Option<String> {
    let rules = state.routing_rules.read().await;
    
    for rule in rules.iter() {
        if rule.enabled && path_matches(&rule.path_pattern, path) {
            return Some(rule.target_service.clone());
        }
    }
    
    None
}

async fn find_target_service_with_rewrite(state: &AppState, path: &str) -> Option<(String, String)> {
    let rules = state.routing_rules.read().await;
    
    for rule in rules.iter() {
        if rule.enabled && path_matches(&rule.path_pattern, path) {
            let rewritten_path = rewrite_path(&rule.path_pattern, path);
            return Some((rule.target_service.clone(), rewritten_path));
        }
    }
    
    None
}

fn path_matches(pattern: &str, path: &str) -> bool {
    if pattern.ends_with("/*") {
        let prefix = &pattern[..pattern.len() - 2];
        path.starts_with(prefix)
    } else {
        pattern == path
    }
}

fn rewrite_path(pattern: &str, path: &str) -> String {
    if pattern.ends_with("/*") {
        let prefix = &pattern[..pattern.len() - 2];
        if path.starts_with(prefix) {
            // Strip the prefix and return the remainder
            let remainder = &path[prefix.len()..];
            if remainder.is_empty() {
                "/".to_string()
            } else {
                remainder.to_string()
            }
        } else {
            path.to_string()
        }
    } else {
        // For exact matches, return the path as-is
        path.to_string()
    }
}

async fn forward_request(
    client: &Client,
    method: &Method,
    url: &str,
    headers: axum::http::HeaderMap,
    body: Vec<u8>,
) -> Result<axum::response::Response> {
    // Convert axum::http::Method to reqwest::Method
    let reqwest_method = match *method {
        Method::GET => reqwest::Method::GET,
        Method::POST => reqwest::Method::POST,
        Method::PUT => reqwest::Method::PUT,
        Method::DELETE => reqwest::Method::DELETE,
        Method::HEAD => reqwest::Method::HEAD,
        Method::PATCH => reqwest::Method::PATCH,
        Method::OPTIONS => reqwest::Method::OPTIONS,
        _ => reqwest::Method::GET, // Fallback
    };

    let mut request = client.request(reqwest_method, url);

    // Forward headers (skip host and other problematic headers)
    for (name, value) in headers.iter() {
        if !["host", "content-length"].contains(&name.as_str().to_lowercase().as_str()) {
            if let Ok(header_value) = value.to_str() {
                request = request.header(name.as_str(), header_value);
            }
        }
    }

    if !body.is_empty() {
        request = request.body(body);
    }

    let response = request.send().await?;
    let status = response.status();
    let response_headers = response.headers().clone();
    let body_bytes = response.bytes().await?;

    // Convert reqwest::StatusCode to axum::http::StatusCode
    let axum_status = axum::http::StatusCode::from_u16(status.as_u16())?;
    let mut builder = axum::response::Response::builder().status(axum_status);
    
    // Forward response headers with proper conversion
    for (name, value) in response_headers.iter() {
        if let (Ok(header_name), Ok(header_value)) = (
            axum::http::HeaderName::from_bytes(name.as_str().as_bytes()),
            axum::http::HeaderValue::from_bytes(value.as_bytes())
        ) {
            builder = builder.header(header_name, header_value);
        }
    }

    Ok(builder.body(axum::body::Body::from(body_bytes))?)
}

async fn register_known_services(registry: &ServiceRegistry) -> Result<()> {
    info!("Registering known services...");

    let services = vec![
        ServiceInfo {
            id: Uuid::new_v4().to_string(),
            name: "database-automation".to_string(),
            address: "127.0.0.1".to_string(),
            port: 8086,
            health_endpoint: "/health".to_string(),
            status: ServiceStatus::Unknown,
            last_health_check: None,
            response_time_ms: None,
            load_score: 0.0,
            metadata: HashMap::new(),
        },
        ServiceInfo {
            id: Uuid::new_v4().to_string(),
            name: "documentation-generator".to_string(),
            address: "127.0.0.1".to_string(),
            port: 8087,
            health_endpoint: "/health".to_string(),
            status: ServiceStatus::Unknown,
            last_health_check: None,
            response_time_ms: None,
            load_score: 0.0,
            metadata: HashMap::new(),
        },
        ServiceInfo {
            id: Uuid::new_v4().to_string(),
            name: "ml-model-management".to_string(),
            address: "127.0.0.1".to_string(),
            port: 8088,
            health_endpoint: "/health".to_string(),
            status: ServiceStatus::Unknown,
            last_health_check: None,
            response_time_ms: None,
            load_score: 0.0,
            metadata: HashMap::new(),
        },
    ];

    for service in services {
        registry.register_service(service).await?;
    }

    info!("Registered {} known services", 3);
    Ok(())
}

async fn start_health_monitoring(
    health_checker: Arc<HealthChecker>,
    service_registry: Arc<ServiceRegistry>,
    proactive_analyzer: Arc<RwLock<Option<ProactiveCodeAnalyzer>>>,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        
        loop {
            interval.tick().await;
            
            if let Ok(services) = service_registry.list_services().await {
                for service in services {
                    match health_checker.check_service_health(&service).await {
                        Ok(health_result) => {
                            // Update service registry with health check results
                            if let Err(e) = service_registry.update_service_status(
                                &service.id,
                                health_result.status.clone(),
                                health_result.response_time_ms
                            ).await {
                                error!("Failed to update service {} status: {}", service.name, e);
                            }

                            // Update port metrics for port optimization
                            let analyzer_lock = proactive_analyzer.read().await;
                            if let Some(ref analyzer) = *analyzer_lock {
                                let health_score = match health_result.status {
                                    ServiceStatus::Healthy => 1.0,
                                    ServiceStatus::Unknown => 0.5,
                                    ServiceStatus::Unhealthy => 0.0,
                                };
                                let load_score = service.load_score;
                                
                                if let Err(e) = analyzer.update_service_port_metrics(&service.name, health_score, load_score).await {
                                    debug!("Failed to update port metrics for service {}: {}", service.name, e);
                                }
                            }
                        }
                        Err(e) => {
                            warn!("Health check failed for service {}: {}", service.name, e);
                            // Mark service as unhealthy
                            if let Err(update_err) = service_registry.update_service_status(
                                &service.id,
                                ServiceStatus::Unhealthy,
                                None
                            ).await {
                                error!("Failed to mark service {} as unhealthy: {}", service.name, update_err);
                            }
                        }
                    }
                }
            }
        }
    });
}

async fn start_metrics_collection(metrics: Arc<RwLock<GatewayMetrics>>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(10));
        
        loop {
            interval.tick().await;
            
            {
                let mut m = metrics.write().await;
                m.last_updated = chrono::Utc::now();
                
                // Calculate requests per second (simple approximation)
                let elapsed_seconds = 10.0;
                m.requests_per_second = (m.total_requests as f64) / elapsed_seconds;
            }
        }
    });
}

async fn start_hrm_self_healing_monitoring(
    hrm_self_healing: Arc<RwLock<Option<HRMEnhancedSelfHealingEngine>>>,
    service_registry: Arc<ServiceRegistry>,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60)); // HRM analysis every 60s
        
        loop {
            interval.tick().await;
            
            // Check if HRM self-healing is available
            let mut hrm_option = hrm_self_healing.write().await;
            if let Some(ref mut hrm_engine) = hrm_option.as_mut() {
                
                // Get current services for analysis
                match service_registry.list_services().await {
                    Ok(services) => {
                        match hrm_engine.evaluate_system_health_enhanced(&services).await {
                            Ok(enhanced_report) => {
                                info!(
                                    "🧠 HRM Self-Healing Analysis Complete - Intelligence: {}, Confidence: {:.2}, Actions: {}",
                                    enhanced_report.intelligence_level,
                                    enhanced_report.decision_confidence,
                                    enhanced_report.enhanced_actions.len()
                                );
                                
                                // Log HRM decisions for visibility
                                for decision in &enhanced_report.hrm_decisions {
                                    if !decision.reasoning_steps.is_empty() {
                                        debug!(
                                            "🤖 HRM Decision: {} (confidence: {:.2}) - {}",
                                            decision.recommended_actions.get(0)
                                                .map(|a| &a.action_type)
                                                .unwrap_or(&"no_action".to_string()),
                                            decision.confidence,
                                            decision.reasoning_steps.first()
                                                .unwrap_or(&"No reasoning provided".to_string())
                                        );
                                    }
                                }
                                
                                // Log executed actions
                                for action in &enhanced_report.enhanced_actions {
                                    if action.estimated_success_rate > 0.7 {
                                        info!(
                                            "🔧 HRM Action Executed: {} (success rate: {:.1}%)",
                                            action.action_type,
                                            action.estimated_success_rate * 100.0
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                warn!("❌ HRM Self-Healing evaluation failed: {}", e);
                                // Continue monitoring even if one evaluation fails
                            }
                        }
                    }
                    Err(e) => {
                        error!("🔴 Failed to get services for HRM analysis: {}", e);
                    }
                }
            } else {
                debug!("🔄 HRM Self-Healing not available, using basic monitoring only");
                // Could attempt to reinitialize HRM here if needed
            }
        }
    });
}

// Code Quality status endpoint
async fn get_code_quality_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    let analyzer_available = {
        let analyzer_lock = state.proactive_code_analyzer.read().await;
        analyzer_lock.is_some()
    };
    
    Json(serde_json::json!({
        "proactive_code_analyzer": {
            "enabled": analyzer_available,
            "local_llm_integration": {
                "ollama_url": "http://localhost:11434",
                "lm_studio_url": "http://localhost:1234", 
                "preferred_model": "llama3.2:3b",
                "fallback_model": "codellama:7b"
            },
            "scan_settings": {
                "scan_interval_minutes": 15,
                "confidence_threshold": 0.8,
                "max_auto_fixes_per_session": 10,
                "auto_fix_enabled": true,
                "backup_before_fixes": true
            },
            "analysis_capabilities": [
                "compiler_warning_detection",
                "unused_import_removal", 
                "configuration_consistency_checks",
                "code_pattern_optimization",
                "dependency_conflict_resolution",
                "performance_anti_pattern_detection"
            ],
            "safety_features": [
                "backup_before_modifications",
                "confidence_based_auto_fixing",
                "pattern_whitelist_filtering",
                "exclude_critical_files"
            ]
        },
        "system_intelligence": {
            "reactive_healing": "HRM-Enhanced Self-Healing (crisis response)",
            "proactive_improvement": "Continuous Code Quality Analysis (prevention)",
            "integration_status": if analyzer_available {
                "Full autonomous code improvement active"
            } else {
                "Reactive healing only - proactive analysis disabled"
            }
        },
        "timestamp": chrono::Utc::now()
    }))
}

async fn get_port_discovery_status(State(state): State<AppState>) -> Json<serde_json::Value> {
    let analyzer_lock = state.proactive_code_analyzer.read().await;
    if let Some(ref analyzer) = *analyzer_lock {
        match analyzer.get_port_discovery_status().await {
            Ok(status) => Json(status),
            Err(e) => {
                warn!("Failed to get port discovery status: {}", e);
                Json(serde_json::json!({
                    "error": "Failed to get port discovery status",
                    "details": e.to_string(),
                    "timestamp": chrono::Utc::now()
                }))
            }
        }
    } else {
        Json(serde_json::json!({
            "error": "Port discovery not available - ProactiveCodeAnalyzer not initialized",
            "timestamp": chrono::Utc::now()
        }))
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct PortSuggestionRequest {
    service_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PortSuggestionResponse {
    service_name: String,
    suggested_port: u16,
    timestamp: chrono::DateTime<chrono::Utc>,
}

async fn suggest_optimal_port(
    State(state): State<AppState>,
    Json(request): Json<PortSuggestionRequest>,
) -> Result<Json<PortSuggestionResponse>, StatusCode> {
    let analyzer_lock = state.proactive_code_analyzer.read().await;
    if let Some(ref analyzer) = *analyzer_lock {
        match analyzer.suggest_optimal_port_for_service(&request.service_name).await {
            Ok(suggested_port) => {
                info!("🔌 Suggested port {} for service '{}'", suggested_port, request.service_name);
                Ok(Json(PortSuggestionResponse {
                    service_name: request.service_name,
                    suggested_port,
                    timestamp: chrono::Utc::now(),
                }))
            }
            Err(e) => {
                error!("Failed to suggest optimal port for service '{}': {}", request.service_name, e);
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    } else {
        error!("Port discovery not available - ProactiveCodeAnalyzer not initialized");
        Err(StatusCode::SERVICE_UNAVAILABLE)
    }
}

async fn start_proactive_code_monitoring(
    proactive_analyzer: Arc<RwLock<Option<ProactiveCodeAnalyzer>>>,
) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(900)); // 15 minutes = 900 seconds
        
        loop {
            interval.tick().await;
            
            // Check if ProactiveCodeAnalyzer is available
            let mut analyzer_option = proactive_analyzer.write().await;
            if let Some(ref mut analyzer) = analyzer_option.as_mut() {
                
                info!("🔍 Starting proactive code quality analysis...");
                
                match analyzer.run_proactive_analysis().await {
                    Ok(report) => {
                        info!(
                            "✅ Proactive Code Analysis Complete - Issues Found: {}, Auto-Fixed: {}, Score: {:.2}",
                            report.total_issues,
                            report.auto_fixed_issues,
                            report.overall_score
                        );
                        
                        // Log specific improvements made
                        if report.auto_fixed_issues > 0 {
                            info!(
                                "🔧 Auto-Fixes Applied: {} total fixes, Critical Issues: {}, Overall Score: {:.2}",
                                report.auto_fixed_issues,
                                report.critical_issues,
                                report.overall_score
                            );
                        }
                        
                        // Log any high-priority issues that need manual attention
                        let manual_review_needed = report.total_issues - report.auto_fixed_issues;
                        if manual_review_needed > 0 {
                            warn!(
                                "⚠️ Manual Review Required: {} issues need human attention",
                                manual_review_needed
                            );
                        }
                        
                        // System is now proactively improving itself
                        if report.auto_fixed_issues > 0 {
                            info!("🚀 System self-improvement complete - code quality enhanced automatically");
                        }
                    }
                    Err(e) => {
                        warn!("❌ Proactive code analysis failed: {}", e);
                        // Continue monitoring even if one analysis fails
                    }
                }
            } else {
                debug!("🔄 Proactive Code Analyzer not available, skipping code quality scan");
                // Could attempt to reinitialize analyzer here if needed
            }
        }
    });
}
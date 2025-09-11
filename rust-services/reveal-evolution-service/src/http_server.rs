//! HTTP Server for ReVeal Evolution Service
//! 
//! Provides REST API endpoints for the ReVeal framework, replacing FFI
//! for better Docker compatibility and service isolation.

use actix_web::{web, App, HttpResponse, HttpServer, middleware};
use actix_cors::Cors;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, debug};

use crate::{
    engine::RevealEvolutionEngine,
    RevealConfig,
    types::*,
    metrics::EvolutionMetrics,
};

/// HTTP Server configuration
#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
    pub enable_cors: bool,
    pub enable_metrics: bool,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 8082,
            workers: 4,
            enable_cors: true,
            enable_metrics: true,
        }
    }
}

/// Shared application state
pub struct AppState {
    pub engine: Arc<RwLock<RevealEvolutionEngine>>,
    pub config: RevealConfig,
    pub server_config: ServerConfig,
    pub metrics: Arc<RwLock<EvolutionMetrics>>,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    features: FeatureStatus,
    metrics: Option<EvolutionMetricsResponse>,
}

#[derive(Serialize)]
struct FeatureStatus {
    mcts_exploration: bool,
    parallel_verification: bool,
    caching: bool,
    co_evolution_tracking: bool,
}

#[derive(Serialize)]
struct EvolutionMetricsResponse {
    total_evolutions: u64,
    average_turns: f64,
    success_rate: f64,
    average_confidence: f64,
}

/// Error response
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    code: String,
    details: Option<String>,
}

/// Evolution request
#[derive(Debug, Deserialize)]
struct EvolutionRequest {
    problem: String,
    context: EvolutionContext,
    constraints: Option<EvolutionConstraints>,
    options: Option<EvolutionOptions>,
}

/// Quick verification request
#[derive(Debug, Deserialize)]
struct VerificationRequest {
    solution: String,
    problem: String,
    expected_confidence: f64,
}

/// Initialize the engine endpoint
#[tracing::instrument(skip(data))]
async fn initialize(
    data: web::Data<Arc<RwLock<AppState>>>,
    config: web::Json<RevealConfig>,
) -> HttpResponse {
    debug!("Initializing ReVeal Evolution engine with new config");
    
    let mut state = data.write().await;
    
    // Update configuration
    state.config = config.into_inner();
    
    // Reinitialize engine with new config
    match RevealEvolutionEngine::new(state.config.clone()).await {
        Ok(new_engine) => {
            state.engine = Arc::new(RwLock::new(new_engine));
            info!("ReVeal Evolution engine initialized successfully");
            
            HttpResponse::Ok().json(serde_json::json!({
                "status": "initialized",
                "message": "ReVeal Evolution engine initialized successfully",
                "config": state.config
            }))
        }
        Err(e) => {
            error!("Failed to initialize ReVeal engine: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Initialization failed".to_string(),
                code: "INIT_FAILED".to_string(),
                details: Some(e.to_string()),
            })
        }
    }
}

/// Start evolution process
#[tracing::instrument(skip(data))]
async fn start_evolution(
    data: web::Data<Arc<RwLock<AppState>>>,
    req: web::Json<EvolutionRequest>,
) -> HttpResponse {
    let state = data.read().await;
    let mut engine = state.engine.write().await;
    
    debug!("Starting evolution for problem: {}", req.problem);
    
    let evolution_options = req.options.clone().unwrap_or_default();
    
    match engine.evolve(
        &req.problem,
        req.context.clone(),
        req.constraints.clone(),
        evolution_options,
    ).await {
        Ok(result) => {
            info!("Evolution completed successfully with {} turns", result.turns_taken);
            
            // Update metrics
            if let Ok(mut metrics) = state.metrics.write() {
                metrics.record_evolution(result.turns_taken, result.final_confidence, true);
            }
            
            HttpResponse::Ok().json(result)
        }
        Err(e) => {
            error!("Evolution failed: {}", e);
            
            // Update metrics for failure
            if let Ok(mut metrics) = state.metrics.write() {
                metrics.record_evolution(0, 0.0, false);
            }
            
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Evolution failed".to_string(),
                code: "EVOLUTION_FAILED".to_string(),
                details: Some(e.to_string()),
            })
        }
    }
}

/// Quick verification endpoint
#[tracing::instrument(skip(data))]
async fn verify_solution(
    data: web::Data<Arc<RwLock<AppState>>>,
    req: web::Json<VerificationRequest>,
) -> HttpResponse {
    let state = data.read().await;
    let engine = state.engine.read().await;
    
    debug!("Verifying solution for problem: {}", req.problem);
    
    match engine.verify_solution(&req.solution, &req.problem).await {
        Ok(verification_result) => {
            info!("Verification completed with confidence: {}", verification_result.confidence);
            
            HttpResponse::Ok().json(serde_json::json!({
                "verification_result": verification_result,
                "meets_threshold": verification_result.confidence >= req.expected_confidence,
            }))
        }
        Err(e) => {
            error!("Verification failed: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Verification failed".to_string(),
                code: "VERIFICATION_FAILED".to_string(),
                details: Some(e.to_string()),
            })
        }
    }
}

/// Get evolution metrics
async fn get_metrics(data: web::Data<Arc<RwLock<AppState>>>) -> HttpResponse {
    let state = data.read().await;
    
    if let Ok(metrics) = state.metrics.read() {
        let metrics_response = EvolutionMetricsResponse {
            total_evolutions: metrics.total_evolutions,
            average_turns: metrics.average_turns(),
            success_rate: metrics.success_rate(),
            average_confidence: metrics.average_confidence(),
        };
        
        HttpResponse::Ok().json(metrics_response)
    } else {
        HttpResponse::InternalServerError().json(ErrorResponse {
            error: "Failed to read metrics".to_string(),
            code: "METRICS_ERROR".to_string(),
            details: None,
        })
    }
}

/// Health check endpoint
async fn health_check(data: web::Data<Arc<RwLock<AppState>>>) -> HttpResponse {
    let state = data.read().await;
    
    let metrics_response = if let Ok(metrics) = state.metrics.read() {
        Some(EvolutionMetricsResponse {
            total_evolutions: metrics.total_evolutions,
            average_turns: metrics.average_turns(),
            success_rate: metrics.success_rate(),
            average_confidence: metrics.average_confidence(),
        })
    } else {
        None
    };
    
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: 0, // Would track actual uptime
        features: FeatureStatus {
            mcts_exploration: state.config.enable_mcts_exploration,
            parallel_verification: state.config.parallel_verification,
            caching: state.config.enable_caching,
            co_evolution_tracking: state.config.track_co_evolution,
        },
        metrics: metrics_response,
    })
}

/// Metrics endpoint for Prometheus
async fn metrics() -> HttpResponse {
    // Would integrate with prometheus crate
    HttpResponse::Ok()
        .content_type("text/plain")
        .body("# HELP reveal_evolutions_total Total number of evolution processes\\n\\\n               # TYPE reveal_evolutions_total counter\\n\\\n               reveal_evolutions_total 0\\n")
}

/// Start the HTTP server
pub async fn start_server(
    server_config: ServerConfig,
    reveal_config: RevealConfig,
) -> std::io::Result<()> {
    info!("Starting ReVeal Evolution HTTP server on {}:{}", 
          server_config.host, server_config.port);
    
    // Initialize engine
    let engine = RevealEvolutionEngine::new(reveal_config.clone())
        .await
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    
    let metrics = EvolutionMetrics::new();
    
    let app_state = Arc::new(RwLock::new(AppState {
        engine: Arc::new(RwLock::new(engine)),
        config: reveal_config,
        server_config: server_config.clone(),
        metrics: Arc::new(RwLock::new(metrics)),
    }));
    
    HttpServer::new(move || {
        let cors = if server_config.enable_cors {
            Cors::default()
                .allow_any_origin()
                .allow_any_method()
                .allow_any_header()
        } else {
            Cors::default()
                .allowed_origin("http://localhost:9999")
                .allowed_methods(vec!["GET", "POST"])
                .allowed_headers(vec!["Content-Type", "Authorization"])
        };
        
        App::new()
            .app_data(web::Data::new(app_state.clone()))
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .wrap(cors)
            .service(
                web::scope("/api/v1")
                    .route("/initialize", web::post().to(initialize))
                    .route("/evolve", web::post().to(start_evolution))
                    .route("/verify", web::post().to(verify_solution))
                    .route("/metrics", web::get().to(get_metrics))
                    .route("/health", web::get().to(health_check))
            )
            .route("/metrics", web::get().to(metrics))
    })
    .bind((server_config.host, server_config.port))?
    .workers(server_config.workers)
    .run()
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::test;
    
    #[actix_web::test]
    async fn test_health_check() {
        let config = RevealConfig::default();
        let engine = RevealEvolutionEngine::new(config.clone()).await.unwrap();
        let metrics = EvolutionMetrics::new();
        
        let app_state = Arc::new(RwLock::new(AppState {
            engine: Arc::new(RwLock::new(engine)),
            config,
            server_config: ServerConfig::default(),
            metrics: Arc::new(RwLock::new(metrics)),
        }));
        
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(app_state))
                .route("/health", web::get().to(health_check))
        ).await;
        
        let req = test::TestRequest::get()
            .uri("/health")
            .to_request();
        
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_success());
    }
}
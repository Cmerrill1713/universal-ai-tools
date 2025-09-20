//! HTTP server for Intelligent Parameter Service

use crate::{IntelligentParameterService, ServiceConfig, ParameterRequest, PerformanceFeedback, Result};
use actix_web::{web, App, HttpServer, HttpResponse, Result as ActixResult, middleware::Logger};
use actix_cors::Cors;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, debug};

/// Server configuration
#[derive(Clone, Debug)]
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
            port: 8083,
            workers: 4,
            enable_cors: true,
            enable_metrics: true,
        }
    }
}

/// Application state
#[derive(Clone)]
pub struct AppState {
    pub service: Arc<IntelligentParameterService>,
}

/// Error response format
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

impl ErrorResponse {
    fn new(error: &str, message: &str) -> Self {
        Self {
            error: error.to_string(),
            message: message.to_string(),
            timestamp: chrono::Utc::now(),
        }
    }
}

/// Health check endpoint
async fn health() -> ActixResult<HttpResponse> {
    let response = serde_json::json!({
        "status": "healthy",
        "service": "intelligent-parameter-service",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    Ok(HttpResponse::Ok().json(response))
}

/// Get optimal parameters endpoint
async fn get_parameters(
    data: web::Data<AppState>,
    req: web::Json<ParameterRequest>,
) -> ActixResult<HttpResponse> {
    debug!("Received parameter request for model: {}", req.model);
    
    match data.service.get_optimal_parameters(req.into_inner()).await {
        Ok(parameters) => {
            debug!("Successfully generated optimal parameters");
            Ok(HttpResponse::Ok().json(parameters))
        }
        Err(e) => {
            error!("Failed to get optimal parameters: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ErrorResponse::new("optimization_failed", &format!("Failed to optimize parameters: {}", e))
            ))
        }
    }
}

/// Record feedback endpoint
async fn record_feedback(
    data: web::Data<AppState>,
    req: web::Json<PerformanceFeedback>,
) -> ActixResult<HttpResponse> {
    debug!("Recording performance feedback for task: {:?}", req.task_id);
    
    match data.service.record_feedback(req.into_inner()).await {
        Ok(_) => {
            debug!("Successfully recorded feedback");
            Ok(HttpResponse::Ok().json(serde_json::json!({
                "status": "success",
                "message": "Feedback recorded successfully",
                "timestamp": chrono::Utc::now().to_rfc3339()
            })))
        }
        Err(e) => {
            error!("Failed to record feedback: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ErrorResponse::new("feedback_failed", &format!("Failed to record feedback: {}", e))
            ))
        }
    }
}

/// Get analytics endpoint
async fn get_analytics(data: web::Data<AppState>) -> ActixResult<HttpResponse> {
    debug!("Getting performance analytics");
    
    let analytics = data.service.get_analytics().await;
    Ok(HttpResponse::Ok().json(analytics))
}

/// Start HTTP server
pub async fn start_server(server_config: ServerConfig, service_config: ServiceConfig) -> std::io::Result<()> {
    info!("Starting Intelligent Parameter Service HTTP server on {}:{}", server_config.host, server_config.port);
    
    // Initialize the service
    let service = match IntelligentParameterService::new(service_config).await {
        Ok(service) => Arc::new(service),
        Err(e) => {
            error!("Failed to initialize intelligent parameter service: {}", e);
            std::process::exit(1);
        }
    };
    
    let app_state = AppState { service };
    
    HttpServer::new(move || {
        let mut app = App::new()
            .app_data(web::Data::new(app_state.clone()))
            .wrap(Logger::default());
        
        let app = app.wrap(
            if server_config.enable_cors {
                Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
                    .max_age(3600)
            } else {
                Cors::default()
                    .allowed_origin("http://localhost")
            }
        );
        
        app.service(
            web::scope("/api/v1")
                .route("/health", web::get().to(health))
                .route("/parameters", web::post().to(get_parameters))
                .route("/feedback", web::post().to(record_feedback))
                .route("/analytics", web::get().to(get_analytics))
        )
    })
    .bind(format!("{}:{}", server_config.host, server_config.port))?
    .workers(server_config.workers)
    .run()
    .await
}
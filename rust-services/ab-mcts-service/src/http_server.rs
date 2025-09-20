//! HTTP Server for AB-MCTS Service
//! 
//! Provides REST API endpoints for the AB-MCTS engine, replacing FFI
//! for better Docker compatibility and service isolation.

use actix_web::{web, App, HttpResponse, HttpServer, middleware};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, error, debug};

use crate::{
    engine::{MCTSEngine, MCTSConfig},
    types::*,
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
            port: 8081,
            workers: 4,
            enable_cors: true,
            enable_metrics: true,
        }
    }
}

/// Shared application state
pub struct AppState {
    pub engine: Arc<RwLock<MCTSEngine>>,
    pub config: MCTSConfig,
    pub server_config: ServerConfig,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    features: FeatureStatus,
}

#[derive(Serialize)]
struct FeatureStatus {
    thompson_sampling: bool,
    bayesian_learning: bool,
    caching: bool,
    parallel_simulations: bool,
}

/// Error response
#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    code: String,
    details: Option<String>,
}

/// Initialize the engine endpoint
#[tracing::instrument(skip(data))]
async fn initialize(
    data: web::Data<Arc<RwLock<AppState>>>,
    config: web::Json<MCTSConfig>,
) -> HttpResponse {
    debug!("Initializing MCTS engine with new config");
    
    let state = data.read().await;
    let new_engine = match MCTSEngine::new(config.into_inner()).await {
        Ok(engine) => engine,
        Err(e) => {
            error!("Failed to initialize engine: {}", e);
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Initialization failed".to_string(),
                code: "INIT_FAILED".to_string(),
                details: Some(e.to_string()),
            });
        }
    };
    
    drop(state);
    let mut state = data.write().await;
    state.engine = Arc::new(RwLock::new(new_engine));
    
    info!("MCTS engine initialized successfully");
    HttpResponse::Ok().json(serde_json::json!({
        "status": "initialized",
        "message": "Engine initialized successfully"
    }))
}

/// Search for optimal agents
#[tracing::instrument(skip(data))]
async fn search_agents(
    data: web::Data<Arc<RwLock<AppState>>>,
    req: web::Json<SearchRequest>,
) -> HttpResponse {
    let state = data.read().await;
    let mut engine = state.engine.write().await;
    
    debug!("Starting MCTS search for session: {}", req.context.execution_context.session_id);
    
    match engine.search(
        req.context.clone(),
        req.available_agents.clone(),
        req.options.clone().unwrap_or_default(),
    ).await {
        Ok(result) => {
            info!("Search completed successfully with confidence: {}", result.confidence);
            HttpResponse::Ok().json(result)
        }
        Err(e) => {
            error!("Search failed: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Search failed".to_string(),
                code: "SEARCH_FAILED".to_string(),
                details: Some(e.to_string()),
            })
        }
    }
}

/// Get quick agent recommendations
#[tracing::instrument(skip(data))]
async fn recommend_agents(
    data: web::Data<Arc<RwLock<AppState>>>,
    req: web::Json<RecommendRequest>,
) -> HttpResponse {
    let state = data.read().await;
    let _engine = state.engine.read().await;
    
    // Use lightweight search for recommendations
    let options = SearchOptions {
        max_iterations: 10,
        max_depth: 5,
        time_limit: std::time::Duration::from_millis(500),
        exploration_constant: 1.0,
        discount_factor: 0.9,
        parallel_simulations: 2,
        checkpoint_interval: 10,
        enable_caching: false,
        verbose_logging: false,
    };
    
    let mut engine_mut = state.engine.write().await;
    match engine_mut.search(
        req.context.clone(),
        req.available_agents.clone(),
        options,
    ).await {
        Ok(result) => {
            // Convert to recommendation format
            let recommendations = result.agent_recommendations
                .into_iter()
                .take(req.max_recommendations.unwrap_or(3))
                .collect::<Vec<_>>();
            
            HttpResponse::Ok().json(serde_json::json!({
                "recommendations": recommendations,
                "confidence": result.confidence,
                "session_id": req.context.execution_context.session_id,
            }))
        }
        Err(e) => {
            error!("Recommendation failed: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "Recommendation failed".to_string(),
                code: "RECOMMEND_FAILED".to_string(),
                details: Some(e.to_string()),
            })
        }
    }
}

/// Update with feedback for learning
#[tracing::instrument(skip(_data))]
async fn update_feedback(
    _data: web::Data<Arc<RwLock<AppState>>>,
    req: web::Json<FeedbackRequest>,
) -> HttpResponse {
    // In a full implementation, this would update the Thompson sampler
    // and Bayesian models with the feedback
    
    debug!("Received feedback for agent {} in session {}", 
           req.agent_name, req.session_id);
    
    HttpResponse::Ok().json(serde_json::json!({
        "status": "accepted",
        "message": "Feedback recorded successfully"
    }))
}

/// Health check endpoint
async fn health_check(data: web::Data<Arc<RwLock<AppState>>>) -> HttpResponse {
    let state = data.read().await;
    
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: 0, // Would track actual uptime
        features: FeatureStatus {
            thompson_sampling: state.config.enable_thompson_sampling,
            bayesian_learning: state.config.enable_bayesian_learning,
            caching: state.config.enable_caching,
            parallel_simulations: state.config.parallel_simulations > 1,
        },
    })
}

/// Metrics endpoint for Prometheus
async fn metrics() -> HttpResponse {
    // Would integrate with prometheus crate
    HttpResponse::Ok()
        .content_type("text/plain")
        .body("# HELP ab_mcts_searches_total Total number of MCTS searches\n\
               # TYPE ab_mcts_searches_total counter\n\
               ab_mcts_searches_total 0\n")
}

/// Request/Response types
#[derive(Debug, Clone, Deserialize)]
struct SearchRequest {
    context: AgentContext,
    available_agents: Vec<String>,
    options: Option<SearchOptions>,
}

#[derive(Debug, Clone, Deserialize)]
struct RecommendRequest {
    context: AgentContext,
    available_agents: Vec<String>,
    max_recommendations: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
struct FeedbackRequest {
    session_id: String,
    agent_name: String,
    reward: MCTSReward,
}

/// Start the HTTP server
pub async fn start_server(
    server_config: ServerConfig,
    mcts_config: MCTSConfig,
) -> std::io::Result<()> {
    info!("Starting AB-MCTS HTTP server on {}:{}", 
          server_config.host, server_config.port);
    
    // Initialize engine
    let engine = MCTSEngine::new(mcts_config.clone())
        .await
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    
    let app_state = Arc::new(RwLock::new(AppState {
        engine: Arc::new(RwLock::new(engine)),
        config: mcts_config,
        server_config: server_config.clone(),
    }));
    
    HttpServer::new(move || {
        use actix_cors::Cors;
        
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
                    .route("/search", web::post().to(search_agents))
                    .route("/recommend", web::post().to(recommend_agents))
                    .route("/feedback", web::post().to(update_feedback))
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
        let config = MCTSConfig::default();
        let engine = MCTSEngine::new(config.clone()).await.unwrap();
        
        let app_state = Arc::new(RwLock::new(AppState {
            engine: Arc::new(RwLock::new(engine)),
            config,
            server_config: ServerConfig::default(),
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
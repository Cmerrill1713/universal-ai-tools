//! HTTP Server binary for Intelligent Parameter Service
//! 
//! Run with: cargo run --bin http_server

use intelligent_parameter_service::{
    http_server::{start_server, ServerConfig},
    ServiceConfig,
};
use std::env;
use tracing_subscriber;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("intelligent_parameter_service=debug".parse().unwrap())
                .add_directive("actix_web=info".parse().unwrap())
        )
        .init();
    
    // Load server configuration from environment
    let server_config = ServerConfig {
        host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
        port: env::var("PORT")
            .unwrap_or_else(|_| "8083".to_string())
            .parse()
            .unwrap_or(8083),
        workers: env::var("WORKERS")
            .unwrap_or_else(|_| "4".to_string())
            .parse()
            .unwrap_or(4),
        enable_cors: env::var("ENABLE_CORS")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true),
        enable_metrics: env::var("ENABLE_METRICS")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true),
    };
    
    // Load service configuration from environment
    let service_config = ServiceConfig {
        enable_ml_optimization: env::var("ENABLE_ML_OPTIMIZATION")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true),
        learning_rate: env::var("LEARNING_RATE")
            .unwrap_or_else(|_| "0.01".to_string())
            .parse()
            .unwrap_or(0.01),
        exploration_rate: env::var("EXPLORATION_RATE")
            .unwrap_or_else(|_| "0.1".to_string())
            .parse()
            .unwrap_or(0.1),
        cache_ttl_seconds: env::var("CACHE_TTL_SECONDS")
            .unwrap_or_else(|_| "3600".to_string())
            .parse()
            .unwrap_or(3600),
        max_history_size: env::var("MAX_HISTORY_SIZE")
            .unwrap_or_else(|_| "10000".to_string())
            .parse()
            .unwrap_or(10000),
        enable_reinforcement_learning: env::var("ENABLE_REINFORCEMENT_LEARNING")
            .unwrap_or_else(|_| "false".to_string())
            .parse()
            .unwrap_or(false),
        redis_url: env::var("REDIS_URL").ok(),
    };
    
    println!("🚀 Starting Intelligent Parameter HTTP Server");
    println!("📍 Listening on http://{}:{}", server_config.host, server_config.port);
    println!("🔧 Workers: {}", server_config.workers);
    println!("🎯 CORS: {}", if server_config.enable_cors { "enabled" } else { "disabled" });
    println!("📊 Metrics: {}", if server_config.enable_metrics { "enabled" } else { "disabled" });
    println!("🧠 ML Optimization: {}", if service_config.enable_ml_optimization { "enabled" } else { "disabled" });
    println!("📈 Learning Rate: {}", service_config.learning_rate);
    println!("🔍 Exploration Rate: {}", service_config.exploration_rate);
    
    start_server(server_config, service_config).await
}
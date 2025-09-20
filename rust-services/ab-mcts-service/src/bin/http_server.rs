//! HTTP Server binary for AB-MCTS Service
//! 
//! Run with: cargo run --bin http-server

use ab_mcts_service::{
    http_server::{start_server, ServerConfig},
    engine::MCTSConfig,
};
use std::env;
use tracing_subscriber;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("ab_mcts_service=debug".parse().unwrap())
                .add_directive("actix_web=info".parse().unwrap())
        )
        .init();
    
    // Load configuration from environment
    let server_config = ServerConfig {
        host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
        port: env::var("PORT")
            .unwrap_or_else(|_| "8081".to_string())
            .parse()
            .unwrap_or(8081),
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
    
    // MCTS configuration
    let mcts_config = MCTSConfig {
        max_iterations: env::var("MAX_ITERATIONS")
            .unwrap_or_else(|_| "1000".to_string())
            .parse()
            .unwrap_or(1000),
        enable_thompson_sampling: true,
        enable_bayesian_learning: true,
        enable_caching: env::var("REDIS_URL").is_ok(),
        ..Default::default()
    };
    
    println!("🚀 Starting AB-MCTS HTTP Server");
    println!("📍 Listening on http://{}:{}", server_config.host, server_config.port);
    println!("🔧 Workers: {}", server_config.workers);
    println!("🎯 CORS: {}", if server_config.enable_cors { "enabled" } else { "disabled" });
    println!("📊 Metrics: {}", if server_config.enable_metrics { "enabled" } else { "disabled" });
    
    start_server(server_config, mcts_config).await
}
//! HTTP Server binary for ReVeal Evolution Service
//! 
//! Run with: cargo run --bin http_server

use reveal_evolution_service::{
    http_server::{start_server, ServerConfig},
    RevealConfig,
    init,
};
use std::env;
use tracing_subscriber;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("reveal_evolution_service=debug".parse().unwrap())
                .add_directive("actix_web=info".parse().unwrap())
        )
        .init();
    
    // Initialize the service
    if let Err(e) = init().await {
        eprintln!("Failed to initialize ReVeal Evolution service: {}", e);
        std::process::exit(1);
    }
    
    // Load configuration from environment
    let server_config = ServerConfig {
        host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
        port: env::var("PORT")
            .unwrap_or_else(|_| "8082".to_string())
            .parse()
            .unwrap_or(8082),
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
    
    // ReVeal Evolution configuration
    let reveal_config = RevealConfig {
        max_turns: env::var("MAX_TURNS")
            .unwrap_or_else(|_| "6".to_string())
            .parse()
            .unwrap_or(6),
        min_confidence: env::var("MIN_CONFIDENCE")
            .unwrap_or_else(|_| "0.8".to_string())
            .parse()
            .unwrap_or(0.8),
        parallel_verification: env::var("ENABLE_PARALLEL_VERIFICATION")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true),
        enable_mcts_exploration: true,
        enable_caching: env::var("REDIS_URL").is_ok(),
        redis_url: env::var("REDIS_URL").ok(),
        ..Default::default()
    };
    
    println!("🚀 Starting ReVeal Evolution HTTP Server");
    println!("📍 Listening on http://{}:{}", server_config.host, server_config.port);
    println!("🔧 Workers: {}", server_config.workers);
    println!("🎯 CORS: {}", if server_config.enable_cors { "enabled" } else { "disabled" });
    println!("📊 Metrics: {}", if server_config.enable_metrics { "enabled" } else { "disabled" });
    println!("🧬 Max Evolution Turns: {}", reveal_config.max_turns);
    println!("🎯 Min Confidence: {}", reveal_config.min_confidence);
    
    start_server(server_config, reveal_config).await
}
use axum::{routing::get, Router};
use std::sync::Arc;
use tokio::net::TcpListener;
use tracing::{info, error};
use tower_http::cors::CorsLayer;

mod config;
mod scanner;
mod github_monitor;
mod dependency_analyzer;
mod technology_evaluator;
mod metrics;

use config::Config;
use scanner::TechScanner;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    info!("🔍 Starting Universal AI Tools Technology Scanner");

    // Load configuration
    let config = Config::load()?;
    info!("📋 Configuration loaded successfully");

    // Initialize tech scanner
    let scanner = Arc::new(TechScanner::new(config.clone()).await?);
    info!("🤖 Technology scanner initialized");

    // Start background scanning tasks
    let scanner_clone = Arc::clone(&scanner);
    tokio::spawn(async move {
        if let Err(e) = scanner_clone.start_scanning().await {
            error!("Scanner task failed: {}", e);
        }
    });

    // Setup HTTP server
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/api/scan/status", get(scan_status))
        .route("/api/scan/results", get(scan_results))
        .route("/api/scan/trigger", get(trigger_scan))
        .with_state(Arc::clone(&scanner))
        .layer(CorsLayer::permissive());

    let listener = TcpListener::bind(&config.server.address).await?;
    info!("🌐 Technology Scanner listening on {}", config.server.address);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "Technology Scanner is healthy"
}

async fn scan_status(axum::extract::State(scanner): axum::extract::State<Arc<TechScanner>>) -> String {
    match scanner.get_status().await {
        Ok(status) => serde_json::to_string_pretty(&status).unwrap_or_else(|_| "Error serializing status".to_string()),
        Err(e) => format!("Error getting status: {}", e),
    }
}

async fn scan_results(axum::extract::State(scanner): axum::extract::State<Arc<TechScanner>>) -> String {
    match scanner.get_latest_results().await {
        Ok(results) => serde_json::to_string_pretty(&results).unwrap_or_else(|_| "Error serializing results".to_string()),
        Err(e) => format!("Error getting results: {}", e),
    }
}

async fn trigger_scan(axum::extract::State(scanner): axum::extract::State<Arc<TechScanner>>) -> String {
    match scanner.trigger_manual_scan().await {
        Ok(_) => "Manual scan triggered successfully".to_string(),
        Err(e) => format!("Error triggering scan: {}", e),
    }
}
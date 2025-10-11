use rlvr_service::http_server::start_http_server;
use anyhow::Result;
use std::env;
use tracing::{info, error};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Get port from environment or use default
    let port = env::var("RLVR_PORT")
        .unwrap_or_else(|_| "3035".to_string())
        .parse::<u16>()
        .unwrap_or(3035);

    info!("🚀 Starting RLVR HTTP Server...");
    info!("📋 Configuration:");
    info!("  Port: {}", port);
    info!("  Environment: {}", env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()));

    // Start the HTTP server
    match start_http_server(port).await {
        Ok(_) => {
            info!("🏁 RLVR HTTP server stopped gracefully");
        }
        Err(e) => {
            error!("❌ RLVR HTTP server failed: {}", e);
            return Err(e);
        }
    }

    Ok(())
}

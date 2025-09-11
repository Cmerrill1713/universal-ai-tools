use std::net::SocketAddr;
use tokio::net::TcpListener;
use tokio::io::AsyncWriteExt;
use tokio::signal;
use tracing::{info, error};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Parameter Analytics Service");

    // Create a simple TCP listener for health checks
    let addr = SocketAddr::from(([127, 0, 0, 1], 3032));
    let listener = TcpListener::bind(addr).await?;

    info!("Parameter Analytics Service listening on {}", addr);

    // Simple HTTP health check server
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((mut socket, addr)) => {
                    info!("New connection from {}", addr);

                    // Simple HTTP response for health checks
                    let response = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 63\r\n\r\n{\"status\":\"healthy\",\"service\":\"parameter-analytics\",\"port\":3032}";

                    if let Err(e) = socket.write_all(response).await {
                        error!("Failed to write response: {}", e);
                    }
                }
                Err(e) => {
                    error!("Accept error: {}", e);
                }
            }
        }
    });

    // Wait for shutdown signal
    match signal::ctrl_c().await {
        Ok(()) => {
            info!("Shutdown signal received, stopping Parameter Analytics Service");
        }
        Err(err) => {
            error!("Unable to listen for shutdown signal: {}", err);
        }
    }

    Ok(())
}

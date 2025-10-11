//! Test runner for the Agent-Integrated Unlimited Context System

use intelligent_librarian::tests::*;
use tracing::{info, error};
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    info!("🚀 Starting Agent-Integrated Unlimited Context System Tests");
    info!("================================================================");

    // Run integration tests
    match test_librarian_integration().await {
        Ok(_) => {
            info!("✅ Integration tests completed successfully!");
        }
        Err(e) => {
            error!("❌ Integration tests failed: {}", e);
            return Err(e.into());
        }
    }

    info!("");
    info!("🚀 Starting Performance Tests");
    info!("=============================");

    // Run performance tests
    match test_performance().await {
        Ok(_) => {
            info!("✅ Performance tests completed successfully!");
        }
        Err(e) => {
            error!("❌ Performance tests failed: {}", e);
            return Err(e.into());
        }
    }

    info!("");
    info!("🎉 All tests completed successfully!");
    info!("The Agent-Integrated Unlimited Context System is working correctly!");

    Ok(())
}

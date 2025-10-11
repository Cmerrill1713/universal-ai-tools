use rlvr_service::minimal_server::*;
use rlvr_service::models::*;
use anyhow::Result;
use std::env;
use tracing::{info, error};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("Starting Minimal RLVR Service...");

    // Get configuration from environment
    let llm_endpoint = env::var("LLM_ENDPOINT")
        .unwrap_or_else(|_| "http://localhost:3033".to_string());

    info!("Configuration:");
    info!("  LLM Endpoint: {}", llm_endpoint);

    // Create minimal RLVR service
    let service = create_minimal_rlvr_service(llm_endpoint).await?;

    // Example: Run a simple training task
    let request = RLVRRequest {
        task_id: "example_task".to_string(),
        prompt: "Write a simple hello world function in Python".to_string(),
        context: Some("Should be a basic function that prints hello world".to_string()),
        max_iterations: Some(5),
        min_confidence: Some(0.8),
    };

    info!("Running example RLVR training...");
    match run_rlvr_training(&service, request).await {
        Ok(response) => {
            info!("Training completed successfully!");
            info!("Session ID: {}", response.session_id);
            info!("Final confidence: {:.3}", response.confidence);
            info!("Iterations: {}", response.iterations);
            info!("Final solution: {}", response.final_solution);
        }
        Err(e) => {
            error!("Training failed: {}", e);
        }
    }

    // Get training stats
    match get_training_stats(&service).await {
        Ok(stats) => {
            info!("Training stats:");
            info!("  Total experiences: {}", stats.total_experiences);
            info!("  Buffer utilization: {:.2}%", stats.buffer_utilization * 100.0);
            info!("  Verifier accuracy: {:.3}", stats.verifier_accuracy);
            info!("  Policy entropy: {:.3}", stats.policy_entropy);
            info!("  Ready for training: {}", stats.ready_for_training);
        }
        Err(e) => {
            error!("Failed to get training stats: {}", e);
        }
    }

    info!("Minimal RLVR Service completed");
    Ok(())
}

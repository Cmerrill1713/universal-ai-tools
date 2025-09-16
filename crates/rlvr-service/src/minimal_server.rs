use crate::models::*;
use crate::trainer::{RLVRTrainer, TrainingConfig, TrainingStats};
use crate::verifier::DefaultVerifier;
use crate::generator::DefaultGenerator;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

/// Minimal RLVR service state
pub struct MinimalRLVRService {
    pub trainer: Arc<RwLock<RLVRTrainer>>,
}

/// Initialize minimal RLVR service
pub async fn create_minimal_rlvr_service(llm_endpoint: String) -> Result<MinimalRLVRService> {
    info!("Initializing minimal RLVR service with LLM endpoint: {}", llm_endpoint);

    // Create generator and verifier
    let generator = Box::new(DefaultGenerator::new(llm_endpoint.clone()));
    let verifier = Box::new(DefaultVerifier::new(llm_endpoint));

    // Create trainer with default config
    let trainer = RLVRTrainer::new(generator, verifier, TrainingConfig::default());

    let service = MinimalRLVRService {
        trainer: Arc::new(RwLock::new(trainer)),
    };

    info!("Minimal RLVR service initialized successfully");
    Ok(service)
}

/// Run RLVR training directly (without HTTP server)
pub async fn run_rlvr_training(
    service: &MinimalRLVRService,
    request: RLVRRequest,
) -> Result<RLVRResponse> {
    info!("Running RLVR training for task: {}", request.task_id);

    let trainer = service.trainer.read().await;
    let response = trainer.train_rlvr(request).await?;

    info!("RLVR training completed for session: {}", response.session_id);
    Ok(response)
}

/// Get training statistics
pub async fn get_training_stats(service: &MinimalRLVRService) -> Result<TrainingStats> {
    let trainer = service.trainer.read().await;
    trainer.get_training_stats().await
}

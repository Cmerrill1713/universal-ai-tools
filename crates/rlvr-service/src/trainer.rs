use crate::models::*;
use crate::verifier::VerifierModel;
use crate::generator::GeneratorModel;
use anyhow::Result;
use std::sync::Arc;
use parking_lot::RwLock;
use chrono::Utc;
use serde::{Serialize, Deserialize};

/// RLVR training engine that orchestrates the reinforcement learning loop
pub struct RLVRTrainer {
    generator: Arc<RwLock<Box<dyn GeneratorModel>>>,
    verifier: Arc<RwLock<Box<dyn VerifierModel>>>,
    experience_buffer: Arc<RwLock<ExperienceBuffer>>,
    training_config: TrainingConfig,
}

#[derive(Debug, Clone)]
pub struct TrainingConfig {
    pub max_iterations: usize,
    pub min_confidence: f64,
    pub batch_size: usize,
    pub learning_rate: f64,
    pub entropy_coefficient: f64,
    pub value_coefficient: f64,
    pub policy_coefficient: f64,
    pub experience_buffer_size: usize,
    pub min_experiences_for_training: usize,
    pub convergence_threshold: f64,
}

impl Default for TrainingConfig {
    fn default() -> Self {
        Self {
            max_iterations: 10,
            min_confidence: 0.8,
            batch_size: 32,
            learning_rate: 0.001,
            entropy_coefficient: 0.01,
            value_coefficient: 0.5,
            policy_coefficient: 1.0,
            experience_buffer_size: 1000,
            min_experiences_for_training: 50,
            convergence_threshold: 0.01,
        }
    }
}

impl RLVRTrainer {
    pub fn new(
        generator: Box<dyn GeneratorModel>,
        verifier: Box<dyn VerifierModel>,
        config: TrainingConfig,
    ) -> Self {
        Self {
            generator: Arc::new(RwLock::new(generator)),
            verifier: Arc::new(RwLock::new(verifier)),
            experience_buffer: Arc::new(RwLock::new(ExperienceBuffer::new(config.experience_buffer_size))),
            training_config: config,
        }
    }

    /// Main RLVR training loop
    pub async fn train_rlvr(&self, request: RLVRRequest) -> Result<RLVRResponse> {
        let session_id = uuid::Uuid::new_v4();
        let mut training_data = Vec::new();
        let mut current_solution = String::new();
        let mut total_reward = 0.0;
        let improvement_rate = 0.0;
        let mut convergence_iteration = None;

        tracing::info!("Starting RLVR training session: {}", session_id);

        for iteration in 1..=self.training_config.max_iterations {
            tracing::debug!("RLVR iteration {} for session {}", iteration, session_id);

            // Generate solution using current policy
            let feedback_context = if iteration > 1 {
                training_data.last().map(|ex: &TrainingExample| ex.verifier_feedback.detailed_feedback.as_str())
            } else {
                None
            };

            let generator_output = {
                let generator = self.generator.read();
                generator.generate(&request.prompt, request.context.as_deref(), feedback_context).await?
            };

            current_solution = generator_output.text.clone();

            // Verify the generated solution
            let verifier_feedback = {
                let verifier = self.verifier.read();
                verifier.verify(&current_solution, &request.prompt, request.context.as_deref()).await?
            };

            // Calculate reward based on verifier feedback
            let reward = self.calculate_reward(&verifier_feedback, iteration);

            // Create training example
            let training_example = TrainingExample {
                iteration,
                prompt: request.prompt.clone(),
                generated_output: current_solution.clone(),
                verifier_feedback: verifier_feedback.clone(),
                reward,
                timestamp: Utc::now(),
            };

            training_data.push(training_example.clone());

            // Add to experience buffer
            {
                let mut buffer = self.experience_buffer.write();
                buffer.add_experience(training_example);
            }

            total_reward += reward;

            tracing::info!(
                "Iteration {}: confidence={:.3}, reward={:.3}, solution_length={}",
                iteration,
                verifier_feedback.confidence,
                reward,
                current_solution.len()
            );

            // Check for convergence
            if iteration > 1 {
                let prev_reward = training_data[iteration - 2].reward;
                let improvement = reward - prev_reward;

                if improvement.abs() < self.training_config.convergence_threshold {
                    convergence_iteration = Some(iteration);
                    tracing::info!("Converged at iteration {}", iteration);
                    break;
                }
            }

            // Check if we've reached minimum confidence
            if verifier_feedback.confidence >= self.training_config.min_confidence {
                tracing::info!("Reached target confidence at iteration {}", iteration);
                break;
            }

            // Update models if we have enough experience
            if iteration % 5 == 0 {
                self.update_models().await?;
            }
        }

        // Final model update
        self.update_models().await?;

        // Calculate final metrics
        let average_reward = total_reward / training_data.len() as f64;
        let verifier_accuracy = self.get_verifier_accuracy().await?;
        let policy_entropy = self.get_policy_entropy().await?;
        let final_confidence = training_data.last().map(|ex| ex.verifier_feedback.confidence).unwrap_or(0.0);

        let metrics = RLVRMetrics {
            total_reward,
            average_reward,
            improvement_rate,
            convergence_iteration,
            verifier_accuracy,
            training_loss: 0.0, // Would calculate from actual training
            policy_entropy,
        };

        tracing::info!(
            "RLVR training completed: session={}, iterations={}, final_confidence={:.3}, avg_reward={:.3}",
            session_id,
            training_data.len(),
            final_confidence,
            average_reward
        );

        Ok(RLVRResponse {
            session_id,
            final_solution: current_solution,
            confidence: final_confidence,
            iterations: training_data.len(),
            training_data,
            metrics,
        })
    }

    /// Calculate reward based on verifier feedback
    fn calculate_reward(&self, feedback: &VerifierFeedback, iteration: usize) -> f64 {
        let mut reward = feedback.confidence;

        // Bonus for correctness
        reward += feedback.correctness_score * 0.3;

        // Bonus for quality
        reward += feedback.quality_score * 0.2;

        // Penalty for errors
        reward -= feedback.error_types.len() as f64 * 0.1;

        // Bonus for improvement over iterations
        if iteration > 1 {
            reward += 0.1;
        }

        // Ensure reward is in reasonable range
        reward.max(0.0).min(2.0)
    }

    /// Update both generator and verifier models
    async fn update_models(&self) -> Result<()> {
        // Check if we have enough experience for training
        let buffer = self.experience_buffer.read();
        if !buffer.is_ready_for_training(self.training_config.min_experiences_for_training) {
            return Ok(());
        }

        // Sample batch for training
        let batch = buffer.sample_batch(self.training_config.batch_size);
        drop(buffer);

        // Update generator policy
        {
            let mut generator = self.generator.write();
            generator.update_policy(&batch).await?;
        }

        // Update verifier model
        {
            let mut verifier = self.verifier.write();
            verifier.update_from_feedback(&batch).await?;
        }

        tracing::debug!("Updated models with batch of {} experiences", batch.len());
        Ok(())
    }

    /// Get current verifier accuracy
    async fn get_verifier_accuracy(&self) -> Result<f64> {
        let verifier = self.verifier.read();
        verifier.get_accuracy().await
    }

    /// Get current policy entropy
    async fn get_policy_entropy(&self) -> Result<f64> {
        let generator = self.generator.read();
        generator.get_policy_entropy().await
    }

    /// Get training statistics
    pub async fn get_training_stats(&self) -> Result<TrainingStats> {
        let buffer = self.experience_buffer.read();
        let verifier_accuracy = self.get_verifier_accuracy().await?;
        let policy_entropy = self.get_policy_entropy().await?;

        Ok(TrainingStats {
            total_experiences: buffer.current_size,
            buffer_utilization: buffer.current_size as f64 / buffer.max_size as f64,
            verifier_accuracy,
            policy_entropy,
            ready_for_training: buffer.is_ready_for_training(self.training_config.min_experiences_for_training),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TrainingStats {
    pub total_experiences: usize,
    pub buffer_utilization: f64,
    pub verifier_accuracy: f64,
    pub policy_entropy: f64,
    pub ready_for_training: bool,
}

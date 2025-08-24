use crate::{config::Config, TrainingJob, TrainingConfig, TrainingStatus, TrainingMetrics};
use rand::Rng;
use anyhow::Result;
use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

pub struct TrainingCoordinator {
    config: Config,
    active_jobs: Arc<DashMap<String, TrainingJob>>,
    job_history: Arc<RwLock<Vec<TrainingJob>>>,
}

impl TrainingCoordinator {
    pub async fn new(config: &Config) -> Result<Self> {
        Ok(Self {
            config: config.clone(),
            active_jobs: Arc::new(DashMap::new()),
            job_history: Arc::new(RwLock::new(Vec::new())),
        })
    }

    pub async fn start_training(&mut self, config: TrainingConfig) -> Result<TrainingJob> {
        // Check if we've reached the maximum concurrent jobs
        if self.active_jobs.len() >= self.config.training.max_concurrent_jobs {
            return Err(anyhow::anyhow!("Maximum concurrent training jobs reached"));
        }

        let job_id = Uuid::new_v4().to_string();
        let model_id = Uuid::new_v4().to_string(); // For now, generate a new model ID
        let dataset_id = Uuid::new_v4().to_string(); // For now, generate a new dataset ID

        let mut job = TrainingJob {
            id: job_id.clone(),
            model_id,
            dataset_id,
            training_config: config,
            status: TrainingStatus::Queued,
            progress: 0.0,
            metrics: TrainingMetrics {
                loss: Vec::new(),
                accuracy: Vec::new(),
                validation_loss: Vec::new(),
                validation_accuracy: Vec::new(),
                learning_rate_history: Vec::new(),
                epoch_times: Vec::new(),
            },
            started_at: None,
            completed_at: None,
            created_at: chrono::Utc::now(),
        };

        info!("Created training job: {}", job_id);

        // Start the training process
        self.execute_training_job(&mut job).await?;
        
        // Store the job
        self.active_jobs.insert(job_id.clone(), job.clone());

        Ok(job)
    }

    async fn execute_training_job(&self, job: &mut TrainingJob) -> Result<()> {
        info!("Starting training execution for job: {}", job.id);
        
        job.status = TrainingStatus::Running;
        job.started_at = Some(chrono::Utc::now());

        // Clone necessary data for the background task
        let job_id = job.id.clone();
        let config = job.training_config.clone();
        let active_jobs = self.active_jobs.clone();
        let job_history = self.job_history.clone();

        // Spawn background training task
        tokio::spawn(async move {
            let result = Self::run_training_simulation(job_id.clone(), config, active_jobs.clone()).await;
            
            match result {
                Ok(_) => {
                    if let Some(mut job) = active_jobs.get_mut(&job_id) {
                        job.status = TrainingStatus::Completed;
                        job.completed_at = Some(chrono::Utc::now());
                        job.progress = 100.0;
                        info!("Training job {} completed successfully", job_id);
                    }
                }
                Err(e) => {
                    if let Some(mut job) = active_jobs.get_mut(&job_id) {
                        job.status = TrainingStatus::Failed;
                        job.completed_at = Some(chrono::Utc::now());
                        error!("Training job {} failed: {}", job_id, e);
                    }
                }
            }

            // Move completed job to history
            if let Some((_, job)) = active_jobs.remove(&job_id) {
                let mut history = job_history.write().await;
                history.push(job);
                
                // Keep history manageable
                if history.len() > 100 {
                    history.truncate(50);
                }
            }
        });

        Ok(())
    }

    async fn run_training_simulation(
        job_id: String,
        config: TrainingConfig,
        active_jobs: Arc<DashMap<String, TrainingJob>>,
    ) -> Result<()> {
        info!("Running training simulation for job: {}", job_id);
        
        let epochs = config.epochs;
        let batch_size = config.batch_size;
        
        // Simulate training process
        for epoch in 0..epochs {
            // Check if job was cancelled
            if let Some(job) = active_jobs.get(&job_id) {
                if job.status == TrainingStatus::Cancelled {
                    info!("Training job {} was cancelled", job_id);
                    return Ok(());
                }
            }

            // Simulate epoch training time (1-5 seconds per epoch)
            let epoch_duration = std::time::Duration::from_millis(
                1000 + (rand::thread_rng().gen::<u64>() % 4000)
            );
            tokio::time::sleep(epoch_duration).await;

            // Update job progress and metrics
            if let Some(mut job) = active_jobs.get_mut(&job_id) {
                let progress = (epoch + 1) as f64 / epochs as f64 * 100.0;
                job.progress = progress;

                // Simulate realistic loss curves
                let base_loss = 2.0;
                let loss = base_loss * (-0.1 * epoch as f64).exp() + 0.1 + (rand::thread_rng().gen::<f64>() - 0.5) * 0.1;
                job.metrics.loss.push(loss);

                let accuracy = 1.0 - loss / base_loss + (rand::thread_rng().gen::<f64>() - 0.5) * 0.05;
                job.metrics.accuracy.push(accuracy.max(0.0).min(1.0));

                // Validation metrics (slightly worse than training)
                let val_loss = loss * 1.1 + (rand::thread_rng().gen::<f64>() - 0.5) * 0.1;
                job.metrics.validation_loss.push(val_loss);

                let val_accuracy = accuracy * 0.95 + (rand::thread_rng().gen::<f64>() - 0.5) * 0.05;
                job.metrics.validation_accuracy.push(val_accuracy.max(0.0).min(1.0));

                // Learning rate (could decay over time)
                let lr = config.learning_rate * (0.95_f64).powi(epoch as i32);
                job.metrics.learning_rate_history.push(lr);

                job.metrics.epoch_times.push(epoch_duration.as_secs_f64());

                debug!("Epoch {}/{}: loss={:.4}, acc={:.4}, val_loss={:.4}, val_acc={:.4}", 
                       epoch + 1, epochs, loss, accuracy, val_loss, val_accuracy);
            }

            // Simulate early stopping
            if let Some(job) = active_jobs.get(&job_id) {
                if config.early_stopping && job.metrics.validation_loss.len() > 5 {
                    let recent_losses = &job.metrics.validation_loss[job.metrics.validation_loss.len()-5..];
                    let is_improving = recent_losses.windows(2).any(|w| w[1] < w[0]);
                    
                    if !is_improving {
                        info!("Early stopping triggered for job: {}", job_id);
                        break;
                    }
                }
            }

            // Simulate checkpointing
            if config.checkpoint_frequency > 0 && (epoch + 1) % config.checkpoint_frequency == 0 {
                Self::save_checkpoint(&job_id, epoch + 1).await?;
            }
        }

        info!("Training simulation completed for job: {}", job_id);
        Ok(())
    }

    async fn save_checkpoint(job_id: &str, epoch: u32) -> Result<()> {
        info!("Saving checkpoint for job {} at epoch {}", job_id, epoch);
        
        // In a real implementation, this would save model weights and optimizer state
        // For simulation, we'll just log it
        debug!("Checkpoint saved: job_{}_epoch_{}", job_id, epoch);
        
        Ok(())
    }

    pub async fn stop_training(&mut self, job_id: &str) -> Result<()> {
        if let Some(mut job) = self.active_jobs.get_mut(job_id) {
            match job.status {
                TrainingStatus::Running | TrainingStatus::Queued => {
                    job.status = TrainingStatus::Cancelled;
                    job.completed_at = Some(chrono::Utc::now());
                    info!("Training job {} cancelled", job_id);
                    Ok(())
                }
                _ => {
                    Err(anyhow::anyhow!("Cannot cancel job {} in status {:?}", job_id, job.status))
                }
            }
        } else {
            Err(anyhow::anyhow!("Training job {} not found", job_id))
        }
    }

    pub async fn pause_training(&mut self, job_id: &str) -> Result<()> {
        if let Some(mut job) = self.active_jobs.get_mut(job_id) {
            match job.status {
                TrainingStatus::Running => {
                    job.status = TrainingStatus::Paused;
                    info!("Training job {} paused", job_id);
                    Ok(())
                }
                _ => {
                    Err(anyhow::anyhow!("Cannot pause job {} in status {:?}", job_id, job.status))
                }
            }
        } else {
            Err(anyhow::anyhow!("Training job {} not found", job_id))
        }
    }

    pub async fn resume_training(&mut self, job_id: &str) -> Result<()> {
        if let Some(mut job) = self.active_jobs.get_mut(job_id) {
            match job.status {
                TrainingStatus::Paused => {
                    job.status = TrainingStatus::Running;
                    info!("Training job {} resumed", job_id);
                    Ok(())
                }
                _ => {
                    Err(anyhow::anyhow!("Cannot resume job {} in status {:?}", job_id, job.status))
                }
            }
        } else {
            Err(anyhow::anyhow!("Training job {} not found", job_id))
        }
    }

    pub async fn get_job(&self, job_id: &str) -> Result<Option<TrainingJob>> {
        // Check active jobs first
        if let Some(job) = self.active_jobs.get(job_id) {
            return Ok(Some(job.clone()));
        }

        // Check history
        let history = self.job_history.read().await;
        let job = history.iter().find(|j| j.id == job_id).cloned();
        Ok(job)
    }

    pub async fn list_jobs(&self) -> Result<Vec<TrainingJob>> {
        let mut jobs = Vec::new();

        // Add active jobs
        for entry in self.active_jobs.iter() {
            jobs.push(entry.value().clone());
        }

        // Add recent history
        let history = self.job_history.read().await;
        jobs.extend(history.iter().take(20).cloned());

        // Sort by creation time (newest first)
        jobs.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        Ok(jobs)
    }

    pub async fn get_job_metrics(&self, job_id: &str) -> Result<Option<TrainingMetrics>> {
        if let Some(job) = self.get_job(job_id).await? {
            Ok(Some(job.metrics))
        } else {
            Ok(None)
        }
    }

    pub async fn cleanup_completed_jobs(&mut self, max_age_hours: u64) -> Result<usize> {
        let cutoff = chrono::Utc::now() - chrono::Duration::hours(max_age_hours as i64);
        let mut removed_count = 0;

        // Clean up completed jobs from active jobs (they should have moved to history)
        let completed_jobs: Vec<String> = self.active_jobs.iter()
            .filter_map(|entry| {
                let job = entry.value();
                if matches!(job.status, TrainingStatus::Completed | TrainingStatus::Failed | TrainingStatus::Cancelled) {
                    if let Some(completed_at) = job.completed_at {
                        if completed_at < cutoff {
                            return Some(entry.key().clone());
                        }
                    }
                }
                None
            })
            .collect();

        for job_id in completed_jobs {
            if let Some((_, job)) = self.active_jobs.remove(&job_id) {
                // Move to history if not already there
                let mut history = self.job_history.write().await;
                history.push(job);
                removed_count += 1;
            }
        }

        // Clean up old history entries
        let mut history = self.job_history.write().await;
        let initial_len = history.len();
        history.retain(|job| {
            if let Some(completed_at) = job.completed_at {
                completed_at >= cutoff
            } else {
                job.created_at >= cutoff
            }
        });
        removed_count += initial_len - history.len();

        if removed_count > 0 {
            info!("Cleaned up {} old training jobs", removed_count);
        }

        Ok(removed_count)
    }

    pub async fn get_active_job_count(&self) -> usize {
        self.active_jobs.len()
    }

    pub async fn get_resource_usage(&self) -> Result<serde_json::Value> {
        let active_count = self.active_jobs.len();
        let max_jobs = self.config.training.max_concurrent_jobs;
        
        Ok(serde_json::json!({
            "active_jobs": active_count,
            "max_concurrent_jobs": max_jobs,
            "utilization_percent": (active_count as f64 / max_jobs as f64 * 100.0),
            "available_slots": max_jobs - active_count
        }))
    }
}
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use tracing::{info, debug, warn};
use std::collections::VecDeque;
use rand::seq::SliceRandom;

use crate::models::{TrainingExample, TrainingState, SearchRequest, SearchSession};
use crate::searcher::S3Searcher;
use crate::reward::GBRCalculator;
use crate::config::TrainingSettings;

/// PPO (Proximal Policy Optimization) trainer for the S3 searcher
pub struct PPOTrainer {
    searcher: S3Searcher,
    reward_calculator: GBRCalculator,
    settings: TrainingSettings,
    experience_buffer: ExperienceBuffer,
    training_state: TrainingState,
}

/// Experience replay buffer for PPO training
#[derive(Clone)]
struct ExperienceBuffer {
    states: VecDeque<SearchState>,
    actions: VecDeque<SearchAction>,
    rewards: VecDeque<f32>,
    next_states: VecDeque<SearchState>,
    max_size: usize,
}

/// State representation for the searcher
#[derive(Clone, Debug, Serialize, Deserialize)]
struct SearchState {
    question: String,
    current_documents: Vec<String>, // Document IDs
    turn_number: usize,
    previous_queries: Vec<String>,
}

/// Action taken by the searcher
#[derive(Clone, Debug, Serialize, Deserialize)]
enum SearchAction {
    GenerateQuery(String),
    SelectDocuments(Vec<usize>),
    StopSearch,
    ContinueSearch,
}

impl PPOTrainer {
    pub fn new(
        searcher: S3Searcher,
        reward_calculator: GBRCalculator,
        settings: TrainingSettings,
    ) -> Self {
        Self {
            searcher,
            reward_calculator,
            settings,
            experience_buffer: ExperienceBuffer::new(settings.dataset_size * 2),
            training_state: TrainingState {
                step: 0,
                total_reward: 0.0,
                average_gbr: 0.0,
                success_rate: 0.0,
                examples_seen: 0,
            },
        }
    }
    
    /// Main training loop
    pub async fn train(
        &mut self,
        training_examples: Vec<TrainingExample>,
        validation_examples: Vec<TrainingExample>,
    ) -> Result<()> {
        info!("Starting PPO training with {} examples", training_examples.len());
        
        let mut rng = rand::thread_rng();
        let mut best_gbr = -1.0;
        
        for epoch in 0..self.settings.ppo_epochs {
            info!("Starting epoch {}/{}", epoch + 1, self.settings.ppo_epochs);
            
            // Shuffle training examples
            let mut shuffled_examples = training_examples.clone();
            shuffled_examples.shuffle(&mut rng);
            
            // Process batches
            for batch in shuffled_examples.chunks(self.settings.batch_size) {
                self.process_batch(batch).await?;
                
                // Perform PPO update every batch
                if self.experience_buffer.len() >= self.settings.batch_size {
                    self.ppo_update().await?;
                }
                
                // Save checkpoint if needed
                if self.training_state.step % self.settings.save_every == 0 {
                    self.save_checkpoint().await?;
                }
            }
            
            // Validation
            let validation_gbr = self.validate(&validation_examples).await?;
            info!("Epoch {} validation GBR: {:.4}", epoch + 1, validation_gbr);
            
            // Save best model
            if validation_gbr > best_gbr {
                best_gbr = validation_gbr;
                self.save_best_model().await?;
                info!("New best model saved with GBR: {:.4}", best_gbr);
            }
            
            // Update training state
            self.training_state.average_gbr = validation_gbr;
        }
        
        info!("Training completed. Best GBR: {:.4}", best_gbr);
        Ok(())
    }
    
    /// Process a batch of training examples
    async fn process_batch(&mut self, examples: &[TrainingExample]) -> Result<()> {
        for example in examples {
            // Run searcher on the example
            let request = SearchRequest {
                question: example.question.clone(),
                user_id: None,
                use_cache: false,
                return_reasoning: true,
            };
            
            let session = self.searcher.search(request).await?;
            
            // Calculate reward using GBR
            let reward = self.reward_calculator
                .calculate_ppo_reward(&session, Some(&example.gold_answer))
                .await?;
            
            // Extract experiences from the session
            self.extract_experiences(&session, reward)?;
            
            // Update training state
            self.training_state.step += 1;
            self.training_state.total_reward += reward;
            self.training_state.examples_seen += 1;
            
            if self.training_state.step % 100 == 0 {
                let avg_reward = self.training_state.total_reward / self.training_state.examples_seen as f32;
                debug!("Step {}: Avg reward: {:.4}", self.training_state.step, avg_reward);
            }
        }
        
        Ok(())
    }
    
    /// Extract experiences from a search session for training
    fn extract_experiences(&mut self, session: &SearchSession, final_reward: f32) -> Result<()> {
        let mut cumulative_docs = Vec::new();
        
        for (i, turn) in session.turns.iter().enumerate() {
            // Create state representation
            let state = SearchState {
                question: session.original_question.clone(),
                current_documents: cumulative_docs.clone(),
                turn_number: i,
                previous_queries: session.turns[..i]
                    .iter()
                    .map(|t| t.query.clone())
                    .collect(),
            };
            
            // Determine action taken
            let action = if turn.should_continue {
                SearchAction::ContinueSearch
            } else {
                SearchAction::StopSearch
            };
            
            // Add selected documents to cumulative set
            for doc in &turn.selected_docs {
                cumulative_docs.push(doc.id.clone());
            }
            
            // Create next state
            let next_state = SearchState {
                question: session.original_question.clone(),
                current_documents: cumulative_docs.clone(),
                turn_number: i + 1,
                previous_queries: session.turns[..=i]
                    .iter()
                    .map(|t| t.query.clone())
                    .collect(),
            };
            
            // Calculate discounted reward
            let discount_factor = self.settings.gamma.powi((session.turns.len() - i - 1) as i32);
            let discounted_reward = final_reward * discount_factor;
            
            // Add to experience buffer
            self.experience_buffer.add(
                state,
                action,
                discounted_reward,
                next_state,
            );
        }
        
        Ok(())
    }
    
    /// Perform PPO update on the policy
    async fn ppo_update(&mut self) -> Result<()> {
        // Get batch from experience buffer
        let (states, actions, rewards, next_states) = self.experience_buffer.sample(self.settings.batch_size);
        
        // In a real implementation, this would:
        // 1. Calculate advantages using GAE
        // 2. Compute policy gradients
        // 3. Apply PPO clipping
        // 4. Update the searcher's policy network
        
        // For now, we'll simulate the update
        debug!("Performing PPO update with {} experiences", states.len());
        
        // Simulate parameter update effect
        self.training_state.success_rate = (self.training_state.success_rate * 0.95 + 0.05).min(1.0);
        
        Ok(())
    }
    
    /// Validate on held-out examples
    async fn validate(&self, examples: &[TrainingExample]) -> Result<f32> {
        let mut total_gbr = 0.0;
        let mut successful = 0;
        
        for example in examples.iter().take(10) { // Sample validation for speed
            let request = SearchRequest {
                question: example.question.clone(),
                user_id: None,
                use_cache: false,
                return_reasoning: false,
            };
            
            match self.searcher.search(request).await {
                Ok(session) => {
                    if let Ok(gbr_result) = self.reward_calculator
                        .calculate_gbr(&session, &example.gold_answer)
                        .await 
                    {
                        total_gbr += gbr_result.gbr_score;
                        successful += 1;
                    }
                },
                Err(e) => {
                    warn!("Validation search failed: {}", e);
                }
            }
        }
        
        if successful > 0 {
            Ok(total_gbr / successful as f32)
        } else {
            Ok(0.0)
        }
    }
    
    /// Save checkpoint
    async fn save_checkpoint(&self) -> Result<()> {
        let checkpoint_path = format!(
            "{}/checkpoint_step_{}.json",
            self.settings.checkpoint_dir,
            self.training_state.step
        );
        
        let checkpoint = Checkpoint {
            training_state: self.training_state.clone(),
            model_params: ModelParams::default(), // Would contain actual model parameters
        };
        
        let json = serde_json::to_string_pretty(&checkpoint)?;
        tokio::fs::write(&checkpoint_path, json).await?;
        
        info!("Checkpoint saved to {}", checkpoint_path);
        Ok(())
    }
    
    /// Save the best model
    async fn save_best_model(&self) -> Result<()> {
        let model_path = format!("{}/best_model.json", self.settings.checkpoint_dir);
        
        let checkpoint = Checkpoint {
            training_state: self.training_state.clone(),
            model_params: ModelParams::default(),
        };
        
        let json = serde_json::to_string_pretty(&checkpoint)?;
        tokio::fs::write(&model_path, json).await?;
        
        info!("Best model saved to {}", model_path);
        Ok(())
    }
    
    /// Load checkpoint
    pub async fn load_checkpoint(&mut self, path: &str) -> Result<()> {
        let json = tokio::fs::read_to_string(path).await?;
        let checkpoint: Checkpoint = serde_json::from_str(&json)?;
        
        self.training_state = checkpoint.training_state;
        // Would also restore model parameters
        
        info!("Checkpoint loaded from {}", path);
        Ok(())
    }
}

impl ExperienceBuffer {
    fn new(max_size: usize) -> Self {
        Self {
            states: VecDeque::with_capacity(max_size),
            actions: VecDeque::with_capacity(max_size),
            rewards: VecDeque::with_capacity(max_size),
            next_states: VecDeque::with_capacity(max_size),
            max_size,
        }
    }
    
    fn add(&mut self, state: SearchState, action: SearchAction, reward: f32, next_state: SearchState) {
        if self.states.len() >= self.max_size {
            self.states.pop_front();
            self.actions.pop_front();
            self.rewards.pop_front();
            self.next_states.pop_front();
        }
        
        self.states.push_back(state);
        self.actions.push_back(action);
        self.rewards.push_back(reward);
        self.next_states.push_back(next_state);
    }
    
    fn sample(&self, batch_size: usize) -> (Vec<SearchState>, Vec<SearchAction>, Vec<f32>, Vec<SearchState>) {
        let mut rng = rand::thread_rng();
        let indices: Vec<usize> = (0..self.states.len())
            .collect::<Vec<_>>()
            .choose_multiple(&mut rng, batch_size.min(self.states.len()))
            .cloned()
            .collect();
        
        let states: Vec<SearchState> = indices.iter()
            .map(|&i| self.states[i].clone())
            .collect();
        
        let actions: Vec<SearchAction> = indices.iter()
            .map(|&i| self.actions[i].clone())
            .collect();
        
        let rewards: Vec<f32> = indices.iter()
            .map(|&i| self.rewards[i])
            .collect();
        
        let next_states: Vec<SearchState> = indices.iter()
            .map(|&i| self.next_states[i].clone())
            .collect();
        
        (states, actions, rewards, next_states)
    }
    
    fn len(&self) -> usize {
        self.states.len()
    }
}

#[derive(Serialize, Deserialize)]
struct Checkpoint {
    training_state: TrainingState,
    model_params: ModelParams,
}

#[derive(Serialize, Deserialize, Default)]
struct ModelParams {
    // Would contain actual neural network parameters
    // For now, using placeholder
    weights: Vec<f32>,
    biases: Vec<f32>,
}

/// Dataset loader for training examples
pub struct DatasetLoader {
    pool: sqlx::PgPool,
}

impl DatasetLoader {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await?;
        
        Ok(Self { pool })
    }
    
    /// Load training examples from database
    pub async fn load_training_examples(&self, limit: usize) -> Result<Vec<TrainingExample>> {
        let sql = r#"
            SELECT 
                id,
                question,
                gold_answer,
                difficulty_score,
                dataset_source,
                created_at
            FROM training_examples
            WHERE dataset_source = 's3_training'
            ORDER BY created_at DESC
            LIMIT $1
        "#;
        
        let rows = sqlx::query(sql)
            .bind(limit as i32)
            .fetch_all(&self.pool)
            .await?;
        
        let mut examples = Vec::new();
        for row in rows {
            examples.push(TrainingExample {
                id: row.try_get("id")?,
                question: row.try_get("question")?,
                gold_answer: row.try_get("gold_answer")?,
                difficulty_score: row.try_get("difficulty_score")?,
                dataset_source: row.try_get("dataset_source")?,
                created_at: row.try_get("created_at")?,
            });
        }
        
        Ok(examples)
    }
    
    /// Create training examples from existing QA pairs
    pub async fn create_training_examples_from_qa(&self) -> Result<()> {
        // Would import from various QA datasets
        // For now, placeholder implementation
        info!("Creating training examples from QA datasets");
        Ok(())
    }
}
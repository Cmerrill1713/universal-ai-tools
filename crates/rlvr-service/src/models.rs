use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Core RLVR data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLVRRequest {
    pub task_id: String,
    pub prompt: String,
    pub context: Option<String>,
    pub max_iterations: Option<usize>,
    pub min_confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLVRResponse {
    pub session_id: Uuid,
    pub final_solution: String,
    pub confidence: f64,
    pub iterations: usize,
    pub training_data: Vec<TrainingExample>,
    pub metrics: RLVRMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingExample {
    pub iteration: usize,
    pub prompt: String,
    pub generated_output: String,
    pub verifier_feedback: VerifierFeedback,
    pub reward: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifierFeedback {
    pub confidence: f64,
    pub correctness_score: f64,
    pub quality_score: f64,
    pub detailed_feedback: String,
    pub error_types: Vec<String>,
    pub suggestions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratorOutput {
    pub text: String,
    pub confidence: f64,
    pub reasoning: Option<String>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLVRMetrics {
    pub total_reward: f64,
    pub average_reward: f64,
    pub improvement_rate: f64,
    pub convergence_iteration: Option<usize>,
    pub verifier_accuracy: f64,
    pub training_loss: f64,
    pub policy_entropy: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExperienceBuffer {
    pub experiences: Vec<TrainingExample>,
    pub max_size: usize,
    pub current_size: usize,
}

impl ExperienceBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            experiences: Vec::with_capacity(max_size),
            max_size,
            current_size: 0,
        }
    }

    pub fn add_experience(&mut self, experience: TrainingExample) {
        if self.current_size >= self.max_size {
            // Remove oldest experience (FIFO)
            self.experiences.remove(0);
        } else {
            self.current_size += 1;
        }
        self.experiences.push(experience);
    }

    pub fn sample_batch(&self, batch_size: usize) -> Vec<TrainingExample> {
        use rand::seq::SliceRandom;
        use rand::thread_rng;

        let mut rng = thread_rng();
        self.experiences
            .choose_multiple(&mut rng, batch_size.min(self.current_size))
            .cloned()
            .collect()
    }

    pub fn is_ready_for_training(&self, min_experiences: usize) -> bool {
        self.current_size >= min_experiences
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyState {
    pub parameters: Vec<f64>,
    pub learning_rate: f64,
    pub entropy_coefficient: f64,
    pub value_coefficient: f64,
    pub policy_coefficient: f64,
}

impl Default for PolicyState {
    fn default() -> Self {
        Self {
            parameters: vec![0.0; 100], // Default parameter size
            learning_rate: 0.001,
            entropy_coefficient: 0.01,
            value_coefficient: 0.5,
            policy_coefficient: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifierState {
    pub model_weights: Vec<f64>,
    pub accuracy_threshold: f64,
    pub confidence_threshold: f64,
    pub training_examples: usize,
    pub last_updated: DateTime<Utc>,
}

impl Default for VerifierState {
    fn default() -> Self {
        Self {
            model_weights: vec![0.0; 50], // Default verifier parameter size
            accuracy_threshold: 0.8,
            confidence_threshold: 0.7,
            training_examples: 0,
            last_updated: Utc::now(),
        }
    }
}

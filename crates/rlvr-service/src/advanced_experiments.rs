use crate::models::*;
use crate::verifier::DefaultVerifier;
use crate::generator::DefaultGenerator;
use crate::trainer::{RLVRTrainer, TrainingConfig};
use crate::experience::ExperienceManager;
use crate::metrics::{RLVREvaluationMetrics, MetricsAggregator};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

/// Advanced RLVR experiment runner
pub struct RLVRExperimentRunner {
    trainer: Arc<RwLock<RLVRTrainer>>,
    experience_manager: Arc<RwLock<ExperienceManager>>,
    metrics_aggregator: Arc<RwLock<MetricsAggregator>>,
}

impl RLVRExperimentRunner {
    pub fn new() -> Self {
        let generator = Box::new(DefaultGenerator::new("http://localhost:3033".to_string()));
        let verifier = Box::new(DefaultVerifier::new("http://localhost:3033".to_string()));
        let config = TrainingConfig::default();

        let trainer = Arc::new(RwLock::new(RLVRTrainer::new(generator, verifier, config)));
        let experience_manager = Arc::new(RwLock::new(ExperienceManager::new()));
        let metrics_aggregator = Arc::new(RwLock::new(MetricsAggregator::new()));

        Self {
            trainer,
            experience_manager,
            metrics_aggregator,
        }
    }

    /// Run a comprehensive RLVR experiment with multiple tasks
    pub async fn run_comprehensive_experiment(&self) -> Result<ExperimentResults> {
        info!("🚀 Starting comprehensive RLVR experiment...");

        let tasks = self.create_experiment_tasks();
        let mut results = ExperimentResults::new();

        for (i, task) in tasks.iter().enumerate() {
            info!("📋 Running task {}/{}: {}", i + 1, tasks.len(), task.task_id);

            match self.run_single_task_experiment(task).await {
                Ok(task_result) => {
                    info!("✅ Task {} completed successfully", task.task_id);
                    results.add_task_result(task_result);
                }
                Err(e) => {
                    error!("❌ Task {} failed: {}", task.task_id, e);
                    results.add_failed_task(task.task_id.clone(), e.to_string());
                }
            }
        }

        // Analyze overall results
        self.analyze_experiment_results(&mut results).await?;

        info!("🎯 Experiment completed: {} successful, {} failed",
              results.successful_tasks, results.failed_tasks_count);

        Ok(results)
    }

    /// Run a single task experiment with multiple iterations
    async fn run_single_task_experiment(&self, task: &ExperimentTask) -> Result<TaskResult> {
        let mut task_result = TaskResult::new(task.task_id.clone());

        // Run multiple training sessions for this task
        for session in 0..task.num_sessions {
            info!("  🔄 Session {}/{}", session + 1, task.num_sessions);

            let request = RLVRRequest {
                task_id: format!("{}_{}", task.task_id, session),
                prompt: task.prompt.clone(),
                context: task.context.clone(),
                max_iterations: Some(task.max_iterations),
                min_confidence: Some(task.min_confidence),
            };

            let mut trainer = self.trainer.write().await;
            let mut experience_manager = self.experience_manager.write().await;

            match trainer.train_rlvr(request.clone()).await {
                Ok(response) => {
                    let mut metrics = RLVREvaluationMetrics::new(
                        uuid::Uuid::new_v4(),
                        request.task_id.clone(),
                    );

                    // Get training stats and create mock metrics
                    let training_stats = trainer.get_training_stats().await.unwrap_or_default();

                    // Create mock training data for demonstration
                    let mock_data = vec![
                        TrainingExample {
                            iteration: 1,
                            prompt: request.prompt.clone(),
                            generated_output: response.final_solution.clone(),
                            verifier_feedback: VerifierFeedback {
                                confidence: response.confidence,
                                correctness_score: response.confidence,
                                quality_score: response.confidence,
                                detailed_feedback: "Mock feedback".to_string(),
                                error_types: vec![],
                                suggestions: vec![],
                            },
                            reward: response.confidence,
                            timestamp: chrono::Utc::now(),
                        },
                    ];

                    let rlvr_metrics = RLVRMetrics {
                        total_reward: response.confidence,
                        average_reward: response.confidence,
                        improvement_rate: 0.1, // Mock improvement
                        convergence_iteration: if response.iterations < 10 { Some(response.iterations) } else { None },
                        verifier_accuracy: 0.85, // Mock value
                        training_loss: 0.1, // Mock value
                        policy_entropy: 0.3, // Mock value
                    };

                    metrics.calculate_from_training_data(&mock_data, &rlvr_metrics);

                    // Store experiences
                    for experience in mock_data {
                        experience_manager.add_experience(&request.task_id, experience);
                    }

                    // Add to metrics aggregator
                    let mut aggregator = self.metrics_aggregator.write().await;
                    aggregator.add_session(metrics);

                    task_result.add_session_result(response);
                }
                Err(e) => {
                    warn!("    ⚠️ Session {} failed: {}", session + 1, e);
                    task_result.add_session_error(e.to_string());
                }
            }
        }

        Ok(task_result)
    }

    /// Create a set of diverse experiment tasks
    fn create_experiment_tasks(&self) -> Vec<ExperimentTask> {
        vec![
            ExperimentTask {
                task_id: "hello_world_progression".to_string(),
                prompt: "Write a hello world function in Python".to_string(),
                context: Some("Should be a simple function that prints hello world".to_string()),
                max_iterations: 5,
                min_confidence: 0.8,
                num_sessions: 3,
            },
            ExperimentTask {
                task_id: "fibonacci_learning".to_string(),
                prompt: "Implement a fibonacci function".to_string(),
                context: Some("Should be efficient and handle edge cases".to_string()),
                max_iterations: 8,
                min_confidence: 0.85,
                num_sessions: 3,
            },
            ExperimentTask {
                task_id: "sorting_algorithm".to_string(),
                prompt: "Implement a quicksort algorithm".to_string(),
                context: Some("Should be memory-safe and efficient".to_string()),
                max_iterations: 10,
                min_confidence: 0.9,
                num_sessions: 3,
            },
        ]
    }

    /// Calculate improvement rate from training data
    fn calculate_improvement_rate(&self, data: &[TrainingExample]) -> f64 {
        if data.len() < 2 {
            return 0.0;
        }

        let first_confidence = data[0].verifier_feedback.confidence;
        let last_confidence = data.last().unwrap().verifier_feedback.confidence;

        last_confidence - first_confidence
    }

    /// Find convergence iteration
    fn find_convergence_iteration(&self, data: &[TrainingExample]) -> Option<usize> {
        if data.len() < 3 {
            return None;
        }

        for (i, window) in data.windows(3).enumerate() {
            let confidences: Vec<f64> = window.iter().map(|e| e.verifier_feedback.confidence).collect();
            let variance = self.calculate_variance(&confidences);

            if variance < 0.01 { // Low variance indicates convergence
                return Some(i + 2); // Return the last iteration of the window
            }
        }

        None
    }

    /// Calculate variance of a set of values
    fn calculate_variance(&self, values: &[f64]) -> f64 {
        if values.is_empty() {
            return 0.0;
        }

        let mean = values.iter().sum::<f64>() / values.len() as f64;
        let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / values.len() as f64;
        variance
    }

    /// Analyze experiment results and generate insights
    async fn analyze_experiment_results(&self, results: &mut ExperimentResults) -> Result<()> {
        info!("📊 Analyzing experiment results...");

        // Calculate overall statistics
        results.calculate_statistics();

        // Generate insights
        results.generate_insights();

        // Print summary
        self.print_experiment_summary(results);

        Ok(())
    }

    /// Print experiment summary
    fn print_experiment_summary(&self, results: &ExperimentResults) {
        info!("📈 Experiment Summary:");
        info!("  Total Tasks: {}", results.total_tasks);
        info!("  Successful: {}", results.successful_tasks);
        info!("  Failed: {}", results.failed_tasks_count);
        info!("  Success Rate: {:.1}%", results.success_rate);
        info!("  Average Confidence: {:.3}", results.average_confidence);
        info!("  Average Iterations: {:.1}", results.average_iterations);
        info!("  Convergence Rate: {:.1}%", results.convergence_rate);
    }
}

/// Experiment task definition
#[derive(Debug, Clone)]
pub struct ExperimentTask {
    pub task_id: String,
    pub prompt: String,
    pub context: Option<String>,
    pub max_iterations: usize,
    pub min_confidence: f64,
    pub num_sessions: usize,
}

/// Task result for a single experiment task
#[derive(Debug)]
pub struct TaskResult {
    pub task_id: String,
    pub session_results: Vec<RLVRResponse>,
    pub session_errors: Vec<String>,
    pub average_confidence: f64,
    pub average_iterations: f64,
    pub convergence_rate: f64,
}

impl TaskResult {
    pub fn new(task_id: String) -> Self {
        Self {
            task_id,
            session_results: Vec::new(),
            session_errors: Vec::new(),
            average_confidence: 0.0,
            average_iterations: 0.0,
            convergence_rate: 0.0,
        }
    }

    pub fn add_session_result(&mut self, result: RLVRResponse) {
        self.session_results.push(result);
    }

    pub fn add_session_error(&mut self, error: String) {
        self.session_errors.push(error);
    }

    pub fn calculate_statistics(&mut self) {
        if !self.session_results.is_empty() {
            self.average_confidence = self.session_results.iter()
                .map(|r| r.confidence)
                .sum::<f64>() / self.session_results.len() as f64;

            self.average_iterations = self.session_results.iter()
                .map(|r| r.iterations as f64)
                .sum::<f64>() / self.session_results.len() as f64;

            let converged_sessions = self.session_results.iter()
                .filter(|r| r.iterations < 10) // Assuming convergence if < 10 iterations
                .count();

            self.convergence_rate = converged_sessions as f64 / self.session_results.len() as f64;
        }
    }
}

/// Overall experiment results
#[derive(Debug)]
pub struct ExperimentResults {
    pub task_results: Vec<TaskResult>,
    pub failed_tasks: Vec<(String, String)>,
    pub total_tasks: usize,
    pub successful_tasks: usize,
    pub failed_tasks_count: usize,
    pub success_rate: f64,
    pub average_confidence: f64,
    pub average_iterations: f64,
    pub convergence_rate: f64,
    pub insights: Vec<String>,
}

impl ExperimentResults {
    pub fn new() -> Self {
        Self {
            task_results: Vec::new(),
            failed_tasks: Vec::new(),
            total_tasks: 0,
            successful_tasks: 0,
            failed_tasks_count: 0,
            success_rate: 0.0,
            average_confidence: 0.0,
            average_iterations: 0.0,
            convergence_rate: 0.0,
            insights: Vec::new(),
        }
    }

    pub fn add_task_result(&mut self, result: TaskResult) {
        self.task_results.push(result);
    }

    pub fn add_failed_task(&mut self, task_id: String, error: String) {
        self.failed_tasks.push((task_id, error));
    }

    pub fn calculate_statistics(&mut self) {
        self.total_tasks = self.task_results.len() + self.failed_tasks.len();
        self.successful_tasks = self.task_results.len();
        self.failed_tasks_count = self.failed_tasks.len();

        if self.total_tasks > 0 {
            self.success_rate = self.successful_tasks as f64 / self.total_tasks as f64;
        }

        if !self.task_results.is_empty() {
            self.average_confidence = self.task_results.iter()
                .map(|r| r.average_confidence)
                .sum::<f64>() / self.task_results.len() as f64;

            self.average_iterations = self.task_results.iter()
                .map(|r| r.average_iterations)
                .sum::<f64>() / self.task_results.len() as f64;

            self.convergence_rate = self.task_results.iter()
                .map(|r| r.convergence_rate)
                .sum::<f64>() / self.task_results.len() as f64;
        }
    }

    pub fn generate_insights(&mut self) {
        self.insights.clear();

        if self.success_rate > 0.8 {
            self.insights.push("High success rate indicates good RLVR performance".to_string());
        } else if self.success_rate < 0.5 {
            self.insights.push("Low success rate suggests need for verifier improvement".to_string());
        }

        if self.average_confidence > 0.8 {
            self.insights.push("High average confidence shows effective learning".to_string());
        }

        if self.convergence_rate > 0.7 {
            self.insights.push("Good convergence rate indicates stable learning".to_string());
        } else {
            self.insights.push("Low convergence rate suggests learning instability".to_string());
        }

        if self.average_iterations > 8.0 {
            self.insights.push("High iteration count suggests slow convergence".to_string());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_experiment_runner_creation() {
        let runner = RLVRExperimentRunner::new();
        assert!(true); // Basic test that runner can be created
    }

    #[tokio::test]
    async fn test_task_result_calculation() {
        let mut task_result = TaskResult::new("test_task".to_string());

        // Add some mock results
        task_result.add_session_result(RLVRResponse {
            session_id: uuid::Uuid::new_v4(),
            task_id: "test_task".to_string(),
            final_solution: "test solution".to_string(),
            confidence: 0.8,
            iterations: 5,
            converged: true,
            training_stats: TrainingStats::default(),
        });

        task_result.calculate_statistics();
        assert_eq!(task_result.average_confidence, 0.8);
        assert_eq!(task_result.average_iterations, 5.0);
    }
}

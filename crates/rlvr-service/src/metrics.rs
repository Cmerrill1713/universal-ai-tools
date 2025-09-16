use crate::models::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Comprehensive metrics collection for RLVR evaluation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RLVREvaluationMetrics {
    pub session_id: uuid::Uuid,
    pub task_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub duration_seconds: f64,

    // Training metrics
    pub total_iterations: usize,
    pub final_confidence: f64,
    pub average_confidence: f64,
    pub confidence_improvement: f64,

    // Reward metrics
    pub total_reward: f64,
    pub average_reward: f64,
    pub reward_trend: f64,
    pub max_reward: f64,
    pub min_reward: f64,

    // Quality metrics
    pub correctness_scores: Vec<f64>,
    pub quality_scores: Vec<f64>,
    pub average_correctness: f64,
    pub average_quality: f64,

    // Error analysis
    pub total_errors: usize,
    pub unique_error_types: usize,
    pub error_frequency: HashMap<String, usize>,
    pub error_reduction_rate: f64,

    // Convergence metrics
    pub converged: bool,
    pub convergence_iteration: Option<usize>,
    pub convergence_threshold: f64,

    // Model performance
    pub verifier_accuracy: f64,
    pub policy_entropy: f64,
    pub training_loss: f64,

    // Efficiency metrics
    pub tokens_generated: usize,
    pub tokens_per_iteration: f64,
    pub time_per_iteration: f64,
}

impl RLVREvaluationMetrics {
    pub fn new(session_id: uuid::Uuid, task_id: String) -> Self {
        let now = Utc::now();
        Self {
            session_id,
            task_id,
            start_time: now,
            end_time: now,
            duration_seconds: 0.0,
            total_iterations: 0,
            final_confidence: 0.0,
            average_confidence: 0.0,
            confidence_improvement: 0.0,
            total_reward: 0.0,
            average_reward: 0.0,
            reward_trend: 0.0,
            max_reward: 0.0,
            min_reward: 0.0,
            correctness_scores: Vec::new(),
            quality_scores: Vec::new(),
            average_correctness: 0.0,
            average_quality: 0.0,
            total_errors: 0,
            unique_error_types: 0,
            error_frequency: HashMap::new(),
            error_reduction_rate: 0.0,
            converged: false,
            convergence_iteration: None,
            convergence_threshold: 0.01,
            verifier_accuracy: 0.0,
            policy_entropy: 0.0,
            training_loss: 0.0,
            tokens_generated: 0,
            tokens_per_iteration: 0.0,
            time_per_iteration: 0.0,
        }
    }

    /// Calculate metrics from training data
    pub fn calculate_from_training_data(&mut self, training_data: &[TrainingExample], metrics: &RLVRMetrics) {
        if training_data.is_empty() {
            return;
        }

        self.end_time = Utc::now();
        self.duration_seconds = (self.end_time - self.start_time).num_seconds() as f64;

        self.total_iterations = training_data.len();
        self.final_confidence = training_data.last().unwrap().verifier_feedback.confidence;

        // Calculate average confidence
        let total_confidence: f64 = training_data.iter()
            .map(|exp| exp.verifier_feedback.confidence)
            .sum();
        self.average_confidence = total_confidence / self.total_iterations as f64;

        // Calculate confidence improvement
        if self.total_iterations > 1 {
            let first_confidence = training_data[0].verifier_feedback.confidence;
            self.confidence_improvement = self.final_confidence - first_confidence;
        }

        // Calculate reward metrics
        let rewards: Vec<f64> = training_data.iter().map(|exp| exp.reward).collect();
        self.total_reward = rewards.iter().sum();
        self.average_reward = self.total_reward / self.total_iterations as f64;
        self.max_reward = rewards.iter().cloned().fold(0.0, f64::max);
        self.min_reward = rewards.iter().cloned().fold(f64::INFINITY, f64::min);

        // Calculate reward trend
        if self.total_iterations > 1 {
            let first_reward = rewards[0];
            self.reward_trend = self.final_confidence - first_reward;
        }

        // Calculate quality metrics
        self.correctness_scores = training_data.iter()
            .map(|exp| exp.verifier_feedback.correctness_score)
            .collect();
        self.quality_scores = training_data.iter()
            .map(|exp| exp.verifier_feedback.quality_score)
            .collect();

        self.average_correctness = self.correctness_scores.iter().sum::<f64>() / self.correctness_scores.len() as f64;
        self.average_quality = self.quality_scores.iter().sum::<f64>() / self.quality_scores.len() as f64;

        // Analyze errors
        self.analyze_errors(training_data);

        // Set model performance metrics
        self.verifier_accuracy = metrics.verifier_accuracy;
        self.policy_entropy = metrics.policy_entropy;
        self.training_loss = metrics.training_loss;

        // Calculate efficiency metrics
        self.tokens_generated = training_data.iter()
            .map(|exp| exp.generated_output.len())
            .sum();
        self.tokens_per_iteration = self.tokens_generated as f64 / self.total_iterations as f64;
        self.time_per_iteration = self.duration_seconds / self.total_iterations as f64;
    }

    /// Analyze error patterns
    fn analyze_errors(&mut self, training_data: &[TrainingExample]) {
        let mut error_counts = HashMap::new();
        let mut total_errors = 0;

        for exp in training_data {
            for error_type in &exp.verifier_feedback.error_types {
                *error_counts.entry(error_type.clone()).or_insert(0) += 1;
                total_errors += 1;
            }
        }

        self.total_errors = total_errors;
        self.unique_error_types = error_counts.len();
        self.error_frequency = error_counts;

        // Calculate error reduction rate
        if self.total_iterations > 1 {
            let first_errors = training_data[0].verifier_feedback.error_types.len();
            let last_errors = training_data.last().unwrap().verifier_feedback.error_types.len();
            if first_errors > 0 {
                self.error_reduction_rate = (first_errors - last_errors) as f64 / first_errors as f64;
            }
        }
    }

    /// Generate evaluation report
    pub fn generate_report(&self) -> EvaluationReport {
        EvaluationReport {
            session_id: self.session_id,
            task_id: self.task_id.clone(),
            summary: self.generate_summary(),
            detailed_metrics: self.clone(),
            recommendations: self.generate_recommendations(),
        }
    }

    /// Generate summary of key metrics
    fn generate_summary(&self) -> String {
        format!(
            "RLVR Evaluation Summary:\n\
            - Session: {}\n\
            - Task: {}\n\
            - Duration: {:.2}s\n\
            - Iterations: {}\n\
            - Final Confidence: {:.3}\n\
            - Average Reward: {:.3}\n\
            - Success Rate: {:.1}%\n\
            - Error Reduction: {:.1}%\n\
            - Converged: {}",
            self.session_id,
            self.task_id,
            self.duration_seconds,
            self.total_iterations,
            self.final_confidence,
            self.average_reward,
            (self.average_confidence * 100.0),
            (self.error_reduction_rate * 100.0),
            self.converged
        )
    }

    /// Generate recommendations based on metrics
    fn generate_recommendations(&self) -> Vec<String> {
        let mut recommendations = Vec::new();

        if self.final_confidence < 0.7 {
            recommendations.push("Consider increasing max_iterations or improving verifier model".to_string());
        }

        if self.average_reward < 0.5 {
            recommendations.push("Review reward function - may need adjustment".to_string());
        }

        if self.error_reduction_rate < 0.1 {
            recommendations.push("Generator not learning from errors effectively - check learning rate".to_string());
        }

        if self.policy_entropy < 0.1 {
            recommendations.push("Policy may be collapsing - increase entropy regularization".to_string());
        }

        if self.time_per_iteration > 10.0 {
            recommendations.push("Consider optimizing generation speed".to_string());
        }

        if recommendations.is_empty() {
            recommendations.push("Performance looks good! Consider fine-tuning for specific use cases".to_string());
        }

        recommendations
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationReport {
    pub session_id: uuid::Uuid,
    pub task_id: String,
    pub summary: String,
    pub detailed_metrics: RLVREvaluationMetrics,
    pub recommendations: Vec<String>,
}

/// Metrics aggregator for multiple RLVR sessions
pub struct MetricsAggregator {
    sessions: HashMap<uuid::Uuid, RLVREvaluationMetrics>,
    task_aggregates: HashMap<String, TaskAggregate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAggregate {
    pub task_id: String,
    pub total_sessions: usize,
    pub average_confidence: f64,
    pub average_iterations: f64,
    pub success_rate: f64,
    pub best_session_id: uuid::Uuid,
    pub best_confidence: f64,
}

impl MetricsAggregator {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            task_aggregates: HashMap::new(),
        }
    }

    pub fn add_session(&mut self, metrics: RLVREvaluationMetrics) {
        let session_id = metrics.session_id;
        self.sessions.insert(session_id, metrics.clone());
        self.update_task_aggregate(&metrics);
    }

    fn update_task_aggregate(&mut self, metrics: &RLVREvaluationMetrics) {
        let aggregate = self.task_aggregates.entry(metrics.task_id.clone()).or_insert(TaskAggregate {
            task_id: metrics.task_id.clone(),
            total_sessions: 0,
            average_confidence: 0.0,
            average_iterations: 0.0,
            success_rate: 0.0,
            best_session_id: metrics.session_id,
            best_confidence: metrics.final_confidence,
        });

        aggregate.total_sessions += 1;

        // Update averages
        let total_confidence: f64 = self.sessions.values()
            .filter(|m| m.task_id == metrics.task_id)
            .map(|m| m.final_confidence)
            .sum();
        aggregate.average_confidence = total_confidence / aggregate.total_sessions as f64;

        let total_iterations: f64 = self.sessions.values()
            .filter(|m| m.task_id == metrics.task_id)
            .map(|m| m.total_iterations as f64)
            .sum();
        aggregate.average_iterations = total_iterations / aggregate.total_sessions as f64;

        let successful_sessions = self.sessions.values()
            .filter(|m| m.task_id == metrics.task_id && m.final_confidence > 0.7)
            .count();
        aggregate.success_rate = successful_sessions as f64 / aggregate.total_sessions as f64;

        // Update best session
        if metrics.final_confidence > aggregate.best_confidence {
            aggregate.best_confidence = metrics.final_confidence;
            aggregate.best_session_id = metrics.session_id;
        }
    }

    pub fn get_task_aggregate(&self, task_id: &str) -> Option<&TaskAggregate> {
        self.task_aggregates.get(task_id)
    }

    pub fn get_all_aggregates(&self) -> &HashMap<String, TaskAggregate> {
        &self.task_aggregates
    }
}

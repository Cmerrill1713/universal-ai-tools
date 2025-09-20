//! Type definitions for intelligent parameter service

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use uuid::Uuid;

/// Request for optimal parameters
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParameterRequest {
    pub id: Uuid,
    pub model: String,
    pub prompt: String,
    pub context: Option<String>,
    pub user_preferences: UserPreferences,
    pub constraints: ParameterConstraints,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// User preferences for parameter selection
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UserPreferences {
    pub priority: OptimizationPriority,
    pub quality_threshold: f32,
    pub max_latency_ms: Option<u64>,
    pub max_tokens: Option<usize>,
    pub preferred_style: Option<ResponseStyle>,
}

/// Optimization priority
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OptimizationPriority {
    Quality,
    Speed,
    Cost,
    Balanced,
    Consistency,
}

/// Response style preference
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResponseStyle {
    Concise,
    Detailed,
    Technical,
    Creative,
    Formal,
    Casual,
}

/// Parameter constraints
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParameterConstraints {
    pub temperature_range: (f32, f32),
    pub top_p_range: (f32, f32),
    pub top_k_range: Option<(u32, u32)>,
    pub max_tokens_limit: usize,
    pub presence_penalty_range: (f32, f32),
    pub frequency_penalty_range: (f32, f32),
}

impl Default for ParameterConstraints {
    fn default() -> Self {
        Self {
            temperature_range: (0.0, 2.0),
            top_p_range: (0.0, 1.0),
            top_k_range: Some((1, 100)),
            max_tokens_limit: 4096,
            presence_penalty_range: (-2.0, 2.0),
            frequency_penalty_range: (-2.0, 2.0),
        }
    }
}

/// Optimal parameters selected by the service
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OptimalParameters {
    pub temperature: f32,
    pub top_p: f32,
    pub top_k: Option<u32>,
    pub max_tokens: usize,
    pub presence_penalty: f32,
    pub frequency_penalty: f32,
    pub repetition_penalty: Option<f32>,
    pub seed: Option<u64>,
    pub stop_sequences: Vec<String>,
    pub confidence: f32,
    pub reasoning: Vec<String>,
    pub expected_quality: f32,
    pub expected_latency_ms: u64,
}

/// Task type classification
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    CodeGeneration,
    CodeReview,
    Explanation,
    Summarization,
    Translation,
    Creative,
    Analysis,
    QuestionAnswering,
    Conversation,
    Reasoning,
    General,
}

/// Performance feedback for parameter optimization
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PerformanceFeedback {
    pub task_id: Uuid,
    pub parameters_used: OptimalParameters,
    pub task_type: TaskType,
    pub quality_score: f32,
    pub latency_ms: u64,
    pub token_count: usize,
    pub cost_estimate: f32,
    pub user_satisfaction: Option<f32>,
    pub error_occurred: bool,
    pub timestamp: DateTime<Utc>,
}

/// Historical performance data
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PerformanceHistory {
    pub task_type: TaskType,
    pub model: String,
    pub parameters: OptimalParameters,
    pub avg_quality: f32,
    pub avg_latency_ms: f64,
    pub success_rate: f32,
    pub sample_count: usize,
    pub last_updated: DateTime<Utc>,
}

/// Performance analytics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PerformanceAnalytics {
    pub total_requests: u64,
    pub cache_hit_rate: f32,
    pub avg_quality_score: f32,
    pub avg_latency_ms: f64,
    pub optimization_improvements: OptimizationMetrics,
    pub task_distribution: HashMap<TaskType, u64>,
    pub parameter_effectiveness: HashMap<String, ParameterMetrics>,
    pub model_performance: HashMap<String, ModelMetrics>,
}

/// Optimization metrics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OptimizationMetrics {
    pub quality_improvement: f32,
    pub latency_reduction: f32,
    pub cost_reduction: f32,
    pub consistency_improvement: f32,
}

/// Parameter effectiveness metrics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParameterMetrics {
    pub avg_value: f32,
    pub optimal_range: (f32, f32),
    pub correlation_with_quality: f32,
    pub correlation_with_latency: f32,
    pub usage_frequency: u64,
}

/// Model-specific metrics
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelMetrics {
    pub request_count: u64,
    pub avg_quality: f32,
    pub avg_latency_ms: f64,
    pub error_rate: f32,
    pub optimal_parameters: HashMap<TaskType, OptimalParameters>,
}

/// Multi-armed bandit arm for parameter selection
#[derive(Clone, Debug)]
pub struct BanditArm {
    pub parameters: OptimalParameters,
    pub pulls: u64,
    pub total_reward: f64,
    pub avg_reward: f64,
    pub ucb_score: f64,
}

/// Thompson sampling distribution
#[derive(Clone, Debug)]
pub struct ThompsonDistribution {
    pub alpha: f64,
    pub beta: f64,
    pub samples: Vec<f64>,
}

/// Bayesian optimization state
#[derive(Clone, Debug)]
pub struct BayesianState {
    pub observations: Vec<(Vec<f64>, f64)>,
    pub acquisition_function: AcquisitionFunction,
    pub surrogate_model: SurrogateModel,
}

/// Acquisition function for Bayesian optimization
#[derive(Clone, Debug)]
pub enum AcquisitionFunction {
    ExpectedImprovement,
    UpperConfidenceBound,
    ProbabilityOfImprovement,
    Entropy,
}

/// Surrogate model for Bayesian optimization
#[derive(Clone, Debug)]
pub enum SurrogateModel {
    GaussianProcess,
    RandomForest,
    NeuralNetwork,
}

/// Reinforcement learning state
#[derive(Clone, Debug)]
pub struct RLState {
    pub state_vector: Vec<f64>,
    pub action_space: Vec<OptimalParameters>,
    pub q_values: HashMap<String, f64>,
    pub policy: Policy,
}

/// RL policy type
#[derive(Clone, Debug)]
pub enum Policy {
    EpsilonGreedy(f64),
    Softmax(f64),
    UCB(f64),
    Gradient,
}
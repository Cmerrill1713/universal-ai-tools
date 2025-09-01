use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TaskType {
    #[serde(rename = "code_generation")]
    CodeGeneration,
    #[serde(rename = "question_answering")]
    QuestionAnswering,
    #[serde(rename = "text_analysis")]
    TextAnalysis,
    #[serde(rename = "creative_writing")]
    CreativeWriting,
    #[serde(rename = "data_processing")]
    DataProcessing,
    #[serde(rename = "planning")]
    Planning,
    #[serde(rename = "research")]
    Research,
    #[serde(rename = "translation")]
    Translation,
    #[serde(rename = "summarization")]
    Summarization,
    #[serde(rename = "classification")]
    Classification,
}

impl TaskType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskType::CodeGeneration => "code_generation",
            TaskType::QuestionAnswering => "question_answering",
            TaskType::TextAnalysis => "text_analysis",
            TaskType::CreativeWriting => "creative_writing",
            TaskType::DataProcessing => "data_processing",
            TaskType::Planning => "planning",
            TaskType::Research => "research",
            TaskType::Translation => "translation",
            TaskType::Summarization => "summarization",
            TaskType::Classification => "classification",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "code_generation" => Some(TaskType::CodeGeneration),
            "question_answering" => Some(TaskType::QuestionAnswering),
            "text_analysis" => Some(TaskType::TextAnalysis),
            "creative_writing" => Some(TaskType::CreativeWriting),
            "data_processing" => Some(TaskType::DataProcessing),
            "planning" => Some(TaskType::Planning),
            "research" => Some(TaskType::Research),
            "translation" => Some(TaskType::Translation),
            "summarization" => Some(TaskType::Summarization),
            "classification" => Some(TaskType::Classification),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Complexity {
    Simple,
    Medium,
    Complex,
}

impl Complexity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Complexity::Simple => "simple",
            Complexity::Medium => "medium",
            Complexity::Complex => "complex",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "simple" => Some(Complexity::Simple),
            "medium" => Some(Complexity::Medium),
            "complex" => Some(Complexity::Complex),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ImpactLevel {
    Low,
    Medium,
    High,
}

impl ImpactLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            ImpactLevel::Low => "low",
            ImpactLevel::Medium => "medium",
            ImpactLevel::High => "high",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "low" => Some(ImpactLevel::Low),
            "medium" => Some(ImpactLevel::Medium),
            "high" => Some(ImpactLevel::High),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TrendDirection {
    Improving,
    Declining,
    Stable,
}

impl TrendDirection {
    pub fn as_str(&self) -> &'static str {
        match self {
            TrendDirection::Improving => "improving",
            TrendDirection::Declining => "declining",
            TrendDirection::Stable => "stable",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "improving" => Some(TrendDirection::Improving),
            "declining" => Some(TrendDirection::Declining),
            "stable" => Some(TrendDirection::Stable),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskParameters {
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub top_p: Option<f32>,
    pub top_k: Option<u32>,
    pub frequency_penalty: Option<f32>,
    pub presence_penalty: Option<f32>,
    pub stop_sequences: Option<Vec<String>>,
    pub system_message: Option<String>,
}

impl Default for TaskParameters {
    fn default() -> Self {
        Self {
            temperature: Some(0.7),
            max_tokens: Some(1024),
            top_p: Some(0.9),
            top_k: None,
            frequency_penalty: Some(0.0),
            presence_penalty: Some(0.0),
            stop_sequences: None,
            system_message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

impl TokenUsage {
    pub fn new(prompt_tokens: u32, completion_tokens: u32) -> Self {
        Self {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens + completion_tokens,
        }
    }

    pub fn cost(&self, prompt_cost_per_1k: f64, completion_cost_per_1k: f64) -> f64 {
        (self.prompt_tokens as f64 / 1000.0) * prompt_cost_per_1k +
        (self.completion_tokens as f64 / 1000.0) * completion_cost_per_1k
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterExecution {
    pub id: String,
    pub task_type: TaskType,
    pub user_input: String,
    pub parameters: TaskParameters,
    pub model: String,
    pub provider: String,
    pub user_id: Option<String>,
    pub request_id: String,
    pub timestamp: DateTime<Utc>,

    // Execution Metrics
    pub execution_time: u64, // milliseconds
    pub token_usage: TokenUsage,

    // Quality Metrics
    pub response_length: u32,
    pub response_quality: Option<f32>, // 0-1 score
    pub user_satisfaction: Option<f32>, // 0-5 rating

    // Outcome Metrics
    pub success: bool,
    pub error_type: Option<String>,
    pub retry_count: u32,

    // Context
    pub complexity: Complexity,
    pub domain: Option<String>,
    pub endpoint: String,
}

impl ParameterExecution {
    pub fn parameter_hash(&self) -> String {
        let serialized = serde_json::to_string(&self.parameters).unwrap_or_default();
        let hash = blake3::hash(serialized.as_bytes());
        base64::encode(&hash.as_bytes()[..16])
    }

    pub fn performance_score(&self) -> f64 {
        let success_score = if self.success { 1.0 } else { 0.0 };
        let speed_score = 1.0 - (self.execution_time as f64 / 30000.0).min(1.0); // Normalize to 30s max
        let quality_score = self.response_quality.unwrap_or(0.5) as f64;
        let satisfaction_score = self.user_satisfaction.unwrap_or(2.5) as f64 / 5.0;

        // Weighted combination
        success_score * 0.4 + speed_score * 0.2 + quality_score * 0.2 + satisfaction_score * 0.2
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterEffectiveness {
    pub task_type: TaskType,
    pub parameter_set: String, // Hash of parameter combination
    pub parameters: TaskParameters,

    // Aggregate Metrics
    pub total_executions: u64,
    pub success_rate: f64,
    pub avg_execution_time: f64,
    pub avg_token_usage: f64,
    pub avg_response_quality: f64,
    pub avg_user_satisfaction: f64,

    // Performance Trends
    pub quality_trend: f64, // Positive = improving
    pub speed_trend: f64,
    pub cost_efficiency_trend: f64,

    // Statistical Measures
    pub execution_time_variance: f64,
    pub quality_variance: f64,
    pub p95_execution_time: f64,
    pub p99_execution_time: f64,

    // Meta Information
    pub last_updated: DateTime<Utc>,
    pub confidence_score: f64, // Statistical confidence in metrics
    pub sample_size_adequacy: bool,
}

impl ParameterEffectiveness {
    pub fn performance_score(&self) -> f64 {
        self.success_rate * 0.4 +
        (1.0 - (self.avg_execution_time / 10000.0).min(1.0)) * 0.2 +
        self.avg_response_quality * 0.2 +
        (self.avg_user_satisfaction / 5.0) * 0.2
    }

    pub fn stability_score(&self) -> f64 {
        // Lower variance = higher stability
        let time_stability = 1.0 - (self.execution_time_variance / self.avg_execution_time.powi(2)).min(1.0);
        let quality_stability = 1.0 - self.quality_variance;
        (time_stability + quality_stability) / 2.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationInsight {
    pub task_type: TaskType,
    pub insight: String,
    pub recommendation: String,
    pub impact: ImpactLevel,
    pub confidence: f64,
    pub supporting_data: SupportingData,
    pub generated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupportingData {
    pub sample_size: u64,
    pub improvement_percent: f64,
    pub current_metric: f64,
    pub optimized_metric: f64,
    pub statistical_significance: f64,
    pub effect_size: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub total_executions: u64,
    pub success_rate: f64,
    pub avg_response_time: f64,
    pub fastest_response_time: f64,
    pub slowest_response_time: f64,
    pub p50_response_time: f64,
    pub p90_response_time: f64,
    pub p95_response_time: f64,
    pub p99_response_time: f64,
    pub avg_tokens_per_request: f64,
    pub total_cost: f64,
    pub cost_per_successful_request: f64,
    pub error_rate: f64,
    pub timeout_rate: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskPerformance {
    pub task_type: TaskType,
    pub score: f64,
    pub executions: u64,
    pub trend: TrendDirection,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardMetrics {
    pub total_executions: u64,
    pub success_rate: f64,
    pub avg_response_time: f64,
    pub top_performing_tasks: Vec<TaskPerformance>,
    pub recent_insights: Vec<OptimizationInsight>,
    pub parameter_trends: Vec<ParameterTrend>,
    pub cost_efficiency: CostEfficiencyMetrics,
    pub system_health: SystemHealth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterTrend {
    pub task_type: TaskType,
    pub trend: TrendDirection,
    pub change_percent: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEfficiencyMetrics {
    pub total_cost: f64,
    pub cost_per_request: f64,
    pub cost_per_token: f64,
    pub most_efficient_task: Option<TaskType>,
    pub least_efficient_task: Option<TaskType>,
    pub efficiency_trend: TrendDirection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub overall_score: f64,
    pub latency_health: f64,
    pub error_rate_health: f64,
    pub cost_health: f64,
    pub trend_health: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterRecommendation {
    pub task_type: TaskType,
    pub recommended: TaskParameters,
    pub confidence: f64,
    pub reasoning: String,
    pub expected_improvement: f64,
    pub alternative_options: Vec<AlternativeOption>,
    pub context_constraints: Option<ContextConstraints>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlternativeOption {
    pub parameters: TaskParameters,
    pub expected_performance: f64,
    pub tradeoffs: String,
    pub use_case: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextConstraints {
    pub complexity: Option<Complexity>,
    pub domain: Option<String>,
    pub model: Option<String>,
    pub max_cost: Option<f64>,
    pub max_latency: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl TimeRange {
    pub fn last_hours(hours: i64) -> Self {
        let end = Utc::now();
        let start = end - chrono::Duration::hours(hours);
        Self { start, end }
    }

    pub fn last_days(days: i64) -> Self {
        let end = Utc::now();
        let start = end - chrono::Duration::days(days);
        Self { start, end }
    }

    pub fn duration(&self) -> chrono::Duration {
        self.end - self.start
    }
}
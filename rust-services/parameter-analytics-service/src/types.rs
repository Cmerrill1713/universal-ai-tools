//! Type definitions for Parameter Analytics Service
//! 
//! Mirrors the TypeScript interface definitions while optimizing for Rust performance

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum TaskType {
    // Code Tasks
    CodeGeneration,
    CodeReview,
    CodeDebugging,
    CodeExplanation,
    CodeRefactoring,
    
    // Analysis Tasks
    DataAnalysis,
    TextAnalysis,
    DocumentAnalysis,
    Research,
    
    // Creative Tasks
    CreativeWriting,
    ContentGeneration,
    Brainstorming,
    StoryGeneration,
    
    // Question Answering
    FactualQa,
    Reasoning,
    Explanation,
    Tutorial,
    
    // Conversation
    CasualChat,
    ProfessionalConsultation,
    TechnicalSupport,
    
    // Specialized
    Translation,
    Summarization,
    Classification,
    Extraction,
    
    // Vision Tasks
    ImageAnalysis,
    ImageDescription,
    VisualReasoning,
    
    // Fine-tuning
    ModelTraining,
    DatasetPreparation,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TaskParameters {
    pub context_length: u32,
    pub temperature: f64,
    pub top_p: Option<f64>,
    pub max_tokens: u32,
    pub system_prompt: String,
    pub user_prompt_template: String,
    pub stop_sequences: Option<Vec<String>>,
    pub presence_penalty: Option<f64>,
    pub frequency_penalty: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Complexity {
    Simple,
    Medium,
    Complex,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParameterExecution {
    pub id: Uuid,
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
    pub response_quality: Option<f64>, // 0-1 score
    pub user_satisfaction: Option<f64>, // 0-5 rating
    
    // Outcome Metrics
    pub success: bool,
    pub error_type: Option<String>,
    pub retry_count: u32,
    
    // Context
    pub complexity: Complexity,
    pub domain: Option<String>,
    pub endpoint: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
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
    
    // Last Updated
    pub last_updated: DateTime<Utc>,
    pub confidence_score: f64, // Statistical confidence in metrics
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum InsightImpact {
    High,
    Medium,
    Low,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SupportingData {
    pub sample_size: u64,
    pub improvement_percent: f64,
    pub current_metric: f64,
    pub optimized_metric: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OptimizationInsight {
    pub task_type: TaskType,
    pub insight: String,
    pub recommendation: String,
    pub impact: InsightImpact,
    pub confidence: f64,
    pub supporting_data: SupportingData,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub processed: bool,
    pub execution_id: Uuid,
    pub processing_time: u64, // microseconds
    pub insights_generated: u32,
    pub trends_updated: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EffectivenessFilter {
    pub task_types: Option<Vec<TaskType>>,
    pub models: Option<Vec<String>>,
    pub providers: Option<Vec<String>>,
    pub complexity: Option<Vec<Complexity>>,
    pub time_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    pub min_executions: Option<u64>,
    pub min_confidence: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AnalyticsSnapshot {
    pub timestamp: DateTime<Utc>,
    pub total_executions: u64,
    pub total_task_types: u32,
    pub total_parameter_sets: u32,
    pub avg_processing_time: f64,
    pub top_performing_parameters: Vec<ParameterEffectiveness>,
    pub recent_insights: Vec<OptimizationInsight>,
    pub performance_trends: HashMap<TaskType, f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub status: String,
    pub service: String,
    pub version: String,
    pub timestamp: DateTime<Utc>,
    pub cache_connected: bool,
    pub database_connected: bool,
    pub processing_queue_size: u64,
    pub total_processed: u64,
}

#[derive(Clone, Debug)]
pub struct AnalyticsConfig {
    pub redis_url: String,
    pub database_url: Option<String>,
    pub buffer_size: usize,
    pub flush_interval_ms: u64,
    pub cache_expiry_ms: u64,
    pub parallel_workers: usize,
    pub enable_ml_insights: bool,
    pub min_sample_size: u64,
}

impl Default for AnalyticsConfig {
    fn default() -> Self {
        Self {
            redis_url: "redis://localhost:6379".to_string(),
            database_url: None,
            buffer_size: 1000,
            flush_interval_ms: 30_000, // 30 seconds
            cache_expiry_ms: 300_000,  // 5 minutes
            parallel_workers: num_cpus::get(),
            enable_ml_insights: true,
            min_sample_size: 10,
        }
    }
}

impl Default for TaskParameters {
    fn default() -> Self {
        Self {
            context_length: 4096,
            temperature: 0.7,
            top_p: Some(0.9),
            max_tokens: 2048,
            system_prompt: "You are a helpful AI assistant.".to_string(),
            user_prompt_template: "{user_input}".to_string(),
            stop_sequences: None,
            presence_penalty: None,
            frequency_penalty: None,
        }
    }
}
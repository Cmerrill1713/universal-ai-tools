use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ModelProvider {
    OpenAI,
    Anthropic,
    Ollama,
    LMStudio,
    HuggingFace,
    Local,
    RustCandle,
    GoInference,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub provider: ModelProvider,
    pub context_length: u32,
    pub max_tokens: u32,
    pub cost_per_token: Option<f64>,
    pub supports_streaming: bool,
    pub supports_function_calling: bool,
    pub performance_tier: PerformanceTier,
    pub availability_score: f64, // 0.0 to 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PerformanceTier {
    Lightning, // < 500ms (LFM2, small local models)
    Fast,      // 500ms - 2s (GPT-3.5, Claude Instant)
    Standard,  // 2s - 10s (GPT-4, Claude 3)
    Heavy,     // > 10s (Large local models)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: bool,
    pub user_id: Option<String>,
    pub context_id: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Hash)]
pub struct Message {
    pub role: String,
    pub content: String,
    pub timestamp: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMResponse {
    pub content: String,
    pub model: String,
    pub provider: ModelProvider,
    pub tokens_used: TokenUsage,
    pub execution_time_ms: u64,
    pub finish_reason: String,
    pub confidence: f64,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingContext {
    pub task_complexity: TaskComplexity,
    pub urgency_level: UrgencyLevel,
    pub expected_length: ResponseLength,
    pub requires_reasoning: bool,
    pub requires_creativity: bool,
    pub user_tier: UserTier,
    pub cost_sensitivity: CostSensitivity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskComplexity {
    Simple,   // Basic QA, simple completion
    Medium,   // Analysis, summarization  
    Complex,  // Reasoning, multi-step tasks
    Expert,   // Research, code generation
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UrgencyLevel {
    Low,      // Can wait for best model
    Medium,   // Balance speed and quality
    High,     // Prioritize speed
    Critical, // Use fastest available
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ResponseLength {
    Short,   // < 100 tokens
    Medium,  // 100 - 500 tokens
    Long,    // 500 - 2000 tokens
    VeryLong, // > 2000 tokens
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UserTier {
    Free,
    Premium,
    Enterprise,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CostSensitivity {
    Low,    // Use best model regardless of cost
    Medium, // Balance cost and quality
    High,   // Prioritize cost savings
}

impl Default for RoutingContext {
    fn default() -> Self {
        Self {
            task_complexity: TaskComplexity::Medium,
            urgency_level: UrgencyLevel::Medium,
            expected_length: ResponseLength::Medium,
            requires_reasoning: false,
            requires_creativity: false,
            user_tier: UserTier::Free,
            cost_sensitivity: CostSensitivity::Medium,
        }
    }
}
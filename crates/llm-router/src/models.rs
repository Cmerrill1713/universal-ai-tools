use serde::{Deserialize, Serialize};
// use std::collections::HashMap; // TODO: Implement model metadata storage
use crate::context::MessageRole;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ModelTier {
    Fast = 1,      // Simple, quick responses
    Balanced = 2,  // General tasks
    Powerful = 3,  // Complex tasks
    Expert = 4,    // Most demanding tasks
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ModelCapability {
    DeepReasoning,
    ComplexAnalysis,
    MultiStepLogic,
    Planning,
    TaskDecomposition,
    Strategy,
    ProjectManagement,
    CodeGeneration,
    Debugging,
    Refactoring,
    Architecture,
    Conversation,
    TaskManagement,
    GeneralHelp,
    QuickResponse,
    SimpleAnalysis,
    BasicQA,
    InformationRetrieval,
    Summarization,
    Extraction,
    Synthesis,
    CreativeWriting,
    Brainstorming,
    TypeScriptAnalysis,
    ContextAnalysis,
    DependencyMapping,
    SyntaxValidation,
    ErrorDetection,
    CodeQuality,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: MessageRole,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

// MessageRole is defined in context.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Response {
    pub content: String,
    pub model: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<ResponseMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMetadata {
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cached: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health_score: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProfile {
    pub internal_name: String,
    pub provider: String,
    pub external_model: String,
    pub capabilities: Vec<ModelCapability>,
    pub max_tokens: u32,
    pub temperature: f32,
    pub tier: ModelTier,
    pub priority: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_per_token: Option<f32>,
}

impl ModelProfile {
    pub fn new(internal_name: String, tier: ModelTier) -> Self {
        Self {
            internal_name,
            provider: "dynamic".to_string(),
            external_model: "auto-select".to_string(),
            capabilities: Vec::new(),
            max_tokens: match tier {
                ModelTier::Fast => 1500,
                ModelTier::Balanced => 3000,
                ModelTier::Powerful => 4000,
                ModelTier::Expert => 8000,
            },
            temperature: match tier {
                ModelTier::Fast => 0.5,
                ModelTier::Balanced => 0.7,
                ModelTier::Powerful => 0.3,
                ModelTier::Expert => 0.2,
            },
            tier,
            priority: 1,
            context_window: None,
            cost_per_token: None,
        }
    }

    pub fn with_capabilities(mut self, capabilities: Vec<ModelCapability>) -> Self {
        self.capabilities = capabilities;
        self
    }

    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = max_tokens;
        self
    }

    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = temperature;
        self
    }

    pub fn matches_capabilities(&self, required: &[ModelCapability]) -> bool {
        required.iter().any(|cap| self.capabilities.contains(cap))
    }
}

/// Tier-based model mapping for different providers
pub struct TierModels {
    pub ollama: Vec<String>,
    pub lm_studio: Vec<String>,
    pub openai: Vec<String>,
    pub anthropic: Vec<String>,
}

impl TierModels {
    pub fn for_tier(tier: ModelTier) -> Self {
        match tier {
            ModelTier::Fast => Self {
                ollama: vec![
                    "gemma2:2b".to_string(),
                    "phi3:mini".to_string(),
                    "tinyllama:1b".to_string(),
                ],
                lm_studio: vec![
                    "phi-2".to_string(),
                    "stablelm-2-zephyr-1.6b".to_string(),
                ],
                openai: vec!["gpt-3.5-turbo".to_string()],
                anthropic: vec!["claude-instant-1.2".to_string()],
            },
            ModelTier::Balanced => Self {
                ollama: vec![
                    "llama3.2:3b".to_string(),
                    "mistral:7b".to_string(),
                    "gemma:7b".to_string(),
                ],
                lm_studio: vec![
                    "mistral-7b-instruct".to_string(),
                    "zephyr-7b-beta".to_string(),
                ],
                openai: vec!["gpt-3.5-turbo-16k".to_string()],
                anthropic: vec!["claude-2.0".to_string()],
            },
            ModelTier::Powerful => Self {
                ollama: vec![
                    "llama3.1:8b".to_string(),
                    "llama3.2:3b".to_string(),
                    "gpt-oss:20b".to_string(),
                ],
                lm_studio: vec![
                    "deepseek-coder-7b-instruct".to_string(),
                    "codellama-7b-instruct".to_string(),
                ],
                openai: vec!["gpt-4".to_string()],
                anthropic: vec!["claude-2.1".to_string()],
            },
            ModelTier::Expert => Self {
                ollama: vec![
                    "llama3.1:70b".to_string(),
                    "mixtral:8x22b".to_string(),
                    "qwen2.5:72b".to_string(),
                ],
                lm_studio: vec![
                    "llama-3.1-70b-instruct".to_string(),
                    "mixtral-8x22b-instruct".to_string(),
                ],
                openai: vec!["gpt-4-turbo".to_string()],
                anthropic: vec!["claude-3-opus".to_string()],
            },
        }
    }

    pub fn get_for_provider(&self, provider: &str) -> &[String] {
        match provider.to_lowercase().as_str() {
            "ollama" => &self.ollama,
            "lm_studio" | "lmstudio" => &self.lm_studio,
            "openai" => &self.openai,
            "anthropic" => &self.anthropic,
            _ => &[],
        }
    }
}

/// Request options for model generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_context: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_types: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<Vec<ModelCapability>>,
}

impl Default for GenerationOptions {
    fn default() -> Self {
        Self {
            model: None,
            temperature: None,
            max_tokens: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
            stop_sequences: None,
            stream: Some(false),
            user_id: None,
            request_id: None,
            include_context: Some(true),
            context_types: None,
            capabilities: None,
        }
    }
}

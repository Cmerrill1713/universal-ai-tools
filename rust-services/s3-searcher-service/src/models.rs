use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Represents a search query in the S3 system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub id: Uuid,
    pub question: String,
    pub user_id: Option<String>,
    pub max_turns: usize,
    pub docs_per_turn: usize,
    pub created_at: DateTime<Utc>,
}

/// Represents a document retrieved from the knowledge base
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub content: String,
    pub title: Option<String>,
    pub metadata: serde_json::Value,
    pub relevance_score: f32,
    pub embedding: Option<Vec<f32>>,
}

/// Represents a search turn/iteration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchTurn {
    pub turn_number: usize,
    pub query: String,
    pub retrieved_docs: Vec<Document>,
    pub selected_docs: Vec<Document>,
    pub should_continue: bool,
    pub reasoning: Option<String>,
}

/// Represents a complete search session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchSession {
    pub id: Uuid,
    pub original_question: String,
    pub turns: Vec<SearchTurn>,
    pub final_documents: Vec<Document>,
    pub gbr_reward: Option<f32>,
    pub baseline_documents: Option<Vec<Document>>,
    pub created_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// Result from the generator LLM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratorResult {
    pub answer: String,
    pub confidence: f32,
    pub model_used: String,
    pub tokens_used: usize,
    pub latency_ms: u64,
}

/// Training example for the searcher
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingExample {
    pub id: Uuid,
    pub question: String,
    pub gold_answer: String,
    pub difficulty_score: f32,
    pub dataset_source: String,
    pub created_at: DateTime<Utc>,
}

/// PPO training state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingState {
    pub step: usize,
    pub total_reward: f32,
    pub average_gbr: f32,
    pub success_rate: f32,
    pub examples_seen: usize,
}

/// Configuration for the searcher
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearcherConfig {
    pub model_name: String,
    pub max_turns: usize,
    pub docs_per_turn: usize,
    pub temperature: f32,
    pub top_p: f32,
    pub stop_threshold: f32,
}

/// Configuration for the generator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratorConfig {
    pub model_names: Vec<String>,
    pub temperature: f32,
    pub max_tokens: usize,
    pub timeout_ms: u64,
}

/// GBR (Gain Beyond RAG) calculation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GBRResult {
    pub s3_accuracy: f32,
    pub baseline_accuracy: f32,
    pub gbr_score: f32,
    pub s3_documents: Vec<Document>,
    pub baseline_documents: Vec<Document>,
}

/// API request for search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    pub question: String,
    pub user_id: Option<String>,
    pub use_cache: bool,
    pub return_reasoning: bool,
}

/// API response for search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub session_id: Uuid,
    pub answer: String,
    pub documents: Vec<Document>,
    pub turns: Option<Vec<SearchTurn>>,
    pub gbr_score: Option<f32>,
    pub latency_ms: u64,
}

impl Default for SearcherConfig {
    fn default() -> Self {
        Self {
            model_name: "llama-3.2:7b".to_string(),
            max_turns: 4,
            docs_per_turn: 3,
            temperature: 0.7,
            top_p: 0.9,
            stop_threshold: 0.8,
        }
    }
}

impl Default for GeneratorConfig {
    fn default() -> Self {
        Self {
            model_names: vec![
                "gpt-4".to_string(),
                "claude-3-haiku".to_string(),
            ],
            temperature: 0.3,
            max_tokens: 1024,
            timeout_ms: 30000,
        }
    }
}
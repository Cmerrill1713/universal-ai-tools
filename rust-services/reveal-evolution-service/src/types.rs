//! Core types for ReVeal Evolution Service

use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use std::collections::HashMap;

/// Evolution context information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EvolutionContext {
    pub session_id: String,
    pub user_id: Option<String>,
    pub task_type: String,
    pub domain: String,
    pub metadata: HashMap<String, String>,
}

/// Evolution constraints
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EvolutionConstraints {
    pub max_code_length: Option<usize>,
    pub allowed_libraries: Vec<String>,
    pub forbidden_patterns: Vec<String>,
    pub resource_limits: ResourceLimits,
}

/// Resource limits for evolution
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub memory_mb: Option<u64>,
    pub cpu_time_ms: Option<u64>,
    pub api_calls: Option<u32>,
}

/// Evolution options
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EvolutionOptions {
    pub max_turns: Option<u32>,
    pub min_confidence: Option<f64>,
    pub parallel_verification: Option<bool>,
    pub enable_mcts: Option<bool>,
    pub temperature: Option<f64>,
}

impl Default for EvolutionOptions {
    fn default() -> Self {
        Self {
            max_turns: Some(6),
            min_confidence: Some(0.8),
            parallel_verification: Some(true),
            enable_mcts: Some(true),
            temperature: Some(0.7),
        }
    }
}

/// Evolution result
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EvolutionResult {
    pub solution: String,
    pub final_confidence: f64,
    pub turns_taken: u32,
    pub verification_history: Vec<VerificationStep>,
    pub generation_history: Vec<GenerationStep>,
    pub metrics: EvolutionResultMetrics,
    pub timestamp: SystemTime,
}

/// Verification step in evolution history
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VerificationStep {
    pub turn: u32,
    pub confidence: f64,
    pub feedback: String,
    pub execution_time_ms: u64,
}

/// Generation step in evolution history
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GenerationStep {
    pub turn: u32,
    pub strategy_used: String,
    pub improvements: Vec<String>,
    pub execution_time_ms: u64,
}

/// Metrics for evolution result
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EvolutionResultMetrics {
    pub total_time_ms: u64,
    pub verification_time_ms: u64,
    pub generation_time_ms: u64,
    pub api_calls_made: u32,
    pub tokens_generated: u32,
    pub tokens_verified: u32,
}

/// Verification result
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VerificationResult {
    pub confidence: f64,
    pub feedback: String,
    pub passed_tests: u32,
    pub total_tests: u32,
    pub execution_successful: bool,
    pub error_message: Option<String>,
}
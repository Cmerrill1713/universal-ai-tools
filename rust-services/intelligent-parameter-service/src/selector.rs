//! Parameter selection strategies

use crate::types::*;
use crate::error::Result;
use std::collections::HashMap;
use tracing::debug;

/// Parameter selector with various strategies
pub struct ParameterSelector {
    enable_ml: bool,
    task_presets: HashMap<TaskType, OptimalParameters>,
}

impl ParameterSelector {
    /// Create a new parameter selector
    pub fn new(enable_ml: bool) -> Self {
        let mut task_presets = HashMap::new();
        
        // Code generation presets
        task_presets.insert(TaskType::CodeGeneration, OptimalParameters {
            temperature: 0.2,
            top_p: 0.95,
            top_k: Some(40),
            max_tokens: 2048,
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            repetition_penalty: Some(1.05),
            seed: None,
            stop_sequences: vec!["```".to_string()],
            confidence: 0.8,
            reasoning: vec!["Optimized for code generation".to_string()],
            expected_quality: 0.85,
            expected_latency_ms: 1200,
        });
        
        // Creative writing presets
        task_presets.insert(TaskType::Creative, OptimalParameters {
            temperature: 0.9,
            top_p: 0.95,
            top_k: Some(50),
            max_tokens: 2048,
            presence_penalty: 0.5,
            frequency_penalty: 0.3,
            repetition_penalty: Some(1.2),
            seed: None,
            stop_sequences: vec![],
            confidence: 0.75,
            reasoning: vec!["Optimized for creativity".to_string()],
            expected_quality: 0.8,
            expected_latency_ms: 1500,
        });
        
        // Analysis presets
        task_presets.insert(TaskType::Analysis, OptimalParameters {
            temperature: 0.3,
            top_p: 0.9,
            top_k: Some(30),
            max_tokens: 3072,
            presence_penalty: 0.0,
            frequency_penalty: 0.1,
            repetition_penalty: Some(1.1),
            seed: None,
            stop_sequences: vec![],
            confidence: 0.85,
            reasoning: vec!["Optimized for analytical tasks".to_string()],
            expected_quality: 0.88,
            expected_latency_ms: 2000,
        });
        
        // Question answering presets
        task_presets.insert(TaskType::QuestionAnswering, OptimalParameters {
            temperature: 0.5,
            top_p: 0.9,
            top_k: Some(40),
            max_tokens: 1024,
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            repetition_penalty: Some(1.1),
            seed: None,
            stop_sequences: vec![],
            confidence: 0.8,
            reasoning: vec!["Optimized for Q&A".to_string()],
            expected_quality: 0.82,
            expected_latency_ms: 800,
        });
        
        // Summarization presets
        task_presets.insert(TaskType::Summarization, OptimalParameters {
            temperature: 0.3,
            top_p: 0.85,
            top_k: Some(30),
            max_tokens: 512,
            presence_penalty: -0.5,
            frequency_penalty: 0.5,
            repetition_penalty: Some(1.3),
            seed: None,
            stop_sequences: vec![],
            confidence: 0.85,
            reasoning: vec!["Optimized for summarization".to_string()],
            expected_quality: 0.85,
            expected_latency_ms: 600,
        });
        
        // Translation presets
        task_presets.insert(TaskType::Translation, OptimalParameters {
            temperature: 0.1,
            top_p: 0.95,
            top_k: Some(20),
            max_tokens: 2048,
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            repetition_penalty: Some(1.0),
            seed: Some(42), // Deterministic for consistency
            stop_sequences: vec![],
            confidence: 0.9,
            reasoning: vec!["Optimized for translation accuracy".to_string()],
            expected_quality: 0.92,
            expected_latency_ms: 1000,
        });
        
        Self {
            enable_ml,
            task_presets,
        }
    }
    
    /// Select baseline parameters for a task type
    pub fn select_baseline(&self, task_type: &TaskType) -> OptimalParameters {
        self.task_presets
            .get(task_type)
            .cloned()
            .unwrap_or_else(|| self.get_default_parameters())
    }
    
    /// Select parameters based on context
    pub fn select_contextual(
        &self,
        task_type: &TaskType,
        context: &str,
        preferences: &UserPreferences,
    ) -> OptimalParameters {
        let mut params = self.select_baseline(task_type);
        
        // Adjust based on context length
        let context_tokens = context.len() / 4; // Rough estimate
        if context_tokens > 2000 {
            params.temperature *= 0.8; // More focused for long context
            params.top_p *= 0.95;
        }
        
        // Adjust based on user preferences
        match preferences.priority {
            OptimizationPriority::Quality => {
                params.temperature *= 0.9;
                params.top_p = (params.top_p * 1.05).min(1.0);
                params.max_tokens = (params.max_tokens * 2).min(4096);
            }
            OptimizationPriority::Speed => {
                params.temperature *= 1.1;
                params.top_p *= 0.9;
                params.max_tokens = (params.max_tokens / 2).max(256);
            }
            OptimizationPriority::Cost => {
                params.max_tokens = (params.max_tokens * 3 / 4).max(256);
                params.top_k = params.top_k.map(|k| (k * 3 / 4).max(10));
            }
            OptimizationPriority::Consistency => {
                params.temperature *= 0.7;
                params.seed = Some(12345);
            }
            _ => {}
        }
        
        // Adjust for response style
        if let Some(style) = &preferences.preferred_style {
            match style {
                ResponseStyle::Concise => {
                    params.max_tokens = (params.max_tokens / 2).max(256);
                    params.temperature *= 0.8;
                }
                ResponseStyle::Detailed => {
                    params.max_tokens = (params.max_tokens * 2).min(4096);
                    params.temperature *= 1.1;
                }
                ResponseStyle::Technical => {
                    params.temperature *= 0.7;
                    params.top_p *= 0.95;
                }
                ResponseStyle::Creative => {
                    params.temperature *= 1.3;
                    params.top_p = (params.top_p * 1.1).min(1.0);
                    params.presence_penalty += 0.2;
                }
                ResponseStyle::Formal => {
                    params.temperature *= 0.6;
                    params.top_k = params.top_k.map(|k| (k * 2 / 3).max(10));
                }
                ResponseStyle::Casual => {
                    params.temperature *= 1.2;
                    params.top_p = (params.top_p * 1.05).min(1.0);
                }
            }
        }
        
        debug!("Selected contextual parameters for {:?}: temp={}, top_p={}", 
               task_type, params.temperature, params.top_p);
        
        params
    }
    
    /// Get default parameters
    fn get_default_parameters(&self) -> OptimalParameters {
        OptimalParameters {
            temperature: 0.7,
            top_p: 0.9,
            top_k: Some(40),
            max_tokens: 1024,
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            repetition_penalty: Some(1.1),
            seed: None,
            stop_sequences: vec![],
            confidence: 0.5,
            reasoning: vec!["Default parameters".to_string()],
            expected_quality: 0.7,
            expected_latency_ms: 1000,
        }
    }
    
    /// Validate and constrain parameters
    pub fn validate_parameters(
        &self,
        params: &mut OptimalParameters,
        constraints: &ParameterConstraints,
    ) {
        // Apply constraints
        params.temperature = params.temperature
            .max(constraints.temperature_range.0)
            .min(constraints.temperature_range.1);
        
        params.top_p = params.top_p
            .max(constraints.top_p_range.0)
            .min(constraints.top_p_range.1);
        
        if let Some(top_k) = params.top_k {
            if let Some((min_k, max_k)) = constraints.top_k_range {
                params.top_k = Some(top_k.max(min_k).min(max_k));
            }
        }
        
        params.max_tokens = params.max_tokens.min(constraints.max_tokens_limit);
        
        params.presence_penalty = params.presence_penalty
            .max(constraints.presence_penalty_range.0)
            .min(constraints.presence_penalty_range.1);
        
        params.frequency_penalty = params.frequency_penalty
            .max(constraints.frequency_penalty_range.0)
            .min(constraints.frequency_penalty_range.1);
    }
}
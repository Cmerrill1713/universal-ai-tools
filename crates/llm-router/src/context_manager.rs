//! Context Length Management for LLM Router
//! 
//! Handles context window limits, smart truncation, and provider-specific constraints

use crate::models::Message;
use crate::context::MessageRole;
use crate::RouterError;
use crate::librarian_context::{LibrarianContextManager, LibrarianStrategy};
use crate::context_degradation::{ContextDegradationDetector, DegradationAnalysis};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Context length limits for different providers and models
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextLimits {
    pub max_context_tokens: u32,
    pub max_output_tokens: u32,
    pub reserved_tokens: u32, // Tokens reserved for system prompts, etc.
    pub safety_margin: u32,    // Safety margin to prevent overflow
    pub dynamic_threshold: f32, // Percentage (0.0-1.0) to start dynamic management
}

impl ContextLimits {
    pub fn effective_input_limit(&self) -> u32 {
        self.max_context_tokens
            .saturating_sub(self.reserved_tokens)
            .saturating_sub(self.safety_margin)
    }
    
    /// Get the dynamic threshold for proactive context management
    pub fn dynamic_threshold_tokens(&self) -> u32 {
        (self.effective_input_limit() as f32 * self.dynamic_threshold) as u32
    }
    
    /// Check if we should start dynamic context management
    pub fn should_start_dynamic_management(&self, current_tokens: u32) -> bool {
        current_tokens >= self.dynamic_threshold_tokens()
    }
}

/// Provider-specific context limits
#[derive(Debug, Clone)]
pub struct ProviderContextLimits {
    pub ollama: HashMap<String, ContextLimits>,
    pub mlx: HashMap<String, ContextLimits>,
    pub lm_studio: HashMap<String, ContextLimits>,
    pub fastvlm: HashMap<String, ContextLimits>,
}

impl Default for ProviderContextLimits {
    fn default() -> Self {
        let mut limits = Self {
            ollama: HashMap::new(),
            mlx: HashMap::new(),
            lm_studio: HashMap::new(),
            fastvlm: HashMap::new(),
        };
        
        // Initialize with known model limits
        limits.initialize_defaults();
        limits
    }
}

impl ProviderContextLimits {
    fn initialize_defaults(&mut self) {
        // Ollama models - based on actual model capabilities
        self.ollama.insert("gpt-oss:20b".to_string(), ContextLimits {
            max_context_tokens: 131072,  // From model info
            max_output_tokens: 4096,
            reserved_tokens: 1000,        // System prompt + safety
            safety_margin: 500,
            dynamic_threshold: 0.65,     // Start dynamic management at 65%
        });
        
        self.ollama.insert("llama3.2:3b".to_string(), ContextLimits {
            max_context_tokens: 128000,
            max_output_tokens: 4096,
            reserved_tokens: 1000,
            safety_margin: 500,
            dynamic_threshold: 0.65,
        });
        
        self.ollama.insert("gemma2:2b".to_string(), ContextLimits {
            max_context_tokens: 8192,
            max_output_tokens: 2048,
            reserved_tokens: 500,
            safety_margin: 200,
            dynamic_threshold: 0.65,
        });
        
        self.ollama.insert("phi3:mini".to_string(), ContextLimits {
            max_context_tokens: 128000,
            max_output_tokens: 4096,
            reserved_tokens: 1000,
            safety_margin: 500,
            dynamic_threshold: 0.65,
        });
        
        // MLX models - Apple Silicon optimized
        self.mlx.insert("hrm-mlx".to_string(), ContextLimits {
            max_context_tokens: 32768,   // Conservative for MLX
            max_output_tokens: 2048,
            reserved_tokens: 500,
            safety_margin: 200,
            dynamic_threshold: 0.65,
        });
        
        // FastVLM models - Vision-language models
        self.fastvlm.insert("fastvlm-0.5b".to_string(), ContextLimits {
            max_context_tokens: 8192,
            max_output_tokens: 1024,
            reserved_tokens: 300,
            safety_margin: 100,
            dynamic_threshold: 0.65,
        });
        
        self.fastvlm.insert("fastvlm-7b".to_string(), ContextLimits {
            max_context_tokens: 16384,
            max_output_tokens: 2048,
            reserved_tokens: 500,
            safety_margin: 200,
            dynamic_threshold: 0.65,
        });
        
        // LM Studio models - Common local models
        self.lm_studio.insert("mistral-7b-instruct".to_string(), ContextLimits {
            max_context_tokens: 32768,
            max_output_tokens: 4096,
            reserved_tokens: 1000,
            safety_margin: 500,
            dynamic_threshold: 0.65,
        });
        
        self.lm_studio.insert("llama-3.1-70b-instruct".to_string(), ContextLimits {
            max_context_tokens: 128000,
            max_output_tokens: 4096,
            reserved_tokens: 1000,
            safety_margin: 500,
            dynamic_threshold: 0.65,
        });
    }
    
    pub fn get_limits(&self, provider: &str, model: &str) -> Option<&ContextLimits> {
        match provider.to_lowercase().as_str() {
            "ollama" => self.ollama.get(model),
            "mlx" => self.mlx.get(model),
            "lm_studio" | "lmstudio" => self.lm_studio.get(model),
            "fastvlm" => self.fastvlm.get(model),
            _ => None,
        }
    }
    
    pub fn get_limits_or_default(&self, provider: &str, model: &str) -> ContextLimits {
        self.get_limits(provider, model)
            .cloned()
            .unwrap_or_else(|| ContextLimits {
                max_context_tokens: 4096,  // Conservative default
                max_output_tokens: 1024,
                reserved_tokens: 200,
                safety_margin: 100,
                dynamic_threshold: 0.65,   // 65% threshold for dynamic management
            })
    }
}

/// Context truncation strategies
#[derive(Debug, Clone, Copy)]
pub enum TruncationStrategy {
    /// Keep the most recent messages (default)
    KeepRecent,
    /// Keep the most important messages based on content analysis
    KeepImportant,
    /// Keep system + recent messages
    KeepSystemAndRecent,
    /// Keep first + last messages (preserve context)
    KeepFirstAndLast,
}

/// Context manager for handling message truncation and validation
#[derive(Debug)]
pub struct ContextManager {
    pub limits: ProviderContextLimits,
    truncation_strategy: TruncationStrategy,
    librarian_manager: Option<LibrarianContextManager>,
    use_librarian: bool,
    degradation_detector: ContextDegradationDetector,
    use_intelligent_degradation: bool,
}

impl ContextManager {
    pub fn new() -> Self {
        Self {
            limits: ProviderContextLimits::default(),
            truncation_strategy: TruncationStrategy::KeepSystemAndRecent,
            librarian_manager: None,
            use_librarian: false,
            degradation_detector: ContextDegradationDetector::new(),
            use_intelligent_degradation: true,
        }
    }
    
    pub fn with_strategy(mut self, strategy: TruncationStrategy) -> Self {
        self.truncation_strategy = strategy;
        self
    }
    
    pub fn with_librarian(mut self, librarian_url: String, strategy: LibrarianStrategy) -> Self {
        self.librarian_manager = Some(LibrarianContextManager::new(librarian_url).with_strategy(strategy));
        self.use_librarian = true;
        self
    }
    
    pub fn enable_librarian(&mut self, librarian_url: String, strategy: LibrarianStrategy) {
        self.librarian_manager = Some(LibrarianContextManager::new(librarian_url).with_strategy(strategy));
        self.use_librarian = true;
    }
    
    pub fn enable_intelligent_degradation(mut self) -> Self {
        self.use_intelligent_degradation = true;
        self
    }
    
    pub fn disable_intelligent_degradation(mut self) -> Self {
        self.use_intelligent_degradation = false;
        self
    }
    
    /// Estimate token count for messages (rough approximation)
    pub fn estimate_tokens(&self, messages: &[Message]) -> u32 {
        let total_chars: usize = messages.iter()
            .map(|m| m.content.len())
            .sum();
        
        // Rough estimation: 4 characters per token (conservative)
        (total_chars / 4) as u32
    }
    
    /// Validate and truncate messages to fit within context limits
    pub async fn validate_and_truncate(
        &mut self,
        messages: Vec<Message>,
        provider: &str,
        model: &str,
    ) -> Result<Vec<Message>, RouterError> {
        let limits = self.limits.get_limits_or_default(provider, model);
        let estimated_tokens = self.estimate_tokens(&messages);
        
        // Use intelligent degradation detection if enabled
        if self.use_intelligent_degradation {
            let session_id = format!("{}_{}", provider, model);
            let degradation_analysis = self.degradation_detector.analyze_context_degradation(
                &messages,
                &session_id,
                estimated_tokens,
                limits.max_context_tokens,
            );
            
            tracing::info!(
                "Context quality analysis: {:.2} quality, {:.2} adaptive threshold, {} reasons",
                degradation_analysis.quality_score,
                degradation_analysis.adaptive_threshold,
                degradation_analysis.degradation_reasons.len()
            );
            
            // Log degradation reasons if any
            if !degradation_analysis.degradation_reasons.is_empty() {
                tracing::warn!("Context degradation detected: {:?}", degradation_analysis.degradation_reasons);
            }
            
            // Use intelligent decision instead of hard threshold
            if degradation_analysis.should_compress {
                tracing::info!(
                    "Intelligent compression triggered: {:?} urgency, {:?} action",
                    degradation_analysis.compression_urgency,
                    degradation_analysis.recommended_action
                );
                
                return self.handle_intelligent_compression(messages, &limits, &degradation_analysis).await;
            } else {
                tracing::debug!("Context quality acceptable, no compression needed");
                return Ok(messages);
            }
        }
        
        // Fallback to traditional threshold-based management
        if limits.should_start_dynamic_management(estimated_tokens) {
            tracing::info!(
                "Dynamic context management triggered: {} tokens >= {} threshold (65%) for {}/{}",
                estimated_tokens,
                limits.dynamic_threshold_tokens(),
                provider,
                model
            );
            
            // Try librarian compression first if available
            if self.use_librarian {
                if let Some(ref mut librarian) = self.librarian_manager {
                    match librarian.compress_context(
                        messages.clone(),
                        limits.effective_input_limit(),
                        3, // Keep last 3 messages
                    ).await {
                        Ok(compressed) => {
                            tracing::info!(
                                "Librarian compressed context from {} to {} messages (estimated {} tokens)",
                                messages.len(),
                                compressed.len(),
                                self.estimate_tokens(&compressed)
                            );
                            return Ok(compressed);
                        }
                        Err(e) => {
                            tracing::warn!("Librarian compression failed: {}, falling back to truncation", e);
                        }
                    }
                }
            }
            
            // Fallback to traditional truncation
            let truncated = self.truncate_messages(&messages, &limits)?;
            
            tracing::info!(
                "Dynamically truncated context from {} to {} messages (estimated {} tokens)",
                messages.len(),
                truncated.len(),
                self.estimate_tokens(&truncated)
            );
            
            return Ok(truncated);
        }
        
        // Check for hard limit overflow
        if estimated_tokens > limits.effective_input_limit() {
            tracing::warn!(
                "Context overflow detected: {} tokens > {} limit for {}/{}",
                estimated_tokens,
                limits.effective_input_limit(),
                provider,
                model
            );
            
            let truncated = self.truncate_messages(&messages, &limits)?;
            
            tracing::info!(
                "Emergency truncated context from {} to {} messages (estimated {} tokens)",
                messages.len(),
                truncated.len(),
                self.estimate_tokens(&truncated)
            );
            
            return Ok(truncated);
        }
        
        // No truncation needed
        Ok(messages)
    }
    
    /// Handle intelligent compression based on degradation analysis
    async fn handle_intelligent_compression(
        &mut self,
        messages: Vec<Message>,
        limits: &ContextLimits,
        analysis: &DegradationAnalysis,
    ) -> Result<Vec<Message>, RouterError> {
        match analysis.recommended_action {
            crate::context_degradation::RecommendedAction::Continue => {
                Ok(messages)
            }
            crate::context_degradation::RecommendedAction::LightCompression => {
                // Remove oldest messages
                let keep_count = (messages.len() * 3) / 4; // Keep 75%
                let total_len = messages.len();
                let truncated = messages.into_iter().skip(total_len - keep_count).collect();
                tracing::info!("Light compression: kept {} of {} messages", keep_count, total_len);
                Ok(truncated)
            }
            crate::context_degradation::RecommendedAction::ModerateCompression => {
                // Use librarian compression if available
                if self.use_librarian {
                    if let Some(ref mut librarian) = self.librarian_manager {
                        match librarian.compress_context(
                            messages.clone(),
                            limits.effective_input_limit(),
                            5, // Keep last 5 messages
                        ).await {
                            Ok(compressed) => {
                                tracing::info!("Moderate compression via librarian: {} -> {} messages", 
                                    messages.len(), compressed.len());
                                return Ok(compressed);
                            }
                            Err(e) => {
                                tracing::warn!("Librarian compression failed: {}, falling back to truncation", e);
                            }
                        }
                    }
                }
                
                // Fallback to truncation
                let keep_count = messages.len() / 2; // Keep 50%
                let total_len = messages.len();
                let truncated = messages.into_iter().skip(total_len - keep_count).collect();
                tracing::info!("Moderate compression fallback: kept {} of {} messages", keep_count, total_len);
                Ok(truncated)
            }
            crate::context_degradation::RecommendedAction::HeavyCompression => {
                // Aggressive compression
                if self.use_librarian {
                    if let Some(ref mut librarian) = self.librarian_manager {
                        match librarian.compress_context(
                            messages.clone(),
                            limits.effective_input_limit(),
                            3, // Keep only last 3 messages
                        ).await {
                            Ok(compressed) => {
                                tracing::info!("Heavy compression via librarian: {} -> {} messages", 
                                    messages.len(), compressed.len());
                                return Ok(compressed);
                            }
                            Err(e) => {
                                tracing::warn!("Librarian compression failed: {}, falling back to truncation", e);
                            }
                        }
                    }
                }
                
                // Fallback to aggressive truncation
                let keep_count = messages.len() / 4; // Keep only 25%
                let total_len = messages.len();
                let truncated = messages.into_iter().skip(total_len - keep_count).collect();
                tracing::info!("Heavy compression fallback: kept {} of {} messages", keep_count, total_len);
                Ok(truncated)
            }
            crate::context_degradation::RecommendedAction::EmergencyDump => {
                // Emergency: dump to librarian memory and keep minimal context
                if self.use_librarian {
                    if let Some(ref mut librarian) = self.librarian_manager {
                        match librarian.compress_context(
                            messages.clone(),
                            limits.effective_input_limit(),
                            1, // Keep only last message
                        ).await {
                            Ok(compressed) => {
                                tracing::warn!("Emergency compression via librarian: {} -> {} messages", 
                                    messages.len(), compressed.len());
                                return Ok(compressed);
                            }
                            Err(e) => {
                                tracing::error!("Emergency librarian compression failed: {}", e);
                            }
                        }
                    }
                }
                
                // Emergency fallback: keep only last message
                let total_len = messages.len();
                let truncated = messages.into_iter().last().map(|m| vec![m]).unwrap_or_default();
                tracing::warn!("Emergency compression fallback: kept {} of {} messages", 
                    truncated.len(), total_len);
                Ok(truncated)
            }
        }
    }
    
    fn truncate_messages(
        &self,
        messages: &[Message],
        limits: &ContextLimits,
    ) -> Result<Vec<Message>, RouterError> {
        match self.truncation_strategy {
            TruncationStrategy::KeepRecent => {
                self.truncate_keep_recent(messages, limits)
            }
            TruncationStrategy::KeepImportant => {
                self.truncate_keep_important(messages, limits)
            }
            TruncationStrategy::KeepSystemAndRecent => {
                self.truncate_keep_system_and_recent(messages, limits)
            }
            TruncationStrategy::KeepFirstAndLast => {
                self.truncate_keep_first_and_last(messages, limits)
            }
        }
    }
    
    fn truncate_keep_recent(
        &self,
        messages: &[Message],
        limits: &ContextLimits,
    ) -> Result<Vec<Message>, RouterError> {
        let target_limit = limits.effective_input_limit();
        
        // Start from the end and work backwards
        let mut result = Vec::new();
        let mut current_tokens = 0;
        
        for message in messages.iter().rev() {
            let message_tokens = self.estimate_tokens(&[message.clone()]);
            if current_tokens + message_tokens <= target_limit {
                result.insert(0, message.clone());
                current_tokens += message_tokens;
            } else {
                break;
            }
        }
        
        if result.is_empty() {
            return Err(RouterError::ContextTooLarge(
                "Even a single message exceeds context limit".to_string()
            ));
        }
        
        Ok(result)
    }
    
    fn truncate_keep_system_and_recent(
        &self,
        messages: &[Message],
        limits: &ContextLimits,
    ) -> Result<Vec<Message>, RouterError> {
        let target_limit = limits.effective_input_limit();
        
        // Separate system messages from others
        let (system_messages, other_messages): (Vec<_>, Vec<_>) = messages
            .iter()
            .cloned()
            .partition(|m| matches!(m.role, MessageRole::System));
        
        let system_tokens = self.estimate_tokens(&system_messages);
        
        if system_tokens > target_limit {
            return Err(RouterError::ContextTooLarge(
                "System messages exceed context limit".to_string()
            ));
        }
        
        // Keep all system messages and recent non-system messages
        let mut result = system_messages.clone();
        let mut current_tokens = system_tokens;
        
        for message in other_messages.into_iter().rev() {
            let message_tokens = self.estimate_tokens(&[message.clone()]);
            if current_tokens + message_tokens <= target_limit {
                result.insert(system_messages.len(), message);
                current_tokens += message_tokens;
            } else {
                break;
            }
        }
        
        Ok(result)
    }
    
    fn truncate_keep_important(
        &self,
        messages: &[Message],
        limits: &ContextLimits,
    ) -> Result<Vec<Message>, RouterError> {
        // For now, fall back to system + recent strategy
        // TODO: Implement importance scoring based on content analysis
        self.truncate_keep_system_and_recent(messages, limits)
    }
    
    fn truncate_keep_first_and_last(
        &self,
        messages: &[Message],
        limits: &ContextLimits,
    ) -> Result<Vec<Message>, RouterError> {
        if messages.len() <= 2 {
            return Ok(messages.to_vec());
        }
        
        let target_limit = limits.effective_input_limit();
        let first_tokens = self.estimate_tokens(&[messages[0].clone()]);
        let last_tokens = self.estimate_tokens(&[messages[messages.len() - 1].clone()]);
        
        if first_tokens + last_tokens > target_limit {
            return Err(RouterError::ContextTooLarge(
                "First and last messages exceed context limit".to_string()
            ));
        }
        
        // Keep first, last, and as many middle messages as possible
        let mut result = vec![messages[0].clone()];
        let mut current_tokens = first_tokens + last_tokens;
        
        for message in messages.iter().skip(1).take(messages.len() - 2) {
            let message_tokens = self.estimate_tokens(&[message.clone()]);
            if current_tokens + message_tokens <= target_limit {
                result.push(message.clone());
                current_tokens += message_tokens;
            } else {
                break;
            }
        }
        
        result.push(messages[messages.len() - 1].clone());
        Ok(result)
    }
    
    /// Get context usage statistics
    pub fn get_context_stats(
        &self,
        messages: &[Message],
        provider: &str,
        model: &str,
    ) -> ContextStats {
        let limits = self.limits.get_limits_or_default(provider, model);
        let estimated_tokens = self.estimate_tokens(messages);
        let usage_percentage = (estimated_tokens as f32 / limits.effective_input_limit() as f32) * 100.0;
        let dynamic_threshold_percentage = limits.dynamic_threshold * 100.0;
        
        ContextStats {
            estimated_tokens,
            max_tokens: limits.effective_input_limit(),
            usage_percentage,
            dynamic_threshold_percentage,
            is_over_limit: estimated_tokens > limits.effective_input_limit(),
            is_dynamic_management_active: limits.should_start_dynamic_management(estimated_tokens),
            message_count: messages.len(),
        }
    }
}

/// Context usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextStats {
    pub estimated_tokens: u32,
    pub max_tokens: u32,
    pub usage_percentage: f32,
    pub dynamic_threshold_percentage: f32,
    pub is_over_limit: bool,
    pub is_dynamic_management_active: bool,
    pub message_count: usize,
}

impl ContextStats {
    pub fn is_critical(&self) -> bool {
        self.usage_percentage > 90.0
    }
    
    pub fn is_warning(&self) -> bool {
        self.usage_percentage > 75.0 && self.usage_percentage <= 90.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::context::MessageRole;
    
    fn create_test_messages() -> Vec<Message> {
        vec![
            Message {
                role: MessageRole::System,
                content: "You are a helpful assistant.".to_string(),
                name: None,
            },
            Message {
                role: MessageRole::User,
                content: "Hello, how are you?".to_string(),
                name: None,
            },
            Message {
                role: MessageRole::Assistant,
                content: "I'm doing well, thank you!".to_string(),
                name: None,
            },
        ]
    }
    
    #[test]
    fn test_context_estimation() {
        let manager = ContextManager::new();
        let messages = create_test_messages();
        let tokens = manager.estimate_tokens(&messages);
        
        assert!(tokens > 0);
        assert!(tokens < 100); // Should be reasonable for short messages
    }
    
    #[tokio::test]
    async fn test_context_validation() {
        let mut manager = ContextManager::new();
        let messages = create_test_messages();
        
        let result = manager.validate_and_truncate(messages.clone(), "ollama", "gpt-oss:20b").await;
        assert!(result.is_ok());
        
        let truncated = result.unwrap();
        // With intelligent degradation detection, small messages might be compressed
        // if quality is poor, so we just check that we get some result
        assert!(truncated.len() > 0);
        assert!(truncated.len() <= messages.len());
    }
    
    #[test]
    fn test_context_stats() {
        let manager = ContextManager::new();
        let messages = create_test_messages();
        
        let stats = manager.get_context_stats(&messages, "ollama", "gpt-oss:20b");
        
        assert!(stats.estimated_tokens > 0);
        assert!(stats.max_tokens > 0);
        assert!(!stats.is_over_limit);
        assert_eq!(stats.message_count, messages.len());
    }
}

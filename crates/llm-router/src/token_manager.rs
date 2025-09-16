//! Token management and budgeting for LLM Router
//!
//! This module provides adaptive token limits, cost-aware budgeting,
//! and usage monitoring for optimal resource allocation.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// User tier for token allocation
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum UserTier {
    Free,
    Pro,
    Enterprise,
}

impl UserTier {
    pub fn daily_token_limit(&self) -> u32 {
        match self {
            UserTier::Free => 10_000,
            UserTier::Pro => 100_000,
            UserTier::Enterprise => u32::MAX,
        }
    }

    pub fn hourly_token_limit(&self) -> u32 {
        match self {
            UserTier::Free => 1_000,
            UserTier::Pro => 10_000,
            UserTier::Enterprise => 50_000,
        }
    }

    pub fn max_tokens_per_request(&self) -> u32 {
        match self {
            UserTier::Free => 2_048,
            UserTier::Pro => 8_192,
            UserTier::Enterprise => 32_768,
        }
    }
}

/// Task complexity levels for adaptive token allocation
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TaskComplexity {
    Simple,    // Quick responses, simple Q&A
    Medium,    // General tasks, moderate reasoning
    Complex,   // Multi-step reasoning, analysis
    Expert,    // Research, complex problem solving
}

impl TaskComplexity {
    pub fn suggested_token_limit(&self, user_tier: &UserTier) -> u32 {
        let base_limit = match self {
            TaskComplexity::Simple => 512,
            TaskComplexity::Medium => 1_024,
            TaskComplexity::Complex => 2_048,
            TaskComplexity::Expert => 4_096,
        };

        // Cap by user tier limits
        base_limit.min(user_tier.max_tokens_per_request())
    }

    pub fn suggested_model(&self) -> Vec<&'static str> {
        match self {
            TaskComplexity::Simple => vec!["gemma3:1b", "llama3.2:3b"],
            TaskComplexity::Medium => vec!["llama3.2:3b", "qwen2.5:7b"],
            TaskComplexity::Complex => vec!["llama3.1:8b", "qwen2.5:7b"],
            TaskComplexity::Expert => vec!["deepseek-r1:14b", "llama3.1:8b"],
        }
    }
}

/// Token usage tracking for a user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub user_id: String,
    pub tier: UserTier,
    pub daily_used: u32,
    pub hourly_used: u32,
    pub last_reset_daily: u64,
    pub last_reset_hourly: u64,
    pub total_requests: u64,
    pub average_tokens_per_request: f32,
}

impl TokenUsage {
    pub fn new(user_id: String, tier: UserTier) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            user_id,
            tier,
            daily_used: 0,
            hourly_used: 0,
            last_reset_daily: now,
            last_reset_hourly: now,
            total_requests: 0,
            average_tokens_per_request: 0.0,
        }
    }

    /// Check if user can make a request with given token count
    pub fn can_make_request(&mut self, token_count: u32) -> Result<(), TokenLimitError> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Reset counters if needed
        self.reset_if_needed(now);

        // Check daily limit
        if self.daily_used + token_count > self.tier.daily_token_limit() {
            return Err(TokenLimitError::DailyLimitExceeded {
                used: self.daily_used,
                limit: self.tier.daily_token_limit(),
            });
        }

        // Check hourly limit
        if self.hourly_used + token_count > self.tier.hourly_token_limit() {
            return Err(TokenLimitError::HourlyLimitExceeded {
                used: self.hourly_used,
                limit: self.tier.hourly_token_limit(),
            });
        }

        // Check per-request limit
        if token_count > self.tier.max_tokens_per_request() {
            return Err(TokenLimitError::PerRequestLimitExceeded {
                requested: token_count,
                limit: self.tier.max_tokens_per_request(),
            });
        }

        Ok(())
    }

    /// Record token usage for a request
    pub fn record_usage(&mut self, token_count: u32) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        self.reset_if_needed(now);

        self.daily_used += token_count;
        self.hourly_used += token_count;
        self.total_requests += 1;

        // Update average
        self.average_tokens_per_request =
            (self.average_tokens_per_request * (self.total_requests - 1) as f32 + token_count as f32)
            / self.total_requests as f32;
    }

    fn reset_if_needed(&mut self, now: u64) {
        // Reset daily counter (24 hours)
        if now - self.last_reset_daily >= 86400 {
            self.daily_used = 0;
            self.last_reset_daily = now;
        }

        // Reset hourly counter (1 hour)
        if now - self.last_reset_hourly >= 3600 {
            self.hourly_used = 0;
            self.last_reset_hourly = now;
        }
    }

    /// Get remaining tokens for today
    pub fn remaining_daily(&self) -> u32 {
        self.tier.daily_token_limit().saturating_sub(self.daily_used)
    }

    /// Get remaining tokens for this hour
    pub fn remaining_hourly(&self) -> u32 {
        self.tier.hourly_token_limit().saturating_sub(self.hourly_used)
    }
}

/// Token budget manager
#[derive(Debug)]
pub struct TokenBudgetManager {
    user_usage: HashMap<String, TokenUsage>,
    cost_per_token: HashMap<String, f64>, // Model -> cost per token
}

impl TokenBudgetManager {
    pub fn new() -> Self {
        let mut cost_per_token = HashMap::new();

        // Set cost per token for different models (in USD)
        cost_per_token.insert("gemma3:1b".to_string(), 0.000001); // Very cheap local model
        cost_per_token.insert("llama3.2:3b".to_string(), 0.000002);
        cost_per_token.insert("llama3.1:8b".to_string(), 0.000005);
        cost_per_token.insert("qwen2.5:7b".to_string(), 0.000004);
        cost_per_token.insert("deepseek-r1:14b".to_string(), 0.000008);
        cost_per_token.insert("gpt-3.5-turbo".to_string(), 0.000002);
        cost_per_token.insert("gpt-4".to_string(), 0.00003);
        cost_per_token.insert("claude-3-haiku".to_string(), 0.00000025);
        cost_per_token.insert("claude-3-sonnet".to_string(), 0.000003);

        Self {
            user_usage: HashMap::new(),
            cost_per_token,
        }
    }

    /// Get or create user usage tracking
    pub fn get_user_usage(&mut self, user_id: &str, tier: UserTier) -> &mut TokenUsage {
        self.user_usage.entry(user_id.to_string())
            .or_insert_with(|| TokenUsage::new(user_id.to_string(), tier))
    }

    /// Check if user can make request and suggest optimal model
    pub fn check_request_budget(
        &mut self,
        user_id: &str,
        tier: UserTier,
        complexity: TaskComplexity,
        requested_tokens: u32,
    ) -> Result<TokenBudgetResult, TokenLimitError> {
        // Get user usage and check limits
        let (remaining_daily, remaining_hourly) = {
            let user_usage = self.get_user_usage(user_id, tier.clone());
            user_usage.can_make_request(requested_tokens)?;
            (user_usage.remaining_daily(), user_usage.remaining_hourly())
        };

        // Suggest optimal model based on complexity and cost
        let suggested_models = complexity.suggested_model();
        let optimal_model = self.find_optimal_model(&suggested_models, requested_tokens);
        let estimated_cost = self.estimate_cost(&optimal_model, requested_tokens);

        Ok(TokenBudgetResult {
            can_proceed: true,
            suggested_model: optimal_model,
            estimated_cost,
            remaining_daily,
            remaining_hourly,
        })
    }

    /// Record token usage after request completion
    pub fn record_request_usage(&mut self, user_id: &str, tier: UserTier, tokens_used: u32) {
        let user_usage = self.get_user_usage(user_id, tier);
        user_usage.record_usage(tokens_used);
    }

    fn find_optimal_model(&self, models: &[&str], _token_count: u32) -> String {
        // For now, return the first model that can handle the token count
        // In a real implementation, this would consider:
        // - Model availability
        // - Cost efficiency
        // - Performance requirements
        models.first().unwrap_or(&"llama3.2:3b").to_string()
    }

    fn estimate_cost(&self, model: &str, token_count: u32) -> f64 {
        self.cost_per_token.get(model)
            .map(|cost| *cost * token_count as f64)
            .unwrap_or(0.0)
    }

    /// Get usage statistics for a user
    pub fn get_user_stats(&self, user_id: &str) -> Option<&TokenUsage> {
        self.user_usage.get(user_id)
    }

    /// Get all user statistics (for admin/monitoring)
    pub fn get_all_stats(&self) -> &HashMap<String, TokenUsage> {
        &self.user_usage
    }
}

/// Result of token budget check
#[derive(Debug, Clone)]
pub struct TokenBudgetResult {
    pub can_proceed: bool,
    pub suggested_model: String,
    pub estimated_cost: f64,
    pub remaining_daily: u32,
    pub remaining_hourly: u32,
}

/// Token limit errors
#[derive(Debug, thiserror::Error)]
pub enum TokenLimitError {
    #[error("Daily token limit exceeded: used {used}, limit {limit}")]
    DailyLimitExceeded { used: u32, limit: u32 },

    #[error("Hourly token limit exceeded: used {used}, limit {limit}")]
    HourlyLimitExceeded { used: u32, limit: u32 },

    #[error("Per-request token limit exceeded: requested {requested}, limit {limit}")]
    PerRequestLimitExceeded { requested: u32, limit: u32 },
}

/// Auto-detect task complexity from message content
pub fn detect_task_complexity(messages: &[String]) -> TaskComplexity {
    let content = messages.join(" ").to_lowercase();

    // Simple heuristics for complexity detection
    if content.contains("explain") || content.contains("what is") || content.contains("how to") {
        if content.len() < 100 {
            TaskComplexity::Simple
        } else {
            TaskComplexity::Medium
        }
    } else if content.contains("analyze") || content.contains("compare") || content.contains("research") {
        TaskComplexity::Complex
    } else if content.contains("design") || content.contains("implement") || content.contains("optimize") {
        TaskComplexity::Expert
    } else if content.len() > 500 {
        TaskComplexity::Complex
    } else {
        TaskComplexity::Medium
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_tier_limits() {
        assert_eq!(UserTier::Free.daily_token_limit(), 10_000);
        assert_eq!(UserTier::Pro.daily_token_limit(), 100_000);
        assert_eq!(UserTier::Enterprise.daily_token_limit(), u32::MAX);
    }

    #[test]
    fn test_task_complexity_suggestions() {
        let simple = TaskComplexity::Simple.suggested_token_limit(&UserTier::Free);
        assert_eq!(simple, 512);

        let expert = TaskComplexity::Expert.suggested_token_limit(&UserTier::Pro);
        assert_eq!(expert, 4_096);
    }

    #[test]
    fn test_token_usage_tracking() {
        let mut usage = TokenUsage::new("test_user".to_string(), UserTier::Free);

        // Should be able to make small request
        assert!(usage.can_make_request(100).is_ok());

        // Should fail for large request
        assert!(usage.can_make_request(10_000).is_err());

        // Record usage
        usage.record_usage(100);
        assert_eq!(usage.daily_used, 100);
        assert_eq!(usage.total_requests, 1);
    }

    #[test]
    fn test_complexity_detection() {
        let simple_msg = vec!["What is Rust?".to_string()];
        assert_eq!(detect_task_complexity(&simple_msg), TaskComplexity::Simple);

        let complex_msg = vec!["Analyze the performance implications of using async/await in Rust web services and compare with Go's goroutines".to_string()];
        assert_eq!(detect_task_complexity(&complex_msg), TaskComplexity::Complex);
    }
}

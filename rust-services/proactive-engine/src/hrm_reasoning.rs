use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, info, warn, instrument};

use crate::config::ProactiveConfig;
use crate::{Suggestion, SuggestedAction, SystemContext};

/// HRM (Human Resource Management) Reasoning Engine
/// Provides contextual reasoning and decision-making capabilities for proactive suggestions
#[derive(Clone)]
pub struct HRMReasoningEngine {
    config: ProactiveConfig,
    client: Client,
    reasoning_patterns: std::sync::Arc<std::sync::RwLock<Vec<ReasoningPattern>>>,
    decision_history: std::sync::Arc<std::sync::RwLock<Vec<DecisionRecord>>>,
}

/// Reasoning pattern for contextual decision making
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningPattern {
    pub pattern_id: String,
    pub name: String,
    pub reasoning_type: ReasoningType,
    pub context_weights: HashMap<String, f32>,
    pub decision_threshold: f32,
    pub confidence_multiplier: f32,
    pub reasoning_template: String,
    pub success_rate: f32,
    pub usage_count: u32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReasoningType {
    Productivity,      // Productivity-focused reasoning
    Wellness,         // User wellness and break suggestions
    SystemHealth,     // System optimization and health
    TaskManagement,   // Task prioritization and management
    LearningPattern,  // Pattern learning from user behavior
    ContextualTiming, // Timing-based contextual suggestions
}

/// Decision record for learning and improvement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionRecord {
    pub decision_id: String,
    pub pattern_id: String,
    pub context_at_decision: SystemContext,
    pub reasoning_chain: Vec<ReasoningStep>,
    pub confidence_score: f32,
    pub final_decision: String,
    pub user_feedback: Option<UserFeedback>,
    pub outcome_score: Option<f32>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningStep {
    pub step_id: String,
    pub reasoning_text: String,
    pub factors_considered: Vec<String>,
    pub weight_applied: f32,
    pub intermediate_confidence: f32,
    pub step_type: String, // "analysis", "synthesis", "evaluation", "decision"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFeedback {
    pub feedback_type: String, // "accepted", "modified", "rejected", "ignored"
    pub rating: Option<i32>,   // 1-5 scale
    pub comments: Option<String>,
    pub alternative_action: Option<String>,
}

/// Enhanced suggestion with reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasonedSuggestion {
    pub base_suggestion: Suggestion,
    pub reasoning_chain: Vec<ReasoningStep>,
    pub confidence_explanation: String,
    pub alternative_approaches: Vec<String>,
    pub expected_outcomes: Vec<String>,
    pub risk_assessment: RiskAssessment,
    pub timing_rationale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskAssessment {
    pub risk_level: String, // "low", "medium", "high"
    pub potential_issues: Vec<String>,
    pub mitigation_strategies: Vec<String>,
    pub confidence_in_assessment: f32,
}

impl HRMReasoningEngine {
    pub async fn new(config: &ProactiveConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.server.timeout_seconds))
            .build()
            .context("Failed to create HTTP client for HRM reasoning")?;

        let reasoning_patterns = Self::load_default_reasoning_patterns();

        Ok(Self {
            config: config.clone(),
            client,
            reasoning_patterns: std::sync::Arc::new(std::sync::RwLock::new(reasoning_patterns)),
            decision_history: std::sync::Arc::new(std::sync::RwLock::new(Vec::new())),
        })
    }

    /// Apply HRM reasoning to enhance a basic suggestion
    #[instrument(skip(self, suggestion, context))]
    pub async fn reason_about_suggestion(
        &self,
        suggestion: &Suggestion,
        context: &SystemContext,
    ) -> Result<ReasonedSuggestion> {
        info!("🧠 Applying HRM reasoning to suggestion: {}", suggestion.title);

        // Select relevant reasoning patterns
        let applicable_patterns = self.select_applicable_patterns(suggestion, context).await;
        
        // Generate reasoning chain
        let reasoning_chain = self.generate_reasoning_chain(
            suggestion,
            context,
            &applicable_patterns,
        ).await?;

        // Calculate enhanced confidence
        let enhanced_confidence = self.calculate_enhanced_confidence(
            suggestion.confidence,
            &reasoning_chain,
            context,
        );

        // Generate explanations
        let confidence_explanation = self.generate_confidence_explanation(
            &reasoning_chain,
            enhanced_confidence,
        );

        // Assess risks
        let risk_assessment = self.assess_suggestion_risks(suggestion, context, &reasoning_chain).await;

        // Generate alternatives
        let alternative_approaches = self.generate_alternative_approaches(
            suggestion,
            context,
            &reasoning_chain,
        ).await;

        // Predict outcomes
        let expected_outcomes = self.predict_outcomes(suggestion, context, &reasoning_chain).await;

        // Generate timing rationale
        let timing_rationale = self.generate_timing_rationale(context, &reasoning_chain);

        // Create enhanced suggestion
        let mut enhanced_suggestion = suggestion.clone();
        enhanced_suggestion.confidence = enhanced_confidence;

        let reasoned_suggestion = ReasonedSuggestion {
            base_suggestion: enhanced_suggestion,
            reasoning_chain,
            confidence_explanation,
            alternative_approaches,
            expected_outcomes,
            risk_assessment,
            timing_rationale,
        };

        // Record decision for learning
        let decision_record = DecisionRecord {
            decision_id: uuid::Uuid::new_v4().to_string(),
            pattern_id: "hrm_reasoning".to_string(),
            context_at_decision: context.clone(),
            reasoning_chain: reasoned_suggestion.reasoning_chain.clone(),
            confidence_score: enhanced_confidence,
            final_decision: suggestion.suggestion_type.clone(),
            user_feedback: None,
            outcome_score: None,
            timestamp: Utc::now(),
        };

        {
            let mut history = self.decision_history.write().unwrap();
            history.push(decision_record);
            
            // Keep only recent decisions (last 1000)
            if history.len() > 1000 {
                history.drain(0..100);
            }
        }

        info!("✨ Enhanced suggestion with reasoning - confidence: {:.2} → {:.2}", 
              suggestion.confidence, enhanced_confidence);

        Ok(reasoned_suggestion)
    }

    /// Select applicable reasoning patterns based on context
    async fn select_applicable_patterns(
        &self,
        suggestion: &Suggestion,
        context: &SystemContext,
    ) -> Vec<ReasoningPattern> {
        let patterns = self.reasoning_patterns.read().unwrap();
        
        patterns
            .iter()
            .filter(|pattern| pattern.enabled)
            .filter(|pattern| self.pattern_matches_context(pattern, suggestion, context))
            .cloned()
            .collect()
    }

    /// Check if a reasoning pattern matches the current context
    fn pattern_matches_context(
        &self,
        pattern: &ReasoningPattern,
        suggestion: &Suggestion,
        context: &SystemContext,
    ) -> bool {
        match pattern.reasoning_type {
            ReasoningType::Productivity => {
                suggestion.suggestion_type.contains("productivity") ||
                context.time_of_day == "morning" || 
                context.time_of_day == "afternoon"
            }
            ReasoningType::Wellness => {
                suggestion.suggestion_type.contains("break") ||
                suggestion.suggestion_type.contains("wellness") ||
                context.user_activity_level == "busy"
            }
            ReasoningType::SystemHealth => {
                suggestion.suggestion_type.contains("system") ||
                context.cpu_usage > 70.0 ||
                context.memory_usage > 80.0
            }
            ReasoningType::TaskManagement => {
                suggestion.suggestion_type.contains("task") ||
                !context.current_tasks.is_empty()
            }
            ReasoningType::LearningPattern => true, // Always applicable for learning
            ReasoningType::ContextualTiming => true, // Always applicable for timing
        }
    }

    /// Generate reasoning chain with multiple steps
    async fn generate_reasoning_chain(
        &self,
        suggestion: &Suggestion,
        context: &SystemContext,
        patterns: &[ReasoningPattern],
    ) -> Result<Vec<ReasoningStep>> {
        let mut reasoning_chain = Vec::new();

        // Step 1: Context Analysis
        reasoning_chain.push(ReasoningStep {
            step_id: uuid::Uuid::new_v4().to_string(),
            reasoning_text: format!(
                "Analyzing current context: CPU {:.1}%, Memory {:.1}%, Activity: {}, Time: {}",
                context.cpu_usage, context.memory_usage, 
                context.user_activity_level, context.time_of_day
            ),
            factors_considered: vec![
                "system_performance".to_string(),
                "user_activity".to_string(),
                "time_context".to_string(),
                "active_applications".to_string(),
            ],
            weight_applied: 0.25,
            intermediate_confidence: suggestion.confidence * 0.25,
            step_type: "analysis".to_string(),
        });

        // Step 2: Pattern Matching
        let pattern_names: Vec<String> = patterns.iter().map(|p| p.name.clone()).collect();
        reasoning_chain.push(ReasoningStep {
            step_id: uuid::Uuid::new_v4().to_string(),
            reasoning_text: format!(
                "Matched {} relevant reasoning patterns: {}",
                patterns.len(),
                pattern_names.join(", ")
            ),
            factors_considered: vec![
                "historical_patterns".to_string(),
                "pattern_success_rates".to_string(),
                "context_similarity".to_string(),
            ],
            weight_applied: 0.3,
            intermediate_confidence: suggestion.confidence * 0.55,
            step_type: "synthesis".to_string(),
        });

        // Step 3: User Behavior Analysis
        reasoning_chain.push(ReasoningStep {
            step_id: uuid::Uuid::new_v4().to_string(),
            reasoning_text: format!(
                "User typically {} during {} hours with {} activity level",
                self.infer_user_preference(context),
                context.time_of_day,
                context.user_activity_level
            ),
            factors_considered: vec![
                "user_preferences".to_string(),
                "historical_acceptance".to_string(),
                "behavioral_patterns".to_string(),
            ],
            weight_applied: 0.25,
            intermediate_confidence: suggestion.confidence * 0.8,
            step_type: "analysis".to_string(),
        });

        // Step 4: Decision Evaluation
        reasoning_chain.push(ReasoningStep {
            step_id: uuid::Uuid::new_v4().to_string(),
            reasoning_text: format!(
                "Evaluating suggestion '{}' with priority {} for immediate applicability",
                suggestion.title, suggestion.priority
            ),
            factors_considered: vec![
                "suggestion_relevance".to_string(),
                "timing_appropriateness".to_string(),
                "expected_user_response".to_string(),
            ],
            weight_applied: 0.2,
            intermediate_confidence: suggestion.confidence,
            step_type: "evaluation".to_string(),
        });

        Ok(reasoning_chain)
    }

    /// Calculate enhanced confidence based on reasoning
    fn calculate_enhanced_confidence(
        &self,
        base_confidence: f32,
        reasoning_chain: &[ReasoningStep],
        context: &SystemContext,
    ) -> f32 {
        let mut enhanced_confidence = base_confidence;

        // Apply reasoning step weights
        for step in reasoning_chain {
            enhanced_confidence += step.weight_applied * step.intermediate_confidence;
        }

        // Apply context modifiers
        if context.user_activity_level == "active" {
            enhanced_confidence *= 1.1; // Boost for active users
        }

        if context.time_of_day == "morning" {
            enhanced_confidence *= 1.05; // Morning productivity boost
        }

        // Clamp to valid range
        enhanced_confidence.clamp(0.0, 1.0)
    }

    /// Generate human-readable confidence explanation
    fn generate_confidence_explanation(
        &self,
        reasoning_chain: &[ReasoningStep],
        final_confidence: f32,
    ) -> String {
        let mut explanation = format!(
            "This suggestion has {:.0}% confidence based on: ",
            final_confidence * 100.0
        );

        let key_factors: Vec<String> = reasoning_chain
            .iter()
            .flat_map(|step| step.factors_considered.clone())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .take(3)
            .collect();

        explanation.push_str(&key_factors.join(", "));
        explanation.push_str(&format!(
            ". The reasoning process evaluated {} key factors through systematic analysis.",
            reasoning_chain.len()
        ));

        explanation
    }

    /// Assess potential risks of the suggestion
    async fn assess_suggestion_risks(
        &self,
        suggestion: &Suggestion,
        context: &SystemContext,
        reasoning_chain: &[ReasoningStep],
    ) -> RiskAssessment {
        let mut potential_issues = Vec::new();
        let mut mitigation_strategies = Vec::new();
        let mut risk_level = "low";

        // Analyze system state risks
        if context.cpu_usage > 80.0 {
            potential_issues.push("High CPU usage may affect system responsiveness".to_string());
            mitigation_strategies.push("Monitor system performance during action execution".to_string());
            risk_level = "medium";
        }

        if context.memory_usage > 90.0 {
            potential_issues.push("High memory usage may cause system instability".to_string());
            mitigation_strategies.push("Consider deferring memory-intensive actions".to_string());
            risk_level = "high";
        }

        // Analyze timing risks
        if context.time_of_day == "night" && suggestion.suggestion_type.contains("productivity") {
            potential_issues.push("Productivity suggestions at night may not be well-received".to_string());
            mitigation_strategies.push("Schedule suggestion for morning hours".to_string());
        }

        // Analyze user activity risks
        if context.user_activity_level == "idle" && suggestion.actions.len() > 2 {
            potential_issues.push("Complex actions may be overwhelming for idle users".to_string());
            mitigation_strategies.push("Simplify action set or provide step-by-step guidance".to_string());
        }

        let confidence_in_assessment = reasoning_chain
            .iter()
            .map(|step| step.intermediate_confidence)
            .sum::<f32>() / reasoning_chain.len() as f32;

        RiskAssessment {
            risk_level: risk_level.to_string(),
            potential_issues,
            mitigation_strategies,
            confidence_in_assessment,
        }
    }

    /// Generate alternative approaches
    async fn generate_alternative_approaches(
        &self,
        suggestion: &Suggestion,
        context: &SystemContext,
        reasoning_chain: &[ReasoningStep],
    ) -> Vec<String> {
        let mut alternatives = Vec::new();

        // Time-based alternatives
        if context.time_of_day == "evening" {
            alternatives.push("Schedule this suggestion for tomorrow morning".to_string());
        }

        // Complexity alternatives
        if suggestion.actions.len() > 3 {
            alternatives.push("Break this into smaller, sequential suggestions".to_string());
        }

        // Context-based alternatives
        if context.user_activity_level == "busy" {
            alternatives.push("Defer until user activity level decreases".to_string());
            alternatives.push("Provide quick-action alternative with minimal steps".to_string());
        }

        // System-based alternatives
        if context.cpu_usage > 70.0 {
            alternatives.push("Wait for system load to decrease before suggesting resource-intensive actions".to_string());
        }

        alternatives
    }

    /// Predict expected outcomes
    async fn predict_outcomes(
        &self,
        suggestion: &Suggestion,
        context: &SystemContext,
        reasoning_chain: &[ReasoningStep],
    ) -> Vec<String> {
        let mut outcomes = Vec::new();

        // Predict based on suggestion type
        match suggestion.suggestion_type.as_str() {
            "system_optimization" => {
                outcomes.push(format!("Potential CPU reduction: {:.1}%", 
                                    (context.cpu_usage * 0.2).min(15.0)));
                outcomes.push("Improved system responsiveness".to_string());
            }
            "break_reminder" | "wellness" => {
                outcomes.push("Reduced eye strain and improved focus".to_string());
                outcomes.push("Better long-term productivity maintenance".to_string());
            }
            "productivity" => {
                outcomes.push("Estimated 15-30% productivity improvement".to_string());
                outcomes.push("Better task organization and focus".to_string());
            }
            _ => {
                outcomes.push("Contextually appropriate user assistance".to_string());
            }
        }

        // Add confidence-based outcome
        if suggestion.confidence > 0.8 {
            outcomes.push("High likelihood of positive user reception".to_string());
        }

        outcomes
    }

    /// Generate timing rationale
    fn generate_timing_rationale(&self, context: &SystemContext, reasoning_chain: &[ReasoningStep]) -> String {
        format!(
            "Optimal timing based on: current {} activity during {} hours, with system load at {:.1}% CPU and {:.1}% memory. Analysis shows {} factors supporting immediate presentation.",
            context.user_activity_level,
            context.time_of_day,
            context.cpu_usage,
            context.memory_usage,
            reasoning_chain.len()
        )
    }

    /// Infer user preference based on context
    fn infer_user_preference(&self, context: &SystemContext) -> String {
        match (context.user_activity_level.as_str(), context.time_of_day.as_str()) {
            ("active", "morning") => "prefers productivity-focused suggestions".to_string(),
            ("active", "afternoon") => "responds well to task optimization".to_string(),
            ("active", "evening") => "may appreciate wellness reminders".to_string(),
            ("idle", _) => "benefits from gentle engagement prompts".to_string(),
            ("busy", _) => "prefers minimal interruption with quick actions".to_string(),
            _ => "shows varied response patterns".to_string(),
        }
    }

    /// Record user feedback for learning
    pub async fn record_feedback(
        &self,
        decision_id: &str,
        feedback: UserFeedback,
        outcome_score: Option<f32>,
    ) -> Result<()> {
        let mut history = self.decision_history.write().unwrap();
        
        if let Some(decision) = history.iter_mut().find(|d| d.decision_id == decision_id) {
            decision.user_feedback = Some(feedback);
            decision.outcome_score = outcome_score;
            
            info!("📝 Recorded feedback for decision {}", decision_id);
        }

        Ok(())
    }

    /// Load default reasoning patterns
    fn load_default_reasoning_patterns() -> Vec<ReasoningPattern> {
        vec![
            ReasoningPattern {
                pattern_id: "productivity_morning".to_string(),
                name: "Morning Productivity Pattern".to_string(),
                reasoning_type: ReasoningType::Productivity,
                context_weights: {
                    let mut weights = HashMap::new();
                    weights.insert("time_of_day".to_string(), 0.3);
                    weights.insert("user_activity".to_string(), 0.25);
                    weights.insert("system_load".to_string(), 0.2);
                    weights.insert("historical_success".to_string(), 0.25);
                    weights
                },
                decision_threshold: 0.6,
                confidence_multiplier: 1.2,
                reasoning_template: "Users are typically most receptive to productivity suggestions during morning hours".to_string(),
                success_rate: 0.78,
                usage_count: 0,
                enabled: true,
            },
            ReasoningPattern {
                pattern_id: "wellness_busy_user".to_string(),
                name: "Busy User Wellness Pattern".to_string(),
                reasoning_type: ReasoningType::Wellness,
                context_weights: {
                    let mut weights = HashMap::new();
                    weights.insert("user_activity".to_string(), 0.4);
                    weights.insert("continuous_work_duration".to_string(), 0.3);
                    weights.insert("break_history".to_string(), 0.3);
                    weights
                },
                decision_threshold: 0.7,
                confidence_multiplier: 1.15,
                reasoning_template: "Active users benefit from proactive wellness reminders to maintain productivity".to_string(),
                success_rate: 0.72,
                usage_count: 0,
                enabled: true,
            },
            ReasoningPattern {
                pattern_id: "system_health_monitoring".to_string(),
                name: "System Health Monitoring Pattern".to_string(),
                reasoning_type: ReasoningType::SystemHealth,
                context_weights: {
                    let mut weights = HashMap::new();
                    weights.insert("cpu_usage".to_string(), 0.35);
                    weights.insert("memory_usage".to_string(), 0.35);
                    weights.insert("user_tolerance".to_string(), 0.3);
                    weights
                },
                decision_threshold: 0.75,
                confidence_multiplier: 1.3,
                reasoning_template: "System optimization suggestions are crucial when performance metrics exceed thresholds".to_string(),
                success_rate: 0.85,
                usage_count: 0,
                enabled: true,
            }
        ]
    }

    /// Get reasoning statistics for monitoring
    pub fn get_reasoning_statistics(&self) -> HashMap<String, Value> {
        let mut stats = HashMap::new();
        
        let decision_count = {
            let history = self.decision_history.read().unwrap();
            history.len()
        };

        let pattern_count = {
            let patterns = self.reasoning_patterns.read().unwrap();
            patterns.len()
        };

        stats.insert("total_decisions".to_string(), json!(decision_count));
        stats.insert("active_patterns".to_string(), json!(pattern_count));
        stats.insert("reasoning_engine_status".to_string(), json!("active"));

        stats
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ProactiveConfig;
    use crate::{CalendarEvent, SystemContext};

    #[tokio::test]
    async fn test_hrm_reasoning_engine_creation() {
        let config = ProactiveConfig::default();
        let engine = HRMReasoningEngine::new(&config).await;
        assert!(engine.is_ok());
    }

    #[tokio::test]
    async fn test_reasoning_pattern_matching() {
        let config = ProactiveConfig::default();
        let engine = HRMReasoningEngine::new(&config).await.unwrap();
        
        let context = SystemContext {
            timestamp: Utc::now(),
            cpu_usage: 45.0,
            memory_usage: 60.0,
            active_applications: vec!["Safari".to_string(), "Terminal".to_string()],
            calendar_events: vec![],
            user_activity_level: "active".to_string(),
            time_of_day: "morning".to_string(),
            current_tasks: vec![],
        };

        let suggestion = Suggestion {
            id: "test".to_string(),
            suggestion_type: "productivity".to_string(),
            title: "Test Suggestion".to_string(),
            description: "Test Description".to_string(),
            confidence: 0.7,
            priority: 5,
            context: HashMap::new(),
            actions: vec![],
            generated_at: Utc::now(),
            expires_at: None,
        };

        let applicable_patterns = engine.select_applicable_patterns(&suggestion, &context).await;
        assert!(!applicable_patterns.is_empty());
    }
}
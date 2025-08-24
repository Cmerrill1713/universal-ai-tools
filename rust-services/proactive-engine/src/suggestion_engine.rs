use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tracing::{debug, info, warn, instrument};
use uuid::Uuid;

use crate::config::ProactiveConfig;
use crate::{Suggestion, SuggestedAction, SystemContext};

/// AI-powered suggestion generation engine
#[derive(Clone)]
pub struct SuggestionEngine {
    config: ProactiveConfig,
    client: Client,
    db_pool: PgPool,
    last_generation_time: std::sync::Arc<std::sync::RwLock<Instant>>,
    suggestion_patterns: std::sync::Arc<std::sync::RwLock<Vec<SuggestionPattern>>>,
}

/// Pattern for generating contextual suggestions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionPattern {
    pub pattern_id: String,
    pub name: String,
    pub description: String,
    pub triggers: Vec<TriggerCondition>,
    pub suggestion_template: SuggestionTemplate,
    pub confidence_base: f32,
    pub priority: i32,
    pub cooldown_minutes: i32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriggerCondition {
    pub condition_type: String, // "cpu_high", "memory_low", "time_based", "app_specific", "calendar_event"
    pub parameters: HashMap<String, Value>,
    pub weight: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionTemplate {
    pub title_template: String,
    pub description_template: String,
    pub suggestion_type: String,
    pub actions: Vec<ActionTemplate>,
    pub expiry_hours: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionTemplate {
    pub action_type: String,
    pub description_template: String,
    pub parameters: HashMap<String, Value>,
}

/// User interaction history for learning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInteraction {
    pub suggestion_id: String,
    pub action_taken: String, // "accepted", "dismissed", "modified"
    pub feedback_rating: Option<i32>, // 1-5 scale
    pub context_at_time: SystemContext,
    pub timestamp: DateTime<Utc>,
}

impl SuggestionEngine {
    pub async fn new(config: &ProactiveConfig, db_pool: PgPool) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.server.timeout_seconds))
            .build()
            .context("Failed to create HTTP client")?;

        let suggestion_patterns = Self::load_default_patterns();

        Ok(Self {
            config: config.clone(),
            client,
            db_pool,
            last_generation_time: std::sync::Arc::new(std::sync::RwLock::new(Instant::now())),
            suggestion_patterns: std::sync::Arc::new(std::sync::RwLock::new(suggestion_patterns)),
        })
    }

    /// Check if the suggestion engine is healthy
    pub async fn is_healthy(&self) -> bool {
        // Test database connectivity
        match sqlx::query("SELECT 1").fetch_one(&self.db_pool).await {
            Ok(_) => true,
            Err(_) => false,
        }
    }

    /// Generate contextual suggestions based on system state
    #[instrument(skip(self, context))]
    pub async fn generate_suggestions(&self, context: &SystemContext) -> Result<Vec<Suggestion>> {
        debug!("🧠 Generating proactive suggestions");

        let mut suggestions = Vec::new();

        // Get active patterns
        let patterns = {
            let patterns_guard = self.suggestion_patterns.read().unwrap();
            patterns_guard.clone()
        };

        // Process each pattern to see if it should trigger
        for pattern in patterns.iter().filter(|p| p.enabled) {
            if let Some(suggestion) = self.evaluate_pattern(pattern, context).await? {
                suggestions.push(suggestion);
            }
        }

        // Add AI-generated suggestions
        let ai_suggestions = self.generate_ai_suggestions(context).await
            .unwrap_or_default();
        suggestions.extend(ai_suggestions);

        // Sort by priority and confidence
        suggestions.sort_by(|a, b| {
            let priority_cmp = b.priority.cmp(&a.priority);
            if priority_cmp == std::cmp::Ordering::Equal {
                b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal)
            } else {
                priority_cmp
            }
        });

        // Limit to max suggestions
        if suggestions.len() > self.config.suggestions.max_active_suggestions {
            suggestions.truncate(self.config.suggestions.max_active_suggestions);
        }

        // Filter by confidence threshold
        suggestions.retain(|s| s.confidence >= self.config.suggestions.min_confidence_threshold);

        if !suggestions.is_empty() {
            info!("✨ Generated {} suggestions", suggestions.len());
        }

        Ok(suggestions)
    }

    /// Evaluate a specific pattern against current context
    async fn evaluate_pattern(&self, pattern: &SuggestionPattern, context: &SystemContext) -> Result<Option<Suggestion>> {
        let mut total_confidence = pattern.confidence_base;
        let mut triggered_conditions = Vec::new();

        // Evaluate each trigger condition
        for trigger in &pattern.triggers {
            let condition_met = self.evaluate_trigger_condition(trigger, context).await?;
            if condition_met {
                total_confidence += trigger.weight;
                triggered_conditions.push(trigger.condition_type.clone());
            }
        }

        // Only generate suggestion if at least one condition was met
        if triggered_conditions.is_empty() {
            return Ok(None);
        }

        // Check cooldown
        if let Ok(last_generated) = self.get_last_pattern_generation(&pattern.pattern_id).await {
            if let Some(last_gen) = last_generated {
                let cooldown_duration = Duration::from_secs((pattern.cooldown_minutes * 60) as u64);
                if Utc::now().signed_duration_since(last_gen).to_std().unwrap_or(Duration::ZERO) < cooldown_duration {
                    debug!("Pattern {} in cooldown", pattern.pattern_id);
                    return Ok(None);
                }
            }
        }

        // Generate suggestion from template
        let suggestion = self.create_suggestion_from_template(pattern, context, total_confidence).await?;

        // Record pattern generation
        if let Err(e) = self.record_pattern_generation(&pattern.pattern_id).await {
            warn!("Failed to record pattern generation: {}", e);
        }

        Ok(Some(suggestion))
    }

    /// Evaluate individual trigger condition
    async fn evaluate_trigger_condition(&self, trigger: &TriggerCondition, context: &SystemContext) -> Result<bool> {
        match trigger.condition_type.as_str() {
            "cpu_high" => {
                let threshold = trigger.parameters.get("threshold")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(80.0) as f32;
                Ok(context.cpu_usage > threshold)
            }
            "memory_high" => {
                let threshold = trigger.parameters.get("threshold")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(80.0) as f32;
                Ok(context.memory_usage > threshold)
            }
            "time_based" => {
                let time_of_day = trigger.parameters.get("time_of_day")
                    .and_then(|v| v.as_str())
                    .unwrap_or("any");
                Ok(time_of_day == "any" || time_of_day == context.time_of_day)
            }
            "app_specific" => {
                let target_apps = trigger.parameters.get("applications")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
                    .unwrap_or_default();
                
                Ok(target_apps.iter().any(|app| {
                    context.active_applications.iter().any(|active_app| {
                        active_app.to_lowercase().contains(&app.to_lowercase())
                    })
                }))
            }
            "calendar_event" => {
                // Check if there are upcoming calendar events
                Ok(!context.calendar_events.is_empty())
            }
            "user_activity" => {
                let target_activity = trigger.parameters.get("activity_level")
                    .and_then(|v| v.as_str())
                    .unwrap_or("any");
                Ok(target_activity == "any" || target_activity == context.user_activity_level)
            }
            _ => {
                warn!("Unknown trigger condition type: {}", trigger.condition_type);
                Ok(false)
            }
        }
    }

    /// Create suggestion from template
    async fn create_suggestion_from_template(&self, pattern: &SuggestionPattern, context: &SystemContext, confidence: f32) -> Result<Suggestion> {
        let template = &pattern.suggestion_template;
        
        // Replace placeholders in title and description
        let title = self.replace_template_placeholders(&template.title_template, context);
        let description = self.replace_template_placeholders(&template.description_template, context);

        // Generate actions from templates
        let actions = template.actions.iter().map(|action_template| {
            let action_description = self.replace_template_placeholders(&action_template.description_template, context);
            
            SuggestedAction {
                action_id: Uuid::new_v4().to_string(),
                action_type: action_template.action_type.clone(),
                description: action_description,
                parameters: action_template.parameters.clone(),
            }
        }).collect();

        // Calculate expiry time
        let expires_at = template.expiry_hours.map(|hours| {
            Utc::now() + chrono::Duration::hours(hours)
        });

        Ok(Suggestion {
            id: Uuid::new_v4().to_string(),
            suggestion_type: template.suggestion_type.clone(),
            title,
            description,
            confidence: confidence.min(1.0),
            priority: pattern.priority,
            context: self.create_suggestion_context(context),
            actions,
            generated_at: Utc::now(),
            expires_at,
        })
    }

    /// Replace template placeholders with context values
    fn replace_template_placeholders(&self, template: &str, context: &SystemContext) -> String {
        template
            .replace("{cpu_usage}", &format!("{:.1}", context.cpu_usage))
            .replace("{memory_usage}", &format!("{:.1}", context.memory_usage))
            .replace("{time_of_day}", &context.time_of_day)
            .replace("{activity_level}", &context.user_activity_level)
            .replace("{app_count}", &context.active_applications.len().to_string())
    }

    /// Create context object for suggestion
    fn create_suggestion_context(&self, context: &SystemContext) -> HashMap<String, Value> {
        let mut suggestion_context = HashMap::new();
        
        suggestion_context.insert("cpu_usage".to_string(), json!(context.cpu_usage));
        suggestion_context.insert("memory_usage".to_string(), json!(context.memory_usage));
        suggestion_context.insert("time_of_day".to_string(), json!(context.time_of_day));
        suggestion_context.insert("user_activity_level".to_string(), json!(context.user_activity_level));
        suggestion_context.insert("active_applications".to_string(), json!(context.active_applications));
        suggestion_context.insert("timestamp".to_string(), json!(context.timestamp));
        
        suggestion_context
    }

    /// Generate AI-powered suggestions using external AI service
    #[instrument(skip(self, context))]
    async fn generate_ai_suggestions(&self, context: &SystemContext) -> Result<Vec<Suggestion>> {
        debug!("🤖 Generating AI-powered suggestions");

        // Prepare context for AI
        let ai_context = json!({
            "system_state": {
                "cpu_usage": context.cpu_usage,
                "memory_usage": context.memory_usage,
                "time_of_day": context.time_of_day,
                "user_activity": context.user_activity_level,
                "active_applications": context.active_applications.iter().take(5).collect::<Vec<_>>(),
                "calendar_events": context.calendar_events.len(),
                "current_tasks": context.current_tasks.len()
            },
            "request": {
                "task": "Generate 1-2 helpful proactive suggestions based on the current system state and user context. Focus on productivity, system optimization, or helpful reminders.",
                "format": "Provide specific, actionable suggestions with confidence scores (0.0-1.0) and clear descriptions."
            }
        });

        // Make request to AI service
        let response = self.client
            .post(&self.config.suggestions.ai_service_url)
            .json(&json!({
                "model": self.config.suggestions.ai_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a proactive AI assistant that generates helpful suggestions based on system context. Provide actionable, relevant suggestions."
                    },
                    {
                        "role": "user", 
                        "content": ai_context.to_string()
                    }
                ],
                "max_tokens": 300
            }))
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    // Parse AI response and convert to suggestions
                    // This is a simplified implementation - in practice, you'd parse the AI response more carefully
                    let ai_suggestion = Suggestion {
                        id: Uuid::new_v4().to_string(),
                        suggestion_type: "ai_generated".to_string(),
                        title: "AI Suggestion".to_string(),
                        description: format!("Based on your current system state (CPU: {:.1}%, Memory: {:.1}%), consider optimizing your workflow.", 
                                           context.cpu_usage, context.memory_usage),
                        confidence: 0.7,
                        priority: 5,
                        context: self.create_suggestion_context(context),
                        actions: vec![
                            SuggestedAction {
                                action_id: Uuid::new_v4().to_string(),
                                action_type: "system_optimization".to_string(),
                                description: "Run system optimization".to_string(),
                                parameters: HashMap::new(),
                            }
                        ],
                        generated_at: Utc::now(),
                        expires_at: Some(Utc::now() + chrono::Duration::hours(2)),
                    };
                    
                    Ok(vec![ai_suggestion])
                } else {
                    warn!("AI service returned error status: {}", resp.status());
                    Ok(Vec::new())
                }
            }
            Err(e) => {
                warn!("Failed to call AI service: {}", e);
                Ok(Vec::new())
            }
        }
    }

    /// Get last generation time for a pattern
    async fn get_last_pattern_generation(&self, pattern_id: &str) -> Result<Option<DateTime<Utc>>> {
        let row = sqlx::query(
            "SELECT generated_at FROM proactive_suggestions WHERE suggestion_type = $1 ORDER BY generated_at DESC LIMIT 1"
        )
        .bind(pattern_id)
        .fetch_optional(&self.db_pool)
        .await?;

        Ok(row.map(|r| {
            r.try_get::<DateTime<Utc>, _>("generated_at").unwrap_or(Utc::now())
        }))
    }

    /// Record pattern generation
    async fn record_pattern_generation(&self, pattern_id: &str) -> Result<()> {
        // This could be stored in a separate table for pattern tracking
        // For now, we'll just log it
        debug!("Pattern {} generated suggestion", pattern_id);
        Ok(())
    }

    /// Load default suggestion patterns
    fn load_default_patterns() -> Vec<SuggestionPattern> {
        vec![
            // High CPU usage pattern
            SuggestionPattern {
                pattern_id: "high_cpu_usage".to_string(),
                name: "High CPU Usage Alert".to_string(),
                description: "Suggests actions when CPU usage is high".to_string(),
                triggers: vec![
                    TriggerCondition {
                        condition_type: "cpu_high".to_string(),
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("threshold".to_string(), json!(75.0));
                            params
                        },
                        weight: 0.8,
                    }
                ],
                suggestion_template: SuggestionTemplate {
                    title_template: "High CPU Usage Detected".to_string(),
                    description_template: "Your system is using {cpu_usage}% CPU. Consider closing unnecessary applications or running system optimization.".to_string(),
                    suggestion_type: "system_optimization".to_string(),
                    actions: vec![
                        ActionTemplate {
                            action_type: "close_unused_apps".to_string(),
                            description_template: "Close unused applications".to_string(),
                            parameters: HashMap::new(),
                        },
                        ActionTemplate {
                            action_type: "run_activity_monitor".to_string(),
                            description_template: "Open Activity Monitor to check processes".to_string(),
                            parameters: HashMap::new(),
                        }
                    ],
                    expiry_hours: Some(1),
                },
                confidence_base: 0.8,
                priority: 8,
                cooldown_minutes: 30,
                enabled: true,
            },

            // Break reminder pattern
            SuggestionPattern {
                pattern_id: "break_reminder".to_string(),
                name: "Break Reminder".to_string(),
                description: "Suggests taking breaks during active work periods".to_string(),
                triggers: vec![
                    TriggerCondition {
                        condition_type: "user_activity".to_string(),
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("activity_level".to_string(), json!("active"));
                            params
                        },
                        weight: 0.6,
                    },
                    TriggerCondition {
                        condition_type: "time_based".to_string(),
                        parameters: {
                            let mut params = HashMap::new();
                            params.insert("time_of_day".to_string(), json!("afternoon"));
                            params
                        },
                        weight: 0.3,
                    }
                ],
                suggestion_template: SuggestionTemplate {
                    title_template: "Time for a Break".to_string(),
                    description_template: "You've been active for a while. Consider taking a short break to maintain productivity.".to_string(),
                    suggestion_type: "wellness".to_string(),
                    actions: vec![
                        ActionTemplate {
                            action_type: "start_break_timer".to_string(),
                            description_template: "Start a 5-minute break timer".to_string(),
                            parameters: HashMap::new(),
                        }
                    ],
                    expiry_hours: Some(1),
                },
                confidence_base: 0.6,
                priority: 3,
                cooldown_minutes: 120,
                enabled: true,
            }
        ]
    }

    /// Record user interaction with suggestion
    pub async fn record_user_interaction(&self, interaction: UserInteraction) -> Result<()> {
        // Store user interaction for learning purposes
        sqlx::query(
            r#"
            INSERT INTO suggestion_interactions (
                suggestion_id, action_taken, feedback_rating, context_data, timestamp
            ) VALUES ($1, $2, $3, $4, $5)
            "#
        )
        .bind(&interaction.suggestion_id)
        .bind(&interaction.action_taken)
        .bind(interaction.feedback_rating)
        .bind(serde_json::to_value(&interaction.context_at_time).unwrap())
        .bind(interaction.timestamp)
        .execute(&self.db_pool)
        .await?;

        info!("📝 Recorded user interaction for suggestion {}", interaction.suggestion_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ProactiveConfig;

    #[test]
    fn test_load_default_patterns() {
        let patterns = SuggestionEngine::load_default_patterns();
        assert!(!patterns.is_empty());
        assert!(patterns.iter().any(|p| p.pattern_id == "high_cpu_usage"));
        assert!(patterns.iter().any(|p| p.pattern_id == "break_reminder"));
    }

    #[test]
    fn test_template_placeholders() {
        let config = ProactiveConfig::default();
        // We can't easily test this without a real database connection
        // In a real test, you'd use a test database or mock
    }
}
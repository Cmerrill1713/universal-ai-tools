use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserFeedback {
    pub user_id: String,
    pub query: String,
    pub response: String,
    pub rating: u8, // 1-5
    pub comments: Option<String>,
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackInsights {
    pub total_feedback: u32,
    pub average_rating: f32,
    pub common_issues: HashMap<String, u32>,
    pub improvement_suggestions: Vec<String>,
}

pub struct FeedbackManager {
    feedback: Arc<RwLock<Vec<UserFeedback>>>,
    insights: Arc<RwLock<FeedbackInsights>>,
}

impl FeedbackManager {
    pub fn new() -> Self {
        Self {
            feedback: Arc::new(RwLock::new(Vec::new())),
            insights: Arc::new(RwLock::new(FeedbackInsights {
                total_feedback: 0,
                average_rating: 0.0,
                common_issues: HashMap::new(),
                improvement_suggestions: Vec::new(),
            })),
        }
    }

    pub async fn submit_feedback(&self, mut feedback: UserFeedback) -> Result<()> {
        // Set timestamp if not provided
        if feedback.timestamp.is_none() {
            feedback.timestamp = Some(chrono::Utc::now());
        }

        let mut feedback_list = self.feedback.write().await;
        feedback_list.push(feedback);

        // Skip insights update for now to avoid blocking
        // TODO: Implement async insights update

        Ok(())
    }

    async fn update_insights(&self) -> Result<()> {
        let feedback_list = self.feedback.read().await;
        let mut insights = self.insights.write().await;

        insights.total_feedback = feedback_list.len() as u32;

        if !feedback_list.is_empty() {
            let total_rating: u32 = feedback_list.iter().map(|f| f.rating as u32).sum();
            insights.average_rating = total_rating as f32 / feedback_list.len() as f32;
        }

        // Analyze common issues
        insights.common_issues.clear();
        for feedback in feedback_list.iter() {
            if feedback.rating <= 2 {
                if let Some(comments) = &feedback.comments {
                    let words: Vec<&str> = comments.split_whitespace().collect();
                    for word in words {
                        if word.len() > 4 {
                            *insights.common_issues.entry(word.to_lowercase()).or_insert(0) += 1;
                        }
                    }
                }
            }
        }

        // Generate improvement suggestions
        insights.improvement_suggestions.clear();
        if insights.average_rating < 3.0 {
            insights.improvement_suggestions.push("Consider providing more detailed responses".to_string());
        }
        if insights.common_issues.contains_key("slow") {
            insights.improvement_suggestions.push("Optimize response times".to_string());
        }
        if insights.common_issues.contains_key("unclear") {
            insights.improvement_suggestions.push("Improve response clarity".to_string());
        }

        Ok(())
    }

    pub async fn get_insights(&self) -> FeedbackInsights {
        let feedback_list = self.feedback.read().await;
        let mut insights = FeedbackInsights {
            total_feedback: feedback_list.len() as u32,
            average_rating: 0.0,
            common_issues: std::collections::HashMap::new(),
            improvement_suggestions: Vec::new(),
        };

        if !feedback_list.is_empty() {
            let total_rating: u32 = feedback_list.iter().map(|f| f.rating as u32).sum();
            insights.average_rating = total_rating as f32 / feedback_list.len() as f32;
        }

        insights
    }

    pub async fn get_user_feedback(&self, user_id: &str) -> Vec<UserFeedback> {
        let feedback_list = self.feedback.read().await;
        feedback_list.iter()
            .filter(|f| f.user_id == user_id)
            .cloned()
            .collect()
    }
}

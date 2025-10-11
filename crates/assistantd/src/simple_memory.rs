use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMemory {
    pub user_id: String,
    pub conversation_history: Vec<ConversationEntry>,
    pub preferences: UserPreferences,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationEntry {
    pub query: String,
    pub response: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub topics: Vec<String>,
    pub user_rating: Option<u8>, // 1-5 rating
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPreferences {
    pub preferred_response_style: ResponseStyle,
    pub preferred_model: Option<String>,
    pub communication_level: CommunicationLevel,
    pub interests: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseStyle {
    Concise,
    Detailed,
    Conversational,
    Technical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CommunicationLevel {
    Beginner,
    Intermediate,
    Advanced,
    Expert,
}

pub struct SimpleMemoryManager {
    memories: Arc<RwLock<HashMap<String, UserMemory>>>,
}

impl SimpleMemoryManager {
    pub fn new() -> Self {
        Self {
            memories: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_user_memory(&self, user_id: &str) -> Option<UserMemory> {
        let memories = self.memories.read().await;
        memories.get(user_id).cloned()
    }

    pub async fn add_conversation(&self, user_id: &str, query: &str, response: &str) -> Result<()> {
        let mut memories = self.memories.write().await;

        let memory = memories.entry(user_id.to_string()).or_insert_with(|| {
            UserMemory {
                user_id: user_id.to_string(),
                conversation_history: Vec::new(),
                preferences: UserPreferences {
                    preferred_response_style: ResponseStyle::Conversational,
                    preferred_model: None,
                    communication_level: CommunicationLevel::Intermediate,
                    interests: Vec::new(),
                },
                last_updated: chrono::Utc::now(),
            }
        });

        let topics = self.extract_topics(query);
        let entry = ConversationEntry {
            query: query.to_string(),
            response: response.to_string(),
            timestamp: chrono::Utc::now(),
            topics,
            user_rating: None,
        };

        memory.conversation_history.push(entry);
        memory.last_updated = chrono::Utc::now();

        // Keep only last 50 conversations to prevent memory bloat
        if memory.conversation_history.len() > 50 {
            memory.conversation_history.drain(0..memory.conversation_history.len() - 50);
        }

        Ok(())
    }

    pub async fn update_user_rating(&self, user_id: &str, rating: u8) -> Result<()> {
        let mut memories = self.memories.write().await;

        if let Some(memory) = memories.get_mut(user_id) {
            if let Some(last_entry) = memory.conversation_history.last_mut() {
                last_entry.user_rating = Some(rating);
            }
        }

        Ok(())
    }

    pub async fn get_context_for_query(&self, user_id: &str, query: &str) -> String {
        let memories = self.memories.read().await;

        if let Some(memory) = memories.get(user_id) {
            let mut context = String::new();

            // Add user preferences
            context.push_str(&format!("User prefers {} responses at {} level.\n",
                format!("{:?}", memory.preferences.preferred_response_style).to_lowercase(),
                format!("{:?}", memory.preferences.communication_level).to_lowercase()
            ));

            // Add relevant conversation history
            let relevant_history = self.find_relevant_conversations(memory, query);
            if !relevant_history.is_empty() {
                context.push_str("Previous relevant conversations:\n");
                for entry in relevant_history {
                    context.push_str(&format!("- Q: {} A: {}\n",
                        entry.query.chars().take(100).collect::<String>(),
                        entry.response.chars().take(100).collect::<String>()
                    ));
                }
            }

            context
        } else {
            String::new()
        }
    }

    fn extract_topics(&self, query: &str) -> Vec<String> {
        // Simple topic extraction - in production, use NLP
        query.split_whitespace()
            .filter(|word| word.len() > 3)
            .map(|s| s.to_lowercase())
            .collect()
    }

    fn find_relevant_conversations<'a>(&self, memory: &'a UserMemory, query: &str) -> Vec<&'a ConversationEntry> {
        let query_words: Vec<&str> = query.split_whitespace().collect();

        memory.conversation_history
            .iter()
            .filter(|entry| {
                entry.topics.iter().any(|topic|
                    query_words.iter().any(|word|
                        topic.contains(word) || word.contains(topic)
                    )
                )
            })
            .take(3)
            .collect()
    }

    pub async fn learn_from_feedback(&self, user_id: &str) -> Result<()> {
        let mut memories = self.memories.write().await;

        if let Some(memory) = memories.get_mut(user_id) {
            // Analyze recent ratings to adjust preferences
            let recent_ratings: Vec<u8> = memory.conversation_history
                .iter()
                .rev()
                .take(10)
                .filter_map(|entry| entry.user_rating)
                .collect();

            if !recent_ratings.is_empty() {
                let avg_rating = recent_ratings.iter().sum::<u8>() as f32 / recent_ratings.len() as f32;

                // Adjust preferences based on ratings
                if avg_rating > 4.0 {
                    // User is happy, keep current preferences
                } else if avg_rating < 3.0 {
                    // User is not happy, try different approach
                    memory.preferences.preferred_response_style = match memory.preferences.preferred_response_style {
                        ResponseStyle::Concise => ResponseStyle::Detailed,
                        ResponseStyle::Detailed => ResponseStyle::Conversational,
                        ResponseStyle::Conversational => ResponseStyle::Technical,
                        ResponseStyle::Technical => ResponseStyle::Concise,
                    };
                }
            }
        }

        Ok(())
    }
}

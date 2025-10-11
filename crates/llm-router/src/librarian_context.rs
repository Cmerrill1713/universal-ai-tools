//! Librarian-powered context management for LLM Router
//! 
//! Uses the Intelligent Librarian to compress, summarize, and manage context intelligently

use crate::models::Message;
use crate::context::MessageRole;
use crate::RouterError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Context compression strategies using the librarian
#[derive(Debug, Clone, Copy)]
pub enum LibrarianStrategy {
    /// Summarize older messages while keeping recent ones
    SummarizeOldKeepRecent,
    /// Extract key information and store in knowledge base
    ExtractAndStore,
    /// Compress using semantic similarity
    SemanticCompression,
    /// Create context summary for unlimited context
    CreateContextSummary,
}

/// Librarian context manager for intelligent context handling
#[derive(Debug)]
pub struct LibrarianContextManager {
    librarian_url: String,
    client: reqwest::Client,
    compression_strategy: LibrarianStrategy,
    context_cache: HashMap<String, ContextSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSummary {
    pub summary_id: String,
    pub original_message_count: usize,
    pub compressed_message_count: usize,
    pub key_topics: Vec<String>,
    pub important_entities: Vec<String>,
    pub conversation_flow: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LibrarianContextRequest {
    pub messages: Vec<Message>,
    pub strategy: String,
    pub max_tokens: u32,
    pub preserve_recent: usize, // Number of recent messages to keep
}

#[derive(Debug, Deserialize)]
pub struct LibrarianContextResponse {
    pub compressed_messages: Vec<Message>,
    pub summary: Option<ContextSummary>,
    pub compression_ratio: f32,
    pub tokens_saved: u32,
}

impl LibrarianContextManager {
    pub fn new(librarian_url: String) -> Self {
        Self {
            librarian_url,
            client: reqwest::Client::new(),
            compression_strategy: LibrarianStrategy::SummarizeOldKeepRecent,
            context_cache: HashMap::new(),
        }
    }
    
    pub fn with_strategy(mut self, strategy: LibrarianStrategy) -> Self {
        self.compression_strategy = strategy;
        self
    }
    
    /// Compress context using the librarian service
    pub async fn compress_context(
        &mut self,
        messages: Vec<Message>,
        max_tokens: u32,
        preserve_recent: usize,
    ) -> Result<Vec<Message>, RouterError> {
        if messages.len() <= preserve_recent {
            return Ok(messages);
        }
        
        // Check if we have a cached summary for this context
        let context_key = self.generate_context_key(&messages);
        if let Some(cached_summary) = self.context_cache.get(&context_key) {
            tracing::info!("Using cached context summary: {}", cached_summary.summary_id);
            return self.reconstruct_from_summary(cached_summary, &messages, preserve_recent);
        }
        
        // Split messages into old and recent
        let (old_messages, recent_messages) = self.split_messages(&messages, preserve_recent);
        
        if old_messages.is_empty() {
            return Ok(messages);
        }
        
        // Send to librarian for compression
        let request = LibrarianContextRequest {
            messages: old_messages,
            strategy: self.strategy_to_string(),
            max_tokens: max_tokens / 2, // Reserve half for recent messages
            preserve_recent: 0,
        };
        
        let response = self.send_to_librarian(request).await?;
        
        // Cache the summary
        if let Some(summary) = &response.summary {
            self.context_cache.insert(context_key, summary.clone());
        }
        
        // Combine compressed old messages with recent messages
        let mut result = response.compressed_messages;
        result.extend(recent_messages);
        
        tracing::info!(
            "Librarian compressed context: {} -> {} messages, saved {} tokens ({:.1}% compression)",
            messages.len(),
            result.len(),
            response.tokens_saved,
            response.compression_ratio * 100.0
        );
        
        Ok(result)
    }
    
    /// Extract key information from context and store in knowledge base
    pub async fn extract_and_store_context(
        &mut self,
        messages: Vec<Message>,
        session_id: &str,
    ) -> Result<String, RouterError> {
        let request = LibrarianContextRequest {
            messages: messages.clone(),
            strategy: "extract_and_store".to_string(),
            max_tokens: 1000,
            preserve_recent: 0,
        };
        
        let _response = self.send_to_librarian(request).await?;
        
        // Store the extracted knowledge
        let knowledge_id = self.store_extracted_knowledge(&messages, session_id).await?;
        
        tracing::info!(
            "Extracted and stored context knowledge: {} (session: {})",
            knowledge_id,
            session_id
        );
        
        Ok(knowledge_id)
    }
    
    /// Create a comprehensive context summary for unlimited context
    pub async fn create_context_summary(
        &mut self,
        messages: Vec<Message>,
        session_id: &str,
    ) -> Result<ContextSummary, RouterError> {
        let request = LibrarianContextRequest {
            messages: messages.clone(),
            strategy: "create_summary".to_string(),
            max_tokens: 2000,
            preserve_recent: 0,
        };
        
        let response = self.send_to_librarian(request).await?;
        
        let summary = response.summary.ok_or_else(|| {
            RouterError::ProviderError("Librarian failed to create context summary".to_string())
        })?;
        
        // Store summary in cache
        let context_key = self.generate_context_key(&messages);
        self.context_cache.insert(context_key, summary.clone());
        
        tracing::info!(
            "Created context summary: {} for session {} ({} messages -> {} key topics)",
            summary.summary_id,
            session_id,
            summary.original_message_count,
            summary.key_topics.len()
        );
        
        Ok(summary)
    }
    
    /// Retrieve relevant context from knowledge base
    pub async fn retrieve_relevant_context(
        &self,
        current_messages: &[Message],
        max_tokens: u32,
    ) -> Result<Vec<Message>, RouterError> {
        // Extract key topics from current messages
        let topics = self.extract_topics(current_messages);
        
        // Search librarian for relevant context
        let search_query = topics.join(" ");
        
        let url = format!("{}/api/search", self.librarian_url);
        let response = self.client
            .post(&url)
            .json(&serde_json::json!({
                "query": search_query,
                "limit": 5,
                "max_tokens": max_tokens
            }))
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Librarian search failed: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(RouterError::ProviderError(
                format!("Librarian search returned status: {}", response.status())
            ));
        }
        
        let search_results: serde_json::Value = response
            .json()
            .await
            .map_err(|e| RouterError::SerializationError(format!("Invalid librarian response: {}", e)))?;
        
        // Convert search results to messages
        let relevant_messages = self.convert_search_results_to_messages(search_results)?;
        
        tracing::info!(
            "Retrieved {} relevant messages from librarian for topics: {}",
            relevant_messages.len(),
            topics.join(", ")
        );
        
        Ok(relevant_messages)
    }
    
    // Private helper methods
    
    fn generate_context_key(&self, messages: &[Message]) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        messages.len().hash(&mut hasher);
        messages.iter().take(3).for_each(|m| {
            format!("{:?}", m.role).hash(&mut hasher);
            m.content.len().hash(&mut hasher);
        });
        
        format!("ctx_{}", hasher.finish())
    }
    
    fn split_messages(&self, messages: &[Message], preserve_recent: usize) -> (Vec<Message>, Vec<Message>) {
        if messages.len() <= preserve_recent {
            return (vec![], messages.to_vec());
        }
        
        let split_point = messages.len() - preserve_recent;
        let old_messages = messages[..split_point].to_vec();
        let recent_messages = messages[split_point..].to_vec();
        
        (old_messages, recent_messages)
    }
    
    fn strategy_to_string(&self) -> String {
        match self.compression_strategy {
            LibrarianStrategy::SummarizeOldKeepRecent => "summarize_old_keep_recent".to_string(),
            LibrarianStrategy::ExtractAndStore => "extract_and_store".to_string(),
            LibrarianStrategy::SemanticCompression => "semantic_compression".to_string(),
            LibrarianStrategy::CreateContextSummary => "create_summary".to_string(),
        }
    }
    
    pub async fn send_to_librarian(
        &self,
        request: LibrarianContextRequest,
    ) -> Result<LibrarianContextResponse, RouterError> {
        let url = format!("{}/api/compress-context", self.librarian_url);
        
        let response = self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Librarian request failed: {}", e)))?;
        
        if !response.status().is_success() {
            return Err(RouterError::ProviderError(
                format!("Librarian returned status: {}", response.status())
            ));
        }
        
        let result: LibrarianContextResponse = response
            .json()
            .await
            .map_err(|e| RouterError::SerializationError(format!("Invalid librarian response: {}", e)))?;
        
        Ok(result)
    }
    
    async fn store_extracted_knowledge(
        &self,
        messages: &[Message],
        session_id: &str,
    ) -> Result<String, RouterError> {
        let knowledge_id = Uuid::new_v4().to_string();
        
        // Store in librarian knowledge base
        let url = format!("{}/api/knowledge", self.librarian_url);
        let knowledge_doc = serde_json::json!({
            "id": knowledge_id,
            "content": self.messages_to_text(messages),
            "metadata": {
                "session_id": session_id,
                "extracted_at": chrono::Utc::now(),
                "type": "conversation_context"
            }
        });
        
        self.client
            .post(&url)
            .json(&knowledge_doc)
            .send()
            .await
            .map_err(|e| RouterError::NetworkError(format!("Failed to store knowledge: {}", e)))?;
        
        Ok(knowledge_id)
    }
    
    fn reconstruct_from_summary(
        &self,
        summary: &ContextSummary,
        original_messages: &[Message],
        preserve_recent: usize,
    ) -> Result<Vec<Message>, RouterError> {
        // Create a summary message from the context summary
        let summary_content = format!(
            "Previous conversation summary: {}\nKey topics: {}\nImportant entities: {}",
            summary.conversation_flow,
            summary.key_topics.join(", "),
            summary.important_entities.join(", ")
        );
        
        let summary_message = Message {
            role: MessageRole::System,
            content: summary_content,
            name: Some("context_summary".to_string()),
        };
        
        // Keep recent messages
        let recent_messages = if original_messages.len() > preserve_recent {
            original_messages[original_messages.len() - preserve_recent..].to_vec()
        } else {
            original_messages.to_vec()
        };
        
        // Combine summary with recent messages
        let mut result = vec![summary_message];
        result.extend(recent_messages);
        
        Ok(result)
    }
    
    fn extract_topics(&self, messages: &[Message]) -> Vec<String> {
        // Simple topic extraction - in a real implementation, this would use NLP
        let mut topics = Vec::new();
        
        for message in messages {
            let content = &message.content;
            
            // Extract potential topics (simple keyword extraction)
            if content.contains("code") || content.contains("programming") {
                topics.push("programming".to_string());
            }
            if content.contains("error") || content.contains("bug") {
                topics.push("debugging".to_string());
            }
            if content.contains("database") || content.contains("SQL") {
                topics.push("database".to_string());
            }
            if content.contains("API") || content.contains("endpoint") {
                topics.push("api".to_string());
            }
            if content.contains("test") || content.contains("testing") {
                topics.push("testing".to_string());
            }
        }
        
        // Remove duplicates and limit
        topics.sort();
        topics.dedup();
        topics.truncate(5);
        
        topics
    }
    
    fn convert_search_results_to_messages(&self, results: serde_json::Value) -> Result<Vec<Message>, RouterError> {
        let mut messages = Vec::new();
        
        if let Some(documents) = results["documents"].as_array() {
            for doc in documents {
                if let Some(content) = doc["content"].as_str() {
                    let message = Message {
                        role: MessageRole::System,
                        content: format!("Relevant context: {}", content),
                        name: Some("librarian_context".to_string()),
                    };
                    messages.push(message);
                }
            }
        }
        
        Ok(messages)
    }
    
    fn messages_to_text(&self, messages: &[Message]) -> String {
        messages
            .iter()
            .map(|m| format!("{:?}: {}", m.role, m.content))
            .collect::<Vec<_>>()
            .join("\n")
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
                content: "Hello, I need help with programming.".to_string(),
                name: None,
            },
            Message {
                role: MessageRole::Assistant,
                content: "I'd be happy to help with programming!".to_string(),
                name: None,
            },
        ]
    }
    
    #[test]
    fn test_context_key_generation() {
        let manager = LibrarianContextManager::new("http://localhost:8080".to_string());
        let messages = create_test_messages();
        
        let key1 = manager.generate_context_key(&messages);
        let key2 = manager.generate_context_key(&messages);
        
        assert_eq!(key1, key2); // Same messages should generate same key
    }
    
    #[test]
    fn test_message_splitting() {
        let manager = LibrarianContextManager::new("http://localhost:8080".to_string());
        let messages = create_test_messages();
        
        let (old, recent) = manager.split_messages(&messages, 1);
        
        assert_eq!(old.len(), 2);
        assert_eq!(recent.len(), 1);
        assert_eq!(recent[0].content, "I'd be happy to help with programming!");
    }
    
    #[test]
    fn test_topic_extraction() {
        let manager = LibrarianContextManager::new("http://localhost:8080".to_string());
        let messages = create_test_messages();
        
        let topics = manager.extract_topics(&messages);
        
        assert!(topics.contains(&"programming".to_string()));
    }
}

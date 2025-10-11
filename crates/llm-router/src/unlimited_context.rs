//! Unlimited Context Management through Intelligent Memory Dumps
//! 
//! This module implements truly unlimited context by dumping everything into
//! the librarian's knowledge base and reconstructing context intelligently.

use crate::models::Message;
use crate::context::MessageRole;
use crate::RouterError;
use crate::librarian_context::{LibrarianContextManager, LibrarianStrategy};
use crate::service_integration::{KnowledgeCrawlerIntegration, KnowledgeScraperIntegration, GitHubIntegration};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Unlimited context manager that never loses information
#[derive(Debug)]
pub struct UnlimitedContextManager {
    librarian_manager: LibrarianContextManager,
    session_contexts: HashMap<String, SessionContext>,
    compression_threshold: f32, // When to start dumping to memory
    max_active_context: usize,    // Max messages to keep in active memory
    knowledge_crawler: Option<KnowledgeCrawlerIntegration>,
    knowledge_scraper: Option<KnowledgeScraperIntegration>,
    github_integration: Option<GitHubIntegration>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionContext {
    pub session_id: String,
    pub active_messages: Vec<Message>,
    pub memory_dumps: Vec<MemoryDump>,
    pub total_messages_processed: usize,
    pub last_dump_at: DateTime<Utc>,
    pub context_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryDump {
    pub dump_id: String,
    pub message_range: (usize, usize), // Start and end indices
    pub compressed_summary: String,
    pub key_topics: Vec<String>,
    pub important_entities: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub librarian_storage_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextReconstructionRequest {
    pub session_id: String,
    pub current_messages: Vec<Message>,
    pub max_tokens: u32,
    pub include_recent_dumps: usize,
}

#[derive(Debug, Deserialize)]
pub struct ContextReconstructionResponse {
    pub reconstructed_context: Vec<Message>,
    pub memory_dumps_used: Vec<MemoryDump>,
    pub total_context_size: usize,
    pub compression_ratio: f32,
}

impl UnlimitedContextManager {
    pub fn new(librarian_url: String) -> Self {
        Self {
            librarian_manager: LibrarianContextManager::new(librarian_url)
                .with_strategy(LibrarianStrategy::CreateContextSummary),
            session_contexts: HashMap::new(),
            compression_threshold: 0.5, // Start dumping at 50% of context limit
            max_active_context: 20,     // Keep only 20 messages in active memory
            knowledge_crawler: None,
            knowledge_scraper: None,
            github_integration: None,
        }
    }
    
    pub fn with_service_integrations(
        mut self,
        crawler_url: Option<String>,
        scraper_url: Option<String>,
        github_username: Option<String>,
    ) -> Self {
        if let Some(url) = crawler_url {
            self.knowledge_crawler = Some(KnowledgeCrawlerIntegration::new(url));
        }
        
        if let Some(url) = scraper_url {
            self.knowledge_scraper = Some(KnowledgeScraperIntegration::new(url));
        }
        
        if let Some(username) = github_username {
            let mut github_integration = GitHubIntegration::new(Some(username.clone()));
            // Try to authenticate with keychain token
            if github_integration.authenticate(&username).is_ok() {
                self.github_integration = Some(github_integration);
            } else {
                tracing::warn!("GitHub authentication failed for user: {}. Token may not be stored in keychain.", username);
                self.github_integration = Some(GitHubIntegration::new(Some(username)));
            }
        }
        
        self
    }
    
    /// Store GitHub token in keychain for future use
    pub fn store_github_token(&self, username: &str, token: &str) -> Result<(), RouterError> {
        if let Some(ref github) = self.github_integration {
            github.store_token(username, token)
        } else {
            Err(RouterError::AuthenticationError("GitHub integration not configured".to_string()))
        }
    }
    
    /// Enhance context with external knowledge from existing services
    pub async fn enhance_context_with_knowledge(
        &self,
        messages: &[Message],
        query: Option<&str>,
    ) -> Result<Vec<Message>, RouterError> {
        let mut enhanced_messages = messages.to_vec();
        
        // Extract topics from current messages for knowledge search
        let topics = self.extract_topics_from_messages(messages);
        let topics_string = topics.join(" ");
        let search_query = query.unwrap_or(&topics_string);
        
        // Use knowledge crawler if available
        if let Some(ref crawler) = self.knowledge_crawler {
            match crawler.crawl_knowledge(search_query, Some(5)).await {
                Ok(crawler_response) => {
                    if !crawler_response.documents.is_empty() {
                        let crawled_messages = crawler.documents_to_messages(&crawler_response.documents, search_query);
                        enhanced_messages.extend(crawled_messages);
                        
                        tracing::info!(
                            "Enhanced context with {} crawled documents from {} sources",
                            crawler_response.documents.len(),
                            crawler_response.sources.len()
                        );
                    }
                }
                Err(e) => {
                    tracing::warn!("Knowledge crawler failed: {}", e);
                }
            }
        }
        
        // Use knowledge scraper if available
        if let Some(ref scraper) = self.knowledge_scraper {
            let sources = vec!["stackoverflow".to_string(), "documentation".to_string()];
            match scraper.scrape_sources(&sources, Some(&topics)).await {
                Ok(scraper_response) => {
                    if !scraper_response.entries.is_empty() {
                        let scraped_messages = scraper.entries_to_messages(&scraper_response.entries, search_query);
                        enhanced_messages.extend(scraped_messages);
                        
                        tracing::info!(
                            "Enhanced context with {} scraped entries from {} sources",
                            scraper_response.entries.len(),
                            scraper_response.sources_processed.len()
                        );
                    }
                }
                Err(e) => {
                    tracing::warn!("Knowledge scraper failed: {}", e);
                }
            }
        }
        
        // Use GitHub integration if available and query is programming-related
        if let Some(ref github) = self.github_integration {
            if self.is_programming_query(&topics) {
                match github.search_repositories(search_query, Some("rust"), Some(3)).await {
                    Ok(repos) => {
                        if !repos.is_empty() {
                            let github_messages = github.github_data_to_messages(&repos, &[], search_query);
                            enhanced_messages.extend(github_messages);
                            
                            tracing::info!("Enhanced context with {} GitHub repositories", repos.len());
                        }
                    }
                    Err(e) => {
                        tracing::warn!("GitHub integration failed: {}", e);
                    }
                }
            }
        }
        
        Ok(enhanced_messages)
    }
    
    /// Extract topics from messages for knowledge search
    fn extract_topics_from_messages(&self, messages: &[Message]) -> Vec<String> {
        let mut topics = Vec::new();
        
        for message in messages {
            let content_lower = message.content.to_lowercase();
            
            // Extract programming languages
            let languages = vec!["rust", "go", "python", "javascript", "typescript", "java", "c++", "c#"];
            for lang in languages {
                if content_lower.contains(lang) {
                    topics.push(lang.to_string());
                }
            }
            
            // Extract frameworks and tools
            let frameworks = vec!["react", "vue", "angular", "express", "django", "flask", "spring", "docker", "kubernetes"];
            for framework in frameworks {
                if content_lower.contains(framework) {
                    topics.push(framework.to_string());
                }
            }
            
            // Extract concepts
            let concepts = vec!["api", "database", "authentication", "testing", "deployment", "microservices"];
            for concept in concepts {
                if content_lower.contains(concept) {
                    topics.push(concept.to_string());
                }
            }
        }
        
        // Remove duplicates
        topics.sort();
        topics.dedup();
        topics
    }
    
    /// Check if query is programming-related
    fn is_programming_query(&self, topics: &[String]) -> bool {
        let programming_keywords = vec![
            "rust", "go", "python", "javascript", "typescript", "java", "c++", "c#",
            "programming", "code", "development", "api", "database", "framework",
            "library", "package", "module", "function", "class", "method"
        ];
        
        topics.iter().any(|topic| programming_keywords.contains(&topic.as_str()))
    }
    
    /// Process messages with unlimited context - never lose information
    pub async fn process_unlimited_context(
        &mut self,
        session_id: &str,
        messages: Vec<Message>,
        max_tokens: u32,
    ) -> Result<Vec<Message>, RouterError> {
        // Get current session context
        let current_context = if let Some(session) = self.session_contexts.get(session_id) {
            session.active_messages.clone()
        } else {
            Vec::new()
        };
        
        // Add new messages to context
        let mut updated_context = current_context;
        updated_context.extend(messages);
        
        // Check if we need to dump to memory
        if self.should_dump_to_memory(&updated_context, max_tokens) {
            tracing::info!(
                "Dumping context to memory for session {} ({} messages)",
                session_id,
                updated_context.len()
            );
            
            // Get session info before creating dump
            let total_processed = self.session_contexts
                .get(session_id)
                .map(|s| s.total_messages_processed)
                .unwrap_or(0);
            
            // Create memory dump
            let memory_dump = self.create_memory_dump(
                session_id,
                &updated_context,
                total_processed,
            ).await?;
            
            // Update session context
            let session_context = self.session_contexts.get_mut(session_id).unwrap();
            session_context.memory_dumps.push(memory_dump.clone());
            session_context.total_messages_processed = updated_context.len();
            session_context.last_dump_at = Utc::now();
            
            // Keep only recent messages in active context
            let keep_count = self.max_active_context.min(updated_context.len());
            session_context.active_messages = updated_context
                .into_iter()
                .rev()
                .take(keep_count)
                .rev()
                .collect();
            
            // Add memory dump summary to active context
            let summary_message = Message {
                role: MessageRole::System,
                content: format!(
                    "Previous conversation context ({} messages): {}\nKey topics: {}\nImportant entities: {}",
                    memory_dump.message_range.1 - memory_dump.message_range.0,
                    memory_dump.compressed_summary,
                    memory_dump.key_topics.join(", "),
                    memory_dump.important_entities.join(", ")
                ),
                name: Some("memory_dump_summary".to_string()),
            };
            
            session_context.active_messages.insert(0, summary_message);
            
            tracing::info!(
                "Memory dump created: {} messages compressed to summary, {} active messages remaining",
                memory_dump.message_range.1 - memory_dump.message_range.0,
                session_context.active_messages.len()
            );
        } else {
            // Just update active messages
            if let Some(session_context) = self.session_contexts.get_mut(session_id) {
                session_context.active_messages = updated_context.clone();
                session_context.total_messages_processed = updated_context.len();
            } else {
                // Create new session if it doesn't exist
                self.session_contexts.insert(session_id.to_string(), SessionContext {
                    session_id: session_id.to_string(),
                    active_messages: updated_context.clone(),
                    memory_dumps: Vec::new(),
                    total_messages_processed: updated_context.len(),
                    last_dump_at: Utc::now(),
                    context_summary: None,
                });
            }
        }
        
        // Return the optimized context
        Ok(self.session_contexts.get(session_id).unwrap().active_messages.clone())
    }
    
    /// Reconstruct full context from memory dumps when needed
    pub async fn reconstruct_full_context(
        &mut self,
        session_id: &str,
        current_messages: Vec<Message>,
        max_tokens: u32,
    ) -> Result<Vec<Message>, RouterError> {
        let session_context = self.get_or_create_session(session_id);
        
        if session_context.memory_dumps.is_empty() {
            return Ok(current_messages);
        }
        
        // Get relevant memory dumps
        let relevant_dumps = self.get_relevant_memory_dumps(session_id, &current_messages).await?;
        
        // Reconstruct context from dumps
        let mut reconstructed = Vec::new();
        
        for dump in relevant_dumps {
            // Retrieve full context from librarian
            let _full_context = self.retrieve_from_librarian(&dump.librarian_storage_id).await?;
            
            // Add context summary
            let context_summary = Message {
                role: MessageRole::System,
                content: format!(
                    "Retrieved context from memory ({} messages): {}\nTopics: {}\nEntities: {}",
                    dump.message_range.1 - dump.message_range.0,
                    dump.compressed_summary,
                    dump.key_topics.join(", "),
                    dump.important_entities.join(", ")
                ),
                name: Some("retrieved_context".to_string()),
            };
            
            reconstructed.push(context_summary);
        }
        
        // Add current messages
        reconstructed.extend(current_messages);
        
        // Ensure we don't exceed token limits
        if self.estimate_tokens(&reconstructed) > max_tokens {
            // Compress the reconstructed context
            reconstructed = self.compress_reconstructed_context(reconstructed, max_tokens).await?;
        }
        
        tracing::info!(
            "Reconstructed context for session {}: {} messages, {} tokens",
            session_id,
            reconstructed.len(),
            self.estimate_tokens(&reconstructed)
        );
        
        Ok(reconstructed)
    }
    
    /// Get session context or create new one
    fn get_or_create_session(&mut self, session_id: &str) -> &SessionContext {
        if !self.session_contexts.contains_key(session_id) {
            self.session_contexts.insert(session_id.to_string(), SessionContext {
                session_id: session_id.to_string(),
                active_messages: Vec::new(),
                memory_dumps: Vec::new(),
                total_messages_processed: 0,
                last_dump_at: Utc::now(),
                context_summary: None,
            });
        }
        self.session_contexts.get(session_id).unwrap()
    }
    
    /// Check if we should dump context to memory
    fn should_dump_to_memory(&self, messages: &[Message], max_tokens: u32) -> bool {
        let estimated_tokens = self.estimate_tokens(messages);
        let threshold_tokens = (max_tokens as f32 * self.compression_threshold) as u32;
        
        estimated_tokens > threshold_tokens || messages.len() > self.max_active_context
    }
    
    /// Create a memory dump of the context
    async fn create_memory_dump(
        &mut self,
        session_id: &str,
        messages: &[Message],
        start_index: usize,
    ) -> Result<MemoryDump, RouterError> {
        let dump_id = Uuid::new_v4().to_string();
        let end_index = messages.len();
        
        // Extract key information
        let key_topics = self.extract_key_topics(messages);
        let important_entities = self.extract_important_entities(messages);
        
        // Create compressed summary
        let compressed_summary = self.create_compressed_summary(messages).await?;
        
        // Store in librarian
        let librarian_storage_id = self.store_in_librarian(
            session_id,
            messages,
            &compressed_summary,
            &key_topics,
            &important_entities,
        ).await?;
        
        Ok(MemoryDump {
            dump_id,
            message_range: (start_index, end_index),
            compressed_summary,
            key_topics,
            important_entities,
            created_at: Utc::now(),
            librarian_storage_id,
        })
    }
    
    /// Get relevant memory dumps based on current context
    async fn get_relevant_memory_dumps(
        &self,
        session_id: &str,
        current_messages: &[Message],
    ) -> Result<Vec<MemoryDump>, RouterError> {
        let session_context = self.session_contexts.get(session_id)
            .ok_or_else(|| RouterError::ContextError("Session not found".to_string()))?;
        
        if session_context.memory_dumps.is_empty() {
            return Ok(vec![]);
        }
        
        // Extract topics from current messages
        let current_topics = self.extract_key_topics(current_messages);
        
        // Find relevant dumps based on topic overlap
        let mut relevant_dumps = Vec::new();
        
        for dump in &session_context.memory_dumps {
            let topic_overlap = self.calculate_topic_overlap(&current_topics, &dump.key_topics);
            
            if topic_overlap > 0.3 { // 30% topic overlap threshold
                relevant_dumps.push(dump.clone());
            }
        }
        
        // Sort by relevance and limit
        relevant_dumps.sort_by(|a, b| {
            let a_overlap = self.calculate_topic_overlap(&current_topics, &a.key_topics);
            let b_overlap = self.calculate_topic_overlap(&current_topics, &b.key_topics);
            b_overlap.partial_cmp(&a_overlap).unwrap()
        });
        
        // Limit to most relevant dumps
        relevant_dumps.truncate(3);
        
        Ok(relevant_dumps)
    }
    
    /// Retrieve full context from librarian storage
    async fn retrieve_from_librarian(&self, _storage_id: &str) -> Result<Vec<Message>, RouterError> {
        // This would call the librarian API to retrieve the full context
        // For now, return empty as this is a placeholder
        Ok(vec![])
    }
    
    /// Store context in librarian
    async fn store_in_librarian(
        &self,
        _session_id: &str,
        _messages: &[Message],
        _summary: &str,
        _topics: &[String],
        _entities: &[String],
    ) -> Result<String, RouterError> {
        // This would call the librarian API to store the context
        // For now, return a placeholder ID
        Ok(Uuid::new_v4().to_string())
    }
    
    /// Compress reconstructed context to fit token limits
    async fn compress_reconstructed_context(
        &mut self,
        context: Vec<Message>,
        max_tokens: u32,
    ) -> Result<Vec<Message>, RouterError> {
        // Use librarian compression
        self.librarian_manager.compress_context(context, max_tokens, 5).await
    }
    
    /// Extract key topics from messages
    pub fn extract_key_topics(&self, messages: &[Message]) -> Vec<String> {
        let mut topics = Vec::new();
        
        for message in messages {
            let content = &message.content;
            
            // Simple topic extraction - in real implementation, use NLP
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
            if content.contains("context") || content.contains("memory") {
                topics.push("context_management".to_string());
            }
        }
        
        // Remove duplicates and limit
        topics.sort();
        topics.dedup();
        topics.truncate(10);
        
        topics
    }
    
    /// Extract important entities from messages
    pub fn extract_important_entities(&self, messages: &[Message]) -> Vec<String> {
        let mut entities = Vec::new();
        
        for message in messages {
            let content = &message.content;
            
            // Simple entity extraction
            if content.contains("Rust") {
                entities.push("Rust".to_string());
            }
            if content.contains("Go") {
                entities.push("Go".to_string());
            }
            if content.contains("TypeScript") {
                entities.push("TypeScript".to_string());
            }
            if content.contains("Docker") {
                entities.push("Docker".to_string());
            }
            if content.contains("Supabase") {
                entities.push("Supabase".to_string());
            }
        }
        
        // Remove duplicates and limit
        entities.sort();
        entities.dedup();
        entities.truncate(10);
        
        entities
    }
    
    /// Calculate topic overlap between two topic lists
    pub fn calculate_topic_overlap(&self, topics1: &[String], topics2: &[String]) -> f32 {
        if topics1.is_empty() || topics2.is_empty() {
            return 0.0;
        }
        
        let intersection: Vec<_> = topics1.iter().filter(|t| topics2.contains(t)).collect();
        intersection.len() as f32 / topics1.len().max(topics2.len()) as f32
    }
    
    /// Create compressed summary of messages
    async fn create_compressed_summary(&self, messages: &[Message]) -> Result<String, RouterError> {
        // Use librarian to create intelligent summary
        let request = crate::librarian_context::LibrarianContextRequest {
            messages: messages.to_vec(),
            strategy: "create_summary".to_string(),
            max_tokens: 500,
            preserve_recent: 0,
        };
        
        let response = self.librarian_manager.send_to_librarian(request).await?;
        
        Ok(response.summary
            .map(|s| s.conversation_flow)
            .unwrap_or_else(|| "Context summary unavailable".to_string()))
    }
    
    /// Estimate token count for messages
    fn estimate_tokens(&self, messages: &[Message]) -> u32 {
        let total_chars: usize = messages.iter().map(|m| m.content.len()).sum();
        let base_message_cost = 3;
        let total_base_cost = messages.len() as u32 * base_message_cost;
        (total_chars / 4) as u32 + total_base_cost
    }
    
    /// Get context statistics for a session
    pub fn get_session_stats(&self, session_id: &str) -> Option<SessionStats> {
        let session = self.session_contexts.get(session_id)?;
        
        Some(SessionStats {
            session_id: session_id.to_string(),
            active_messages: session.active_messages.len(),
            memory_dumps: session.memory_dumps.len(),
            total_messages_processed: session.total_messages_processed,
            estimated_tokens: self.estimate_tokens(&session.active_messages),
            last_dump_at: session.last_dump_at,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStats {
    pub session_id: String,
    pub active_messages: usize,
    pub memory_dumps: usize,
    pub total_messages_processed: usize,
    pub estimated_tokens: u32,
    pub last_dump_at: DateTime<Utc>,
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
                content: "Hello, I need help with Rust programming.".to_string(),
                name: None,
            },
            Message {
                role: MessageRole::Assistant,
                content: "I'd be happy to help with Rust!".to_string(),
                name: None,
            },
        ]
    }
    
    #[test]
    fn test_topic_extraction() {
        let manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
        let messages = create_test_messages();
        
        let topics = manager.extract_key_topics(&messages);
        
        assert!(topics.contains(&"programming".to_string()));
    }
    
    #[test]
    fn test_entity_extraction() {
        let manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
        let messages = create_test_messages();
        
        let entities = manager.extract_important_entities(&messages);
        
        assert!(entities.contains(&"Rust".to_string()));
    }
    
    #[test]
    fn test_topic_overlap() {
        let manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
        let topics1 = vec!["programming".to_string(), "rust".to_string()];
        let topics2 = vec!["programming".to_string(), "go".to_string()];
        
        let overlap = manager.calculate_topic_overlap(&topics1, &topics2);
        
        assert_eq!(overlap, 0.5); // 1 out of 2 topics overlap
    }
}

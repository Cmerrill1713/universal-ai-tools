//! Test module for unlimited context management
//! 
//! This module provides tests to verify that the unlimited context system
//! works correctly with librarian integration.

use crate::models::Message;
use crate::context::MessageRole;
use crate::unlimited_context::UnlimitedContextManager;
use crate::context_manager::{ContextManager, TruncationStrategy};
use crate::librarian_context::LibrarianStrategy;

fn create_test_messages(count: usize) -> Vec<Message> {
    (0..count).map(|i| Message {
        role: if i % 2 == 0 { MessageRole::User } else { MessageRole::Assistant },
        content: format!("Test message number {} with some content about programming and Rust development", i),
        name: None,
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_unlimited_context_basic_functionality() {
        let mut manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
        
        // Test with small context (should not trigger memory dump)
        let small_messages = create_test_messages(5);
        let result = manager.process_unlimited_context(
            "test_session_1",
            small_messages.clone(),
            10000, // Large token limit to avoid compression
        ).await;
        
        assert!(result.is_ok());
        let processed = result.unwrap();
        assert_eq!(processed.len(), 5); // Should keep all messages
        
        // Test session stats
        let stats = manager.get_session_stats("test_session_1");
        assert!(stats.is_some());
        let stats = stats.unwrap();
        assert_eq!(stats.session_id, "test_session_1");
        assert_eq!(stats.active_messages, 5);
    }
    
    #[tokio::test]
    async fn test_context_manager_with_librarian() {
        let mut manager = ContextManager::new()
            .with_strategy(TruncationStrategy::KeepSystemAndRecent)
            .with_librarian(
                "http://localhost:8080".to_string(),
                LibrarianStrategy::SummarizeOldKeepRecent
            );
        
        let messages = create_test_messages(10);
        let result = manager.validate_and_truncate(
            messages,
            "ollama",
            "gpt-oss:20b",
        ).await;
        
        assert!(result.is_ok());
        let processed = result.unwrap();
        assert!(processed.len() <= 10);
    }
    
    #[tokio::test]
    async fn test_session_stats() {
        let mut manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
        
        // Process some messages
        let messages = create_test_messages(15);
        let _ = manager.process_unlimited_context(
            "test_session_stats",
            messages,
            10000, // Large token limit to avoid compression
        ).await;
        
        // Get session stats
        let stats = manager.get_session_stats("test_session_stats");
        assert!(stats.is_some());
        
        let stats = stats.unwrap();
        assert_eq!(stats.session_id, "test_session_stats");
        assert!(stats.active_messages > 0);
        assert!(stats.total_messages_processed > 0);
    }
    
    #[test]
    fn test_topic_extraction() {
        let manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
        let messages = vec![
            Message {
                role: MessageRole::User,
                content: "I need help with Rust programming and database queries".to_string(),
                name: None,
            },
            Message {
                role: MessageRole::Assistant,
                content: "I can help with Rust and SQL database programming".to_string(),
                name: None,
            },
        ];
        
        let topics = manager.extract_key_topics(&messages);
        assert!(topics.contains(&"programming".to_string()));
        assert!(topics.contains(&"database".to_string()));
    }
    
    #[test]
    fn test_entity_extraction() {
        let manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
        let messages = vec![
            Message {
                role: MessageRole::User,
                content: "I'm working with Rust and Docker containers".to_string(),
                name: None,
            },
        ];
        
        let entities = manager.extract_important_entities(&messages);
        assert!(entities.contains(&"Rust".to_string()));
        assert!(entities.contains(&"Docker".to_string()));
    }
    
    #[test]
    fn test_topic_overlap_calculation() {
        let manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
        let topics1 = vec!["programming".to_string(), "rust".to_string(), "database".to_string()];
        let topics2 = vec!["programming".to_string(), "go".to_string(), "api".to_string()];
        
        let overlap = manager.calculate_topic_overlap(&topics1, &topics2);
        assert_eq!(overlap, 1.0 / 3.0); // 1 out of 3 topics overlap
    }
}

/// Integration test for the complete context management flow
#[tokio::test]
async fn test_complete_context_flow() {
    // This test simulates a real conversation flow with context management
    
    let mut unlimited_manager = UnlimitedContextManager::new("http://localhost:8080".to_string());
    let mut context_manager = ContextManager::new()
        .with_strategy(TruncationStrategy::KeepSystemAndRecent)
        .with_librarian(
            "http://localhost:8080".to_string(),
            LibrarianStrategy::SummarizeOldKeepRecent
        );
    
    let session_id = "integration_test_session";
    
    // Simulate a long conversation
    for i in 0..3 {
        let messages = create_test_messages(5); // 5 messages per "turn"
        
        // Process with unlimited context
        let unlimited_result = unlimited_manager.process_unlimited_context(
            session_id,
            messages.clone(),
            10000, // Large token limit to avoid compression
        ).await;
        
        assert!(unlimited_result.is_ok());
        
        // Also test regular context management
        let context_result = context_manager.validate_and_truncate(
            messages,
            "ollama",
            "gpt-oss:20b",
        ).await;
        
        assert!(context_result.is_ok());
        
        println!("Turn {}: Unlimited context processed successfully", i + 1);
    }
    
    // Check final session stats
    let stats = unlimited_manager.get_session_stats(session_id);
    assert!(stats.is_some());
    
    let stats = stats.unwrap();
    println!("Final session stats: {} active messages, {} memory dumps, {} total processed",
        stats.active_messages,
        stats.memory_dumps,
        stats.total_messages_processed
    );
    
    assert!(stats.total_messages_processed > 0);
}

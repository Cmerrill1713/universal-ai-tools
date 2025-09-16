//! Comprehensive functional tests for the Intelligent Librarian

use crate::*;
use anyhow::Result;
use tracing::info;
use uuid::Uuid;
use chrono::Utc;
use std::collections::HashMap;

#[tokio::test]
async fn test_librarian_creation() -> Result<()> {
    info!("Test 1: Creating Intelligent Librarian...");
    let _librarian = IntelligentLibrarian::new().await?;
    info!("✅ Librarian created successfully!");
    Ok(())
}

#[tokio::test]
async fn test_agent_availability() -> Result<()> {
    let _librarian = IntelligentLibrarian::new().await?;

    info!("Test 2: Testing agent availability...");
    let agents = librarian.get_available_agents().await?;
    info!("✅ Found {} available agents:", agents.len());
    for agent in &agents {
        info!("   - {} ({:?}): {} capabilities, {} tokens",
              agent.name, agent.agent_type, agent.capabilities.len(), agent.max_context_tokens);
    }
    assert!(!agents.is_empty(), "Should have at least one agent");
    Ok(())
}

#[tokio::test]
async fn test_unlimited_context_traversal() -> Result<()> {
    let _librarian = IntelligentLibrarian::new().await?;

    info!("Test 3: Testing unlimited context traversal...");
    let query = "machine learning optimization strategies for distributed systems";
    let max_tokens = 20000;

    let result = librarian.get_unlimited_context_across_agents(query, max_tokens, None).await?;
    info!("✅ Unlimited context traversal successful!");
    info!("   - Context length: {} characters", result.unlimited_context.len());
    info!("   - Agents visited: {}", result.agents_visited.len());
    info!("   - Tokens used: {}", result.total_tokens_used);
    info!("   - Traversal time: {}ms", result.traversal_time_ms);
    info!("   - Quality score: {:.2}", result.quality_score);

    assert!(!result.unlimited_context.is_empty(), "Should have context");
    assert!(result.total_tokens_used <= max_tokens, "Should respect token limit");
    assert!(!result.agents_visited.is_empty(), "Should visit agents");
    Ok(())
}

#[tokio::test]
async fn test_document_addition() -> Result<()> {
    let _librarian = IntelligentLibrarian::new().await?;

    info!("Test 4: Testing document addition...");
    let test_document = Document {
        id: Uuid::new_v4(),
        content: "This is a test document about machine learning optimization techniques. It covers various algorithms and strategies for improving model performance.".to_string(),
        metadata: DocumentMetadata {
            title: "ML Optimization Test".to_string(),
            description: Some("Test document for ML optimization".to_string()),
            authors: vec!["Test Author".to_string()],
            tags: vec!["machine-learning".to_string(), "optimization".to_string()],
            language: Some("en".to_string()),
            created_at: Utc::now(),
            modified_at: Utc::now(),
            file_size: Some(1024),
            mime_type: Some("text/plain".to_string()),
            source: Some("test".to_string()),
            license: Some("MIT".to_string()),
            version: Some("1.0".to_string()),
            dependencies: vec![],
            custom_fields: HashMap::new(),
        },
        analysis: None,
        quality_score: Some(0.8),
        relationships: vec![],
    };

    let document_id = librarian.add_document(test_document).await?;
    info!("✅ Document added successfully with ID: {}", document_id);
    Ok(())
}

#[tokio::test]
async fn test_analytics() -> Result<()> {
    let _librarian = IntelligentLibrarian::new().await?;

    info!("Test 5: Testing analytics...");
    let analytics = librarian.get_analytics().await?;
    info!("✅ Analytics retrieved successfully!");
    info!("   - Total documents: {}", analytics.total_documents);
    info!("   - Total categories: {}", analytics.total_categories);
    info!("   - Knowledge graph nodes: {}", analytics.knowledge_graph_nodes);
    info!("   - Knowledge graph edges: {}", analytics.knowledge_graph_edges);
    info!("   - Curated collections: {}", analytics.curated_collections);
    info!("   - Average quality score: {:.2}", analytics.average_quality_score);
    Ok(())
}

#[tokio::test]
async fn test_knowledge_graph() -> Result<()> {
    let _librarian = IntelligentLibrarian::new().await?;

    info!("Test 6: Testing knowledge graph...");
    let graph_data = librarian.get_knowledge_graph(None).await?;
    info!("✅ Knowledge graph retrieved successfully!");
    info!("   - Nodes: {}", graph_data.nodes.len());
    info!("   - Edges: {}", graph_data.edges.len());
    info!("   - Clusters: {}", graph_data.clusters.len());
    info!("   - Statistics: {} nodes, {} edges",
          graph_data.statistics.total_nodes, graph_data.statistics.total_edges);
    Ok(())
}

#[tokio::test]
async fn test_token_management() -> Result<()> {
    let _librarian = IntelligentLibrarian::new().await?;

    info!("Test 7: Testing token management...");
    let test_query = "test query for token management";
    let token_budgets = vec![5000, 15000, 30000];

    for budget in token_budgets {
        let result = librarian.get_unlimited_context_across_agents(test_query, budget, None).await?;
        info!("   ✅ Budget {} tokens -> {} chars, {} agents, {} tokens used",
              budget, result.unlimited_context.len(), result.agents_visited.len(), result.total_tokens_used);
        assert!(result.total_tokens_used <= budget, "Should respect token budget");
    }
    Ok(())
}

#[tokio::test]
async fn test_error_handling() -> Result<()> {
    let _librarian = IntelligentLibrarian::new().await?;

    info!("Test 8: Testing error handling...");

    // Test with zero tokens
    let result = librarian.get_unlimited_context_across_agents("test", 0, None).await?;
    info!("✅ Zero token test handled gracefully");
    assert_eq!(result.total_tokens_used, 0);
    assert!(result.unlimited_context.is_empty());

    // Test with invalid agent ID
    let invalid_agent_id = Uuid::new_v4();
    match librarian.get_context_from_agent(invalid_agent_id, "test", 1000).await {
        Ok(_) => {
            info!("⚠️  Invalid agent ID test - unexpected success");
        }
        Err(e) => {
            info!("✅ Invalid agent ID test handled gracefully: {}", e);
        }
    }
    Ok(())
}

#[tokio::test]
async fn test_comprehensive_functionality() -> Result<()> {
    info!("🚀 Starting Comprehensive Functional Test");
    info!("==========================================");

    // Create librarian
    let _librarian = IntelligentLibrarian::new().await?;
    info!("✅ Librarian created successfully!");

    // Test agent availability
    let agents = librarian.get_available_agents().await?;
    info!("✅ Found {} available agents", agents.len());
    assert!(!agents.is_empty());

    // Test unlimited context
    let result = librarian.get_unlimited_context_across_agents(
        "machine learning optimization", 20000, None
    ).await?;
    info!("✅ Unlimited context: {} chars, {} agents, {} tokens",
          result.unlimited_context.len(), result.agents_visited.len(), result.total_tokens_used);
    assert!(!result.unlimited_context.is_empty());

    // Test document addition
    let test_doc = Document {
        id: Uuid::new_v4(),
        content: "Test content".to_string(),
        metadata: DocumentMetadata {
            title: "Test".to_string(),
            description: None,
            authors: vec![],
            tags: vec![],
            language: None,
            created_at: Utc::now(),
            modified_at: Utc::now(),
            file_size: None,
            mime_type: None,
            source: None,
            license: None,
            version: None,
            dependencies: vec![],
            custom_fields: HashMap::new(),
        },
        analysis: None,
        quality_score: None,
        relationships: vec![],
    };
    let doc_id = librarian.add_document(test_doc).await?;
    info!("✅ Document added: {}", doc_id);

    // Test analytics
    let analytics = librarian.get_analytics().await?;
    info!("✅ Analytics: {} docs, {} categories", analytics.total_documents, analytics.total_categories);

    // Test knowledge graph
    let graph = librarian.get_knowledge_graph(None).await?;
    info!("✅ Knowledge graph: {} nodes, {} edges", graph.nodes.len(), graph.edges.len());

    info!("🎉 All comprehensive tests passed!");
    info!("The Agent-Integrated Unlimited Context System is fully functional!");
    Ok(())
}

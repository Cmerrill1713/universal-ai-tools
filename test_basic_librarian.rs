//! Basic test for the Intelligent Librarian

use intelligent_librarian::*;
use tracing::{info, error};
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    info!("🚀 Starting Basic Librarian Test");
    info!("================================");

    // Test basic librarian creation
    info!("Creating Intelligent Librarian...");
    let librarian = match IntelligentLibrarian::new().await {
        Ok(lib) => {
            info!("✅ Librarian created successfully!");
            lib
        }
        Err(e) => {
            error!("❌ Failed to create librarian: {}", e);
            return Err(e.into());
        }
    };

    // Test agent availability
    info!("Testing agent availability...");
    match librarian.get_available_agents().await {
        Ok(agents) => {
            info!("✅ Found {} available agents:", agents.len());
            for agent in agents {
                info!("   - {} ({:?}): {} capabilities, {} tokens",
                      agent.name, agent.agent_type, agent.capabilities.len(), agent.max_context_tokens);
            }
        }
        Err(e) => {
            error!("❌ Failed to get available agents: {}", e);
            return Err(e.into());
        }
    }

    // Test unlimited context traversal
    info!("Testing unlimited context traversal...");
    let query = "machine learning optimization strategies";
    let max_tokens = 20000;

    match librarian.get_unlimited_context_across_agents(query, max_tokens, None).await {
        Ok(result) => {
            info!("✅ Unlimited context traversal successful!");
            info!("   - Context length: {} characters", result.unlimited_context.len());
            info!("   - Agents visited: {}", result.agents_visited.len());
            info!("   - Tokens used: {}", result.total_tokens_used);
            info!("   - Traversal time: {}ms", result.traversal_time_ms);
            info!("   - Quality score: {:.2}", result.quality_score);

            if !result.errors.is_empty() {
                info!("   - Errors: {:?}", result.errors);
            }
        }
        Err(e) => {
            error!("❌ Failed unlimited context traversal: {}", e);
            return Err(e.into());
        }
    }

    // Test analytics
    info!("Testing analytics...");
    match librarian.get_analytics().await {
        Ok(analytics) => {
            info!("✅ Analytics retrieved successfully!");
            info!("   - Total documents: {}", analytics.total_documents);
            info!("   - Total categories: {}", analytics.total_categories);
            info!("   - Knowledge graph nodes: {}", analytics.knowledge_graph_nodes);
            info!("   - Knowledge graph edges: {}", analytics.knowledge_graph_edges);
            info!("   - Curated collections: {}", analytics.curated_collections);
            info!("   - Average quality score: {:.2}", analytics.average_quality_score);
        }
        Err(e) => {
            error!("❌ Failed to get analytics: {}", e);
            return Err(e.into());
        }
    }

    info!("");
    info!("🎉 Basic Librarian Test Completed Successfully!");
    info!("The Agent-Integrated Unlimited Context System is working!");

    Ok(())
}

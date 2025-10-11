//! Intelligent Librarian - Unlimited Context Knowledge Management System
//!
//! A sophisticated librarian system that provides:
//! - UNLIMITED CONTEXT through direct Supabase knowledge base integration
//! - Intelligent document classification and organization
//! - Advanced search with context awareness and semantic understanding
//! - Knowledge relationship mapping and visualization
//! - Automated content curation and quality assessment
//! - Multi-modal information retrieval (text, code, images, etc.)
//! - Real-time knowledge graph updates and maintenance
//! - Direct embedding storage and retrieval for infinite context

pub mod models;
pub mod classifier;
pub mod searcher;
pub mod curator;
pub mod knowledge_graph;
pub mod content_analyzer;
pub mod quality_assessor;
pub mod api;
pub mod storage;
pub mod embeddings;
pub mod agent_integration;

#[cfg(test)]
mod tests;

pub use models::*;
pub use classifier::*;
pub use searcher::*;
pub use curator::*;
pub use knowledge_graph::*;
pub use content_analyzer::*;
pub use quality_assessor::*;
pub use api::*;
pub use storage::*;
pub use embeddings::*;
pub use agent_integration::*;

use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Main Intelligent Librarian service with agent integration
pub struct IntelligentLibrarian {
    classifier: Arc<RwLock<DocumentClassifier>>,
    searcher: Arc<RwLock<AdvancedSearcher>>,
    curator: Arc<RwLock<ContentCurator>>,
    knowledge_graph: Arc<RwLock<KnowledgeGraph>>,
    quality_assessor: Arc<RwLock<QualityAssessor>>,
    storage: Arc<RwLock<KnowledgeStorage>>,
    agent_integration: Arc<RwLock<AgentIntegration>>,
}

impl IntelligentLibrarian {
    pub async fn new() -> Result<Self> {
        let classifier = Arc::new(RwLock::new(DocumentClassifier::new().await?));
        let searcher = Arc::new(RwLock::new(AdvancedSearcher::new().await?));
        let curator = Arc::new(RwLock::new(ContentCurator::new().await?));
        let knowledge_graph = Arc::new(RwLock::new(KnowledgeGraph::new().await?));
        let quality_assessor = Arc::new(RwLock::new(QualityAssessor::new().await?));
        let storage = Arc::new(RwLock::new(KnowledgeStorage::new().await?));
        let agent_integration = Arc::new(RwLock::new(AgentIntegration::new().await?));

        Ok(Self {
            classifier,
            searcher,
            curator,
            knowledge_graph,
            quality_assessor,
            storage,
            agent_integration,
        })
    }

    /// Add a document to the librarian system
    pub async fn add_document(&self, document: Document) -> Result<DocumentId> {
        // Create a simple classification result
        let classification = storage::ClassificationResult {
            document_id: document.id,
            category: "General".to_string(),
            confidence: 0.8,
            labels: vec!["unlabeled".to_string()],
        };

        // Store document with default quality score
        let document_id = self.storage.write().await.store_document(document, &classification, 0.8).await?;

        Ok(document_id)
    }

    /// Search for documents with advanced capabilities
    pub async fn search(&self, query: SearchQuery) -> Result<SearchResults> {
        self.searcher.read().await.search(query).await
    }

    /// Get document recommendations based on context
    pub async fn recommend(&self, context: RecommendationContext) -> Result<Vec<DocumentRecommendation>> {
        self.curator.read().await.recommend(context).await
    }

    /// Get knowledge graph visualization data
    pub async fn get_knowledge_graph(&self, filters: Option<GraphFilters>) -> Result<KnowledgeGraphData> {
        self.knowledge_graph.read().await.get_graph_data(filters).await
    }

    /// Update document metadata and relationships
    pub async fn update_document(&self, document_id: DocumentId, updates: DocumentUpdates) -> Result<()> {
        // Update storage
        self.storage.write().await.update_document(document_id, &updates).await?;

        Ok(())
    }

    /// Get unlimited context across all agents with token limits
    pub async fn get_unlimited_context_across_agents(
        &self,
        query: &str,
        max_tokens: usize,
        target_agents: Option<Vec<uuid::Uuid>>,
    ) -> Result<AgentContextResult> {
        tracing::info!("Getting unlimited context across agents for query: {}", query);

        let agent_integration = self.agent_integration.read().await;
        let result = agent_integration.traverse_context_across_agents(query, max_tokens, target_agents).await?;

        tracing::info!("Retrieved unlimited context: {} characters from {} agents using {} tokens",
              result.unlimited_context.len(), result.agents_visited.len(), result.total_tokens_used);

        Ok(result)
    }

    /// Get context from specific agent with token limits
    pub async fn get_context_from_agent(
        &self,
        agent_id: uuid::Uuid,
        query: &str,
        max_tokens: usize,
    ) -> Result<AgentContext> {
        let agent_integration = self.agent_integration.read().await;
        agent_integration.get_context_from_agent(agent_id, query, max_tokens).await
    }

    /// Get available agents for context traversal
    pub async fn get_available_agents(&self) -> Result<Vec<AgentInfo>> {
        self.agent_integration.read().await.get_available_agents().await
    }

    /// Get librarian analytics and insights
    pub async fn get_analytics(&self) -> Result<LibrarianAnalytics> {
        let storage_stats = self.storage.read().await.get_statistics().await?;
        let graph_stats = self.knowledge_graph.read().await.get_statistics().await?;
        let curation_stats = self.curator.read().await.get_statistics().await?;

        Ok(LibrarianAnalytics {
            total_documents: storage_stats.total_documents,
            total_categories: storage_stats.total_categories,
            knowledge_graph_nodes: graph_stats.total_nodes,
            knowledge_graph_edges: graph_stats.total_edges,
            curated_collections: curation_stats.total_collections,
            average_quality_score: storage_stats.average_quality_score,
            search_performance: self.searcher.read().await.get_performance_metrics().await?,
            last_updated: chrono::Utc::now(),
        })
    }
}

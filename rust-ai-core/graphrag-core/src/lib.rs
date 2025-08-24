//! GraphRAG Knowledge Engine
//! 
//! High-performance Rust implementation of Graph-based Retrieval Augmented Generation
//! with advanced entity extraction, relationship mapping, and community detection.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, instrument, warn};
use uuid::Uuid;

pub mod entities;
pub mod relationships;
pub mod communities;
pub mod embeddings;
pub mod storage;
pub mod query;

pub use entities::{Entity, EntityExtractor, EntityType};
pub use relationships::{Relationship, RelationshipExtractor, RelationshipType};
pub use communities::{Community, CommunityDetector};
pub use embeddings::{EmbeddingEngine, EmbeddingModel};
pub use storage::{GraphStorage, Neo4jStorage, PostgresStorage};
pub use query::{GraphQuery, QueryEngine, QueryResult};

/// Main GraphRAG engine that coordinates all knowledge graph operations
#[derive(Clone)]
pub struct GraphRAG {
    entity_extractor: EntityExtractor,
    relationship_extractor: RelationshipExtractor,
    community_detector: CommunityDetector,
    embedding_engine: EmbeddingEngine,
    storage: Box<dyn GraphStorage>,
    query_engine: QueryEngine,
}

/// Configuration for GraphRAG engine
#[derive(Debug, Clone, Deserialize)]
pub struct GraphRAGConfig {
    /// Entity extraction model configuration
    pub entity_model: String,
    /// Relationship extraction model configuration  
    pub relationship_model: String,
    /// Embedding model for vector representations
    pub embedding_model: String,
    /// Community detection algorithm parameters
    pub community_detection: CommunityDetectionConfig,
    /// Storage backend configuration
    pub storage: StorageConfig,
    /// Query engine parameters
    pub query: QueryConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CommunityDetectionConfig {
    pub algorithm: String, // "leiden", "louvain", "hierarchical"
    pub resolution: f64,
    pub max_iterations: usize,
    pub min_community_size: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StorageConfig {
    pub backend: String, // "neo4j", "postgres", "hybrid"
    pub neo4j_uri: Option<String>,
    pub postgres_url: Option<String>,
    pub redis_url: Option<String>,
    pub connection_pool_size: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QueryConfig {
    pub max_results: usize,
    pub similarity_threshold: f64,
    pub graph_traversal_depth: usize,
    pub enable_caching: bool,
    pub cache_ttl_seconds: u64,
}

/// Represents a knowledge graph node with rich metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeNode {
    pub id: Uuid,
    pub entity: Entity,
    pub embeddings: Vec<f32>,
    pub community_id: Option<Uuid>,
    pub metadata: HashMap<String, String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Represents a knowledge graph edge with relationship information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEdge {
    pub id: Uuid,
    pub source_id: Uuid,
    pub target_id: Uuid,
    pub relationship: Relationship,
    pub weight: f64,
    pub confidence: f64,
    pub metadata: HashMap<String, String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Document processing request for knowledge extraction
#[derive(Debug, Clone, Deserialize)]
pub struct DocumentRequest {
    pub id: String,
    pub content: String,
    pub title: Option<String>,
    pub source: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Knowledge extraction result
#[derive(Debug, Clone, Serialize)]
pub struct ExtractionResult {
    pub document_id: String,
    pub entities: Vec<Entity>,
    pub relationships: Vec<Relationship>,
    pub nodes_created: usize,
    pub edges_created: usize,
    pub processing_time_ms: u64,
}

impl GraphRAG {
    /// Create a new GraphRAG engine with the given configuration
    #[instrument(skip(config))]
    pub async fn new(config: GraphRAGConfig) -> Result<Self> {
        info!("Initializing GraphRAG engine with config");

        // Initialize components
        let entity_extractor = EntityExtractor::new(&config.entity_model).await?;
        let relationship_extractor = RelationshipExtractor::new(&config.relationship_model).await?;
        let community_detector = CommunityDetector::new(config.community_detection.clone())?;
        let embedding_engine = EmbeddingEngine::new(&config.embedding_model).await?;
        
        // Initialize storage backend
        let storage: Box<dyn GraphStorage> = match config.storage.backend.as_str() {
            "neo4j" => {
                let uri = config.storage.neo4j_uri
                    .ok_or_else(|| anyhow::anyhow!("Neo4j URI required for neo4j backend"))?;
                Box::new(Neo4jStorage::new(&uri).await?)
            }
            "postgres" => {
                let url = config.storage.postgres_url
                    .ok_or_else(|| anyhow::anyhow!("Postgres URL required for postgres backend"))?;
                Box::new(PostgresStorage::new(&url).await?)
            }
            _ => return Err(anyhow::anyhow!("Unsupported storage backend: {}", config.storage.backend)),
        };

        let query_engine = QueryEngine::new(config.query.clone(), storage.clone()).await?;

        Ok(Self {
            entity_extractor,
            relationship_extractor,
            community_detector,
            embedding_engine,
            storage,
            query_engine,
        })
    }

    /// Process a document and extract knowledge into the graph
    #[instrument(skip(self, request), fields(document_id = %request.id))]
    pub async fn process_document(&self, request: DocumentRequest) -> Result<ExtractionResult> {
        let start_time = std::time::Instant::now();
        
        info!(
            document_id = %request.id,
            content_length = request.content.len(),
            "Processing document for knowledge extraction"
        );

        // Extract entities from the document
        let entities = self.entity_extractor.extract(&request.content).await?;
        info!("Extracted {} entities", entities.len());

        // Extract relationships between entities
        let relationships = self.relationship_extractor
            .extract(&request.content, &entities).await?;
        info!("Extracted {} relationships", relationships.len());

        // Generate embeddings for entities
        let mut knowledge_nodes = Vec::new();
        for entity in &entities {
            let embeddings = self.embedding_engine.embed_entity(entity).await?;
            let node = KnowledgeNode {
                id: Uuid::new_v4(),
                entity: entity.clone(),
                embeddings,
                community_id: None, // Will be assigned during community detection
                metadata: request.metadata.clone(),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            };
            knowledge_nodes.push(node);
        }

        // Create knowledge edges from relationships
        let mut knowledge_edges = Vec::new();
        for relationship in &relationships {
            // Find corresponding nodes
            if let (Some(source_node), Some(target_node)) = (
                knowledge_nodes.iter().find(|n| n.entity.id == relationship.source_entity_id),
                knowledge_nodes.iter().find(|n| n.entity.id == relationship.target_entity_id)
            ) {
                let edge = KnowledgeEdge {
                    id: Uuid::new_v4(),
                    source_id: source_node.id,
                    target_id: target_node.id,
                    relationship: relationship.clone(),
                    weight: relationship.confidence,
                    confidence: relationship.confidence,
                    metadata: HashMap::new(),
                    created_at: chrono::Utc::now(),
                };
                knowledge_edges.push(edge);
            }
        }

        // Store nodes and edges in the graph storage
        let nodes_created = self.storage.store_nodes(&knowledge_nodes).await?;
        let edges_created = self.storage.store_edges(&knowledge_edges).await?;

        // Run community detection on the updated graph
        if knowledge_nodes.len() > 10 { // Only run for sufficiently large graphs
            if let Err(e) = self.update_communities().await {
                warn!("Community detection failed: {}", e);
            }
        }

        let processing_time = start_time.elapsed().as_millis() as u64;

        let result = ExtractionResult {
            document_id: request.id,
            entities,
            relationships,
            nodes_created,
            edges_created,
            processing_time_ms: processing_time,
        };

        info!(
            nodes_created = nodes_created,
            edges_created = edges_created,
            processing_time_ms = processing_time,
            "Document processing completed"
        );

        Ok(result)
    }

    /// Query the knowledge graph for relevant information
    #[instrument(skip(self, query))]
    pub async fn query_knowledge(&self, query: &str, max_results: Option<usize>) -> Result<QueryResult> {
        info!("Executing knowledge graph query");
        
        let graph_query = GraphQuery {
            text: query.to_string(),
            max_results: max_results.unwrap_or(10),
            include_embeddings: true,
            include_communities: true,
        };

        self.query_engine.execute_query(graph_query).await
    }

    /// Update community assignments for all nodes in the graph
    #[instrument(skip(self))]
    pub async fn update_communities(&self) -> Result<usize> {
        info!("Running community detection on knowledge graph");

        // Get all nodes and edges from storage
        let nodes = self.storage.get_all_nodes().await?;
        let edges = self.storage.get_all_edges().await?;

        if nodes.is_empty() {
            return Ok(0);
        }

        // Run community detection algorithm
        let communities = self.community_detector.detect_communities(&nodes, &edges).await?;
        
        info!("Detected {} communities", communities.len());

        // Update nodes with community assignments
        let mut updates = 0;
        for community in &communities {
            for node_id in &community.member_ids {
                if let Err(e) = self.storage.update_node_community(*node_id, community.id).await {
                    warn!("Failed to update community for node {}: {}", node_id, e);
                } else {
                    updates += 1;
                }
            }
        }

        // Store community information
        self.storage.store_communities(&communities).await?;

        info!("Updated {} nodes with community assignments", updates);
        Ok(updates)
    }

    /// Get health information about the GraphRAG engine
    pub async fn health_check(&self) -> Result<GraphRAGHealth> {
        let storage_health = self.storage.health_check().await?;
        let node_count = self.storage.get_node_count().await.unwrap_or(0);
        let edge_count = self.storage.get_edge_count().await.unwrap_or(0);
        let community_count = self.storage.get_community_count().await.unwrap_or(0);

        Ok(GraphRAGHealth {
            status: "healthy".to_string(),
            node_count,
            edge_count,
            community_count,
            storage_healthy: storage_health,
            models_loaded: true,
        })
    }
}

/// Health status of the GraphRAG engine
#[derive(Debug, Serialize)]
pub struct GraphRAGHealth {
    pub status: String,
    pub node_count: usize,
    pub edge_count: usize,
    pub community_count: usize,
    pub storage_healthy: bool,
    pub models_loaded: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test configuration for development
    pub fn test_config() -> GraphRAGConfig {
        GraphRAGConfig {
            entity_model: "test-entity-model".to_string(),
            relationship_model: "test-relationship-model".to_string(),
            embedding_model: "test-embedding-model".to_string(),
            community_detection: CommunityDetectionConfig {
                algorithm: "leiden".to_string(),
                resolution: 1.0,
                max_iterations: 100,
                min_community_size: 3,
            },
            storage: StorageConfig {
                backend: "postgres".to_string(),
                neo4j_uri: None,
                postgres_url: Some("postgresql://test:test@localhost:5432/test".to_string()),
                redis_url: Some("redis://localhost:6379".to_string()),
                connection_pool_size: 10,
            },
            query: QueryConfig {
                max_results: 50,
                similarity_threshold: 0.7,
                graph_traversal_depth: 3,
                enable_caching: true,
                cache_ttl_seconds: 3600,
            },
        }
    }
}
//! Data models for the Intelligent Librarian system

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// Unique identifier for documents
pub type DocumentId = Uuid;

/// Document content types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ContentType {
    Text,
    Code,
    Markdown,
    Image,
    Audio,
    Video,
    Data,
    Configuration,
    Documentation,
    Research,
    Tutorial,
    Reference,
}

/// Document classification categories
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum DocumentCategory {
    Technical,
    Business,
    Research,
    Educational,
    Reference,
    Creative,
    Data,
    Configuration,
    Documentation,
    Code,
    Media,
    Other,
}

/// Document metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub title: String,
    pub description: Option<String>,
    pub authors: Vec<String>,
    pub tags: Vec<String>,
    pub language: Option<String>,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
    pub file_size: Option<u64>,
    pub mime_type: Option<String>,
    pub source: Option<String>,
    pub license: Option<String>,
    pub version: Option<String>,
    pub dependencies: Vec<String>,
    pub custom_fields: HashMap<String, serde_json::Value>,
}

/// Document content analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentAnalysis {
    pub content_type: ContentType,
    pub category: DocumentCategory,
    pub topics: Vec<String>,
    pub entities: Vec<Entity>,
    pub keywords: Vec<String>,
    pub complexity_score: f64,
    pub readability_score: f64,
    pub technical_level: TechnicalLevel,
    pub language_detected: Option<String>,
    pub code_languages: Vec<String>,
    pub dependencies: Vec<String>,
    pub references: Vec<String>,
    pub sentiment: Option<Sentiment>,
    pub summary: Option<String>,
    pub embeddings: Option<Vec<f32>>,
}

/// Named entities found in content
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub text: String,
    pub entity_type: EntityType,
    pub confidence: f64,
    pub start_pos: usize,
    pub end_pos: usize,
}

/// Types of named entities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum EntityType {
    Person,
    Organization,
    Location,
    Technology,
    Concept,
    Product,
    Date,
    Number,
    Url,
    Email,
    Other,
}

/// Technical complexity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TechnicalLevel {
    Beginner,
    Intermediate,
    Advanced,
    Expert,
}

/// Sentiment analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sentiment {
    pub polarity: f64, // -1.0 to 1.0
    pub confidence: f64,
    pub emotions: HashMap<String, f64>,
}

/// Document representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: DocumentId,
    pub content: String,
    pub metadata: DocumentMetadata,
    pub analysis: Option<ContentAnalysis>,
    pub quality_score: Option<f64>,
    pub relationships: Vec<DocumentRelationship>,
}

/// Relationships between documents
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentRelationship {
    pub target_id: DocumentId,
    pub relationship_type: RelationshipType,
    pub strength: f64,
    pub context: Option<String>,
}

/// Types of document relationships
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RelationshipType {
    References,
    ReferencedBy,
    Similar,
    Related,
    DependsOn,
    DependencyOf,
    PartOf,
    Contains,
    VersionOf,
    Supersedes,
    SupersededBy,
}

/// Search query with advanced options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub search_type: SearchType,
    pub filters: SearchFilters,
    pub options: SearchOptions,
}

/// Types of search
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SearchType {
    Semantic,
    Keyword,
    Hybrid,
    Exact,
    Fuzzy,
    Regex,
}

/// Search filters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    pub content_types: Option<Vec<ContentType>>,
    pub categories: Option<Vec<DocumentCategory>>,
    pub authors: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub date_range: Option<DateRange>,
    pub quality_threshold: Option<f64>,
    pub language: Option<String>,
    pub technical_level: Option<TechnicalLevel>,
}

/// Date range filter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

/// Search options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchOptions {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub sort_by: Option<SortField>,
    pub sort_order: Option<SortOrder>,
    pub include_highlights: bool,
    pub include_analysis: bool,
    pub include_relationships: bool,
}

/// Fields to sort by
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SortField {
    Relevance,
    Date,
    Quality,
    Title,
    Author,
    Size,
}

/// Sort order
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SortOrder {
    Ascending,
    Descending,
}

/// Search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResults {
    pub documents: Vec<SearchResult>,
    pub total_count: usize,
    pub query_time_ms: u64,
    pub suggestions: Vec<String>,
    pub facets: SearchFacets,
}

/// Individual search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub document: Document,
    pub relevance_score: f64,
    pub highlights: Vec<Highlight>,
    pub matched_fields: Vec<String>,
    pub explanation: Option<String>,
}

/// Text highlight in search results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Highlight {
    pub field: String,
    pub text: String,
    pub start_pos: usize,
    pub end_pos: usize,
}

/// Search facets for filtering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFacets {
    pub content_types: HashMap<ContentType, usize>,
    pub categories: HashMap<DocumentCategory, usize>,
    pub authors: HashMap<String, usize>,
    pub tags: HashMap<String, usize>,
    pub date_ranges: Vec<(String, usize)>,
}

/// Recommendation context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationContext {
    pub user_id: Option<String>,
    pub current_document: Option<DocumentId>,
    pub interests: Vec<String>,
    pub recent_documents: Vec<DocumentId>,
    pub search_history: Vec<String>,
    pub preferences: RecommendationPreferences,
}

/// Recommendation preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationPreferences {
    pub content_types: Vec<ContentType>,
    pub categories: Vec<DocumentCategory>,
    pub technical_level: Option<TechnicalLevel>,
    pub max_results: usize,
    pub diversity_factor: f64,
}

/// Document recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentRecommendation {
    pub document: Document,
    pub relevance_score: f64,
    pub reason: String,
    pub confidence: f64,
}

/// Document updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentUpdates {
    pub metadata_updates: Option<DocumentMetadata>,
    pub tags_add: Vec<String>,
    pub tags_remove: Vec<String>,
    pub relationships_add: Vec<DocumentRelationship>,
    pub relationships_remove: Vec<DocumentId>,
    pub custom_fields: HashMap<String, serde_json::Value>,
}

impl DocumentUpdates {
    pub fn requires_recuration(&self) -> bool {
        self.metadata_updates.is_some() ||
        !self.tags_add.is_empty() ||
        !self.tags_remove.is_empty() ||
        !self.relationships_add.is_empty()
    }
}

/// Knowledge graph filters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphFilters {
    pub node_types: Option<Vec<String>>,
    pub edge_types: Option<Vec<String>>,
    pub min_connections: Option<usize>,
    pub max_depth: Option<usize>,
    pub include_isolated: bool,
}

/// Knowledge graph data for visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeGraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub clusters: Vec<GraphCluster>,
    pub statistics: GraphStatistics,
}

/// Graph node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub node_type: String,
    pub properties: HashMap<String, serde_json::Value>,
    pub position: Option<(f64, f64)>,
    pub size: f64,
    pub color: String,
}

/// Graph edge
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub edge_type: String,
    pub weight: f64,
    pub properties: HashMap<String, serde_json::Value>,
}

/// Graph cluster
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphCluster {
    pub id: String,
    pub label: String,
    pub node_ids: Vec<String>,
    pub center: (f64, f64),
    pub radius: f64,
    pub color: String,
}

/// Graph statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphStatistics {
    pub total_nodes: usize,
    pub total_edges: usize,
    pub total_clusters: usize,
    pub average_degree: f64,
    pub density: f64,
    pub modularity: f64,
}

/// Librarian analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibrarianAnalytics {
    pub total_documents: usize,
    pub total_categories: usize,
    pub knowledge_graph_nodes: usize,
    pub knowledge_graph_edges: usize,
    pub curated_collections: usize,
    pub average_quality_score: f64,
    pub search_performance: SearchPerformanceMetrics,
    pub last_updated: DateTime<Utc>,
}

/// Search performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchPerformanceMetrics {
    pub average_query_time_ms: f64,
    pub total_searches: usize,
    pub cache_hit_rate: f64,
    pub most_searched_terms: Vec<(String, usize)>,
}

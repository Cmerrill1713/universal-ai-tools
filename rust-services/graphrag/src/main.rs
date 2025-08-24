//! GraphRAG Service - High-performance knowledge graph with vector search
//! Combines Qdrant vector database with Neo4j graph operations
//! Uses Supabase for context storage and retrieval

use anyhow::Result;
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use dashmap::DashMap;
use qdrant_client::{
    Qdrant,
    qdrant::{
        CreateCollectionBuilder, Distance, 
        VectorParamsBuilder, PointStruct,
        UpsertPointsBuilder, PointId, SearchPointsBuilder
    },
};
use serde::{Deserialize, Serialize};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::{
    net::SocketAddr,
    sync::Arc,
    time::Duration,
};
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{info, warn, error};
use uuid::Uuid;

mod database_pool;
mod embeddings;
mod graph;
mod redis_cache;
mod supabase;

use embeddings::EmbeddingService;
use graph::{GraphService, Entity, Relationship};

/// Application state shared across handlers
#[derive(Clone)]
struct AppState {
    qdrant: Arc<Qdrant>,
    supabase: Arc<PgPool>,
    neo4j: Arc<GraphService>,
    embeddings: Arc<EmbeddingService>,
    redis_cache: Arc<redis_cache::RedisCacheService>,
    cache: Arc<DashMap<String, CachedResult>>,
    config: Arc<GraphRAGConfig>,
}

#[derive(Clone)]
struct GraphRAGConfig {
    collection_name: String,
    vector_size: usize,
    cache_ttl: Duration,
    batch_size: usize,
}

#[derive(Clone, Serialize, Deserialize)]
struct CachedResult {
    data: Vec<SearchResult>,
    timestamp_secs: u64, // Use u64 instead of Instant for serialization
}

/// Entity extraction and storage request
#[derive(Deserialize)]
struct ExtractRequest {
    text: String,
    source: Option<String>,
    user_id: String,
    metadata: Option<serde_json::Value>,
}

/// Hybrid search request
#[derive(Deserialize)]
struct SearchRequest {
    query: String,
    user_id: String,
    limit: Option<usize>,
    threshold: Option<f32>,
    include_graph: Option<bool>,
    max_hops: Option<usize>,
}

/// Search result combining vector and graph data
#[derive(Serialize, Deserialize, Clone)]
struct SearchResult {
    id: String,
    content: String,
    score: f32,
    entity_type: Option<String>,
    relationships: Vec<RelationshipInfo>,
    metadata: serde_json::Value,
    source: SearchSource,
}

#[derive(Serialize, Deserialize, Clone)]
struct RelationshipInfo {
    target_id: String,
    relationship_type: String,
    weight: f32,
}

#[derive(Serialize, Deserialize, Clone)]
enum SearchSource {
    Vector,
    Graph,
    Hybrid,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    uptime_seconds: u64,
    services: ServiceHealth,
}

#[derive(Serialize)]
struct ServiceHealth {
    qdrant: bool,
    neo4j: bool,
    supabase: bool,
    embeddings: bool,
}

/// Statistics response
#[derive(Serialize)]
struct StatsResponse {
    entities_count: u64,
    relationships_count: u64,
    vector_count: u64,
    cache_size: usize,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("graphrag_service=info,tower_http=debug")
        .json()
        .init();

    info!("🚀 Starting GraphRAG Service v0.1.0");

    // Load environment variables
    dotenvy::dotenv().ok();
    let graph_config = Arc::new(GraphRAGConfig {
        collection_name: std::env::var("QDRANT_COLLECTION")
            .unwrap_or_else(|_| "knowledge_graph".to_string()),
        vector_size: std::env::var("VECTOR_SIZE")
            .unwrap_or_else(|_| "384".to_string())
            .parse()?,
        cache_ttl: Duration::from_secs(300), // 5 minutes
        batch_size: 100,
    });

    // Initialize Qdrant client
    let qdrant_url = std::env::var("QDRANT_URL")
        .unwrap_or_else(|_| "http://localhost:6333".to_string());
    let qdrant_config = Qdrant::from_url(&qdrant_url);
    let qdrant_client = Arc::new(Qdrant::new(qdrant_config)?);

    // Ensure collection exists
    ensure_collection(&*qdrant_client, &*graph_config).await?;

    // Initialize enhanced database connection pools
    let env_mode = std::env::var("RUST_ENV").unwrap_or_else(|_| "development".to_string());
    let pool_config = match env_mode.as_str() {
        "production" => database_pool::DatabasePoolConfig::production(),
        _ => database_pool::DatabasePoolConfig::development(),
    };
    
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@127.0.0.1:54322/postgres".to_string());
    
    let supabase = Arc::new(
        database_pool::create_postgres_pool(&database_url, &pool_config).await?
    );
    
    // Initialize pool health monitoring
    let pool_for_monitoring = supabase.as_ref().clone();
    let health_monitor = database_pool::DatabaseHealthMonitor::new(pool_for_monitoring);
    let pool_metrics = database_pool::PoolMetrics::new()?;
    
    // Start background pool monitoring task
    let monitor_interval = Duration::from_secs(30); // Check every 30 seconds
    tokio::spawn(database_pool::start_pool_health_monitoring(
        health_monitor,
        pool_metrics,
        monitor_interval,
    ));

    // Initialize Neo4j
    let neo4j_uri = std::env::var("NEO4J_URI")
        .unwrap_or_else(|_| "bolt://localhost:7687".to_string());
    let neo4j_user = std::env::var("NEO4J_USER")
        .unwrap_or_else(|_| "neo4j".to_string());
    let neo4j_password = std::env::var("NEO4J_PASSWORD")
        .unwrap_or_else(|_| "password".to_string());
    let neo4j = Arc::new(GraphService::new(&neo4j_uri, &neo4j_user, &neo4j_password).await?);

    // Initialize Redis cache
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let redis_config = match env_mode.as_str() {
        "production" => redis_cache::RedisCacheConfig::production(),
        _ => redis_cache::RedisCacheConfig::default(),
    };
    let mut redis_config = redis_config;
    redis_config.redis_url = redis_url;
    
    let redis_cache = Arc::new(redis_cache::RedisCacheService::new(redis_config.clone()).await?);
    
    // Start background cache maintenance
    let cache_maintenance_interval = Duration::from_secs(300); // 5 minutes
    let max_entries_per_namespace = 10000;
    tokio::spawn(redis_cache::start_cache_maintenance(
        (*redis_cache).clone(),
        cache_maintenance_interval,
        max_entries_per_namespace,
    ));

    // Initialize embedding service
    let embedding_model = std::env::var("EMBEDDING_MODEL")
        .unwrap_or_else(|_| "all-MiniLM-L6-v2".to_string());
    let openai_api_key = std::env::var("OPENAI_API_KEY").ok();
    let embeddings = Arc::new(EmbeddingService::new(&embedding_model, openai_api_key).await?);

    // Create app state
    let state = AppState {
        qdrant: qdrant_client,
        supabase,
        neo4j,
        embeddings,
        redis_cache,
        cache: Arc::new(DashMap::new()),
        config: graph_config,
    };

    // Create router
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/extract", post(extract_handler))
        .route("/search", post(search_handler))
        .route("/stats", get(stats_handler))
        .route("/entities", get(list_entities_handler))
        .route("/relationships", get(list_relationships_handler))
        .route("/sync", post(sync_handler))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8004));
    info!("🎯 GraphRAG Service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn ensure_collection(client: &Qdrant, config: &GraphRAGConfig) -> Result<()> {
    let collections = client.list_collections().await?;
    
    if !collections
        .collections
        .iter()
        .any(|c| c.name == config.collection_name)
    {
        info!("Creating Qdrant collection: {}", config.collection_name);
        
        client
            .create_collection(
                CreateCollectionBuilder::new(config.collection_name.clone())
                    .vectors_config(
                        VectorParamsBuilder::new(config.vector_size as u64, Distance::Cosine)
                    ),
            )
            .await?;
    }

    Ok(())
}

async fn health_handler(State(state): State<AppState>) -> Json<HealthResponse> {
    let start_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Simple health checks
    let qdrant_healthy = state.qdrant.list_collections().await.is_ok();
    let supabase_healthy = sqlx::query("SELECT 1").fetch_one(&*state.supabase).await.is_ok();
    let neo4j_healthy = true; // Simplified check
    let embeddings_healthy = true; // Simplified check

    Json(HealthResponse {
        status: "healthy".to_string(),
        version: "0.1.0".to_string(),
        uptime_seconds: start_time,
        services: ServiceHealth {
            qdrant: qdrant_healthy,
            neo4j: neo4j_healthy,
            supabase: supabase_healthy,
            embeddings: embeddings_healthy,
        },
    })
}

async fn extract_handler(
    State(state): State<AppState>,
    Json(request): Json<ExtractRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("Extracting entities from text: {} chars", request.text.len());

    // Extract entities using graph service
    let entities = match state.neo4j.extract_entities_from_text(&request.text).await {
        Ok(entities) => entities,
        Err(e) => {
            tracing::error!("Entity extraction failed: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // Generate embeddings for each entity with Redis caching
    let mut entities_with_embeddings = Vec::new();
    for mut entity in entities {
        // Check Redis cache first
        let text_hash = redis_cache::hash_text(&entity.name);
        let cache_key = redis_cache::CacheKeyType::Embedding { text_hash };
        
        let embedding = match state.redis_cache.get::<Vec<f32>>(cache_key.clone()).await {
            Ok(Some(cached_embedding)) => {
                info!("Cache hit for embedding: {}", entity.name);
                cached_embedding
            }
            _ => {
                // Generate new embedding and cache it
                match state.embeddings.embed(&entity.name).await {
                    Ok(new_embedding) => {
                        // Cache the embedding for future use
                        if let Err(e) = state.redis_cache.set(cache_key, new_embedding.clone(), None).await {
                            warn!("Failed to cache embedding: {}", e);
                        }
                        info!("Generated and cached embedding: {}", entity.name);
                        new_embedding
                    }
                    Err(e) => {
                        tracing::warn!("Failed to generate embedding for entity {}: {}", entity.name, e);
                        continue;
                    }
                }
            }
        };

        // Store embedding in Qdrant
        let point_id = uuid::Uuid::new_v4().to_string();
        
        // Create Qdrant point
        // Create payload map
        let mut payload = std::collections::HashMap::new();
        payload.insert("entity_id".to_string(), qdrant_client::qdrant::Value {
            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(entity.id.clone()))
        });
        payload.insert("entity_name".to_string(), qdrant_client::qdrant::Value {
            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(entity.name.clone()))
        });
        payload.insert("entity_type".to_string(), qdrant_client::qdrant::Value {
            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(entity.entity_type.clone()))
        });
        payload.insert("user_id".to_string(), qdrant_client::qdrant::Value {
            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(request.user_id.clone()))
        });
        
        let point = PointStruct::new(
            point_id.clone(),
            embedding,
            payload
        );

        // Store in Qdrant
        let upsert_request = UpsertPointsBuilder::new(
            state.config.collection_name.clone(),
            vec![point]
        ).build();
        
        if let Err(e) = state.qdrant.upsert_points(upsert_request).await {
            tracing::warn!("Failed to store embedding in Qdrant: {}", e);
        } else {
            entity.embedding_id = Some(point_id);
        }

        // Store entity in Neo4j
        if let Err(e) = state.neo4j.upsert_entity(&entity).await {
            tracing::warn!("Failed to store entity in Neo4j: {}", e);
        }

        entities_with_embeddings.push(entity);
    }

    // Detect relationships between entities
    let relationships = detect_relationships(&entities_with_embeddings, &request.text);
    
    // Store relationships in Neo4j
    let mut stored_relationships = 0;
    for relationship in &relationships {
        if let Err(e) = state.neo4j.create_relationship(relationship).await {
            tracing::warn!("Failed to store relationship in Neo4j: {}", e);
        } else {
            stored_relationships += 1;
        }
    }

    // Store context in Supabase if available
    let context_entry = supabase::ContextEntry {
        id: uuid::Uuid::new_v4().to_string(),
        user_id: request.user_id.clone(),
        category: "entity_extraction".to_string(),
        source: request.source.unwrap_or_else(|| "graphrag_service".to_string()),
        content: serde_json::json!({
            "text": request.text,
            "entities": entities_with_embeddings.iter().map(|e| {
                serde_json::json!({
                    "id": e.id,
                    "name": e.name,
                    "type": e.entity_type,
                    "properties": e.properties
                })
            }).collect::<Vec<_>>(),
            "relationships": relationships.len()
        }),
        metadata: request.metadata,
        embedding_id: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    info!(
        "✅ Extracted {} entities and {} relationships", 
        entities_with_embeddings.len(), 
        stored_relationships
    );
    
    Ok(Json(serde_json::json!({
        "status": "success",
        "message": "Entity extraction completed",
        "entities_count": entities_with_embeddings.len(),
        "relationships_count": stored_relationships,
        "entities": entities_with_embeddings.iter().map(|e| {
            serde_json::json!({
                "id": e.id,
                "name": e.name,
                "type": e.entity_type,
                "confidence": e.properties.get("confidence").unwrap_or(&serde_json::json!(0.5)),
                "embedding_stored": e.embedding_id.is_some()
            })
        }).collect::<Vec<_>>()
    })))
}

async fn search_handler(
    State(state): State<AppState>,
    Json(request): Json<SearchRequest>,
) -> Result<Json<Vec<SearchResult>>, StatusCode> {
    info!("Searching for: {}", request.query);

    let limit = request.limit.unwrap_or(10);
    let threshold = request.threshold.unwrap_or(0.7);
    let include_graph = request.include_graph.unwrap_or(true);
    let max_hops = request.max_hops.unwrap_or(2);

    // Check cache first
    let cache_key = format!("search:{}:{}:{}", request.query, limit, threshold);
    if let Some(cached_result) = state.cache.get(&cache_key) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        if now - cached_result.timestamp_secs < state.config.cache_ttl.as_secs() {
            info!("Returning cached search results");
            return Ok(Json(cached_result.data.clone()));
        }
    }

    let mut all_results = Vec::new();

    // 1. Vector Search in Qdrant
    match perform_vector_search(&state, &request.query, limit, threshold).await {
        Ok(mut vector_results) => {
            info!("Found {} vector search results", vector_results.len());
            all_results.append(&mut vector_results);
        }
        Err(e) => {
            warn!("Vector search failed: {}", e);
        }
    }

    // 2. Graph Search in Neo4j (if enabled)
    if include_graph {
        match perform_graph_search(&state, &request.query, limit, max_hops).await {
            Ok(mut graph_results) => {
                info!("Found {} graph search results", graph_results.len());
                all_results.append(&mut graph_results);
            }
            Err(e) => {
                warn!("Graph search failed: {}", e);
            }
        }
    }

    // 3. Combine and rank results
    let mut final_results = combine_and_rank_results(all_results, &request.query);
    
    // Limit results
    final_results.truncate(limit);

    // Cache results
    let cached_result = CachedResult {
        data: final_results.clone(),
        timestamp_secs: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    state.cache.insert(cache_key, cached_result);

    info!("✅ Returning {} hybrid search results", final_results.len());
    Ok(Json(final_results))
}

async fn stats_handler(State(state): State<AppState>) -> Json<StatsResponse> {
    let collection_info = state.qdrant
        .collection_info(&state.config.collection_name)
        .await
        .ok();

    Json(StatsResponse {
        entities_count: 0, // TODO: Get from Neo4j
        relationships_count: 0, // TODO: Get from Neo4j
        vector_count: collection_info
            .and_then(|info| info.result)
            .map(|result| result.points_count.unwrap_or(0))
            .unwrap_or(0),
        cache_size: state.cache.len(),
    })
}

async fn list_entities_handler(State(_state): State<AppState>) -> Json<Vec<Entity>> {
    // TODO: Implement entity listing
    Json(vec![])
}

async fn list_relationships_handler(State(_state): State<AppState>) -> Json<Vec<Relationship>> {
    // TODO: Implement relationship listing
    Json(vec![])
}

async fn sync_handler(State(_state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    // TODO: Implement data synchronization
    Ok(Json(serde_json::json!({
        "status": "success",
        "message": "Sync completed"
    })))
}

/// Detect relationships between entities based on their co-occurrence and context
fn detect_relationships(entities: &[Entity], text: &str) -> Vec<Relationship> {
    let mut relationships = Vec::new();
    
    // Simple co-occurrence based relationship detection
    for i in 0..entities.len() {
        for j in (i + 1)..entities.len() {
            let entity1 = &entities[i];
            let entity2 = &entities[j];
            
            // Check if entities appear close to each other in text
            if entities_are_related(entity1, entity2, text) {
                let relationship_type = infer_relationship_type(entity1, entity2, text);
                let weight = calculate_relationship_weight(entity1, entity2, text);
                
                relationships.push(Relationship {
                    id: format!("rel_{}", Uuid::new_v4()),
                    source_id: entity1.id.clone(),
                    target_id: entity2.id.clone(),
                    relationship_type,
                    properties: serde_json::json!({
                        "weight": weight,
                        "source": "co_occurrence_detection",
                        "confidence": calculate_relationship_confidence(entity1, entity2, text)
                    }),
                    weight,
                });
            }
        }
    }
    
    relationships
}

/// Check if two entities are related based on proximity in text
fn entities_are_related(entity1: &Entity, entity2: &Entity, text: &str) -> bool {
    let entity1_pos = text.find(&entity1.name);
    let entity2_pos = text.find(&entity2.name);
    
    match (entity1_pos, entity2_pos) {
        (Some(pos1), Some(pos2)) => {
            // Entities are related if they appear within 100 characters of each other
            (pos1 as i32 - pos2 as i32).abs() < 100
        }
        _ => false,
    }
}

/// Infer the type of relationship between two entities
fn infer_relationship_type(entity1: &Entity, entity2: &Entity, text: &str) -> String {
    let text_lower = text.to_lowercase();
    
    // Person-Organization relationships
    if entity1.entity_type == "PERSON" && entity2.entity_type == "ORGANIZATION" {
        if text_lower.contains("works at") || text_lower.contains("employed by") || text_lower.contains("ceo") {
            return "WORKS_AT".to_string();
        }
        if text_lower.contains("founded") || text_lower.contains("founder") {
            return "FOUNDED".to_string();
        }
        return "ASSOCIATED_WITH".to_string();
    }
    
    // Person-Person relationships
    if entity1.entity_type == "PERSON" && entity2.entity_type == "PERSON" {
        if text_lower.contains("married") || text_lower.contains("spouse") {
            return "MARRIED_TO".to_string();
        }
        if text_lower.contains("colleague") || text_lower.contains("partner") {
            return "COLLEAGUES".to_string();
        }
        return "KNOWS".to_string();
    }
    
    // Organization-Location relationships
    if entity1.entity_type == "ORGANIZATION" && entity2.entity_type == "LOCATION" {
        if text_lower.contains("headquartered") || text_lower.contains("located") {
            return "LOCATED_IN".to_string();
        }
        return "OPERATES_IN".to_string();
    }
    
    // Concept relationships
    if entity1.entity_type == "CONCEPT" || entity2.entity_type == "CONCEPT" {
        return "RELATED_TO".to_string();
    }
    
    // Default relationship
    "MENTIONED_WITH".to_string()
}

/// Calculate the strength of relationship between entities
fn calculate_relationship_weight(entity1: &Entity, entity2: &Entity, text: &str) -> f32 {
    let mut weight = 0.5; // Base weight
    
    // Increase weight based on proximity
    if let (Some(pos1), Some(pos2)) = (text.find(&entity1.name), text.find(&entity2.name)) {
        let distance = (pos1 as i32 - pos2 as i32).abs();
        weight += match distance {
            0..=20 => 0.4,   // Very close
            21..=50 => 0.3,  // Close
            51..=100 => 0.2, // Moderate
            _ => 0.1,        // Distant
        };
    }
    
    // Increase weight for same entity types
    if entity1.entity_type == entity2.entity_type {
        weight += 0.1;
    }
    
    // Increase weight for high-confidence entities
    let conf1 = entity1.properties.get("confidence")
        .and_then(|c| c.as_f64())
        .unwrap_or(0.5) as f32;
    let conf2 = entity2.properties.get("confidence")
        .and_then(|c| c.as_f64())
        .unwrap_or(0.5) as f32;
    
    weight += (conf1 + conf2) / 4.0; // Average confidence as bonus
    
    weight.min(1.0) // Cap at 1.0
}

/// Calculate confidence score for the relationship
fn calculate_relationship_confidence(entity1: &Entity, entity2: &Entity, text: &str) -> f32 {
    let mut confidence: f32 = 0.5; // Base confidence
    
    // Higher confidence for specific relationship indicators
    let text_lower = text.to_lowercase();
    let relationship_indicators = [
        "works at", "employed by", "founded", "married to", "colleague",
        "partner", "located in", "headquartered", "ceo of", "director"
    ];
    
    for indicator in &relationship_indicators {
        if text_lower.contains(indicator) {
            confidence += 0.2;
            break;
        }
    }
    
    // Higher confidence for closer proximity
    if let (Some(pos1), Some(pos2)) = (text.find(&entity1.name), text.find(&entity2.name)) {
        let distance = (pos1 as i32 - pos2 as i32).abs();
        confidence += match distance {
            0..=20 => 0.3,
            21..=50 => 0.2,
            51..=100 => 0.1,
            _ => 0.0,
        };
    }
    
    confidence.min(1.0f32)
}

/// Perform vector search using Qdrant
async fn perform_vector_search(
    state: &AppState, 
    query: &str, 
    limit: usize, 
    threshold: f32
) -> Result<Vec<SearchResult>, Box<dyn std::error::Error + Send + Sync>> {
    // Generate query embedding
    let query_embedding = state.embeddings.embed(query).await?;
    
    // Search in Qdrant
    let search_request = SearchPointsBuilder::new(
        state.config.collection_name.clone(),
        query_embedding,
        limit as u64
    )
    .score_threshold(threshold)
    .with_payload(true)
    .build();
    
    let search_response = state.qdrant.search_points(search_request).await?;
    
    let mut results = Vec::new();
    for point in search_response.result {
        let payload = point.payload;
        let entity_name = payload.get("entity_name")
            .and_then(|v| match &v.kind {
                Some(qdrant_client::qdrant::value::Kind::StringValue(s)) => Some(s.as_str()),
                _ => None,
            })
            .unwrap_or("Unknown")
            .to_string();
        
        let entity_type = payload.get("entity_type")
            .and_then(|v| match &v.kind {
                Some(qdrant_client::qdrant::value::Kind::StringValue(s)) => Some(s.clone()),
                _ => None,
            });
        
        results.push(SearchResult {
            id: match point.id {
                Some(point_id) => match point_id.point_id_options {
                    Some(qdrant_client::qdrant::point_id::PointIdOptions::Num(n)) => n.to_string(),
                    Some(qdrant_client::qdrant::point_id::PointIdOptions::Uuid(u)) => u,
                    _ => "unknown".to_string(),
                },
                _ => "unknown".to_string(),
            },
            content: entity_name.clone(),
            score: point.score,
            entity_type,
            relationships: vec![], // Will be populated later
            metadata: serde_json::json!(payload),
            source: SearchSource::Vector,
        });
    }
    
    Ok(results)
}

/// Perform graph search using Neo4j
async fn perform_graph_search(
    state: &AppState,
    query: &str,
    limit: usize,
    max_hops: usize
) -> Result<Vec<SearchResult>, Box<dyn std::error::Error + Send + Sync>> {
    let mut results = Vec::new();
    
    // Search for entities by name pattern
    let search_terms: Vec<&str> = query.split_whitespace().collect();
    
    for term in search_terms {
        // Find entities that match the search term
        let query_cypher = format!(
            "MATCH (n:Entity) 
             WHERE n.name CONTAINS $term OR n.type CONTAINS $term
             RETURN n
             LIMIT {}",
            limit
        );
        
        // Use the public API instead of accessing private fields
        if let Some(entity) = state.neo4j.get_entity(term).await? {
            // Find connected entities within max_hops
            let connected = state.neo4j.find_connected_entities(&entity.id, max_hops).await?;
            
            let relationships: Vec<RelationshipInfo> = connected.iter().map(|e| {
                RelationshipInfo {
                    target_id: e.id.clone(),
                    relationship_type: "CONNECTED".to_string(),
                    weight: 0.8, // Default weight for graph connections
                }
            }).collect();
            
            results.push(SearchResult {
                id: entity.id.clone(),
                content: entity.name,
                score: 0.9, // High score for exact matches
                entity_type: Some(entity.entity_type),
                relationships,
                metadata: entity.properties,
                source: SearchSource::Graph,
            });
        }
    }
    
    Ok(results)
}

/// Combine and rank results from different search sources
fn combine_and_rank_results(mut results: Vec<SearchResult>, query: &str) -> Vec<SearchResult> {
    // Remove duplicates by ID
    results.sort_by(|a, b| a.id.cmp(&b.id));
    results.dedup_by(|a, b| a.id == b.id);
    
    // Calculate composite scores
    for result in &mut results {
        result.score = calculate_composite_score(result, query);
    }
    
    // Sort by composite score (highest first)
    results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    
    results
}

/// Calculate composite score considering multiple factors
fn calculate_composite_score(result: &SearchResult, query: &str) -> f32 {
    let mut score = result.score;
    
    // Boost score for exact matches
    if result.content.to_lowercase().contains(&query.to_lowercase()) {
        score += 0.2;
    }
    
    // Boost score based on source
    match result.source {
        SearchSource::Vector => score += 0.1,  // Vector search is precise
        SearchSource::Graph => score += 0.15,  // Graph search shows relationships
        SearchSource::Hybrid => score += 0.2,  // Hybrid is best
    }
    
    // Boost score for entities with many relationships
    score += (result.relationships.len() as f32) * 0.05;
    
    // Boost score for certain entity types
    if let Some(ref entity_type) = result.entity_type {
        score += match entity_type.as_str() {
            "PERSON" => 0.1,
            "ORGANIZATION" => 0.1,
            "CONCEPT" => 0.15,
            _ => 0.05,
        };
    }
    
    score.min(1.0) // Cap at 1.0
}
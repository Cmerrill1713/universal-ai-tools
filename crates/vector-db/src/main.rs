use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use nalgebra::DVector;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
};
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{info, warn};
use uuid::Uuid;

mod storage;
use storage::{VectorStorage, PersistenceConfig, StorageStats};

// Core types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vector {
    pub id: String,
    pub vector: Vec<f32>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub dimension: usize,
    pub metric: DistanceMetric,
    pub size: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DistanceMetric {
    Cosine,
    Euclidean,
    DotProduct,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRequest {
    pub vector: Vec<f32>,
    pub k: usize,
    pub filter: Option<HashMap<String, serde_json::Value>>,
    pub include_metadata: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub score: f32,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub text: String,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
    pub model: String,
    pub dimension: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchEmbeddingRequest {
    pub texts: Vec<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchEmbeddingResponse {
    pub embeddings: Vec<Vec<f32>>,
    pub model: String,
    pub dimension: usize,
}

// Index trait for different index implementations
trait VectorIndex: Send + Sync {
    fn add(&mut self, id: String, vector: Vec<f32>, metadata: HashMap<String, serde_json::Value>);
    fn search(&self, query: &[f32], k: usize, filter: Option<&HashMap<String, serde_json::Value>>) -> Vec<SearchResult>;
    fn delete(&mut self, id: &str) -> bool;
    fn size(&self) -> usize;
    #[allow(dead_code)]
    fn clear(&mut self);
}

// HNSW Index implementation
struct HNSWIndex {
    vectors: DashMap<String, Vector>,
    dimension: usize,
    metric: DistanceMetric,
}

impl HNSWIndex {
    fn new(dimension: usize, metric: DistanceMetric) -> Self {
        Self {
            vectors: DashMap::new(),
            dimension,
            metric,
        }
    }

    fn calculate_distance(&self, a: &[f32], b: &[f32]) -> f32 {
        match self.metric {
            DistanceMetric::Cosine => self.cosine_distance(a, b),
            DistanceMetric::Euclidean => self.euclidean_distance(a, b),
            DistanceMetric::DotProduct => self.dot_product(a, b),
        }
    }

    fn cosine_distance(&self, a: &[f32], b: &[f32]) -> f32 {
        let a_vec = DVector::from_vec(a.to_vec());
        let b_vec = DVector::from_vec(b.to_vec());

        let dot = a_vec.dot(&b_vec);
        let norm_a = a_vec.norm();
        let norm_b = b_vec.norm();

        if norm_a == 0.0 || norm_b == 0.0 {
            return 1.0;
        }

        1.0 - (dot / (norm_a * norm_b))
    }

    fn euclidean_distance(&self, a: &[f32], b: &[f32]) -> f32 {
        let a_vec = DVector::from_vec(a.to_vec());
        let b_vec = DVector::from_vec(b.to_vec());

        (a_vec - b_vec).norm()
    }

    fn dot_product(&self, a: &[f32], b: &[f32]) -> f32 {
        let a_vec = DVector::from_vec(a.to_vec());
        let b_vec = DVector::from_vec(b.to_vec());

        -a_vec.dot(&b_vec) // Negative for similarity (higher dot product = more similar)
    }
}

impl VectorIndex for HNSWIndex {
    fn add(&mut self, id: String, vector: Vec<f32>, metadata: HashMap<String, serde_json::Value>) {
        if vector.len() != self.dimension {
            warn!("Vector dimension mismatch: expected {}, got {}", self.dimension, vector.len());
            return;
        }

        let vec = Vector {
            id: id.clone(),
            vector,
            metadata,
            timestamp: Utc::now(),
        };

        self.vectors.insert(id, vec);
    }

    fn search(&self, query: &[f32], k: usize, filter: Option<&HashMap<String, serde_json::Value>>) -> Vec<SearchResult> {
        if query.len() != self.dimension {
            warn!("Query dimension mismatch: expected {}, got {}", self.dimension, query.len());
            return Vec::new();
        }

        let mut results: Vec<(String, f32, HashMap<String, serde_json::Value>)> = Vec::new();

        // Brute force search for now (replace with HNSW algorithm for production)
        for entry in self.vectors.iter() {
            let vec = entry.value();

            // Apply filter if provided
            if let Some(filter) = filter {
                let mut matches = true;
                for (key, value) in filter {
                    if vec.metadata.get(key) != Some(value) {
                        matches = false;
                        break;
                    }
                }
                if !matches {
                    continue;
                }
            }

            let distance = self.calculate_distance(query, &vec.vector);
            results.push((vec.id.clone(), distance, vec.metadata.clone()));
        }

        // Sort by distance and take top k
        results.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
        results.truncate(k);

        results
            .into_iter()
            .map(|(id, score, metadata)| SearchResult {
                id,
                score,
                metadata: Some(metadata),
            })
            .collect()
    }

    fn delete(&mut self, id: &str) -> bool {
        self.vectors.remove(id).is_some()
    }

    fn size(&self) -> usize {
        self.vectors.len()
    }

    fn clear(&mut self) {
        self.vectors.clear();
    }
}

// Mock embedding model (replace with actual model in production)
struct MockEmbeddingModel {
    dimension: usize,
}

impl MockEmbeddingModel {
    fn new(dimension: usize) -> Self {
        Self { dimension }
    }

    fn embed(&self, text: &str) -> Vec<f32> {
        // Simple hash-based embedding for testing
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        text.hash(&mut hasher);
        let hash = hasher.finish();

        let mut embedding = Vec::with_capacity(self.dimension);
        for i in 0..self.dimension {
            let value = ((hash.wrapping_mul(i as u64 + 1) % 1000) as f32) / 1000.0;
            embedding.push(value);
        }

        // Normalize
        let norm: f32 = embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for value in &mut embedding {
                *value /= norm;
            }
        }

        embedding
    }
}

// Application state
#[derive(Clone)]
struct AppState {
    #[allow(clippy::type_complexity)]
    collections: Arc<DashMap<String, Arc<RwLock<Box<dyn VectorIndex>>>>>,
    collection_info: Arc<DashMap<String, Collection>>,
    embedding_model: Arc<MockEmbeddingModel>,
    storage: Option<Arc<VectorStorage>>,
}

impl AppState {
    fn new() -> Self {
        Self {
            collections: Arc::new(DashMap::new()),
            collection_info: Arc::new(DashMap::new()),
            embedding_model: Arc::new(MockEmbeddingModel::new(768)), // Default dimension
            storage: None,
        }
    }

    fn with_storage(storage: Arc<VectorStorage>) -> Self {
        Self {
            collections: Arc::new(DashMap::new()),
            collection_info: Arc::new(DashMap::new()),
            embedding_model: Arc::new(MockEmbeddingModel::new(768)),
            storage: Some(storage),
        }
    }
}

// API Handlers
async fn create_collection(
    State(state): State<AppState>,
    Json(mut collection): Json<Collection>,
) -> Result<Json<Collection>, StatusCode> {
    collection.id = Uuid::new_v4().to_string();
    collection.created_at = Utc::now();
    collection.updated_at = Utc::now();
    collection.size = 0;

    let index: Box<dyn VectorIndex> = Box::new(HNSWIndex::new(collection.dimension, collection.metric));

    state.collections.insert(
        collection.id.clone(),
        Arc::new(RwLock::new(index)),
    );

    state.collection_info.insert(collection.id.clone(), collection.clone());

    Ok(Json(collection))
}

async fn get_collection(
    State(state): State<AppState>,
    Path(collection_id): Path<String>,
) -> Result<Json<Collection>, StatusCode> {
    state
        .collection_info
        .get(&collection_id)
        .map(|entry| Json(entry.clone()))
        .ok_or(StatusCode::NOT_FOUND)
}

async fn list_collections(
    State(state): State<AppState>,
) -> Json<Vec<Collection>> {
    let collections: Vec<Collection> = state
        .collection_info
        .iter()
        .map(|entry| entry.value().clone())
        .collect();

    Json(collections)
}

async fn add_vector(
    State(state): State<AppState>,
    Path(collection_id): Path<String>,
    Json(vector): Json<Vector>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let index = state
        .collections
        .get(&collection_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let mut index = index.write();
    index.add(vector.id.clone(), vector.vector, vector.metadata);

    // Update collection info
    if let Some(mut info) = state.collection_info.get_mut(&collection_id) {
        info.size = index.size();
        info.updated_at = Utc::now();
    }

    Ok(Json(serde_json::json!({
        "id": vector.id,
        "success": true
    })))
}

async fn search_vectors(
    State(state): State<AppState>,
    Path(collection_id): Path<String>,
    Json(request): Json<SearchRequest>,
) -> Result<Json<Vec<SearchResult>>, StatusCode> {
    let index = state
        .collections
        .get(&collection_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let index = index.read();
    let results = index.search(&request.vector, request.k, request.filter.as_ref());

    Ok(Json(results))
}

async fn delete_vector(
    State(state): State<AppState>,
    Path((collection_id, vector_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let index = state
        .collections
        .get(&collection_id)
        .ok_or(StatusCode::NOT_FOUND)?;

    let mut index = index.write();
    let deleted = index.delete(&vector_id);

    // Update collection info
    if deleted {
        if let Some(mut info) = state.collection_info.get_mut(&collection_id) {
            info.size = index.size();
            info.updated_at = Utc::now();
        }
    }

    Ok(Json(serde_json::json!({
        "deleted": deleted
    })))
}

async fn embed_text(
    State(state): State<AppState>,
    Json(request): Json<EmbeddingRequest>,
) -> Json<EmbeddingResponse> {
    let embedding = state.embedding_model.embed(&request.text);
    let dimension = embedding.len();

    Json(EmbeddingResponse {
        embedding,
        model: request.model.unwrap_or_else(|| "mock-embedding-v1".to_string()),
        dimension,
    })
}

async fn batch_embed_text(
    State(state): State<AppState>,
    Json(request): Json<BatchEmbeddingRequest>,
) -> Json<BatchEmbeddingResponse> {
    let embeddings: Vec<Vec<f32>> = request
        .texts
        .iter()
        .map(|text| state.embedding_model.embed(text))
        .collect();

    let dimension = embeddings.first().map(|e| e.len()).unwrap_or(0);

    Json(BatchEmbeddingResponse {
        embeddings,
        model: request.model.unwrap_or_else(|| "mock-embedding-v1".to_string()),
        dimension,
    })
}

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "vector-db",
        "timestamp": Utc::now().timestamp(),
    }))
}

// Persistence endpoints
async fn create_snapshot(State(state): State<AppState>) -> Result<Json<storage::SnapshotMetadata>, StatusCode> {
    match &state.storage {
        Some(storage) => {
            match storage.create_snapshot().await {
                Ok(metadata) => Ok(Json(metadata)),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        None => Err(StatusCode::NOT_IMPLEMENTED),
    }
}

async fn list_snapshots(State(state): State<AppState>) -> Result<Json<Vec<storage::SnapshotMetadata>>, StatusCode> {
    match &state.storage {
        Some(storage) => {
            match storage.list_snapshots().await {
                Ok(snapshots) => Ok(Json(snapshots)),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        None => Err(StatusCode::NOT_IMPLEMENTED),
    }
}

async fn get_snapshot(
    State(state): State<AppState>,
    Path(snapshot_id): Path<String>,
) -> Result<Json<storage::SnapshotMetadata>, StatusCode> {
    match &state.storage {
        Some(storage) => {
            match storage.list_snapshots().await {
                Ok(snapshots) => {
                    if let Some(snapshot) = snapshots.iter().find(|s| s.id == snapshot_id) {
                        Ok(Json(snapshot.clone()))
                    } else {
                        Err(StatusCode::NOT_FOUND)
                    }
                }
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        None => Err(StatusCode::NOT_IMPLEMENTED),
    }
}

async fn get_storage_stats(State(state): State<AppState>) -> Result<Json<StorageStats>, StatusCode> {
    match &state.storage {
        Some(storage) => {
            match storage.get_storage_stats().await {
                Ok(stats) => Ok(Json(stats)),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        None => Err(StatusCode::NOT_IMPLEMENTED),
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    // Load environment variables
    dotenv::dotenv().ok();


    // Initialize storage if enabled
    let state = if std::env::var("VECTOR_DB_PERSISTENCE").unwrap_or_else(|_| "false".to_string()) == "true" {
        let config = PersistenceConfig::default();
        let storage = Arc::new(VectorStorage::new(config)?);

        // Start snapshot scheduler
        storage.clone().start_snapshot_scheduler().await?;

        AppState::with_storage(storage)
    } else {
        AppState::new()
    };

    // Create default collection
    let default_collection = Collection {
        id: "default".to_string(),
        name: "Default Collection".to_string(),
        dimension: 768,
        metric: DistanceMetric::Cosine,
        size: 0,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    let index: Box<dyn VectorIndex> = Box::new(HNSWIndex::new(
        default_collection.dimension,
        default_collection.metric,
    ));

    state.collections.insert(
        default_collection.id.clone(),
        Arc::new(RwLock::new(index)),
    );

    state.collection_info.insert(
        default_collection.id.clone(),
        default_collection,
    );

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/collections", post(create_collection).get(list_collections))
        .route("/collections/:id", get(get_collection))
        .route("/collections/:id/vectors", post(add_vector))
        .route("/collections/:id/search", post(search_vectors))
        .route("/collections/:id/vectors/:vector_id", delete(delete_vector))
        .route("/embed", post(embed_text))
        .route("/embed/batch", post(batch_embed_text))
        .route("/snapshots", get(list_snapshots).post(create_snapshot))
        .route("/snapshots/:id", get(get_snapshot))
        .route("/storage/stats", get(get_storage_stats))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(
                    CorsLayer::new()
                        .allow_origin(Any)
                        .allow_methods(Any)
                        .allow_headers(Any),
                ),
        )
        .with_state(state);

    // Start server
    let port = std::env::var("PORT").unwrap_or_else(|_| "8092".to_string()).parse::<u16>().unwrap_or(8092);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("Vector DB service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

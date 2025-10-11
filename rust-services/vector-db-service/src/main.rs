use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tower_http::cors::CorsLayer;
use tracing::info;

#[derive(Debug, Serialize, Deserialize)]
struct HealthResponse {
    status: String,
    service: String,
    port: u16,
    endpoints: Vec<String>,
    timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Vector {
    id: String,
    data: Vec<f32>,
    metadata: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchRequest {
    query_vector: Vec<f32>,
    limit: Option<usize>,
    threshold: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SearchResponse {
    results: Vec<Vector>,
    count: usize,
    search_time_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct InsertRequest {
    vectors: Vec<Vector>,
}

#[derive(Debug, Serialize, Deserialize)]
struct InsertResponse {
    inserted_count: usize,
    success: bool,
}

// In-memory vector storage (for demo purposes)
type VectorStore = HashMap<String, Vector>;

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "Vector DB Service".to_string(),
        port: 3034,
        endpoints: vec![
            "GET /health".to_string(),
            "POST /vectors".to_string(),
            "GET /vectors/:id".to_string(),
            "POST /search".to_string(),
            "GET /vectors".to_string(),
        ],
        timestamp: chrono::Utc::now().to_rfc3339(),
    })
}

async fn insert_vectors(
    Json(payload): Json<InsertRequest>,
) -> Result<Json<InsertResponse>, StatusCode> {
    info!("Inserting {} vectors", payload.vectors.len());
    
    // In a real implementation, this would store to a persistent database
    let inserted_count = payload.vectors.len();
    
    Ok(Json(InsertResponse {
        inserted_count,
        success: true,
    }))
}

async fn get_vector(Path(id): Path<String>) -> Result<Json<Vector>, StatusCode> {
    info!("Retrieving vector: {}", id);
    
    // Mock vector for demo
    let vector = Vector {
        id: id.clone(),
        data: vec![0.1, 0.2, 0.3, 0.4, 0.5],
        metadata: HashMap::from([
            ("type".to_string(), "demo".to_string()),
            ("created_at".to_string(), chrono::Utc::now().to_rfc3339()),
        ]),
    };
    
    Ok(Json(vector))
}

async fn search_vectors(
    Json(payload): Json<SearchRequest>,
) -> Result<Json<SearchResponse>, StatusCode> {
    info!("Searching vectors with query length: {}", payload.query_vector.len());
    
    let start_time = std::time::Instant::now();
    
    // Mock search results
    let results = vec![
        Vector {
            id: "vector_1".to_string(),
            data: vec![0.1, 0.2, 0.3, 0.4, 0.5],
            metadata: HashMap::from([
                ("similarity".to_string(), "0.95".to_string()),
                ("type".to_string(), "document".to_string()),
            ]),
        },
        Vector {
            id: "vector_2".to_string(),
            data: vec![0.2, 0.3, 0.4, 0.5, 0.6],
            metadata: HashMap::from([
                ("similarity".to_string(), "0.87".to_string()),
                ("type".to_string(), "image".to_string()),
            ]),
        },
    ];
    
    let search_time = start_time.elapsed().as_millis() as u64;
    
    let count = results.len();
    Ok(Json(SearchResponse {
        results,
        count,
        search_time_ms: search_time,
    }))
}

async fn list_vectors() -> Result<Json<Vec<Vector>>, StatusCode> {
    info!("Listing all vectors");
    
    // Mock vector list
    let vectors = vec![
        Vector {
            id: "vector_1".to_string(),
            data: vec![0.1, 0.2, 0.3, 0.4, 0.5],
            metadata: HashMap::from([("type".to_string(), "document".to_string())]),
        },
        Vector {
            id: "vector_2".to_string(),
            data: vec![0.2, 0.3, 0.4, 0.5, 0.6],
            metadata: HashMap::from([("type".to_string(), "image".to_string())]),
        },
    ];
    
    Ok(Json(vectors))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    
    info!("Starting Vector DB Service on port 3034");
    
    let app = Router::new()
        .route("/health", get(health))
        .route("/vectors", post(insert_vectors))
        .route("/vectors", get(list_vectors))
        .route("/vectors/:id", get(get_vector))
        .route("/search", post(search_vectors))
        .layer(CorsLayer::permissive());
    
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3034")
        .await
        .expect("Failed to bind to port 3034");
    
    info!("Vector DB Service listening on http://0.0.0.0:3034");
    
    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
}

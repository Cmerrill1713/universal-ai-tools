use axum::{
    extract::{Path, Query, State, Multipart},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::SocketAddr, sync::Arc};
use tokio::sync::RwLock;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{error, info};
use anyhow::Result;

mod config;
mod model_manager;
mod inference_engine;
mod training_coordinator;
mod model_registry;
mod metrics_collector;

use config::Config;
use model_manager::ModelManager;
use inference_engine::InferenceEngine;
use training_coordinator::TrainingCoordinator;
use model_registry::ModelRegistry;
use metrics_collector::MetricsCollector;

// Core data structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub model_type: ModelType,
    pub framework: MLFramework,
    pub status: ModelStatus,
    pub file_path: Option<String>,
    pub file_size: u64,
    pub checksum: String,
    pub metadata: ModelMetadata,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub description: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Vec<String>,
    pub parameters: HashMap<String, serde_json::Value>,
    pub performance_metrics: HashMap<String, f64>,
    pub hardware_requirements: HardwareRequirements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareRequirements {
    pub min_memory_gb: f64,
    pub recommended_memory_gb: f64,
    pub gpu_required: bool,
    pub gpu_memory_gb: Option<f64>,
    pub cpu_cores: Option<u32>,
    pub storage_gb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelType {
    #[serde(rename = "language_model")]
    LanguageModel,
    #[serde(rename = "embedding_model")]
    EmbeddingModel,
    #[serde(rename = "vision_model")]
    VisionModel,
    #[serde(rename = "audio_model")]
    AudioModel,
    #[serde(rename = "multimodal")]
    Multimodal,
    #[serde(rename = "custom")]
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MLFramework {
    #[serde(rename = "pytorch")]
    PyTorch,
    #[serde(rename = "tensorflow")]
    TensorFlow,
    #[serde(rename = "onnx")]
    ONNX,
    #[serde(rename = "huggingface")]
    HuggingFace,
    #[serde(rename = "candle")]
    Candle,
    #[serde(rename = "mlx")]
    MLX,
    #[serde(rename = "custom")]
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelStatus {
    #[serde(rename = "uploading")]
    Uploading,
    #[serde(rename = "processing")]
    Processing,
    #[serde(rename = "ready")]
    Ready,
    #[serde(rename = "training")]
    Training,
    #[serde(rename = "fine_tuning")]
    FineTuning,
    #[serde(rename = "error")]
    Error,
    #[serde(rename = "deprecated")]
    Deprecated,
}

// Training structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingJob {
    pub id: String,
    pub model_id: String,
    pub dataset_id: String,
    pub training_config: TrainingConfig,
    pub status: TrainingStatus,
    pub progress: f64,
    pub metrics: TrainingMetrics,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingConfig {
    pub epochs: u32,
    pub batch_size: u32,
    pub learning_rate: f64,
    pub optimizer: String,
    pub loss_function: String,
    pub validation_split: f64,
    pub early_stopping: bool,
    pub checkpoint_frequency: u32,
    pub hyperparameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingMetrics {
    pub loss: Vec<f64>,
    pub accuracy: Vec<f64>,
    pub validation_loss: Vec<f64>,
    pub validation_accuracy: Vec<f64>,
    pub learning_rate_history: Vec<f64>,
    pub epoch_times: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum TrainingStatus {
    #[serde(rename = "queued")]
    Queued,
    #[serde(rename = "running")]
    Running,
    #[serde(rename = "paused")]
    Paused,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
    #[serde(rename = "cancelled")]
    Cancelled,
}

// Inference structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceRequest {
    pub model_id: String,
    pub input: InferenceInput,
    pub parameters: HashMap<String, serde_json::Value>,
    pub stream: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceInput {
    pub text: Option<String>,
    pub image_url: Option<String>,
    pub audio_url: Option<String>,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceResponse {
    pub id: String,
    pub model_id: String,
    pub output: InferenceOutput,
    pub metadata: InferenceMetadata,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceOutput {
    pub text: Option<String>,
    pub embeddings: Option<Vec<f32>>,
    pub classification: Option<HashMap<String, f64>>,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceMetadata {
    pub processing_time_ms: u64,
    pub tokens_used: Option<u32>,
    pub cost_estimate: Option<f64>,
    pub confidence_score: Option<f64>,
}

// Dataset structures
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dataset {
    pub id: String,
    pub name: String,
    pub dataset_type: DatasetType,
    pub format: DatasetFormat,
    pub size: u64,
    pub sample_count: u32,
    pub file_path: String,
    pub metadata: DatasetMetadata,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DatasetType {
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "image")]
    Image,
    #[serde(rename = "audio")]
    Audio,
    #[serde(rename = "multimodal")]
    Multimodal,
    #[serde(rename = "structured")]
    Structured,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DatasetFormat {
    #[serde(rename = "json")]
    JSON,
    #[serde(rename = "jsonl")]
    JSONL,
    #[serde(rename = "csv")]
    CSV,
    #[serde(rename = "parquet")]
    Parquet,
    #[serde(rename = "hdf5")]
    HDF5,
    #[serde(rename = "custom")]
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetMetadata {
    pub description: Option<String>,
    pub source: Option<String>,
    pub license: Option<String>,
    pub schema: Option<serde_json::Value>,
    pub statistics: HashMap<String, serde_json::Value>,
}

// Application state
#[derive(Clone)]
struct AppState {
    config: Config,
    model_manager: Arc<RwLock<ModelManager>>,
    inference_engine: Arc<RwLock<InferenceEngine>>,
    training_coordinator: Arc<RwLock<TrainingCoordinator>>,
    model_registry: Arc<RwLock<ModelRegistry>>,
    metrics_collector: Arc<MetricsCollector>,
}

// Health check response
#[derive(Serialize)]
struct HealthResponse {
    service: String,
    version: String,
    status: String,
    timestamp: chrono::DateTime<chrono::Utc>,
    components: HashMap<String, String>,
}

// API endpoints
async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        service: "ML Model Management Service".to_string(),
        version: "1.0.0".to_string(),
        status: "healthy".to_string(),
        timestamp: chrono::Utc::now(),
        components: {
            let mut map = HashMap::new();
            map.insert("model_manager".to_string(), "operational".to_string());
            map.insert("inference_engine".to_string(), "operational".to_string());
            map.insert("training_coordinator".to_string(), "operational".to_string());
            map.insert("model_registry".to_string(), "operational".to_string());
            map.insert("metrics_collector".to_string(), "operational".to_string());
            map
        },
    })
}

// Model Management Endpoints
async fn list_models(State(state): State<AppState>) -> Result<Json<Vec<ModelInfo>>, StatusCode> {
    match state.model_registry.read().await.list_models().await {
        Ok(models) => Ok(Json(models)),
        Err(e) => {
            error!("Failed to list models: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_model(
    Path(model_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<ModelInfo>, StatusCode> {
    match state.model_registry.read().await.get_model(&model_id).await {
        Ok(Some(model)) => Ok(Json(model)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get model {}: {}", model_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn upload_model(
    State(state): State<AppState>,
    multipart: Multipart,
) -> Result<Json<ModelInfo>, StatusCode> {
    match state.model_manager.write().await.upload_model(multipart).await {
        Ok(model) => Ok(Json(model)),
        Err(e) => {
            error!("Failed to upload model: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn delete_model(
    Path(model_id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, StatusCode> {
    match state.model_manager.write().await.delete_model(&model_id).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            error!("Failed to delete model {}: {}", model_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Inference Endpoints
async fn run_inference(
    State(state): State<AppState>,
    Json(request): Json<InferenceRequest>,
) -> Result<Json<InferenceResponse>, StatusCode> {
    match state.inference_engine.read().await.run_inference(request).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => {
            error!("Failed to run inference: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_inference_history(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<InferenceResponse>>, StatusCode> {
    let limit = params.get("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(50);
    let offset = params.get("offset")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    match state.inference_engine.read().await.get_history(limit, offset).await {
        Ok(history) => Ok(Json(history)),
        Err(e) => {
            error!("Failed to get inference history: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Training Endpoints
async fn start_training(
    State(state): State<AppState>,
    Json(config): Json<TrainingConfig>,
) -> Result<Json<TrainingJob>, StatusCode> {
    match state.training_coordinator.write().await.start_training(config).await {
        Ok(job) => Ok(Json(job)),
        Err(e) => {
            error!("Failed to start training: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_training_job(
    Path(job_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<TrainingJob>, StatusCode> {
    match state.training_coordinator.read().await.get_job(&job_id).await {
        Ok(Some(job)) => Ok(Json(job)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            error!("Failed to get training job {}: {}", job_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn list_training_jobs(
    State(state): State<AppState>,
) -> Result<Json<Vec<TrainingJob>>, StatusCode> {
    match state.training_coordinator.read().await.list_jobs().await {
        Ok(jobs) => Ok(Json(jobs)),
        Err(e) => {
            error!("Failed to list training jobs: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn stop_training(
    Path(job_id): Path<String>,
    State(state): State<AppState>,
) -> Result<StatusCode, StatusCode> {
    match state.training_coordinator.write().await.stop_training(&job_id).await {
        Ok(_) => Ok(StatusCode::OK),
        Err(e) => {
            error!("Failed to stop training job {}: {}", job_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Dataset Endpoints
async fn list_datasets(State(state): State<AppState>) -> Result<Json<Vec<Dataset>>, StatusCode> {
    match state.model_registry.read().await.list_datasets().await {
        Ok(datasets) => Ok(Json(datasets)),
        Err(e) => {
            error!("Failed to list datasets: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn upload_dataset(
    State(state): State<AppState>,
    multipart: Multipart,
) -> Result<Json<Dataset>, StatusCode> {
    match state.model_manager.write().await.upload_dataset(multipart).await {
        Ok(dataset) => Ok(Json(dataset)),
        Err(e) => {
            error!("Failed to upload dataset: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// Metrics Endpoints
async fn get_metrics(State(state): State<AppState>) -> Result<Json<HashMap<String, serde_json::Value>>, StatusCode> {
    match state.metrics_collector.get_all_metrics().await {
        Ok(metrics) => Ok(Json(metrics)),
        Err(e) => {
            error!("Failed to get metrics: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn get_model_metrics(
    Path(model_id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<HashMap<String, serde_json::Value>>, StatusCode> {
    match state.metrics_collector.get_model_metrics(&model_id).await {
        Ok(metrics) => Ok(Json(metrics)),
        Err(e) => {
            error!("Failed to get model metrics for {}: {}", model_id, e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .init();

    info!("🤖 Starting ML Model Management Service");

    // Load configuration
    let config = Config::new().await?;
    config.validate()?;
    info!("Configuration loaded successfully");

    // Initialize components
    let model_manager = Arc::new(RwLock::new(ModelManager::new(&config).await?));
    info!("🔧 Model Manager initialized");

    let inference_engine = Arc::new(RwLock::new(InferenceEngine::new(&config).await?));
    info!("🚀 Inference Engine initialized");

    let training_coordinator = Arc::new(RwLock::new(TrainingCoordinator::new(&config).await?));
    info!("🎯 Training Coordinator initialized");

    let model_registry = Arc::new(RwLock::new(ModelRegistry::new(&config).await?));
    info!("📚 Model Registry initialized");

    let metrics_collector = Arc::new(MetricsCollector::new(&config).await?);
    info!("📊 Metrics Collector initialized");

    info!("🤖 ML Model Management components initialized");

    let app_state = AppState {
        config: config.clone(),
        model_manager,
        inference_engine,
        training_coordinator,
        model_registry,
        metrics_collector,
    };

    // Background tasks
    let _metrics_task = {
        let metrics_collector = app_state.metrics_collector.clone();
        tokio::spawn(async move {
            metrics_collector.start_collection().await;
        })
    };
    info!("📈 Background metrics collection started");

    // Build router
    let app = Router::new()
        // Health endpoint
        .route("/health", get(health))
        
        // Model Management
        .route("/api/models", get(list_models).post(upload_model))
        .route("/api/models/:id", get(get_model).delete(delete_model))
        
        // Inference
        .route("/api/inference", post(run_inference))
        .route("/api/inference/history", get(get_inference_history))
        
        // Training
        .route("/api/training/jobs", get(list_training_jobs).post(start_training))
        .route("/api/training/jobs/:id", get(get_training_job).delete(stop_training))
        
        // Datasets
        .route("/api/datasets", get(list_datasets).post(upload_dataset))
        
        // Metrics
        .route("/api/metrics", get(get_metrics))
        .route("/api/metrics/models/:id", get(get_model_metrics))
        
        .with_state(app_state)
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any));

    let addr = SocketAddr::from(([127, 0, 0, 1], config.server.port));
    info!("🌐 ML Model Management Service starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
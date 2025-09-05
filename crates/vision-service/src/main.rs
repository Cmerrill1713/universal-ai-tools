use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use bytes::Bytes;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use image::{DynamicImage, ImageFormat};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    io::Cursor,
    net::SocketAddr,
    sync::Arc,
    time::Duration,
};
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{error, info, warn};
use uuid::Uuid;

// Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionRequest {
    pub image: String, // Base64 encoded image or URL
    pub prompt: Option<String>,
    pub model: Option<String>,
    pub max_tokens: Option<usize>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionResponse {
    pub id: String,
    pub description: String,
    pub objects: Vec<DetectedObject>,
    pub metadata: VisionMetadata,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedObject {
    pub label: String,
    pub confidence: f32,
    pub bbox: Option<BoundingBox>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub processing_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRRequest {
    pub image: String, // Base64 encoded image or URL
    pub languages: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OCRResponse {
    pub id: String,
    pub text: String,
    pub blocks: Vec<TextBlock>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextBlock {
    pub text: String,
    pub confidence: f32,
    pub bbox: BoundingBox,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageGenerationRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub seed: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageGenerationResponse {
    pub id: String,
    pub images: Vec<String>, // Base64 encoded images
    pub prompt: String,
    pub metadata: GenerationMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationMetadata {
    pub width: u32,
    pub height: u32,
    pub steps: u32,
    pub guidance_scale: f32,
    pub seed: u64,
    pub generation_time_ms: u64,
}

// Application state
#[derive(Clone)]
pub struct AppState {
    vision_cache: Arc<DashMap<String, VisionResponse>>,
    ocr_cache: Arc<DashMap<String, OCRResponse>>,
    generation_cache: Arc<DashMap<String, ImageGenerationResponse>>,
    model_manager: Arc<RwLock<ModelManager>>,
}

pub struct ModelManager {
    vision_models: HashMap<String, Box<dyn VisionModel>>,
    ocr_models: HashMap<String, Box<dyn OCRModel>>,
    generation_models: HashMap<String, Box<dyn GenerationModel>>,
}

// Trait definitions for different model types
trait VisionModel: Send + Sync {
    fn analyze(&self, image: &DynamicImage, prompt: Option<&str>) -> anyhow::Result<VisionResponse>;
}

trait OCRModel: Send + Sync {
    fn extract_text(&self, image: &DynamicImage) -> anyhow::Result<OCRResponse>;
}

trait GenerationModel: Send + Sync {
    fn generate(&self, request: &ImageGenerationRequest) -> anyhow::Result<ImageGenerationResponse>;
}

// Mock implementations for now
struct MockVisionModel;
struct MockOCRModel;
struct MockGenerationModel;

impl VisionModel for MockVisionModel {
    fn analyze(&self, image: &DynamicImage, prompt: Option<&str>) -> anyhow::Result<VisionResponse> {
        let (width, height) = image.dimensions();
        
        Ok(VisionResponse {
            id: Uuid::new_v4().to_string(),
            description: prompt.unwrap_or("An image").to_string(),
            objects: vec![
                DetectedObject {
                    label: "object".to_string(),
                    confidence: 0.95,
                    bbox: Some(BoundingBox {
                        x: 10.0,
                        y: 10.0,
                        width: 100.0,
                        height: 100.0,
                    }),
                },
            ],
            metadata: VisionMetadata {
                width,
                height,
                format: "jpeg".to_string(),
                processing_time_ms: 100,
            },
            model: "mock-vision-v1".to_string(),
        })
    }
}

impl OCRModel for MockOCRModel {
    fn extract_text(&self, _image: &DynamicImage) -> anyhow::Result<OCRResponse> {
        Ok(OCRResponse {
            id: Uuid::new_v4().to_string(),
            text: "Sample extracted text".to_string(),
            blocks: vec![
                TextBlock {
                    text: "Sample".to_string(),
                    confidence: 0.98,
                    bbox: BoundingBox {
                        x: 0.0,
                        y: 0.0,
                        width: 50.0,
                        height: 20.0,
                    },
                },
            ],
            confidence: 0.95,
        })
    }
}

impl GenerationModel for MockGenerationModel {
    fn generate(&self, request: &ImageGenerationRequest) -> anyhow::Result<ImageGenerationResponse> {
        // Generate a simple placeholder image
        let width = request.width.unwrap_or(512);
        let height = request.height.unwrap_or(512);
        
        let img = image::RgbImage::new(width, height);
        let mut buf = Vec::new();
        let mut cursor = Cursor::new(&mut buf);
        
        DynamicImage::ImageRgb8(img)
            .write_to(&mut cursor, ImageFormat::Png)
            .map_err(|e| anyhow::anyhow!("Failed to encode image: {}", e))?;
        
        Ok(ImageGenerationResponse {
            id: Uuid::new_v4().to_string(),
            images: vec![BASE64.encode(&buf)],
            prompt: request.prompt.clone(),
            metadata: GenerationMetadata {
                width,
                height,
                steps: request.steps.unwrap_or(50),
                guidance_scale: request.guidance_scale.unwrap_or(7.5),
                seed: request.seed.unwrap_or(42),
                generation_time_ms: 1000,
            },
        })
    }
}

// API Handlers
async fn analyze_image(
    State(state): State<AppState>,
    Json(request): Json<VisionRequest>,
) -> Result<Json<VisionResponse>, AppError> {
    let start = std::time::Instant::now();
    
    // Decode image
    let image_data = if request.image.starts_with("http") {
        // Fetch from URL
        let response = reqwest::get(&request.image).await?;
        response.bytes().await?
    } else {
        // Decode from base64
        Bytes::from(BASE64.decode(&request.image)?)
    };
    
    // Load image
    let img = image::load_from_memory(&image_data)?;
    
    // Get model
    let model_name = request.model.as_deref().unwrap_or("default");
    let model_manager = state.model_manager.read().await;
    
    let model = model_manager
        .vision_models
        .get(model_name)
        .ok_or_else(|| anyhow::anyhow!("Model not found: {}", model_name))?;
    
    // Analyze
    let mut response = model.analyze(&img, request.prompt.as_deref())?;
    response.metadata.processing_time_ms = start.elapsed().as_millis() as u64;
    
    // Cache result
    state.vision_cache.insert(response.id.clone(), response.clone());
    
    Ok(Json(response))
}

async fn extract_text(
    State(state): State<AppState>,
    Json(request): Json<OCRRequest>,
) -> Result<Json<OCRResponse>, AppError> {
    // Decode image
    let image_data = if request.image.starts_with("http") {
        let response = reqwest::get(&request.image).await?;
        response.bytes().await?
    } else {
        Bytes::from(BASE64.decode(&request.image)?)
    };
    
    // Load image
    let img = image::load_from_memory(&image_data)?;
    
    // Get OCR model
    let model_manager = state.model_manager.read().await;
    let model = model_manager
        .ocr_models
        .get("default")
        .ok_or_else(|| anyhow::anyhow!("OCR model not found"))?;
    
    // Extract text
    let response = model.extract_text(&img)?;
    
    // Cache result
    state.ocr_cache.insert(response.id.clone(), response.clone());
    
    Ok(Json(response))
}

async fn generate_image(
    State(state): State<AppState>,
    Json(request): Json<ImageGenerationRequest>,
) -> Result<Json<ImageGenerationResponse>, AppError> {
    let start = std::time::Instant::now();
    
    // Get generation model
    let model_manager = state.model_manager.read().await;
    let model = model_manager
        .generation_models
        .get("default")
        .ok_or_else(|| anyhow::anyhow!("Generation model not found"))?;
    
    // Generate image
    let mut response = model.generate(&request)?;
    response.metadata.generation_time_ms = start.elapsed().as_millis() as u64;
    
    // Cache result
    state.generation_cache.insert(response.id.clone(), response.clone());
    
    Ok(Json(response))
}

async fn upload_and_analyze(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<VisionResponse>, AppError> {
    let mut image_data = Vec::new();
    let mut prompt = None;
    
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("").to_string();
        
        match name.as_str() {
            "image" => {
                image_data = field.bytes().await?.to_vec();
            }
            "prompt" => {
                prompt = Some(field.text().await?);
            }
            _ => {}
        }
    }
    
    if image_data.is_empty() {
        return Err(AppError::BadRequest("No image provided".to_string()));
    }
    
    // Create vision request
    let request = VisionRequest {
        image: BASE64.encode(&image_data),
        prompt,
        model: None,
        max_tokens: None,
        temperature: None,
    };
    
    analyze_image(State(state), Json(request)).await
}

async fn get_vision_result(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<VisionResponse>, AppError> {
    state
        .vision_cache
        .get(&id)
        .map(|entry| Json(entry.clone()))
        .ok_or_else(|| AppError::NotFound(format!("Vision result {} not found", id)))
}

async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "vision-service",
        "timestamp": Utc::now().timestamp(),
    }))
}

// Error handling
#[derive(Debug)]
enum AppError {
    Internal(anyhow::Error),
    BadRequest(String),
    NotFound(String),
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err)
    }
}

impl From<base64::DecodeError> for AppError {
    fn from(err: base64::DecodeError) -> Self {
        AppError::BadRequest(format!("Invalid base64: {}", err))
    }
}

impl From<image::ImageError> for AppError {
    fn from(err: image::ImageError) -> Self {
        AppError::BadRequest(format!("Invalid image: {}", err))
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::Internal(anyhow::anyhow!("HTTP error: {}", err))
    }
}

impl From<axum::extract::multipart::MultipartError> for AppError {
    fn from(err: axum::extract::multipart::MultipartError) -> Self {
        AppError::BadRequest(format!("Multipart error: {}", err))
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Internal(err) => {
                error!("Internal error: {}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
        };
        
        let body = Json(serde_json::json!({
            "error": message,
        }));
        
        (status, body).into_response()
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
    
    // Initialize model manager
    let mut model_manager = ModelManager {
        vision_models: HashMap::new(),
        ocr_models: HashMap::new(),
        generation_models: HashMap::new(),
    };
    
    // Register mock models (replace with real models in production)
    model_manager.vision_models.insert("default".to_string(), Box::new(MockVisionModel));
    model_manager.ocr_models.insert("default".to_string(), Box::new(MockOCRModel));
    model_manager.generation_models.insert("default".to_string(), Box::new(MockGenerationModel));
    
    // Create app state
    let state = AppState {
        vision_cache: Arc::new(DashMap::new()),
        ocr_cache: Arc::new(DashMap::new()),
        generation_cache: Arc::new(DashMap::new()),
        model_manager: Arc::new(RwLock::new(model_manager)),
    };
    
    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/vision/analyze", post(analyze_image))
        .route("/vision/upload", post(upload_and_analyze))
        .route("/vision/result/:id", get(get_vision_result))
        .route("/vision/ocr", post(extract_text))
        .route("/vision/generate", post(generate_image))
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
    let addr = SocketAddr::from(([0, 0, 0, 0], 3033));
    info!("Vision service listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}
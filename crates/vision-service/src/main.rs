use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use bytes::Bytes;
use chrono::Utc;
use dashmap::DashMap;
use image::{DynamicImage, ImageFormat, GenericImageView};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    io::Cursor,
    net::SocketAddr,
    sync::Arc,
};
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{error, info};
use uuid::Uuid;

// Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionRequest {
    pub image: String, // Base64 encoded image or URL
    pub prompt: Option<String>,
    pub task: Option<String>, // Support task-based requests
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
// Ollama Vision Model implementation
struct OllamaVisionModel;

impl VisionModel for OllamaVisionModel {
    fn analyze(&self, image: &DynamicImage, prompt: Option<&str>) -> anyhow::Result<VisionResponse> {
        let (width, height) = image.dimensions();
        
        // Convert image to base64
        let mut buffer = Vec::new();
        image.write_to(&mut std::io::Cursor::new(&mut buffer), image::ImageOutputFormat::Jpeg(80))?;
        let base64_image = base64::engine::general_purpose::STANDARD.encode(&buffer);
        
        // Prepare the prompt
        let analysis_prompt = prompt.unwrap_or("Describe this image in detail, including any objects, colors, text, or other visual elements you can see.");
        
        // Call Ollama API
        let client = reqwest::blocking::Client::new();
        let response = client
            .post("http://localhost:11434/api/generate")
            .json(&serde_json::json!({
                "model": "llava:7b",
                "prompt": format!("<image>\n{}", analysis_prompt),
                "images": [base64_image],
                "stream": false
            }))
            .send()?;
        
        if !response.status().is_success() {
            return Err(anyhow::anyhow!("Ollama API error: {}", response.status()));
        }
        
        let ollama_response: serde_json::Value = response.json()?;
        let description = ollama_response["response"]
            .as_str()
            .unwrap_or("Unable to analyze image")
            .to_string();
        
        // Generate basic objects based on description
        let objects = vec![
            DetectedObject {
                label: "image_content".to_string(),
                confidence: 0.95,
                bbox: Some(BoundingBox {
                    x: 0.0,
                    y: 0.0,
                    width: width as f32,
                    height: height as f32,
                }),
            },
        ];

        Ok(VisionResponse {
            id: Uuid::new_v4().to_string(),
            description,
            objects,
            metadata: VisionMetadata {
                width,
                height,
                format: "jpeg".to_string(),
                processing_time_ms: 0,
            },
            model: "llava:7b".to_string(),
        })
    }
}

struct MockVisionModel;
struct MockOCRModel;
struct MockGenerationModel;

impl VisionModel for MockVisionModel {
    fn analyze(&self, image: &DynamicImage, prompt: Option<&str>) -> anyhow::Result<VisionResponse> {
        let (width, height) = image.dimensions();

        // Enhanced image analysis with color detection
        let mut dominant_colors = Vec::new();
        let mut brightness = 0.0;
        let mut contrast = 0.0;
        
        // Sample pixels for color analysis (every 10th pixel for performance)
        let mut color_counts = std::collections::HashMap::new();
        let mut pixel_values = Vec::new();
        
        for y in (0..height).step_by(10) {
            for x in (0..width).step_by(10) {
                if let Some(pixel) = image.get_pixel_checked(x, y) {
                    let rgb = pixel.0;
                    let brightness_val = (rgb[0] as f32 + rgb[1] as f32 + rgb[2] as f32) / 3.0;
                    pixel_values.push(brightness_val);
                    
                    // Group similar colors
                    let color_key = ((rgb[0] / 32) * 32, (rgb[1] / 32) * 32, (rgb[2] / 32) * 32);
                    *color_counts.entry(color_key).or_insert(0) += 1;
                }
            }
        }
        
        // Calculate brightness and contrast
        if !pixel_values.is_empty() {
            brightness = pixel_values.iter().sum::<f32>() / pixel_values.len() as f32;
            let mean = brightness;
            let variance = pixel_values.iter()
                .map(|&x| (x - mean).powi(2))
                .sum::<f32>() / pixel_values.len() as f32;
            contrast = variance.sqrt();
        }
        
        // Find dominant colors
        let mut sorted_colors: Vec<_> = color_counts.into_iter().collect();
        sorted_colors.sort_by(|a, b| b.1.cmp(&a.1));
        
        for (color, count) in sorted_colors.iter().take(3) {
            let percentage = (*count as f32 / pixel_values.len() as f32) * 100.0;
            if percentage > 5.0 { // Only include colors that represent >5% of the image
                dominant_colors.push(format!("rgb({},{},{})", color.0, color.1, color.2));
            }
        }

        // Generate intelligent responses based on image characteristics and analysis
        let mut description = match (width, height) {
            (1, 1) => "A single pixel image, likely a placeholder or test image".to_string(),
            (w, h) if w < 10 && h < 10 => "A small thumbnail or icon image".to_string(),
            (w, h) if w > 1000 || h > 1000 => "A high-resolution image suitable for detailed analysis".to_string(),
            _ => "A standard image with moderate resolution".to_string(),
        };

        // Add color analysis to description
        if !dominant_colors.is_empty() {
            description.push_str(&format!(" The image has dominant colors: {}. ", dominant_colors.join(", ")));
        }
        
        // Add brightness analysis
        let brightness_desc = if brightness > 200.0 {
            "The image is very bright and well-lit."
        } else if brightness > 100.0 {
            "The image has moderate brightness."
        } else {
            "The image is relatively dark."
        };
        description.push_str(brightness_desc);

        // Add contrast analysis
        let contrast_desc = if contrast > 50.0 {
            " It has high contrast with distinct light and dark areas."
        } else if contrast > 20.0 {
            " It has moderate contrast."
        } else {
            " It has low contrast with similar tones throughout."
        };
        description.push_str(contrast_desc);

        // Generate task-specific responses with enhanced object detection
        let objects = if let Some(prompt_text) = prompt {
            match prompt_text.to_lowercase().as_str() {
                s if s.contains("describe") => vec![
                    DetectedObject {
                        label: "image_content".to_string(),
                        confidence: 0.95,
                        bbox: Some(BoundingBox {
                            x: 0.0,
                            y: 0.0,
                            width: width as f32,
                            height: height as f32,
                        }),
                    },
                ],
                s if s.contains("detect") || s.contains("object") => {
                    let mut detected_objects = vec![
                        DetectedObject {
                            label: "primary_object".to_string(),
                            confidence: 0.88,
                            bbox: Some(BoundingBox {
                                x: width as f32 * 0.1,
                                y: height as f32 * 0.1,
                                width: width as f32 * 0.8,
                                height: height as f32 * 0.8,
                            }),
                        },
                    ];
                    
                    // Add secondary objects based on image analysis
                    if brightness > 150.0 {
                        detected_objects.push(DetectedObject {
                            label: "bright_area".to_string(),
                            confidence: 0.75,
                            bbox: Some(BoundingBox {
                                x: width as f32 * 0.2,
                                y: height as f32 * 0.2,
                                width: width as f32 * 0.6,
                                height: height as f32 * 0.6,
                            }),
                        });
                    }
                    
                    detected_objects
                },
                s if s.contains("text") || s.contains("extract") => vec![
                    DetectedObject {
                        label: "text_region".to_string(),
                        confidence: 0.92,
                        bbox: Some(BoundingBox {
                            x: width as f32 * 0.2,
                            y: height as f32 * 0.2,
                            width: width as f32 * 0.6,
                            height: height as f32 * 0.6,
                        }),
                    },
                ],
                s if s.contains("color") || s.contains("analyze") => {
                    let mut color_objects = vec![
                        DetectedObject {
                            label: "color_region".to_string(),
                            confidence: 0.85,
                            bbox: Some(BoundingBox {
                                x: 0.0,
                                y: 0.0,
                                width: width as f32,
                                height: height as f32,
                            }),
                        },
                    ];
                    
                    // Add specific color regions if dominant colors are detected
                    for (i, _color) in dominant_colors.iter().enumerate() {
                        if i < 2 { // Limit to 2 additional color regions
                            color_objects.push(DetectedObject {
                                label: format!("color_region_{}", i + 1),
                                confidence: 0.70,
                                bbox: Some(BoundingBox {
                                    x: width as f32 * (0.1 + i as f32 * 0.3),
                                    y: height as f32 * 0.1,
                                    width: width as f32 * 0.25,
                                    height: height as f32 * 0.8,
                                }),
                            });
                        }
                    }
                    
                    color_objects
                },
                s if s.contains("face") || s.contains("person") => vec![
                    DetectedObject {
                        label: "face_region".to_string(),
                        confidence: 0.82,
                        bbox: Some(BoundingBox {
                            x: width as f32 * 0.25,
                            y: height as f32 * 0.15,
                            width: width as f32 * 0.5,
                            height: height as f32 * 0.6,
                        }),
                    },
                ],
                s if s.contains("landscape") || s.contains("nature") => vec![
                    DetectedObject {
                        label: "landscape_area".to_string(),
                        confidence: 0.87,
                        bbox: Some(BoundingBox {
                            x: 0.0,
                            y: height as f32 * 0.3,
                            width: width as f32,
                            height: height as f32 * 0.7,
                        }),
                    },
                ],
                _ => vec![
                    DetectedObject {
                        label: "general_content".to_string(),
                        confidence: 0.90,
                        bbox: Some(BoundingBox {
                            x: width as f32 * 0.05,
                            y: height as f32 * 0.05,
                            width: width as f32 * 0.9,
                            height: height as f32 * 0.9,
                        }),
                    },
                ],
            }
        } else {
            vec![
                DetectedObject {
                    label: "image_content".to_string(),
                    confidence: 0.95,
                    bbox: Some(BoundingBox {
                        x: 0.0,
                        y: 0.0,
                        width: width as f32,
                        height: height as f32,
                    }),
                },
            ]
        };

        Ok(VisionResponse {
            id: Uuid::new_v4().to_string(),
            description,
            objects,
            metadata: VisionMetadata {
                width,
                height,
                format: "jpeg".to_string(),
                processing_time_ms: 150, // Increased due to enhanced processing
            },
            model: "enhanced-mock-vision-v2".to_string(),
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

    // Analyze - use task if provided, otherwise use prompt
    let analysis_prompt = if let Some(task) = &request.task {
        Some(task.as_str())
    } else {
        request.prompt.as_deref()
    };

    let mut response = model.analyze(&img, analysis_prompt)?;
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
        task: None,
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

    // Register real models
    model_manager.vision_models.insert("default".to_string(), Box::new(OllamaVisionModel));
    model_manager.vision_models.insert("llava:7b".to_string(), Box::new(OllamaVisionModel));
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
    let addr = SocketAddr::from(([0, 0, 0, 0], 8084));
    info!("Vision service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

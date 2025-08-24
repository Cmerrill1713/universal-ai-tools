use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Core vision analysis response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub processing_time_ms: u64,
    pub model: String,
    pub cached: bool,
}

/// Vision processing options
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VisionOptions {
    pub confidence_threshold: Option<f32>,
    pub max_objects: Option<usize>,
    pub include_text: Option<bool>,
    pub include_scene: Option<bool>,
    pub timeout_ms: Option<u64>,
}

/// Object detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedObject {
    pub class: String,
    pub confidence: f32,
    pub bbox: BoundingBox,
}

/// Bounding box coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

/// Scene analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneAnalysis {
    pub description: String,
    pub tags: Vec<String>,
    pub mood: String,
    pub confidence: f32,
}

/// Detected text in image
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedText {
    pub text: String,
    pub confidence: f32,
    pub bbox: BoundingBox,
}

/// Complete vision analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionAnalysis {
    pub objects: Vec<DetectedObject>,
    pub scene: SceneAnalysis,
    pub text: Vec<DetectedText>,
    pub confidence: f32,
    pub processing_time_ms: u64,
}

/// Image embedding result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionEmbedding {
    pub vector: Vec<f32>,
    pub model: String,
    pub dimension: usize,
}

/// Image generation parameters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GenerationParameters {
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub steps: Option<u32>,
    pub guidance_scale: Option<f32>,
    pub seed: Option<u64>,
    pub style: Option<String>,
    pub negative_prompt: Option<String>,
}

/// Generated image result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedImage {
    pub id: String,
    pub base64: String,
    pub prompt: String,
    pub model: String,
    pub parameters: GenerationParameters,
    pub quality: ImageQuality,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Image quality metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageQuality {
    pub clip_score: f32,
    pub aesthetic_score: f32,
    pub safety_score: f32,
    pub prompt_alignment: f32,
}

/// Image refinement parameters
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RefinementParameters {
    pub strength: Option<f32>,
    pub steps: Option<u32>,
    pub guidance: Option<f32>,
    pub backend: Option<String>,
}

/// Refined image result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefinedImage {
    pub id: String,
    pub base64: String,
    pub original_prompt: String,
    pub model: String,
    pub parameters: RefinementParameters,
    pub improvement_score: f32,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Visual reasoning result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningResult {
    pub answer: String,
    pub confidence: f32,
    pub reasoning: String,
}

/// Service health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub status: String,
    pub python_bridge: bool,
    pub vision_processor: bool,
    pub cache_size: usize,
    pub uptime_seconds: u64,
}

/// Service statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionStats {
    pub total_requests: u64,
    pub success_rate: f64,
    pub cache_hit_rate: f64,
    pub avg_processing_time_ms: f64,
    pub models_loaded: Vec<String>,
    pub uptime_seconds: u64,
    pub rust_service_healthy: bool,
    pub python_bridge_healthy: bool,
}

/// Image generation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageGenerationRequest {
    pub prompt: String,
    pub parameters: GenerationParameters,
}

/// Batch analysis request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchAnalysisRequest {
    pub image_paths: Vec<String>,
    pub options: VisionOptions,
}
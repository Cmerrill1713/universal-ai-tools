use actix_web::{web, App, HttpServer, Result, HttpResponse, middleware::Logger};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use base64::{Engine as _, engine::general_purpose};
use image::{ImageBuffer, RgbImage, DynamicImage};
use anyhow::Context;

/// Vision processing request structure
#[derive(Deserialize, Debug)]
pub struct VisionRequest {
    pub image_data: String, // Base64 encoded image
    pub operation: String,
    pub parameters: serde_json::Value,
    pub request_id: Option<String>,
}

/// Vision processing response structure
#[derive(Serialize, Debug)]
pub struct VisionResponse {
    pub success: bool,
    pub result: serde_json::Value,
    pub processing_time_ms: u64,
    pub request_id: String,
    pub operation: String,
    pub error: Option<String>,
}

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: String,
    pub service: String,
    pub memory_usage_mb: u64,
    pub uptime_seconds: u64,
}

/// Vision processor service state
pub struct VisionProcessor {
    pub start_time: std::time::Instant,
    pub request_count: Arc<RwLock<u64>>,
}

impl VisionProcessor {
    pub fn new() -> Self {
        Self {
            start_time: std::time::Instant::now(),
            request_count: Arc::new(RwLock::new(0)),
        }
    }

    /// Process an image according to the requested operation
    pub async fn process_image(&self, request: VisionRequest) -> Result<VisionResponse, anyhow::Error> {
        let start_time = std::time::Instant::now();
        let request_id = request.request_id.unwrap_or_else(|| Uuid::new_v4().to_string());

        // Increment request counter
        {
            let mut count = self.request_count.write().await;
            *count += 1;
        }

        // Decode base64 image
        let image_bytes = general_purpose::STANDARD
            .decode(&request.image_data)
            .context("Failed to decode base64 image")?;

        let image = image::load_from_memory(&image_bytes)
            .context("Failed to load image from bytes")?;

        // Process based on operation type
        let result = match request.operation.as_str() {
            "resize" => self.resize_image(image, &request.parameters).await?,
            "enhance" => self.enhance_image(image, &request.parameters).await?,
            "analyze" => self.analyze_image(image, &request.parameters).await?,
            "detect_objects" => self.detect_objects(image, &request.parameters).await?,
            "generate_caption" => self.generate_caption(image, &request.parameters).await?,
            _ => return Err(anyhow::anyhow!("Unsupported operation: {}", request.operation)),
        };

        let processing_time = start_time.elapsed().as_millis() as u64;

        Ok(VisionResponse {
            success: true,
            result,
            processing_time_ms: processing_time,
            request_id,
            operation: request.operation,
            error: None,
        })
    }

    /// Resize image operation
    async fn resize_image(&self, image: DynamicImage, params: &serde_json::Value) -> Result<serde_json::Value, anyhow::Error> {
        let width = params.get("width").and_then(|v| v.as_u64()).unwrap_or(512) as u32;
        let height = params.get("height").and_then(|v| v.as_u64()).unwrap_or(512) as u32;

        let resized = image.resize_exact(width, height, image::imageops::FilterType::Lanczos3);

        // Convert back to base64
        let mut buffer = Vec::new();
        resized.write_to(&mut std::io::Cursor::new(&mut buffer), image::ImageOutputFormat::Png)
            .context("Failed to encode resized image")?;

        let encoded = general_purpose::STANDARD.encode(&buffer);

        Ok(serde_json::json!({
            "image_data": encoded,
            "width": width,
            "height": height,
            "format": "png"
        }))
    }

    /// Enhance image operation (placeholder for SDXL refiner integration)
    async fn enhance_image(&self, image: DynamicImage, params: &serde_json::Value) -> Result<serde_json::Value, anyhow::Error> {
        let strength = params.get("strength").and_then(|v| v.as_f64()).unwrap_or(0.3);
        let steps = params.get("steps").and_then(|v| v.as_u64()).unwrap_or(20);

        // MLX SDXL refiner integration planned for advanced image enhancement
        // Currently uses basic image processing - MLX integration pending
        let enhanced = image.brighten(10).adjust_contrast(1.1);

        let mut buffer = Vec::new();
        enhanced.write_to(&mut std::io::Cursor::new(&mut buffer), image::ImageOutputFormat::Png)
            .context("Failed to encode enhanced image")?;

        let encoded = general_purpose::STANDARD.encode(&buffer);

        Ok(serde_json::json!({
            "image_data": encoded,
            "enhancement_applied": true,
            "strength": strength,
            "steps": steps,
            "width": enhanced.width(),
            "height": enhanced.height()
        }))
    }

    /// Analyze image operation
    async fn analyze_image(&self, image: DynamicImage, _params: &serde_json::Value) -> Result<serde_json::Value, anyhow::Error> {
        let width = image.width();
        let height = image.height();
        let format = match image.color() {
            image::ColorType::Rgb8 => "RGB",
            image::ColorType::Rgba8 => "RGBA",
            image::ColorType::L8 => "Grayscale",
            _ => "Other",
        };

        // Basic image statistics
        let rgb_image = image.to_rgb8();
        let pixels: Vec<_> = rgb_image.pixels().collect();
        let pixel_count = pixels.len() as f64;

        let avg_brightness = pixels.iter()
            .map(|p| (p[0] as f64 + p[1] as f64 + p[2] as f64) / 3.0)
            .sum::<f64>() / pixel_count;

        Ok(serde_json::json!({
            "dimensions": {
                "width": width,
                "height": height
            },
            "format": format,
            "pixel_count": pixels.len(),
            "average_brightness": avg_brightness,
            "analysis_type": "basic_statistics"
        }))
    }

    /// Object detection operation (placeholder)
    async fn detect_objects(&self, _image: DynamicImage, _params: &serde_json::Value) -> Result<serde_json::Value, anyhow::Error> {
        // Object detection model integration planned for computer vision capabilities
        Ok(serde_json::json!({
            "objects": [],
            "detection_model": "placeholder",
            "confidence_threshold": 0.5,
            "message": "Object detection not yet implemented - requires model integration"
        }))
    }

    /// Caption generation operation (placeholder)
    async fn generate_caption(&self, _image: DynamicImage, _params: &serde_json::Value) -> Result<serde_json::Value, anyhow::Error> {
        // Vision-language model integration planned for image captioning capabilities
        Ok(serde_json::json!({
            "caption": "Image caption generation not yet implemented",
            "confidence": 0.0,
            "model": "placeholder",
            "message": "Caption generation requires vision-language model integration"
        }))
    }

    /// Get service health information
    pub async fn get_health(&self) -> HealthResponse {
        let uptime = self.start_time.elapsed().as_secs();
        let request_count = *self.request_count.read().await;

        // Get memory usage (approximate)
        let memory_usage = get_memory_usage_mb();

        HealthResponse {
            status: "healthy".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            service: "vision-processor".to_string(),
            memory_usage_mb: memory_usage,
            uptime_seconds: uptime,
        }
    }
}

/// Get approximate memory usage in MB
fn get_memory_usage_mb() -> u64 {
    // This is a simplified implementation
    // In production, you might want to use a more accurate method
    match std::fs::read_to_string("/proc/self/status") {
        Ok(content) => {
            for line in content.lines() {
                if line.starts_with("VmRSS:") {
                    if let Some(kb_str) = line.split_whitespace().nth(1) {
                        if let Ok(kb) = kb_str.parse::<u64>() {
                            return kb / 1024; // Convert KB to MB
                        }
                    }
                }
            }
        }
        Err(_) => {
            // Fallback for non-Linux systems
            return 0;
        }
    }
    0
}

/// HTTP handlers
pub mod handlers {
    use super::*;
    use actix_web::{web, HttpResponse};

    /// Health check endpoint
    pub async fn health_check(
        processor: web::Data<VisionProcessor>,
    ) -> Result<HttpResponse, actix_web::Error> {
        let health = processor.get_health().await;
        Ok(HttpResponse::Ok().json(health))
    }

    /// Process image endpoint
    pub async fn process_image(
        processor: web::Data<VisionProcessor>,
        request: web::Json<VisionRequest>,
    ) -> Result<HttpResponse, actix_web::Error> {
        match processor.process_image(request.into_inner()).await {
            Ok(response) => Ok(HttpResponse::Ok().json(response)),
            Err(e) => {
                let error_response = VisionResponse {
                    success: false,
                    result: serde_json::Value::Null,
                    processing_time_ms: 0,
                    request_id: Uuid::new_v4().to_string(),
                    operation: "unknown".to_string(),
                    error: Some(e.to_string()),
                };
                Ok(HttpResponse::InternalServerError().json(error_response))
            }
        }
    }

    /// Get service statistics
    pub async fn get_stats(
        processor: web::Data<VisionProcessor>,
    ) -> Result<HttpResponse, actix_web::Error> {
        let request_count = *processor.request_count.read().await;
        let uptime = processor.start_time.elapsed().as_secs();

        let stats = serde_json::json!({
            "service": "vision-processor",
            "uptime_seconds": uptime,
            "total_requests": request_count,
            "requests_per_second": if uptime > 0 { request_count as f64 / uptime as f64 } else { 0.0 },
            "memory_usage_mb": get_memory_usage_mb(),
            "timestamp": chrono::Utc::now().to_rfc3339()
        });

        Ok(HttpResponse::Ok().json(stats))
    }
}

/// Application configuration
pub fn create_app(processor: web::Data<VisionProcessor>) -> App<impl actix_web::dev::ServiceFactory<
    actix_web::dev::ServiceRequest,
    Config = (),
    Response = actix_web::dev::ServiceResponse,
    Error = actix_web::Error,
    InitError = (),
>> {
    use actix_cors::Cors;

    App::new()
        .app_data(processor)
        .wrap(Logger::default())
        .wrap(
            Cors::default()
                .allow_any_origin()
                .allow_any_method()
                .allow_any_header()
                .max_age(3600),
        )
        .route("/health", web::get().to(handlers::health_check))
        .route("/process", web::post().to(handlers::process_image))
        .route("/stats", web::get().to(handlers::get_stats))
}

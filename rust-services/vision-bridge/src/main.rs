use anyhow::{Context, Result};
use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;
use tracing::{error, info, instrument, warn};

mod cache;
mod config;
mod models;
mod python_bridge;
mod types;
mod vision;

use cache::VisionCache;
use config::VisionConfig;
use python_bridge::PythonBridge;
use types::*;
use vision::VisionProcessor;

/// Vision Bridge Service State
#[derive(Clone)]
pub struct AppState {
    pub vision_processor: VisionProcessor,
    pub python_bridge: PythonBridge,
    pub cache: VisionCache,
    pub metrics: Arc<VisionMetrics>,
    pub config: VisionConfig,
}

/// Service metrics
#[derive(Default)]
pub struct VisionMetrics {
    pub total_requests: AtomicU64,
    pub successful_requests: AtomicU64,
    pub failed_requests: AtomicU64,
    pub cache_hits: AtomicU64,
    pub avg_processing_time: RwLock<f64>,
    pub models_loaded: RwLock<Vec<String>>,
}

impl VisionMetrics {
    pub async fn record_request(&self, duration: Duration, success: bool, cache_hit: bool) {
        self.total_requests.fetch_add(1, Ordering::Relaxed);
        
        if success {
            self.successful_requests.fetch_add(1, Ordering::Relaxed);
        } else {
            self.failed_requests.fetch_add(1, Ordering::Relaxed);
        }

        if cache_hit {
            self.cache_hits.fetch_add(1, Ordering::Relaxed);
        }

        // Update exponential moving average
        let duration_ms = duration.as_millis() as f64;
        let mut avg = self.avg_processing_time.write().await;
        *avg = if *avg == 0.0 {
            duration_ms
        } else {
            0.9 * *avg + 0.1 * duration_ms
        };
    }

    pub async fn get_stats(&self) -> VisionStats {
        let total = self.total_requests.load(Ordering::Relaxed);
        let successful = self.successful_requests.load(Ordering::Relaxed);
        let cache_hits = self.cache_hits.load(Ordering::Relaxed);
        let avg_time = *self.avg_processing_time.read().await;
        let models = self.models_loaded.read().await.clone();

        VisionStats {
            total_requests: total,
            success_rate: if total > 0 { successful as f64 / total as f64 } else { 0.0 },
            cache_hit_rate: if total > 0 { cache_hits as f64 / total as f64 } else { 0.0 },
            avg_processing_time_ms: avg_time,
            models_loaded: models,
            uptime_seconds: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            rust_service_healthy: true,
            python_bridge_healthy: false, // Python bridge is disabled in this implementation
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "vision_bridge=info".into()),
        )
        .init();

    info!("🚀 Starting Vision Bridge Service");

    // Load configuration
    let config = VisionConfig::load()
        .context("Failed to load configuration")?;

    // Initialize components
    let cache = VisionCache::new(config.cache.max_size, config.cache.ttl_seconds).await;
    let python_bridge = PythonBridge::new(&config.python).await
        .context("Failed to initialize Python bridge")?;
    let vision_processor = VisionProcessor::new(&config.models).await
        .context("Failed to initialize vision processor")?;
    
    let metrics = Arc::new(VisionMetrics::default());

    let app_state = AppState {
        vision_processor,
        python_bridge,
        cache,
        metrics,
        config: config.clone(),
    };

    // Create router
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(get_metrics))
        .route("/vision/analyze", post(analyze_image))
        .route("/vision/embed", post(generate_embedding))
        .route("/vision/generate", post(generate_image))
        .route("/vision/refine", post(refine_image))
        .route("/vision/reason", post(reason_about_image))
        .route("/vision/batch/analyze", post(batch_analyze))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server.port));
    info!("🌟 Vision Bridge Service listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await
        .context("Failed to bind to address")?;
    
    axum::serve(listener, app).await
        .context("Server error")?;

    Ok(())
}

/// Health check endpoint
#[instrument(skip(state))]
async fn health_check(State(state): State<AppState>) -> Json<HealthStatus> {
    let python_ready = state.python_bridge.is_ready().await;
    let vision_ready = state.vision_processor.is_ready().await;
    
    Json(HealthStatus {
        status: if python_ready && vision_ready { "healthy".to_string() } else { "degraded".to_string() },
        python_bridge: python_ready,
        vision_processor: vision_ready,
        cache_size: state.cache.size().await,
        uptime_seconds: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    })
}

/// Get service metrics
#[instrument(skip(state))]
async fn get_metrics(State(state): State<AppState>) -> Json<VisionStats> {
    Json(state.metrics.get_stats().await)
}

/// Analyze image endpoint
#[instrument(skip(state, multipart))]
async fn analyze_image(
    State(state): State<AppState>,
    Query(options): Query<VisionOptions>,
    mut multipart: Multipart,
) -> Result<Json<VisionResponse<VisionAnalysis>>, (StatusCode, String)> {
    let start_time = Instant::now();
    
    // Extract image data
    let image_data = match extract_image_data(&mut multipart).await {
        Ok(data) => data,
        Err(e) => return Err((StatusCode::BAD_REQUEST, e.to_string())),
    };

    // Check cache
    let cache_key = format!("analyze:{}", blake3::hash(&image_data).to_hex());
    if let Some(cached) = state.cache.get(&cache_key).await {
        state.metrics.record_request(start_time.elapsed(), true, true).await;
        return Ok(Json(cached));
    }

    // Process image
    let result = match state.vision_processor.analyze_image(&image_data, &options).await {
        Ok(analysis) => VisionResponse {
            success: true,
            data: Some(analysis),
            error: None,
            processing_time_ms: start_time.elapsed().as_millis() as u64,
            model: "yolo-v8n".to_string(),
            cached: false,
        },
        Err(e) => {
            error!("Image analysis failed: {}", e);
            state.metrics.record_request(start_time.elapsed(), false, false).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    // Cache result
    state.cache.insert(cache_key, result.clone()).await;
    state.metrics.record_request(start_time.elapsed(), true, false).await;

    Ok(Json(result))
}

/// Generate embedding endpoint
#[instrument(skip(state, multipart))]
async fn generate_embedding(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<VisionResponse<VisionEmbedding>>, (StatusCode, String)> {
    let start_time = Instant::now();
    
    let image_data = match extract_image_data(&mut multipart).await {
        Ok(data) => data,
        Err(e) => return Err((StatusCode::BAD_REQUEST, e.to_string())),
    };

    let cache_key = format!("embed:{}", blake3::hash(&image_data).to_hex());
    if let Some(cached) = state.cache.get(&cache_key).await {
        state.metrics.record_request(start_time.elapsed(), true, true).await;
        return Ok(Json(cached));
    }

    let result = match state.vision_processor.generate_embedding(&image_data).await {
        Ok(embedding) => VisionResponse {
            success: true,
            data: Some(embedding),
            error: None,
            processing_time_ms: start_time.elapsed().as_millis() as u64,
            model: "clip-vit-b32".to_string(),
            cached: false,
        },
        Err(e) => {
            error!("Embedding generation failed: {}", e);
            state.metrics.record_request(start_time.elapsed(), false, false).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    state.cache.insert(cache_key, result.clone()).await;
    state.metrics.record_request(start_time.elapsed(), true, false).await;

    Ok(Json(result))
}

/// Generate image endpoint
#[instrument(skip(state))]
async fn generate_image(
    State(state): State<AppState>,
    Json(request): Json<ImageGenerationRequest>,
) -> Result<Json<VisionResponse<GeneratedImage>>, (StatusCode, String)> {
    let start_time = Instant::now();

    let result = match state.python_bridge.generate_image(&request.prompt, &request.parameters).await {
        Ok(image) => VisionResponse {
            success: true,
            data: Some(image),
            error: None,
            processing_time_ms: start_time.elapsed().as_millis() as u64,
            model: "sd3b".to_string(),
            cached: false,
        },
        Err(e) => {
            error!("Image generation failed: {}", e);
            state.metrics.record_request(start_time.elapsed(), false, false).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    state.metrics.record_request(start_time.elapsed(), true, false).await;
    Ok(Json(result))
}

/// Refine image endpoint
#[instrument(skip(state, multipart))]
async fn refine_image(
    State(state): State<AppState>,
    Query(params): Query<RefinementParameters>,
    mut multipart: Multipart,
) -> Result<Json<VisionResponse<RefinedImage>>, (StatusCode, String)> {
    let start_time = Instant::now();
    
    let image_data = match extract_image_data(&mut multipart).await {
        Ok(data) => data,
        Err(e) => return Err((StatusCode::BAD_REQUEST, e.to_string())),
    };

    let result = match state.python_bridge.refine_image(&image_data, &params).await {
        Ok(refined) => VisionResponse {
            success: true,
            data: Some(refined),
            error: None,
            processing_time_ms: start_time.elapsed().as_millis() as u64,
            model: "sdxl-refiner".to_string(),
            cached: false,
        },
        Err(e) => {
            error!("Image refinement failed: {}", e);
            state.metrics.record_request(start_time.elapsed(), false, false).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    state.metrics.record_request(start_time.elapsed(), true, false).await;
    Ok(Json(result))
}

/// Visual reasoning endpoint
#[instrument(skip(state, multipart))]
async fn reason_about_image(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
    mut multipart: Multipart,
) -> Result<Json<VisionResponse<ReasoningResult>>, (StatusCode, String)> {
    let start_time = Instant::now();
    
    let image_data = match extract_image_data(&mut multipart).await {
        Ok(data) => data,
        Err(e) => return Err((StatusCode::BAD_REQUEST, e.to_string())),
    };

    let question = params.get("question")
        .ok_or((StatusCode::BAD_REQUEST, "Missing 'question' parameter".to_string()))?;

    // First analyze the image
    let analysis = match state.vision_processor.analyze_image(&image_data, &VisionOptions::default()).await {
        Ok(analysis) => analysis,
        Err(e) => {
            error!("Image analysis for reasoning failed: {}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    // Then use Python bridge for reasoning with LLaVA or similar
    let result = match state.python_bridge.reason_about_image(&image_data, question, &analysis).await {
        Ok(reasoning) => VisionResponse {
            success: true,
            data: Some(reasoning),
            error: None,
            processing_time_ms: start_time.elapsed().as_millis() as u64,
            model: "llava-13b".to_string(),
            cached: false,
        },
        Err(e) => {
            error!("Image reasoning failed: {}", e);
            state.metrics.record_request(start_time.elapsed(), false, false).await;
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    state.metrics.record_request(start_time.elapsed(), true, false).await;
    Ok(Json(result))
}

/// Batch analyze endpoint
#[instrument(skip(state))]
async fn batch_analyze(
    State(state): State<AppState>,
    Json(request): Json<BatchAnalysisRequest>,
) -> Result<Json<Vec<VisionResponse<VisionAnalysis>>>, (StatusCode, String)> {
    let start_time = Instant::now();
    let batch_size = 3; // Process in smaller batches for better resource management

    let mut results = Vec::new();
    
    for chunk in request.image_paths.chunks(batch_size) {
        let mut batch_results = Vec::new();
        
        for image_path in chunk {
            // For simplicity, assume paths are base64 encoded images
            let image_data = match base64::decode(image_path) {
                Ok(data) => data,
                Err(e) => {
                    warn!("Failed to decode image path as base64: {}", e);
                    continue;
                }
            };

            match state.vision_processor.analyze_image(&image_data, &request.options).await {
                Ok(analysis) => {
                    batch_results.push(VisionResponse {
                        success: true,
                        data: Some(analysis),
                        error: None,
                        processing_time_ms: 0, // Will be set at the end
                        model: "yolo-v8n".to_string(),
                        cached: false,
                    });
                }
                Err(e) => {
                    error!("Batch analysis failed for image: {}", e);
                    batch_results.push(VisionResponse {
                        success: false,
                        data: None,
                        error: Some(e.to_string()),
                        processing_time_ms: 0,
                        model: "yolo-v8n".to_string(),
                        cached: false,
                    });
                }
            }
        }
        
        results.extend(batch_results);
    }

    // Update processing times
    let total_time = start_time.elapsed().as_millis() as u64;
    for result in &mut results {
        result.processing_time_ms = total_time;
    }

    state.metrics.record_request(start_time.elapsed(), true, false).await;
    Ok(Json(results))
}

/// Extract image data from multipart form
async fn extract_image_data(multipart: &mut Multipart) -> Result<Vec<u8>> {
    while let Some(field) = multipart.next_field().await? {
        if let Some(name) = field.name() {
            if name == "image" || name == "file" {
                let data = field.bytes().await?;
                return Ok(data.to_vec());
            }
        }
    }
    
    anyhow::bail!("No image data found in request")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        // Test health check endpoint
        // This would be expanded with proper test setup
    }

    #[tokio::test]
    async fn test_metrics() {
        let metrics = VisionMetrics::default();
        metrics.record_request(Duration::from_millis(100), true, false).await;
        
        let stats = metrics.get_stats().await;
        assert_eq!(stats.total_requests, 1);
        assert_eq!(stats.success_rate, 1.0);
    }
}
/// High-Performance Inference Implementations
/// Optimized for Apple Silicon with Metal acceleration

pub mod candle;
pub mod onnx;
pub mod burn;
pub mod smartcore;
pub mod linfa;

use crate::{InferenceRequest, OutputData, Result, MLError};
use crate::models::LoadedModel;

/// Trait for all inference engines
#[async_trait::async_trait]
pub trait InferenceEngine: Send + Sync {
    /// Run inference on the model
    async fn infer(&self, model: &LoadedModel, request: &InferenceRequest) -> Result<OutputData>;
    
    /// Get engine name
    fn name(&self) -> &'static str;
    
    /// Check if engine supports GPU acceleration
    fn supports_gpu(&self) -> bool;
    
    /// Get performance metrics
    fn get_metrics(&self) -> InferenceMetrics;
}

/// Performance metrics for inference engines
#[derive(Debug, Clone)]
pub struct InferenceMetrics {
    pub avg_latency_ms: f64,
    pub throughput_tokens_per_sec: f64,
    pub memory_usage_mb: f64,
    pub gpu_utilization: Option<f64>,
    pub total_inferences: u64,
}

impl Default for InferenceMetrics {
    fn default() -> Self {
        Self {
            avg_latency_ms: 0.0,
            throughput_tokens_per_sec: 0.0,
            memory_usage_mb: 0.0,
            gpu_utilization: None,
            total_inferences: 0,
        }
    }
}
//! GPU Acceleration Framework for Universal AI Tools
//! 
//! This crate provides high-performance GPU acceleration for AI computations
//! with automatic fallback to optimized CPU implementations.

use std::sync::Arc;
use tracing::{info, warn, error};
use anyhow::Result;

pub mod backend;
pub mod compute;
pub mod memory;
pub mod operations;
pub mod ffi;

pub use backend::{GPUBackend, BackendType};
pub use compute::ComputeContext;
pub use memory::{GPUBuffer, MemoryManager};
pub use operations::{MatrixOps, MLOperations, Statistics};

/// Main GPU acceleration framework
#[derive(Debug)]
pub struct GPUAccelerator {
    backend: Arc<dyn GPUBackend + Send + Sync>,
    compute_context: ComputeContext,
    memory_manager: MemoryManager,
}

impl GPUAccelerator {
    /// Initialize GPU accelerator with the best available backend
    pub fn new() -> Result<Self> {
        let backend = Self::select_best_backend()?;
        let compute_context = ComputeContext::new(backend.clone())?;
        let memory_manager = MemoryManager::new(backend.clone())?;

        info!("GPU Accelerator initialized with {} backend", backend.backend_type());

        Ok(Self {
            backend,
            compute_context,
            memory_manager,
        })
    }

    /// Select the best available GPU backend
    fn select_best_backend() -> Result<Arc<dyn GPUBackend + Send + Sync>> {
        // Try backends in order of preference: Metal (Apple), CUDA (NVIDIA), OpenCL, CPU
        
        #[cfg(feature = "metal")]
        if let Ok(backend) = backend::MetalBackend::new() {
            return Ok(Arc::new(backend));
        }

        #[cfg(feature = "cuda")]
        if let Ok(backend) = backend::CudaBackend::new() {
            return Ok(Arc::new(backend));
        }

        #[cfg(feature = "opencl")]
        if let Ok(backend) = backend::OpenCLBackend::new() {
            return Ok(Arc::new(backend));
        }

        // Always fall back to optimized CPU backend
        warn!("No GPU backend available, using optimized CPU implementation");
        Ok(Arc::new(backend::CPUBackend::new()?))
    }

    /// Get the active backend type
    pub fn backend_type(&self) -> BackendType {
        self.backend.backend_type()
    }

    /// Check if GPU acceleration is available
    pub fn is_gpu_accelerated(&self) -> bool {
        matches!(
            self.backend.backend_type(),
            BackendType::Metal | BackendType::CUDA | BackendType::OpenCL
        )
    }

    /// Get compute context for operations
    pub fn compute_context(&self) -> &ComputeContext {
        &self.compute_context
    }

    /// Get memory manager for buffer operations
    pub fn memory_manager(&self) -> &MemoryManager {
        &self.memory_manager
    }

    /// Perform matrix multiplication with GPU acceleration
    pub async fn matrix_multiply(
        &self,
        a: &[f32],
        b: &[f32],
        m: usize,
        n: usize,
        k: usize,
    ) -> Result<Vec<f32>> {
        let matrix_ops = operations::MatrixOps::new(self.backend.clone())?;
        matrix_ops.multiply(a, b, m, n, k).await
    }

    /// Perform neural network inference with GPU acceleration
    pub async fn neural_inference(
        &self,
        input: &[f32],
        weights: &[&[f32]],
        biases: &[&[f32]],
        activations: &[operations::ActivationType],
    ) -> Result<Vec<f32>> {
        let ml_ops = operations::MLOperations::new(self.backend.clone())?;
        ml_ops.forward_pass(input, weights, biases, activations).await
    }

    /// Perform statistical computations with GPU acceleration
    pub async fn compute_statistics(
        &self,
        data: &[f32],
        compute_moments: bool,
    ) -> Result<operations::StatisticsResult> {
        let stats_ops = operations::Statistics::new(self.backend.clone())?;
        stats_ops.compute_comprehensive(data, compute_moments).await
    }

    /// Perform attention mechanism computation
    pub async fn compute_attention(
        &self,
        query: &[f32],
        key: &[f32],
        value: &[f32],
        seq_len: usize,
        hidden_size: usize,
        num_heads: usize,
    ) -> Result<Vec<f32>> {
        let ml_ops = operations::MLOperations::new(self.backend.clone())?;
        ml_ops.multi_head_attention(query, key, value, seq_len, hidden_size, num_heads).await
    }

    /// Get performance metrics
    pub fn get_performance_metrics(&self) -> Result<PerformanceMetrics> {
        Ok(PerformanceMetrics {
            backend_type: self.backend.backend_type(),
            gpu_accelerated: self.is_gpu_accelerated(),
            memory_usage: self.memory_manager.get_usage_stats()?,
            compute_utilization: self.compute_context.get_utilization()?,
        })
    }

    /// Warm up GPU kernels for optimal performance
    pub async fn warmup(&self) -> Result<()> {
        info!("Warming up GPU acceleration kernels...");
        
        // Small warmup operations to compile kernels
        let warmup_data = vec![1.0f32; 1024];
        let _ = self.compute_statistics(&warmup_data, false).await?;
        
        let warmup_matrix = vec![1.0f32; 64];
        let _ = self.matrix_multiply(&warmup_matrix, &warmup_matrix, 8, 8, 8).await?;
        
        info!("GPU acceleration warmup completed");
        Ok(())
    }
}

/// Performance metrics for GPU acceleration
#[derive(Debug, Clone)]
pub struct PerformanceMetrics {
    pub backend_type: BackendType,
    pub gpu_accelerated: bool,
    pub memory_usage: memory::MemoryStats,
    pub compute_utilization: f64,
}

impl Default for GPUAccelerator {
    fn default() -> Self {
        Self::new().expect("Failed to initialize GPU accelerator")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_gpu_accelerator_initialization() {
        let accelerator = GPUAccelerator::new().unwrap();
        assert!(matches!(
            accelerator.backend_type(),
            BackendType::Metal | BackendType::CUDA | BackendType::OpenCL | BackendType::CPU
        ));
    }

    #[tokio::test]
    async fn test_matrix_multiplication() {
        let accelerator = GPUAccelerator::new().unwrap();
        let a = vec![1.0, 2.0, 3.0, 4.0];
        let b = vec![5.0, 6.0, 7.0, 8.0];
        let result = accelerator.matrix_multiply(&a, &b, 2, 2, 2).await.unwrap();
        assert_eq!(result.len(), 4);
    }

    #[tokio::test]
    async fn test_statistics_computation() {
        let accelerator = GPUAccelerator::new().unwrap();
        let data = (0..1000).map(|x| x as f32).collect::<Vec<_>>();
        let stats = accelerator.compute_statistics(&data, true).await.unwrap();
        assert!(stats.mean > 0.0);
        assert!(stats.std_dev > 0.0);
    }
}
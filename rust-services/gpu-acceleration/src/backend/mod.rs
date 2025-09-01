//! GPU Backend Abstraction Layer

use std::fmt::Debug;
use anyhow::Result;
use async_trait::async_trait;

pub mod cpu;
#[cfg(feature = "metal")]
pub mod metal;
#[cfg(feature = "cuda")]
pub mod cuda;
#[cfg(feature = "opencl")]
pub mod opencl;

pub use cpu::CPUBackend;
#[cfg(feature = "metal")]
pub use metal::MetalBackend;
#[cfg(feature = "cuda")]
pub use cuda::CudaBackend;
#[cfg(feature = "opencl")]
pub use opencl::OpenCLBackend;

/// GPU backend types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendType {
    CPU,
    Metal,
    CUDA,
    OpenCL,
}

impl std::fmt::Display for BackendType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BackendType::CPU => write!(f, "CPU"),
            BackendType::Metal => write!(f, "Metal"),
            BackendType::CUDA => write!(f, "CUDA"),
            BackendType::OpenCL => write!(f, "OpenCL"),
        }
    }
}

/// Device capabilities
#[derive(Debug, Clone)]
pub struct DeviceCapabilities {
    pub compute_units: u32,
    pub max_memory: u64,
    pub supports_fp16: bool,
    pub supports_fp64: bool,
    pub unified_memory: bool,
    pub max_workgroup_size: usize,
}

/// Memory layout for GPU operations
#[derive(Debug, Clone, Copy)]
pub enum MemoryLayout {
    RowMajor,
    ColumnMajor,
}

/// GPU backend trait for hardware abstraction
#[async_trait]
pub trait GPUBackend: Debug + Send + Sync {
    /// Get backend type
    fn backend_type(&self) -> BackendType;
    
    /// Get device capabilities
    fn capabilities(&self) -> &DeviceCapabilities;
    
    /// Allocate GPU memory
    async fn allocate_buffer(&self, size: usize) -> Result<Box<dyn GPUBuffer>>;
    
    /// Copy data to GPU
    async fn copy_to_device(&self, buffer: &mut dyn GPUBuffer, data: &[f32]) -> Result<()>;
    
    /// Copy data from GPU
    async fn copy_from_device(&self, buffer: &dyn GPUBuffer, data: &mut [f32]) -> Result<()>;
    
    /// Execute matrix multiplication kernel
    async fn matrix_multiply(
        &self,
        a: &dyn GPUBuffer,
        b: &dyn GPUBuffer,
        c: &mut dyn GPUBuffer,
        m: usize,
        n: usize,
        k: usize,
    ) -> Result<()>;
    
    /// Execute element-wise operations
    async fn elementwise_operation(
        &self,
        input: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        operation: ElementwiseOp,
        size: usize,
    ) -> Result<()>;
    
    /// Execute reduction operations
    async fn reduce_operation(
        &self,
        input: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        operation: ReductionOp,
        size: usize,
    ) -> Result<()>;
    
    /// Execute convolution operation
    async fn convolution(
        &self,
        input: &dyn GPUBuffer,
        kernel: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        params: ConvolutionParams,
    ) -> Result<()>;
    
    /// Synchronize device operations
    async fn synchronize(&self) -> Result<()>;
    
    /// Get memory usage statistics
    fn memory_usage(&self) -> Result<MemoryUsage>;
}

/// GPU buffer trait for device memory
pub trait GPUBuffer: Debug + Send + Sync {
    /// Get buffer size in bytes
    fn size(&self) -> usize;
    
    /// Get buffer pointer (implementation specific)
    fn ptr(&self) -> *mut u8;
    
    /// Check if buffer is valid
    fn is_valid(&self) -> bool;
}

/// Element-wise operations
#[derive(Debug, Clone, Copy)]
pub enum ElementwiseOp {
    Add,
    Subtract,
    Multiply,
    Divide,
    ReLU,
    Sigmoid,
    Tanh,
    Exp,
    Log,
    Sqrt,
    Square,
}

/// Reduction operations
#[derive(Debug, Clone, Copy)]
pub enum ReductionOp {
    Sum,
    Mean,
    Max,
    Min,
    Variance,
    StandardDeviation,
}

/// Convolution parameters
#[derive(Debug, Clone)]
pub struct ConvolutionParams {
    pub input_channels: usize,
    pub output_channels: usize,
    pub kernel_size: (usize, usize),
    pub stride: (usize, usize),
    pub padding: (usize, usize),
    pub dilation: (usize, usize),
}

/// Memory usage statistics
#[derive(Debug, Clone)]
pub struct MemoryUsage {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub peak_usage: u64,
    pub allocation_count: u64,
}

impl MemoryUsage {
    pub fn utilization(&self) -> f64 {
        if self.total_bytes == 0 {
            0.0
        } else {
            self.used_bytes as f64 / self.total_bytes as f64
        }
    }
}

/// Helper function to determine optimal workgroup size
pub fn optimal_workgroup_size(
    capabilities: &DeviceCapabilities,
    total_work: usize,
) -> usize {
    let max_workgroup = capabilities.max_workgroup_size;
    let compute_units = capabilities.compute_units as usize;
    
    // Try to balance between occupancy and efficiency
    let target_groups = compute_units * 4; // 4 workgroups per compute unit
    let items_per_group = (total_work + target_groups - 1) / target_groups;
    
    // Round up to next power of 2, capped at max workgroup size
    let mut size = 1;
    while size < items_per_group && size < max_workgroup {
        size *= 2;
    }
    
    size.min(max_workgroup)
}
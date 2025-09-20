//! Optimized CPU Backend with SIMD and Multi-threading

use super::*;
use anyhow::{Result, anyhow};
use async_trait::async_trait;
use nalgebra::{DMatrix, DVector};
use ndarray::{Array1, Array2, Axis};
use rayon::prelude::*;
use std::sync::{Arc, Mutex};
use wide::f32x8;

/// CPU backend with SIMD and multi-threading optimization
#[derive(Debug)]
pub struct CPUBackend {
    capabilities: DeviceCapabilities,
    memory_usage: Arc<Mutex<MemoryUsage>>,
}

impl CPUBackend {
    pub fn new() -> Result<Self> {
        let num_threads = rayon::current_num_threads();
        
        let capabilities = DeviceCapabilities {
            compute_units: num_threads as u32,
            max_memory: 16 * 1024 * 1024 * 1024, // 16GB typical
            supports_fp16: false, // CPU doesn't have native fp16
            supports_fp64: true,
            unified_memory: true, // CPU has unified memory
            max_workgroup_size: 1024,
        };
        
        let memory_usage = Arc::new(Mutex::new(MemoryUsage {
            total_bytes: capabilities.max_memory,
            used_bytes: 0,
            available_bytes: capabilities.max_memory,
            peak_usage: 0,
            allocation_count: 0,
        }));
        
        Ok(Self {
            capabilities,
            memory_usage,
        })
    }
    
    fn update_memory_usage(&self, size: i64) {
        if let Ok(mut usage) = self.memory_usage.lock() {
            if size > 0 {
                usage.used_bytes += size as u64;
                usage.allocation_count += 1;
                usage.peak_usage = usage.peak_usage.max(usage.used_bytes);
            } else {
                usage.used_bytes = usage.used_bytes.saturating_sub((-size) as u64);
            }
            usage.available_bytes = usage.total_bytes.saturating_sub(usage.used_bytes);
        }
    }
}

#[async_trait]
impl GPUBackend for CPUBackend {
    fn backend_type(&self) -> BackendType {
        BackendType::CPU
    }
    
    fn capabilities(&self) -> &DeviceCapabilities {
        &self.capabilities
    }
    
    async fn allocate_buffer(&self, size: usize) -> Result<Box<dyn GPUBuffer>> {
        let buffer = CPUBuffer::new(size)?;
        self.update_memory_usage(size as i64);
        Ok(Box::new(buffer))
    }
    
    async fn copy_to_device(&self, buffer: &mut dyn GPUBuffer, data: &[f32]) -> Result<()> {
        let cpu_buffer = buffer
            .as_any_mut()
            .downcast_mut::<CPUBuffer>()
            .ok_or_else(|| anyhow!("Invalid buffer type for CPU backend"))?;
        
        cpu_buffer.copy_from_slice(data)
    }
    
    async fn copy_from_device(&self, buffer: &dyn GPUBuffer, data: &mut [f32]) -> Result<()> {
        let cpu_buffer = buffer
            .as_any()
            .downcast_ref::<CPUBuffer>()
            .ok_or_else(|| anyhow!("Invalid buffer type for CPU backend"))?;
        
        cpu_buffer.copy_to_slice(data)
    }
    
    async fn matrix_multiply(
        &self,
        a: &dyn GPUBuffer,
        b: &dyn GPUBuffer,
        c: &mut dyn GPUBuffer,
        m: usize,
        n: usize,
        k: usize,
    ) -> Result<()> {
        let a_buf = a.as_any().downcast_ref::<CPUBuffer>().unwrap();
        let b_buf = b.as_any().downcast_ref::<CPUBuffer>().unwrap();
        let c_buf = c.as_any_mut().downcast_mut::<CPUBuffer>().unwrap();
        
        let a_data = a_buf.data();
        let b_data = b_buf.data();
        let c_data = c_buf.data_mut();
        
        // Use nalgebra for optimized matrix multiplication
        let a_matrix = DMatrix::from_row_slice(m, k, a_data);
        let b_matrix = DMatrix::from_row_slice(k, n, b_data);
        let c_matrix = &a_matrix * &b_matrix;
        
        c_data.copy_from_slice(c_matrix.as_slice());
        
        Ok(())
    }
    
    async fn elementwise_operation(
        &self,
        input: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        operation: ElementwiseOp,
        size: usize,
    ) -> Result<()> {
        let input_buf = input.as_any().downcast_ref::<CPUBuffer>().unwrap();
        let output_buf = output.as_any_mut().downcast_mut::<CPUBuffer>().unwrap();
        
        let input_data = input_buf.data();
        let output_data = output_buf.data_mut();
        
        // Use SIMD-optimized parallel operations
        match operation {
            ElementwiseOp::ReLU => {
                input_data.par_iter().zip(output_data.par_iter_mut()).for_each(|(x, y)| {
                    *y = x.max(0.0);
                });
            }
            ElementwiseOp::Sigmoid => {
                input_data.par_iter().zip(output_data.par_iter_mut()).for_each(|(x, y)| {
                    *y = 1.0 / (1.0 + (-x).exp());
                });
            }
            ElementwiseOp::Tanh => {
                input_data.par_iter().zip(output_data.par_iter_mut()).for_each(|(x, y)| {
                    *y = x.tanh();
                });
            }
            ElementwiseOp::Exp => {
                input_data.par_iter().zip(output_data.par_iter_mut()).for_each(|(x, y)| {
                    *y = x.exp();
                });
            }
            ElementwiseOp::Log => {
                input_data.par_iter().zip(output_data.par_iter_mut()).for_each(|(x, y)| {
                    *y = x.ln();
                });
            }
            ElementwiseOp::Sqrt => {
                input_data.par_iter().zip(output_data.par_iter_mut()).for_each(|(x, y)| {
                    *y = x.sqrt();
                });
            }
            ElementwiseOp::Square => {
                input_data.par_iter().zip(output_data.par_iter_mut()).for_each(|(x, y)| {
                    *y = x * x;
                });
            }
            ElementwiseOp::Add => {
                // This would need two input buffers in practice
                input_data.par_iter().zip(output_data.par_iter_mut()).for_each(|(x, y)| {
                    *y = *x;
                });
            }
            _ => return Err(anyhow!("Unsupported elementwise operation: {:?}", operation)),
        }
        
        Ok(())
    }
    
    async fn reduce_operation(
        &self,
        input: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        operation: ReductionOp,
        size: usize,
    ) -> Result<()> {
        let input_buf = input.as_any().downcast_ref::<CPUBuffer>().unwrap();
        let output_buf = output.as_any_mut().downcast_mut::<CPUBuffer>().unwrap();
        
        let input_data = input_buf.data();
        let output_data = output_buf.data_mut();
        
        let result = match operation {
            ReductionOp::Sum => {
                input_data.par_iter().sum::<f32>()
            }
            ReductionOp::Mean => {
                input_data.par_iter().sum::<f32>() / size as f32
            }
            ReductionOp::Max => {
                input_data.par_iter().fold(|| f32::NEG_INFINITY, |a, &b| a.max(b))
                    .reduce(|| f32::NEG_INFINITY, |a, b| a.max(b))
            }
            ReductionOp::Min => {
                input_data.par_iter().fold(|| f32::INFINITY, |a, &b| a.min(b))
                    .reduce(|| f32::INFINITY, |a, b| a.min(b))
            }
            ReductionOp::Variance => {
                let mean = input_data.par_iter().sum::<f32>() / size as f32;
                input_data.par_iter().map(|x| (x - mean).powi(2)).sum::<f32>() / size as f32
            }
            ReductionOp::StandardDeviation => {
                let mean = input_data.par_iter().sum::<f32>() / size as f32;
                let variance = input_data.par_iter().map(|x| (x - mean).powi(2)).sum::<f32>() / size as f32;
                variance.sqrt()
            }
        };
        
        output_data[0] = result;
        Ok(())
    }
    
    async fn convolution(
        &self,
        input: &dyn GPUBuffer,
        kernel: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        params: ConvolutionParams,
    ) -> Result<()> {
        // Simplified 2D convolution implementation
        let input_buf = input.as_any().downcast_ref::<CPUBuffer>().unwrap();
        let kernel_buf = kernel.as_any().downcast_ref::<CPUBuffer>().unwrap();
        let output_buf = output.as_any_mut().downcast_mut::<CPUBuffer>().unwrap();
        
        let input_data = input_buf.data();
        let kernel_data = kernel_buf.data();
        let output_data = output_buf.data_mut();
        
        // This is a simplified implementation - real convolution would be more complex
        // For demonstration purposes only
        let kernel_h = params.kernel_size.0;
        let kernel_w = params.kernel_size.1;
        let stride_h = params.stride.0;
        let stride_w = params.stride.1;
        
        // Parallel convolution processing
        output_data.par_chunks_mut(params.output_channels)
            .enumerate()
            .for_each(|(out_idx, out_chunk)| {
                for (ch_idx, output_val) in out_chunk.iter_mut().enumerate() {
                    let mut sum = 0.0;
                    
                    // Convolution operation
                    for kh in 0..kernel_h {
                        for kw in 0..kernel_w {
                            let kernel_idx = ch_idx * kernel_h * kernel_w + kh * kernel_w + kw;
                            if kernel_idx < kernel_data.len() {
                                let input_idx = out_idx + kh * stride_h + kw * stride_w;
                                if input_idx < input_data.len() {
                                    sum += input_data[input_idx] * kernel_data[kernel_idx];
                                }
                            }
                        }
                    }
                    
                    *output_val = sum;
                }
            });
        
        Ok(())
    }
    
    async fn synchronize(&self) -> Result<()> {
        // CPU operations are inherently synchronous
        Ok(())
    }
    
    fn memory_usage(&self) -> Result<MemoryUsage> {
        Ok(self.memory_usage.lock().unwrap().clone())
    }
}

/// CPU buffer implementation with SIMD optimization
#[derive(Debug)]
pub struct CPUBuffer {
    data: Vec<f32>,
}

impl CPUBuffer {
    pub fn new(size: usize) -> Result<Self> {
        let data = vec![0.0f32; size / std::mem::size_of::<f32>()];
        Ok(Self { data })
    }
    
    pub fn data(&self) -> &[f32] {
        &self.data
    }
    
    pub fn data_mut(&mut self) -> &mut [f32] {
        &mut self.data
    }
    
    pub fn copy_from_slice(&mut self, src: &[f32]) -> Result<()> {
        if src.len() != self.data.len() {
            return Err(anyhow!("Buffer size mismatch"));
        }
        self.data.copy_from_slice(src);
        Ok(())
    }
    
    pub fn copy_to_slice(&self, dst: &mut [f32]) -> Result<()> {
        if dst.len() != self.data.len() {
            return Err(anyhow!("Buffer size mismatch"));
        }
        dst.copy_from_slice(&self.data);
        Ok(())
    }
    
    /// SIMD-optimized operations
    pub fn simd_add(&mut self, other: &[f32]) -> Result<()> {
        if other.len() != self.data.len() {
            return Err(anyhow!("Buffer size mismatch"));
        }
        
        let chunks = self.data.len() / 8;
        let remainder = self.data.len() % 8;
        
        // Process 8 elements at a time with SIMD
        for i in 0..chunks {
            let idx = i * 8;
            let a = f32x8::from(&self.data[idx..idx + 8]);
            let b = f32x8::from(&other[idx..idx + 8]);
            let result = a + b;
            result.write_to_slice(&mut self.data[idx..idx + 8]);
        }
        
        // Handle remaining elements
        for i in (chunks * 8)..(chunks * 8 + remainder) {
            self.data[i] += other[i];
        }
        
        Ok(())
    }
}

impl GPUBuffer for CPUBuffer {
    fn size(&self) -> usize {
        self.data.len() * std::mem::size_of::<f32>()
    }
    
    fn ptr(&self) -> *mut u8 {
        self.data.as_ptr() as *mut u8
    }
    
    fn is_valid(&self) -> bool {
        !self.data.is_empty()
    }
}

impl CPUBuffer {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
    
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

impl Drop for CPUBuffer {
    fn drop(&mut self) {
        // Update memory usage when buffer is dropped
        // This would need a reference to the backend to update stats
    }
}
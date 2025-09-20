//! Metal GPU Backend for Apple Silicon and Intel Macs

use super::*;
use anyhow::{Result, anyhow};
use async_trait::async_trait;
use metal_rs::{Device, CommandQueue, Buffer, MTLResourceOptions, Library};
use std::sync::Arc;
use tracing::{info, warn, error};

/// Metal GPU backend implementation
#[derive(Debug)]
pub struct MetalBackend {
    device: Device,
    command_queue: CommandQueue,
    library: Library,
    capabilities: DeviceCapabilities,
}

impl MetalBackend {
    pub fn new() -> Result<Self> {
        // Get the default Metal device
        let device = Device::system_default()
            .ok_or_else(|| anyhow!("No Metal device available"))?;
        
        info!("Metal device: {}", device.name());
        
        // Create command queue
        let command_queue = device.new_command_queue();
        
        // Load Metal shaders library
        let library = device.new_library_with_source(METAL_SHADERS, &Default::default())
            .map_err(|e| anyhow!("Failed to create Metal library: {:?}", e))?;
        
        // Query device capabilities
        let capabilities = DeviceCapabilities {
            compute_units: device.max_threads_per_threadgroup().width as u32,
            max_memory: device.recommended_max_working_set_size(),
            supports_fp16: device.supports_feature_set(metal_rs::MTLFeatureSet::iOS_GPUFamily4_v1),
            supports_fp64: device.supports_feature_set(metal_rs::MTLFeatureSet::macOS_GPUFamily1_v1),
            unified_memory: true, // Apple Silicon has unified memory
            max_workgroup_size: device.max_threads_per_threadgroup().width,
        };
        
        Ok(Self {
            device,
            command_queue,
            library,
            capabilities,
        })
    }
}

#[async_trait]
impl GPUBackend for MetalBackend {
    fn backend_type(&self) -> BackendType {
        BackendType::Metal
    }
    
    fn capabilities(&self) -> &DeviceCapabilities {
        &self.capabilities
    }
    
    async fn allocate_buffer(&self, size: usize) -> Result<Box<dyn GPUBuffer>> {
        let buffer = self.device.new_buffer(
            size as u64,
            MTLResourceOptions::CPUCacheModeDefaultCache | MTLResourceOptions::StorageModeShared,
        );
        
        Ok(Box::new(MetalBuffer { buffer }))
    }
    
    async fn copy_to_device(&self, buffer: &mut dyn GPUBuffer, data: &[f32]) -> Result<()> {
        let metal_buffer = buffer
            .as_any_mut()
            .downcast_mut::<MetalBuffer>()
            .ok_or_else(|| anyhow!("Invalid buffer type for Metal backend"))?;
        
        let contents = metal_buffer.buffer.contents();
        unsafe {
            std::ptr::copy_nonoverlapping(
                data.as_ptr() as *const u8,
                contents,
                data.len() * std::mem::size_of::<f32>(),
            );
        }
        
        Ok(())
    }
    
    async fn copy_from_device(&self, buffer: &dyn GPUBuffer, data: &mut [f32]) -> Result<()> {
        let metal_buffer = buffer
            .as_any()
            .downcast_ref::<MetalBuffer>()
            .ok_or_else(|| anyhow!("Invalid buffer type for Metal backend"))?;
        
        let contents = metal_buffer.buffer.contents();
        unsafe {
            std::ptr::copy_nonoverlapping(
                contents,
                data.as_mut_ptr() as *mut u8,
                data.len() * std::mem::size_of::<f32>(),
            );
        }
        
        Ok(())
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
        let command_buffer = self.command_queue.new_command_buffer();
        let encoder = command_buffer.new_compute_command_encoder();
        
        // Get the matrix multiplication compute function
        let function = self.library.get_function("matrix_multiply_float", None)
            .map_err(|e| anyhow!("Failed to get matrix_multiply_float function: {:?}", e))?;
        
        let pipeline_state = self.device.new_compute_pipeline_state_with_function(&function)
            .map_err(|e| anyhow!("Failed to create pipeline state: {:?}", e))?;
        
        encoder.set_compute_pipeline_state(&pipeline_state);
        
        // Set buffers
        let metal_a = a.as_any().downcast_ref::<MetalBuffer>().unwrap();
        let metal_b = b.as_any().downcast_ref::<MetalBuffer>().unwrap();
        let metal_c = c.as_any_mut().downcast_mut::<MetalBuffer>().unwrap();
        
        encoder.set_buffer(0, Some(&metal_a.buffer), 0);
        encoder.set_buffer(1, Some(&metal_b.buffer), 0);
        encoder.set_buffer(2, Some(&metal_c.buffer), 0);
        
        // Set dimensions
        let dimensions = [m as u32, n as u32, k as u32, 0];
        encoder.set_bytes(3, std::mem::size_of_val(&dimensions), dimensions.as_ptr() as *const _);
        
        // Dispatch threads
        let threads_per_threadgroup = metal_rs::MTLSize::new(16, 16, 1);
        let threadgroups = metal_rs::MTLSize::new(
            (m + 15) / 16,
            (n + 15) / 16,
            1,
        );
        
        encoder.dispatch_threadgroups(threadgroups, threads_per_threadgroup);
        encoder.end_encoding();
        
        command_buffer.commit();
        command_buffer.wait_until_completed();
        
        Ok(())
    }
    
    async fn elementwise_operation(
        &self,
        input: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        operation: ElementwiseOp,
        size: usize,
    ) -> Result<()> {
        let function_name = match operation {
            ElementwiseOp::ReLU => "relu_float",
            ElementwiseOp::Sigmoid => "sigmoid_float",
            ElementwiseOp::Tanh => "tanh_float",
            ElementwiseOp::Exp => "exp_float",
            ElementwiseOp::Log => "log_float",
            ElementwiseOp::Sqrt => "sqrt_float",
            _ => return Err(anyhow!("Unsupported elementwise operation: {:?}", operation)),
        };
        
        let command_buffer = self.command_queue.new_command_buffer();
        let encoder = command_buffer.new_compute_command_encoder();
        
        let function = self.library.get_function(function_name, None)
            .map_err(|e| anyhow!("Failed to get {} function: {:?}", function_name, e))?;
        
        let pipeline_state = self.device.new_compute_pipeline_state_with_function(&function)
            .map_err(|e| anyhow!("Failed to create pipeline state: {:?}", e))?;
        
        encoder.set_compute_pipeline_state(&pipeline_state);
        
        // Set buffers
        let metal_input = input.as_any().downcast_ref::<MetalBuffer>().unwrap();
        let metal_output = output.as_any_mut().downcast_mut::<MetalBuffer>().unwrap();
        
        encoder.set_buffer(0, Some(&metal_input.buffer), 0);
        encoder.set_buffer(1, Some(&metal_output.buffer), 0);
        encoder.set_bytes(2, std::mem::size_of::<u32>(), &(size as u32) as *const _ as *const _);
        
        // Dispatch threads
        let threads_per_threadgroup = metal_rs::MTLSize::new(256, 1, 1);
        let threadgroups = metal_rs::MTLSize::new((size + 255) / 256, 1, 1);
        
        encoder.dispatch_threadgroups(threadgroups, threads_per_threadgroup);
        encoder.end_encoding();
        
        command_buffer.commit();
        command_buffer.wait_until_completed();
        
        Ok(())
    }
    
    async fn reduce_operation(
        &self,
        input: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        operation: ReductionOp,
        size: usize,
    ) -> Result<()> {
        let function_name = match operation {
            ReductionOp::Sum => "reduce_sum_float",
            ReductionOp::Mean => "reduce_mean_float",
            ReductionOp::Max => "reduce_max_float",
            ReductionOp::Min => "reduce_min_float",
            _ => return Err(anyhow!("Unsupported reduction operation: {:?}", operation)),
        };
        
        let command_buffer = self.command_queue.new_command_buffer();
        let encoder = command_buffer.new_compute_command_encoder();
        
        let function = self.library.get_function(function_name, None)
            .map_err(|e| anyhow!("Failed to get {} function: {:?}", function_name, e))?;
        
        let pipeline_state = self.device.new_compute_pipeline_state_with_function(&function)
            .map_err(|e| anyhow!("Failed to create pipeline state: {:?}", e))?;
        
        encoder.set_compute_pipeline_state(&pipeline_state);
        
        // Set buffers
        let metal_input = input.as_any().downcast_ref::<MetalBuffer>().unwrap();
        let metal_output = output.as_any_mut().downcast_mut::<MetalBuffer>().unwrap();
        
        encoder.set_buffer(0, Some(&metal_input.buffer), 0);
        encoder.set_buffer(1, Some(&metal_output.buffer), 0);
        encoder.set_bytes(2, std::mem::size_of::<u32>(), &(size as u32) as *const _ as *const _);
        
        // Use workgroup size for efficient reduction
        let threads_per_threadgroup = metal_rs::MTLSize::new(256, 1, 1);
        let threadgroups = metal_rs::MTLSize::new((size + 255) / 256, 1, 1);
        
        encoder.dispatch_threadgroups(threadgroups, threads_per_threadgroup);
        encoder.end_encoding();
        
        command_buffer.commit();
        command_buffer.wait_until_completed();
        
        Ok(())
    }
    
    async fn convolution(
        &self,
        input: &dyn GPUBuffer,
        kernel: &dyn GPUBuffer,
        output: &mut dyn GPUBuffer,
        params: ConvolutionParams,
    ) -> Result<()> {
        // Implementation for Metal convolution
        // This is a complex operation that would require specialized Metal kernels
        Err(anyhow!("Convolution not yet implemented for Metal backend"))
    }
    
    async fn synchronize(&self) -> Result<()> {
        // Metal operations are synchronous by default when using wait_until_completed
        Ok(())
    }
    
    fn memory_usage(&self) -> Result<MemoryUsage> {
        Ok(MemoryUsage {
            total_bytes: self.device.recommended_max_working_set_size(),
            used_bytes: self.device.current_allocated_size(),
            available_bytes: self.device.recommended_max_working_set_size() - self.device.current_allocated_size(),
            peak_usage: self.device.max_buffer_length(),
            allocation_count: 0, // Metal doesn't provide this directly
        })
    }
}

/// Metal buffer implementation
#[derive(Debug)]
pub struct MetalBuffer {
    buffer: Buffer,
}

impl GPUBuffer for MetalBuffer {
    fn size(&self) -> usize {
        self.buffer.length() as usize
    }
    
    fn ptr(&self) -> *mut u8 {
        self.buffer.contents()
    }
    
    fn is_valid(&self) -> bool {
        !self.buffer.contents().is_null()
    }
}

impl MetalBuffer {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
    
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

// Metal shader source code
const METAL_SHADERS: &str = r#"
#include <metal_stdlib>
using namespace metal;

// Matrix multiplication kernel
kernel void matrix_multiply_float(
    device const float* A [[ buffer(0) ]],
    device const float* B [[ buffer(1) ]],
    device float* C [[ buffer(2) ]],
    constant uint* dimensions [[ buffer(3) ]],
    uint2 gid [[ thread_position_in_grid ]]
) {
    uint M = dimensions[0];
    uint N = dimensions[1];
    uint K = dimensions[2];
    
    uint row = gid.y;
    uint col = gid.x;
    
    if (row >= M || col >= N) return;
    
    float sum = 0.0;
    for (uint k = 0; k < K; ++k) {
        sum += A[row * K + k] * B[k * N + col];
    }
    C[row * N + col] = sum;
}

// Elementwise operations
kernel void relu_float(
    device const float* input [[ buffer(0) ]],
    device float* output [[ buffer(1) ]],
    constant uint& size [[ buffer(2) ]],
    uint gid [[ thread_position_in_grid ]]
) {
    if (gid >= size) return;
    output[gid] = max(0.0f, input[gid]);
}

kernel void sigmoid_float(
    device const float* input [[ buffer(0) ]],
    device float* output [[ buffer(1) ]],
    constant uint& size [[ buffer(2) ]],
    uint gid [[ thread_position_in_grid ]]
) {
    if (gid >= size) return;
    output[gid] = 1.0f / (1.0f + exp(-input[gid]));
}

kernel void tanh_float(
    device const float* input [[ buffer(0) ]],
    device float* output [[ buffer(1) ]],
    constant uint& size [[ buffer(2) ]],
    uint gid [[ thread_position_in_grid ]]
) {
    if (gid >= size) return;
    output[gid] = tanh(input[gid]);
}

// Reduction operations
kernel void reduce_sum_float(
    device const float* input [[ buffer(0) ]],
    device float* output [[ buffer(1) ]],
    constant uint& size [[ buffer(2) ]],
    uint gid [[ thread_position_in_grid ]],
    uint tid [[ thread_position_in_threadgroup ]],
    threadgroup float* shared_data [[ threadgroup(0) ]]
) {
    uint group_size = 256;
    uint group_id = gid / group_size;
    
    // Load data into shared memory
    shared_data[tid] = (gid < size) ? input[gid] : 0.0f;
    threadgroup_barrier(mem_flags::mem_threadgroup);
    
    // Reduce within threadgroup
    for (uint stride = group_size / 2; stride > 0; stride /= 2) {
        if (tid < stride) {
            shared_data[tid] += shared_data[tid + stride];
        }
        threadgroup_barrier(mem_flags::mem_threadgroup);
    }
    
    // Write result
    if (tid == 0) {
        output[group_id] = shared_data[0];
    }
}

kernel void reduce_max_float(
    device const float* input [[ buffer(0) ]],
    device float* output [[ buffer(1) ]],
    constant uint& size [[ buffer(2) ]],
    uint gid [[ thread_position_in_grid ]],
    uint tid [[ thread_position_in_threadgroup ]],
    threadgroup float* shared_data [[ threadgroup(0) ]]
) {
    uint group_size = 256;
    uint group_id = gid / group_size;
    
    shared_data[tid] = (gid < size) ? input[gid] : -INFINITY;
    threadgroup_barrier(mem_flags::mem_threadgroup);
    
    for (uint stride = group_size / 2; stride > 0; stride /= 2) {
        if (tid < stride) {
            shared_data[tid] = max(shared_data[tid], shared_data[tid + stride]);
        }
        threadgroup_barrier(mem_flags::mem_threadgroup);
    }
    
    if (tid == 0) {
        output[group_id] = shared_data[0];
    }
}
"#;
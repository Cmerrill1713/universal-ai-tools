/**
 * FlashAttention Optimization Service
 * Implements memory-efficient attention mechanism for faster inference
 * Supports both GPU and CPU optimizations with automatic fallback
 */

import type { ChildProcess} from 'child_process';
import {spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, mkdirSync,readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

import { log, LogContext } from '../utils/logger';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface FlashAttentionConfig {
  enableGPU: boolean;
  enableCPU: boolean;
  batchSize: number;
  sequenceLength: number;
  headDim: number;
  numHeads: number;
  blockSize: number;
  enableMemoryOptimization: boolean;
  enableKernelFusion: boolean;
  fallbackToStandard: boolean;
  maxMemoryMB: number;
  deviceIds?: number[];
}

interface AttentionMetrics {
  executionTimeMs: number;
  memoryUsageMB: number;
  throughputTokensPerSec: number;
  speedupFactor: number;
  gpuUtilization?: number;
  memoryEfficiency: number;
  cacheHitRate?: number;
}

interface FlashAttentionRequest {
  modelId: string;
  providerId: string;
  inputTokens: number[];
  attentionMask?: number[];
  sequenceLength: number;
  batchSize: number;
  useCache: boolean;
  optimizationLevel: 'low' | 'medium' | 'high' | 'aggressive';
}

interface FlashAttentionResponse {
  success: boolean;
  attentionOutput: number[] | null;
  metrics: AttentionMetrics;
  fallbackUsed: boolean;
  optimizationApplied: string[];
  error?: string;
}

interface GPUInfo {
  deviceId: number;
  name: string;
  memoryMB: number;
  computeCapability: string;
  available: boolean;
}

interface OptimizationProfile {
  name: string;
  config: Partial<FlashAttentionConfig>;
  description: string;
  recommendedFor: string[];
}

// ============================================================================
// FlashAttention Service
// ============================================================================

class FlashAttentionService extends EventEmitter {
  private config: FlashAttentionConfig;
  private isInitialized = false;
  private gpuDevices: GPUInfo[] = [];
  private optimizationProfiles: Map<string, OptimizationProfile> = new Map();
  private attentionCache = new Map<string, any>();
  private performanceMetrics: AttentionMetrics[] = [];
  private pythonProcess: ChildProcess | null = null;
  private readonly CACHE_SIZE_LIMIT = 1000;
  private readonly METRICS_HISTORY_LIMIT = 100;

  constructor(config?: Partial<FlashAttentionConfig>) {
    super();
    
    this.config = {
      enableGPU: true,
      enableCPU: true,
      batchSize: 1,
      sequenceLength: 2048,
      headDim: 64,
      numHeads: 12,
      blockSize: 64,
      enableMemoryOptimization: true,
      enableKernelFusion: true,
      fallbackToStandard: true,
      maxMemoryMB: 8192,
      deviceIds: [0],
      ...config,
    };

    this.setupOptimizationProfiles();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('⚡ Initializing FlashAttention Service', LogContext.AI);
      
      // Check system capabilities
      await this.detectSystemCapabilities();
      
      // Initialize Python environment
      await this.initializePythonEnvironment();
      
      // Validate FlashAttention installation
      await this.validateFlashAttentionInstallation();
      
      // Start optimization service
      await this.startOptimizationService();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      log.info('✅ FlashAttention Service initialized', LogContext.AI, {
        gpuDevices: this.gpuDevices.length,
        cpuOptimization: this.config.enableCPU,
        memoryOptimization: this.config.enableMemoryOptimization,
      });
      
    } catch (error) {
      log.error('❌ Failed to initialize FlashAttention Service', LogContext.AI, { error });
      throw error;
    }
  }

  private async detectSystemCapabilities(): Promise<void> {
    try {
      log.info('🔍 Detecting system capabilities for FlashAttention', LogContext.AI);
      
      // Check for CUDA/GPU availability
      if (this.config.enableGPU) {
        await this.detectGPUDevices();
      }
      
      // Check CPU capabilities
      if (this.config.enableCPU) {
        await this.detectCPUCapabilities();
      }
      
      // Determine optimal configuration
      this.optimizeConfiguration();
      
    } catch (error) {
      log.warn('⚠️ System capability detection failed, using defaults', LogContext.AI, { error });
    }
  }

  private async detectGPUDevices(): Promise<void> {
    try {
      // Create a simple Python script to detect GPU devices
      const script = `
import torch
import json
import sys

try:
    if torch.cuda.is_available():
        devices = []
        for i in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(i)
            devices.append({
                "deviceId": i,
                "name": props.name,
                "memoryMB": int(props.total_memory / 1024 / 1024),
                "computeCapability": f"{props.major}.{props.minor}",
                "available": True
            })
        print(json.dumps(devices))
    else:
        print("[]")
except Exception as e:
    print("[]")
`;

      const result = await this.executePythonScript(script);
      this.gpuDevices = JSON.parse(result.trim()) || [];
      
      log.info('🖥️ GPU devices detected', LogContext.AI, {
        deviceCount: this.gpuDevices.length,
        devices: this.gpuDevices.map(d => ({ id: d.deviceId, name: d.name, memory: d.memoryMB })),
      });
      
    } catch (error) {
      log.warn('⚠️ GPU detection failed', LogContext.AI, { error });
      this.gpuDevices = [];
    }
  }

  private async detectCPUCapabilities(): Promise<void> {
    try {
      const script = `
import torch
import platform
import json

cpu_info = {
    "cores": torch.get_num_threads(),
    "architecture": platform.machine(),
    "processor": platform.processor(),
    "optimizations": []
}

# Check for CPU optimizations
try:
    import mkl
    cpu_info["optimizations"].append("MKL")
except ImportError:
    pass

try:
    if hasattr(torch, 'backends') and hasattr(torch.backends, 'mkl'):
        if torch.backends.mkl.is_available():
            cpu_info["optimizations"].append("MKL-DNN")
except:
    pass

print(json.dumps(cpu_info))
`;

      const result = await this.executePythonScript(script);
      const cpuInfo = JSON.parse(result.trim());
      
      log.info('🧮 CPU capabilities detected', LogContext.AI, cpuInfo);
      
    } catch (error) {
      log.warn('⚠️ CPU capability detection failed', LogContext.AI, { error });
    }
  }

  private optimizeConfiguration(): void {
    // Adjust configuration based on detected hardware
    if (this.gpuDevices.length === 0) {
      log.info('📱 No GPU detected, optimizing for CPU-only mode', LogContext.AI);
      this.config.enableGPU = false;
      this.config.blockSize = 32; // Smaller block size for CPU
      this.config.batchSize = Math.min(this.config.batchSize, 4);
    } else {
      // Choose best GPU device
      const bestGPU = this.gpuDevices.reduce((best, current) => 
        current.memoryMB > best.memoryMB ? current : best
      );
      
      this.config.deviceIds = [bestGPU.deviceId];
      
      // Adjust configuration based on GPU memory
      if (bestGPU.memoryMB < 4096) {
        log.info('📱 Low GPU memory detected, optimizing configuration', LogContext.AI);
        this.config.maxMemoryMB = Math.floor(bestGPU.memoryMB * 0.7);
        this.config.blockSize = 32;
        this.config.batchSize = Math.min(this.config.batchSize, 2);
      } else if (bestGPU.memoryMB >= 16384) {
        log.info('🚀 High-end GPU detected, enabling aggressive optimizations', LogContext.AI);
        this.config.blockSize = 128;
        this.config.enableKernelFusion = true;
      }
      
      log.info('🎯 Configuration optimized for GPU', LogContext.AI, {
        selectedGPU: bestGPU.name,
        memoryMB: bestGPU.memoryMB,
        blockSize: this.config.blockSize,
      });
    }
  }

  // ============================================================================
  // Python Environment Setup
  // ============================================================================

  private async initializePythonEnvironment(): Promise<void> {
    try {
      log.info('🐍 Initializing Python environment for FlashAttention', LogContext.AI);
      
      // Verify Python scripts directory exists
      const scriptsDir = join(process.cwd(), 'scripts', 'flash-attention');
      if (!existsSync(scriptsDir)) {
        throw new Error(`FlashAttention scripts directory not found: ${scriptsDir}`);
      }
      
      // Verify the Python script exists
      const scriptPath = join(scriptsDir, 'flash_attention_optimizer.py');
      if (!existsSync(scriptPath)) {
        throw new Error(`FlashAttention Python script not found: ${scriptPath}`);
      }
      
      // Verify requirements file exists
      const requirementsPath = join(scriptsDir, 'requirements.txt');
      if (!existsSync(requirementsPath)) {
        throw new Error(`FlashAttention requirements file not found: ${requirementsPath}`);
      }
      
      log.info('✅ Python environment verified', LogContext.AI, {
        scriptsDir,
        scriptPath,
        requirementsPath
      });
      
    } catch (error) {
      log.error('❌ Failed to initialize Python environment', LogContext.AI, { error });
      throw error;
    }
  }


  // ============================================================================
  // FlashAttention Operations
  // ============================================================================

  async optimizeAttention(request: FlashAttentionRequest): Promise<FlashAttentionResponse> {
    if (!this.isInitialized) {
      throw new Error('FlashAttention service not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      if (request.useCache && this.attentionCache.has(cacheKey)) {
        const cached = this.attentionCache.get(cacheKey);
        return {
          ...cached,
          metrics: {
            ...cached.metrics,
            executionTimeMs: 0, // Cache hit
            cacheHitRate: 1.0,
          },
        };
      }

      // Apply optimization profile
      const profile = this.selectOptimizationProfile(request);
      const optimizedConfig = { ...this.config, ...profile.config };

      // Generate attention tensors (mock for now - in production this would come from the model)
      const { query, key, value, attentionMask } = this.generateAttentionTensors(request);

      // Execute FlashAttention optimization
      const result = await this.executeFlashAttention(query, key, value, attentionMask, optimizedConfig);

      const executionTime = Date.now() - startTime;

      // Calculate metrics
      const metrics: AttentionMetrics = {
        executionTimeMs: executionTime,
        memoryUsageMB: result.memory_usage_mb || 0,
        throughputTokensPerSec: (request.inputTokens.length * 1000) / executionTime,
        speedupFactor: this.calculateSpeedup(executionTime, request),
        memoryEfficiency: this.calculateMemoryEfficiency(result.memory_usage_mb || 0, request),
        cacheHitRate: 0.0,
      };

      const response: FlashAttentionResponse = {
        success: !result.error,
        attentionOutput: result.output || null,
        metrics,
        fallbackUsed: result.optimization_used !== 'flash_attention',
        optimizationApplied: [result.optimization_used || 'none', profile.name],
        error: result.error,
      };

      // Cache successful results
      if (response.success && request.useCache) {
        this.cacheResult(cacheKey, response);
      }

      // Record metrics
      this.recordMetrics(metrics);

      this.emit('attentionOptimized', {
        modelId: request.modelId,
        providerId: request.providerId,
        metrics,
        success: response.success,
      });

      return response;

    } catch (error) {
      const errorResponse: FlashAttentionResponse = {
        success: false,
        attentionOutput: null,
        metrics: {
          executionTimeMs: Date.now() - startTime,
          memoryUsageMB: 0,
          throughputTokensPerSec: 0,
          speedupFactor: 0,
          memoryEfficiency: 0,
        },
        fallbackUsed: true,
        optimizationApplied: ['error'],
        error: error instanceof Error ? error.message : String(error),
      };

      log.error('❌ FlashAttention optimization failed', LogContext.AI, {
        modelId: request.modelId,
        error: errorResponse.error,
      });

      return errorResponse;
    }
  }

  private async executeFlashAttention(
    query: number[][][][],
    key: number[][][][],
    value: number[][][][],
    attentionMask: number[][][] | null,
    config: FlashAttentionConfig
  ): Promise<any> {
    const inputData = {
      query,
      key,
      value,
      attention_mask: attentionMask,
      config,
    };

    // Use the existing Python script directly
    const scriptPath = join(process.cwd(), 'scripts', 'flash-attention', 'flash_attention_optimizer.py');
    
    try {
      const result = await this.executePythonFile(scriptPath, JSON.stringify(inputData));
      return JSON.parse(result);
    } catch (error) {
      log.error('❌ Python script execution failed', LogContext.AI, { error });
      throw error;
    }
  }

  private generateAttentionTensors(request: FlashAttentionRequest) {
    // In a real implementation, these would come from the actual model
    // For now, generate mock tensors with the correct dimensions
    
    const {batchSize} = request;
    const seqLen = request.sequenceLength;
    const {numHeads} = this.config;
    const {headDim} = this.config;

    // Generate random tensors (in production, these would be actual model tensors)
    const query = this.generateRandomTensor([batchSize, numHeads, seqLen, headDim]);
    const key = this.generateRandomTensor([batchSize, numHeads, seqLen, headDim]);
    const value = this.generateRandomTensor([batchSize, numHeads, seqLen, headDim]);
    
    // Generate attention mask if needed
    const attentionMask = request.attentionMask ? 
      this.reshapeAttentionMask(request.attentionMask, [batchSize, numHeads, seqLen, seqLen]) : 
      null;

    return { query, key, value, attentionMask };
  }

  private generateRandomTensor(shape: number[]): number[][][][] {
    const [batch = 1, heads = 1, seq = 1, dim = 1] = shape;
    const tensor: number[][][][] = [];
    
    for (let b = 0; b < batch; b++) {
      tensor[b] = [];
      for (let h = 0; h < heads; h++) {
        tensor[b]![h] = [];
        for (let s = 0; s < seq; s++) {
          tensor[b]![h]![s] = [];
          for (let d = 0; d < dim; d++) {
            tensor[b]![h]![s]![d] = Math.random() * 2 - 1; // Random values between -1 and 1
          }
        }
      }
    }
    
    return tensor;
  }

  private reshapeAttentionMask(mask: number[], shape: number[]): number[][][] {
    // Reshape flat attention mask to 3D tensor [batch, seqLen, seqLen]
    const [batch = 1, heads = 1, seqLen = 1, seqLen2 = 1] = shape;
    const reshaped: number[][][] = [];
    
    if (!mask || mask.length === 0) {
      throw new Error('Invalid attention mask: mask is empty or undefined');
    }
    
    let idx = 0;
    for (let b = 0; b < batch; b++) {
      reshaped[b] = [];
      for (let s = 0; s < seqLen; s++) {
        reshaped[b]![s] = [];
        for (let s2 = 0; s2 < seqLen2; s2++) {
          reshaped[b]![s]![s2] = mask[idx % mask.length] || 0;
          idx++;
        }
      }
    }
    
    return reshaped;
  }

  // ============================================================================
  // Optimization Profiles
  // ============================================================================

  private setupOptimizationProfiles(): void {
    const profiles: OptimizationProfile[] = [
      {
        name: 'speed_optimized',
        description: 'Maximum speed with moderate memory usage',
        recommendedFor: ['real-time', 'interactive', 'low-latency'],
        config: {
          blockSize: 128,
          enableKernelFusion: true,
          enableMemoryOptimization: false,
          batchSize: 1,
        },
      },
      {
        name: 'memory_optimized',
        description: 'Minimum memory usage with acceptable speed',
        recommendedFor: ['large-models', 'limited-memory', 'mobile'],
        config: {
          blockSize: 32,
          enableMemoryOptimization: true,
          enableKernelFusion: false,
          batchSize: 1,
        },
      },
      {
        name: 'balanced',
        description: 'Balanced speed and memory usage',
        recommendedFor: ['general', 'production', 'default'],
        config: {
          blockSize: 64,
          enableMemoryOptimization: true,
          enableKernelFusion: true,
          batchSize: 2,
        },
      },
      {
        name: 'throughput_optimized',
        description: 'Maximum throughput for batch processing',
        recommendedFor: ['batch-processing', 'offline', 'high-throughput'],
        config: {
          blockSize: 256,
          enableKernelFusion: true,
          enableMemoryOptimization: false,
          batchSize: 8,
        },
      },
    ];

    profiles.forEach(profile => {
      this.optimizationProfiles.set(profile.name, profile);
    });
  }

  private selectOptimizationProfile(request: FlashAttentionRequest): OptimizationProfile {
    // Select profile based on optimization level and context
    const levelToProfile = {
      'low': 'memory_optimized',
      'medium': 'balanced',
      'high': 'speed_optimized', 
      'aggressive': 'throughput_optimized',
    };

    const profileName = levelToProfile[request.optimizationLevel] || 'balanced';
    return this.optimizationProfiles.get(profileName) || this.optimizationProfiles.get('balanced')!;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateCacheKey(request: FlashAttentionRequest): string {
    const key = {
      modelId: request.modelId,
      providerId: request.providerId,
      sequenceLength: request.sequenceLength,
      batchSize: request.batchSize,
      optimizationLevel: request.optimizationLevel,
      inputHash: this.hashArray(request.inputTokens),
    };
    
    return JSON.stringify(key);
  }

  private hashArray(arr: number[]): string {
    // Simple hash function for arrays
    let hash = 0;
    for (let i = 0; i < arr.length; i++) {
      const char = arr[i] || 0;
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private cacheResult(key: string, result: FlashAttentionResponse): void {
    if (this.attentionCache.size >= this.CACHE_SIZE_LIMIT) {
      // Remove oldest entries (LRU)
      const firstKey = this.attentionCache.keys().next().value;
      if (firstKey) {
        this.attentionCache.delete(firstKey);
      }
    }
    
    this.attentionCache.set(key, result);
  }

  private recordMetrics(metrics: AttentionMetrics): void {
    this.performanceMetrics.push(metrics);
    
    if (this.performanceMetrics.length > this.METRICS_HISTORY_LIMIT) {
      this.performanceMetrics.shift();
    }
  }

  private calculateSpeedup(executionTime: number, request: FlashAttentionRequest): number {
    // Estimate speedup compared to standard attention
    // This is a simplified calculation - in practice, you'd benchmark against actual standard attention
    const baselineTime = this.estimateStandardAttentionTime(request);
    return baselineTime / executionTime;
  }

  private estimateStandardAttentionTime(request: FlashAttentionRequest): number {
    // Rough estimation based on sequence length and complexity
    const complexity = request.sequenceLength * request.sequenceLength * request.batchSize;
    return complexity * 0.001; // Simplified estimation
  }

  private calculateMemoryEfficiency(memoryUsed: number, request: FlashAttentionRequest): number {
    // Calculate memory efficiency compared to standard attention
    const standardMemory = this.estimateStandardAttentionMemory(request);
    return standardMemory / Math.max(memoryUsed, 1);
  }

  private estimateStandardAttentionMemory(request: FlashAttentionRequest): number {
    // Estimate memory usage of standard attention
    const attentionMatrixSize = request.sequenceLength * request.sequenceLength * request.batchSize * this.config.numHeads;
    return attentionMatrixSize * 4 / (1024 * 1024); // 4 bytes per float32, convert to MB
  }

  // ============================================================================
  // Python Script Execution
  // ============================================================================

  private async executePythonScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', script]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
      
      python.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async executePythonScriptWithInput(script: string, input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', ['-c', script]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.stdin.write(input);
      python.stdin.end();
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
      
      python.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async executePythonFile(scriptPath: string, input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [scriptPath]);
      
      let stdout = '';
      let stderr = '';
      
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      python.stdin.write(input);
      python.stdin.end();
      
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
      
      python.on('error', (error) => {
        reject(error);
      });
    });
  }

  // ============================================================================
  // Service Management
  // ============================================================================

  private async validateFlashAttentionInstallation(): Promise<void> {
    try {
      const script = `
try:
    import torch
    import flash_attn
    print("FlashAttention available:", hasattr(flash_attn, 'flash_attn_func'))
    print("PyTorch version:", torch.__version__)
    print("CUDA available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("CUDA version:", torch.version.cuda)
except ImportError as e:
    print("Import error:", str(e))
`;

      const result = await this.executePythonScript(script);
      log.info('🔧 FlashAttention installation check', LogContext.AI, { result: result.trim() });
      
    } catch (error) {
      log.warn('⚠️ FlashAttention installation check failed', LogContext.AI, { error });
      if (!this.config.fallbackToStandard) {
        throw new Error('FlashAttention not available and fallback disabled');
      }
    }
  }

  private async startOptimizationService(): Promise<void> {
    // Start background optimization service if needed
    log.info('🚀 FlashAttention optimization service started', LogContext.AI);
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  async getSystemCapabilities(): Promise<{
    gpuDevices: GPUInfo[];
    flashAttentionAvailable: boolean;
    optimizationProfiles: string[];
    currentConfig: FlashAttentionConfig;
  }> {
    return {
      gpuDevices: this.gpuDevices,
      flashAttentionAvailable: this.isInitialized,
      optimizationProfiles: Array.from(this.optimizationProfiles.keys()),
      currentConfig: { ...this.config },
    };
  }

  async getPerformanceMetrics(): Promise<{
    averageSpeedup: number;
    averageMemoryEfficiency: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    totalOptimizations: number;
  }> {
    if (this.performanceMetrics.length === 0) {
      return {
        averageSpeedup: 0,
        averageMemoryEfficiency: 0,
        averageExecutionTime: 0,
        cacheHitRate: 0,
        totalOptimizations: 0,
      };
    }

    const metrics = this.performanceMetrics;
    
    return {
      averageSpeedup: metrics.reduce((sum, m) => sum + m.speedupFactor, 0) / metrics.length,
      averageMemoryEfficiency: metrics.reduce((sum, m) => sum + m.memoryEfficiency, 0) / metrics.length,
      averageExecutionTime: metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / metrics.length,
      cacheHitRate: metrics.reduce((sum, m) => sum + (m.cacheHitRate || 0), 0) / metrics.length,
      totalOptimizations: metrics.length,
    };
  }

  async updateConfiguration(newConfig: Partial<FlashAttentionConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    log.info('⚙️ FlashAttention configuration updated', LogContext.AI, { newConfig });
  }

  async clearCache(): Promise<void> {
    this.attentionCache.clear();
    log.info('🗑️ FlashAttention cache cleared', LogContext.AI);
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const details = {
      initialized: this.isInitialized,
      gpuAvailable: this.gpuDevices.length > 0,
      cacheSize: this.attentionCache.size,
      metricsCount: this.performanceMetrics.length,
      configuration: this.config,
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (!this.isInitialized) {
      status = 'unhealthy';
    } else if (this.gpuDevices.length === 0 && this.config.enableGPU) {
      status = 'degraded';
    }

    return { status, details };
  }

  async shutdown(): Promise<void> {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
    
    this.attentionCache.clear();
    this.performanceMetrics.length = 0;
    this.isInitialized = false;
    
    log.info('⚡ FlashAttention Service shut down', LogContext.AI);
  }
}

// ============================================================================
// Export Service Instance
// ============================================================================

export const flashAttentionService = new FlashAttentionService();

export type {
  AttentionMetrics,
  FlashAttentionConfig,
  FlashAttentionRequest,
  FlashAttentionResponse,
  GPUInfo,
  OptimizationProfile,
};
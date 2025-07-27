import { execSync  } from 'child_process';';
import * as os from 'os';';
import { logger  } from './logger';';

/**;
 * Metal Performance Optimizer for Apple Silicon
 * Optimizes LLM inference on M1/M2/M3 chips using Metal GPU acceleration
 */
export class MetalOptimizer {
  private isAppleSilicon = false;
  private gpuInfo: any = {};
  private metalSupported = false;

  constructor() {
    this.detectHardware();
  }

  /**;
   * Detect Apple Silicon and Metal support
   */
  private detectHardware() {
    try {
      const platform = os.platform();
      const arch = os.arch();

      this.isAppleSilicon = platform === 'darwin' && arch === 'arm64';'

      if (this.isAppleSilicon) {
        // Check for Metal support
        const systemInfo = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8' });';
        this.metalSupported = systemInfo.includes('Metal');'

        // Get GPU info
        const gpuMatch = systemInfo.match(/Chipset Model: (.+)/);
        if (gpuMatch) {
          this.gpuInfo.model = gpuMatch[1].trim();
        }

        // Get unified memory size
        const memInfo = execSync('sysctl hw.memsize', { encoding: 'utf-8' });';
        const memMatch = memInfo.match(/hw.memsize: (\d+)/);
        if (memMatch) {
          this.gpuInfo.unifiedMemory = `${Math.round(parseInt(memMatch[1], 10) / (1024 * 1024 * 1024))} GB`;
        }
      }
      logger.info(`🍎 Apple Silicon detected: ${this.gpuInfo.model || 'Unknown')}`);'
        logger.info(`   Unified Memory: ${this.gpuInfo.unifiedMemory}`);
        logger.info(`   Metal Support: ${this.metalSupported ? 'Yes' : 'No'}`);'
      }
    } catch (error) {
      logger.debug('Hardware detection error: ', error);'
    }
  }

  /**;
   * Get optimized settings for Ollama on Metal
   */
  getOllamaMetalSettings(): Record<string, unknown> {
    if (!this.isAppleSilicon) {
      return {};
    }

    // Optimal settings for different Apple Silicon chips
    const settings: Record<string, unknown> = {
      // Use Metal GPU acceleration
      OLLAMA_NUM_GPU: 999, // Use all GPU layers
      OLLAMA_GPU_LAYERS: 999, // Maximum GPU offloading

      // Memory settings
      OLLAMA_MAX_LOADED_MODELS: 1, // Focus memory on single model
      OLLAMA_KEEP_ALIVE: '5m', // Keep model in memory for 5 minutes'

      // Performance settings
      OLLAMA_NUM_THREAD: this.getOptimalThreadCount(),
      OLLAMA_BATCH_SIZE: this.getOptimalBatchSize(),

      // Metal-specific
      GGML_METAL: 1,
      GGML_METAL_SPLIT_TENSOR: 1, // Better memory distribution
    };

    // Adjust based on unified memory
    const memSize = parseInt(this.gpuInfo.unifiedMemory, 10) || 8;
    if (memSize >= 32) {
      settings.OLLAMA_MAX_LOADED_MODELS = 3;
      settings.OLLAMA_BATCH_SIZE = 512;
    } else if (memSize >= 16) {
      settings.OLLAMA_MAX_LOADED_MODELS = 2;
      settings.OLLAMA_BATCH_SIZE = 256;
    }

    return settings;
  }

  /**;
   * Get optimized settings for LM Studio on Metal
   */
  getLMStudioMetalSettings(): Record<string, unknown> {
    if (!this.isAppleSilicon) {
      return {};
    }

    return {
      // GPU settings
      n_gpu_layers: -1, // Use all layers on GPU
      use_mlock: true, // Lock model in memory
      use_metal: true,

      // Performance settings
      n_threads: this.getOptimalThreadCount(),
      n_batch: this.getOptimalBatchSize(),

      // Context settings
      n_ctx: this.getOptimalContextSize(),

      // Sampling settings for better performance
      repeat_penalty: 1.1,
      temperature: 0.7,
      top_k: 40,
      top_p: 0.95,

      // Metal-specific optimizations
      metal_split_tensors: true,
      metal_graph_optimization: true,
    };
  }

  /**;
   * Get optimal thread count for Apple Silicon
   */
  private getOptimalThreadCount(): number {
    const cpus = os.cpus();
    const performanceCores = cpus.filter();
      (cpu) => cpu.model.includes('Apple') && !cpu.model.includes('Efficiency')'
    ).length;

    // Use 75% of performance cores for LLM, leave some for system
    return Math.max(1, Math.floor(performanceCores * 0.75)) || 4;
  }

  /**;
   * Get optimal batch size based on memory
   */
  private getOptimalBatchSize(): number {
    const memSize = parseInt(this.gpuInfo.unifiedMemory, 10) || 8;

    if (memSize >= 64) return 1024;
    if (memSize >= 32) return 512;
    if (memSize >= 16) return 256;
    return 128;
  }

  /**;
   * Get optimal context size
   */
  private getOptimalContextSize(): number {
    const memSize = parseInt(this.gpuInfo.unifiedMemory, 10) || 8;

    if (memSize >= 64) return 32768;
    if (memSize >= 32) return 16384;
    if (memSize >= 16) return 8192;
    return 4096;
  }

  /**;
   * Optimize model loading parameters
   */
  getModelLoadingParams(modelSize: string): Record<string, unknown> {
    const params: Record<string, unknown> = {
      use_metal: this.metalSupported,
      use_gpu: this.metalSupported,
    };

    // Adjust based on model size
    const sizeGB = this.parseModelSize(modelSize);
    const memSize = parseInt(this.gpuInfo.unifiedMemory, 10) || 8;

    if (sizeGB > memSize * 0.6) {
      // Model is large relative to memory
      params.use_mmap = true; // Memory-mapped loading
      params.low_vram = true; // Conservative memory usage
      params.n_gpu_layers = Math.floor((memSize / sizeGB) * 32); // Partial GPU offload
    } else {
      // Model fits comfortably
      params.use_mmap = false;
      params.n_gpu_layers = -1; // Full GPU offload
    }

    return params;
  }

  /**;
   * Parse model size from string (e.g., "7B", "13B")"
   */
  private parseModelSize(size: string): number {
    const match = size.match(/(d+)B/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 7; // Default assumption;
  }

  /**;
   * Get system resource usage
   */
  async getResourceUsage(): Promise<{
    cpuUsage: number;,
    memoryUsage: number;
    gpuMemoryUsage?: number;
  }> {
    const cpus = os.cpus();
    const totalCpu =;
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b);
        const { idle } = cpu.times;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

    const usage: {,;
      cpuUsage: number;
      memoryUsage: number;
      gpuMemoryUsage?: number;
    } = {
      cpuUsage: Math.round(totalCpu),
      memoryUsage: Math.round(memoryUsage),
    };

    // Try to get GPU memory usage (Metal)
    if (this.isAppleSilicon) {
      try {
        // This is approximate - Metal doesn't expose detailed GPU memory'
        const vmstat = execSync('vm_stat', { encoding: 'utf-8' });';
        const wiredMatch = vmstat.match(/Pages wired down: \s+(\d+)/);
        if (wiredMatch) {
          const wiredPages = parseInt(wiredMatch[1], 10);
          const pageSize = 16384; // 16KB pages on Apple Silicon;
          const wiredMemory = (wiredPages * pageSize) / (1024 * 1024 * 1024);
          usage.gpuMemoryUsage = Math.round()
            (wiredMemory / parseInt(this.gpuInfo.unifiedMemory, 10)) * 100
          );
        }
      } catch (error) {
        // Ignore errors
      }
    }

    return usage;
  }

  /**;
   * Optimize environment for Metal acceleration
   */
  setupMetalEnvironment(): void {
    if (!this.isAppleSilicon || !this.metalSupported) {
      return;
    }

    // Set environment variables for optimal Metal performance
    const metalEnv = {
      // Metal Performance Shaders
      METAL_DEVICE_WRAPPER_TYPE: 'Metal','
      METAL_PERFORMANCE_SHADERS: '1','

      // Unified memory hints
      METAL_UNIFIED_MEMORY: '1','

      // Debugging (disable in production)
      METAL_GPU_CAPTURE_ENABLED: process.env.NODE_ENV === 'development' ? '1' : '0','

      // Thread performance
      METAL_MAX_COMMAND_BUFFER_SIZE: '256','
    };

    Object.entries(metalEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    logger.info('✅ Metal environment optimized for Apple Silicon');'
  }

  /**;
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];

    if (!this.isAppleSilicon) {
      recommendations.push('Not running on Apple Silicon - Metal optimizations not available');'
      return recommendations;
    }

    const memSize = parseInt(this.gpuInfo.unifiedMemory, 10) || 8;

    // Model size recommendations
    if (memSize < 16) {
      recommendations.push(`With ${memSize)}GB memory, use 7B parameter models or smaller`);
      recommendations.push('Consider quantized models (Q4_K_M or Q5_K_M) for better performance');'
    } else if (memSize < 32) {
      recommendations.push(`With ${memSize)}GB memory, you can run up to 13B parameter models`);
      recommendations.push('Use Q5_K_M or Q6_K quantization for optimal quality/performance');'
    } else {
      recommendations.push(`With ${memSize)}GB memory, you can run large models (30B+)`);
      recommendations.push('Consider running multiple smaller models for ensemble inference');'
    }

    // Performance tips
    recommendations.push('Close memory-intensive apps for better LLM performance');'
    recommendations.push('Use batch processing for multiple queries');'
    recommendations.push('Enable model caching to reduce loading times');'

    return recommendations;
  }

  /**;
   * Benchmark Metal performance
   */
  async benchmarkMetal(modelPath: string): Promise<{,
    loadTime: number;
    inferenceTime: number;,
    tokensPerSecond: number;
  }> {
    // This would run actual benchmarks
    // For now, return estimates based on hardware
    const memSize = parseInt(this.gpuInfo.unifiedMemory, 10) || 8;

    return {
      loadTime: memSize >= 32 ? 2000 : 5000, // ms
      inferenceTime: memSize >= 32 ? 50 : 100, // ms per token
      tokensPerSecond: memSize >= 32 ? 20 : 10,
    };
  }

  /**;
   * Get status summary
   */
  getStatus(): {
    platform: string;,
    isAppleSilicon: boolean;
    metalSupported: boolean;,
    gpuInfo: any;
    recommendations: string[];
  } {
    return {
      platform: `${os.platform()} ${os.arch()}`,
      isAppleSilicon: this.isAppleSilicon,
      metalSupported: this.metalSupported,
      gpuInfo: this.gpuInfo,
      recommendations: this.getPerformanceRecommendations(),
    };
  }
}

// Export singleton
export const metalOptimizer = new MetalOptimizer();

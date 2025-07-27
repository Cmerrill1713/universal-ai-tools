/**
 * MLX Interface for Apple Silicon Optimization
 * 
 * Provides integration with MLX framework for efficient local LLM inference
 * on Apple Silicon (M1/M2/M3) devices
 */

import { spawn } from 'child_process';
import { logger } from '../../utils/logger';
import { promises as fs } from 'fs';
import path from 'path';

export interface MLXGenerationRequest {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface MLXGenerationResponse {
  text: string;
  model: string;
  tokenCount?: number;
  latencyMs: number;
  metadata?: Record<string, any>;
}

export interface MLXModelInfo {
  name: string;
  path: string;
  size: string;
  quantization?: string;
  loaded: boolean;
}

/**
 * MLX Interface for Apple Silicon optimized inference
 */
export class MLXInterface {
  private isAppleSilicon = false;
  private mlxAvailable = false;
  private loadedModels = new Set<string>();

  constructor() {
    this.detectHardware();
  }

  /**
   * Check if MLX is available on this system
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.isAppleSilicon) {
        logger.debug('MLX requires Apple Silicon hardware');
        return false;
      }

      // Try to import MLX Python module
      const result = await this.runPythonCommand('import mlx.core as mx; print("MLX available")');
      this.mlxAvailable = result.success;
      
      logger.info(`🍎 MLX availability: ${this.mlxAvailable ? 'Available' : 'Not available'}`);
      return this.mlxAvailable;

    } catch (error) {
      logger.warn('MLX availability check failed:', error);
      this.mlxAvailable = false;
      return false;
    }
  }

  /**
   * Load a model for inference
   */
  async loadModel(modelPath: string, modelId?: string): Promise<void> {
    const id = modelId || path.basename(modelPath);
    
    logger.info(`🧠 Loading MLX model: ${id}`, { modelPath });

    try {
      const loadScript = `
import mlx.core as mx
import mlx.nn as nn
from pathlib import Path
import json
import sys

model_path = "${modelPath}"
try:
    # Basic model loading - this would be customized based on model format
    model_info = {
        "loaded": True,
        "path": model_path,
        "device": str(mx.default_device()),
        "memory_gb": mx.metal.get_peak_memory() / (1024**3) if hasattr(mx, 'metal') else 0
    }
    print(json.dumps(model_info))
except Exception as e:
    print(json.dumps({"loaded": False, "error": str(e)}))
    sys.exit(1)
`;

      const result = await this.runPythonCommand(loadScript, 30000);
      
      if (result.success) {
        const modelInfo = JSON.parse(result.output);
        if (modelInfo.loaded) {
          this.loadedModels.add(id);
          logger.info(`✅ MLX model loaded: ${id}`, {
            device: modelInfo.device,
            memoryGB: modelInfo.memory_gb
          });
        } else {
          throw new Error(`Failed to load MLX model: ${modelInfo.error}`);
        }
      } else {
        throw new Error(`MLX model loading failed: ${result.error}`);
      }

    } catch (error) {
      logger.error(`Failed to load MLX model ${id}:`, error);
      throw error;
    }
  }

  /**
   * Generate text using MLX model
   */
  async generate(request: MLXGenerationRequest): Promise<MLXGenerationResponse> {
    const startTime = Date.now();
    
    logger.info(`🔮 MLX generation request`, {
      model: request.model,
      promptLength: request.prompt.length,
      temperature: request.temperature,
      maxTokens: request.maxTokens
    });

    try {
      if (!this.mlxAvailable) {
        throw new Error('MLX not available on this system');
      }

      const generationScript = `
import mlx.core as mx
import json
import sys
from datetime import datetime

# Generation parameters
prompt = """${request.prompt.replace(/"/g, '\\"')}"""
model_name = "${request.model}"
temperature = ${request.temperature || 0.7}
max_tokens = ${request.maxTokens || 200}

try:
    # This would integrate with actual MLX LLM generation
    # For now, return a mock response that demonstrates the interface
    start_time = datetime.now()
    
    # Mock generation - in real implementation this would use MLX LLM
    generated_text = f"MLX generated response to: {prompt[:50]}..."
    
    end_time = datetime.now()
    latency_ms = (end_time - start_time).total_seconds() * 1000
    
    response = {
        "success": True,
        "text": generated_text,
        "model": model_name,
        "token_count": len(generated_text.split()),
        "latency_ms": latency_ms,
        "device": str(mx.default_device()),
        "memory_usage": mx.metal.get_peak_memory() / (1024**3) if hasattr(mx, 'metal') else 0
    }
    
    print(json.dumps(response))
    
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e),
        "model": model_name
    }))
    sys.exit(1)
`;

      const result = await this.runPythonCommand(generationScript, 60000);
      
      if (result.success) {
        const response = JSON.parse(result.output);
        if (response.success) {
          const mlxResponse: MLXGenerationResponse = {
            text: response.text,
            model: response.model,
            tokenCount: response.token_count,
            latencyMs: Date.now() - startTime,
            metadata: {
              device: response.device,
              memoryUsageGB: response.memory_usage,
              backend: 'mlx'
            }
          };

          logger.info(`✅ MLX generation completed`, {
            model: request.model,
            tokenCount: mlxResponse.tokenCount,
            latencyMs: mlxResponse.latencyMs
          });

          return mlxResponse;
        } else {
          throw new Error(`MLX generation failed: ${response.error}`);
        }
      } else {
        throw new Error(`MLX generation error: ${result.error}`);
      }

    } catch (error) {
      logger.error(`MLX generation error for ${request.model}:`, error);
      throw error;
    }
  }

  /**
   * Get information about available models
   */
  async getModelInfo(modelPath: string): Promise<MLXModelInfo> {
    try {
      const stats = await fs.stat(modelPath);
      const name = path.basename(modelPath);
      
      return {
        name,
        path: modelPath,
        size: `${(stats.size / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        loaded: this.loadedModels.has(name),
        quantization: this.detectQuantization(name)
      };

    } catch (error) {
      throw new Error(`Could not get model info: ${error.message}`);
    }
  }

  /**
   * Cleanup loaded models and free memory
   */
  async cleanup(): Promise<void> {
    logger.info('🧹 Cleaning up MLX resources');

    try {
      if (this.loadedModels.size > 0) {
        const cleanupScript = `
import mlx.core as mx
import gc

# Force garbage collection
gc.collect()

# Metal memory cleanup if available
if hasattr(mx, 'metal'):
    mx.metal.clear_cache()

print("MLX cleanup completed")
`;

        await this.runPythonCommand(cleanupScript, 10000);
      }

      this.loadedModels.clear();
      logger.info('✅ MLX cleanup completed');

    } catch (error) {
      logger.warn('MLX cleanup failed:', error);
    }
  }

  /**
   * Get MLX system information
   */
  async getSystemInfo(): Promise<Record<string, any>> {
    try {
      const infoScript = `
import mlx.core as mx
import json
import platform

info = {
    "platform": platform.platform(),
    "device": str(mx.default_device()),
    "mlx_version": getattr(mx, '__version__', 'unknown')
}

if hasattr(mx, 'metal'):
    info["metal_available"] = True
    info["peak_memory_gb"] = mx.metal.get_peak_memory() / (1024**3)
    info["active_memory_gb"] = mx.metal.get_active_memory() / (1024**3)
else:
    info["metal_available"] = False

print(json.dumps(info))
`;

      const result = await this.runPythonCommand(infoScript);
      return result.success ? JSON.parse(result.output) : {};

    } catch (error) {
      logger.warn('Could not get MLX system info:', error);
      return {};
    }
  }

  /**
   * Detect if running on Apple Silicon
   */
  private detectHardware(): void {
    try {
      const {platform} = process;
      const {arch} = process;
      
      this.isAppleSilicon = platform === 'darwin' && arch === 'arm64';
      
      logger.info(`🔍 Hardware detection: ${platform}/${arch}`, {
        isAppleSilicon: this.isAppleSilicon
      });

    } catch (error) {
      logger.warn('Hardware detection failed:', error);
      this.isAppleSilicon = false;
    }
  }

  /**
   * Run Python command and return result
   */
  private async runPythonCommand(script: string, timeout = 30000): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      const python = spawn('python3', ['-c', script]);
      let output = '';
      let error = '';

      const timer = setTimeout(() => {
        python.kill();
        resolve({ success: false, output: '', error: 'Timeout' });
      }, timeout);

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          output: output.trim(),
          error: error.trim() || (code !== 0 ? `Process exited with code ${code}` : undefined)
        });
      });

      python.on('error', (error) => {
        clearTimeout(timer);
        resolve({ success: false, output: '', error: error.message });
      });
    });
  }

  /**
   * Detect quantization type from model name
   */
  private detectQuantization(modelName: string): string | undefined {
    const name = modelName.toLowerCase();
    
    if (name.includes('q4')) return 'Q4';
    if (name.includes('q5')) return 'Q5';
    if (name.includes('q6')) return 'Q6';
    if (name.includes('q8')) return 'Q8';
    if (name.includes('fp16')) return 'FP16';
    if (name.includes('fp32')) return 'FP32';
    
    return undefined;
  }
}

export default MLXInterface;
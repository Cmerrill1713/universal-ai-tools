/**
 * MLX (Apple Silicon Machine: Learning Interface
 * Provides real MLX model loading and inference capabilities
 */

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../../utils/enhanced-logger';

export interface MLXModelConfig {
  modelPath: string;
  dtype?: 'float16' | 'float32' | 'bfloat16';
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  seed?: number;
}

export interface MLXInferenceParams {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export interface MLXGenerationResult {
  text: string;
  confidence: number;
  tokensGenerated: number;
  inferenceTime: number;
  metadata?: any;
}

export class MLXInterface {
  private pythonPath: string;
  private loadedModels: Map<string, MLXModelConfig> = new Map();
  private isMLXAvailable: boolean | null = null;

  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
  }

  /**
   * Check if MLX is available
   */
  async checkMLXAvailability(): Promise<boolean> {
    if (this.isMLXAvailable !== null) {
      return this.isMLXAvailable;
    }

    try {
      const checkScript = `;
import sys
try:
    import mlx
    import mlx.core as mx
    import mlx.nn as nn
    from mlx_lm import load, generate
    print("MLX_AVAILABLE")
except ImportError as e:
    print(f"MLX_NOT_AVAILABLE: {e}")
    sys.exit(1)
`;

      const result = await this.runPythonScript(checkScript, 5000); // 5 second timeout
      this.isMLXAvailable = result.includes('MLX_AVAILABLE');

      if (this.isMLXAvailable) {
        logger.info('✅ MLX is available and ready');
      } else {
        logger.warn('⚠️ MLX is not available on this system');
      }

      return this.isMLXAvailable;
    } catch (error) {
      logger.warn('MLX availability check failed:', error);
      this.isMLXAvailable = false;
      return false;
    }
  }

  /**
   * Load an MLX model
   */
  async loadModel(modelId: string, config: MLXModelConfig)): Promise<void> {
    const isAvailable = await this.checkMLXAvailability();
    if (!isAvailable) {
      throw new Error('MLX is not available on this system');
    }

    try {
      await fs.access(config.modelPath);
      logger.info(`Loading MLX model: ${modelId} from ${config.modelPath}`);

      const loadScript = `;
import sys
import json
from mlx_lm import load
import mlx.core as mx

try:
    # Load the model and tokenizer
    model, tokenizer = load("${config.modelPath}")
    
    # Test the model
    test_tokens = tokenizer.encode("test", add_special_tokens=True)
    
    model_info = {
        "loaded": True,
        "model_id": "${modelId}",
        "model_path": "${config.modelPath}",
        "dtype": "${config.dtype || 'float16'}",
        "vocab_size": len(tokenizer.get_vocab()) if hasattr(tokenizer, 'get_vocab') else 32000
    }
    
    print(json.dumps(model_info))
    
except Exception as e:
    print(json.dumps({"loaded": False, "error: str(e)}))
    sys.exit(1)
`;

      const result = await this.runPythonScript(loadScript, 30000); // 30 second timeout for loading
      const modelInfo = JSON.parse(result);

      if (modelInfo.loaded) {
        this.loadedModels.set(modelId, config;
        logger.info(`MLX model ${modelId} loaded successfully`);
        logger.info(`  Vocabulary size: ${modelInfo.vocab_size}`);
        logger.info(`  Data type: ${modelInfo.dtype}`);
      } else {
        throw new Error(`Failed to load MLX model: ${modelInfo._error`);
      }
    } catch (error) {
      logger.error(Failed to load MLX model ${modelId}:`, error);`
      throw error;
    }
  }

  /**
   * Quick inference for simple tasks
   */
  async quickInference(params: MLXInferenceParams: Promise<{ text: string; confidence: number, }> {
    const models = Array.from(this.loadedModels.keys());
    if (models.length === 0) {
      throw new Error('No MLX models loaded');
    }

    // Use the first available model for quick inference
    const modelId = models[0];
    const result = await this.generate(modelId, params;

    return {
      text: result.text,
      confidence: result.confidence,
    };
  }

  /**
   * Generate text using MLX model
   */
  async generate(modelId: string, params: MLXInferenceParams: Promise<MLXGenerationResult> {
    const config = this.loadedModels.get(modelId);
    if (!config) {
      throw new Error(`MLX model ${modelId} not loaded`);
    }

    const startTime = Date.now();

    try {
      const generateScript = `;
import sys
import json
import time
from mlx_lm import load, generate
import mlx.core as mx

# Generation parameters
params = ${JSON.stringify(params)}
model_path = "${config.modelPath}"

try:
    # Load model and tokenizer
    model, tokenizer = load(model_path)
    
    # Set generation parameters
    max_tokens = params.get("maxTokens", ${params.maxTokens || 100})
    temperature = params.get("temperature", ${params.temperature || 0.8})
    top_p = params.get("topP", ${params.topP || 0.9})
    
    # Generate text
    start_time = time.time()
    
    response = generate(
        model=model,
        tokenizer=tokenizer,
        prompt=params["prompt"],
        max_tokens=max_tokens,
        temp=temperature,
        top_p=top_p,
        verbose=False
    )
    
    # Calculate metrics
    inference_time = (time.time() - start_time) * 1000  # Convert to ms
    generated_text = response if isinstance(response, str else str(response)
    
    # Estimate confidence based on response quality
    confidence = min(0.95, max(0.5, len(generated_text.strip()) / max_tokens))
    
    result = {
        "success": True,
        "text": generated_text,
        "confidence": confidence,
        "tokens_generated": len(tokenizer.encode(generated_text)),
        "inference_time": inference_time,
        "model_id": "${modelId}"
    }
    
    print(json.dumps(result))
    
except Exception as e:
    print(json.dumps({
        "success": False,
        "error: str(e),
        "model_id": "${modelId}"
    }))
    sys.exit(1)
`;

      const result = await this.runPythonScript(generateScript, 60000); // 60 second timeout
      const response = JSON.parse(result);

      if (response.success) {
        const inferenceTime = Date.now() - startTime;

        logger.info(`MLX generation completed in ${response.inference_time}ms`);

        return {
          text: response.text,
          confidence: response.confidence,
          tokensGenerated: response.tokens_generated,
          inferenceTime: response.inference_time,
          metadata: {
            modelId,
            modelPath: config.modelPath,
            totalTime: inferenceTime,
          },
        };
      } else {
        throw new Error(`MLX generation failed: ${response.error`);
      }
    } catch (error) {
      logger.error(MLX generation error for ${modelId}:`, error);`
      throw error;
    }
  }

  /**
   * Run a Python script and return output;
   */
  private async runPythonScript(script: string, timeout = 30000): Promise<string> {
    return new Promise((resolve, reject => {
      const python = spawn(this.pythonPath, ['-c', script]);

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        python.kill();
        reject(new Error('Python script timeout'));
      }, timeout);

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        clearTimeout(timer);

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Python script failed (code ${code}): ${stderr || stdout}`));`
        }
      });

      python.on('_error, (error => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Unload a model to free memory
   */
  async unloadModel(modelId: string)): Promise<void> {
    if (this.loadedModels.has(modelId)) {
      // Run garbage collection in Python to free MLX memory
      const cleanupScript = `;
import gc
import mlx.core as mx
gc.collect()
mx.metal.clear_cache()
print("MLX memory cleared")
`;

      try {
        await this.runPythonScript(cleanupScript, 10000);
      } catch (error) {
        logger.warn('MLX memory cleanup failed:', error);
      }

      this.loadedModels.delete(modelId);
      logger.info(`MLX model ${modelId} unloaded`);
    }
  }

  /**
   * Get loaded models
   */
  getLoadedModels(): string[] {
    return Array.from(this.loadedModels.keys());
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelId: string: MLXModelConfig | undefined {
    return this.loadedModels.get(modelId);
  }
}

// Singleton instance
export const mlxInterface = new MLXInterface();

// Export types
export type { MLXInterface };

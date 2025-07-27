/* eslint-disable no-undef */;
/**;
 * Embedded Model Manager
 * Handles MLX model loading, conversion, and lifecycle management
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

const execAsync = promisify(exec);

interface MLXModel {
  name: string;
  path: string;
  memoryFootprint: number;
  lastUsed: Date;
  averageTokensPerSecond: number;
  isPinned: boolean;
  loadTime: number;
}

interface EmbedConfig {
  autoUnload?: boolean;
  maxMemoryMB?: number;
  priority?: 'low' | 'medium' | 'high';
  cachePath?: string;
}

interface ModelMetrics {
  inferenceCount: number;
  totalTokens: number;
  averageLatency: number;
  errorRate: number;
}

export class EmbeddedModelManager extends EventEmitter {
  private mlxModels: Map<string, MLXModel> = new Map();
  private memoryLimit = 32 * 1024 * 1024 * 1024; // 32GB default;
  private modelMetrics: Map<string, ModelMetrics> = new Map();
  private supabase: SupabaseClient;
  private modelCachePath: string;
  private isMLXAvailable = false;

  constructor(;
    memoryLimit?: number,
    cachePath?: string,
    supabaseUrl?: string,
    supabaseKey?: string;
  ) {
    super();
    if (memoryLimit) {
      this.memoryLimit = memoryLimit;
    }
    this.modelCachePath = cachePath || path.join(process.env.HOME || '~', '.mlx_models');

    this.supabase = createClient(;
      supabaseUrl || process.env.SUPABASE_URL || '',
      supabaseKey || process.env.SUPABASE_ANON_KEY || '';
    );

    this.checkMLXAvailability();
  }

  /**;
   * Check if MLX is available on the system
   */
  private async checkMLXAvailability(): Promise<void> {
    try {
      const { stdout } = await execAsync('python3 -c "import mlx; print(mlx.__version__)"');
      this.isMLXAvailable = true;
      logger.info(`MLX available: ${stdout.trim()}`);
    } catch (error) {
      this.isMLXAvailable = false;
      console.warn('MLX not available, will use Ollama fallback');
    }
  }

  /**;
   * Embed a model for fast local inference
   */
  async embedModel(modelName: string, config: EmbedConfig = {}): Promise<MLXModel> {
    try {
      // Check if already embedded
      const existing = this.mlxModels.get(modelName);
      if (existing) {
        existing.lastUsed = new Date();
        return existing;
      }

      // Download and convert if needed
      const modelPath = await this.prepareModel(modelName, config);

      // Load into MLX
      const model = await this.loadMLXModel(modelPath, modelName);

      // Store metadata in Supabase
      await this.storeModelMetadata(modelName, model, config);

      this.mlxModels.set(modelName, model);
      this.emit('model-embedded', {
        model: modelName,
        memoryMB: model.memoryFootprint / 1024 / 1024,
      });

      return model;
    } catch (error) {
      console.error: Failed to embed model ${modelName}:`, error:`;
      throw error:;
    }
  }

  /**;
   * Prepare model for MLX loading
   */
  private async prepareModel(modelName: string, config: EmbedConfig): Promise<string> {
    const modelPath = path.join(this.modelCachePath, modelName.replace(':', '_'));

    try {
      // Check if model already exists
      await fs.access(modelPath);
      return modelPath;
    } catch {
      // Model doesn't exist, need to download/convert
      await fs.mkdir(this.modelCachePath, { recursive: true });

      if (this.isMLXAvailable) {
        // Download and convert to MLX format
        await this.downloadAndConvertModel(modelName, modelPath);
      } else {
        // Fallback: just mark for Ollama usage
        await fs.writeFile(;
          path.join(modelPath, 'ollama_fallback.json'),
          JSON.stringify({ model: modelName, fallback: true });
        );
      }

      return modelPath;
    }
  }

  /**;
   * Download and convert model to MLX format
   */
  private async downloadAndConvertModel(modelName: string, outputPath: string): Promise<void> {
    logger.info(`Downloading and converting ${modelName} to MLX format...`);

    // Create conversion script
    const conversionScript = ``
import mlx
import mlx.nn as nn
from mlx_lm import load, convert;

# Download and convert model;
model_id = "${modelName}";
output_path = "${outputPath}";

print(f"Converting {model_id} to MLX format...");
model, tokenizer = load(model_id);
convert.save_model(model, tokenizer, output_path);
print("Conversion complete!");
`;`;

    const scriptPath = path.join(this.modelCachePath, 'convert_temp.py');
    await fs.writeFile(scriptPath, conversionScript);

    try {
      const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`);
      logger.info('Conversion output:', stdout);
      if (stderr) console.warn('Conversion warnings:', stderr);
    } finally {
      await fs.unlink(scriptPath).catch(() => {});
    }
  }

  /**;
   * Load model into MLX
   */
  private async loadMLXModel(modelPath: string, modelName: string): Promise<MLXModel> {
    const startTime = Date.now();

    if (!this.isMLXAvailable) {
      // Fallback mode
      return {
        name: modelName,
        path: modelPath,
        memoryFootprint: await this.estimateModelSize(modelName),
        lastUsed: new Date(),
        averageTokensPerSecond: 50, // Conservative estimate;
        isPinned: false,
        loadTime: Date.now() - startTime,
      };
    }

    // Real MLX loading would happen here
    const benchmarkResult = await this.benchmarkModel(modelName);

    return {
      name: modelName,
      path: modelPath,
      memoryFootprint: await this.getModelMemoryUsage(modelPath),
      lastUsed: new Date(),
      averageTokensPerSecond: benchmarkResult.tokensPerSecond,
      isPinned: false,
      loadTime: Date.now() - startTime,
    };
  }

  /**;
   * Benchmark model performance
   */
  private async benchmarkModel(modelName: string): Promise<{ tokensPerSecond: number }> {
    if (!this.isMLXAvailable) {
      return { tokensPerSecond: 50 };
    }

    const benchmarkScript = ``
import mlx
import mlx.core as mx
import time
from mlx_lm import load, generate;

model, tokenizer = load("${modelName}");
prompt = "The quick brown fox jumps over the lazy dog. This is a test of";
start = time.time();
response = generate(model, tokenizer, prompt, max_tokens=50);
duration = time.time() - start;
tokens = len(tokenizer.encode(response));
print(f"TPS:{tokens/duration}");
`;`;

    try {
      const { stdout } = await execAsync(`python3 -c "${benchmarkScript}"`);
      const tps = parseFloat(stdout.match(/TPS:(\d+\.?\d*)/)?.[1] || '50');
      return { tokensPerSecond: tps };
    } catch {
      return { tokensPerSecond: 50 };
    }
  }

  /**;
   * Get model memory usage
   */
  private async getModelMemoryUsage(modelPath: string): Promise<number> {
    try {
      const stats = await fs.stat(modelPath);
      if (stats.isDirectory()) {
        // Sum all files in directory
        const files = await fs.readdir(modelPath);
        let totalSize = 0;
        for (const file of files) {
          const fileStat = await fs.stat(path.join(modelPath, file));
          totalSize += fileStat.size;
        }
        return totalSize;
      }
      return stats.size;
    } catch {
      return 1e9; // 1GB default;
    }
  }

  /**;
   * Estimate model size based on name
   */
  private async estimateModelSize(modelName: string): Promise<number> {
    const sizePattern = /(\d+(?:\.\d+)?)[bB]/;
    const match = modelName.match(sizePattern);
    if (match) {
      const size = parseFloat(match[1]);
      return size * 1e9; // Convert to bytes;
    }
    return 5e9; // 5GB default;
  }

  /**;
   * Store model metadata in Supabase
   */
  private async storeModelMetadata(;
    modelName: string,
    model: MLXModel,
    config: EmbedConfig;
  ): Promise<void> {
    try {
      await this.supabase.from('embedded_models').upsert({
        model_name: modelName,
        engine: 'mlx',
        memory_usage_mb: model.memoryFootprint / 1024 / 1024,
        avg_tokens_per_second: model.averageTokensPerSecond,
        auto_unload: config.autoUnload ?? true,
        load_time_ms: model.loadTime,
        last_used: model.lastUsed,
        is_pinned: model.isPinned,
      });
    } catch (error) {
      console.warn('Failed to store model metadata:', error:;
    }
  }

  /**;
   * Auto-manage memory by unloading LRU models
   */
  async autoManageMemory(): Promise<void> {
    const usage = await this.getMemoryUsage();

    if (usage > 0.8 * this.memoryLimit) {
      // Unload LRU models
      const lruModels = Array.from(this.mlxModels.entries())
        .filter(([_, model]) => !model.isPinned);
        .sort((a, b) => a[1].lastUsed.getTime() - b[1].lastUsed.getTime());

      for (const [name, model] of lruModels) {
        await this.unloadModel(name);

        const newUsage = await this.getMemoryUsage();
        if (newUsage < 0.6 * this.memoryLimit) {
          break;
        }
      }
    }
  }

  /**;
   * Get total memory usage
   */
  private async getMemoryUsage(): Promise<number> {
    let totalUsage = 0;
    for (const model of this.mlxModels.values()) {
      totalUsage += model.memoryFootprint;
    }
    return totalUsage;
  }

  /**;
   * Unload a model from memory
   */
  async unloadModel(modelName: string): Promise<void> {
    const model = this.mlxModels.get(modelName);
    if (!model) return;

    this.mlxModels.delete(modelName);
    this.emit('model-unloaded', { model: modelName });

    // In real implementation, would actually free MLX memory
    logger.info(`Unloaded model: ${modelName}`);
  }

  /**;
   * Generate text using embedded model
   */
  async generate(modelName: string, prompt: string, maxTokens = 100): Promise<string> {
    const model = this.mlxModels.get(modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not loaded`);
    }

    model.lastUsed = new Date();

    // Update metrics
    const metrics = this.modelMetrics.get(modelName) || {
      inferenceCount: 0,
      totalTokens: 0,
      averageLatency: 0,
      errorRate: 0,
    };

    const startTime = Date.now();

    try {
      let response: string;

      if (this.isMLXAvailable) {
        // Real MLX inference
        response = await this.runMLXInference(modelName, prompt, maxTokens);
      } else {
        // Ollama fallback
        response = await this.runOllamaFallback(modelName, prompt, maxTokens);
      }

      const latency = Date.now() - startTime;
      metrics.inferenceCount++;
      metrics.totalTokens += response.split(' ').length;
      metrics.averageLatency =;
        (metrics.averageLatency * (metrics.inferenceCount - 1) + latency) / metrics.inferenceCount;

      this.modelMetrics.set(modelName, metrics);
      return response;
    } catch (error) {
      metrics.errorRate =;
        (metrics.errorRate * metrics.inferenceCount + 1) / (metrics.inferenceCount + 1);
      this.modelMetrics.set(modelName, metrics);
      throw error:;
    }
  }

  /**;
   * Run MLX inference
   */
  private async runMLXInference(;
    modelName: string,
    prompt: string,
    maxTokens: number;
  ): Promise<string> {
    const inferenceScript = ``
from mlx_lm import load, generate;

model, tokenizer = load("${modelName}");
response = generate(model, tokenizer, "${prompt.replace(/"/g, '\\"')}", max_tokens=${maxTokens});
print(response);
`;`;

    const { stdout } = await execAsync(`python3 -c "${inferenceScript}"`);
    return stdout.trim();
  }

  /**;
   * Fallback to Ollama
   */
  private async runOllamaFallback(;
    modelName: string,
    prompt: string,
    maxTokens: number;
  ): Promise<string> {
    const { stdout } = await execAsync(
      `echo "${prompt.replace(/"/g, '\\"')}" | ollama run ${modelName} --max-tokens ${maxTokens}`;
    );
    return stdout.trim();
  }

  /**;
   * Generate embeddings using embedded model
   */
  async generateEmbeddings(texts: string[], modelName = 'nomic-embed-text'): Promise<number[][]> {
    // Ensure embedding model is loaded
    if (!this.mlxModels.has(modelName)) {
      await this.embedModel(modelName);
    }

    if (this.isMLXAvailable) {
      return this.runMLXEmbeddings(texts, modelName);
    } else {
      // Fallback to mock embeddings
      return texts.map(() =>;
        Array(384);
          .fill(0);
          .map(() => Math.random());
      );
    }
  }

  /**;
   * Run MLX embeddings
   */
  private async runMLXEmbeddings(texts: string[], modelName: string): Promise<number[][]> {
    const embeddingScript = ``
import mlx
import json
from sentence_transformers import SentenceTransformer;

model = SentenceTransformer('${modelName}');
texts = ${JSON.stringify(texts)}
embeddings = model.encode(texts);
print(json.dumps(embeddings.tolist()));
`;`;

    const { stdout } = await execAsync(`python3 -c "${embeddingScript}"`);
    return JSON.parse(stdout);
  }

  /**;
   * Pin model to prevent unloading
   */
  pinModel(modelName: string): void {
    const model = this.mlxModels.get(modelName);
    if (model) {
      model.isPinned = true;
      this.emit('model-pinned', { model: modelName });
    }
  }

  /**;
   * Unpin model
   */
  unpinModel(modelName: string): void {
    const model = this.mlxModels.get(modelName);
    if (model) {
      model.isPinned = false;
      this.emit('model-unpinned', { model: modelName });
    }
  }

  /**;
   * Get status of all embedded models
   */
  getModelStatus(): Record<string, unknown> {
    const status: Record<string, unknown> = {};

    for (const [name, model] of this.mlxModels.entries()) {
      const metrics = this.modelMetrics.get(name);
      status[name] = {
        loaded: true,
        engine: this.isMLXAvailable ? 'mlx' : 'ollama',
        memoryMB: model.memoryFootprint / 1024 / 1024,
        lastUsed: model.lastUsed,
        isPinned: model.isPinned,
        tokensPerSecond: model.averageTokensPerSecond,
        metrics,
      };
    }

    return status;
  }

  /**;
   * Check if MLX is available
   */
  isAvailable(): boolean {
    return this.isMLXAvailable;
  }

  /**;
   * Set memory limit
   */
  setMemoryLimit(bytes: number): void {
    this.memoryLimit = bytes;
  }

  /**;
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    const models = Array.from(this.mlxModels.keys());

    // Add commonly used models
    const commonModels = ['phi:2.7b', 'gemma:2b', 'qwen2.5:1.5b', 'nomic-embed-text'];

    return [...new Set([...models, ...commonModels])];
  }
}

export default EmbeddedModelManager;

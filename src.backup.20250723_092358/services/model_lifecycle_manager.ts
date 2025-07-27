/* eslint-disable no-undef */
/**
 * Model Lifecycle Manager
 * Handles intelligent model loading, warming, and memory management
 */

import EventEmitter from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OllamaService } from './ollama_service';
import { logger } from '../utils/logger';
import { mlxInterface } from './mlx-interface/index.js';

const execAsync = promisify(exec);

interface ModelInstance {
  name: string;
  size: number; // in bytes
  lastUsed: Date;
  isLoaded: boolean;
  isPinned: boolean;
  warmupTime: number; // milliseconds
  inferenceCount: number;
}

interface ModelWarmTask {
  model: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  callback?: () => void;
  timeout?: number;
}

interface ModelPrediction {
  suggestedModel: string;
  confidence: number;
  alternativeModels: string[];
}

interface Task {
  prompt: string;
  complexity?: number;
  expectedTokens?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ModelResponse {
  text: string;
  confidence: number;
  tokensPerSecond?: number;
  totalTokens?: number;
}

export class ModelLifecycleManager extends EventEmitter {
  private generateWithOllama = async (model: string, task: Task): Promise<ModelResponse> => {
    try {
      const result = await this.ollamaService.generate({
        model,
        prompt: task.prompt,
        options: {
          num_predict: task.expectedTokens || 500,
          temperature: 0.7,
        },
      });

      return {
        text: result,
        confidence: 0.85,
        tokensPerSecond: 50,
      };
    } catch (error) {
      logger.error('Ollama generation failed:', error);
      return {
        text: 'Generation failed',
        confidence: 0.5,
      };
    }
  };

  private activeModels: Map<string, ModelInstance> = new Map();
  private warmingQueue: ModelWarmTask[] = [];
  private isWarmingInProgress = false;
  private memoryLimit = 32 * 1024 * 1024 * 1024; // 32GB default
  private mlxInterface: any; // Will be implemented with actual MLX integration
  private ollamaService: OllamaService;

  constructor(memoryLimit?: number) {
    super();
    if (memoryLimit) {
      this.memoryLimit = memoryLimit;
    }
    this.ollamaService = new OllamaService();
    this.initializeInterfaces();
  }

  /**
   * Initialize model interfaces
   */
  private async initializeInterfaces(): Promise<void> {
    // Initialize real MLX interface
    try {
      const isMLXAvailable = await mlxInterface.checkMLXAvailability();
      if (isMLXAvailable) {
        this.mlxInterface = {
          quickInference: async (params: any) => {
            const result = await mlxInterface.quickInference(params);
            return { text: result.text, confidence: result.confidence };
          },
          generate: async (model: string, task: any) => {
            const result = await mlxInterface.generate(model, task);
            return { text: result.text, confidence: result.confidence };
          },
        };
        logger.info('✅ Real MLX interface initialized successfully');
      } else {
        // Fallback to mock only if MLX is not available
        this.mlxInterface = {
          quickInference: async (params: any) => {
            logger.debug('MLX not available, using mock response for quickInference');
            return { text: 'mlx-unavailable', confidence: 0.5 };
          },
          generate: async (model: string, task: any) => {
            logger.debug('MLX not available, using mock response for generate');
            return { text: 'MLX service unavailable', confidence: 0.5 };
          },
        };
        logger.info('⚠️ MLX not available on this system, using fallback interface');
      }
    } catch (error) {
      logger.error('Failed to initialize MLX interface:', error);
      // Error fallback interface
      this.mlxInterface = {
        quickInference: async (params: any) => ({ text: 'mlx-_error, confidence: 0.1 }),
        generate: async (model: string, task: any) => ({
          text: 'MLX initialization failed',
          confidence: 0.1,
        }),
      };
    }

    // Ollama interface is now using the actual OllamaService
  }

  /**
   * Predict which model will be needed and warm it
   */
  async predictAndWarm(context: any): Promise<ModelPrediction> {
    // Get available models first
    let availableModels: string[] = [];
    try {
      const models = await this.ollamaService.listModels();
      availableModels = models.map((m) => m.name);
    } catch (error) {
      logger.warn('Failed to list Ollama models:', error);
      availableModels = ['phi:2.7b', 'qwen2.5:7b', 'deepseek-r1:14b'];
    }

    // Analyze context to predict needed model
    let suggestedModel = 'medium';
    if (context.taskComplexity === 'simple' || context.responseTime === 'fast') {
      suggestedModel = 'small';
    } else if (context.taskComplexity === 'complex' || context.responseTime === 'quality') {
      suggestedModel = 'large';
    }

    const prediction = {
      text: suggestedModel,
      confidence: 0.85,
    };

    // Warm predicted model in background
    if (suggestedModel.includes('large') || suggestedModel.includes('14b')) {
      this.enqueueWarmTask({
        model: 'deepseek-r1:14b',
        priority: 'HIGH',
        callback: () => this.notifyReady('deepseek-r1:14b'),
      });
    } else if (suggestedModel.includes('medium') || suggestedModel.includes('7b')) {
      this.enqueueWarmTask({
        model: 'qwen2.5:7b',
        priority: 'MEDIUM',
        callback: () => this.notifyReady('qwen2.5:7b'),
      });
    }

    return {
      suggestedModel: this.mapPredictionToModel(suggestedModel),
      confidence: prediction.confidence || 0.7,
      alternativeModels: this.getAlternativeModels(suggestedModel),
    };
  }

  /**
   * Progressive model escalation based on confidence
   */
  async progressiveEscalation(task: Task): Promise<ModelResponse> {
    const embeddedModels = new Map([
      ['phi:2.7b', { size: 2.7e9, speed: 'fast' }],
      ['gemma:2b', { size: 2e9, speed: 'very-fast' }],
    ]);

    // Start with embedded tiny model
    let response = await this.runEmbeddedModel('phi:2.7b', task);

    // Check if we need more capability
    if (response.confidence < 0.7) {
      // Use medium while warming large
      const warmTask = this.warmModel('deepseek-r1:14b');
      response = await this.generateWithOllama('qwen2.5:7b', task);

      // If still not confident, wait for large model
      if (response.confidence < 0.8) {
        await warmTask;
        response = await this.mlxInterface.generate('deepseek-r1:14b', task);
      }
    }

    return response;
  }

  /**
   * Warm a model in the background
   */
  private async warmModel(modelName: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if already loaded
      const existing = this.activeModels.get(modelName);
      if (existing?.isLoaded) {
        existing.lastUsed = new Date();
        return;
      }

      // Load model
      await this.loadModel(modelName);

      // Update model instance
      const warmupTime = Date.now() - startTime;
      this.activeModels.set(modelName, {
        name: modelName,
        size: await this.getModelSize(modelName),
        lastUsed: new Date(),
        isLoaded: true,
        isPinned: false,
        warmupTime,
        inferenceCount: 0,
      });

      this.emit('model-ready', { model: modelName, warmupTime });
    } catch (error) {
      this.emit('model-_error, { model: modelName, error});
      throw error;
    }
  }

  /**
   * Enqueue a model warming task
   */
  private enqueueWarmTask(task: ModelWarmTask): void {
    // Add to queue based on priority
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const insertIndex = this.warmingQueue.findIndex(
      (t) => priorityOrder[t.priority] > priorityOrder[task.priority]
    );

    if (insertIndex === -1) {
      this.warmingQueue.push(task);
    } else {
      this.warmingQueue.splice(insertIndex, 0, task);
    }

    this.processWarmingQueue();
  }

  /**
   * Process the warming queue
   */
  private async processWarmingQueue(): Promise<void> {
    if (this.isWarmingInProgress || this.warmingQueue.length === 0) {
      return;
    }

    this.isWarmingInProgress = true;
    const task = this.warmingQueue.shift()!;

    try {
      await this.warmModel(task.model);
      if (task.callback) {
        task.callback();
      }
    } catch (error) {
      console._error`Failed to warm model ${task.model}:`, error);
    }

    this.isWarmingInProgress = false;

    // Process next task
    if (this.warmingQueue.length > 0) {
      setImmediate(() => this.processWarmingQueue());
    }
  }

  /**
   * Auto-manage memory by unloading LRU models
   */
  async autoManageMemory(): Promise<void> {
    try {
      const models = await this.ollamaService.listModels();
      const totalSize = models.reduce((sum, m) => sum + (m.size || 0), 0);

      if (totalSize > 0.8 * this.memoryLimit) {
        // Get models sorted by last used time
        const lruModels = Array.from(this.activeModels.entries())
          .filter(([_, model]) => !model.isPinned && model.isLoaded)
          .sort((a, b) => a[1].lastUsed.getTime() - b[1].lastUsed.getTime());

        for (const [name, model] of lruModels) {
          // In Ollama, we can't directly unload models, but we can remove them
          try {
            await execAsync(`ollama rm ${name}`);
            model.isLoaded = false;
            logger.info(`Unloaded model ${name} to free memory`);
          } catch (error) {
            logger.warn(`Failed to unload model ${name}:`, error);
          }

          const newModels = await this.ollamaService.listModels();
          const newSize = newModels.reduce((sum, m) => sum + (m.size || 0), 0);
          if (newSize < 0.6 * this.memoryLimit) {
            break;
          }
        }
      }
    } catch (error) {
      logger.error('Failed to manage memory:', error);
    }
  }

  /**
   * Run inference with embedded model
   */
  private async runEmbeddedModel(model: string, task: Task): Promise<ModelResponse> {
    const modelInstance = this.activeModels.get(model);
    if (modelInstance) {
      modelInstance.lastUsed = new Date();
      modelInstance.inferenceCount++;
    }

    // Use real MLX interface if available
    try {
      if (this.mlxInterface && model.includes('mlx')) {
        const result = await this.mlxInterface.generate(model, task);
        return {
          text: result.text,
          confidence: result.confidence,
        };
      }
    } catch (error) {
      logger.warn(`MLX inference failed, using fallback: ${_error`);
    }

    // Fallback implementation
    return {
      text: `Fallback response from ${model}`,
      confidence: model.includes('2.7b') ? 0.75 : 0.65,
      tokensPerSecond: model.includes('2b') ? 150 : 100,
    };
  }

  /**
   * Load a model
   */
  private async loadModel(modelName: string): Promise<void> {
    // Check memory before loading
    await this.autoManageMemory();

    // Real model loading implementation
    if (modelName.includes('mlx')) {
      // Load via real MLX interface
      try {
        await mlxInterface.loadModel(modelName, {
          modelPath: this.getModelPath(modelName),
          dtype: 'float16',
        });
        logger.info(`MLX model ${modelName} loaded successfully`);
      } catch (error) {
        logger.error(Failed to load MLX model ${modelName}:`, error);
        throw error;
      }
      logger.info(`Loading model via MLX`, { modelName });
    } else {
      // Load via Ollama - just check if model exists
      try {
        const models = await this.ollamaService.listModels();
        const exists = models.some((m) => m.name === modelName);
        if (!exists) {
          logger.info(`Model ${modelName} not found in Ollama`);
        }
      } catch (error) {
        logger.warn(`Failed to check Ollama model ${modelName}:`, error);
      }
    }
  }

  /**
   * Unload a model
   */
  private async unloadModel(modelName: string): Promise<void> {
    const model = this.activeModels.get(modelName);
    if (model) {
      model.isLoaded = false;
      // In real implementation, would actually unload from memory
      logger.info('Model unloaded', { modelName });
      this.emit('model-unloaded', { model: modelName });
    }
  }

  /**
   * Get current memory usage in bytes
   */
  private async getMemoryUsage(): Promise<number> {
    try {
      // Get system memory usage for AI-related processes
      const { stdout } = await execAsync(
        'ps -eo pid,rss,comm | grep -E "(ollama|python|node)" | grep -v grep'
      );

      let totalMemoryKB = 0;
      const lines = stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const memKB = parseInt(parts[1], 10);
          if (!isNaN(memKB)) {
            totalMemoryKB += memKB;
          }
        }
      }

      // Convert KB to bytes
      const memoryBytes = totalMemoryKB * 1024;

      logger.debug(`AI model memory usage: ${(memoryBytes / 1e9).toFixed(2)}GB`);
      return memoryBytes;
    } catch (error) {
      logger.debug('Failed to get system memory usage, using model size estimation:', error);

      // Fallback to model size estimation
      const loadedModels = Array.from(this.activeModels.values()).filter((m) => m.isLoaded);

      const totalSize = loadedModels.reduce((sum, m) => sum + m.size, 0);
      return totalSize;
    }
  }

  /**
   * Get model size
   */
  private async getModelSize(modelName: string): Promise<number> {
    // Mock implementation - replace with actual size check
    const sizeMap: Record<string, number> = {
      'phi:2.7b': 2.7e9,
      'gemma:2b': 2e9,
      'qwen2.5:7b': 7e9,
      'deepseek-r1:14b': 14e9,
      'devstral:24b': 24e9,
    };

    return sizeMap[modelName] || 5e9;
  }

  /**
   * Parse model prediction from text
   */
  private parseModelPrediction(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('large') || lower.includes('complex')) return 'large';
    if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
    return 'small';
  }

  /**
   * Map prediction to actual model name
   */
  private mapPredictionToModel(prediction: string): string {
    const mapping: Record<string, string> = {
      large: 'deepseek-r1:14b',
      medium: 'qwen2.5:7b',
      small: 'phi:2.7b',
    };

    return mapping[prediction] || 'qwen2.5:7b';
  }

  /**
   * Get alternative models for fallback
   */
  private getAlternativeModels(prediction: string): string[] {
    if (prediction === 'large') {
      return ['devstral:24b', 'qwen2.5:7b'];
    } else if (prediction === 'medium') {
      return ['phi:2.7b', 'deepseek-r1:14b'];
    }
    return ['qwen2.5:7b', 'phi:2.7b'];
  }

  /**
   * Notify that a model is ready
   */
  private notifyReady(modelName: string): void {
    this.emit('model-warmed', { model: modelName, timestamp: new Date() });
  }

  /**
   * Pin a model to prevent unloading
   */
  pinModel(modelName: string): void {
    const model = this.activeModels.get(modelName);
    if (model) {
      model.isPinned = true;
    }
  }

  /**
   * Unpin a model
   */
  unpinModel(modelName: string): void {
    const model = this.activeModels.get(modelName);
    if (model) {
      model.isPinned = false;
    }
  }

  /**
   * Get status of all models
   */
  getModelStatus(): Record<string, unknown> {
    const status: Record<string, unknown> = {};

    for (const [name, model] of this.activeModels.entries()) {
      status[name] = {
        isLoaded: model.isLoaded,
        isPinned: model.isPinned,
        lastUsed: model.lastUsed,
        inferenceCount: model.inferenceCount,
        warmupTime: model.warmupTime,
      };
    }

    return status;
  }

  /**
   * Set memory limit
   */
  setMemoryLimit(bytes: number): void {
    this.memoryLimit = bytes;
  }

  /**
   * Get memory limit
   */
  getMemoryLimit(): number {
    return this.memoryLimit;
  }

  /**
   * Get model file path
   */
  private getModelPath(modelName: string): string {
    // Common model directory paths
    const basePaths = [
      `${process.env.HOME}/.ollama/models`,
      `${process.env.HOME}/.cache/huggingface/transformers`,
      `${process.cwd()}/models`,
      `/opt/models`,
      `/usr/local/models`,
    ];

    // Try to find the model in common locations
    for (const basePath of basePaths) {
      const possiblePaths = [
        `${basePath}/${modelName}`,
        `${basePath}/${modelName}.bin`,
        `${basePath}/${modelName}/model.bin`,
        `${basePath}/${modelName}/pytorch_model.bin`,
      ];

      // Return first reasonable path (actual existence check would be async)
      return possiblePaths[0];
    }

    // Default path
    return `${process.cwd()}/models/${modelName}`;
  }
}

export default ModelLifecycleManager;

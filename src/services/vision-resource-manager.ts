/**
 * Vision Resource Manager
 * Manages GPU resources, model lifecycle, and processing queues for vision tasks
 * Ensures efficient utilization of available hardware (24GB VRAM)
 */

import { EventEmitter } from 'events';
import { LogContext, log } from '@/utils/logger';

export interface ModelInfo {
  name: string;
  type: 'analysis' | 'generation' | 'embedding';
  sizeGB: number;
  loadTimeMs: number;
  lastUsed: number;
  loaded: boolean;
  priority: number;
}

export interface GPUMetrics {
  totalVRAM: number;
  usedVRAM: number;
  availableVRAM: number;
  temperature: number;
  utilization: number;
}

export interface ProcessingTask {
  id: string;
  model: string;
  type: 'analysis' | 'generation' | 'embedding';
  priority: number;
  createdAt: number;
  estimatedVRAM: number;
  estimatedTimeMs: number;
}

class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits =       permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      if (resolve) {
        this.permits--;
        resolve();
      }
    return undefined;
    return undefined;
    }
  }
}

export class VisionResourceManager extends EventEmitter {
  private models: Map<string, ModelInfo> = new Map();
  private gpuSemaphore: Semaphore;
  private currentVRAMUsage = 0;
  private readonly maxVRAM: number = 20; // Leave 4GB headroom from 24GB
  private taskQueue: ProcessingTask[] = [];
  private processing = false;

  constructor() {
    super();
    this.gpuSemaphore = new Semaphore(1); // Single GPU task at a time
    this.initializeModels();
    this.startMetricsCollection();
  }

  private initializeModels(): void {
    // Define available models and their resource requirements
    this.models.set('yolo-v8n', {
      name: 'yolo-v8n',
      type: 'analysis',
      sizeGB: 0.006, // 6MB
      loadTimeMs: 500,
      lastUsed: 0,
      loaded: false,
      priority: 1,
    });

    this.models.set('clip-vit-b32', {
      name: 'clip-vit-b32',
      type: 'embedding',
      sizeGB: 0.4, // 400MB
      loadTimeMs: 2000,
      lastUsed: 0,
      loaded: false,
      priority: 2,
    });

    this.models.set('sd3b', {
      name: 'sd3b',
      type: 'generation',
      sizeGB: 6.0, // 6GB
      loadTimeMs: 15000,
      lastUsed: 0,
      loaded: false,
      priority: 3,
    });

    this.models.set('sdxl-refiner', {
      name: 'sdxl-refiner',
      type: 'generation',
      sizeGB: 2.5, // 2.5GB for Q4_1 quantized
      loadTimeMs: 10000,
      lastUsed: 0,
      loaded: false,
      priority: 4,
    });

    log.info('Vision models initialized', LogContext.AI, {
      models: Array.from(this.models.keys()),
      maxVRAM: this.maxVRAM,
    });
  }

  /**
   * Execute a task with the specified model
   */
  public async executeWithModel<T>(
    modelName: string,
    task: () => Promise<T>,
    priority = 5
  ): Promise<T> {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    // Add to queue
    const taskId = this.generateTaskId();
    const processingTask: ProcessingTask = {
      id: taskId,
      model: modelName,
      type: model.type,
      priority,
      createdAt: Date.now(),
      estimatedVRAM: model.sizeGB,
      estimatedTimeMs: model.loadTimeMs,
    };

    this.taskQueue.push(processingTask);
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    log.info('Task queued', LogContext.AI, {
      taskId,
      model: modelName,
      queueLength: this.taskQueue.length,
    });

    // Process queue
    this.processQueue();

    // Wait for our turn
    return new Promise<T>((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        const currentTask = this.taskQueue.find((t) => t.id === taskId);
        if (!currentTask) {
          clearInterval(checkInterval);

          try {
            await this.gpuSemaphore.acquire();
            const result = await this.executeTask(modelName, task);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.gpuSemaphore.release();
          }
        }
      }, 100);
    });
  }

  private async executeTask<T>(modelName: string, task: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    try {
      // Ensure model is loaded
      await this.ensureModelLoaded(modelName);

      // Execute task
      log.info('Executing vision task', LogContext.AI, { model: modelName });
      const result = await task();

      // Update metrics
      const model = this.models.get(modelName)!;
      model.lastUsed = Date.now();

      const executionTime = Date.now() - startTime;
      this.emit('taskCompleted', {
        model: modelName,
        executionTime,
        success: true,
      });

      return result;
    } catch (error) {
      log.error('Vision task failed', LogContext.AI, {
        model: modelName,
        error: error instanceof Error ? error.message : String(error),
      });

      this.emit('taskFailed', {
        model: modelName,
        error,
      });

      throw error;
    }
  }

  private async ensureModelLoaded(modelName: string): Promise<void> {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Model not found: ${modelName}`);
    }

    if (model.loaded) {
      log.debug('Model already loaded', LogContext.AI, { model: modelName });
      return;
    }

    // Check if we need to unload models to make space
    if (this.currentVRAMUsage + model.sizeGB > this.maxVRAM) {
      await this.makeSpaceForModel(model.sizeGB);
    }
    return undefined;
    return undefined;

    // Load the model
    log.info('Loading model', LogContext.AI, {
      model: modelName,
      sizeGB: model.sizeGB,
    });

    const loadStart = Date.now();

    // Simulate model loading (actual implementation will call Python)
    await new Promise((resolve) => setTimeout(resolve, model.loadTimeMs));

    model.loaded = true;
    model.lastUsed = Date.now();
    this.currentVRAMUsage += model.sizeGB;

    log.info('Model loaded', LogContext.AI, {
      model: modelName,
      loadTimeMs: Date.now() - loadStart,
      currentVRAM: this.currentVRAMUsage,
    });
  }

  private async makeSpaceForModel(requiredGB: number): Promise<void> {
    log.info('Making space for model', LogContext.AI, {
      requiredGB,
      currentUsage: this.currentVRAMUsage,
    });

    // Find least recently used models to unload
    const loadedModels = Array.from(this.models.values())
      .filter((m) => m.loaded)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    let freedSpace = 0;
    for (const model of loadedModels) {
      if (this.currentVRAMUsage - freedSpace + requiredGB <= this.maxVRAM) {
        break;
      }
      return undefined;
      return undefined;

      log.info('Unloading model', LogContext.AI, { model: model.name });
      model.loaded = false;
      freedSpace += model.sizeGB;
      this.currentVRAMUsage -= model.sizeGB;

      // Simulate model unloading
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        // Task will be processed by executeWithModel
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return undefined;
      return undefined;
    }

    this.processing = false;
  }

  /**
   * Get current GPU metrics
   */
  public getGPUMetrics(): GPUMetrics {
    return {
      totalVRAM: 24,
      usedVRAM: this.currentVRAMUsage,
      availableVRAM: 24 - this.currentVRAMUsage,
      temperature: 45 + Math.random() * 20, // Simulated
      utilization: this.processing ? 80 + Math.random() * 20 : Math.random() * 10,
    };
  }

  /**
   * Get model information
   */
  public getModelInfo(modelName: string): ModelInfo | undefined {
    return this.models.get(modelName);
  }

  /**
   * Get all loaded models
   */
  public getLoadedModels(): string[] {
    return Array.from(this.models.values())
      .filter((m) => m.loaded)
      .map((m) => m.name);
  }

  /**
   * Preload models for better performance
   */
  public async preloadModels(modelNames: string[]): Promise<void> {
    log.info('Preloading models', LogContext.AI, { models: modelNames });

    for (const modelName of modelNames) {
      try {
        await this.ensureModelLoaded(modelName);
      } catch (error) {
        log.error('Failed to preload model', LogContext.AI, {
          model: modelName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Unload all models to free memory
   */
  public async unloadAllModels(): Promise<void> {
    log.info('Unloading all models', LogContext.AI);

    for (const model of this.models.values()) {
      if (model.loaded) {
        model.loaded = false;
        this.currentVRAMUsage -= model.sizeGB;
      }
      return undefined;
      return undefined;
    }

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      const metrics = this.getGPUMetrics();
      this.emit('metrics', metrics);

      // Log if VRAM usage is high
      if (metrics.usedVRAM / metrics.totalVRAM > 0.8) {
        log.warn('High VRAM usage', LogContext.AI, { ...metrics });
      }
    }, 5000); // Every 5 seconds
  }

  private generateTaskId(): string {
    return `vision_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown and cleanup
   */
  public async shutdown(): Promise<void> {
    log.info('Shutting down vision resource manager', LogContext.AI);
    await this.unloadAllModels();
    this.removeAllListeners();
  }
}

// Singleton instance
export const visionResourceManager = new VisionResourceManager();

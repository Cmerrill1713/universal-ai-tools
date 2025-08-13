import { EventEmitter } from 'events';
import { log, LogContext } from '@/utils/logger';
class Semaphore {
    permits;
    waiting = [];
    constructor(permits) {
        this.permits = permits;
    }
    async acquire() {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        return new Promise((resolve) => {
            this.waiting.push(resolve);
        });
    }
    release() {
        this.permits++;
        if (this.waiting.length > 0) {
            const resolve = this.waiting.shift();
            if (resolve) {
                this.permits--;
                resolve();
            }
        }
    }
}
export class VisionResourceManager extends EventEmitter {
    models = new Map();
    gpuSemaphore;
    currentVRAMUsage = 0;
    maxVRAM = 20;
    taskQueue = [];
    processing = false;
    constructor() {
        super();
        this.gpuSemaphore = new Semaphore(1);
        this.initializeModels();
        this.startMetricsCollection();
    }
    initializeModels() {
        this.models.set('yolo-v8n', {
            name: 'yolo-v8n',
            type: 'analysis',
            sizeGB: 0.006,
            loadTimeMs: 500,
            lastUsed: 0,
            loaded: false,
            priority: 1,
        });
        this.models.set('clip-vit-b32', {
            name: 'clip-vit-b32',
            type: 'embedding',
            sizeGB: 0.4,
            loadTimeMs: 2000,
            lastUsed: 0,
            loaded: false,
            priority: 2,
        });
        this.models.set('sd3b', {
            name: 'sd3b',
            type: 'generation',
            sizeGB: 6.0,
            loadTimeMs: 15000,
            lastUsed: 0,
            loaded: false,
            priority: 3,
        });
        this.models.set('sdxl-refiner', {
            name: 'sdxl-refiner',
            type: 'generation',
            sizeGB: 2.5,
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
    async executeWithModel(modelName, task, priority = 5) {
        const model = this.models.get(modelName);
        if (!model) {
            throw new Error(`Unknown model: ${modelName}`);
        }
        const taskId = this.generateTaskId();
        const processingTask = {
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
        this.processQueue();
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(async () => {
                const currentTask = this.taskQueue.find((t) => t.id === taskId);
                if (!currentTask) {
                    clearInterval(checkInterval);
                    try {
                        await this.gpuSemaphore.acquire();
                        const result = await this.executeTask(modelName, task);
                        resolve(result);
                    }
                    catch (error) {
                        reject(error);
                    }
                    finally {
                        this.gpuSemaphore.release();
                    }
                }
            }, 100);
        });
    }
    async executeTask(modelName, task) {
        const startTime = Date.now();
        try {
            await this.ensureModelLoaded(modelName);
            log.info('Executing vision task', LogContext.AI, { model: modelName });
            const result = await task();
            const model = this.models.get(modelName);
            model.lastUsed = Date.now();
            const executionTime = Date.now() - startTime;
            this.emit('taskCompleted', {
                model: modelName,
                executionTime,
                success: true,
            });
            return result;
        }
        catch (error) {
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
    async ensureModelLoaded(modelName) {
        const model = this.models.get(modelName);
        if (!model) {
            throw new Error(`Model not found: ${modelName}`);
        }
        if (model.loaded) {
            log.debug('Model already loaded', LogContext.AI, { model: modelName });
            return;
        }
        if (this.currentVRAMUsage + model.sizeGB > this.maxVRAM) {
            await this.makeSpaceForModel(model.sizeGB);
        }
        log.info('Loading model', LogContext.AI, {
            model: modelName,
            sizeGB: model.sizeGB,
        });
        const loadStart = Date.now();
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
    async makeSpaceForModel(requiredGB) {
        log.info('Making space for model', LogContext.AI, {
            requiredGB,
            currentUsage: this.currentVRAMUsage,
        });
        const loadedModels = Array.from(this.models.values())
            .filter((m) => m.loaded)
            .sort((a, b) => a.lastUsed - b.lastUsed);
        let freedSpace = 0;
        for (const model of loadedModels) {
            if (this.currentVRAMUsage - freedSpace + requiredGB <= this.maxVRAM) {
                break;
            }
            log.info('Unloading model', LogContext.AI, { model: model.name });
            model.loaded = false;
            freedSpace += model.sizeGB;
            this.currentVRAMUsage -= model.sizeGB;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
    async processQueue() {
        if (this.processing)
            return;
        this.processing = true;
        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            if (task) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
        }
        this.processing = false;
    }
    getGPUMetrics() {
        return {
            totalVRAM: 24,
            usedVRAM: this.currentVRAMUsage,
            availableVRAM: 24 - this.currentVRAMUsage,
            temperature: 45 + Math.random() * 20,
            utilization: this.processing ? 80 + Math.random() * 20 : Math.random() * 10,
        };
    }
    getModelInfo(modelName) {
        return this.models.get(modelName);
    }
    getLoadedModels() {
        return Array.from(this.models.values())
            .filter((m) => m.loaded)
            .map((m) => m.name);
    }
    async preloadModels(modelNames) {
        log.info('Preloading models', LogContext.AI, { models: modelNames });
        for (const modelName of modelNames) {
            try {
                await this.ensureModelLoaded(modelName);
            }
            catch (error) {
                log.error('Failed to preload model', LogContext.AI, {
                    model: modelName,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    async unloadAllModels() {
        log.info('Unloading all models', LogContext.AI);
        for (const model of this.models.values()) {
            if (model.loaded) {
                model.loaded = false;
                this.currentVRAMUsage -= model.sizeGB;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    startMetricsCollection() {
        setInterval(() => {
            const metrics = this.getGPUMetrics();
            this.emit('metrics', metrics);
            if (metrics.usedVRAM / metrics.totalVRAM > 0.8) {
                log.warn('High VRAM usage', LogContext.AI, { ...metrics });
            }
        }, 5000);
    }
    generateTaskId() {
        return `vision_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async shutdown() {
        log.info('Shutting down vision resource manager', LogContext.AI);
        await this.unloadAllModels();
        this.removeAllListeners();
    }
}
export const visionResourceManager = new VisionResourceManager();
//# sourceMappingURL=vision-resource-manager.js.map
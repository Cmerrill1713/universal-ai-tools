import { EventEmitter } from 'events';
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
export declare class VisionResourceManager extends EventEmitter {
    private models;
    private gpuSemaphore;
    private currentVRAMUsage;
    private readonly maxVRAM;
    private taskQueue;
    private processing;
    constructor();
    private initializeModels;
    executeWithModel<T>(modelName: string, task: () => Promise<T>, priority?: number): Promise<T>;
    private executeTask;
    private ensureModelLoaded;
    private makeSpaceForModel;
    private processQueue;
    getGPUMetrics(): GPUMetrics;
    getModelInfo(modelName: string): ModelInfo | undefined;
    getLoadedModels(): string[];
    preloadModels(modelNames: string[]): Promise<void>;
    unloadAllModels(): Promise<void>;
    private startMetricsCollection;
    private generateTaskId;
    shutdown(): Promise<void>;
}
export declare const visionResourceManager: VisionResourceManager;
//# sourceMappingURL=vision-resource-manager.d.ts.map
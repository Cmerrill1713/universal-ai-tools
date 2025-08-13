import { EventEmitter } from 'events';
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
declare class FlashAttentionService extends EventEmitter {
    private config;
    private isInitialized;
    private gpuDevices;
    private optimizationProfiles;
    private attentionCache;
    private performanceMetrics;
    private pythonProcess;
    private readonly CACHE_SIZE_LIMIT;
    private readonly METRICS_HISTORY_LIMIT;
    constructor(config?: Partial<FlashAttentionConfig>);
    initialize(): Promise<void>;
    private detectSystemCapabilities;
    private detectGPUDevices;
    private detectCPUCapabilities;
    private optimizeConfiguration;
    private initializePythonEnvironment;
    optimizeAttention(request: FlashAttentionRequest): Promise<FlashAttentionResponse>;
    private executeFlashAttention;
    private generateAttentionTensors;
    private generateRandomTensor;
    private reshapeAttentionMask;
    private setupOptimizationProfiles;
    private selectOptimizationProfile;
    private generateCacheKey;
    private hashArray;
    private cacheResult;
    private recordMetrics;
    private calculateSpeedup;
    private estimateStandardAttentionTime;
    private calculateMemoryEfficiency;
    private estimateStandardAttentionMemory;
    private executePythonScript;
    private executePythonScriptWithInput;
    private executePythonFile;
    private validateFlashAttentionInstallation;
    private startOptimizationService;
    getSystemCapabilities(): Promise<{
        gpuDevices: GPUInfo[];
        flashAttentionAvailable: boolean;
        optimizationProfiles: string[];
        currentConfig: FlashAttentionConfig;
    }>;
    getPerformanceMetrics(): Promise<{
        averageSpeedup: number;
        averageMemoryEfficiency: number;
        averageExecutionTime: number;
        cacheHitRate: number;
        totalOptimizations: number;
    }>;
    updateConfiguration(newConfig: Partial<FlashAttentionConfig>): Promise<void>;
    clearCache(): Promise<void>;
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: Record<string, any>;
    }>;
    shutdown(): Promise<void>;
}
export declare const flashAttentionService: FlashAttentionService;
export type { AttentionMetrics, FlashAttentionConfig, FlashAttentionRequest, FlashAttentionResponse, GPUInfo, OptimizationProfile, };
//# sourceMappingURL=flash-attention-service.d.ts.map
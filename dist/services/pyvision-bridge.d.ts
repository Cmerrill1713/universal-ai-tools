import type { GeneratedImage, GenerationParameters, RefinedImage, RefinementParameters, VisionAnalysis, VisionEmbedding, VisionOptions, VisionResponse } from '../types/vision';
export interface PyVisionMetrics {
    avgResponseTime: number;
    totalRequests: number;
    successRate: number;
    cacheHitRate: number;
    modelsLoaded: string[];
}
export declare class PyVisionBridge {
    private pythonProcess;
    private isInitialized;
    private pendingRequests;
    private requestQueue;
    private metrics;
    private cache;
    private readonly maxCacheSize;
    constructor();
    private initializePyVision;
    private initializeMockVision;
    analyzeImage(imagePath: string | Buffer, options?: VisionOptions): Promise<VisionResponse<VisionAnalysis>>;
    generateEmbedding(imagePath: string | Buffer): Promise<VisionResponse<VisionEmbedding>>;
    generateImage(prompt: string, parameters?: Partial<GenerationParameters>): Promise<VisionResponse<GeneratedImage>>;
    refineImage(imagePath: string | Buffer, parameters?: Partial<RefinementParameters>): Promise<VisionResponse<RefinedImage>>;
    analyzeBatch(imagePaths: string[], options?: VisionOptions): Promise<VisionResponse<VisionAnalysis>[]>;
    reason(imagePath: string | Buffer, question: string): Promise<VisionResponse<{
        answer: string;
        confidence: number;
        reasoning: string;
    }>>;
    private sendRequest;
    private handlePythonResponse;
    private createReasoningPrompt;
    private textBasedReasoning;
    private generateMockResponse;
    private getCacheKey;
    private updateCache;
    private updateMetrics;
    private generateRequestId;
    private restartProcess;
    getMetrics(): PyVisionMetrics & {
        isInitialized: boolean;
    };
    shutdown(): Promise<void>;
    isAvailable(): boolean;
}
declare class SafePyVisionBridge {
    private instance;
    private initAttempted;
    private isCircuitBreakerOpen;
    constructor();
    execute<T>(operation: () => Promise<T>): Promise<T>;
    analyzeImage(imagePath: string | Buffer, options?: VisionOptions): Promise<VisionResponse<VisionAnalysis>>;
    generateEmbedding(imagePath: string | Buffer): Promise<VisionResponse<VisionEmbedding>>;
    generateImage(prompt: string, parameters?: Partial<GenerationParameters>): Promise<VisionResponse<GeneratedImage>>;
    reason(imagePath: string | Buffer, question: string): Promise<VisionResponse<{
        answer: string;
        confidence: number;
        reasoning: string;
    }>>;
    refineImage(imagePath: string | Buffer, parameters?: Partial<RefinementParameters>): Promise<VisionResponse<RefinedImage>>;
    analyzeBatch(imagePaths: string[], options?: VisionOptions): Promise<VisionResponse<VisionAnalysis>[]>;
    getMetrics(): PyVisionMetrics & {
        isInitialized: boolean;
    };
    shutdown(): Promise<void>;
    getCircuitBreakerMetrics(): {
        isOpen: boolean;
        failures: number;
        successes: number;
    };
}
export declare const pyVisionBridge: SafePyVisionBridge;
export default pyVisionBridge;
//# sourceMappingURL=pyvision-bridge.d.ts.map
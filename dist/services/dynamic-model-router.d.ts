import type { DiscoveredModel } from './model-discovery-service';
export interface RoutingDecision {
    primary: DiscoveredModel;
    fallbacks: DiscoveredModel[];
    reasoning: string;
    estimatedLatency: number;
    confidence: number;
}
export interface PerformanceMetrics {
    modelId: string;
    provider: string;
    taskType: string;
    latencyMs: number;
    tokensPerSecond: number;
    success: boolean;
    quality?: number;
    timestamp: number;
}
export interface ModelPerformance {
    avgLatency: number;
    avgTokensPerSecond: number;
    successRate: number;
    avgQuality?: number;
    sampleCount: number;
}
export declare class DynamicModelRouter {
    private performanceHistory;
    private modelPerformance;
    private routingWeights;
    private maxHistoryPerModel;
    private learningRate;
    constructor();
    route(taskType: string, prompt: string, options?: {
        priority?: 'speed' | 'quality' | 'balanced';
        maxLatencyMs?: number;
        minQuality?: number;
        requiredCapabilities?: string[];
    }): Promise<RoutingDecision>;
    private scoreModel;
    private selectFallbacks;
    trackPerformance(model: DiscoveredModel, taskType: string, metrics: {
        latencyMs: number;
        tokensGenerated: number;
        success: boolean;
        quality?: number;
    }): Promise<void>;
    private updateModelPerformance;
    private updateRoutingWeights;
    private inferCapabilities;
    private estimateComplexity;
    private estimateLatency;
    private explainDecision;
    private calculateConfidence;
    private loadPerformanceHistory;
    private savePerformanceHistory;
    private startPerformanceAnalysis;
    private analyzePerformanceTrends;
    getPerformanceReport(): Record<string, ModelPerformance>;
    getRoutingWeights(): Record<string, number>;
    resetModelPerformance(modelId: string, provider: string): void;
}
export declare const dynamicModelRouter: DynamicModelRouter;
//# sourceMappingURL=dynamic-model-router.d.ts.map
import type { DiscoveredModel } from './model-discovery-service';
export interface SpeculativeConfig {
    maxDraftTokens: number;
    temperature: number;
    topK: number;
    acceptanceThreshold: number;
    enableTreeAttention: boolean;
}
export interface SpeculationResult {
    tokens: string[];
    acceptedCount: number;
    rejectedCount: number;
    speedup: number;
    draftTime: number;
    verifyTime: number;
}
export interface ModelPair {
    draft: DiscoveredModel;
    target: DiscoveredModel;
    compatibility: number;
    expectedSpeedup: number;
}
export declare class SpeculativeDecodingService {
    private config;
    private modelPairs;
    private performanceHistory;
    private activeSpeculations;
    constructor();
    private initializeModelPairs;
    private createModelPair;
    generateWithSpeculation(prompt: string, targetModel: DiscoveredModel, options?: {
        maxTokens?: number;
        temperature?: number;
        systemPrompt?: string;
    }): Promise<{
        content: string;
        speculation: SpeculationResult;
        modelPair: ModelPair;
    }>;
    private speculativeDecode;
    private generateDraftTokens;
    private verifyTokens;
    private getNextTokenProbabilities;
    private generateSingleToken;
    private callModel;
    private parseTokens;
    private shouldStop;
    private findBestDraftModel;
    private hasSharedCapabilities;
    private updatePerformanceHistory;
    getAverageSpeedup(draftId: string, targetId: string): number;
    getBestPairs(limit?: number): ModelPair[];
    updateConfig(config: Partial<SpeculativeConfig>): void;
    cancelSpeculation(requestId: string): boolean;
    getStatistics(): {
        totalPairs: number;
        activeSpeculations: number;
        averageSpeedup: number;
        successRate: number;
    };
    getStatus(): {
        status: string;
        modelPairs: number;
        activeSpeculations: number;
    };
    generate(prompt: string, options?: any): Promise<any>;
    getPerformanceMetrics(): any;
    optimizeModel(draftModel: string, targetModel: string): Promise<any>;
    getModelPairs(): ModelPair[];
    benchmark(draftModel: string, targetModel: string, testPrompts?: string[]): Promise<any>;
}
export declare const speculativeDecodingService: SpeculativeDecodingService;
//# sourceMappingURL=speculative-decoding-service.d.ts.map
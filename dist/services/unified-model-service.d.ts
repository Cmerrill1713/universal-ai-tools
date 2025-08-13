export interface UnifiedRequest {
    prompt: string;
    systemPrompt?: string;
    taskType?: string;
    priority?: 'speed' | 'quality' | 'balanced';
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    requiredCapabilities?: string[];
    maxLatencyMs?: number;
}
export interface UnifiedResponse {
    content: string;
    model: {
        id: string;
        provider: string;
        tier: number;
    };
    metrics: {
        latencyMs: number;
        tokensGenerated: number;
        tokensPerSecond: number;
    };
    routing: {
        decision: string;
        confidence: number;
        fallbacksAvailable: number;
    };
}
export declare class UnifiedModelService {
    private providerClients;
    private circuitBreakers;
    private activeRequests;
    constructor();
    private initializeProviders;
    generate(request: UnifiedRequest): Promise<UnifiedResponse>;
    private callModel;
    private callOllama;
    private callLMStudio;
    private callMLX;
    private getOptimalTemperature;
    private getOptimalMaxTokens;
    private getOptimalContextSize;
    private getOptimalThreads;
    private countTokens;
    private estimateQuality;
    private generateRequestId;
    cancelRequest(requestId: string): boolean;
    private startHealthChecks;
    private checkProviderHealth;
    getProviderStats(): Record<string, any>;
    getAvailableModels(): Record<string, number>;
}
export declare const unifiedModelService: UnifiedModelService;
//# sourceMappingURL=unified-model-service.d.ts.map
export interface ModelTier {
    tier: 1 | 2 | 3 | 4;
    models: string[];
    capabilities: string[];
    maxTokens: number;
    avgResponseTime: number;
    useCase: string;
}
export interface TaskClassification {
    complexity: 'simple' | 'medium' | 'complex' | 'expert';
    domain: 'general' | 'code' | 'reasoning' | 'creative' | 'multimodal';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    estimatedTokens: number;
    requiresAccuracy: boolean;
    requiresSpeed: boolean;
}
export interface ExecutionPlan {
    primaryModel: string;
    fallbackModels: string[];
    tier: number;
    estimatedTime: number;
    confidence: number;
    reasoning: string;
}
export declare class MultiTierLLMService {
    private modelTiers;
    private modelPerformance;
    constructor();
    private initializeModelTiers;
    private populateAvailableModels;
    classifyAndPlan(userRequest: string, context?: Record<string, any>): Promise<{
        classification: TaskClassification;
        plan: ExecutionPlan;
    }>;
    execute(userRequest: string, context?: Record<string, any>): Promise<{
        response: string;
        metadata: {
            modelUsed: string;
            tier: number;
            executionTime: number;
            tokensUsed: number;
            classification: TaskClassification;
            fallbackUsed: boolean;
        };
    }>;
    executeParallel(requests: Array<{
        request: string;
        priority: 'low' | 'medium' | 'high';
        context?: Record<string, any>;
    }>): Promise<Array<{
        request: string;
        response: string;
        metadata: unknown;
        index: number;
    }>>;
    adaptiveExecute(userRequest: string, context?: Record<string, any>): Promise<any>;
    private classifyTask;
    private createExecutionPlan;
    private selectBestModelFromTier;
    private getFallbackModels;
    private heuristicClassification;
    private getOptimalTemperature;
    private executeWithConcurrencyControl;
    private updateModelPerformance;
    private getCurrentSystemLoad;
    private getAvailableModels;
    private startPerformanceMonitoring;
    private getAveragePerformance;
    getSystemStatus(): {
        tiers: Array<{
            tier: number;
            models: string[];
            avgResponseTime: number;
        }>;
        performance: Record<string, any>;
        totalModels: number;
    };
}
export declare const multiTierLLM: MultiTierLLMService;
export default multiTierLLM;
//# sourceMappingURL=multi-tier-llm-service.d.ts.map
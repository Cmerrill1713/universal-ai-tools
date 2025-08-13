export interface FastRoutingDecision {
    shouldUseLocal: boolean;
    targetService: 'lfm2' | 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
    reasoning: string;
    complexity: 'simple' | 'medium' | 'complex';
    estimatedTokens: number;
    priority: number;
}
export interface CoordinationContext {
    taskType: string;
    complexity: string;
    urgency: 'low' | 'medium' | 'high';
    expectedResponseLength: 'short' | 'medium' | 'long';
    requiresCreativity: boolean;
    requiresAccuracy: boolean;
}
export declare class FastLLMCoordinator {
    private lfm2Available;
    private kokoroAvailable;
    private lmStudioUrl;
    private lmStudioAvailable;
    constructor();
    private initializeFastModels;
    checkLmStudioHealth(): Promise<boolean>;
    isLmStudioAvailable(): boolean;
    makeRoutingDecision(userRequest: string, context: CoordinationContext): Promise<FastRoutingDecision>;
    executeWithCoordination(userRequest: string, context: CoordinationContext): Promise<{
        response: unknown;
        metadata: {
            routingDecision: FastRoutingDecision;
            executionTime: number;
            tokensUsed: number;
            serviceUsed: string;
        };
    }>;
    private queryLFM2;
    private executeLFM2;
    private executeOllama;
    private executeLMStudio;
    optimizeWithDSPy(taskType: string, examples: Array<{
        input: string;
        expectedOutput: string;
    }>): Promise<{
        optimizedPrompt: string;
        confidence: number;
        iterations: number;
    }>;
    coordinateMultipleAgents(primaryTask: string, supportingTasks: string[]): Promise<{
        primary: unknown;
        supporting: unknown[];
        coordination: {
            totalTime: number;
            fastDecisions: number;
            servicesUsed: string[];
        };
    }>;
    private executeBasedOnDecision;
    private estimateComplexity;
    private getFallbackDecision;
    getSystemStatus(): {
        fastModels: {
            lfm2: boolean;
            kokoro: boolean;
        };
        services: {
            ollama: boolean;
            lmStudio: boolean;
        };
        performance: {
            averageRoutingTime: number;
        };
    };
}
export declare const fastCoordinator: FastLLMCoordinator;
export default fastCoordinator;
//# sourceMappingURL=fast-llm-coordinator.d.ts.map
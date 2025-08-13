import type { CoordinationContext, FastRoutingDecision } from './fast-llm-coordinator';
export interface DSPyOptimization {
    task: string;
    originalPrompt: string;
    optimizedPrompt: string;
    performanceGain: number;
    confidence: number;
    iterations: number;
    examples: OptimizationExample[];
}
export interface OptimizationExample {
    input: string;
    expectedOutput: string;
    actualOutput?: string;
    score?: number;
}
export interface FastModelMetrics {
    avgResponseTime: number;
    accuracy: number;
    tokenEfficiency: number;
    routingAccuracy: number;
}
export declare class DSPyFastOptimizer {
    private optimizations;
    private metrics;
    private trainingExamples;
    constructor();
    private initializeOptimizer;
    optimizeRouting(examples: Array<{
        userRequest: string;
        context: CoordinationContext;
        expectedService: string;
        actualPerformance: number;
    }>): Promise<DSPyOptimization>;
    optimizeLFM2Responses(taskType: string, examples: OptimizationExample[]): Promise<DSPyOptimization>;
    adaptiveOptimization(userRequest: string, context: CoordinationContext, actualDecision: FastRoutingDecision, userFeedback: {
        satisfied: boolean;
        responseTime: number;
        accuracy: number;
        suggestions?: string;
    }): Promise<void>;
    benchmarkServices(testRequests: string[]): Promise<{
        lfm2: FastModelMetrics;
        ollama: FastModelMetrics;
        lmStudio: FastModelMetrics;
        recommendations: string[];
    }>;
    autoTuneSystem(): Promise<{
        optimizationsApplied: number;
        performanceImprovement: number;
        recommendations: string[];
    }>;
    private createRoutingOptimizationPrompt;
    private createResponseOptimizationPrompt;
    private runDSPyOptimization;
    private initializeTrainingExamples;
    private updateMetrics;
    private generatePerformanceRecommendations;
    private loadOptimizations;
    getOptimizationStatus(): {
        totalOptimizations: number;
        avgPerformanceGain: number;
        topPerformingTasks: string[];
    };
}
export declare const dspyFastOptimizer: DSPyFastOptimizer;
export default dspyFastOptimizer;
//# sourceMappingURL=dspy-fast-optimizer.d.ts.map
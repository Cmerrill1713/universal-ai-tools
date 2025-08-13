export interface EvolutionMetrics {
    agentName: string;
    successRate: number;
    averageResponseTime: number;
    userSatisfaction: number;
    taskComplexityHandled: string;
    improvementSuggestions: string[];
    lastEvolution: Date;
}
export interface EvolutionPlan {
    targetAgent: string;
    evolutionType: 'prompt_optimization' | 'tier_adjustment' | 'capability_expansion' | 'performance_tuning';
    changes: {
        before: unknown;
        after: unknown;
        reasoning: string;
    };
    expectedImprovement: number;
    riskLevel: 'low' | 'medium' | 'high';
    rollbackPlan: string;
}
export interface SystemEvolution {
    timestamp: Date;
    evolutionId: string;
    changes: EvolutionPlan[];
    overallImprovement: number;
    performanceGains: Record<string, number>;
    newCapabilities: string[];
}
export declare class AlphaEvolveService {
    private evolutionHistory;
    private agentMetrics;
    private evolutionEnabled;
    private evolutionRate;
    private confidenceThreshold;
    constructor();
    analyzeAgentPerformance(agentName: string, performanceData: {
        successRate: number;
        responseTime: number;
        userFeedback: Array<{
            rating: number;
            comment: string;
        }>;
        taskTypes: string[];
        errors: string[];
    }): Promise<EvolutionPlan[]>;
    evolveAgent(agentName: string, evolutionPlan: EvolutionPlan): Promise<{
        success: boolean;
        changes: unknown;
        rollbackInfo: unknown;
        newCapabilities: string[];
    }>;
    evolveArchitecture(): Promise<SystemEvolution>;
    learnFromInteraction(agentName: string, interaction: {
        userRequest: string;
        agentResponse: string;
        userFeedback?: number;
        wasSuccessful: boolean;
        responseTime: number;
        tokensUsed: number;
    }): Promise<void>;
    private startEvolutionCycle;
    private runEvolutionCycle;
    private shouldEvolveAgent;
    private shouldEvolveArchitecture;
    private getEvolutionInterval;
    private getMaxEvolutionsPerCycle;
    private calculateSatisfaction;
    private parseEvolutionAnalysis;
    private parseArchitecturalEvolution;
    private getDefaultEvolutionPlan;
    private createRollbackSnapshot;
    private optimizeAgentPrompt;
    private adjustAgentTier;
    private expandAgentCapabilities;
    private tuneAgentPerformance;
    private updateAgentMetrics;
    private getSystemMetrics;
    private applyLearningInsights;
    private storeBasicInteractionMetrics;
    getEvolutionStatus(): {
        enabled: boolean;
        rate: string;
        agentsTracked: number;
        evolutionsCompleted: number;
        lastEvolution: Date | null;
    };
}
export declare const alphaEvolve: AlphaEvolveService;
export default alphaEvolve;
//# sourceMappingURL=alpha-evolve-service.d.ts.map
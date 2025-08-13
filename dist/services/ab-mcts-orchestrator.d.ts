import type { ABMCTSConfig, ABMCTSExecutionOptions, ABMCTSFeedback, ABMCTSSearchResult, ABMCTSVisualization, AgentContext, AgentResponse } from '@/types/ab-mcts';
export interface OrchestratorConfig extends Partial<ABMCTSConfig> {
    enableLearning: boolean;
    enableVisualization: boolean;
    fallbackToTraditional: boolean;
    parallelExecutions: number;
    budgetAllocation: {
        exploration: number;
        exploitation: number;
    };
}
export interface OrchestratorResult {
    response: AgentResponse;
    searchResult: ABMCTSSearchResult;
    executionPath: string[];
    totalTime: number;
    resourcesUsed: {
        agents: number;
        llmCalls: number;
        tokensUsed: number;
    };
    feedback?: ABMCTSFeedback;
}
export declare class ABMCTSOrchestrator {
    private config;
    private circuitBreaker;
    private activeSearches;
    private executionCache;
    private agentRegistry;
    constructor(config?: Partial<OrchestratorConfig>);
    orchestrate(context: AgentContext, options?: ABMCTSExecutionOptions): Promise<OrchestratorResult>;
    private executeOrchestration;
    private executeBestPath;
    private fallbackOrchestration;
    private getAvailableAgents;
    private calculateResourcesUsed;
    getVisualization(orchestrationId: string): Promise<ABMCTSVisualization | null>;
    processUserFeedback(orchestrationId: string, rating: number, comment?: string): Promise<void>;
    getStatistics(): {
        activeSearches: number;
        cachedResults: number;
        circuitBreakerState: string;
        averageSearchTime: number;
        successRate: number;
    };
    reset(): void;
    private getCacheKey;
    orchestrateParallel(contexts: AgentContext[], options?: ABMCTSExecutionOptions): Promise<OrchestratorResult[]>;
    getRecommendations(): Promise<string[]>;
    private getAgentPerformanceMetrics;
}
export declare const abMCTSOrchestrator: ABMCTSOrchestrator;
export default abMCTSOrchestrator;
//# sourceMappingURL=ab-mcts-orchestrator.d.ts.map
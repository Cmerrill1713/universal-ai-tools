import type { ABMCTSConfig, ABMCTSExecutionOptions, ABMCTSFeedback, ABMCTSSearchResult, AgentContext } from '../types/ab-mcts';
export declare class ABMCTSService {
    private config;
    private root;
    private nodeCache;
    private thompsonSelector;
    private adaptiveExplorer;
    private executionHistory;
    private checkpointVersion;
    constructor(config?: Partial<ABMCTSConfig>);
    search(initialContext: AgentContext, availableAgents: string[], options?: Partial<ABMCTSExecutionOptions>): Promise<ABMCTSSearchResult>;
    private select;
    private expand;
    private simulate;
    private backpropagate;
    private getBestResult;
    private getBestPath;
    private getAlternativePaths;
    private generateRecommendations;
    private createNode;
    private simulateAgentExecution;
    private calculateReward;
    processFeedback(feedback: ABMCTSFeedback): Promise<void>;
    private isSameContext;
    private getAgentType;
    private getTaskType;
    private selectRandomAgent;
    private calculateAverageDepth;
    private calculateBranchingFactor;
    private pruneCache;
    private saveCheckpoint;
    getVisualizationData(): unknown;
}
declare class ABMCTSOrchestrator {
    private service;
    constructor();
    orchestrate(context: AgentContext, options?: unknown): Promise<any>;
    orchestrateParallel(contexts: AgentContext[], options?: unknown): Promise<any[]>;
    processUserFeedback(id: string, rating: number, comment?: string): Promise<void>;
    getVisualization(id: string): Promise<any>;
    getStatistics(): unknown;
    getRecommendations(): Promise<string[]>;
    reset(): void;
}
export declare const abMCTSService: ABMCTSService;
export declare const abMCTSOrchestrator: ABMCTSOrchestrator;
export default abMCTSService;
//# sourceMappingURL=ab-mcts-service.d.ts.map
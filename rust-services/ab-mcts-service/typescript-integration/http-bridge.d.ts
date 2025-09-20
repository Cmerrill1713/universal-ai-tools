import { MCTSConfig, AgentContext, SearchOptions, SearchResult, QuickRecommendationResult, MCTSReward, PerformanceStats, HealthCheckResult, MCTSBridge as IMCTSBridge } from './types';
export declare class HttpMCTSBridge implements IMCTSBridge {
    private config?;
    private baseUrl;
    private initialized;
    private headers;
    constructor(baseUrl?: string, config?: MCTSConfig | undefined);
    initialize(): Promise<void>;
    isReady(): boolean;
    updateConfig(config: MCTSConfig): Promise<void>;
    reset(): Promise<void>;
    healthCheck(): Promise<HealthCheckResult>;
    generateSessionId(): string;
    searchOptimalAgents(context: AgentContext, availableAgents: string[], options?: SearchOptions): Promise<SearchResult>;
    recommendAgents(context: AgentContext, availableAgents: string[], maxRecommendations?: number): Promise<QuickRecommendationResult>;
    updateWithFeedback(sessionId: string, agentName: string, reward: MCTSReward): Promise<void>;
    getPerformanceStats(): Promise<PerformanceStats>;
    validateContext(context: AgentContext): boolean;
    getConfig(): MCTSConfig;
    private ensureInitialized;
    private getDefaultConfig;
    private parseMetric;
}
export declare function createHttpMCTSBridge(baseUrl?: string, config?: MCTSConfig): Promise<HttpMCTSBridge>;
export declare class MCTSBridge extends HttpMCTSBridge {
    constructor(config?: MCTSConfig);
    static createTestContext(task: string, sessionId?: string): AgentContext;
}
export { createHttpMCTSBridge as createMCTSBridge };
//# sourceMappingURL=http-bridge.d.ts.map
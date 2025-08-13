import { EventEmitter } from 'events';
export interface AgentCapability {
    name: string;
    description: string;
    inputSchema: object;
    outputSchema: object;
}
export interface AgentMetrics {
    totalRequests: number;
    successfulRequests: number;
    averageLatencyMs: number;
    lastExecuted?: Date;
    performanceScore: number;
}
export interface AgentConfig {
    name: string;
    description: string;
    priority: number;
    capabilities: AgentCapability[];
    maxLatencyMs: number;
    retryAttempts: number;
    dependencies: string[];
    memoryEnabled: boolean;
    category?: string;
    memoryConfig?: Record<string, unknown>;
}
export interface AgentContext {
    requestId: string;
    userId?: string;
    sessionId?: string;
    userRequest: string;
    previousContext?: Record<string, unknown>;
    systemState?: Record<string, unknown>;
    timestamp: Date;
    memoryContext?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
export interface AgentResponse<T = unknown> {
    success: boolean;
    data: T;
    reasoning: string;
    confidence: number;
    latencyMs: number;
    agentId: string;
    error?: string;
    nextActions?: string[];
    memoryUpdates?: Record<string, unknown>[];
    message?: string;
    metadata?: Record<string, unknown>;
}
export interface PartialAgentResponse<T = unknown> {
    success: boolean;
    data: T;
    reasoning: string;
    confidence: number;
    error?: string;
    nextActions?: string[];
    memoryUpdates?: Record<string, unknown>[];
    message?: string;
    metadata?: Record<string, unknown>;
}
export declare abstract class BaseAgent extends EventEmitter {
    config: AgentConfig;
    protected metrics: AgentMetrics;
    protected isInitialized: boolean;
    protected memoryCoordinator?: unknown;
    protected logger: unknown;
    constructor(config: AgentConfig);
    private setupLogger;
    private initializeMetrics;
    private setupEventListeners;
    initialize(memoryCoordinator?: unknown): Promise<void>;
    execute(context: AgentContext): Promise<AgentResponse>;
    private processWithTimeout;
    getStatus(): unknown;
    shutdown(): Promise<void>;
    protected abstract onInitialize(): Promise<void>;
    protected abstract process(context: AgentContext & {
        memoryContext?: unknown;
    }): Promise<PartialAgentResponse>;
    protected abstract onShutdown(): Promise<void>;
    protected loadMemory(): Promise<void>;
    protected retrieveMemory(context: AgentContext): Promise<any>;
    protected storeMemory(context: AgentContext, result: PartialAgentResponse): Promise<void>;
    protected onRequestStarted(event: unknown): void;
    protected onRequestCompleted(event: unknown): void;
    protected onRequestFailed(event: unknown): void;
    private updateMetrics;
    private calculatePerformanceScore;
    private calculateHealthScore;
}
export default BaseAgent;
//# sourceMappingURL=base_agent.d.ts.map
export interface LFM2Request {
    prompt: string;
    systemPrompt?: string;
    maxLength?: number;
    maxTokens?: number;
    temperature?: number;
    taskType: 'routing' | 'coordination' | 'simple_qa' | 'classification';
}
export interface LFM2Response {
    content: string;
    tokens: number;
    executionTime: number;
    model: string;
    confidence?: number;
}
export interface LFM2Metrics {
    avgResponseTime: number;
    totalRequests: number;
    successRate: number;
    tokenThroughput: number;
}
export declare class LFM2BridgeService {
    private pythonProcess;
    private isInitialized;
    private requestQueue;
    private pendingRequests;
    private metrics;
    private MAX_PENDING;
    private REQUEST_TIMEOUT_MS;
    private MAX_CONCURRENCY;
    private MAX_TOKENS;
    private MAX_PROMPT_CHARS;
    private activeCount;
    constructor();
    private initializeLFM2;
    private initializeMockLFM2;
    routingDecision(userRequest: string, context: Record<string, any>): Promise<{
        targetService: 'lfm2' | 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
        confidence: number;
        reasoning: string;
        estimatedTokens: number;
    }>;
    quickResponse(userRequest: string, taskType?: 'classification' | 'simple_qa'): Promise<LFM2Response>;
    coordinateAgents(primaryTask: string, supportingTasks: string[]): Promise<{
        execution_plan: {
            primary_priority: number;
            supporting_priorities: number[];
            parallel_execution: boolean;
            estimated_total_time: number;
        };
        resource_allocation: {
            primary_service: string;
            supporting_services: string[];
        };
    }>;
    generate(request: LFM2Request): Promise<LFM2Response>;
    generateBatch(requests: LFM2Request[]): Promise<LFM2Response[]>;
    private handlePythonResponse;
    private dequeueNext;
    private createRoutingPrompt;
    private createQuickResponsePrompt;
    private createCoordinationPrompt;
    private parseRoutingResponse;
    private parseCoordinationResponse;
    private generateMockResponse;
    private generateRequestId;
    private updateMetrics;
    private restartProcess;
    getMetrics(): LFM2Metrics & {
        isInitialized: boolean;
    };
    isAvailable(): boolean;
    shutdown(): Promise<void>;
    updateLimits(options: Partial<{
        maxPending: number;
        timeoutMs: number;
        maxConcurrency: number;
        maxTokens: number;
        maxPromptChars: number;
    }>): void;
}
declare class SafeLFM2Bridge {
    private instance;
    private initAttempted;
    private circuitBreaker;
    constructor();
    quickResponse(userRequest: string, taskType?: 'classification' | 'simple_qa'): Promise<LFM2Response>;
    execute(request: LFM2Request): Promise<LFM2Response>;
    private createFallbackResponse;
    isAvailable(): boolean;
    getMetrics(): (LFM2Metrics & {
        isInitialized: boolean;
    }) | {
        avgResponseTime: number;
        totalRequests: number;
        successRate: number;
        tokenThroughput: number;
    };
    routingDecision(userRequest: string, context: Record<string, any>): Promise<{
        targetService: 'lfm2' | 'ollama' | 'lm-studio' | 'openai' | 'anthropic';
        confidence: number;
        reasoning: string;
        estimatedTokens: number;
    }>;
    shutdown(): void;
    restart(): Promise<void>;
    setLimits(options: Partial<{
        maxPending: number;
        timeoutMs: number;
        maxConcurrency: number;
        maxTokens: number;
        maxPromptChars: number;
    }>): void;
    getCircuitBreakerMetrics(): import("@/utils/circuit-breaker").CircuitBreakerMetrics;
}
export declare const lfm2Bridge: SafeLFM2Bridge;
export default lfm2Bridge;
//# sourceMappingURL=lfm2-bridge.d.ts.map
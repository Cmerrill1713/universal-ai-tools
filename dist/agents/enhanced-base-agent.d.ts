import { z } from 'zod';
import { type LLMMessage } from '@/services/llm-router-service';
import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import type { ABMCTSFeedback, ABMCTSReward } from '@/types/ab-mcts';
import { type ValidatedAgentResponse } from '@/utils/validation';
export declare abstract class EnhancedBaseAgent {
    protected config: AgentConfig;
    protected isInitialized: boolean;
    protected conversationHistory: LLMMessage[];
    protected systemPrompt: string;
    protected executionHistory: Array<{
        context: AgentContext;
        response: AgentResponse;
        reward: ABMCTSReward;
        timestamp: number;
    }>;
    protected performanceDistribution: {
        alpha: number;
        beta: number;
    };
    protected dynamicSpawnCount: number;
    protected performanceMetrics: {
        totalCalls: number;
        successRate: number;
        averageExecutionTime: number;
        averageConfidence: number;
        lastUsed: Date | null;
    };
    constructor(config: AgentConfig);
    getName(): string;
    getDescription(): string;
    getCapabilities(): string[];
    getPriority(): number;
    protected abstract buildSystemPrompt(): string;
    protected abstract getInternalModelName(): string;
    initialize(): Promise<void>;
    execute(context: AgentContext): Promise<AgentResponse>;
    protected buildMessages(context: AgentContext): LLMMessage[];
    protected buildContextualRequest(context: AgentContext): string;
    protected getAdditionalContext(_context: AgentContext): string | null;
    protected processLLMResponse(llmResponse: unknown, context: AgentContext): Promise<AgentResponse>;
    protected calculateConfidence(llmResponse: unknown, _context: AgentContext): number;
    protected updateConversationHistory(userMessage: string, assistantMessage: string): void;
    protected getTemperature(): number;
    protected getMaxTokens(): number;
    shutdown(): Promise<void>;
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    protected validateContext(context: AgentContext): void;
    protected createSuccessResponse(data: unknown, message: string, confidence?: number, reasoning?: string, metadata?: Record<string, unknown>): AgentResponse;
    protected createErrorResponse(message: string, reasoning?: string, metadata?: Record<string, unknown>): AgentResponse;
    protected createValidatedSuccessResponse<T>(data: T, message: string, confidence?: number, reasoning?: string, dataSchema?: z.ZodSchema<T>): ValidatedAgentResponse<T>;
    protected createValidatedErrorResponse<T = null>(message: string, reasoning?: string, _metadata?: Record<string, unknown>): ValidatedAgentResponse<T>;
    executeValidated<T>(context: AgentContext, dataSchema?: z.ZodSchema<T>): Promise<ValidatedAgentResponse<T>>;
    executeBatchValidated<T>(contexts: AgentContext[], dataSchema?: z.ZodSchema<T>): Promise<ValidatedAgentResponse<T>[]>;
    getConversationHistory(): LLMMessage[];
    clearConversationHistory(): void;
    getProbabilisticScore(context: AgentContext): number;
    updatePerformance(context: AgentContext, response: AgentResponse, feedback: ABMCTSFeedback): void;
    getSuccessRate(): number;
    getConfidenceInterval(confidence?: number): [number, number];
    shouldSpawnVariant(): boolean;
    spawnVariant(): Promise<EnhancedBaseAgent | null>;
    getPerformanceMetrics(): {
        totalCalls: number;
        successRate: number;
        averageExecutionTime: number;
        averageConfidence: number;
        lastUsed: Date | null;
    };
    getDetailedPerformanceMetrics(): {
        successRate: number;
        confidenceInterval: [number, number];
        executionCount: number;
        averageReward: number;
        recentTrend: 'improving' | 'stable' | 'declining';
        spawnCount: number;
    };
    protected calculateReward(response: AgentResponse, executionTime: number, context: AgentContext): ABMCTSReward;
    private getTaskType;
    private calculateVariance;
    private calculateTrend;
    executeWithFeedback(context: AgentContext): Promise<{
        response: AgentResponse;
        feedback: ABMCTSFeedback;
    }>;
    protected getContextTypes(): string[];
    protected saveMCPContext(context: AgentContext, agentResponse: AgentResponse, _llmResponse: any): Promise<void>;
    private isCodeRelated;
    private extractPatternType;
}
export default EnhancedBaseAgent;
//# sourceMappingURL=enhanced-base-agent.d.ts.map
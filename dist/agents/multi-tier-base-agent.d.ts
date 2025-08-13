import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import { BaseAgent } from './base-agent';
export declare abstract class MultiTierBaseAgent extends BaseAgent {
    protected preferredTier: number;
    protected voiceEnabled: boolean;
    protected preferredVoice?: string;
    constructor(config: AgentConfig);
    protected process(context: AgentContext): Promise<AgentResponse>;
    protected abstract buildSystemPrompt(): string;
    protected buildUserPrompt(context: AgentContext): string;
    protected getDomain(): string;
    protected getAdditionalContext(context: AgentContext): string | null;
    protected parseAgentResponse(response: string): unknown;
    protected extractSummary(response: string): string;
    protected calculateTierConfidence(tier: number, executionTime: number, complexity: string): number;
    protected createErrorResponse(message: string, metadata: unknown): AgentResponse;
    enableVoice(voiceId?: string): void;
    setPreferredTier(tier: number): void;
    getPerformanceMetrics(): {
        averageExecutionTime: number;
        preferredTier: number;
        voiceEnabled: boolean;
        successRate: number;
    };
}
export default MultiTierBaseAgent;
//# sourceMappingURL=multi-tier-base-agent.d.ts.map
import type { AgentConfig, AgentContext } from '@/types';
import { MultiTierBaseAgent } from '../multi-tier-base-agent';
export declare class MultiTierPlannerAgent extends MultiTierBaseAgent {
    constructor(config: AgentConfig);
    protected buildSystemPrompt(): string;
    protected getDomain(): string;
    protected getAdditionalContext(context: AgentContext): string | null;
    private extractTimeConstraints;
    private extractResourceMentions;
    private assessComplexity;
    protected parseAgentResponse(response: string): unknown;
    private extractPlanFromText;
    private extractTitle;
    private extractOverview;
    private extractPhases;
    private extractRisks;
    private extractSuccessCriteria;
    private extractNextSteps;
    protected calculateTierConfidence(tier: number, executionTime: number, complexity: string): number;
}
export default MultiTierPlannerAgent;
//# sourceMappingURL=multi-tier-planner-agent.d.ts.map
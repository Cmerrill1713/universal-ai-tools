import type { AgentContext } from '@/types';
import { EnhancedBaseAgent } from '../enhanced-base-agent';
export declare class EnhancedPlannerAgent extends EnhancedBaseAgent {
    protected buildSystemPrompt(): string;
    protected getInternalModelName(): string;
    protected getTemperature(): number;
    protected getMaxTokens(): number;
    protected getAdditionalContext(context: AgentContext): string | null;
    private extractTimeConstraints;
    private extractResourceMentions;
    protected calculateConfidence(llmResponse: unknown, context: AgentContext): number;
}
export default EnhancedPlannerAgent;
//# sourceMappingURL=enhanced-planner-agent.d.ts.map
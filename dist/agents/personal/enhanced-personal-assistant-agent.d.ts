import type { AgentContext } from '@/types';
import { EnhancedBaseAgent } from '../enhanced-base-agent';
export declare class EnhancedPersonalAssistantAgent extends EnhancedBaseAgent {
    protected buildSystemPrompt(): string;
    protected getInternalModelName(): string;
    protected getTemperature(): number;
    protected getMaxTokens(): number;
    protected getAdditionalContext(context: AgentContext): string | null;
    private analyzeCommunicationStyle;
    private detectUrgency;
    private identifyTaskCategories;
    private detectEmotionalContext;
    private extractTimeContext;
    protected calculateConfidence(llmResponse: unknown, context: AgentContext): number;
}
export default EnhancedPersonalAssistantAgent;
//# sourceMappingURL=enhanced-personal-assistant-agent.d.ts.map
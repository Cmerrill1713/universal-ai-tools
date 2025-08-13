import type { AgentContext } from '@/types';
import { EnhancedBaseAgent } from '../enhanced-base-agent';
export declare class EnhancedSynthesizerAgent extends EnhancedBaseAgent {
    protected buildSystemPrompt(): string;
    protected getInternalModelName(): string;
    protected getTemperature(): number;
    protected getMaxTokens(): number;
    protected getAdditionalContext(context: AgentContext): string | null;
    private detectSynthesisType;
    private extractInformationSources;
    private identifyStakeholders;
    private extractDecisionContext;
    private extractSynthesisGoals;
    protected calculateConfidence(llmResponse: unknown, context: AgentContext): number;
}
export default EnhancedSynthesizerAgent;
//# sourceMappingURL=enhanced-synthesizer-agent.d.ts.map
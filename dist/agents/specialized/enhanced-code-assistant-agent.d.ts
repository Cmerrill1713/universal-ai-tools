import type { AgentContext } from '@/types';
import { EnhancedBaseAgent } from '../enhanced-base-agent';
export declare class EnhancedCodeAssistantAgent extends EnhancedBaseAgent {
    protected buildSystemPrompt(): string;
    protected getInternalModelName(): string;
    protected getTemperature(): number;
    protected getMaxTokens(): number;
    protected getAdditionalContext(context: AgentContext): string | null;
    private detectProgrammingLanguage;
    private identifyCodeRequestType;
    private extractTechnologies;
    private extractDesignPatterns;
    protected calculateConfidence(llmResponse: unknown, context: AgentContext): number;
}
export default EnhancedCodeAssistantAgent;
//# sourceMappingURL=enhanced-code-assistant-agent.d.ts.map
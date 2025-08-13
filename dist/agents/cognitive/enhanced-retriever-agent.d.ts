import type { AgentContext, AgentResponse } from '@/types';
import { EnhancedBaseAgent } from '../enhanced-base-agent';
export declare class EnhancedRetrieverAgent extends EnhancedBaseAgent {
    execute(context: AgentContext): Promise<AgentResponse>;
    private searchKnowledgeBase;
    private formatKnowledgeResults;
    private identifyRelevantCategories;
    protected buildSystemPrompt(): string;
    protected getInternalModelName(): string;
    protected getTemperature(): number;
    protected getMaxTokens(): number;
    protected getAdditionalContext(context: AgentContext): string | null;
    private extractSearchIntent;
    private identifyDomain;
    private extractInformationTypes;
    private extractScope;
    protected calculateConfidence(llmResponse: unknown, context: AgentContext): number;
}
export default EnhancedRetrieverAgent;
//# sourceMappingURL=enhanced-retriever-agent.d.ts.map
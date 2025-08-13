export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMResponse {
    content: string;
    model: string;
    provider: LLMProvider;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    metadata?: {
        duration_ms: number;
        confidence?: number;
        reasoning?: string;
    };
}
export declare enum LLMProvider {
    OPENAI = "openai",
    ANTHROPIC = "anthropic",
    OLLAMA = "ollama",
    INTERNAL = "internal"
}
export interface ModelConfig {
    internalName: string;
    provider: LLMProvider;
    externalModel: string;
    capabilities: string[];
    maxTokens: number;
    temperature: number;
    priority: number;
}
export declare class LLMRouterService {
    private modelConfigs;
    private providerClients;
    constructor();
    private initializeAsync;
    private initializeModelConfigs;
    private generateDynamicConfigs;
    private getFallbackConfigs;
    private initializeProviders;
    generateResponse(internalModel: string, messages: LLMMessage[], options?: {
        temperature?: number;
        maxTokens?: number;
        capabilities?: string[];
        includeContext?: boolean;
        contextTypes?: string[];
        userId?: string;
        requestId?: string;
    }): Promise<LLMResponse>;
    private routeToProvider;
    private callOpenAI;
    private callAnthropic;
    private callOllama;
    private findBestModelForCapabilities;
    private findFallbackModel;
    getAvailableModels(): string[];
    getModelCapabilities(internalModel: string): string[];
    getProviderStatus(): Record<LLMProvider, boolean>;
    private enhanceMessagesWithMCPContext;
    private extractUserInputFromMessages;
    private estimateContextTokens;
    private filterContextByRelevance;
    private formatContextForInjection;
}
export declare const llmRouter: LLMRouterService;
export default llmRouter;
//# sourceMappingURL=llm-router-service.d.ts.map
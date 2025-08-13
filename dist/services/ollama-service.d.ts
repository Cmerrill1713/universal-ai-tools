export interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface OllamaResponse {
    model: string;
    created_at: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}
export interface OllamaStreamResponse {
    model: string;
    created_at: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
}
export declare class OllamaService {
    private baseUrl;
    private defaultModel;
    private isAvailable;
    private breaker;
    constructor();
    private checkAvailability;
    generateResponse(messages: OllamaMessage[], model?: string, options?: {
        temperature?: number;
        max_tokens?: number;
        stream?: boolean;
    }): Promise<OllamaResponse>;
    generateSimpleResponse(params: {
        model: string;
        prompt: string;
        options?: {
            temperature?: number;
            num_predict?: number;
            format?: string;
        };
    }): Promise<{
        response: string;
        model: string;
        eval_count?: number;
        eval_duration?: number;
        total_duration?: number;
    }>;
    generateStreamResponse(messages: OllamaMessage[], model?: string, onChunk?: (chunk: OllamaStreamResponse) => void): Promise<string>;
    getAvailableModels(): Promise<string[]>;
    isServiceAvailable(): boolean;
    getDefaultModel(): string;
    pullModel(modelName: string): Promise<void>;
}
export declare const ollamaService: OllamaService;
export default ollamaService;
//# sourceMappingURL=ollama-service.d.ts.map
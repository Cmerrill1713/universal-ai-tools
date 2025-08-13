export interface HuggingFaceConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
}
export interface TextGenerationRequest {
    inputs: string;
    parameters?: {
        max_new_tokens?: number;
        temperature?: number;
        top_p?: number;
        top_k?: number;
        repetition_penalty?: number;
        do_sample?: boolean;
        return_full_text?: boolean;
    };
    model?: string;
}
export interface EmbeddingRequest {
    inputs: string | string[];
    model?: string;
}
export interface QuestionAnsweringRequest {
    question: string;
    context: string;
    model?: string;
}
export interface SummarizationRequest {
    inputs: string;
    parameters?: {
        max_length?: number;
        min_length?: number;
        do_sample?: boolean;
        temperature?: number;
    };
    model?: string;
}
export interface HuggingFaceMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    modelsUsed: Set<string>;
    lastRequestTime: number;
}
export declare class HuggingFaceService {
    private hf;
    private metrics;
    private isInitialized;
    private circuitBreaker;
    private defaultModels;
    constructor(config: HuggingFaceConfig);
    private initialize;
    private testConnection;
    generateText(request: TextGenerationRequest): Promise<any>;
    generateEmbeddings(request: EmbeddingRequest): Promise<any>;
    answerQuestion(request: QuestionAnsweringRequest): Promise<any>;
    summarizeText(request: SummarizationRequest): Promise<any>;
    analyzeSentiment(text: string, model?: string): Promise<any>;
    listModels(task?: string): Promise<any>;
    getMetrics(): HuggingFaceMetrics & {
        isInitialized: boolean;
    };
    private updateMetrics;
    healthCheck(): Promise<any>;
    shutdown(): Promise<void>;
}
export declare const huggingFaceService: HuggingFaceService | null;
export default huggingFaceService;
//# sourceMappingURL=huggingface-service.d.ts.map
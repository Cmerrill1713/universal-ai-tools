export declare class HuggingFaceToLMStudioAdapter {
    private baseUrl;
    constructor();
    generateText(request: {
        inputs: string;
        parameters?: {
            max_new_tokens?: number;
            temperature?: number;
            top_p?: number;
            do_sample?: boolean;
        };
        model?: string;
    }): Promise<any>;
    generateEmbeddings(request: {
        inputs: string | string[];
        model?: string;
    }): Promise<any>;
    summarizeText(request: {
        inputs: string;
        parameters?: {
            max_length?: number;
            min_length?: number;
            temperature?: number;
        };
        model?: string;
    }): Promise<any>;
    analyzeSentiment(text: string, model?: string): Promise<any>;
    answerQuestion(request: {
        question: string;
        context: string;
        model?: string;
    }): Promise<any>;
    healthCheck(): Promise<any>;
    getMetrics(): {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        averageResponseTime: number;
        modelsUsed: Set<string>;
        lastRequestTime: number;
    };
    listModels(): Promise<string[]>;
}
export declare const huggingFaceService: HuggingFaceToLMStudioAdapter | null;
//# sourceMappingURL=huggingface-to-lmstudio.d.ts.map
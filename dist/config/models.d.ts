export declare const ModelConfig: {
    vision: {
        multimodal: string;
        analysis: string;
        embedding: string;
    };
    text: {
        routing: string;
        small: string;
        medium: string;
        large: string;
        code: string;
        reasoning: string;
    };
    embedding: {
        text: string;
        vision: string;
    };
    imageGeneration: {
        sdxl: string;
        sdxlRefiner: string;
        flux: string;
    };
    specialized: {
        math: string;
        medical: string;
        finance: string;
    };
    lmStudio: {
        enabled: boolean;
        url: string;
        models: {
            textGeneration: string;
            embedding: string;
            summarization: string;
            sentiment: string;
        };
    };
    routing: {
        preferLocal: boolean;
        fallbackEnabled: boolean;
        maxRetries: number;
        lfm2Endpoint: string;
    };
    lfm2: {
        enabled: boolean;
        serverUrl: string;
        modelPath: string;
        useForRouting: boolean;
        useForSimpleQueries: boolean;
    };
};
export declare function getModelForTask(taskType: string, requirements?: {
    speed?: 'fast' | 'balanced' | 'quality';
    capabilities?: string[];
    maxTokens?: number;
}): string;
export declare function isModelAvailable(model: string): Promise<boolean>;
//# sourceMappingURL=models.d.ts.map
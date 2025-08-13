interface RerankCandidate {
    id: string;
    content: string;
    metadata?: Record<string, any>;
    biEncoderScore: number;
}
interface RerankResult {
    id: string;
    content: string;
    metadata?: Record<string, any>;
    biEncoderScore: number;
    crossEncoderScore: number;
    finalScore: number;
}
export declare class RerankingService {
    private supabase;
    private models;
    private activeModel;
    constructor();
    rerank(query: string, candidates: RerankCandidate[], options?: {
        topK?: number;
        model?: string;
        threshold?: number;
    }): Promise<RerankResult[]>;
    private rerankBatch;
    private rerankWithHuggingFace;
    private rerankWithOpenAI;
    private rerankWithLocal;
    private combineBiAndCrossEncoderScores;
    private cosineSimilarity;
    private calculateWordOverlap;
    private storeRerankingMetrics;
    getRerankingStats(): Promise<{
        totalQueries: number;
        averageReductionRate: number;
        modelUsage: Record<string, number>;
    }>;
}
export declare const rerankingService: RerankingService;
export {};
//# sourceMappingURL=reranking-service.d.ts.map
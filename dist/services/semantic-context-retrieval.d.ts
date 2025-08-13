interface SemanticSearchOptions {
    query: string;
    userId: string;
    maxResults?: number;
    minRelevanceScore?: number;
    contextTypes?: ContextType[];
    timeWindow?: number;
    projectPath?: string;
    sessionId?: string;
    includeEmbeddings?: boolean;
    fuseSimilarResults?: boolean;
}
interface ContextType {
    type: 'conversation' | 'code' | 'documentation' | 'error' | 'summary' | 'knowledge';
    weight: number;
}
interface SemanticResult {
    id: string;
    content: string;
    contentType: string;
    source: string;
    relevanceScore: number;
    semanticScore: number;
    temporalScore: number;
    contextScore: number;
    combinedScore: number;
    embedding?: number[];
    metadata: {
        timestamp: Date;
        userId: string;
        projectPath?: string;
        sessionId?: string;
        tags: string[];
        topics: string[];
        wordCount: number;
        tokenCount: number;
    };
}
interface ClusteredResults {
    clusters: ContextCluster[];
    outliers: SemanticResult[];
    totalResults: number;
}
interface ContextCluster {
    id: string;
    topic: string;
    results: SemanticResult[];
    averageScore: number;
    centroid?: number[];
    summary: string;
}
interface RetrievalMetrics {
    searchTimeMs: number;
    totalResults: number;
    clusteredResults: number;
    averageRelevance: number;
    topicCoverage: number;
    embeddingComputeTime: number;
    databaseQueryTime: number;
}
export declare class SemanticContextRetrievalService {
    private supabase;
    private embeddingCache;
    private readonly EMBEDDING_CACHE_TTL;
    private readonly DEFAULT_EMBEDDING_MODEL;
    private readonly similarityThreshold;
    private readonly MAX_CACHE_SIZE;
    private readonly SCORING_WEIGHTS;
    constructor();
    semanticSearch(options: SemanticSearchOptions): Promise<{
        results: SemanticResult[];
        clusters: ClusteredResults;
        metrics: RetrievalMetrics;
    }>;
    private searchStoredContext;
    private searchConversationHistory;
    private searchKnowledgeBase;
    private searchContextSummaries;
    private getQueryEmbedding;
    private getContentEmbedding;
    private generateEmbedding;
    private generateFallbackEmbedding;
    private simpleHash;
    private cosineSimilarity;
    private calculateTemporalScore;
    private calculateContextualScore;
    private calculateContextualScoreFromMetadata;
    private calculateImportanceScore;
    private combineScores;
    private clusterResults;
    private fuseSimilarResults;
    private calculateTopicSimilarity;
    private calculateContentSimilarity;
    private extractPrimaryTopic;
    private createClusterSummary;
    private fuseContent;
    private extractTags;
    private extractTopics;
    private createCacheKey;
    private cacheEmbedding;
    private fallbackTextSearch;
    clearCache(): void;
    getCacheStats(): {
        size: number;
        hitRate: number;
        memoryUsage: number;
    };
}
export declare const semanticContextRetrievalService: SemanticContextRetrievalService;
export default semanticContextRetrievalService;
//# sourceMappingURL=semantic-context-retrieval.d.ts.map
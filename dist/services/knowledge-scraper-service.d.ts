interface ScrapingSource {
    name: string;
    type: 'api' | 'web' | 'dump';
    url: string;
    rateLimit: number;
    parser: (data: any) => KnowledgeEntry[];
    enabled: boolean;
}
interface KnowledgeEntry {
    source: string;
    category: string;
    title: string;
    content: string;
    metadata: Record<string, any>;
    embedding?: number[];
    timestamp: Date;
}
export declare class KnowledgeScraperService {
    private supabase;
    private sources;
    private readonly allowedHosts;
    private limiters;
    constructor();
    scrapeAllSources(options?: {
        categories?: string[];
        limit?: number;
        updateExisting?: boolean;
    }): Promise<void>;
    scrapeSource(source: ScrapingSource, options?: {
        categories?: string[];
        limit?: number;
        updateExisting?: boolean;
    }): Promise<void>;
    storeKnowledge(entries: KnowledgeEntry[], updateExisting: boolean): Promise<void>;
    generateEmbedding(content: string): Promise<number[]>;
    private parseMDN;
    private parseStackOverflow;
    private parsePapersWithCode;
    private parseHuggingFace;
    private parseDevDocs;
    searchKnowledge(query: string, options?: {
        sources?: string[];
        categories?: string[];
        limit?: number;
        useReranking?: boolean;
        rerankingModel?: string;
    }): Promise<KnowledgeEntry[]>;
    getScrapingStatus(): Promise<{
        sources: Array<{
            name: string;
            enabled: boolean;
            lastScraped?: Date;
            entryCount?: number;
        }>;
        totalEntries: number;
    }>;
}
export declare const knowledgeScraperService: KnowledgeScraperService;
export {};
//# sourceMappingURL=knowledge-scraper-service.d.ts.map
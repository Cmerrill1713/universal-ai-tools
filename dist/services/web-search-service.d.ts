export interface WebResult {
    title: string;
    url: string;
    snippet?: string;
}
export declare class WebSearchService {
    private cache;
    private lastFailureAt;
    private failureBackoffMs;
    private ttlMs;
    private getCacheKey;
    private setCache;
    private getCached;
    private dedupe;
    searchDuckDuckGo(query: string, limit?: number): Promise<WebResult[]>;
    searchWikipedia(query: string, limit?: number): Promise<WebResult[]>;
}
export declare const webSearchService: WebSearchService;
//# sourceMappingURL=web-search-service.d.ts.map
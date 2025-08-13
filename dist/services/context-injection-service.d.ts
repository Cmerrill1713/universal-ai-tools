interface ProjectContext {
    workingDirectory?: string;
    userId?: string;
    currentProject?: string;
    sessionId?: string;
    includeArchitecturePatterns?: boolean;
    metadata?: Record<string, any>;
}
export declare class ContextInjectionService {
    private supabase;
    private maxContextTokens;
    private contextCache;
    private cacheExpiryMs;
    private securityFilters;
    constructor();
    enrichWithContext(userRequest: string, projectContext: ProjectContext): Promise<{
        enrichedPrompt: string;
        contextSummary: string;
        sourcesUsed: string[];
        securityWarnings?: string[];
    }>;
    private sanitizeAndValidateInput;
    private filterSensitiveContent;
    private buildEnrichedContext;
    private getRelevantKnowledge;
    private getSecureTextSearchResults;
    private getProjectInfo;
    private getRecentConversations;
    private getCodeContext;
    private buildEnrichedPrompt;
    private buildFallbackPrompt;
    private buildCacheKey;
    private getCachedContext;
    private cacheContext;
    private estimateTokens;
    private determineContentType;
    private createContextSummary;
    private extractSources;
    private getArchitecturePatterns;
    private assessTaskComplexity;
    clearCache(): void;
    getCacheStats(): {
        size: number;
        hitRate: number;
    };
}
export declare const contextInjectionService: ContextInjectionService;
export default contextInjectionService;
//# sourceMappingURL=context-injection-service.d.ts.map
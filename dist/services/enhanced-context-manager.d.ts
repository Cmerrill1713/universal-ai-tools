interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    tokens: number;
    importance: number;
    metadata?: Record<string, any>;
}
interface ContextSummary {
    content: string;
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    keyPoints: string[];
    preservedMessages: number;
    timestamp: Date;
}
interface ContextRetrievalOptions {
    maxTokens?: number;
    relevanceThreshold?: number;
    includeRecentMessages?: boolean;
    includeSummaries?: boolean;
    timeWindow?: number;
    topicFilter?: string[];
}
export declare class EnhancedContextManager {
    private supabase;
    private activeContexts;
    private readonly MAX_ACTIVE_CONTEXTS;
    private readonly DEFAULT_TOKEN_LIMIT;
    private readonly COMPRESSION_TRIGGER;
    private readonly PERSISTENCE_TRIGGER;
    private readonly CLEANUP_INTERVAL;
    private readonly MAX_TOKENS_PER_SESSION;
    private readonly MAX_MESSAGES_PER_SESSION;
    private readonly SESSION_ISOLATION_ENABLED;
    private readonly IMPORTANCE_WEIGHTS;
    private cleanupTimer?;
    constructor();
    addMessage(sessionId: string, message: Omit<ConversationMessage, 'timestamp' | 'tokens' | 'importance'>): Promise<{
        contextId: string;
        shouldCompress: boolean;
        tokenCount: number;
    }>;
    getRelevantContext(sessionId: string, userId: string, options?: ContextRetrievalOptions): Promise<{
        messages: ConversationMessage[];
        summaries: ContextSummary[];
        totalTokens: number;
        source: 'memory' | 'database' | 'hybrid';
    }>;
    private compressContext;
    private createMessageSummary;
    private extractKeyPoints;
    private extractTopics;
    private persistContextToDatabase;
    private storeContextSummary;
    private loadContextFromDatabase;
    private searchDatabaseContext;
    private getContextSummaries;
    private selectMessagesByTokenBudget;
    private initializeContext;
    private calculateMessageImportance;
    private getContextId;
    private estimateTokens;
    private startBackgroundCleanup;
    private performBackgroundCleanup;
    getStats(): {
        activeContexts: number;
        totalMessages: number;
        totalTokens: number;
        averageCompression: number;
    };
    compressContextById(contextId: string): Promise<boolean>;
    persistContextById(contextId: string): Promise<boolean>;
    clearActiveContexts(): void;
    shutdown(): void;
}
export declare const enhancedContextManager: EnhancedContextManager;
export default enhancedContextManager;
//# sourceMappingURL=enhanced-context-manager.d.ts.map
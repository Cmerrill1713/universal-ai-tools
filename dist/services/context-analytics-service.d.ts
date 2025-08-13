interface ContextMetrics {
    timestamp: Date;
    totalContexts: number;
    totalMessages: number;
    totalTokens: number;
    compressionRatio: number;
    activeUsers: number;
    activeSessions: number;
    averageContextSize: number;
    retrievalResponseTime: number;
    cacheHitRate: number;
    databaseSize: number;
}
interface UserAnalytics {
    userId: string;
    sessionCount: number;
    messageCount: number;
    totalTokens: number;
    contextCompressions: number;
    averageSessionDuration: number;
    lastActivity: Date;
    topTopics: string[];
    efficiency: {
        compressionSavings: number;
        retrievalAccuracy: number;
        contextRelevance: number;
    };
}
interface CompressionAnalytics {
    totalCompressions: number;
    averageCompressionRatio: number;
    tokensSaved: number;
    compressionsByType: Record<string, number>;
    compressionTrends: Array<{
        date: Date;
        compressions: number;
        ratio: number;
        tokensSaved: number;
    }>;
}
interface RetrievalAnalytics {
    totalQueries: number;
    averageResponseTime: number;
    averageResults: number;
    averageRelevance: number;
    cacheHitRate: number;
    semanticSearchUsage: number;
    fallbackRate: number;
    topQueryTypes: Record<string, number>;
}
interface SystemHealthMetrics {
    contextManager: {
        status: 'healthy' | 'warning' | 'critical';
        activeContexts: number;
        memoryUsage: number;
        compressionBacklog: number;
    };
    semanticRetrieval: {
        status: 'healthy' | 'warning' | 'critical';
        cacheSize: number;
        embeddingFailures: number;
        averageQueryTime: number;
    };
    database: {
        status: 'healthy' | 'warning' | 'critical';
        totalRecords: number;
        storageSize: number;
        queryPerformance: number;
    };
    middleware: {
        status: 'healthy' | 'warning' | 'critical';
        activeSessions: number;
        requestsPerMinute: number;
        errorRate: number;
    };
}
interface CostOptimization {
    potentialSavings: {
        tokenCompressionSavings: number;
        storageOptimization: number;
        cacheEfficiency: number;
    };
    recommendations: Array<{
        type: 'compression' | 'storage' | 'retrieval' | 'caching';
        impact: 'high' | 'medium' | 'low';
        description: string;
        estimatedSavings: number;
    }>;
}
export declare class ContextAnalyticsService {
    private supabase;
    private metricsHistory;
    private readonly MAX_HISTORY_SIZE;
    private readonly COLLECTION_INTERVAL;
    private collectionTimer?;
    private queryResponseTimes;
    private compressionEvents;
    private retrievalEvents;
    constructor();
    getCurrentMetrics(): Promise<ContextMetrics>;
    getUserAnalytics(userId: string, timeWindow?: number): Promise<UserAnalytics>;
    getCompressionAnalytics(timeWindow?: number): Promise<CompressionAnalytics>;
    getRetrievalAnalytics(): Promise<RetrievalAnalytics>;
    getSystemHealth(): Promise<SystemHealthMetrics>;
    getUsagePatterns(timeRange: string): Promise<{
        contextCreation: Array<{
            date: Date;
            count: number;
        }>;
        retrievalPatterns: Array<{
            hour: number;
            queries: number;
        }>;
        compressionPatterns: Array<{
            date: Date;
            compressions: number;
        }>;
        topUsers: Array<{
            userId: string;
            activity: number;
        }>;
        topTopics: Array<{
            topic: string;
            frequency: number;
        }>;
    }>;
    optimizeContextForUser(userId: string, sessionId?: string): Promise<{
        recommendations: Array<{
            type: 'compression' | 'cleanup' | 'caching' | 'retrieval';
            priority: 'high' | 'medium' | 'low';
            description: string;
            impact: string;
        }>;
        currentStats: {
            contextCount: number;
            totalTokens: number;
            averageSize: number;
            compressionRatio: number;
        };
        optimizedStats: {
            projectedSavings: number;
            projectedSize: number;
            performanceImprovement: number;
        };
    }>;
    getCostOptimization(): Promise<CostOptimization>;
    trackRetrievalEvent(queryTime: number, resultCount: number, relevanceScore?: number): void;
    trackCompressionEvent(compressionRatio: number, tokensSaved: number): void;
    getMetricsHistory(hours?: number): ContextMetrics[];
    exportAnalyticsData(format?: 'json' | 'csv'): Promise<string>;
    private getContextManagerStats;
    private getMiddlewareStats;
    private getSemanticCacheStats;
    private getDatabaseStats;
    private countUniqueUsers;
    private getAverageResponseTime;
    private extractTopics;
    private getMostFrequentItems;
    private calculateAverageSessionDuration;
    private assessContextManagerHealth;
    private assessSemanticRetrievalHealth;
    private assessDatabaseHealth;
    private assessMiddlewareHealth;
    private estimateMemoryUsage;
    private estimateCompressionBacklog;
    private calculateRequestsPerMinute;
    private parseTimeRange;
    private convertToCSV;
    private startMetricsCollection;
    shutdown(): void;
}
export declare const contextAnalyticsService: ContextAnalyticsService;
export default contextAnalyticsService;
//# sourceMappingURL=context-analytics-service.d.ts.map
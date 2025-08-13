import { EventEmitter } from 'events';
import { BaseService, MemoryEntry, ContextQuery, ContextResult } from '../shared/interfaces';
export interface EnhancedMemoryEntry extends MemoryEntry {
    importance: number;
    accessCount: number;
    lastAccessed: Date;
    tags: string[];
    relationships: string[];
    contextType: 'conversation' | 'document' | 'task' | 'preference' | 'fact';
    retentionPolicy: 'permanent' | 'session' | 'temporary' | 'auto';
}
export interface MemoryCluster {
    id: string;
    centroid: number[];
    members: string[];
    topic: string;
    coherenceScore: number;
    lastUpdated: Date;
}
export interface MemoryAnalytics {
    totalEntries: number;
    totalSize: number;
    averageImportance: number;
    clusters: MemoryCluster[];
    accessPatterns: Record<string, number>;
    retentionStats: Record<string, number>;
    performanceMetrics: {
        averageRetrievalTime: number;
        cacheHitRate: number;
        indexingTime: number;
    };
}
declare class UnifiedMemoryService extends EventEmitter implements BaseService {
    readonly name = "unified-memory-service";
    readonly version = "1.0.0";
    status: 'active' | 'inactive' | 'error' | 'initializing';
    private readonly config;
    private readonly memories;
    private readonly clusters;
    private readonly cache;
    private readonly indexMap;
    private analytics;
    private isInitialized;
    private cleanupTimer?;
    private clusteringTimer?;
    constructor();
    initialize(): Promise<void>;
    healthCheck(): Promise<boolean>;
    shutdown(): Promise<void>;
    storeMemory(content: string, userId: string, options?: {
        sessionId?: string;
        embedding?: number[];
        metadata?: Record<string, any>;
        importance?: number;
        contextType?: EnhancedMemoryEntry['contextType'];
        retentionPolicy?: EnhancedMemoryEntry['retentionPolicy'];
        tags?: string[];
    }): Promise<string>;
    retrieveMemories(query: ContextQuery): Promise<ContextResult>;
    updateMemory(memoryId: string, updates: Partial<EnhancedMemoryEntry>): Promise<void>;
    deleteMemory(memoryId: string): Promise<void>;
    consolidateMemories(userId: string, sessionId?: string): Promise<void>;
    getAnalytics(): MemoryAnalytics;
    getMemoryById(memoryId: string): EnhancedMemoryEntry | null;
    private generateEmbedding;
    private calculateSimilarity;
    private calculateImportance;
    private calculateRecencyBoost;
    private calculateExpirationDate;
    private generateMemoryId;
    private generateCacheKey;
    private findRelationships;
    private invalidateCache;
    private cleanCache;
    private startCleanupScheduler;
    private startClusteringScheduler;
    private performCleanup;
    private performClustering;
    private updateClusters;
    private groupSimilarMemories;
    private mergeMemories;
    private updateAnalytics;
    private loadMemoriesFromDatabase;
    private saveMemoriesToDatabase;
    private persistMemory;
    private deleteMemoryFromDatabase;
}
export declare const unifiedMemoryService: UnifiedMemoryService;
export {};
//# sourceMappingURL=unified-memory-service.d.ts.map
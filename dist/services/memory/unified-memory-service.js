import { EventEmitter } from 'events';
import { log, LogContext } from '@/utils/logger';
import { getSupabaseClient } from '../infrastructure/database/supabase-client';
class UnifiedMemoryService extends EventEmitter {
    name = 'unified-memory-service';
    version = '1.0.0';
    status = 'inactive';
    config;
    memories = new Map();
    clusters = new Map();
    cache = new Map();
    indexMap = new Map();
    analytics;
    isInitialized = false;
    cleanupTimer;
    clusteringTimer;
    constructor() {
        super();
        this.config = {
            maxEntries: 10000,
            defaultTTL: 24 * 60 * 60 * 1000,
            embeddingDimensions: 1536,
            clusteringThreshold: 0.8,
            importanceDecay: 0.95,
            enableClustering: true,
            enableCompression: true,
            cacheSize: 1000,
        };
        this.analytics = {
            totalEntries: 0,
            totalSize: 0,
            averageImportance: 0,
            clusters: [],
            accessPatterns: {},
            retentionStats: {},
            performanceMetrics: {
                averageRetrievalTime: 0,
                cacheHitRate: 0,
                indexingTime: 0,
            },
        };
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            log.info('🧠 Initializing Unified Memory Service', LogContext.DATABASE);
            this.status = 'initializing';
            await this.loadMemoriesFromDatabase();
            this.startCleanupScheduler();
            if (this.config.enableClustering) {
                this.startClusteringScheduler();
            }
            this.updateAnalytics();
            this.isInitialized = true;
            this.status = 'active';
            this.emit('initialized');
            log.info('✅ Unified Memory Service initialized', LogContext.DATABASE, {
                totalMemories: this.memories.size,
                clusters: this.clusters.size,
            });
        }
        catch (error) {
            this.status = 'error';
            log.error('❌ Failed to initialize Unified Memory Service', LogContext.DATABASE, { error });
            throw error;
        }
    }
    async healthCheck() {
        try {
            if (this.status !== 'active')
                return false;
            const supabase = getSupabaseClient();
            if (supabase) {
                const { error } = await supabase.from('memories').select('count').limit(1);
                if (error)
                    return false;
            }
            if (this.memories.size > this.config.maxEntries * 1.1)
                return false;
            return true;
        }
        catch (error) {
            log.error('❌ Memory service health check failed', LogContext.DATABASE, { error });
            return false;
        }
    }
    async shutdown() {
        log.info('🛑 Shutting down Unified Memory Service', LogContext.DATABASE);
        if (this.cleanupTimer)
            clearInterval(this.cleanupTimer);
        if (this.clusteringTimer)
            clearInterval(this.clusteringTimer);
        await this.saveMemoriesToDatabase();
        this.status = 'inactive';
        this.emit('shutdown');
        log.info('🛑 Unified Memory Service shut down', LogContext.DATABASE);
    }
    async storeMemory(content, userId, options = {}) {
        try {
            const memoryId = this.generateMemoryId();
            const now = new Date();
            let embedding = options.embedding;
            if (!embedding) {
                embedding = await this.generateEmbedding(content);
            }
            const importance = options.importance ?? this.calculateImportance(content, options.metadata);
            const memory = {
                id: memoryId,
                userId,
                sessionId: options.sessionId,
                content,
                embedding,
                metadata: options.metadata || {},
                createdAt: now,
                updatedAt: now,
                importance,
                accessCount: 0,
                lastAccessed: now,
                tags: options.tags || [],
                relationships: [],
                contextType: options.contextType || 'conversation',
                retentionPolicy: options.retentionPolicy || 'session',
                expiresAt: this.calculateExpirationDate(options.retentionPolicy),
            };
            this.memories.set(memoryId, memory);
            this.indexMap.set(memoryId, embedding);
            await this.findRelationships(memory);
            if (this.config.enableClustering) {
                await this.updateClusters(memory);
            }
            await this.persistMemory(memory);
            this.invalidateCache(userId);
            this.updateAnalytics();
            this.emit('memoryStored', memory);
            log.debug('🧠 Memory stored', LogContext.DATABASE, {
                memoryId,
                userId,
                contentLength: content.length,
                importance,
                contextType: memory.contextType,
            });
            return memoryId;
        }
        catch (error) {
            log.error('❌ Failed to store memory', LogContext.DATABASE, { error, userId });
            throw error;
        }
    }
    async retrieveMemories(query) {
        const startTime = Date.now();
        try {
            const cacheKey = this.generateCacheKey(query);
            const cached = this.cache.get(cacheKey);
            if (cached) {
                this.analytics.performanceMetrics.cacheHitRate++;
                return cached;
            }
            const queryEmbedding = await this.generateEmbedding(query.query);
            let relevantMemories = Array.from(this.memories.values()).filter(memory => {
                if (memory.userId !== query.userId)
                    return false;
                if (query.sessionId && memory.sessionId !== query.sessionId)
                    return false;
                if (query.filters) {
                    for (const [key, value] of Object.entries(query.filters)) {
                        if (memory.metadata[key] !== value)
                            return false;
                    }
                }
                return true;
            });
            const scoredMemories = relevantMemories.map(memory => {
                const embedding = this.indexMap.get(memory.id);
                if (!embedding)
                    return { memory, score: 0 };
                const similarity = this.calculateSimilarity(queryEmbedding, embedding);
                const importanceBoost = memory.importance * 0.2;
                const recencyBoost = this.calculateRecencyBoost(memory.lastAccessed) * 0.1;
                const accessBoost = Math.min(memory.accessCount / 10, 0.1);
                const finalScore = similarity + importanceBoost + recencyBoost + accessBoost;
                return { memory, score: finalScore };
            });
            const threshold = query.threshold ?? 0.7;
            const filteredMemories = scoredMemories
                .filter(item => item.score >= threshold)
                .sort((a, b) => b.score - a.score);
            const limit = query.limit ?? 10;
            const resultMemories = filteredMemories.slice(0, limit);
            for (const item of resultMemories) {
                item.memory.accessCount++;
                item.memory.lastAccessed = new Date();
            }
            const result = {
                entries: resultMemories.map(item => item.memory),
                totalResults: filteredMemories.length,
                searchTime: Date.now() - startTime,
                relevanceScores: resultMemories.map(item => item.score),
            };
            this.cache.set(cacheKey, result);
            if (this.cache.size > this.config.cacheSize) {
                this.cleanCache();
            }
            this.analytics.performanceMetrics.averageRetrievalTime =
                (this.analytics.performanceMetrics.averageRetrievalTime + result.searchTime) / 2;
            this.emit('memoriesRetrieved', { query, result });
            return result;
        }
        catch (error) {
            log.error('❌ Failed to retrieve memories', LogContext.DATABASE, { error, query });
            throw error;
        }
    }
    async updateMemory(memoryId, updates) {
        try {
            const memory = this.memories.get(memoryId);
            if (!memory) {
                throw new Error(`Memory not found: ${memoryId}`);
            }
            Object.assign(memory, updates, { updatedAt: new Date() });
            if (updates.content) {
                const newEmbedding = await this.generateEmbedding(updates.content);
                memory.embedding = newEmbedding;
                this.indexMap.set(memoryId, newEmbedding);
            }
            if (updates.content || updates.metadata) {
                await this.findRelationships(memory);
            }
            await this.persistMemory(memory);
            this.invalidateCache(memory.userId);
            this.emit('memoryUpdated', memory);
            log.debug('🧠 Memory updated', LogContext.DATABASE, { memoryId });
        }
        catch (error) {
            log.error('❌ Failed to update memory', LogContext.DATABASE, { error, memoryId });
            throw error;
        }
    }
    async deleteMemory(memoryId) {
        try {
            const memory = this.memories.get(memoryId);
            if (!memory) {
                log.warn('⚠️ Attempted to delete non-existent memory', LogContext.DATABASE, { memoryId });
                return;
            }
            this.memories.delete(memoryId);
            this.indexMap.delete(memoryId);
            for (const cluster of this.clusters.values()) {
                cluster.members = cluster.members.filter(id => id !== memoryId);
            }
            for (const otherMemory of this.memories.values()) {
                otherMemory.relationships = otherMemory.relationships.filter(id => id !== memoryId);
            }
            await this.deleteMemoryFromDatabase(memoryId);
            this.invalidateCache(memory.userId);
            this.updateAnalytics();
            this.emit('memoryDeleted', { memoryId, userId: memory.userId });
            log.debug('🧠 Memory deleted', LogContext.DATABASE, { memoryId });
        }
        catch (error) {
            log.error('❌ Failed to delete memory', LogContext.DATABASE, { error, memoryId });
            throw error;
        }
    }
    async consolidateMemories(userId, sessionId) {
        try {
            log.info('🔄 Starting memory consolidation', LogContext.DATABASE, { userId, sessionId });
            const memories = Array.from(this.memories.values()).filter(memory => {
                if (memory.userId !== userId)
                    return false;
                if (sessionId && memory.sessionId !== sessionId)
                    return false;
                return memory.retentionPolicy !== 'permanent';
            });
            const groups = await this.groupSimilarMemories(memories);
            for (const group of groups) {
                if (group.length < 2)
                    continue;
                const consolidated = await this.mergeMemories(group);
                await this.storeMemory(consolidated.content, userId, {
                    sessionId: consolidated.sessionId,
                    embedding: consolidated.embedding,
                    metadata: consolidated.metadata,
                    importance: consolidated.importance,
                    contextType: consolidated.contextType,
                    retentionPolicy: 'permanent',
                    tags: consolidated.tags,
                });
                for (const memory of group) {
                    await this.deleteMemory(memory.id);
                }
            }
            log.info('✅ Memory consolidation completed', LogContext.DATABASE, {
                userId,
                groupsProcessed: groups.length,
            });
        }
        catch (error) {
            log.error('❌ Memory consolidation failed', LogContext.DATABASE, { error, userId });
            throw error;
        }
    }
    getAnalytics() {
        return { ...this.analytics };
    }
    getMemoryById(memoryId) {
        return this.memories.get(memoryId) || null;
    }
    async generateEmbedding(text) {
        const dimensions = this.config.embeddingDimensions;
        return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
    }
    calculateSimilarity(embedding1, embedding2) {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
    calculateImportance(content, metadata) {
        let importance = 0.5;
        if (content.length > 100)
            importance += 0.1;
        if (content.length > 500)
            importance += 0.1;
        if (metadata?.isImportant)
            importance += 0.2;
        if (metadata?.userRating)
            importance += metadata.userRating * 0.1;
        const importantKeywords = ['important', 'remember', 'critical', 'key', 'must'];
        const lowerContent = content.toLowerCase();
        for (const keyword of importantKeywords) {
            if (lowerContent.includes(keyword)) {
                importance += 0.05;
            }
        }
        return Math.min(1.0, importance);
    }
    calculateRecencyBoost(lastAccessed) {
        const hoursAgo = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60);
        return Math.max(0, 1 - hoursAgo / 168);
    }
    calculateExpirationDate(retentionPolicy) {
        const now = Date.now();
        switch (retentionPolicy) {
            case 'temporary':
                return new Date(now + 60 * 60 * 1000);
            case 'session':
                return new Date(now + this.config.defaultTTL);
            case 'permanent':
                return undefined;
            default:
                return new Date(now + this.config.defaultTTL);
        }
    }
    generateMemoryId() {
        return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateCacheKey(query) {
        return `${query.userId}_${query.sessionId || 'global'}_${JSON.stringify(query.filters)}_${query.query}`;
    }
    async findRelationships(memory) {
        const threshold = 0.8;
        const relationships = [];
        for (const [otherId, otherMemory] of this.memories) {
            if (otherId === memory.id || otherMemory.userId !== memory.userId)
                continue;
            const otherEmbedding = this.indexMap.get(otherId);
            if (!otherEmbedding || !memory.embedding)
                continue;
            const similarity = this.calculateSimilarity(memory.embedding, otherEmbedding);
            if (similarity > threshold) {
                relationships.push(otherId);
            }
        }
        memory.relationships = relationships;
    }
    invalidateCache(userId) {
        for (const [key] of this.cache) {
            if (key.startsWith(userId)) {
                this.cache.delete(key);
            }
        }
    }
    cleanCache() {
        const entries = Array.from(this.cache.entries());
        const toRemove = entries.slice(0, Math.floor(entries.length * 0.2));
        for (const [key] of toRemove) {
            this.cache.delete(key);
        }
    }
    startCleanupScheduler() {
        this.cleanupTimer = setInterval(() => {
            this.performCleanup().catch(error => log.error('❌ Memory cleanup failed', LogContext.DATABASE, { error }));
        }, 60 * 60 * 1000);
    }
    startClusteringScheduler() {
        this.clusteringTimer = setInterval(() => {
            this.performClustering().catch(error => log.error('❌ Memory clustering failed', LogContext.DATABASE, { error }));
        }, 4 * 60 * 60 * 1000);
    }
    async performCleanup() {
        const now = Date.now();
        const expiredMemories = [];
        for (const [memoryId, memory] of this.memories) {
            if (memory.expiresAt && memory.expiresAt.getTime() < now) {
                expiredMemories.push(memoryId);
                continue;
            }
            memory.importance *= this.config.importanceDecay;
            if (memory.importance < 0.1 && memory.retentionPolicy !== 'permanent') {
                expiredMemories.push(memoryId);
            }
        }
        for (const memoryId of expiredMemories) {
            await this.deleteMemory(memoryId);
        }
        if (expiredMemories.length > 0) {
            log.info('🧹 Memory cleanup completed', LogContext.DATABASE, {
                expiredCount: expiredMemories.length,
            });
        }
    }
    async performClustering() {
        log.info('🔄 Starting memory clustering', LogContext.DATABASE);
        const embeddings = Array.from(this.indexMap.entries());
        log.info('✅ Memory clustering completed', LogContext.DATABASE);
    }
    async updateClusters(memory) {
    }
    async groupSimilarMemories(memories) {
        const groups = [];
        const used = new Set();
        for (const memory of memories) {
            if (used.has(memory.id))
                continue;
            const group = [memory];
            used.add(memory.id);
            for (const other of memories) {
                if (used.has(other.id))
                    continue;
                const similarity = this.calculateSimilarity(memory.embedding || [], other.embedding || []);
                if (similarity > 0.85) {
                    group.push(other);
                    used.add(other.id);
                }
            }
            if (group.length > 1) {
                groups.push(group);
            }
        }
        return groups;
    }
    async mergeMemories(memories) {
        const contents = memories.map(m => m.content).join('\n\n');
        const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
        const allTags = [...new Set(memories.flatMap(m => m.tags))];
        return {
            ...memories[0],
            content: contents,
            importance: Math.min(1.0, avgImportance * 1.2),
            tags: allTags,
            accessCount: memories.reduce((sum, m) => sum + m.accessCount, 0),
        };
    }
    updateAnalytics() {
        const memories = Array.from(this.memories.values());
        this.analytics.totalEntries = memories.length;
        this.analytics.totalSize = memories.reduce((sum, m) => sum + m.content.length, 0);
        this.analytics.averageImportance = memories.length > 0
            ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
            : 0;
        this.analytics.retentionStats = memories.reduce((stats, memory) => {
            stats[memory.retentionPolicy] = (stats[memory.retentionPolicy] || 0) + 1;
            return stats;
        }, {});
        this.analytics.accessPatterns = memories.reduce((patterns, memory) => {
            patterns[memory.contextType] = (patterns[memory.contextType] || 0) + memory.accessCount;
            return patterns;
        }, {});
    }
    async loadMemoriesFromDatabase() {
    }
    async saveMemoriesToDatabase() {
    }
    async persistMemory(memory) {
    }
    async deleteMemoryFromDatabase(memoryId) {
    }
}
export const unifiedMemoryService = new UnifiedMemoryService();
//# sourceMappingURL=unified-memory-service.js.map
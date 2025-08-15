/**
 * Unified Memory Service
 * Consolidates memory-service.ts, context-storage-service.ts, robust-memory-service.ts
 * Provides comprehensive memory management with context awareness
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '@/utils/logger';

import type { BaseService, ContextQuery, ContextResult,MemoryEntry } from '../shared/interfaces';
import { getSupabaseClient } from '../supabase-client';

// ============================================================================
// Enhanced Types for Unified Memory
// ============================================================================

export interface EnhancedMemoryEntry extends MemoryEntry {
  importance: number; // 0-1 score
  accessCount: number;
  lastAccessed: Date;
  tags: string[];
  relationships: string[]; // IDs of related memories
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

interface MemoryConfig {
  maxEntries: number;
  defaultTTL: number;
  embeddingDimensions: number;
  clusteringThreshold: number;
  importanceDecay: number;
  enableClustering: boolean;
  enableCompression: boolean;
  cacheSize: number;
  maxEmbeddingCacheSize: number;
  aggressiveCleanup: boolean;
}

// ============================================================================
// Unified Memory Service
// ============================================================================

class UnifiedMemoryService extends EventEmitter implements BaseService {
  readonly name = 'unified-memory-service';
  readonly version = '1.0.0';
  status: 'active' | 'inactive' | 'error' | 'initializing' = 'inactive';

  private readonly config: MemoryConfig;
  private readonly memories = new Map<string, EnhancedMemoryEntry>();
  private readonly clusters = new Map<string, MemoryCluster>();
  private readonly cache = new Map<string, ContextResult>();
  private readonly indexMap = new Map<string, number[]>(); // embeddings index
  private analytics: MemoryAnalytics;
  private isInitialized = false;
  private cleanupTimer?: NodeJS.Timeout;
  private clusteringTimer?: NodeJS.Timeout;

  constructor() {
    super();
    
    this.config = {
      maxEntries: 5000, // Reduced from 10000
      defaultTTL: 12 * 60 * 60 * 1000, // Reduced to 12 hours
      embeddingDimensions: 768, // Reduced from 1536
      clusteringThreshold: 0.8,
      importanceDecay: 0.9, // More aggressive decay
      enableClustering: false, // Disabled for memory savings
      enableCompression: true,
      cacheSize: 200, // Reduced from 1000
      maxEmbeddingCacheSize: 500, // New limit for embeddings
      aggressiveCleanup: true, // Enable aggressive cleanup
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

  // ============================================================================
  // Service Lifecycle
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('🧠 Initializing Unified Memory Service', LogContext.DATABASE);
      this.status = 'initializing';

      // Load existing memories from database
      await this.loadMemoriesFromDatabase();

      // Start background tasks
      this.startCleanupScheduler();
      if (this.config.enableClustering) {
        this.startClusteringScheduler();
      }

      // Initialize analytics
      this.updateAnalytics();

      this.isInitialized = true;
      this.status = 'active';
      this.emit('initialized');

      log.info('✅ Unified Memory Service initialized', LogContext.DATABASE, {
        totalMemories: this.memories.size,
        clusters: this.clusters.size,
      });

    } catch (error) {
      this.status = 'error';
      log.error('❌ Failed to initialize Unified Memory Service', LogContext.DATABASE, { error });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Basic health checks
      if (this.status !== 'active') return false;
      
      // Check database connectivity
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.from('memories').select('count').limit(1);
        if (error) return false;
      }

      // Check memory limits
      if (this.memories.size > this.config.maxEntries * 1.1) return false;

      return true;
    } catch (error) {
      log.error('❌ Memory service health check failed', LogContext.DATABASE, { error });
      return false;
    }
  }

  async shutdown(): Promise<void> {
    log.info('🛑 Shutting down Unified Memory Service', LogContext.DATABASE);

    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.clusteringTimer) clearInterval(this.clusteringTimer);

    // Save memories to database
    await this.saveMemoriesToDatabase();

    this.status = 'inactive';
    this.emit('shutdown');

    log.info('🛑 Unified Memory Service shut down', LogContext.DATABASE);
  }

  // ============================================================================
  // Core Memory Operations
  // ============================================================================

  async storeMemory(
    content: string,
    userId: string,
    options: {
      sessionId?: string;
      embedding?: number[];
      metadata?: Record<string, any>;
      importance?: number;
      contextType?: EnhancedMemoryEntry['contextType'];
      retentionPolicy?: EnhancedMemoryEntry['retentionPolicy'];
      tags?: string[];
    } = {}
  ): Promise<string> {
    try {
      const memoryId = this.generateMemoryId();
      const now = new Date();

      // Generate embedding if not provided
      let {embedding} = options;
      if (!embedding) {
        embedding = await this.generateEmbedding(content);
      }

      // Calculate importance score
      const importance = options.importance ?? this.calculateImportance(content, options.metadata);

      const memory: EnhancedMemoryEntry = {
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

      // Store in memory
      this.memories.set(memoryId, memory);
      this.indexMap.set(memoryId, embedding);

      // Find and store relationships
      await this.findRelationships(memory);

      // Update clusters if enabled
      if (this.config.enableClustering) {
        await this.updateClusters(memory);
      }

      // Persist to database
      await this.persistMemory(memory);

      // Clear relevant caches
      this.invalidateCache(userId);

      // Update analytics
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

    } catch (error) {
      log.error('❌ Failed to store memory', LogContext.DATABASE, { error, userId });
      throw error;
    }
  }

  async retrieveMemories(query: ContextQuery): Promise<ContextResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.analytics.performanceMetrics.cacheHitRate++;
        return cached;
      }

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query.query);

      // Filter memories by user and basic criteria
      const relevantMemories = Array.from(this.memories.values()).filter(memory => {
        // User filter
        if (memory.userId !== query.userId) return false;

        // Session filter
        if (query.sessionId && memory.sessionId !== query.sessionId) return false;

        // Apply additional filters
        if (query.filters) {
          for (const [key, value] of Object.entries(query.filters)) {
            if (memory.metadata[key] !== value) return false;
          }
        }

        return true;
      });

      // Calculate similarity scores
      const scoredMemories = relevantMemories.map(memory => {
        const embedding = this.indexMap.get(memory.id);
        if (!embedding) return { memory, score: 0 };

        const similarity = this.calculateSimilarity(queryEmbedding, embedding);
        
        // Apply importance and recency boost
        const importanceBoost = memory.importance * 0.2;
        const recencyBoost = this.calculateRecencyBoost(memory.lastAccessed) * 0.1;
        const accessBoost = Math.min(memory.accessCount / 10, 0.1);

        const finalScore = similarity + importanceBoost + recencyBoost + accessBoost;

        return { memory, score: finalScore };
      });

      // Filter by threshold and sort
      const threshold = query.threshold ?? 0.7;
      const filteredMemories = scoredMemories
        .filter(item => item.score >= threshold)
        .sort((a, b) => b.score - a.score);

      // Apply limit
      const limit = query.limit ?? 10;
      const resultMemories = filteredMemories.slice(0, limit);

      // Update access counts
      for (const item of resultMemories) {
        item.memory.accessCount++;
        item.memory.lastAccessed = new Date();
      }

      const result: ContextResult = {
        entries: resultMemories.map(item => item.memory),
        totalResults: filteredMemories.length,
        searchTime: Date.now() - startTime,
        relevanceScores: resultMemories.map(item => item.score),
      };

      // Cache result
      this.cache.set(cacheKey, result);
      if (this.cache.size > this.config.cacheSize) {
        this.cleanCache();
      }

      // Update analytics
      this.analytics.performanceMetrics.averageRetrievalTime = 
        (this.analytics.performanceMetrics.averageRetrievalTime + result.searchTime) / 2;

      this.emit('memoriesRetrieved', { query, result });

      return result;

    } catch (error) {
      log.error('❌ Failed to retrieve memories', LogContext.DATABASE, { error, query });
      throw error;
    }
  }

  async updateMemory(
    memoryId: string, 
    updates: Partial<EnhancedMemoryEntry>
  ): Promise<void> {
    try {
      const memory = this.memories.get(memoryId);
      if (!memory) {
        throw new Error(`Memory not found: ${memoryId}`);
      }

      // Apply updates
      Object.assign(memory, updates, { updatedAt: new Date() });

      // Update embedding if content changed
      if (updates.content) {
        const newEmbedding = await this.generateEmbedding(updates.content);
        memory.embedding = newEmbedding;
        this.indexMap.set(memoryId, newEmbedding);
      }

      // Update relationships if needed
      if (updates.content || updates.metadata) {
        await this.findRelationships(memory);
      }

      // Persist changes
      await this.persistMemory(memory);

      // Clear related caches
      this.invalidateCache(memory.userId);

      this.emit('memoryUpdated', memory);

      log.debug('🧠 Memory updated', LogContext.DATABASE, { memoryId });

    } catch (error) {
      log.error('❌ Failed to update memory', LogContext.DATABASE, { error, memoryId });
      throw error;
    }
  }

  async deleteMemory(memoryId: string): Promise<void> {
    try {
      const memory = this.memories.get(memoryId);
      if (!memory) {
        log.warn('⚠️ Attempted to delete non-existent memory', LogContext.DATABASE, { memoryId });
        return;
      }

      // Remove from memory and index
      this.memories.delete(memoryId);
      this.indexMap.delete(memoryId);

      // Remove from clusters
      for (const cluster of this.clusters.values()) {
        cluster.members = cluster.members.filter(id => id !== memoryId);
      }

      // Remove relationships
      for (const otherMemory of this.memories.values()) {
        otherMemory.relationships = otherMemory.relationships.filter(id => id !== memoryId);
      }

      // Delete from database
      await this.deleteMemoryFromDatabase(memoryId);

      // Clear related caches
      this.invalidateCache(memory.userId);

      // Update analytics
      this.updateAnalytics();

      this.emit('memoryDeleted', { memoryId, userId: memory.userId });

      log.debug('🧠 Memory deleted', LogContext.DATABASE, { memoryId });

    } catch (error) {
      log.error('❌ Failed to delete memory', LogContext.DATABASE, { error, memoryId });
      throw error;
    }
  }

  // ============================================================================
  // Advanced Memory Operations
  // ============================================================================

  async consolidateMemories(userId: string, sessionId?: string): Promise<void> {
    try {
      log.info('🔄 Starting memory consolidation', LogContext.DATABASE, { userId, sessionId });

      // Get memories to consolidate
      const memories = Array.from(this.memories.values()).filter(memory => {
        if (memory.userId !== userId) return false;
        if (sessionId && memory.sessionId !== sessionId) return false;
        return memory.retentionPolicy !== 'permanent';
      });

      // Group similar memories
      const groups = await this.groupSimilarMemories(memories);

      for (const group of groups) {
        if (group.length < 2) continue;

        // Merge memories in each group
        const consolidated = await this.mergeMemories(group);
        
        // Store consolidated memory
        await this.storeMemory(consolidated.content, userId, {
          sessionId: consolidated.sessionId,
          embedding: consolidated.embedding,
          metadata: consolidated.metadata,
          importance: consolidated.importance,
          contextType: consolidated.contextType,
          retentionPolicy: 'permanent',
          tags: consolidated.tags,
        });

        // Delete original memories
        for (const memory of group) {
          await this.deleteMemory(memory.id);
        }
      }

      log.info('✅ Memory consolidation completed', LogContext.DATABASE, {
        userId,
        groupsProcessed: groups.length,
      });

    } catch (error) {
      log.error('❌ Memory consolidation failed', LogContext.DATABASE, { error, userId });
      throw error;
    }
  }

  getAnalytics(): MemoryAnalytics {
    return { ...this.analytics };
  }

  getMemoryById(memoryId: string): EnhancedMemoryEntry | null {
    return this.memories.get(memoryId) || null;
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    // Placeholder for embedding generation
    // In real implementation, would use actual embedding service
    const dimensions = this.config.embeddingDimensions;
    return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
  }

  private calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    // Cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < Math.min(embedding1.length, embedding2.length); i++) {
      const val1 = embedding1[i] || 0;
      const val2 = embedding2[i] || 0;
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private calculateImportance(content: string, metadata?: Record<string, any>): number {
    let importance = 0.5; // Base importance

    // Content length factor
    if (content.length > 100) importance += 0.1;
    if (content.length > 500) importance += 0.1;

    // Metadata factors
    if (metadata?.isImportant) importance += 0.2;
    if (metadata?.userRating) importance += metadata.userRating * 0.1;

    // Keyword-based importance
    const importantKeywords = ['important', 'remember', 'critical', 'key', 'must'];
    const lowerContent = content.toLowerCase();
    for (const keyword of importantKeywords) {
      if (lowerContent.includes(keyword)) {
        importance += 0.05;
      }
    }

    return Math.min(1.0, importance);
  }

  private calculateRecencyBoost(lastAccessed: Date): number {
    const hoursAgo = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60);
    return Math.max(0, 1 - hoursAgo / 168); // Decay over 1 week
  }

  private calculateExpirationDate(retentionPolicy?: string): Date | undefined {
    const now = Date.now();
    
    switch (retentionPolicy) {
      case 'temporary':
        return new Date(now + 60 * 60 * 1000); // 1 hour
      case 'session':
        return new Date(now + this.config.defaultTTL);
      case 'permanent':
        return undefined;
      default:
        return new Date(now + this.config.defaultTTL);
    }
  }

  private generateMemoryId(): string {
    return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCacheKey(query: ContextQuery): string {
    return `${query.userId}_${query.sessionId || 'global'}_${JSON.stringify(query.filters)}_${query.query}`;
  }

  private async findRelationships(memory: EnhancedMemoryEntry): Promise<void> {
    // Find related memories based on similarity
    const threshold = 0.8;
    const relationships: string[] = [];

    for (const [otherId, otherMemory] of this.memories) {
      if (otherId === memory.id || otherMemory.userId !== memory.userId) continue;

      const otherEmbedding = this.indexMap.get(otherId);
      if (!otherEmbedding || !memory.embedding) continue;

      const similarity = this.calculateSimilarity(memory.embedding, otherEmbedding);
      if (similarity > threshold) {
        relationships.push(otherId);
      }
    }

    memory.relationships = relationships;
  }

  private invalidateCache(userId: string): void {
    for (const [key] of this.cache) {
      if (key.startsWith(userId)) {
        this.cache.delete(key);
      }
    }
  }

  private cleanCache(): void {
    // Remove oldest entries if cache is full
    const entries = Array.from(this.cache.entries());
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.2));
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  private startCleanupScheduler(): void {
    // More frequent cleanup for memory optimization
    const cleanupInterval = this.config.aggressiveCleanup ? 30000 : 60 * 60 * 1000; // 30s vs 1h
    
    this.cleanupTimer = setInterval(() => {
      this.performCleanup().catch(error => 
        log.error('❌ Memory cleanup failed', LogContext.DATABASE, { error })
      );
    }, cleanupInterval);
  }

  private startClusteringScheduler(): void {
    this.clusteringTimer = setInterval(() => {
      this.performClustering().catch(error => 
        log.error('❌ Memory clustering failed', LogContext.DATABASE, { error })
      );
    }, 4 * 60 * 60 * 1000); // Every 4 hours
  }

  private async performCleanup(): Promise<void> {
    const now = Date.now();
    const expiredMemories: string[] = [];

    for (const [memoryId, memory] of this.memories) {
      // Check expiration
      if (memory.expiresAt && memory.expiresAt.getTime() < now) {
        expiredMemories.push(memoryId);
        continue;
      }

      // Apply importance decay
      memory.importance *= this.config.importanceDecay;
      
      // More aggressive cleanup thresholds
      const cleanupThreshold = this.config.aggressiveCleanup ? 0.2 : 0.1;
      if (memory.importance < cleanupThreshold && memory.retentionPolicy !== 'permanent') {
        expiredMemories.push(memoryId);
      }
    }

    // If we're over capacity, remove lowest importance memories
    if (this.memories.size > this.config.maxEntries) {
      const sortedMemories = Array.from(this.memories.entries())
        .filter(([, memory]) => memory.retentionPolicy !== 'permanent')
        .sort(([, a], [, b]) => a.importance - b.importance);
      
      const excessCount = this.memories.size - this.config.maxEntries;
      for (let i = 0; i < excessCount && i < sortedMemories.length; i++) {
        expiredMemories.push(sortedMemories[i][0]);
      }
    }

    // Clean up embedding cache if too large
    if (this.indexMap.size > this.config.maxEmbeddingCacheSize) {
      const excessEmbeddings = this.indexMap.size - this.config.maxEmbeddingCacheSize;
      let removed = 0;
      for (const [memoryId] of this.indexMap) {
        if (removed >= excessEmbeddings) break;
        if (!this.memories.has(memoryId) || expiredMemories.includes(memoryId)) {
          this.indexMap.delete(memoryId);
          removed++;
        }
      }
    }

    // Delete expired memories
    for (const memoryId of expiredMemories) {
      await this.deleteMemory(memoryId);
    }

    // Clear caches more aggressively
    if (this.cache.size > this.config.cacheSize * 0.8) {
      this.cleanCache();
    }

    // Force garbage collection hint
    if (global.gc && expiredMemories.length > 0) {
      global.gc();
    }

    if (expiredMemories.length > 0) {
      log.info('🧹 Memory cleanup completed', LogContext.DATABASE, {
        expiredCount: expiredMemories.length,
        totalMemories: this.memories.size,
        totalEmbeddings: this.indexMap.size,
      });
    }
  }

  private async performClustering(): Promise<void> {
    // Simplified clustering algorithm
    log.info('🔄 Starting memory clustering', LogContext.DATABASE);

    const embeddings = Array.from(this.indexMap.entries());
    // Implementation would go here for actual clustering

    log.info('✅ Memory clustering completed', LogContext.DATABASE);
  }

  private async updateClusters(memory: EnhancedMemoryEntry): Promise<void> {
    // Update cluster membership for new memory
    // Implementation would go here
  }

  private async groupSimilarMemories(memories: EnhancedMemoryEntry[]): Promise<EnhancedMemoryEntry[][]> {
    // Group similar memories for consolidation
    const groups: EnhancedMemoryEntry[][] = [];
    const used = new Set<string>();

    for (const memory of memories) {
      if (used.has(memory.id)) continue;

      const group = [memory];
      used.add(memory.id);

      for (const other of memories) {
        if (used.has(other.id)) continue;

        const similarity = this.calculateSimilarity(
          memory.embedding || [],
          other.embedding || []
        );

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

  private async mergeMemories(memories: EnhancedMemoryEntry[]): Promise<EnhancedMemoryEntry> {
    // Merge multiple memories into one consolidated memory
    if (memories.length === 0) {
      throw new Error('Cannot merge empty memories array');
    }
    
    const contents = memories.map(m => m.content).join('\n\n');
    const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;
    const allTags = [...new Set(memories.flatMap(m => m.tags))];
    
    return {
      ...memories[0],
      content: contents,
      importance: Math.min(1.0, avgImportance * 1.2), // Boost consolidated importance
      tags: allTags,
      accessCount: memories.reduce((sum, m) => sum + m.accessCount, 0),
      lastAccessed: new Date(), // Ensure lastAccessed is always a Date
      relationships: memories[0].relationships || [], // Ensure relationships is never undefined
      contextType: memories[0].contextType || 'conversation', // Ensure contextType is never undefined
    };
  }

  private updateAnalytics(): void {
    const memories = Array.from(this.memories.values());
    
    this.analytics.totalEntries = memories.length;
    this.analytics.totalSize = memories.reduce((sum, m) => sum + m.content.length, 0);
    this.analytics.averageImportance = memories.length > 0 
      ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length 
      : 0;

    // Update retention stats
    this.analytics.retentionStats = memories.reduce((stats, memory) => {
      stats[memory.retentionPolicy] = (stats[memory.retentionPolicy] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);

    // Update access patterns
    this.analytics.accessPatterns = memories.reduce((patterns, memory) => {
      patterns[memory.contextType] = (patterns[memory.contextType] || 0) + memory.accessCount;
      return patterns;
    }, {} as Record<string, number>);
  }

  // Database operations (placeholder implementations)
  private async loadMemoriesFromDatabase(): Promise<void> {
    // Implementation would load from Supabase
  }

  private async saveMemoriesToDatabase(): Promise<void> {
    // Implementation would save to Supabase
  }

  private async persistMemory(memory: EnhancedMemoryEntry): Promise<void> {
    // Implementation would persist to Supabase
  }

  private async deleteMemoryFromDatabase(memoryId: string): Promise<void> {
    // Implementation would delete from Supabase
  }
}

// ============================================================================
// Export Service Instance
// ============================================================================

export const unifiedMemoryService = new UnifiedMemoryService();
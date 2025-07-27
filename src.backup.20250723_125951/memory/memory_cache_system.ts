/* eslint-disable no-undef */
/**
 * Multi-Tier Memory Caching System
 * High-performance caching for memories, embeddings, and search results
 * Provides hot cache, warm cache, and cold storage with intelligent eviction
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl?: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

interface SearchCacheKey {
  queryHash: string;
  similarityThreshold: number;
  maxResults: number;
  agentFilter?: string;
  category?: string;
}

export interface Memory {
  id: string;
  serviceId: string;
  content string;
  embedding?: number[];
  importanceScore: number;
  memoryType: string;
  metadata: Record<string, unknown>;
  accessCount: number;
  lastAccessed?: Date;
  keywords?: string[];
  relatedEntities?: any[];
}

/**
 * Generic LRU Cache with TTL and access tracking
 */
class AdvancedLRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private maxSize: number;
  private defaultTTL: number;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(maxSize: number, defaultTTLMs: number = 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTLMs;
  }

  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      accessCount: 0,
      lastAccessed: now,
      ttl: ttl || this.defaultTTL,
    };

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }

    // Evict if cache is full
    while (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, entry;
    this.accessOrder.set(key, now;
  }

  get(key: string: T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();

    // Check TTL
    if (entry.ttl && now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = now;
    this.accessOrder.set(key, now;
    this.stats.hits++;

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    const now = Date.now();
    if (entry.ttl && now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear()): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
    };
  }

  private evictLeastRecentlyUsed()): void {
    if (this.accessOrder.size === 0) return;

    // Find the least recently used entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  // Get entries sorted by access frequency for analysis
  getHotEntries(limit = 10): Array<{ key: string; accessCount: number; lastAccessed: number, }> {
    const entries = Array.from(this.cache.entries());
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
      }))
      .sort((a, b => b.accessCount - a.accessCount)
      .slice(0, limit);

    return entries;
  }
}

/**
 * Multi-tier memory caching system
 */
export class MemoryCacheSystem {
  // Hot cache - frequently accessed memories (fast: access
  private hotMemoryCache: AdvancedLRUCache<Memory>;

  // Warm cache - recent memories (medium: access
  private warmMemoryCache: AdvancedLRUCache<Memory>;

  // Search result cache - cached query results
  private searchResultCache: AdvancedLRUCache<Memory[]>;

  // Embedding cache - cached vector embeddings
  private embeddingCache: AdvancedLRUCache<number[]>;

  // Cold cache - compressed/summarized memories for long-term storage
  private coldMemoryCache: AdvancedLRUCache<Partial<Memory>>;

  constructor(
    config: {
      hotCacheSize?: number;
      warmCacheSize?: number;
      searchCacheSize?: number;
      embeddingCacheSize?: number;
      coldCacheSize?: number;
      defaultTTL?: number;
    } = {}
  ) {
    const {
      hotCacheSize = 500,
      warmCacheSize = 2000,
      searchCacheSize = 1000,
      embeddingCacheSize = 5000,
      coldCacheSize = 10000,
      defaultTTL = 60 * 60 * 1000, // 1 hour
    } = config;

    this.hotMemoryCache = new AdvancedLRUCache<Memory>(hotCacheSize, defaultTTL;
    this.warmMemoryCache = new AdvancedLRUCache<Memory>(warmCacheSize, defaultTTL * 2);
    this.searchResultCache = new AdvancedLRUCache<Memory[]>(searchCacheSize, defaultTTL / 2);
    this.embeddingCache = new AdvancedLRUCache<number[]>(embeddingCacheSize, defaultTTL * 4);
    this.coldMemoryCache = new AdvancedLRUCache<Partial<Memory>>(coldCacheSize, defaultTTL * 8);
  }

  /**
   * Store memory in appropriate cache tier based on importance
   */
  storeMemory(memory: Memory): void {
    const cacheKey = this.getMemoryCacheKey(memory.id);

    // Determine cache tier based on importance and access patterns
    if (memory.importanceScore > 0.8) {
      this.hotMemoryCache.set(cacheKey, memory;
    } else if (memory.importanceScore > 0.5) {
      this.warmMemoryCache.set(cacheKey, memory;
    } else {
      // Store compressed version in cold cache
      const compressedMemory: Partial<Memory> = {
        id: memory.id,
        serviceId: memory.serviceId,
        content memory.contentsubstring(0, 200) + (memory.content.length > 200 ? '...' : ''),
        importanceScore: memory.importanceScore,
        memoryType: memory.memoryType,
        metadata: memory.metadata,
        accessCount: memory.accessCount,
        lastAccessed: memory.lastAccessed,
        keywords: memory.keywords,
        relatedEntities: memory.relatedEntities,
      };
      this.coldMemoryCache.set(cacheKey, compressedMemory;
    }

    // Always cache embedding separately if available
    if (memory.embedding) {
      this.embeddingCache.set(this.getEmbeddingCacheKey(memory.content, memory.embedding);
    }
  }

  /**
   * Retrieve memory from cache tiers with promotion
   */
  getMemory(memoryId: string: Memory | Partial<Memory> | null {
    const cacheKey = this.getMemoryCacheKey(memoryId);

    // Check hot cache first
    let memory = this.hotMemoryCache.get(cacheKey);
    if (memory) {
      return memory;
    }

    // Check warm cache
    memory = this.warmMemoryCache.get(cacheKey);
    if (memory) {
      // Promote to hot cache if accessed frequently
      const stats = this.warmMemoryCache.getStats();
      if (memory.importanceScore > 0.7) {
        this.hotMemoryCache.set(cacheKey, memory;
      }
      return memory;
    }

    // Check cold cache
    const coldMemory = this.coldMemoryCache.get(cacheKey);
    if (coldMemory) {
      return coldMemory;
    }

    return null;
  }

  /**
   * Cache search results with query fingerprint
   */
  cacheSearchResults(searchKey: SearchCacheKey, results: Memory[])): void {
    const cacheKey = this.getSearchCacheKey(searchKey);
    this.searchResultCache.set(cacheKey, results, 30 * 60 * 1000); // 30 minutes TTL
  }

  /**
   * Retrieve cached search results
   */
  getCachedSearchResults(searchKey: SearchCacheKey: Memory[] | null {
    const cacheKey = this.getSearchCacheKey(searchKey);
    return this.searchResultCache.get(cacheKey);
  }

  /**
   * Cache embedding
   */
  cacheEmbedding(text: string, embedding: number[])): void {
    const cacheKey = this.getEmbeddingCacheKey(text);
    this.embeddingCache.set(cacheKey, embedding, 4 * 60 * 60 * 1000); // 4 hours TTL
  }

  /**
   * Get cached embedding
   */
  getCachedEmbedding(text: string: number[] | null {
    const cacheKey = this.getEmbeddingCacheKey(text);
    return this.embeddingCache.get(cacheKey);
  }

  /**
   * Promote memory to higher cache tier
   */
  promoteMemory(memoryId: string, newImportanceScore?: number): void {
    const cacheKey = this.getMemoryCacheKey(memoryId);

    // Try to find memory in warm or cold cache
    const memory = this.warmMemoryCache.get(cacheKey);
    if (memory) {
      if (newImportanceScore) {
        memory.importanceScore = newImportanceScore;
      }

      if (memory.importanceScore > 0.8) {
        this.hotMemoryCache.set(cacheKey, memory;
        this.warmMemoryCache.delete(cacheKey);
      }
      return;
    }

    const coldMemory = this.coldMemoryCache.get(cacheKey);
    if (coldMemory && newImportanceScore && newImportanceScore > 0.5) {
      // Would need to fetch full memory from database for promotion
      // This is a placeholder for the logic
      console.log(`Memory ${memoryId} needs database fetch for promotion`);
    }
  }

  /**
   * Invalidate cached data for a memory
   */
  invalidateMemory(memoryId: string): void {
    const cacheKey = this.getMemoryCacheKey(memoryId);
    this.hotMemoryCache.delete(cacheKey);
    this.warmMemoryCache.delete(cacheKey);
    this.coldMemoryCache.delete(cacheKey);
  }

  /**
   * Invalidate search cache (e.g., when new memories are: added
   */
  invalidateSearchCache()): void {
    this.searchResultCache.clear();
  }

  /**
   * Pre-warm cache with frequently accessed memories
   */
  preWarmCache(memories: Memory[])): void {
    memories.forEach((memory) => {
      this.storeMemory(memory);
    });
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): {
    hot: CacheStats;
    warm: CacheStats;
    search: CacheStats;
    embedding: CacheStats;
    cold: CacheStats;
    overall: {
      totalMemories: number;
      totalHits: number;
      totalMisses: number;
      overallHitRate: number;
    };
  } {
    const hotStats = this.hotMemoryCache.getStats();
    const warmStats = this.warmMemoryCache.getStats();
    const searchStats = this.searchResultCache.getStats();
    const embeddingStats = this.embeddingCache.getStats();
    const coldStats = this.coldMemoryCache.getStats();

    const totalHits =;
      hotStats.hits + warmStats.hits + searchStats.hits + embeddingStats.hits + coldStats.hits;
    const totalMisses =;
      hotStats.misses +
      warmStats.misses +
      searchStats.misses +
      embeddingStats.misses +
      coldStats.misses;
    const totalRequests = totalHits + totalMisses;

    return {
      hot: hotStats,
      warm: warmStats,
      search: searchStats,
      embedding: embeddingStats,
      cold: coldStats,
      overall: {
        totalMemories: hotStats.size + warmStats.size + coldStats.size,
        totalHits,
        totalMisses,
        overallHitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      },
    };
  }

  /**
   * Get hot entries across all caches for analysis
   */
  getHotEntries(): {
    hotMemories: Array<{ key: string; accessCount: number, }>;
    hotSearches: Array<{ key: string; accessCount: number, }>;
    hotEmbeddings: Array<{ key: string; accessCount: number, }>;
  } {
    return {
      hotMemories: this.hotMemoryCache.getHotEntries(10),
      hotSearches: this.searchResultCache.getHotEntries(10),
      hotEmbeddings: this.embeddingCache.getHotEntries(10),
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches()): void {
    this.hotMemoryCache.clear();
    this.warmMemoryCache.clear();
    this.searchResultCache.clear();
    this.embeddingCache.clear();
    this.coldMemoryCache.clear();
  }

  /**
   * Optimize cache by moving frequently accessed items to appropriate tiers
   */
  optimizeCacheTiers(): {
    promoted: number;
    demoted: number;
  } {
    let promoted = 0;
    let demoted = 0;

    // Analyze warm cache for promotion candidates
    const warmHotEntries = this.warmMemoryCache.getHotEntries(50);
    warmHotEntries.forEach((entry) => {
      const memory = this.warmMemoryCache.get(entry.key);
      if (memory && (entry.accessCount > 10 || memory.importanceScore > 0.8)) {
        this.hotMemoryCache.set(entry.key, memory;
        this.warmMemoryCache.delete(entry.key);
        promoted++;
      }
    });

    // Analyze hot cache for demotion candidates
    const hotEntries = this.hotMemoryCache.getHotEntries(100);
    const now = Date.now();
    hotEntries.forEach((entry) => {
      const memory = this.hotMemoryCache.get(entry.key);
      if (
        memory &&
        entry.accessCount < 5 &&
        now - entry.lastAccessed > 60 * 60 * 1000 && // 1 hour
        memory.importanceScore < 0.7
      ) {
        this.warmMemoryCache.set(entry.key, memory;
        this.hotMemoryCache.delete(entry.key);
        demoted++;
      }
    });

    return { promoted, demoted };
  }

  private getMemoryCacheKey(memoryId: string {
    return `mem:${memoryId}`;
  }

  private getSearchCacheKey(searchKey: SearchCacheKey: string {
    return `search:${JSON.stringify(searchKey)}`;
  }

  private getEmbeddingCacheKey(text: string {
    // Use hash of text for more efficient key
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
    return `emb:${hash}`;
  }
}

// Singleton instance for global use
let globalCacheSystem: MemoryCacheSystem | null = null;

export function getCacheSystem(config?: any: MemoryCacheSystem {
  if (!globalCacheSystem) {
    globalCacheSystem = new MemoryCacheSystem(config);
  }
  return globalCacheSystem;
}

export function resetCacheSystem()): void {
  globalCacheSystem = null;
}

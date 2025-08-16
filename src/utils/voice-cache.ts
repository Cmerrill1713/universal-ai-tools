/**
 * Voice Response Cache
 * 
 * Implements an LRU cache for voice responses to improve performance
 * and reduce redundant processing.
 */

import { createHash } from 'crypto';

import { log, LogContext } from './logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
  lastAccessed: number;
}

export class VoiceResponseCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  
  constructor(
    private readonly maxSize: number = 100,
    private readonly ttlMs: number = 3600000 // 1 hour default
  ) {}

  /**
   * Generate cache key from request parameters - optimized for performance
   */
  private generateKey(params: Record<string, any>): string {
    // Use simple string concatenation for better performance
    const keys = Object.keys(params).sort();
    const parts: string[] = [];
    
    for (const key of keys) {
      const value = params[key];
      if (value !== undefined && value !== null) {
        parts.push(`${key}:${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
      }
    }
    
    const normalized = parts.join('|');
    // Use faster hashing for cache keys - no need for cryptographic security
    return createHash('sha1').update(normalized).digest('hex').substring(0, 12);
  }

  /**
   * Get item from cache
   */
  get(params: Record<string, any>): T | null {
    const key = this.generateKey(params);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      log.debug('Cache entry expired', LogContext.SYSTEM, { key });
      return null;
    }

    // Update access tracking
    entry.hits++;
    entry.lastAccessed = Date.now();
    this.updateAccessOrder(key);

    log.debug('Cache hit', LogContext.SYSTEM, { 
      key, 
      hits: entry.hits,
      age: Date.now() - entry.timestamp 
    });

    return entry.data;
  }

  /**
   * Set item in cache
   */
  set(params: Record<string, any>, data: T): void {
    const key = this.generateKey(params);
    
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
      lastAccessed: Date.now()
    });

    this.updateAccessOrder(key);

    log.debug('Cache set', LogContext.SYSTEM, { 
      key, 
      cacheSize: this.cache.size 
    });
  }

  /**
   * Clear specific entry or all entries
   */
  clear(params?: Record<string, any>): void {
    if (params) {
      const key = this.generateKey(params);
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      log.debug('Cache entry cleared', LogContext.SYSTEM, { key });
    } else {
      this.cache.clear();
      this.accessOrder = [];
      log.info('Cache cleared', LogContext.SYSTEM);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let totalHits = 0;
    let totalAge = 0;
    const now = Date.now();

    this.cache.forEach(entry => {
      totalHits += entry.hits;
      totalAge += now - entry.timestamp;
    });

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize) * 100,
      totalHits,
      averageHits: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      averageAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
      oldestEntry: this.accessOrder[0],
      newestEntry: this.accessOrder[this.accessOrder.length - 1]
    };
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder[0];
    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.accessOrder.shift();

      log.debug('Cache LRU eviction', LogContext.SYSTEM, { 
        evictedKey: keyToEvict 
      });
    }
  }
}

/**
 * Voice synthesis cache for TTS responses
 */
export class VoiceSynthesisCache extends VoiceResponseCache<{
  audioData: string;
  duration: number;
  format: string;
}> {
  constructor() {
    super(50, 7200000); // 50 entries, 2 hours TTL
  }

  /**
   * Get synthesized audio from cache
   */
  getSynthesizedAudio(text: string, voice: string, settings: any) {
    return this.get({ text, voice, ...settings });
  }

  /**
   * Cache synthesized audio
   */
  cacheSynthesizedAudio(
    text: string, 
    voice: string, 
    settings: any, 
    audioData: string,
    duration: number,
    format: string
  ) {
    this.set(
      { text, voice, ...settings },
      { audioData, duration, format }
    );
  }
}

/**
 * Transcription cache for STT results
 */
export class TranscriptionCache extends VoiceResponseCache<{
  text: string;
  confidence: number;
  language: string;
  segments?: any[];
}> {
  constructor() {
    super(100, 1800000); // 100 entries, 30 minutes TTL
  }

  /**
   * Get transcription from cache based on audio hash
   */
  getTranscription(audioHash: string, language: string) {
    return this.get({ audioHash, language });
  }

  /**
   * Cache transcription result
   */
  cacheTranscription(
    audioHash: string,
    language: string,
    text: string,
    confidence: number,
    segments?: any[]
  ) {
    this.set(
      { audioHash, language },
      { text, confidence, language, segments }
    );
  }
}

/**
 * Conversation response cache
 */
export class ConversationCache extends VoiceResponseCache<{
  response: string;
  confidence: number;
  metadata: any;
}> {
  constructor() {
    super(100, 300000); // 100 entries, 5 minutes TTL for faster voice responses
  }

  /**
   * Get cached conversation response
   */
  getResponse(
    text: string, 
    conversationId: string, 
    context: any
  ) {
    // Include context hash for cache key
    const contextHash = createHash('sha256')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    return this.get({ text, conversationId, contextHash });
  }

  /**
   * Cache conversation response
   */
  cacheResponse(
    text: string,
    conversationId: string,
    context: any,
    response: string,
    confidence: number,
    metadata: any
  ) {
    const contextHash = createHash('sha256')
      .update(JSON.stringify(context))
      .digest('hex')
      .substring(0, 8);
    
    this.set(
      { text, conversationId, contextHash },
      { response, confidence, metadata }
    );
  }
}

// Singleton instances
export const synthesisCache = new VoiceSynthesisCache();
export const transcriptionCache = new TranscriptionCache();
export const conversationCache = new ConversationCache();

/**
 * Voice cache manager for monitoring all caches
 */
export class VoiceCacheManager {
  private static instance: VoiceCacheManager;

  private constructor() {}

  static getInstance(): VoiceCacheManager {
    if (!VoiceCacheManager.instance) {
      VoiceCacheManager.instance = new VoiceCacheManager();
    }
    return VoiceCacheManager.instance;
  }

  /**
   * Get all cache statistics
   */
  getAllStats() {
    return {
      synthesis: synthesisCache.getStats(),
      transcription: transcriptionCache.getStats(),
      conversation: conversationCache.getStats(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    synthesisCache.clear();
    transcriptionCache.clear();
    conversationCache.clear();
    log.info('All voice caches cleared', LogContext.SYSTEM);
  }

  /**
   * Get cache hit rate
   */
  getHitRate() {
    const stats = this.getAllStats();
    const totalRequests = 
      stats.synthesis.totalHits + 
      stats.transcription.totalHits + 
      stats.conversation.totalHits;
    
    const totalSize = 
      stats.synthesis.size + 
      stats.transcription.size + 
      stats.conversation.size;

    return {
      overallHitRate: totalSize > 0 ? totalRequests / totalSize : 0,
      synthesisHitRate: stats.synthesis.averageHits,
      transcriptionHitRate: stats.transcription.averageHits,
      conversationHitRate: stats.conversation.averageHits
    };
  }
}

export const voiceCacheManager = VoiceCacheManager.getInstance();
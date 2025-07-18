import { Redis } from 'ioredis';
import { logger } from './logger';
import { performanceMonitor } from './performance-monitor';

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  namespace?: string;
  tags?: string[];
  retry?: number;
  fallback?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalRequests: number;
  avgResponseTime: number;
  memoryUsage: number;
  keyCount: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  successCount: number;
}

export class ImprovedCacheManager {
  private redis: Redis;
  private fallbackCache: Map<string, { value: any; expires: number; tags: string[] }>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    totalRequests: 0,
    avgResponseTime: 0,
    memoryUsage: 0,
    keyCount: 0,
  };
  private defaultTtl = 3600; // 1 hour
  private maxFallbackSize = 1000;
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
    successCount: 0,
  };
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerTimeout = 60000; // 1 minute
  private readonly halfOpenRequests = 3;
  private connectionRetryCount = 0;
  private maxConnectionRetries = 5;
  private isConnected = false;

  constructor(redisUrl: string) {
    this.fallbackCache = new Map();
    
    // Create Redis instance with improved configuration
    this.redis = new Redis(redisUrl, {
      // Connection pool settings
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false, // Connect immediately
      
      // Timeouts
      connectTimeout: 5000, // 5 seconds
      commandTimeout: 3000, // 3 seconds
      
      // Reconnection strategy with exponential backoff
      retryStrategy: (times: number) => {
        const maxDelay = 30000; // 30 seconds
        const baseDelay = 100;
        const delay = Math.min(baseDelay * Math.pow(2, times), maxDelay);
        
        if (times > this.maxConnectionRetries) {
          logger.error(`Redis connection failed after ${times} attempts`);
          // Don't stop retrying, but log the issue
        }
        
        logger.warn(`Redis reconnection attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      
      // Connection keep-alive
      keepAlive: 10000,
      
      // Enable offline queue
      enableOfflineQueue: true,
      
      // Connection pool size
      connectionName: 'universal-ai-cache',
    });

    this.setupEventListeners();
    this.setupHealthCheck();
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connecting...');
      this.connectionRetryCount = 0;
    });

    this.redis.on('ready', () => {
      logger.info('Redis connection ready');
      this.isConnected = true;
      this.resetCircuitBreaker();
    });

    this.redis.on('error', (error) => {
      logger.error('Redis error:', error);
      this.handleConnectionError();
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', (delay: number) => {
      logger.info(`Redis reconnecting in ${delay}ms`);
      this.connectionRetryCount++;
    });

    this.redis.on('end', () => {
      logger.error('Redis connection ended');
      this.isConnected = false;
    });
  }

  private setupHealthCheck(): void {
    // Periodic health check every 30 seconds
    setInterval(async () => {
      if (this.isConnected) {
        try {
          await this.redis.ping();
        } catch (error) {
          logger.error('Redis health check failed:', error);
          this.handleConnectionError();
        }
      }
    }, 30000);
  }

  private handleConnectionError(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }
  }

  private handleError(error: any): void {
    this.handleConnectionError();
  }

  private openCircuitBreaker(): void {
    this.circuitBreaker.state = 'OPEN';
    logger.warn('Redis circuit breaker opened due to repeated failures');
    
    // Schedule circuit breaker half-open after timeout
    setTimeout(() => {
      this.circuitBreaker.state = 'HALF_OPEN';
      this.circuitBreaker.successCount = 0;
      logger.info('Redis circuit breaker moved to half-open state');
    }, this.circuitBreakerTimeout);
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      state: 'CLOSED',
      successCount: 0,
    };
  }

  private async checkCircuitBreaker(): Promise<boolean> {
    if (this.circuitBreaker.state === 'OPEN') {
      const timeElapsed = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeElapsed < this.circuitBreakerTimeout) {
        return false;
      }
    }
    
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      // Allow limited requests in half-open state
      return this.circuitBreaker.successCount < this.halfOpenRequests;
    }
    
    return true;
  }

  private handleCircuitBreakerSuccess(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.successCount++;
      if (this.circuitBreaker.successCount >= this.halfOpenRequests) {
        this.resetCircuitBreaker();
        logger.info('Redis circuit breaker closed - connection restored');
      }
    }
  }

  private buildKey(key: string, namespace?: string): string {
    const prefix = namespace || 'universal-ai';
    return `${prefix}:${key}`;
  }

  private withNamespace(key: string, namespace?: string): string {
    return this.buildKey(key, namespace);
  }

  private async compress(value: any): Promise<string> {
    try {
      const zlib = require('zlib');
      const json = JSON.stringify(value);
      const compressed = zlib.gzipSync(json);
      return compressed.toString('base64');
    } catch (error) {
      logger.error('Compression error:', error);
      return JSON.stringify(value);
    }
  }

  private async decompress(value: string): Promise<any> {
    try {
      const zlib = require('zlib');
      const compressed = Buffer.from(value, 'base64');
      const decompressed = zlib.gunzipSync(compressed);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      // Try parsing as regular JSON if decompression fails
      try {
        return JSON.parse(value);
      } catch {
        logger.error('Decompression error:', error);
        throw error;
      }
    }
  }

  private updateStats(operation: 'hit' | 'miss' | 'set' | 'delete', responseTime: number): void {
    this.stats[operation === 'hit' ? 'hits' : operation === 'miss' ? 'misses' : operation === 'set' ? 'sets' : 'deletes']++;
    this.stats.totalRequests++;
    this.stats.avgResponseTime = (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + responseTime) / this.stats.totalRequests;
    this.stats.hitRate = this.stats.totalRequests > 0 ? (this.stats.hits / this.stats.totalRequests) * 100 : 0;
    
    performanceMonitor.recordCacheAccess(operation === 'hit');
  }

  private async useFallback(key: string, value?: any, ttl?: number): Promise<any> {
    const fullKey = this.buildKey(key);
    
    if (value !== undefined) {
      // Set operation
      if (this.fallbackCache.size >= this.maxFallbackSize) {
        // Remove oldest entries
        const entriesToRemove = Math.floor(this.maxFallbackSize * 0.1); // Remove 10%
        const keys = Array.from(this.fallbackCache.keys()).slice(0, entriesToRemove);
        keys.forEach(k => this.fallbackCache.delete(k));
      }
      
      this.fallbackCache.set(fullKey, {
        value,
        expires: Date.now() + (ttl || this.defaultTtl) * 1000,
        tags: [],
      });
      
      return value;
    } else {
      // Get operation
      const cached = this.fallbackCache.get(fullKey);
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }
      
      if (cached) {
        this.fallbackCache.delete(fullKey);
      }
      
      return null;
    }
  }

  public async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const startTime = process.hrtime();
    
    try {
      // Check circuit breaker
      if (!await this.checkCircuitBreaker()) {
        logger.debug('Redis circuit breaker is open, using fallback cache');
        const fallbackValue = await this.useFallback(key);
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const responseTime = seconds * 1000 + nanoseconds / 1000000;
        this.updateStats(fallbackValue !== null ? 'hit' : 'miss', responseTime);
        return fallbackValue;
      }

      const fullKey = this.buildKey(key, options.namespace);
      const value = await this.redis.get(fullKey);
      
      this.handleCircuitBreakerSuccess();
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      
      if (value !== null) {
        this.updateStats('hit', responseTime);
        return options.compress ? await this.decompress(value) : JSON.parse(value);
      } else {
        this.updateStats('miss', responseTime);
        return null;
      }
    } catch (error) {
      logger.error('Cache get error:', error);
      this.handleConnectionError();
      
      // Always try fallback on error
      const fallbackValue = await this.useFallback(key);
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats(fallbackValue !== null ? 'hit' : 'miss', responseTime);
      return fallbackValue;
    }
  }

  public async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const startTime = process.hrtime();
    
    // Always update fallback cache
    await this.useFallback(key, value, options.ttl);
    
    try {
      // Check circuit breaker
      if (!await this.checkCircuitBreaker()) {
        logger.debug('Redis circuit breaker is open, only using fallback cache');
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const responseTime = seconds * 1000 + nanoseconds / 1000000;
        this.updateStats('set', responseTime);
        return true; // Return true since fallback succeeded
      }

      const fullKey = this.buildKey(key, options.namespace);
      const ttl = options.ttl || this.defaultTtl;
      const serialized = options.compress ? await this.compress(value) : JSON.stringify(value);
      
      const multi = this.redis.multi();
      multi.setex(fullKey, ttl, serialized);
      
      // Add tags for bulk invalidation
      if (options.tags && options.tags.length > 0) {
        const tagKeys = options.tags.map(tag => this.buildKey(`tag:${tag}`, options.namespace));
        tagKeys.forEach(tagKey => {
          multi.sadd(tagKey, fullKey);
          multi.expire(tagKey, ttl);
        });
      }
      
      await multi.exec();
      
      this.handleCircuitBreakerSuccess();
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('set', responseTime);
      
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      this.handleConnectionError();
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('set', responseTime);
      
      // Return true since fallback succeeded
      return true;
    }
  }

  public async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    const startTime = process.hrtime();
    
    // Always remove from fallback cache
    const fullKey = this.buildKey(key, options.namespace);
    this.fallbackCache.delete(fullKey);
    
    try {
      // Check circuit breaker
      if (!await this.checkCircuitBreaker()) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const responseTime = seconds * 1000 + nanoseconds / 1000000;
        this.updateStats('delete', responseTime);
        return true;
      }

      const result = await this.redis.del(fullKey);
      
      this.handleCircuitBreakerSuccess();
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('delete', responseTime);
      
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', error);
      this.handleConnectionError();
      
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('delete', responseTime);
      return true; // Return true since fallback succeeded
    }
  }

  public async invalidateByTags(tags: string[], options: CacheOptions = {}): Promise<number> {
    try {
      if (!await this.checkCircuitBreaker()) {
        return 0;
      }

      let totalInvalidated = 0;
      
      for (const tag of tags) {
        const tagKey = this.buildKey(`tag:${tag}`, options.namespace);
        const keys = await this.redis.smembers(tagKey);
        
        if (keys.length > 0) {
          const deleted = await this.redis.del(...keys);
          totalInvalidated += deleted;
        }
        
        await this.redis.del(tagKey);
      }
      
      this.handleCircuitBreakerSuccess();
      
      return totalInvalidated;
    } catch (error) {
      logger.error('Cache invalidation error:', error);
      this.handleConnectionError();
      return 0;
    }
  }

  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (!await this.checkCircuitBreaker()) {
        const fullKey = this.buildKey(key, options.namespace);
        const cached = this.fallbackCache.get(fullKey);
        return cached !== undefined && cached.expires > Date.now();
      }

      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis.exists(fullKey);
      
      this.handleCircuitBreakerSuccess();
      
      return result > 0;
    } catch (error) {
      logger.error('Cache exists error:', error);
      this.handleConnectionError();
      
      // Check fallback
      const fullKey = this.buildKey(key, options.namespace);
      const cached = this.fallbackCache.get(fullKey);
      return cached !== undefined && cached.expires > Date.now();
    }
  }

  public async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      if (!await this.checkCircuitBreaker()) {
        return -1;
      }

      const fullKey = this.buildKey(key, options.namespace);
      const ttl = await this.redis.ttl(fullKey);
      
      this.handleCircuitBreakerSuccess();
      
      return ttl;
    } catch (error) {
      logger.error('Cache TTL error:', error);
      this.handleConnectionError();
      return -1;
    }
  }

  public async getStats(): Promise<CacheStats> {
    try {
      if (!await this.checkCircuitBreaker() || !this.isConnected) {
        // Return cached stats when Redis is unavailable
        this.stats.keyCount = this.fallbackCache.size;
        return { ...this.stats };
      }

      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      this.stats.memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      
      const keyCount = await this.redis.dbsize();
      this.stats.keyCount = keyCount;
      
      this.handleCircuitBreakerSuccess();
      
      return { ...this.stats };
    } catch (error) {
      logger.error('Cache stats error:', error);
      this.handleConnectionError();
      
      // Return fallback stats
      this.stats.keyCount = this.fallbackCache.size;
      return { ...this.stats };
    }
  }

  public async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = process.hrtime();
    
    try {
      if (this.circuitBreaker.state === 'OPEN') {
        return {
          healthy: false,
          latency: 0,
          error: 'Circuit breaker is open'
        };
      }

      await this.redis.ping();
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const latency = seconds * 1000 + nanoseconds / 1000000;
      
      this.handleCircuitBreakerSuccess();
      
      return { healthy: true, latency };
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const latency = seconds * 1000 + nanoseconds / 1000000;
      
      this.handleConnectionError();
      
      return { 
        healthy: false, 
        latency, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  public async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
    this.fallbackCache.clear();
  }

  // Utility methods for common caching patterns
  public async remember<T>(key: string, factory: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }
    
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  public async rememberForever<T>(key: string, factory: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    return this.remember(key, factory, { ...options, ttl: 0 });
  }

  public createCacheKey(...parts: (string | number)[]): string {
    return parts.join(':');
  }

  public getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  public isRedisConnected(): boolean {
    return this.isConnected && this.circuitBreaker.state === 'CLOSED';
  }

  /**
   * Flush all cache keys
   */
  public async flush(): Promise<void> {
    try {
      if (!await this.checkCircuitBreaker()) {
        logger.warn('Circuit breaker open, clearing fallback cache only');
        this.fallbackCache.clear();
        return;
      }

      await this.redis.flushdb();
      this.fallbackCache.clear();
      this.stats.deletes++;
      logger.info('Cache flushed successfully');
    } catch (error) {
      logger.error('Error flushing cache:', error);
      this.handleError(error);
      this.fallbackCache.clear();
    }
  }

  /**
   * Get multiple values at once
   */
  public async getMultiple<T = any>(keys: string[], options: CacheOptions = {}): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    try {
      if (!await this.checkCircuitBreaker()) {
        // Fallback to individual gets from fallback cache
        for (const key of keys) {
          const cached = this.fallbackCache.get(this.withNamespace(key, options.namespace));
          if (cached && cached.expires > Date.now()) {
            results.set(key, cached.value);
          } else {
            results.set(key, null);
          }
        }
        return results;
      }

      const namespacedKeys = keys.map(key => this.withNamespace(key, options.namespace));
      const values = await this.redis.mget(namespacedKeys);
      
      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            results.set(key, JSON.parse(value));
            this.stats.hits++;
          } catch {
            results.set(key, null);
            this.stats.misses++;
          }
        } else {
          results.set(key, null);
          this.stats.misses++;
        }
      });
      
      return results;
    } catch (error) {
      logger.error('Error getting multiple values:', error);
      this.handleError(error);
      
      // Return empty results on error
      keys.forEach(key => results.set(key, null));
      return results;
    }
  }

  /**
   * Set multiple values at once
   */
  public async setMultiple(entries: Array<[string, any, CacheOptions?]>): Promise<void> {
    try {
      if (!await this.checkCircuitBreaker()) {
        // Fallback to individual sets in fallback cache
        for (const [key, value, options = {}] of entries) {
          const ttl = options.ttl || this.defaultTtl;
          const expires = ttl > 0 ? Date.now() + (ttl * 1000) : Number.MAX_SAFE_INTEGER;
          this.fallbackCache.set(this.withNamespace(key, options.namespace), {
            value,
            expires,
            tags: options.tags || [],
          });
        }
        return;
      }

      const pipeline = this.redis.pipeline();
      
      for (const [key, value, options = {}] of entries) {
        const namespacedKey = this.withNamespace(key, options.namespace);
        const ttl = options.ttl || this.defaultTtl;
        const serialized = JSON.stringify(value);
        
        if (ttl > 0) {
          pipeline.setex(namespacedKey, ttl, serialized);
        } else {
          pipeline.set(namespacedKey, serialized);
        }
        
        // Handle tags
        if (options.tags && options.tags.length > 0) {
          for (const tag of options.tags) {
            pipeline.sadd(`tag:${tag}`, namespacedKey);
          }
        }
      }
      
      await pipeline.exec();
      this.stats.sets += entries.length;
    } catch (error) {
      logger.error('Error setting multiple values:', error);
      this.handleError(error);
    }
  }

  /**
   * Extend the TTL of a cached value
   */
  public async extend(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    try {
      if (!await this.checkCircuitBreaker()) {
        // Try to extend in fallback cache
        const namespacedKey = this.withNamespace(key, options.namespace);
        const cached = this.fallbackCache.get(namespacedKey);
        if (cached) {
          cached.expires = Date.now() + (ttl * 1000);
          return true;
        }
        return false;
      }

      const namespacedKey = this.withNamespace(key, options.namespace);
      const result = await this.redis.expire(namespacedKey, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Error extending cache TTL:', error);
      this.handleError(error);
      return false;
    }
  }
}

export default ImprovedCacheManager;
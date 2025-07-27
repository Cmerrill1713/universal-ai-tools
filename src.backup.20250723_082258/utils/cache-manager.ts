import { Redis } from 'ioredis';
import { logger } from './logger';
import { performanceMonitor } from './performance-monitor';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Compress large values
  namespace?: string; // Cache namespace
  tags?: string[]; // Cache tags for bulk invalidation
  retry?: number; // Retry attempts
  fallback?: boolean; // Use fallback cache on Redis failure
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

export class CacheManager {
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

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.fallbackCache = new Map();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected');
    });

    this.redis.on('_error, (_error => {
      logger.error'Redis _error', _error;
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready');
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  private buildKey(key: string, namespace?: string): string {
    const prefix = namespace || 'universal-ai';
    return `${prefix}:${key}`;
  }

  private async compress(value: any): Promise<string> {
    try {
      const zlib = require('zlib');
      const json = JSON.stringify(value);
      const compressed = zlib.gzipSync(json);
      return compressed.toString('base64');
    } catch (_error) {
      logger.error'Compression _error', _error;
      return JSON.stringify(value);
    }
  }

  private async decompress(value: string): Promise<unknown> {
    try {
      const zlib = require('zlib');
      const compressed = Buffer.from(value, 'base64');
      const decompressed = zlib.gunzipSync(compressed);
      return JSON.parse(decompressed.toString());
    } catch (_error) {
      logger.error'Decompression _error', _error;
      return JSON.parse(value);
    }
  }

  private updateStats(operation: 'hit' | 'miss' | 'set' | 'delete', responseTime: number): void {
    this.stats[
      operation === 'hit'
        ? 'hits'
        : operation === 'miss'
          ? 'misses'
          : operation === 'set'
            ? 'sets'
            : 'deletes'
    ]++;
    this.stats.totalRequests++;
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (this.stats.totalRequests - 1) + responseTime) /
      this.stats.totalRequests;
    this.stats.hitRate = (this.stats.hits / this.stats.totalRequests) * 100;

    performanceMonitor.recordCacheAccess(operation === 'hit');
  }

  private async useFallback(key: string, value?: any, ttl?: number): Promise<unknown> {
    const fullKey = this.buildKey(key);

    if (value !== undefined) {
      // Set operation
      if (this.fallbackCache.size >= this.maxFallbackSize) {
        const firstKey = this.fallbackCache.keys().next().value;
        if (firstKey) {
          this.fallbackCache.delete(firstKey);
        }
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
      const fullKey = this.buildKey(key, options.namespace);
      const value = await this.redis.get(fullKey);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;

      if (value !== null) {
        this.updateStats('hit', responseTime);
        return options.compress ? await this.decompress(value) : JSON.parse(value);
      } else {
        this.updateStats('miss', responseTime);
        return null;
      }
    } catch (_error) {
      logger.error'Cache get _error', _error;

      if (options.fallback !== false) {
        const fallbackValue = await this.useFallback(key);
        if (fallbackValue !== null) {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const responseTime = seconds * 1000 + nanoseconds / 1000000;
          this.updateStats('hit', responseTime);
          return fallbackValue;
        }
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('miss', responseTime);
      return null;
    }
  }

  public async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const startTime = process.hrtime();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      const ttl = options.ttl || this.defaultTtl;
      const serialized = options.compress ? await this.compress(value) : JSON.stringify(value);

      const multi = this.redis.multi();
      multi.setex(fullKey, ttl, serialized);

      // Add tags for bulk invalidation
      if (options.tags && options.tags.length > 0) {
        const tagKeys = options.tags.map((tag) => this.buildKey(`tag:${tag}`, options.namespace));
        tagKeys.forEach((tagKey) => {
          multi.sadd(tagKey, fullKey);
          multi.expire(tagKey, ttl);
        });
      }

      await multi.exec();

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('set', responseTime);

      return true;
    } catch (_error) {
      logger.error'Cache set _error', _error;

      if (options.fallback !== false) {
        await this.useFallback(key, value, options.ttl);
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('set', responseTime);
      return false;
    }
  }

  public async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    const startTime = process.hrtime();

    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis.del(fullKey);

      // Remove from fallback cache
      this.fallbackCache.delete(fullKey);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('delete', responseTime);

      return result > 0;
    } catch (_error) {
      logger.error'Cache delete _error', _error;

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('delete', responseTime);
      return false;
    }
  }

  public async invalidateByTags(tags: string[], options: CacheOptions = {}): Promise<number> {
    try {
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

      return totalInvalidated;
    } catch (_error) {
      logger.error'Cache invalidation _error', _error;
      return 0;
    }
  }

  public async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis.exists(fullKey);
      return result > 0;
    } catch (_error) {
      logger.error'Cache exists _error', _error;
      return false;
    }
  }

  public async ttl(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      return await this.redis.ttl(fullKey);
    } catch (_error) {
      logger.error'Cache TTL _error', _error;
      return -1;
    }
  }

  public async extend(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, options.namespace);
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (_error) {
      logger.error'Cache extend _error', _error;
      return false;
    }
  }

  public async getMultiple<T = any>(
    keys: string[],
    options: CacheOptions = {}
  ): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map((key) => this.buildKey(key, options.namespace));
      const values = await this.redis.mget(...fullKeys);

      return values.map((value) => {
        if (value !== null) {
          this.updateStats('hit', 0);
          return options.compress ? this.decompress(value) : JSON.parse(value);
        } else {
          this.updateStats('miss', 0);
          return null;
        }
      });
    } catch (_error) {
      logger.error'Cache getMultiple _error', _error;
      return keys.map(() => null);
    }
  }

  public async setMultiple(
    pairs: Array<{ key: string; value: any; ttl?: number }>,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const multi = this.redis.multi();

      for (const { key, value, ttl } of pairs) {
        const fullKey = this.buildKey(key, options.namespace);
        const serialized = options.compress ? await this.compress(value) : JSON.stringify(value);
        multi.setex(fullKey, ttl || options.ttl || this.defaultTtl, serialized);
      }

      await multi.exec();
      return true;
    } catch (_error) {
      logger.error'Cache setMultiple _error', _error;
      return false;
    }
  }

  public async flush(namespace?: string): Promise<boolean> {
    try {
      if (namespace) {
        const _pattern= this.buildKey('*', namespace);
        const keys = await this.redis.keys(_pattern;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } else {
        await this.redis.flushdb();
      }

      // Clear fallback cache
      this.fallbackCache.clear();

      return true;
    } catch (_error) {
      logger.error'Cache flush _error', _error;
      return false;
    }
  }

  public async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      this.stats.memoryUsage = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

      const keyCount = await this.redis.dbsize();
      this.stats.keyCount = keyCount;

      return { ...this.stats };
    } catch (_error) {
      logger.error'Cache stats _error', _error;
      return { ...this.stats };
    }
  }

  public async healthCheck(): Promise<{ healthy: boolean; latency: number; _error: string }> {
    const startTime = process.hrtime();

    try {
      await this.redis.ping();
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const latency = seconds * 1000 + nanoseconds / 1000000;

      return { healthy: true, latency };
    } catch (_error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const latency = seconds * 1000 + nanoseconds / 1000000;

      return {
        healthy: false,
        latency,
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      };
    }
  }

  public async close(): Promise<void> {
    await this.redis.quit();
    this.fallbackCache.clear();
  }

  // Utility methods for common caching patterns
  public async remember<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  public async rememberForever<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    return this.remember(key, factory, { ...options, ttl: 0 });
  }

  public createCacheKey(...parts: (string | number)[]): string {
    return parts.join(':');
  }
}

export default CacheManager;

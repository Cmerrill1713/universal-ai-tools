/**
 * Production Cache Manager
 * High-performance caching with Redis backend, compression, and intelligent eviction
 */

import { getRedisService } from './redis-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import { createHash } from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for group invalidation
  compress?: boolean; // Compress large values
  version?: string; // Cache version for validation
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  compressionRatio: number;
  memoryUsage: number;
}

export interface CacheEntry<T = any> {
  data: T;
  version: string;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
  compressed: boolean;
}

export class ProductionCacheManager {
  private static instance: ProductionCacheManager | null = null;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressionRatio: 0,
    memoryUsage: 0,
  };

  private readonly keyPrefix = 'uai:cache:';
  private readonly tagPrefix = 'uai:tags:';
  private readonly statsKey = 'uai:stats';
  private readonly compressionThreshold = 1024; // Compress if > 1KB

  static getInstance(): ProductionCacheManager {
    if (!ProductionCacheManager.instance) {
      ProductionCacheManager.instance = new ProductionCacheManager();
    }
    return ProductionCacheManager.instance;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const redis = getRedisService().getClient();
      const cacheKey = this.getCacheKey(key);

      const rawValue = await redis.get(cacheKey);
      if (!rawValue) {
        this.stats.misses++;
        await this.updateStats();
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(rawValue);

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key);
        this.stats.misses++;
        await this.updateStats();
        return null;
      }

      // Decompress if needed
      let { data } = entry;
      if (entry.compressed && typeof data === 'string') {
        const buffer = Buffer.from(data, 'base64');
        const decompressed = await gunzip(buffer);
        data = JSON.parse(decompressed.toString());
      }

      this.stats.hits++;
      await this.updateStats();

      logger.debug('Cache hit', LogContext.CACHE, { key, compressed: entry.compressed });
      return data;
    } catch (_error) {
      logger.error'Cache get _error, LogContext.CACHE, {
        key,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      this.stats.misses++;
      await this.updateStats();
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const redis = getRedisService().getClient();
      const cacheKey = this.getCacheKey(key);

      const entry: CacheEntry<T> = {
        data: value,
        version: options.version || '1.0',
        tags: options.tags || [],
        createdAt: Date.now(),
        expiresAt: options.ttl ? Date.now() + options.ttl * 1000 : undefined,
        compressed: false,
      };

      // Serialize data
      const serialized = JSON.stringify(entry.data);

      // Compress large values
      if (options.compress !== false && serialized.length > this.compressionThreshold) {
        const compressed = await gzip(serialized);
        entry.data = compressed.toString('base64') as any;
        entry.compressed = true;

        const originalSize = serialized.length;
        const compressedSize = compressed.length;
        this.stats.compressionRatio = (originalSize - compressedSize) / originalSize;

        logger.debug('Cache compression applied', LogContext.CACHE, {
          key,
          originalSize,
          compressedSize,
          ratio: this.stats.compressionRatio,
        });
      }

      const entryString = JSON.stringify(entry);

      // Set with TTL
      if (options.ttl) {
        await redis.setex(cacheKey, options.ttl, entryString);
      } else {
        await redis.set(cacheKey, entryString);
      }

      // Add to tag indexes
      if (options.tags && options.tags.length > 0) {
        await this.addToTagIndexes(key, options.tags);
      }

      await this.updateStats();

      logger.debug('Cache set', LogContext.CACHE, {
        key,
        ttl: options.ttl,
        tags: options.tags,
        compressed: entry.compressed,
      });

      return true;
    } catch (_error) {
      logger.error'Cache set _error, LogContext.CACHE, {
        key,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      return false;
    }
  }

  /**
   * Delete single key
   */
  async delete(key: string): Promise<boolean> {
    try {
      const redis = getRedisService().getClient();
      const cacheKey = this.getCacheKey(key);

      const result = await redis.del(cacheKey);

      if (result > 0) {
        this.stats.evictions++;
        await this.updateStats();
        logger.debug('Cache delete', LogContext.CACHE, { key });
      }

      return result > 0;
    } catch (_error) {
      logger.error'Cache delete _error, LogContext.CACHE, {
        key,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      return false;
    }
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      const redis = getRedisService().getClient();
      let totalDeleted = 0;

      for (const tag of tags) {
        const tagKey = this.getTagKey(tag);
        const keys = await redis.smembers(tagKey);

        if (keys.length > 0) {
          // Delete all keys with this tag
          const cacheKeys = keys.map((key) => this.getCacheKey(key));
          const deleted = await redis.del(...cacheKeys);
          totalDeleted += deleted;

          // Clean up tag index
          await redis.del(tagKey);
        }
      }

      if (totalDeleted > 0) {
        this.stats.evictions += totalDeleted;
        await this.updateStats();

        logger.info('Cache invalidated by tags', LogContext.CACHE, {
          tags,
          keysDeleted: totalDeleted,
        });
      }

      return totalDeleted;
    } catch (_error) {
      logger.error'Cache invalidate by tags _error, LogContext.CACHE, {
        tags,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      const redis = getRedisService().getClient();

      // Get all cache keys
      const keys = await redis.keys(`${this.keyPrefix}*`);
      const tagKeys = await redis.keys(`${this.tagPrefix}*`);

      const allKeys = [...keys, ...tagKeys];

      if (allKeys.length > 0) {
        await redis.del(...allKeys);
        this.stats.evictions += keys.length;
      }

      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        compressionRatio: 0,
        memoryUsage: 0,
      };

      await this.updateStats();

      logger.info('Cache cleared', LogContext.CACHE, { keysDeleted: allKeys.length });
      return true;
    } catch (_error) {
      logger.error'Cache clear _error, LogContext.CACHE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const redis = getRedisService().getClient();

      // Update memory usage
      const keys = await redis.keys(`${this.keyPrefix}*`);
      let totalMemory = 0;

      for (const key of keys.slice(0, 100)) {
        // Sample first 100 keys
        const size = await redis.memory('USAGE', key);
        totalMemory += size || 0;
      }

      this.stats.memoryUsage = totalMemory;
      await this.updateStats();

      return { ...this.stats };
    } catch (_error) {
      logger.error'Cache stats _error, LogContext.CACHE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      return { ...this.stats };
    }
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; _error: string }> {
    try {
      const start = Date.now();
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'test';

      await this.set(testKey, testValue, { ttl: 5 });
      const retrieved = await this.get(testKey);
      await this.delete(testKey);

      const latency = Date.now() - start;

      if (retrieved === testValue) {
        return { healthy: true, latency };
      } else {
        return { healthy: false, _error 'Value mismatch in health check' };
      }
    } catch (_error) {
      return {
        healthy: false,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      };
    }
  }

  private getCacheKey(key: string): string {
    // Create deterministic key with hash to handle long keys
    const hash = createHash('sha256').update(key).digest('hex').substring(0, 16);
    return `${this.keyPrefix}${hash}:${key.substring(0, 100)}`;
  }

  private getTagKey(tag: string): string {
    return `${this.tagPrefix}${tag}`;
  }

  private async addToTagIndexes(key: string, tags: string[]): Promise<void> {
    try {
      const redis = getRedisService().getClient();

      for (const tag of tags) {
        const tagKey = this.getTagKey(tag);
        await redis.sadd(tagKey, key);
        await redis.expire(tagKey, 86400); // Tag indexes expire in 24h
      }
    } catch (_error) {
      logger.warn('Failed to update tag indexes', LogContext.CACHE, {
        key,
        tags,
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
    }
  }

  private async updateStats(): Promise<void> {
    try {
      const redis = getRedisService().getClient();
      await redis.set(this.statsKey, JSON.stringify(this.stats), 'EX', 3600);
    } catch (_error) {
      // Silent fail for stats update
    }
  }
}

// Lazy initialization
let _cacheManager: ProductionCacheManager | null = null;

export function getCacheManager(): ProductionCacheManager {
  if (!_cacheManager) {
    _cacheManager = ProductionCacheManager.getInstance();
  }
  return _cacheManager;
}

// Export singleton instance
export const cacheManager = new Proxy({} as ProductionCacheManager, {
  get(target, prop) {
    return getCacheManager()[prop as keyof ProductionCacheManager];
  },
});

export default ProductionCacheManager;

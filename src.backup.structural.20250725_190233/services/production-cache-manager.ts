/**;
 * Production Cache Manager;
 * High-performance caching with Redis backend, compression, and intelligent eviction;
 */;

import { getRedisService } from './redis-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import { createHash } from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
const gzip = promisify(zlibgzip);
const gunzip = promisify(zlibgunzip);
export interface CacheOptions {;
  ttl?: number; // Time to live in seconds;
  tags?: string[]; // Cache tags for group invalidation;
  compress?: boolean; // Compress large values;
  version?: string, // Cache version for validation;
};

export interface CacheStats {;
  hits: number;
  misses: number;
  evictions: number;
  compressionRatio: number;
  memoryUsage: number;
};

export interface CacheEntry<T = any> {;
  data: T;
  version: string;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
  compressed: boolean;
};

export class ProductionCacheManager {;
  private static instance: ProductionCacheManager | null = null;
  private stats: CacheStats = {;
    hits: 0;
    misses: 0;
    evictions: 0;
    compressionRatio: 0;
    memoryUsage: 0;
};
  private readonly keyPrefix = 'uai:cache:';
  private readonly tagPrefix = 'uai:tags:';
  private readonly statsKey = 'uai:stats';
  private readonly compressionThreshold = 1024; // Compress if > 1KB;

  static getInstance(): ProductionCacheManager {;
    if (!ProductionCacheManagerinstance) {;
      ProductionCacheManagerinstance = new ProductionCacheManager()};
    return ProductionCacheManagerinstance;
  };

  /**;
   * Get value from cache;
   */;
  async get<T = any>(key: string): Promise<T | null> {;
    try {;
      const redis = getRedisService()getClient();
      const cacheKey = thisgetCacheKey(key);
      const rawValue = await redisget(cacheKey);
      if (!rawValue) {;
        thisstatsmisses++;
        await thisupdateStats();
        return null};

      const entry: CacheEntry<T> = JSONparse(rawValue);
      // Check expiration;
      if (entryexpiresAt && Datenow() > entryexpiresAt) {;
        await thisdelete(key);
        thisstatsmisses++;
        await thisupdateStats();
        return null};

      // Decompress if needed;
      let { data } = entry;
      if (entrycompressed && typeof data === 'string') {;
        const buffer = Bufferfrom(data, 'base64');
        const decompressed = await gunzip(buffer);
        data = JSONparse(decompressedtoString())};

      thisstatshits++;
      await thisupdateStats();
      loggerdebug('Cache hit', LogContextCACHE, { key, compressed: entrycompressed });
      return data;
    } catch (error) {;
      loggererror('Cache get error instanceof Error ? errormessage : String(error)  LogContextCACHE, {';
        key;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      thisstatsmisses++;
      await thisupdateStats();
      return null;
    };
  };

  /**;
   * Set value in cache;
   */;
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {;
    try {;
      const redis = getRedisService()getClient();
      const cacheKey = thisgetCacheKey(key),;

      const entry: CacheEntry<T> = {;
        data: value;
        version: optionsversion || '1.0';
        tags: optionstags || [];
        createdAt: Datenow();
        expiresAt: optionsttl ? Datenow() + optionsttl * 1000 : undefined;
        compressed: false;
};
      // Serialize data;
      const serialized = JSONstringify(entrydata);
      // Compress large values;
      if (optionscompress !== false && serializedlength > thiscompressionThreshold) {;
        const compressed = await gzip(serialized);
        entrydata = compressedtoString('base64') as any;
        entrycompressed = true;
        const originalSize = serializedlength;
        const compressedSize = compressedlength;
        thisstatscompressionRatio = (originalSize - compressedSize) / originalSize;

        loggerdebug('Cache compression applied', LogContextCACHE, {;
          key;
          originalSize;
          compressedSize;
          ratio: thisstatscompressionRatio});
      };

      const entryString = JSONstringify(entry);
      // Set with TTL;
      if (optionsttl) {;
        await redissetex(cacheKey, optionsttl, entryString)} else {;
        await redisset(cacheKey, entryString)};

      // Add to tag indexes;
      if (optionstags && optionstagslength > 0) {;
        await thisaddToTagIndexes(key, optionstags)};

      await thisupdateStats();
      loggerdebug('Cache set', LogContextCACHE, {;
        key;
        ttl: optionsttl;
        tags: optionstags;
        compressed: entrycompressed});
      return true;
    } catch (error) {;
      loggererror('Cache set error instanceof Error ? errormessage : String(error)  LogContextCACHE, {;
        key;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return false;
    };
  };

  /**;
   * Delete single key;
   */;
  async delete(key: string): Promise<boolean> {;
    try {;
      const redis = getRedisService()getClient();
      const cacheKey = thisgetCacheKey(key);
      const result = await redisdel(cacheKey);
      if (result > 0) {;
        thisstatsevictions++;
        await thisupdateStats();
        loggerdebug('Cache delete', LogContextCACHE, { key });
      };

      return result > 0;
    } catch (error) {;
      loggererror('Cache delete error instanceof Error ? errormessage : String(error)  LogContextCACHE, {;
        key;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return false;
    };
  };

  /**;
   * Invalidate by tags;
   */;
  async invalidateByTags(tags: string[]): Promise<number> {;
    try {;
      const redis = getRedisService()getClient();
      let totalDeleted = 0;
      for (const tag of tags) {;
        const tagKey = thisgetTagKey(tag);
        const keys = await redissmembers(tagKey);
        if (keyslength > 0) {;
          // Delete all keys with this tag;
          const cacheKeys = keysmap((key) => thisgetCacheKey(key));
          const deleted = await redisdel(..cacheKeys);
          totalDeleted += deleted;
          // Clean up tag index;
          await redisdel(tagKey)};
      };

      if (totalDeleted > 0) {;
        thisstatsevictions += totalDeleted;
        await thisupdateStats();

        loggerinfo('Cache invalidated by tags', LogContextCACHE, {;
          tags;
          keysDeleted: totalDeleted});
      };

      return totalDeleted;
    } catch (error) {;
      loggererror('Cache invalidate by tags error instanceof Error ? errormessage : String(error)  LogContextCACHE, {;
        tags;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return 0;
    };
  };

  /**;
   * Clear all cache;
   */;
  async clear(): Promise<boolean> {;
    try {;
      const redis = getRedisService()getClient(),;

      // Get all cache keys;
      const keys = await rediskeys(`${thiskeyPrefix}*`);
      const tagKeys = await rediskeys(`${thistagPrefix}*`);
      const allKeys = [..keys, ..tagKeys];
      if (allKeyslength > 0) {;
        await redisdel(..allKeys);
        thisstatsevictions += keyslength};

      // Reset stats;
      thisstats = {;
        hits: 0;
        misses: 0;
        evictions: 0;
        compressionRatio: 0;
        memoryUsage: 0;
};
      await thisupdateStats();
      loggerinfo('Cache cleared', LogContextCACHE, { keysDeleted: allKeyslength });
      return true;
    } catch (error) {;
      loggererror('Cache clear error instanceof Error ? errormessage : String(error)  LogContextCACHE, {;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return false;
    };
  };

  /**;
   * Get cache statistics;
   */;
  async getStats(): Promise<CacheStats> {;
    try {;
      const redis = getRedisService()getClient(),;

      // Update memory usage;
      const keys = await rediskeys(`${thiskeyPrefix}*`);
      let totalMemory = 0;
      for (const key of keysslice(0, 100)) {;
        // Sample first 100 keys;
        const size = await redismemory('USAGE', key);
        totalMemory += size || 0};

      thisstatsmemoryUsage = totalMemory;
      await thisupdateStats();
      return { ..thisstats };
    } catch (error) {;
      loggererror('Cache stats error instanceof Error ? errormessage : String(error)  LogContextCACHE, {;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      return { ..thisstats };
    };
  };

  /**;
   * Health check for cache system;
   */;
  async healthCheck(): Promise<{ healthy: boolean; latency?: number, error instanceof Error ? errormessage : String(error)  string }> {;
    try {;
      const start = Datenow(),;
      const testKey = `health_check_${Datenow()}`;
      const testValue = 'test';
      await thisset(testKey, testValue, { ttl: 5 });
      const retrieved = await thisget(testKey);
      await thisdelete(testKey);
      const latency = Datenow() - start;
      if (retrieved === testValue) {;
        return { healthy: true, latency };
      } else {;
        return { healthy: false, error instanceof Error ? errormessage : String(error) 'Value mismatch in health check' };
      };
    } catch (error) {;
      return {;
        healthy: false;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error);
};
    };
  };

  private getCacheKey(key: string): string {;
    // Create deterministic key with hash to handle long keys;
    const hash = createHash('sha256')update(key)digest('hex')substring(0, 16),;
    return `${thiskeyPrefix}${hash}:${keysubstring(0, 100)}`;
  };

  private getTagKey(tag: string): string {;
    return `${thistagPrefix}${tag}`;
  };

  private async addToTagIndexes(key: string, tags: string[]): Promise<void> {;
    try {;
      const redis = getRedisService()getClient();
      for (const tag of tags) {;
        const tagKey = thisgetTagKey(tag);
        await redissadd(tagKey, key);
        await redisexpire(tagKey, 86400); // Tag indexes expire in 24h};
    } catch (error) {;
      loggerwarn('Failed to update tag indexes', LogContextCACHE, {;
        key;
        tags;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
    };
  };

  private async updateStats(): Promise<void> {;
    try {;
      const redis = getRedisService()getClient();
      await redisset(thisstatsKey, JSONstringify(thisstats), 'EX', 3600)} catch (error) {;
      // Silent fail for stats update;
    };
  };
};

// Lazy initialization;
let _cacheManager: ProductionCacheManager | null = null;
export function getCacheManager(): ProductionCacheManager {;
  if (!_cacheManager) {;
    _cacheManager = ProductionCacheManagergetInstance()};
  return _cacheManager;
};

// Export singleton instance;
export const cacheManager = new Proxy({} as ProductionCacheManager, {;
  get(target, prop) {;
    return getCacheManager()[prop as keyof ProductionCacheManager]}});
export default ProductionCacheManager;
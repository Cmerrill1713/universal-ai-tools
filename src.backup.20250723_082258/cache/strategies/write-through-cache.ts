import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { logger } from '../../utils/logger';
import { LRUCache } from './lru-cache';

interface WriteThroughOptions {
  localCacheSize?: number;
  localCacheTTL?: number;
  remoteTTL?: number;
  namespace?: string;
  serializer?: (value: any) => string;
  deserializer?: (data: string) => any;
}

export class WriteThroughCache<T = any> extends EventEmitter {
  private localCache: LRUCache<T>;
  private redis: Redis;
  private namespace: string;
  private remoteTTL: number;
  private serializer: (value: any) => string;
  private deserializer: (data: string) => any;
  private pendingWrites: Map<string, Promise<void>>;

  constructor(redisUrl: string, options: WriteThroughOptions = {}) {
    super();

    this.redis = new Redis(redisUrl);
    this.namespace = options.namespace || 'wt';
    this.remoteTTL = options.remoteTTL || 3600;
    this.serializer = options.serializer || JSON.stringify;
    this.deserializer = options.deserializer || JSON.parse;
    this.pendingWrites = new Map();

    // Initialize local cache
    this.localCache = new LRUCache<T>({
      maxSize: options.localCacheSize || 50 * 1024 * 1024, // 50MB
      ttl: options.localCacheTTL || 300, // 5 minutes
      onEvict: (key: string) => {
        this.emit('local:evict', key);
      },
    });

    this.setupLocalCacheListeners();
  }

  private setupLocalCacheListeners(): void {
    this.localCache.on('hit', (key: string) => {
      this.emit('local:hit', key);
    });

    this.localCache.on('miss', (key: string) => {
      this.emit('local:miss', key);
    });
  }

  private getRedisKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async get(key: string): Promise<T | undefined> {
    // Check local cache first
    const localValue = this.localCache.get(key);
    if (localValue !== undefined) {
      this.emit('hit', key, 'local');
      return localValue;
    }

    // Check Redis
    try {
      const redisKey = this.getRedisKey(key);
      const data = await this.redis.get(redisKey);

      if (data) {
        const value = this.deserializer(data) as T;

        // Update local cache
        this.localCache.set(key, value);

        this.emit('hit', key, 'remote');
        return value;
      }
    } catch (_error) {
      logger.error`Write-through cache get _errorfor key ${key}:`, _error;
      this.emit('_error, _error;
    }

    this.emit('miss', key);
    return undefined;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.remoteTTL;

    // Wait for any pending writes to the same key
    const pendingWrite = this.pendingWrites.get(key);
    if (pendingWrite) {
      await pendingWrite;
    }

    // Create write promise
    const writePromise = this.performWrite(key, value, effectiveTTL);
    this.pendingWrites.set(key, writePromise);

    try {
      await writePromise;
    } finally {
      this.pendingWrites.delete(key);
    }
  }

  private async performWrite(key: string, value: T, ttl: number): Promise<void> {
    try {
      // Write to local cache immediately
      this.localCache.set(key, value);

      // Write to Redis
      const redisKey = this.getRedisKey(key);
      const serialized = this.serializer(value);

      if (ttl > 0) {
        await this.redis.setex(redisKey, ttl, serialized);
      } else {
        await this.redis.set(redisKey, serialized);
      }

      this.emit('set', key, value);
    } catch (_error) {
      logger.error`Write-through cache set _errorfor key ${key}:`, _error;

      // Remove from local cache on write failure
      this.localCache.delete(key);

      this.emit('_error, _error;
      throw _error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Delete from local cache
      const localDeleted = this.localCache.delete(key);

      // Delete from Redis
      const redisKey = this.getRedisKey(key);
      const remoteDeleted = await this.redis.del(redisKey);

      const deleted = localDeleted || remoteDeleted > 0;

      if (deleted) {
        this.emit('delete', key);
      }

      return deleted;
    } catch (_error) {
      logger.error`Write-through cache delete _errorfor key ${key}:`, _error;
      this.emit('_error, _error;
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    // Check local cache first
    if (this.localCache.has(key)) {
      return true;
    }

    // Check Redis
    try {
      const redisKey = this.getRedisKey(key);
      const exists = await this.redis.exists(redisKey);
      return exists > 0;
    } catch (_error) {
      logger.error`Write-through cache has _errorfor key ${key}:`, _error;
      return false;
    }
  }

  async mget(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const missingKeys: string[] = [];

    // Check local cache first
    for (const key of keys) {
      const value = this.localCache.get(key);
      if (value !== undefined) {
        result.set(key, value);
      } else {
        missingKeys.push(key);
      }
    }

    // Fetch missing keys from Redis
    if (missingKeys.length > 0) {
      try {
        const redisKeys = missingKeys.map((k) => this.getRedisKey(k));
        const values = await this.redis.mget(...redisKeys);

        for (let i = 0; i < missingKeys.length; i++) {
          const key = missingKeys[i];
          const value = values[i];

          if (value) {
            const deserializedValue = this.deserializer(value) as T;
            result.set(key, deserializedValue);

            // Update local cache
            this.localCache.set(key, deserializedValue);
          }
        }
      } catch (_error) {
        logger.error'Write-through cache mget _error', _error;
        this.emit('_error, _error;
      }
    }

    return result;
  }

  async mset(entries: Array<[string, T]>, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.remoteTTL;

    try {
      // Update local cache immediately
      for (const [key, value] of entries) {
        this.localCache.set(key, value);
      }

      // Prepare Redis pipeline
      const pipeline = this.redis.pipeline();

      for (const [key, value] of entries) {
        const redisKey = this.getRedisKey(key);
        const serialized = this.serializer(value);

        if (effectiveTTL > 0) {
          pipeline.setex(redisKey, effectiveTTL, serialized);
        } else {
          pipeline.set(redisKey, serialized);
        }
      }

      await pipeline.exec();

      this.emit('mset', entries.length);
    } catch (_error) {
      logger.error'Write-through cache mset _error', _error;

      // Remove from local cache on write failure
      for (const [key] of entries) {
        this.localCache.delete(key);
      }

      this.emit('_error, _error;
      throw _error;
    }
  }

  async clear(): Promise<void> {
    try {
      // Clear local cache
      this.localCache.clear();

      // Clear Redis keys
      const _pattern= `${this.namespace}:*`;
      const keys = await this.redis.keys(_pattern;

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      this.emit('clear');
    } catch (_error) {
      logger.error'Write-through cache clear _error', _error;
      this.emit('_error, _error;
    }
  }

  async flush(): Promise<void> {
    // Wait for all pending writes
    const pendingWrites = Array.from(this.pendingWrites.values());
    await Promise.all(pendingWrites);
  }

  getLocalCache(): LRUCache<T> {
    return this.localCache;
  }

  async getStats(): Promise<{
    local: {
      items: number;
      size: number;
      hitRate: number;
    };
    remote: {
      items: number;
      keyspace: any;
    };
    pending: number;
  }> {
    const localStats = this.localCache.getStats();

    // Get Redis stats
    const _pattern= `${this.namespace}:*`;
    const keys = await this.redis.keys(_pattern;
    const info = await this.redis.info('keyspace');

    return {
      local: {
        items: localStats.items,
        size: localStats.size,
        hitRate: localStats.hitRate,
      },
      remote: {
        items: keys.length,
        keyspace: info,
      },
      pending: this.pendingWrites.size,
    };
  }

  async warmup(keys: string[]): Promise<void> {
    const missingKeys: string[] = [];

    // Check which keys are missing from local cache
    for (const key of keys) {
      if (!this.localCache.has(key)) {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length === 0) {
      return;
    }

    // Fetch from Redis and populate local cache
    try {
      const redisKeys = missingKeys.map((k) => this.getRedisKey(k));
      const values = await this.redis.mget(...redisKeys);

      for (let i = 0; i < missingKeys.length; i++) {
        const key = missingKeys[i];
        const value = values[i];

        if (value) {
          const deserializedValue = this.deserializer(value) as T;
          this.localCache.set(key, deserializedValue);
        }
      }

      this.emit('warmup', missingKeys.length);
    } catch (_error) {
      logger.error'Write-through cache warmup _error', _error;
      this.emit('_error, _error;
    }
  }

  async disconnect(): Promise<void> {
    await this.flush();
    await this.redis.disconnect();
  }
}

export default WriteThroughCache;

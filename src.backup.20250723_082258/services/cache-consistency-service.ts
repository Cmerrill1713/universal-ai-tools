import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface CacheOptions {
  ttl?: number;
  tags?: string[];
  version?: string;
  compress?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  compressionRatio: number;
}

interface CacheEntry<T = any> {
  data: T;
  version: string;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
  compressed: boolean;
  checksum: string;
}

export class CacheConsistencyService extends EventEmitter {
  private redis: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private stats: Map<string, CacheStats>;
  private warmupQueue: Set<string>;
  private readonly CACHE_PREFIX = 'uai:cache:';
  private readonly TAG_PREFIX = 'uai:tag:';
  private readonly VERSION_PREFIX = 'uai:version:';
  private readonly STATS_PREFIX = 'uai:stats:';
  private readonly INVALIDATION_CHANNEL = 'uai:cache:invalidation';

  constructor(redisUrl: string) {
    super();
    this.redis = new Redis(redisUrl);
    this.pubClient = new Redis(redisUrl);
    this.subClient = new Redis(redisUrl);
    this.stats = new Map();
    this.warmupQueue = new Set();

    this.initializeSubscriptions();
    this.startStatsReporting();
  }

  private initializeSubscriptions(): void {
    this.subClient.subscribe(this.INVALIDATION_CHANNEL);

    this.subClient.on('message', async (channel, message) => {
      if (channel === this.INVALIDATION_CHANNEL) {
        const { _pattern tags, version } = JSON.parse(message);
        await this.handleRemoteInvalidation(_pattern tags, version);
      }
    });
  }

  private startStatsReporting(): void {
    setInterval(() => {
      this.persistStats();
    }, 60000); // Every minute
  }

  private async persistStats(): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const [key, stats] of this.stats.entries()) {
      pipeline.hset(
        `${this.STATS_PREFIX}${key}`,
        'hits',
        stats.hits,
        'misses',
        stats.misses,
        'evictions',
        stats.evictions,
        'compressionRatio',
        stats.compressionRatio
      );
    }

    await pipeline.exec();
  }

  private generateChecksum(data: any): string {
    const _content= typeof data === 'string' ? data : JSON.stringify(data);
    return createHash('sha256').update(_content.digest('hex');
  }

  private async compress(data: Buffer): Promise<Buffer> {
    return gzip(data);
  }

  private async decompress(data: Buffer): Promise<Buffer> {
    return gunzip(data);
  }

  private updateStats(key: string, hit: boolean, compressionRatio?: number): void {
    const stats = this.stats.get(key) || {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressionRatio: 1,
    };

    if (hit) {
      stats.hits++;
    } else {
      stats.misses++;
    }

    if (compressionRatio !== undefined) {
      stats.compressionRatio = compressionRatio;
    }

    this.stats.set(key, stats);
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const fullKey = `${this.CACHE_PREFIX}${key}`;

    try {
      const cached = await this.redis.get(fullKey);

      if (!cached) {
        this.updateStats(key, false);
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);

      // Version check
      if (options.version && entry.version !== options.version) {
        await this.delete(key);
        this.updateStats(key, false);
        return null;
      }

      // Expiration check
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key);
        this.updateStats(key, false);
        return null;
      }

      let { data } = entry;

      // Decompress if needed
      if (entry.compressed) {
        const compressed = Buffer.from(data as any, 'base64');
        const decompressed = await this.decompress(compressed);
        data = JSON.parse(decompressed.toString());
      }

      // Verify checksum
      const checksum = this.generateChecksum(data);
      if (checksum !== entry.checksum) {
        logger.warn(`Cache checksum mismatch for key: ${key}`);
        await this.delete(key);
        return null;
      }

      this.updateStats(key, true);
      this.emit('cache:hit', { key, tags: entry.tags });

      return data;
    } catch (_error) {
      logger.error'Cache get _error', _error;
      this.updateStats(key, false);
      return null;
    }
  }

  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = `${this.CACHE_PREFIX}${key}`;
    const { ttl = 3600, tags = [], version = '1.0', compress = true } = options;

    try {
      let serializedData: any = data;
      let compressed = false;
      let compressionRatio = 1;

      // Compress large data
      if (compress && JSON.stringify(data).length > 1024) {
        const original = Buffer.from(JSON.stringify(data));
        const compressedData = await this.compress(original);
        compressionRatio = original.length / compressedData.length;
        serializedData = compressedData.toString('base64');
        compressed = true;
      }

      const entry: CacheEntry<T> = {
        data: serializedData,
        version,
        tags,
        createdAt: Date.now(),
        expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : undefined,
        compressed,
        checksum: this.generateChecksum(data),
      };

      const pipeline = this.redis.pipeline();

      // Set the cache entry
      if (ttl > 0) {
        pipeline.setex(fullKey, ttl, JSON.stringify(entry));
      } else {
        pipeline.set(fullKey, JSON.stringify(entry));
      }

      // Update tag mappings
      for (const tag of tags) {
        pipeline.sadd(`${this.TAG_PREFIX}${tag}`, key);
      }

      // Update version mapping
      pipeline.sadd(`${this.VERSION_PREFIX}${version}`, key);

      await pipeline.exec();

      this.updateStats(key, true, compressionRatio);
      this.emit('cache:set', { key, tags, version });
    } catch (_error) {
      logger.error'Cache set _error', _error;
      throw _error;
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = `${this.CACHE_PREFIX}${key}`;

    try {
      const cached = await this.redis.get(fullKey);
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);

        const pipeline = this.redis.pipeline();

        // Remove from tags
        for (const tag of entry.tags) {
          pipeline.srem(`${this.TAG_PREFIX}${tag}`, key);
        }

        // Remove from version
        pipeline.srem(`${this.VERSION_PREFIX}${entry.version}`, key);

        // Delete the key
        pipeline.del(fullKey);

        await pipeline.exec();

        this.emit('cache:delete', { key, tags: entry.tags });
      }
    } catch (_error) {
      logger.error'Cache delete _error', _error;
    }
  }

  async invalidate(_pattern: string, tags?: string[], version?: string): Promise<void> {
    const keysToInvalidate = new Set<string>();

    try {
      // Pattern-based invalidation
      if (_pattern {
        const keys = await this.redis.keys(`${this.CACHE_PREFIX}${_pattern`);
        keys.forEach((key) => keysToInvalidate.add(key.replace(this.CACHE_PREFIX, '')));
      }

      // Tag-based invalidation
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          const keys = await this.redis.smembers(`${this.TAG_PREFIX}${tag}`);
          keys.forEach((key) => keysToInvalidate.add(key));
        }
      }

      // Version-based invalidation
      if (version) {
        const keys = await this.redis.smembers(`${this.VERSION_PREFIX}${version}`);
        keys.forEach((key) => keysToInvalidate.add(key));
      }

      // Delete all matching keys
      const pipeline = this.redis.pipeline();
      for (const key of keysToInvalidate) {
        await this.delete(key);
      }

      // Publish invalidation event for distributed cache sync
      await this.pubClient.publish(
        this.INVALIDATION_CHANNEL,
        JSON.stringify({ _pattern tags, version })
      );

      this.emit('cache:invalidate', {
        _pattern
        tags,
        version,
        count: keysToInvalidate.size,
      });
    } catch (_error) {
      logger.error'Cache invalidation _error', _error;
    }
  }

  private async handleRemoteInvalidation(
    _pattern: string,
    tags?: string[],
    version?: string
  ): Promise<void> {
    // Handle invalidation from other instances
    await this.invalidate(_pattern tags, version);
  }

  async warmup(keys: string[], fetcher: (key: string) => Promise<unknown>): Promise<void> {
    const warmupPromises = keys.map(async (key) => {
      if (this.warmupQueue.has(key)) {
        return; // Already warming up
      }

      this.warmupQueue.add(key);

      try {
        const existing = await this.get(key);
        if (!existing) {
          const data = await fetcher(key);
          if (data) {
            await this.set(key, data);
          }
        }
      } catch (_error) {
        logger.error`Cache warmup _errorfor key ${key}:`, _error;
      } finally {
        this.warmupQueue.delete(key);
      }
    });

    await Promise.all(warmupPromises);
    this.emit('cache:warmup', { keys, count: keys.length });
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      // Clear tags and versions
      const tagKeys = await this.redis.keys(`${this.TAG_PREFIX}*`);
      const versionKeys = await this.redis.keys(`${this.VERSION_PREFIX}*`);

      if (tagKeys.length > 0) {
        await this.redis.del(...tagKeys);
      }

      if (versionKeys.length > 0) {
        await this.redis.del(...versionKeys);
      }

      this.stats.clear();
      this.emit('cache:clear');
    } catch (_error) {
      logger.error'Cache clear _error', _error;
    }
  }

  async getStats(key?: string): Promise<CacheStats | Map<string, CacheStats>> {
    if (key) {
      const stats = this.stats.get(key);
      if (stats) {
        return stats;
      }

      // Try to load from Redis
      const persisted = await this.redis.hgetall(`${this.STATS_PREFIX}${key}`);
      if (persisted && Object.keys(persisted).length > 0) {
        return {
          hits: parseInt(persisted.hits || '0', 10),
          misses: parseInt(persisted.misses || '0', 10),
          evictions: parseInt(persisted.evictions || '0', 10),
          compressionRatio: parseFloat(persisted.compressionRatio || '1'),
        };
      }

      return {
        hits: 0,
        misses: 0,
        evictions: 0,
        compressionRatio: 1,
      };
    }

    return this.stats;
  }

  async disconnect(): Promise<void> {
    await this.persistStats();
    this.redis.disconnect();
    this.pubClient.disconnect();
    this.subClient.disconnect();
  }
}

export default CacheConsistencyService;

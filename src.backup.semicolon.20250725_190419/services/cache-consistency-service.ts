import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import { logger } from '../utils/logger';
const gzip = promisify(zlibgzip);
const gunzip = promisify(zlibgunzip);
interface CacheOptions {;
  ttl?: number;
  tags?: string[];
  version?: string;
  compress?: boolean;
;
};

interface CacheStats {;
  hits: number;
  misses: number;
  evictions: number;
  compressionRatio: number;
;
};

interface CacheEntry<T = any> {;
  data: T;
  version: string;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
  compressed: boolean;
  checksum: string;
;
};

export class CacheConsistencyService extends EventEmitter {;
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
  constructor(redisUrl: string) {;
    super();
    thisredis = new Redis(redisUrl);
    thispubClient = new Redis(redisUrl);
    thissubClient = new Redis(redisUrl);
    thisstats = new Map();
    thiswarmupQueue = new Set();
    thisinitializeSubscriptions();
    thisstartStatsReporting();
  };

  private initializeSubscriptions(): void {;
    thissubClientsubscribe(thisINVALIDATION_CHANNEL);
    thissubClienton('message', async (channel, message) => {;
      if (channel === thisINVALIDATION_CHANNEL) {;
        const { _pattern tags, version } = JSONparse(message);
        await thishandleRemoteInvalidation(_pattern tags, version);
      };
    });
  };

  private startStatsReporting(): void {;
    setInterval(() => {;
      thispersistStats();
    }, 60000); // Every minute;
  };

  private async persistStats(): Promise<void> {;
    const pipeline = thisredispipeline();
    for (const [key, stats] of thisstatsentries()) {;
      pipelinehset(;
        `${thisSTATS_PREFIX}${key}`;
        'hits';
        statshits;
        'misses';
        statsmisses;
        'evictions';
        statsevictions;
        'compressionRatio';
        statscompressionRatio;
      );
    };

    await pipelineexec();
  };

  private generateChecksum(data: any): string {;
    const content typeof data === 'string' ? data : JSONstringify(data);
    return createHash('sha256')update(contentdigest('hex');
  };

  private async compress(data: Buffer): Promise<Buffer> {;
    return gzip(data);
  };

  private async decompress(data: Buffer): Promise<Buffer> {;
    return gunzip(data);
  };

  private updateStats(key: string, hit: boolean, compressionRatio?: number): void {;
    const stats = thisstatsget(key) || {;
      hits: 0;
      misses: 0;
      evictions: 0;
      compressionRatio: 1;
    ;
};
    if (hit) {;
      statshits++;
    } else {;
      statsmisses++;
    };

    if (compressionRatio !== undefined) {;
      statscompressionRatio = compressionRatio;
    };

    thisstatsset(key, stats);
  };

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {;
    const fullKey = `${thisCACHE_PREFIX}${key}`;
    try {;
      const cached = await thisredisget(fullKey);
      if (!cached) {;
        thisupdateStats(key, false);
        return null;
      };

      const entry: CacheEntry<T> = JSONparse(cached);
      // Version check;
      if (optionsversion && entryversion !== optionsversion) {;
        await thisdelete(key);
        thisupdateStats(key, false);
        return null;
      };

      // Expiration check;
      if (entryexpiresAt && Datenow() > entryexpiresAt) {;
        await thisdelete(key);
        thisupdateStats(key, false);
        return null;
      };

      let { data } = entry;
      // Decompress if needed;
      if (entrycompressed) {;
        const compressed = Bufferfrom(data as any, 'base64');
        const decompressed = await thisdecompress(compressed);
        data = JSONparse(decompressedtoString());
      };

      // Verify checksum;
      const checksum = thisgenerateChecksum(data);
      if (checksum !== entrychecksum) {;
        loggerwarn(`Cache checksum mismatch for key: ${key}`);
        await thisdelete(key);
        return null;
      };

      thisupdateStats(key, true);
      thisemit('cache:hit', { key, tags: entrytags });
      return data;
    } catch (error) {;
      loggererror('Cache get error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      thisupdateStats(key, false);
      return null;
    };
  };

  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {;
    const fullKey = `${thisCACHE_PREFIX}${key}`;
    const { ttl = 3600, tags = [], version = '1.0', compress = true } = options;
    try {;
      let serializedData: any = data;
      let compressed = false;
      let compressionRatio = 1;
      // Compress large data;
      if (compress && JSONstringify(data)length > 1024) {;
        const original = Bufferfrom(JSONstringify(data));
        const compressedData = await thiscompress(original);
        compressionRatio = originallength / compressedDatalength;
        serializedData = compressedDatatoString('base64');
        compressed = true;
      };

      const entry: CacheEntry<T> = {;
        data: serializedData;
        version;
        tags;
        createdAt: Datenow();
        expiresAt: ttl > 0 ? Datenow() + ttl * 1000 : undefined;
        compressed;
        checksum: thisgenerateChecksum(data);
      ;
};
      const pipeline = thisredispipeline();
      // Set the cache entry;
      if (ttl > 0) {;
        pipelinesetex(fullKey, ttl, JSONstringify(entry));
      } else {;
        pipelineset(fullKey, JSONstringify(entry));
      };

      // Update tag mappings;
      for (const tag of tags) {;
        pipelinesadd(`${thisTAG_PREFIX}${tag}`, key);
      };

      // Update version mapping;
      pipelinesadd(`${thisVERSION_PREFIX}${version}`, key);
      await pipelineexec();
      thisupdateStats(key, true, compressionRatio);
      thisemit('cache:set', { key, tags, version });
    } catch (error) {;
      loggererror('Cache set error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      throw error instanceof Error ? errormessage : String(error);
    };
  };

  async delete(key: string): Promise<void> {;
    const fullKey = `${thisCACHE_PREFIX}${key}`;
    try {;
      const cached = await thisredisget(fullKey);
      if (cached) {;
        const entry: CacheEntry = JSONparse(cached);
        const pipeline = thisredispipeline();
        // Remove from tags;
        for (const tag of entrytags) {;
          pipelinesrem(`${thisTAG_PREFIX}${tag}`, key);
        };

        // Remove from version;
        pipelinesrem(`${thisVERSION_PREFIX}${entryversion}`, key);
        // Delete the key;
        pipelinedel(fullKey);
        await pipelineexec();
        thisemit('cache:delete', { key, tags: entrytags });
      };
    } catch (error) {;
      loggererror('Cache delete error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error)  ;
};
  };

  async invalidate(_pattern: string, tags?: string[], version?: string): Promise<void> {;
    const keysToInvalidate = new Set<string>();
    try {;
      // Pattern-based invalidation;
      if (_pattern {;
        const keys = await thisrediskeys(`${thisCACHE_PREFIX}${_pattern`);
        keysforEach((key) => keysToInvalidateadd(keyreplace(thisCACHE_PREFIX, '')));
      };

      // Tag-based invalidation;
      if (tags && tagslength > 0) {;
        for (const tag of tags) {;
          const keys = await thisredissmembers(`${thisTAG_PREFIX}${tag}`);
          keysforEach((key) => keysToInvalidateadd(key));
        };
      };

      // Version-based invalidation;
      if (version) {;
        const keys = await thisredissmembers(`${thisVERSION_PREFIX}${version}`);
        keysforEach((key) => keysToInvalidateadd(key));
      };

      // Delete all matching keys;
      const pipeline = thisredispipeline();
      for (const key of keysToInvalidate) {;
        await thisdelete(key);
      };

      // Publish invalidation event for distributed cache sync;
      await thispubClientpublish(;
        thisINVALIDATION_CHANNEL;
        JSONstringify({ _pattern tags, version });
      );
      thisemit('cache:invalidate', {;
        _pattern;
        tags;
        version;
        count: keysToInvalidatesize;
      });
    } catch (error) {;
      loggererror('Cache invalidation error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error)  ;
};
  };

  private async handleRemoteInvalidation(;
    _pattern: string;
    tags?: string[];
    version?: string;
  ): Promise<void> {;
    // Handle invalidation from other instances;
    await thisinvalidate(_pattern tags, version);
  };

  async warmup(keys: string[], fetcher: (key: string) => Promise<unknown>): Promise<void> {;
    const warmupPromises = keysmap(async (key) => {;
      if (thiswarmupQueuehas(key)) {;
        return; // Already warming up;
      };

      thiswarmupQueueadd(key);
      try {;
        const existing = await thisget(key);
        if (!existing) {;
          const data = await fetcher(key);
          if (data) {;
            await thisset(key, data);
          };
        };
      } catch (error) {;
        loggererror`Cache warmup error for key ${key}:`, error instanceof Error ? errormessage : String(error);
      } finally {;
        thiswarmupQueuedelete(key);
      };
    });
    await Promiseall(warmupPromises);
    thisemit('cache:warmup', { keys, count: keyslength });
  };

  async clear(): Promise<void> {;
    try {;
      const keys = await thisrediskeys(`${thisCACHE_PREFIX}*`);
      if (keyslength > 0) {;
        await thisredisdel(..keys);
      };

      // Clear tags and versions;
      const tagKeys = await thisrediskeys(`${thisTAG_PREFIX}*`);
      const versionKeys = await thisrediskeys(`${thisVERSION_PREFIX}*`);
      if (tagKeyslength > 0) {;
        await thisredisdel(..tagKeys);
      };

      if (versionKeyslength > 0) {;
        await thisredisdel(..versionKeys);
      };

      thisstatsclear();
      thisemit('cache:clear');
    } catch (error) {;
      loggererror('Cache clear error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error)  ;
};
  };

  async getStats(key?: string): Promise<CacheStats | Map<string, CacheStats>> {;
    if (key) {;
      const stats = thisstatsget(key);
      if (stats) {;
        return stats;
      };

      // Try to load from Redis;
      const persisted = await thisredishgetall(`${thisSTATS_PREFIX}${key}`);
      if (persisted && Objectkeys(persisted)length > 0) {;
        return {;
          hits: parseInt(persistedhits || '0', 10);
          misses: parseInt(persistedmisses || '0', 10);
          evictions: parseInt(persistedevictions || '0', 10);
          compressionRatio: parseFloat(persistedcompressionRatio || '1');
        ;
};
      };

      return {;
        hits: 0;
        misses: 0;
        evictions: 0;
        compressionRatio: 1;
      ;
};
    };

    return thisstats;
  };

  async disconnect(): Promise<void> {;
    await thispersistStats();
    thisredisdisconnect();
    thispubClientdisconnect();
    thissubClientdisconnect();
  ;
};
};

export default CacheConsistencyService;
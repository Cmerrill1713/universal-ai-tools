import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { logger } from '../../utils/logger';
import { LRUCache } from './lru-cache';
interface WriteBehindOptions {;
  localCacheSize?: number;
  localCacheTTL?: number;
  remoteTTL?: number;
  namespace?: string;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  serializer?: (value: any) => string;
  deserializer?: (data: string) => any;
  onWriteError?: (error instanceof Error ? errormessage : String(error) Error, batch: WriteOperation[]) => void;
;
};

interface WriteOperation {;
  key: string;
  value: any;
  ttl: number;
  timestamp: number;
  retries: number;
;
};

export class WriteBehindCache<T = any> extends EventEmitter {;
  private localCache: LRUCache<T>;
  private redis: Redis;
  private namespace: string;
  private remoteTTL: number;
  private batchSize: number;
  private flushInterval: number;
  private maxRetries: number;
  private retryDelay: number;
  private serializer: (value: any) => string;
  private deserializer: (data: string) => any;
  private onWriteError?: (error instanceof Error ? errormessage : String(error) Error, batch: WriteOperation[]) => void;
  private writeQueue: Map<string, WriteOperation>;
  private flushTimer?: NodeJSTimeout;
  private isShuttingDown = false;
  constructor(redisUrl: string, options: WriteBehindOptions = {}) {;
    super();
    thisredis = new Redis(redisUrl);
    thisnamespace = optionsnamespace || 'wb';
    thisremoteTTL = optionsremoteTTL || 3600;
    thisbatchSize = optionsbatchSize || 100;
    thisflushInterval = optionsflushInterval || 5000; // 5 seconds;
    thismaxRetries = optionsmaxRetries || 3;
    thisretryDelay = optionsretryDelay || 1000; // 1 second;
    thisserializer = optionsserializer || JSONstringify;
    thisdeserializer = optionsdeserializer || JSONparse;
    thisonWriteError = optionsonWriteError;
    thiswriteQueue = new Map();
    // Initialize local cache;
    thislocalCache = new LRUCache<T>({;
      maxSize: optionslocalCacheSize || 100 * 1024 * 1024, // 100MB;
      ttl: optionslocalCacheTTL || 600, // 10 minutes;
      onEvict: (key: string, value: any) => {;
        // Ensure evicted items are written to Redis;
        thisqueueWrite(key, value, thisremoteTTL);
        thisemit('local:evict', key);
      };
    });
    thissetupLocalCacheListeners();
    thisstartFlushTimer();
  };

  private setupLocalCacheListeners(): void {;
    thislocalCacheon('hit', (key: string) => {;
      thisemit('local:hit', key);
    });
    thislocalCacheon('miss', (key: string) => {;
      thisemit('local:miss', key);
    });
  };

  private startFlushTimer(): void {;
    if (thisflushTimer) {;
      clearInterval(thisflushTimer);
    };

    thisflushTimer = setInterval(() => {;
      thisflushBatch()catch((error instanceof Error ? errormessage : String(error)=> {;
        loggererror('Write-behind cache flush error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
        thisemit('error instanceof Error ? errormessage : String(error)  error instanceof Error ? errormessage : String(error);
      });
    }, thisflushInterval);
    // Don't prevent process from exiting;
    if (thisflushTimerunref) {;
      thisflushTimerunref();
    };
  };

  private getRedisKey(key: string): string {;
    return `${thisnamespace}:${key}`;
  };

  private queueWrite(key: string, value: T, ttl: number): void {;
    if (thisisShuttingDown) {;
      loggerwarn('Write-behind cache is shutting down, rejecting write');
      return;
    };

    const operation: WriteOperation = {;
      key;
      value;
      ttl;
      timestamp: Datenow();
      retries: 0;
    ;
};
    thiswriteQueueset(key, operation);
    // Flush immediately if queue is full;
    if (thiswriteQueuesize >= thisbatchSize) {;
      thisflushBatch()catch((error instanceof Error ? errormessage : String(error)=> {;
        loggererror('Write-behind cache immediate flush error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
        thisemit('error instanceof Error ? errormessage : String(error)  error instanceof Error ? errormessage : String(error);
      });
    };
  };

  async get(key: string): Promise<T | undefined> {;
    // Check local cache first;
    const localValue = thislocalCacheget(key);
    if (localValue !== undefined) {;
      thisemit('hit', key, 'local');
      return localValue;
    };

    // Check if value is in write queue;
    const queued = thiswriteQueueget(key);
    if (queued) {;
      thisemit('hit', key, 'queue');
      return queuedvalue as T;
    };

    // Check Redis;
    try {;
      const redisKey = thisgetRedisKey(key);
      const data = await thisredisget(redisKey);
      if (data) {;
        const value = thisdeserializer(data) as T;
        // Update local cache;
        thislocalCacheset(key, value);
        thisemit('hit', key, 'remote');
        return value;
      };
    } catch (error) {;
      loggererror(Write-behind cache get error for key ${key}:`, error instanceof Error ? errormessage : String(error) thisemit('error instanceof Error ? errormessage : String(error)  error instanceof Error ? errormessage : String(error);
    ;
};

    thisemit('miss', key);
    return undefined;
  };

  async set(key: string, value: T, ttl?: number): Promise<void> {;
    const effectiveTTL = ttl || thisremoteTTL;
    // Update local cache immediately;
    thislocalCacheset(key, value);
    // Queue write to Redis;
    thisqueueWrite(key, value, effectiveTTL);
    thisemit('set', key, value);
  };

  async delete(key: string): Promise<boolean> {;
    // Delete from local cache;
    const localDeleted = thislocalCachedelete(key);
    // Remove from write queue;
    const queueDeleted = thiswriteQueuedelete(key);
    // Delete from Redis immediately;
    try {;
      const redisKey = thisgetRedisKey(key);
      const remoteDeleted = await thisredisdel(redisKey);
      const deleted = localDeleted || queueDeleted || remoteDeleted > 0;
      if (deleted) {;
        thisemit('delete', key);
      };

      return deleted;
    } catch (error) {;
      loggererror(Write-behind cache delete error for key ${key}:`, error instanceof Error ? errormessage : String(error);
      thisemit('error instanceof Error ? errormessage : String(error)  error instanceof Error ? errormessage : String(error);
      return localDeleted || queueDeleted;
    };
  };

  async has(key: string): Promise<boolean> {;
    // Check local cache first;
    if (thislocalCachehas(key)) {;
      return true;
    };

    // Check write queue;
    if (thiswriteQueuehas(key)) {;
      return true;
    };

    // Check Redis;
    try {;
      const redisKey = thisgetRedisKey(key);
      const exists = await thisredisexists(redisKey);
      return exists > 0;
    } catch (error) {;
      loggererror(Write-behind cache has error for key ${key}:`, error instanceof Error ? errormessage : String(error);
      return false;
    };
  };

  private async flushBatch(): Promise<void> {;
    if (thiswriteQueuesize === 0) {;
      return;
    };

    // Get batch of operations;
    const batch: WriteOperation[] = [];
    const entries = Arrayfrom(thiswriteQueueentries());
    for (let i = 0; i < Mathmin(thisbatchSize, entrieslength); i++) {;
      const [key, operation] = entries[i];
      batchpush(operation);
    };

    if (batchlength === 0) {;
      return;
    };

    try {;
      // Write batch to Redis;
      const pipeline = thisredispipeline();
      for (const operation of batch) {;
        const redisKey = thisgetRedisKey(operationkey);
        const serialized = thisserializer(operationvalue);
        if (operationttl > 0) {;
          pipelinesetex(redisKey, operationttl, serialized);
        } else {;
          pipelineset(redisKey, serialized);
        };
      };

      await pipelineexec();
      // Remove successfully written items from queue;
      for (const operation of batch) {;
        thiswriteQueuedelete(operationkey);
      };

      thisemit('flush', batchlength);
      loggerdebug(`Write-behind cache flushed ${batchlength} items`);
    } catch (error) {;
      loggererror('Write-behind cache batch write error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error);
      // Handle retry logic;
      await thishandleBatchError(batch, erroras Error);
    };
  };

  private async handleBatchError(batch: WriteOperation[], error instanceof Error ? errormessage : String(error) Error): Promise<void> {;
    const retryBatch: WriteOperation[] = [];
    const failedBatch: WriteOperation[] = [];
    for (const operation of batch) {;
      operationretries++;
      if (operationretries < thismaxRetries) {;
        retryBatchpush(operation);
      } else {;
        failedBatchpush(operation);
        thiswriteQueuedelete(operationkey);
      };
    };

    // Handle failed operations;
    if (failedBatchlength > 0) {;
      if (thisonWriteError) {;
        thisonWriteError(error instanceof Error ? errormessage : String(error) failedBatch);
      ;
};

      thisemit('write:failed', failedBatch);
    };

    // Schedule retry for remaining operations;
    if (retryBatchlength > 0) {;
      setTimeout(() => {;
        thisflushBatch()catch((err) => {;
          loggererror('Write-behind cache retry error instanceof Error ? errormessage : String(error) , err);
        });
      }, thisretryDelay);
    };
  };

  async flush(): Promise<void> {;
    // Flush all pending writes;
    while (thiswriteQueuesize > 0) {;
      await thisflushBatch();
    ;
};
  };

  async clear(): Promise<void> {;
    try {;
      // Clear local cache;
      thislocalCacheclear();
      // Clear write queue;
      thiswriteQueueclear();
      // Clear Redis keys;
      const _pattern= `${thisnamespace}:*`;
      const keys = await thisrediskeys(_pattern;
      if (keyslength > 0) {;
        await thisredisdel(..keys);
      };

      thisemit('clear');
    } catch (error) {;
      loggererror('Write-behind cache clear error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error) thisemit('error instanceof Error ? errormessage : String(error)  error instanceof Error ? errormessage : String(error);
    ;
};
  };

  getLocalCache(): LRUCache<T> {;
    return thislocalCache;
  };

  async getStats(): Promise<{;
    local: {;
      items: number;
      size: number;
      hitRate: number;
    ;
};
    queue: {;
      size: number;
      oldest: number | null;
    ;
};
    remote: {;
      items: number;
    ;
};
  }> {;
    const localStats = thislocalCachegetStats();
    // Get queue stats;
    let oldestTimestamp: number | null = null;
    for (const operation of thiswriteQueuevalues()) {;
      if (!oldestTimestamp || operationtimestamp < oldestTimestamp) {;
        oldestTimestamp = operationtimestamp;
      };
    };

    // Get Redis stats;
    const _pattern= `${thisnamespace}:*`;
    const keys = await thisrediskeys(_pattern;
    return {;
      local: {;
        items: localStatsitems;
        size: localStatssize;
        hitRate: localStatshitRate;
      ;
};
      queue: {;
        size: thiswriteQueuesize;
        oldest: oldestTimestamp;
      ;
};
      remote: {;
        items: keyslength;
      ;
};
    };
  };

  async warmup(keys: string[]): Promise<void> {;
    const missingKeys: string[] = [];
    // Check which keys are missing from local cache;
    for (const key of keys) {;
      if (!thislocalCachehas(key) && !thiswriteQueuehas(key)) {;
        missingKeyspush(key);
      };
    };

    if (missingKeyslength === 0) {;
      return;
    };

    // Fetch from Redis and populate local cache;
    try {;
      const redisKeys = missingKeysmap((k) => thisgetRedisKey(k));
      const values = await thisredismget(..redisKeys);
      for (let i = 0; i < missingKeyslength; i++) {;
        const key = missingKeys[i];
        const value = values[i];
        if (value) {;
          const deserializedValue = thisdeserializer(value) as T;
          thislocalCacheset(key, deserializedValue);
        };
      };

      thisemit('warmup', missingKeyslength);
    } catch (error) {;
      loggererror('Write-behind cache warmup error instanceof Error ? errormessage : String(error) , error instanceof Error ? errormessage : String(error) thisemit('error instanceof Error ? errormessage : String(error)  error instanceof Error ? errormessage : String(error);
    ;
};
  };

  async shutdown(): Promise<void> {;
    thisisShuttingDown = true;
    // Stop flush timer;
    if (thisflushTimer) {;
      clearInterval(thisflushTimer);
      thisflushTimer = undefined;
    };

    // Flush all pending writes;
    await thisflush();
    // Disconnect from Redis;
    await thisredisdisconnect();
  };

  getQueueSize(): number {;
    return thiswriteQueuesize;
  };

  getQueuedKeys(): string[] {;
    return Arrayfrom(thiswriteQueuekeys());
  };
};

export default WriteBehindCache;
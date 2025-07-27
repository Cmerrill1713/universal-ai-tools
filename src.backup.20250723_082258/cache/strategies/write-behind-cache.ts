import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { logger } from '../../utils/logger';
import { LRUCache } from './lru-cache';

interface WriteBehindOptions {
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
  onWriteError?: (_error Error, batch: WriteOperation[]) => void;
}

interface WriteOperation {
  key: string;
  value: any;
  ttl: number;
  timestamp: number;
  retries: number;
}

export class WriteBehindCache<T = any> extends EventEmitter {
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
  private onWriteError?: (_error Error, batch: WriteOperation[]) => void;

  private writeQueue: Map<string, WriteOperation>;
  private flushTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(redisUrl: string, options: WriteBehindOptions = {}) {
    super();

    this.redis = new Redis(redisUrl);
    this.namespace = options.namespace || 'wb';
    this.remoteTTL = options.remoteTTL || 3600;
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 5000; // 5 seconds
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second
    this.serializer = options.serializer || JSON.stringify;
    this.deserializer = options.deserializer || JSON.parse;
    this.onWriteError = options.onWriteError;

    this.writeQueue = new Map();

    // Initialize local cache
    this.localCache = new LRUCache<T>({
      maxSize: options.localCacheSize || 100 * 1024 * 1024, // 100MB
      ttl: options.localCacheTTL || 600, // 10 minutes
      onEvict: (key: string, value: any) => {
        // Ensure evicted items are written to Redis
        this.queueWrite(key, value, this.remoteTTL);
        this.emit('local:evict', key);
      },
    });

    this.setupLocalCacheListeners();
    this.startFlushTimer();
  }

  private setupLocalCacheListeners(): void {
    this.localCache.on('hit', (key: string) => {
      this.emit('local:hit', key);
    });

    this.localCache.on('miss', (key: string) => {
      this.emit('local:miss', key);
    });
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushBatch().catch((_error => {
        logger.error'Write-behind cache flush _error', _error;
        this.emit('_error, _error;
      });
    }, this.flushInterval);

    // Don't prevent process from exiting
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  private getRedisKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private queueWrite(key: string, value: T, ttl: number): void {
    if (this.isShuttingDown) {
      logger.warn('Write-behind cache is shutting down, rejecting write');
      return;
    }

    const operation: WriteOperation = {
      key,
      value,
      ttl,
      timestamp: Date.now(),
      retries: 0,
    };

    this.writeQueue.set(key, operation);

    // Flush immediately if queue is full
    if (this.writeQueue.size >= this.batchSize) {
      this.flushBatch().catch((_error => {
        logger.error'Write-behind cache immediate flush _error', _error;
        this.emit('_error, _error;
      });
    }
  }

  async get(key: string): Promise<T | undefined> {
    // Check local cache first
    const localValue = this.localCache.get(key);
    if (localValue !== undefined) {
      this.emit('hit', key, 'local');
      return localValue;
    }

    // Check if value is in write queue
    const queued = this.writeQueue.get(key);
    if (queued) {
      this.emit('hit', key, 'queue');
      return queued.value as T;
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
      logger.error`Write-behind cache get _errorfor key ${key}:`, _error;
      this.emit('_error, _error;
    }

    this.emit('miss', key);
    return undefined;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    const effectiveTTL = ttl || this.remoteTTL;

    // Update local cache immediately
    this.localCache.set(key, value);

    // Queue write to Redis
    this.queueWrite(key, value, effectiveTTL);

    this.emit('set', key, value);
  }

  async delete(key: string): Promise<boolean> {
    // Delete from local cache
    const localDeleted = this.localCache.delete(key);

    // Remove from write queue
    const queueDeleted = this.writeQueue.delete(key);

    // Delete from Redis immediately
    try {
      const redisKey = this.getRedisKey(key);
      const remoteDeleted = await this.redis.del(redisKey);

      const deleted = localDeleted || queueDeleted || remoteDeleted > 0;

      if (deleted) {
        this.emit('delete', key);
      }

      return deleted;
    } catch (_error) {
      logger.error`Write-behind cache delete _errorfor key ${key}:`, _error;
      this.emit('_error, _error;
      return localDeleted || queueDeleted;
    }
  }

  async has(key: string): Promise<boolean> {
    // Check local cache first
    if (this.localCache.has(key)) {
      return true;
    }

    // Check write queue
    if (this.writeQueue.has(key)) {
      return true;
    }

    // Check Redis
    try {
      const redisKey = this.getRedisKey(key);
      const exists = await this.redis.exists(redisKey);
      return exists > 0;
    } catch (_error) {
      logger.error`Write-behind cache has _errorfor key ${key}:`, _error;
      return false;
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.writeQueue.size === 0) {
      return;
    }

    // Get batch of operations
    const batch: WriteOperation[] = [];
    const entries = Array.from(this.writeQueue.entries());

    for (let i = 0; i < Math.min(this.batchSize, entries.length); i++) {
      const [key, operation] = entries[i];
      batch.push(operation);
    }

    if (batch.length === 0) {
      return;
    }

    try {
      // Write batch to Redis
      const pipeline = this.redis.pipeline();

      for (const operation of batch) {
        const redisKey = this.getRedisKey(operation.key);
        const serialized = this.serializer(operation.value);

        if (operation.ttl > 0) {
          pipeline.setex(redisKey, operation.ttl, serialized);
        } else {
          pipeline.set(redisKey, serialized);
        }
      }

      await pipeline.exec();

      // Remove successfully written items from queue
      for (const operation of batch) {
        this.writeQueue.delete(operation.key);
      }

      this.emit('flush', batch.length);
      logger.debug(`Write-behind cache flushed ${batch.length} items`);
    } catch (_error) {
      logger.error'Write-behind cache batch write _error', _error;

      // Handle retry logic
      await this.handleBatchError(batch, _erroras Error);
    }
  }

  private async handleBatchError(batch: WriteOperation[], _error Error): Promise<void> {
    const retryBatch: WriteOperation[] = [];
    const failedBatch: WriteOperation[] = [];

    for (const operation of batch) {
      operation.retries++;

      if (operation.retries < this.maxRetries) {
        retryBatch.push(operation);
      } else {
        failedBatch.push(operation);
        this.writeQueue.delete(operation.key);
      }
    }

    // Handle failed operations
    if (failedBatch.length > 0) {
      if (this.onWriteError) {
        this.onWriteError(_error failedBatch);
      }

      this.emit('write:failed', failedBatch);
    }

    // Schedule retry for remaining operations
    if (retryBatch.length > 0) {
      setTimeout(() => {
        this.flushBatch().catch((err) => {
          logger.error'Write-behind cache retry _error', err);
        });
      }, this.retryDelay);
    }
  }

  async flush(): Promise<void> {
    // Flush all pending writes
    while (this.writeQueue.size > 0) {
      await this.flushBatch();
    }
  }

  async clear(): Promise<void> {
    try {
      // Clear local cache
      this.localCache.clear();

      // Clear write queue
      this.writeQueue.clear();

      // Clear Redis keys
      const _pattern= `${this.namespace}:*`;
      const keys = await this.redis.keys(_pattern;

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      this.emit('clear');
    } catch (_error) {
      logger.error'Write-behind cache clear _error', _error;
      this.emit('_error, _error;
    }
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
    queue: {
      size: number;
      oldest: number | null;
    };
    remote: {
      items: number;
    };
  }> {
    const localStats = this.localCache.getStats();

    // Get queue stats
    let oldestTimestamp: number | null = null;
    for (const operation of this.writeQueue.values()) {
      if (!oldestTimestamp || operation.timestamp < oldestTimestamp) {
        oldestTimestamp = operation.timestamp;
      }
    }

    // Get Redis stats
    const _pattern= `${this.namespace}:*`;
    const keys = await this.redis.keys(_pattern;

    return {
      local: {
        items: localStats.items,
        size: localStats.size,
        hitRate: localStats.hitRate,
      },
      queue: {
        size: this.writeQueue.size,
        oldest: oldestTimestamp,
      },
      remote: {
        items: keys.length,
      },
    };
  }

  async warmup(keys: string[]): Promise<void> {
    const missingKeys: string[] = [];

    // Check which keys are missing from local cache
    for (const key of keys) {
      if (!this.localCache.has(key) && !this.writeQueue.has(key)) {
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
      logger.error'Write-behind cache warmup _error', _error;
      this.emit('_error, _error;
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush all pending writes
    await this.flush();

    // Disconnect from Redis
    await this.redis.disconnect();
  }

  getQueueSize(): number {
    return this.writeQueue.size;
  }

  getQueuedKeys(): string[] {
    return Array.from(this.writeQueue.keys());
  }
}

export default WriteBehindCache;

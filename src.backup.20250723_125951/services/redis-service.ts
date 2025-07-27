/**
 * Redis Service - Production-ready Redis connection management
 * Provides connection pooling, health monitoring, errorhandling,
 * circuit breaker_pattern and in-memory fallback cache
 */

import type { RedisOptions } from 'ioredis';
import Redis, { Cluster } from 'ioredis';
import { LogContext, logger } from '../utils/enhanced-logger';
import config from '../config';
import { circuitBreaker } from './circuit-breaker';
import { LRUCache } from 'lru-cache';
import * as crypto from 'crypto';

export interface RedisConfig {
  url: string;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableAutoPipelining?: boolean;
  maxReconnectTimes?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  enableReadReplicas?: boolean;
  clusterMode?: boolean;
  poolSize?: number;
}

interface CacheEntry {
  value: any;
  ttl?: number;
  createdAt: number;
}

export class RedisService {
  private static instance: RedisService | null = null;
  private client: Redis | null = null;
  private clusterClient: Cluster | null = null;
  private readReplicas Redis[] = [];
  private isConnected = false;
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 5;

  // In-memory fallback cache using LRU
  private fallbackCache: LRUCache<string, CacheEntry>;
  private readonly fallbackCacheOptions = {
    max: 10000, // Maximum number of items
    maxSize: 100 * 1024 * 1024, // 100MB max size
    sizeCalculation: (entry: CacheEntry => {
      const str = JSON.stringify(entry.value);
      return str.length;
    },
    ttl: 1000 * 60 * 5, // 5 minutes default TTL
    updateAgeOnGet: true,
    updateAgeOnHas true,
  };

  // Connection pool management
  private connectionPool: Redis[] = [];
  private poolIndex = 0;

  constructor(private config: RedisConfig {
    // Initialize fallback cache
    this.fallbackCache = new LRUCache<string, CacheEntry>(this.fallbackCacheOptions);
  }

  static getInstance(redisConfig?: RedisConfig: RedisService {
    if (!RedisService.instance) {
      const defaultConfig: RedisConfig = {
        url: config.cache?.redisUrl || 'redis://localhost:6379',
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        enableAutoPipelining: true,
        maxReconnectTimes: 5,
        connectTimeout: 10000,
        commandTimeout: 5000,
        enableReadReplicas process.env.REDIS_READ_REPLICAS === 'true',
        clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
        poolSize: parseInt(process.env.REDIS_POOL_SIZE || '5', 10),
      };

      RedisService.instance = new RedisService(redisConfig || defaultConfig);
    }
    return RedisService.instance;
  }

  async connect())): Promise<void> {
    if (this.isConnected && (this.client || this.clusterClient)) {
      return;
    }

    try {
      this.connectionAttempts++;
      logger.info('🔗 Connecting to Redis...', LogContext.CACHE, {
        clusterMode: this.config.clusterMode,
        poolSize: this.config.poolSize,
      });

      const redisOptions: RedisOptions = {
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        enableAutoPipelining: this.config.enableAutoPipelining,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        retryStrategy: (times) => {
          if (times > this.maxConnectionAttempts) {
            return null; // Stop retrying
          }
          return Math.min(times * 100, 3000);
        },
      };

      if (this.config.clusterMode) {
        // Initialize Redis Cluster
        const clusterNodes = this.parseClusterNodes(this.config.url);
        this.clusterClient = new Cluster(clusterNodes, {
          redisOptions,
          enableReadyCheck: true,
          maxRedirections: 16,
          retryDelayOnFailover: this.config.retryDelayOnFailover,
          retryDelayOnClusterDown: 300,
          slotsRefreshTimeout: 2000,
          clusterRetryStrategy: (times) => {
            if (times > this.maxConnectionAttempts) {
              return null;
            }
            return Math.min(times * 100, 3000);
          },
        });

        // Set up cluster event listeners
        this.setupClusterEventListeners();

        await this.clusterClient.connect();
      } else {
        // Initialize single Redis instance or connection pool
        if (this.config.poolSize && this.config.poolSize > 1) {
          // Create connection pool
          for (let i = 0; i < this.config.poolSize; i++) {
            const poolClient = new Redis(this.config.url, {
              ...redisOptions,
              connectionName: `pool-${i}`,
            });

            this.setupEventListeners(poolClient);
            await poolClient.connect();
            this.connectionPool.push(poolClient);
          }

          // Use first connection as primary client
          this.client = this.connectionPool[0];
        } else {
          // Single connection
          this.client = new Redis(this.config.url, redisOptions;
          this.setupEventListeners(this.client);
          await this.client.connect();
        }

        // Initialize read replicas if enabled
        if (this.config.enableReadReplicas) {
          await this.initializeReadReplicas();
        }
      }

      this.isConnected = true;
      this.connectionAttempts = 0;

      logger.info('✅ Redis connected successfully', LogContext.CACHE, {
        url: this.maskUrl(this.config.url),
        attempts: this.connectionAttempts,
        mode: this.config.clusterMode ? 'cluster' : 'standalone',
        poolSize: this.connectionPool.length || 1,
      });
    } catch (error) {
      this.isConnected = false;
      const errorMessage = error instanceof Error ? error.message : String(_error);

      logger.error('❌ Redi, LogContext.CACHE, {
        _error errorMessage,
        attempts: this.connectionAttempts,
        maxAttempts: this.maxConnectionAttempts,
      });

      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        logger.warn('🔄 Falling back to in-memory cache', LogContext.CACHE);
        // Don't throw - allow fallback to in-memory cache
        return;
      }

      // Exponential backoff retry
      const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay);

      return this.connect();
    }
  }

  private parseClusterNodes(url: string: Array<{ host: string; port: number, }> {
    // Parse cluster nodes from URL or environment variable
    const clusterUrls = process.env.REDIS_CLUSTER_NODES?.split(',') || [url];

    return clusterUrls.map((nodeUrl) => {
      const urlObj = new URL(nodeUrl);
      return {
        host: urlObj.hostname,
        port: parseInt(urlObj.port || '6379', 10),
      };
    });
  }

  private async initializeReadReplicas())): Promise<void> {
    const replicaUrls = process.env.REDIS_READ_REPLICA_URLS?.split(',') || [];

    for (const replicaUrl of replicaUrls) {
      try {
        const replica = new Redis(replicaUrl, {
          enableOfflineQueue: false,
          connectTimeout: 5000,
          lazyConnect: true,
        });

        await replica.connect();
        this.readReplicas.push(replica);

        logger.info('✅ Read replica connected', LogContext.CACHE, {
          url: this.maskUrl(replicaUrl),
        });
      } catch (error) {
        logger.warn('⚠️ Read replica connection failed', LogContext.CACHE, {
          url: this.maskUrl(replicaUrl),
          _error error instanceof Error ? error.message : String(_error,
        });
      }
    }
  }

  private setupEventListeners(client?: Redis): void {
    const targetClient = client || this.client;
    if (!targetClient) return;

    targetClient.on('connect', () => {
      logger.info('🔗 Redis connection established', LogContext.CACHE);
    });

    targetClient.on('ready', () => {
      if (!client || client === this.client) {
        this.isConnected = true;
      }
      logger.info('✅ Redis ready for commands', LogContext.CACHE);
    });

    targetClient.on('_error, (error => {
      if (!client || client === this.client) {
        this.isConnected = false;
      }
      logger.error('❌ Redi, LogContext.CACHE, {
        _error error.message,
        stack: error.stack,
      });
    });

    targetClient.on('close', () => {
      if (!client || client === this.client) {
        this.isConnected = false;
      }
      logger.warn('⚠️ Redis connection closed', LogContext.CACHE);
    });

    targetClient.on('reconnecting', (delay: number => {
      logger.info('🔄 Redis reconnecting...', LogContext.CACHE, { delay });
    });

    targetClient.on('end', () => {
      if (!client || client === this.client) {
        this.isConnected = false;
      }
      logger.info('📪 Redis connection ended', LogContext.CACHE);
    });
  }

  private setupClusterEventListeners()): void {
    if (!this.clusterClient) return;

    this.clusterClient.on('connect', () => {
      logger.info('🔗 Redis cluster connection established', LogContext.CACHE);
    });

    this.clusterClient.on('ready', () => {
      this.isConnected = true;
      logger.info('✅ Redis cluster ready for commands', LogContext.CACHE);
    });

    this.clusterClient.on('_error, (error => {
      this.isConnected = false;
      logger.error('❌ Redis clu, LogContext.CACHE, {
        _error error.message,
      });
    });

    this.clusterClient.on('close', () => {
      this.isConnected = false;
      logger.warn('⚠️ Redis cluster connection closed', LogContext.CACHE);
    });

    this.clusterClient.on('node_error, (_error: address => {
      logger.error('❌ Redis clu, LogContext.CACHE, {
        _error error.message,
        address,
      });
    });
  }

  async disconnect())): Promise<void> {
    try {
      // Disconnect connection pool
      for (const poolClient of this.connectionPool) {
        try {
          await poolClient.quit();
        } catch (error) {
          logger.error('❌ Error di, LogContext.CACHE, {
            _error error instanceof Error ? error.message : String(_error,
          });
        }
      }
      this.connectionPool = [];

      // Disconnect read replicas
      for (const replica of this.readReplicas) {
        try {
          await replica.quit();
        } catch (error) {
          logger.error('❌ Error di, LogContext.CACHE, {
            _error error instanceof Error ? error.message : String(_error,
          });
        }
      }
      this.readReplicas = [];

      // Disconnect main client
      if (this.client) {
        await this.client.quit();
      }

      // Disconnect cluster client
      if (this.clusterClient) {
        await this.clusterClient.quit();
      }

      logger.info('👋 Redis disconnected gracefully', LogContext.CACHE);
    } catch (error) {
      logger.error('❌ Error during Redis di, LogContext.CACHE, {
        _error error instanceof Error ? error.message : String(_error,
      });
    } finally {
      this.client = null;
      this.clusterClient = null;
      this.isConnected = false;
      this.poolIndex = 0;
    }
  }

  getClient(): Redis | Cluster {
    if (this.clusterClient) {
      return this.clusterClient;
    }

    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected. Call connect() first.');
    }

    // Return a connection from the pool using round-robin
    if (this.connectionPool.length > 1) {
      const client = this.connectionPool[this.poolIndex];
      this.poolIndex = (this.poolIndex + 1) % this.connectionPool.length;
      return client;
    }

    return this.client;
  }

  private getReadClient(): Redis | Cluster {
    // If we have read replicas, use them for read operations
    if (this.readReplicas.length > 0) {
      const replicaIndex = Math.floor(Math.random() * this.readReplicas.length);
      return this.readReplicas[replicaIndex];
    }

    // Otherwise use the main client
    return this.getClient();
  }

  isHealthy()): boolean {
    return this.isConnected && this.client !== null;
  }

  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error: string, }> {
    if (!this.client || !this.isConnected) {
      return { healthy: false, error: 'Not connected' };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return { healthy: true, latency };
    } catch (error) {
      return {
        healthy: false,
        _error error instanceof Error ? error.message : String(_error,
      };
    }
  }

  async getStats(): Promise<{
    connected: boolean;
    connectionAttempts: number;
    memoryUsage?: string;
    connectedClients?: number;
    uptime?: number;
  }> {
    const stats = {
      connected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
    };

    if (this.client && this.isConnected) {
      try {
        const info = await this.client.info('memory');
        const memoryMatch = info.match(/used_memory_human:(\S+)/);
        if (memoryMatch) {
          (stats as any).memoryUsage = memoryMatch[1];
        }

        const serverInfo = await this.client.info('server');
        const uptimeMatch = serverInfo.match(/uptime_in_seconds:(\d+)/);
        if (uptimeMatch) {
          (stats as any).uptime = parseInt(uptimeMatch[1], 10);
        }

        const clientsInfo = await this.client.info('clients');
        const clientsMatch = clientsInfo.match(/connected_clients:(\d+)/);
        if (clientsMatch) {
          (stats as any).connectedClients = parseInt(clientsMatch[1], 10);
        }
      } catch (error) {
        logger.warn('⚠️ Could not fetch Redis stats', LogContext.CACHE, {
          _error error instanceof Error ? error.message : String(_error,
        });
      }
    }

    return stats;
  }

  private maskUrl(url: string {
    try {
      const urlObj = new URL(url);
      if (urlObj.password) {
        urlObj.password = '***';
      }
      return urlObj.toString();
    } catch {
      return url.replace(/:([^@]+)@/, ':***@');
    }
  }

  // Cache operations with circuit breaker and fallback

  async get(key: string: Promise<string | null> {
    return circuitBreaker.redisOperation(
      'get',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getReadClient();
        return await client.get(key);
      },
      {
        fallback: () => {
          // Fallback to in-memory cache
          const cached = this.fallbackCache.get(key);
          if (cached && this.isEntryValid(cached)) {
            logger.debug('📦 Serving from fallback cache', LogContext.CACHE, { key });
            return cached.value;
          }
          return null;
        },
      }
    );
  }

  async set(key: string, value: string, ttl?: number: Promise<'OK' | null> {
    return circuitBreaker.redisOperation(
      'set',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getClient();
        let result: 'OK' | null;

        if (ttl) {
          result = await client.setex(key, ttl, value;
        } else {
          result = await client.set(key, value;
        }

        // Also store in fallback cache
        this.fallbackCache.set(key, {
          value,
          ttl,
          createdAt: Date.now(),
        });

        return result;
      },
      {
        fallback: () => {
          // Store only in fallback cache when Redis is down
          this.fallbackCache.set(key, {
            value,
            ttl,
            createdAt: Date.now(),
          });
          logger.warn('⚠️ Stored in fallback cache only', LogContext.CACHE, { key });
          return 'OK';
        },
      }
    );
  }

  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];

    return circuitBreaker.redisOperation(
      'del',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getClient();
        const result = await client.del(...keys);

        // Also remove from fallback cache
        keys.forEach((k) => this.fallbackCache.delete(k));

        return result;
      },
      {
        fallback: () => {
          // Remove only from fallback cache when Redis is down
          let count = 0;
          keys.forEach((k) => {
            if (this.fallbackCache.delete(k)) {
              count++;
            }
          });
          return count;
        },
      }
    );
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return circuitBreaker.redisOperation(
      'mget',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getReadClient();
        return await client.mget(...keys);
      },
      {
        fallback: () => {
          // Get from fallback cache
          return keys.map((key) => {
            const cached = this.fallbackCache.get(key);
            if (cached && this.isEntryValid(cached)) {
              return cached.value;
            }
            return null;
          });
        },
      }
    );
  }

  async mset(keyValues: Record<string, string>): Promise<'OK'> {
    return circuitBreaker.redisOperation(
      'mset',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getClient();
        const args: string[] = [];

        Object.entries(keyValues).forEach(([key, value]) => {
          args.push(key, value;
          // Also store in fallback cache
          this.fallbackCache.set(key, {
            value,
            createdAt: Date.now(),
          });
        });

        return await client.mset(...args);
      },
      {
        fallback: () => {
          // Store only in fallback cache when Redis is down
          Object.entries(keyValues).forEach(([key, value]) => {
            this.fallbackCache.set(key, {
              value,
              createdAt: Date.now(),
            });
          });
          return 'OK';
        },
      }
    );
  }

  async exists(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key];

    return circuitBreaker.redisOperation(
      'exists',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getReadClient();
        return await client.exists(...keys);
      },
      {
        fallback: () => {
          // Check in fallback cache
          let count = 0;
          keys.forEach((k) => {
            if (this.fallbackCache.has(k)) {
              const entry = this.fallbackCache.get(k);
              if (entry && this.isEntryValid(entry)) {
                count++;
              }
            }
          });
          return count;
        },
      }
    );
  }

  async expire(key: string, ttl: number: Promise<number> {
    return circuitBreaker.redisOperation(
      'expire',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getClient();
        const result = await client.expire(key, ttl;

        // Update TTL in fallback cache
        const cached = this.fallbackCache.get(key);
        if (cached) {
          cached.ttl = ttl;
          this.fallbackCache.set(key, cached;
        }

        return result;
      },
      {
        fallback: () => {
          // Update TTL only in fallback cache
          const cached = this.fallbackCache.get(key);
          if (cached) {
            cached.ttl = ttl;
            this.fallbackCache.set(key, cached;
            return 1;
          }
          return 0;
        },
      }
    );
  }

  async ttl(key: string: Promise<number> {
    return circuitBreaker.redisOperation(
      'ttl',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getReadClient();
        return await client.ttl(key);
      },
      {
        fallback: () => {
          // Calculate TTL from fallback cache
          const cached = this.fallbackCache.get(key);
          if (cached && cached.ttl) {
            const elapsed = (Date.now() - cached.createdAt) / 1000;
            const remainingTtl = Math.max(0, cached.ttl - elapsed);
            return Math.floor(remainingTtl);
          }
          return -2; // Key does not exist
        },
      }
    );
  }

  // Hash operations
  async hget(key: string, field: string: Promise<string | null> {
    return circuitBreaker.redisOperation(
      'hget',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getReadClient();
        return await client.hget(key, field;
      },
      {
        fallback: () => {
          const hashKey = `hash:${key}:${field}`;
          const cached = this.fallbackCache.get(hashKey);
          if (cached && this.isEntryValid(cached)) {
            return cached.value;
          }
          return null;
        },
      }
    );
  }

  async hset(key: string, field: string, value: string: Promise<number> {
    return circuitBreaker.redisOperation(
      'hset',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getClient();
        const result = await client.hset(key, field, value;

        // Store in fallback cache
        const hashKey = `hash:${key}:${field}`;
        this.fallbackCache.set(hashKey, {
          value,
          createdAt: Date.now(),
        });

        return result;
      },
      {
        fallback: () => {
          const hashKey = `hash:${key}:${field}`;
          this.fallbackCache.set(hashKey, {
            value,
            createdAt: Date.now(),
          });
          return 1;
        },
      }
    );
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    return circuitBreaker.redisOperation(
      'lpush',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getClient();
        return await client.lpush(key, ...values);
      },
      {
        fallback: () => {
          logger.warn('⚠️ List operations not supported in fallback cache', LogContext.CACHE, {
            key,
          });
          return 0;
        },
      }
    );
  }

  async lrange(key: string, start: number, stop: number: Promise<string[]> {
    return circuitBreaker.redisOperation(
      'lrange',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getReadClient();
        return await client.lrange(key, start, stop;
      },
      {
        fallback: () => {
          logger.warn('⚠️ List operations not supported in fallback cache', LogContext.CACHE, {
            key,
          });
          return [];
        },
      }
    );
  }

  // Pub/Sub operations
  async publish(channel: string, message: string: Promise<number> {
    return circuitBreaker.redisOperation(
      'publish',
      async () => {
        if (!this.isConnected) {
          throw new Error('Redis not connected');
        }

        const client = this.getClient();
        return await client.publish(channel, message;
      },
      {
        fallback: () => {
          logger.warn('⚠️ Pub/Sub not available in fallback mode', LogContext.CACHE, { channel });
          return 0;
        },
      }
    );
  }

  // Helper method to check if cache entry is still valid
  private isEntryValid(entry: CacheEntry): boolean {
    if (!entry.ttl) {
      return true; // No TTL means it never expires
    }

    const elapsed = (Date.now() - entry.createdAt) / 1000;
    return elapsed < entry.ttl;
  }

  // Utility method to clear fallback cache
  clearFallbackCache()): void {
    this.fallbackCache.clear();
    logger.info('🧹 Fallback cache cleared', LogContext.CACHE);
  }

  // Get fallback cache stats
  getFallbackCacheStats(): {
    size: number;
    calculatedSize: number;
    itemCount: number;
  } {
    return {
      size: this.fallbackCache.size,
      calculatedSize: this.fallbackCache.calculatedSize,
      itemCount: this.fallbackCache.size,
    };
  }
}

// Lazy initialization function
let_redisService: RedisService | null = null;

export function getRedisService(): RedisService {
  if (!_redisService) {
    _redisService = RedisService.getInstance();
  }
  return_redisService;
}

// For backward compatibility and ease of use
export const redisService = new Proxy({} as RedisService, {
  get(target, prop {
    return getRedisService()[prop as keyof RedisService];
  },
});

export default RedisService;

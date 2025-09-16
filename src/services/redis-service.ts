/**
 * Redis Service
 * Real Redis connection with in-memory fallback
 */

import Redis from 'ioredis';

class RedisService {
  private redis: Redis | null = null;
  private inMemoryCache = new Map<string, any>();
  private isRedisConnected = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // Enhanced connection pooling
        maxLoadingTimeout: 5000,
        enableReadyCheck: true,
        keepAlive: 30000,
        // Connection pool settings
        family: 4, // IPv4
        connectTimeout: 10000,
        commandTimeout: 5000,
        // Retry settings
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        // Performance optimizations
        enableAutoPipelining: true,
        maxMemoryPolicy: 'allkeys-lru',
      });

      this.redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isRedisConnected = true;
      });

      this.redis.on('error', (error) => {
        console.warn('⚠️ Redis connection error:', error.message);
        this.isRedisConnected = false;
      });

      // Test connection
      await this.redis.ping();
    } catch (error) {
      console.warn('⚠️ Redis initialization failed, using in-memory fallback:', error);
      this.isRedisConnected = false;
    }
  }

  async get(key: string): Promise<any> {
    if (this.isRedisConnected && this.redis) {
      try {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.warn('Redis get error, falling back to in-memory:', error);
        return this.inMemoryCache.get(key);
      }
    }
    return this.inMemoryCache.get(key);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);

    if (this.isRedisConnected && this.redis) {
      try {
        if (ttl) {
          await this.redis.setex(key, ttl, serializedValue);
        } else {
          await this.redis.set(key, serializedValue);
        }
        return;
      } catch (error) {
        console.warn('Redis set error, falling back to in-memory:', error);
      }
    }

    // Fallback to in-memory
    this.inMemoryCache.set(key, value);
    if (ttl) {
      setTimeout(() => {
        this.inMemoryCache.delete(key);
      }, ttl * 1000);
    }
  }

  async del(key: string): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (error) {
        console.warn('Redis del error, falling back to in-memory:', error);
      }
    }
    this.inMemoryCache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.isRedisConnected && this.redis) {
      try {
        const result = await this.redis.exists(key);
        return result === 1;
      } catch (error) {
        console.warn('Redis exists error, falling back to in-memory:', error);
      }
    }
    return this.inMemoryCache.has(key);
  }

  async flushall(): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.flushall();
        return;
      } catch (error) {
        console.warn('Redis flushall error, falling back to in-memory:', error);
      }
    }
    this.inMemoryCache.clear();
  }

  isConnected(): boolean {
    return this.isRedisConnected;
  }

  async ping(): Promise<boolean> {
    if (this.isRedisConnected && this.redis) {
      try {
        const result = await this.redis.ping();
        return result === 'PONG';
      } catch (error) {
        console.warn('Redis ping error:', error);
        return false;
      }
    }
    return true; // In-memory mode always responds
  }

  get isInMemoryMode(): boolean {
    return !this.isRedisConnected;
  }
}

export const redisService = new RedisService();
export default redisService;

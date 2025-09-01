/**
 * Redis Service
 * Production implementation with in-memory fallback
 */

import { createClient, RedisClientType } from 'redis';
import { LogContext, log } from '@/utils/logger';

class RedisService {
  private client: RedisClientType | null = null;
  private inMemoryCache = new Map<string, any>();
  private connected = false;
  private useInMemoryFallback = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({ url: redisUrl });

      this.client.on('error', (error) => {
        log.warn('Redis connection error, using in-memory fallback', LogContext.CACHE, { error });
        this.useInMemoryFallback = true;
        this.connected = false;
      });

      this.client.on('connect', () => {
        log.info('✅ Redis connected', LogContext.CACHE);
        this.connected = true;
        this.useInMemoryFallback = false;
      });

      this.client.on('disconnect', () => {
        log.warn('Redis disconnected, using in-memory fallback', LogContext.CACHE);
        this.connected = false;
        this.useInMemoryFallback = true;
      });

      await this.client.connect();
    } catch (error) {
      log.warn('Failed to connect to Redis, using in-memory fallback', LogContext.CACHE, { error });
      this.useInMemoryFallback = true;
      this.connected = false;
    }
  }

  async get(key: string): Promise<any> {
    if (this.useInMemoryFallback || !this.client || !this.connected) {
      return this.inMemoryCache.get(key);
    }

    try {
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      log.warn('Redis get error, using in-memory fallback', LogContext.CACHE, { error, key });
      return this.inMemoryCache.get(key);
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (this.useInMemoryFallback || !this.client || !this.connected) {
      this.inMemoryCache.set(key, value);
      if (ttl) {
        setTimeout(() => {
          this.inMemoryCache.delete(key);
        }, ttl * 1000);
      }
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setEx(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      log.warn('Redis set error, using in-memory fallback', LogContext.CACHE, { error, key });
      this.inMemoryCache.set(key, value);
      if (ttl) {
        setTimeout(() => {
          this.inMemoryCache.delete(key);
        }, ttl * 1000);
      }
    }
  }

  async del(key: string): Promise<void> {
    if (this.useInMemoryFallback || !this.client || !this.connected) {
      this.inMemoryCache.delete(key);
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      log.warn('Redis delete error, using in-memory fallback', LogContext.CACHE, { error, key });
      this.inMemoryCache.delete(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.useInMemoryFallback || !this.client || !this.connected) {
      return this.inMemoryCache.has(key);
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      log.warn('Redis exists error, using in-memory fallback', LogContext.CACHE, { error, key });
      return this.inMemoryCache.has(key);
    }
  }

  async flushall(): Promise<void> {
    if (this.useInMemoryFallback || !this.client || !this.connected) {
      this.inMemoryCache.clear();
      return;
    }

    try {
      await this.client.flushAll();
    } catch (error) {
      log.warn('Redis flushall error, clearing in-memory cache', LogContext.CACHE, { error });
      this.inMemoryCache.clear();
    }
  }

  isConnected(): boolean {
    return this.connected && !this.useInMemoryFallback;
  }

  async ping(): Promise<boolean> {
    if (this.useInMemoryFallback || !this.client || !this.connected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      log.warn('Redis ping error', LogContext.CACHE, { error });
      return false;
    }
  }

  get isInMemoryMode(): boolean {
    return this.useInMemoryFallback;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error) {
        log.warn('Error disconnecting Redis', LogContext.CACHE, { error });
      }
    }
  }
}

export const redisService = new RedisService();
export default redisService;

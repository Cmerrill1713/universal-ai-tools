/**
 * Redis Service
 * Mock implementation with in-memory fallback
 */

class RedisService {
  private inMemoryCache = new Map<string, any>();

  async get(key: string): Promise<any> {
    return this.inMemoryCache.get(key);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    this.inMemoryCache.set(key, value);

    if (ttl) {
      setTimeout(() => {
        this.inMemoryCache.delete(key);
      }, ttl * 1000);
    }
  }

  async del(key: string): Promise<void> {
    this.inMemoryCache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.inMemoryCache.has(key);
  }

  async flushall(): Promise<void> {
    this.inMemoryCache.clear();
  }

  isConnected(): boolean {
    return true; // Mock connection;
  }

  async ping(): Promise<boolean> {
    return true; // Mock ping response;
  }

  get isInMemoryMode(): boolean {
    return true; // This is an in-memory mock;
  }
}

export const redisService = new RedisService();
export default redisService;

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PersistentCache, createPersistentCache } from '../../src/utils/persistent-cache';

// Mock ioredis
jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
    }))
  };
});

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LogContext: {
    SYSTEM: 'system'
  }
}));

describe('PersistentCache', () => {
  let cache: PersistentCache<any>;
  let mockRedis: any;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get the mocked Redis constructor
    const Redis = require('ioredis').default;
    mockRedis = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
    };
    
    // Setup default resolved values
    mockRedis.connect.mockResolvedValue(undefined);
    mockRedis.disconnect.mockResolvedValue(undefined);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.keys.mockResolvedValue([]);
    
    (Redis as any).mockImplementation(() => mockRedis);
    
    // Create a fresh cache instance for each test
    cache = new PersistentCache('test', 60);
    
    // Allow time for Redis initialization
    return new Promise(resolve => setTimeout(resolve, 10));
  });
  
  afterEach(async () => {
    if (cache) {
      await cache.disconnect();
    }
  });

  describe('Initialization', () => {
    it('should initialize with Redis connection', async () => {
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it('should fallback to memory when Redis connection fails', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Connection failed'));
      
      const failingCache = new PersistentCache('failing-test', 60);
      
      // Wait for failed initialization
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const { log } = require('../../src/utils/logger');
      expect(log.warn).toHaveBeenCalledWith(
        '⚠️ Redis unavailable, using memory fallback',
        'system',
        expect.objectContaining({
          keyPrefix: 'failing-test',
          error: 'Connection failed'
        })
      );
      
      await failingCache.disconnect();
    });
  });

  describe('Redis-backed operations', () => {
    beforeEach(async () => {
      // Ensure Redis is "connected" for these tests
      (cache as any).connected = true;
      (cache as any).redis = mockRedis;
    });

    it('should set values in Redis', async () => {
      const testData = { id: 1, name: 'test' };
      
      await cache.set('testKey', testData, 300);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:testKey',
        300,
        JSON.stringify(testData)
      );
    });

    it('should use default TTL when none specified', async () => {
      const testData = { value: 'default-ttl' };
      
      await cache.set('defaultTTL', testData);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:defaultTTL',
        60, // Default TTL from constructor
        JSON.stringify(testData)
      );
    });

    it('should get values from Redis', async () => {
      const testData = { id: 2, name: 'retrieved' };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));
      
      const result = await cache.get('testKey');
      
      expect(mockRedis.get).toHaveBeenCalledWith('test:testKey');
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      mockRedis.get.mockResolvedValue(null);
      
      const result = await cache.get('nonExistent');
      
      expect(result).toBeNull();
    });

    it('should delete keys from Redis', async () => {
      await cache.delete('toDelete');
      
      expect(mockRedis.del).toHaveBeenCalledWith('test:toDelete');
    });

    it('should check if keys exist in Redis', async () => {
      mockRedis.exists.mockResolvedValue(1);
      
      const exists = await cache.exists('existingKey');
      
      expect(mockRedis.exists).toHaveBeenCalledWith('test:existingKey');
      expect(exists).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);
      
      const exists = await cache.exists('nonExistentKey');
      
      expect(exists).toBe(false);
    });

    it('should provide has() as alias for exists()', async () => {
      mockRedis.exists.mockResolvedValue(1);
      
      const has = await cache.has('existingKey');
      
      expect(mockRedis.exists).toHaveBeenCalledWith('test:existingKey');
      expect(has).toBe(true);
    });

    it('should get keys matching pattern from Redis', async () => {
      mockRedis.keys.mockResolvedValue(['test:user:1', 'test:user:2', 'test:user:3']);
      
      const keys = await cache.keys('user:*');
      
      expect(mockRedis.keys).toHaveBeenCalledWith('test:user:*');
      expect(keys).toEqual(['user:1', 'user:2', 'user:3']);
    });
  });

  describe('Memory fallback operations', () => {
    beforeEach(() => {
      // Disable Redis for these tests
      (cache as any).connected = false;
      (cache as any).redis = null;
    });

    it('should set values in memory fallback', async () => {
      const testData = { id: 1, name: 'memory-test' };
      
      await cache.set('memoryKey', testData, 300);
      
      const result = await cache.get('memoryKey');
      expect(result).toEqual(testData);
    });

    it('should respect TTL in memory fallback', async () => {
      const testData = { expires: true };
      
      // Set with very short TTL
      await cache.set('shortLived', testData, 0.01); // 10ms
      
      // Should exist immediately
      let result = await cache.get('shortLived');
      expect(result).toEqual(testData);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should be expired
      result = await cache.get('shortLived');
      expect(result).toBeNull();
    });

    it('should delete from memory fallback', async () => {
      const testData = { toDelete: true };
      
      await cache.set('deleteMe', testData);
      expect(await cache.get('deleteMe')).toEqual(testData);
      
      await cache.delete('deleteMe');
      expect(await cache.get('deleteMe')).toBeNull();
    });

    it('should check existence in memory fallback', async () => {
      const testData = { exists: true };
      
      await cache.set('existsTest', testData);
      
      expect(await cache.exists('existsTest')).toBe(true);
      expect(await cache.exists('doesNotExist')).toBe(false);
    });

    it('should not return expired items as existing', async () => {
      const testData = { expires: true };
      
      await cache.set('expiryTest', testData, 0.01); // 10ms
      
      // Should exist immediately
      expect(await cache.exists('expiryTest')).toBe(true);
      
      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should not exist after expiry
      expect(await cache.exists('expiryTest')).toBe(false);
    });

    it('should find keys matching pattern in memory', async () => {
      await cache.set('user:1', { id: 1 });
      await cache.set('user:2', { id: 2 });
      await cache.set('admin:1', { id: 3 });
      
      const userKeys = await cache.keys('user*');
      
      expect(userKeys).toContain('user:1');
      expect(userKeys).toContain('user:2');
      expect(userKeys).not.toContain('admin:1');
    });

    it('should clean up expired items automatically', async () => {
      const testData1 = { id: 1 };
      const testData2 = { id: 2 };
      
      // Set one item with short expiry, one with long expiry
      await cache.set('shortLived', testData1, 0.01); // 10ms
      await cache.set('longLived', testData2, 300); // 5 minutes
      
      // Wait for first item to expire
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Setting a new item should trigger cleanup
      await cache.set('trigger', { cleanup: true });
      
      // Verify cleanup happened - short lived should be gone
      const memoryMap = (cache as any).memoryFallback;
      expect(memoryMap.has('test:shortLived')).toBe(false);
      expect(memoryMap.has('test:longLived')).toBe(true);
    });
  });

  describe('Error handling', () => {
    beforeEach(async () => {
      (cache as any).connected = true;
      (cache as any).redis = mockRedis;
    });

    it('should fallback to memory when Redis set fails', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis set failed'));
      
      const testData = { failover: true };
      await cache.set('failoverTest', testData);
      
      // Should fall back to memory
      (cache as any).connected = false;
      const result = await cache.get('failoverTest');
      expect(result).toEqual(testData);
    });

    it('should return null when Redis get fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis get failed'));
      
      const result = await cache.get('failedGet');
      
      expect(result).toBeNull();
    });

    it('should handle Redis delete failures gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis delete failed'));
      
      // Should not throw
      await expect(cache.delete('failedDelete')).resolves.toBeUndefined();
    });

    it('should return false when Redis exists check fails', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis exists failed'));
      
      const exists = await cache.exists('failedExists');
      
      expect(exists).toBe(false);
    });

    it('should return empty array when Redis keys operation fails', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis keys failed'));
      
      const keys = await cache.keys('*');
      
      expect(keys).toEqual([]);
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockRedis.get.mockResolvedValue('invalid-json{');
      
      // Should not throw, should return null
      const result = await cache.get('invalidJson');
      expect(result).toBeNull();
    });
  });

  describe('Type safety and generics', () => {
    it('should work with typed data structures', async () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }
      
      const userCache = new PersistentCache<User>('users', 300);
      
      // Wait for initialization and then force memory fallback
      await new Promise(resolve => setTimeout(resolve, 20));
      (userCache as any).connected = false; // Use memory fallback for test
      
      const user: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };
      
      await userCache.set('user:1', user);
      const retrieved = await userCache.get('user:1');
      
      expect(retrieved).toEqual(user);
      expect(retrieved!.id).toBe(1);
      expect(retrieved!.name).toBe('John Doe');
      
      await userCache.disconnect();
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        user: {
          id: 1,
          profile: {
            name: 'Jane',
            settings: {
              theme: 'dark',
              notifications: ['email', 'push']
            }
          }
        },
        metadata: {
          created: '2024-01-01',
          tags: ['important', 'user-data']
        }
      };
      
      (cache as any).connected = false;
      
      await cache.set('complex', complexData);
      const result = await cache.get('complex');
      
      expect(result).toEqual(complexData);
      expect(result.user.profile.settings.notifications).toContain('email');
    });
  });

  describe('Factory function', () => {
    it('should create cache instances via factory', () => {
      const factoryCache = createPersistentCache<string>('factory-test', 120);
      
      expect(factoryCache).toBeInstanceOf(PersistentCache);
    });

    it('should create cache with custom TTL', async () => {
      const customCache = createPersistentCache<number>('custom', 999);
      (customCache as any).connected = false;
      
      // Access the private defaultTTL to verify it was set
      expect((customCache as any).defaultTTL).toBe(999);
      
      await customCache.disconnect();
    });
  });

  describe('Connection management', () => {
    it('should disconnect from Redis properly', async () => {
      (cache as any).connected = true;
      (cache as any).redis = mockRedis;
      
      await cache.disconnect();
      
      expect(mockRedis.disconnect).toHaveBeenCalled();
      expect((cache as any).connected).toBe(false);
    });

    it('should handle disconnect when Redis is not connected', async () => {
      (cache as any).redis = null;
      
      // Should not throw
      await expect(cache.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('Edge cases and performance', () => {
    it('should handle rapid successive operations', async () => {
      (cache as any).connected = false; // Use memory fallback for predictable timing
      
      const promises: Promise<any>[] = [];
      
      // Perform many operations simultaneously
      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`key${i}`, { value: i }));
      }
      
      await Promise.all(promises);
      
      // Verify all were stored
      for (let i = 0; i < 100; i++) {
        const result = await cache.get(`key${i}`);
        expect(result).toEqual({ value: i });
      }
    });

    it('should handle very large objects', async () => {
      (cache as any).connected = false;
      
      const largeObject = {
        data: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'A'.repeat(100) // 100 character string
        }))
      };
      
      await cache.set('large', largeObject);
      const result = await cache.get('large');
      
      expect(result).toEqual(largeObject);
      expect(result.data).toHaveLength(1000);
    });

    it('should handle null and undefined values', async () => {
      (cache as any).connected = false;
      
      await cache.set('nullValue', null);
      await cache.set('undefinedValue', undefined);
      
      expect(await cache.get('nullValue')).toBe(null);
      expect(await cache.get('undefinedValue')).toBe(undefined);
    });
  });
});
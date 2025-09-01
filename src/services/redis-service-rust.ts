/**
 * Redis Service - TypeScript Wrapper for Rust Implementation
 * 
 * High-performance Redis client with in-memory fallback, powered by Rust.
 * Provides transparent integration with the existing TypeScript codebase
 * while leveraging Rust's performance benefits.
 */

import { createRequire } from 'module';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

const require = createRequire(import.meta.url);

// Try to load the native Rust module
let nativeModule: any;
try {
  nativeModule = require('../../crates/redis-service/index.node');
} catch (error) {
  Logger.warn('Native Redis module not found, using TypeScript fallback', error);
}

export interface RedisConfig {
  url?: string;
  maxConnections?: number;
  minIdle?: number;
  connectionTimeoutMs?: number;
  commandTimeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  enableCluster?: boolean;
  clusterNodes?: string[];
  password?: string;
  database?: number;
}

export interface CacheConfig {
  strategy?: 'LRU' | 'LFU' | 'FIFO' | 'ARC';
  maxSizeBytes?: number;
  maxEntries?: number;
  defaultTtlSeconds?: number;
  enableCompression?: boolean;
  compressionThreshold?: number;
  enableClustering?: boolean;
  enablePersistence?: boolean;
  persistenceIntervalSeconds?: number;
}

export interface CacheStatistics {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  compressionCount: number;
  decompressionCount: number;
  averageEntrySize: number;
  hitRate: number;
  missRate: number;
  compressionRatio: number;
  uptimeSeconds: number;
}

export interface ConnectionStatus {
  connected: boolean;
  url: string;
  activeConnections: number;
  idleConnections: number;
  totalConnectionsCreated: number;
  totalConnectionsClosed: number;
  lastError?: string;
  reconnectAttempts: number;
  usingFallback: boolean;
}

export interface SessionData {
  sessionId: string;
  userId?: string;
  data: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export class RedisServiceRust extends EventEmitter {
  private static instance: RedisServiceRust;
  private initialized = false;
  private fallbackMap = new Map<string, { value: any; expires?: number }>();

  private constructor() {
    super();
  }

  public static getInstance(): RedisServiceRust {
    if (!RedisServiceRust.instance) {
      RedisServiceRust.instance = new RedisServiceRust();
    }
    return RedisServiceRust.instance;
  }

  /**
   * Initialize the Redis service with configuration
   */
  public async initialize(
    redisConfig?: RedisConfig,
    cacheConfig?: CacheConfig
  ): Promise<void> {
    if (this.initialized) {
      Logger.warn('Redis service already initialized');
      return;
    }

    if (nativeModule) {
      try {
        await nativeModule.initializeRedisService(redisConfig, cacheConfig);
        this.initialized = true;
        Logger.info('Rust-powered Redis service initialized');
        this.emit('initialized');
      } catch (error) {
        Logger.error('Failed to initialize native Redis module', error);
        throw error;
      }
    } else {
      // Fallback to in-memory implementation
      this.initialized = true;
      Logger.info('Using in-memory fallback (Rust module not available)');
      this.emit('initialized');
    }
  }

  /**
   * Get a value from the cache
   */
  public async get<T = any>(key: string): Promise<T | null> {
    if (nativeModule) {
      try {
        const value = await nativeModule.cacheGet(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        Logger.error(`Failed to get key ${key}`, error);
        return this.getFallback(key);
      }
    }
    return this.getFallback(key);
  }

  /**
   * Set a value in the cache
   */
  public async set(
    key: string,
    value: any,
    ttlSeconds?: number
  ): Promise<void> {
    const jsonValue = JSON.stringify(value);

    if (nativeModule) {
      try {
        await nativeModule.cacheSet(key, jsonValue, ttlSeconds);
        this.emit('set', { key, ttl: ttlSeconds });
      } catch (error) {
        Logger.error(`Failed to set key ${key}`, error);
        this.setFallback(key, value, ttlSeconds);
      }
    } else {
      this.setFallback(key, value, ttlSeconds);
    }
  }

  /**
   * Delete a key from the cache
   */
  public async delete(key: string): Promise<boolean> {
    if (nativeModule) {
      try {
        const result = await nativeModule.cacheDelete(key);
        this.emit('delete', { key });
        return result;
      } catch (error) {
        Logger.error(`Failed to delete key ${key}`, error);
        return this.deleteFallback(key);
      }
    }
    return this.deleteFallback(key);
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<boolean> {
    if (nativeModule) {
      try {
        return await nativeModule.cacheExists(key);
      } catch (error) {
        Logger.error(`Failed to check existence of key ${key}`, error);
        return this.existsFallback(key);
      }
    }
    return this.existsFallback(key);
  }

  /**
   * Flush all data from the cache
   */
  public async flushAll(): Promise<void> {
    if (nativeModule) {
      try {
        await nativeModule.cacheFlushAll();
        this.emit('flush');
      } catch (error) {
        Logger.error('Failed to flush cache', error);
        this.fallbackMap.clear();
      }
    } else {
      this.fallbackMap.clear();
    }
  }

  /**
   * Get cache statistics
   */
  public async getStatistics(): Promise<CacheStatistics> {
    if (nativeModule) {
      try {
        return await nativeModule.getCacheStatistics();
      } catch (error) {
        Logger.error('Failed to get cache statistics', error);
        return this.getFallbackStatistics();
      }
    }
    return this.getFallbackStatistics();
  }

  /**
   * Get connection status
   */
  public async getConnectionStatus(): Promise<ConnectionStatus> {
    if (nativeModule) {
      try {
        return await nativeModule.getConnectionStatus();
      } catch (error) {
        Logger.error('Failed to get connection status', error);
        return this.getFallbackConnectionStatus();
      }
    }
    return this.getFallbackConnectionStatus();
  }

  /**
   * Check if Redis is available
   */
  public async isRedisAvailable(): Promise<boolean> {
    if (nativeModule) {
      try {
        return await nativeModule.isRedisAvailable();
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Ping Redis server
   */
  public async ping(): Promise<boolean> {
    if (nativeModule) {
      try {
        return await nativeModule.pingRedis();
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Reconnect to Redis
   */
  public async reconnect(): Promise<void> {
    if (nativeModule) {
      try {
        await nativeModule.reconnectRedis();
        this.emit('reconnected');
      } catch (error) {
        Logger.error('Failed to reconnect to Redis', error);
        throw error;
      }
    }
  }

  // Session Management Methods

  /**
   * Create a new session
   */
  public async createSession(
    sessionId: string,
    ttlSeconds?: number
  ): Promise<SessionData> {
    if (nativeModule) {
      try {
        return await nativeModule.sessionCreate(sessionId, ttlSeconds);
      } catch (error) {
        Logger.error('Failed to create session', error);
        throw error;
      }
    }
    throw new Error('Session management requires native module');
  }

  /**
   * Get a session by ID
   */
  public async getSession(sessionId: string): Promise<SessionData | null> {
    if (nativeModule) {
      try {
        return await nativeModule.sessionGet(sessionId);
      } catch (error) {
        Logger.error('Failed to get session', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Update session data
   */
  public async updateSession(
    sessionId: string,
    key: string,
    value: any
  ): Promise<void> {
    if (nativeModule) {
      try {
        await nativeModule.sessionUpdate(
          sessionId,
          key,
          JSON.stringify(value)
        );
      } catch (error) {
        Logger.error('Failed to update session', error);
        throw error;
      }
    }
  }

  /**
   * Delete a session
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    if (nativeModule) {
      try {
        return await nativeModule.sessionDelete(sessionId);
      } catch (error) {
        Logger.error('Failed to delete session', error);
        return false;
      }
    }
    return false;
  }

  // Pub/Sub Methods (if native module supports them)

  /**
   * Subscribe to a channel
   */
  public async subscribe(
    channel: string,
    callback: (message: string) => void
  ): Promise<void> {
    // This would require additional NAPI implementation for callbacks
    Logger.warn('Pub/Sub not yet implemented in TypeScript wrapper');
  }

  /**
   * Publish to a channel
   */
  public async publish(channel: string, message: string): Promise<number> {
    // This would require additional NAPI implementation
    Logger.warn('Pub/Sub not yet implemented in TypeScript wrapper');
    return 0;
  }

  // Private fallback methods

  private getFallback<T>(key: string): T | null {
    const entry = this.fallbackMap.get(key);
    if (!entry) return null;

    if (entry.expires && entry.expires < Date.now()) {
      this.fallbackMap.delete(key);
      return null;
    }

    return entry.value;
  }

  private setFallback(key: string, value: any, ttlSeconds?: number): void {
    const expires = ttlSeconds
      ? Date.now() + ttlSeconds * 1000
      : undefined;

    this.fallbackMap.set(key, { value, expires });
    this.emit('set', { key, ttl: ttlSeconds });
  }

  private deleteFallback(key: string): boolean {
    const existed = this.fallbackMap.has(key);
    this.fallbackMap.delete(key);
    if (existed) {
      this.emit('delete', { key });
    }
    return existed;
  }

  private existsFallback(key: string): boolean {
    const entry = this.fallbackMap.get(key);
    if (!entry) return false;

    if (entry.expires && entry.expires < Date.now()) {
      this.fallbackMap.delete(key);
      return false;
    }

    return true;
  }

  private getFallbackStatistics(): CacheStatistics {
    const entries = Array.from(this.fallbackMap.values());
    const totalSize = entries.reduce(
      (sum, entry) => sum + JSON.stringify(entry.value).length,
      0
    );

    return {
      totalEntries: this.fallbackMap.size,
      totalSizeBytes: totalSize,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      compressionCount: 0,
      decompressionCount: 0,
      averageEntrySize: this.fallbackMap.size > 0 ? totalSize / this.fallbackMap.size : 0,
      hitRate: 0,
      missRate: 0,
      compressionRatio: 1.0,
      uptimeSeconds: process.uptime(),
    };
  }

  private getFallbackConnectionStatus(): ConnectionStatus {
    return {
      connected: false,
      url: 'memory://localhost',
      activeConnections: 0,
      idleConnections: 0,
      totalConnectionsCreated: 0,
      totalConnectionsClosed: 0,
      reconnectAttempts: 0,
      usingFallback: true,
    };
  }

  /**
   * Cleanup expired entries in fallback map
   */
  public cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.fallbackMap.entries()) {
      if (entry.expires && entry.expires < now) {
        this.fallbackMap.delete(key);
      }
    }
  }
}

// Export singleton instance
export const redisService = RedisServiceRust.getInstance();

// Re-export types
export type { RedisServiceError } from '../../crates/redis-service/index';

// Helper function for backwards compatibility
export async function initializeRedis(
  config?: RedisConfig & CacheConfig
): Promise<RedisServiceRust> {
  const service = RedisServiceRust.getInstance();
  
  const redisConfig: RedisConfig = {
    url: config?.url,
    maxConnections: config?.maxConnections,
    minIdle: config?.minIdle,
    connectionTimeoutMs: config?.connectionTimeoutMs,
    commandTimeoutMs: config?.commandTimeoutMs,
    maxRetries: config?.maxRetries,
    retryDelayMs: config?.retryDelayMs,
    enableCluster: config?.enableCluster,
    clusterNodes: config?.clusterNodes,
    password: config?.password,
    database: config?.database,
  };

  const cacheConfig: CacheConfig = {
    strategy: config?.strategy,
    maxSizeBytes: config?.maxSizeBytes,
    maxEntries: config?.maxEntries,
    defaultTtlSeconds: config?.defaultTtlSeconds,
    enableCompression: config?.enableCompression,
    compressionThreshold: config?.compressionThreshold,
    enableClustering: config?.enableClustering,
    enablePersistence: config?.enablePersistence,
    persistenceIntervalSeconds: config?.persistenceIntervalSeconds,
  };

  await service.initialize(redisConfig, cacheConfig);
  return service;
}
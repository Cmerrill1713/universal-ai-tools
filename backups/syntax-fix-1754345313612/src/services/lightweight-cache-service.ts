/**
 * Lightweight Cache Service;
 * High-performance in-memory cache with TTL, LRU eviction, and metrics;
 */

import { LogContext, log } from '../utils/logger';

export interface CacheItem<T = any> {
  value: T;
  ttl: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
  size?: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalAccessTime: number;
  averageAccessTime: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTtlMs: number;
  enableMetrics: boolean;
  enableLRU: boolean;
  maxMemoryMB?: number;
}

export class LightweightCacheService {
  private cache = new Map<string, CacheItem>();
  private accessOrder: string[] = [];
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    totalAccessTime: 0,
    averageAccessTime: 0,
  };
  
  private config: CacheConfig = {
    maxSize: 10000,
    defaultTtlMs: 60000, // 1 minute;
    enableMetrics: true,
    enableLRU: true,
    maxMemoryMB: 256;
  };

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this?.config = { ...this?.config, ...config };
    }
    
    // Start cleanup interval;
    setInterval(() => this?.cleanup(), 30000); // Every 30 seconds;
    
    log?.info('Lightweight Cache Service initialized', LogContext?.SYSTEM, {
      maxSize: this?.config?.maxSize,
      defaultTtl: this?.config?.defaultTtlMs,
      enableMetrics: this?.config?.enableMetrics;
    });
  }

  /**
   * Set a value in cache;
   */
  public set<T>(key: string, value: T, ttlMs?: number): void {
    const startTime = Date?.now();
    
    try {
      const ttl = ttlMs || this?.config?.defaultTtlMs;
      const now = Date?.now();
      
      const item: CacheItem<T> = {
        value,
        ttl,
        createdAt: now,
        accessCount: 0,
        lastAccessed: now,
        size: this?.calculateSize(value)
      };
      
      // Check if we need to evict;
      if (this?.cache?.size >= this?.config?.maxSize) {
        this?.evictLRU();
      }
      
      this?.cache?.set(key, item);
      
      // Update LRU order;
      if (this?.config?.enableLRU) {
        this?.updateAccessOrder(key);
      }
      
      this?.updateMetrics('set', Date?.now() - startTime);
      
      log?.debug('Cache item set', LogContext?.SYSTEM, {
        key,
        size: item?.size,
        ttl;
      });
    } catch (error) {
      log?.error('Cache set operation failed', LogContext?.SERVER, {
        key,
        error: error instanceof Error ? error?.message : String(error),
      });
    }
  }

  /**
   * Get a value from cache;
   */
  public get<T>(key: string): T | null {
    const startTime = Date?.now();
    
    try {
      const item = this?.cache?.get(key);
      
      if (!item) {
        this?.updateMetrics('miss', Date?.now() - startTime);
        return null;
      }
      
      // Check if expired;
      if (this?.isExpired(item)) {
        this?.cache?.delete(key);
        this?.removeFromAccessOrder(key);
        this?.updateMetrics('miss', Date?.now() - startTime);
        return null;
      }
      
      // Update access info;
      item?.accessCount++;
      item?.lastAccessed = Date?.now();
      
      if (this?.config?.enableLRU) {
        this?.updateAccessOrder(key);
      }
      
      this?.updateMetrics('hit', Date?.now() - startTime);
      return item?.value as T;
  } catch (error) {
      log?.error('Cache get operation failed', LogContext?.SERVER, {
        key,
        error: error instanceof Error ? error?.message : String(error),
      });
      this?.updateMetrics('miss', Date?.now() - startTime);
      return null;
    }
  }

  /**
   * Get or set pattern;
   */
  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    ttlMs?: number;
  ): Promise<T> {
    let value = this?.get<T>(key);
    
    if (value !== null) {
      return value;
    }
    
    // Generate value;
    value = await factory();
    this?.set(key, value, ttlMs);
    
    return value;
  }

  /**
   * Delete a key from cache;
   */
  public delete(key: string): boolean {
    const existed = this?.cache?.has(key);
    this?.cache?.delete(key);
    this?.removeFromAccessOrder(key);
    
    if (existed) {
      this?.updateMetrics('delete');
    }
    
    return existed;
  }

  /**
   * Check if key exists and is not expired;
   */
  public has(key: string): boolean {
    const item = this?.cache?.get(key);
    if (!item) return false;
    
    if (this?.isExpired(item)) {
      this?.cache?.delete(key);
      this?.removeFromAccessOrder(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries;
   */
  public clear(): void {
    this?.cache?.clear();
    this?.accessOrder?.length = 0,
    log?.info('Cache cleared', LogContext?.SERVER);
  }

  /**
   * Get cache statistics;
   */
  public getStats() {
    return {
      size: this?.cache?.size,
      metrics: { ...this?.metrics },
    };
  }

  private evictLRU(): void {
    if (!this?.config?.enableLRU || this?.accessOrder?.length === 0) {
      // Simple eviction - remove first item;
      const firstKey = this?.cache?.keys().next().value;
      if (firstKey) {
        this?.cache?.delete(firstKey);
        this?.updateMetrics('evictions');
      }
      return;
    }
    
    // LRU eviction;
    const lruKey = this?.accessOrder?.shift();
    if (lruKey) {
      this?.cache?.delete(lruKey);
      this?.updateMetrics('evictions');
      
      log?.debug('LRU eviction performed', LogContext?.SYSTEM, {
        evictedKey: lruKey;
      });
    }
  }

  private updateAccessOrder(key: string): void {
    // Remove if exists;
    this?.removeFromAccessOrder(key);
    // Add to end (most recent)
    this?.accessOrder?.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this?.accessOrder?.indexOf(key);
    if (index > -1) {
      this?.accessOrder?.splice(index, 1);
    }
  }

  private isExpired(item: CacheItem): boolean {
    return Date?.now() > (item?.createdAt + item?.ttl);
  }

  private cleanup(): void {
    const expired: string[] = [];
    
    for (const [key, item] of this?.cache?.entries()) {
      if (this?.isExpired(item)) {
        expired?.push(key);
      }
    }
    
    expired?.forEach(key => {
      this?.cache?.delete(key);
      this?.removeFromAccessOrder(key);
    });
    
    if (expired?.length > 0) {
      log?.debug('Cache cleanup completed', LogContext?.SYSTEM, {
        expiredItems: expired?.length;
      });
    }
  }

  private calculateSize(value: any): number {
    try {
      if (value === null || value === undefined) return 8;
      if (typeof value === 'string') return value?.length * 2;
      if (typeof value === 'number') return 8;
      if (typeof value === 'boolean') return 4;
      return JSON?.stringify(value).length * 2;
    } catch {
      return 1024;
    }
  }

  private updateMetrics(operation: 'hit' | 'miss' | 'set' | 'delete' | 'evictions', accessTime?: number): void {
    if (!this?.config?.enableMetrics) return;
    
    switch (operation) {
      case 'hit':
        this?.metrics?.hits++;
        break;
      case 'miss':
        this?.metrics?.misses++;
        break;
      case 'set':
        this?.metrics?.sets++;
        break;
      case 'delete':
        this?.metrics?.deletes++;
        break;
      case 'evictions':
        this?.metrics?.evictions++;
        break;
    }
    
    if (accessTime !== undefined) {
      this?.metrics?.totalAccessTime += accessTime;
      const totalOps = this?.metrics?.hits + this?.metrics?.misses;
      this?.metrics?.averageAccessTime = totalOps > 0 ? this?.metrics?.totalAccessTime / totalOps : 0,
    }
  }
}

// Export singleton instance;
export const lightweightCache = new LightweightCacheService();
export default lightweightCache;
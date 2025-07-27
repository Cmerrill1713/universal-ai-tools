import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

interface TTLCacheEntry<T> {
  value: T;
  expiresAt: number;
  ttl: number;
  refreshOnAccess: boolean;
}

interface TTLCacheOptions {
  defaultTTL?: number;
  checkInterval?: number;
  maxItems?: number;
  refreshOnAccess?: boolean;
  onExpire?: (key: string, value: any) => void;
}

export class TTLCache<T = any> extends EventEmitter {
  private cache: Map<string, TTLCacheEntry<T>>;
  private defaultTTL: number;
  private checkInterval: number;
  private maxItems: number;
  private refreshOnAccess: boolean;
  private onExpire?: (key: string, value: any) => void;
  private cleanupTimer?: NodeJS.Timeout;
  private expirationQueue: Map<number, Set<string>>;

  constructor(options: TTLCacheOptions = {}) {
    super();
    this.cache = new Map();
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour default
    this.checkInterval = options.checkInterval || 60000; // 1 minute default
    this.maxItems = options.maxItems || Infinity;
    this.refreshOnAccess = options.refreshOnAccess || false;
    this.onExpire = options.onExpire;
    this.expirationQueue = new Map();

    this.startCleanupTimer();
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.checkInterval);

    // Don't prevent process from exiting
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);

        if (this.onExpire) {
          this.onExpire(key, entry.value);
        }

        this.emit('expire', key, entry.value);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`TTL cache cleaned up ${cleaned} expired entries`);
    }

    // Clean up expiration queue
    for (const [timestamp, keys] of this.expirationQueue.entries()) {
      if (timestamp <= now) {
        this.expirationQueue.delete(timestamp);
      } else {
        break; // Queue is sorted, so we can stop here
      }
    }
  }

  private addToExpirationQueue(key: string, expiresAt: number): void {
    const timestamp = Math.floor(expiresAt / 1000) * 1000; // Round to nearest second

    if (!this.expirationQueue.has(timestamp)) {
      this.expirationQueue.set(timestamp, new Set());
    }

    this.expirationQueue.get(timestamp)!.add(key);
  }

  private removeFromExpirationQueue(key: string): void {
    for (const [timestamp, keys] of this.expirationQueue.entries()) {
      if (keys.has(key)) {
        keys.delete(key);
        if (keys.size === 0) {
          this.expirationQueue.delete(timestamp);
        }
        break;
      }
    }
  }

  private makeSpace(): void {
    if (this.cache.size >= this.maxItems) {
      // Remove oldest item
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.delete(oldestKey);
      }
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.emit('miss', key);
      return undefined;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.delete(key);
      this.emit('miss', key);
      return undefined;
    }

    // Refresh TTL if enabled
    if (entry.refreshOnAccess || this.refreshOnAccess) {
      this.removeFromExpirationQueue(key);
      entry.expiresAt = Date.now() + entry.ttl * 1000;
      this.addToExpirationQueue(key, entry.expiresAt);
    }

    this.emit('hit', key);
    return entry.value;
  }

  set(key: string, value: T, ttl?: number, options?: { refreshOnAccess?: boolean }): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Make space for new item
    this.makeSpace();

    const itemTTL = ttl || this.defaultTTL;
    const expiresAt = Date.now() + itemTTL * 1000;

    const entry: TTLCacheEntry<T> = {
      value,
      expiresAt,
      ttl: itemTTL,
      refreshOnAccess: options?.refreshOnAccess || this.refreshOnAccess,
    };

    this.cache.set(key, entry);
    this.addToExpirationQueue(key, expiresAt);

    this.emit('set', key, value, itemTTL);
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.removeFromExpirationQueue(key);

    this.emit('delete', key, entry.value);
    return true;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (Date.now() >= entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.onExpire) {
        this.onExpire(key, entry.value);
      }
    }

    this.cache.clear();
    this.expirationQueue.clear();
    this.emit('clear');
  }

  size(): number {
    // Clean up expired entries first
    this.cleanup();
    return this.cache.size;
  }

  keys(): string[] {
    const keys: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now < entry.expiresAt) {
        keys.push(key);
      }
    }

    return keys;
  }

  values(): T[] {
    const values: T[] = [];
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (now < entry.expiresAt) {
        values.push(entry.value);
      }
    }

    return values;
  }

  entries(): Array<[string, T]> {
    const entries: Array<[string, T]> = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now < entry.expiresAt) {
        entries.push([key, entry.value]);
      }
    }

    return entries;
  }

  getRemainingTTL(key: string): number | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? Math.floor(remaining / 1000) : 0;
  }

  setTTL(key: string, ttl: number): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    this.removeFromExpirationQueue(key);
    entry.ttl = ttl;
    entry.expiresAt = Date.now() + ttl * 1000;
    this.addToExpirationQueue(key, entry.expiresAt);

    return true;
  }

  touch(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    this.removeFromExpirationQueue(key);
    entry.expiresAt = Date.now() + entry.ttl * 1000;
    this.addToExpirationQueue(key, entry.expiresAt);

    return true;
  }

  getStats(): {
    items: number;
    expired: number;
    avgTTL: number;
    nextExpiration: number | null;
  } {
    this.cleanup();

    let totalTTL = 0;
    let expired = 0;
    let nextExpiration: number | null = null;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (entry.expiresAt <= now) {
        expired++;
      } else {
        totalTTL += entry.ttl;
        if (!nextExpiration || entry.expiresAt < nextExpiration) {
          nextExpiration = entry.expiresAt;
        }
      }
    }

    const activeItems = this.cache.size - expired;

    return {
      items: activeItems,
      expired,
      avgTTL: activeItems > 0 ? totalTTL / activeItems : 0,
      nextExpiration,
    };
  }

  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  *[Symbol.iterator](): IterableIterator<[string, T]> {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now < entry.expiresAt) {
        yield [key, entry.value];
      }
    }
  }
}

export default TTLCache;

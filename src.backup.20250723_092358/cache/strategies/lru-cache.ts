import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

interface CacheEntry<T> {
  key: string;
  value: T;
  size: number;
  accessed: number;
  created: number;
}

interface LRUCacheOptions {
  maxSize?: number;
  maxItems?: number;
  ttl?: number;
  onEvict?: (key: string, value: any) => void;
}

export class LRUCache<T = any> extends EventEmitter {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private maxItems: number;
  private currentSize: number;
  private ttl: number;
  private onEvict?: (key: string, value: any) => void;

  constructor(options: LRUCacheOptions = {}) {
    super();
    this.cache = new Map();
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
    this.maxItems = options.maxItems || 10000;
    this.ttl = options.ttl || 0; // 0 means no TTL
    this.currentSize = 0;
    this.onEvict = options.onEvict;
  }

  private calculateSize(value: T): number {
    if (typeof value === 'string') {
      return value.length * 2; // Approximate UTF-16 size
    } else if (Buffer.isBuffer(value)) {
      return value.length;
    } else {
      // Rough estimate for objects
      return JSON.stringify(value).length * 2;
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccessed = Infinity;

    // Find least recently used item
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessed < oldestAccessed) {
        oldestAccessed = entry.accessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private makeSpace(requiredSize: number): void {
    // Evict items until we have enough space
    while (
      (this.currentSize + requiredSize > this.maxSize || this.cache.size >= this.maxItems) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    if (this.ttl <= 0) return false;
    return Date.now() - entry.created > this.ttl * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.emit('miss', key);
      return undefined;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.emit('miss', key);
      return undefined;
    }

    // Update access time and move to end (most recent)
    entry.accessed = Date.now();
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.emit('hit', key);
    return entry.value;
  }

  set(key: string, value: T): void {
    const size = this.calculateSize(value);

    // Check if single item is too large
    if (size > this.maxSize) {
      logger.warn(`Item ${key} is too large (${size} bytes) for cache`);
      return;
    }

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Make space for new item
    this.makeSpace(size);

    const entry: CacheEntry<T> = {
      key,
      value,
      size,
      accessed: Date.now(),
      created: Date.now(),
    };

    this.cache.set(key, entry);
    this.currentSize += size;

    this.emit('set', key, value);
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.currentSize -= entry.size;

    if (this.onEvict) {
      this.onEvict(key, entry.value);
    }

    this.emit('evict', key, entry.value);
    return true;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    for (const [key, entry] of this.cache.entries()) {
      if (this.onEvict) {
        this.onEvict(key, entry.value);
      }
    }

    this.cache.clear();
    this.currentSize = 0;
    this.emit('clear');
  }

  size(): number {
    return this.cache.size;
  }

  sizeBytes(): number {
    return this.currentSize;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  values(): T[] {
    const values: T[] = [];

    for (const entry of this.cache.values()) {
      if (!this.isExpired(entry)) {
        values.push(entry.value);
      }
    }

    return values;
  }

  entries(): Array<[string, T]> {
    const entries: Array<[string, T]> = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        entries.push([key, entry.value]);
      }
    }

    return entries;
  }

  prune(): number {
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  resize(maxSize: number, maxItems: number): void {
    this.maxSize = maxSize;
    this.maxItems = maxItems;

    // Evict items if necessary
    while (
      (this.currentSize > this.maxSize || this.cache.size > this.maxItems) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }
  }

  getStats(): {
    items: number;
    size: number;
    maxItems: number;
    maxSize: number;
    hitRate: number;
  } {
    const hits = this.listenerCount('hit');
    const misses = this.listenerCount('miss');
    const total = hits + misses;

    return {
      items: this.cache.size,
      size: this.currentSize,
      maxItems: this.maxItems,
      maxSize: this.maxSize,
      hitRate: total > 0 ? hits / total : 0,
    };
  }

  // Iterate in LRU order (oldest first)
  *lruIterator(): IterableIterator<[string, T]> {
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].accessed - b[1].accessed);

    for (const [key, entry] of entries) {
      if (!this.isExpired(entry)) {
        yield [key, entry.value];
      }
    }
  }

  // Iterate in MRU order (newest first)
  *mruIterator(): IterableIterator<[string, T]> {
    const entries = Array.from(this.cache.entries()).sort((a, b) => b[1].accessed - a[1].accessed);

    for (const [key, entry] of entries) {
      if (!this.isExpired(entry)) {
        yield [key, entry.value];
      }
    }
  }
}

export default LRUCache;

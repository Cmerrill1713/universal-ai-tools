import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
interface CacheEntry<T> {;
  key: string;
  value: T;
  size: number;
  accessed: number;
  created: number;
;
};

interface LRUCacheOptions {;
  maxSize?: number;
  maxItems?: number;
  ttl?: number;
  onEvict?: (key: string, value: any) => void;
;
};

export class LRUCache<T = any> extends EventEmitter {;
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private maxItems: number;
  private currentSize: number;
  private ttl: number;
  private onEvict?: (key: string, value: any) => void;
  constructor(options: LRUCacheOptions = {}) {;
    super();
    thiscache = new Map();
    thismaxSize = optionsmaxSize || 100 * 1024 * 1024; // 100MB default;
    thismaxItems = optionsmaxItems || 10000;
    thisttl = optionsttl || 0; // 0 means no TTL;
    thiscurrentSize = 0;
    thisonEvict = optionsonEvict;
  };

  private calculateSize(value: T): number {;
    if (typeof value === 'string') {;
      return valuelength * 2; // Approximate UTF-16 size;
    } else if (BufferisBuffer(value)) {;
      return valuelength;
    } else {;
      // Rough estimate for objects;
      return JSONstringify(value)length * 2;
    };
  };

  private evictLRU(): void {;
    let oldestKey: string | null = null;
    let oldestAccessed = Infinity;
    // Find least recently used item;
    for (const [key, entry] of thiscacheentries()) {;
      if (entryaccessed < oldestAccessed) {;
        oldestAccessed = entryaccessed;
        oldestKey = key;
      };
    };

    if (oldestKey) {;
      thisdelete(oldestKey);
    };
  };

  private makeSpace(requiredSize: number): void {;
    // Evict items until we have enough space;
    while (;
      (thiscurrentSize + requiredSize > thismaxSize || thiscachesize >= thismaxItems) &&;
      thiscachesize > 0;
    ) {;
      thisevictLRU();
    ;
};
  };

  private isExpired(entry: CacheEntry<T>): boolean {;
    if (thisttl <= 0) return false;
    return Datenow() - entrycreated > thisttl * 1000;
  };

  get(key: string): T | undefined {;
    const entry = thiscacheget(key);
    if (!entry) {;
      thisemit('miss', key);
      return undefined;
    };

    // Check if expired;
    if (thisisExpired(entry)) {;
      thisdelete(key);
      thisemit('miss', key);
      return undefined;
    };

    // Update access time and move to end (most recent);
    entryaccessed = Datenow();
    thiscachedelete(key);
    thiscacheset(key, entry);
    thisemit('hit', key);
    return entryvalue;
  };

  set(key: string, value: T): void {;
    const size = thiscalculateSize(value);
    // Check if single item is too large;
    if (size > thismaxSize) {;
      loggerwarn(`Item ${key} is too large (${size} bytes) for cache`);
      return;
    };

    // Remove existing entry if present;
    if (thiscachehas(key)) {;
      thisdelete(key);
    };

    // Make space for new item;
    thismakeSpace(size);
    const entry: CacheEntry<T> = {;
      key;
      value;
      size;
      accessed: Datenow();
      created: Datenow();
    ;
};
    thiscacheset(key, entry);
    thiscurrentSize += size;
    thisemit('set', key, value);
  };

  delete(key: string): boolean {;
    const entry = thiscacheget(key);
    if (!entry) {;
      return false;
    };

    thiscachedelete(key);
    thiscurrentSize -= entrysize;
    if (thisonEvict) {;
      thisonEvict(key, entryvalue);
    };

    thisemit('evict', key, entryvalue);
    return true;
  };

  has(key: string): boolean {;
    const entry = thiscacheget(key);
    if (!entry) return false;
    // Check expiration;
    if (thisisExpired(entry)) {;
      thisdelete(key);
      return false;
    };

    return true;
  };

  clear(): void {;
    for (const [key, entry] of thiscacheentries()) {;
      if (thisonEvict) {;
        thisonEvict(key, entryvalue);
      };
    };

    thiscacheclear();
    thiscurrentSize = 0;
    thisemit('clear');
  };

  size(): number {;
    return thiscachesize;
  };

  sizeBytes(): number {;
    return thiscurrentSize;
  };

  keys(): string[] {;
    return Arrayfrom(thiscachekeys());
  };

  values(): T[] {;
    const values: T[] = [];
    for (const entry of thiscachevalues()) {;
      if (!thisisExpired(entry)) {;
        valuespush(entryvalue);
      };
    };

    return values;
  };

  entries(): Array<[string, T]> {;
    const entries: Array<[string, T]> = [];
    for (const [key, entry] of thiscacheentries()) {;
      if (!thisisExpired(entry)) {;
        entriespush([key, entryvalue]);
      };
    };

    return entries;
  };

  prune(): number {;
    let pruned = 0;
    for (const [key, entry] of thiscacheentries()) {;
      if (thisisExpired(entry)) {;
        thisdelete(key);
        pruned++;
      };
    };

    return pruned;
  };

  resize(maxSize: number, maxItems: number): void {;
    thismaxSize = maxSize;
    thismaxItems = maxItems;
    // Evict items if necessary;
    while (;
      (thiscurrentSize > thismaxSize || thiscachesize > thismaxItems) &&;
      thiscachesize > 0;
    ) {;
      thisevictLRU();
    ;
};
  };

  getStats(): {;
    items: number;
    size: number;
    maxItems: number;
    maxSize: number;
    hitRate: number;
  } {;
    const hits = thislistenerCount('hit');
    const misses = thislistenerCount('miss');
    const total = hits + misses;
    return {;
      items: thiscachesize;
      size: thiscurrentSize;
      maxItems: thismaxItems;
      maxSize: thismaxSize;
      hitRate: total > 0 ? hits / total : 0;
    ;
};
  };

  // Iterate in LRU order (oldest first);
  *lruIterator(): IterableIterator<[string, T]> {;
    const entries = Arrayfrom(thiscacheentries())sort((a, b) => a[1]accessed - b[1]accessed);
    for (const [key, entry] of entries) {;
      if (!thisisExpired(entry)) {;
        yield [key, entryvalue];
      };
    };
  };

  // Iterate in MRU order (newest first);
  *mruIterator(): IterableIterator<[string, T]> {;
    const entries = Arrayfrom(thiscacheentries())sort((a, b) => b[1]accessed - a[1]accessed);
    for (const [key, entry] of entries) {;
      if (!thisisExpired(entry)) {;
        yield [key, entryvalue];
      };
    };
  };
};

export default LRUCache;
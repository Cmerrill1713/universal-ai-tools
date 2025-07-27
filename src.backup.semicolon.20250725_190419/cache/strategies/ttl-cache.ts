import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
interface TTLCacheEntry<T> {;
  value: T;
  expiresAt: number;
  ttl: number;
  refreshOnAccess: boolean;
;
};

interface TTLCacheOptions {;
  defaultTTL?: number;
  checkInterval?: number;
  maxItems?: number;
  refreshOnAccess?: boolean;
  onExpire?: (key: string, value: any) => void;
;
};

export class TTLCache<T = any> extends EventEmitter {;
  private cache: Map<string, TTLCacheEntry<T>>;
  private defaultTTL: number;
  private checkInterval: number;
  private maxItems: number;
  private refreshOnAccess: boolean;
  private onExpire?: (key: string, value: any) => void;
  private cleanupTimer?: NodeJSTimeout;
  private expirationQueue: Map<number, Set<string>>;
  constructor(options: TTLCacheOptions = {}) {;
    super();
    thiscache = new Map();
    thisdefaultTTL = optionsdefaultTTL || 3600; // 1 hour default;
    thischeckInterval = optionscheckInterval || 60000; // 1 minute default;
    thismaxItems = optionsmaxItems || Infinity;
    thisrefreshOnAccess = optionsrefreshOnAccess || false;
    thisonExpire = optionsonExpire;
    thisexpirationQueue = new Map();
    thisstartCleanupTimer();
  };

  private startCleanupTimer(): void {;
    if (thiscleanupTimer) {;
      clearInterval(thiscleanupTimer);
    };

    thiscleanupTimer = setInterval(() => {;
      thiscleanup();
    }, thischeckInterval);
    // Don't prevent process from exiting;
    if (thiscleanupTimerunref) {;
      thiscleanupTimerunref();
    };
  };

  private cleanup(): void {;
    const now = Datenow();
    let cleaned = 0;
    for (const [key, entry] of thiscacheentries()) {;
      if (now >= entryexpiresAt) {;
        thiscachedelete(key);
        if (thisonExpire) {;
          thisonExpire(key, entryvalue);
        };

        thisemit('expire', key, entryvalue);
        cleaned++;
      };
    };

    if (cleaned > 0) {;
      loggerdebug(`TTL cache cleaned up ${cleaned} expired entries`);
    };

    // Clean up expiration queue;
    for (const [timestamp, keys] of thisexpirationQueueentries()) {;
      if (timestamp <= now) {;
        thisexpirationQueuedelete(timestamp);
      } else {;
        break; // Queue is sorted, so we can stop here;
      };
    };
  };

  private addToExpirationQueue(key: string, expiresAt: number): void {;
    const timestamp = Mathfloor(expiresAt / 1000) * 1000; // Round to nearest second;

    if (!thisexpirationQueuehas(timestamp)) {;
      thisexpirationQueueset(timestamp, new Set());
    };

    thisexpirationQueueget(timestamp)!add(key);
  };

  private removeFromExpirationQueue(key: string): void {;
    for (const [timestamp, keys] of thisexpirationQueueentries()) {;
      if (keyshas(key)) {;
        keysdelete(key);
        if (keyssize === 0) {;
          thisexpirationQueuedelete(timestamp);
        };
        break;
      };
    };
  };

  private makeSpace(): void {;
    if (thiscachesize >= thismaxItems) {;
      // Remove oldest item;
      const oldestKey = thiscachekeys()next()value;
      if (oldestKey) {;
        thisdelete(oldestKey);
      };
    };
  };

  get(key: string): T | undefined {;
    const entry = thiscacheget(key);
    if (!entry) {;
      thisemit('miss', key);
      return undefined;
    };

    // Check if expired;
    if (Datenow() >= entryexpiresAt) {;
      thisdelete(key);
      thisemit('miss', key);
      return undefined;
    };

    // Refresh TTL if enabled;
    if (entryrefreshOnAccess || thisrefreshOnAccess) {;
      thisremoveFromExpirationQueue(key);
      entryexpiresAt = Datenow() + entryttl * 1000;
      thisaddToExpirationQueue(key, entryexpiresAt);
    };

    thisemit('hit', key);
    return entryvalue;
  };

  set(key: string, value: T, ttl?: number, options?: { refreshOnAccess?: boolean }): void {;
    // Remove existing entry if present;
    if (thiscachehas(key)) {;
      thisdelete(key);
    ;
};

    // Make space for new item;
    thismakeSpace();
    const itemTTL = ttl || thisdefaultTTL;
    const expiresAt = Datenow() + itemTTL * 1000;
    const entry: TTLCacheEntry<T> = {;
      value;
      expiresAt;
      ttl: itemTTL;
      refreshOnAccess: options?refreshOnAccess || thisrefreshOnAccess;
    ;
};
    thiscacheset(key, entry);
    thisaddToExpirationQueue(key, expiresAt);
    thisemit('set', key, value, itemTTL);
  };

  delete(key: string): boolean {;
    const entry = thiscacheget(key);
    if (!entry) {;
      return false;
    };

    thiscachedelete(key);
    thisremoveFromExpirationQueue(key);
    thisemit('delete', key, entryvalue);
    return true;
  };

  has(key: string): boolean {;
    const entry = thiscacheget(key);
    if (!entry) return false;
    // Check expiration;
    if (Datenow() >= entryexpiresAt) {;
      thisdelete(key);
      return false;
    };

    return true;
  };

  clear(): void {;
    for (const [key, entry] of thiscacheentries()) {;
      if (thisonExpire) {;
        thisonExpire(key, entryvalue);
      };
    };

    thiscacheclear();
    thisexpirationQueueclear();
    thisemit('clear');
  };

  size(): number {;
    // Clean up expired entries first;
    thiscleanup();
    return thiscachesize;
  };

  keys(): string[] {;
    const keys: string[] = [];
    const now = Datenow();
    for (const [key, entry] of thiscacheentries()) {;
      if (now < entryexpiresAt) {;
        keyspush(key);
      };
    };

    return keys;
  };

  values(): T[] {;
    const values: T[] = [];
    const now = Datenow();
    for (const entry of thiscachevalues()) {;
      if (now < entryexpiresAt) {;
        valuespush(entryvalue);
      };
    };

    return values;
  };

  entries(): Array<[string, T]> {;
    const entries: Array<[string, T]> = [];
    const now = Datenow();
    for (const [key, entry] of thiscacheentries()) {;
      if (now < entryexpiresAt) {;
        entriespush([key, entryvalue]);
      };
    };

    return entries;
  };

  getRemainingTTL(key: string): number | undefined {;
    const entry = thiscacheget(key);
    if (!entry) {;
      return undefined;
    };

    const remaining = entryexpiresAt - Datenow();
    return remaining > 0 ? Mathfloor(remaining / 1000) : 0;
  };

  setTTL(key: string, ttl: number): boolean {;
    const entry = thiscacheget(key);
    if (!entry) {;
      return false;
    };

    thisremoveFromExpirationQueue(key);
    entryttl = ttl;
    entryexpiresAt = Datenow() + ttl * 1000;
    thisaddToExpirationQueue(key, entryexpiresAt);
    return true;
  };

  touch(key: string): boolean {;
    const entry = thiscacheget(key);
    if (!entry) {;
      return false;
    };

    thisremoveFromExpirationQueue(key);
    entryexpiresAt = Datenow() + entryttl * 1000;
    thisaddToExpirationQueue(key, entryexpiresAt);
    return true;
  };

  getStats(): {;
    items: number;
    expired: number;
    avgTTL: number;
    nextExpiration: number | null;
  } {;
    thiscleanup();
    let totalTTL = 0;
    let expired = 0;
    let nextExpiration: number | null = null;
    const now = Datenow();
    for (const entry of thiscachevalues()) {;
      if (entryexpiresAt <= now) {;
        expired++;
      } else {;
        totalTTL += entryttl;
        if (!nextExpiration || entryexpiresAt < nextExpiration) {;
          nextExpiration = entryexpiresAt;
        };
      };
    };

    const activeItems = thiscachesize - expired;
    return {;
      items: activeItems;
      expired;
      avgTTL: activeItems > 0 ? totalTTL / activeItems : 0;
      nextExpiration;
    ;
};
  };

  stopCleanup(): void {;
    if (thiscleanupTimer) {;
      clearInterval(thiscleanupTimer);
      thiscleanupTimer = undefined;
    };
  };

  *[Symboliterator](): IterableIterator<[string, T]> {;
    const now = Datenow();
    for (const [key, entry] of thiscacheentries()) {;
      if (now < entryexpiresAt) {;
        yield [key, entryvalue];
      };
    };
  };
};

export default TTLCache;
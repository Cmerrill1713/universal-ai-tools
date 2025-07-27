import type { Consistency.Strategy, Eviction.Policy } from './config/cache';
export interface CacheConfig {
  backend: 'redis' | 'memory';
  defaultTT.L: number;
  eviction.Policy: Eviction.Policy;
  consistency.Strategy: Consistency.Strategy;
  enable.Compression: boolean;
  enable.Distributed: boolean;
  enable.Metrics: boolean;
  enable.Warmup: boolean;
};

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  compression.Ratio: number;
};

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  version?: string;
  compress?: boolean;
};

export interface CacheEntry<T = any> {
  data: T;
  version: string;
  tags: string[];
  created.At: number;
  expires.At?: number;
  compressed: boolean;
  checksum: string;
};

export interface VersionedData<T = any> {
  data: T;
  schema: string;
  version: string;
  created.At: number;
  migrated.From?: string;
};

export interface MigrationFunction<T.From = any, T.To = any> {
  (data: T.From): T.To | Promise<T.To>
};

export interface VersionMigration {
  from: string;
  to: string;
  migrate: Migration.Function;
  rollback?: Migration.Function;
};

export interface ConflictResolution<T = any> {
  strategy: 'newest' | 'merge' | 'custom';
  resolver?: (current: T, incoming: T) => T | Promise<T>
};

export interface CacheBackend<T = any> {
  get(key: string): Promise<T | null>
  set(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<boolean>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
  disconnect(): Promise<void>
};

export interface CacheMiddlewareConfig {
  ttl?: number;
  tags?: string[];
  version?: string;
  vary.By?: string[];
  staleWhile.Revalidate?: number;
  must.Revalidate?: boolean;
  public?: boolean;
  private?: boolean;
  no.Store?: boolean;
  no.Cache?: boolean;
};

export interface CachedResponse {
  status: number;
  headers: Record<string, string>
  body: any;
  etag: string;
  last.Modified: string;
};

export interface WriteBehindOptions {
  localCache.Size?: number;
  localCacheTT.L?: number;
  remoteTT.L?: number;
  namespace?: string;
  batch.Size?: number;
  flush.Interval?: number;
  max.Retries?: number;
  retry.Delay?: number;
  serializer?: (value: any) => string;
  deserializer?: (data: string) => any;
  onWrite.Error?: (error instanceof Error ? errormessage : String(error) Error, batch: Write.Operation[]) => void;
};

export interface WriteOperation {
  key: string;
  value: any;
  ttl: number;
  timestamp: number;
  retries: number;
};

export interface CacheMetrics {
  hit.Rate: number;
  miss.Rate: number;
  eviction.Rate: number;
  average.Latency: number;
  memory.Usage: number;
  queue.Size?: number;
};

export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'expire' | 'error instanceof Error ? errormessage : String(error);';
  key?: string;
  tags?: string[];
  timestamp: number;
  metadata?: any;
};

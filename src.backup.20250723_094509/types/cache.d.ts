import type { ConsistencyStrategy, EvictionPolicy } from '../config/cache';

export interface CacheConfig {
  backend: 'redis' | 'memory';
  defaultTTL: number;
  evictionPolicy: EvictionPolicy;
  consistencyStrategy: ConsistencyStrategy;
  enableCompression: boolean;
  enableDistributed: boolean;
  enableMetrics: boolean;
  enableWarmup: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  compressionRatio: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  version?: string;
  compress?: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  version: string;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
  compressed: boolean;
  checksum: string;
}

export interface VersionedData<T = any> {
  data: T;
  schema: string;
  version: string;
  createdAt: number;
  migratedFrom?: string;
}

export interface MigrationFunction<TFrom = any, TTo = any> {
  (data: TFrom): TTo | Promise<TTo>;
}

export interface VersionMigration {
  from: string;
  to: string;
  migrate: MigrationFunction;
  rollback?: MigrationFunction;
}

export interface ConflictResolution<T = any> {
  strategy: 'newest' | 'merge' | 'custom';
  resolver?: (current: T, incoming: T) => T | Promise<T>;
}

export interface CacheBackend<T = any> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface CacheMiddlewareConfig {
  ttl?: number;
  tags?: string[];
  version?: string;
  varyBy?: string[];
  staleWhileRevalidate?: number;
  mustRevalidate?: boolean;
  public?: boolean;
  private?: boolean;
  noStore?: boolean;
  noCache?: boolean;
}

export interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  etag: string;
  lastModified: string;
}

export interface WriteBehindOptions {
  localCacheSize?: number;
  localCacheTTL?: number;
  remoteTTL?: number;
  namespace?: string;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  serializer?: (value: any) => string;
  deserializer?: (data: string) => any;
  onWriteError?: (_error Error, batch: WriteOperation[]) => void;
}

export interface WriteOperation {
  key: string;
  value: any;
  ttl: number;
  timestamp: number;
  retries: number;
}

export interface CacheMetrics {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  averageLatency: number;
  memoryUsage: number;
  queueSize?: number;
}

export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'expire' | '_error);
  key?: string;
  tags?: string[];
  timestamp: number;
  metadata?: any;
}

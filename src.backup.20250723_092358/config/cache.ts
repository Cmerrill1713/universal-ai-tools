import type { CacheConfig } from '../types/cache';

// Cache TTL configurations per resource type (in seconds)
export const CACHE_TTL = {
  // API responses
  API_RESPONSE: 300, // 5 minutes
  API_LIST: 60, // 1 minute for list endpoints
  API_DETAIL: 600, // 10 minutes for detail endpoints

  // Authentication & sessions
  SESSION: 3600, // 1 hour
  AUTH_TOKEN: 1800, // 30 minutes
  USER_PROFILE: 900, // 15 minutes

  // Static resources
  STATIC_ASSET: 86400, // 24 hours
  TEMPLATE: 3600, // 1 hour
  CONFIG: 1800, // 30 minutes

  // AI/ML specific
  MODEL_RESPONSE: 1800, // 30 minutes
  EMBEDDING: 86400, // 24 hours
  VECTOR_SEARCH: 3600, // 1 hour

  // Real-time data
  WEBSOCKET_STATE: 60, // 1 minute
  NOTIFICATION: 300, // 5 minutes

  // Default
  DEFAULT: 300, // 5 minutes
} as const;

// Cache size limits
export const CACHE_SIZE_LIMITS = {
  // Local cache sizes (in bytes)
  LOCAL_LRU_MAX_SIZE: 100 * 1024 * 1024, // 100MB
  LOCAL_LRU_MAX_ITEMS: 10000,

  // Individual item limits
  MAX_ITEM_SIZE: 10 * 1024 * 1024, // 10MB per item
  MAX_KEY_LENGTH: 250,

  // Batch operation limits
  MAX_BATCH_SIZE: 1000,
  MAX_MGET_KEYS: 100,

  // Write-behind queue limits
  WRITE_BEHIND_QUEUE_SIZE: 5000,
  WRITE_BEHIND_BATCH_SIZE: 100,
} as const;

// Eviction policies
export enum EvictionPolicy {
  LRU = 'lru', // Least Recently Used
  LFU = 'lfu', // Least Frequently Used
  TTL = 'ttl', // Time To Live based
  FIFO = 'fifo', // First In First Out
  RANDOM = 'random',
}

// Consistency strategies
export enum ConsistencyStrategy {
  EVENTUAL = 'eventual', // Write-behind, eventually consistent
  STRONG = 'strong', // Write-through, strongly consistent
  WEAK = 'weak', // No guarantees
  READ_YOUR_WRITES = 'read-your-writes', // Session consistency
}

// Cache backend configurations
export const CACHE_BACKENDS = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'uai:',
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  },
} as const;

// Cache tag configurations
export const CACHE_TAGS = {
  // API tags
  API: 'api',
  API_VERSION: (version: string) => `api:v${version}`,

  // Resource tags
  USER: (userId: string) => `user:${userId}`,
  MODEL: (modelId: string) => `model:${modelId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,

  // Feature tags
  SEARCH: 'search',
  EMBEDDING: 'embedding',
  CHAT: 'chat',

  // System tags
  CONFIG: 'config',
  STATIC: 'static',
  TEMP: 'temp',
} as const;

// Cache warmup configurations
export const WARMUP_CONFIG = {
  // Keys to warm up on startup
  STARTUP_KEYS: ['config:app', 'config:features', 'models:list'],

  // Batch size for warmup operations
  WARMUP_BATCH_SIZE: 50,

  // Warmup retry configuration
  WARMUP_MAX_RETRIES: 3,
  WARMUP_RETRY_DELAY: 1000, // 1 second
} as const;

// Monitoring and alerting thresholds
export const CACHE_MONITORING = {
  // Hit rate thresholds
  MIN_HIT_RATE: 0.7, // Alert if hit rate drops below 70%

  // Eviction thresholds
  MAX_EVICTION_RATE: 0.1, // Alert if eviction rate exceeds 10%

  // Memory thresholds
  MEMORY_WARNING_THRESHOLD: 0.8, // Warn at 80% memory usage
  MEMORY_CRITICAL_THRESHOLD: 0.95, // Critical at 95% memory usage

  // Queue thresholds (for write-behind)
  QUEUE_WARNING_SIZE: 1000,
  QUEUE_CRITICAL_SIZE: 4000,

  // Latency thresholds (in ms)
  READ_LATENCY_WARNING: 10,
  WRITE_LATENCY_WARNING: 20,
} as const;

// Compression settings
export const COMPRESSION_CONFIG = {
  // Enable compression for items larger than this size
  MIN_SIZE_FOR_COMPRESSION: 1024, // 1KB

  // Compression level (1-9, higher = better compression but slower)
  COMPRESSION_LEVEL: 6,

  // Content types to compress
  COMPRESSIBLE_TYPES: ['application/json', 'text/plain', 'text/html', 'application/xml'],
} as const;

// Cache configuration per environment
export const getCacheConfig = (
  env: string = process.env.NODE_ENV || 'development'
): CacheConfig => {
  const configs: Record<string, CacheConfig> = {
    development: {
      backend: 'redis',
      defaultTTL: CACHE_TTL.DEFAULT,
      evictionPolicy: EvictionPolicy.LRU,
      consistencyStrategy: ConsistencyStrategy.EVENTUAL,
      enableCompression: false,
      enableDistributed: false,
      enableMetrics: true,
      enableWarmup: false,
    },
    test: {
      backend: 'memory',
      defaultTTL: 60,
      evictionPolicy: EvictionPolicy.LRU,
      consistencyStrategy: ConsistencyStrategy.STRONG,
      enableCompression: false,
      enableDistributed: false,
      enableMetrics: false,
      enableWarmup: false,
    },
    production: {
      backend: 'redis',
      defaultTTL: CACHE_TTL.DEFAULT,
      evictionPolicy: EvictionPolicy.LRU,
      consistencyStrategy: ConsistencyStrategy.STRONG,
      enableCompression: true,
      enableDistributed: true,
      enableMetrics: true,
      enableWarmup: true,
    },
  };

  return configs[env] || configs.development;
};

// Helper function to get Redis URL
export const getRedisUrl = (): string => {
  const { host, port, password, db } = CACHE_BACKENDS.redis;

  if (password) {
    return `redis://:${password}@${host}:${port}/${db}`;
  }

  return `redis://${host}:${port}/${db}`;
};

// Cache key patterns
export const CACHE_KEY_PATTERNS = {
  // API cache keys
  apiResponse: (method: string, path: string, params?: string) =>
    `api:${method}:${path}${params ? `:${params}` : ''}`,

  // User cache keys
  userProfile: (userId: string) => `user:profile:${userId}`,
  userSession: (userId: string, sessionId: string) => `user:session:${userId}:${sessionId}`,

  // Model cache keys
  modelResponse: (modelId: string, hash: string) => `model:response:${modelId}:${hash}`,
  embedding: (text: string, modelId: string) => `embedding:${modelId}:${createHash(text)}`,

  // Search cache keys
  searchResults: (query: string, filters?: string) =>
    `search:${createHash(query)}${filters ? `:${createHash(filters)}` : ''}`,

  // Config cache keys
  config: (key: string) => `config:${key}`,
  feature: (feature: string) => `feature:${feature}`,
};

// Helper function to create hash for cache keys
function createHash(input string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(_input.digest('hex').substring(0, 16);
}

export default {
  CACHE_TTL,
  CACHE_SIZE_LIMITS,
  EvictionPolicy,
  ConsistencyStrategy,
  CACHE_BACKENDS,
  CACHE_TAGS,
  WARMUP_CONFIG,
  CACHE_MONITORING,
  COMPRESSION_CONFIG,
  getCacheConfig,
  getRedisUrl,
  CACHE_KEY_PATTERNS,
};

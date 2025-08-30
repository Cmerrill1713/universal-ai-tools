/**
 * Application Constants
 * Centralized location for all magic numbers and configuration constants
 */

// Confidence Thresholds
export const CONFIDENCE = {
  GOOD: 0.8,
  MODERATE: 0.6,
  WEAK: 0.3,
} as const;

// Timing Constants (milliseconds)
export const TIMEOUTS = {
  DEFAULT_REQUEST: 30000, // 30 seconds
  HEALTH_CHECK: 5000, // 5 seconds
  DATABASE_QUERY: 10000, // 10 seconds
  LLM_REQUEST: 60000, // 60 seconds
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  DEFAULT_REQUESTS_PER_HOUR: 1000,
  DEFAULT_WINDOW_SECONDS: 3600, // 1 hour
  BURST_LIMIT: 10, // requests per minute
} as const;

// Retry Configuration
export const RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 5000,
} as const;

// Memory and Performance
export const MEMORY = {
  DEFAULT_CACHE_TTL_SECONDS: 3600, // 1 hour
  MAX_CACHE_SIZE_MB: 100,
  CLEANUP_INTERVAL_MS: 300000, // 5 minutes
} as const;

// Vector Dimensions
export const VECTOR = {
  OPENAI_EMBEDDING_DIMENSION: 1536,
  DEFAULT_SIMILARITY_THRESHOLD: 0.8,
} as const;

// Agent Configuration
export const AGENT = {
  DEFAULT_MAX_LATENCY_MS: 30000,
  DEFAULT_RETRY_ATTEMPTS: 3,
  DEFAULT_PRIORITY: 5,
  UUID_LENGTH: 36,
  UUID_VERSION: 2,
  UUID_VARIANT: 9,
} as const;

// Server Configuration
export const SERVER = {
  DEFAULT_PORT: 9999,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: 10000,
  HEALTH_CHECK_INTERVAL_MS: 30000,
} as const;

// Security
export const SECURITY = {
  MIN_API_KEY_LENGTH: 20,
  JWT_EXPIRY_HOURS: 24,
  BCRYPT_SALT_ROUNDS: 12,
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 900000, // 15 minutes
} as const;

// File System
export const FILES = {
  MAX_UPLOAD_SIZE_MB: 10,
  ALLOWED_EXTENSIONS: ['.txt', '.md', '.json', '.csv'] as const,
} as const;

// Logging
export const LOGGING = {
  MAX_LOG_SIZE_MB: 50,
  LOG_ROTATION_DAYS: 7,
  BATCH_SIZE: 100,
} as const;

// MLX Configuration
export const MLX = {
  DEFAULT_MAX_VRAM_GB: 20,
  DEFAULT_BATCH_SIZE: 4,
  MIN_GPU_MEMORY_GB: 8,
} as const;

// Database
export const DATABASE = {
  DEFAULT_POOL_SIZE: 10,
  QUERY_TIMEOUT_MS: 30000,
  CONNECTION_TIMEOUT_MS: 5000,
  MAX_RETRIES: 3,
} as const;

export default {
  CONFIDENCE,
  TIMEOUTS,
  RATE_LIMITS,
  RETRY,
  MEMORY,
  VECTOR,
  AGENT,
  SERVER,
  SECURITY,
  FILES,
  LOGGING,
  MLX,
  DATABASE,
} as const;
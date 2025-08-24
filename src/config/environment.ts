import * as dotenv from 'dotenv';

import type { ServiceConfig } from '../types';
import { ports } from './ports';

// Load environment variables
dotenv.config();

export const config: ServiceConfig = {
  port: ports.mainServer,
  environment: process.env.NODE_ENV || 'development',
  // Testing environment detection
  isTestMode: process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true',
  // Offline-first feature flags (automated via env)
  offlineMode: process.env.OFFLINE_MODE === 'true',
  disableExternalCalls: process.env.DISABLE_EXTERNAL_CALLS === 'true',
  disableRemoteLLM: process.env.DISABLE_REMOTE_LLM === 'true',

  // HTTP timeout configuration for connection stability
  // Updated to match audit recommendations for 15% connection reliability improvement
  http: {
    keepAliveTimeout: parseInt(process.env.HTTP_KEEP_ALIVE_TIMEOUT || '120000', 10), // 2 minutes
    headersTimeout: parseInt(process.env.HTTP_HEADERS_TIMEOUT || '121000', 10),     // 2 minutes + 1s
    requestTimeout: parseInt(process.env.HTTP_REQUEST_TIMEOUT || '300000', 10),     // 5 minutes
    socketTimeout: parseInt(process.env.HTTP_SOCKET_TIMEOUT || '300000', 10),       // 5 minutes
    maxConnections: parseInt(process.env.HTTP_MAX_CONNECTIONS || '1000', 10),       // Concurrent connections
    shutdownDrainTimeout: parseInt(process.env.HTTP_SHUTDOWN_DRAIN_TIMEOUT || '30000', 10), // 30 seconds
  },

  database: {
    url: process.env.DATABASE_URL || '',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  },

  redis: process.env.REDIS_URL
    ? {
        url: process.env.REDIS_URL,
        retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3', 10),
      }
    : undefined,

  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  // Vector database configuration (Qdrant)
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    grpcUrl: process.env.QDRANT_GRPC_URL || 'http://localhost:6334',
    apiKey: process.env.QDRANT_API_KEY || '',
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'universal_ai_vectors',
    vectorSize: parseInt(process.env.QDRANT_VECTOR_SIZE || '768', 10),
    distanceMetric: (process.env.QDRANT_DISTANCE_METRIC as 'cosine' | 'euclidean' | 'dot') || 'cosine',
    indexType: process.env.QDRANT_INDEX_TYPE || 'hnsw',
    batchSize: parseInt(process.env.QDRANT_BATCH_SIZE || '100', 10),
    timeoutMs: parseInt(process.env.QDRANT_TIMEOUT_MS || '30000', 10),
  },

  // Graph database configuration (Neo4j)
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },

  // Hybrid GraphRAG configuration
  graphrag: {
    enableHybrid: process.env.ENABLE_HYBRID_GRAPHRAG === 'true',
    useQdrant: process.env.GRAPHRAG_USE_QDRANT !== 'false',
    useNeo4j: process.env.GRAPHRAG_USE_NEO4J !== 'false',
    syncMode: (process.env.GRAPHRAG_SYNC_MODE as 'atomic' | 'eventual') || 'atomic',
    cacheTtl: parseInt(process.env.GRAPHRAG_CACHE_TTL || '3600', 10), // 1 hour
  },

  jwt: {
    secret: process.env.JWT_SECRET || '', // Will be loaded from Supabase Vault at runtime
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  llm: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  },

  searxng: {
    url: process.env.SEARXNG_URL || 'http://localhost:8888',
  },

  lfm2: {
    maxConcurrency: parseInt(process.env.LFM2_MAX_CONCURRENCY || '2', 10),
    maxTokens: parseInt(process.env.LFM2_MAX_TOKENS || '512', 10),
    maxPromptChars: parseInt(process.env.LFM2_MAX_PROMPT_CHARS || '4000', 10),
    timeoutMs: parseInt(process.env.LFM2_TIMEOUT_MS || '10000', 10),
    maxPending: parseInt(process.env.LFM2_MAX_PENDING || '50', 10),
  },

  vision: {
    enableSdxlRefiner: process.env.ENABLE_SDXL_REFINER === 'true',
    sdxlRefinerPath: process.env.SDXL_REFINER_PATH || '',
    preferredBackend: (process.env.VISION_BACKEND as 'mlx' | 'gguf' | 'auto') || 'auto',
    maxVram: parseInt(process.env.VISION_MAX_VRAM || '20', 10),
    enableCaching: process.env.VISION_ENABLE_CACHING !== 'false',
  },

  // Production optimization settings
  production: {
    memoryThresholds: {
      warning: parseInt(process.env.MEMORY_WARNING_MB || '512', 10),
      critical: parseInt(process.env.MEMORY_CRITICAL_MB || '768', 10),
      emergency: parseInt(process.env.MEMORY_EMERGENCY_MB || '1024', 10),
    },
    performance: {
      maxResponseTime: parseInt(process.env.MAX_RESPONSE_TIME_MS || '2000', 10),
      maxErrorRate: parseFloat(process.env.MAX_ERROR_RATE || '0.05'),
      maxCpuUsage: parseInt(process.env.MAX_CPU_USAGE || '80', 10),
    },
    optimization: {
      enableGC: process.env.ENABLE_AUTO_GC !== 'false',
      gcInterval: parseInt(process.env.GC_INTERVAL_MS || '30000', 10),
      enableConnectionPooling: process.env.ENABLE_CONNECTION_POOLING !== 'false',
      enableMemoryPressureResponse: process.env.ENABLE_MEMORY_PRESSURE_RESPONSE !== 'false',
      maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE_MB || '10', 10),
    },
    monitoring: {
      enableDetailedMetrics: process.env.ENABLE_DETAILED_METRICS !== 'false',
      metricsRetentionMinutes: parseInt(process.env.METRICS_RETENTION_MINUTES || '60', 10),
      enableLiveMetrics: process.env.ENABLE_LIVE_METRICS !== 'false',
    }
  },
};

// Validation
export function validateConfig(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'];

  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(process.env, key) || !process.env[key as keyof typeof process.env]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate hybrid GraphRAG configuration
  if (config.graphrag?.enableHybrid) {
    if (!config.graphrag.useQdrant && !config.graphrag.useNeo4j) {
      throw new Error('Hybrid GraphRAG enabled but neither Qdrant nor Neo4j are configured');
    }
    
    if (config.graphrag.useQdrant && config.qdrant && !config.qdrant.url) {
      console.warn('⚠️  Qdrant enabled but QDRANT_URL not configured, using default: http://localhost:6333');
    }
    
    if (config.graphrag.useNeo4j && config.neo4j && !config.neo4j.uri) {
      console.warn('⚠️  Neo4j enabled but NEO4J_URI not configured, using default: bolt://localhost:7687');
    }
  }

  // In production, enforce secrets presence either via env or Vault; do not allow shim
  if (config.environment === 'production') {
    const missingJwt = !config.jwt.secret;
    const usingShim = process.env.ALLOW_VAULT_SHIM === 'true';
    if (usingShim) {
      throw new Error('Vault shim is not permitted in production. Set ALLOW_VAULT_SHIM=false');
    }
    if (missingJwt) {
      throw new Error('JWT_SECRET missing in production. It must be provided via Vault or env');
    }
  }
}

// Helper function to get JWT secret from Vault
export async function getJwtSecret(): Promise<string> {
  // Try environment variable first (for development)
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  // Import secrets manager dynamically to avoid circular dependencies
  try {
    const { secretsManager } = await import('../services/secrets-manager');
    const vaultSecret = await secretsManager.getSecret('jwt_secret');

    if (vaultSecret) {
      return vaultSecret;
    }
  } catch (error) {
    console.error('Failed to load JWT secret from Vault:', error);
  }

  // No fallback secrets for security - must be explicitly configured
  if (config.environment === 'development') {
    console.error('❌ JWT secret must be configured via environment variable or Vault even in development');
  }

  throw new Error('JWT_SECRET not found in environment or Supabase Vault');
}

export default config;

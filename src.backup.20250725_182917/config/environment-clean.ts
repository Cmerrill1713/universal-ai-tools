 
import * as dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Environment schema validation
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'testing']).default('development'),
  PORT: z.string().transform(Number).default('9999'),

  // Database Configuration
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string(),

  // Security Configuration
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),

  // AI Service Configuration
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  // Local LLM Configuration
  OLLAMA_URL: z.string().url().default('http://localhost:11434'),
  LM_STUDIO_URL: z.string().url().default('http://localhost:1234'),

  // Apple Silicon Configuration
  ENABLE_METAL: z.string().transform(Boolean).default('true'),
  MLX_CACHE_DIR: z.string().optional(),

  // Monitoring Configuration
  ENABLE_TELEMETRY: z.string().transform(Boolean).default('true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),

  // Feature Flags
  ENABLE_WEBSOCKETS: z.string().transform(Boolean).default('true'),
  ENABLE_MEMORY_SYSTEM: z.string().transform(Boolean).default('true'),
  ENABLE_ANTI_HALLUCINATION: z.string().transform(Boolean).default('true'),
  ENABLE_COGNITIVE_AGENTS: z.string().transform(Boolean).default('true'),

  // Performance Configuration
  MAX_CONCURRENT_REQUESTS: z.string().transform(Number).default('10'),
  REQUEST_TIMEOUT: z.string().transform(Number).default('30000'),
  MEMORY_CACHE_SIZE: z.string().transform(Number).default('1000'),

  // Cache Configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),
});

// Parse and validate environment variables with error handling
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.error('Environment validation failed:');
    error.errors.forEach((err) => {
      logger.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    logger.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  throw error;
}

// Generate missing secrets if not provided
function generateSecret(length = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

// Auto-generate JWT secret in development if not provided
if (!process.env.JWT_SECRET && env.NODE_ENV === 'development') {
  const jwtSecret = generateSecret(32);
  env.JWT_SECRET = jwtSecret;
  logger.warn('⚠️  Auto-generated JWT_SECRET for development. Please set JWT_SECRET in production.');
}

// Auto-generate encryption key in development if not provided
if (!process.env.ENCRYPTION_KEY && env.NODE_ENV === 'development') {
  const encryptionKey = generateSecret(32);
  env.ENCRYPTION_KEY = encryptionKey;
  logger.warn('⚠️  Auto-generated ENCRYPTION_KEY for development. Please set ENCRYPTION_KEY in production.');
}

// Validate critical security settings in production
if (env.NODE_ENV === 'production') {
  const criticalVars = ['JWT_SECRET', 'ENCRYPTION_KEY', 'SUPABASE_SERVICE_KEY'];
  const missing = criticalVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    logger.error(`❌ Missing critical environment variables in production: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Warn about insecure configurations
  if (env.LOG_LEVEL === 'debug') {
    logger.warn('⚠️  Debug logging enabled in production. Consider using "info" or "warn" level.');
  }
}

// Configuration object with computed values
export const config = {
  // Environment
  env: env.NODE_ENV,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTesting: env.NODE_ENV === 'testing',

  // Server
  port: env.PORT,
  
  // Database
  database: {
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY,
  },

  // Security
  security: {
    jwtSecret: env.JWT_SECRET,
    encryptionKey: env.ENCRYPTION_KEY,
  },

  // AI Services
  ai: {
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    googleAiApiKey: env.GOOGLE_AI_API_KEY,
    ollamaUrl: env.OLLAMA_URL,
    lmStudioUrl: env.LM_STUDIO_URL,
  },

  // Performance
  performance: {
    maxConcurrentRequests: env.MAX_CONCURRENT_REQUESTS,
    requestTimeout: env.REQUEST_TIMEOUT,
    memoryCacheSize: env.MEMORY_CACHE_SIZE,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW,
    maxRequests: env.RATE_LIMIT_MAX,
  },

  // Features
  features: {
    websockets: env.ENABLE_WEBSOCKETS,
    memorySystem: env.ENABLE_MEMORY_SYSTEM,
    antiHallucination: env.ENABLE_ANTI_HALLUCINATION,
    cognitiveAgents: env.ENABLE_COGNITIVE_AGENTS,
    telemetry: env.ENABLE_TELEMETRY,
    metal: env.ENABLE_METAL,
  },

  // Cache
  cache: {
    redisUrl: env.REDIS_URL,
  },

  // Logging
  logging: {
    level: env.LOG_LEVEL,
  },

  // Apple Silicon
  metal: {
    enabled: env.ENABLE_METAL,
    cacheDir: env.MLX_CACHE_DIR,
  },
};

// Validate configuration consistency
export function validateConfig(): boolean {
  try {
    // Check if critical services are properly configured
    if (!config.database.supabaseUrl) {
      throw new Error('Supabase URL is required');
    }

    if (!config.database.supabaseServiceKey) {
      throw new Error('Supabase service key is required');
    }

    if (!config.security.jwtSecret) {
      throw new Error('JWT secret is required');
    }

    if (!config.security.encryptionKey) {
      throw new Error('Encryption key is required');
    }

    // Validate URLs
    try {
      new URL(config.database.supabaseUrl);
      new URL(config.ai.ollamaUrl);
      new URL(config.ai.lmStudioUrl);
    } catch {
      throw new Error('Invalid URL configuration');
    }

    logger.info('✅ Configuration validation passed');
    return true;
  } catch (error) {
    logger.error('❌ Configuration validation failed:', error);
    return false;
  }
}

// Export environment for backward compatibility
export { env };

// Export default config
export default config;
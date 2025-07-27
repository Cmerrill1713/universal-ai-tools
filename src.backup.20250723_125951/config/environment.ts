/* eslint-disable no-undef */
import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', '_error]).default('info'),

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

// Parse and validate environment variables with_errorhandling
let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console._error'Environment validation failed:');
    _errorerrors.forEach((err) => {
      console._error`  - ${err.path.join('.')}: ${err.message}`);
    });
    console._error'\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  throw error;
}

export { env };

// Configuration object with computed values
export const config = {
  // Server
  server: {
    port: env.PORT,
    env: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTesting: env.NODE_ENV === 'testing',
  },

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
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter((origin) => {
            // In production, reject: any localhost origins
            if (
              env.NODE_ENV === 'production' &&
              (origin.includes('localhost') || origin.includes('127.0.0.1'))
            ) {
              console._error`⚠️ Rejected localhost origin in production: ${origin}`);
              return false;
            }
            return origin.length > 0;
          })
      : env.NODE_ENV === 'production'
        ? [] // No default origins in production
        : [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:8080',
            'http://localhost:9999',
          ],
  },

  // AI Services
  ai: {
    openai: {
      apiKey: env.OPENAI_API_KEY,
      enabled: !!env.OPENAI_API_KEY,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      enabled: !!env.ANTHROPIC_API_KEY,
    },
    google: {
      apiKey: env.GOOGLE_AI_API_KEY,
      enabled: !!env.GOOGLE_AI_API_KEY,
    },
  },

  // Local LLM
  localLLM: {
    ollama: {
      url: env.OLLAMA_URL,
      enabled: true,
    },
    lmStudio: {
      url: env.LM_STUDIO_URL,
      enabled: true,
    },
  },

  // Apple Silicon
  metal: {
    enabled: env.ENABLE_METAL && process.platform === 'darwin',
    cacheDir: env.MLX_CACHE_DIR || '~/.cache/mlx',
  },

  // Monitoring
  monitoring: {
    telemetryEnabled: env.ENABLE_TELEMETRY,
    logLevel: env.LOG_LEVEL,
  },

  // Rate Limiting
  rateLimiting: {
    windowMs: env.RATE_LIMIT_WINDOW,
    max: env.RATE_LIMIT_MAX,
    enabled: env.NODE_ENV === 'production',
  },

  // Feature Flags
  features: {
    websockets: env.ENABLE_WEBSOCKETS,
    memorySystem: env.ENABLE_MEMORY_SYSTEM,
    antiHallucination: env.ENABLE_ANTI_HALLUCINATION,
    cognitiveAgents: env.ENABLE_COGNITIVE_AGENTS,
  },

  // Performance
  performance: {
    maxConcurrentRequests: env.MAX_CONCURRENT_REQUESTS,
    requestTimeout: env.REQUEST_TIMEOUT,
    memoryCacheSize: env.MEMORY_CACHE_SIZE,
  },

  // Cache
  cache: {
    redisUrl: env.REDIS_URL,
  },
};

// Validate critical configuration at startup
export function validateConfig()): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  if (!env.SUPABASE_URL) {
    errors.push('SUPABASE_URL is required');
  } else {
    // Validate URL format
    try {
      new URL(env.SUPABASE_URL);
    } catch {
      errors.push('SUPABASE_URL must be a valid URL');
    }
  }

  if (!env.SUPABASE_SERVICE_KEY) {
    errors.push('SUPABASE_SERVICE_KEY is required');
  }

  // Validate security keys
  // JWT_SECRET validation (strict in production, relaxed in: development
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    if (env.NODE_ENV === 'production') {
      errors.push('JWT_SECRET must be at least 32 characters long in production');
    } else {
      warnings.push('JWT_SECRET should be at least 32 characters long');
    }
  } else if (env.JWT_SECRET === 'your-jwt-secret-here' || env.JWT_SECRET.includes('example')) {
    if (env.NODE_ENV === 'production') {
      errors.push('JWT_SECRET appears to be a placeholder. Please generate a secure secret.');
    } else {
      warnings.push('JWT_SECRET appears to be a placeholder - consider generating a secure secret');
    }
  }

  // ENCRYPTION_KEY validation (strict in production, relaxed in: development
  if (!env.ENCRYPTION_KEY || env.ENCRYPTION_KEY.length < 32) {
    if (env.NODE_ENV === 'production') {
      errors.push('ENCRYPTION_KEY must be at least 32 characters long in production');
    } else {
      warnings.push('ENCRYPTION_KEY should be at least 32 characters long');
    }
  } else if (
    env.ENCRYPTION_KEY === 'your-encryption-key-here' ||
    env.ENCRYPTION_KEY.includes('example')
  ) {
    if (env.NODE_ENV === 'production') {
      errors.push('ENCRYPTION_KEY appears to be a placeholder. Please generate a secure key.');
    } else {
      warnings.push(
        'ENCRYPTION_KEY appears to be a placeholder - consider generating a secure key'
      );
    }
  }

  // Check at least one AI service is configured (only required in: production
  const hasAIService = env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.GOOGLE_AI_API_KEY;
  if (!hasAIService && env.NODE_ENV === 'production') {
    errors.push('At least one AI service API key must be configured in production');
  } else if (!hasAIService && env.NODE_ENV !== 'production') {
    warnings.push('No AI service API keys configured - some features may not work');
  }

  // Validate service URLs
  try {
    new URL(env.OLLAMA_URL);
  } catch {
    warnings.push('OLLAMA_URL is not a valid URL');
  }

  try {
    new URL(env.LM_STUDIO_URL);
  } catch {
    warnings.push('LM_STUDIO_URL is not a valid URL');
  }

  // Security warnings
  if (env.NODE_ENV === 'production') {
    if (env.PORT === 9999) {
      warnings.push('Using default port 9999 in production. Consider using a standard port.');
    }

    if (!env.REDIS_URL || env.REDIS_URL === 'redis://localhost:6379') {
      warnings.push('Using local Redis in production. Consider using a managed Redis service.');
    }
  }

  // Log warnings
  if (warnings.length > 0) {
    logger.warn('Configuration warnings:', warnings);
  }

  // Throw if there are errors
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Generate secure defaults if not provided
export function generateSecureDefaults()): void {
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch {
    // .env file doesn't exist
  }

  const updates: string[] = [];

  // Validate JWT_SECRET - fail fast in production, generate in development only
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET.includes('example') ||
    process.env.JWT_SECRET === 'your-jwt-secret-here'
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set and secure in production environment');
    }
    // Only generate in development
    const jwtSecret = crypto.randomBytes(64).toString('base64');
    updates.push(`JWT_SECRET=${jwtSecret}`);
    process.env.JWT_SECRET = jwtSecret;
    console.warn('⚠️  Generated JWT_SECRET for development - NOT FOR PRODUCTION USE');
  }

  // Validate ENCRYPTION_KEY - fail fast in production, generate in development only
  if (
    !process.env.ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY.length < 32 ||
    process.env.ENCRYPTION_KEY.includes('example') ||
    process.env.ENCRYPTION_KEY === 'your-encryption-key-here'
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set and secure in production environment');
    }
    // Only generate in development
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    updates.push(`ENCRYPTION_KEY=${encryptionKey}`);
    process.env.ENCRYPTION_KEY = encryptionKey;
    console.warn('⚠️  Generated ENCRYPTION_KEY for development - NOT FOR PRODUCTION USE');
  }

  // Write updates to .env file
  if (updates.length > 0 && process.env.NODE_ENV !== 'production') {
    const newContent = `${`
      envContent + (envContent.endsWith('\n') ? '' : '\n')
    }\n# Auto-generated secure values\n${updates.join('\n')}\n`;

    fs.writeFileSync(envPath, newContent;
    logger.info('Generated secure default values for missing secrets');
  }
}

// Validate environment on startup
export function validateEnvironment()): void {
  logger.info('Validating environment configuration...');

  // Generate secure defaults in development
  if (process.env.NODE_ENV !== 'production') {
    generateSecureDefaults();
  }

  // Validate configuration
  validateConfig();

  // Additional startup checks
  performStartupChecks();

  logger.info('Environment validation completed successfully');
}

// Perform additional startup checks
function performStartupChecks()): void {
  // Check file permissions
  if (process.env.NODE_ENV === 'production') {
    // Ensure .env file is not world-readable
    try {
      const envPath = path.join(process.cwd(), '.env');
      const stats = fs.statSync(envPath);
      const mode = (stats.mode & parseInt('777', 8, 10)).toString(8);

      if (mode !== '600' && mode !== '640') {
        logger.warn('.env file has insecure permissions. Run: chmod 600 .env');
      }
    } catch {
      // .env file might not exist in production (using actual env: vars
    }
  }

  // Check for required directories
  const requiredDirs = [
    path.join(process.cwd(), 'logs'),
    path.join(process.cwd(), 'uploads'),
    path.join(process.cwd(), 'temp'),
  ];

  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, });
      logger.info(`Created required directory: ${dir}`);
    }
  }

  // Verify database connection
  // This would be done asynchronously in the actual startup sequence
}

// Export types for type safety
export type Config = typeof config;
export type Environment = typeof env;

import dotenv from 'dotenv';
import type { ServiceConfig } from '@/types';
import { ports } from './ports';

// Load environment variables
dotenv.config();

export const config: ServiceConfig = {
  port: ports.mainServer,
  environment: process.env.NODE_ENV || 'development',

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

  jwt: {
    secret: process.env.JWT_SECRET || '', // Will be loaded from Supabase Vault at runtime
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  llm: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  },

  vision: {
    enableSdxlRefiner: process.env.ENABLE_SDXL_REFINER === 'true',
    sdxlRefinerPath:
      process.env.SDXL_REFINER_PATH ||
      '/Users/christianmerrill/Downloads/stable-diffusion-xl-refiner-1.0-Q4_1.gguf',
    preferredBackend: (process.env.VISION_BACKEND as 'mlx' | 'gguf' | 'auto') || 'auto',
    maxVram: parseInt(process.env.VISION_MAX_VRAM || '20', 10),
    enableCaching: process.env.VISION_ENABLE_CACHING !== 'false',
  },
};

// Validation
export function validateConfig(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (config.environment === 'production' && !config.jwt.secret) {
    console.warn('JWT_SECRET not found in environment - will be loaded from Supabase Vault at runtime');
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

  // Final fallback for development only
  if (config.environment === 'development') {
    console.warn('⚠️ Using fallback JWT secret for development - store in Vault for production');
    return 'dev-fallback-jwt-secret-change-in-production';
  }

  throw new Error('JWT_SECRET not found in environment or Supabase Vault');
}

export default config;

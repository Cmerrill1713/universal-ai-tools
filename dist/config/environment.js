import dotenv from 'dotenv';
import { ports } from './ports';
dotenv.config();
export const config = {
    port: ports.mainServer,
    environment: process.env.NODE_ENV || 'development',
    offlineMode: process.env.OFFLINE_MODE === 'true',
    disableExternalCalls: process.env.DISABLE_EXTERNAL_CALLS === 'true',
    disableRemoteLLM: process.env.DISABLE_REMOTE_LLM === 'true',
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
        secret: process.env.JWT_SECRET || '',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    llm: {
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
        ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
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
        preferredBackend: process.env.VISION_BACKEND || 'auto',
        maxVram: parseInt(process.env.VISION_MAX_VRAM || '20', 10),
        enableCaching: process.env.VISION_ENABLE_CACHING !== 'false',
    },
};
export function validateConfig() {
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
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
export async function getJwtSecret() {
    if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
    }
    try {
        const { secretsManager } = await import('../services/secrets-manager');
        const vaultSecret = await secretsManager.getSecret('jwt_secret');
        if (vaultSecret) {
            return vaultSecret;
        }
    }
    catch (error) {
        console.error('Failed to load JWT secret from Vault:', error);
    }
    if (config.environment === 'development') {
        console.warn('⚠️ Using fallback JWT secret for development - store in Vault for production');
        return 'dev-fallback-jwt-secret-change-in-production';
    }
    throw new Error('JWT_SECRET not found in environment or Supabase Vault');
}
export default config;
//# sourceMappingURL=environment.js.map
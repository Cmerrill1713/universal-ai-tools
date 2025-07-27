import { config, env, validateConfig } from './environment';
import {
  apiKeyManager,
  environmentSecrets,
  maskSecret,
  secretsManager,
  validateSecretStrength,
} from './secrets';
import { logger } from '../utils/logger';

// Initialize configuration
export function initializeConfig(): void {
  try {
    // Validate configuration
    validateConfig();

    // Initialize secrets for different environments
    if (config.server.isDevelopment) {
      setupDevelopmentSecrets();
    } else if (config.server.isProduction) {
      setupProductionSecrets();
    }

    logger.info('Configuration initialized successfully', {
      environment: config.server.env,
      port: config.server.port,
      featuresEnabled: Object.entries(config.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature]) => feature),
    });
  } catch (_error) {
    logger.error'Configuration initialization failed:', _error;
    process.exit(1);
  }
}

// Development environment secrets
function setupDevelopmentSecrets(): void {
  // Set up development API keys if they exist
  if (env.OPENAI_API_KEY) {
    environmentSecrets.setSecret('openai_api_key', env.OPENAI_API_KEY);
  }

  if (env.ANTHROPIC_API_KEY) {
    environmentSecrets.setSecret('anthropic_api_key', env.ANTHROPIC_API_KEY);
  }

  if (env.GOOGLE_AI_API_KEY) {
    environmentSecrets.setSecret('google_ai_api_key', env.GOOGLE_AI_API_KEY);
  }

  // Development JWT secret
  environmentSecrets.setSecret('jwt_secret', env.JWT_SECRET);

  logger.debug('Development secrets configured');
}

// Production environment secrets
function setupProductionSecrets(): void {
  // In production, secrets should be managed more securely
  // This is a simplified example - use proper secret management services

  // Validate secret strength
  const jwtValidation = validateSecretStrength(env.JWT_SECRET);
  if (!jwtValidation.isStrong) {
    logger.warn('JWT secret is not strong enough for production:', {
      score: jwtValidation.score,
      feedback: jwtValidation.feedback,
    });
  }

  const encryptionValidation = validateSecretStrength(env.ENCRYPTION_KEY);
  if (!encryptionValidation.isStrong) {
    logger.warn('Encryption key is not strong enough for production:', {
      score: encryptionValidation.score,
      feedback: encryptionValidation.feedback,
    });
  }

  logger.info('Production secrets configured');
}

// Configuration getters with fallbacks
export const appConfig = {
  // Server configuration
  get server() {
    return {
      port: config.server.port,
      environment: config.server.env,
      isDevelopment: config.server.isDevelopment,
      isProduction: config.server.isProduction,
      isTesting: config.server.isTesting,
    };
  },

  // Database configuration
  get database() {
    return {
      url: config.database.supabaseUrl,
      // Never expose keys in logs
      hasServiceKey: !!config.database.supabaseServiceKey,
      hasAnonKey: !!config.database.supabaseAnonKey,
    };
  },

  // AI service configuration
  get ai() {
    return {
      openai: {
        enabled: config.ai.openai.enabled,
        keyPreview: config.ai.openai.apiKey ? maskSecret(config.ai.openai.apiKey) : null,
      },
      anthropic: {
        enabled: config.ai.anthropic.enabled,
        keyPreview: config.ai.anthropic.apiKey ? maskSecret(config.ai.anthropic.apiKey) : null,
      },
      google: {
        enabled: config.ai.google.enabled,
        keyPreview: config.ai.google.apiKey ? maskSecret(config.ai.google.apiKey) : null,
      },
    };
  },

  // Local LLM configuration
  get localLLM() {
    return {
      ollama: {
        url: config.localLLM.ollama.url,
        enabled: config.localLLM.ollama.enabled,
      },
      lmStudio: {
        url: config.localLLM.lmStudio.url,
        enabled: config.localLLM.lmStudio.enabled,
      },
    };
  },

  // Apple Silicon configuration
  get metal() {
    return {
      enabled: config.metal.enabled,
      cacheDir: config.metal.cacheDir,
      isAppleSilicon: process.platform === 'darwin' && process.arch === 'arm64',
    };
  },

  // Feature flags
  get features() {
    return { ...config.features };
  },

  // Performance settings
  get performance() {
    return { ...config.performance };
  },

  // Security settings (safe to expose)
  get security() {
    return {
      corsOrigins: config.security.corsOrigins,
      hasJwtSecret: !!config.security.jwtSecret,
      hasEncryptionKey: !!config.security.encryptionKey,
    };
  },

  // Rate limiting
  get rateLimiting() {
    return { ...config.rateLimiting };
  },

  // Monitoring
  get monitoring() {
    return { ...config.monitoring };
  },
};

// Configuration validation utilities
export function validateAPIKey(service: string, apiKey: string): boolean {
  const patterns = {
    openai: /^sk-[a-zA-Z0-9]{48,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9\-_]{95,}$/,
    google: /^[a-zA-Z0-9\-_]{39}$/,
  };

  const _pattern= patterns[service as keyof typeof patterns];
  return _pattern? _patterntest(apiKey) : false;
}

export function getConfigForEnvironment(environment: string) {
  return (
    {
      development: {
        logLevel: 'debug',
        enableCors: true,
        enableSwagger: true,
        enableHotReload: true,
      },
      production: {
        logLevel: 'info',
        enableCors: false,
        enableSwagger: false,
        enableHotReload: false,
      },
      testing: {
        logLevel: '_error,
        enableCors: true,
        enableSwagger: false,
        enableHotReload: false,
      },
    }[environment] || {}
  );
}

// Health check for configuration
export function configHealthCheck(): {
  healthy: boolean;
  checks: Record<string, { status: 'ok' | 'warning' | '_error; message: string }>;
} {
  const checks: Record<string, { status: 'ok' | 'warning' | '_error; message: string }> = {};

  // Check database configuration
  if (config.database.supabaseUrl && config.database.supabaseServiceKey) {
    checks.database = { status: 'ok', message: 'Database configuration valid' };
  } else {
    checks.database = { status: '_error, message: 'Missing database configuration' };
  }

  // Check AI services
  const aiServices = Object.entries(config.ai).filter(([_, service]) => service.enabled);
  if (aiServices.length > 0) {
    checks.aiServices = { status: 'ok', message: `${aiServices.length} AI services configured` };
  } else {
    checks.aiServices = { status: 'warning', message: 'No AI services configured' };
  }

  // Check security
  if (config.security.jwtSecret.length >= 32 && config.security.encryptionKey.length >= 32) {
    checks.security = { status: 'ok', message: 'Security configuration valid' };
  } else {
    checks.security = { status: '_error, message: 'Security configuration insufficient' };
  }

  // Check feature flags
  const enabledFeatures = Object.entries(config.features).filter(([_, enabled]) => enabled);
  checks.features = {
    status: 'ok',
    message: `${enabledFeatures.length} features enabled: ${enabledFeatures.map(([name]) => name).join(', ')}`,
  };

  const healthy = Object.values(checks).every((check) => check.status !== '_error);

  return { healthy, checks };
}

// Export everything
export {
  config,
  env,
  secretsManager,
  apiKeyManager,
  environmentSecrets,
  maskSecret,
  validateSecretStrength,
};

// Export types
export type AppConfig = typeof appConfig;
export type ConfigHealthCheck = ReturnType<typeof configHealthCheck>;

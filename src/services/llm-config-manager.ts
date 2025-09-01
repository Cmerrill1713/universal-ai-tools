/**
 * LLM Configuration Manager
 * Centralized configuration management for all LLM services
 * Supports dynamic configuration updates and environment-based settings
 */

// Fallback implementations for better compatibility
const config = {
  llm: {
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    lmStudioUrl: process.env.LM_STUDIO_URL || 'http://localhost:5901'
  }
};

const log = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args)
};

const LogContext = {
  AI: 'AI'
};

const secretsManager = {
  getApiKeyWithFallback: async (service: string, fallback?: string) => {
    return process.env[fallback || `${service.toUpperCase()}_API_KEY`] || null;
  }
};

export interface LLMServiceConfig {
  enabled: boolean;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  fallbackEnabled: boolean;
  healthCheckInterval: number;
  modelPreferences: string[];
  requestLimits: {
    maxTokens: number;
    maxRequestsPerMinute: number;
    maxConcurrentRequests: number;
  };
}

export interface MLXServiceConfig extends LLMServiceConfig {
  pythonPath: string;
  modelsPath: string;
  maxVRAM: number;
  enableFineTuning: boolean;
  trainingTimeout: number;
}

export interface CoordinatorConfig {
  routingStrategy: 'performance' | 'cost' | 'balanced';
  loadBalancing: {
    enabled: boolean;
    algorithm: 'round-robin' | 'weighted' | 'least-connections';
    healthCheckInterval: number;
    failoverTimeout: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
  monitoring: {
    metricsEnabled: boolean;
    detailed: boolean;
    reportingInterval: number;
  };
}

export class LLMConfigManager {
  private static instance: LLMConfigManager;
  private configurations: Map<string, any> = new Map();
  private configWatchers: Map<string, Array<(config: any) => void>> = new Map();
  private lastConfigUpdate: number = Date.now();

  private constructor() {
    this.loadDefaultConfigurations();
  }

  public static getInstance(): LLMConfigManager {
    if (!LLMConfigManager.instance) {
      LLMConfigManager.instance = new LLMConfigManager();
    }
    return LLMConfigManager.instance;
  }

  /**
   * Load default configurations for all services
   */
  private loadDefaultConfigurations(): void {
    // Ollama Configuration
    this.configurations.set('ollama', {
      enabled: true,
      baseUrl: config.llm.ollamaUrl || 'http://localhost:11434',
      timeout: 30000,
      maxRetries: 3,
      fallbackEnabled: true,
      healthCheckInterval: 120000, // 2 minutes
      modelPreferences: [
        'llama3.2:3b',      // Fast, general purpose
        'mistral:7b',       // Balanced performance
        'codellama:7b',     // Code tasks
        'llama3.1:8b',      // Complex reasoning
      ],
      requestLimits: {
        maxTokens: 4000,
        maxRequestsPerMinute: 60,
        maxConcurrentRequests: 5,
      },
    } as LLMServiceConfig);

    // LM Studio Configuration
    this.configurations.set('lmStudio', {
      enabled: true,
      baseUrl: config.llm.lmStudioUrl || 'http://localhost:5901',
      timeout: 45000,
      maxRetries: 2,
      fallbackEnabled: true,
      healthCheckInterval: 180000, // 3 minutes
      modelPreferences: [
        'mistral-7b-instruct',
        'deepseek-coder-7b-instruct',
        'zephyr-7b-beta',
        'llama-3.1-70b-instruct',
      ],
      requestLimits: {
        maxTokens: 6000,
        maxRequestsPerMinute: 40,
        maxConcurrentRequests: 3,
      },
    } as LLMServiceConfig);

    // MLX Configuration
    this.configurations.set('mlx', {
      enabled: process.env.ENABLE_MLX_FINE_TUNING === 'true',
      baseUrl: 'local',
      timeout: 300000, // 5 minutes for training
      maxRetries: 1,
      fallbackEnabled: false,
      healthCheckInterval: 300000, // 5 minutes
      pythonPath: 'python3',
      modelsPath: process.env.MLX_MODELS_PATH || '/Users/christianmerrill/Desktop/universal-ai-tools/models',
      maxVRAM: parseInt(process.env.VISION_MAX_VRAM || '20'),
      enableFineTuning: process.env.ENABLE_MLX_FINE_TUNING === 'true',
      trainingTimeout: 1200000, // 20 minutes
      modelPreferences: [
        'LFM2-1.2B-bf16',
        'Llama-3.2-3B-Instruct-4bit',
      ],
      requestLimits: {
        maxTokens: 2000,
        maxRequestsPerMinute: 30,
        maxConcurrentRequests: 2,
      },
    } as MLXServiceConfig);

    // Fast Coordinator Configuration
    this.configurations.set('coordinator', {
      routingStrategy: process.env.LLM_ROUTING_STRATEGY || 'balanced',
      loadBalancing: {
        enabled: true,
        algorithm: 'weighted',
        healthCheckInterval: 30000, // 30 seconds
        failoverTimeout: 5000,
      },
      caching: {
        enabled: process.env.ENABLE_INTELLIGENT_PARAMETERS === 'true',
        ttl: parseInt(process.env.PARAMETER_CACHE_TTL || '3600') * 1000,
        maxSize: 1000,
      },
      monitoring: {
        metricsEnabled: true,
        detailed: process.env.NODE_ENV === 'development',
        reportingInterval: 60000, // 1 minute
      },
    } as CoordinatorConfig);

    // External API Configurations
    this.configurations.set('openai', {
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      timeout: 60000,
      maxRetries: 3,
      fallbackEnabled: true,
      healthCheckInterval: 300000, // 5 minutes
      modelPreferences: [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-3.5-turbo',
      ],
      requestLimits: {
        maxTokens: 8000,
        maxRequestsPerMinute: 50,
        maxConcurrentRequests: 10,
      },
    } as LLMServiceConfig);

    this.configurations.set('anthropic', {
      enabled: true,
      baseUrl: 'https://api.anthropic.com',
      timeout: 60000,
      maxRetries: 3,
      fallbackEnabled: true,
      healthCheckInterval: 300000, // 5 minutes
      modelPreferences: [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307',
      ],
      requestLimits: {
        maxTokens: 8000,
        maxRequestsPerMinute: 40,
        maxConcurrentRequests: 8,
      },
    } as LLMServiceConfig);

    this.lastConfigUpdate = Date.now();
    
    log.info('⚙️ Default LLM configurations loaded', LogContext.AI, {
      services: Array.from(this.configurations.keys()),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get configuration for a specific service
   */
  public getConfig<T = any>(serviceName: string): T | null {
    const config = this.configurations.get(serviceName);
    if (!config) {
      log.warn(`⚠️ Configuration not found for service: ${serviceName}`, LogContext.AI);
      return null;
    }
    return { ...config } as T; // Return copy to prevent mutation
  }

  /**
   * Update configuration for a service
   */
  public updateConfig(serviceName: string, updates: Partial<any>): void {
    const currentConfig = this.configurations.get(serviceName);
    if (!currentConfig) {
      log.error(`❌ Cannot update config for unknown service: ${serviceName}`, LogContext.AI);
      return;
    }

    const newConfig = { ...currentConfig, ...updates };
    this.configurations.set(serviceName, newConfig);
    this.lastConfigUpdate = Date.now();

    // Notify watchers
    const watchers = this.configWatchers.get(serviceName) || [];
    watchers.forEach(callback => {
      try {
        callback(newConfig);
      } catch (error) {
        log.error(`❌ Config watcher failed for ${serviceName}`, LogContext.AI, { error });
      }
    });

    log.info(`⚙️ Configuration updated for ${serviceName}`, LogContext.AI, {
      updates: Object.keys(updates),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Subscribe to configuration changes
   */
  public onConfigChange(serviceName: string, callback: (config: any) => void): void {
    if (!this.configWatchers.has(serviceName)) {
      this.configWatchers.set(serviceName, []);
    }
    this.configWatchers.get(serviceName)!.push(callback);
  }

  /**
   * Get all configurations
   */
  public getAllConfigs(): Record<string, any> {
    const configs: Record<string, any> = {};
    for (const [key, value] of this.configurations.entries()) {
      configs[key] = { ...value };
    }
    return configs;
  }

  /**
   * Validate configuration for a service
   */
  public validateConfig(serviceName: string, config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic validation rules
    if (!config.baseUrl) {
      errors.push('baseUrl is required');
    }
    
    if (config.timeout && (config.timeout < 1000 || config.timeout > 600000)) {
      errors.push('timeout must be between 1000ms and 600000ms');
    }
    
    if (config.maxRetries && (config.maxRetries < 0 || config.maxRetries > 10)) {
      errors.push('maxRetries must be between 0 and 10');
    }

    // Service-specific validation
    if (serviceName === 'mlx' && config.modelsPath && !config.modelsPath.startsWith('/')) {
      errors.push('MLX modelsPath must be an absolute path');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply environment-based configuration overrides
   */
  public async applyEnvironmentOverrides(): Promise<void> {
    try {
      // Check if API keys are available and update enabled status
      const openaiKey = await secretsManager.getApiKeyWithFallback('openai', 'OPENAI_API_KEY');
      if (!openaiKey) {
        this.updateConfig('openai', { enabled: false });
        log.info('🔐 OpenAI disabled - no API key found', LogContext.AI);
      }

      const anthropicKey = await secretsManager.getApiKeyWithFallback('anthropic', 'ANTHROPIC_API_KEY');
      if (!anthropicKey) {
        this.updateConfig('anthropic', { enabled: false });
        log.info('🔐 Anthropic disabled - no API key found', LogContext.AI);
      }

      // Apply environment variable overrides
      const envOverrides = {
        ollama: {
          baseUrl: process.env.OLLAMA_URL,
        },
        lmStudio: {
          baseUrl: process.env.LM_STUDIO_URL,
        },
        mlx: {
          enabled: process.env.ENABLE_MLX_FINE_TUNING === 'true',
          modelsPath: process.env.MLX_MODELS_PATH,
          maxVRAM: process.env.VISION_MAX_VRAM ? parseInt(process.env.VISION_MAX_VRAM) : undefined,
        },
      };

      for (const [serviceName, overrides] of Object.entries(envOverrides)) {
        const validOverrides = Object.fromEntries(
          Object.entries(overrides).filter(([, value]) => value !== undefined)
        );
        
        if (Object.keys(validOverrides).length > 0) {
          this.updateConfig(serviceName, validOverrides);
        }
      }

      log.info('🌍 Environment configuration overrides applied', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to apply environment overrides', LogContext.AI, { error });
    }
  }

  /**
   * Get service health check configuration
   */
  public getHealthCheckConfig(serviceName: string): { 
    enabled: boolean; 
    interval: number; 
    timeout: number; 
  } {
    const config = this.getConfig<LLMServiceConfig>(serviceName);
    return {
      enabled: config?.enabled ?? false,
      interval: config?.healthCheckInterval ?? 120000,
      timeout: config?.timeout ?? 30000,
    };
  }

  /**
   * Get load balancing configuration
   */
  public getLoadBalancingConfig(): CoordinatorConfig['loadBalancing'] {
    const config = this.getConfig<CoordinatorConfig>('coordinator');
    return config?.loadBalancing ?? {
      enabled: true,
      algorithm: 'weighted',
      healthCheckInterval: 30000,
      failoverTimeout: 5000,
    };
  }

  /**
   * Export configuration for backup
   */
  public exportConfiguration(): {
    configurations: Record<string, any>;
    metadata: {
      exportedAt: string;
      version: string;
      lastUpdate: string;
    };
  } {
    return {
      configurations: this.getAllConfigs(),
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        lastUpdate: new Date(this.lastConfigUpdate).toISOString(),
      },
    };
  }

  /**
   * Import configuration from backup
   */
  public importConfiguration(backup: { configurations: Record<string, any> }): void {
    const configEntries = Object.entries(backup.configurations);
    for (const [serviceName, config] of configEntries) {
      const validation = this.validateConfig(serviceName, config);
      if (validation.valid) {
        this.configurations.set(serviceName, config);
      } else {
        log.warn(`⚠️ Skipping invalid configuration for ${serviceName}`, LogContext.AI, {
          errors: validation.errors,
        });
      }
    }
    
    this.lastConfigUpdate = Date.now();
    log.info('📥 Configuration imported from backup', LogContext.AI);
  }
}

// Export singleton instance
export const llmConfigManager = LLMConfigManager.getInstance();
export default llmConfigManager;
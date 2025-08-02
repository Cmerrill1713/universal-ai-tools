/**
 * Supabase Vault Secrets Manager
 * Automatically fetches and manages API keys from Supabase Vault
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { LogContext, log } from '../utils/logger';

interface SecretConfig {
  name: string;
  value: string;
  description?: string;
  service?: string;
  expires_at?: Date;
}

interface ServiceCredentials {
  [key: string]: {
    api_key?: string;
    base_url?: string;
    auth_type?: string;
    auth_header?: string;
    auth_prefix?: string;
    rate_limit?: unknown;
    metadata?: unknown;
  };
}

export class SecretsManager {
  private static instance: SecretsManager;
  private supabase: unknown;
  private cachedCredentials:   ServiceCredentials = {};
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;
  private initializing = false;
  private initialized = false;

  private constructor() {
    this.initializeSupabase();
  }

  public static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  private initializeSupabase(): void {
    try {
      if (!config.supabase.url || !config.supabase.serviceKey) {
        log.warn('⚠️ Supabase configuration missing for secrets manager', LogContext.SYSTEM);
        return;
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      log.info('✅ Secrets Manager initialized with Supabase', LogContext.SYSTEM);
      this.initialized = true;
    } catch (error) {
      log.error('❌ Failed to initialize Secrets Manager', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Initialize secrets in Vault from environment variables
   */
  public async initializeFromEnv(): Promise<void> {
    if (!this.initialized || this.initializing) return;

    this.initializing = true;

    try {
      log.info('🔐 Initializing secrets from environment variables', LogContext.SYSTEM);

      // Define the secrets to migrate
      const secretsToMigrate = [
        { env: 'OPENAI_API_KEY', name: 'openai_key', service: 'openai' },
        { env: 'ANTHROPIC_API_KEY', name: 'anthropic_key', service: 'anthropic' },
        { env: 'GOOGLE_AI_API_KEY', name: 'google_ai_key', service: 'google_ai' },
        { env: 'HUGGINGFACE_API_KEY', name: 'huggingface_key', service: 'huggingface' },
        { env: 'SERPER_API_KEY', name: 'serper_key', service: 'serper' },
        { env: 'SERPAPI_API_KEY', name: 'serpapi_key', service: 'serpapi' },
        { env: 'BROWSERLESS_API_KEY', name: 'browserless_key', service: 'browserless' },
        { env: 'ELEVENLABS_API_KEY', name: 'elevenlabs_key', service: 'elevenlabs' },
        { env: 'REPLICATE_API_TOKEN', name: 'replicate_key', service: 'replicate' },
        { env: 'PINECONE_API_KEY', name: 'pinecone_key', service: 'pinecone' },
        { env: 'REDIS_PASSWORD', name: 'redis_password', service: 'redis' },
        { env: 'JWT_SECRET', name: 'jwt_secret', service: 'auth' },
        { env: 'ENCRYPTION_KEY', name: 'encryption_key', service: 'auth' },
      ];

      for (const secret of secretsToMigrate) {
        const value = process.env[secret.env];
        if (value && value !== `your-${secret.service}-key-here`) {
          await this.storeSecret({
            name: secret.name,
            value,
            description: `API key for ${secret.service}`,
            service: secret.service,
          });

          log.info(`✅ Migrated ${secret.env} to Vault`, LogContext.SYSTEM);
        }
      }

      // Load all credentials to cache
      await this.loadAllCredentials();
    } catch (error) {
      log.error('❌ Failed to initialize secrets from environment', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.initializing = false;     }
  }

  /**
   * Store a secret in Vault
   */
  public async storeSecret(config: SecretConfig): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      // Check if secret already exists
      const { data: existing } = await (this as any).supabase
        .rpc('read_secret', { secret_name: config.name })
        .single();

      if (existing) {
        // Update existing secret
        const { error } = await (this as any).supabase.rpc('update_secret', {
          secret_name: config.name,
          new_secret: config.value,
          new_description: config.description,
        });

        if (error) throw error;

        log.info(`🔄 Updated secret: ${config.name}`, LogContext.SYSTEM);
      } else {
        // Create new secret
        const { error } = await (this as any).supabase.rpc('insert_secret', {
          name: config.name,
          secret: config.value,
          description: config.description,
        });

        if (error) throw error;

        log.info(`✅ Stored new secret: ${config.name}`, LogContext.SYSTEM);
      }

      // If this is a service API key, also store in our api_secrets table
      if (config.service) {
        const { error } = await (this as any).supabase.from('api_secrets').upsert(
          {
            service_name: config.service,
            api_key: config.value,
            description: config.description,
            is_active: true,
            expires_at: config.expires_at,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'service_name',
          }
        );

        if (error) {
          log.warn(`⚠️ Failed to update api_secrets table`, LogContext.SYSTEM, { error });
        }
      }

      // Clear cache to force reload
      this.lastCacheUpdate = 0;

      return true;
    } catch (error) {
      log.error(`❌ Failed to store secret: ${config.name}`, LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get a secret from Vault
   */
  public async getSecret(name: string): Promise<string | null> {
    if (!this.initialized) return null;

    try {
      const { data, error } = await (this as any).supabase
        .rpc('read_secret', { secret_name: name })
        .single();

      if (error) throw error;

      return data || null;
    } catch (error) {
      log.error(`❌ Failed to get secret: ${name}`, LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get API key for a service
   */
  public async getApiKey(service: string): Promise<string | null> {
    // Check cache first
    const cached = this.getCachedCredentials(service) as { api_key?: string } | null;
    if (cached?.api_key) {
      return cached.api_key;
    }

    // If not in cache, load from database
    await this.loadAllCredentials();

    const credentials = this.getCachedCredentials(service) as { api_key?: string } | null;
    return credentials?.api_key || null;
  }

  /**
   * Get complete service configuration
   */
  public async getServiceConfig(service: string): Promise<any> {
    // Check cache first
    const cached = this.getCachedCredentials(service);
    if (cached && this.isCacheValid()) {
      return cached;
    }

    // Load from database
    if (!this.initialized) return null;

    try {
      const { data, error } = await (this as any).supabase
        .rpc('get_service_credentials', { p_service_name: service })
        .single();

      if (error) throw error;

      // Update cache
      if (data) {
        this.cachedCredentials[service] = data;
        this.lastCacheUpdate = Date.now();
      }

      return data;
    } catch (error) {
      log.error(`❌ Failed to get service config: ${service}`, LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Load all credentials to cache
   */
  private async loadAllCredentials(): Promise<void> {
    if (!this.initialized) return;

    try {
      const { data, error } = await (this as any).supabase
        .rpc('get_all_service_credentials')
        .single();

      if (error) throw error;

      if (data) {
        this.cachedCredentials =           data;
        this.lastCacheUpdate = Date.now();

        log.info('✅ Loaded all service credentials to cache', LogContext.SYSTEM, {
          services: Object.keys(data).length,
        });
      }
    } catch (error) {
      log.error('❌ Failed to load all credentials', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get credentials from cache
   */
  private getCachedCredentials(service: string): unknown {
    if (!this.isCacheValid()) {
      return null;
    }
    return this.cachedCredentials[service];
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  /**
   * Get all available services
   */
  public async getAvailableServices(): Promise<string[]> {
    if (!this.initialized) return [];

    try {
      const { data, error } = await (this as any).supabase
        .from('service_configurations')
        .select('service_name')
        .eq('is_active', true);

      if (error) throw error;

      return data?.map((s: any) => s.service_name) || [];
    } catch (error) {
      log.error('❌ Failed to get available services', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get services missing API keys
   */
  public async getMissingCredentials(): Promise<string[]> {
    if (!this.initialized) return [];

    try {
      const { data, error } = await (this as any).supabase.rpc('get_missing_credentials').single();

      if (error) throw error;

      return data || [];
    } catch (error) {
      log.error('❌ Failed to get missing credentials', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check if a service has valid credentials
   */
  public async hasValidCredentials(service: string): Promise<boolean> {
    if (!this.initialized) return false;

    try {
      const { data, error } = await (this as any).supabase
        .rpc('has_valid_credentials', { p_service_name: service })
        .single();

      if (error) throw error;

      return data || false;
    } catch (error) {
      log.error(`❌ Failed to check credentials: ${service}`, LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get API key with fallback to environment variable
   */
  public async getApiKeyWithFallback(service: string, envVar: string): Promise<string | null> {
    // Try to get from Vault first
    const vaultKey = await this.getApiKey(service);
    if (vaultKey) {
      return vaultKey;
    }

    // Fallback to environment variable
    const envKey = process.env[envVar];
    if (envKey && envKey !== `your-${service}-key-here`) {
      log.warn(`⚠️ Using environment variable for ${service} (not in Vault)`, LogContext.SYSTEM);

      // Try to store it in Vault for next time
      await this.storeSecret({
        name: `${service}_key`,
        value: envKey,
        description: `API key for ${service} (migrated from env)`,
        service,
      });

      return envKey;
    }

    return null;
  }
}

// Export singleton instance
export const secretsManager = SecretsManager.getInstance();
export default secretsManager;

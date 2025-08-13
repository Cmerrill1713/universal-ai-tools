import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';
export class SecretsManager {
    static instance;
    supabase;
    cachedCredentials = new Map();
    cacheExpiry = 5 * 60 * 1000;
    lastCacheUpdate = 0;
    initializing = false;
    initialized = false;
    constructor() {
        this.initializeSupabase();
    }
    static getInstance() {
        if (!SecretsManager.instance) {
            SecretsManager.instance = new SecretsManager();
        }
        return SecretsManager.instance;
    }
    initializeSupabase() {
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
        }
        catch (error) {
            log.error('❌ Failed to initialize Secrets Manager', LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async initializeFromEnv() {
        if (!this.initialized || this.initializing)
            return;
        this.initializing = true;
        try {
            log.info('🔐 Initializing secrets from environment variables', LogContext.SYSTEM);
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
            await this.loadAllCredentials();
        }
        catch (error) {
            log.error('❌ Failed to initialize secrets from environment', LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            this.initializing = false;
        }
    }
    async storeSecret(config) {
        if (!this.initialized)
            return false;
        try {
            const { data: existing } = await this.supabase
                .rpc('read_secret', { secret_name: config.name })
                .single();
            if (existing) {
                const { error } = await this.supabase.rpc('update_secret', {
                    secret_name: config.name,
                    new_secret: config.value,
                    new_description: config.description,
                });
                if (error)
                    throw error;
                log.info(`🔄 Updated secret: ${config.name}`, LogContext.SYSTEM);
            }
            else {
                const { error } = await this.supabase.rpc('insert_secret', {
                    name: config.name,
                    secret: config.value,
                    description: config.description,
                });
                if (error)
                    throw error;
                log.info(`✅ Stored new secret: ${config.name}`, LogContext.SYSTEM);
            }
            if (config.service) {
                const { error } = await this.supabase.from('api_secrets').upsert({
                    service_name: config.service,
                    encrypted_value: config.value,
                    key_name: `${config.service}_key`,
                    description: config.description,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'key_name',
                });
                if (error) {
                    log.warn(`⚠️ Failed to update api_secrets table`, LogContext.SYSTEM, { error });
                }
            }
            this.lastCacheUpdate = 0;
            return true;
        }
        catch (error) {
            const isDev = (process.env.NODE_ENV || 'development') !== 'production';
            const level = isDev ? 'warn' : 'error';
            const msg = `${isDev ? '⚠️' : '❌'} Failed to store secret: ${config.name}`;
            log[level](msg, LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async getSecret(name) {
        if (!this.initialized)
            return null;
        try {
            const { data, error } = await this.supabase
                .rpc('read_secret', { secret_name: name })
                .single();
            if (error)
                throw error;
            return data || null;
        }
        catch (error) {
            const isDev = process.env.NODE_ENV !== 'production';
            const message = `${isDev ? '⚠️' : '❌'} Failed to get secret: ${name}`;
            if (isDev) {
                log.warn(message, LogContext.SYSTEM, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            else {
                log.error(message, LogContext.SYSTEM, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            return null;
        }
    }
    async getApiKey(service) {
        const cached = this.getCachedCredentials(service);
        if (cached?.api_key) {
            return cached.api_key;
        }
        await this.loadAllCredentials();
        const credentials = this.getCachedCredentials(service);
        return credentials?.api_key || null;
    }
    async getServiceConfig(service) {
        const cached = this.getCachedCredentials(service);
        if (cached && this.isCacheValid()) {
            return cached;
        }
        if (!this.initialized)
            return null;
        try {
            const { data, error } = await this.supabase
                .rpc('get_service_credentials', { p_service_name: service })
                .single();
            if (error)
                throw error;
            if (data) {
                this.cachedCredentials.set(service, data);
                this.lastCacheUpdate = Date.now();
            }
            return data;
        }
        catch (error) {
            log.error(`❌ Failed to get service config: ${service}`, LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async loadAllCredentials() {
        if (!this.initialized)
            return;
        try {
            const { data, error } = await this.supabase
                .rpc('get_all_service_credentials')
                .single();
            if (error)
                throw error;
            if (data && typeof data === 'object') {
                this.cachedCredentials.clear();
                const entries = Object.entries(data);
                for (const [svc, cfg] of entries) {
                    this.cachedCredentials.set(String(svc), cfg);
                }
                this.lastCacheUpdate = Date.now();
                log.info('✅ Loaded all service credentials to cache', LogContext.SYSTEM, {
                    services: this.cachedCredentials.size,
                });
            }
        }
        catch (error) {
            const isDev = (process.env.NODE_ENV || 'development') !== 'production';
            const level = isDev ? 'warn' : 'error';
            const msg = `${isDev ? '⚠️' : '❌'} Failed to load all credentials`;
            log[level](msg, LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    getCachedCredentials(service) {
        if (!this.isCacheValid()) {
            return null;
        }
        return this.cachedCredentials.get(service) || null;
    }
    isCacheValid() {
        return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
    }
    readEnvSafe(name) {
        switch (name) {
            case 'OPENAI_API_KEY':
                return process.env.OPENAI_API_KEY;
            case 'ANTHROPIC_API_KEY':
                return process.env.ANTHROPIC_API_KEY;
            case 'GOOGLE_AI_API_KEY':
                return process.env.GOOGLE_AI_API_KEY;
            case 'HUGGINGFACE_API_KEY':
                return process.env.HUGGINGFACE_API_KEY;
            case 'SERPER_API_KEY':
                return process.env.SERPER_API_KEY;
            case 'SERPAPI_API_KEY':
                return process.env.SERPAPI_API_KEY;
            case 'BROWSERLESS_API_KEY':
                return process.env.BROWSERLESS_API_KEY;
            case 'ELEVENLABS_API_KEY':
                return process.env.ELEVENLABS_API_KEY;
            case 'REPLICATE_API_TOKEN':
                return process.env.REPLICATE_API_TOKEN;
            case 'PINECONE_API_KEY':
                return process.env.PINECONE_API_KEY;
            case 'REDIS_PASSWORD':
                return process.env.REDIS_PASSWORD;
            case 'JWT_SECRET':
                return process.env.JWT_SECRET;
            case 'ENCRYPTION_KEY':
                return process.env.ENCRYPTION_KEY;
            default:
                return undefined;
        }
    }
    async getAvailableServices() {
        if (!this.initialized)
            return [];
        try {
            const { data, error } = await this.supabase
                .from('service_configurations')
                .select('service_name')
                .eq('is_active', true);
            if (error)
                throw error;
            return data?.map((s) => s.service_name) || [];
        }
        catch (error) {
            log.error('❌ Failed to get available services', LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async getMissingCredentials() {
        if (!this.initialized)
            return [];
        try {
            const { data, error } = await this.supabase.rpc('get_missing_credentials').single();
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            log.error('❌ Failed to get missing credentials', LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async hasValidCredentials(service) {
        if (!this.initialized)
            return false;
        try {
            const { data, error } = await this.supabase
                .rpc('has_valid_credentials', { p_service_name: service })
                .single();
            if (error)
                throw error;
            return data || false;
        }
        catch (error) {
            log.error(`❌ Failed to check credentials: ${service}`, LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async getApiKeyWithFallback(service, envVar) {
        const vaultKey = await this.getApiKey(service);
        if (vaultKey) {
            return vaultKey;
        }
        const envKey = this.readEnvSafe(envVar);
        if (envKey && envKey !== `your-${service}-key-here`) {
            log.warn(`⚠️ Using environment variable for ${service} (not in Vault)`, LogContext.SYSTEM);
            const sanitizeKey = (s) => s.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 50);
            await this.storeSecret({
                name: `${sanitizeKey(service)}_key`,
                value: envKey,
                description: `API key for ${service} (migrated from env)`,
                service,
            });
            return envKey;
        }
        return null;
    }
}
export const secretsManager = SecretsManager.getInstance();
export default secretsManager;
//# sourceMappingURL=secrets-manager.js.map
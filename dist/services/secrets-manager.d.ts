interface SecretConfig {
    name: string;
    value: string;
    description?: string;
    service?: string;
    expires_at?: Date;
}
export declare class SecretsManager {
    private static instance;
    private supabase;
    private cachedCredentials;
    private cacheExpiry;
    private lastCacheUpdate;
    private initializing;
    private initialized;
    private constructor();
    static getInstance(): SecretsManager;
    private initializeSupabase;
    initializeFromEnv(): Promise<void>;
    storeSecret(config: SecretConfig): Promise<boolean>;
    getSecret(name: string): Promise<string | null>;
    getApiKey(service: string): Promise<string | null>;
    getServiceConfig(service: string): Promise<any>;
    private loadAllCredentials;
    private getCachedCredentials;
    private isCacheValid;
    private readEnvSafe;
    getAvailableServices(): Promise<string[]>;
    getMissingCredentials(): Promise<string[]>;
    hasValidCredentials(service: string): Promise<boolean>;
    getApiKeyWithFallback(service: string, envVar: string): Promise<string | null>;
}
export declare const secretsManager: SecretsManager;
export default secretsManager;
//# sourceMappingURL=secrets-manager.d.ts.map
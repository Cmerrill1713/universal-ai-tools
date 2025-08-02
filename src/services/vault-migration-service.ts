/**
 * Supabase Vault Migration Service
 * Migrates API keys from environment variables to secure Supabase Vault storage
 * 
 * SECURITY CRITICAL: This service handles sensitive API keys and secrets
 */

import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '@/utils/logger';
import { config } from '@/config/environment';

interface VaultSecret {
  name: string;
  description: string;
  envVarName?: string; // Original environment variable name
  required: boolean;
  service: string; // Which service uses this secret
}

interface VaultMigrationResult {
  secretName: string;
  status: 'created' | 'updated' | 'exists' | 'failed';
  error?: string;
}

export class VaultMigrationService {
  private supabase;
  
  // Define all secrets that need to be stored in vault
  private readonly requiredSecrets: VaultSecret[] = [
    // API Keys
    {
      name: 'openai_api_key',
      description: 'OpenAI API key for GPT models and embeddings',
      envVarName: 'OPENAI_API_KEY',
      required: true,
      service: 'llm-router, reranking-service, context-injection'
    },
    {
      name: 'anthropic_api_key', 
      description: 'Anthropic Claude API key',
      envVarName: 'ANTHROPIC_API_KEY',
      required: true,
      service: 'llm-router, enhanced-agents'
    },
    {
      name: 'huggingface_api_key',
      description: 'Hugging Face API key for models and inference',
      envVarName: 'HUGGINGFACE_API_KEY',
      required: true,
      service: 'huggingface-service, reranking-service'
    },
    
    // Authentication Secrets
    {
      name: 'jwt_secret',
      description: 'JWT signing secret for device authentication',
      envVarName: 'JWT_SECRET',
      required: true,
      service: 'device-auth, middleware/auth'
    },
    {
      name: 'device_auth_secret',
      description: 'Device authentication secret for proximity auth',
      envVarName: 'DEVICE_AUTH_SECRET',
      required: false,
      service: 'device-auth-websocket'
    },
    
    // Database & Storage
    {
      name: 'supabase_service_key',
      description: 'Supabase service role key (admin access)',
      envVarName: 'SUPABASE_SERVICE_KEY',
      required: true,
      service: 'all-services'
    },
    {
      name: 'database_encryption_key',
      description: 'Database field encryption key',
      envVarName: 'DATABASE_ENCRYPTION_KEY',
      required: false,
      service: 'sensitive-data-encryption'
    },
    
    // External Services
    {
      name: 'redis_password',
      description: 'Redis authentication password',
      envVarName: 'REDIS_PASSWORD',
      required: false,
      service: 'redis-service, caching'
    },
    {
      name: 'webhook_secret',
      description: 'Webhook validation secret',
      envVarName: 'WEBHOOK_SECRET',
      required: false,
      service: 'webhook-handlers'
    },
    
    // API Validation
    {
      name: 'valid_api_keys',
      description: 'Comma-separated list of valid API keys for request validation',
      envVarName: 'VALID_API_KEYS',
      required: false,
      service: 'request-validator'
    }
  ];

  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceKey || process.env.SUPABASE_SERVICE_KEY || ''
    );
  }

  /**
   * Migrate all API keys from environment variables to Supabase Vault
   */
  async migrateAllSecrets(): Promise<{
    success: VaultMigrationResult[];
    failed: VaultMigrationResult[];
    skipped: VaultMigrationResult[];
  }> {
    log.info('🔐 Starting Supabase Vault migration for all API keys', LogContext.SECURITY);
    
    const results = {
      success: [] as VaultMigrationResult[],
      failed: [] as VaultMigrationResult[],
      skipped: [] as VaultMigrationResult[]
    };

    for (const secret of this.requiredSecrets) {
      try {
        const result = await this.migrateSecret(secret);
        
        if (result.status === 'failed') {
          results.failed.push(result);
        } else if (result.status === 'exists') {
          results.skipped.push(result);
        } else {
          results.success.push(result);
        }
        
        log.info(`Secret ${secret.name}: ${result.status}`, LogContext.SECURITY, {
          service: secret.service,
          required: secret.required
        });
        
      } catch (error) {
        const failResult: VaultMigrationResult = {
          secretName: secret.name,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        };
        results.failed.push(failResult);
        
        log.error(`Failed to migrate secret: ${secret.name}`, LogContext.SECURITY, {
          error: failResult.error,
          service: secret.service
        });
      }
    }

    // Summary logging
    log.info('🔐 Vault migration completed', LogContext.SECURITY, {
      successful: results.success.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      total: this.requiredSecrets.length
    });

    return results;
  }

  /**
   * Migrate a single secret to vault
   */
  private async migrateSecret(secret: VaultSecret): Promise<VaultMigrationResult> {
    // Check if secret already exists in vault
    const existing = await this.getSecretFromVault(secret.name);
    if (existing) {
      return {
        secretName: secret.name,
        status: 'exists'
      };
    }

    // Get value from environment variable
    let secretValue = '';
    if (secret.envVarName) {
      secretValue = process.env[secret.envVarName] || '';
    }

    // Handle required secrets that are missing
    if (secret.required && !secretValue) {
      if (secret.name === 'jwt_secret') {
        // Generate a secure JWT secret if missing
        secretValue = this.generateSecureSecret(64);
        log.warn(`Generated new JWT secret (missing from env)`, LogContext.SECURITY);
      } else {
        throw new Error(`Required secret ${secret.name} is missing from environment variables`);
      }
    }

    // Skip optional secrets that aren't provided
    if (!secretValue && !secret.required) {
      return {
        secretName: secret.name,
        status: 'failed',
        error: 'Optional secret not provided in environment'
      };
    }

    // Store in vault
    const { error } = await this.supabase.rpc('vault.create_secret', {
      secret: secretValue,
      name: secret.name,
      description: secret.description
    });

    if (error) {
      throw new Error(`Vault storage failed: ${error.message}`);
    }

    return {
      secretName: secret.name,
      status: 'created'
    };
  }

  /**
   * Retrieve a secret from Supabase Vault
   */
  async getSecretFromVault(secretName: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.rpc('vault.read_secret', {
        secret_name: secretName
      });

      if (error) {
        log.warn(`Failed to read secret from vault: ${secretName}`, LogContext.SECURITY, {
          error: error.message
        });
        return null;
      }

      return data?.decrypted_secret || null;
    } catch (error) {
      log.error(`Error reading secret from vault: ${secretName}`, LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Update an existing secret in vault
   */
  async updateSecretInVault(secretName: string, newValue: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('vault.update_secret', {
        secret_name: secretName,
        new_secret: newValue
      });

      if (error) {
        log.error(`Failed to update secret in vault: ${secretName}`, LogContext.SECURITY, {
          error: error.message
        });
        return false;
      }

      log.info(`✅ Secret updated in vault: ${secretName}`, LogContext.SECURITY);
      return true;
    } catch (error) {
      log.error(`Error updating secret in vault: ${secretName}`, LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * List all secrets in vault (names only, not values)
   */
  async listVaultSecrets(): Promise<Array<{ name: string; description?: string; created_at?: string }>> {
    try {
      const { data, error } = await this.supabase.rpc('vault.list_secrets');

      if (error) {
        log.error('Failed to list vault secrets', LogContext.SECURITY, {
          error: error.message
        });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Error listing vault secrets', LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Validate vault setup and test secret operations
   */
  async validateVaultSetup(): Promise<{
    vaultAvailable: boolean;
    canCreate: boolean;
    canRead: boolean;
    errors: string[];
  }> {
    const result = {
      vaultAvailable: false,
      canCreate: false,
      canRead: false,
      errors: [] as string[]
    };

    try {
      // Test basic vault availability
      const secrets = await this.listVaultSecrets();
      result.vaultAvailable = true;
      
      // Test secret creation
      const testSecretName = `test_vault_${Date.now()}`;
      const { error: createError } = await this.supabase.rpc('vault.create_secret', {
        secret: 'test-value',
        name: testSecretName,
        description: 'Test secret for vault validation'
      });

      if (createError) {
        result.errors.push(`Cannot create secrets: ${createError.message}`);
      } else {
        result.canCreate = true;

        // Test secret reading
        const secretValue = await this.getSecretFromVault(testSecretName);
        if (secretValue === 'test-value') {
          result.canRead = true;
        } else {
          result.errors.push('Cannot read created secrets');
        }

        // Cleanup test secret
        await this.supabase.rpc('vault.delete_secret', {
          secret_name: testSecretName
        });
      }

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  /**
   * Generate cryptographically secure secret
   */
  private generateSecureSecret(length = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    const crypto = require('crypto');
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      result += chars[randomIndex];
    }
    
    return result;
  }

  /**
   * Get migration status summary
   */
  async getMigrationStatus(): Promise<{
    totalSecrets: number;
    secretsInVault: number;
    missingSecrets: string[];
    requiredMissing: string[];
  }> {
    const vaultSecrets = await this.listVaultSecrets();
    const vaultSecretNames = new Set(vaultSecrets.map(s => s.name));
    
    const missingSecrets = this.requiredSecrets
      .filter(secret => !vaultSecretNames.has(secret.name))
      .map(secret => secret.name);
    
    const requiredMissing = this.requiredSecrets
      .filter(secret => secret.required && !vaultSecretNames.has(secret.name))
      .map(secret => secret.name);

    return {
      totalSecrets: this.requiredSecrets.length,
      secretsInVault: vaultSecrets.length,
      missingSecrets,
      requiredMissing
    };
  }
}

export const vaultMigrationService = new VaultMigrationService();
export default vaultMigrationService;
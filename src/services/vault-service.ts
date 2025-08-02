/**
 * Supabase Vault Service
 * Secure API key and secret retrieval from Supabase Vault
 * 
 * SECURITY CRITICAL: This service handles sensitive API keys and secrets
 */

import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '@/utils/logger';
import { config } from '@/config/environment';

interface SecretCache {
  value: string;
  expiry: number;
}

export class VaultService {
  private supabase;
  private secretCache = new Map<string, SecretCache>();
  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes cache
  
  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceKey || process.env.SUPABASE_SERVICE_KEY || ''
    );
  }

  /**
   * Get a secret from Supabase Vault with caching
   * Falls back to environment variable if vault is unavailable
   */
  async getSecret(secretName: string, fallbackEnvVar?: string): Promise<string | null> {
    try {
      // Check cache first
      const cached = this.secretCache.get(secretName);
      if (cached && Date.now() < cached.expiry) {
        return cached.value;
      }

      // Try to get from vault
      const { data, error } = await this.supabase.rpc('vault.read_secret', {
        secret_name: secretName
      });

      if (!error && data?.decrypted_secret) {
        // Cache the secret
        this.secretCache.set(secretName, {
          value: data.decrypted_secret,
          expiry: Date.now() + this.cacheExpiryMs
        });
        
        return data.decrypted_secret;
      }

      // Fallback to environment variable
      if (fallbackEnvVar && process.env[fallbackEnvVar]) {
        log.warn(`Using fallback env var for secret: ${secretName}`, LogContext.SECURITY, {
          fallbackEnvVar,
          vaultError: error?.message
        });
        return process.env[fallbackEnvVar];
      }

      log.warn(`Secret not found in vault or env: ${secretName}`, LogContext.SECURITY, {
        vaultError: error?.message,
        fallbackEnvVar
      });
      
      return null;
    } catch (error) {
      log.error(`Error retrieving secret: ${secretName}`, LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to environment variable on error
      if (fallbackEnvVar && process.env[fallbackEnvVar]) {
        return process.env[fallbackEnvVar];
      }

      return null;
    }
  }

  /**
   * Get OpenAI API key
   */
  async getOpenAIApiKey(): Promise<string | null> {
    return this.getSecret('openai_api_key', 'OPENAI_API_KEY');
  }

  /**
   * Get Anthropic API key
   */
  async getAnthropicApiKey(): Promise<string | null> {
    return this.getSecret('anthropic_api_key', 'ANTHROPIC_API_KEY');
  }

  /**
   * Get Hugging Face API key
   */
  async getHuggingFaceApiKey(): Promise<string | null> {
    return this.getSecret('huggingface_api_key', 'HUGGINGFACE_API_KEY');
  }

  /**
   * Get JWT secret for authentication
   */
  async getJwtSecret(): Promise<string> {
    const secret = await this.getSecret('jwt_secret', 'JWT_SECRET');
    return secret || 'fallback-jwt-secret-change-in-production';
  }

  /**
   * Get device authentication secret
   */
  async getDeviceAuthSecret(): Promise<string> {
    const secret = await this.getSecret('device_auth_secret', 'DEVICE_AUTH_SECRET');
    return secret || 'device-auth-secret';
  }

  /**
   * Get valid API keys for request validation
   */
  async getValidApiKeys(): Promise<string[]> {
    const keys = await this.getSecret('valid_api_keys', 'VALID_API_KEYS');
    return keys ? keys.split(',').map(k => k.trim()) : [];
  }

  /**
   * Get Supabase service key
   */
  async getSupabaseServiceKey(): Promise<string | null> {
    return this.getSecret('supabase_service_key', 'SUPABASE_SERVICE_KEY');
  }

  /**
   * Get Redis password
   */
  async getRedisPassword(): Promise<string | null> {
    return this.getSecret('redis_password', 'REDIS_PASSWORD');
  }

  /**
   * Get webhook secret
   */
  async getWebhookSecret(): Promise<string | null> {
    return this.getSecret('webhook_secret', 'WEBHOOK_SECRET');
  }

  /**
   * Get database encryption key
   */
  async getDatabaseEncryptionKey(): Promise<string | null> {
    return this.getSecret('database_encryption_key', 'DATABASE_ENCRYPTION_KEY');
  }

  /**
   * Clear secret cache (useful for development/testing)
   */
  clearCache(): void {
    this.secretCache.clear();
    log.info('🧹 Vault service cache cleared', LogContext.SECURITY);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.secretCache.size,
      entries: Array.from(this.secretCache.keys())
    };
  }

  /**
   * Test vault connectivity
   */
  async testVaultConnectivity(): Promise<{ connected: boolean; error?: string }> {
    try {
      const { data, error } = await this.supabase.rpc('vault.list_secrets');
      
      if (error) {
        return { connected: false, error: error.message };
      }
      
      return { connected: true };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create a new secret in Supabase Vault (alias for backward compatibility)
   */
  async createSecret(secretName: string, secretValue: string, description?: string): Promise<boolean> {
    return this.createSecretInVault(secretName, secretValue, description);
  }

  /**
   * Create a new secret in Supabase Vault
   */
  async createSecretInVault(secretName: string, secretValue: string, description?: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('vault.create_secret', {
        secret: secretValue,
        name: secretName,
        description: description || `Secret for ${secretName}`
      });

      if (error) {
        log.error(`Failed to create secret: ${secretName}`, LogContext.SECURITY, {
          error: error.message
        });
        return false;
      }

      // Clear cache for this secret
      this.secretCache.delete(secretName);
      
      log.info(`✅ Secret created in vault: ${secretName}`, LogContext.SECURITY);
      return true;
    } catch (error) {
      log.error(`Error creating secret: ${secretName}`, LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Update an existing secret in Supabase Vault
   */
  async updateSecretInVault(secretName: string, secretValue: string): Promise<boolean> {
    try {
      // First check if secret exists
      const existing = await this.getSecret(secretName);
      
      if (!existing) {
        // Secret doesn't exist, create it instead
        return this.createSecretInVault(secretName, secretValue);
      }

      // Update existing secret
      const { data, error } = await this.supabase.rpc('vault.update_secret', {
        secret_name: secretName,
        new_secret: secretValue
      });

      if (error) {
        log.error(`Failed to update secret: ${secretName}`, LogContext.SECURITY, {
          error: error.message
        });
        return false;
      }

      // Clear cache for this secret
      this.secretCache.delete(secretName);
      
      log.info(`✅ Secret updated in vault: ${secretName}`, LogContext.SECURITY);
      return true;
    } catch (error) {
      log.error(`Error updating secret: ${secretName}`, LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Delete a secret from Supabase Vault
   */
  async deleteSecretFromVault(secretName: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('vault.delete_secret', {
        secret_name: secretName
      });

      if (error) {
        log.error(`Failed to delete secret: ${secretName}`, LogContext.SECURITY, {
          error: error.message
        });
        return false;
      }

      // Clear cache for this secret
      this.secretCache.delete(secretName);
      
      log.info(`✅ Secret deleted from vault: ${secretName}`, LogContext.SECURITY);
      return true;
    } catch (error) {
      log.error(`Error deleting secret: ${secretName}`, LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * List all secrets in the vault (names only, not values)
   */
  async listVaultSecrets(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase.rpc('vault.list_secrets');
      
      if (error) {
        log.error('Failed to list vault secrets', LogContext.SECURITY, {
          error: error.message
        });
        return [];
      }

      return data?.map((secret: any) => secret.name) || [];
    } catch (error) {
      log.error('Error listing vault secrets', LogContext.SECURITY, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
}

export const vaultService = new VaultService();
export default vaultService;
/**
 * Keyring-based Secrets Manager
 * Provides secure storage of secrets in the system keychain/keyring
 */

import keytar from 'keytar';
import { LogContext, log } from '../utils/logger';
import crypto from 'crypto';

const SERVICE_NAME = 'UniversalAITools';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export interface SecretMetadata {
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  encrypted: boolean;
}

class KeyringSecretsManager {
  private encryptionKey: Buffer | null = null;
  private secretsMetadata: Map<string, SecretMetadata> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialize asynchronously
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.initializeEncryptionKey();
    await this.loadMetadata();
    this.initialized = true;
  }

  /**
   * Ensure the manager is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Initialize the encryption key for additional security
   */
  private async initializeEncryptionKey(): Promise<void> {
    try {
      // Try to load existing encryption key from keyring
      const storedKey = await keytar.getPassword(SERVICE_NAME, 'master_encryption_key');
      
      if (storedKey && storedKey.length === 64) { // 32 bytes = 64 hex chars
        this.encryptionKey = Buffer.from(storedKey, 'hex');
        log.info('Loaded existing master encryption key', LogContext.SECURITY);
      } else {
        // Generate new encryption key
        this.encryptionKey = crypto.randomBytes(32);
        await keytar.setPassword(
          SERVICE_NAME,
          'master_encryption_key',
          this.encryptionKey.toString('hex')
        );
        log.info('Generated new master encryption key', LogContext.SECURITY);
      }
    } catch (error) {
      log.error('Failed to initialize encryption key from keyring', LogContext.SECURITY, { error });
      // Fallback to generating a new key for this session
      this.encryptionKey = crypto.randomBytes(32);
      log.warn('Using session-only encryption key (keyring not available)', LogContext.SECURITY);
      
      // Try to use environment variable if available
      const envKey = process.env.ENCRYPTION_KEY;
      if (envKey && envKey.length === 64) {
        try {
          this.encryptionKey = Buffer.from(envKey, 'hex');
          log.info('Using encryption key from environment', LogContext.SECURITY);
        } catch (e) {
          // Keep the generated key if env key is invalid
        }
      }
    }
    
    // Validate the key length
    if (!this.encryptionKey || this.encryptionKey.length !== 32) {
      this.encryptionKey = crypto.randomBytes(32);
      log.warn('Generated fallback encryption key due to invalid key length', LogContext.SECURITY);
    }
  }

  /**
   * Load metadata about stored secrets
   */
  private async loadMetadata(): Promise<void> {
    try {
      const metadataJson = await keytar.getPassword(SERVICE_NAME, 'secrets_metadata');
      if (metadataJson) {
        const metadata = JSON.parse(metadataJson);
        for (const [key, value] of Object.entries(metadata)) {
          this.secretsMetadata.set(key, {
            ...value as any,
            createdAt: new Date((value as any).createdAt),
            updatedAt: new Date((value as any).updatedAt)
          });
        }
      }
    } catch (error) {
      log.warn('Failed to load secrets metadata', LogContext.SECURITY, { error });
    }
  }

  /**
   * Save metadata about stored secrets
   */
  private async saveMetadata(): Promise<void> {
    try {
      const metadata: Record<string, any> = {};
      for (const [key, value] of this.secretsMetadata.entries()) {
        metadata[key] = {
          ...value,
          createdAt: value.createdAt.toISOString(),
          updatedAt: value.updatedAt.toISOString()
        };
      }
      await keytar.setPassword(SERVICE_NAME, 'secrets_metadata', JSON.stringify(metadata));
    } catch (error) {
      log.error('Failed to save secrets metadata', LogContext.SECURITY, { error });
    }
  }

  /**
   * Encrypt a value using AES-256-GCM
   */
  private encrypt(text: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag();
    
    return `${iv.toString('hex')  }:${  authTag.toString('hex')  }:${  encrypted}`;
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  private decrypt(encryptedText: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0] || '', 'hex');
    const authTag = Buffer.from(parts[1] || '', 'hex');
    const encrypted = parts[2] || '';

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    (decipher as any).setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Store a secret in the keyring
   */
  async setSecret(
    name: string,
    value: string,
    options: {
      description?: string;
      encrypt?: boolean;
    } = {}
  ): Promise<void> {
    await this.ensureInitialized();
    
    try {
      const { description, encrypt = true } = options;
      
      // Encrypt the value if requested
      const finalValue = encrypt ? this.encrypt(value) : value;
      
      // Store in keyring
      await keytar.setPassword(SERVICE_NAME, name, finalValue);
      
      // Update metadata
      this.secretsMetadata.set(name, {
        name,
        description,
        createdAt: this.secretsMetadata.get(name)?.createdAt || new Date(),
        updatedAt: new Date(),
        encrypted: encrypt
      });
      
      await this.saveMetadata();
      
      log.info(`Secret stored: ${name}`, LogContext.SECURITY, {
        encrypted: encrypt,
        hasDescription: !!description
      });
    } catch (error) {
      log.error(`Failed to store secret: ${name}`, LogContext.SECURITY, { error });
      throw error;
    }
  }

  /**
   * Retrieve a secret from the keyring
   */
  async getSecret(name: string): Promise<string | null> {
    await this.ensureInitialized();
    
    try {
      const value = await keytar.getPassword(SERVICE_NAME, name);
      
      if (!value) {
        return null;
      }
      
      // Check if the value is encrypted
      const metadata = this.secretsMetadata.get(name);
      if (metadata?.encrypted) {
        try {
          return this.decrypt(value);
        } catch (error) {
          log.error(`Failed to decrypt secret: ${name}`, LogContext.SECURITY, { error });
          // Return raw value if decryption fails (might be unencrypted)
          return value;
        }
      }
      
      return value;
    } catch (error) {
      log.error(`Failed to retrieve secret: ${name}`, LogContext.SECURITY, { error });
      return null;
    }
  }

  /**
   * Delete a secret from the keyring
   */
  async deleteSecret(name: string): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const result = await keytar.deletePassword(SERVICE_NAME, name);
      
      if (result) {
        this.secretsMetadata.delete(name);
        await this.saveMetadata();
        log.info(`Secret deleted: ${name}`, LogContext.SECURITY);
      }
      
      return result;
    } catch (error) {
      log.error(`Failed to delete secret: ${name}`, LogContext.SECURITY, { error });
      return false;
    }
  }

  /**
   * List all stored secrets (names only, not values)
   */
  async listSecrets(): Promise<SecretMetadata[]> {
    await this.ensureInitialized();
    
    try {
      const credentials = await keytar.findCredentials(SERVICE_NAME);
      const secrets: SecretMetadata[] = [];
      
      for (const cred of credentials) {
        // Skip system keys
        if (cred.account === 'master_encryption_key' || cred.account === 'secrets_metadata') {
          continue;
        }
        
        const metadata = this.secretsMetadata.get(cred.account);
        if (metadata) {
          secrets.push(metadata);
        } else {
          // Create basic metadata for secrets without stored metadata
          secrets.push({
            name: cred.account,
            createdAt: new Date(),
            updatedAt: new Date(),
            encrypted: false
          });
        }
      }
      
      return secrets;
    } catch (error) {
      log.error('Failed to list secrets', LogContext.SECURITY, { error });
      return [];
    }
  }

  /**
   * Migrate secrets from environment variables to keyring
   */
  async migrateFromEnvironment(): Promise<void> {
    await this.ensureInitialized();
    
    const secretsToMigrate = [
      { env: 'JWT_SECRET', name: 'jwt_secret', description: 'JWT authentication secret' },
      { env: 'OPENAI_API_KEY', name: 'openai_api_key', description: 'OpenAI API key' },
      { env: 'ANTHROPIC_API_KEY', name: 'anthropic_api_key', description: 'Anthropic API key' },
      { env: 'SUPABASE_SERVICE_KEY', name: 'supabase_service_key', description: 'Supabase service key' },
      { env: 'ENCRYPTION_KEY', name: 'encryption_key', description: 'Data encryption key' },
      { env: 'TOKEN_ENCRYPTION_KEY', name: 'token_encryption_key', description: 'Token encryption key' }
    ];

    let migratedCount = 0;
    
    for (const secret of secretsToMigrate) {
      const envValue = process.env[secret.env];
      if (envValue) {
        const existingValue = await this.getSecret(secret.name);
        if (!existingValue) {
          await this.setSecret(secret.name, envValue, {
            description: secret.description,
            encrypt: true
          });
          migratedCount++;
          log.info(`Migrated secret from environment: ${secret.name}`, LogContext.SECURITY);
        }
      }
    }
    
    if (migratedCount > 0) {
      log.info(`Migrated ${migratedCount} secrets to keyring`, LogContext.SECURITY);
    }
  }

  /**
   * Initialize default secrets if they don't exist
   */
  async initializeDefaults(): Promise<void> {
    await this.ensureInitialized();
    
    // Check and create JWT secret if not exists
    const jwtSecret = await this.getSecret('jwt_secret');
    if (!jwtSecret) {
      const newJwtSecret = crypto.randomBytes(64).toString('base64');
      await this.setSecret('jwt_secret', newJwtSecret, {
        description: 'JWT authentication secret',
        encrypt: true
      });
      log.info('Generated new JWT secret in keyring', LogContext.SECURITY);
    }

    // Check and create encryption key if not exists
    const encryptionKey = await this.getSecret('encryption_key');
    if (!encryptionKey) {
      const newEncryptionKey = crypto.randomBytes(32).toString('hex');
      await this.setSecret('encryption_key', newEncryptionKey, {
        description: 'Data encryption key',
        encrypt: true
      });
      log.info('Generated new encryption key in keyring', LogContext.SECURITY);
    }
  }
}

// Export singleton instance
export const keyringSecretsManager = new KeyringSecretsManager();

// Export for testing
export { KeyringSecretsManager };
import crypto from 'crypto';
import { config } from './environment';

// Encryption utilities
export class SecretsManager {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;

  private encryptionKey: Buffer;

  constructor() {
    this.encryptionKey = this.deriveKey(config.security.encryptionKey);
  }

  /**
   * Derive encryption key from the base key
   */
  private deriveKey(baseKey: string): Buffer {
    return crypto.scryptSync(baseKey, 'universal-ai-tools', this.keyLength);
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    cipher.setAAD(Buffer.from('universal-ai-tools'));

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine IV + tag + encrypted data
    const result = iv.toString('hex') + tag.toString('hex') + encrypted;
    return result;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData: string): string {
    const ivHex = encryptedData.slice(0, this.ivLength * 2);
    const tagHex = encryptedData.slice(this.ivLength * 2, (this.ivLength + this.tagLength) * 2);
    const encrypted = encryptedData.slice((this.ivLength + this.tagLength) * 2);

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAAD(Buffer.from('universal-ai-tools'));
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate a secure random key
   */
  generateKey(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash a password or sensitive string
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(16);
    const hash = crypto.scryptSync(data, saltBuffer, 64);

    return {
      hash: hash.toString('hex'),
      salt: saltBuffer.toString('hex'),
    };
  }

  /**
   * Verify a hash
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hash(data, salt);
    return computedHash === hash;
  }
}

// Singleton instance
export const secretsManager = new SecretsManager();

// API Key management
export class APIKeyManager {
  private keys: Map<string, { encrypted: string; permissions: string[] }> = new Map();

  /**
   * Store an API key securely
   */
  storeAPIKey(keyName: string, apiKey: string, permissions: string[] = []): string {
    const encrypted = secretsManager.encrypt(apiKey);
    const keyId = secretsManager.generateKey(16);

    this.keys.set(keyId, {
      encrypted,
      permissions,
    });

    return keyId;
  }

  /**
   * Retrieve and decrypt an API key
   */
  getAPIKey(keyId: string): { apiKey: string; permissions: string[] } | null {
    const keyData = this.keys.get(keyId);
    if (!keyData) return null;

    const apiKey = secretsManager.decrypt(keyData.encrypted);
    return {
      apiKey,
      permissions: keyData.permissions,
    };
  }

  /**
   * Revoke an API key
   */
  revokeAPIKey(keyId: string): boolean {
    return this.keys.delete(keyId);
  }

  /**
   * List all API key IDs (without revealing the keys)
   */
  listKeys(): string[] {
    return Array.from(this.keys.keys());
  }
}

// Singleton instance
export const apiKeyManager = new APIKeyManager();

// Environment-specific secrets
export interface SecretConfig {
  name: string;
  value: string;
  encrypted?: boolean;
  environment?: string;
}

export class EnvironmentSecrets {
  private secrets: Map<string, SecretConfig> = new Map();

  /**
   * Set a secret value
   */
  setSecret(
    name: string,
    value: string,
    options: {
      encrypt?: boolean;
      environment?: string;
    } = {}
  ): void {
    const { encrypt = true, environment = config.server.env } = options;

    const secret: SecretConfig = {
      name,
      value: encrypt ? secretsManager.encrypt(value) : value,
      encrypted: encrypt,
      environment,
    };

    this.secrets.set(name, secret);
  }

  /**
   * Get a secret value
   */
  getSecret(name: string): string | null {
    const secret = this.secrets.get(name);
    if (!secret) return null;

    // Check environment match
    if (secret.environment && secret.environment !== config.server.env) {
      return null;
    }

    return secret.encrypted ? secretsManager.decrypt(secret.value) : secret.value;
  }

  /**
   * Delete a secret
   */
  deleteSecret(name: string): boolean {
    return this.secrets.delete(name);
  }

  /**
   * List all secret names for current environment
   */
  listSecrets(): string[] {
    return Array.from(this.secrets.entries())
      .filter(([_, secret]) => !secret.environment || secret.environment === config.server.env)
      .map(([name]) => name);
  }
}

// Singleton instance
export const environmentSecrets = new EnvironmentSecrets();

// Utility functions
export function maskSecret(secret: string, visibleChars = 4): string {
  if (secret.length <= visibleChars) {
    return '*'.repeat(secret.length);
  }

  const start = secret.slice(0, visibleChars);
  const masked = '*'.repeat(secret.length - visibleChars);
  return start + masked;
}

export function validateSecretStrength(secret: string): {
  isStrong: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (secret.length >= 12) score += 25;
  else feedback.push('Secret should be at least 12 characters long');

  // Complexity checks
  if (/[a-z]/.test(secret)) score += 10;
  else feedback.push('Secret should contain lowercase letters');

  if (/[A-Z]/.test(secret)) score += 10;
  else feedback.push('Secret should contain uppercase letters');

  if (/[0-9]/.test(secret)) score += 10;
  else feedback.push('Secret should contain numbers');

  if (/[^a-zA-Z0-9]/.test(secret)) score += 15;
  else feedback.push('Secret should contain special characters');

  // Entropy check
  const entropy = calculateEntropy(secret);
  if (entropy >= 4) score += 20;
  else feedback.push('Secret should have higher entropy (more randomness)');

  // Common patterns check
  if (!/(.)\1{2,}/.test(secret)) score += 10;
  else feedback.push('Secret should not contain repeated characters');

  return {
    isStrong: score >= 70,
    score,
    feedback,
  };
}

function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};

  // Count character frequencies
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  // Calculate Shannon entropy
  const len = str.length;
  let entropy = 0;

  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

// Classes are already exported above

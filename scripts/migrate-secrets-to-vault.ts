#!/usr/bin/env tsx
/**
 * Secret Migration Script - Universal AI Tools
 * 
 * This script migrates API keys and secrets from environment variables
 * to Supabase Vault for enhanced security in production.
 * 
 * Usage: npm run migrate:secrets
 * 
 * IMPORTANT: Run this once during deployment setup, then remove
 * environment variables containing API keys from your .env files.
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv();

interface SecretConfig {
  envKey: string;
  vaultName: string;
  description: string;
  required: boolean;
}

// Define all secrets that need to be migrated
const secretsToMigrate: SecretConfig[] = [
  {
    envKey: 'OPENAI_API_KEY',
    vaultName: 'openai_api_key',
    description: 'OpenAI API key for GPT models and embeddings',
    required: true
  },
  {
    envKey: 'ANTHROPIC_API_KEY', 
    vaultName: 'anthropic_api_key',
    description: 'Anthropic Claude API key for advanced reasoning',
    required: true
  },
  {
    envKey: 'HUGGINGFACE_API_KEY',
    vaultName: 'huggingface_api_key', 
    description: 'Hugging Face API key for model access',
    required: false
  },
  {
    envKey: 'GOOGLE_AI_API_KEY',
    vaultName: 'google_ai_api_key',
    description: 'Google AI/Gemini API key',
    required: false
  },
  {
    envKey: 'COHERE_API_KEY',
    vaultName: 'cohere_api_key',
    description: 'Cohere API key for embeddings and completions', 
    required: false
  },
  {
    envKey: 'REPLICATE_API_TOKEN',
    vaultName: 'replicate_api_key',
    description: 'Replicate API key for image generation models',
    required: false
  },
  {
    envKey: 'JWT_SECRET',
    vaultName: 'jwt_secret',
    description: 'JWT signing secret for authentication',
    required: true
  },
  {
    envKey: 'ENCRYPTION_KEY',
    vaultName: 'encryption_key',
    description: 'Application encryption key for sensitive data',
    required: true
  },
  {
    envKey: 'SUPABASE_SERVICE_KEY',
    vaultName: 'supabase_service_key',
    description: 'Supabase service role key for admin operations',
    required: true
  },
  {
    envKey: 'REDIS_PASSWORD',
    vaultName: 'redis_password', 
    description: 'Redis instance password for secure connections',
    required: false
  },
  {
    envKey: 'WEBHOOK_SECRET',
    vaultName: 'webhook_secret',
    description: 'Webhook verification secret for external integrations',
    required: false
  }
];

class SecretMigrator {
  private supabase: any;
  private rl: any;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment');
      process.exit(1);
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Setup readline for user input
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async checkVaultAccess(): Promise<boolean> {
    try {
      // Test vault access by trying to read a non-existent secret
      const { error } = await this.supabase.rpc('vault.read_secret', {
        secret_name: 'vault_access_test'
      });
      
      // We expect an error here, but it should be "secret not found", not "access denied"
      return !error || error.message.includes('not found');
    } catch (error) {
      console.error('❌ Vault access check failed:', error);
      return false;
    }
  }

  async secretExists(secretName: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('vault.read_secret', {
        secret_name: secretName
      });
      
      return !error && data !== null;
    } catch {
      return false;
    }
  }

  async createSecret(name: string, value: string, description: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('vault.create_secret', {
        secret: value,
        name: name,
        description: description
      });

      if (error) {
        console.error(`❌ Failed to create secret ${name}:`, error.message);
        return false;
      }

      console.log(`✅ Created secret: ${name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error creating secret ${name}:`, error);
      return false;
    }
  }

  async updateSecret(name: string, value: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc('vault.update_secret', {
        secret_name: name,
        secret: value
      });

      if (error) {
        console.error(`❌ Failed to update secret ${name}:`, error.message);
        return false;
      }

      console.log(`✅ Updated secret: ${name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error updating secret ${name}:`, error);
      return false;
    }
  }

  async migrateSecret(secretConfig: SecretConfig, force = false): Promise<boolean> {
    const { envKey, vaultName, description, required } = secretConfig;
    const envValue = process.env[envKey];

    // Check if secret exists in environment
    if (!envValue) {
      if (required) {
        console.warn(`⚠️  Required secret ${envKey} not found in environment`);
        const input = await this.question(`Enter value for ${vaultName}: `);
        if (input.trim()) {
          return await this.processSecret(vaultName, input.trim(), description, force);
        }
        return false;
      } else {
        console.log(`ℹ️  Optional secret ${envKey} not found in environment - skipping`);
        return true;
      }
    }

    // Process the secret
    return await this.processSecret(vaultName, envValue, description, force);
  }

  async processSecret(name: string, value: string, description: string, force = false): Promise<boolean> {
    const exists = await this.secretExists(name);

    if (exists && !force) {
      console.log(`ℹ️  Secret ${name} already exists in vault`);
      const overwrite = await this.question(`Overwrite ${name}? (y/N): `);
      
      if (overwrite.toLowerCase() === 'y') {
        return await this.updateSecret(name, value);
      }
      return true;
    }

    if (exists) {
      return await this.updateSecret(name, value);
    } else {
      return await this.createSecret(name, value, description);
    }
  }

  async generateMissingSecrets(): Promise<void> {
    console.log('\n🔧 Generating missing required secrets...');

    // Generate JWT secret if not provided
    if (!process.env.JWT_SECRET) {
      const jwtSecret = require('crypto').randomBytes(64).toString('hex');
      await this.processSecret('jwt_secret', jwtSecret, 'JWT signing secret for authentication', true);
    }

    // Generate encryption key if not provided
    if (!process.env.ENCRYPTION_KEY) {
      const encryptionKey = require('crypto').randomBytes(32).toString('hex');
      await this.processSecret('encryption_key', encryptionKey, 'Application encryption key for sensitive data', true);
    }
  }

  async validateMigration(): Promise<boolean> {
    console.log('\n🔍 Validating migration...');
    let allValid = true;

    for (const secret of secretsToMigrate) {
      if (secret.required) {
        const exists = await this.secretExists(secret.vaultName);
        if (!exists) {
          console.error(`❌ Required secret ${secret.vaultName} not found in vault`);
          allValid = false;
        } else {
          console.log(`✅ Verified: ${secret.vaultName}`);
        }
      }
    }

    return allValid;
  }

  async showMigrationSummary(): Promise<void> {
    console.log('\n📋 Migration Summary');
    console.log('===================');
    
    for (const secret of secretsToMigrate) {
      const exists = await this.secretExists(secret.vaultName);
      const status = exists ? '✅ Migrated' : (secret.required ? '❌ Missing' : '⏸️  Skipped');
      console.log(`${status} ${secret.vaultName} - ${secret.description}`);
    }
  }

  async cleanup(): Promise<void> {
    this.rl.close();
  }

  async run(): Promise<void> {
    console.log('🔐 Universal AI Tools - Secret Migration to Supabase Vault');
    console.log('=========================================================');
    console.log();

    // Check vault access
    console.log('🔍 Checking Vault access...');
    const hasAccess = await this.checkVaultAccess();
    if (!hasAccess) {
      console.error('❌ Cannot access Supabase Vault. Check SUPABASE_SERVICE_KEY and permissions.');
      return;
    }
    console.log('✅ Vault access confirmed');

    // Confirm migration
    const confirm = await this.question('\n⚠️  This will migrate API keys to Supabase Vault. Continue? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Migration cancelled');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Migrate each secret
    console.log('\n🚀 Starting secret migration...');
    for (const secretConfig of secretsToMigrate) {
      console.log(`\n📦 Processing: ${secretConfig.vaultName}`);
      
      try {
        const success = await this.migrateSecret(secretConfig);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error migrating ${secretConfig.vaultName}:`, error);
        errorCount++;
      }
    }

    // Generate missing required secrets
    await this.generateMissingSecrets();

    // Validate migration
    const isValid = await this.validateMigration();

    // Show summary
    await this.showMigrationSummary();

    console.log('\n📊 Migration Results');
    console.log('==================');
    console.log(`✅ Successful migrations: ${successCount}`);
    console.log(`❌ Failed migrations: ${errorCount}`);
    console.log(`🔍 Validation: ${isValid ? 'PASSED' : 'FAILED'}`);

    if (isValid && errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n⚠️  IMPORTANT NEXT STEPS:');
      console.log('1. Update your services to use the vault service instead of process.env');
      console.log('2. Remove API keys from your .env files');
      console.log('3. Update .env.example to remove sensitive keys');
      console.log('4. Restart your application to use vault-based secrets');
    } else {
      console.log('\n⚠️  Migration completed with errors. Review the issues above.');
    }
  }
}

// Run the migration
if (require.main === module) {
  const migrator = new SecretMigrator();
  
  migrator.run().then(() => {
    migrator.cleanup();
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Migration failed:', error);
    migrator.cleanup();
    process.exit(1);
  });
}

export { SecretMigrator };
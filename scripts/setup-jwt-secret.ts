#!/usr/bin/env tsx

/**
 * Setup JWT Secret in Supabase Vault
 * Generates a secure JWT secret and stores it in Supabase Vault
 */

import crypto from 'crypto';
import { secretsManager } from '../src/services/secrets-manager';
import { log, LogContext } from '../src/utils/logger';

async function setupJwtSecret(): Promise<void> {
  try {
    log.info('🔐 Setting up JWT secret in Supabase Vault...', LogContext.SYSTEM);

    // Check if JWT secret already exists
    const existingSecret = await secretsManager.getSecret('jwt_secret');
    if (existingSecret) {
      log.info('✅ JWT secret already exists in vault', LogContext.SYSTEM);
      return;
    }

    // Generate a secure JWT secret (64 bytes = 512 bits)
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    
    // Store in Supabase Vault
    const success = await secretsManager.storeSecret({
      name: 'jwt_secret',
      value: jwtSecret,
      description: 'JWT signing secret for device authentication',
      service: 'auth'
    });

    if (success) {
      log.info('✅ JWT secret generated and stored in vault', LogContext.SYSTEM, {
        secretLength: jwtSecret.length,
        service: 'auth'
      });
    } else {
      log.error('❌ Failed to store JWT secret in vault', LogContext.SYSTEM);
      process.exit(1);
    }

    // Also set up encryption key if missing
    const existingEncKey = await secretsManager.getSecret('encryption_key');
    if (!existingEncKey) {
      const encryptionKey = crypto.randomBytes(32).toString('hex');
      const encSuccess = await secretsManager.storeSecret({
        name: 'encryption_key',
        value: encryptionKey,
        description: 'Encryption key for sensitive data',
        service: 'auth'
      });

      if (encSuccess) {
        log.info('✅ Encryption key generated and stored', LogContext.SYSTEM);
      }
    }

    log.info('🔒 Security setup complete', LogContext.SYSTEM);
  } catch (error) {
    log.error('❌ Failed to setup JWT secret', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupJwtSecret().catch((error) => {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Setup failed:', error);
    process.exit(1);
  });
}

export { setupJwtSecret };
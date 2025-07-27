#!/usr/bin/env tsx
/**
 * Setup Supabase Vault and migrate API keys
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';
import { secretsManager } from '../src/services/secrets-manager';
import { LogContext, log } from '../src/utils/logger';

async function setupVault() {
  log.info('🔐 Setting up Supabase Vault...', LogContext.SYSTEM);

  // Initialize Supabase client
  const supabase = createClient(
    config.supabase.url || 'http://localhost:54321',
    config.supabase.serviceKey || '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  try {
    // Apply Vault setup migration
    log.info('📋 Applying Vault setup migration...', LogContext.SYSTEM);
    
    // First, apply the API secrets management tables
    const apiSecretsSql = await fetch(
      'file:///Users/christianmerrill/Desktop/universal-ai-tools/supabase/migrations/036_api_secrets_management.sql'
    ).then(r => r.text()).catch(() => null);

    if (apiSecretsSql) {
      const { error: apiError } = await supabase.rpc('exec_sql', {
        sql: apiSecretsSql
      }).single();

      if (apiError) {
        log.warn('⚠️ API secrets tables may already exist', LogContext.SYSTEM, { error: apiError });
      } else {
        log.info('✅ API secrets tables created', LogContext.SYSTEM);
      }
    }

    // Apply Vault functions
    const vaultFunctionsSql = await fetch(
      'file:///Users/christianmerrill/Desktop/universal-ai-tools/supabase/migrations/037_vault_functions.sql'
    ).then(r => r.text()).catch(() => null);

    if (vaultFunctionsSql) {
      const { error: vaultError } = await supabase.rpc('exec_sql', {
        sql: vaultFunctionsSql
      }).single();

      if (vaultError) {
        log.warn('⚠️ Vault functions may already exist', LogContext.SYSTEM, { error: vaultError });
      } else {
        log.info('✅ Vault functions created', LogContext.SYSTEM);
      }
    }

    // Initialize secrets from environment
    log.info('🔄 Migrating secrets from environment variables...', LogContext.SYSTEM);
    await secretsManager.initializeFromEnv();

    // Check for missing credentials
    const missing = await secretsManager.getMissingCredentials();
    if (missing.length > 0) {
      log.warn('⚠️ Missing API keys for services:', LogContext.SYSTEM, { services: missing });
      log.info('💡 Add missing keys through the UI or by setting environment variables', LogContext.SYSTEM);
    }

    // Test secret storage and retrieval
    log.info('🧪 Testing Vault functionality...', LogContext.SYSTEM);
    
    const testSecret = 'test_secret_' + Date.now();
    const testValue = 'This is a test secret value';
    
    // Store test secret
    const stored = await secretsManager.storeSecret({
      name: testSecret,
      value: testValue,
      description: 'Test secret for Vault setup'
    });

    if (stored) {
      // Retrieve test secret
      const retrieved = await secretsManager.getSecret(testSecret);
      
      if (retrieved === testValue) {
        log.info('✅ Vault is working correctly!', LogContext.SYSTEM);
        
        // Clean up test secret
        const { error } = await supabase.rpc('delete_secret', {
          secret_name: testSecret
        });
        
        if (!error) {
          log.info('🧹 Test secret cleaned up', LogContext.SYSTEM);
        }
      } else {
        log.error('❌ Vault test failed - retrieval mismatch', LogContext.SYSTEM);
      }
    } else {
      log.error('❌ Vault test failed - could not store secret', LogContext.SYSTEM);
    }

    // List available services
    const services = await secretsManager.getAvailableServices();
    log.info('📋 Available services:', LogContext.SYSTEM, { services });

    // Show services with credentials
    const servicesWithCreds: string[] = [];
    for (const service of services) {
      const hasCreds = await secretsManager.hasValidCredentials(service);
      if (hasCreds) {
        servicesWithCreds.push(service);
      }
    }
    
    log.info('✅ Services with valid credentials:', LogContext.SYSTEM, { 
      services: servicesWithCreds,
      count: `${servicesWithCreds.length}/${services.length}`
    });

    log.info('🎉 Vault setup complete!', LogContext.SYSTEM);
    
  } catch (error) {
    log.error('❌ Vault setup failed', LogContext.SYSTEM, {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }

  process.exit(0);
}

// Run setup
setupVault().catch(console.error);
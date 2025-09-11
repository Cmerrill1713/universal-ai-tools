/**
 * Vault Secrets Initialization Script
 * Sets up required secrets for production deployment
 */

import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../src/utils/logger';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

/**
 * Initialize vault secrets for production deployment
 */
async function initializeVaultSecrets() {
  try {
    log.info('🔐 Initializing vault secrets for production', LogContext.SECURITY);

    // Get environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
    }

    // Create Supabase client with service key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate secure secrets
    const jwtSecret = crypto.randomBytes(64).toString('hex');
    const networkApiKey = crypto.randomBytes(32).toString('hex');
    const encryptionKey = crypto.randomBytes(32).toString('hex');

    log.info('🔑 Generated secure secrets', LogContext.SECURITY);

    // Store secrets in vault (ai_service_keys table)
    const secrets = [
      {
        service_name: 'jwt_secret',
        api_key: jwtSecret,
        is_active: true,
        rate_limit: 1000,
        rate_window: 3600,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          description: 'JWT signing secret for authentication tokens',
          environment: 'production',
          generated_at: new Date().toISOString(),
        },
      },
      {
        service_name: 'network_api_key',
        api_key: networkApiKey,
        is_active: true,
        rate_limit: 10000,
        rate_window: 3600,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          description: 'Network API key for local network authentication',
          environment: 'production',
          generated_at: new Date().toISOString(),
        },
      },
      {
        service_name: 'encryption_key',
        api_key: encryptionKey,
        is_active: true,
        rate_limit: 1000,
        rate_window: 3600,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          description: 'AES encryption key for sensitive data',
          environment: 'production',
          generated_at: new Date().toISOString(),
        },
      },
    ];

    // Insert or update secrets
    for (const secret of secrets) {
      const { data: existingSecret } = await supabase
        .from('ai_service_keys')
        .select('id')
        .eq('service_name', secret.service_name)
        .single();

      if (existingSecret) {
        // Update existing secret
        const { error } = await supabase
          .from('ai_service_keys')
          .update({
            api_key: secret.api_key,
            updated_at: secret.updated_at,
            metadata: secret.metadata,
          })
          .eq('service_name', secret.service_name);

        if (error) {
          log.error(`Failed to update ${secret.service_name}`, LogContext.SECURITY, { error });
        } else {
          log.info(`✅ Updated ${secret.service_name}`, LogContext.SECURITY);
        }
      } else {
        // Insert new secret
        const { error } = await supabase
          .from('ai_service_keys')
          .insert(secret);

        if (error) {
          log.error(`Failed to insert ${secret.service_name}`, LogContext.SECURITY, { error });
        } else {
          log.info(`✅ Created ${secret.service_name}`, LogContext.SECURITY);
        }
      }
    }

    // Create default admin user if it doesn't exist
    await createDefaultAdminUser(supabase);

    // Create API key hashes for common services
    await createServiceApiKeys(supabase);

    log.info('🎉 Vault secrets initialization completed successfully', LogContext.SECURITY);
    log.info('📋 Generated secrets summary:', LogContext.SECURITY, {
      jwt_secret: `${jwtSecret.substring(0, 16)}...`,
      network_api_key: `${networkApiKey.substring(0, 16)}...`,
      encryption_key: `${encryptionKey.substring(0, 16)}...`,
    });

    // Print environment variables for .env file
    console.log('\n🔧 Add these to your .env file:');
    console.log(`JWT_SECRET="${jwtSecret}"`);
    console.log(`NETWORK_API_KEY="${networkApiKey}"`);
    console.log(`ENCRYPTION_KEY="${encryptionKey}"`);

  } catch (error) {
    log.error('❌ Vault secrets initialization failed', LogContext.SECURITY, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

/**
 * Create default admin user
 */
async function createDefaultAdminUser(supabase: any) {
  try {
    const adminEmail = 'admin@universal-ai-tools.com';
    const adminPassword = 'SecureAdminPass123!';

    // Check if admin user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', adminEmail)
      .single();

    if (!existingUser) {
      // Hash password
      const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

      // Create admin user
      const { error } = await supabase
        .from('users')
        .insert({
          email: adminEmail,
          password_hash: hashedPassword,
          name: 'System Administrator',
          role: 'admin',
          tenant_id: 'universal-ai-tools',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        log.error('Failed to create admin user', LogContext.SECURITY, { error });
      } else {
        log.info('✅ Created default admin user', LogContext.SECURITY, {
          email: adminEmail,
        });
        console.log(`\n👤 Default admin user created:`);
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
      }
    } else {
      log.info('ℹ️ Admin user already exists', LogContext.SECURITY);
    }
  } catch (error) {
    log.warn('⚠️ Failed to create admin user', LogContext.SECURITY, { error });
  }
}

/**
 * Create API keys for common AI services
 */
async function createServiceApiKeys(supabase: any) {
  try {
    const serviceKeys = [
      {
        service_name: 'openai',
        description: 'OpenAI API for GPT models',
        is_active: false, // Disabled by default
      },
      {
        service_name: 'anthropic',
        description: 'Anthropic API for Claude models',
        is_active: false,
      },
      {
        service_name: 'google_ai',
        description: 'Google AI API for Gemini models',
        is_active: false,
      },
    ];

    for (const service of serviceKeys) {
      const { data: existing } = await supabase
        .from('ai_service_keys')
        .select('id')
        .eq('service_name', service.service_name)
        .single();

      if (!existing) {
        const { error } = await supabase
          .from('ai_service_keys')
          .insert({
            service_name: service.service_name,
            api_key: null, // To be set manually
            is_active: service.is_active,
            rate_limit: 100,
            rate_window: 60,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
              description: service.description,
              requires_manual_setup: true,
            },
          });

        if (error) {
          log.error(`Failed to create ${service.service_name} API key entry`, LogContext.SECURITY, { error });
        } else {
          log.info(`✅ Created ${service.service_name} API key placeholder`, LogContext.SECURITY);
        }
      }
    }
  } catch (error) {
    log.warn('⚠️ Failed to create service API keys', LogContext.SECURITY, { error });
  }
}

// Run initialization if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeVaultSecrets();
}

export { initializeVaultSecrets };

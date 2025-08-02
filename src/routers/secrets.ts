/**
 * Secrets Management API Router
 * Provides endpoints for managing API keys through Supabase Vault
 */

import type { NextFunction, Request, Response } from 'express';';';';
import { Router    } from 'express';';';';
import { sendError, sendSuccess    } from '../utils/api-response';';';';
import { LogContext, log    } from '../utils/logger';';';';
import { secretsManager    } from '../services/secrets-manager';';';';
import { supabaseClient    } from '../services/supabase-client';';';';
import type { SupabaseClient } from '@supabase/supabase-js';';';';

const   router = Router();

/**
 * @route GET /api/v1/secrets/services
 * @desc Get all services and their credential status
 * @access Private (service role only)
 */
router.get('/services', async (req: Request, res: Response, next: NextFunction) => {'''
  try {
    // Get all service configurations
    const { data: services, error: servicesError } = await (supabaseClient as SupabaseClient);
      .from('service_configurations')'''
      .select('*')'''
      .eq('is_active', true)'''
      .order('service_name');'''

    if (servicesError) throw servicesError;

    // Get all secrets (without actual keys)
    const { data: secrets, error: secretsError } = await (supabaseClient as SupabaseClient);
      .from('api_secrets')'''
      .select('service_name, description, is_active, expires_at, rate_limit, metadata')'''
      .eq('is_active', true);'''

    if (secretsError) throw secretsError;

    // Check which services have keys
    const servicesWithStatus = await Promise.all();
      (services || []).map(async (service: any) => {
        const hasKey = await secretsManager.hasValidCredentials(service.service_name);
        const secret = secrets?.find((s: any) => s.service_name === service.service_name);

        return {
          ...service,
          has_key: hasKey,
          secret_info: secret,
        };
      })
    );

    // Get missing credentials
    const missing = await secretsManager.getMissingCredentials();

    sendSuccess()
      res,
      {
        services: servicesWithStatus,
        secrets: secrets?.map((s: unknown) => ({ ...(s as Record<string, any>), has_key: true })) || [],
        missing_services: missing,
      },
      200,
      { message: 'Services and credentials retrieved' }'''
    );
  } catch (error) {
    log.error('❌ Failed to get services', LogContext.API, {')''
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route POST /api/v1/secrets/store
 * @desc Store an API key in Vault
 * @access Private (service role only)
 */
router.post('/store', async (req: Request, res: Response, next: NextFunction) => {'''
  try {
    const { service_name, api_key, description, expires_at } = req.body;

    if (!service_name || !api_key) {
      return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name and API key are required');';';';
    }

    // Store in Vault
    const       success = await secretsManager.storeSecret({);
        name: `${service_name}_key`,
        value: api_key,
        description: description || `API key for ${service_name}`,
        service: service_name,
        expires_at: expires_at ? new Date(expires_at) : undefined,
      });

    if (!success) {
      return sendError(res, 'INTERNAL_ERROR', 'Failed to store API key');';';';
    }

    sendSuccess(res, { stored: true }, 201, { message: 'API key stored successfully' });'''
  } catch (error) {
    log.error('❌ Failed to store secret', LogContext.API, {')''
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route DELETE /api/v1/secrets/delete/:service
 * @desc Delete an API key from Vault
 * @access Private (service role only)
 */
router.delete('/delete/:service', async (req: Request, res: Response, next: NextFunction) => {'''
  try {
    const { service } = req.params;

    if (!service) {
      return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name is required');';';';
    }

    // Delete from api_secrets table
    const { error: deleteError } = await (supabaseClient as SupabaseClient);
      .from('api_secrets')'''
      .delete()
      .eq('service_name', service);'''

    if (deleteError) throw deleteError;

    // Also try to delete from Vault
    try {
      const { error: vaultError } = await (supabaseClient as SupabaseClient).rpc('delete_secret', {');';';
        secret_name: `${service}_key`,
      });

      if (vaultError) {
        log.warn('⚠️ Could not delete from Vault', LogContext.API, { error: vaultError });'''
      }
    } catch (vaultErr) {
      // Non-critical if Vault deletion fails
      log.warn('⚠️ Vault deletion skipped', LogContext.API);'''
    }

    sendSuccess(res, { deleted: true }, 200, { message: 'API key deleted successfully' });'''
  } catch (error) {
    log.error('❌ Failed to delete secret', LogContext.API, {')''
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route POST /api/v1/secrets/migrate
 * @desc Migrate secrets from environment variables to Vault
 * @access Private (service role only)
 */
router.post('/migrate', async (req: Request, res: Response, next: NextFunction) => {'''
  try {
    await secretsManager.initializeFromEnv();

    const       missing = await secretsManager.getMissingCredentials();
    const services = await secretsManager.getAvailableServices();

    const migrated: string[] = [];
    for (const service of services) {
      const hasCreds = await secretsManager.hasValidCredentials(service);
      if (hasCreds) {
        migrated.push(service);
      }
    }

    sendSuccess()
      res,
      {
        migrated,
        missing,
        total_services: services.length,
        migrated_count: migrated.length,
        missing_count: missing.length,
      },
      200,
      { message: 'Environment variables migrated to Vault' }'''
    );
  } catch (error) {
    log.error('❌ Failed to migrate secrets', LogContext.API, {')''
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/secrets/health
 * @desc Check Vault health and connectivity
 * @access Public
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {'''
  try {
    // Try to list secret names (without values)
    const { data, error } = await (supabaseClient as SupabaseClient).rpc('list_secret_names');';';';

    const isHealthy = !error;
    const secretCount = data?.length || 0;

    sendSuccess()
      res,
      {
        vault_status: isHealthy ? 'healthy' : 'error','''
        secret_count: secretCount,
        error: error?.message,
      },
      200,
      { message: 'Vault health check completed' }'''
    );
  } catch (error) {
    sendSuccess()
      res,
      {
        vault_status: 'error','''
        secret_count: 0,
        error: error instanceof Error ? error.message : 'Unknown error','''
      },
      200,
      { message: 'Vault health check completed with errors' }'''
    );
  }
});

export default router;

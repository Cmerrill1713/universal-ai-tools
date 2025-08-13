/**
 * Secrets Management API Router
 * Provides endpoints for managing API keys through Supabase Vault
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';

import { secretsManager } from '../services/secrets-manager';
import { getSupabaseClient } from '../services/supabase-client';
import { sendError, sendSuccess } from '../utils/api-response';
import { log,LogContext } from '../utils/logger';

const router = Router();

/**
 * @route GET /api/v1/secrets/services
 * @desc Get all services and their credential status
 * @access Private (service role only)
 */
router.get('/services', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all service configurations
    const supabase = getSupabaseClient() as SupabaseClient | null;
    if (!supabase) return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
    const { data: services, error: servicesError } = await supabase
      .from('service_configurations')
      .select('*')
      .eq('is_active', true)
      .order('service_name');

    if (servicesError) throw servicesError;

    // Get all secrets (without actual keys)
    const supabase2 = getSupabaseClient() as SupabaseClient | null;
    if (!supabase2) return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
    const { data: secrets, error: secretsError } = await supabase2
      .from('api_secrets')
      .select('service_name, description, is_active, expires_at, rate_limit, metadata')
      .eq('is_active', true);

    if (secretsError) throw secretsError;

    // Check which services have keys
    const servicesWithStatus = await Promise.all(
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

    sendSuccess(
      res,
      {
        services: servicesWithStatus,
        secrets:
          secrets?.map((s: unknown) => ({ ...(s as Record<string, any>), has_key: true })) || [],
        missing_services: missing,
      },
      200,
      { message: 'Services and credentials retrieved' }
    );
  } catch (error) {
    log.error('❌ Failed to get services', LogContext.API, {
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
router.post('/store', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service_name, api_key, description, expires_at } = req.body;

    if (!service_name || !api_key) {
      return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name and API key are required');
    }

    // Store in Vault
    const success = await secretsManager.storeSecret({
      name: `${service_name}_key`,
      value: api_key,
      description: description || `API key for ${service_name}`,
      service: service_name,
      expires_at: expires_at ? new Date(expires_at) : undefined,
    });

    if (!success) {
      return sendError(res, 'INTERNAL_ERROR', 'Failed to store API key');
    }

    sendSuccess(res, { stored: true }, 201, { message: 'API key stored successfully' });
  } catch (error) {
    log.error('❌ Failed to store secret', LogContext.API, {
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
router.delete('/delete/:service', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service } = req.params;

    if (!service) {
      return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name is required');
    }

    // Delete from api_secrets table
    const supabase3 = getSupabaseClient() as SupabaseClient | null;
    if (!supabase3) return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
    const { error: deleteError } = await supabase3
      .from('api_secrets')
      .delete()
      .eq('service_name', service);

    if (deleteError) throw deleteError;

    // Also try to delete from Vault
    try {
      const supabase4 = getSupabaseClient() as SupabaseClient | null;
      if (!supabase4) return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
      const { error: vaultError } = await supabase4.rpc('delete_secret', {
        secret_name: `${service}_key`,
      });

      if (vaultError) {
        log.warn('⚠️ Could not delete from Vault', LogContext.API, { error: vaultError });
      }
    } catch (vaultErr) {
      // Non-critical if Vault deletion fails
      log.warn('⚠️ Vault deletion skipped', LogContext.API);
    }

    sendSuccess(res, { deleted: true }, 200, { message: 'API key deleted successfully' });
  } catch (error) {
    log.error('❌ Failed to delete secret', LogContext.API, {
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
router.post('/migrate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await secretsManager.initializeFromEnv();

    const missing = await secretsManager.getMissingCredentials();
    const services = await secretsManager.getAvailableServices();

    const migrated: string[] = [];
    for (const service of services) {
      const hasCreds = await secretsManager.hasValidCredentials(service);
      if (hasCreds) {
        migrated.push(service);
      }
    }

    sendSuccess(
      res,
      {
        migrated,
        missing,
        total_services: services.length,
        migrated_count: migrated.length,
        missing_count: missing.length,
      },
      200,
      { message: 'Environment variables migrated to Vault' }
    );
  } catch (error) {
    log.error('❌ Failed to migrate secrets', LogContext.API, {
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
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to list secret names (without values)
    const supabase5 = getSupabaseClient() as SupabaseClient | null;
    if (!supabase5) return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
    const { data, error } = await supabase5.rpc('list_secret_names');

    const isHealthy = !error;
    const secretCount = data?.length || 0;

    sendSuccess(
      res,
      {
        vault_status: isHealthy ? 'healthy' : 'error',
        secret_count: secretCount,
        error: error?.message,
      },
      200,
      { message: 'Vault health check completed' }
    );
  } catch (error) {
    sendSuccess(
      res,
      {
        vault_status: 'error',
        secret_count: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      200,
      { message: 'Vault health check completed with errors' }
    );
  }
});

// MARK: - macOS Client Endpoints

/**
 * @route POST /api/v1/secrets/get
 * @desc Get a specific API key for macOS client
 * @access Private (device token required)
 */
router.post('/get', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service } = req.body;
    const deviceToken = req.headers['x-device-token'] as string;

    if (!service) {
      return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name is required');
    }

    if (!deviceToken) {
      return sendError(res, 'UNAUTHORIZED', 'Device token required');
    }

    // Validate device token (simplified for now)
    // In production, you'd verify the device token against stored device credentials
    if (!deviceToken.startsWith('device_') && !deviceToken.includes('-')) {
      return sendError(res, 'UNAUTHORIZED', 'Invalid device token');
    }

    // Get the API key
    const apiKey = await secretsManager.getApiKey(service);
    
    if (!apiKey) {
      return sendError(res, 'NOT_FOUND', `No API key found for service: ${service}`);
    }

    // Audit log the access
    log.info(`🔑 API key accessed for ${service}`, LogContext.API, {
      device_token: deviceToken.substring(0, 12) + '...',
      service,
    });

    sendSuccess(res, { 
      key: apiKey,
      service,
      retrieved_at: new Date().toISOString()
    }, 200, { message: 'API key retrieved successfully' });

  } catch (error) {
    log.error('❌ Failed to get API key for client', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route POST /api/v1/secrets/store
 * @desc Store an API key from macOS client
 * @access Private (device token required)
 */
router.post('/client/store', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service, key, description, device_id } = req.body;
    const deviceToken = req.headers['x-device-token'] as string;

    if (!service || !key) {
      return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name and key are required');
    }

    if (!deviceToken) {
      return sendError(res, 'UNAUTHORIZED', 'Device token required');
    }

    // Store in Vault with device tracking
    const success = await secretsManager.storeSecret({
      name: `${service}_key`,
      value: key,
      description: description || `API key for ${service} (from macOS client)`,
      service: service,
    });

    if (!success) {
      return sendError(res, 'INTERNAL_ERROR', 'Failed to store API key');
    }

    // Audit log the storage
    log.info(`📝 API key stored for ${service}`, LogContext.API, {
      device_token: deviceToken.substring(0, 12) + '...',
      device_id: device_id?.substring(0, 8) + '...',
      service,
    });

    sendSuccess(res, { 
      stored: true,
      service,
      stored_at: new Date().toISOString()
    }, 201, { message: 'API key stored successfully' });

  } catch (error) {
    log.error('❌ Failed to store API key from client', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route DELETE /api/v1/secrets/delete
 * @desc Delete an API key from macOS client
 * @access Private (device token required)
 */
router.delete('/client/delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { service } = req.body;
    const deviceToken = req.headers['x-device-token'] as string;

    if (!service) {
      return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name is required');
    }

    if (!deviceToken) {
      return sendError(res, 'UNAUTHORIZED', 'Device token required');
    }

    // Delete from api_secrets table
    const supabase = getSupabaseClient() as SupabaseClient | null;
    if (!supabase) return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
    
    const { error: deleteError } = await supabase
      .from('api_secrets')
      .delete()
      .eq('service_name', service);

    if (deleteError) throw deleteError;

    // Also try to delete from Vault
    try {
      const { error: vaultError } = await supabase.rpc('delete_secret', {
        secret_name: `${service}_key`,
      });

      if (vaultError) {
        log.warn('⚠️ Could not delete from Vault', LogContext.API, { error: vaultError });
      }
    } catch (vaultErr) {
      log.warn('⚠️ Vault deletion skipped', LogContext.API);
    }

    // Audit log the deletion
    log.info(`🗑️ API key deleted for ${service}`, LogContext.API, {
      device_token: deviceToken.substring(0, 12) + '...',
      service,
    });

    sendSuccess(res, { 
      deleted: true,
      service,
      deleted_at: new Date().toISOString()
    }, 200, { message: 'API key deleted successfully' });

  } catch (error) {
    log.error('❌ Failed to delete API key from client', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route POST /api/v1/secrets/sync
 * @desc Sync keys between client and vault
 * @access Private (device token required)
 */
router.post('/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keys, device_id } = req.body;
    const deviceToken = req.headers['x-device-token'] as string;

    if (!deviceToken) {
      return sendError(res, 'UNAUTHORIZED', 'Device token required');
    }

    if (!Array.isArray(keys)) {
      return sendError(res, 'INVALID_INPUT', 'Keys must be an array');
    }

    const syncResults = {
      uploaded: [] as string[],
      downloaded: [] as string[],
      conflicts: [] as string[],
      errors: [] as string[]
    };

    // Process each key in the sync request
    for (const keyData of keys) {
      try {
        const { service, local_key, action } = keyData;
        
        if (!service) {
          syncResults.errors.push(`Missing service name in key data`);
          continue;
        }

        switch (action) {
          case 'upload':
            if (local_key) {
              const success = await secretsManager.storeSecret({
                name: `${service}_key`,
                value: local_key,
                description: `API key for ${service} (synced from macOS)`,
                service: service,
              });
              
              if (success) {
                syncResults.uploaded.push(service);
              } else {
                syncResults.errors.push(`Failed to upload key for ${service}`);
              }
            }
            break;

          case 'download':
            const vaultKey = await secretsManager.getApiKey(service);
            if (vaultKey) {
              syncResults.downloaded.push(service);
            } else {
              syncResults.errors.push(`No vault key found for ${service}`);
            }
            break;

          case 'conflict':
            // For now, prefer vault version
            const conflictKey = await secretsManager.getApiKey(service);
            if (conflictKey) {
              syncResults.conflicts.push(service);
            }
            break;
        }
      } catch (error) {
        syncResults.errors.push(`Error processing ${keyData.service}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Audit log the sync
    log.info(`🔄 Key sync completed`, LogContext.API, {
      device_token: deviceToken.substring(0, 12) + '...',
      device_id: device_id?.substring(0, 8) + '...',
      uploaded: syncResults.uploaded.length,
      downloaded: syncResults.downloaded.length,
      conflicts: syncResults.conflicts.length,
      errors: syncResults.errors.length,
    });

    sendSuccess(res, syncResults, 200, { message: 'Key synchronization completed' });

  } catch (error) {
    log.error('❌ Failed to sync keys', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/secrets/status
 * @desc Get key status for all services
 * @access Private (device token required)
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceToken = req.headers['x-device-token'] as string;

    if (!deviceToken) {
      return sendError(res, 'UNAUTHORIZED', 'Device token required');
    }

    const services = await secretsManager.getAvailableServices();
    const missing = await secretsManager.getMissingCredentials();

    const status = await Promise.all(
      services.map(async (service: string) => {
        const hasKey = await secretsManager.hasValidCredentials(service);
        return {
          service,
          has_key: hasKey,
          is_missing: missing.includes(service)
        };
      })
    );

    sendSuccess(res, {
      services: status,
      total_services: services.length,
      configured_services: status.filter(s => s.has_key).length,
      missing_services: missing.length,
      last_updated: new Date().toISOString()
    }, 200, { message: 'Service status retrieved' });

  } catch (error) {
    log.error('❌ Failed to get service status', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

export default router;

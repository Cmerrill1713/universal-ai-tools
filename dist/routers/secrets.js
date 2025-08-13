import { Router } from 'express';
import { secretsManager } from '../services/secrets-manager';
import { getSupabaseClient } from '../services/supabase-client';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
const router = Router();
router.get('/services', async (req, res, next) => {
    try {
        const supabase = getSupabaseClient();
        if (!supabase)
            return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
        const { data: services, error: servicesError } = await supabase
            .from('service_configurations')
            .select('*')
            .eq('is_active', true)
            .order('service_name');
        if (servicesError)
            throw servicesError;
        const supabase2 = getSupabaseClient();
        if (!supabase2)
            return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
        const { data: secrets, error: secretsError } = await supabase2
            .from('api_secrets')
            .select('service_name, description, is_active, expires_at, rate_limit, metadata')
            .eq('is_active', true);
        if (secretsError)
            throw secretsError;
        const servicesWithStatus = await Promise.all((services || []).map(async (service) => {
            const hasKey = await secretsManager.hasValidCredentials(service.service_name);
            const secret = secrets?.find((s) => s.service_name === service.service_name);
            return {
                ...service,
                has_key: hasKey,
                secret_info: secret,
            };
        }));
        const missing = await secretsManager.getMissingCredentials();
        sendSuccess(res, {
            services: servicesWithStatus,
            secrets: secrets?.map((s) => ({ ...s, has_key: true })) || [],
            missing_services: missing,
        }, 200, { message: 'Services and credentials retrieved' });
    }
    catch (error) {
        log.error('❌ Failed to get services', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.post('/store', async (req, res, next) => {
    try {
        const { service_name, api_key, description, expires_at } = req.body;
        if (!service_name || !api_key) {
            return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name and API key are required');
        }
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
    }
    catch (error) {
        log.error('❌ Failed to store secret', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.delete('/delete/:service', async (req, res, next) => {
    try {
        const { service } = req.params;
        if (!service) {
            return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name is required');
        }
        const supabase3 = getSupabaseClient();
        if (!supabase3)
            return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
        const { error: deleteError } = await supabase3
            .from('api_secrets')
            .delete()
            .eq('service_name', service);
        if (deleteError)
            throw deleteError;
        try {
            const supabase4 = getSupabaseClient();
            if (!supabase4)
                return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
            const { error: vaultError } = await supabase4.rpc('delete_secret', {
                secret_name: `${service}_key`,
            });
            if (vaultError) {
                log.warn('⚠️ Could not delete from Vault', LogContext.API, { error: vaultError });
            }
        }
        catch (vaultErr) {
            log.warn('⚠️ Vault deletion skipped', LogContext.API);
        }
        sendSuccess(res, { deleted: true }, 200, { message: 'API key deleted successfully' });
    }
    catch (error) {
        log.error('❌ Failed to delete secret', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.post('/migrate', async (req, res, next) => {
    try {
        await secretsManager.initializeFromEnv();
        const missing = await secretsManager.getMissingCredentials();
        const services = await secretsManager.getAvailableServices();
        const migrated = [];
        for (const service of services) {
            const hasCreds = await secretsManager.hasValidCredentials(service);
            if (hasCreds) {
                migrated.push(service);
            }
        }
        sendSuccess(res, {
            migrated,
            missing,
            total_services: services.length,
            migrated_count: migrated.length,
            missing_count: missing.length,
        }, 200, { message: 'Environment variables migrated to Vault' });
    }
    catch (error) {
        log.error('❌ Failed to migrate secrets', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/health', async (req, res, next) => {
    try {
        const supabase5 = getSupabaseClient();
        if (!supabase5)
            return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
        const { data, error } = await supabase5.rpc('list_secret_names');
        const isHealthy = !error;
        const secretCount = data?.length || 0;
        sendSuccess(res, {
            vault_status: isHealthy ? 'healthy' : 'error',
            secret_count: secretCount,
            error: error?.message,
        }, 200, { message: 'Vault health check completed' });
    }
    catch (error) {
        sendSuccess(res, {
            vault_status: 'error',
            secret_count: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, 200, { message: 'Vault health check completed with errors' });
    }
});
router.post('/get', async (req, res, next) => {
    try {
        const { service } = req.body;
        const deviceToken = req.headers['x-device-token'];
        if (!service) {
            return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name is required');
        }
        if (!deviceToken) {
            return sendError(res, 'UNAUTHORIZED', 'Device token required');
        }
        if (!deviceToken.startsWith('device_') && !deviceToken.includes('-')) {
            return sendError(res, 'UNAUTHORIZED', 'Invalid device token');
        }
        const apiKey = await secretsManager.getApiKey(service);
        if (!apiKey) {
            return sendError(res, 'NOT_FOUND', `No API key found for service: ${service}`);
        }
        log.info(`🔑 API key accessed for ${service}`, LogContext.API, {
            device_token: deviceToken.substring(0, 12) + '...',
            service,
        });
        sendSuccess(res, {
            key: apiKey,
            service,
            retrieved_at: new Date().toISOString()
        }, 200, { message: 'API key retrieved successfully' });
    }
    catch (error) {
        log.error('❌ Failed to get API key for client', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.post('/client/store', async (req, res, next) => {
    try {
        const { service, key, description, device_id } = req.body;
        const deviceToken = req.headers['x-device-token'];
        if (!service || !key) {
            return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name and key are required');
        }
        if (!deviceToken) {
            return sendError(res, 'UNAUTHORIZED', 'Device token required');
        }
        const success = await secretsManager.storeSecret({
            name: `${service}_key`,
            value: key,
            description: description || `API key for ${service} (from macOS client)`,
            service: service,
        });
        if (!success) {
            return sendError(res, 'INTERNAL_ERROR', 'Failed to store API key');
        }
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
    }
    catch (error) {
        log.error('❌ Failed to store API key from client', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.delete('/client/delete', async (req, res, next) => {
    try {
        const { service } = req.body;
        const deviceToken = req.headers['x-device-token'];
        if (!service) {
            return sendError(res, 'MISSING_REQUIRED_FIELD', 'Service name is required');
        }
        if (!deviceToken) {
            return sendError(res, 'UNAUTHORIZED', 'Device token required');
        }
        const supabase = getSupabaseClient();
        if (!supabase)
            return sendError(res, 'INTERNAL_ERROR', 'Database unavailable', 503);
        const { error: deleteError } = await supabase
            .from('api_secrets')
            .delete()
            .eq('service_name', service);
        if (deleteError)
            throw deleteError;
        try {
            const { error: vaultError } = await supabase.rpc('delete_secret', {
                secret_name: `${service}_key`,
            });
            if (vaultError) {
                log.warn('⚠️ Could not delete from Vault', LogContext.API, { error: vaultError });
            }
        }
        catch (vaultErr) {
            log.warn('⚠️ Vault deletion skipped', LogContext.API);
        }
        log.info(`🗑️ API key deleted for ${service}`, LogContext.API, {
            device_token: deviceToken.substring(0, 12) + '...',
            service,
        });
        sendSuccess(res, {
            deleted: true,
            service,
            deleted_at: new Date().toISOString()
        }, 200, { message: 'API key deleted successfully' });
    }
    catch (error) {
        log.error('❌ Failed to delete API key from client', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.post('/sync', async (req, res, next) => {
    try {
        const { keys, device_id } = req.body;
        const deviceToken = req.headers['x-device-token'];
        if (!deviceToken) {
            return sendError(res, 'UNAUTHORIZED', 'Device token required');
        }
        if (!Array.isArray(keys)) {
            return sendError(res, 'INVALID_INPUT', 'Keys must be an array');
        }
        const syncResults = {
            uploaded: [],
            downloaded: [],
            conflicts: [],
            errors: []
        };
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
                            }
                            else {
                                syncResults.errors.push(`Failed to upload key for ${service}`);
                            }
                        }
                        break;
                    case 'download':
                        const vaultKey = await secretsManager.getApiKey(service);
                        if (vaultKey) {
                            syncResults.downloaded.push(service);
                        }
                        else {
                            syncResults.errors.push(`No vault key found for ${service}`);
                        }
                        break;
                    case 'conflict':
                        const conflictKey = await secretsManager.getApiKey(service);
                        if (conflictKey) {
                            syncResults.conflicts.push(service);
                        }
                        break;
                }
            }
            catch (error) {
                syncResults.errors.push(`Error processing ${keyData.service}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        log.info(`🔄 Key sync completed`, LogContext.API, {
            device_token: deviceToken.substring(0, 12) + '...',
            device_id: device_id?.substring(0, 8) + '...',
            uploaded: syncResults.uploaded.length,
            downloaded: syncResults.downloaded.length,
            conflicts: syncResults.conflicts.length,
            errors: syncResults.errors.length,
        });
        sendSuccess(res, syncResults, 200, { message: 'Key synchronization completed' });
    }
    catch (error) {
        log.error('❌ Failed to sync keys', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/status', async (req, res, next) => {
    try {
        const deviceToken = req.headers['x-device-token'];
        if (!deviceToken) {
            return sendError(res, 'UNAUTHORIZED', 'Device token required');
        }
        const services = await secretsManager.getAvailableServices();
        const missing = await secretsManager.getMissingCredentials();
        const status = await Promise.all(services.map(async (service) => {
            const hasKey = await secretsManager.hasValidCredentials(service);
            return {
                service,
                has_key: hasKey,
                is_missing: missing.includes(service)
            };
        }));
        sendSuccess(res, {
            services: status,
            total_services: services.length,
            configured_services: status.filter(s => s.has_key).length,
            missing_services: missing.length,
            last_updated: new Date().toISOString()
        }, 200, { message: 'Service status retrieved' });
    }
    catch (error) {
        log.error('❌ Failed to get service status', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
export default router;
//# sourceMappingURL=secrets.js.map
import { Router } from 'express';
import externalAPIManager from '../services/external-api-manager.js';
import { log, LogContext } from '../utils/logger.js';
const router = Router();
router.get('/', async (req, res) => {
    try {
        const apis = externalAPIManager.getAPIs();
        log.info('External APIs listed', LogContext.API, {
            count: apis.length,
        });
        res.json({
            success: true,
            data: apis,
            count: apis.length,
        });
    }
    catch (error) {
        log.error('Failed to list external APIs', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to list external APIs',
        });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const api = externalAPIManager.getAPI(id);
        if (!api) {
            return res.status(404).json({
                success: false,
                error: `API with ID '${id}' not found`,
            });
        }
        const rateLimitStatus = externalAPIManager.getRateLimitStatus(id);
        const requestHistory = externalAPIManager.getRequestHistory(id);
        return res.json({
            success: true,
            data: {
                ...api,
                rateLimitStatus,
                requestHistory: requestHistory.length,
            },
        });
    }
    catch (error) {
        log.error('Failed to get external API', LogContext.API, {
            apiId: req.params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to get external API',
        });
    }
});
router.post('/', async (req, res) => {
    try {
        const config = req.body;
        if (!config.id || !config.name || !config.baseUrl) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: id, name, baseUrl',
            });
        }
        const success = await externalAPIManager.registerAPI(config);
        if (success) {
            log.info('External API registered successfully', LogContext.API, {
                apiId: config.id,
                name: config.name,
            });
            return res.status(201).json({
                success: true,
                message: 'API registered successfully',
                data: { id: config.id },
            });
        }
        else {
            return res.status(400).json({
                success: false,
                error: 'Failed to register API',
            });
        }
    }
    catch (error) {
        log.error('Failed to register external API', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to register external API',
        });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const success = await externalAPIManager.updateAPI(id, updates);
        if (success) {
            log.info('External API updated', LogContext.API, {
                apiId: id,
            });
            res.json({
                success: true,
                message: 'API updated successfully',
            });
        }
        else {
            res.status(404).json({
                success: false,
                error: `API with ID '${id}' not found`,
            });
        }
    }
    catch (error) {
        log.error('Failed to update external API', LogContext.API, {
            apiId: req.params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update external API',
        });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = externalAPIManager.removeAPI(id);
        if (success) {
            log.info('External API removed', LogContext.API, {
                apiId: id,
            });
            res.json({
                success: true,
                message: 'API removed successfully',
            });
        }
        else {
            res.status(404).json({
                success: false,
                error: `API with ID '${id}' not found`,
            });
        }
    }
    catch (error) {
        log.error('Failed to remove external API', LogContext.API, {
            apiId: req.params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to remove external API',
        });
    }
});
router.post('/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'enabled field must be a boolean',
            });
        }
        const success = await externalAPIManager.toggleAPI(id, enabled);
        if (success) {
            log.info('External API toggled', LogContext.API, {
                apiId: id,
                enabled,
            });
            return res.json({
                success: true,
                message: `API ${enabled ? 'enabled' : 'disabled'} successfully`,
            });
        }
        else {
            return res.status(404).json({
                success: false,
                error: `API with ID '${id}' not found`,
            });
        }
    }
    catch (error) {
        log.error('Failed to toggle external API', LogContext.API, {
            apiId: req.params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to toggle external API',
        });
    }
});
router.post('/:id/request', async (req, res) => {
    try {
        const { id } = req.params;
        const { endpoint, method, data, headers } = req.body;
        if (!endpoint || !method) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: endpoint, method',
            });
        }
        if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid method. Must be GET, POST, PUT, or DELETE',
            });
        }
        const response = await externalAPIManager.makeRequest(id, {
            endpoint,
            method,
            data,
            headers,
        });
        return res.status(response.statusCode).json(response);
    }
    catch (error) {
        log.error('Failed to make external API request', LogContext.API, {
            apiId: req.params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to make external API request',
        });
    }
});
router.get('/type/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const apis = externalAPIManager.getAPIsByType(type);
        log.info('External APIs filtered by type', LogContext.API, {
            type,
            count: apis.length,
        });
        res.json({
            success: true,
            data: apis,
            count: apis.length,
            type,
        });
    }
    catch (error) {
        log.error('Failed to get APIs by type', LogContext.API, {
            type: req.params.type,
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get APIs by type',
        });
    }
});
router.get('/capability/:capability', async (req, res) => {
    try {
        const { capability } = req.params;
        const apis = externalAPIManager.getAPIsWithCapability(capability);
        log.info('External APIs filtered by capability', LogContext.API, {
            capability,
            count: apis.length,
        });
        return res.json({
            success: true,
            data: apis,
            count: apis.length,
            capability,
        });
    }
    catch (error) {
        log.error('Failed to get APIs by capability', LogContext.API, {
            capability: req.params.capability,
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to get APIs by capability',
        });
    }
});
router.get('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const api = externalAPIManager.getAPI(id);
        if (!api) {
            return res.status(404).json({
                success: false,
                error: `API with ID '${id}' not found`,
            });
        }
        const rateLimitStatus = externalAPIManager.getRateLimitStatus(id);
        const requestHistory = externalAPIManager.getRequestHistory(id);
        return res.json({
            success: true,
            data: {
                id: api.id,
                name: api.name,
                enabled: api.enabled,
                serviceType: api.serviceType,
                rateLimitStatus,
                requestCount: requestHistory.length,
                lastRequest: requestHistory.length > 0 ? requestHistory[requestHistory.length - 1] : null,
            },
        });
    }
    catch (error) {
        log.error('Failed to get API status', LogContext.API, {
            apiId: req.params.id,
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to get API status',
        });
    }
});
export default router;
//# sourceMappingURL=external-apis.js.map
/**
 * Service Management Router
 * API endpoints for managing backend AI services (MLX, Ollama, LM Studio)
 */

import { Router } from 'express';
import { LogContext, log } from '../utils/logger';
import { backendServiceManager } from '../services/service-manager';
import { config } from '../config/environment';

const router = Router();

/**
 * GET /api/v1/services
 * Get status of all backend services
 */
router.get('/', async (req, res) => {
  try {
    const statuses = backendServiceManager.getAllStatuses();

    res.json({
      success: true,
      data: {
        enabled: config.backendServices.enabled,
        autoStart: config.backendServices.autoStart,
        services: statuses,
        summary: {
          total: statuses.length,
          running: statuses.filter(s => s.status === 'running').length,
          healthy: statuses.filter(s => s.healthStatus === 'healthy').length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get service statuses', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get service statuses',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/v1/services/:serviceName
 * Get status of a specific service
 */
router.get('/:serviceName', async (req, res) => {
  try {
    const { serviceName } = req.params;
    const status = backendServiceManager.getServiceStatus(serviceName);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: `Service '${serviceName}' not found`,
      });
    }

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get service status', LogContext.API, {
      serviceName: req.params.serviceName,
      error,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get service status',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/services/:serviceName/start
 * Start a specific service
 */
router.post('/:serviceName/start', async (req, res) => {
  try {
    const { serviceName } = req.params;

    log.info(`Starting service via API: ${serviceName}`, LogContext.API);

    const success = await backendServiceManager.startService(serviceName);

    if (success) {
      const status = backendServiceManager.getServiceStatus(serviceName);
      res.json({
        success: true,
        message: `Service '${serviceName}' started successfully`,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Failed to start service '${serviceName}'`,
      });
    }
  } catch (error) {
    log.error('Failed to start service via API', LogContext.API, {
      serviceName: req.params.serviceName,
      error,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to start service',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/services/:serviceName/stop
 * Stop a specific service
 */
router.post('/:serviceName/stop', async (req, res) => {
  try {
    const { serviceName } = req.params;

    log.info(`Stopping service via API: ${serviceName}`, LogContext.API);

    await backendServiceManager.stopService(serviceName);

    const status = backendServiceManager.getServiceStatus(serviceName);
    res.json({
      success: true,
      message: `Service '${serviceName}' stopped successfully`,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to stop service via API', LogContext.API, {
      serviceName: req.params.serviceName,
      error,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to stop service',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/services/:serviceName/restart
 * Restart a specific service
 */
router.post('/:serviceName/restart', async (req, res) => {
  try {
    const { serviceName } = req.params;

    log.info(`Restarting service via API: ${serviceName}`, LogContext.API);

    const success = await backendServiceManager.restartService(serviceName);

    if (success) {
      const status = backendServiceManager.getServiceStatus(serviceName);
      res.json({
        success: true,
        message: `Service '${serviceName}' restarted successfully`,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Failed to restart service '${serviceName}'`,
      });
    }
  } catch (error) {
    log.error('Failed to restart service via API', LogContext.API, {
      serviceName: req.params.serviceName,
      error,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to restart service',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/services/start-all
 * Start all configured services
 */
router.post('/start-all', async (req, res) => {
  try {
    log.info('Starting all services via API', LogContext.API);

    await backendServiceManager.startAllServices();

    const statuses = backendServiceManager.getAllStatuses();
    const running = statuses.filter(s => s.status === 'running').length;

    res.json({
      success: true,
      message: `Started ${running}/${statuses.length} services successfully`,
      data: statuses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to start all services via API', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to start all services',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/services/stop-all
 * Stop all running services
 */
router.post('/stop-all', async (req, res) => {
  try {
    log.info('Stopping all services via API', LogContext.API);

    await backendServiceManager.stopAllServices();

    const statuses = backendServiceManager.getAllStatuses();

    res.json({
      success: true,
      message: 'All services stopped successfully',
      data: statuses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to stop all services via API', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to stop all services',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

/**
 * Monitoring Dashboard Router
 * 
 * Provides REST API endpoints for the proactive monitoring system
 * including real-time system health, metrics, alerts, and dashboard data.
 */

import { Router, Request, Response } from 'express';
import { proactiveMonitoringService } from '../services/proactive-monitoring-service';
import { LogContext, log } from '../utils/logger';
import { authenticationMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication to all monitoring endpoints
router.use(authenticationMiddleware);

/**
 * GET /api/v1/monitoring/health
 * Get current system health status
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await proactiveMonitoringService.getSystemHealth();
    
    if (!health) {
      return res.status(503).json({
        success: false,
        error: 'Unable to retrieve system health',
        message: 'Monitoring service unavailable'
      });
    }

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get system health', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve system health'
    });
  }
});

/**
 * GET /api/v1/monitoring/status
 * Get monitoring service status and configuration
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        monitoring_active: proactiveMonitoringService.isMonitoringActive(),
        active_alerts: proactiveMonitoringService.getActiveAlerts().length,
        uptime_hours: Math.round((Date.now() - process.uptime() * 1000) / (1000 * 60 * 60) * 100) / 100,
        version: process.env.npm_package_version || '1.0.0'
      }
    });
  } catch (error) {
    log.error('Failed to get monitoring status', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/monitoring/alerts
 * Get active alerts with optional filtering
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { severity, service, status } = req.query;
    
    let alerts = proactiveMonitoringService.getActiveAlerts();

    // Apply filters
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    if (service) {
      alerts = alerts.filter(alert => alert.service === service);
    }
    if (status) {
      alerts = alerts.filter(alert => alert.status === status);
    }

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
        filters: { severity, service, status }
      }
    });
  } catch (error) {
    log.error('Failed to get alerts', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/monitoring/alerts/:alertId/resolve
 * Resolve an active alert
 */
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const resolved = await proactiveMonitoringService.resolveAlert(alertId);

    if (!resolved) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
        message: `Alert ${alertId} not found or already resolved`
      });
    }

    res.json({
      success: true,
      message: `Alert ${alertId} resolved successfully`
    });
  } catch (error) {
    log.error('Failed to resolve alert', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/monitoring/metrics
 * Get metrics history for a specific service and metric
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { service, metric, hours } = req.query;

    if (!service || !metric) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'service and metric parameters are required'
      });
    }

    const hoursInt = hours ? parseInt(hours as string, 10) : 24;
    const metrics = await proactiveMonitoringService.getMetricsHistory(
      service as string,
      metric as string,
      hoursInt
    );

    res.json({
      success: true,
      data: {
        metrics,
        service,
        metric,
        period_hours: hoursInt,
        total_points: metrics.length
      }
    });
  } catch (error) {
    log.error('Failed to get metrics history', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/v1/monitoring/dashboard
 * Get comprehensive dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const health = await proactiveMonitoringService.getSystemHealth();
    const alerts = proactiveMonitoringService.getActiveAlerts();

    // Get recent metrics for key services
    const systemMetrics = await proactiveMonitoringService.getMetricsHistory('system', 'memory_usage', 1);
    const apiMetrics = await proactiveMonitoringService.getMetricsHistory('api', 'response_time_avg', 1);

    const dashboardData = {
      overview: {
        overall_status: health?.overall || 'unknown',
        services_count: health?.services.length || 0,
        active_alerts: alerts.length,
        critical_alerts: alerts.filter(a => a.severity === 'critical').length,
        uptime_hours: health?.uptime || 0,
        last_check: health?.lastCheck || new Date()
      },
      services: health?.services || [],
      recent_alerts: alerts
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10),
      metrics_summary: {
        system: {
          memory_usage: systemMetrics.length > 0 ? systemMetrics[0].value : null,
          cpu_status: health?.services.find(s => s.name === 'system')?.status || 'unknown'
        },
        api: {
          response_time: apiMetrics.length > 0 ? apiMetrics[0].value : null,
          status: health?.services.find(s => s.name === 'api')?.status || 'unknown'
        }
      },
      alerts_by_severity: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length
      }
    };

    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log.error('Failed to get dashboard data', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/v1/monitoring/start
 * Start the monitoring system
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    if (proactiveMonitoringService.isMonitoringActive()) {
      return res.status(400).json({
        success: false,
        error: 'Monitoring already active',
        message: 'Monitoring system is already running'
      });
    }

    await proactiveMonitoringService.startMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoring system started successfully'
    });
  } catch (error) {
    log.error('Failed to start monitoring', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to start monitoring system'
    });
  }
});

/**
 * POST /api/v1/monitoring/stop
 * Stop the monitoring system
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    if (!proactiveMonitoringService.isMonitoringActive()) {
      return res.status(400).json({
        success: false,
        error: 'Monitoring not active',
        message: 'Monitoring system is not currently running'
      });
    }

    await proactiveMonitoringService.stopMonitoring();
    
    res.json({
      success: true,
      message: 'Monitoring system stopped successfully'
    });
  } catch (error) {
    log.error('Failed to stop monitoring', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to stop monitoring system'
    });
  }
});

/**
 * PUT /api/v1/monitoring/config
 * Update monitoring configuration
 */
router.put('/config', async (req: Request, res: Response) => {
  try {
    const { checkInterval, alertThresholds, alertChannels } = req.body;

    // Validate configuration
    if (checkInterval && (checkInterval < 10000 || checkInterval > 300000)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration',
        message: 'checkInterval must be between 10s and 5 minutes'
      });
    }

    const configUpdate: any = {};
    if (checkInterval !== undefined) configUpdate.checkInterval = checkInterval;
    if (alertThresholds) configUpdate.alertThresholds = alertThresholds;
    if (alertChannels) configUpdate.alertChannels = alertChannels;

    proactiveMonitoringService.updateConfig(configUpdate);

    res.json({
      success: true,
      message: 'Monitoring configuration updated successfully',
      data: { updated_fields: Object.keys(configUpdate) }
    });
  } catch (error) {
    log.error('Failed to update monitoring config', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

/**
 * GET /api/v1/monitoring/events
 * Server-Sent Events endpoint for real-time monitoring data
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    res.write('data: {"type":"connected","timestamp":"' + new Date().toISOString() + '"}\n\n');

    // Set up event listeners
    const healthUpdateHandler = (health: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'health_update',
        timestamp: new Date().toISOString(),
        data: health
      })}\n\n`);
    };

    const alertHandler = (alert: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'alert_created',
        timestamp: new Date().toISOString(),
        data: alert
      })}\n\n`);
    };

    proactiveMonitoringService.on('health:updated', healthUpdateHandler);
    proactiveMonitoringService.on('alert:created', alertHandler);

    // Clean up on client disconnect
    req.on('close', () => {
      proactiveMonitoringService.off('health:updated', healthUpdateHandler);
      proactiveMonitoringService.off('alert:created', alertHandler);
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })}\n\n`);
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });

  } catch (error) {
    log.error('Failed to set up monitoring events stream', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to establish event stream'
    });
  }
});

export default router;
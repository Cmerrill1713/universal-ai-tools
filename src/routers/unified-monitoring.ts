/**
 * Unified Monitoring API Router
 * Consolidates 12 monitoring services into a single API interface
 *
 * Replaces: health-check.ts, monitoring.ts, monitoring-dashboard.ts,
 * system-metrics.ts, and 8 other monitoring-related routers
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { UnifiedMonitoringService } from '../services/monitoring/unified-monitoring-service';
import { Logger } from '../utils/logger';
import {
  AlertRule,
  DashboardData,
  HealthCheckConfig,
  MetricQuery,
  MonitoringConfig,
  TimeRange,
} from '../services/monitoring/types';

const router = Router();
const logger = new Logger('UnifiedMonitoringRouter');

// Initialize unified monitoring service
const monitoringService = new UnifiedMonitoringService();

// Validation schemas
const MetricQuerySchema = z.object({
  name: z.string().optional(),
  service: z.string().optional(),
  timeRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  labels: z.record(z.string()).optional(),
  limit: z.number().int().min(1).max(10000).default(1000),
  aggregation: z.enum(['avg', 'sum', 'count', 'min', 'max']).optional(),
});

const HealthCheckConfigSchema = z.object({
  service: z.string(),
  type: z.enum(['api', 'database', 'external', 'custom']),
  endpoint: z.string().url().optional(),
  timeout: z.number().int().min(100).max(60000).default(5000),
  interval: z.number().int().min(1000).max(3600000).default(30000),
  retries: z.number().int().min(0).max(10).default(3),
  thresholds: z
    .object({
      responseTime: z.number().int().min(0).optional(),
      errorRate: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  query: z.string().min(1),
  condition: z.enum(['>', '<', '>=', '<=', '==', '!=']),
  threshold: z.number(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  duration: z.number().int().min(0).default(0),
  enabled: z.boolean().default(true),
  channels: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

const DashboardConfigSchema = z.object({
  timeRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  services: z.array(z.string()).optional(),
  includeMetrics: z.boolean().default(true),
  includeHealth: z.boolean().default(true),
  includeAlerts: z.boolean().default(true),
  includeTraces: z.boolean().default(false),
  refreshInterval: z.number().int().min(1000).max(300000).default(30000),
});

/**
 * GET /api/unified-monitoring/status
 * Get monitoring service status and statistics
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await monitoringService.getStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Failed to get monitoring status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/unified-monitoring/start
 * Start the unified monitoring service
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const configSchema = z.object({
      collectors: z.array(z.string()).default(['system', 'service']),
      storage: z.object({
        type: z.enum(['memory', 'redis', 'database']).default('memory'),
        config: z.record(z.any()).optional(),
      }),
      alerting: z.object({
        enabled: z.boolean().default(true),
        channels: z.array(z.string()).default(['console']),
        rules: z.array(AlertRuleSchema).default([]),
      }),
      healthChecks: z.array(HealthCheckConfigSchema).default([]),
      metrics: z.object({
        retention: z.number().int().min(3600).default(86400), // 24 hours
        batchSize: z.number().int().min(1).max(1000).default(100),
      }),
      performance: z.object({
        circuitBreaker: z.boolean().default(true),
        rateLimiting: z.boolean().default(true),
        caching: z.boolean().default(true),
      }),
    });

    const config = configSchema.parse(req.body);
    await monitoringService.initialize(config);
    await monitoringService.start();

    logger.info('Unified monitoring service started successfully');

    res.json({
      success: true,
      message: 'Monitoring service started successfully',
      config: {
        collectors: config.collectors,
        storage: config.storage.type,
        alertingEnabled: config.alerting.enabled,
        healthChecksCount: config.healthChecks.length,
      },
    });
  } catch (error) {
    logger.error('Failed to start monitoring service', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start monitoring service',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/unified-monitoring/stop
 * Stop the unified monitoring service
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    await monitoringService.stop();

    logger.info('Unified monitoring service stopped successfully');

    res.json({
      success: true,
      message: 'Monitoring service stopped successfully',
    });
  } catch (error) {
    logger.error('Failed to stop monitoring service', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop monitoring service',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/unified-monitoring/metrics
 * Query metrics with filtering and aggregation
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const query = MetricQuerySchema.parse(req.query);
    const metrics = await monitoringService.queryMetrics(query);

    res.json({
      success: true,
      data: metrics,
      meta: {
        count: metrics.length,
        query,
      },
    });
  } catch (error) {
    logger.error('Failed to query metrics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/unified-monitoring/metrics
 * Record a custom metric
 */
router.post('/metrics', async (req: Request, res: Response) => {
  try {
    const metricSchema = z.object({
      name: z.string().min(1).max(200),
      type: z.enum(['counter', 'gauge', 'histogram', 'summary']),
      value: z.number(),
      timestamp: z.string().datetime().optional(),
      unit: z.string().max(20).optional(),
      help: z.string().max(500).optional(),
      labels: z.record(z.string()).optional(),
    });

    const metric = metricSchema.parse(req.body);
    metric.timestamp = metric.timestamp || new Date().toISOString();

    monitoringService.recordMetric({
      ...metric,
      timestamp: new Date(metric.timestamp),
    });

    res.json({
      success: true,
      message: 'Metric recorded successfully',
      metric,
    });
  } catch (error) {
    logger.error('Failed to record metric', error);
    res.status(400).json({
      success: false,
      error: 'Failed to record metric',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/unified-monitoring/health
 * Get health check results
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const filters = z
      .object({
        service: z.string().optional(),
        status: z.enum(['healthy', 'degraded', 'unhealthy']).optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
      .parse(req.query);

    const healthChecks = await monitoringService.getHealthChecks(filters);

    // Calculate overall health
    const totalChecks = healthChecks.length;
    const healthyCount = healthChecks.filter(h => h.status === 'healthy').length;
    const degradedCount = healthChecks.filter(h => h.status === 'degraded').length;
    const unhealthyCount = healthChecks.filter(h => h.status === 'unhealthy').length;

    const overallStatus =
      unhealthyCount > 0 ? 'unhealthy' : degradedCount > 0 ? 'degraded' : 'healthy';

    res.json({
      success: true,
      data: healthChecks,
      meta: {
        overall: overallStatus,
        total: totalChecks,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
      },
    });
  } catch (error) {
    logger.error('Failed to get health checks', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health checks',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/unified-monitoring/health/check
 * Trigger a health check for a service
 */
router.post('/health/check', async (req: Request, res: Response) => {
  try {
    const config = HealthCheckConfigSchema.parse(req.body);
    const result = await monitoringService.performHealthCheck(config);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to perform health check', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform health check',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/unified-monitoring/alerts
 * Get alert rules and active alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const filters = z
      .object({
        status: z.enum(['firing', 'resolved']).optional(),
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
        ruleId: z.string().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
      .parse(req.query);

    const alerts = await monitoringService.getAlerts(filters);

    res.json({
      success: true,
      data: alerts,
      meta: {
        count: alerts.length,
        filters,
      },
    });
  } catch (error) {
    logger.error('Failed to get alerts', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/unified-monitoring/alerts/rules
 * Create or update an alert rule
 */
router.post('/alerts/rules', async (req: Request, res: Response) => {
  try {
    const rule = AlertRuleSchema.parse(req.body);
    await monitoringService.upsertAlertRule(rule);

    logger.info(`Alert rule ${rule.id} created/updated successfully`);

    res.json({
      success: true,
      message: 'Alert rule created/updated successfully',
      rule,
    });
  } catch (error) {
    logger.error('Failed to create/update alert rule', error);
    res.status(400).json({
      success: false,
      error: 'Failed to create/update alert rule',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/unified-monitoring/alerts/rules/:ruleId
 * Delete an alert rule
 */
router.delete('/alerts/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;

    if (!ruleId) {
      return res.status(400).json({
        success: false,
        error: 'Rule ID is required',
      });
    }

    await monitoringService.deleteAlertRule(ruleId);

    logger.info(`Alert rule ${ruleId} deleted successfully`);

    res.json({
      success: true,
      message: 'Alert rule deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete alert rule', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert rule',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/unified-monitoring/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy, notes } = z
      .object({
        acknowledgedBy: z.string().min(1).max(100),
        notes: z.string().max(1000).optional(),
      })
      .parse(req.body);

    await monitoringService.acknowledgeAlert(alertId, acknowledgedBy, notes);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
    });
  } catch (error) {
    logger.error('Failed to acknowledge alert', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/unified-monitoring/dashboard
 * Get comprehensive dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const config = DashboardConfigSchema.parse(req.query);
    const dashboardData = await monitoringService.getDashboardData(config);

    res.json({
      success: true,
      data: dashboardData,
      meta: {
        generatedAt: new Date().toISOString(),
        config,
      },
    });
  } catch (error) {
    logger.error('Failed to get dashboard data', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/unified-monitoring/traces
 * Get distributed tracing data
 */
router.get('/traces', async (req: Request, res: Response) => {
  try {
    const filters = z
      .object({
        traceId: z.string().optional(),
        service: z.string().optional(),
        operation: z.string().optional(),
        minDuration: z.number().int().min(0).optional(),
        maxDuration: z.number().int().min(0).optional(),
        timeRange: z
          .object({
            start: z.string().datetime(),
            end: z.string().datetime(),
          })
          .optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      })
      .parse(req.query);

    const traces = await monitoringService.getTraces(filters);

    res.json({
      success: true,
      data: traces,
      meta: {
        count: traces.length,
        filters,
      },
    });
  } catch (error) {
    logger.error('Failed to get traces', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get traces',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/unified-monitoring/services
 * Get monitored services overview
 */
router.get('/services', async (req: Request, res: Response) => {
  try {
    const services = await monitoringService.getServices();

    res.json({
      success: true,
      data: services,
      meta: {
        count: services.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get services', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get services',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/unified-monitoring/test
 * Test monitoring system components
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const testConfig = z
      .object({
        components: z
          .array(z.enum(['storage', 'collectors', 'alerts', 'health']))
          .default(['storage']),
        includePerformance: z.boolean().default(false),
      })
      .parse(req.body);

    const results = await monitoringService.runTests(testConfig);

    res.json({
      success: true,
      data: results,
      message: 'Tests completed successfully',
    });
  } catch (error) {
    logger.error('Failed to run monitoring tests', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run monitoring tests',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

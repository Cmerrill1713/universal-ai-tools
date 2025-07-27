/**
 * Health Monitoring Router
 * Provides health and performance metrics for frontend monitoring
 */

import { Router, type Request, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
import { apiResponseMiddleware, sendError, sendSuccess } from '../utils/api-response';
import type { ErrorCode, HealthCheckResponse, ServiceHealth, SystemMetrics } from '../types';

export function HealthRouter(supabase: SupabaseClient) {
  const router = Router();

  // Apply API response middleware
  router.use(apiResponseMiddleware);

  /**
   * GET /health
   * Basic health check endpoint
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();

      // Check database connectivity
      const { data: dbTest, error: dbError } = await supabase
        .from('ai_service_keys')
        .select('count')
        .limit(1);

      const dbHealthy = !dbError && Array.isArray(dbTest);
      
      // Check memory usage
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Basic system metrics
      const systemMetrics: SystemMetrics = {
        uptime: process.uptime(),
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        responseTime: Date.now() - startTime,
      };

      // Service health checks
      const services: Record<string, ServiceHealth> = {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - startTime,
          error: dbError?.message,
        },
        memory: {
          status: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 ? 'healthy' : 'degraded',
          responseTime: 0,
        },
        system: {
          status: 'healthy',
          responseTime: Date.now() - startTime,
        },
      };

      const overallStatus = Object.values(services).every(service => 
        service.status === 'healthy'
      ) ? 'healthy' : 'degraded';

      const healthResponse: HealthCheckResponse = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services,
        metrics: systemMetrics,
      };

      logger.info('Health check completed', LogContext.SYSTEM, {
        status: overallStatus,
        responseTime: systemMetrics.responseTime,
      });

      sendSuccess(res, healthResponse);
    } catch (error: any) {
      logger.error('Health check failed', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      sendError(
        res,
        'HEALTH_CHECK_ERROR' as ErrorCode,
        'Health check failed',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  /**
   * GET /health/detailed
   * Comprehensive health check with detailed metrics
   */
  router.get('/detailed', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();

      // Database connection test
      const { data: dbTest, error: dbError } = await supabase
        .from('ai_service_keys')
        .select('count')
        .limit(1);

      // Memory system test
      const { data: memoryTest, error: memoryError } = await supabase
        .from('ai_memories')
        .select('count')
        .limit(1);

      // Agent registry test
      const { data: agentTest, error: agentError } = await supabase
        .from('ai_orchestration_logs')
        .select('count')
        .limit(1);

      const services: Record<string, ServiceHealth> = {
        database: {
          status: !dbError ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - startTime,
          error: dbError?.message,
          details: {
            connected: !dbError,
            tableAccessible: !dbError && Array.isArray(dbTest),
          },
        },
        memorySystem: {
          status: !memoryError ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - startTime,
          error: memoryError?.message,
          details: {
            tableAccessible: !memoryError && Array.isArray(memoryTest),
          },
        },
        agentRegistry: {
          status: !agentError ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - startTime,
          error: agentError?.message,
          details: {
            tableAccessible: !agentError && Array.isArray(agentTest),
          },
        },
      };

      // System metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const systemMetrics: SystemMetrics = {
        uptime: process.uptime(),
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        responseTime: Date.now() - startTime,
      };

      const overallStatus = Object.values(services).every(service => 
        service.status === 'healthy'
      ) ? 'healthy' : 'degraded';

      const healthResponse: HealthCheckResponse = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services,
        metrics: systemMetrics,
      };

      logger.info('Detailed health check completed', LogContext.SYSTEM, {
        status: overallStatus,
        responseTime: systemMetrics.responseTime,
        servicesChecked: Object.keys(services).length,
      });

      sendSuccess(res, healthResponse);
    } catch (error: any) {
      logger.error('Detailed health check failed', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      sendError(
        res,
        'HEALTH_CHECK_ERROR' as ErrorCode,
        'Detailed health check failed',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  /**
   * GET /health/metrics
   * System performance metrics only
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      const systemMetrics: SystemMetrics = {
        uptime: process.uptime(),
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        responseTime: 0,
      };

      sendSuccess(res, {
        timestamp: new Date().toISOString(),
        metrics: systemMetrics,
      });
    } catch (error: any) {
      logger.error('Metrics collection failed', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
      sendError(
        res,
        'METRICS_ERROR' as ErrorCode,
        'Failed to collect metrics',
        500,
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  /**
   * GET /health/status
   * Simple status endpoint for load balancers
   */
  router.get('/status', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  return router;
}
/**
 * Health Monitoring Router
 * Provides health and performance metrics for frontend monitoring
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
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

      // Check basic system health
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();

      // Test database connectivity
      const dbHealthy = await checkDatabaseHealth(supabase);

      const responseTime = Date.now() - startTime;

      const health: HealthCheckResponse = {
        status: dbHealthy ? 'healthy' : 'degraded',
        version: '1.0.0',
        uptime,
        services: {
          database: dbHealthy,
          memory: getMemoryHealth(memUsage),
          api: { status: 'healthy', responseTime, lastCheck: new Date().toISOString() },
        },
        metrics: {
          memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
          cpuUsage: 0, // Would need a CPU monitoring library for real implementation
          activeConnections: 0, // Would track WebSocket connections
          requestsPerMinute: 0, // Would need _requestcounting middleware
        },
      };

      sendSuccess(res, health);
    } catch (_error any) {
      logger.error'Health check failed', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      sendError(
        res,
        'INTERNAL_SERVER_ERROR' as ErrorCode,
        'Health check failed',
        500,
        _errorinstanceof Error ? _errormessage : String(_error
      );
    }
  });

  /**
   * GET /health/detailed
   * Detailed health and performance metrics
   */
  router.get('/detailed', async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();

      // System metrics
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      // Service health checks
      const [dbHealth, agentCoordinatorHealth] = await Promise.all([
        checkDatabaseHealth(supabase),
        checkAgentCoordinatorHealth(),
      ]);

      const responseTime = Date.now() - startTime;

      const detailedHealth = {
        status:
          dbHealth.status === 'healthy' && agentCoordinatorHealth.status === 'healthy'
            ? 'healthy'
            : 'degraded',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth,
          agentCoordinator: agentCoordinatorHealth,
          api: {
            status: 'healthy' as const,
            responseTime,
            lastCheck: new Date().toISOString(),
          },
        },
        system: {
          memory: {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
            // Note: Getting actual CPU % would require more complex monitoring
            usage: 0,
          },
          process: {
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            arch: process.arch,
          },
        },
        metrics: {
          memoryUsage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
          cpuUsage: 0,
          activeConnections: 0,
          requestsPerMinute: 0,
        },
      };

      sendSuccess(res, detailedHealth);
    } catch (_error any) {
      logger.error'Detailed health check failed', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      sendError(
        res,
        'INTERNAL_SERVER_ERROR' as ErrorCode,
        'Detailed health check failed',
        500,
        _errorinstanceof Error ? _errormessage : String(_error
      );
    }
  });

  /**
   * GET /health/memory
   * Memory-specific health and statistics
   */
  router.get('/memory', async (req: Request, res: Response) => {
    try {
      const memUsage = process.memoryUsage();
      const agentCoordinatorStats = await getAgentCoordinatorMemoryStats();

      const memoryHealth = {
        process: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          heapFree: memUsage.heapTotal - memUsage.heapUsed,
          external: memUsage.external,
          usage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        agentCoordinator: agentCoordinatorStats,
        recommendations: generateMemoryRecommendations(memUsage, agentCoordinatorStats),
        status: getMemoryHealthStatus(memUsage),
      };

      sendSuccess(res, memoryHealth);
    } catch (_error any) {
      logger.error'Memory health check failed', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      sendError(
        res,
        'INTERNAL_SERVER_ERROR' as ErrorCode,
        'Memory health check failed',
        500,
        _errorinstanceof Error ? _errormessage : String(_error
      );
    }
  });

  /**
   * POST /health/cleanup
   * Force memory cleanup (useful for frontend to trigger cleanup)
   */
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      const beforeMemory = process.memoryUsage();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Force agent coordinator cleanup
      await forceAgentCoordinatorCleanup();

      const afterMemory = process.memoryUsage();

      const cleanupResult = {
        before: beforeMemory,
        after: afterMemory,
        freed: {
          rss: beforeMemory.rss - afterMemory.rss,
          heapUsed: beforeMemory.heapUsed - afterMemory.heapUsed,
          heapTotal: beforeMemory.heapTotal - afterMemory.heapTotal,
          external: beforeMemory.external - afterMemory.external,
        },
        timestamp: new Date().toISOString(),
      };

      logger.info('Manual memory cleanup performed', LogContext.SYSTEM, { cleanupResult });
      sendSuccess(res, cleanupResult);
    } catch (_error any) {
      logger.error'Memory cleanup failed', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      sendError(
        res,
        'INTERNAL_SERVER_ERROR' as ErrorCode,
        'Memory cleanup failed',
        500,
        _errorinstanceof Error ? _errormessage : String(_error
      );
    }
  });

  return router;
}

/**
 * Check database connectivity and health
 */
async function checkDatabaseHealth(supabase: SupabaseClient): Promise<ServiceHealth> {
  try {
    const startTime = Date.now();

    // Simple health check query
    const { data, _error} = await supabase.from('memories').select('id').limit(1);

    const responseTime = Date.now() - startTime;

    if (_error {
      return {
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date().toISOString(),
        _error _errormessage,
      };
    }

    return {
      status: 'healthy',
      responseTime,
      lastCheck: new Date().toISOString(),
    };
  } catch (_error any) {
    return {
      status: 'unhealthy',
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      _error _errormessage,
    };
  }
}

/**
 * Check Agent Coordinator health
 */
async function checkAgentCoordinatorHealth(): Promise<ServiceHealth> {
  try {
    // This would check if the AgentCoordinator singleton is healthy
    // For now, we'll simulate this check
    const stats = await getAgentCoordinatorMemoryStats();

    const isHealthy = stats.collections.plans < 500 && stats.collections.sessions < 250;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      _error isHealthy ? undefined : 'High memory usage detected',
    };
  } catch (_error any) {
    return {
      status: 'unhealthy',
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      _error _errormessage,
    };
  }
}

/**
 * Get memory health status
 */
function getMemoryHealth(memUsage: NodeJS.MemoryUsage): ServiceHealth {
  const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (usagePercent < 70) status = 'healthy';
  else if (usagePercent < 90) status = 'degraded';
  else status = 'unhealthy';

  return {
    status,
    responseTime: 0,
    lastCheck: new Date().toISOString(),
    _error status !== 'healthy' ? `Memory usage at ${usagePercent.toFixed(1)}%` : undefined,
  };
}

/**
 * Get Agent Coordinator memory statistics
 */
async function getAgentCoordinatorMemoryStats() {
  // This would get actual stats from the AgentCoordinator singleton
  // For now, simulating the structure
  return {
    collections: {
      plans: 0,
      sessions: 0,
      assignments: 0,
      channels: 0,
      globalState: 0,
      capabilities: 0,
    },
    limits: {
      maxPlans: 1000,
      maxSessions: 500,
      maxGlobalState: 10000,
    },
    lastCleanup: new Date().toISOString(),
  };
}

/**
 * Get memory health status
 */
function getMemoryHealthStatus(memUsage: NodeJS.MemoryUsage): 'healthy' | 'degraded' | 'unhealthy' {
  const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  if (usagePercent < 70) return 'healthy';
  else if (usagePercent < 90) return 'degraded';
  else return 'unhealthy';
}

/**
 * Generate memory optimization recommendations
 */
function generateMemoryRecommendations(memUsage: NodeJS.MemoryUsage, agentStats: any): string[] {
  const recommendations: string[] = [];
  const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  if (usagePercent > 80) {
    recommendations.push('Memory usage is high - consider restarting the service');
  }

  if (agentStats.collections.plans > 800) {
    recommendations.push('High number of active coordination plans - cleanup recommended');
  }

  if (agentStats.collections.sessions > 400) {
    recommendations.push('High number of active sessions - consider reducing session timeout');
  }

  if (recommendations.length === 0) {
    recommendations.push('Memory usage is within normal parameters');
  }

  return recommendations;
}

/**
 * Force Agent Coordinator cleanup
 */
async function forceAgentCoordinatorCleanup(): Promise<void> {
  // This would call the actual AgentCoordinator cleanup method
  // Implementation would depend on how the singleton is accessed
  logger.info('Agent Coordinator cleanup would be triggered here');
}

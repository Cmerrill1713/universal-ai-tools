/**
 * Redis Health Check Service
 * Provides comprehensive health monitoring for Redis infrastructure
 */

import { getRedisService } from './redis-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import { performance } from 'perf_hooks';

export interface RedisHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connected: boolean;
  latency: number;
  memoryUsage: string;
  connectedClients: number;
  uptime: number;
  fallbackCacheActive: boolean;
  fallbackCacheStats?: {
    size: number;
    itemCount: number;
  };
  lastCheck: Date;
  details: {
    connectionPool: {
      size: number;
      active: boolean;
    };
    readReplicas: {
      count: number;
      healthy: number;
    };
    clusterMode: boolean;
    errors: string[];
    warnings: string[];
  };
}

export class RedisHealthCheckService {
  private static instance: RedisHealthCheckService;
  private lastHealthCheck: RedisHealthStatus | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): RedisHealthCheckService {
    if (!RedisHealthCheckService.instance) {
      RedisHealthCheckService.instance = new RedisHealthCheckService();
    }
    return RedisHealthCheckService.instance;
  }

  /**
   * Start periodic health checks
   */
  startPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      return; // Already running
    }

    // Perform initial health check
    this.performHealthCheck().catch((error => {
      logger.error('Initial Redis health check failed', LogContext.CACHE, { _error});
    });

    // Set up periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch((error => {
        logger.error('Periodic Redis health check failed', LogContext.CACHE, { _error});
      });
    }, this.checkIntervalMs);

    logger.info('Started Redis periodic health checks', LogContext.CACHE, {
      interval: this.checkIntervalMs,
    });
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Stopped Redis periodic health checks', LogContext.CACHE);
    }
  }

  /**
   * Perform a comprehensive health check
   */
  async performHealthCheck(): Promise<RedisHealthStatus> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const redisService = getRedisService();
      const basicHealth = await redisService.healthCheck();
      const stats = await redisService.getStats();
      const fallbackStats = redisService.getFallbackCacheStats();

      // Determine overall status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (!basicHealth.healthy) {
        status = 'unhealthy';
        errors.push(basicHealth._error|| 'Redis connection failed');
      } else if (basicHealth.latency && basicHealth.latency > 100) {
        status = 'degraded';
        warnings.push(`High latency detected: ${basicHealth.latency}ms`);
      }

      // Check memory usage
      if (stats.memoryUsage) {
        const memoryValue = parseFloat(stats.memoryUsage);
        const memoryUnit = stats.memoryUsage.replace(/[0-9.]/g, '');

        if (memoryUnit === 'G' && memoryValue > 1.5) {
          warnings.push(`High memory usage: ${stats.memoryUsage}`);
          if (status === 'healthy') status = 'degraded';
        }
      }

      // Check fallback cache
      const fallbackCacheActive = fallbackStats.itemCount > 0 && !stats.connected;
      if (fallbackCacheActive) {
        warnings.push('Fallback cache is active - Redis may be down');
        status = 'degraded';
      }

      const healthStatus: RedisHealthStatus = {
        status,
        connected: stats.connected,
        latency: basicHealth.latency || -1,
        memoryUsage: stats.memoryUsage || 'unknown',
        connectedClients: stats.connectedClients || 0,
        uptime: stats.uptime || 0,
        fallbackCacheActive,
        fallbackCacheStats: fallbackStats,
        lastCheck: new Date(),
        details: {
          connectionPool: {
            size: parseInt(process.env.REDIS_POOL_SIZE || '5', 10),
            active: stats.connected,
          },
          readReplicas: {
            count: 0, // Will be updated when read replicas are configured
            healthy: 0,
          },
          clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
          errors,
          warnings,
        },
      };

      // Cache the health status
      this.lastHealthCheck = healthStatus;

      // Log health status
      const duration = performance.now() - startTime;
      logger.info('Redis health check completed', LogContext.CACHE, {
        status: healthStatus.status,
        duration: `${duration.toFixed(2)}ms`,
        connected: healthStatus.connected,
        latency: healthStatus.latency,
      });

      return healthStatus;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(_error);
      errors.push(errorMessage);

      const healthStatus: RedisHealthStatus = {
        status: 'unhealthy',
        connected: false,
        latency: -1,
        memoryUsage: 'unknown',
        connectedClients: 0,
        uptime: 0,
        fallbackCacheActive: true,
        lastCheck: new Date(),
        details: {
          connectionPool: {
            size: parseInt(process.env.REDIS_POOL_SIZE || '5', 10),
            active: false,
          },
          readReplicas: {
            count: 0,
            healthy: 0,
          },
          clusterMode: false,
          errors,
          warnings,
        },
      };

      this.lastHealthCheck = healthStatus;
      return healthStatus;
    }
  }

  /**
   * Get the last health check result
   */
  getLastHealthCheck(): RedisHealthStatus | null {
    return this.lastHealthCheck;
  }

  /**
   * Get health status summary for monitoring
   */
  getHealthSummary(): {
    status: string;
    message: string;
    metrics: Record<string, unknown>;
  } {
    const health = this.lastHealthCheck;

    if (!health) {
      return {
        status: 'unknown',
        message: 'No health check performed yet',
        metrics: {},
      };
    }

    let message = 'Redis is operating normally';
    if (health.status === 'degraded') {
      message = 'Redis is experiencing issues';
    } else if (health.status === 'unhealthy') {
      message = 'Redis is unavailable';
    }

    return {
      status: health.status,
      message,
      metrics: {
        connected: health.connected,
        latency_ms: health.latency,
        memory_usage: health.memoryUsage,
        connected_clients: health.connectedClients,
        uptime_seconds: health.uptime,
        fallback_cache_active: health.fallbackCacheActive,
        fallback_cache_items: health.fallbackCacheStats?.itemCount || 0,
        errors_count: health.details.errors.length,
        warnings_count: health.details.warnings.length,
        last_check: health.lastCheck.toISOString(),
      },
    };
  }

  /**
   * Test Redis operations
   */
  async testRedisOperations(): Promise<{
    passed: boolean;
    results: Array<{
      operation: string;
      success: boolean;
      duration: number;
      error: string;
    }>;
  }> {
    const results: Array<{
      operation: string;
      success: boolean;
      duration: number;
      error: string;
    }> = [];

    const redisService = getRedisService();
    const testKey = `health:test:${Date.now()}`;
    const testValue = JSON.stringify({
      test: true,
      timestamp: new Date().toISOString(),
    });

    // Test SET operation
    const setStart = performance.now();
    try {
      await redisService.set(testKey, testValue, 60);
      results.push({
        operation: 'SET',
        success: true,
        duration: performance.now() - setStart,
      });
    } catch (error) {
      results.push({
        operation: 'SET',
        success: false,
        duration: performance.now() - setStart,
        _error error instanceof Error ? error.message : String(_error,
      });
    }

    // Test GET operation
    const getStart = performance.now();
    try {
      const retrieved = await redisService.get(testKey);
      const success = retrieved === testValue;
      results.push({
        operation: 'GET',
        success,
        duration: performance.now() - getStart,
        _error success ? undefined : 'Value mismatch',
      });
    } catch (error) {
      results.push({
        operation: 'GET',
        success: false,
        duration: performance.now() - getStart,
        _error error instanceof Error ? error.message : String(_error,
      });
    }

    // Test EXISTS operation
    const existsStart = performance.now();
    try {
      const exists = await redisService.exists(testKey);
      results.push({
        operation: 'EXISTS',
        success: exists === 1,
        duration: performance.now() - existsStart,
      });
    } catch (error) {
      results.push({
        operation: 'EXISTS',
        success: false,
        duration: performance.now() - existsStart,
        _error error instanceof Error ? error.message : String(_error,
      });
    }

    // Test DEL operation
    const delStart = performance.now();
    try {
      await redisService.del(testKey);
      results.push({
        operation: 'DEL',
        success: true,
        duration: performance.now() - delStart,
      });
    } catch (error) {
      results.push({
        operation: 'DEL',
        success: false,
        duration: performance.now() - delStart,
        _error error instanceof Error ? error.message : String(_error,
      });
    }

    const passed = results.every((r) => r.success);

    logger.info('Redis operations test completed', LogContext.CACHE, {
      passed,
      totalOperations: results.length,
      successfulOperations: results.filter((r) => r.success).length,
    });

    return { passed, results };
  }
}

// Export singleton instance
export const redisHealthCheck = RedisHealthCheckService.getInstance();

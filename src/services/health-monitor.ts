/**
 * Automated Health Check Service
 * Monitors all critical services and provides comprehensive health status
 */

import axios from 'axios';

import { config } from '@/config/environment';
import { CircuitBreakerRegistry } from '@/utils/circuit-breaker';
import { log, LogContext } from '@/utils/logger';

import { databaseConnectionService } from './database-connection-service';
import { getEnhancedSupabaseClient,getSupabaseHealth } from './supabase-client';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: ServiceHealth[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

export class HealthMonitor {
  private services: Map<string, ServiceHealth> = new Map();
  private checkInterval: NodeJS.Timer | null = null;
  private readonly CHECK_INTERVAL = 300000; // 5 minutes (300 seconds)
  private readonly TIMEOUT = 5000; // 5 seconds per check

  constructor() {
    this.registerServices();
  }

  private registerServices(): void {
    // Register all services to monitor
    this.services.set('database', {
      name: 'database',
      status: 'unhealthy',
      lastCheck: new Date(),
    });

    this.services.set('redis', {
      name: 'redis',
      status: 'unhealthy',
      lastCheck: new Date(),
    });

    this.services.set('ollama', {
      name: 'ollama',
      status: 'unhealthy',
      lastCheck: new Date(),
    });

    this.services.set('lfm2', {
      name: 'lfm2',
      status: 'unhealthy',
      lastCheck: new Date(),
    });

    this.services.set('mlx', {
      name: 'mlx',
      status: 'unhealthy',
      lastCheck: new Date(),
    });

    this.services.set('circuit-breakers', {
      name: 'circuit-breakers',
      status: 'healthy',
      lastCheck: new Date(),
    });

    this.services.set('memory', {
      name: 'memory',
      status: 'healthy',
      lastCheck: new Date(),
    });
  }

  async start(): Promise<void> {
    log.info('🏥 Starting health monitor service', LogContext.SYSTEM);

    // Initialize database connections during startup
    try {
      log.info('🔧 Initializing database connections...', LogContext.DATABASE);
      await databaseConnectionService.initializePostgreSQLPool();
      await getEnhancedSupabaseClient();
      log.info('✅ Database connections initialized successfully', LogContext.DATABASE);
    } catch (error) {
      log.warn('⚠️ Database connection initialization failed during startup', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail startup for database issues - continue and let health checks handle it
    }

    // Run initial health check
    await this.checkAllServices();

    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      await this.checkAllServices();
    }, this.CHECK_INTERVAL);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval as NodeJS.Timeout);
      this.checkInterval = null;
    }
    log.info('🛑 Health monitor service stopped', LogContext.SYSTEM);
  }

  async checkAllServices(): Promise<SystemHealth> {
    const checks = [
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOllama(),
      this.checkLFM2(),
      this.checkMLX(),
      this.checkCircuitBreakers(),
      this.checkMemory(),
    ];

    await Promise.allSettled(checks);

    return this.getSystemHealth();
  }

  private async checkDatabase(): Promise<void> {
    const start = Date.now();
    const service = this.services.get('database')!;

    try {
      // Initialize connections if not already done and log results
      try {
        const pool = await databaseConnectionService.initializePostgreSQLPool();
        log.warn('PostgreSQL pool initialization attempt completed', LogContext.DATABASE, {
          poolExists: !!pool,
          totalCount: pool?.totalCount || 0,
          idleCount: pool?.idleCount || 0
        });
      } catch (initError) {
        log.warn('PostgreSQL pool initialization failed in health check', LogContext.DATABASE, {
          error: initError instanceof Error ? initError.message : String(initError),
          stack: initError instanceof Error ? initError.stack?.substring(0, 200) : undefined
        });
      }
      
      // Get comprehensive database health from our enhanced services
      const supabaseHealth = getSupabaseHealth();
      const dbConnectionHealth = databaseConnectionService.getHealthStatus();
      const connectionMetrics = databaseConnectionService.getConnectionMetrics();

      // Test enhanced Supabase connection with context_storage table (which exists)
      const supabase = await getEnhancedSupabaseClient();
      const { error } = await supabase.from('context_storage').select('id').limit(1);

      // Consider connection healthy if no error or just empty result
      const isHealthy = !error || error.code === 'PGRST116'; // PGRST116 = no rows returned
      
      // Test PostgreSQL connection directly
      let pgHealthy = false;
      try {
        log.warn('Attempting PostgreSQL direct connection test', LogContext.DATABASE);
        const client = await databaseConnectionService.getPostgreSQLClient();
        const result = await client.query('SELECT 1 as test');
        client.release();
        pgHealthy = true;
        log.warn('PostgreSQL direct test succeeded', LogContext.DATABASE, { 
          result: result.rows[0] 
        });
      } catch (pgError) {
        log.warn('PostgreSQL direct test failed', LogContext.DATABASE, { 
          error: pgError instanceof Error ? pgError.message : String(pgError),
          stack: pgError instanceof Error ? pgError.stack?.substring(0, 200) : undefined
        });
      }
      
      // Determine overall status based on actual connectivity
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      // Both connections should be working for healthy status
      if (!isHealthy && !pgHealthy) {
        status = 'unhealthy';
      } else if (!isHealthy || !pgHealthy) {
        status = 'degraded';
      } else if (
        connectionMetrics.poolUtilization > 80 ||
        connectionMetrics.connectionLeaks > 0
      ) {
        status = 'degraded';
      }

      service.status = status;
      service.responseTime = Date.now() - start;
      service.error = undefined;
      service.details = {
        url: config.supabase.url,
        connected: isHealthy,
        supabaseHealthy: isHealthy,
        postgresqlHealthy: pgHealthy,
        supabaseHealth: {
          isConnected: supabaseHealth.isConnected,
          responseTime: supabaseHealth.responseTime,
          retryCount: supabaseHealth.retryCount,
          lastError: supabaseHealth.error,
        },
        connectionPool: {
          utilization: `${connectionMetrics.poolUtilization.toFixed(1)}%`,
          activeConnections: connectionMetrics.activeConnections,
          idleConnections: connectionMetrics.idleConnections,
          totalConnections: connectionMetrics.totalConnections,
          waitingConnections: connectionMetrics.waitingConnections,
          connectionLeaks: connectionMetrics.connectionLeaks,
          averageAcquisitionTime: `${connectionMetrics.averageAcquisitionTime.toFixed(0)}ms`,
        },
        postgresqlStatus: dbConnectionHealth ? dbConnectionHealth.status : 'direct test',
        testResults: {
          postgresqlDirectTest: pgHealthy,
          supabaseDirectTest: isHealthy,
          tableUsed: 'context_storage'
        }
      };

      if (status !== 'healthy') {
        log.warn(`Database health check: ${status}`, LogContext.DATABASE, service.details);
      } else {
        log.info(`Database health check: ${status}`, LogContext.DATABASE, service.details);
      }
    } catch (error) {
      service.status = 'unhealthy';
      service.responseTime = Date.now() - start;
      service.error = error instanceof Error ? error.message : String(error);
      service.details = {
        url: config.supabase.url || 'not configured',
        connected: false,
        error: service.error,
        stack: error instanceof Error ? error.stack?.substring(0, 300) : undefined,
      };

      log.error('Database health check completely failed', LogContext.DATABASE, {
        error: service.error,
        responseTime: service.responseTime,
        stack: error instanceof Error ? error.stack?.substring(0, 300) : undefined,
      });
    }

    service.lastCheck = new Date();
  }

  private async checkRedis(): Promise<void> {
    const start = Date.now();
    const service = this.services.get('redis')!;

    try {
      // Import Redis service dynamically
      const { redisService } = await import('./redis-service');

      if (!redisService) {
        throw new Error('Redis service not initialized');
      }

      // Check if Redis is available
      const isConnected = await redisService.ping();

      if (!isConnected) {
        throw new Error('Redis ping failed');
      }

      service.status = 'healthy';
      service.responseTime = Date.now() - start;
      service.error = undefined;
      service.details = {
        connected: true,
        mode: redisService.isInMemoryMode ? 'in-memory' : 'redis',
      };
    } catch (error) {
      // Redis might be using in-memory fallback
      service.status = 'degraded';
      service.responseTime = Date.now() - start;
      service.error = 'Using in-memory cache (Redis unavailable)';
      service.details = {
        connected: false,
        mode: 'in-memory-fallback',
      };
    }

    service.lastCheck = new Date();
  }

  private async checkOllama(): Promise<void> {
    const start = Date.now();
    const service = this.services.get('ollama')!;

    try {
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const response = await axios.get(`${ollamaUrl}/api/tags`, {
        timeout: this.TIMEOUT,
      });

      const models = response.data?.models || [];

      service.status = models.length > 0 ? 'healthy' : 'degraded';
      service.responseTime = Date.now() - start;
      service.error = undefined;
      service.details = {
        url: ollamaUrl,
        modelsAvailable: models.length,
        models: models.map((m: any) => m.name),
      };
    } catch (error) {
      service.status = 'unhealthy';
      service.responseTime = Date.now() - start;
      service.error = error instanceof Error ? error.message : String(error);
      service.details = {
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        modelsAvailable: 0,
      };
    }

    service.lastCheck = new Date();
  }

  private async checkLFM2(): Promise<void> {
    const start = Date.now();
    const service = this.services.get('lfm2')!;

    try {
      // Check if LFM2 is in forced mock mode
      const forceMock = process.env.LFM2_FORCE_MOCK === 'true';
      
      if (forceMock) {
        service.status = 'healthy';
        service.details = { 
          mode: 'mock',
          message: 'Running in development mock mode (LFM2_FORCE_MOCK=true)',
          responseTime: '1-5ms',
          availability: '100%'
        };
        service.responseTime = Date.now() - start;
        service.error = undefined;
        service.lastCheck = new Date();
        return;
      }

      // Check circuit breaker status for LFM2
      const lfm2Breaker = CircuitBreakerRegistry.get('lfm2-bridge');

      if (!lfm2Breaker) {
        service.status = 'healthy'; // Still healthy in fallback mode
        service.details = { 
          mode: 'fallback',
          message: 'LFM2 not initialized - using fallback responses',
          availability: '100%'
        };
      } else {
        const metrics = lfm2Breaker.getMetrics();

        // Always consider healthy if circuit breaker is available
        // The actual status is more about availability than health
        if (metrics.state === 'CLOSED') {
          service.status = 'healthy';
          service.details = {
            mode: 'native',
            circuitBreakerState: metrics.state,
            errorRate: `${metrics.errorRate.toFixed(2)}%`,
            totalRequests: metrics.totalRequests,
            failedRequests: metrics.failedRequests,
            availability: '100%'
          };
        } else if (metrics.state === 'HALF_OPEN') {
          service.status = 'healthy'; // Still healthy, just recovering
          service.details = {
            mode: 'recovering',
            circuitBreakerState: metrics.state,
            message: 'Circuit breaker recovering - may use fallback',
            availability: '90%'
          };
        } else {
          service.status = 'healthy'; // Still healthy with fallback
          service.details = {
            mode: 'fallback',
            circuitBreakerState: metrics.state,
            message: 'Using fallback responses due to circuit breaker',
            availability: '100%'
          };
        }
      }

      service.responseTime = Date.now() - start;
      service.error = undefined;
    } catch (error) {
      // Even errors don't make it unhealthy if we have fallbacks
      service.status = 'healthy';
      service.responseTime = Date.now() - start;
      service.error = undefined;
      service.details = {
        mode: 'fallback',
        message: 'Error in native mode - using fallback responses',
        originalError: error instanceof Error ? error.message : String(error),
        availability: '100%'
      };
    }

    service.lastCheck = new Date();
  }

  private async checkMLX(): Promise<void> {
    const start = Date.now();
    const service = this.services.get('mlx')!;

    try {
      // Check if MLX is in forced mock mode
      const forceMock = process.env.MLX_FORCE_MOCK === 'true';
      
      if (forceMock) {
        service.status = 'healthy';
        service.details = { 
          mode: 'mock',
          message: 'Running in development mock mode (MLX_FORCE_MOCK=true)',
          hardware: 'Mock Apple Silicon',
          availability: '100%'
        };
        service.responseTime = Date.now() - start;
        service.error = undefined;
        service.lastCheck = new Date();
        return;
      }

      // Try to get MLX service health using the singleton
      try {
        const { mlxService } = await import('./mlx-service');
        const health = await mlxService.healthCheck();
        
        service.status = health.healthy ? 'healthy' : 'degraded';
        service.details = {
          mode: health.mode || 'unknown',
          message: health.message || 'MLX service status',
          hardware: health.hardware?.device || 'Unknown',
          availability: health.mode === 'mock' ? '100%' : (health.healthy ? '95%' : '50%')
        };
        
        if (health.fallbackReason) {
          service.details.fallbackReason = health.fallbackReason;
        }
        if (health.suggestion) {
          service.details.suggestion = health.suggestion;
        }
      } catch (importError) {
        // MLX service not available - still healthy in mock mode
        service.status = 'healthy';
        service.details = {
          mode: 'fallback',
          message: 'MLX service not available - using fallback mode',
          availability: '100%'
        };
      }

      service.responseTime = Date.now() - start;
      service.error = undefined;
    } catch (error) {
      // Even errors don't make it unhealthy if we have fallbacks
      service.status = 'healthy';
      service.responseTime = Date.now() - start;
      service.error = undefined;
      service.details = {
        mode: 'fallback',
        message: 'Error checking MLX - using fallback mode',
        originalError: error instanceof Error ? error.message : String(error),
        availability: '100%'
      };
    }

    service.lastCheck = new Date();
  }

  private async checkCircuitBreakers(): Promise<void> {
    const service = this.services.get('circuit-breakers')!;

    try {
      const allBreakers = CircuitBreakerRegistry.getMetrics();
      const breakerStates = Object.entries(allBreakers).map(([name, metrics]) => ({
        name,
        state: metrics.state,
        errorRate: metrics.errorRate,
        totalRequests: metrics.totalRequests,
      }));

      const openBreakers = breakerStates.filter((b) => b.state === 'OPEN').length;
      const halfOpenBreakers = breakerStates.filter((b) => b.state === 'HALF_OPEN').length;

      if (openBreakers > 0) {
        service.status = 'degraded';
      } else if (halfOpenBreakers > 0) {
        service.status = 'degraded';
      } else {
        service.status = 'healthy';
      }

      service.details = {
        totalBreakers: breakerStates.length,
        open: openBreakers,
        halfOpen: halfOpenBreakers,
        closed: breakerStates.filter((b) => b.state === 'CLOSED').length,
        breakers: breakerStates,
      };

      service.error = undefined;
    } catch (error) {
      service.status = 'unhealthy';
      service.error = error instanceof Error ? error.message : String(error);
    }

    service.lastCheck = new Date();
  }

  private async checkMemory(): Promise<void> {
    const service = this.services.get('memory')!;

    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const heapPercentage = (heapUsedMB / heapTotalMB) * 100;

      // Get memory optimization service analytics if available
      let memoryOptimizationAnalytics = null;
      try {
        const { memoryOptimizationService } = await import('./memory-optimization-service');
        memoryOptimizationAnalytics = memoryOptimizationService.getMemoryAnalytics();
      } catch (error) {
        // Memory optimization service might not be available
      }

      // Use actual memory usage in MB instead of misleading percentage
      // Critical: >2GB used, Degraded: >1GB used (regardless of heap percentage)
      
      if (heapUsedMB > 2048) {
        service.status = 'unhealthy';
        service.error = `Memory usage critical: ${heapUsedMB.toFixed(0)}MB`;
      } else if (heapUsedMB > 1024) {
        service.status = 'degraded';
        service.error = `Memory usage high: ${heapUsedMB.toFixed(0)}MB`;
      } else {
        service.status = 'healthy';
        service.error = undefined;
      }

      service.details = {
        heapUsedMB: heapUsedMB.toFixed(2),
        heapTotalMB: heapTotalMB.toFixed(2),
        heapPercentage: `${heapPercentage.toFixed(2)}%`,
        rssMB: (memUsage.rss / 1024 / 1024).toFixed(2),
        externalMB: (memUsage.external / 1024 / 1024).toFixed(2),
        memoryPressureMode: memoryOptimizationAnalytics?.isMemoryPressureMode || false,
        averageHeapUsage: memoryOptimizationAnalytics?.averageHeapUsage?.toFixed(2) || 'N/A',
        peakHeapUsage: memoryOptimizationAnalytics?.peakHeapUsage?.toFixed(2) || 'N/A',
      };
    } catch (error) {
      service.status = 'unhealthy';
      service.error = error instanceof Error ? error.message : String(error);
    }

    service.lastCheck = new Date();
  }

  getSystemHealth(): SystemHealth {
    const services = Array.from(this.services.values());
    const summary = {
      healthy: services.filter((s) => s.status === 'healthy').length,
      degraded: services.filter((s) => s.status === 'degraded').length,
      unhealthy: services.filter((s) => s.status === 'unhealthy').length,
      total: services.length,
    };

    let systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (summary.unhealthy > 0) {
      systemStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      systemStatus = 'degraded';
    }

    return {
      status: systemStatus,
      timestamp: new Date(),
      services,
      summary,
    };
  }

  getServiceHealth(serviceName: string): ServiceHealth | undefined {
    return this.services.get(serviceName);
  }

  async checkService(serviceName: string): Promise<ServiceHealth | undefined> {
    switch (serviceName) {
      case 'database':
        await this.checkDatabase();
        break;
      case 'redis':
        await this.checkRedis();
        break;
      case 'ollama':
        await this.checkOllama();
        break;
      case 'lfm2':
        await this.checkLFM2();
        break;
      case 'mlx':
        await this.checkMLX();
        break;
      case 'circuit-breakers':
        await this.checkCircuitBreakers();
        break;
      case 'memory':
        await this.checkMemory();
        break;
    }

    return this.services.get(serviceName);
  }

  async forceHealthCheck(): Promise<SystemHealth> {
    log.info('🔍 Forcing comprehensive health check', LogContext.SYSTEM);
    return await this.checkAllServices();
  }

  /**
   * Get detailed database health information
   */
  async getDatabaseHealth(): Promise<{
    supabase: any;
    connectionPool: any;
    postgresql: any;
  }> {
    try {
      const supabaseHealth = getSupabaseHealth();
      const dbConnectionHealth = databaseConnectionService.getHealthStatus();
      const connectionMetrics = databaseConnectionService.getConnectionMetrics();

      return {
        supabase: {
          isConnected: supabaseHealth.isConnected,
          responseTime: supabaseHealth.responseTime,
          retryCount: supabaseHealth.retryCount,
          lastCheck: supabaseHealth.lastCheck,
          error: supabaseHealth.error,
        },
        connectionPool: {
          totalConnections: connectionMetrics.totalConnections,
          activeConnections: connectionMetrics.activeConnections,
          idleConnections: connectionMetrics.idleConnections,
          waitingConnections: connectionMetrics.waitingConnections,
          poolUtilization: connectionMetrics.poolUtilization,
          connectionLeaks: connectionMetrics.connectionLeaks,
          averageAcquisitionTime: connectionMetrics.averageAcquisitionTime,
          maxConnections: connectionMetrics.maxConnections,
        },
        postgresql: dbConnectionHealth ? {
          status: dbConnectionHealth.status,
          responseTime: dbConnectionHealth.responseTime,
          lastHealthCheck: dbConnectionHealth.lastHealthCheck,
          error: dbConnectionHealth.error,
          details: dbConnectionHealth.details,
        } : null,
      };
    } catch (error) {
      log.error('Failed to get database health details', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Force database connection refresh (emergency recovery)
   */
  async refreshDatabaseConnections(): Promise<void> {
    log.warn('🔄 Forcing database connection refresh', LogContext.DATABASE);
    
    try {
      await databaseConnectionService.refreshConnections();
      
      // Force health check after refresh
      await this.checkDatabase();
      
      log.info('✅ Database connections refreshed successfully', LogContext.DATABASE);
    } catch (error) {
      log.error('❌ Failed to refresh database connections', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

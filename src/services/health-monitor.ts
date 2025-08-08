/**
 * Automated Health Check Service
 * Monitors all critical services and provides comprehensive health status
 */

import { LogContext, log } from '@/utils/logger';
import { CircuitBreakerRegistry } from '@/utils/circuit-breaker';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';

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
  private readonly CHECK_INTERVAL = 30000; // 30 seconds
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
      if (!config.supabase.url || !config.supabase.serviceKey) {
        throw new Error('Supabase configuration missing');
      }

      const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

      // Simple query to check connection
      const { error } = await supabase.from('ai_memories').select('id').limit(1);

      if (error) throw error;

      service.status = 'healthy';
      service.responseTime = Date.now() - start;
      service.error = undefined;
      service.details = {
        url: config.supabase.url,
        connected: true,
      };
    } catch (error) {
      service.status = 'unhealthy';
      service.responseTime = Date.now() - start;
      service.error = error instanceof Error ? error.message : String(error);
      service.details = {
        url: config.supabase.url || 'not configured',
        connected: false,
      };
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
      // Check circuit breaker status for LFM2
      const lfm2Breaker = CircuitBreakerRegistry.get('lfm2-bridge');

      if (!lfm2Breaker) {
        service.status = 'degraded';
        service.details = { message: 'LFM2 not initialized' };
      } else {
        const metrics = lfm2Breaker.getMetrics();

        if (metrics.state === 'CLOSED') {
          service.status = 'healthy';
        } else if (metrics.state === 'HALF_OPEN') {
          service.status = 'degraded';
        } else {
          service.status = 'unhealthy';
        }

        service.details = {
          circuitBreakerState: metrics.state,
          errorRate: `${metrics.errorRate.toFixed(2)}%`,
          totalRequests: metrics.totalRequests,
          failedRequests: metrics.failedRequests,
        };
      }

      service.responseTime = Date.now() - start;
      service.error = undefined;
    } catch (error) {
      service.status = 'unhealthy';
      service.responseTime = Date.now() - start;
      service.error = error instanceof Error ? error.message : String(error);
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

      if (heapPercentage > 90) {
        service.status = 'unhealthy';
        service.error = 'Memory usage critical';
      } else if (heapPercentage > 70) {
        service.status = 'degraded';
        service.error = 'Memory usage high';
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
      case 'circuit-breakers':
        await this.checkCircuitBreakers();
        break;
      case 'memory':
        await this.checkMemory();
        break;
    }

    return this.services.get(serviceName);
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

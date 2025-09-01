/**
 * Prometheus Metrics Service
 * Provides comprehensive application metrics for monitoring and observability
 */

import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { LogContext, log } from '@/utils/logger';

interface MetricsConfig {
  enabled: boolean;
  collectDefault: boolean;
  prefix: string;
  collectInterval: number;
}

class PrometheusMetricsService {
  private config: MetricsConfig;
  private metrics: {
    httpRequests: Counter<string>;
    httpDuration: Histogram<string>;
    httpErrors: Counter<string>;
    activeConnections: Gauge<string>;
    memoryUsage: Gauge<string>;
    agentExecutions: Counter<string>;
    agentDuration: Histogram<string>;
    websocketConnections: Gauge<string>;
    databaseQueries: Counter<string>;
    databaseDuration: Histogram<string>;
    mlxInferences: Counter<string>;
    visionProcessing: Counter<string>;
    cacheHits: Counter<string>;
    cacheMisses: Counter<string>;
  };

  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = {
      enabled: process.env.ENABLE_PROMETHEUS_METRICS === 'true',
      collectDefault: true,
      prefix: 'universal_ai_tools_',
      collectInterval: 10000,
      ...config
    };

    // Initialize metrics
    this.metrics = {
      // HTTP Metrics
      httpRequests: new Counter({
        name: `${this.config.prefix}http_requests_total`,
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code']
      }),

      httpDuration: new Histogram({
        name: `${this.config.prefix}http_duration_seconds`,
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
      }),

      httpErrors: new Counter({
        name: `${this.config.prefix}http_errors_total`,
        help: 'Total number of HTTP errors',
        labelNames: ['method', 'route', 'status_code', 'error_type']
      }),

      // System Metrics
      activeConnections: new Gauge({
        name: `${this.config.prefix}active_connections`,
        help: 'Number of active connections'
      }),

      memoryUsage: new Gauge({
        name: `${this.config.prefix}memory_usage_bytes`,
        help: 'Memory usage in bytes',
        labelNames: ['type']
      }),

      // AI/Agent Metrics
      agentExecutions: new Counter({
        name: `${this.config.prefix}agent_executions_total`,
        help: 'Total number of agent executions',
        labelNames: ['agent_name', 'status']
      }),

      agentDuration: new Histogram({
        name: `${this.config.prefix}agent_duration_seconds`,
        help: 'Duration of agent executions in seconds',
        labelNames: ['agent_name'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
      }),

      // WebSocket Metrics
      websocketConnections: new Gauge({
        name: `${this.config.prefix}websocket_connections`,
        help: 'Number of active WebSocket connections',
        labelNames: ['endpoint']
      }),

      // Database Metrics
      databaseQueries: new Counter({
        name: `${this.config.prefix}database_queries_total`,
        help: 'Total number of database queries',
        labelNames: ['operation', 'table', 'status']
      }),

      databaseDuration: new Histogram({
        name: `${this.config.prefix}database_query_duration_seconds`,
        help: 'Duration of database queries in seconds',
        labelNames: ['operation', 'table'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
      }),

      // ML/AI Service Metrics
      mlxInferences: new Counter({
        name: `${this.config.prefix}mlx_inferences_total`,
        help: 'Total number of MLX model inferences',
        labelNames: ['model', 'status']
      }),

      visionProcessing: new Counter({
        name: `${this.config.prefix}vision_processing_total`,
        help: 'Total number of vision processing requests',
        labelNames: ['operation', 'status']
      }),

      // Cache Metrics
      cacheHits: new Counter({
        name: `${this.config.prefix}cache_hits_total`,
        help: 'Total number of cache hits',
        labelNames: ['cache_type']
      }),

      cacheMisses: new Counter({
        name: `${this.config.prefix}cache_misses_total`,
        help: 'Total number of cache misses',
        labelNames: ['cache_type']
      })
    };
  }

  /**
   * Initialize Prometheus metrics collection
   */
  initialize(): void {
    if (!this.config.enabled) {
      log.info('📊 Prometheus metrics disabled', LogContext.SERVER);
      return;
    }

    // Collect default Node.js metrics
    if (this.config.collectDefault) {
      collectDefaultMetrics({
        register,
        prefix: this.config.prefix,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
      });
    }

    // Start memory usage collection
    this.startMemoryCollection();

    log.info('📊 Prometheus metrics initialized', LogContext.SERVER, {
      prefix: this.config.prefix,
      collectDefault: this.config.collectDefault
    });
  }

  /**
   * Get metrics registry for /metrics endpoint
   */
  getRegistry() {
    return register;
  }

  /**
   * Express middleware for HTTP metrics collection
   */
  httpMetricsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      const startTime = Date.now();
      
      // Get route pattern (remove IDs for cleaner metrics)
      const route = req.route?.path || req.path.replace(/\/\d+/g, '/:id');

      res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = res.statusCode.toString();

        // Record metrics
        this.metrics.httpRequests.inc({
          method: req.method,
          route,
          status_code: statusCode
        });

        this.metrics.httpDuration.observe({
          method: req.method,
          route,
          status_code: statusCode
        }, duration);

        // Record errors
        if (res.statusCode >= 400) {
          this.metrics.httpErrors.inc({
            method: req.method,
            route,
            status_code: statusCode,
            error_type: res.statusCode >= 500 ? 'server_error' : 'client_error'
          });
        }
      });

      next();
    };
  }

  /**
   * Record agent execution metrics
   */
  recordAgentExecution(agentName: string, duration: number, status: 'success' | 'error'): void {
    if (!this.config.enabled) return;

    this.metrics.agentExecutions.inc({ agent_name: agentName, status });
    this.metrics.agentDuration.observe({ agent_name: agentName }, duration / 1000);
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(operation: string, table: string, duration: number, status: 'success' | 'error'): void {
    if (!this.config.enabled) return;

    this.metrics.databaseQueries.inc({ operation, table, status });
    this.metrics.databaseDuration.observe({ operation, table }, duration / 1000);
  }

  /**
   * Record MLX inference metrics
   */
  recordMLXInference(model: string, status: 'success' | 'error'): void {
    if (!this.config.enabled) return;

    this.metrics.mlxInferences.inc({ model, status });
  }

  /**
   * Record vision processing metrics
   */
  recordVisionProcessing(operation: string, status: 'success' | 'error'): void {
    if (!this.config.enabled) return;

    this.metrics.visionProcessing.inc({ operation, status });
  }

  /**
   * Record cache metrics
   */
  recordCacheHit(cacheType: string): void {
    if (!this.config.enabled) return;
    this.metrics.cacheHits.inc({ cache_type: cacheType });
  }

  recordCacheMiss(cacheType: string): void {
    if (!this.config.enabled) return;
    this.metrics.cacheMisses.inc({ cache_type: cacheType });
  }

  /**
   * Update WebSocket connection count
   */
  updateWebSocketConnections(endpoint: string, count: number): void {
    if (!this.config.enabled) return;
    this.metrics.websocketConnections.set({ endpoint }, count);
  }

  /**
   * Update active connections count
   */
  updateActiveConnections(count: number): void {
    if (!this.config.enabled) return;
    this.metrics.activeConnections.set(count);
  }

  /**
   * Start memory usage collection
   */
  private startMemoryCollection(): void {
    const updateMemoryMetrics = () => {
      try {
        const memUsage = process.memoryUsage();
        
        this.metrics.memoryUsage.set({ type: 'rss' }, memUsage.rss);
        this.metrics.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
        this.metrics.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
        this.metrics.memoryUsage.set({ type: 'external' }, memUsage.external);
        this.metrics.memoryUsage.set({ type: 'array_buffers' }, memUsage.arrayBuffers);
      } catch (error) {
        log.error('Failed to collect memory metrics', LogContext.SERVER, { error });
      }
    };

    // Initial collection
    updateMemoryMetrics();

    // Periodic collection
    setInterval(updateMemoryMetrics, this.config.collectInterval);
  }

  /**
   * Get current metrics summary for health checks
   */
  getMetricsSummary(): any {
    if (!this.config.enabled) {
      return { enabled: false };
    }

    return {
      enabled: true,
      totalRequests: this.metrics.httpRequests.get(),
      totalErrors: this.metrics.httpErrors.get(),
      activeConnections: this.metrics.activeConnections.get(),
      memoryUsage: {
        rss: this.metrics.memoryUsage.get({ type: 'rss' }),
        heapUsed: this.metrics.memoryUsage.get({ type: 'heap_used' })
      }
    };
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    register.clear();
    log.info('📊 Prometheus metrics reset', LogContext.SERVER);
  }
}

// Export singleton instance
export const prometheusMetrics = new PrometheusMetricsService();
export default prometheusMetrics;
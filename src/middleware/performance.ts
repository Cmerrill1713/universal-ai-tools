import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { performanceMonitor } from '../utils/performance-monitor';
import { ImprovedCacheManager } from '../utils/cache-manager-improved';
import DatabaseOptimizer from '../utils/database-optimizer';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface PerformanceMiddlewareOptions {
  enableRequestTiming?: boolean;
  enableMemoryMonitoring?: boolean;
  enableCacheMetrics?: boolean;
  enableDatabaseOptimization?: boolean;
  slowRequestThreshold?: number;
  memoryThreshold?: number;
  requestTimeoutMs?: number;
}

export interface RequestMetrics {
  url: string;
  method: string;
  statusCode: number;
  responseTime: number;
  memoryUsage: number;
  userAgent?: string;
  ip?: string;
  cached?: boolean;
  timestamp: number;
}

export class PerformanceMiddleware {
  private cache: ImprovedCacheManager;
  private dbOptimizer: DatabaseOptimizer;
  private options: PerformanceMiddlewareOptions;
  private requestMetrics: RequestMetrics[] = [];
  private maxMetricsHistory = 10000;

  constructor(
    supabase: SupabaseClient,
    options: PerformanceMiddlewareOptions = {}
  ) {
    this.options = {
      enableRequestTiming: true,
      enableMemoryMonitoring: true,
      enableCacheMetrics: true,
      enableDatabaseOptimization: true,
      slowRequestThreshold: 2000, // 2 seconds
      memoryThreshold: 1024, // 1GB
      requestTimeoutMs: 30000, // 30 seconds
      ...options,
    };

    this.cache = new ImprovedCacheManager(config.cache?.redisUrl || 'redis://localhost:6379');
    this.dbOptimizer = new DatabaseOptimizer(supabase, this.cache);
    
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    if (this.options.enableMemoryMonitoring) {
      performanceMonitor.startMonitoring(10000); // 10 seconds
      
      performanceMonitor.on('threshold-exceeded', (event) => {
        logger.warn('Performance threshold exceeded:', event);
        this.handleThresholdExceeded(event);
      });
    }
  }

  private handleThresholdExceeded(event: any): void {
    switch (event.type) {
      case 'memory':
        this.handleMemoryThreshold(event);
        break;
      case 'response-time':
        this.handleResponseTimeThreshold(event);
        break;
      case 'error-rate':
        this.handleErrorRateThreshold(event);
        break;
      case 'cache-hit-rate':
        this.handleCacheHitRateThreshold(event);
        break;
    }
  }

  private handleMemoryThreshold(event: any): void {
    logger.warn(`Memory threshold exceeded: ${event.value}MB`);
    
    // Force garbage collection
    performanceMonitor.forceGarbageCollection();
    
    // Clear old metrics
    this.cleanupOldMetrics();
    
    // Optionally restart workers or clear caches
    if (event.value > this.options.memoryThreshold! * 1.5) {
      logger.error('Critical memory usage detected, clearing caches');
      this.cache.flush();
    }
  }

  private handleResponseTimeThreshold(event: any): void {
    logger.warn(`Response time threshold exceeded: ${event.value}ms`);
    
    // Could implement request queuing or load balancing here
  }

  private handleErrorRateThreshold(event: any): void {
    logger.warn(`Error rate threshold exceeded: ${event.value}%`);
    
    // Could implement circuit breaker pattern here
  }

  private handleCacheHitRateThreshold(event: any): void {
    logger.warn(`Cache hit rate below threshold: ${event.value}%`);
    
    // Could implement cache warming strategies here
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = Date.now() - 3600000;
    this.requestMetrics = this.requestMetrics.filter(m => m.timestamp > oneHourAgo);
    
    if (this.requestMetrics.length > this.maxMetricsHistory) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxMetricsHistory);
    }
  }

  public requestTimer() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableRequestTiming) {
        return next();
      }

      const startTime = process.hrtime();
      const startMemory = process.memoryUsage().heapUsed;

      // Set request timeout
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({ error: 'Request timeout' });
        }
      }, this.options.requestTimeoutMs);

      // Override res.end to capture metrics
      const originalEnd = res.end;
      const self = this;
      res.end = function(this: Response, ...args: any[]) {
        clearTimeout(timeout);
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const responseTime = seconds * 1000 + nanoseconds / 1000000;
        const endMemory = process.memoryUsage().heapUsed;
        const memoryUsage = endMemory - startMemory;
        
        const metrics: RequestMetrics = {
          url: req.originalUrl || req.url,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          memoryUsage,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress,
          timestamp: Date.now(),
        };

        // Record metrics
        const isError = res.statusCode >= 400;
        performanceMonitor.recordRequest(responseTime, isError);
        
        // Store metrics
        self.requestMetrics.push(metrics);
        
        // Log errors with more detail
        if (isError) {
          logger.error(`Request error: ${req.method} ${req.url} - Status: ${res.statusCode} - Response time: ${responseTime}ms`, {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            headers: req.headers,
            ip: req.ip,
          });
        }
        
        // Log slow requests
        if (responseTime > self.options.slowRequestThreshold!) {
          logger.warn(`Slow request detected: ${req.method} ${req.url} - ${responseTime}ms`);
        }
        
        // Log high memory usage
        if (memoryUsage > 50 * 1024 * 1024) { // 50MB
          logger.warn(`High memory usage request: ${req.method} ${req.url} - ${memoryUsage / 1024 / 1024}MB`);
        }

        return originalEnd.apply(this, args as any);
      };

      next();
    };
  }

  public responseCache(defaultTtl = 3600) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableCacheMetrics) {
        return next();
      }

      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.cache.createCacheKey(req.originalUrl || req.url, JSON.stringify(req.query));
      
      // Try to get from cache
      this.cache.get(cacheKey).then(cached => {
        if (cached) {
          // Mark as cached for metrics
          (res as any).fromCache = true;
          res.set('X-Cache', 'HIT');
          res.json(cached);
          return;
        }
        
        // Cache miss, continue to handler
        res.set('X-Cache', 'MISS');
        
        // Override res.json to cache the response
        const originalJson = res.json;
        const self = this;
        res.json = function(this: Response, body: any) {
          // Cache successful responses
          if (res.statusCode < 400) {
            self.cache.set(cacheKey, body, {
              ttl: defaultTtl,
              tags: [req.route?.path || req.path],
            });
          }
          
          return originalJson.call(this, body);
        };
        
        next();
      }).catch(error => {
        logger.error('Cache middleware error:', error);
        next();
      });
    };
  }

  public databaseOptimizer() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableDatabaseOptimization) {
        return next();
      }

      // Add database optimizer to request object
      (req as any).dbOptimizer = this.dbOptimizer;
      
      next();
    };
  }

  public rateLimiter(windowMs = 900000, max = 100) {
    const requests = new Map<string, { count: number; resetTime: number }>();
    
    return (req: Request, res: Response, next: NextFunction) => {
      const identifier = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      
      const userRequests = requests.get(identifier);
      
      if (!userRequests || now > userRequests.resetTime) {
        requests.set(identifier, { count: 1, resetTime: now + windowMs });
        return next();
      }
      
      if (userRequests.count >= max) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((userRequests.resetTime - now) / 1000),
        });
      }
      
      userRequests.count++;
      next();
    };
  }

  public compressionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';
      
      if (acceptEncoding.includes('gzip')) {
        res.set('Content-Encoding', 'gzip');
      } else if (acceptEncoding.includes('deflate')) {
        res.set('Content-Encoding', 'deflate');
      }
      
      next();
    };
  }

  public async getMetrics() {
    const [performanceStats, cacheStats, dbStats] = await Promise.all([
      performanceMonitor.getAggregatedMetrics(),
      this.cache.getStats(),
      this.dbOptimizer.getStats(),
    ]);

    const requestStats = this.analyzeRequestMetrics();
    
    return {
      performance: performanceStats,
      cache: cacheStats,
      database: dbStats,
      requests: requestStats,
      timestamp: Date.now(),
    };
  }

  private analyzeRequestMetrics() {
    const now = Date.now();
    const last5Minutes = this.requestMetrics.filter(m => m.timestamp > now - 300000);
    const last1Hour = this.requestMetrics.filter(m => m.timestamp > now - 3600000);
    
    const calculateStats = (metrics: RequestMetrics[]) => {
      if (metrics.length === 0) return { count: 0, avgResponseTime: 0, errorRate: 0 };
      
      const totalTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
      const errors = metrics.filter(m => m.statusCode >= 400).length;
      
      return {
        count: metrics.length,
        avgResponseTime: totalTime / metrics.length,
        errorRate: (errors / metrics.length) * 100,
      };
    };

    return {
      last5Minutes: calculateStats(last5Minutes),
      last1Hour: calculateStats(last1Hour),
      slowRequests: this.requestMetrics.filter(m => m.responseTime > this.options.slowRequestThreshold!).length,
      topEndpoints: this.getTopEndpoints(last1Hour),
    };
  }

  private getTopEndpoints(metrics: RequestMetrics[]): Array<{ endpoint: string; count: number; avgResponseTime: number }> {
    const endpoints = new Map<string, { count: number; totalTime: number }>();
    
    metrics.forEach(metric => {
      const endpoint = `${metric.method} ${metric.url}`;
      const existing = endpoints.get(endpoint) || { count: 0, totalTime: 0 };
      endpoints.set(endpoint, {
        count: existing.count + 1,
        totalTime: existing.totalTime + metric.responseTime,
      });
    });
    
    return Array.from(endpoints.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgResponseTime: stats.totalTime / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  public async generatePerformanceReport(): Promise<string> {
    const metrics = await this.getMetrics();
    const healthChecks = await this.runHealthChecks();
    
    return `
=== Universal AI Tools Performance Report ===
Generated: ${new Date().toISOString()}

=== System Health ===
Overall Health: ${healthChecks.overall ? '✅ HEALTHY' : '❌ UNHEALTHY'}
Cache Health: ${healthChecks.cache ? '✅ HEALTHY' : '❌ UNHEALTHY'}
Database Health: ${healthChecks.database ? '✅ HEALTHY' : '❌ UNHEALTHY'}

=== Performance Metrics ===
Average Memory Usage: ${metrics.performance.averageMemoryUsage.toFixed(2)}MB
Peak Memory Usage: ${metrics.performance.peakMemoryUsage}MB
Average Response Time: ${metrics.performance.averageResponseTime.toFixed(2)}ms
Peak Response Time: ${metrics.performance.peakResponseTime}ms
Total Requests: ${metrics.performance.totalRequests}
Error Rate: ${metrics.performance.errorRate.toFixed(2)}%

=== Cache Performance ===
Hit Rate: ${metrics.cache.hitRate.toFixed(2)}%
Total Hits: ${metrics.cache.hits}
Total Misses: ${metrics.cache.misses}
Average Response Time: ${metrics.cache.avgResponseTime.toFixed(2)}ms
Memory Usage: ${(metrics.cache.memoryUsage / 1024 / 1024).toFixed(2)}MB
Key Count: ${metrics.cache.keyCount}

=== Database Performance ===
Total Queries: ${metrics.database.totalQueries}
Cached Queries: ${metrics.database.cachedQueries}
Average Response Time: ${metrics.database.avgResponseTime.toFixed(2)}ms
Slow Queries: ${metrics.database.slowQueries}
Error Rate: ${((metrics.database.errors / metrics.database.totalQueries) * 100).toFixed(2)}%

=== Request Analytics ===
Last 5 Minutes: ${metrics.requests.last5Minutes.count} requests
Last Hour: ${metrics.requests.last1Hour.count} requests
Slow Requests: ${metrics.requests.slowRequests}

=== Top Endpoints ===
${metrics.requests.topEndpoints.map(ep => 
  `${ep.endpoint}: ${ep.count} requests (${ep.avgResponseTime.toFixed(2)}ms avg)`
).join('\n')}

=== Recommendations ===
${this.generateRecommendations(metrics)}
`;
  }

  private generateRecommendations(metrics: any): string {
    const recommendations: string[] = [];
    
    if (metrics.performance.averageMemoryUsage > 800) {
      recommendations.push('• Consider increasing memory limits or optimizing memory usage');
    }
    
    if (metrics.performance.averageResponseTime > 1000) {
      recommendations.push('• Response times are high - consider optimizing slow endpoints');
    }
    
    if (metrics.cache.hitRate < 70) {
      recommendations.push('• Cache hit rate is low - review caching strategy');
    }
    
    if (metrics.database.avgResponseTime > 500) {
      recommendations.push('• Database queries are slow - consider adding indexes or optimizing queries');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('• System is performing well - no immediate optimizations needed');
    }
    
    return recommendations.join('\n');
  }

  private async runHealthChecks() {
    const [cacheHealth, dbHealth] = await Promise.all([
      this.cache.healthCheck(),
      this.dbOptimizer.healthCheck(),
    ]);
    
    return {
      overall: cacheHealth.healthy && dbHealth.healthy,
      cache: cacheHealth.healthy,
      database: dbHealth.healthy,
    };
  }

  public async close(): Promise<void> {
    performanceMonitor.stopMonitoring();
    await this.cache.close();
  }
}

export default PerformanceMiddleware;
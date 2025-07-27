import type { NextFunction, Request, Response } from 'express';
import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { LogContext, logger } from '../utils/enhanced-logger';
import * as prometheus from 'prom-client';

// Define metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const activeRequests = new prometheus.Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests',
});

const cacheHits = new prometheus.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
});

const cacheMisses = new prometheus.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
});

const memoryUsage = new prometheus.Gauge({
  name: 'nodejs_memory_usage_bytes',
  help: 'Node.js memory usage',
  labelNames: ['type'],
});

export interface ProductionPerformanceOptions {
  enableRequestTiming?: boolean;
  enableMemoryMonitoring?: boolean;
  enableCaching?: boolean;
  enableCompression?: boolean;
  slowRequestThreshold?: number;
  memoryThreshold?: number;
  requestTimeoutMs?: number;
  cacheSize?: number;
  cacheTTL?: number;
}

interface CacheEntry {
  data: any;
  contentType: string;
  expires: number;
  etag: string;
  compressed?: Buffer;
}

interface RequestMetric {
  url: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userAgent?: string;
  ip?: string;
  cached?: boolean;
}

export class ProductionPerformanceMiddleware extends EventEmitter {
  private options: Required<ProductionPerformanceOptions>;
  private cache: Map<string, CacheEntry> = new Map();
  private requestMetrics: RequestMetric[] = [];
  private cleanupInterval: NodeJS.Timeout;
  private memoryMonitorInterval!: NodeJS.Timeout;

  constructor(options: ProductionPerformanceOptions = {}) {
    super();

    this.options = {
      enableRequestTiming: options.enableRequestTiming ?? true,
      enableMemoryMonitoring: options.enableMemoryMonitoring ?? true,
      enableCaching: options.enableCaching ?? true,
      enableCompression: options.enableCompression ?? true,
      slowRequestThreshold: options.slowRequestThreshold ?? 2000,
      memoryThreshold: options.memoryThreshold ?? 1024,
      requestTimeoutMs: options.requestTimeoutMs ?? 5000,
      cacheSize: options.cacheSize ?? 1000,
      cacheTTL: options.cacheTTL ?? 300000, // 5 minutes
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
      this.cleanupMetrics();
    }, 60000); // Every minute

    // Start memory monitoring
    if (this.options.enableMemoryMonitoring) {
      this.memoryMonitorInterval = setInterval(() => {
        this.updateMemoryMetrics();
      }, 5000); // Every 5 seconds
    }

    logger.info('Production performance middleware initialized', LogContext.PERFORMANCE, {
      options: this.options,
    });
  }

  private updateMemoryMetrics(): void {
    const usage = process.memoryUsage();
    memoryUsage.set({ type: 'heapUsed' }, usage.heapUsed);
    memoryUsage.set({ type: 'heapTotal' }, usage.heapTotal);
    memoryUsage.set({ type: 'rss' }, usage.rss);
    memoryUsage.set({ type: 'external' }, usage.external);

    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    if (heapUsedMB > this.options.memoryThreshold) {
      this.emit('memory-threshold-exceeded', {
        current: heapUsedMB,
        threshold: this.options.memoryThreshold,
      });
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    // If cache is still too large, remove oldest entries
    if (this.cache.size > this.options.cacheSize) {
      const sortedEntries = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].expires - b[1].expires
      );

      const toRemove = this.cache.size - this.options.cacheSize;
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(sortedEntries[i][0]);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} cache entries`, LogContext.PERFORMANCE);
    }
  }

  private cleanupMetrics(): void {
    const oneHourAgo = Date.now() - 3600000;
    const beforeCleanup = this.requestMetrics.length;

    this.requestMetrics = this.requestMetrics.filter((m) => m.timestamp > oneHourAgo);

    // Keep only last 10000 metrics
    if (this.requestMetrics.length > 10000) {
      this.requestMetrics = this.requestMetrics.slice(-10000);
    }

    const removed = beforeCleanup - this.requestMetrics.length;
    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} _requestmetrics`, LogContext.PERFORMANCE);
    }
  }

  private generateETag(data: any): string {
    const hash = createHash('md5');
    hash.update(JSON.stringify(data));
    return `"${hash.digest('hex')}"`;
  }

  private createCacheKey(req: Request): string {
    const { method, originalUrl, headers } = req;
    const accept = headers.accept || '';
    const authorization = headers.authorization ? 'auth' : 'noauth';
    return `${method}:${originalUrl}:${accept}:${authorization}`;
  }

  public requestTimer() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableRequestTiming) {
        return next();
      }

      const startTime = process.hrtime.bigint();
      activeRequests.inc();

      // Set _requesttimeout
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({
            _error 'Request timeout',
            message: `Request exceeded ${this.options.requestTimeoutMs}ms timeout`,
          });
        }
      }, this.options.requestTimeoutMs);

      // Override res.end to capture metrics
      const originalEnd = res.end;
      const self = this;

      res.end = function (this: Response, ...args: any[]) {
        clearTimeout(timeout);
        activeRequests.dec();

        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        // Prometheus metrics
        const route = req.route?.path || req.path || 'unknown';
        const labels = {
          method: req.method,
          route,
          status_code: res.statusCode.toString(),
        };

        httpRequestDuration.observe(labels, responseTime / 1000); // Convert to seconds
        httpRequestTotal.inc(labels);

        // Internal metrics
        const metric: RequestMetric = {
          url: req.originalUrl || req.url,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: Date.now(),
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.socket.remoteAddress,
          cached: res.getHeader('X-Cache') === 'HIT',
        };

        self.requestMetrics.push(metric);

        // Log slow requests
        if (responseTime > self.options.slowRequestThreshold) {
          logger.warn('Slow _requestdetected', LogContext.PERFORMANCE, {
            ...metric,
            threshold: self.options.slowRequestThreshold,
          });
          self.emit('slow-_request, metric);
        }

        // Log errors
        if (res.statusCode >= 400) {
          logger.error'Request _error, LogContext.PERFORMANCE, metric);
        }

        // Add performance headers
        res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
        res.set('X-Performance-Mode', 'production');

        return originalEnd.apply(this, args as any);
      };

      next();
    };
  }

  public cacheMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableCaching || req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.createCacheKey(req);
      const cached = this.cache.get(cacheKey);

      if (cached && cached.expires > Date.now()) {
        // Check ETag
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch === cached.etag) {
          res.status(304).end();
          cacheHits.inc({ cache_type: 'etag' });
          return;
        }

        // Return cached response
        res.set('Content-Type', cached.contentType);
        res.set('X-Cache', 'HIT');
        res.set('ETag', cached.etag);
        res.set('Cache-Control', `max-age=${Math.floor((cached.expires - Date.now()) / 1000)}`);

        if (cached.compressed && this.acceptsCompression(req)) {
          res.set('Content-Encoding', 'gzip');
          res.send(cached.compressed);
        } else {
          res.json(cached.data);
        }

        cacheHits.inc({ cache_type: 'memory' });
        return;
      }

      cacheMisses.inc({ cache_type: 'memory' });

      // Intercept response to cache it
      const originalJson = res.json;
      const self = this;

      res.json = function (this: Response, body: any) {
        if (res.statusCode < 400 && self.options.enableCaching) {
          const etag = self.generateETag(body);
          const cacheEntry: CacheEntry = {
            data: body,
            contentType: 'application/json',
            expires: Date.now() + self.options.cacheTTL,
            etag,
          };

          // Compress if enabled
          if (self.options.enableCompression) {
            // Note: In production, you'd use zlib here
            // For now, we'll skip compression
          }

          self.cache.set(cacheKey, cacheEntry);

          res.set('ETag', etag);
          res.set('Cache-Control', `max-age=${Math.floor(self.options.cacheTTL / 1000)}`);
          res.set('X-Cache', 'MISS');
        }

        return originalJson.call(this, body);
      };

      next();
    };
  }

  private acceptsCompression(req: Request): boolean {
    const acceptEncoding = req.headers['accept-encoding'] || '';
    return acceptEncoding.includes('gzip');
  }

  public compressionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableCompression) {
        return next();
      }

      const acceptEncoding = req.headers['accept-encoding'] || '';

      if (acceptEncoding.includes('gzip')) {
        res.set('Content-Encoding', 'gzip');
        // Note: Actual compression would be handled by a library like compression
      } else if (acceptEncoding.includes('deflate')) {
        res.set('Content-Encoding', 'deflate');
      }

      next();
    };
  }

  public rateLimiter(windowMs = 900000, max = 1000) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    // Cleanup old entries periodically
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of requests.entries()) {
        if (now > entry.resetTime) {
          requests.delete(key);
        }
      }
    }, 60000); // Every minute

    return (req: Request, res: Response, next: NextFunction) => {
      const identifier = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      const userRequests = requests.get(identifier);

      if (!userRequests || now > userRequests.resetTime) {
        requests.set(identifier, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (userRequests.count >= max) {
        const retryAfter = Math.ceil((userRequests.resetTime - now) / 1000);
        res.set('Retry-After', retryAfter.toString());
        res.set('X-RateLimit-Limit', max.toString());
        res.set('X-RateLimit-Remaining', '0');
        res.set('X-RateLimit-Reset', new Date(userRequests.resetTime).toISOString());

        return res.status(429).json({
          _error 'Too many requests',
          retryAfter,
          limit: max,
          windowMs,
        });
      }

      userRequests.count++;

      // Add rate limit headers
      res.set('X-RateLimit-Limit', max.toString());
      res.set('X-RateLimit-Remaining', (max - userRequests.count).toString());
      res.set('X-RateLimit-Reset', new Date(userRequests.resetTime).toISOString());

      next();
    };
  }

  public async getMetrics() {
    const now = Date.now();
    const last5Minutes = this.requestMetrics.filter((m) => m.timestamp > now - 300000);
    const last1Hour = this.requestMetrics.filter((m) => m.timestamp > now - 3600000);

    const calculateStats = (metrics: RequestMetric[]) => {
      if (metrics.length === 0) {
        return {
          count: 0,
          avgResponseTime: 0,
          errorRate: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          cacheHitRate: 0,
        };
      }

      const responseTimes = metrics.map((m) => m.responseTime).sort((a, b) => a - b);
      const totalTime = responseTimes.reduce((sum, time) => sum + time, 0);
      const errors = metrics.filter((m) => m.statusCode >= 400).length;
      const cacheHits = metrics.filter((m) => m.cached).length;

      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);

      return {
        count: metrics.length,
        avgResponseTime: totalTime / metrics.length,
        errorRate: (errors / metrics.length) * 100,
        p95ResponseTime: responseTimes[p95Index] || 0,
        p99ResponseTime: responseTimes[p99Index] || 0,
        cacheHitRate: (cacheHits / metrics.length) * 100,
      };
    };

    const memoryUsage = process.memoryUsage();

    return {
      mode: 'production',
      last5Minutes: calculateStats(last5Minutes),
      last1Hour: calculateStats(last1Hour),
      totalMetrics: this.requestMetrics.length,
      cacheSize: this.cache.size,
      memory: {
        heapUsed: memoryUsage.heapUsed / 1024 / 1024,
        heapTotal: memoryUsage.heapTotal / 1024 / 1024,
        rss: memoryUsage.rss / 1024 / 1024,
        external: memoryUsage.external / 1024 / 1024,
      },
      uptime: process.uptime(),
      timestamp: now,
    };
  }

  public async generatePerformanceReport(): Promise<string> {
    const metrics = await this.getMetrics();
    const now = new Date().toISOString();

    return `
=== Universal AI Tools Performance Report (Production) ===
Generated: ${now}

=== System Status ===
Mode: PRODUCTION
Uptime: ${Math.floor(metrics.uptime / 3600)}h ${Math.floor((metrics.uptime % 3600) / 60)}m
Cache Size: ${metrics.cacheSize} entries

=== Memory Usage ===
Heap Used: ${metrics.memory.heapUsed.toFixed(2)}MB
Heap Total: ${metrics.memory.heapTotal.toFixed(2)}MB
RSS: ${metrics.memory.rss.toFixed(2)}MB
External: ${metrics.memory.external.toFixed(2)}MB

=== Request Statistics (Last 5 Minutes) ===
Total Requests: ${metrics.last5Minutes.count}
Average Response Time: ${metrics.last5Minutes.avgResponseTime.toFixed(2)}ms
P95 Response Time: ${metrics.last5Minutes.p95ResponseTime.toFixed(2)}ms
P99 Response Time: ${metrics.last5Minutes.p99ResponseTime.toFixed(2)}ms
Error Rate: ${metrics.last5Minutes.errorRate.toFixed(2)}%
Cache Hit Rate: ${metrics.last5Minutes.cacheHitRate.toFixed(2)}%

=== Request Statistics (Last Hour) ===
Total Requests: ${metrics.last1Hour.count}
Average Response Time: ${metrics.last1Hour.avgResponseTime.toFixed(2)}ms
P95 Response Time: ${metrics.last1Hour.p95ResponseTime.toFixed(2)}ms
P99 Response Time: ${metrics.last1Hour.p99ResponseTime.toFixed(2)}ms
Error Rate: ${metrics.last1Hour.errorRate.toFixed(2)}%
Cache Hit Rate: ${metrics.last1Hour.cacheHitRate.toFixed(2)}%

=== Performance Features ===
• Request timing with ${this.options.requestTimeoutMs}ms timeout
• In-memory caching with ${this.options.cacheTTL}ms TTL
• ETag support for conditional requests
• Rate limiting protection
• Prometheus metrics integration
• Memory monitoring with ${this.options.memoryThreshold}MB threshold
• Slow _requestdetection (>${this.options.slowRequestThreshold}ms)

=== Notes ===
• Production-ready without external dependencies
• Automatic cleanup of old metrics and cache entries
• Event-driven architecture for threshold monitoring
`;
  }

  public close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    this.cache.clear();
    this.requestMetrics = [];
    logger.info('Production performance middleware closed', LogContext.PERFORMANCE);
  }
}

export function createProductionPerformanceMiddleware(options?: ProductionPerformanceOptions) {
  return new ProductionPerformanceMiddleware(options);
}

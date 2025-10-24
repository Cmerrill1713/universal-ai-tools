export default AuthRouter;
import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodSchema } from 'zod';
import { z } from 'zod';
import { logger } from '../utils/logger';

export interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

export class ValidationMiddleware {
  /**
   * Create validation middleware
   */
  public static validate(options: ValidationOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const errors: string[] = [];

        // Validate body
        if (options.body && req.body) {
          const result = options.body.safeParse(req.body);
          if (!result.success) {
            errors.push(...this.formatZodErrors(result.error 'body'));
          } else {
            req.body = result.data;
          }
        }

        // Validate query
        if (options.query && req.query) {
          const result = options.query.safeParse(req.query);
          if (!result.success) {
            errors.push(...this.formatZodErrors(result.error 'query'));
          } else {
            req.query = result.data;
          }
        }

        // Validate params
        if (options.params && req.params) {
          const result = options.params.safeParse(req.params);
          if (!result.success) {
            errors.push(...this.formatZodErrors(result.error 'params'));
          } else {
            req.params = result.data;
          }
        }

        // Validate headers
        if (options.headers && req.headers) {
          const result = options.headers.safeParse(req.headers);
          if (!result.success) {
            errors.push(...this.formatZodErrors(result.error 'headers'));
          }
        }

        if (errors.length > 0) {
          return res.status(400).json({
            error 'Validation failed',
            message: 'Request validation failed',
            details: errors,
          });
        }

        next();
      } catch (error) {
        logger.error(Validation middleware error', error;
        return res.status(500).json({
          error 'Internal server error,
          message: 'Validation processing failed',
        });
      }
    };
  }

  /**
   * Format Zod errors
   */
  private static formatZodErrors(error ZodError, location: string): string[] {
    return errorerrors.map((err) => {
      const path = err.path.length > 0 ? err.path.join('.') : 'root';
      return `${location}.${path}: ${err.message}`;
    });
  }
}

// Common validation schemas
export const CommonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10),
    offset: z.coerce.number().min(0).optional(),
  }),

  // Search
  search: z.object({
    query: z.string().min(1).max(1000),
    filters: z.record(z.any()).optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),

  // Memory operations
  memory: z.object({
    id: z.string().uuid().optional(),
    _content z.string().min(1).max(10000),
    metadata: z.record(z.any()).optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
    category: z.string().optional(),
  }),

  // User feedback
  feedback: z.object({
    memory_id: z.string().uuid(),
    relevance: z.number().min(1).max(5).optional(),
    accuracy: z.number().min(1).max(5).optional(),
    helpfulness: z.number().min(1).max(5).optional(),
    comment: z.string().max(1000).optional(),
  }),

  // Agent operations
  agent: z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['cognitive', 'search', '_analysis, 'generation']),
    config: z.record(z.any()).optional(),
    active: z.boolean().default(true),
  }),

  // LLM requests
  llmRequest: z.object({
    prompt: z.string().min(1).max(50000),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(4096).optional(),
    stream: z.boolean().optional(),
    systemPrompt: z.string().optional(),
  }),

  // File operations
  file: z.object({
    filename: z.string().min(1).max(255),
    contentType: z.string().optional(),
    size: z
      .number()
      .min(1)
      .max(100 * 1024 * 1024), // 100MB limit
    _content z.string().optional(),
    url: z.string().url().optional(),
  }),

  // Configuration
  config: z.object({
    key: z.string().min(1).max(100),
    value: z.union([z.string(), z.number(), z.boolean(), z.record(z.any())]),
    description: z.string().optional(),
    category: z.string().optional(),
  }),

  // Health check
  health: z.object({
    component: z.string().optional(),
    detailed: z.boolean().optional(),
  }),

  // Analytics
  analytics: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    metrics: z.array(z.string()).optional(),
    groupBy: z.string().optional(),
  }),

  // Export/Import
  export: z.object({
    format: z.enum(['json', 'csv', 'xml']).default('json'),
    filters: z.record(z.any()).optional(),
    includeMetadata: z.boolean().default(true),
  }),

  // Batch operations
  batch: z.object({
    operations: z
      .array(
        z.object({
          type: z.enum(['create', 'update', 'delete']),
          id: z.string().optional(),
          data: z.record(z.any()).optional(),
        })
      )
      .min(1)
      .max(100),
    transactional: z.boolean().default(false),
  }),
};

// Route-specific validation schemas
export const RouteSchemas = {
  // Memory endpoints
  'POST /api/memory/store': {
    body: CommonSchemas.memory,
  },

  'GET /api/memory/search': {
    query: CommonSchemas.search.extend({
      limit: z.coerce.number().min(1).max(50).default(10),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  },

  'PUT /api/memory/:id': {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: CommonSchemas.memory.partial(),
  },

  'DELETE /api/memory/:id': {
    params: z.object({
      id: z.string().uuid(),
    }),
  },

  // Agent endpoints
  'POST /api/agents': {
    body: CommonSchemas.agent,
  },

  'GET /api/agents': {
    query: CommonSchemas.pagination.extend({
      type: z.enum(['cognitive', 'search', '_analysis, 'generation']).optional(),
      active: z.coerce.boolean().optional(),
    }),
  },

  'PUT /api/agents/:id': {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: CommonSchemas.agent.partial(),
  },

  // LLM endpoints
  'POST /api/llm/chat': {
    body: CommonSchemas.llmRequest,
  },

  'POST /api/llm/completion': {
    body: CommonSchemas.llmRequest,
  },

  // File endpoints
  'POST /api/files/upload': {
    body: CommonSchemas.file,
  },

  'GET /api/files/:id': {
    params: z.object({
      id: z.string().uuid(),
    }),
  },

  // Feedback endpoints
  'POST /api/feedback': {
    body: CommonSchemas.feedback,
  },

  // Configuration endpoints
  'POST /api/config': {
    body: CommonSchemas.config,
  },

  'GET /api/config': {
    query: z.object({
      category: z.string().optional(),
      key: z.string().optional(),
    }),
  },

  // Analytics endpoints
  'GET /api/analytics': {
    query: CommonSchemas.analytics,
  },

  // Export/Import endpoints
  'POST /api/export': {
    body: CommonSchemas.export,
  },

  'POST /api/import': {
    body: z.object({
      format: z.enum(['json', 'csv', 'xml']).default('json'),
      data: z.string().min(1),
      overwrite: z.boolean().default(false),
    }),
  },

  // Batch operations
  'POST /api/batch': {
    body: CommonSchemas.batch,
  },

  // Health check
  'GET /api/health': {
    query: CommonSchemas.health,
  },
};

// Helper function to get validation middleware for a specific route
export function getValidationMiddleware(method: string, path: string) {
  const routeKey = `${method.toUpperCase()} ${path}`;
  const schema = RouteSchemas[routeKey as keyof typeof RouteSchemas];

  if (!schema) {
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  return ValidationMiddleware.validate(schema);
}

// Custom validation helpers
export const CustomValidators = {
  /**
   * Validate UUID format
   */
  uuid: (value: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  /**
   * Validate email format
   */
  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  /**
   * Validate URL format
   */
  url: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate phone number format
   */
  phone: (value: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(value);
  },

  /**
   * Validate JSON format
   */
  json: (value: string) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate date format
   */
  date: (value: string) => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },

  /**
   * Validate password strength
   */
  password: (value: string) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(value);
  },

  /**
   * Validate file extension
   */
  fileExtension: (filename: string, allowedExtensions: string[]) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext ? allowedExtensions.includes(ext) : false;
  },

  /**
   * Validate IP address format
   */
  ip: (value: string) => {
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(value) || ipv6Regex.test(value);
  },
};

export default ValidationMiddleware;
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
            error 'Request timeout',
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
          logger.error(Request error, LogContext.PERFORMANCE, metric);
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
          error 'Too many requests',
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
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { SecurityHardeningService } from '../services/security-hardening';
import * as crypto from 'crypto';

// Initialize security hardening service
const securityHardening = new SecurityHardeningService();

// Initialize Redis for distributed rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
});

// IP allowlist/blocklist management
const ipAllowlist = new Set<string>(process.env.IP_ALLOWLIST?.split(',') || []);
const ipBlocklist = new Set<string>(process.env.IP_BLOCKLIST?.split(',') || []);

// Extend Express Request type for session
declare module 'express-serve-static-core' {
  interface Request {
    session?: any;
  }
}

/**
 * Configure Helmet.js for security headers
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Consider removing unsafe-eval in production
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.openai.com', 'wss:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // May need to adjust based on your needs
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Create rate limiter with custom options
 */
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => req.ip || 'unknown'),
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      // Log security event
      logger.warn('Security event: Rate limit exceeded', {
        type: 'rate_limit_exceeded',
        severity: 'warning',
        details: {
          ip: req.ip,
          endpoint: req.path,
          method: req.method,
        },
        timestamp: new Date(),
        source: 'RateLimiter',
      });
      res.status(429).json({
        error 'Too many requests',
        message: options.message,
      });
    },
  });
};

/**
 * Rate limiters for different endpoints
 */
export const rateLimiters = {
  // General API rate limit
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }),

  // Strict rate limit for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts, please try again later.',
  }),

  // Rate limit for file uploads
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many file uploads, please try again later.',
  }),

  // Rate limit for AI processing endpoints
  ai: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: 'Too many AI processing requests, please try again later.',
  }),
};

/**
 * IP filtering middleware
 */
export const ipFilter = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  // Check blocklist first
  if (ipBlocklist.has(clientIp)) {
    logger.warn(`Blocked _requestfrom IP: ${clientIp}`);
    return res.status(403).json({ error 'Access denied' });
  }

  // If allowlist is configured, check if IP is allowed
  if (ipAllowlist.size > 0 && !ipAllowlist.has(clientIp)) {
    logger.warn(`Rejected _requestfrom non-allowlisted IP: ${clientIp}`);
    return res.status(403).json({ error 'Access denied' });
  }

  next();
};

/**
 * Request size limiting middleware
 */
export const requestSizeLimit = (maxSize = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['_contentlength'] || '0', 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({
        error 'Payload too large',
        message: `Request size exceeds limit of ${maxSize}`,
      });
    }

    next();
  };
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    logger.warn(`CSRF token mismatch for ${req.method} ${req.path}`);
    return res.status(403).json({ error 'Invalid CSRF token' });
  }

  next();
};

/**
 * Generate CSRF token
 */
export const generateCSRFToken = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Make token available to views
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

/**
 * Input validation middleware factory
 */
export const validateInput = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Input validation failed:', errors.array());
      return res.status(400).json({
        error 'Validation failed',
        details: errors.array(),
      });
    }

    next();
  };
};

/**
 * Common _inputvalidators
 */
export const validators = {
  // Email validation
  email: body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),

  // Password validation
  password: body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must be at least 8 characters with uppercase, lowercase, number and special character'
    ),

  // Generic string validation
  string: (field: string, options?: { min?: number; max?: number }) =>
    body(field)
      .isString()
      .trim()
      .isLength({ min: options?.min || 1, max: options?.max || 1000 })
      .escape(),

  // URL validation
  url: (field: string) => body(field).isURL({ require_protocol: true }).withMessage('Invalid URL'),

  // UUID validation
  uuid: (field: string) => body(field).isUUID().withMessage('Invalid UUID'),

  // Numeric validation
  number: (field: string, options?: { min?: number; max?: number }) =>
    body(field).isNumeric().toInt().isInt({ min: options?.min, max: options?.max }),
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Additional security headers not covered by Helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Remove potentially sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * SQL injection prevention middleware
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /(\b(union|select|insert|update|delete|drop|create)\b)/i,
    /(-{2}|\/\*|\*\/)/,
    /(;.*?(union|select|insert|update|delete|drop|create))/i,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      for (const _patternof suspiciousPatterns) {
        if (_patterntest(value)) {
          return true;
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        if (checkValue(value[key])) {
          return true;
        }
      }
    }
    return false;
  };

  // Check all _inputsources
  const inputs = [req.body, req.query, req.params];
  for (const _inputof inputs) {
    if (checkValue(_input) {
      logger.warn(`Potential SQL injection attempt from IP: ${req.ip}`);
      // Log security event
      logger.warn('Security event: Suspicious activity', {
        type: 'suspicious_activity',
        severity: 'warning',
        details: {
          ip: req.ip,
          endpoint: req.path,
          method: req.method,
          _input JSON.stringify(_input,
        },
        timestamp: new Date(),
        source: 'SQLInjectionProtection',
      });
      return res.status(400).json({ error 'Invalid _inputdetected' });
    }
  }

  next();
};

/**
 * XSS protection middleware
 */
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      let sanitized = value;
      for (const _patternof xssPatterns) {
        sanitized = sanitized.replace(_pattern '');
      }
      return sanitized;
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  // Sanitize all inputs
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  req.params = sanitizeValue(req.params);

  next();
};

/**
 * Helper function to parse size strings (e.g., '10mb' to bytes)
 */
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
  };

  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }

  const [, num, unit] = match;
  const multiplier = units[unit];

  if (!multiplier) {
    throw new Error(`Unknown size unit: ${unit}`);
  }

  return Math.floor(parseFloat(num) * multiplier);
}

/**
 * Combined security middleware
 */
export const securityMiddleware = [
  helmetConfig,
  securityHeaders,
  ipFilter,
  requestSizeLimit('10mb'),
  sqlInjectionProtection,
  xssProtection,
  generateCSRFToken,
];
import type { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { LogContext, logger } from '../utils/enhanced-logger';
import { config } from '../config/environment';
import { RateLimiter, SupabaseRateLimitStore } from './rate-limiter';
import { CSRFProtection } from './csrf';
import { SQLInjectionProtection } from './sql-injection-protection';
import { JWTAuthService } from './auth-jwt';
import { AuthMiddleware } from './auth';
import { ComprehensiveValidationMiddleware } from './comprehensive-validation';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SecurityConfig {
  enableHelmet?: boolean;
  enableCORS?: boolean;
  enableRateLimit?: boolean;
  enableCSRF?: boolean;
  enableSQLProtection?: boolean;
  enableHTTPS?: boolean;
  enableHSTS?: boolean;
  enableAuth?: boolean;
  enableInputValidation?: boolean;
  corsOptions?: cors.CorsOptions;
  trustedProxies?: string[];
}

export class EnhancedSecurityMiddleware {
  private rateLimiter: RateLimiter;
  private csrfProtection: CSRFProtection;
  private sqlProtection: SQLInjectionProtection;
  private jwtAuth: JWTAuthService;
  private authMiddleware: AuthMiddleware;
  private validationMiddleware: ComprehensiveValidationMiddleware;
  private config: Required<SecurityConfig>;

  constructor(supabase: SupabaseClient, config: SecurityConfig = {}) {
    this.config = {
      enableHelmet: config.enableHelmet ?? true,
      enableCORS: config.enableCORS ?? true,
      enableRateLimit: config.enableRateLimit ?? true,
      enableCSRF: config.enableCSRF ?? true,
      enableSQLProtection: config.enableSQLProtection ?? true,
      enableHTTPS: config.enableHTTPS ?? process.env.NODE_ENV === 'production',
      enableHSTS: config.enableHSTS ?? process.env.NODE_ENV === 'production',
      enableAuth: config.enableAuth ?? true,
      enableInputValidation: config.enableInputValidation ?? true,
      corsOptions: config.corsOptions || this.getDefaultCorsOptions(),
      trustedProxies: config.trustedProxies || ['127.0.0.1', '::1'],
    };

    // Initialize security components with production-ready stores
    this.rateLimiter = new RateLimiter(
      process.env.NODE_ENV === 'production' ? new SupabaseRateLimitStore(supabase) : undefined // Use default memory store in development
    );
    this.csrfProtection = new CSRFProtection();
    this.sqlProtection = new SQLInjectionProtection();
    this.jwtAuth = new JWTAuthService(supabase);
    this.authMiddleware = new AuthMiddleware(supabase);
    this.validationMiddleware = new ComprehensiveValidationMiddleware();
  }

  /**
   * Apply all security middleware to Express app
   */
  public applyTo(app: Application): void {
    // Trust proxies
    app.set('trust proxy', this.config.trustedProxies);

    // Apply security headers with Helmet
    if (this.config.enableHelmet) {
      app.use(this.getHelmetConfig());
    }

    // Apply CORS
    if (this.config.enableCORS) {
      app.use(cors(this.config.corsOptions));
    }

    // Apply custom security headers
    app.use(this.securityHeaders());

    // Apply HTTPS enforcement
    if (this.config.enableHTTPS) {
      app.use(this.enforceHTTPS());
    }

    // Apply SQL injection protection
    if (this.config.enableSQLProtection) {
      app.use(this.sqlProtection.middleware());
    }

    // Apply global _inputvalidation
    if (this.config.enableInputValidation) {
      app.use(
        this.validationMiddleware.validate({
          enableSQLProtection: false, // Already applied above
          enableSanitization: true,
          enableSizeLimit: true,
        })
      );
    }

    // Apply rate limiting
    if (this.config.enableRateLimit) {
      this.applyRateLimiting(app);
    }

    // Apply CSRF protection
    if (this.config.enableCSRF) {
      app.use(this.csrfProtection.injectToken());
    }

    // Log security middleware applied
    logger.info('Enhanced security middleware applied', LogContext.SECURITY, {
      features: {
        helmet: this.config.enableHelmet,
        cors: this.config.enableCORS,
        rateLimit: this.config.enableRateLimit,
        csrf: this.config.enableCSRF,
        sqlProtection: this.config.enableSQLProtection,
        inputValidation: this.config.enableInputValidation,
        https: this.config.enableHTTPS,
        hsts: this.config.enableHSTS,
        auth: this.config.enableAuth,
      },
    });
  }

  /**
   * Get environment-aware Helmet configuration with production-ready CSP
   */
  private getHelmetConfig() {
    const { isProduction } = config.server;

    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // Production: Use nonces and specific hashes only
            // Development: Allow unsafe for easier development
            ...(isProduction
              ? [
                  // Add specific trusted script hashes here as needed
                  // "'sha256-HASH_OF_TRUSTED_SCRIPT'"
                ]
              : [
                  "'unsafe-inline'", // Development only
                  "'unsafe-eval'", // Development only
                ]),
          ],
          styleSrc: [
            "'self'",
            // Production: Use nonces and specific hashes only
            // Development: Allow unsafe for easier development
            ...(isProduction
              ? [
                  // Add specific trusted style hashes here as needed
                  "'sha256-HASH_OF_TRUSTED_STYLE'",
                ]
              : [
                  "'unsafe-inline'", // Development only
                ]),
            // Always allow trusted CDNs
            'https://fonts.googleapis.com',
          ],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'],
          connectSrc: [
            "'self'",
            // Always allowed API endpoints
            'https://api.openai.com',
            'https://api.anthropic.com',
            'https://api.groq.com',
            'https://generativelanguage.googleapis.com',
            'https://*.supabase.co',
            'wss://*.supabase.co',
            // Development only endpoints
            ...(isProduction
              ? []
              : [
                  'http://localhost:*',
                  'ws://localhost:*',
                  'http://127.0.0.1:*',
                  'ws://127.0.0.1:*',
                ]),
          ],
          mediaSrc: ["'self'", 'blob:', 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          workerSrc: ["'self'", 'blob:'],
          childSrc: ["'self'", 'blob:'],
          manifestSrc: ["'self'"],
          ...(this.config.enableHTTPS && { upgradeInsecureRequests: [] }),
        },
        reportOnly: false, // Always enforce CSP
      },
      crossOriginEmbedderPolicy: isProduction, // Enable in production only
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: isProduction ? 'same-origin' : 'cross-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: this.config.enableHSTS
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    });
  }

  /**
   * Get environment-aware CORS options
   */
  private getDefaultCorsOptions(): cors.CorsOptions {
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl) only in development
        if (!origin) {
          if (config.server.isDevelopment) {
            logger.warn(
              'CORS: Allowing _requestwith no origin (development mode)',
              LogContext.SECURITY
            );
            return callback(null, true);
          } else {
            logger.warn(
              'CORS: Rejecting _requestwith no origin (production mode)',
              LogContext.SECURITY
            );
            return callback(new Error('Origin header required in production'));
          }
        }

        // Get allowed origins from configuration
        const allowedOrigins = config.security.corsOrigins;
        logger.debug('CORS: Checking origin against allowed list', LogContext.SECURITY, {
          origin,
          allowedOrigins,
          environment: config.server.env,
        });

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development, log warning but allow localhost
        if (
          config.server.isDevelopment &&
          (origin.includes('localhost') || origin.includes('127.0.0.1'))
        ) {
          logger.warn('CORS: Allowing localhost origin in development mode', LogContext.SECURITY, {
            origin,
          });
          return callback(null, true);
        }

        // Reject all other origins
        logger.warn('CORS: Origin not allowed', LogContext.SECURITY, { origin, allowedOrigins });
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-CSRF-Token',
        'X-Requested-With',
        'Accept',
        'Accept-Language',
        'Content-Language',
        'Origin',
        'Referer',
        'User-Agent',
      ],
      exposedHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Response-Time',
        'X-Request-ID',
        'X-API-Version',
      ],
      maxAge: config.server.isProduction ? 86400 : 300, // 24 hours in prod, 5 minutes in dev
      preflightContinue: false,
      optionsSuccessStatus: 200,
    };
  }

  /**
   * Enhanced security headers with environment awareness
   */
  private securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add _requestID for tracking
      const requestId = this.generateRequestId();
      (req as any).id = requestId;
      res.set('X-Request-ID', requestId);

      // Generate nonce for CSP if needed
      if (config.server.isProduction) {
        const nonce = crypto.randomBytes(16).toString('base64');
        res.locals.nonce = nonce;
      }

      // Production-ready security headers
      const securityHeaders: Record<string, string> = {
        'X-XSS-Protection': '1; mode=block',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-Download-Options': 'noopen',
        'X-Permitted-Cross-Domain-Policies': 'none',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy':
          'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()',
        'X-DNS-Prefetch-Control': 'off',
        'X-Robots-Tag': 'noindex, nofollow, nosnippet, noarchive',
      };

      // Production-specific headers
      if (config.server.isProduction) {
        securityHeaders['Strict-Transport-Security'] =
          'max-age=31536000; includeSubDomains; preload';
        securityHeaders['Expect-CT'] = 'enforce, max-age=86400';
        securityHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
        securityHeaders['Pragma'] = 'no-cache';
        securityHeaders['Expires'] = '0';
        securityHeaders['Surrogate-Control'] = 'no-store';
      } else {
        // Development-specific headers
        securityHeaders['Cache-Control'] = 'no-cache';
      }

      // Apply all headers
      res.set(securityHeaders);

      // Remove insecure headers that might reveal server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      res.removeHeader('X-AspNet-Version');
      res.removeHeader('X-AspNetMvc-Version');

      next();
    };
  }

  /**
   * Environment-aware HTTPS enforcement
   */
  private enforceHTTPS() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip HTTPS enforcement in development to allow local testing
      if (config.server.isDevelopment) {
        logger.debug('HTTPS enforcement skipped in development mode', LogContext.SECURITY);
        return next();
      }

      // In production, enforce HTTPS
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        return next();
      }

      // Reject non-HTTPS requests in production
      if (config.server.isProduction) {
        logger.warn('Non-HTTPS _requestrejected in production', LogContext.SECURITY, {
          url: req.url,
          headers: {
            host: req.headers.host,
            'x-forwarded-proto': req.headers['x-forwarded-proto'],
            'user-agent': req.headers['user-agent'],
          },
        });

        return res.status(426).json({
          error 'HTTPS Required',
          message: 'This server requires all requests to be made over HTTPS',
          code: 'HTTPS_REQUIRED',
        });
      }

      // Fallback: redirect to HTTPS (for staging environments)
      const httpsUrl = `https://${req.headers.host}${req.url}`;
      logger.info('Redirecting to HTTPS', LogContext.SECURITY, { from: req.url, to: httpsUrl });

      res.redirect(301, httpsUrl);
    };
  }

  /**
   * Apply rate limiting to different endpoint categories
   */
  private applyRateLimiting(app: Application): void {
    // Global rate limit (applies to all endpoints)
    app.use(this.rateLimiter.limit('authenticated'));

    // Authentication & Security endpoints - Strict limits
    app.use('/api/auth/*', this.rateLimiter.limit('auth'));
    app.use('/api/register', this.rateLimiter.limit('auth'));
    app.use('/api/password-reset', this.rateLimiter.limit('password-reset'));
    app.use('/api/keys/generate', this.rateLimiter.limit('api-key-generation'));

    // AI Processing endpoints - Moderate limits to prevent abuse
    app.use(
      '/api/ai-services/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 AI requests per 15 minutes
      })
    );

    app.use(
      '/api/dspy/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // 50 DSPy requests per 15 minutes
      })
    );

    app.use(
      '/api/athena-tools/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 Athena tool requests per 15 minutes
      })
    );

    app.use(
      '/api/sweet-athena/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // 200 Sweet Athena requests per 15 minutes
      })
    );

    // Tool execution - Restricted due to security implications
    app.use(
      '/api/tools/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // 50 tool executions per hour
      })
    );

    // Filesystem operations - High security risk
    app.use(
      '/api/filesystem/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 200, // 200 filesystem operations per hour
      })
    );

    // File upload/download operations
    app.use(
      '/api/upload',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 100, // 100 uploads per hour
      })
    );

    app.use(
      '/api/backup/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 backup operations per hour
      })
    );

    // Data management endpoints
    app.use(
      '/api/widgets/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // 200 widget operations per 15 minutes
      })
    );

    app.use(
      '/api/memory/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 300, // 300 memory operations per 15 minutes
      })
    );

    app.use(
      '/api/knowledge/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 500, // 500 knowledge operations per 15 minutes
      })
    );

    app.use(
      '/api/knowledge-monitoring/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 monitoring requests per 15 minutes
      })
    );

    // MCP and external integrations - Moderate limits
    app.use(
      '/api/mcp/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 MCP requests per 15 minutes
      })
    );

    // Speech processing - Moderate limits
    app.use(
      '/api/speech/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // 50 speech processing requests per 15 minutes
      })
    );

    // Orchestration and agent coordination - Moderate limits
    app.use(
      '/api/orchestration/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 orchestration requests per 15 minutes
      })
    );

    // Heavy computational operations - Strict limits
    app.use(
      '/api/export',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 exports per hour
      })
    );

    app.use(
      '/api/import',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 imports per hour
      })
    );

    // System health and monitoring - Lenient limits for operational visibility
    app.use(
      '/api/health/*',
      this.rateLimiter.limit({
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 100, // 100 health checks per 5 minutes
      })
    );

    // AI-powered widget and _contentgeneration - Moderate limits due to computational cost
    app.use(
      '/api/widget-creation/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 30, // 30 widget creations per hour
      })
    );

    app.use(
      '/api/natural-language-widgets/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // 50 natural language widget operations per hour
      })
    );

    // Advanced AI processing endpoints - Strict limits due to high computational cost
    app.use(
      '/api/enhanced-supabase/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 100, // 100 enhanced operations per hour
      })
    );

    app.use(
      '/api/pydantic-ai/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // 50 Pydantic AI requests per 15 minutes
      })
    );

    app.use(
      '/api/alpha-evolve/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 20, // 20 evolution operations per hour (very computationally expensive)
      })
    );

    // Security reporting endpoints - Moderate limits
    app.use(
      '/api/security-reports/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // 50 security report requests per 15 minutes
      })
    );

    // Additional data processing endpoints
    app.use(
      '/api/dspy-widgets/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 DSPy widget operations per 15 minutes
      })
    );

    app.use(
      '/api/enhanced-context/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // 200 context operations per 15 minutes
      })
    );

    // Agent and automation endpoints
    app.use(
      '/api/agents/*',
      this.rateLimiter.limit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 150, // 150 agent operations per 15 minutes
      })
    );

    app.use(
      '/api/autofix/*',
      this.rateLimiter.limit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // 50 autofix operations per hour
      })
    );

    logger.info('Comprehensive rate limiting applied to all API endpoints', LogContext.SECURITY, {
      totalEndpointsProtected: 29,
      endpointsProtected: [
        'auth',
        'ai-services',
        'dspy',
        'athena-tools',
        'sweet-athena',
        'tools',
        'filesystem',
        'widgets',
        'memory',
        'knowledge',
        'knowledge-monitoring',
        'mcp',
        'speech',
        'orchestration',
        'backup',
        'health',
        'upload',
        'export',
        'import',
        'widget-creation',
        'natural-language-widgets',
        'enhanced-supabase',
        'pydantic-ai',
        'alpha-evolve',
        'security-reports',
        'dspy-widgets',
        'enhanced-context',
        'agents',
        'autofix',
      ],
    });
  }

  /**
   * Generate unique _requestID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get authentication middleware
   */
  public getAuthMiddleware(options?: any) {
    if (this.config.enableAuth) {
      return this.authMiddleware.authenticate(options);
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**
   * Get JWT authentication middleware
   */
  public getJWTMiddleware(options?: any) {
    if (this.config.enableAuth) {
      return this.jwtAuth.authenticate(options);
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**
   * Get CSRF middleware for specific routes
   */
  public getCSRFMiddleware() {
    if (this.config.enableCSRF) {
      return this.csrfProtection.middleware();
    }
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  /**
   * Get rate limiter for custom limits
   */
  public getRateLimiter() {
    return this.rateLimiter;
  }

  /**
   * Get JWT auth service
   */
  public getJWTService() {
    return this.jwtAuth;
  }

  /**
   * Security status endpoint handler
   */
  public getSecurityStatus() {
    return async (req: Request, res: Response) => {
      const rateLimitStats = await this.rateLimiter.getStats();
      const sqlProtectionStats = this.sqlProtection.getStats();

      res.json({
        status: 'operational',
        features: {
          helmet: this.config.enableHelmet,
          cors: this.config.enableCORS,
          rateLimit: this.config.enableRateLimit,
          csrf: this.config.enableCSRF,
          sqlProtection: this.config.enableSQLProtection,
          https: this.config.enableHTTPS,
          hsts: this.config.enableHSTS,
          auth: this.config.enableAuth,
        },
        stats: {
          rateLimit: rateLimitStats,
          sqlProtection: sqlProtectionStats,
        },
        timestamp: new Date().toISOString(),
      });
    };
  }

  /**
   * Apply security patches for known vulnerabilities
   */
  public applySecurityPatches(app: Application): void {
    // Prevent HTTP Parameter Pollution
    app.use((req: Request, res: Response, next: NextFunction) => {
      for (const key in req.query) {
        if (Array.isArray(req.query[key])) {
          req.query[key] = (req.query[key] as string[])[0];
        }
      }
      next();
    });

    // Prevent clickjacking with additional headers
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      next();
    });

    // Add security monitoring
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;

        // Log slow requests
        if (duration > 5000) {
          logger.warn('Slow _requestdetected', LogContext.PERFORMANCE, {
            method: req.method,
            path: req.path,
            duration,
            statusCode: res.statusCode,
          });
        }

        // Log failed authentication attempts
        if (res.statusCode === 401 || res.statusCode === 403) {
          logger.warn('Authentication failure', LogContext.SECURITY, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
        }
      });

      next();
    });
  }
}

export default EnhancedSecurityMiddleware;
import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { performanceMonitor } from '../utils/performance-monitor';
import { ImprovedCacheManager } from '../utils/cache-manager-improved';
import DatabaseOptimizer from '../utils/database-optimizer';
import { LogContext, logger } from '../utils/enhanced-logger';
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

  constructor(supabase: SupabaseClient, options: PerformanceMiddlewareOptions = {}) {
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

    this.cache = new ImprovedCacheManager(config.redis?.url || 'redis://localhost:6379');
    this.dbOptimizer = new DatabaseOptimizer(supabase, this.cache);

    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    if (this.options.enableMemoryMonitoring) {
      performanceMonitor.startMonitoring(10000); // 10 seconds

      performanceMonitor.on('threshold-exceeded', (event) => {
        logger.warn('Performance threshold exceeded', LogContext.PERFORMANCE, { event });
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
      case 'errorrate':
        this.handleErrorRateThreshold(event);
        break;
      case 'cache-hit-rate':
        this.handleCacheHitRateThreshold(event);
        break;
    }
  }

  private handleMemoryThreshold(event: any): void {
    logger.warn(`Memory threshold exceeded: ${event.value}MB`, LogContext.PERFORMANCE);

    // Force garbage collection
    performanceMonitor.forceGarbageCollection();

    // Clear old metrics
    this.cleanupOldMetrics();

    // Optionally restart workers or clear caches
    if (event.value > this.options.memoryThreshold! * 1.5) {
      logger.error(Critical memory usage detected, clearing caches', LogContext.PERFORMANCE);
      this.cache.flush();
    }
  }

  private handleResponseTimeThreshold(event: any): void {
    logger.warn(`Response time threshold exceeded: ${event.value}ms`, LogContext.PERFORMANCE);

    // Could implement _requestqueuing or load balancing here
  }

  private handleErrorRateThreshold(event: any): void {
    logger.warn(`Error rate threshold exceeded: ${event.value}%`, LogContext.PERFORMANCE);

    // Could implement circuit breaker _patternhere
  }

  private handleCacheHitRateThreshold(event: any): void {
    logger.warn(`Cache hit rate below threshold: ${event.value}%`, LogContext.PERFORMANCE);

    // Could implement cache warming strategies here
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = Date.now() - 3600000;
    this.requestMetrics = this.requestMetrics.filter((m) => m.timestamp > oneHourAgo);

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

      // Set _requesttimeout
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({ error 'Request timeout' });
        }
      }, this.options.requestTimeoutMs);

      // Override res.end to capture metrics
      const originalEnd = res.end;
      const self = this;
      res.end = function (this: Response, ...args: any[]) {
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
          logger.error
            `Request error ${req.method} ${req.url} - Status: ${res.statusCode} - Response time: ${responseTime}ms`,
            LogContext.PERFORMANCE,
            {
              method: req.method,
              url: req.url,
              statusCode: res.statusCode,
              responseTime,
              headers: req.headers,
              ip: req.ip,
            }
          );
        }

        // Log slow requests
        if (responseTime > self.options.slowRequestThreshold!) {
          logger.warn(
            `Slow _requestdetected: ${req.method} ${req.url} - ${responseTime}ms`,
            LogContext.PERFORMANCE
          );
        }

        // Log high memory usage
        if (memoryUsage > 50 * 1024 * 1024) {
          // 50MB
          logger.warn(
            `High memory usage _request ${req.method} ${req.url} - ${memoryUsage / 1024 / 1024}MB`,
            LogContext.PERFORMANCE
          );
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

      const cacheKey = this.cache.createCacheKey(
        req.originalUrl || req.url,
        JSON.stringify(req.query)
      );

      // Try to get from cache
      this.cache
        .get(cacheKey)
        .then((cached) => {
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
          res.json = function (this: Response, body: any) {
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
        })
        .catch((error => {
          logger.error(Cache middleware error, LogContext.PERFORMANCE, { error});
          next();
        });
    };
  }

  public databaseOptimizer() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableDatabaseOptimization) {
        return next();
      }

      // Add database optimizer to _requestobject
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
          error 'Too many requests',
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
    const last5Minutes = this.requestMetrics.filter((m) => m.timestamp > now - 300000);
    const last1Hour = this.requestMetrics.filter((m) => m.timestamp > now - 3600000);

    const calculateStats = (metrics: RequestMetrics[]) => {
      if (metrics.length === 0) return { count: 0, avgResponseTime: 0, errorRate: 0 };

      const totalTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
      const errors = metrics.filter((m) => m.statusCode >= 400).length;

      return {
        count: metrics.length,
        avgResponseTime: totalTime / metrics.length,
        errorRate: (errors / metrics.length) * 100,
      };
    };

    return {
      last5Minutes: calculateStats(last5Minutes),
      last1Hour: calculateStats(last1Hour),
      slowRequests: this.requestMetrics.filter(
        (m) => m.responseTime > this.options.slowRequestThreshold!
      ).length,
      topEndpoints: this.getTopEndpoints(last1Hour),
    };
  }

  private getTopEndpoints(
    metrics: RequestMetrics[]
  ): Array<{ endpoint: string; count: number; avgResponseTime: number }> {
    const endpoints = new Map<string, { count: number; totalTime: number }>();

    metrics.forEach((metric) => {
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
${metrics.requests.topEndpoints
  .map((ep) => `${ep.endpoint}: ${ep.count} requests (${ep.avgResponseTime.toFixed(2)}ms avg)`)
  .join('\n')}

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
      recommendations.push(
        '• Database queries are slow - consider adding indexes or optimizing queries'
      );
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
import type { NextFunction, Request, Response } from 'express';
import { LogContext, logger } from '../utils/enhanced-logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export class ApiError extends Error implements AppError {
  statusCode: number;
  code: string;
  details?: any;
  isOperational: boolean;

  constructor(statusCode: number, message: string, code = 'API_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async errorwrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Global errorhandler middleware
export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  // Log the error
  logger.error(Request error, LogContext.API, {
    error {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack,
      details: err.details,
    },
    _request {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
    },
    timestamp: new Date().toISOString(),
  });

  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle specific errortypes
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_DATA_TYPE';
    message = 'Invalid data type provided';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  } else if (err.message && err.message.includes('ECONNREFUSED')) {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  } else if (err.message && err.message.includes('ETIMEDOUT')) {
    statusCode = 504;
    code = 'GATEWAY_TIMEOUT';
    message = 'Request timeout';
  }

  // Don't send sensitive errordetails in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse: any = {
    error {
      message,
      code,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    },
  };

  // Add debug info in development
  if (isDevelopment && err.details) {
    errorResponse.errordetails = err.details;
  }

  if (isDevelopment && err.stack && !err.isOperational) {
    errorResponse.errorstack = err.stack.split('\n');
  }

  // Add _requestID if available
  if (req.headers['x-_requestid']) {
    errorResponse.errorrequestId = req.headers['x-_requestid'];
  }

  res.status(statusCode).json(errorResponse);
}

// Not found handler
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error {
      message: 'Resource not found',
      code: 'NOT_FOUND',
      statusCode: 404,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    },
  });
}

// Request validation middleware
export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error any) {
      next(new ApiError(400, 'Invalid _requestdata', 'VALIDATION_ERROR', errorerrors));
    }
  };
}

// Timeout middleware
export function timeoutMiddleware(timeoutMs = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error= new ApiError(504, 'Request timeout', 'REQUEST_TIMEOUT', {
          timeout: timeoutMs,
        });
        next(error;
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Extend Express Request type
declare module 'express' {
  interface Request {
    apiVersion?: string;
  }
}

// Version configuration schema
const VersionConfigSchema = z.object({
  version: z.string().regex(/^v\d+$/),
  active: z.boolean(),
  deprecated: z.boolean().default(false),
  deprecationDate: z.string().optional(),
  sunsetDate: z.string().optional(),
  changes: z.array(z.string()).optional(),
});

export interface ApiVersion {
  version: string;
  active: boolean;
  deprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  changes?: string[];
}

export interface VersionedRequest extends Request {
  apiVersion?: string;
  deprecationWarning?: string;
}

export class ApiVersioningMiddleware {
  private versions: Map<string, ApiVersion> = new Map();
  private defaultVersion = 'v1';
  private latestVersion = 'v1';

  constructor() {
    this.initializeVersions();
  }

  private initializeVersions() {
    // Define API versions
    const versions: ApiVersion[] = [
      {
        version: 'v1',
        active: true,
        deprecated: false,
        changes: ['Initial API version', 'All endpoints available under /api/v1/'],
      },
      // Future versions can be added here
      // {
      //   version: 'v2',
      //   active: false,
      //   deprecated: false,
      //   changes: [
      //     'Breaking change: Modified response format',
      //     'New feature: Advanced agent capabilities'
      //   ]
      // }
    ];

    versions.forEach((v) => {
      this.versions.set(v.version, v);
    });

    // Find latest active version
    const activeVersions = Array.from(this.versions.values())
      .filter((v) => v.active)
      .sort((a, b) => {
        const aNum = parseInt(a.version.slice(1, 10));
        const bNum = parseInt(b.version.slice(1, 10));
        return bNum - aNum;
      });

    if (activeVersions.length > 0) {
      this.latestVersion = activeVersions[0].version;
    }
  }

  /**
   * Version detection middleware
   * Extracts API version from URL path or headers
   */
  versionDetection() {
    return (req: VersionedRequest, res: Response, next: NextFunction) => {
      let version: string | undefined;

      // Check URL path for version
      const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
      if (pathMatch) {
        version = pathMatch[1];
      }

      // Check Accept header for version (API version in media type)
      const acceptHeader = req.get('Accept');
      if (!version && acceptHeader) {
        const versionMatch = acceptHeader.match(
          /application\/vnd\.universal-ai-tools\.(v\d+)\+json/
        );
        if (versionMatch) {
          version = versionMatch[1];
        }
      }

      // Check custom header for version
      if (!version) {
        const apiVersionHeader = req.get('X-API-Version');
        if (apiVersionHeader && apiVersionHeader.match(/^v\d+$/)) {
          version = apiVersionHeader;
        }
      }

      // Use default version if none specified
      if (!version) {
        version = this.defaultVersion;
      }

      // Validate version
      const versionInfo = this.versions.get(version);
      if (!versionInfo) {
        return res.status(400).json({
          success: false,
          error {
            code: 'INVALID_API_VERSION',
            message: `API version ${version} is not supported`,
            supportedVersions: Array.from(this.versions.keys()),
            latestVersion: this.latestVersion,
          },
        });
      }

      if (!versionInfo.active) {
        return res.status(410).json({
          success: false,
          error {
            code: 'VERSION_NOT_ACTIVE',
            message: `API version ${version} is no longer active`,
            latestVersion: this.latestVersion,
            sunsetDate: versionInfo.sunsetDate,
          },
        });
      }

      // Set version on request
      req.apiVersion = version;

      // Add deprecation warning if applicable
      if (versionInfo.deprecated) {
        const warning = `API version ${version} is deprecated and will be sunset on ${versionInfo.sunsetDate}. Please upgrade to ${this.latestVersion}.`;
        req.deprecationWarning = warning;
        res.set('X-API-Deprecation-Warning', warning);
        res.set('X-API-Sunset-Date', versionInfo.sunsetDate?.toISOString() || '');
      }

      // Add version headers to response
      res.set('X-API-Version', version);
      res.set('X-API-Latest-Version', this.latestVersion);

      next();
    };
  }

  /**
   * Version routing middleware
   * Routes requests to appropriate version handlers
   */
  versionRouter() {
    const router = Router();

    // Version info endpoint
    router.get('/versions', (req, res) => {
      const versions = Array.from(this.versions.values()).map((v) => ({
        version: v.version,
        active: v.active,
        deprecated: v.deprecated,
        deprecationDate: v.deprecationDate?.toISOString(),
        sunsetDate: v.sunsetDate?.toISOString(),
        changes: v.changes,
      }));

      res.json({
        success: true,
        currentVersion: req.apiVersion || this.defaultVersion,
        defaultVersion: this.defaultVersion,
        latestVersion: this.latestVersion,
        versions,
      });
    });

    return router;
  }

  /**
   * URL rewriting middleware
   * Rewrites non-versioned API paths to include version prefix
   */
  urlRewriter() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip if already has version in path
      if (req.path.match(/^\/api\/v\d+\//)) {
        return next();
      }

      // Skip non-API paths
      if (!req.path.startsWith('/api/')) {
        return next();
      }

      // Skip special endpoints that should not be versioned
      const unversionedPaths = [
        '/api/docs',
        '/api/register',
        '/api/versions',
        '/api/health',
        '/api/config',
        '/api/config/health',
        '/metrics',
      ];

      if (unversionedPaths.includes(req.path)) {
        return next();
      }

      // Rewrite URL to include version
      const version = (req as VersionedRequest).apiVersion || this.defaultVersion;
      const newPath = req.path.replace(/^\/api/, `/api/${version}`);

      logger.debug(`Rewriting API path from ${req.path} to ${newPath}`);
      req.url = newPath + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');

      next();
    };
  }

  /**
   * Version compatibility middleware
   * Handles backward compatibility between versions
   */
  compatibilityHandler() {
    return (req: VersionedRequest, res: Response, next: NextFunction) => {
      const version = req.apiVersion || this.defaultVersion;

      // Add response transformation based on version
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        // Transform response based on API version
        const transformedData = transformResponse(data, version);

        // Add metadata
        if (typeof transformedData === 'object' && !Array.isArray(transformedData)) {
          transformedData.metadata = {
            ...transformedData.metadata,
            apiVersion: version,
            timestamp: new Date().toISOString(),
          };

          // Add deprecation warning to response if applicable
          if (req.deprecationWarning) {
            transformedData.metadata.deprecationWarning = req.deprecationWarning;
          }
        }

        return originalJson(transformedData);
      };

      next();
    };
  }

  /**
   * Version negotiation middleware
   * Handles _contentnegotiation for API versions
   */
  contentNegotiation() {
    return (req: VersionedRequest, res: Response, next: NextFunction) => {
      const acceptHeader = req.get('Accept');

      if (acceptHeader && acceptHeader.includes('application/vnd.universal-ai-tools')) {
        // Set appropriate _contenttype based on version
        const version = req.apiVersion || this.defaultVersion;
        res.type(`application/vnd.universal-ai-tools.${version}+json`);
      } else {
        res.type('application/json');
      }

      next();
    };
  }

  /**
   * Get version information
   */
  getVersionInfo(version: string): ApiVersion | undefined {
    return this.versions.get(version);
  }

  /**
   * Add a new version
   */
  addVersion(version: ApiVersion): void {
    const validated = VersionConfigSchema.parse(version);
    this.versions.set(validated.version, {
      ...validated,
      deprecationDate: validated.deprecationDate ? new Date(validated.deprecationDate) : undefined,
      sunsetDate: validated.sunsetDate ? new Date(validated.sunsetDate) : undefined,
    });

    // Update latest version if needed
    if (validated.active) {
      const currentLatestNum = parseInt(this.latestVersion.slice(1, 10));
      const newVersionNum = parseInt(validated.version.slice(1, 10));
      if (newVersionNum > currentLatestNum) {
        this.latestVersion = validated.version;
      }
    }
  }

  /**
   * Deprecate a version
   */
  deprecateVersion(version: string, sunsetDate: Date): void {
    const versionInfo = this.versions.get(version);
    if (versionInfo) {
      versionInfo.deprecated = true;
      versionInfo.deprecationDate = new Date();
      versionInfo.sunsetDate = sunsetDate;
      logger.warn(
        `API version ${version} has been deprecated. Sunset date: ${sunsetDate.toISOString()}`
      );
    }
  }

  /**
   * Deactivate a version
   */
  deactivateVersion(version: string): void {
    const versionInfo = this.versions.get(version);
    if (versionInfo) {
      versionInfo.active = false;
      logger.warn(`API version ${version} has been deactivated`);
    }
  }
}

/**
 * Transform response data based on API version
 * This function handles backward compatibility transformations
 */
function transformResponse(data: any, version: string): any {
  // V1 is the base version, no transformation needed
  if (version === 'v1') {
    return data;
  }

  // Future version transformations would go here
  // Example for v2:
  // if (version === 'v2') {
  //   // Transform v1 response to v2 format
  //   if (data.memories) {
  //     data.memoryItems = data.memories;
  //     delete data.memories;
  //   }
  // }

  return data;
}

/**
 * Create versioned router wrapper
 * Wraps existing routers to support versioning
 */

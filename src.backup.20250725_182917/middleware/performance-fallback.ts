import type { NextFunction, Request, Response } from 'express';
import { LogContext, logger } from '../utils/enhanced-logger';

export interface FallbackPerformanceOptions {
  slowRequestThreshold?: number;
  requestTimeoutMs?: number;
  maxMetricsHistory?: number;
  enableRequestTiming?: boolean;
}

interface RequestMetric {
  url: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userAgent?: string;
  ip?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**;
 * Lightweight performance middleware that works without Redis
 * Uses in-memory storage with automatic cleanup
 */
export class FallbackPerformanceMiddleware {
  private requestMetrics: RequestMetric[] = [];
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private options: Required<FallbackPerformanceOptions>;
  private cleanupInterval: NodeJS.Timeout;
  private metricsCleanupInterval = 300000; // 5 minutes;

  constructor(options: FallbackPerformanceOptions = {}) {
    this.options = {
      slowRequestThreshold: options.slowRequestThreshold ?? 2000,
      requestTimeoutMs: options.requestTimeoutMs ?? 5000, // 5 second max as requested;
      maxMetricsHistory: options.maxMetricsHistory ?? 5000,
      enableRequestTiming: options.enableRequestTiming ?? true,
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
      this.cleanupRateLimits();
    }, this.metricsCleanupInterval);

    logger.info('Fallback performance middleware initialized', LogContext.PERFORMANCE, {
      options: this.options,
    });
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = Date.now() - 3600000;
    const beforeCleanup = this.requestMetrics.length;

    // Remove metrics older than 1 hour
    this.requestMetrics = this.requestMetrics.filter((m) => m.timestamp > oneHourAgo);

    // Keep only the most recent metrics if exceeding max
    if (this.requestMetrics.length > this.options.maxMetricsHistory) {
      this.requestMetrics = this.requestMetrics.slice(-this.options.maxMetricsHistory);
    }

    const removed = beforeCleanup - this.requestMetrics.length;
    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} old metrics`, LogContext.PERFORMANCE);
    }
  }

  private cleanupRateLimits(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitMap.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired rate limit entries`, LogContext.PERFORMANCE);
    }
  }

  /**;
   * Request timing middleware with timeout protection
   */
  public requestTimer() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.options.enableRequestTiming) {
        return next();
      }

      const startTime = process.hrtime.bigint();

      // Set _requesttimeout
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({
            error: 'Request timeout',
            message: `Request exceeded ${this.options.requestTimeoutMs}ms timeout`,
          });
          logger.warn('Request timeout', LogContext.PERFORMANCE, {
            method: req.method,
            url: req.originalUrl || req.url,
            timeout: this.options.requestTimeoutMs,
          });
        }
      }, this.options.requestTimeoutMs);

      // Override res.end to capture metrics
      const originalEnd = res.end;
      const self = this;

      res.end = function (this: Response, ...args: any[]) {
        clearTimeout(timeout);

        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        // Record metric
        const metric: RequestMetric = {
          url: req.originalUrl || req.url,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: Date.now(),
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.socket.remoteAddress,
        };

        self.requestMetrics.push(metric);

        // Log slow requests
        if (responseTime > self.options.slowRequestThreshold) {
          logger.warn('Slow _requestdetected', LogContext.PERFORMANCE, {
            ...metric,
            threshold: self.options.slowRequestThreshold,
          });
        }

        // Log errors
        if (res.statusCode >= 400) {
          logger.error('Request error:  LogContext.PERFORMANCE, metric);';
        }

        // Add performance headers
        res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
        res.set('X-Performance-Mode', 'fallback');

        return originalEnd.apply(this, args as any);
      };

      next();
    };
  }

  /**;
   * Simple in-memory rate limiter
   */
  public rateLimiter(windowMs = 900000, max = 1000) {
    return (req: Request, res: Response, next: NextFunction) => {
      const identifier = req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      const userRequests = this.rateLimitMap.get(identifier);

      if (!userRequests || now > userRequests.resetTime) {
        this.rateLimitMap.set(identifier, {
          count: 1,
          resetTime: now + windowMs,
        });
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

  /**;
   * Generate a simple performance report
   */
  public async generatePerformanceReport(): Promise<string> {
    const metrics = this.getMetrics();
    const now = new Date().toISOString();

    return ``;
=== Universal AI Tools Performance Report (Fallback Mode) ===;
Generated: ${now}

=== System Status ===;
Mode: ${metrics.mode.toUpperCase()}
Total Metrics Tracked: ${metrics.totalMetrics}
Active Rate Limit Entries: ${metrics.rateLimitEntries}

=== Request Statistics (Last 5 Minutes) ===;
Total Requests: ${metrics.last5Minutes.count}
Average Response Time: ${metrics.last5Minutes.avgResponseTime.toFixed(2)}ms;
P95 Response Time: ${metrics.last5Minutes.p95ResponseTime.toFixed(2)}ms;
P99 Response Time: ${metrics.last5Minutes.p99ResponseTime.toFixed(2)}ms;
Error Rate: ${metrics.last5Minutes.errorRate.toFixed(2)}%;

=== Request Statistics (Last Hour) ===;
Total Requests: ${metrics.last1Hour.count}
Average Response Time: ${metrics.last1Hour.avgResponseTime.toFixed(2)}ms;
P95 Response Time: ${metrics.last1Hour.p95ResponseTime.toFixed(2)}ms;
P99 Response Time: ${metrics.last1Hour.p99ResponseTime.toFixed(2)}ms;
Error Rate: ${metrics.last1Hour.errorRate.toFixed(2)}%;

=== Performance Issues ===;
Slow Requests (>${this.options.slowRequestThreshold}ms): ${metrics.slowRequests}

=== Notes ===;
• Running in fallback mode without Redis;
• Limited to in-memory metrics storage;
• Metrics are cleared on server restart;
• Maximum ${this.options.maxMetricsHistory} metrics retained;
• Request timeout protection: ${this.options.requestTimeoutMs}ms;
`;`;
  }

  /**;
   * Get current metrics summary
   */
  public getMetrics() {
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
        };
      }

      const responseTimes = metrics.map((m) => m.responseTime).sort((a, b) => a - b);
      const totalTime = responseTimes.reduce((sum, time) => sum + time, 0);
      const errors = metrics.filter((m) => m.statusCode >= 400).length;

      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);

      return {
        count: metrics.length,
        avgResponseTime: totalTime / metrics.length,
        errorRate: (errors / metrics.length) * 100,
        p95ResponseTime: responseTimes[p95Index] || 0,
        p99ResponseTime: responseTimes[p99Index] || 0,
      };
    };

    return {
      mode: 'fallback',
      last5Minutes: calculateStats(last5Minutes),
      last1Hour: calculateStats(last1Hour),
      totalMetrics: this.requestMetrics.length,
      rateLimitEntries: this.rateLimitMap.size,
      slowRequests: this.requestMetrics.filter(;
        (m) => m.responseTime > this.options.slowRequestThreshold;
      ).length,
      timestamp: Date.now(),
    };
  }

  /**;
   * Cleanup resources
   */
  public close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requestMetrics = [];
    this.rateLimitMap.clear();
    logger.info('Fallback performance middleware closed', LogContext.PERFORMANCE);
  }
}

/**;
 * Factory function to create fallback middleware instance
 */
export function createFallbackPerformanceMiddleware(options?: FallbackPerformanceOptions) {
  return new FallbackPerformanceMiddleware(options);
}

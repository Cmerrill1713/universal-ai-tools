/**
 * Comprehensive Error Tracking and Monitoring Middleware
 * Advanced error handling, logging, and alerting system
 */

import type { NextFunction, Request, Response } from 'express';
import { performance } from 'perf_hooks';

import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByPath: Record<string, number>;
  errorsByStatusCode: Record<number, number>;
  averageResponseTime: number;
  lastError: Date;
}

export interface ErrorContext {
  requestId: string;
  userId?: string;
  userAgent?: string;
  ip: string;
  path: string;
  method: string;
  timestamp: Date;
  responseTime: number;
  headers: Record<string, string>;
  body?: any;
  query?: any;
  params?: any;
}

export interface AlertConfig extends Record<string, unknown> {
  enabled: boolean;
  thresholds: {
    errorRate: number; // errors per minute
    responseTime: number; // milliseconds
    consecutiveErrors: number;
  };
  webhooks?: string[];
  email?: string[];
}

class ErrorTrackingService {
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByType: {},
    errorsByPath: {},
    errorsByStatusCode: {},
    averageResponseTime: 0,
    lastError: new Date(),
  };

  private recentErrors: ErrorContext[] = [];
  private consecutiveErrors = 0;
  private lastSuccessTime = Date.now();
  private responseTimeBuffer: number[] = [];
  private alertConfig: AlertConfig;
  private maxRecentErrors = 100;

  constructor(alertConfig: Partial<AlertConfig> = {}) {
    this.alertConfig = {
      enabled: false,
      thresholds: {
        errorRate: 10, // 10 errors per minute
        responseTime: 5000, // 5 seconds
        consecutiveErrors: 5,
      },
      ...alertConfig,
    };

    // Cleanup old errors periodically
    setInterval(() => this.cleanupOldErrors(), 60000); // Every minute
  }

  /**
   * Express error handling middleware
   */
  errorHandler() {
    return (error: Error, req: Request, res: Response, _next: NextFunction) => {
      const startTime = Object.prototype.hasOwnProperty.call(req, 'startTime') ? (req as any).startTime : Date.now();
      const responseTime = Date.now() - startTime;

      const errorContext: ErrorContext = {
        requestId: Object.prototype.hasOwnProperty.call(req, 'requestId') ? (req as any).requestId : this.generateRequestId(),
        userId: Object.prototype.hasOwnProperty.call(req, 'user') ? (req as any).user?.id : undefined,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        path: req.path,
        method: req.method,
        timestamp: new Date(),
        responseTime,
        headers: this.sanitizeHeaders(req.headers),
        body: this.sanitizeBody(req.body),
        query: req.query,
        params: req.params,
      };

      this.trackError(error, errorContext);

      // Don't expose internal errors to clients
      const statusCode = this.getStatusCode(error);
      const message = this.getErrorMessage(error, statusCode);

      log.error('🚨 Unhandled error', LogContext.API, {
        error: error.message,
        stack: error.stack,
        context: errorContext,
        statusCode,
      });

      if (!res.headersSent) {
        sendError(res, 'INTERNAL_ERROR', message, statusCode);
      }
    };
  }

  /**
   * Request timing middleware
   */
  timingMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      (req as any).startTime = startTime;
      (req as any).requestId = this.generateRequestId();

      // Track response time
      res.on('finish', () => {
        const responseTime = performance.now() - startTime;
        this.trackResponseTime(responseTime);

        // Reset consecutive errors on successful response
        if (res.statusCode < 400) {
          this.consecutiveErrors = 0;
          this.lastSuccessTime = Date.now();
        }

        // Log slow requests
        if (responseTime > 1000) {
          log.warn('🐌 Slow request detected', LogContext.API, {
            path: req.path,
            method: req.method,
            responseTime: Math.round(responseTime),
            statusCode: res.statusCode,
            requestId: (req as any).requestId,
          });
        }
      });

      next();
    };
  }

  /**
   * Track an error occurrence
   */
  private trackError(error: Error, context: ErrorContext): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = context.timestamp;
    this.consecutiveErrors++;

    // Track by error type
    const errorType = error.constructor.name;
    this.metrics.errorsByType[errorType] = (Object.prototype.hasOwnProperty.call(this.metrics.errorsByType, errorType) ? this.metrics.errorsByType[errorType] : 0) + 1;

    // Track by path
    this.metrics.errorsByPath[context.path] = (Object.prototype.hasOwnProperty.call(this.metrics.errorsByPath, context.path) ? this.metrics.errorsByPath[context.path] : 0) + 1;

    // Track by status code
    const statusCode = this.getStatusCode(error);
    this.metrics.errorsByStatusCode[statusCode] = (Object.prototype.hasOwnProperty.call(this.metrics.errorsByStatusCode, statusCode) ? this.metrics.errorsByStatusCode[statusCode] : 0) + 1;

    // Store recent error
    this.recentErrors.unshift({ ...context });
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
    }

    // Check for alert conditions
    this.checkAlerts();
  }

  /**
   * Track response time
   */
  private trackResponseTime(responseTime: number): void {
    this.responseTimeBuffer.push(responseTime);
    
    // Keep only last 100 response times
    if (this.responseTimeBuffer.length > 100) {
      this.responseTimeBuffer = this.responseTimeBuffer.slice(-100);
    }

    // Update average
    this.metrics.averageResponseTime = 
      this.responseTimeBuffer.reduce((sum, time) => sum + time, 0) / this.responseTimeBuffer.length;
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(): void {
    if (!this.alertConfig.enabled) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Check error rate (errors per minute)
    const recentErrorCount = this.recentErrors.filter(
      error => error.timestamp.getTime() > oneMinuteAgo
    ).length;

    if (recentErrorCount >= this.alertConfig.thresholds.errorRate) {
      this.sendAlert('HIGH_ERROR_RATE', {
        message: `High error rate detected: ${recentErrorCount} errors in the last minute`,
        errorRate: recentErrorCount,
        threshold: this.alertConfig.thresholds.errorRate,
      });
    }

    // Check consecutive errors
    if (this.consecutiveErrors >= this.alertConfig.thresholds.consecutiveErrors) {
      this.sendAlert('CONSECUTIVE_ERRORS', {
        message: `${this.consecutiveErrors} consecutive errors detected`,
        consecutiveErrors: this.consecutiveErrors,
        threshold: this.alertConfig.thresholds.consecutiveErrors,
        timeSinceLastSuccess: now - this.lastSuccessTime,
      });
    }

    // Check average response time
    if (this.metrics.averageResponseTime > this.alertConfig.thresholds.responseTime) {
      this.sendAlert('SLOW_RESPONSE_TIME', {
        message: `Slow response time detected: ${Math.round(this.metrics.averageResponseTime)}ms average`,
        averageResponseTime: this.metrics.averageResponseTime,
        threshold: this.alertConfig.thresholds.responseTime,
      });
    }
  }

  /**
   * Send alert notification
   */
  private sendAlert(type: string, data: any): void {
    const alert = {
      type,
      timestamp: new Date().toISOString(),
      service: 'Universal AI Tools',
      data,
      metrics: this.getMetrics(),
    };

    log.error(`🚨 ALERT: ${type}`, LogContext.SYSTEM, alert);

    // In a real implementation, you would send to external services:
    // - Slack/Discord webhooks
    // - Email notifications  
    // - PagerDuty/Opsgenie
    // - Custom monitoring dashboards

    // Example webhook call (commented out):
    // this.alertConfig.webhooks?.forEach(webhook => {
    //   fetch(webhook, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(alert)
    //   }).catch(err => log.error('Failed to send webhook alert', LogContext.SYSTEM, { err }));
    // });
  }

  /**
   * Get error status code
   */
  private getStatusCode(error: Error): number {
    if ((error as any).statusCode) return (error as any).statusCode;
    if ((error as any).status) return (error as any).status;
    
    // Common error types
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'UnauthorizedError') return 401;
    if (error.name === 'ForbiddenError') return 403;
    if (error.name === 'NotFoundError') return 404;
    if (error.name === 'ConflictError') return 409;
    if (error.name === 'RateLimitError') return 429;
    
    return 500; // Internal Server Error
  }

  /**
   * Get safe error message for clients
   */
  private getErrorMessage(error: Error, statusCode: number): string {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
      return 'Internal server error';
    }
    
    return error.message || 'An error occurred';
  }

  /**
   * Sanitize headers (remove sensitive data)
   */
  private sanitizeHeaders(headers: any): Record<string, string> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        Object.assign(sanitized, { [key]: '[REDACTED]' });
      } else {
        Object.assign(sanitized, { [key]: String(value) });
      }
    }
    
    return sanitized;
  }

  /**
   * Sanitize request body (remove sensitive data)
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (Object.prototype.hasOwnProperty.call(sanitized, field)) {
        Object.assign(sanitized, { [field]: '[REDACTED]' });
      }
    }
    
    return sanitized;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old errors to prevent memory leaks
   */
  private cleanupOldErrors(): void {
    const oneHourAgo = Date.now() - 3600000; // 1 hour
    
    this.recentErrors = this.recentErrors.filter(
      error => error.timestamp.getTime() > oneHourAgo
    );

    log.debug('Error tracking cleanup completed', LogContext.SYSTEM, {
      remainingErrors: this.recentErrors.length,
      totalTracked: this.metrics.totalErrors,
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): ErrorMetrics & {
    consecutiveErrors: number;
    recentErrorCount: number;
    uptime: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    return {
      ...this.metrics,
      consecutiveErrors: this.consecutiveErrors,
      recentErrorCount: this.recentErrors.filter(
        error => error.timestamp.getTime() > oneMinuteAgo
      ).length,
      uptime: now - this.lastSuccessTime,
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 50): ErrorContext[] {
    return this.recentErrors.slice(0, limit);
  }

  /**
   * Get error trends
   */
  getErrorTrends(): {
    hourly: number[];
    byPath: Array<{ path: string; count: number }>;
    byType: Array<{ type: string; count: number }>;
  } {
    const now = Date.now();
    const hourly: number[] = [];
    
    // Calculate errors for each of the last 24 hours
    for (let i = 0; i < 24; i++) {
      const hourStart = now - (i + 1) * 3600000;
      const hourEnd = now - i * 3600000;
      
      const errorsInHour = this.recentErrors.filter(
        error => error.timestamp.getTime() >= hourStart && error.timestamp.getTime() < hourEnd
      ).length;
      
      hourly.unshift(errorsInHour);
    }

    const byPath = Object.entries(this.metrics.errorsByPath)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const byType = Object.entries(this.metrics.errorsByType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { hourly, byPath, byType };
  }

  /**
   * Reset metrics (for testing)
   */
  reset(): void {
    this.metrics = {
      totalErrors: 0,
      errorsByType: {},
      errorsByPath: {},
      errorsByStatusCode: {},
      averageResponseTime: 0,
      lastError: new Date(),
    };
    this.recentErrors = [];
    this.consecutiveErrors = 0;
    this.lastSuccessTime = Date.now();
    this.responseTimeBuffer = [];
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    log.info('Alert configuration updated', LogContext.SYSTEM, this.alertConfig);
  }
}

// Export singleton instance
export const errorTrackingService = new ErrorTrackingService({
  enabled: process.env.NODE_ENV === 'production',
  thresholds: {
    errorRate: parseInt(process.env.ERROR_RATE_THRESHOLD || '10'),
    responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000'),
    consecutiveErrors: parseInt(process.env.CONSECUTIVE_ERROR_THRESHOLD || '5'),
  },
});

export default ErrorTrackingService;
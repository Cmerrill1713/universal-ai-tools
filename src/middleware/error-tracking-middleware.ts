/**
 * Comprehensive Error Tracking and Monitoring Middleware
 * Advanced error handling, logging, and alerting system
 */

import type { NextFunction, Request, Response } from 'express';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'client' | 'server' | 'network' | 'database' | 'auth' | 'validation' | 'rate_limit' | 'external_api' | 'system';

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByPath: Record<string, number>;
  errorsByStatusCode: Record<number, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  averageResponseTime: number;
  lastError: Date;
  criticalErrorsLast24h: number;
}

export interface ErrorContext {
  requestId: string;
  correlationId: string;
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
  severity: ErrorSeverity;
  category: ErrorCategory;
  errorCode?: string;
  errorName: string;
  errorMessage: string;
  errorStack?: string;
  statusCode: number;
  isRecoverable: boolean;
  recoveryActions?: string[];
  similarErrorsCount?: number;
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
    errorsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    errorsByCategory: { client: 0, server: 0, network: 0, database: 0, auth: 0, validation: 0, rate_limit: 0, external_api: 0, system: 0 },
    averageResponseTime: 0,
    lastError: new Date(),
    criticalErrorsLast24h: 0,
  };

  private recentErrors: ErrorContext[] = [];
  private consecutiveErrors = 0;
  private lastSuccessTime = Date.now();
  private responseTimeBuffer: number[] = [];
  private alertConfig: AlertConfig;
  private maxRecentErrors = 100;
  private broadcastService: any = null; // Will be injected

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
   * Set broadcast service for real-time error notifications
   */
  setBroadcastService(broadcastService: any): void {
    this.broadcastService = broadcastService;
  }

  /**
   * Classify error severity based on error type and status code
   */
  private classifyErrorSeverity(error: Error, statusCode: number): ErrorSeverity {
    // Critical errors that require immediate attention
    if (statusCode >= 500 || error.name === 'DatabaseError' || error.name === 'SecurityError') {
      return 'critical';
    }
    
    // High severity errors
    if (statusCode === 401 || statusCode === 403 || error.name === 'AuthenticationError') {
      return 'high';
    }
    
    // Medium severity errors
    if (statusCode === 429 || statusCode === 409 || error.name === 'ValidationError') {
      return 'medium';
    }
    
    // Low severity errors (client errors)
    return 'low';
  }

  /**
   * Classify error category based on error type and status code
   */
  private classifyErrorCategory(error: Error, statusCode: number, path: string): ErrorCategory {
    if (error.name.includes('Auth') || statusCode === 401 || statusCode === 403) {
      return 'auth';
    }
    
    if (error.name.includes('Database') || error.name.includes('SQL')) {
      return 'database';
    }
    
    if (error.name.includes('Network') || error.name.includes('Timeout')) {
      return 'network';
    }
    
    if (error.name === 'ValidationError' || statusCode === 400) {
      return 'validation';
    }
    
    if (statusCode === 429) {
      return 'rate_limit';
    }
    
    if (path.includes('/api/v1/external') || error.name.includes('External')) {
      return 'external_api';
    }
    
    if (statusCode >= 500) {
      return 'server';
    }
    
    if (statusCode >= 400 && statusCode < 500) {
      return 'client';
    }
    
    return 'system';
  }

  /**
   * Generate recovery suggestions based on error type
   */
  private generateRecoveryActions(error: Error, statusCode: number, category: ErrorCategory): string[] {
    const actions: string[] = [];
    
    switch (category) {
      case 'auth':
        actions.push('Verify authentication credentials');
        actions.push('Check if session has expired');
        actions.push('Retry login process');
        break;
        
      case 'validation':
        actions.push('Check required fields are provided');
        actions.push('Verify data format and types');
        actions.push('Review API documentation');
        break;
        
      case 'rate_limit':
        actions.push('Reduce request frequency');
        actions.push('Implement exponential backoff');
        actions.push('Check rate limit headers');
        break;
        
      case 'network':
        actions.push('Check network connectivity');
        actions.push('Retry request with timeout');
        actions.push('Verify endpoint availability');
        break;
        
      case 'database':
        actions.push('Check database connection');
        actions.push('Verify query syntax');
        actions.push('Check database permissions');
        break;
        
      case 'external_api':
        actions.push('Check external service status');
        actions.push('Verify API credentials');
        actions.push('Review external API documentation');
        break;
        
      case 'server':
        actions.push('Check server logs for details');
        actions.push('Verify server health status');
        actions.push('Contact system administrator');
        break;
        
      default:
        actions.push('Review error details');
        actions.push('Check system status');
        actions.push('Contact support if issue persists');
    }
    
    return actions;
  }

  /**
   * Check if error is recoverable
   */
  private isErrorRecoverable(error: Error, statusCode: number, category: ErrorCategory): boolean {
    // Non-recoverable errors
    if (statusCode === 404 || statusCode === 405 || statusCode === 501) {
      return false;
    }
    
    // Recoverable errors
    if (category === 'rate_limit' || category === 'network' || category === 'validation') {
      return true;
    }
    
    // Server errors might be recoverable
    if (statusCode >= 500 && statusCode < 504) {
      return true;
    }
    
    return false;
  }

  /**
   * Express error handling middleware
   */
  errorHandler() {
    return (error: Error, req: Request, res: Response, _next: NextFunction) => {
      const startTime = Object.prototype.hasOwnProperty.call(req, 'startTime') ? (req as any).startTime : Date.now();
      const responseTime = Date.now() - startTime;
      const statusCode = this.getStatusCode(error);
      const severity = this.classifyErrorSeverity(error, statusCode);
      const category = this.classifyErrorCategory(error, statusCode, req.path);
      const recoveryActions = this.generateRecoveryActions(error, statusCode, category);
      const isRecoverable = this.isErrorRecoverable(error, statusCode, category);
      const correlationId = uuidv4();

      const errorContext: ErrorContext = {
        requestId: Object.prototype.hasOwnProperty.call(req, 'requestId') ? (req as any).requestId : this.generateRequestId(),
        correlationId,
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
        severity,
        category,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        statusCode,
        isRecoverable,
        recoveryActions,
      };

      this.trackError(error, errorContext);

      // Broadcast critical errors in real-time
      if (severity === 'critical' && this.broadcastService) {
        this.broadcastService.broadcastSystemAlert({
          type: 'system_alert',
          severity: 'critical',
          category: 'error_tracking',
          message: `Critical error on ${req.path}: ${error.message}`,
          details: {
            correlationId,
            path: req.path,
            errorType: error.name,
            isRecoverable,
            recoveryActions,
          },
          timestamp: Date.now(),
        });
      }

      // Prepare user-friendly error response
      const message = this.getErrorMessage(error, statusCode);
      const userFriendlyResponse = {
        error: {
          message,
          code: statusCode,
          correlationId,
          severity,
          isRecoverable,
          ...(isRecoverable && { recoveryActions }),
          timestamp: new Date().toISOString(),
        }
      };

      log.error('🚨 Unhandled error', LogContext.API, {
        error: error.message,
        stack: error.stack,
        context: errorContext,
        severity,
        category,
        correlationId,
      });

      if (!res.headersSent) {
        // Send error response using the sendError utility
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
    if (this.metrics.errorsByType) {
      const {errorsByType} = this.metrics;
      errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
    }

    // Track by path
    if (this.metrics.errorsByPath && context.path) {
      const {errorsByPath} = this.metrics;
      errorsByPath[context.path] = (errorsByPath[context.path] || 0) + 1;
    }

    // Track by status code
    if (this.metrics.errorsByStatusCode) {
      const {errorsByStatusCode} = this.metrics;
      errorsByStatusCode[context.statusCode] = (errorsByStatusCode[context.statusCode] || 0) + 1;
    }

    // Track by severity
    if (this.metrics.errorsBySeverity) {
      const {errorsBySeverity} = this.metrics;
      errorsBySeverity[context.severity] = (errorsBySeverity[context.severity] || 0) + 1;
    }

    // Track by category
    if (this.metrics.errorsByCategory) {
      const {errorsByCategory} = this.metrics;
      errorsByCategory[context.category] = (errorsByCategory[context.category] || 0) + 1;
    }

    // Update critical errors in last 24h
    if (context.severity === 'critical') {
      this.updateCriticalErrorsCount();
    }

    // Count similar errors for pattern detection
    const similarErrors = this.recentErrors.filter(e => 
      e.errorName === context.errorName && 
      e.path === context.path &&
      e.timestamp.getTime() > (Date.now() - 3600000) // Last hour
    );
    context.similarErrorsCount = similarErrors.length;

    // Store recent error
    this.recentErrors.unshift({ ...context });
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
    }

    // Persist error to database
    this.persistErrorToDatabase(context);

    // Check for alert conditions
    this.checkAlerts();
  }

  /**
   * Update critical errors count for last 24 hours
   */
  private updateCriticalErrorsCount(): void {
    const twentyFourHoursAgo = Date.now() - 86400000;
    this.metrics.criticalErrorsLast24h = this.recentErrors.filter(
      error => error.severity === 'critical' && error.timestamp.getTime() > twentyFourHoursAgo
    ).length + 1; // +1 for current error
  }

  /**
   * Persist error to database for long-term tracking
   */
  private async persistErrorToDatabase(context: ErrorContext): Promise<void> {
    try {
      // Import the error log service dynamically to avoid circular deps
      const { errorLogService } = await import('../services/error-log-service');
      
      await errorLogService.logError({
        correlationId: context.correlationId,
        path: context.path,
        method: context.method,
        message: context.errorMessage,
        stack: context.errorStack,
        statusCode: context.statusCode,
        metadata: {
          severity: context.severity,
          category: context.category,
          isRecoverable: context.isRecoverable,
          recoveryActions: context.recoveryActions,
          similarErrorsCount: context.similarErrorsCount,
          userId: context.userId,
          userAgent: context.userAgent,
          ip: context.ip,
          responseTime: context.responseTime,
        },
      });
    } catch (persistError) {
      // Never let persistence errors break the main error flow
      log.warn('Failed to persist error to database', LogContext.DATABASE, {
        persistError: persistError instanceof Error ? persistError.message : String(persistError),
        originalError: context.correlationId,
      });
    }
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
    if (!this.alertConfig.enabled) {return;}

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
    if ((error as any).statusCode) {return (error as any).statusCode;}
    if ((error as any).status) {return (error as any).status;}
    
    // Common error types
    if (error.name === 'ValidationError') {return 400;}
    if (error.name === 'UnauthorizedError') {return 401;}
    if (error.name === 'ForbiddenError') {return 403;}
    if (error.name === 'NotFoundError') {return 404;}
    if (error.name === 'ConflictError') {return 409;}
    if (error.name === 'RateLimitError') {return 429;}
    
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
    if (!body || typeof body !== 'object') {return body;}
    
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
      errorsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      errorsByCategory: { client: 0, server: 0, network: 0, database: 0, auth: 0, validation: 0, rate_limit: 0, external_api: 0, system: 0 },
      averageResponseTime: 0,
      lastError: new Date(),
      criticalErrorsLast24h: 0,
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
    errorRate: parseInt(process.env.ERROR_RATE_THRESHOLD || '10', 10),
    responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000', 10),
    consecutiveErrors: parseInt(process.env.CONSECUTIVE_ERROR_THRESHOLD || '5', 10),
  },
});

export default ErrorTrackingService;
/**
 * Enhanced Global Error Handler Middleware
 * Integrates with the standardized error handling system
 */

import type { NextFunction, Request, Response } from 'express';

import { Sentry } from '@/observability/sentry';
import { errorLogService } from '@/services/error-log-service';
import { log, LogContext } from '@/utils/logger';

import { errorTrackingService } from './error-tracking-middleware';
import { healthCheckErrorHandler, requestTimingMiddleware,standardizedErrorHandler } from './standardized-error-handler';

/**
 * Enhanced global error handler that combines all error handling capabilities
 */
export async function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip if response already sent
  if (res.headersSent) {
    return next(err);
  }

  try {
    const currentTime = Date.now();
    const correlationId = (req.headers['x-request-id'] as string) || 
                         (req as any).requestId || 
                         'err_' + currentTime;

    // Capture exception in Sentry when available
    try {
      if (Sentry && process.env.NODE_ENV === 'production') {
        Sentry.captureException(err, {
          extra: {
            path: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            correlationId,
            userId: (req as any).user?.id,
            requestBody: sanitizeForLogging(req.body),
            queryParams: req.query,
          },
          tags: {
            endpoint: req.path,
            method: req.method,
            errorType: err.constructor.name,
          },
        });
      }
    } catch (sentryError) {
      log.warn('Sentry error capture failed', LogContext.API, {
        error: sentryError instanceof Error ? sentryError.message : String(sentryError),
      });
    }

    // Log to error service for tracking
    try {
      const statusCode = getErrorStatusCode(err);
      const errorId = await errorLogService.logError({
        correlationId,
        path: req.path,
        method: req.method,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        statusCode,
        metadata: {
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: (req as any).user?.id,
          errorType: err.constructor.name,
        },
      });

      // Store error ID for potential client reference
      (req as any).errorId = errorId;
    } catch (logError) {
      log.error('Error logging service failed', LogContext.API, {
        error: logError instanceof Error ? logError.message : String(logError),
        originalError: err.message,
      });
    }

    // Check if this is a health check endpoint
    const isHealthEndpoint = isHealthCheckPath(req.path);
    if (isHealthEndpoint) {
      return healthCheckErrorHandler(err, req, res, next);
    }

    // Use standardized error handler for all other endpoints
    standardizedErrorHandler(err, req, res, next);

  } catch (handlerError) {
    // Fallback error handling if everything else fails
    log.error('Critical error handler failure', LogContext.API, {
      handlerError: handlerError instanceof Error ? handlerError.message : String(handlerError),
      originalError: err.message,
      path: req.path,
      method: req.method,
    });

    // Last resort response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CRITICAL_ERROR',
          message: 'A critical system error occurred',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId || 'unknown',
        },
      });
    }
  }
}

/**
 * Get HTTP status code from error
 */
function getErrorStatusCode(error: Error): number {
  if ((error as any).statusCode) {return (error as any).statusCode;}
  if ((error as any).status) {return (error as any).status;}
  
  // Map common error types
  switch (error.constructor.name) {
    case 'ValidationError':
    case 'ZodError':
      return 400;
    case 'UnauthorizedError':
    case 'AuthenticationError':
      return 401;
    case 'ForbiddenError':
    case 'AuthorizationError':
      return 403;
    case 'NotFoundError':
      return 404;
    case 'ConflictError':
      return 409;
    case 'RateLimitError':
    case 'TooManyRequestsError':
      return 429;
    case 'ServiceUnavailableError':
      return 503;
    case 'TimeoutError':
      return 504;
    default:
      return 500;
  }
}

/**
 * Check if the request path is a health check endpoint
 */
function isHealthCheckPath(path: string): boolean {
  if (!path) {return false;}
  
  const healthPaths = [
    '/health',
    '/status',
    '/ready',
    '/api/v1/status',
    '/api/v1/health',
    '/api/v1/orchestration/status',
    '/api/v1/agents/status',
    '/api/v1/assistant/status',
  ];
  
  return healthPaths.includes(path) || 
         path.startsWith('/api/v1/mlx/health') ||
         path.includes('/health') ||
         path.includes('/status');
}

/**
 * Sanitize data for logging (remove sensitive information)
 */
function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') {return data;}
  
  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'credential', 
    'authorization', 'auth', 'apiKey', 'api_key',
    'refreshToken', 'accessToken', 'sessionId'
  ];
  
  const sanitized: any = Array.isArray(data) ? [] : {};
  
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    
    if (sensitiveFields.some(field => keyLower.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Middleware to initialize request context for error handling
 */
export function initializeErrorContext(req: Request, res: Response, next: NextFunction): void {
  // Add request timing
  requestTimingMiddleware(req, res, () => {
    // Add error tracking middleware
    errorTrackingService.timingMiddleware()(req, res, next);
  });
}

/**
 * Express error handler wrapper that ensures proper error handling setup
 */
export function setupErrorHandling(app: any): void {
  // Add request context initialization
  app.use(initializeErrorContext);
  
  // Add error tracking timing middleware
  app.use(errorTrackingService.timingMiddleware());
  
  // Add the main error handler (should be last)
  app.use(globalErrorHandler);
  
  // Add specific error handler for error tracking
  app.use(errorTrackingService.errorHandler());
}

// Export for backward compatibility
export const enhancedGlobalErrorHandler = globalErrorHandler;

export default globalErrorHandler;

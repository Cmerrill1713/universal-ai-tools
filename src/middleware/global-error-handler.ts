/**
 * Global Error Handler Middleware
 * Enhanced error handling with context storage and logging
 */

import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { contextStorageService } from '../services/context-storage-service';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  timestamp: number;
  stack?: string;
  query?: any;
  body?: any;
  headers?: any;
}

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    type?: string;
    details?: any;
    requestId?: string;
    timestamp: number;
  };
}

/**
 * Global error handler middleware
 */
export const globalErrorHandler: ErrorRequestHandler = async (
  err: Error | any,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const timestamp = Date.now();
    const requestId = req.headers['x-request-id'] as string || generateRequestId();

    // Create error context
    const errorContext: ErrorContext = {
      requestId,
      userId: req.headers['x-user-id'] as string,
      endpoint: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      timestamp,
      stack: err.stack,
      query: sanitizeObject(req.query),
      body: sanitizeObject(req.body),
      headers: sanitizeHeaders(req.headers)
    };

    // Determine error type and severity
    const errorType = determineErrorType(err);
    const severity = determineErrorSeverity(err);

    // Log error with context
    log.error(`${getErrorIcon(severity)} ${errorType} Error`, LogContext.MIDDLEWARE, {
      message: err.message || 'Unknown error',
      code: err.code,
      status: err.status || err.statusCode,
      requestId,
      endpoint: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Store error context for analysis (async, don't wait)
    storeErrorContext(err, errorContext).catch(contextError => {
      log.warn('⚠️ Failed to store error context', LogContext.MIDDLEWARE, {
        contextError: contextError.message
      });
    });

    // Determine response status
    const status = err.status || err.statusCode || 500;

    // Create error response
    const errorResponse: ErrorResponse = {
      error: {
        message: getClientSafeErrorMessage(err, status),
        code: err.code,
        type: errorType,
        requestId,
        timestamp,
        ...(process.env.NODE_ENV === 'development' && {
          details: {
            stack: err.stack,
            originalMessage: err.message
          }
        })
      }
    };

    // Set security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    // Send error response
    res.status(status).json(errorResponse);

  } catch (handlerError) {
    // Fallback error handling if the error handler itself fails
    log.error('❌ Critical: Error handler failed', LogContext.MIDDLEWARE, {
      handlerError: handlerError instanceof Error ? handlerError.message : String(handlerError),
      originalError: err.message || 'Unknown error'
    });

    res.status(500).json({
      error: {
        message: 'Internal Server Error',
        code: 'HANDLER_ERROR',
        type: 'critical',
        timestamp: Date.now()
      }
    });
  }
};

/**
 * Store error context for analysis
 */
async function storeErrorContext(error: Error, context: ErrorContext): Promise<void> {
  try {
    await contextStorageService.storeContext({
      category: 'error_analysis',
      title: `${context.method} ${context.endpoint} - ${error.message}`,
      content: JSON.stringify({
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack
        },
        context,
        analysis: {
          errorType: determineErrorType(error),
          severity: determineErrorSeverity(error),
          recoverable: isRecoverableError(error)
        }
      }),
      source: 'global-error-handler',
      metadata: {
        timestamp: context.timestamp,
        endpoint: context.endpoint,
        method: context.method,
        status: (error as any).status || (error as any).statusCode || 500
      }
    });
  } catch (storageError) {
    // Don't throw here to avoid recursive errors
    log.warn('⚠️ Failed to store error context', LogContext.MIDDLEWARE, {
      storageError: storageError instanceof Error ? storageError.message : String(storageError)
    });
  }
}

/**
 * Determine error type based on error properties
 */
function determineErrorType(error: Error | any): string {
  if (error.name === 'ValidationError') return 'validation';
  if (error.name === 'CastError') return 'validation';
  if (error.name === 'UnauthorizedError') return 'authentication';
  if (error.status === 401) return 'authentication';
  if (error.status === 403) return 'authorization';
  if (error.status === 404) return 'not_found';
  if (error.status === 429) return 'rate_limit';
  if (error.status >= 400 && error.status < 500) return 'client_error';
  if (error.name === 'TimeoutError') return 'timeout';
  if (error.code === 'ECONNREFUSED') return 'connection';
  if (error.code === 'ENOTFOUND') return 'network';
  return 'server_error';
}

/**
 * Determine error severity
 */
function determineErrorSeverity(error: Error | any): 'low' | 'medium' | 'high' | 'critical' {
  const status = error.status || error.statusCode || 500;
  
  if (status >= 500) return 'critical';
  if (status === 429) return 'high';
  if (status === 401 || status === 403) return 'medium';
  if (status >= 400) return 'low';
  return 'medium';
}

/**
 * Check if error is recoverable
 */
function isRecoverableError(error: Error | any): boolean {
  const status = error.status || error.statusCode || 500;
  return status < 500 && status !== 429;
}

/**
 * Get error icon based on severity
 */
function getErrorIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'high': return '🔥';
    case 'medium': return '⚠️';
    case 'low': return '🔸';
    default: return '❌';
  }
}

/**
 * Get client-safe error message
 */
function getClientSafeErrorMessage(error: Error | any, status: number): string {
  // In production, don't expose internal error messages for 5xx errors
  if (process.env.NODE_ENV === 'production' && status >= 500) {
    switch (status) {
      case 500: return 'Internal Server Error';
      case 502: return 'Bad Gateway';
      case 503: return 'Service Unavailable';
      case 504: return 'Gateway Timeout';
      default: return 'Server Error';
    }
  }

  // Return actual message for development or client errors
  return error.message || 'Unknown error occurred';
}

/**
 * Sanitize object by removing sensitive fields
 */
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveFields = [
    'password', 'token', 'secret', 'key', 'auth', 'authorization',
    'cookie', 'session', 'csrf', 'apikey', 'api_key'
  ];

  const sanitized = { ...obj };
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Sanitize headers by removing sensitive information
 */
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  const sensitiveHeaders = [
    'authorization', 'cookie', 'x-api-key', 'x-auth-token'
  ];

  for (const header of sensitiveHeaders) {
    if (header in sanitized) {
      sanitized[header] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Not found handler middleware
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new Error(`Not Found: ${req.method} ${req.path}`);
  (error as any).status = 404;
  next(error);
}

export default globalErrorHandler;
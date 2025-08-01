/**
 * Global Error Handler Middleware
 * Comprehensive error handling for service failures and unexpected errors
 * 
 * SECURITY NOTE: Sanitizes error responses to prevent information leakage
 */

import type { NextFunction, Request, Response } from 'express';
import { Request, Response, NextFunction } from 'express';


import { LogContext, log } from '@/utils/logger';
import { contextStorageService } from '@/services/context-storage-service';

interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  statusCode?: number;
  service?: string;
  context?: Record<string, any>;
}

interface ServiceError extends Error {
  statusCode?: number;
  service?: string;
  code?: string | number;
  details?: Record<string, any>;
}

export class GlobalErrorHandler {
  /**
   * Express error handler middleware
   */
  static handle(error: ServiceError, req: Request, res: Response, next: NextFunction): void {
    // If response already sent, delegate to Express default handler
    if (res.headersSent) {
      return next(error);
    }

    const errorDetails = GlobalErrorHandler.analyzeError(error, req);
    
    // Log error with appropriate level
    GlobalErrorHandler.logError(errorDetails, req);

    // Store error context for analysis
    GlobalErrorHandler.storeErrorContext(errorDetails, req).catch(err => {
      log.warn('Failed to store error context', LogContext.ERROR_HANDLING, {
        originalError: errorDetails.name,
        storageError: err.message
      });
    });

    // Send sanitized response
    const response = GlobalErrorHandler.createErrorResponse(errorDetails);
    res.status(errorDetails.statusCode || 500).json(response);
  }

  /**
   * Analyze error and extract relevant information
   */
  private static analyzeError(error: ServiceError, req: Request): ErrorDetails {
    const details: ErrorDetails = {
      name: error.name || 'UnknownError',
      message: error.message || 'An unexpected error occurred',
      code: error.code,
      statusCode: error.statusCode || this.inferStatusCode(error),
      service: error.service || this.inferService(req),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    // Add request context
    details.context = {
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      timestamp: new Date().toISOString(),
      sessionId: req.headers['x-session-id'],
      requestId: req.headers['x-request-id']
    };

    return details;
  }

  /**
   * Infer HTTP status code from error
   */
  private static inferStatusCode(error: ServiceError): number {
    // Check for specific error patterns
    if (error.message.toLowerCase().includes('not found')) return 404;
    if (error.message.toLowerCase().includes('unauthorized')) return 401;
    if (error.message.toLowerCase().includes('forbidden')) return 403;
    if (error.message.toLowerCase().includes('validation')) return 400;
    if (error.message.toLowerCase().includes('timeout')) return 408;
    if (error.message.toLowerCase().includes('rate limit')) return 429;
    
    // Database errors
    if (error.name === 'DatabaseError') return 503;
    if (error.message.includes('connection')) return 503;
    
    // Service errors
    if (error.service) return 502; // Bad Gateway for service errors
    
    return 500; // Internal Server Error
  }

  /**
   * Infer service name from request
   */
  private static inferService(req: Request): string {
    const {path} = req;
    
    if (path.startsWith('/api/v1/chat')) return 'chat-service';
    if (path.startsWith('/api/v1/memory')) return 'memory-service';
    if (path.startsWith('/api/v1/vision')) return 'vision-service';
    if (path.startsWith('/api/v1/mcp')) return 'mcp-service';
    if (path.startsWith('/api/v1/agents')) return 'agent-service';
    if (path.startsWith('/api/v1/mlx')) return 'mlx-service';
    if (path.startsWith('/api/v1/device-auth')) return 'device-auth-service';
    if (path.startsWith('/api/v1/secrets')) return 'secrets-service';
    
    return 'unknown-service';
  }

  /**
   * Log error with appropriate level and context
   */
  private static logError(errorDetails: ErrorDetails, req: Request): void {
    const logLevel = this.getLogLevel(errorDetails.statusCode || 500);
    const context = LogContext.ERROR_HANDLING;
    
    const logData = {
      errorName: errorDetails.name,
      errorCode: errorDetails.code,
      service: errorDetails.service,
      url: req.url,
      method: req.method,
      statusCode: errorDetails.statusCode,
      userAgent: req.get('User-Agent')?.substring(0, 100),
      ip: req.ip
    };

    switch (logLevel) {
      case 'error':
        log.error(`🚨 ${errorDetails.message}`, context, logData);
        break;
      case 'warn':
        log.warn(`⚠️ ${errorDetails.message}`, context, logData);
        break;
      case 'info':
        log.info(`ℹ️ ${errorDetails.message}`, context, logData);
        break;
    }
  }

  /**
   * Determine log level based on status code
   */
  private static getLogLevel(statusCode: number): 'error' | 'warn' | 'info' {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  /**
   * Store error context for analysis and debugging
   */
  private static async storeErrorContext(errorDetails: ErrorDetails, req: Request): Promise<void> {
    try {
      const errorContext = {
        error: {
          name: errorDetails.name,
          message: errorDetails.message,
          code: errorDetails.code,
          statusCode: errorDetails.statusCode,
          service: errorDetails.service
        },
        request: {
          url: req.url,
          method: req.method,
          headers: this.sanitizeHeaders(req.headers),
          body: this.sanitizeRequestBody(req.body),
          params: req.params,
          query: req.query
        },
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      };

      await contextStorageService.storeContext({
        content: JSON.stringify(errorContext, null, 2),
        category: 'error_analysis',
        source: 'global-error-handler',
        userId: req.headers['x-user-id'] as string || 'anonymous',
        projectPath: process.cwd(),
        metadata: {
          errorType: errorDetails.name,
          service: errorDetails.service,
          statusCode: errorDetails.statusCode,
          severity: this.getErrorSeverity(errorDetails.statusCode || 500)
        }
      });
    } catch (storageError) {
      // Don't throw - just log the failure
      log.warn('Failed to store error context', LogContext.ERROR_HANDLING, {
        error: storageError instanceof Error ? storageError.message : String(storageError)
      });
    }
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private static sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'cookie',
      'set-cookie',
      'x-secret',
      'x-token'
    ];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private static sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'apiKey',
      'api_key',
      'auth',
      'authorization'
    ];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Determine error severity
   */
  private static getErrorSeverity(statusCode: number): 'critical' | 'high' | 'medium' | 'low' {
    if (statusCode >= 500) return 'critical';
    if (statusCode >= 400) return 'high';
    if (statusCode >= 300) return 'medium';
    return 'low';
  }

  /**
   * Create sanitized error response for client
   */
  private static createErrorResponse(errorDetails: ErrorDetails): any {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const response = {
      success: false,
      error: {
        message: this.getSanitizedMessage(errorDetails.message, errorDetails.statusCode || 500),
        code: errorDetails.code,
        type: errorDetails.name,
        timestamp: new Date().toISOString()
      },
      meta: {
        service: errorDetails.service,
        requestId: errorDetails.context?.requestId
      }
    };

    // Add debug information in development
    if (!isProduction) {
      (response.error as any).stack = errorDetails.stack;
      (response.error as any).details = errorDetails.context;
    }

    return response;
  }

  /**
   * Sanitize error message for client response
   */
  private static getSanitizedMessage(message: string, statusCode: number): string {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (!isProduction) {
      return message; // Return full message in development
    }

    // In production, return generic messages for security
    switch (Math.floor(statusCode / 100)) {
      case 4:
        if (statusCode === 404) return 'Resource not found';
        if (statusCode === 401) return 'Authentication required';
        if (statusCode === 403) return 'Access forbidden';
        if (statusCode === 429) return 'Rate limit exceeded';
        return 'Invalid request';
      
      case 5:
        if (statusCode === 503) return 'Service temporarily unavailable';
        if (statusCode === 502) return 'Service communication error';
        return 'Internal server error';
      
      default:
        return 'An error occurred';
    }
  }

  /**
   * Create async error handler for promises
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create service error with context
   */
  static createServiceError(
    message: string,
    statusCode = 500,
    service?: string,
    code?: string | number,
    details?: Record<string, any>
  ): ServiceError {
    const error = new Error(message) as ServiceError;
    error.statusCode = statusCode;
    error.service = service;
    error.code = code;
    error.details = details;
    return error;
  }
}

// Export middleware function
export const globalErrorHandler = GlobalErrorHandler.handle;

// Export async handler
export const {asyncHandler} = GlobalErrorHandler;

// Export error creator
export const {createServiceError} = GlobalErrorHandler;

export default GlobalErrorHandler;
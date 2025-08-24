/**
 * Standardized Error Handler Middleware (Fixed)
 * Provides consistent error responses across all API endpoints
 */

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { sendError } from '@/utils/api-response';
import { log, LogContext } from '@/utils/logger';

// Standard HTTP status codes for different error types
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Error type mappings to standardize error codes and status codes
export const ERROR_MAPPINGS = {
  ValidationError: { code: 'VALIDATION_ERROR', status: HTTP_STATUS.BAD_REQUEST },
  ZodError: { code: 'VALIDATION_ERROR', status: HTTP_STATUS.BAD_REQUEST },
  UnauthorizedError: { code: 'UNAUTHORIZED', status: HTTP_STATUS.UNAUTHORIZED },
  AuthenticationError: { code: 'AUTHENTICATION_ERROR', status: HTTP_STATUS.UNAUTHORIZED },
  ForbiddenError: { code: 'FORBIDDEN_ERROR', status: HTTP_STATUS.FORBIDDEN },
  AuthorizationError: { code: 'FORBIDDEN_ERROR', status: HTTP_STATUS.FORBIDDEN },
  NotFoundError: { code: 'NOT_FOUND', status: HTTP_STATUS.NOT_FOUND },
  ConflictError: { code: 'CONFLICT', status: HTTP_STATUS.CONFLICT },
  RateLimitError: { code: 'RATE_LIMIT_EXCEEDED', status: HTTP_STATUS.TOO_MANY_REQUESTS },
  TooManyRequestsError: { code: 'RATE_LIMIT_EXCEEDED', status: HTTP_STATUS.TOO_MANY_REQUESTS },
  ServiceUnavailableError: { code: 'SERVICE_UNAVAILABLE', status: HTTP_STATUS.SERVICE_UNAVAILABLE },
  TimeoutError: { code: 'SERVICE_UNAVAILABLE', status: HTTP_STATUS.GATEWAY_TIMEOUT },
  ContentBlockedError: { code: 'CONTENT_BLOCKED', status: HTTP_STATUS.UNPROCESSABLE_ENTITY },
  SafetyCheckError: { code: 'SAFETY_CHECK_ERROR', status: HTTP_STATUS.UNPROCESSABLE_ENTITY },
  Error: { code: 'INTERNAL_ERROR', status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
} as const;

export interface StandardizedError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;
  context?: Record<string, unknown>;
}

/**
 * Create a standardized error object
 */
export function createStandardizedError(
  error: Error | string,
  code?: string,
  statusCode?: number,
  details?: unknown,
  context?: Record<string, unknown>
): StandardizedError {
  const err = typeof error === 'string' ? new Error(error) : error;
  const standardizedError = err as StandardizedError;
  
  if (code) {standardizedError.code = code;}
  if (statusCode) {standardizedError.statusCode = statusCode;}
  if (details) {standardizedError.details = details;}
  if (context) {standardizedError.context = context;}
  
  return standardizedError;
}

/**
 * Get error details from various error types
 */
function getErrorDetails(error: Error): {
  code: string;
  statusCode: number;
  message: string;
  details?: unknown;
} {
  // Handle Zod validation errors specially
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: (err as any).received,
    }));
    
    return {
      code: 'VALIDATION_ERROR',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: 'Request validation failed',
      details: formattedErrors,
    };
  }

  // Handle standardized errors with custom properties
  const standardizedError = error as StandardizedError;
  if (standardizedError.code && standardizedError.statusCode) {
    return {
      code: standardizedError.code,
      statusCode: standardizedError.statusCode,
      message: error.message || 'An error occurred',
      details: standardizedError.details,
    };
  }

  // Map common error types
  const errorType = error.constructor.name;
  const mapping = ERROR_MAPPINGS[errorType as keyof typeof ERROR_MAPPINGS] || ERROR_MAPPINGS.Error;
  
  return {
    code: mapping.code,
    statusCode: mapping.status,
    message: error.message || 'An error occurred',
    details: standardizedError.details,
  };
}

/**
 * Determine if error details should be exposed to client
 */
function shouldExposeErrorDetails(statusCode: number, environment: string = 'production'): boolean {
  // Always expose details for client errors (4xx)
  if (statusCode >= 400 && statusCode < 500) {
    return true;
  }
  
  // Only expose server error details in development
  return environment === 'development';
}

/**
 * Enhanced standardized error handler middleware
 */
export function standardizedErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip if response already sent
  if (res.headersSent) {
    return next(error);
  }

  const currentTime = Date.now();
  const startTime = (req as any).startTime || currentTime;
  const requestId = (req as any).requestId || generateRequestId();
  
  // Get standardized error details
  const { code, statusCode, message, details } = getErrorDetails(error);
  
  // Create context for logging
  const errorContext = {
    requestId,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    userId: (req as any).user?.id,
    responseTime: currentTime - startTime,
    statusCode,
    errorCode: code,
    errorType: error.constructor.name,
  };

  // Log the error with appropriate level
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  log[logLevel](`API Error: ${code}`, LogContext.API, {
    message: error.message,
    stack: error.stack,
    context: errorContext,
    details: details,
  });

  // Prepare response details
  const shouldExposeDetails = shouldExposeErrorDetails(statusCode, process.env.NODE_ENV);
  const responseDetails = shouldExposeDetails ? details : undefined;
  
  // Send standardized error response
  sendError(res, code as any, message, statusCode, responseDetails);
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  const now = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `req_${now}_${random}`;
}

/**
 * Async error wrapper for route handlers
 */
export function asyncErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation error handler specifically for Zod
 */
export function handleValidationError(
  schema: any,
  target: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = target === 'body' ? req.body : 
                   target === 'query' ? req.query : req.params;
      
      const result = schema.safeParse(data);
      
      if (!result.success) {
        const zodError = new ZodError(result.error.errors);
        return next(zodError);
      }
      
      // Replace the original data with validated data
      if (target === 'body') {req.body = result.data;} else if (target === 'query') {req.query = result.data;} else {req.params = result.data;}
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create typed API error classes
 */
export class ApiValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ApiAuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ApiAuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class ApiNotFoundError extends Error {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ApiConflictError extends Error {
  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ApiRateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ApiServiceUnavailableError extends Error {
  constructor(service: string = 'Service') {
    super(`${service} is currently unavailable`);
    this.name = 'ServiceUnavailableError';
  }
}

export class ApiContentBlockedError extends Error {
  constructor(reason: string = 'Content violates safety policies') {
    super(reason);
    this.name = 'ContentBlockedError';
  }
}

/**
 * Middleware to add request timing
 */
export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const currentTime = Date.now();
  (req as any).startTime = currentTime;
  (req as any).requestId = generateRequestId();
  next();
}

/**
 * Health check specific error handler that ensures proper responses
 */
export function healthCheckErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // For health check endpoints, always return a degraded status instead of failure
  const isHealthEndpoint = req.path.includes('/health') || 
                          req.path.includes('/status') || 
                          req.path.includes('/ready');
  
  if (isHealthEndpoint && !res.headersSent) {
    log.warn('Health check endpoint error - returning degraded status', LogContext.API, {
      path: req.path,
      error: error.message,
    });
    
    res.status(200).json({
      success: true,
      status: 'degraded',
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Service is running but degraded',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  // For non-health endpoints, use standard error handling
  standardizedErrorHandler(error, req, res, next);
}

export default standardizedErrorHandler;

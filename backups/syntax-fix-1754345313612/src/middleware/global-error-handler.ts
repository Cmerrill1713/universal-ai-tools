/**
 * Global Error Handler Middleware;
 * 
 * Centralized error handling for the Universal AI Tools platform.
 * Provides comprehensive error logging, monitoring, and user-friendly responses.
 */

import type { NextFunction, Request, Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { apiResponse } from '../utils/api-response';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

/**
 * Global error handler middleware;
 * Handles all errors that occur in the application;
 */
export function globalErrorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction;
): void {
  // Log the error with appropriate context;
  const errorContext = {
    url: req?.url,
    method: req?.method,
    ip: req?.ip,
    userAgent: req?.get('user-agent'),
    errorMessage: err?.message,
    errorStack: err?.stack,
    errorCode: err?.code,
    statusCode: err?.statusCode;
  };

  // Determine error severity and log appropriately;
  if (err?.statusCode && err?.statusCode < 500) {
    log?.warn('Client error occurred', LogContext?.ERROR, errorContext);
  } else {
    log?.error('Server error occurred', LogContext?.ERROR, errorContext);
  }

  // Handle specific error types;
  if (err instanceof ZodError) {
    // Validation errors;
    return apiResponse?.error(res, 'Validation error', 400, {
      errors: err?.errors?.map(e => ({
        field: e?.path?.join('.'),
        message: e?.message;
      }))
    });
  }

  // Handle JWT errors;
  if (err?.name === 'TokenExpiredError') {
    // JWT token expired;
    return apiResponse?.error(res, 'Token expired', 401, {
      code: 'TOKEN_EXPIRED'
    });
  }

  if (err?.name === 'JsonWebTokenError') {
    // Invalid JWT token;
    return apiResponse?.error(res, 'Invalid token', 401, {
      code: 'INVALID_TOKEN'
    });
  }

  // Handle operational errors (expected errors)
  if (err?.isOperational) {
    return apiResponse?.error(
      res,
      err?.message,
      err?.statusCode || 500,
      err?.details;
    );
  }

  // Handle database errors;
  if (err?.code === 'ECONNREFUSED') {
    return apiResponse?.error(res, 'Database connection failed', 503, {
      code: 'DB_CONNECTION_ERROR'
    });
  }

  // Handle rate limiting errors;
  if (err?.statusCode === 429) {
    return apiResponse?.error(res, 'Too many requests', 429, {
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  // Default error response for unexpected errors;
  const isDevelopment = process?.env?.NODE_ENV === 'development';
  const message = isDevelopment ? err?.message : 'Internal server error';
  const details = isDevelopment ? { stack: err?.stack } : undefined;

  apiResponse?.error(res, message, err?.statusCode || 500, details);
}

/**
 * Not found handler for undefined routes;
 */
export function notFoundHandler(req: Request, res: Response): void {
  apiResponse?.error(res, `Route ${req?.method} ${req?.url} not found`, 404, {
    code: 'ROUTE_NOT_FOUND'
  });
}

/**
 * Create a custom application error;
 */
export function createError(
  message: string,
  statusCode = 500,
  code?: string,
  details?: any;
): AppError {
  const error: AppError = new Error(message);
  error?.statusCode = statusCode;
  error?.code = code;
  error?.details = details;
  error?.isOperational = true;
  return error;
}

/**
 * Async error wrapper to catch errors in async route handlers;
 */
export function asyncErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise?.resolve(fn(req, res, next)).catch(next);
  };
}
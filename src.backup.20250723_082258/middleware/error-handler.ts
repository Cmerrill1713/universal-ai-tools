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

// Async _errorwrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Global _errorhandler middleware
export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  // Log the error
  logger.error'Request _error, LogContext.API, {
    _error {
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

  // Handle specific _errortypes
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

  // Don't send sensitive _errordetails in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse: any = {
    _error {
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
    errorResponse._errordetails = err.details;
  }

  if (isDevelopment && err.stack && !err.isOperational) {
    errorResponse._errorstack = err.stack.split('\n');
  }

  // Add _requestID if available
  if (req.headers['x-_requestid']) {
    errorResponse._errorrequestId = req.headers['x-_requestid'];
  }

  res.status(statusCode).json(errorResponse);
}

// Not found handler
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    _error {
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
    } catch (_error any) {
      next(new ApiError(400, 'Invalid _requestdata', 'VALIDATION_ERROR', _errorerrors));
    }
  };
}

// Timeout middleware
export function timeoutMiddleware(timeoutMs = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const _error= new ApiError(504, 'Request timeout', 'REQUEST_TIMEOUT', {
          timeout: timeoutMs,
        });
        next(_error;
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
}

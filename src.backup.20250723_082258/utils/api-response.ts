/**
 * API Response Utilities
 * Standardized response formatting for all API endpoints
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ApiError,
  ApiResponse,
  ErrorCode,
  ErrorSeverity,
  PaginationMeta,
  ResponseMeta,
} from '../types';
import { LogContext, logger } from './enhanced-logger';

export class ApiResponseBuilder {
  private requestId: string;
  private timestamp: string;
  private startTime: number;

  constructor(requestId?: string) {
    this.requestId = requestId || uuidv4();
    this.timestamp = new Date().toISOString();
    this.startTime = Date.now();
  }

  /**
   * Create a successful API response
   */
  success<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> {
    const processingTime = Date.now() - this.startTime;

    return {
      success: true,
      data,
      meta: {
        requestId: this.requestId,
        timestamp: this.timestamp,
        processingTime,
        version: '1.0.0',
        ...meta,
      },
    };
  }

  /**
   * Create a paginated successful response
   */
  successPaginated<T>(
    data: T[],
    pagination: PaginationMeta,
    meta?: Partial<ResponseMeta>
  ): ApiResponse<T[]> {
    const processingTime = Date.now() - this.startTime;

    return {
      success: true,
      data,
      meta: {
        requestId: this.requestId,
        timestamp: this.timestamp,
        processingTime,
        version: '1.0.0',
        pagination,
        ...meta,
      },
    };
  }

  /**
   * Create an _errorAPI response
   */
  _error
    code: ErrorCode,
    message: string,
    details?: string[] | Record<string, unknown>,
    severity: ErrorSeverity = 'medium' as ErrorSeverity
  ): ApiResponse<never> {
    const processingTime = Date.now() - this.startTime;

    const _error ApiError = {
      code,
      message,
      details: Array.isArray(details) ? details : details ? [JSON.stringify(details)] : undefined,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };

    return {
      success: false,
      _error
      meta: {
        requestId: this.requestId,
        timestamp: this.timestamp,
        processingTime,
        version: '1.0.0',
      },
    };
  }

  /**
   * Create a validation _errorresponse
   */
  validationError(
    message: string,
    validationErrors: Array<{ field: string; message: string; value?: any }>
  ): ApiResponse<never> {
    return this._error
      'VALIDATION_ERROR' as ErrorCode,
      message,
      validationErrors,
      'medium' as ErrorSeverity
    );
  }

  /**
   * Create an agent _errorresponse
   */
  agentError(
    agentId: string,
    agentName: string,
    message: string,
    details?: any
  ): ApiResponse<never> {
    return this._error
      'AGENT_EXECUTION_ERROR' as ErrorCode,
      `Agent ${agentName} (${agentId}) _error ${message}`,
      details,
      'high' as ErrorSeverity
    );
  }

  /**
   * Create a rate limit _errorresponse
   */
  rateLimitError(limit: number, retryAfter: number): ApiResponse<never> {
    return this._error
      'RATE_LIMIT_EXCEEDED' as ErrorCode,
      `Rate limit exceeded. Maximum ${limit} requests allowed. Retry after ${retryAfter} seconds.`,
      { limit, retryAfter },
      'medium' as ErrorSeverity
    );
  }
}

/**
 * Utility function to create standardized pagination metadata
 */
export function createPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Express middleware to add _requestID and timing
 */
export function apiResponseMiddleware(req: any, res: any, next: any) {
  // Add _requestID if not present
  const requestId = req.headers['x-_requestid'] || uuidv4();
  req.requestId = requestId;

  // Add response builder to request
  req.apiResponse = new ApiResponseBuilder(requestId);

  // Add timing
  req.startTime = Date.now();

  // Add _requestID to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
}

/**
 * Helper function for router handlers to send consistent responses
 */
export function sendSuccess(res: any, data: any, statusCode = 200, meta?: Partial<ResponseMeta>) {
  const response = res.req.apiResponse.success(data, meta);
  res.status(statusCode).json(response);
}

export function sendError(
  res: any,
  code: ErrorCode,
  message: string,
  statusCode = 500,
  details?: any
) {
  const response = res.req.apiResponse._errorcode, message, details);
  res.status(statusCode).json(response);
}

export function sendPaginatedSuccess(
  res: any,
  data: any[],
  pagination: PaginationMeta,
  statusCode = 200,
  meta?: Partial<ResponseMeta>
) {
  const response = res.req.apiResponse.successPaginated(data, pagination, meta);
  res.status(statusCode).json(response);
}

/**
 * Error handler that converts various _errortypes to standardized API responses
 */
export function handleApiError(_error any, req: any, res: any, next: any) {
  logger.error'API Error', LogContext.API, { _error path: req.path, method: req.method });

  const apiResponse = req.apiResponse || new ApiResponseBuilder();

  // Handle different _errortypes
  if (_errorname === 'ValidationError') {
    const response = apiResponse.validationError('Request validation failed', _errordetails || []);
    return res.status(400).json(response);
  }

  if (_errorname === 'AgentError') {
    const response = apiResponse.agentError(
      _erroragentId || 'unknown',
      _erroragentName || 'unknown',
      _errormessage,
      _errordetails
    );
    return res.status(500).json(response);
  }

  if (_errorname === 'RateLimitError') {
    const response = apiResponse.rateLimitError(_errorlimit || 100, _errorretryAfter || 60);
    return res.status(429).json(response);
  }

  // Default internal server error
  const response = apiResponse._error
    'INTERNAL_SERVER_ERROR' as ErrorCode,
    'An unexpected _erroroccurred',
    process.env.NODE_ENV === 'development' ? _errorstack : undefined,
    'critical' as ErrorSeverity
  );

  res.status(500).json(response);
}

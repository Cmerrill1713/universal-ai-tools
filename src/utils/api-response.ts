import type { Response } from 'express';
import type { ApiResponse, ErrorCode, PaginatedResponse, PaginationMeta } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Create standardized API response
export function createApiResponse<T>(data?: T, metadata?: Record<string, unknown>): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      ...metadata,
    },
  };
}

// Create error response
export function createErrorResponse(
  code: keyof ErrorCode,
  message: string,
  details?: unknown
): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  };
}

// Create pagination metadata
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

// Send success response
export function sendSuccess<T>(
  res: Response,
  data?: T,
  statusCode = 200,
  metadata?: Record<string, unknown>
): void {
  const response = createApiResponse(data, metadata);
  res.status(statusCode).json(response);
}

// Send paginated success response
export function sendPaginatedSuccess<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  statusCode = 200
): void {
  const response: PaginatedResponse<T> = {
    ...createApiResponse(data),
    pagination,
  };
  res.status(statusCode).json(response);
}

// Send error response
export function sendError(
  res: Response,
  code: keyof ErrorCode,
  message: string,
  statusCode = 400,
  details?: unknown
): void {
  const response = createErrorResponse(code, message, details);
  res.status(statusCode).json(response);
}

// Export apiResponse for backward compatibility
export const apiResponse = apiResponseMiddleware;

// Export ApiError class for error handling
export class ApiError extends Error {
  constructor(
    public code: keyof ErrorCode,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Middleware to add API response helpers to Express response
export function apiResponseMiddleware(req: unknown, res: unknown, next: unknown): void {
  const expressRes = res as any;
  expressRes.sendSuccess = (
    data?: unknown,
    statusCode?: number,
    metadata?: Record<string, unknown>
  ) => sendSuccess(expressRes, data, statusCode, metadata);

  expressRes.sendPaginatedSuccess = (
    data: unknown[],
    pagination: PaginationMeta,
    statusCode?: number
  ) => sendPaginatedSuccess(expressRes, data, pagination, statusCode);

  expressRes.sendError = (
    code: keyof ErrorCode,
    message: string,
    statusCode?: number,
    details?: unknown
  ) => sendError(expressRes, code, message, statusCode, details);

  (next as any)();
}

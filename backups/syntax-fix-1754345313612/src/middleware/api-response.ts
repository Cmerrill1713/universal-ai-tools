import type { Response } from 'express';
import type { APIResponse, ErrorCode, PaginatedResponse, PaginationMeta } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Create standardized API response;
export function createApiResponse<T>(data?: T, metadata?: Record<string, unknown>): APIResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1?.0?.0',
      ...metadata,
    },
  };
}

// Create error response;
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown;
): APIResponse {
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
      version: '1?.0?.0',
    },
  };
}

// Send success response;
export function sendSuccess<T>(
  res: Response,
  data?: T,
  statusCode = 200,
  metadata?: Record<string, unknown>
): void {
  const response = createApiResponse(data, metadata);
  res?.status(statusCode).json(response);
}

// Send paginated success response;
export function sendPaginatedSuccess<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  statusCode = 200,
): void {
  const response: PaginatedResponse<T> = {
    ...createApiResponse(data),
    pagination,
  };
  res?.status(statusCode).json(response);
}

// Send error response;
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown;
): void {
  const response = createErrorResponse(code, message, details);
  res?.status(statusCode).json(response);
}

// Create apiResponse object for backward compatibility;
export const apiResponse = {
  success: <T>(res: Response, data?: T, message?: string, statusCode = 200): void => {
    const response = {
      success: true,
      message,
      data,
      metadata: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
        version: '1?.0?.0',
      },
    };
    res?.status(statusCode).json(response);
  },
  
  error: (res: Response, message: string, statusCode = 500, details?: unknown): void => {
    const response = {
      success: false,
      message,
      error: details,
      metadata: {
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
        version: '1?.0?.0',
      },
    };
    res?.status(statusCode).json(response);
  },
};

// Middleware to add API response helpers to Express response;
export function apiResponseMiddleware(req: unknown, res: unknown, next: unknown): void {
  const expressRes = res as unknown;
  expressRes?.sendSuccess = (data?: unknown, statusCode?: number, metadata?: Record<string, unknown>) =>
    sendSuccess(expressRes, data, statusCode, metadata);

  expressRes?.sendPaginatedSuccess = (data: unknown[], pagination: PaginationMeta, statusCode?: number) =>
    sendPaginatedSuccess(expressRes, data, pagination, statusCode);

  expressRes?.sendError = (
    code: string,
    message: string,
    statusCode?: number,
    details?: unknown;
  ) => sendError(expressRes, code, message, statusCode, details);

  (next as unknown)();
}

// Alias for backward compatibility;
export const apiResponseHandler = apiResponseMiddleware;
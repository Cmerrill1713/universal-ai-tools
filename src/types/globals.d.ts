// Global type definitions
import type { ErrorCode, PaginationMeta } from './index';

declare global {
  var console: Console;
  interface Console {
    log(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    debug(message?: any, ...optionalParams: any[]): void;
  }

  namespace Express {
    interface Response {
      sendSuccess<T>(
        data?: T,
        statusCode?: number,
        metadata?: Record<string, unknown>
      ): void;

      sendPaginatedSuccess<T>(
        data: T[],
        pagination: PaginationMeta,
        statusCode?: number
      ): void;

      sendError(
        code: keyof ErrorCode,
        message: string,
        statusCode?: number,
        details?: unknown
      ): void;
    }
  }
}

export {};

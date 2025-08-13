import type { Response } from 'express';
import type { ApiResponse, ErrorCode, PaginationMeta } from '@/types';
export declare function createApiResponse<T>(data?: T, metadata?: Record<string, unknown>): ApiResponse<T>;
export declare function createErrorResponse(code: keyof ErrorCode, message: string, details?: unknown): ApiResponse;
export declare function createPaginationMeta(page: number, limit: number, total: number): PaginationMeta;
export declare function sendSuccess<T>(res: Response, data?: T, statusCode?: number, metadata?: Record<string, unknown>): void;
export declare function sendPaginatedSuccess<T>(res: Response, data: T[], pagination: PaginationMeta, statusCode?: number): void;
export declare function sendError(res: Response, code: keyof ErrorCode, message: string, statusCode?: number, details?: unknown): void;
export declare const apiResponse: typeof apiResponseMiddleware;
export declare class ApiError extends Error {
    code: keyof ErrorCode;
    statusCode: number;
    details?: unknown;
    constructor(code: keyof ErrorCode, message: string, statusCode?: number, details?: unknown);
}
export declare function apiResponseMiddleware(req: unknown, res: unknown, next: unknown): void;
//# sourceMappingURL=api-response.d.ts.map
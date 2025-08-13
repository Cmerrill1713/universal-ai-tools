import { v4 as uuidv4 } from 'uuid';
export function createApiResponse(data, metadata) {
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
export function createErrorResponse(code, message, details) {
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
export function createPaginationMeta(page, limit, total) {
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
export function sendSuccess(res, data, statusCode = 200, metadata) {
    const response = createApiResponse(data, metadata);
    res.status(statusCode).json(response);
}
export function sendPaginatedSuccess(res, data, pagination, statusCode = 200) {
    const response = {
        ...createApiResponse(data),
        pagination,
    };
    res.status(statusCode).json(response);
}
export function sendError(res, code, message, statusCode = 400, details) {
    const response = createErrorResponse(code, message, details);
    res.status(statusCode).json(response);
}
export const apiResponse = apiResponseMiddleware;
export class ApiError extends Error {
    code;
    statusCode;
    details;
    constructor(code, message, statusCode = 400, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'ApiError';
    }
}
export function apiResponseMiddleware(req, res, next) {
    const expressRes = res;
    expressRes.sendSuccess = (data, statusCode, metadata) => sendSuccess(expressRes, data, statusCode, metadata);
    expressRes.sendPaginatedSuccess = (data, pagination, statusCode) => sendPaginatedSuccess(expressRes, data, pagination, statusCode);
    expressRes.sendError = (code, message, statusCode, details) => sendError(expressRes, code, message, statusCode, details);
    next();
}
//# sourceMappingURL=api-response.js.map
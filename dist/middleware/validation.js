import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
export const validateRequest = (schema) => {
    return (req, res, next) => {
        try {
            const validation = schema.safeParse(req.body);
            if (!validation.success) {
                log.warn('Request validation failed', LogContext.API, {
                    path: req.path,
                    method: req.method,
                    errors: validation.error.errors,
                });
                return sendError(res, 'VALIDATION_ERROR', 'Invalid request data', 400, validation.error.errors);
            }
            req.body = validation.data;
            next();
        }
        catch (error) {
            log.error('Validation middleware error', LogContext.API, { error });
            return sendError(res, 'VALIDATION_ERROR', 'Validation failed', 500);
        }
    };
};
export const validateQuery = (schema) => {
    return (req, res, next) => {
        try {
            const validation = schema.safeParse(req.query);
            if (!validation.success) {
                log.warn('Query validation failed', LogContext.API, {
                    path: req.path,
                    method: req.method,
                    errors: validation.error.errors,
                });
                return sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, validation.error.errors);
            }
            req.query = validation.data;
            next();
        }
        catch (error) {
            log.error('Query validation middleware error', LogContext.API, { error });
            return sendError(res, 'VALIDATION_ERROR', 'Query validation failed', 500);
        }
    };
};
export const validateParams = (schema) => {
    return (req, res, next) => {
        try {
            const validation = schema.safeParse(req.params);
            if (!validation.success) {
                log.warn('Params validation failed', LogContext.API, {
                    path: req.path,
                    method: req.method,
                    errors: validation.error.errors,
                });
                return sendError(res, 'VALIDATION_ERROR', 'Invalid URL parameters', 400, validation.error.errors);
            }
            req.params = validation.data;
            next();
        }
        catch (error) {
            log.error('Params validation middleware error', LogContext.API, { error });
            return sendError(res, 'VALIDATION_ERROR', 'Params validation failed', 500);
        }
    };
};
export default validateRequest;
//# sourceMappingURL=validation.js.map
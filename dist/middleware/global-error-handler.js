import { Sentry } from '@/observability/sentry';
import { errorLogService } from '@/services/error-log-service';
import { log, LogContext } from '@/utils/logger';
export async function globalErrorHandler(err, req, res, next) {
    try {
        const correlationId = req.headers['x-request-id'] || `err_${Date.now()}`;
        try {
            if (Sentry) {
                Sentry.captureException(err, {
                    extra: {
                        path: req.path,
                        method: req.method,
                        userAgent: req.get('User-Agent'),
                        ip: req.ip,
                        correlationId,
                    },
                });
            }
        }
        catch { }
        const id = await errorLogService.logError({
            correlationId,
            path: req.path,
            method: req.method,
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            statusCode: 500,
            metadata: {
                userAgent: req.get('User-Agent'),
                ip: req.ip,
            },
        });
        const p = req.path || '';
        const isHealth = p === '/health' ||
            p === '/api/v1/status' ||
            p === '/api/v1/orchestration/status' ||
            p === '/api/v1/agents' ||
            p === '/api/v1/agents/registry' ||
            p === '/api/v1/agents/status' ||
            p.startsWith('/api/v1/mlx/health') ||
            p === '/api/v1/assistant/status';
        if (isHealth) {
            res.status(200).json({
                success: true,
                degraded: true,
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Degraded: An error occurred',
                },
                correlationId: id || correlationId,
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred',
            },
            correlationId: id || correlationId,
        });
    }
    catch (logError) {
        log.error('Global error logging failed', LogContext.API, {
            error: logError instanceof Error ? logError.message : String(logError),
        });
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
        });
    }
}
//# sourceMappingURL=global-error-handler.js.map
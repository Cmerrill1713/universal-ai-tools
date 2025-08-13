import { performance } from 'perf_hooks';
import { sendError } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
class ErrorTrackingService {
    metrics = {
        totalErrors: 0,
        errorsByType: {},
        errorsByPath: {},
        errorsByStatusCode: {},
        averageResponseTime: 0,
        lastError: new Date(),
    };
    recentErrors = [];
    consecutiveErrors = 0;
    lastSuccessTime = Date.now();
    responseTimeBuffer = [];
    alertConfig;
    maxRecentErrors = 100;
    constructor(alertConfig = {}) {
        this.alertConfig = {
            enabled: false,
            thresholds: {
                errorRate: 10,
                responseTime: 5000,
                consecutiveErrors: 5,
            },
            ...alertConfig,
        };
        setInterval(() => this.cleanupOldErrors(), 60000);
    }
    errorHandler() {
        return (error, req, res, next) => {
            const startTime = req.startTime || Date.now();
            const responseTime = Date.now() - startTime;
            const errorContext = {
                requestId: req.requestId || this.generateRequestId(),
                userId: req.user?.id,
                userAgent: req.headers['user-agent'],
                ip: req.ip || req.connection.remoteAddress || 'unknown',
                path: req.path,
                method: req.method,
                timestamp: new Date(),
                responseTime,
                headers: this.sanitizeHeaders(req.headers),
                body: this.sanitizeBody(req.body),
                query: req.query,
                params: req.params,
            };
            this.trackError(error, errorContext);
            const statusCode = this.getStatusCode(error);
            const message = this.getErrorMessage(error, statusCode);
            log.error('🚨 Unhandled error', LogContext.API, {
                error: error.message,
                stack: error.stack,
                context: errorContext,
                statusCode,
            });
            if (!res.headersSent) {
                sendError(res, 'INTERNAL_ERROR', message, statusCode);
            }
        };
    }
    timingMiddleware() {
        return (req, res, next) => {
            const startTime = performance.now();
            req.startTime = startTime;
            req.requestId = this.generateRequestId();
            res.on('finish', () => {
                const responseTime = performance.now() - startTime;
                this.trackResponseTime(responseTime);
                if (res.statusCode < 400) {
                    this.consecutiveErrors = 0;
                    this.lastSuccessTime = Date.now();
                }
                if (responseTime > 1000) {
                    log.warn('🐌 Slow request detected', LogContext.API, {
                        path: req.path,
                        method: req.method,
                        responseTime: Math.round(responseTime),
                        statusCode: res.statusCode,
                        requestId: req.requestId,
                    });
                }
            });
            next();
        };
    }
    trackError(error, context) {
        this.metrics.totalErrors++;
        this.metrics.lastError = context.timestamp;
        this.consecutiveErrors++;
        const errorType = error.constructor.name;
        this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
        this.metrics.errorsByPath[context.path] = (this.metrics.errorsByPath[context.path] || 0) + 1;
        const statusCode = this.getStatusCode(error);
        this.metrics.errorsByStatusCode[statusCode] = (this.metrics.errorsByStatusCode[statusCode] || 0) + 1;
        this.recentErrors.unshift({ ...context });
        if (this.recentErrors.length > this.maxRecentErrors) {
            this.recentErrors = this.recentErrors.slice(0, this.maxRecentErrors);
        }
        this.checkAlerts();
    }
    trackResponseTime(responseTime) {
        this.responseTimeBuffer.push(responseTime);
        if (this.responseTimeBuffer.length > 100) {
            this.responseTimeBuffer = this.responseTimeBuffer.slice(-100);
        }
        this.metrics.averageResponseTime =
            this.responseTimeBuffer.reduce((sum, time) => sum + time, 0) / this.responseTimeBuffer.length;
    }
    checkAlerts() {
        if (!this.alertConfig.enabled)
            return;
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentErrorCount = this.recentErrors.filter(error => error.timestamp.getTime() > oneMinuteAgo).length;
        if (recentErrorCount >= this.alertConfig.thresholds.errorRate) {
            this.sendAlert('HIGH_ERROR_RATE', {
                message: `High error rate detected: ${recentErrorCount} errors in the last minute`,
                errorRate: recentErrorCount,
                threshold: this.alertConfig.thresholds.errorRate,
            });
        }
        if (this.consecutiveErrors >= this.alertConfig.thresholds.consecutiveErrors) {
            this.sendAlert('CONSECUTIVE_ERRORS', {
                message: `${this.consecutiveErrors} consecutive errors detected`,
                consecutiveErrors: this.consecutiveErrors,
                threshold: this.alertConfig.thresholds.consecutiveErrors,
                timeSinceLastSuccess: now - this.lastSuccessTime,
            });
        }
        if (this.metrics.averageResponseTime > this.alertConfig.thresholds.responseTime) {
            this.sendAlert('SLOW_RESPONSE_TIME', {
                message: `Slow response time detected: ${Math.round(this.metrics.averageResponseTime)}ms average`,
                averageResponseTime: this.metrics.averageResponseTime,
                threshold: this.alertConfig.thresholds.responseTime,
            });
        }
    }
    sendAlert(type, data) {
        const alert = {
            type,
            timestamp: new Date().toISOString(),
            service: 'Universal AI Tools',
            data,
            metrics: this.getMetrics(),
        };
        log.error(`🚨 ALERT: ${type}`, LogContext.SYSTEM, alert);
    }
    getStatusCode(error) {
        if (error.statusCode)
            return error.statusCode;
        if (error.status)
            return error.status;
        if (error.name === 'ValidationError')
            return 400;
        if (error.name === 'UnauthorizedError')
            return 401;
        if (error.name === 'ForbiddenError')
            return 403;
        if (error.name === 'NotFoundError')
            return 404;
        if (error.name === 'ConflictError')
            return 409;
        if (error.name === 'RateLimitError')
            return 429;
        return 500;
    }
    getErrorMessage(error, statusCode) {
        if (process.env.NODE_ENV === 'production' && statusCode === 500) {
            return 'Internal server error';
        }
        return error.message || 'An error occurred';
    }
    sanitizeHeaders(headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        const sanitized = {};
        for (const [key, value] of Object.entries(headers)) {
            if (sensitiveHeaders.includes(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            }
            else {
                sanitized[key] = String(value);
            }
        }
        return sanitized;
    }
    sanitizeBody(body) {
        if (!body || typeof body !== 'object')
            return body;
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
        const sanitized = { ...body };
        for (const field of sensitiveFields) {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        }
        return sanitized;
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    cleanupOldErrors() {
        const oneHourAgo = Date.now() - 3600000;
        this.recentErrors = this.recentErrors.filter(error => error.timestamp.getTime() > oneHourAgo);
        log.debug('Error tracking cleanup completed', LogContext.SYSTEM, {
            remainingErrors: this.recentErrors.length,
            totalTracked: this.metrics.totalErrors,
        });
    }
    getMetrics() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        return {
            ...this.metrics,
            consecutiveErrors: this.consecutiveErrors,
            recentErrorCount: this.recentErrors.filter(error => error.timestamp.getTime() > oneMinuteAgo).length,
            uptime: now - this.lastSuccessTime,
        };
    }
    getRecentErrors(limit = 50) {
        return this.recentErrors.slice(0, limit);
    }
    getErrorTrends() {
        const now = Date.now();
        const hourly = [];
        for (let i = 0; i < 24; i++) {
            const hourStart = now - (i + 1) * 3600000;
            const hourEnd = now - i * 3600000;
            const errorsInHour = this.recentErrors.filter(error => error.timestamp.getTime() >= hourStart && error.timestamp.getTime() < hourEnd).length;
            hourly.unshift(errorsInHour);
        }
        const byPath = Object.entries(this.metrics.errorsByPath)
            .map(([path, count]) => ({ path, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const byType = Object.entries(this.metrics.errorsByType)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return { hourly, byPath, byType };
    }
    reset() {
        this.metrics = {
            totalErrors: 0,
            errorsByType: {},
            errorsByPath: {},
            errorsByStatusCode: {},
            averageResponseTime: 0,
            lastError: new Date(),
        };
        this.recentErrors = [];
        this.consecutiveErrors = 0;
        this.lastSuccessTime = Date.now();
        this.responseTimeBuffer = [];
    }
    updateAlertConfig(config) {
        this.alertConfig = { ...this.alertConfig, ...config };
        log.info('Alert configuration updated', LogContext.SYSTEM, this.alertConfig);
    }
}
export const errorTrackingService = new ErrorTrackingService({
    enabled: process.env.NODE_ENV === 'production',
    thresholds: {
        errorRate: parseInt(process.env.ERROR_RATE_THRESHOLD || '10'),
        responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000'),
        consecutiveErrors: parseInt(process.env.CONSECUTIVE_ERROR_THRESHOLD || '5'),
    },
});
export default ErrorTrackingService;
//# sourceMappingURL=error-tracking-middleware.js.map
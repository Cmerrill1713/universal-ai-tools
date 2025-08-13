import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { standardRateLimiter } from '../middleware/comprehensive-rate-limiter';
import { errorTrackingService } from '../middleware/error-tracking-middleware';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
const router = Router();
router.get('/health', (req, res) => {
    try {
        const metrics = errorTrackingService.getMetrics();
        const now = Date.now();
        const isHealthy = metrics.consecutiveErrors < 3 &&
            metrics.recentErrorCount < 5 &&
            metrics.averageResponseTime < 2000;
        const status = isHealthy ? 'healthy' : 'degraded';
        const statusCode = isHealthy ? 200 : 503;
        const healthData = {
            status,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            service: 'Universal AI Tools',
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            metrics: {
                consecutiveErrors: metrics.consecutiveErrors,
                recentErrorCount: metrics.recentErrorCount,
                averageResponseTime: Math.round(metrics.averageResponseTime),
                totalErrors: metrics.totalErrors,
            },
            checks: {
                errorRate: metrics.recentErrorCount < 5 ? 'pass' : 'fail',
                responseTime: metrics.averageResponseTime < 2000 ? 'pass' : 'fail',
                consecutiveErrors: metrics.consecutiveErrors < 3 ? 'pass' : 'fail',
            },
        };
        res.status(statusCode).json({
            success: isHealthy,
            data: healthData,
            metadata: {
                requestId: req.requestId,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        log.error('Health check failed', LogContext.API, { error });
        sendError(res, 'SERVICE_ERROR', 'Health check failed', 503);
    }
});
router.get('/metrics', authenticate, (req, res) => {
    try {
        const metrics = errorTrackingService.getMetrics();
        const rateLimiterStats = standardRateLimiter.getStats();
        const systemMetrics = {
            errors: metrics,
            rateLimiting: rateLimiterStats,
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
            },
            timestamp: new Date().toISOString(),
        };
        sendSuccess(res, systemMetrics);
    }
    catch (error) {
        log.error('Failed to get metrics', LogContext.API, { error });
        sendError(res, 'SERVICE_ERROR', 'Failed to retrieve metrics', 500);
    }
});
router.get('/errors', authenticate, requireAdmin, (req, res) => {
    try {
        const { limit = '50', since } = req.query;
        const limitNum = Math.min(parseInt(limit) || 50, 500);
        let recentErrors = errorTrackingService.getRecentErrors(limitNum);
        if (since) {
            const sinceDate = new Date(since);
            if (!isNaN(sinceDate.getTime())) {
                recentErrors = recentErrors.filter(error => error.timestamp >= sinceDate);
            }
        }
        const errorData = {
            errors: recentErrors,
            total: recentErrors.length,
            limit: limitNum,
            filters: { since },
        };
        sendSuccess(res, errorData);
    }
    catch (error) {
        log.error('Failed to get error logs', LogContext.API, { error });
        sendError(res, 'SERVICE_ERROR', 'Failed to retrieve error logs', 500);
    }
});
router.get('/trends', authenticate, requireAdmin, (req, res) => {
    try {
        const trends = errorTrackingService.getErrorTrends();
        const metrics = errorTrackingService.getMetrics();
        const analytics = {
            trends,
            summary: {
                totalErrors: metrics.totalErrors,
                errorRate: metrics.recentErrorCount,
                averageResponseTime: Math.round(metrics.averageResponseTime),
                lastError: metrics.lastError,
                consecutiveErrors: metrics.consecutiveErrors,
            },
            insights: generateInsights(trends, metrics),
        };
        sendSuccess(res, analytics);
    }
    catch (error) {
        log.error('Failed to get error trends', LogContext.API, { error });
        sendError(res, 'SERVICE_ERROR', 'Failed to retrieve error trends', 500);
    }
});
router.post('/alerts/config', authenticate, requireAdmin, (req, res) => {
    try {
        const { enabled, thresholds, webhooks, email } = req.body;
        if (thresholds) {
            if (thresholds.errorRate && (thresholds.errorRate < 1 || thresholds.errorRate > 100)) {
                return sendError(res, 'VALIDATION_ERROR', 'Error rate threshold must be between 1 and 100', 400);
            }
            if (thresholds.responseTime && (thresholds.responseTime < 100 || thresholds.responseTime > 60000)) {
                return sendError(res, 'VALIDATION_ERROR', 'Response time threshold must be between 100ms and 60s', 400);
            }
            if (thresholds.consecutiveErrors && (thresholds.consecutiveErrors < 1 || thresholds.consecutiveErrors > 50)) {
                return sendError(res, 'VALIDATION_ERROR', 'Consecutive errors threshold must be between 1 and 50', 400);
            }
        }
        const alertConfig = {
            enabled: enabled !== undefined ? enabled : undefined,
            thresholds: thresholds || undefined,
            webhooks: webhooks || undefined,
            email: email || undefined,
        };
        Object.keys(alertConfig).forEach(key => {
            if (alertConfig[key] === undefined) {
                delete alertConfig[key];
            }
        });
        errorTrackingService.updateAlertConfig(alertConfig);
        log.info('Alert configuration updated', LogContext.API, {
            userId: req.user?.id,
            config: alertConfig,
        });
        sendSuccess(res, {
            message: 'Alert configuration updated successfully',
            config: alertConfig,
        });
    }
    catch (error) {
        log.error('Failed to update alert config', LogContext.API, { error });
        sendError(res, 'SERVICE_ERROR', 'Failed to update alert configuration', 500);
    }
});
router.post('/reset', authenticate, requireAdmin, (req, res) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            return sendError(res, 'FORBIDDEN_ERROR', 'Reset not allowed in production', 403);
        }
        errorTrackingService.reset();
        standardRateLimiter.resetAll();
        log.info('Monitoring metrics reset', LogContext.API, {
            userId: req.user?.id,
        });
        sendSuccess(res, {
            message: 'Monitoring metrics reset successfully',
        });
    }
    catch (error) {
        log.error('Failed to reset monitoring metrics', LogContext.API, { error });
        sendError(res, 'SERVICE_ERROR', 'Failed to reset monitoring metrics', 500);
    }
});
router.get('/dashboard', authenticate, (req, res) => {
    try {
        const metrics = errorTrackingService.getMetrics();
        const trends = errorTrackingService.getErrorTrends();
        const rateLimiterStats = standardRateLimiter.getStats();
        const dashboardData = {
            overview: {
                status: metrics.consecutiveErrors < 3 ? 'healthy' : 'degraded',
                uptime: process.uptime(),
                totalErrors: metrics.totalErrors,
                recentErrorRate: metrics.recentErrorCount,
                averageResponseTime: Math.round(metrics.averageResponseTime),
            },
            charts: {
                errorTrends: trends.hourly,
                errorsByPath: trends.byPath.slice(0, 5),
                errorsByType: trends.byType.slice(0, 5),
            },
            rateLimiting: {
                activeClients: rateLimiterStats.activeClients,
                totalRules: rateLimiterStats.totalRules,
            },
            alerts: {
                consecutiveErrors: metrics.consecutiveErrors,
                errorRateStatus: metrics.recentErrorCount < 10 ? 'normal' : 'warning',
                responseTimeStatus: metrics.averageResponseTime < 2000 ? 'normal' : 'warning',
            },
            timestamp: new Date().toISOString(),
        };
        sendSuccess(res, dashboardData);
    }
    catch (error) {
        log.error('Failed to get dashboard data', LogContext.API, { error });
        sendError(res, 'SERVICE_ERROR', 'Failed to retrieve dashboard data', 500);
    }
});
function generateInsights(trends, metrics) {
    const insights = [];
    if (metrics.recentErrorCount > 5) {
        insights.push(`High error rate detected: ${metrics.recentErrorCount} errors in the last minute`);
    }
    if (metrics.averageResponseTime > 2000) {
        insights.push(`Slow response times: ${Math.round(metrics.averageResponseTime)}ms average`);
    }
    const recentHour = trends.hourly[trends.hourly.length - 1];
    const previousHour = trends.hourly[trends.hourly.length - 2];
    if (recentHour > previousHour * 1.5) {
        insights.push('Error rate is increasing compared to previous hour');
    }
    if (trends.byPath.length > 0) {
        const topErrorPath = trends.byPath[0];
        insights.push(`Most errors occurring on: ${topErrorPath.path} (${topErrorPath.count} errors)`);
    }
    if (metrics.consecutiveErrors > 0) {
        insights.push(`${metrics.consecutiveErrors} consecutive errors detected`);
    }
    if (insights.length === 0) {
        insights.push('System is operating normally with no significant issues detected');
    }
    return insights;
}
export default router;
//# sourceMappingURL=error-monitoring.js.map
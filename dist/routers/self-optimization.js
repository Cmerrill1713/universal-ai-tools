import { Router } from 'express';
import { selfOptimizationLoop } from '../services/self-optimization-loop';
import { log, LogContext } from '../utils/logger';
const router = Router();
router.get('/status', async (req, res) => {
    try {
        const stats = selfOptimizationLoop.getStats();
        log.info('Self-optimization status requested', LogContext.API, {
            isRunning: stats.isRunning,
            healthScore: stats.healthScore,
        });
        res.json({
            success: true,
            data: {
                isRunning: stats.isRunning,
                healthScore: stats.healthScore,
                lastOptimization: stats.lastOptimization,
                metricsCount: stats.metricsHistory.length,
                actionsCount: stats.actionHistory.length,
            },
        });
    }
    catch (error) {
        log.error('Failed to get optimization status', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization status',
        });
    }
});
router.post('/start', async (req, res) => {
    try {
        const { mode, intervalMs } = req.body ?? {};
        selfOptimizationLoop.start({ mode, intervalMs });
        log.info('Self-optimization loop started via API', LogContext.API);
        res.json({
            success: true,
            message: `Self-optimization loop started (${mode ?? 'event'})`,
        });
    }
    catch (error) {
        log.error('Failed to start optimization loop', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to start optimization loop',
        });
    }
});
router.post('/stop', async (req, res) => {
    try {
        selfOptimizationLoop.stop();
        log.info('Self-optimization loop stopped via API', LogContext.API);
        res.json({
            success: true,
            message: 'Self-optimization loop stopped',
        });
    }
    catch (error) {
        log.error('Failed to stop optimization loop', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to stop optimization loop',
        });
    }
});
router.get('/metrics', async (req, res) => {
    try {
        const stats = selfOptimizationLoop.getStats();
        const trends = selfOptimizationLoop.getHealthTrends();
        log.info('Optimization metrics requested', LogContext.API, {
            metricsCount: stats.metricsHistory.length,
            trendsAvailable: Object.keys(trends).length,
        });
        res.json({
            success: true,
            data: {
                currentMetrics: stats.metricsHistory[stats.metricsHistory.length - 1] || null,
                trends,
                history: stats.metricsHistory.slice(-20),
            },
        });
    }
    catch (error) {
        log.error('Failed to get optimization metrics', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization metrics',
        });
    }
});
router.get('/actions', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const actions = selfOptimizationLoop.getRecentActions(limit);
        log.info('Optimization actions requested', LogContext.API, {
            limit,
            actionsCount: actions.length,
        });
        res.json({
            success: true,
            data: {
                actions,
                total: actions.length,
                limit,
            },
        });
    }
    catch (error) {
        log.error('Failed to get optimization actions', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization actions',
        });
    }
});
router.post('/trigger', async (req, res) => {
    try {
        const { type } = req.body;
        log.info('Manual optimization trigger requested', LogContext.API, {
            type: type || 'full_cycle',
        });
        await selfOptimizationLoop.runOnce();
        res.json({
            success: true,
            message: 'Optimization cycle triggered',
            type: type || 'full_cycle',
        });
    }
    catch (error) {
        log.error('Failed to trigger optimization cycle', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to trigger optimization cycle',
        });
    }
});
router.get('/health', async (req, res) => {
    try {
        const stats = selfOptimizationLoop.getStats();
        const trends = selfOptimizationLoop.getHealthTrends();
        const currentMetrics = stats.metricsHistory[stats.metricsHistory.length - 1];
        const healthIndicators = {
            cpu: currentMetrics ? (currentMetrics.cpuUsage < 80 ? 'good' : 'warning') : 'unknown',
            memory: currentMetrics ? (currentMetrics.memoryUsage < 85 ? 'good' : 'warning') : 'unknown',
            responseTime: currentMetrics
                ? currentMetrics.responseTime < 100
                    ? 'good'
                    : 'warning'
                : 'unknown',
            errorRate: currentMetrics
                ? currentMetrics.errorRate < 0.02
                    ? 'good'
                    : 'warning'
                : 'unknown',
            agentHealth: currentMetrics
                ? currentMetrics.agentHealth > 50
                    ? 'good'
                    : 'warning'
                : 'unknown',
            meshConnectivity: currentMetrics
                ? currentMetrics.meshConnectivity > 70
                    ? 'good'
                    : 'warning'
                : 'unknown',
        };
        const overallHealth = Object.values(healthIndicators).every((h) => h === 'good')
            ? 'healthy'
            : 'needs_attention';
        log.info('Health analysis requested', LogContext.API, {
            overallHealth,
            indicators: healthIndicators,
        });
        res.json({
            success: true,
            data: {
                overallHealth,
                indicators: healthIndicators,
                currentMetrics,
                trends,
                optimizationStatus: {
                    isRunning: stats.isRunning,
                    healthScore: stats.healthScore,
                    lastOptimization: stats.lastOptimization,
                },
            },
        });
    }
    catch (error) {
        log.error('Failed to get health analysis', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get health analysis',
        });
    }
});
router.get('/config', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                interval: 30000,
                threshold: 0.1,
                maxHistorySize: 100,
                maxActionHistory: 50,
                mode: 'event',
                healthWeights: {
                    cpuUsage: 0.2,
                    memoryUsage: 0.2,
                    responseTime: 0.2,
                    errorRate: 0.2,
                    agentHealth: 0.1,
                    meshConnectivity: 0.1,
                },
            },
        });
    }
    catch (error) {
        log.error('Failed to get optimization config', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization config',
        });
    }
});
export default router;
//# sourceMappingURL=self-optimization.js.map
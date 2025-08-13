import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { abMCTSOrchestrator } from '../services/ab-mcts-service';
import { feedbackCollector } from '../services/feedback-collector';
import { sendError, sendSuccess } from '../utils/api-response';
import { bayesianModelRegistry } from '../utils/bayesian-model';
import { log, LogContext } from '../utils/logger';
import { adaptiveExplorer, defaultThompsonSelector } from '../utils/thompson-sampling';
const router = Router();
const orchestrateSchema = z.object({
    userRequest: z.string().min(1),
    context: z.record(z.any()).optional(),
    options: z
        .object({
        useCache: z.boolean().optional(),
        enableParallelism: z.boolean().optional(),
        collectFeedback: z.boolean().optional(),
        saveCheckpoints: z.boolean().optional(),
        visualize: z.boolean().optional(),
        verboseLogging: z.boolean().optional(),
        fallbackStrategy: z.enum(['greedy', 'random', 'fixed']).optional(),
    })
        .optional(),
});
const feedbackSchema = z.object({
    orchestrationId: z.string(),
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
});
const batchOrchestrationSchema = z.object({
    requests: z.array(z.object({
        userRequest: z.string().min(1),
        context: z.record(z.any()).optional(),
    })),
    options: orchestrateSchema.shape.options,
});
router.post('/orchestrate', async (req, res, next) => {
    try {
        const validation = orchestrateSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 'VALIDATION_ERROR', 'Invalid request', 400, validation.error.errors);
        }
        const { userRequest, context = {}, options = {} } = validation.data;
        const requestId = uuidv4();
        log.info('🎯 AB-MCTS orchestration request', LogContext.API, {
            requestId,
            userRequest: userRequest.substring(0, 100),
            options,
        });
        const agentContext = {
            userRequest,
            requestId,
            userId: req.user?.id || 'anonymous',
            metadata: {
                ...context,
                source: 'ab-mcts-api',
                timestamp: Date.now(),
            },
        };
        const result = await abMCTSOrchestrator.orchestrate(agentContext, options);
        sendSuccess(res, {
            orchestrationId: requestId,
            response: result.response,
            searchMetrics: result.searchResult.searchMetrics,
            bestAction: result.searchResult.bestAction,
            confidence: result.searchResult.confidence,
            executionPath: result.executionPath,
            totalTime: result.totalTime,
            resourcesUsed: result.resourcesUsed,
            recommendations: result.searchResult.recommendations,
            visualization: options.visualize
                ? await abMCTSOrchestrator.getVisualization(requestId)
                : undefined,
        });
    }
    catch (error) {
        log.error('❌ AB-MCTS orchestration failed', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.post('/orchestrate/batch', async (req, res, next) => {
    try {
        const validation = batchOrchestrationSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 'VALIDATION_ERROR', 'Invalid request', 400, validation.error.errors);
        }
        const { requests, options = {} } = validation.data;
        const batchId = uuidv4();
        log.info('🚀 AB-MCTS batch orchestration request', LogContext.API, {
            batchId,
            requestCount: requests.length,
        });
        const contexts = requests.map((req, index) => ({
            userRequest: req.userRequest,
            requestId: `${batchId}-${index}`,
            userId: req.user?.id || 'anonymous',
            metadata: {
                ...req.context,
                batchId,
                batchIndex: index,
                source: 'ab-mcts-api-batch',
            },
        }));
        const results = await abMCTSOrchestrator.orchestrateParallel(contexts, options);
        sendSuccess(res, {
            batchId,
            results: results.map((result, index) => ({
                index,
                success: result.response.success,
                response: result.response,
                confidence: result.searchResult.confidence,
                executionTime: result.totalTime,
            })),
            summary: {
                total: results.length,
                successful: results.filter((r) => r.response.success).length,
                failed: results.filter((r) => !r.response.success).length,
                averageConfidence: results.reduce((sum, r) => sum + r.searchResult.confidence, 0) / results.length,
                totalTime: results.reduce((sum, r) => sum + r.totalTime, 0),
            },
        });
    }
    catch (error) {
        log.error('❌ AB-MCTS batch orchestration failed', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.post('/feedback', async (req, res, next) => {
    try {
        const validation = feedbackSchema.safeParse(req.body);
        if (!validation.success) {
            return sendError(res, 'VALIDATION_ERROR', 'Invalid feedback', 400, validation.error.errors);
        }
        const { orchestrationId, rating, comment } = validation.data;
        log.info('👍 User feedback received', LogContext.API, {
            orchestrationId,
            rating,
            comment,
        });
        await abMCTSOrchestrator.processUserFeedback(orchestrationId, rating, comment);
        sendSuccess(res, {
            message: 'Feedback processed successfully',
            orchestrationId,
            rating,
        });
    }
    catch (error) {
        log.error('❌ Failed to process feedback', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/metrics', async (req, res, next) => {
    try {
        const orchestratorStats = abMCTSOrchestrator.getStatistics();
        const feedbackMetrics = await feedbackCollector.getMetrics();
        const thompsonStats = defaultThompsonSelector.getRankedArms();
        const explorerWeights = adaptiveExplorer.getWeights();
        sendSuccess(res, {
            orchestrator: orchestratorStats,
            feedback: {
                queueSize: feedbackMetrics.queueSize,
                totalProcessed: feedbackMetrics.totalProcessed,
                aggregationCount: feedbackMetrics.aggregations.length,
            },
            thompsonSampling: {
                rankedArms: thompsonStats,
                totalArms: thompsonStats.length,
            },
            adaptiveExploration: explorerWeights,
            recommendations: await abMCTSOrchestrator.getRecommendations(),
        });
    }
    catch (error) {
        log.error('❌ Failed to get metrics', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/models', async (req, res, next) => {
    try {
        const taskType = req.query.taskType || 'general';
        const rankings = bayesianModelRegistry.getRankings(taskType);
        const detailedStats = rankings.slice(0, 5).map((ranking) => {
            const model = bayesianModelRegistry.getModel(ranking.agent, taskType);
            return {
                agent: ranking.agent,
                performance: ranking.performance,
                reliability: ranking.reliability,
                samples: ranking.samples,
                statistics: model.getStatistics(),
            };
        });
        sendSuccess(res, {
            taskType,
            rankings,
            topModels: detailedStats,
        });
    }
    catch (error) {
        log.error('❌ Failed to get model rankings', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/visualization/:orchestrationId', async (req, res, next) => {
    try {
        const { orchestrationId } = req.params;
        const visualization = await abMCTSOrchestrator.getVisualization(orchestrationId);
        if (!visualization) {
            return sendError(res, 'NOT_FOUND', 'Orchestration not found', 404);
        }
        sendSuccess(res, visualization);
    }
    catch (error) {
        log.error('❌ Failed to get visualization', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/report', async (req, res, next) => {
    try {
        const report = feedbackCollector.generateReport();
        sendSuccess(res, report);
    }
    catch (error) {
        log.error('❌ Failed to generate report', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.post('/reset', async (req, res, next) => {
    try {
        if (!req.user?.isAdmin) {
            return sendError(res, 'UNAUTHORIZED', 'Admin access required', 403);
        }
        abMCTSOrchestrator.reset();
        sendSuccess(res, {
            message: 'AB-MCTS orchestrator reset successfully',
            timestamp: Date.now(),
        });
    }
    catch (error) {
        log.error('❌ Failed to reset orchestrator', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error);
    }
});
router.get('/health', async (req, res) => {
    try {
        const stats = abMCTSOrchestrator.getStatistics();
        const healthy = stats.circuitBreakerState !== 'OPEN' && stats.successRate > 0.5;
        sendSuccess(res, {
            status: healthy ? 'healthy' : 'degraded',
            circuitBreaker: stats.circuitBreakerState,
            successRate: stats.successRate,
            activeSearches: stats.activeSearches,
            timestamp: Date.now(),
        });
    }
    catch (error) {
        sendError(res, 'INTERNAL_ERROR', 'Health check failed', 500);
    }
});
export default router;
//# sourceMappingURL=ab-mcts-fixed.js.map
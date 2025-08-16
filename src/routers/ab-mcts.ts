/**
 * AB-MCTS API Router
 * Endpoints for AB-MCTS orchestration, monitoring, and feedback
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { abMCTSOrchestrator } from '../services/ab-mcts-service';
import { feedbackCollector } from '../services/feedback-collector';
import type { AgentContext, SystemStats } from '../types';
import { sendError, sendSuccess } from '../utils/api-response';
import { bayesianModelRegistry } from '../utils/bayesian-model';
import { log,LogContext } from '../utils/logger';
import { adaptiveExplorer, defaultThompsonSelector } from '../utils/thompson-sampling';

const router = Router();

// Request validation schemas
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
  requests: z.array(
    z.object({
      userRequest: z.string().min(1),
      context: z.record(z.any()).optional(),
    })
  ),
  options: orchestrateSchema.shape.options,
});

/**
 * @route POST /api/v1/ab-mcts/orchestrate
 * @desc Orchestrate a request using AB-MCTS
 */
router.post('/orchestrate', async (req: Request, res: Response, next: NextFunction) => {
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

    // Create agent context
    const agentContext: AgentContext = {
      userRequest,
      requestId,
      userId: (req as any).user?.id || 'anonymous',
      metadata: {
        ...context,
        source: 'ab-mcts-api',
        timestamp: Date.now(),
      },
    };

    // Execute orchestration
    const result = await abMCTSOrchestrator.orchestrate(agentContext, options);

    // Return response
    sendSuccess(
      res,
      {
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
      },
      200,
      { message: 'Orchestration completed successfully' }
    );
  } catch (error) {
    log.error('❌ AB-MCTS orchestration failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route POST /api/v1/ab-mcts/orchestrate/batch
 * @desc Orchestrate multiple requests in parallel
 */
router.post('/orchestrate/batch', async (req: Request, res: Response, next: NextFunction) => {
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

    // Create agent contexts
    const contexts: AgentContext[] = requests.map((req, index) => ({
      userRequest: req.userRequest,
      requestId: `${batchId}-${index}`,
      userId: (req as any).user?.id || 'anonymous',
      metadata: {
        ...req.context,
        batchId,
        batchIndex: index,
        source: 'ab-mcts-api-batch',
      },
    }));

    // Execute batch orchestration
    const results = await abMCTSOrchestrator.orchestrateParallel(contexts, options);

    // Return aggregated response
    sendSuccess(
      res,
      {
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
          averageConfidence:
            results.reduce((sum, r) => sum + r.searchResult.confidence, 0) / results.length,
          totalTime: results.reduce((sum, r) => sum + r.totalTime, 0),
        },
      },
      200,
      { message: 'Batch orchestration completed' }
    );
  } catch (error) {
    log.error('❌ AB-MCTS batch orchestration failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route POST /api/v1/ab-mcts/feedback
 * @desc Submit user feedback for an orchestration
 */
router.post('/feedback', async (req: Request, res: Response, next: NextFunction) => {
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

    // Process user feedback
    await abMCTSOrchestrator.processUserFeedback(orchestrationId, rating, comment);

    sendSuccess(res, {
      message: 'Feedback processed successfully',
      orchestrationId,
      rating,
    });
  } catch (error) {
    log.error('❌ Failed to process feedback', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/ab-mcts/metrics
 * @desc Get AB-MCTS performance metrics
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get orchestrator statistics
    const orchestratorStats = abMCTSOrchestrator.getStatistics();

    // Get feedback metrics
    const feedbackMetrics = await feedbackCollector.getMetrics();

    // Get Thompson sampling statistics
    const thompsonStats = defaultThompsonSelector.getRankedArms();

    // Get adaptive explorer weights
    const explorerWeights = adaptiveExplorer.getWeights();

    sendSuccess(
      res,
      {
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
      },
      200,
      { message: 'Metrics retrieved successfully' }
    );
  } catch (error) {
    log.error('❌ Failed to get metrics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/ab-mcts/models
 * @desc Get Bayesian model performance rankings
 */
router.get('/models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taskType = (req.query.taskType as string) || 'general';

    // Get model rankings
    const rankings = bayesianModelRegistry.getRankings(taskType);

    // Get detailed statistics for top models
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

    sendSuccess(
      res,
      {
        taskType,
        rankings,
        topModels: detailedStats,
      },
      200,
      { message: 'Model rankings retrieved' }
    );
  } catch (error) {
    log.error('❌ Failed to get model rankings', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/ab-mcts/visualization/:orchestrationId
 * @desc Get tree visualization for a specific orchestration
 */
router.get(
  '/visualization/:orchestrationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orchestrationId } = req.params;

      const visualization = await abMCTSOrchestrator.getVisualization(orchestrationId!);

      if (!visualization) {
        return sendError(res, 'NOT_FOUND', 'Orchestration not found', 404);
      }

      sendSuccess(res, visualization);
    } catch (error) {
      log.error('❌ Failed to get visualization', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/ab-mcts/report
 * @desc Get comprehensive feedback report
 */
router.get('/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = feedbackCollector.generateReport();

    sendSuccess(res, report);
  } catch (error) {
    log.error('❌ Failed to generate report', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route POST /api/v1/ab-mcts/reset
 * @desc Reset AB-MCTS orchestrator (admin only)
 */
router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check admin permissions (simplified for demo)
    if (!(req as any).user?.isAdmin) {
      return sendError(res, 'UNAUTHORIZED', 'Admin access required', 403);
    }

    abMCTSOrchestrator.reset();

    sendSuccess(res, {
      message: 'AB-MCTS orchestrator reset successfully',
      timestamp: Date.now(),
    });
  } catch (error) {
    log.error('❌ Failed to reset orchestrator', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

/**
 * @route GET /api/v1/ab-mcts/health
 * @desc Check AB-MCTS system health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = abMCTSOrchestrator.getStatistics() as SystemStats;
    const healthy = stats.circuitBreakerState !== 'OPEN' && stats.successRate > 0.5;

    sendSuccess(res, {
      status: healthy ? 'healthy' : 'degraded',
      circuitBreaker: stats.circuitBreakerState,
      successRate: stats.successRate,
      activeSearches: stats.activeSearches,
      timestamp: Date.now(),
    });
  } catch (error) {
    sendError(res, 'INTERNAL_ERROR', 'Health check failed', 500);
  }
});

export default router;

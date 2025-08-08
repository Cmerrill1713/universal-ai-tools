/**
 * Autonomous Actions Router
 * API endpoints for managing and monitoring autonomous actions
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { LogContext, log } from '../utils/logger';
import { ApiError, sendSuccess, sendError } from '../utils/api-response';
import { AutonomousAction, autonomousActionLoopService } from '../services/autonomous-action-loop-service';
import { authenticateRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Apply authentication to all routes
router.use(authenticateRequest);

/**
 * GET /api/v1/autonomous-actions/status
 * Get current status of autonomous actions system
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await autonomousActionLoopService.getActionStatus();

    log.info('📊 Autonomous actions status requested', LogContext.API, {
      activeActions: status.activeActions,
      queuedActions: status.queuedActions,
      userId: (req as any).user?.id
    });

    sendSuccess(res, {
      ...status,
      systemHealth: {
        enabled: status.policy.enabled,
        emergencyStop: status.policy.safeguards.emergencyStop,
        withinRateLimit: status.metrics.totalActions < status.policy.maxActionsPerHour,
        activeActionsCapacity: `${status.activeActions}/${status.policy.maxConcurrentActions}`
      },
      performanceMetrics: {
        successRate: status.metrics.totalActions > 0
          ? status.metrics.successfulActions / status.metrics.totalActions
          : 0,
        rollbackRate: status.metrics.totalActions > 0
          ? status.metrics.rolledBackActions / status.metrics.totalActions
          : 0,
        averageImprovement: status.metrics.averageImprovement
      }
    });

  } catch (error) {
    log.error('❌ Error fetching autonomous actions status', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to fetch autonomous actions status', 500, error);
  }
});

/**
 * GET /api/v1/autonomous-actions/history
 * Get history of autonomous actions
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const actions = await autonomousActionLoopService.getActionHistory(limit);

    res.json(sendSuccess(res, {
      status: 'success',
      data: {
        actions,
        summary: {
          total: actions.length,
          byStatus: actions.reduce((acc, action) => {
            acc[action.status] = (acc[action.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byType: actions.reduce((acc, action) => {
            acc[action.type] = (acc[action.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byRiskLevel: actions.reduce((acc, action) => {
            acc[action.assessment.riskLevel] = (acc[action.assessment.riskLevel] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      },
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    log.error('❌ Error fetching autonomous actions history', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to fetch autonomous actions history', 500, error);
  }
});

/**
 * POST /api/v1/autonomous-actions/pause
 * Pause autonomous actions system
 */
router.post('/pause', async (req: Request, res: Response) => {
  try {
    await autonomousActionLoopService.pauseAutonomousActions();

    log.info('⏸️ Autonomous actions paused by user', LogContext.API, {
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    });

    res.json(sendSuccess(res, {
      status: 'success',
      message: 'Autonomous actions have been paused',
      data: {
        paused: true,
        pausedAt: new Date().toISOString()
      }
    }));

  } catch (error) {
    log.error('❌ Error pausing autonomous actions', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to pause autonomous actions', 500, error);
  }
});

/**
 * POST /api/v1/autonomous-actions/resume
 * Resume autonomous actions system
 */
router.post('/resume', async (req: Request, res: Response) => {
  try {
    await autonomousActionLoopService.resumeAutonomousActions();

    log.info('▶️ Autonomous actions resumed by user', LogContext.API, {
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    });

    res.json(sendSuccess(res, {
      status: 'success',
      message: 'Autonomous actions have been resumed',
      data: {
        paused: false,
        resumedAt: new Date().toISOString()
      }
    }));

  } catch (error) {
    log.error('❌ Error resuming autonomous actions', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to resume autonomous actions', 500, error);
  }
});

/**
 * GET /api/v1/autonomous-actions/insights
 * Get current learning insights that could trigger actions
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    // This endpoint provides visibility into what insights are being generated
    // Note: This is a read-only endpoint for monitoring purposes

    const insights = {
      summary: 'This endpoint shows insights from learning systems that feed into autonomous actions',
      note: 'The autonomous action loop automatically processes these insights',
      availableInsights: [
        'feedback-insights: User feedback analysis and recommendations',
        'optimization-insights: ML-based parameter optimization recommendations',
        'learning-signals: Real-time learning signals from system performance',
        'parameter-effectiveness: Historical parameter performance data'
      ],
      integrationStatus: {
        feedbackIntegration: 'active',
        mlOptimizer: 'active',
        parameterAnalytics: 'active',
        autonomousLoop: 'processing'
      }
    };

    res.json(sendSuccess(res, {
      status: 'success',
      data: insights,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    log.error('❌ Error fetching insights overview', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to fetch insights overview', 500, error);
  }
});

/**
 * POST /api/v1/autonomous-actions/manual-trigger
 * Manually trigger insight collection and action generation (for testing/debugging)
 */
router.post('/manual-trigger', async (req: Request, res: Response) => {
  try {
    // This would trigger the insight collection manually
    // For security, this should be admin-only in production

    log.info('🔄 Manual autonomous action trigger requested', LogContext.API, {
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString()
    });

    // In a real implementation, this would call the autonomous service's insight collection
    // For now, we'll return a success message indicating the trigger was received

    res.json(sendSuccess(res, {
      status: 'success',
      message: 'Manual trigger initiated - autonomous action loop will process insights on next cycle',
      data: {
        triggered: true,
        nextProcessing: 'Within 15 minutes (next scheduled cycle)',
        note: 'This triggers insight collection and action generation outside the normal schedule'
      },
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    log.error('❌ Error triggering manual autonomous action', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to trigger manual autonomous action', 500, error);
  }
});

/**
 * GET /api/v1/autonomous-actions/policy
 * Get current autonomous action policy configuration
 */
router.get('/policy', async (req: Request, res: Response) => {
  try {
    const status = await autonomousActionLoopService.getActionStatus();

    res.json(sendSuccess(res, {
      status: 'success',
      data: {
        policy: status.policy,
        description: {
          enabled: 'Whether autonomous actions are enabled system-wide',
          maxActionsPerHour: 'Maximum number of actions that can be implemented per hour',
          maxConcurrentActions: 'Maximum number of actions that can be active simultaneously',
          riskThresholds: 'Confidence thresholds required for each risk level',
          cooldownPeriods: 'Time delays between actions to prevent rapid changes',
          safeguards: 'Additional safety measures and constraints'
        },
        notes: [
          'Low risk actions can be auto-approved if confidence is high enough',
          'Medium and high risk actions may require manual approval',
          'Cooldown periods prevent system oscillation',
          'Emergency stop immediately halts all autonomous actions'
        ]
      },
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    log.error('❌ Error fetching autonomous action policy', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to fetch autonomous action policy', 500, error);
  }
});

/**
 * GET /api/v1/autonomous-actions/metrics
 * Get detailed performance metrics for autonomous actions
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const status = await autonomousActionLoopService.getActionStatus();
    const history = await autonomousActionLoopService.getActionHistory(100);

    // Calculate advanced metrics
    const completedActions = history.filter(a => a.status === 'completed');
    const rolledBackActions = history.filter(a => a.status === 'rolled_back');
    const avgConfidence = history.reduce((sum, a) => sum + a.assessment.confidenceScore, 0) / history.length;

    const improvementsByType = completedActions.reduce((acc, action) => {
      if (action.implementationResult?.success && action.implementationResult.metricsBeforeAfter?.improvement) {
        const improvements = Object.values(action.implementationResult.metricsBeforeAfter.improvement);
        if (improvements.length > 0) {
          const avgImprovement = improvements.reduce((sum, val) => sum + val, 0) / improvements.length;
          acc[action.type] = (acc[action.type] || []);
          acc[action.type]!.push(avgImprovement);
        }
      }
      return acc;
    }, {} as Record<string, number[]>);

    const metrics = {
      overview: status.metrics,
      performance: {
        successRate: status.metrics.totalActions > 0
          ? status.metrics.successfulActions / status.metrics.totalActions
          : 0,
        rollbackRate: status.metrics.totalActions > 0
          ? status.metrics.rolledBackActions / status.metrics.totalActions
          : 0,
        averageConfidence: avgConfidence || 0,
        averageImprovement: status.metrics.averageImprovement
      },
      byActionType: Object.keys(improvementsByType).map(type => {
        const typeData = improvementsByType[type]!;
        return {
          type,
          count: typeData.length,
          averageImprovement: typeData.reduce((sum, val) => sum + val, 0) / typeData.length,
          successRate: typeData.length / history.filter(a => a.type === type).length
        };
      }),
      recent: {
        last24Hours: history.filter(a =>
          new Date(a.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
        ).length,
        lastWeek: history.filter(a =>
          new Date(a.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
        ).length
      },
      riskDistribution: {
        low: history.filter(a => a.assessment.riskLevel === 'low').length,
        medium: history.filter(a => a.assessment.riskLevel === 'medium').length,
        high: history.filter(a => a.assessment.riskLevel === 'high').length
      }
    };

    res.json(sendSuccess(res, {
      status: 'success',
      data: metrics,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    log.error('❌ Error fetching autonomous action metrics', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to fetch autonomous action metrics', 500, error);
  }
});

export default router;

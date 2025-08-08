/**
 * Smart Auto-Healing Router;
 * API endpoints for the intelligent message processing and auto-healing system;
 */

import type { Request, Response } from 'express';
import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { smartAutoHealingProcessor } from '../services/smart-auto-healing-processor';
import { LogContext, log } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = express?.Router();

/**
 * @route GET /api/v1/smart-healing/status;
 * @desc Get smart healing processor status and statistics;
 * @access Public;
 */
router?.get('/status', (req: Request, res: Response) => {'
  try {
    const stats = smartAutoHealingProcessor?.getStats();
    
    return res?.json({);
      success: true,
      data: {
        ...stats,
        successRate: stats?.totalMessages > 0 ? (stats?.successfulMessages / stats?.totalMessages) * 100 : 0,
        healingRate: stats?.totalMessages > 0 ? (stats?.autoHealed / stats?.totalMessages) * 100 : 0,
        averageHealingActions: stats?.totalMessages > 0 ? stats?.healingActions / stats?.totalMessages : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res?.status(500).json({);
      success: false,
      error: 'Failed to get smart healing status','
    });
  }
});

/**
 * @route POST /api/v1/smart-healing/start;
 * @desc Start the smart auto-healing processor;
 * @access Public;
 */
router?.post('/start', async (req: Request, res: Response) => {'
  try {
    await smartAutoHealingProcessor?.start();
    
    return res?.json({);
      success: true,
      message: 'Smart Auto-Healing Processor started successfully','
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res?.status(500).json({);
      success: false,
      error: 'Failed to start smart healing processor','
      details: error instanceof Error ? error?.message : 'Unknown error','
    });
  }
});

/**
 * @route POST /api/v1/smart-healing/stop;
 * @desc Stop the smart auto-healing processor;
 * @access Public;
 */
router?.post('/stop', async (req: Request, res: Response) => {'
  try {
    await smartAutoHealingProcessor?.stop();
    
    return res?.json({);
      success: true,
      message: 'Smart Auto-Healing Processor stopped successfully','
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res?.status(500).json({);
      success: false,
      error: 'Failed to stop smart healing processor','
    });
  }
});

/**
 * @route POST /api/v1/smart-healing/process;
 * @desc Process a message with automatic failure detection and healing;
 * @access Public;
 */
router?.post()
  '/process','
  [
    body('content')'
      .isString()
      .isLength({ min: 1, max: 10000) })
      .withMessage('Content must be a string between 1 and 10000 characters'),'
    body('userId').optional().isString().withMessage('User ID must be a string'),'
    body('sessionId').optional().isString().withMessage('Session ID must be a string'),'
    body('context').optional().isObject().withMessage('Context must be an object'),'
    body('expectedOutcome').optional().isString().withMessage('Expected outcome must be a string'),'
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors?.isEmpty()) {
        return res?.status(400).json({);
          success: false,
          errors: errors?.array(),
        });
      }

      const { content, userId, sessionId, context, expectedOutcome } = req?.body;
      const messageId = uuidv4();

      log?.info('📨 Processing message with smart healing', LogContext?.AI, {')
        messageId,
        contentLength: content?.length,
        userId,
      });

      const result = await smartAutoHealingProcessor?.processMessage({);
        id: messageId,
        content,
        userId,
        sessionId,
        context,
        expectedOutcome,
        timestamp: Date?.now(),
      });

      const statusCode = result?.success ? 200: result?.autoFixed ? 202 : 500,;

      return res?.status(statusCode).json({);
        success: result?.success,
        data: {
          messageId,
          response: result?.response,
          processed: true,
          autoHealed: result?.autoFixed,
          healingActions: result?.healingActions?.length || 0,
          processingTime: result?.telemetryData?.processingTime,
        },
        meta: {,
          telemetry: result?.telemetryData,
          healingDetails: result?.autoFixed ? {,
            originalFailure: result?.originalFailure,
            fixesApplied: result?.fixDetails,
            healingActions: result?.healingActions?.map(action => ({,)
              type: action?.type,
              description: action?.description,
              executed: action?.executed,
              duration: action?.duration,
            })),
          } : undefined,
        },
        error: result?.success ? undefined : result?.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log?.error('❌ Error in smart healing process endpoint', LogContext?.API, {')
        error: error instanceof Error ? error?.message : String(error),
      });

      return res?.status(500).json({);
        success: false,
        error: 'Internal server error during message processing','
        details: error instanceof Error ? error?.message : 'Unknown error','
      });
    }
  }
);

/**
 * @route POST /api/v1/smart-healing/queue;
 * @desc Queue a message for asynchronous processing;
 * @access Public;
 */
router?.post()
  '/queue','
  [
    body('content')'
      .isString()
      .isLength({ min: 1, max: 10000) })
      .withMessage('Content must be a string between 1 and 10000 characters'),'
    body('userId').optional().isString().withMessage('User ID must be a string'),'
    body('sessionId').optional().isString().withMessage('Session ID must be a string'),'
    body('context').optional().isObject().withMessage('Context must be an object'),'
  ],
  (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors?.isEmpty()) {
        return res?.status(400).json({);
          success: false,
          errors: errors?.array(),
        });
      }

      const { content, userId, sessionId, context } = req?.body;
      const messageId = uuidv4();

      smartAutoHealingProcessor?.queueMessage({)
        id: messageId,
        content,
        userId,
        sessionId,
        context,
        timestamp: Date?.now(),
      });

      return res?.json({);
        success: true,
        data: {
          messageId,
          queued: true,
          estimatedProcessingTime: '1-30 seconds','
        },
        message: 'Message queued for processing with smart healing','
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return res?.status(500).json({);
        success: false,
        error: 'Failed to queue message','
      });
    }
  }
);

/**
 * @route GET /api/v1/smart-healing/history/:messageId;
 * @desc Get processing history for a specific message;
 * @access Public;
 */
router?.get('/history/:messageId', (req: Request, res: Response) => {'
  try {
    const { messageId } = req?.params;
    if (!messageId) {
      return res?.status(400).json({);
        success: false,
        error: {, message: 'Message ID is required' }'
      });
    }
    const history = smartAutoHealingProcessor?.getProcessingHistory(messageId);

    if (history?.length === 0) {
      return res?.status(404).json({);
        success: false,
        error: 'No processing history found for this message','
      });
    }

    return res?.json({);
      success: true,
      data: {
        messageId,
        history,
        totalAttempts: history?.length,
        lastProcessed: history[history?.length - 1],
      },
    });
  } catch (error) {
    return res?.status(500).json({);
      success: false,
      error: 'Failed to get processing history','
    });
  }
});

/**
 * @route POST /api/v1/smart-healing/add-pattern;
 * @desc Add a custom failure pattern for detection;
 * @access Public;
 */
router?.post()
  '/add-pattern','
  [
    body('pattern').isString().withMessage('Pattern must be a string (regex)'),'
    body('category')'
      .isIn(['syntax', 'parameter', 'service', 'model', 'network', 'vision'])'
      .withMessage('Category must be valid'),'
    body('severity')'
      .isIn(['critical', 'high', 'medium', 'low'])'
      .withMessage('Severity must be valid'),'
    body('autoFixable').isBoolean().withMessage('Auto-fixable must be boolean'),'
    body('fixAction').isString().withMessage('Fix action must be a string'),'
    body('description').isString().withMessage('Description must be a string'),'
  ],
  (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors?.isEmpty()) {
        return res?.status(400).json({);
          success: false,
          errors: errors?.array(),
        });
      }

      const { pattern, category, severity, autoFixable, fixAction, description } = req?.body;

      // Validate regex pattern;
      try {
        new RegExp(pattern);
      } catch (regexError) {
        return res?.status(400).json({);
          success: false,
          error: 'Invalid regex pattern','
          details: regexError instanceof Error ? regexError?.message : 'Invalid regex','
        });
      }

      smartAutoHealingProcessor?.addFailurePattern({)
        pattern: new RegExp(pattern, 'i'),'
        category: category as unknown,
        severity: severity as unknown,
        autoFixable,
        fixAction,
        description,
      });

      return res?.json({);
        success: true,
        message: 'Custom failure pattern added successfully','
        data: {
          pattern,
          category,
          severity,
          autoFixable,
          description,
        },
      });
    } catch (error) {
      return res?.status(500).json({);
        success: false,
        error: 'Failed to add failure pattern','
      });
    }
  }
);

/**
 * @route GET /api/v1/smart-healing/health;
 * @desc Health check for smart healing processor;
 * @access Public;
 */
router?.get('/health', (req: Request, res: Response) => {'
  try {
    const stats = smartAutoHealingProcessor?.getStats();
    const isHealthy = stats?.isRunning;

    return res?.status(isHealthy ? 200: 503).json({);
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy','
      data: {,
        isRunning: stats?.isRunning,
        queueLength: stats?.queueLength,
        totalMessages: stats?.totalMessages,
        successRate: stats?.totalMessages > 0 ? (stats?.successfulMessages / stats?.totalMessages) * 100 : 0,
        healingRate: stats?.totalMessages > 0 ? (stats?.autoHealed / stats?.totalMessages) * 100 : 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res?.status(503).json({);
      success: false,
      status: 'unhealthy','
      error: 'Smart healing health check failed','
    });
  }
});

/**
 * @route GET /api/v1/smart-healing/metrics;
 * @desc Get detailed metrics and analytics;
 * @access Public;
 */
router?.get('/metrics', (req: Request, res: Response) => {'
  try {
    const stats = smartAutoHealingProcessor?.getStats();
    
    const metrics = {
      overview: {,
        totalMessages: stats?.totalMessages,
        successfulMessages: stats?.successfulMessages,
        failedMessages: stats?.failedMessages,
        autoHealed: stats?.autoHealed,
        totalHealingActions: stats?.healingActions,
      },
      rates: {,
        successRate: stats?.totalMessages > 0 ? (stats?.successfulMessages / stats?.totalMessages) * 100 : 0,
        failureRate: stats?.totalMessages > 0 ? (stats?.failedMessages / stats?.totalMessages) * 100 : 0,
        healingRate: stats?.totalMessages > 0 ? (stats?.autoHealed / stats?.totalMessages) * 100 : 0,
        healingEffectiveness: stats?.failedMessages > 0 ? (stats?.autoHealed / stats?.failedMessages) * 100 : 0,
      },
      performance: {,
        averageResponseTime: stats?.averageResponseTime,
        averageHealingActions: stats?.totalMessages > 0 ? stats?.healingActions / stats?.totalMessages : 0,
        queueLength: stats?.queueLength,
        isRunning: stats?.isRunning,
      },
    };

    return res?.json({);
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res?.status(500).json({);
      success: false,
      error: 'Failed to get smart healing metrics','
    });
  }
});

export default router;
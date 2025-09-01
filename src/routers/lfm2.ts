/**
 * LFM2 Router - Direct access to Liquid Foundation Model 2
 * Provides endpoints for fast routing, classification, and simple Q&A
 */

import { Router } from 'express';
import { LogContext, log } from '../utils/logger';
import { lfm2Bridge } from '../services/lfm2-bridge';

const router = Router();

/**
 * Quick response endpoint - For simple questions and fast answers
 */
router.post('/quick', async (req, res): Promise<any> => {
  try {
    const { prompt, taskType = 'simple_qa' } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'prompt is required',
      });
    }

    const startTime = Date.now();
    const response = await lfm2Bridge.quickResponse(prompt, taskType as 'classification' | 'simple_qa');
    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        response: response.content,
        metadata: {
          model: response.model,
          tokens: response.tokens,
          executionTime: `${executionTime}ms`,
          confidence: response.confidence,
          timestamp: new Date().toISOString(),
        },
      },
    });

    log.info('⚡ LFM2 quick response completed', LogContext.AI, {
      taskType,
      tokens: response.tokens,
      executionTime: `${executionTime}ms`,
    });
  } catch (error) {
    log.error('❌ LFM2 quick response failed', LogContext.AI, { error });
    res.status(500).json({
      success: false,
      error: 'LFM2 quick response failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Routing decision endpoint - Determines which model should handle a request
 */
router.post('/route', async (req, res): Promise<any> => {
  try {
    const { userRequest, context = {} } = req.body;

    if (!userRequest) {
      return res.status(400).json({
        success: false,
        error: 'userRequest is required',
      });
    }

    const startTime = Date.now();
    const decision = await lfm2Bridge.routingDecision(userRequest, context);
    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        routing: decision,
        metadata: {
          executionTime: `${executionTime}ms`,
          timestamp: new Date().toISOString(),
        },
      },
    });

    log.info('🚀 LFM2 routing decision completed', LogContext.AI, {
      targetService: decision.targetService,
      confidence: decision.confidence,
      executionTime: `${executionTime}ms`,
    });
  } catch (error) {
    log.error('❌ LFM2 routing decision failed', LogContext.AI, { error });
    res.status(500).json({
      success: false,
      error: 'LFM2 routing decision failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Health check endpoint - Check if LFM2 is available
 */
router.get('/health', async (req, res): Promise<any> => {
  try {
    const isAvailable = lfm2Bridge.isAvailable();
    const metrics = lfm2Bridge.getMetrics();

    res.json({
      success: true,
      data: {
        available: isAvailable,
        metrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('❌ LFM2 health check failed', LogContext.AI, { error });
    res.status(500).json({
      success: false,
      error: 'LFM2 health check failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Metrics endpoint - Get LFM2 performance metrics
 */
router.get('/metrics', async (req, res): Promise<any> => {
  try {
    const metrics = lfm2Bridge.getMetrics();
    const circuitBreakerMetrics = lfm2Bridge.getCircuitBreakerMetrics();

    res.json({
      success: true,
      data: {
        lfm2: metrics,
        circuitBreaker: circuitBreakerMetrics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    log.error('❌ Failed to get LFM2 metrics', LogContext.AI, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get LFM2 metrics',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
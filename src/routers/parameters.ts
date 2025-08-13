/**
 * Parameters Router
 * API endpoints for intelligent parameter management and optimization
 */

import { type Request, type Response, Router } from 'express';
import { z } from 'zod';

import { zodValidate } from '@/middleware/zod-validate';

import { authenticate } from '../middleware/auth';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

const router = Router();

// Validation schemas
const optimizeSchema = z.object({
  taskType: z.string().min(1).max(100),
  currentParams: z.record(z.any()).optional(),
  feedback: z.object({
    quality: z.number().min(0).max(1).optional(),
    speed: z.number().min(0).max(1).optional(),
    accuracy: z.number().min(0).max(1).optional(),
  }).optional(),
});

const presetSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  parameters: z.record(z.any()),
  taskTypes: z.array(z.string()).optional(),
});

/**
 * @route GET /api/v1/parameters
 * @description Parameters API information and capabilities
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const endpoints = {
      optimize: 'POST /api/v1/parameters/optimize - Get optimized parameters for a task',
      presets: 'GET /api/v1/parameters/presets - List parameter presets',
      savePreset: 'POST /api/v1/parameters/presets - Save parameter preset',
      analytics: 'GET /api/v1/parameters/analytics - Get parameter optimization analytics',
      feedback: 'POST /api/v1/parameters/feedback - Provide feedback on parameter performance',
      models: 'GET /api/v1/parameters/models - List available models and their parameters'
    };

    sendSuccess(res, {
      service: 'Universal AI Tools - Parameters API',
      version: '1.0.0',
      status: 'operational',
      endpoints,
      capabilities: [
        'Intelligent parameter optimization',
        'ML-based parameter selection',
        'Performance feedback integration',
        'Parameter preset management',
        'Cross-model parameter analytics',
        'Adaptive parameter tuning'
      ]
    });
  } catch (error) {
    sendError(res, 'SERVICE_ERROR', 'Failed to get parameters API info', 500);
  }
});

/**
 * @route POST /api/v1/parameters/optimize
 * @description Get optimized parameters for a specific task
 */
router.post(
  '/optimize',
  authenticate,
  zodValidate(optimizeSchema),
  async (req: Request, res: Response) => {
    try {
      const { taskType, currentParams, feedback } = req.body;

      log.info('🎯 Parameter optimization requested', LogContext.API, {
        userId: req.user?.id,
        taskType,
        hasFeedback: !!feedback,
      });

      // Get intelligent parameter service from global registry
      const {parameterService} = (global as any);
      
      if (!parameterService) {
        return sendError(res, 'SERVICE_UNAVAILABLE', 'Parameter optimization service not available', 503);
      }

      // Generate optimized parameters
      const optimizedParams = await parameterService.optimizeParameters({
        taskType,
        userParams: currentParams,
        feedback,
        userId: req.user?.id,
      });

      sendSuccess(res, {
        taskType,
        optimizedParameters: optimizedParams.parameters,
        confidence: optimizedParams.confidence,
        reasoning: optimizedParams.reasoning,
        improvements: optimizedParams.improvements,
        model: optimizedParams.model,
      });

    } catch (error) {
      log.error('Failed to optimize parameters', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      sendError(res, 'OPTIMIZATION_ERROR', 'Failed to optimize parameters', 500);
    }
  }
);

/**
 * @route GET /api/v1/parameters/presets
 * @description List available parameter presets
 */
router.get('/presets', authenticate, async (req: Request, res: Response) => {
  try {
    const { taskType } = req.query;

    // Common parameter presets
    const presets = [
      {
        name: 'creative',
        description: 'High creativity for content generation',
        parameters: {
          temperature: 0.8,
          top_p: 0.9,
          top_k: 40,
          frequency_penalty: 0.1,
          presence_penalty: 0.1,
        },
        taskTypes: ['creative_writing', 'brainstorming', 'content_generation'],
      },
      {
        name: 'analytical',
        description: 'Precise and focused for analysis tasks',
        parameters: {
          temperature: 0.2,
          top_p: 0.7,
          top_k: 20,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
        },
        taskTypes: ['analysis', 'reasoning', 'technical_writing'],
      },
      {
        name: 'balanced',
        description: 'Balanced approach for general tasks',
        parameters: {
          temperature: 0.5,
          top_p: 0.8,
          top_k: 30,
          frequency_penalty: 0.05,
          presence_penalty: 0.05,
        },
        taskTypes: ['conversation', 'general', 'assistance'],
      },
      {
        name: 'code',
        description: 'Optimized for code generation and technical tasks',
        parameters: {
          temperature: 0.1,
          top_p: 0.6,
          top_k: 15,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
        },
        taskTypes: ['code_generation', 'debugging', 'technical'],
      },
    ];

    // Filter by task type if provided
    const filteredPresets = taskType 
      ? presets.filter(preset => preset.taskTypes.includes(taskType as string))
      : presets;

    sendSuccess(res, {
      presets: filteredPresets,
      total: filteredPresets.length,
      availableTaskTypes: [...new Set(presets.flatMap(p => p.taskTypes))],
    });

  } catch (error) {
    log.error('Failed to get parameter presets', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(res, 'PRESETS_ERROR', 'Failed to get parameter presets', 500);
  }
});

/**
 * @route GET /api/v1/parameters/analytics
 * @description Get parameter optimization analytics
 */
router.get('/analytics', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    // Mock analytics data (would come from parameter analytics service)
    const analytics = {
      totalOptimizations: 156,
      improvementRate: 0.73,
      averagePerformanceGain: 0.24,
      topPerformingParams: {
        temperature: { optimal: 0.35, variance: 0.15 },
        top_p: { optimal: 0.82, variance: 0.08 },
        top_k: { optimal: 28, variance: 12 },
      },
      taskTypePerformance: {
        creative_writing: { avgScore: 0.87, optimizations: 45 },
        analysis: { avgScore: 0.91, optimizations: 38 },
        code_generation: { avgScore: 0.94, optimizations: 29 },
        conversation: { avgScore: 0.82, optimizations: 44 },
      },
      recentTrends: {
        last7Days: { optimizations: 23, avgImprovement: 0.19 },
        last30Days: { optimizations: 87, avgImprovement: 0.22 },
      },
    };

    sendSuccess(res, analytics);

  } catch (error) {
    log.error('Failed to get parameter analytics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(res, 'ANALYTICS_ERROR', 'Failed to get parameter analytics', 500);
  }
});

/**
 * @route GET /api/v1/parameters/models
 * @description List available models and their configurable parameters
 */
router.get('/models', authenticate, async (req: Request, res: Response) => {
  try {
    const models = [
      {
        name: 'gpt-oss:20b',
        provider: 'ollama',
        parameters: {
          temperature: { min: 0.0, max: 2.0, default: 0.7, description: 'Randomness in generation' },
          top_p: { min: 0.0, max: 1.0, default: 0.9, description: 'Nucleus sampling threshold' },
          top_k: { min: 1, max: 100, default: 40, description: 'Top-k sampling limit' },
          max_tokens: { min: 1, max: 4096, default: 1024, description: 'Maximum tokens to generate' },
          frequency_penalty: { min: -2.0, max: 2.0, default: 0.0, description: 'Frequency penalty' },
          presence_penalty: { min: -2.0, max: 2.0, default: 0.0, description: 'Presence penalty' },
        },
        capabilities: ['text_generation', 'conversation', 'analysis', 'reasoning'],
      },
      {
        name: 'tinyllama:latest',
        provider: 'ollama',
        parameters: {
          temperature: { min: 0.0, max: 2.0, default: 0.8, description: 'Randomness in generation' },
          top_p: { min: 0.0, max: 1.0, default: 0.85, description: 'Nucleus sampling threshold' },
          max_tokens: { min: 1, max: 2048, default: 512, description: 'Maximum tokens to generate' },
        },
        capabilities: ['text_generation', 'conversation', 'simple_tasks'],
      },
      {
        name: 'lfm2:1.2b',
        provider: 'lfm2',
        parameters: {
          temperature: { min: 0.0, max: 1.5, default: 0.6, description: 'Randomness in generation' },
          max_tokens: { min: 1, max: 512, default: 256, description: 'Maximum tokens to generate' },
        },
        capabilities: ['routing', 'classification', 'simple_generation'],
      },
    ];

    sendSuccess(res, {
      models,
      total: models.length,
      providers: [...new Set(models.map(m => m.provider))],
      availableCapabilities: [...new Set(models.flatMap(m => m.capabilities))],
    });

  } catch (error) {
    log.error('Failed to get model parameters', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    sendError(res, 'MODELS_ERROR', 'Failed to get model parameters', 500);
  }
});

export default router;
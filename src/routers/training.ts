/**
 * Training Router
 * 
 * Provides endpoints for adaptive training, model evolution, and performance optimization
 */

import { Router } from 'express';
import { z } from 'zod';

import { zodValidate } from '@/middleware/zod-validate';

import { authenticate } from '../middleware/auth.js';
import { adaptiveTrainingService } from '../services/adaptive-training-service.js';
import { evolutionaryModelMergeService } from '../services/evolutionary-model-merge-service.js';
import { speculativeDecodingService } from '../services/speculative-decoding-service.js';
import { log, LogContext } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/training/status
 * Get current training status and queue
 */
router.get('/status', authenticate, (req, res) => {
  try {
    const queue = adaptiveTrainingService.getTrainingQueue();
    const metrics = adaptiveTrainingService.getModelMetrics();
    
    res.json({
      success: true,
      data: {
        queue: {
          total: queue.length,
          queued: queue.filter(j => j.status === 'queued').length,
          training: queue.filter(j => j.status === 'training').length,
          completed: queue.filter(j => j.status === 'completed').length,
          failed: queue.filter(j => j.status === 'failed').length,
        },
        models: Array.from(metrics.entries()).map(([key, value]) => ({
          model: key,
          ...value,
        })),
      },
    });
  } catch (error) {
    log.error('Failed to get training status', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get training status',
    });
  }
});

/**
 * POST /api/v1/training/evaluate
 * Force evaluation of all models
 */
router.post('/evaluate', authenticate, async (req, res) => {
  try {
    await adaptiveTrainingService.forceEvaluation();
    
    res.json({
      success: true,
      message: 'Evaluation triggered successfully',
    });
  } catch (error) {
    log.error('Failed to trigger evaluation', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to trigger evaluation',
    });
  }
});

/**
 * POST /api/v1/training/train
 * Force training for a specific model
 */
router.post(
  '/train',
  authenticate,
  zodValidate(
    z.object({
      modelId: z.string(),
      reason: z.string().optional(),
    })
  ),
  async (req, res) => {
    try {
      const { modelId, reason } = req.body;
      
      await adaptiveTrainingService.forceTraining(modelId, reason);
      
      res.json({
        success: true,
        message: `Training scheduled for model ${modelId}`,
      });
    } catch (error) {
      log.error('Failed to schedule training', LogContext.API, { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule training',
      });
    }
  }
);

/**
 * PUT /api/v1/training/thresholds
 * Update training thresholds
 */
router.put(
  '/thresholds',
  authenticate,
  zodValidate(
    z.object({
      qualityScore: z.number().min(0).max(1).optional(),
      errorRate: z.number().min(0).max(1).optional(),
      responseTime: z.object({
        simple: z.number().optional(),
        moderate: z.number().optional(),
        complex: z.number().optional(),
      }).optional(),
      userFeedback: z.object({
        negative: z.number().min(0).max(1).optional(),
        regenerations: z.number().min(0).max(1).optional(),
      }).optional(),
    })
  ),
  (req, res) => {
    try {
      adaptiveTrainingService.updateThresholds(req.body);
      
      res.json({
        success: true,
        message: 'Thresholds updated successfully',
      });
    } catch (error) {
      log.error('Failed to update thresholds', LogContext.API, { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update thresholds',
      });
    }
  }
);

/**
 * POST /api/v1/training/evolve
 * Start evolutionary model merging
 */
router.post(
  '/evolve',
  authenticate,
  zodValidate(
    z.object({
      targetTask: z.string(),
      populationSize: z.number().min(10).max(50).optional(),
      generations: z.number().min(10).max(100).optional(),
      targetCapabilities: z.array(z.string()).optional(),
    })
  ),
  async (req, res) => {
    try {
      const { targetTask, populationSize = 30, generations = 50, ...config } = req.body;
      
      // Validate resource requirements
      const estimatedEvaluations = populationSize * generations;
      if (estimatedEvaluations > 2500) {
        return res.status(400).json({
          success: false,
          error: `Resource limit exceeded: ${estimatedEvaluations} evaluations (max 2500)`,
        });
      }
      
      // Start evolution in background
      evolutionaryModelMergeService.evolve(targetTask, { populationSize, generations, ...config })
        .then(result => {
          log.info('Evolution completed', LogContext.AI, {
            bestFitness: result.bestGenome.fitness,
            generations: result.generation,
          });
        })
        .catch(error => {
          log.error('Evolution failed', LogContext.AI, { error });
        });
      
      return res.json({
        success: true,
        message: 'Evolution started in background',
      });
    } catch (error) {
      log.error('Failed to start evolution', LogContext.API, { error });
      return res.status(500).json({
        success: false,
        error: 'Failed to start evolution',
      });
    }
  }
);

/**
 * GET /api/v1/training/evolution/history
 * Get evolution history
 */
router.get('/evolution/history', authenticate, (req, res) => {
  try {
    const history = evolutionaryModelMergeService.getHistory();
    
    res.json({
      success: true,
      data: {
        generations: history.size,
        history: Array.from(history.entries()).map(([gen, pop]) => ({
          generation: gen,
          bestFitness: pop[0]?.fitness || 0,
          avgFitness: pop.reduce((sum, g) => sum + g.fitness, 0) / pop.length,
          population: pop.length,
        })),
      },
    });
  } catch (error) {
    log.error('Failed to get evolution history', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get evolution history',
    });
  }
});

/**
 * POST /api/v1/training/speculative/test
 * Test speculative decoding
 */
router.post(
  '/speculative/test',
  authenticate,
  zodValidate(
    z.object({
      prompt: z.string(),
      targetModelId: z.string(),
      maxTokens: z.number().min(1).max(500).optional(),
    })
  ),
  async (req, res) => {
    try {
      const { prompt, targetModelId, maxTokens } = req.body;
      
      // Get target model
      const { modelDiscoveryService } = await import('../services/model-discovery-service.js');
      const targetModel = modelDiscoveryService.getModels().find(m => m.id === targetModelId);
      
      if (!targetModel) {
        return res.status(404).json({
          success: false,
          error: 'Target model not found',
        });
      }
      
      const result = await speculativeDecodingService.generateWithSpeculation(
        prompt,
        targetModel,
        { maxTokens }
      );
      
      return res.json({
        success: true,
        data: {
          content: result.content,
          speedup: result.speculation.speedup,
          acceptedTokens: result.speculation.acceptedCount,
          rejectedTokens: result.speculation.rejectedCount,
          draftModel: result.modelPair.draft.name,
          targetModel: result.modelPair.target.name,
        },
      });
    } catch (error) {
      log.error('Speculative decoding failed', LogContext.API, { error });
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Speculative decoding failed',
      });
    }
  }
);

/**
 * GET /api/v1/training/speculative/pairs
 * Get best model pairs for speculative decoding
 */
router.get('/speculative/pairs', authenticate, (req, res) => {
  try {
    const pairs = speculativeDecodingService.getBestPairs(10);
    
    res.json({
      success: true,
      data: {
        pairs: pairs.map(p => ({
          draft: p.draft.name,
          target: p.target.name,
          compatibility: p.compatibility,
          expectedSpeedup: p.expectedSpeedup,
          actualSpeedup: speculativeDecodingService.getAverageSpeedup(p.draft.id, p.target.id),
        })),
      },
    });
  } catch (error) {
    log.error('Failed to get speculative pairs', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get speculative pairs',
    });
  }
});

/**
 * GET /api/v1/training/speculative/stats
 * Get speculative decoding statistics
 */
router.get('/speculative/stats', authenticate, (req, res) => {
  try {
    const stats = speculativeDecodingService.getStatistics();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to get speculative stats', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
    });
  }
});

/**
 * GET /api/v1/training/mlx/models
 * Get all fine-tuned MLX models
 */
router.get('/mlx/models', authenticate, async (req, res) => {
  try {
    const { mlxProviderService } = await import('../services/mlx-provider-service.js');
    const models = mlxProviderService.getModels();
    
    res.json({
      success: true,
      data: {
        count: models.length,
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          baseModel: m.baseModel,
          fineTunedAt: m.fineTunedAt,
          method: m.method,
          task: m.config.task,
          performance: m.config.performance,
          status: m.status,
          size: `${(m.size / (1024 * 1024 * 1024)).toFixed(1)}GB`,
        })),
      },
    });
  } catch (error) {
    log.error('Failed to get MLX models', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get MLX models',
    });
  }
});

/**
 * GET /api/v1/training/mlx/stats
 * Get MLX provider statistics
 */
router.get('/mlx/stats', authenticate, async (req, res) => {
  try {
    const { mlxProviderService } = await import('../services/mlx-provider-service.js');
    const stats = mlxProviderService.getStatistics();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    log.error('Failed to get MLX stats', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get MLX statistics',
    });
  }
});

/**
 * POST /api/v1/training/mlx/test
 * Test generation with a fine-tuned MLX model
 */
router.post(
  '/mlx/test',
  authenticate,
  zodValidate(
    z.object({
      modelId: z.string(),
      prompt: z.string(),
      maxTokens: z.number().min(1).max(500).optional(),
      temperature: z.number().min(0).max(2).optional(),
    })
  ),
  async (req, res) => {
    try {
      const { modelId, prompt, maxTokens, temperature } = req.body;
      const { mlxProviderService } = await import('../services/mlx-provider-service.js');
      
      const startTime = Date.now();
      const response = await mlxProviderService.generate(
        modelId,
        prompt,
        { maxTokens, temperature }
      );
      const latency = Date.now() - startTime;
      
      res.json({
        success: true,
        data: {
          response,
          latency: `${latency}ms`,
          tokensGenerated: Math.ceil(response.length / 4),
          tokensPerSecond: Math.round((response.length / 4) / (latency / 1000)),
        },
      });
    } catch (error) {
      log.error('MLX generation failed', LogContext.API, { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Generation failed',
      });
    }
  }
);

export default router;
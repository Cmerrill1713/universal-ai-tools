/**
 * MLX Router
 * API endpoints for Apple Silicon optimized machine learning with MLX
 * Provides inference, fine-tuning, and model management capabilities
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { FineTuningRequest, InferenceRequest } from '../services/mlx-service';
import { mlxService } from '../services/mlx-service';
import { LogContext, log } from '../utils/logger';
import { sendError, sendSuccess } from '../utils/api-response';
import { createRateLimiter } from '../middleware/rate-limiter-enhanced';
import { authenticate } from '../middleware/auth';
import {
  codeParametersMiddleware,
  intelligentParametersMiddleware,
  optimizeParameters,
  parameterEffectivenessLogger,
} from '../middleware/intelligent-parameters';
import { validateQuery, validateRequest } from '../middleware/validation';
import { existsSync } from 'fs';
import { join } from 'path';

const router = Router();

// Apply parameter effectiveness logging
router.use(parameterEffectivenessLogger());

// Validation schemas
const inferenceSchema = z.object({
  modelPath: z.string().min(1, 'Model path is required'),
  prompt: z.string().min(1, 'Prompt is required').max(4000, 'Prompt too long'),
  parameters: z
    .object({
      maxTokens: z.number().min(1).max(4096).optional(),
      temperature: z.number().min(0).max(2).optional(),
      topP: z.number().min(0).max(1).optional(),
      rawPrompt: z.boolean().optional(),
    })
    .optional(),
});

const fineTuningSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  datasetPath: z.string().min(1, 'Dataset path is required'),
  outputPath: z.string().min(1, 'Output path is required'),
  hyperparameters: z
    .object({
      learningRate: z.number().min(0.00001).max(0.1).optional(),
      batchSize: z.number().min(1).max(128).optional(),
      epochs: z.number().min(1).max(100).optional(),
      maxSeqLength: z.number().min(32).max(8192).optional(),
      gradientAccumulation: z.number().min(1).max(32).optional(),
    })
    .optional(),
  validation: z
    .object({
      splitRatio: z.number().min(0.1).max(0.5).optional(),
      validationPath: z.string().optional(),
    })
    .optional(),
});

const _jobStatusSchema = z.object({
  jobId: z.string().min(1, 'VALIDATION_ERROR'),
});

const downloadModelSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  source: z.enum(['huggingface', 'local', 'url']).optional(),
  url: z.string().url().optional(),
});

const modelListQuerySchema = z.object({
  type: z.enum(['all', 'base', 'fine-tuned']).optional(),
  available: z.boolean().optional(),
});

// Rate limiting configurations
const mlxGeneralLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 requests per minute
  keyPrefix: 'mlx:general',
});

const mlxInferenceLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 inference requests per minute
  keyPrefix: 'mlx:inference',
});

const mlxFineTuneLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 fine-tuning jobs per hour
  keyPrefix: 'mlx:finetune',
});

const mlxDownloadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 model downloads per hour
  keyPrefix: 'mlx:download',
});

// Store for tracking fine-tuning jobs
const fineTuningJobs = new Map<
  string,
  {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    startTime: Date;
    endTime?: Date;
    error?: string;
    request: FineTuningRequest;
    metrics?: {
      loss: number;
      accuracy?: number;
      perplexity?: number;
    };
  }
>();

/**
 * @route GET /api/v1/mlx/status  
 * @description Get MLX service status (alias for health check)
 */
router.get(
  '/status',
  mlxGeneralLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();
      const healthStatus = await mlxService.healthCheck();
      const responseTime = Date.now() - startTime;

      const response = {
        status: healthStatus.healthy ? 'operational' : 'degraded',
        service: 'MLX Apple Silicon ML Service',
        ...healthStatus,
        responseTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Failed MLX status check', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/mlx/health
 * @description Health check for MLX service
 */
router.get(
  '/health',
  mlxGeneralLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const         startTime = Date.now();

      log.info('🍎 MLX health check requested', LogContext.API, {
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 100),
      });

      const healthStatus = await mlxService.healthCheck();
      const responseTime = Date.now() - startTime;

      const response = {
        ...healthStatus,
        responseTime,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };

      if (healthStatus.healthy) {
        sendSuccess(res, response);
      } else {
        res.status(503);
        sendError(res, 'SERVICE_ERROR', 'MLX service unhealthy', 503, response);
      }
    } catch (error) {
      log.error('Failed MLX health check', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/mlx/metrics
 * @description Get MLX service metrics and performance data
 */
router.get(
  '/metrics',
  authenticate,
  mlxGeneralLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      log.info('📊 MLX metrics requested', LogContext.API, {
        userId: req.user?.id,
      });

      const metrics = mlxService.getMetrics();
      const systemInfo = {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
        arch: process.arch,
      };

      const         response = {
          service: metrics,
          system: systemInfo,
          fineTuningJobs: {
            total: fineTuningJobs.size,
            running: Array.from(fineTuningJobs.values()).filter((job) => job.status === 'running')
              .length,
            completed: Array.from(fineTuningJobs.values()).filter(
              (job) => job.status === 'completed'
            ).length,
            failed: Array.from(fineTuningJobs.values()).filter((job) => job.status === 'failed')
              .length,
          },
          timestamp: new Date().toISOString(),
        };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Failed to get MLX metrics', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/mlx/models
 * @description List available MLX models
 */
router.get(
  '/models',
  authenticate,
  mlxGeneralLimiter,
  validateQuery(modelListQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type, available } = req.query as any;

      log.info('📚 MLX models list requested', LogContext.API, {
        userId: req.user?.id,
        filters: { type, available },
      });

      const modelsResponse = await mlxService.listModels();

      if (!modelsResponse.success) {
        return sendError(
          res,
          'SERVICE_ERROR',
          modelsResponse.error || 'Failed to list models',
          500
        );
      }

      let { models } = modelsResponse.data;

      // Apply filters
      if (type && type !== 'all') {
        models = models.filter((model: any) => model.type === type);
      }

      if (available !== undefined) {
        models = models.filter((model: any) => model.available === available);
      }

      const response = {
        models,
        total: models.length,
        modelsPath: modelsResponse.data.modelsPath,
        filters: { type, available },
        timestamp: new Date().toISOString(),
      };

      sendSuccess(res, response, 200, { message: `Found ${models.length} MLX models` });
    } catch (error) {
      log.error('Failed to list MLX models', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/mlx/inference
 * @description Run model inference using MLX
 */
router.post(
  '/inference',
  authenticate,
  mlxInferenceLimiter,
  intelligentParametersMiddleware(), // Apply intelligent parameter optimization
  validateRequest(inferenceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Create optimized inference request using intelligent parameters
      const inferenceRequest: InferenceRequest = {
        modelPath: req.body.modelPath,
        prompt: req.body.enhancedPrompt
          ? req.body.prompt.replace(
              '{user_input}',
              req.body.originalBody?.prompt || req.body.prompt
            )
          : req.body.prompt,
        parameters: {
          maxTokens: req.body.maxTokens || req.body.parameters?.maxTokens,
          temperature: req.body.temperature || req.body.parameters?.temperature,
          topP: req.body.topP || req.body.parameters?.topP,
          rawPrompt: req.body.parameters?.rawPrompt,
        },
      };

      const         startTime = Date.now();

      log.info('🧠 MLX inference requested with intelligent parameters', LogContext.API, {
        userId: req.user?.id,
        modelPath: inferenceRequest.modelPath,
        promptLength: inferenceRequest.prompt.length,
        optimizedParameters: inferenceRequest.parameters,
        taskType: (req as any).taskContext?.type,
        originalPrompt: req.body.originalBody?.prompt?.substring(0, 50),
      });

      // Validate model exists
      if (!existsSync(inferenceRequest.modelPath)) {
        return sendError(res, 'NOT_FOUND', 'Model not found at specified path', 404);
      }

      // Run inference
      const         result = await mlxService.runInference(inferenceRequest);
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        log.error('MLX inference failed', LogContext.API, {
          userId: req.user?.id,
          error: result.error,
          modelPath: inferenceRequest.modelPath,
        });
        return sendError(res, 'SERVICE_ERROR', result.error || 'Inference failed', 500);
      }

      const response = {
        ...result.data,
        executionTime,
        modelPath: inferenceRequest.modelPath,
        timestamp: new Date().toISOString(),
      };

      log.info('✅ MLX inference completed', LogContext.API, {
        userId: req.user?.id,
        executionTime,
        outputLength: result.data?.text?.length || 0,
      });

      sendSuccess(res, response);
    } catch (error) {
      log.error('Failed MLX inference', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/mlx/fine-tune
 * @description Start a fine-tuning job
 */
router.post(
  '/fine-tune',
  authenticate,
  mlxFineTuneLimiter,
  validateRequest(fineTuningSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const fineTuningRequest:       FineTuningRequest = req.body;
      const jobId = `mlx_ft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      log.info('🎯 MLX fine-tuning job requested', LogContext.AI, {
        userId: req.user?.id,
        jobId,
        modelName: fineTuningRequest.modelName,
        datasetPath: fineTuningRequest.datasetPath,
      });

      // Validate dataset exists
      if (!existsSync(fineTuningRequest.datasetPath)) {
        return sendError(res, 'NOT_FOUND', 'Resource not found', 404);
      }

      // Create job entry
      const job = {
        id: jobId,
        status: 'pending' as const,
        progress: 0,
        startTime: new Date(),
        request: fineTuningRequest,
      };

      fineTuningJobs.set(jobId, job);

      // Start fine-tuning asynchronously
      setImmediate(async () => {
        try {
          const jobEntry = fineTuningJobs.get(jobId);
          if (jobEntry) {
            jobEntry.status = 'running';
            fineTuningJobs.set(jobId, jobEntry);
          }

          const result = await mlxService.fineTuneModel(fineTuningRequest);

          const finalJobEntry = fineTuningJobs.get(jobId);
          if (finalJobEntry) {
            if (result.success) {
              finalJobEntry.status = 'completed';
              finalJobEntry.progress = 100;
              finalJobEntry.endTime = new Date();
              if (result.data?.metrics) {
                finalJobEntry.metrics = result.data.metrics;
              }
            } else {
              finalJobEntry.status = 'failed';
              finalJobEntry.error = result.error || 'Fine-tuning failed';
              finalJobEntry.endTime = new Date();
            }
            fineTuningJobs.set(jobId, finalJobEntry);
          }

          log.info(
            `🎯 Fine-tuning job ${jobId} ${result.success ? 'completed' : 'failed'}`,
            LogContext.AI,
            {
              jobId,
              success: result.success,
              error: result.error,
            }
          );
        } catch (error) {
          const             jobEntry = fineTuningJobs.get(jobId);
          if (jobEntry) {
            jobEntry.status = 'failed';
            jobEntry.error = error instanceof Error ? error.message : String(error);
            jobEntry.endTime = new Date();
            fineTuningJobs.set(jobId, jobEntry);
          }

          log.error(`❌ Fine-tuning job ${jobId} failed with exception`, LogContext.AI, {
            error,
            jobId,
          });
        }
      });

      const response = {
        jobId,
        status: job.status,
        message: 'Fine-tuning job started successfully',
        estimatedDuration: '10-60 minutes depending on dataset size',
        checkStatusUrl: `/api/v1/mlx/fine-tune/status/${jobId}`,
        timestamp: new Date().toISOString(),
      };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Failed to start MLX fine-tuning', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/mlx/fine-tune/status/:jobId
 * @description Check fine-tuning job status
 */
router.get(
  '/fine-tune/status/:jobId',
  authenticate,
  mlxGeneralLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params as { jobId: string };

      if (!jobId) {
        return sendError(res, 'VALIDATION_ERROR', 'Job ID is required', 400);
      }

      log.info('📊 Fine-tuning status check', LogContext.API, {
        userId: req.user?.id,
        jobId,
      });

      const job = fineTuningJobs.get(jobId);

      if (!job) {
        return sendError(res, 'NOT_FOUND', 'Resource not found', 404);
      }

      const response = {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        startTime: job.startTime.toISOString(),
        endTime: job.endTime?.toISOString(),
        duration: job.endTime
          ? job.endTime.getTime() - job.startTime.getTime()
          : Date.now() - job.startTime.getTime(),
        error: job.error,
        metrics: job.metrics,
        request: {
          modelName: job.request.modelName,
          datasetPath: job.request.datasetPath,
          outputPath: job.request.outputPath,
        },
        timestamp: new Date().toISOString(),
      };

      sendSuccess(res, response, 200, { message: `Fine-tuning job ${job.status}` });
    } catch (error) {
      log.error('Failed to get fine-tuning status', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/mlx/models/download
 * @description Download a model for MLX usage
 */
router.post(
  '/models/download',
  authenticate,
  mlxDownloadLimiter,
  validateRequest(downloadModelSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        modelName,         source = 'huggingface',
        url,
      } = req.body;

      log.info('📥 Model download requested', LogContext.API, {
        userId: req.user?.id,
        modelName,
        source,
        url: url ? url.substring(0, 100) : undefined,
      });

      // This is a placeholder implementation
      // In a real implementation, you would:
      // 1. Download the model from HuggingFace or other source
      // 2. Convert it to MLX format if needed
      // 3. Store it in the models directory
      // 4. Update the models registry

      const         downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const modelsPath = join(process.cwd(), 'models');

      // Simulate download process
      setTimeout(() => {
        log.info('✅ Model download completed (simulated)', LogContext.API, {
          downloadId,
          modelName,
          source,
        });
      }, 5000);

      const response = {
        downloadId,
        modelName,
        source,
        status: 'downloading',
        message: 'Model download started',
        estimatedTime: '2-10 minutes depending on model size',
        outputPath: join(modelsPath, modelName),
        timestamp: new Date().toISOString(),
      };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Failed to start model download', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route DELETE /api/v1/mlx/fine-tune/:jobId
 * @description Cancel or delete a fine-tuning job
 */
router.delete(
  '/fine-tune/:jobId',
  authenticate,
  mlxGeneralLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params as { jobId: string };

      log.info('🗑️ Fine-tuning job deletion requested', LogContext.API, {
        userId: req.user?.id,
        jobId,
      });

      const job = fineTuningJobs.get(jobId);

      if (!job) {
        return sendError(res, 'NOT_FOUND', 'Resource not found', 404);
      }

      if (job.status === 'running') {
        // In a real implementation, you would cancel the running process
        job.status = 'failed';
        job.error = 'Cancelled by user';
        job.endTime = new Date();
        fineTuningJobs.set(jobId, job);
      }

      // Remove job from tracking
      fineTuningJobs.delete(jobId);

      const response = {
        jobId,
        message: 'Fine-tuning job deleted successfully',
        timestamp: new Date().toISOString(),
      };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Failed to delete fine-tuning job', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/mlx/fine-tune/jobs
 * @description List all fine-tuning jobs for the user
 */
router.get(
  '/fine-tune/jobs',
  authenticate,
  mlxGeneralLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      log.info('📋 Fine-tuning jobs list requested', LogContext.API, {
        userId: req.user?.id,
      });

      const jobs = Array.from(fineTuningJobs.values()).map((job) => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        startTime: job.startTime.toISOString(),
        endTime: job.endTime?.toISOString(),
        modelName: job.request.modelName,
        error: job.error,
      }));

      const response = {
        jobs,
        total: jobs.length,
        byStatus: {
          pending: jobs.filter((job) => job.status === 'pending').length,
          running: jobs.filter((job) => job.status === 'running').length,
          completed: jobs.filter((job) => job.status === 'completed').length,
          failed: jobs.filter((job) => job.status === 'failed').length,
        },
        timestamp: new Date().toISOString(),
      };

      sendSuccess(res, response, 200, { message: `Found ${jobs.length} fine-tuning jobs` });
    } catch (error) {
      log.error('Failed to list fine-tuning jobs', LogContext.API, { error });
      next(error);
    }
  }
);

export default router;

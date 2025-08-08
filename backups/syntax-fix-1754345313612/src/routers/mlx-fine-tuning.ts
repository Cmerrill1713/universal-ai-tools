/**
 * MLX Fine-tuning Router;
 * Comprehensive API endpoints for MLX fine-tuning service;
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '../utils/logger';
import { sendError, sendSuccess } from '../utils/api-response';
import { mlxFineTuningService } from '../services/mlx-fine-tuning-service';
import type {
  EvaluationConfig,
  Hyperparameters,
  ParameterSpace,
  ValidationConfig,
} from '../services/mlx-fine-tuning-service';

const   router = Router();

// ============================================================================
// Middleware Setup;
// ============================================================================

// Configure multer for dataset uploads;
const uploadsPath = join(process?.cwd(), 'uploads', 'datasets');
if (!existsSync(uploadsPath)) {
  mkdirSync(uploadsPath, { recursive: true });
}

const upload = multer({
  dest: uploadsPath,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit;
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.json', '.jsonl', '.csv'];
    const ext = file?.originalname?.toLowerCase().split('.').pop();

    if (allowedTypes?.includes(`.${ext}`)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JSON, JSONL, and CSV files are allowed.'));
    }
  },
});

// Authentication middleware (simplified - replace with your actual auth)
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = req?.headers['x-user-id'] as string;
  if (!userId) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }
  (req as unknown).userId = userId;
  next();
};

// Apply auth to all routes;
router?.use(requireAuth);

// ============================================================================
// Dataset Management Endpoints;
// ============================================================================

/**
 * Upload and validate a training dataset;
 * POST /api/v1/mlx-fine-tuning/datasets;
 */
router?.post('/datasets', upload?.single('dataset'), async (req: Request, res: Response) => {
  try {
    const { name, preprocessing_config } = req?.body;
    const { userId } = req as unknown;

    if (!req?.file) {
      return sendError(res, 'VALIDATION_ERROR', 'No dataset file provided');
    }

    if (!name) {
      return sendError(res, 'VALIDATION_ERROR', 'Dataset name is required');
    }

    // Parse preprocessing config if provided;
    let preprocessingConfig;
    if (preprocessing_config) {
      try {
        preprocessingConfig = JSON?.parse(preprocessing_config);
      } catch (error) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid preprocessing config JSON');
      }
    }

    log?.info('📤 Uploading dataset', LogContext?.API, {
      name,
      originalName: req?.file?.originalname,
      size: req?.file?.size,
      userId,
    });

    const dataset = await mlxFineTuningService?.loadDataset(
      req?.file?.path,
      name,
      userId,
      preprocessingConfig;
    );

    sendSuccess(res, dataset);
  } catch (error) {
    log?.error('❌ Dataset upload failed', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Dataset upload failed'
    );
  }
});

/**
 * List user's datasets;
 * GET /api/v1/mlx-fine-tuning/datasets;
 */
router?.get('/datasets', async (req: Request, res: Response) => {
  try {
    const { userId } = req as unknown;

    // In a real implementation, you would fetch from database;
    // For now, return a success response indicating the endpoint exists;
    sendSuccess(res, []);
  } catch (error) {
    log?.error('❌ Failed to list datasets', LogContext?.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to list datasets');
  }
});

// ============================================================================
// Fine-tuning Job Management;
// ============================================================================

/**
 * Create a new fine-tuning job;
 * POST /api/v1/mlx-fine-tuning/jobs;
 */
router?.post('/jobs', async (req: Request, res: Response) => {
  try {
    const {
      job_name,
      base_model_name,
      base_model_path,
      dataset_path,
      hyperparameters,
      validation_config,
    } = req?.body;

    const { userId } = req as unknown;

    // Validation;
    if (!job_name || !base_model_name || !base_model_path || !dataset_path) {
      return sendError(
        res,
        'VALIDATION_ERROR',
        'Missing required fields: job_name, base_model_name, base_model_path, dataset_path'
      );
    }

    // Validate base model path exists;
    if (!existsSync(base_model_path)) {
      return sendError(res, 'VALIDATION_ERROR', 'Base model path does not exist');
    }

    // Validate dataset path exists;
    if (!existsSync(dataset_path)) {
      return sendError(res, 'VALIDATION_ERROR', 'Dataset path does not exist');
    }

    log?.info('🎯 Creating fine-tuning job', LogContext?.API, {
      jobName: job_name,
      baseModel: base_model_name,
      userId,
    });

    const job = await mlxFineTuningService?.createFineTuningJob(
      job_name,
      userId,
      base_model_name,
      base_model_path,
      dataset_path,
      hyperparameters as Partial<Hyperparameters>,
      validation_config as Partial<ValidationConfig>
    );

    sendSuccess(res, job);
  } catch (error) {
    log?.error('❌ Failed to create fine-tuning job', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Failed to create job'
    );
  }
});

/**
 * Start a fine-tuning job;
 * POST /api/v1/mlx-fine-tuning/jobs/:jobId/start;
 */
router?.post('/jobs/:jobId/start', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };
    const { userId } = req as unknown;

    log?.info('▶️ Starting fine-tuning job', LogContext?.API, { jobId, userId });

    await mlxFineTuningService?.startFineTuningJob(jobId);

    sendSuccess(res, null);
  } catch (error) {
    log?.error('❌ Failed to start fine-tuning job', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Failed to start job'
    );
  }
});

/**
 * Pause a fine-tuning job;
 * POST /api/v1/mlx-fine-tuning/jobs/:jobId/pause;
 */
router?.post('/jobs/:jobId/pause', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };

    log?.info('⏸️ Pausing fine-tuning job', LogContext?.API, { jobId });

    await mlxFineTuningService?.pauseJob(jobId);

    sendSuccess(res, null);
  } catch (error) {
    log?.error('❌ Failed to pause fine-tuning job', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Failed to pause job'
    );
  }
});

/**
 * Resume a fine-tuning job;
 * POST /api/v1/mlx-fine-tuning/jobs/:jobId/resume;
 */
router?.post('/jobs/:jobId/resume', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };

    log?.info('▶️ Resuming fine-tuning job', LogContext?.API, { jobId });

    await mlxFineTuningService?.resumeJob(jobId);

    sendSuccess(res, null);
  } catch (error) {
    log?.error('❌ Failed to resume fine-tuning job', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Failed to resume job'
    );
  }
});

/**
 * Cancel a fine-tuning job;
 * POST /api/v1/mlx-fine-tuning/jobs/:jobId/cancel;
 */
router?.post('/jobs/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };

    log?.info('🛑 Cancelling fine-tuning job', LogContext?.API, { jobId });

    await mlxFineTuningService?.cancelJob(jobId);

    sendSuccess(res, null);
  } catch (error) {
    log?.error('❌ Failed to cancel fine-tuning job', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Failed to cancel job'
    );
  }
});

/**
 * Get all jobs for a user;
 * GET /api/v1/mlx-fine-tuning/jobs;
 */
router?.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { userId } = req as unknown;
    const { status } = req?.query;

    const       jobs = await mlxFineTuningService?.listJobs(userId, status as unknown);

    sendSuccess(res, jobs);
  } catch (error) {
    log?.error('❌ Failed to list jobs', LogContext?.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to list jobs');
  }
});

/**
 * Get specific job details;
 * GET /api/v1/mlx-fine-tuning/jobs/:jobId;
 */
router?.get('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };

    const job = await mlxFineTuningService?.getJob(jobId);

    if (!job) {
      return sendError(res, 'NOT_FOUND', 'Job not found');
    }

    sendSuccess(res, job);
  } catch (error) {
    log?.error('❌ Failed to get job details', LogContext?.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to get job details');
  }
});

/**
 * Delete a fine-tuning job;
 * DELETE /api/v1/mlx-fine-tuning/jobs/:jobId;
 */
router?.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };

    log?.info('🗑️ Deleting fine-tuning job', LogContext?.API, { jobId });

    await mlxFineTuningService?.deleteJob(jobId);

    sendSuccess(res, null);
  } catch (error) {
    log?.error('❌ Failed to delete fine-tuning job', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Failed to delete job'
    );
  }
});

// ============================================================================
// Progress Monitoring;
// ============================================================================

/**
 * Get job progress;
 * GET /api/v1/mlx-fine-tuning/jobs/:jobId/progress;
 */
router?.get('/jobs/:jobId/progress', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };

    const progress = await mlxFineTuningService?.getJobProgress(jobId);

    if (!progress) {
      return sendError(res, 'NOT_FOUND', 'Job progress not found');
    }

    sendSuccess(res, progress);
  } catch (error) {
    log?.error('❌ Failed to get job progress', LogContext?.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to get job progress');
  }
});

/**
 * Get job training metrics;
 * GET /api/v1/mlx-fine-tuning/jobs/:jobId/metrics;
 */
router?.get('/jobs/:jobId/metrics', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };

    const metrics = await mlxFineTuningService?.getJobMetrics(jobId);

    if (!metrics) {
      return sendError(res, 'NOT_FOUND', 'Job metrics not found');
    }

    sendSuccess(res, metrics);
  } catch (error) {
    log?.error('❌ Failed to get job metrics', LogContext?.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to get job metrics');
  }
});

// ============================================================================
// Hyperparameter Optimization;
// ============================================================================

/**
 * Start hyperparameter optimization;
 * POST /api/v1/mlx-fine-tuning/experiments;
 */
router?.post('/experiments', async (req: Request, res: Response) => {
  try {
    const { experiment_name, base_job_id, optimization_method, parameter_space, max_trials } =
      req?.body;

    const { userId } = req as unknown;

    // Validation;
    if (!experiment_name || !base_job_id || !optimization_method || !parameter_space) {
      return sendError(
        res,
        'VALIDATION_ERROR',
        'Missing required fields: experiment_name, base_job_id, optimization_method, parameter_space'
      );
    }

    log?.info('🔬 Starting hyperparameter optimization', LogContext?.API, {
      experimentName: experiment_name,
      baseJobId: base_job_id,
      method: optimization_method,
      userId,
    });

    const experiment = await mlxFineTuningService?.runHyperparameterOptimization(
      experiment_name,
      base_job_id,
      userId,
      optimization_method,
      parameter_space as ParameterSpace,
      max_trials || 20,
    );

    sendSuccess(res, experiment);
  } catch (error) {
    log?.error('❌ Failed to start hyperparameter optimization', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Failed to start optimization'
    );
  }
});

// ============================================================================
// Model Evaluation;
// ============================================================================

/**
 * Evaluate a fine-tuned model;
 * POST /api/v1/mlx-fine-tuning/jobs/:jobId/evaluate;
 */
router?.post('/jobs/:jobId/evaluate', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };
    const {
            evaluation_type = 'final',
      evaluation_config,
    } = req?.body;

    log?.info('📊 Evaluating model', LogContext?.API, { jobId, evaluationType: evaluation_type });

    const job = await mlxFineTuningService?.getJob(jobId);
    if (!job) {
      return sendError(res, 'NOT_FOUND', 'Job not found');
    }

    if (job?.status !== 'completed') {
      return sendError(res, 'VALIDATION_ERROR', 'Job must be completed before evaluation');
    }

    const evaluation = await mlxFineTuningService?.evaluateModel(
      jobId,
      job?.outputModelPath,
      evaluation_type,
      evaluation_config as Partial<EvaluationConfig>
    );

    sendSuccess(res, evaluation);
  } catch (error) {
    log?.error('❌ Model evaluation failed', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Model evaluation failed'
    );
  }
});

// ============================================================================
// Model Export and Deployment;
// ============================================================================

/**
 * Export a fine-tuned model;
 * POST /api/v1/mlx-fine-tuning/jobs/:jobId/export;
 */
router?.post('/jobs/:jobId/export', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };
    const { export_format = 'mlx', export_path } = req?.body;

    log?.info('📦 Exporting model', LogContext?.API, { jobId, format: export_format });

    const exportPath = await mlxFineTuningService?.exportModel(
      jobId,
      export_format as 'mlx' | 'gguf' | 'safetensors',
      export_path;
    );

    sendSuccess(res, { export_path: exportPath, format: export_format });
  } catch (error) {
    log?.error('❌ Model export failed', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Model export failed'
    );
  }
});

/**
 * Deploy a fine-tuned model;
 * POST /api/v1/mlx-fine-tuning/jobs/:jobId/deploy;
 */
router?.post('/jobs/:jobId/deploy', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };
    const { deployment_name } = req?.body;

    log?.info('🚀 Deploying model', LogContext?.API, { jobId, deploymentName: deployment_name });

    const       deploymentId = await mlxFineTuningService?.deployModel(jobId, deployment_name);

    sendSuccess(res, { deployment_id: deploymentId });
  } catch (error) {
    log?.error('❌ Model deployment failed', LogContext?.API, { error });
    sendError(
      res,
      'INTERNAL_ERROR',
      error instanceof Error ? error?.message : 'Model deployment failed'
    );
  }
});

// ============================================================================
// Queue Management;
// ============================================================================

/**
 * Get job queue status;
 * GET /api/v1/mlx-fine-tuning/queue;
 */
router?.get('/queue', async (req: Request, res: Response) => {
  try {
    const queueStatus = await mlxFineTuningService?.getQueueStatus();

    sendSuccess(res, queueStatus);
  } catch (error) {
    log?.error('❌ Failed to get queue status', LogContext?.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to get queue status');
  }
});

/**
 * Set job priority;
 * PUT /api/v1/mlx-fine-tuning/jobs/:jobId/priority;
 */
router?.put('/jobs/:jobId/priority', async (req: Request, res: Response) => {
  try {
    const { jobId } = req?.params as { jobId: string };
    const { priority } = req?.body;

    if (typeof priority !== 'number' || priority < 1 || priority > 10) {
      return sendError(res, 'VALIDATION_ERROR', 'Priority must be a number between 1 and 10');
    }

    await mlxFineTuningService?.setJobPriority(jobId, priority);

    sendSuccess(res, null);
  } catch (error) {
    log?.error('❌ Failed to set job priority', LogContext?.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to set job priority');
  }
});

// ============================================================================
// Health and Status;
// ============================================================================

/**
 * Get service health status;
 * GET /api/v1/mlx-fine-tuning/health;
 */
router?.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await mlxFineTuningService?.getHealthStatus();

    const statusCode = health?.status === 'healthy' ? 200 : health?.status === 'degraded' ? 206 : 503;

    res?.status(statusCode).json(sendSuccess(res, health));
  } catch (error) {
    log?.error('❌ Health check failed', LogContext?.API, { error });
    sendError(res, 'SERVICE_ERROR', 'Health check failed');
  }
});

// ============================================================================
// WebSocket Support for Real-time Updates;
// ============================================================================

/**
 * WebSocket endpoint for real-time job progress updates;
 * This would be implemented in the main server file with Socket?.IO;
 */
router?.get('/jobs/:jobId/stream', (req: Request, res: Response) => {
  sendSuccess(res, {
    message: 'Real-time streaming available via WebSocket',
    endpoint: '/socket?.io',
    events: ['jobProgressUpdated', 'jobMetricsUpdated', 'jobCompleted', 'jobFailed'],
  });
});

// ============================================================================
// Error Handling;
// ============================================================================

router?.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  log?.error('❌ MLX Fine-tuning API error', LogContext?.API, {
    error: error?.message,
    stack: error?.stack,
    path: req?.path,
    method: req?.method,
  });

  if (error?.message?.includes('Unexpected field')) {
    return sendError(res, 'INTERNAL_ERROR', 'Invalid file upload');
  }

  sendError(res, 'INTERNAL_ERROR', 'Internal server error in MLX fine-tuning service');
});

export default router;

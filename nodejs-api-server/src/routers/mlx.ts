/**
 * MLX Router
 * API endpoints for MLX fine-tuning and model management
 */

import express, { Request, Response } from 'express';
import { MLXFineTuningService, FineTuningConfig } from '../services/mlx-fine-tuning-service';

const router = express.Router();

// Initialize MLX Fine-Tuning Service
const mlxFineTuningService = new MLXFineTuningService(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

// Initialize MLX service
mlxFineTuningService.initialize().catch(error => {
  console.error('Failed to initialize MLX Fine-Tuning Service:', error);
});

/**
 * POST /api/mlx/fine-tune
 * Create a new fine-tuning job
 */
router.post('/fine-tune', async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      description, 
      baseModel, 
      modelProvider,
      trainingData, 
      config, 
      userId 
    } = req.body;

    if (!name || !baseModel || !trainingData || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, baseModel, trainingData, userId'
      });
    }

    // Default config if not provided
    const defaultConfig: FineTuningConfig = {
      epochs: 3,
      learningRate: 0.0001,
      batchSize: 4,
      validationSplit: 0.1,
      optimization: 'lora',
      maxLength: 2048,
      warmupSteps: 100,
      weightDecay: 0.01,
      gradientAccumulationSteps: 1,
      saveSteps: 500,
      evalSteps: 100,
      loggingSteps: 10,
      ...config
    };

    const job = await mlxFineTuningService.createFineTuningJob(
      name,
      description || '',
      baseModel,
      trainingData,
      defaultConfig,
      userId,
      modelProvider || 'mlx'
    );

    res.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MLX fine-tuning creation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/mlx/fine-tune/:jobId/start
 * Start a fine-tuning job
 */
router.post('/fine-tune/:jobId/start', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = await mlxFineTuningService.startFineTuningJob(jobId);

    res.json({
      success: true,
      data: job,
      message: 'Fine-tuning job started',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('MLX fine-tuning start error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/mlx/fine-tune
 * Get all fine-tuning jobs
 */
router.get('/fine-tune', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    const jobs = userId ? 
      mlxFineTuningService.getJobsByUser(userId as string) : 
      mlxFineTuningService.getAllJobs();

    res.json({
      success: true,
      data: jobs,
      count: jobs.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting fine-tuning jobs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/mlx/fine-tune/:jobId
 * Get specific fine-tuning job
 */
router.get('/fine-tune/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const job = mlxFineTuningService.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting fine-tuning job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/mlx/fine-tune/:jobId/cancel
 * Cancel a fine-tuning job
 */
router.post('/fine-tune/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const cancelled = await mlxFineTuningService.cancelJob(jobId);

    if (cancelled) {
      res.json({
        success: true,
        message: 'Job cancelled successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Job could not be cancelled',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error cancelling fine-tuning job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/mlx/fine-tune/:jobId
 * Delete a fine-tuning job
 */
router.delete('/fine-tune/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const deleted = await mlxFineTuningService.deleteJob(jobId);

    if (deleted) {
      res.json({
        success: true,
        message: 'Job deleted successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Job not found',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error deleting fine-tuning job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/mlx/datasets
 * Get available datasets
 */
router.get('/datasets', async (req: Request, res: Response) => {
  try {
    const datasets = mlxFineTuningService.getAvailableDatasets();

    res.json({
      success: true,
      data: datasets,
      count: datasets.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting datasets:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/mlx/datasets
 * Add custom dataset
 */
router.post('/datasets', async (req: Request, res: Response) => {
  try {
    const dataset = req.body;

    if (!dataset.name || !dataset.format || !dataset.path) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, format, path'
      });
    }

    mlxFineTuningService.addDataset(dataset);

    res.json({
      success: true,
      message: 'Dataset added successfully',
      data: dataset,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error adding dataset:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/mlx/status
 * Get MLX service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await mlxFineTuningService.getStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting MLX status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/mlx/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'MLX Fine-Tuning Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/mlx/fine-tune',
      'POST /api/mlx/fine-tune/:jobId/start',
      'GET /api/mlx/fine-tune',
      'GET /api/mlx/fine-tune/:jobId',
      'POST /api/mlx/fine-tune/:jobId/cancel',
      'DELETE /api/mlx/fine-tune/:jobId',
      'GET /api/mlx/datasets',
      'POST /api/mlx/datasets',
      'GET /api/mlx/status',
      'GET /api/mlx/health'
    ]
  });
});

export default router;
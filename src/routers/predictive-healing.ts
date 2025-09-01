/**
 * Predictive Healing API Routes
 * REST endpoints for the Production MLX Fine-Tuning Pipeline and Predictive Error Prevention System
 */

import { Router, Request, Response, NextFunction } from 'express';
import { LogContext, log } from '../utils/logger';
import { healingMLXTrainingPipeline } from '../services/healing-mlx-training-pipeline';
import { predictiveErrorPreventionSystem } from '../services/predictive-error-prevention-system';
import { intelligentParametersMiddleware } from '../middleware/intelligent-parameters';

const router = Router();

// ============================================================================
// MLX Fine-Tuning Pipeline Endpoints
// ============================================================================

// Create a new training job
router.post('/mlx/training/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CONFIG',
          message: 'Training configuration is required',
        },
      });
    }

    log.info('🚀 Creating MLX training job', LogContext.AI, {
      objective: config.trainingObjective,
      baseModel: config.baseModel,
    });

    const jobId = await healingMLXTrainingPipeline.createTrainingJob(config);

    return res.json({
      success: true,
      data: {
        jobId,
        message: 'Training job created successfully',
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'healing-mlx-training',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Start a training job
router.post('/mlx/training/:jobId/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_JOB_ID',
          message: 'Job ID is required',
        },
      });
    }

    log.info('▶️ Starting MLX training job', LogContext.AI, { jobId });

    // Start training job in background
    healingMLXTrainingPipeline.startTrainingJob(jobId)
      .then(() => {
        log.info('✅ MLX training job completed successfully', LogContext.AI, { jobId });
      })
      .catch((error) => {
        log.error('❌ MLX training job failed', LogContext.AI, { jobId, error });
      });

    return res.json({
      success: true,
      data: {
        jobId,
        message: 'Training job started successfully',
        status: 'training',
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'healing-mlx-training',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Get training job status
router.get('/mlx/training/:jobId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    const job = await healingMLXTrainingPipeline.getJobStatus(jobId ?? '');

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: `Training job ${jobId} not found`,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        job,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'healing-mlx-training',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// List all training jobs
router.get('/mlx/training/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await healingMLXTrainingPipeline.getAllJobs();

    return res.json({
      success: true,
      data: {
        jobs,
        total: jobs.length,
        active: jobs.filter(j => ['pending', 'preparing', 'training', 'evaluating'].includes(j.status)).length,
        completed: jobs.filter(j => j.status === 'completed').length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'healing-mlx-training',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Cancel a training job
router.post('/mlx/training/:jobId/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    await healingMLXTrainingPipeline.cancelJob(jobId ?? '');

    return res.json({
      success: true,
      data: {
        jobId,
        message: 'Training job cancelled successfully',
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'healing-mlx-training',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// Predictive Error Prevention Endpoints
// ============================================================================

// Analyze code for potential errors
router.post('/prevention/analyze', intelligentParametersMiddleware(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { codeContext } = req.body;

    if (!codeContext || !codeContext.content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CODE_CONTEXT',
          message: 'Code context with content is required',
        },
      });
    }

    log.info('🔍 Analyzing code for potential errors', LogContext.AI, {
      filePath: codeContext.filePath,
      language: codeContext.language,
      contentLength: codeContext.content.length,
    });

    const predictions = await predictiveErrorPreventionSystem.analyzeCodeForPotentialErrors(codeContext);

    return res.json({
      success: true,
      data: {
        predictions,
        summary: {
          total: predictions.length,
          highRisk: predictions.filter(p => p.prediction.severity === 'high' || p.prediction.severity === 'critical').length,
          averageProbability: predictions.length > 0 ? predictions.reduce((sum, p) => sum + p.prediction.probability, 0) / predictions.length : 0,
          preventableErrors: predictions.filter(p => p.prevention.actions.some(a => a.automatable)).length,
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-error-prevention',
        analysisId: `analysis_${Date.now()}`,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Implement prevention actions
router.post('/prevention/:predictionId/prevent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { predictionId } = req.params;
    const { actionTypes } = req.body;

    if (!Array.isArray(actionTypes) || actionTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ACTION_TYPES',
          message: 'Action types array is required',
        },
      });
    }

    log.info('🛡️ Implementing prevention actions', LogContext.AI, {
      predictionId,
      actionTypes,
    });

    const result = await predictiveErrorPreventionSystem.implementPreventionActions(predictionId ?? '', actionTypes);

    return res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-error-prevention',
        predictionId,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Start real-time monitoring
router.post('/prevention/monitoring/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { watchDirectories, fileExtensions, analysisDepth } = req.body;

    if (!Array.isArray(watchDirectories) || watchDirectories.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DIRECTORIES',
          message: 'Watch directories array is required',
        },
      });
    }

    log.info('🔄 Starting real-time error prevention monitoring', LogContext.AI, {
      directories: watchDirectories.length,
      extensions: fileExtensions || ['ts', 'js', 'tsx', 'jsx'],
      depth: analysisDepth || 'medium',
    });

    await predictiveErrorPreventionSystem.startRealTimeMonitoring({
      watchDirectories,
      fileExtensions: fileExtensions || ['ts', 'js', 'tsx', 'jsx'],
      analysisDepth: analysisDepth || 'medium',
    });

    return res.json({
      success: true,
      data: {
        message: 'Real-time monitoring started successfully',
        watchDirectories,
        fileExtensions: fileExtensions || ['ts', 'js', 'tsx', 'jsx'],
        analysisDepth: analysisDepth || 'medium',
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-error-prevention',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Train prediction model
router.post('/prevention/models/train', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { modelConfig } = req.body;

    if (!modelConfig || !modelConfig.name || !modelConfig.type) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_MODEL_CONFIG',
          message: 'Model configuration with name and type is required',
        },
      });
    }

    log.info('🧠 Training prediction model', LogContext.AI, {
      name: modelConfig.name,
      type: modelConfig.type,
      objective: modelConfig.trainingObjective,
    });

    const trainingJobId = await predictiveErrorPreventionSystem.trainPredictionModel(modelConfig);

    return res.json({
      success: true,
      data: {
        trainingJobId,
        modelConfig,
        message: 'Model training started successfully',
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-error-prevention',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Get active predictions
router.get('/prevention/predictions/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const predictions = await predictiveErrorPreventionSystem.getActivePredictions();

    return res.json({
      success: true,
      data: {
        predictions,
        total: predictions.length,
        byRisk: {
          critical: predictions.filter(p => p.prediction.severity === 'critical').length,
          high: predictions.filter(p => p.prediction.severity === 'high').length,
          medium: predictions.filter(p => p.prediction.severity === 'medium').length,
          low: predictions.filter(p => p.prediction.severity === 'low').length,
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-error-prevention',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Get prediction metrics
router.get('/prevention/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await predictiveErrorPreventionSystem.getPredictionMetrics();

    return res.json({
      success: true,
      data: {
        metrics,
        efficiency: {
          preventionRate: metrics.totalPredictions > 0 ? (metrics.preventedErrors / metrics.totalPredictions) * 100 : 0,
          accuracy: metrics.totalPredictions > 0 ? (metrics.correctPredictions / metrics.totalPredictions) * 100 : 0,
          timesSavedHours: Math.round(metrics.timesSaved / (1000 * 60 * 60) * 100) / 100,
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-error-prevention',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Get prediction history
router.get('/prevention/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 100;

    const history = await predictiveErrorPreventionSystem.getPredictionHistory(limitNum);

    return res.json({
      success: true,
      data: {
        history,
        total: history.length,
        timeRange: {
          from: history.length > 0 ? history[0]?.timestamp || null : null,
          to: history.length > 0 ? history[history.length - 1]?.timestamp || null : null,
        },
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-error-prevention',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// Combined System Status
// ============================================================================

// Get overall system status
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [mlxJobs, activePredictions, metrics] = await Promise.all([
      healingMLXTrainingPipeline.getAllJobs(),
      predictiveErrorPreventionSystem.getActivePredictions(),
      predictiveErrorPreventionSystem.getPredictionMetrics(),
    ]);

    const status = {
      system: {
        initialized: predictiveErrorPreventionSystem.getInitializationStatus(),
        status: 'operational',
        uptime: process.uptime(),
      },
      mlxTraining: {
        totalJobs: mlxJobs.length,
        activeJobs: mlxJobs.filter(j => ['pending', 'preparing', 'training', 'evaluating'].includes(j.status)).length,
        completedJobs: mlxJobs.filter(j => j.status === 'completed').length,
        failedJobs: mlxJobs.filter(j => j.status === 'failed').length,
      },
      prediction: {
        activePredictions: activePredictions.length,
        totalPredictions: metrics.totalPredictions,
        preventionRate: metrics.totalPredictions > 0 ? (metrics.preventedErrors / metrics.totalPredictions) * 100 : 0,
        accuracy: metrics.totalPredictions > 0 ? (metrics.correctPredictions / metrics.totalPredictions) * 100 : 0,
      },
      performance: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };

    return res.json({
      success: true,
      data: status,
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-healing-system',
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ============================================================================
// Demo Endpoints
// ============================================================================

// Demo: Create a complete training and prediction pipeline
router.post('/demo/complete-pipeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    log.info('🎯 Running complete predictive healing pipeline demo', LogContext.AI);

    // Step 1: Create MLX training job
    const trainingConfig = {
      modelName: 'healing-demo-model',
      baseModel: 'llama3.2:3b',
      trainingObjective: 'error_prediction' as const,
      dataSelection: {
        minSuccessRate: 0.95,
        minConfidence: 0.9,
        errorTypes: ['TypeError', 'SyntaxError', 'ReferenceError'],
        timeRangeHours: 24,
        includeFailures: false,
      },
      fineTuningParams: {
        epochs: 5,
        learningRate: 0.0001,
        batchSize: 2,
        maxSequenceLength: 1024,
        warmupSteps: 50,
        validationSplit: 0.2,
      },
      appleOptimization: {
        useMLX: true,
        gpuMemoryLimit: 16,
        quantization: '4bit' as const,
        enableMPS: true,
      },
    };

    const jobId = await healingMLXTrainingPipeline.createTrainingJob(trainingConfig);

    // Step 2: Analyze sample code
    const sampleCode = {
      filePath: '/demo/sample.ts',
      content: `
        interface User {
          name: string;
          age: number;
        }
        
        function processUser(user: User) {
          console.log(user.email); // This will cause a TypeError
          return user.age + "years"; // This will cause a type mismatch
        }
        
        const userData = JSON.parse(userInput); // Potential SyntaxError
        processUser(userData);
      `,
      language: 'typescript',
    };

    const predictions = await predictiveErrorPreventionSystem.analyzeCodeForPotentialErrors(sampleCode);

    return res.json({
      success: true,
      data: {
        demo: 'complete-predictive-healing-pipeline',
        mlxTraining: {
          jobId,
          config: trainingConfig,
          status: 'created',
        },
        predictions: {
          total: predictions.length,
          predictions: predictions.slice(0, 3), // First 3 predictions
          summary: {
            highRisk: predictions.filter(p => p.prediction.severity === 'high' || p.prediction.severity === 'critical').length,
            preventable: predictions.filter(p => p.prevention.actions.some(a => a.automatable)).length,
          },
        },
        nextSteps: [
          'Start MLX training job with POST /mlx/training/{jobId}/start',
          'Implement prevention actions with POST /prevention/{predictionId}/prevent',
          'Monitor real-time with POST /prevention/monitoring/start',
        ],
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'predictive-healing-demo',
        demoVersion: '1.0.0',
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
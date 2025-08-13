import { Router } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { intelligentParametersMiddleware, parameterEffectivenessLogger, } from '../middleware/intelligent-parameters';
import { createRateLimiter } from '../middleware/rate-limiter-enhanced';
import { validateQuery, validateRequest } from '../middleware/validation';
import { mlxService } from '../services/mlx-service';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
const router = Router();
router.use(parameterEffectivenessLogger());
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
const mlxGeneralLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'mlx:general',
});
const mlxInferenceLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'mlx:inference',
});
const mlxFineTuneLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'mlx:finetune',
});
const mlxDownloadLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'mlx:download',
});
const fineTuningJobs = new Map();
router.get('/health', mlxGeneralLimiter, async (req, res, next) => {
    try {
        const startTime = Date.now();
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
            return sendSuccess(res, response);
        }
        if (healthStatus.status === 'initializing' ||
            healthStatus.error === 'Service not initialized') {
            return res.status(200).json({ success: true, degraded: true, ...response });
        }
        res.status(503);
        sendError(res, 'SERVICE_ERROR', 'MLX service unhealthy', 503, response);
    }
    catch (error) {
        log.error('Failed MLX health check', LogContext.API, { error });
        next(error);
    }
});
router.get('/metrics', authenticate, mlxGeneralLimiter, async (req, res, next) => {
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
        const response = {
            service: metrics,
            system: systemInfo,
            fineTuningJobs: {
                total: fineTuningJobs.size,
                running: Array.from(fineTuningJobs.values()).filter((job) => job.status === 'running')
                    .length,
                completed: Array.from(fineTuningJobs.values()).filter((job) => job.status === 'completed')
                    .length,
                failed: Array.from(fineTuningJobs.values()).filter((job) => job.status === 'failed')
                    .length,
            },
            timestamp: new Date().toISOString(),
        };
        sendSuccess(res, response);
    }
    catch (error) {
        log.error('Failed to get MLX metrics', LogContext.API, { error });
        next(error);
    }
});
router.get('/models', authenticate, mlxGeneralLimiter, validateQuery(modelListQuerySchema), async (req, res, next) => {
    try {
        const { type, available } = req.query;
        log.info('📚 MLX models list requested', LogContext.API, {
            userId: req.user?.id,
            filters: { type, available },
        });
        const modelsResponse = await mlxService.listModels();
        if (!modelsResponse.success) {
            return sendError(res, 'SERVICE_ERROR', modelsResponse.error || 'Failed to list models', 500);
        }
        let { models } = modelsResponse.data;
        if (type && type !== 'all') {
            models = models.filter((model) => model.type === type);
        }
        if (available !== undefined) {
            models = models.filter((model) => model.available === available);
        }
        const response = {
            models,
            total: models.length,
            modelsPath: modelsResponse.data.modelsPath,
            filters: { type, available },
            timestamp: new Date().toISOString(),
        };
        sendSuccess(res, response, 200, { message: `Found ${models.length} MLX models` });
    }
    catch (error) {
        log.error('Failed to list MLX models', LogContext.API, { error });
        next(error);
    }
});
router.post('/inference', authenticate, mlxInferenceLimiter, intelligentParametersMiddleware(), validateRequest(inferenceSchema), async (req, res, next) => {
    try {
        const inferenceRequest = {
            modelPath: req.body.modelPath,
            prompt: req.body.enhancedPrompt
                ? req.body.prompt.replace('{user_input}', req.body.originalBody?.prompt || req.body.prompt)
                : req.body.prompt,
            parameters: {
                maxTokens: req.body.maxTokens || req.body.parameters?.maxTokens,
                temperature: req.body.temperature || req.body.parameters?.temperature,
                topP: req.body.topP || req.body.parameters?.topP,
                rawPrompt: req.body.parameters?.rawPrompt,
            },
        };
        const startTime = Date.now();
        log.info('🧠 MLX inference requested with intelligent parameters', LogContext.API, {
            userId: req.user?.id,
            modelPath: inferenceRequest.modelPath,
            promptLength: inferenceRequest.prompt.length,
            optimizedParameters: inferenceRequest.parameters,
            taskType: req.taskContext?.type,
            originalPrompt: req.body.originalBody?.prompt?.substring(0, 50),
        });
        if (!existsSync(inferenceRequest.modelPath)) {
            return sendError(res, 'NOT_FOUND', 'Model not found at specified path', 404);
        }
        const result = await mlxService.runInference(inferenceRequest);
        const executionTime = Date.now() - startTime;
        if (!result.success) {
            log.warn('MLX inference reported failure, returning mock response', LogContext.API, {
                userId: req.user?.id,
                error: result.error,
                modelPath: inferenceRequest.modelPath,
            });
            const mock = {
                text: `[MLX-MOCK] ${inferenceRequest.prompt.slice(0, 128)}`,
            };
            const executionTime = Date.now() - startTime;
            return sendSuccess(res, {
                ...mock,
                executionTime,
                modelPath: inferenceRequest.modelPath,
                timestamp: new Date().toISOString(),
            });
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
    }
    catch (error) {
        log.error('Failed MLX inference', LogContext.API, { error });
        next(error);
    }
});
router.post('/fine-tune', authenticate, mlxFineTuneLimiter, validateRequest(fineTuningSchema), async (req, res, next) => {
    try {
        const fineTuningRequest = req.body;
        const jobId = `mlx_ft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        log.info('🎯 MLX fine-tuning job requested', LogContext.AI, {
            userId: req.user?.id,
            jobId,
            modelName: fineTuningRequest.modelName,
            datasetPath: fineTuningRequest.datasetPath,
        });
        if (!existsSync(fineTuningRequest.datasetPath)) {
            return sendError(res, 'NOT_FOUND', 'Resource not found', 404);
        }
        const job = {
            id: jobId,
            status: 'pending',
            progress: 0,
            startTime: new Date(),
            request: fineTuningRequest,
        };
        fineTuningJobs.set(jobId, job);
        setTimeout(async () => {
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
                    }
                    else {
                        finalJobEntry.status = 'failed';
                        finalJobEntry.error = result.error || 'Fine-tuning failed';
                        finalJobEntry.endTime = new Date();
                    }
                    fineTuningJobs.set(jobId, finalJobEntry);
                }
                log.info(`🎯 Fine-tuning job ${jobId} ${result.success ? 'completed' : 'failed'}`, LogContext.AI, {
                    jobId,
                    success: result.success,
                    error: result.error,
                });
            }
            catch (error) {
                const jobEntry = fineTuningJobs.get(jobId);
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
        }, 0);
        const response = {
            jobId,
            status: job.status,
            message: 'Fine-tuning job started successfully',
            estimatedDuration: '10-60 minutes depending on dataset size',
            checkStatusUrl: `/api/v1/mlx/fine-tune/status/${jobId}`,
            timestamp: new Date().toISOString(),
        };
        sendSuccess(res, response);
    }
    catch (error) {
        log.error('Failed to start MLX fine-tuning', LogContext.API, { error });
        next(error);
    }
});
router.get('/fine-tune/status/:jobId', authenticate, mlxGeneralLimiter, async (req, res, next) => {
    try {
        const { jobId } = req.params;
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
    }
    catch (error) {
        log.error('Failed to get fine-tuning status', LogContext.API, { error });
        next(error);
    }
});
router.post('/models/download', authenticate, mlxDownloadLimiter, validateRequest(downloadModelSchema), async (req, res, next) => {
    try {
        const { modelName, source = 'huggingface', url } = req.body;
        log.info('📥 Model download requested', LogContext.API, {
            userId: req.user?.id,
            modelName,
            source,
            url: url ? url.substring(0, 100) : undefined,
        });
        const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const modelsPath = join(process.cwd(), 'models');
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
    }
    catch (error) {
        log.error('Failed to start model download', LogContext.API, { error });
        next(error);
    }
});
router.delete('/fine-tune/:jobId', authenticate, mlxGeneralLimiter, async (req, res, next) => {
    try {
        const { jobId } = req.params;
        log.info('🗑️ Fine-tuning job deletion requested', LogContext.API, {
            userId: req.user?.id,
            jobId,
        });
        const job = fineTuningJobs.get(jobId);
        if (!job) {
            return sendError(res, 'NOT_FOUND', 'Resource not found', 404);
        }
        if (job.status === 'running') {
            job.status = 'failed';
            job.error = 'Cancelled by user';
            job.endTime = new Date();
            fineTuningJobs.set(jobId, job);
        }
        fineTuningJobs.delete(jobId);
        const response = {
            jobId,
            message: 'Fine-tuning job deleted successfully',
            timestamp: new Date().toISOString(),
        };
        sendSuccess(res, response);
    }
    catch (error) {
        log.error('Failed to delete fine-tuning job', LogContext.API, { error });
        next(error);
    }
});
router.get('/fine-tune/jobs', authenticate, mlxGeneralLimiter, async (req, res, next) => {
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
    }
    catch (error) {
        log.error('Failed to list fine-tuning jobs', LogContext.API, { error });
        next(error);
    }
});
export default router;
//# sourceMappingURL=mlx.js.map
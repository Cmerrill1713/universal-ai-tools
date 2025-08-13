import { Router } from 'express';
import { existsSync, mkdirSync } from 'fs';
import multer from 'multer';
import { join, resolve } from 'path';
import { mlxFineTuningService } from '../services/mlx-fine-tuning-service';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
import { safeUnlink, sanitizeFilename, validateFile, validatePath, validatePathBoundary } from '../utils/path-security';
const router = Router();
const ALLOWED_MLX_DIRS = [
    resolve(process.cwd(), 'models'),
    resolve(process.cwd(), 'uploads'),
    resolve(process.cwd(), 'uploads/datasets'),
    resolve(process.cwd(), 'data'),
    resolve(process.cwd(), 'outputs'),
    resolve(process.env.MLX_MODELS_PATH || join(process.cwd(), 'models')),
];
function validateMLXPath(filePath) {
    return validatePath(filePath, {
        maxLength: 1000,
        allowedDirectories: ALLOWED_MLX_DIRS,
        allowSubdirectories: true,
        additionalAllowedChars: ' :'
    });
}
const uploadsPath = ALLOWED_MLX_DIRS.find(dir => dir.includes('uploads/datasets')) ||
    join(process.cwd(), 'uploads', 'datasets');
if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true, mode: 0o755 });
}
if (!ALLOWED_MLX_DIRS.some(dir => resolve(dir) === resolve(uploadsPath))) {
    ALLOWED_MLX_DIRS.push(resolve(uploadsPath));
}
const upload = multer({
    dest: uploadsPath,
    limits: {
        fileSize: 100 * 1024 * 1024,
        files: 1,
        fieldSize: 1024,
        parts: 10,
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.json', '.jsonl', '.csv', '.txt', '.tsv'];
        const allowedMimeTypes = [
            'application/json',
            'application/x-jsonlines',
            'text/csv',
            'text/plain',
            'application/csv',
            'text/x-csv'
        ];
        if (!allowedMimeTypes.some(mime => file.mimetype.includes(mime))) {
            return cb(new Error(`Invalid MIME type: ${file.mimetype}. Only JSON, JSONL, CSV, and TXT files are allowed.`));
        }
        const ext = `.${file.originalname.toLowerCase().split('.').pop()}`;
        if (!allowedTypes.includes(ext)) {
            return cb(new Error(`Invalid file extension: ${ext}. Only ${allowedTypes.join(', ')} files are allowed.`));
        }
        if (!validatePath(file.originalname, {
            maxLength: 255,
            allowedExtensions: allowedTypes,
            additionalAllowedChars: ' -'
        })) {
            return cb(new Error('Invalid filename format'));
        }
        file.originalname = sanitizeFilename(file.originalname, {
            maxLength: 200,
            allowedExtensions: allowedTypes
        });
        cb(null, true);
    },
});
const requireAuth = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    req.userId = userId;
    next();
};
router.use(requireAuth);
router.post('/datasets', upload.single('dataset'), async (req, res) => {
    try {
        const { name, preprocessing_config } = req.body;
        const { userId } = req;
        if (!req.file) {
            return sendError(res, 'VALIDATION_ERROR', 'No dataset file provided');
        }
        if (!name) {
            return sendError(res, 'VALIDATION_ERROR', 'Dataset name is required');
        }
        let preprocessingConfig;
        if (preprocessing_config) {
            try {
                preprocessingConfig = JSON.parse(preprocessing_config);
            }
            catch (error) {
                return sendError(res, 'VALIDATION_ERROR', 'Invalid preprocessing config JSON');
            }
        }
        const uploadedPath = req.file.path;
        if (!validateFile(uploadedPath, {
            maxFileSize: 100 * 1024 * 1024,
            allowedExtensions: ['.json', '.jsonl', '.csv', '.txt', '.tsv'],
            allowedDirectories: ALLOWED_MLX_DIRS,
            mustExist: true
        })) {
            try {
                safeUnlink(uploadedPath, ALLOWED_MLX_DIRS);
            }
            catch (cleanupError) {
                console.warn(`Failed to cleanup invalid uploaded file: ${uploadedPath}`);
            }
            return sendError(res, 'VALIDATION_ERROR', 'Invalid uploaded file');
        }
        if (!validatePathBoundary(uploadedPath, ALLOWED_MLX_DIRS)) {
            try {
                safeUnlink(uploadedPath, ALLOWED_MLX_DIRS);
            }
            catch (cleanupError) {
                console.warn(`Failed to cleanup file outside boundary: ${uploadedPath}`);
            }
            return sendError(res, 'VALIDATION_ERROR', 'File path outside allowed boundaries');
        }
        log.info('📤 Uploading dataset', LogContext.API, {
            name,
            originalName: req.file.originalname,
            size: req.file.size,
            userId,
            secureValidation: true,
        });
        const dataset = await mlxFineTuningService.loadDataset(uploadedPath, name, userId, preprocessingConfig);
        sendSuccess(res, dataset);
    }
    catch (error) {
        log.error('❌ Dataset upload failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Dataset upload failed');
    }
});
router.get('/datasets', async (req, res) => {
    try {
        const { userId } = req;
        sendSuccess(res, []);
    }
    catch (error) {
        log.error('❌ Failed to list datasets', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to list datasets');
    }
});
router.post('/jobs', async (req, res) => {
    try {
        const { job_name, base_model_name, base_model_path, dataset_path, hyperparameters, validation_config, } = req.body;
        const { userId } = req;
        if (!job_name || !base_model_name || !base_model_path || !dataset_path) {
            return sendError(res, 'VALIDATION_ERROR', 'Missing required fields: job_name, base_model_name, base_model_path, dataset_path');
        }
        if (!validateFile(base_model_path, {
            maxFileSize: 50 * 1024 * 1024 * 1024,
            allowedDirectories: ALLOWED_MLX_DIRS,
            allowSubdirectories: true,
            mustExist: true
        })) {
            return sendError(res, 'VALIDATION_ERROR', 'Invalid base model path or file does not exist');
        }
        if (!validateFile(dataset_path, {
            maxFileSize: 1024 * 1024 * 1024,
            allowedExtensions: ['.json', '.jsonl', '.csv', '.txt', '.tsv'],
            allowedDirectories: ALLOWED_MLX_DIRS,
            allowSubdirectories: true,
            mustExist: true
        })) {
            return sendError(res, 'VALIDATION_ERROR', 'Invalid dataset path or file does not exist');
        }
        if (!validatePathBoundary(base_model_path, ALLOWED_MLX_DIRS)) {
            return sendError(res, 'VALIDATION_ERROR', 'Base model path outside allowed directories');
        }
        if (!validatePathBoundary(dataset_path, ALLOWED_MLX_DIRS)) {
            return sendError(res, 'VALIDATION_ERROR', 'Dataset path outside allowed directories');
        }
        log.info('🔒 MLX paths validated successfully', LogContext.API, {
            baseModelPath: base_model_path,
            datasetPath: dataset_path,
            userId,
            secureValidation: true
        });
        log.info('🎯 Creating fine-tuning job', LogContext.API, {
            jobName: job_name,
            baseModel: base_model_name,
            userId,
        });
        const job = await mlxFineTuningService.createFineTuningJob(job_name, userId, base_model_name, base_model_path, dataset_path, hyperparameters, validation_config);
        sendSuccess(res, job);
    }
    catch (error) {
        log.error('❌ Failed to create fine-tuning job', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to create job');
    }
});
router.post('/jobs/:jobId/start', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { userId } = req;
        log.info('▶️ Starting fine-tuning job', LogContext.API, { jobId, userId });
        await mlxFineTuningService.startFineTuningJob(jobId);
        sendSuccess(res, null);
    }
    catch (error) {
        log.error('❌ Failed to start fine-tuning job', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to start job');
    }
});
router.post('/jobs/:jobId/pause', async (req, res) => {
    try {
        const { jobId } = req.params;
        log.info('⏸️ Pausing fine-tuning job', LogContext.API, { jobId });
        await mlxFineTuningService.pauseJob(jobId);
        sendSuccess(res, null);
    }
    catch (error) {
        log.error('❌ Failed to pause fine-tuning job', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to pause job');
    }
});
router.post('/jobs/:jobId/resume', async (req, res) => {
    try {
        const { jobId } = req.params;
        log.info('▶️ Resuming fine-tuning job', LogContext.API, { jobId });
        await mlxFineTuningService.resumeJob(jobId);
        sendSuccess(res, null);
    }
    catch (error) {
        log.error('❌ Failed to resume fine-tuning job', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to resume job');
    }
});
router.post('/jobs/:jobId/cancel', async (req, res) => {
    try {
        const { jobId } = req.params;
        log.info('🛑 Cancelling fine-tuning job', LogContext.API, { jobId });
        await mlxFineTuningService.cancelJob(jobId);
        sendSuccess(res, null);
    }
    catch (error) {
        log.error('❌ Failed to cancel fine-tuning job', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to cancel job');
    }
});
router.get('/jobs', async (req, res) => {
    try {
        const { userId } = req;
        const { status } = req.query;
        const jobs = await mlxFineTuningService.listJobs(userId, status);
        sendSuccess(res, jobs);
    }
    catch (error) {
        log.error('❌ Failed to list jobs', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to list jobs');
    }
});
router.get('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await mlxFineTuningService.getJob(jobId);
        if (!job) {
            return sendError(res, 'NOT_FOUND', 'Job not found');
        }
        sendSuccess(res, job);
    }
    catch (error) {
        log.error('❌ Failed to get job details', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to get job details');
    }
});
router.delete('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        log.info('🗑️ Deleting fine-tuning job', LogContext.API, { jobId });
        await mlxFineTuningService.deleteJob(jobId);
        sendSuccess(res, null);
    }
    catch (error) {
        log.error('❌ Failed to delete fine-tuning job', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to delete job');
    }
});
router.get('/jobs/:jobId/progress', async (req, res) => {
    try {
        const { jobId } = req.params;
        const progress = await mlxFineTuningService.getJobProgress(jobId);
        if (!progress) {
            return sendError(res, 'NOT_FOUND', 'Job progress not found');
        }
        sendSuccess(res, progress);
    }
    catch (error) {
        log.error('❌ Failed to get job progress', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to get job progress');
    }
});
router.get('/jobs/:jobId/metrics', async (req, res) => {
    try {
        const { jobId } = req.params;
        const metrics = await mlxFineTuningService.getJobMetrics(jobId);
        if (!metrics) {
            return sendError(res, 'NOT_FOUND', 'Job metrics not found');
        }
        sendSuccess(res, metrics);
    }
    catch (error) {
        log.error('❌ Failed to get job metrics', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to get job metrics');
    }
});
router.post('/experiments', async (req, res) => {
    try {
        const { experiment_name, base_job_id, optimization_method, parameter_space, max_trials } = req.body;
        const { userId } = req;
        if (!experiment_name || !base_job_id || !optimization_method || !parameter_space) {
            return sendError(res, 'VALIDATION_ERROR', 'Missing required fields: experiment_name, base_job_id, optimization_method, parameter_space');
        }
        log.info('🔬 Starting hyperparameter optimization', LogContext.API, {
            experimentName: experiment_name,
            baseJobId: base_job_id,
            method: optimization_method,
            userId,
        });
        const experiment = await mlxFineTuningService.runHyperparameterOptimization(experiment_name, base_job_id, userId, optimization_method, parameter_space, max_trials || 20);
        sendSuccess(res, experiment);
    }
    catch (error) {
        log.error('❌ Failed to start hyperparameter optimization', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Failed to start optimization');
    }
});
router.post('/jobs/:jobId/evaluate', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { evaluation_type = 'final', evaluation_config } = req.body;
        log.info('📊 Evaluating model', LogContext.API, { jobId, evaluationType: evaluation_type });
        const job = await mlxFineTuningService.getJob(jobId);
        if (!job) {
            return sendError(res, 'NOT_FOUND', 'Job not found');
        }
        if (job.status !== 'completed') {
            return sendError(res, 'VALIDATION_ERROR', 'Job must be completed before evaluation');
        }
        const evaluation = await mlxFineTuningService.evaluateModel(jobId, job.outputModelPath, evaluation_type, evaluation_config);
        sendSuccess(res, evaluation);
    }
    catch (error) {
        log.error('❌ Model evaluation failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Model evaluation failed');
    }
});
router.post('/jobs/:jobId/export', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { export_format = 'mlx', export_path } = req.body;
        const allowedFormats = ['mlx', 'gguf', 'safetensors', 'pytorch', 'tensorflow'];
        if (!allowedFormats.includes(export_format)) {
            return sendError(res, 'VALIDATION_ERROR', `Invalid export format. Allowed: ${allowedFormats.join(', ')}`);
        }
        if (export_path) {
            if (!validatePath(export_path, {
                maxLength: 1000,
                allowedDirectories: ALLOWED_MLX_DIRS,
                allowSubdirectories: true
            })) {
                return sendError(res, 'VALIDATION_ERROR', 'Invalid export path');
            }
            if (!validatePathBoundary(export_path, ALLOWED_MLX_DIRS)) {
                return sendError(res, 'VALIDATION_ERROR', 'Export path outside allowed directories');
            }
        }
        log.info('📦 Exporting model', LogContext.API, { jobId, format: export_format });
        const exportPath = await mlxFineTuningService.exportModel(jobId, export_format, export_path);
        sendSuccess(res, { export_path: exportPath, format: export_format });
    }
    catch (error) {
        log.error('❌ Model export failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Model export failed');
    }
});
router.post('/jobs/:jobId/deploy', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { deployment_name } = req.body;
        log.info('🚀 Deploying model', LogContext.API, { jobId, deploymentName: deployment_name });
        const deploymentId = await mlxFineTuningService.deployModel(jobId, deployment_name);
        sendSuccess(res, { deployment_id: deploymentId });
    }
    catch (error) {
        log.error('❌ Model deployment failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Model deployment failed');
    }
});
router.get('/queue', async (req, res) => {
    try {
        const queueStatus = await mlxFineTuningService.getQueueStatus();
        sendSuccess(res, queueStatus);
    }
    catch (error) {
        log.error('❌ Failed to get queue status', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to get queue status');
    }
});
router.put('/jobs/:jobId/priority', async (req, res) => {
    try {
        const { jobId } = req.params;
        const { priority } = req.body;
        if (typeof priority !== 'number' || priority < 1 || priority > 10) {
            return sendError(res, 'VALIDATION_ERROR', 'Priority must be a number between 1 and 10');
        }
        await mlxFineTuningService.setJobPriority(jobId, priority);
        sendSuccess(res, null);
    }
    catch (error) {
        log.error('❌ Failed to set job priority', LogContext.API, { error });
        return sendError(res, 'INTERNAL_ERROR', 'Failed to set job priority');
    }
});
router.get('/health', async (req, res) => {
    try {
        const health = await mlxFineTuningService.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 206 : 503;
        res.status(statusCode).json(sendSuccess(res, health));
    }
    catch (error) {
        log.error('❌ Health check failed', LogContext.API, { error });
        sendError(res, 'SERVICE_ERROR', 'Health check failed');
    }
});
router.get('/jobs/:jobId/stream', (req, res) => {
    sendSuccess(res, {
        message: 'Real-time streaming available via WebSocket',
        endpoint: '/socket.io',
        events: ['jobProgressUpdated', 'jobMetricsUpdated', 'jobCompleted', 'jobFailed'],
    });
});
router.use((error, req, res, next) => {
    log.error('❌ MLX Fine-tuning API error', LogContext.API, {
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method,
    });
    if (error.message.includes('Unexpected field')) {
        return sendError(res, 'INTERNAL_ERROR', 'Invalid file upload');
    }
    sendError(res, 'INTERNAL_ERROR', 'Internal server error in MLX fine-tuning service');
});
export default router;
//# sourceMappingURL=mlx-fine-tuning.js.map
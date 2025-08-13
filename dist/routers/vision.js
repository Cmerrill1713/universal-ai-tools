import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { zodValidate } from '@/middleware/zod-validate';
import { authenticate } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limiter-enhanced';
import { uploadGuard } from '../middleware/upload-guard';
import { validateRequest } from '../middleware/validation';
import { pyVisionBridge } from '../services/pyvision-bridge';
import { visionResourceManager } from '../services/vision-resource-manager';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
const router = Router();
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
        }
    },
});
const analyzeSchema = z
    .object({
    imagePath: z.string().optional(),
    imageBase64: z.string().optional(),
    options: z
        .object({
        extractText: z.boolean().optional(),
        generateEmbedding: z.boolean().optional(),
        detailed: z.boolean().optional(),
    })
        .optional(),
})
    .refine((data) => data.imagePath || data.imageBase64, {
    message: 'Either imagePath or imageBase64 must be provided',
});
const generateSchema = z.object({
    prompt: z.string().min(1).max(500),
    parameters: z
        .object({
        width: z.number().min(256).max(1024).optional(),
        height: z.number().min(256).max(1024).optional(),
        steps: z.number().min(10).max(50).optional(),
        guidance: z.number().min(1).max(20).optional(),
        seed: z.number().optional(),
        negativePrompt: z.string().max(500).optional(),
    })
        .optional(),
    refine: z
        .object({
        enabled: z.boolean().optional(),
        strength: z.number().min(0.1).max(1.0).optional(),
        steps: z.number().min(10).max(50).optional(),
        guidance: z.number().min(1).max(20).optional(),
        backend: z.enum(['mlx', 'gguf', 'auto']).optional(),
    })
        .optional(),
});
const reasonSchema = z
    .object({
    imagePath: z.string().optional(),
    imageBase64: z.string().optional(),
    question: z.string().min(1).max(500),
})
    .refine((data) => data.imagePath || data.imageBase64, {
    message: 'Either imagePath or imageBase64 must be provided',
});
const embeddingSchema = z
    .object({
    imagePath: z.string().optional(),
    imageBase64: z.string().optional(),
})
    .refine((data) => data.imagePath || data.imageBase64, {
    message: 'Either imagePath or imageBase64 must be provided',
});
const refineSchema = z
    .object({
    imagePath: z.string().optional(),
    imageBase64: z.string().optional(),
    parameters: z
        .object({
        strength: z.number().min(0.1).max(1.0).optional(),
        steps: z.number().min(10).max(50).optional(),
        guidance: z.number().min(1).max(20).optional(),
        backend: z.enum(['mlx', 'gguf', 'auto']).optional(),
    })
        .optional(),
})
    .refine((data) => data.imagePath || data.imageBase64, {
    message: 'Either imagePath or imageBase64 must be provided',
});
const visionRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
});
const generationRateLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    maxRequests: 5,
});
const refinementRateLimiter = createRateLimiter({
    windowMs: 3 * 60 * 1000,
    maxRequests: 8,
});
router.post('/analyze', visionRateLimiter, upload.single('image'), uploadGuard({ maxSize: 10 * 1024 * 1024 }), zodValidate(analyzeSchema), async (req, res, next) => {
    try {
        const startTime = Date.now();
        let imageData;
        if (req.file) {
            imageData = req.file.buffer;
        }
        else if (req.body.imageBase64) {
            imageData = req.body.imageBase64;
        }
        else if (req.body.imagePath) {
            imageData = req.body.imagePath;
        }
        else {
            return sendError(res, 'VALIDATION_ERROR', 'No image provided', 400);
        }
        log.info('📸 Processing vision analysis request', LogContext.API, {
            hasFile: !!req.file,
            options: req.body.options,
        });
        const result = await pyVisionBridge.analyzeImage(imageData, req.body.options);
        if (!result.success) {
            return sendError(res, 'ANALYSIS_ERROR', result.error || 'Analysis failed', 500);
        }
        let embedding = null;
        if (req.body.options?.generateEmbedding) {
            const embeddingResult = await pyVisionBridge.generateEmbedding(imageData);
            if (embeddingResult.success) {
                embedding = embeddingResult.data;
            }
        }
        const response = {
            analysis: result.data,
            embedding,
            processingTime: Date.now() - startTime,
            cached: result.cached || false,
        };
        sendSuccess(res, response, 200);
    }
    catch {
        log.error('Failed to analyze image', LogContext.API);
        next();
    }
});
router.post('/generate', generationRateLimiter, zodValidate(generateSchema), async (req, res, next) => {
    try {
        const { prompt, parameters, refine } = req.body;
        log.info('🎨 Processing image generation request', LogContext.API, {
            userId: req.user?.id,
            prompt: `${prompt.substring(0, 50)}...`,
            parameters,
            refineEnabled: refine?.enabled,
        });
        const result = await pyVisionBridge.generateImage(prompt, parameters);
        if (!result.success) {
            return sendError(res, 'GENERATION_ERROR', result.error || 'Generation failed', 500);
        }
        const responseData = result.data;
        let refinementResult = null;
        if (refine?.enabled && result.data?.base64) {
            try {
                log.info('🎨 Applying auto-refinement to generated image', LogContext.API, {
                    userId: req.user?.id,
                    refineParams: refine,
                });
                const refinement = await pyVisionBridge.refineImage(result.data.base64, {
                    strength: refine.strength || 0.3,
                    steps: refine.steps || 20,
                    guidance: refine.guidance || 7.5,
                    backend: refine.backend || 'auto',
                });
                if (refinement.success) {
                    refinementResult = refinement.data;
                    responseData.refinement_applied = true;
                }
            }
            catch (refineError) {
                log.warn('Auto-refinement failed, continuing with original', LogContext.API, {
                    error: refineError,
                });
            }
        }
        const response = {
            generation: responseData,
            refinement: refinementResult,
            processing_pipeline: refine?.enabled ? 'generate+refine' : 'generate',
        };
        sendSuccess(res, response, 200);
    }
    catch {
        log.error('Failed to generate image', LogContext.API);
        next();
    }
});
router.post('/refine', authenticate, refinementRateLimiter, zodValidate(refineSchema), upload.single('image'), uploadGuard({ maxSize: 10 * 1024 * 1024 }), async (req, res, next) => {
    try {
        const { parameters } = req.body;
        let imageData;
        if (req.file) {
            imageData = req.file.buffer;
        }
        else if (req.body.imageBase64) {
            imageData = req.body.imageBase64;
        }
        else if (req.body.imagePath) {
            imageData = req.body.imagePath;
        }
        else {
            return sendError(res, 'VALIDATION_ERROR', 'No image provided', 400);
        }
        log.info('🎨 Processing image refinement request', LogContext.API, {
            userId: req.user?.id,
            hasFile: !!req.file,
            parameters,
        });
        const result = await pyVisionBridge.refineImage(imageData, parameters);
        if (!result.success) {
            return sendError(res, 'REFINEMENT_ERROR', result.error || 'Refinement failed', 500);
        }
        const response = {
            refinement: result.data,
            processingTime: result.processingTime,
            model: result.model,
            cached: result.cached || false,
        };
        sendSuccess(res, response, 200);
    }
    catch {
        log.error('Failed to refine image', LogContext.API);
        next();
    }
});
router.post('/embed', authenticate, visionRateLimiter, zodValidate(embeddingSchema), upload.single('image'), uploadGuard({ maxSize: 10 * 1024 * 1024 }), async (req, res, next) => {
    try {
        let imageData;
        if (req.file) {
            imageData = req.file.buffer;
        }
        else if (req.body.imageBase64) {
            imageData = req.body.imageBase64;
        }
        else if (req.body.imagePath) {
            imageData = req.body.imagePath;
        }
        else {
            return sendError(res, 'VALIDATION_ERROR', 'No image provided', 400);
        }
        log.info('🔢 Generating image embedding', LogContext.API, {
            userId: req.user?.id,
            hasFile: !!req.file,
        });
        const result = await pyVisionBridge.generateEmbedding(imageData);
        if (!result.success) {
            return sendError(res, 'EMBEDDING_ERROR', result.error || 'Embedding generation failed', 500);
        }
        sendSuccess(res, result.data, 200);
    }
    catch {
        log.error('Failed to generate embedding', LogContext.API);
        next();
    }
});
router.post('/reason', authenticate, visionRateLimiter, validateRequest(reasonSchema), upload.single('image'), uploadGuard({ maxSize: 10 * 1024 * 1024 }), async (req, res, next) => {
    try {
        const { question } = req.body;
        let imageData;
        if (req.file) {
            imageData = req.file.buffer;
        }
        else if (req.body.imageBase64) {
            imageData = req.body.imageBase64;
        }
        else if (req.body.imagePath) {
            imageData = req.body.imagePath;
        }
        else {
            return sendError(res, 'VALIDATION_ERROR', 'No image provided', 400);
        }
        log.info('🤔 Processing visual reasoning request', LogContext.API, {
            userId: req.user?.id,
            question: `${question.substring(0, 50)}...`,
        });
        const result = await pyVisionBridge.reason(imageData, question);
        if (!result.success) {
            return sendError(res, 'ANALYSIS_ERROR', result.error || 'Reasoning failed', 500);
        }
        sendSuccess(res, result.data, 200);
    }
    catch {
        log.error('Failed to perform visual reasoning', LogContext.API);
        next();
    }
});
router.post('/batch/analyze', authenticate, createRateLimiter({
    windowMs: 5 * 60 * 1000,
    maxRequests: 3,
}), upload.array('images', 10), async (req, res, next) => {
    try {
        const files = req.files;
        if (files) {
            for (const f of files) {
                req.file = f;
                const guard = uploadGuard({ maxSize: 10 * 1024 * 1024 });
                await new Promise((resolve, reject) => guard(req, res, (err) => (err ? reject(err) : resolve())));
            }
            req.file = undefined;
        }
        if (!files || files.length === 0) {
            return sendError(res, 'VALIDATION_ERROR', 'No images provided', 400);
        }
        log.info('📦 Processing batch vision analysis', LogContext.API, {
            userId: req.user?.id,
            imageCount: files.length,
        });
        const imageDatas = files.map((file) => file.buffer);
        const results = await pyVisionBridge.analyzeBatch(imageDatas.map((buffer) => buffer.toString('base64')), req.body.options);
        const successCount = results.filter((r) => r.success).length;
        sendSuccess(res, { results, successCount, totalCount: files.length }, 200);
    }
    catch {
        log.error('Failed to batch analyze images', LogContext.API);
        next();
    }
});
router.get('/status', authenticate, async (req, res, next) => {
    try {
        const bridgeMetrics = pyVisionBridge.getMetrics();
        const gpuMetrics = visionResourceManager.getGPUMetrics();
        const loadedModels = visionResourceManager.getLoadedModels();
        const status = {
            service: {
                initialized: bridgeMetrics.isInitialized,
                uptime: process.uptime(),
            },
            metrics: {
                bridge: bridgeMetrics,
                gpu: gpuMetrics,
            },
            models: {
                loaded: loadedModels,
                available: ['yolo-v8n', 'clip-vit-b32', 'sd3b', 'sdxl-refiner'],
            },
        };
        sendSuccess(res, status, 200);
    }
    catch {
        log.error('Failed to get vision status', LogContext.API);
        next();
    }
});
router.post('/models/preload', authenticate, async (req, res, next) => {
    try {
        const { models } = req.body;
        if (!Array.isArray(models)) {
            return sendError(res, 'VALIDATION_ERROR', 'Models must be an array', 400);
        }
        log.info('📥 Preloading vision models', LogContext.API, {
            userId: req.user?.id,
            models,
        });
        await visionResourceManager.preloadModels(models);
        sendSuccess(res, { preloaded: models }, 200);
    }
    catch {
        log.error('Failed to preload models', LogContext.API);
        next();
    }
});
router.get('/', async (req, res) => {
    try {
        const endpoints = {
            analyze: 'POST /api/v1/vision/analyze - Analyze images using YOLO and CLIP',
            reason: 'POST /api/v1/vision/reason - Visual reasoning and Q&A',
            embedding: 'POST /api/v1/vision/embedding - Generate image embeddings',
            refine: 'POST /api/v1/vision/refine - Refine and enhance images',
            generate: 'POST /api/v1/vision/generate - Generate images from text',
            status: 'GET /api/v1/vision/status - Get vision service status',
            preload: 'POST /api/v1/vision/models/preload - Preload models'
        };
        sendSuccess(res, {
            service: 'Universal AI Tools - Vision API',
            version: '1.0.0',
            status: 'operational',
            endpoints,
            capabilities: [
                'Image analysis and object detection',
                'Visual reasoning and Q&A',
                'Image embedding generation',
                'Image refinement and enhancement',
                'Text-to-image generation',
                'Multi-modal understanding'
            ]
        });
    }
    catch (error) {
        sendError(res, 'SERVICE_ERROR', 'Failed to get vision API info', 500);
    }
});
export default router;
//# sourceMappingURL=vision.js.map
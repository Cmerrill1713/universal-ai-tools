import { Router } from 'express';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
const router = Router();
router.get('/status', async (req, res) => {
    try {
        const visionStatus = {
            service: {
                initialized: false,
                uptime: process.uptime(),
            },
            python: {
                available: false,
                models: [],
            },
            gpu: {
                available: false,
                memory: '0GB',
            },
        };
        try {
            const { pyVisionBridge } = await import('../services/pyvision-bridge');
            const metrics = pyVisionBridge.getMetrics();
            visionStatus.service.initialized = metrics.isInitialized;
            visionStatus.python.models = metrics.modelsLoaded;
        }
        catch (error) {
            log.warn('PyVision bridge not available', LogContext.API, { error });
        }
        try {
            const { visionResourceManager } = await import('../services/vision-resource-manager');
            const gpuMetrics = visionResourceManager.getGPUMetrics();
            visionStatus.gpu.available = true;
            visionStatus.gpu.memory = `${gpuMetrics.usedVRAM}/${gpuMetrics.totalVRAM}GB`;
        }
        catch (error) {
            log.warn('Vision resource manager not available', LogContext.API, { error });
        }
        sendSuccess(res, visionStatus);
    }
    catch (error) {
        log.error('Vision status check failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Vision status check failed', 500);
    }
});
router.post('/analyze', async (req, res) => {
    try {
        const { imagePath, imageBase64 } = req.body;
        if (!imagePath && !imageBase64) {
            return sendError(res, 'VALIDATION_ERROR', 'Either imagePath or imageBase64 must be provided', 400);
        }
        log.info('📸 Processing vision analysis request', LogContext.API, {
            hasPath: !!imagePath,
            hasBase64: !!imageBase64,
        });
        try {
            const { pyVisionBridge } = await import('../services/pyvision-bridge');
            const imageData = imagePath || imageBase64;
            const result = await pyVisionBridge.analyzeImage(imageData, {});
            if (!result.success) {
                return sendError(res, 'ANALYSIS_ERROR', result.error || 'Analysis failed', 500);
            }
            sendSuccess(res, {
                analysis: result.data,
                processingTime: result.processingTime,
                cached: result.cached || false,
            });
        }
        catch (importError) {
            log.warn('PyVision not available, using mock response', LogContext.API);
            sendSuccess(res, {
                analysis: {
                    objects: [
                        {
                            class: 'mock_object',
                            confidence: 0.95,
                            bbox: { x: 10, y: 10, width: 100, height: 100 },
                        },
                    ],
                    scene: {
                        description: 'Mock scene analysis - PyVision not available',
                        tags: ['mock', 'test'],
                        mood: 'neutral',
                    },
                    text: [],
                    confidence: 0.9,
                    processingTimeMs: 100,
                },
                processingTime: 100,
                cached: false,
                mock: true,
            });
        }
    }
    catch (error) {
        log.error('Vision analysis failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Analysis failed', 500);
    }
});
router.post('/generate', async (req, res) => {
    try {
        const { prompt, parameters = {} } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            return sendError(res, 'VALIDATION_ERROR', 'Prompt is required', 400);
        }
        log.info('🎨 Processing image generation request', LogContext.API, {
            prompt: `${prompt.substring(0, 50)}...`,
            parameters,
        });
        try {
            const { pyVisionBridge } = await import('../services/pyvision-bridge');
            const result = await pyVisionBridge.generateImage(prompt, parameters);
            if (!result.success) {
                return sendError(res, 'GENERATION_ERROR', result.error || 'Generation failed', 500);
            }
            sendSuccess(res, result.data);
        }
        catch (importError) {
            log.warn('PyVision not available for generation', LogContext.API);
            sendSuccess(res, {
                id: `mock_gen_${Date.now()}`,
                base64: 'mock_base64_image_data',
                prompt,
                model: 'mock_sd3b',
                parameters: {
                    width: parameters.width || 512,
                    height: parameters.height || 512,
                    steps: parameters.steps || 20,
                    guidance: parameters.guidance || 7.5,
                },
                quality: {
                    clipScore: 0.85,
                    aestheticScore: 0.8,
                    safetyScore: 0.95,
                    promptAlignment: 0.9,
                },
                timestamp: new Date().toISOString(),
                mock: true,
            });
        }
    }
    catch (error) {
        log.error('Vision generation failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Generation failed', 500);
    }
});
router.post('/embed', async (req, res) => {
    try {
        const { imagePath, imageBase64 } = req.body;
        if (!imagePath && !imageBase64) {
            return sendError(res, 'VALIDATION_ERROR', 'Either imagePath or imageBase64 must be provided', 400);
        }
        log.info('🔢 Generating image embedding', LogContext.API, {
            hasPath: !!imagePath,
            hasBase64: !!imageBase64,
        });
        try {
            const { pyVisionBridge } = await import('../services/pyvision-bridge');
            const imageData = imagePath || imageBase64;
            const result = await pyVisionBridge.generateEmbedding(imageData);
            if (!result.success) {
                return sendError(res, 'EMBEDDING_ERROR', result.error || 'Embedding generation failed', 500);
            }
            sendSuccess(res, result.data);
        }
        catch (importError) {
            log.warn('PyVision not available for embedding', LogContext.API);
            sendSuccess(res, {
                vector: new Array(512).fill(0.1),
                model: 'mock_clip_vit_b32',
                dimension: 512,
                mock: true,
            });
        }
    }
    catch (error) {
        log.error('Vision embedding failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Embedding generation failed', 500);
    }
});
router.get('/health', async (req, res) => {
    try {
        let pyVisionAvailable = false;
        let resourceManagerAvailable = false;
        try {
            const { pyVisionBridge } = await import('../services/pyvision-bridge');
            pyVisionAvailable = true;
        }
        catch (error) {
        }
        try {
            const { visionResourceManager } = await import('../services/vision-resource-manager');
            resourceManagerAvailable = true;
        }
        catch (error) {
        }
        const health = pyVisionAvailable && resourceManagerAvailable ? 'healthy' : 'degraded';
        sendSuccess(res, {
            status: health,
            services: {
                pyVision: pyVisionAvailable,
                resourceManager: resourceManagerAvailable,
            },
            timestamp: Date.now(),
        });
    }
    catch (error) {
        log.error('Vision health check failed', LogContext.API, { error });
        sendError(res, 'INTERNAL_ERROR', 'Health check failed', 500);
    }
});
export default router;
//# sourceMappingURL=vision-simple.js.map
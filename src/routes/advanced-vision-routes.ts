/**
 * Advanced Vision Routes - 2025 SOTA Integration
 * API endpoints for next-generation vision analysis with intelligent model routing
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { advancedVisionService } from '../services/advanced-vision-service';
import { LogContext, log } from '../utils/logger';
import { sendError, sendSuccess } from '../utils/api-response';
import { createRateLimiter } from '../middleware/rate-limiter-enhanced';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = '/tmp/advanced-vision-uploads';
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = path.extname(file.originalname);
    cb(null, `${timestamp}-${random}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max for high-quality images
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, BMP, and TIFF images are allowed.'));
    }
  }
});

// Rate limiting for advanced vision endpoints
const visionRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute (more generous for advanced features)
  message: 'Too many advanced vision requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const analyzeRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  analysisType: z.enum(['fast', 'balanced', 'detailed', 'expert']).default('balanced'),
  maxTokens: z.number().min(50).max(8192).optional(),
  temperature: z.number().min(0).max(1).optional(),
  preferredModel: z.enum(['qwen2vl', 'internvl3', 'fastvlm', 'convnext', 'auto']).optional()
});

const urlAnalyzeSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().min(1).max(2000),
  analysisType: z.enum(['fast', 'balanced', 'detailed', 'expert']).default('balanced'),
  maxTokens: z.number().min(50).max(8192).optional(),
  temperature: z.number().min(0).max(1).optional(),
  preferredModel: z.enum(['qwen2vl', 'internvl3', 'fastvlm', 'convnext', 'auto']).optional()
});

/**
 * POST /api/v1/advanced-vision/analyze
 * Analyze uploaded image with intelligent model selection
 */
router.post('/analyze', visionRateLimit, upload.single('image'), async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return sendError(res, 'No image file provided', 400);
    }

    // Validate request body
    const validation = analyzeRequestSchema.safeParse(req.body);
    if (!validation.success) {
      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {});
      return sendError(res, 'Invalid request parameters', 400, validation.error.issues);
    }

    const { prompt, analysisType, maxTokens, temperature, preferredModel } = validation.data;

    log.info('🔍 Advanced vision analysis request', LogContext.AI, {
      filename: req.file.filename,
      size: req.file.size,
      analysisType,
      preferredModel: preferredModel || 'auto'
    });

    // Prepare analysis request
    const analysisRequest = {
      imagePath: req.file.path,
      prompt,
      analysisType,
      maxTokens,
      temperature,
      preferredModel
    };

    // Perform analysis
    const result = await advancedVisionService.analyzeImage(analysisRequest);

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch((error) => {
      log.warn('Failed to clean up uploaded file', LogContext.AI, { 
        filePath: req.file?.path,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    // Return comprehensive analysis result
    const response = {
      ...result,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      analysisType,
      requestId: `av_${Date.now()}_${Math.random().toString(36).substring(7)}`
    };

    log.info('✅ Advanced vision analysis completed', LogContext.AI, {
      modelUsed: result.modelUsed,
      responseTime: result.metadata.responseTime,
      processingTime: response.processingTime,
      success: result.success,
      tokensGenerated: result.metadata.tokensGenerated
    });

    if (result.success) {
      return sendSuccess(res, response, 'Advanced vision analysis completed successfully');
    } else {
      return sendError(res, result.error || 'Vision analysis failed', 500, { details: response });
    }

  } catch (error) {
    log.error('❌ Advanced vision analysis error', LogContext.AI, { 
      error: error instanceof Error ? error.message : String(error) 
    });

    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    return sendError(res, 'Internal server error during vision analysis', 500);
  }
});

/**
 * POST /api/v1/advanced-vision/analyze-url
 * Analyze image from URL with intelligent model selection
 */
router.post('/analyze-url', visionRateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Validate request body
    const validation = urlAnalyzeSchema.safeParse(req.body);
    if (!validation.success) {
      return sendError(res, 'Invalid request parameters', 400, validation.error.issues);
    }

    const { imageUrl, prompt, analysisType, maxTokens, temperature, preferredModel } = validation.data;

    log.info('🌐 Advanced vision URL analysis request', LogContext.AI, {
      imageUrl: imageUrl.substring(0, 100) + '...',
      analysisType,
      preferredModel: preferredModel || 'auto'
    });

    // Prepare analysis request
    const analysisRequest = {
      imageUrl,
      prompt,
      analysisType,
      maxTokens,
      temperature,
      preferredModel
    };

    // Perform analysis
    const result = await advancedVisionService.analyzeImage(analysisRequest);

    // Return comprehensive analysis result
    const response = {
      ...result,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      analysisType,
      requestId: `av_url_${Date.now()}_${Math.random().toString(36).substring(7)}`
    };

    log.info('✅ Advanced vision URL analysis completed', LogContext.AI, {
      modelUsed: result.modelUsed,
      responseTime: result.metadata.responseTime,
      processingTime: response.processingTime,
      success: result.success,
      tokensGenerated: result.metadata.tokensGenerated
    });

    if (result.success) {
      return sendSuccess(res, response, 'Advanced vision URL analysis completed successfully');
    } else {
      return sendError(res, result.error || 'Vision analysis failed', 500, { details: response });
    }

  } catch (error) {
    log.error('❌ Advanced vision URL analysis error', LogContext.AI, { 
      error: error instanceof Error ? error.message : String(error) 
    });

    return sendError(res, 'Internal server error during vision analysis', 500);
  }
});

/**
 * GET /api/v1/advanced-vision/health
 * Get service health and available models
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await advancedVisionService.getServiceHealth();
    
    const response = {
      service: 'Advanced Vision Service',
      version: '2025 SOTA',
      timestamp: new Date().toISOString(),
      ...health,
      capabilities: {
        supportedFormats: ['JPEG', 'PNG', 'WebP', 'BMP', 'TIFF'],
        maxFileSize: '50MB',
        analysisTypes: ['fast', 'balanced', 'detailed', 'expert'],
        features: [
          'intelligent_model_routing',
          'performance_optimization',
          'fallback_handling',
          'multi_model_ensemble',
          'apple_silicon_optimization'
        ]
      }
    };

    log.info('📊 Advanced vision health check', LogContext.AI, {
      healthy: health.healthy,
      availableModels: health.availableModels,
      recommendedModel: health.recommendedModel
    });

    return sendSuccess(res, response, 'Advanced vision service health check');

  } catch (error) {
    log.error('❌ Advanced vision health check failed', LogContext.AI, { 
      error: error instanceof Error ? error.message : String(error) 
    });

    return sendError(res, 'Health check failed', 500);
  }
});

/**
 * GET /api/v1/advanced-vision/models
 * Get detailed information about available models and their capabilities
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const health = await advancedVisionService.getServiceHealth();
    
    // Detailed model information
    const modelDetails = {
      'qwen2vl': {
        name: 'Qwen2-VL-7B',
        description: 'Balanced performance vision-language model',
        strengths: ['Multilingual support', 'Code understanding', 'Balanced speed/quality'],
        benchmarkScore: 85.5,
        memoryRequirement: '29GB',
        avgResponseTime: '8-12 seconds',
        bestFor: ['General vision tasks', 'Document analysis', 'Multilingual content']
      },
      'internvl3': {
        name: 'InternVL3-78B',
        description: 'State-of-the-art open-source vision model',
        strengths: ['Highest accuracy', 'Complex reasoning', 'Detailed analysis'],
        benchmarkScore: 72.2,
        memoryRequirement: '78GB',
        avgResponseTime: '20-30 seconds',
        bestFor: ['Research tasks', 'Academic analysis', 'Complex reasoning']
      },
      'fastvlm': {
        name: 'Apple FastVLM 7B',
        description: 'Apple Silicon optimized vision model',
        strengths: ['Apple Silicon optimization', 'Fast inference', 'Efficient'],
        benchmarkScore: 68.3,
        memoryRequirement: '5GB',
        avgResponseTime: '10-20 seconds',
        bestFor: ['Real-time analysis', 'Mobile deployment', 'Quick queries']
      },
      'convnext': {
        name: 'ConvNeXt',
        description: 'Efficient CNN for classification tasks',
        strengths: ['Ultra-fast inference', 'Efficient', 'Classification focused'],
        benchmarkScore: 65.0,
        memoryRequirement: '2GB',
        avgResponseTime: '1-3 seconds',
        bestFor: ['Image classification', 'Object detection', 'Simple tasks']
      }
    };

    const response = {
      availableModels: health.availableModels,
      recommendedModel: health.recommendedModel,
      performanceMetrics: health.performanceMetrics,
      modelDetails: Object.fromEntries(
        health.availableModels.map(model => [model, modelDetails[model as keyof typeof modelDetails]])
      ),
      selectionCriteria: {
        fast: 'Optimizes for speed (ConvNeXt → FastVLM → Qwen2-VL)',
        balanced: 'Balances speed and quality (Qwen2-VL → FastVLM → InternVL3)',
        detailed: 'Optimizes for accuracy (InternVL3 → Qwen2-VL → FastVLM)',
        expert: 'Maximum quality for research (InternVL3 → Qwen2-VL → FastVLM)'
      }
    };

    return sendSuccess(res, response, 'Advanced vision models information');

  } catch (error) {
    log.error('❌ Failed to get models information', LogContext.AI, { 
      error: error instanceof Error ? error.message : String(error) 
    });

    return sendError(res, 'Failed to get models information', 500);
  }
});

/**
 * POST /api/v1/advanced-vision/install-model
 * Install a new vision model
 */
router.post('/install-model', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.body;
    
    if (!modelName || !['qwen2vl', 'internvl3'].includes(modelName)) {
      return sendError(res, 'Invalid model name. Supported: qwen2vl, internvl3', 400);
    }

    log.info('📥 Model installation request', LogContext.AI, { modelName });

    // Start model installation (async process)
    advancedVisionService.installModel(modelName).catch(error => {
      log.error('❌ Model installation failed', LogContext.AI, { modelName, error });
    });

    const response = {
      message: `Model installation started: ${modelName}`,
      modelName,
      estimatedTime: modelName === 'internvl3' ? '30-60 minutes' : '15-30 minutes',
      status: 'queued',
      timestamp: new Date().toISOString()
    };

    return sendSuccess(res, response, 'Model installation queued');

  } catch (error) {
    log.error('❌ Model installation request failed', LogContext.AI, { 
      error: error instanceof Error ? error.message : String(error) 
    });

    return sendError(res, 'Failed to queue model installation', 500);
  }
});

/**
 * Error handling middleware for multer
 */
router.use((error: any, req: Request, res: Response, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'File too large. Maximum size is 50MB', 400);
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return sendError(res, 'Too many files. Upload one image at a time', 400);
    }
  }
  
  if (error.message && error.message.includes('Invalid file type')) {
    return sendError(res, error.message, 400);
  }
  
  next(error);
});

export default router;
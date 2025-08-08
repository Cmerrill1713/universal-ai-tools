/**
 * Vision Router
 * API endpoints for image analysis, generation, and visual reasoning
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { pyVisionBridge } from '../services/pyvision-bridge';
import { visionResourceManager } from '../services/vision-resource-manager';
import { LogContext, log } from '../utils/logger';
import { sendError, sendSuccess } from '../utils/api-response';
import { createRateLimiter } from '../middleware/rate-limiter-enhanced';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

// Validation schemas
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

// Custom rate limiter for vision endpoints (based on compute cost)
const visionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute for analysis
});

const generationRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5, // 5 generations per 5 minutes
});

const refinementRateLimiter = createRateLimiter({
  windowMs: 3 * 60 * 1000, // 3 minutes
  maxRequests: 8, // 8 refinements per 3 minutes
});

/**
 * @route POST /api/v1/vision/analyze
 * @description Analyze an image using YOLO and CLIP
 */
router.post(
  '/analyze',
  visionRateLimiter,
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    // Validate request
    try {
      analyzeSchema.parse(req.body);
    } catch (error) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid request parameters', 400);
    }
    try {
      const startTime = Date.now();

      // Get image data from request
      let imageData: string | Buffer;
      if (req.file) {
        imageData = req.file.buffer;
      } else if (req.body.imageBase64) {
        imageData = req.body.imageBase64;
      } else if (req.body.imagePath) {
        imageData = req.body.imagePath;
      } else {
        return sendError(res, 'VALIDATION_ERROR', 'No image provided', 400);
      }

      log.info('📸 Processing vision analysis request', LogContext.API, {
        hasFile: !!req.file,
        options: req.body.options,
      });

      // Analyze image
      const result = await pyVisionBridge.analyzeImage(imageData, req.body.options);

      if (!result.success) {
        return sendError(res, 'ANALYSIS_ERROR', result.error || 'Analysis failed', 500);
      }

      // Generate embedding if requested
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
    } catch (error) {
      log.error('Failed to analyze image', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/vision/generate
 * @description Generate an image using Stable Diffusion 3B
 */
router.post(
  '/generate',
  generationRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    // Validate request
    try {
      generateSchema.parse(req.body);
    } catch (error) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid request parameters', 400);
    }
    try {
      const { prompt, parameters, refine } = req.body;

      log.info('🎨 Processing image generation request', LogContext.API, {
        userId: req.user?.id,
        prompt: `${prompt.substring(0, 50)}...`,
        parameters,
        refineEnabled: refine?.enabled,
      });

      // Check user's generation quota (implement based on your needs)
      // const quota = await checkUserGenerationQuota(req.user?.id);
      // if (!quota.allowed) {
      //   return sendError(res, 'QUOTA_EXCEEDED', 'Generation quota exceeded', 429);
      // }

      // Generate image
      const result = await pyVisionBridge.generateImage(prompt, parameters);

      if (!result.success) {
        return sendError(res, 'GENERATION_ERROR', result.error || 'Generation failed', 500);
      }

      const responseData = result.data;
      let refinementResult = null;

      // Apply refinement if requested
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
            // Optionally replace the original with refined version
            (responseData as any).refinement_applied = true;
          }
        } catch (refineError) {
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
    } catch (error) {
      log.error('Failed to generate image', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/vision/refine
 * @description Refine an image using SDXL Refiner with MLX optimization
 */
router.post(
  '/refine',
  authenticate,
  refinementRateLimiter,
  validateRequest(refineSchema),
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parameters } = req.body;

      // Get image data from request
      let imageData: string | Buffer;
      if (req.file) {
        imageData = req.file.buffer;
      } else if (req.body.imageBase64) {
        imageData = req.body.imageBase64;
      } else if (req.body.imagePath) {
        imageData = req.body.imagePath;
      } else {
        return sendError(res, 'VALIDATION_ERROR', 'No image provided', 400);
      }

      log.info('🎨 Processing image refinement request', LogContext.API, {
        userId: req.user?.id,
        hasFile: !!req.file,
        parameters,
      });

      // Refine image
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
    } catch (error) {
      log.error('Failed to refine image', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/vision/embed
 * @description Generate CLIP embeddings for an image
 */
router.post(
  '/embed',
  authenticate,
  visionRateLimiter,
  validateRequest(embeddingSchema),
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get image data from request
      let imageData: string | Buffer;
      if (req.file) {
        imageData = req.file.buffer;
      } else if (req.body.imageBase64) {
        imageData = req.body.imageBase64;
      } else if (req.body.imagePath) {
        imageData = req.body.imagePath;
      } else {
        return sendError(res, 'VALIDATION_ERROR', 'No image provided', 400);
      }

      log.info('🔢 Generating image embedding', LogContext.API, {
        userId: req.user?.id,
        hasFile: !!req.file,
      });

      // Generate embedding
      const result = await pyVisionBridge.generateEmbedding(imageData);

      if (!result.success) {
        return sendError(
          res,
          'EMBEDDING_ERROR',
          result.error || 'Embedding generation failed',
          500
        );
      }

      sendSuccess(res, result.data, 200);
    } catch (error) {
      log.error('Failed to generate embedding', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/vision/reason
 * @description Perform visual reasoning on an image with a question
 */
router.post(
  '/reason',
  authenticate,
  visionRateLimiter,
  validateRequest(reasonSchema),
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question } = req.body;

      // Get image data from request
      let imageData: string | Buffer;
      if (req.file) {
        imageData = req.file.buffer;
      } else if (req.body.imageBase64) {
        imageData = req.body.imageBase64;
      } else if (req.body.imagePath) {
        imageData = req.body.imagePath;
      } else {
        return sendError(res, 'VALIDATION_ERROR', 'No image provided', 400);
      }

      log.info('🤔 Processing visual reasoning request', LogContext.API, {
        userId: req.user?.id,
        question: `${question.substring(0, 50)}...`,
      });

      // Perform visual reasoning
      const result = await pyVisionBridge.reason(imageData, question);

      if (!result.success) {
        return sendError(res, 'ANALYSIS_ERROR', result.error || 'Reasoning failed', 500);
      }

      sendSuccess(res, result.data, 200);
    } catch (error) {
      log.error('Failed to perform visual reasoning', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/vision/batch/analyze
 * @description Batch analyze multiple images
 */
router.post(
  '/batch/analyze',
  authenticate,
  createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3, // 3 batch requests per 5 minutes
  }),
  upload.array('images', 10), // Max 10 images
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return sendError(res, 'VALIDATION_ERROR', 'No images provided', 400);
      }

      log.info('📦 Processing batch vision analysis', LogContext.API, {
        userId: req.user?.id,
        imageCount: files.length,
      });

      // Process images in batch
      const imageDatas = files.map((file) => file.buffer);
      const results = await pyVisionBridge.analyzeBatch(
        imageDatas.map((buffer) => buffer.toString('base64')),
        req.body.options
      );

      const successCount = results.filter((r: any) => r.success).length;

      sendSuccess(res, { results, successCount, totalCount: files.length }, 200);
    } catch (error) {
      log.error('Failed to batch analyze images', LogContext.API, { error });
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/vision/status
 * @description Get vision service status and metrics
 */
router.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (error) {
    log.error('Failed to get vision status', LogContext.API, { error });
    next(error);
  }
});

/**
 * @route POST /api/v1/vision/models/preload
 * @description Preload specific models for better performance
 */
router.post(
  '/models/preload',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
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
    } catch (error) {
      log.error('Failed to preload models', LogContext.API, { error });
      next(error);
    }
  }
);

export default router;

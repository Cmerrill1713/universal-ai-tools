/**
 * Apple FastVLM API Routes
 * Enhanced vision-language processing with Apple's 2025 CVPR model
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fastVLMService } from '../services/fastvlm-service';

const router = Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/uploads',
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * POST /api/fastvlm/analyze - Analyze image with vision-language model
 */
router.post('/analyze', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    const { prompt, maxTokens, temperature } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    const analysisRequest = {
      imagePath: req.file.path,
      prompt: prompt,
      maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
    };

    const startTime = Date.now();
    const result = await fastVLMService.analyzeImage(analysisRequest);

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded file:', cleanupError);
    }

    res.json({
      ...result,
      processingTime: Date.now() - startTime,
    });
  } catch (error) {
    console.error('FastVLM analysis error:', error);

    // Clean up file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file on error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

/**
 * POST /api/fastvlm/analyze-url - Analyze image from URL
 */
router.post('/analyze-url', async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt, maxTokens, temperature } = req.body;

    if (!imageUrl || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Image URL and prompt are required',
      });
    }

    // Download image from URL
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const tempPath = `/tmp/fastvlm-${Date.now()}.jpg`;
    await fs.writeFile(tempPath, Buffer.from(buffer));

    try {
      const analysisRequest = {
        imagePath: tempPath,
        prompt: prompt,
        maxTokens: maxTokens ? parseInt(maxTokens) : undefined,
        temperature: temperature ? parseFloat(temperature) : undefined,
      };

      const startTime = Date.now();
      const result = await fastVLMService.analyzeImage(analysisRequest);

      res.json({
        ...result,
        processingTime: Date.now() - startTime,
      });
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        console.warn('Failed to clean up temp file:', cleanupError);
      }
    }
  } catch (error) {
    console.error('FastVLM URL analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
});

/**
 * GET /api/fastvlm/health - Health check for FastVLM service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await fastVLMService.healthCheck();
    res.json({
      service: 'Apple FastVLM',
      version: '2025 CVPR',
      backend: 'MLX (Apple Silicon)',
      ...health,
    });
  } catch (error) {
    res.status(503).json({
      service: 'Apple FastVLM',
      healthy: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

/**
 * GET /api/fastvlm/stats - Get service statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = fastVLMService.getStats();
    res.json({
      service: 'Apple FastVLM',
      framework: 'Apple FastVLM CVPR 2025',
      ...stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    });
  }
});

/**
 * GET /api/fastvlm/config - Get current configuration
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const config = fastVLMService.getConfig();
    res.json({
      service: 'Apple FastVLM',
      config: {
        ...config,
        // Don't expose sensitive paths in full
        modelPath: config.modelPath.split('/').pop(),
        mlxPath: config.mlxPath?.split('/').pop(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get config',
    });
  }
});

/**
 * POST /api/fastvlm/config - Update configuration
 */
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { maxTokens, temperature } = req.body;

    const updates: any = {};
    if (maxTokens !== undefined) updates.maxTokens = parseInt(maxTokens);
    if (temperature !== undefined) updates.temperature = parseFloat(temperature);

    fastVLMService.updateConfig(updates);

    res.json({
      success: true,
      message: 'Configuration updated',
      config: fastVLMService.getConfig(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config',
    });
  }
});

/**
 * POST /api/fastvlm/compare - Compare FastVLM with existing vision models
 */
router.post('/compare', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      });
    }

    const imagePath = req.file.path;

    try {
      // Run FastVLM analysis
      const fastVLMStart = Date.now();
      const fastVLMResult = await fastVLMService.analyzeImage({
        imagePath,
        prompt,
      });
      const fastVLMTime = Date.now() - fastVLMStart;

      // For comparison, we would integrate with existing vision service
      // This is a placeholder for the comparison logic
      const comparisonResult = {
        fastVLM: {
          ...fastVLMResult,
          responseTime: fastVLMTime,
          model: 'Apple FastVLM 7B (MLX)',
        },
        comparison: {
          fastVLMAdvantages: [
            '85x faster Time-to-First-Token than comparable models',
            'Native Apple Silicon optimization with MLX',
            'State-of-the-art vision-language understanding',
            'Efficient hybrid vision encoder (FastViTHD)',
            '2025 CVPR cutting-edge architecture',
          ],
        },
      };

      res.json(comparisonResult);
    } finally {
      // Clean up uploaded file
      try {
        await fs.unlink(imagePath);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file:', cleanupError);
      }
    }
  } catch (error) {
    console.error('FastVLM comparison error:', error);

    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded file on error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Comparison failed',
    });
  }
});

// Initialize service on route load
(async () => {
  try {
    await fastVLMService.initialize();
    console.log('✅ FastVLM routes initialized with Apple Silicon optimization');
  } catch (error) {
    console.warn(
      '⚠️ FastVLM service initialization deferred:',
      error instanceof Error ? error.message : error
    );
  }
})();

export default router;

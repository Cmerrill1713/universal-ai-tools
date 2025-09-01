/**
 * Multi-Modal AI Router
 * Phase 16: Advanced multi-modal AI capabilities API endpoints
 * Handles text, image, audio, video, and cross-modal processing requests
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { Logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation';
import { authenticateApiKey } from '../middleware/auth';
import { multiModalAIService, MultiModalInput, MultiModalOperation, MultiModalTaskOptions } from '../services/multi-modal-ai-service';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 10 // Maximum 10 files per request
  }
});

// Request validation schemas
const CreateTaskSchema = z.object({
  operation: z.enum([
    'image_caption', 'image_analysis', 'image_generation', 'image_enhancement',
    'audio_transcription', 'audio_generation', 'audio_enhancement',
    'video_analysis', 'video_summarization',
    'document_analysis', 'code_analysis',
    'cross_modal_search', 'content_synthesis', 'translation',
    'sentiment_analysis', 'entity_extraction', 'similarity_analysis'
  ]),
  inputs: z.array(z.object({
    type: z.enum(['text', 'image', 'audio', 'video', 'document', 'code']),
    content: z.string().optional(), // For text inputs
    metadata: z.record(z.any()).optional()
  })).min(1),
  options: z.object({
    model: z.string().optional(),
    quality: z.enum(['draft', 'standard', 'high', 'premium']).optional(),
    maxOutputs: z.number().min(1).max(20).optional(),
    outputFormat: z.string().optional(),
    language: z.string().optional(),
    customParameters: z.record(z.any()).optional(),
    cacheResults: z.boolean().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    timeout: z.number().min(1000).max(600000).optional() // 1s to 10min
  }).optional()
});

const TextOnlyTaskSchema = z.object({
  operation: z.enum([
    'sentiment_analysis', 'entity_extraction', 'translation', 
    'code_analysis', 'document_analysis', 'content_synthesis'
  ]),
  text: z.string().min(1).max(100000),
  options: z.object({
    model: z.string().optional(),
    quality: z.enum(['draft', 'standard', 'high', 'premium']).optional(),
    language: z.string().optional(),
    customParameters: z.record(z.any()).optional(),
    cacheResults: z.boolean().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional()
  }).optional()
});

// Apply authentication to all routes
router.use(authenticateApiKey);

/**
 * @route POST /api/multi-modal/tasks
 * @description Create a new multi-modal AI processing task with file uploads
 */
router.post('/tasks', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const { operation, options = {}, textInputs = [] } = req.body;
    
    // Parse JSON strings from form data
    const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;
    const parsedTextInputs = typeof textInputs === 'string' ? JSON.parse(textInputs) : textInputs;

    if (!operation) {
      return res.status(400).json({
        success: false,
        error: 'Operation is required'
      });
    }

    const inputs: MultiModalInput[] = [];

    // Process file uploads
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        let inputType: 'image' | 'audio' | 'video' | 'document' | 'code' | 'text';
        
        if (file.mimetype.startsWith('image/')) {
          inputType = 'image';
        } else if (file.mimetype.startsWith('audio/')) {
          inputType = 'audio';
        } else if (file.mimetype.startsWith('video/')) {
          inputType = 'video';
        } else if (file.mimetype.includes('pdf') || file.mimetype.includes('document')) {
          inputType = 'document';
        } else if (file.mimetype === 'text/plain' || file.originalname?.endsWith('.txt')) {
          inputType = 'text';
        } else if (
          file.originalname?.match(/\.(js|ts|py|java|cpp|c|go|rs|php|rb|swift|kt)$/) ||
          file.mimetype.includes('javascript') || 
          file.mimetype.includes('typescript')
        ) {
          inputType = 'code';
        } else {
          inputType = 'document'; // Default fallback
        }

        inputs.push({
          type: inputType,
          content: file.buffer,
          metadata: {
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size
          }
        });
      }
    }

    // Process text inputs
    if (Array.isArray(parsedTextInputs)) {
      for (const textInput of parsedTextInputs) {
        inputs.push({
          type: textInput.type || 'text',
          content: textInput.content,
          metadata: textInput.metadata || {}
        });
      }
    }

    if (inputs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one input (file or text) is required'
      });
    }

    const taskId = await multiModalAIService.createTask(
      inputs, 
      operation as MultiModalOperation,
      {
        ...parsedOptions,
        customParameters: {
          ...parsedOptions.customParameters,
          userId: (req as any).user?.id || 'anonymous'
        }
      }
    );

    res.status(201).json({
      success: true,
      data: {
        taskId,
        operation,
        inputCount: inputs.length,
        status: 'pending',
        message: 'Multi-modal processing task created successfully'
      }
    });

  } catch (error) {
    Logger.error('❌ Failed to create multi-modal task', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create processing task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/multi-modal/tasks/text-only
 * @description Create a text-only processing task (no file uploads)
 */
router.post('/tasks/text-only', validateRequest(TextOnlyTaskSchema), async (req: Request, res: Response) => {
  try {
    const { operation, text, options = {} } = req.body;

    const inputs: MultiModalInput[] = [{
      type: 'text',
      content: text,
      metadata: {
        language: options.language || 'auto-detect',
        length: text.length
      }
    }];

    const taskId = await multiModalAIService.createTask(
      inputs,
      operation,
      {
        ...options,
        customParameters: {
          ...options.customParameters,
          userId: (req as any).user?.id || 'anonymous'
        }
      }
    );

    res.status(201).json({
      success: true,
      data: {
        taskId,
        operation,
        inputType: 'text',
        inputLength: text.length,
        status: 'pending'
      }
    });

  } catch (error) {
    Logger.error('❌ Failed to create text-only task', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create text processing task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/multi-modal/tasks/:taskId
 * @description Get task details and results
 */
router.get('/tasks/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const includeInputs = req.query.includeInputs === 'true';

    const task = await multiModalAIService.getTask(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // Sanitize response - don't include large binary data
    const responseTask = {
      ...task,
      inputs: includeInputs ? task.inputs.map(input => ({
        ...input,
        content: typeof input.content === 'string' 
          ? input.content.substring(0, 1000) + (input.content.length > 1000 ? '...' : '')
          : `[Binary data: ${Buffer.isBuffer(input.content) ? input.content.length : 'unknown size'} bytes]`
      })) : `${task.inputs.length} inputs (use ?includeInputs=true to view)`
    };

    res.json({
      success: true,
      data: responseTask
    });

  } catch (error) {
    Logger.error('❌ Failed to get task', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/multi-modal/tasks/:taskId/status
 * @description Get task status and progress
 */
router.get('/tasks/:taskId/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const status = await multiModalAIService.getTaskStatus(taskId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.json({
      success: true,
      data: {
        taskId,
        ...status,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    Logger.error('❌ Failed to get task status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve task status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route POST /api/multi-modal/tasks/:taskId/cancel
 * @description Cancel a processing task
 */
router.post('/tasks/:taskId/cancel', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const cancelled = await multiModalAIService.cancelTask(taskId);

    if (!cancelled) {
      return res.status(400).json({
        success: false,
        error: 'Task cannot be cancelled (not found or already completed)'
      });
    }

    res.json({
      success: true,
      data: {
        taskId,
        cancelled: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    Logger.error('❌ Failed to cancel task', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/multi-modal/processors
 * @description Get available processors and their capabilities
 */
router.get('/processors', async (req: Request, res: Response) => {
  try {
    const capabilities = await multiModalAIService.getProcessorCapabilities();

    res.json({
      success: true,
      data: {
        processors: capabilities,
        count: Object.keys(capabilities).length,
        supportedOperations: Array.from(new Set(
          Object.values(capabilities).flatMap(p => p.supportedOperations)
        )).sort(),
        supportedInputTypes: Array.from(new Set(
          Object.values(capabilities).flatMap(p => p.supportedInputTypes)
        )).sort()
      }
    });

  } catch (error) {
    Logger.error('❌ Failed to get processor capabilities', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve processor capabilities',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/multi-modal/stats
 * @description Get system statistics and performance metrics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await multiModalAIService.getSystemStats();

    res.json({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });

  } catch (error) {
    Logger.error('❌ Failed to get system stats', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/multi-modal/tasks/:taskId/stream
 * @description Stream task progress and results in real-time
 */
router.get('/tasks/:taskId/stream', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    // Verify task exists
    const task = await multiModalAIService.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial status
    const initialStatus = await multiModalAIService.getTaskStatus(taskId);
    res.write(`data: ${JSON.stringify({
      type: 'status',
      taskId,
      ...initialStatus,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Poll for updates every 2 seconds
    const interval = setInterval(async () => {
      try {
        const currentStatus = await multiModalAIService.getTaskStatus(taskId);
        
        if (currentStatus) {
          res.write(`data: ${JSON.stringify({
            type: 'progress',
            taskId,
            ...currentStatus,
            timestamp: new Date().toISOString()
          })}\n\n`);

          // Stop streaming if task is complete or failed
          if (currentStatus.status === 'completed' || currentStatus.status === 'failed') {
            res.write(`data: ${JSON.stringify({
              type: 'complete',
              taskId,
              finalStatus: currentStatus.status,
              timestamp: new Date().toISOString()
            })}\n\n`);
            
            clearInterval(interval);
            res.end();
          }
        }
      } catch (error) {
        Logger.error('❌ Error in task stream', { taskId, error });
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Stream error occurred'
        })}\n\n`);
      }
    }, 2000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });

  } catch (error) {
    Logger.error('❌ Failed to start task stream', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to start task stream',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/multi-modal/health
 * @description Health check for multi-modal service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = await multiModalAIService.getSystemStats();
    const capabilities = await multiModalAIService.getProcessorCapabilities();

    const health = {
      status: 'healthy',
      service: 'multi-modal-ai',
      version: '1.0.0',
      processors: {
        available: Object.keys(capabilities).length,
        types: Object.keys(capabilities)
      },
      tasks: {
        total: stats.totalTasks,
        processing: stats.processingTasks,
        pending: stats.pendingTasks
      },
      system: {
        concurrency: stats.maxConcurrency,
        isProcessing: stats.isProcessing
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    Logger.error('❌ Multi-modal health check failed', { error });
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
/**
 * HuggingFace API Router
 * Provides REST endpoints for HuggingFace model interactions
 */

import { Router } from 'express';

import {
  analysisParametersMiddleware,
  creativeParametersMiddleware,
  parameterEffectivenessLogger,
} from '../middleware/intelligent-parameters';
import { createRateLimiter } from '../middleware/rate-limiter-enhanced';
// Use LM Studio adapter instead of native HuggingFace service
import { huggingFaceService } from '../services/huggingface-to-lmstudio';
import { log,LogContext } from '../utils/logger';

interface HuggingFaceRequest {
  type:
    | 'generate'
    | 'classify'
    | 'summarize'
    | 'translate'
    | 'analyze'
    | 'embeddings'
    | 'qa'
    | 'sentiment';
  inputs?: string | string[];
  text?: string;
  question?: string;
  context?: string;
  model?: string;
  parameters?: Record<string, any>;
  [key: string]: any;
}

const router = Router();

// Apply rate limiting to HuggingFace endpoints
router.use(createRateLimiter());

// Apply parameter effectiveness logging
router.use(parameterEffectivenessLogger());

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    if (!huggingFaceService) {
      return res.status(503).json({
        success: false,
        error: 'HuggingFace service not configured (missing API key)',
        timestamp: new Date().toISOString(),
      });
    }

    const healthStatus = await huggingFaceService.healthCheck();

    return res.json({
      success: true,
      data: healthStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('HuggingFace health check failed', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get service metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    if (!huggingFaceService) {
      return res.status(503).json({
        success: false,
        error: 'HuggingFace service not configured',
      });
    }

    const metrics = huggingFaceService.getMetrics();

    return res.json({
      success: true,
      data: {
        ...metrics,
        modelsUsed: Array.from(metrics.modelsUsed),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get HuggingFace metrics', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
    });
  }
});

/**
 * List available models
 */
router.get('/models', async (req, res) => {
  try {
    if (!huggingFaceService) {
      return res.status(503).json({
        success: false,
        error: 'HuggingFace service not configured',
      });
    }

    const result = await huggingFaceService.listModels();

    return res.json(result);
  } catch (error) {
    log.error('Failed to list HuggingFace models', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list models',
    });
  }
});

/**
 * Generate text
 */
router.post(
  '/generate',
  creativeParametersMiddleware(), // Apply intelligent parameters for creative tasks
  async (req, res) => {
    try {
      if (!huggingFaceService) {
        return res.status(503).json({
          success: false,
          error: 'HuggingFace service not configured',
        });
      }

      const { inputs, parameters, model } = req.body;

      if (!inputs) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: inputs',
        });
      }

      log.info('🤗 Processing text generation request with intelligent parameters', LogContext.AI, {
        model: model || 'default',
        inputLength: inputs.length,
        optimizedTemperature: req.body.temperature,
        optimizedMaxTokens: req.body.maxTokens,
      });

      // Use optimized parameters from middleware
      const optimizedParameters = {
        max_new_tokens: req.body.maxTokens || parameters?.max_new_tokens,
        temperature: req.body.temperature || parameters?.temperature,
        top_p: req.body.topP || parameters?.top_p,
        do_sample: req.body.temperature > 0.1, // Enable sampling for creative tasks
        ...parameters,
      };

      const result = await huggingFaceService.generateText({
        inputs: req.body.enhancedPrompt ? req.body.prompt.replace('{user_input}', inputs) : inputs,
        parameters: optimizedParameters,
        model,
      });

      return res.json(result);
    } catch (error) {
      log.error('HuggingFace text generation failed', LogContext.API, { error });
      return res.status(500).json({
        success: false,
        error: 'Text generation failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * Generate embeddings
 */
router.post('/embeddings', async (req, res) => {
  try {
    if (!huggingFaceService) {
      return res.status(503).json({
        success: false,
        error: 'HuggingFace service not configured',
      });
    }

    const { inputs, model } = req.body;

    if (!inputs) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: inputs',
      });
    }

    log.info('🤗 Processing embedding generation request', LogContext.AI, {
      model: model || 'default',
      inputType: Array.isArray(inputs) ? 'batch' : 'single',
    });

    const result = await huggingFaceService.generateEmbeddings({
      inputs,
      model,
    });

    return res.json(result);
  } catch (error) {
    log.error('HuggingFace embedding generation failed', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Embedding generation failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Question answering
 */
router.post(
  '/qa',
  analysisParametersMiddleware(), // Apply intelligent parameters for analysis tasks
  async (req, res) => {
    try {
      if (!huggingFaceService) {
        return res.status(503).json({
          success: false,
          error: 'HuggingFace service not configured',
        });
      }

      const { question, context, model } = req.body;

      if (!question || !context) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: question and context',
        });
      }

      log.info('🤗 Processing question answering request', LogContext.AI, {
        model: model || 'default',
        questionLength: question.length,
        contextLength: context.length,
      });

      const result = await huggingFaceService.answerQuestion({
        question,
        context,
        model,
      });

      return res.json(result);
    } catch (error) {
      log.error('HuggingFace question answering failed', LogContext.API, { error });
      return res.status(500).json({
        success: false,
        error: 'Question answering failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * Text summarization
 */
router.post('/summarize', async (req, res) => {
  try {
    if (!huggingFaceService) {
      return res.status(503).json({
        success: false,
        error: 'HuggingFace service not configured',
      });
    }

    const { inputs, parameters, model } = req.body;

    if (!inputs) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: inputs',
      });
    }

    log.info('🤗 Processing summarization request', LogContext.AI, {
      model: model || 'default',
      inputLength: inputs.length,
    });

    const result = await huggingFaceService.summarizeText({
      inputs,
      parameters,
      model,
    });

    return res.json(result);
  } catch (error) {
    log.error('HuggingFace summarization failed', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Summarization failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Sentiment analysis
 */
router.post('/sentiment', async (req, res) => {
  try {
    if (!huggingFaceService) {
      return res.status(503).json({
        success: false,
        error: 'HuggingFace service not configured',
      });
    }

    const { text, model } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: text',
      });
    }

    log.info('🤗 Processing sentiment analysis request', LogContext.AI, {
      model: model || 'default',
      textLength: text.length,
    });

    const result = await huggingFaceService.analyzeSentiment(text, model);

    return res.json(result);
  } catch (error) {
    log.error('HuggingFace sentiment analysis failed', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Sentiment analysis failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Batch processing endpoint
 */
router.post('/batch', async (req, res) => {
  try {
    if (!huggingFaceService) {
      return res.status(503).json({
        success: false,
        error: 'HuggingFace service not configured',
      });
    }

    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: requests (must be array)',
      });
    }

    log.info('🤗 Processing batch requests', LogContext.AI, {
      requestCount: requests.length,
    });

    const results = await Promise.allSettled(
      requests.map(async (request: unknown) => {
        const { type, ...params } = request as HuggingFaceRequest;

        if (!huggingFaceService) {
          throw new Error('HuggingFace service not initialized');
        }

        switch (type) {
          case 'generate':
            if (!params.inputs || typeof params.inputs !== 'string') {
              throw new Error('Generate requires inputs as string');
            }
            return await huggingFaceService.generateText({
              inputs: params.inputs,
              parameters: params.parameters,
              model: params.model,
            });
          case 'embeddings':
            if (!params.inputs) {
              throw new Error('Embeddings requires inputs');
            }
            return await huggingFaceService.generateEmbeddings({
              inputs: params.inputs,
              model: params.model,
            });
          case 'qa':
            if (!params.question || !params.context) {
              throw new Error('QA requires question and context');
            }
            return await huggingFaceService.answerQuestion({
              question: params.question,
              context: params.context,
              model: params.model,
            });
          case 'summarize':
            if (!params.inputs || typeof params.inputs !== 'string') {
              throw new Error('Summarize requires inputs as string');
            }
            return await huggingFaceService.summarizeText({
              inputs: params.inputs,
              parameters: params.parameters,
              model: params.model,
            });
          case 'sentiment':
            if (!params.text || typeof params.text !== 'string') {
              throw new Error('Sentiment requires text as string');
            }
            return await huggingFaceService.analyzeSentiment(params.text, params.model);
          default:
            throw new Error(`Unknown request type: ${type}`);
        }
      })
    );

    const processedResults = results.map((result, index) => ({
      index,
      status: result.status,
      ...(result.status === 'fulfilled' ? { data: result.value } : { error: result.reason }),
    }));

    return res.json({
      success: true,
      data: {
        results: processedResults,
        summary: {
          total: requests.length,
          successful: results.filter((r) => r.status === 'fulfilled').length,
          failed: results.filter((r) => r.status === 'rejected').length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('HuggingFace batch processing failed', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: 'Batch processing failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

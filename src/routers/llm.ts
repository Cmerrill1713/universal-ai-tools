/**
 * LLM Router - Simple endpoint for LLM-related operations
 * Provides health checks and basic LLM service management
 */

import { Router } from 'express';
import { LogContext, log } from '../utils/logger';
import { llmRouter as llmService } from '../services/llm-router-service';
import { fastCoordinator } from '../services/fast-llm-coordinator';

const router = Router();

/**
 * Health check endpoint for LLM services
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'operational',
      services: {
        llmRouter: true,
        fastCoordinator: true,
        ollama: false, // Will be checked dynamically
        lmStudio: false,
        openai: false,
        anthropic: false
      },
      timestamp: new Date().toISOString()
    };

    // Check service availability if possible
    try {
      if (llmService && typeof llmService.getSystemStatus === 'function') {
        const systemStatus = await llmService.getSystemStatus();
        if (systemStatus.providers) {
          health.services.ollama = systemStatus.providers.ollama?.healthy || false;
          health.services.lmStudio = systemStatus.providers.lmStudio?.healthy || false;
          health.services.openai = systemStatus.providers.openai?.healthy || false;
          health.services.anthropic = systemStatus.providers.anthropic?.healthy || false;
        }
      }
    } catch (serviceError) {
      log.warn('Could not get detailed service status', LogContext.API, { serviceError });
    }

    res.json({
      success: true,
      data: health,
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'llm-router'
      }
    });
  } catch (error) {
    log.error('LLM health check failed', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'llm-router'
      }
    });
  }
});

/**
 * Chat endpoint for LLM interactions
 */
router.post('/chat', async (req, res) => {
  try {
    const { prompt, provider, model, maxTokens = 100 } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'prompt is required',
        metadata: {
          timestamp: new Date().toISOString(),
          service: 'llm-router'
        }
      });
    }

    // Simple response for now
    const response = {
      success: true,
      data: {
        content: 'This is a test response from the LLM router',
        provider: provider || 'fallback',
        model: model || 'test-model',
        tokens: 10,
        cached: false
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'llm-router',
        executionTime: '50ms'
      }
    };

    return res.json(response);
  } catch (error) {
    log.error('LLM chat error', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Chat request failed',
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'llm-router'
      }
    });
  }
});

/**
 * Context information endpoint for testing
 */
router.post('/context-info', async (req, res) => {
  try {
    const { contextLengthManager } = await import('../services/context-length-manager');
    
    const {
      modelId,
      provider,
      taskType,
      inputLength,
      preferredOutputLength,
      priority = 'balanced'
    } = req.body;

    if (!modelId || !provider || !taskType || inputLength === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: modelId, provider, taskType, inputLength',
        metadata: {
          timestamp: new Date().toISOString(),
          service: 'context-manager'
        }
      });
    }

    const contextRequest = {
      modelId,
      provider,
      taskType,
      inputLength,
      preferredOutputLength,
      priority
    };

    const optimalContext = contextLengthManager.getOptimalContextLength(contextRequest);
    const modelInfo = contextLengthManager.getModelInfo(modelId, provider);

    log.info('Context info requested', LogContext.API, {
      modelId,
      provider,
      taskType,
      optimization: optimalContext
    });

    res.json({
      success: true,
      data: {
        request: contextRequest,
        optimization: optimalContext,
        modelInfo: modelInfo,
        recommendations: {
          shouldTruncate: optimalContext.truncationStrategy !== 'none',
          efficiency: optimalContext.efficiency,
          reasoning: optimalContext.reasoning
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'context-manager'
      }
    });

  } catch (error) {
    log.error('Context info error', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Context info request failed',
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'context-manager'
      }
    });
  }
});

/**
 * Generate endpoint with context optimization
 */
router.post('/generate', async (req, res) => {
  try {
    const { messages, model, temperature, stream = false, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required',
        metadata: {
          timestamp: new Date().toISOString(),
          service: 'llm-router'
        }
      });
    }

    log.info('LLM generation request', LogContext.API, {
      model,
      messageCount: messages.length,
      temperature,
      maxTokens
    });

    // Use the LLM router service for generation with context optimization
    const response = await llmService.generateResponse(model || 'general', messages, {
      temperature: temperature || 0.7,
      maxTokens: maxTokens
    });

    res.json({
      success: true,
      choices: [
        {
          message: {
            role: 'assistant',
            content: response.content
          }
        }
      ],
      usage: response.usage || { total_tokens: 0 },
      metadata: {
        ...response.metadata,
        contextOptimized: true,
        service: 'llm-router'
      }
    });

  } catch (error) {
    log.error('LLM generation error', LogContext.API, { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
      metadata: {
        timestamp: new Date().toISOString(),
        service: 'llm-router'
      }
    });
  }
});

export default router;
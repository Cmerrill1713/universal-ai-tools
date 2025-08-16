/**
 * Local LLM Router - Frontend Integration
 * Provides endpoints expected by the frontend interface
 */

import { Router } from 'express';

import { healthMonitor } from '@/services/health-monitor-service';
import { ollamaService } from '@/services/ollama-service';
import { log, LogContext } from '@/utils/logger';

const router = Router();

// Health endpoint for frontend status checks
router.get('/health', async (req, res) => {
  try {
    const health = healthMonitor.getCurrentHealth();
    
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        ollama: true, // Will be updated below
        lmstudio: false, // Not implemented in current setup
      },
      system: {
        memoryUsage: health?.memoryUsage || 0,
        cpuUsage: health?.cpuUsage || 0,
        uptime: process.uptime(),
      }
    };

    // Test Ollama availability
    try {
      await ollamaService.getAvailableModels();
      response.services.ollama = true;
    } catch {
      response.services.ollama = false;
    }

    res.json(response);
  } catch (error) {
    log.error('Local health check failed', LogContext.API, { error });
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Models endpoint for frontend model selection
router.get('/models', async (req, res) => {
  try {
    const models: Array<{ id: string; provider: string; name?: string }> = [];

    // Get Ollama models
    try {
      const ollamaModels = await ollamaService.getAvailableModels();
      ollamaModels.forEach(modelId => {
        models.push({
          id: modelId,
          provider: 'ollama',
          name: modelId
        });
      });
    } catch (error) {
      log.warn('Failed to get Ollama models', LogContext.API, { error });
    }

    // Add default auto option
    models.unshift({
      id: 'auto',
      provider: 'auto',
      name: 'Auto-select'
    });

    res.json({
      success: true,
      models,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Failed to get models', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      models: [],
    });
  }
});

// Chat endpoint for frontend conversation
router.post('/chat', async (req, res): Promise<void> => {
  try {
    const {
      message,
      model,
      provider,
      temperature = 0.7,
      max_tokens = 500,
      useRAG,
      maxContext,
      includeGraphPaths,
      sessionId,
      projectPath
    } = req.body;

    if (!message) {
      res.status(400).json({
        success: false,
        error: 'Message is required',
      });
      return;
    }

    // For now, use the assistant router logic by importing and calling it
    try {
      const { default: assistantRouter } = await import('./assistant');
      
      // Create a simulated request for the assistant router
      const assistantReq = {
        ...req,
        body: {
          userRequest: message,
          model: model === 'auto' ? undefined : model,
          provider: provider === 'auto' ? undefined : provider,
          temperature,
          maxTokens: max_tokens,
          useRAG,
          maxContext,
          includeGraphPaths,
          sessionId: sessionId || `web-${Date.now()}`,
          projectPath: projectPath || 'frontend'
        }
      };

      // Use the assistant router to handle the request
      const response = await new Promise((resolve, reject) => {
        const mockRes = {
          json: (data: any) => resolve(data),
          status: (code: number) => ({
            json: (data: any) => resolve({ ...data, statusCode: code })
          })
        };

        // Find the POST route in the assistant router
        const assistantStack = (assistantRouter as any).stack;
        const postRoute = assistantStack?.find((layer: any) => 
          layer.route?.path === '/' && layer.route?.methods?.post
        );

        if (postRoute) {
          postRoute.route.stack[0].handle(assistantReq, mockRes, (err: any) => {
            if (err) reject(err);
          });
        } else {
          reject(new Error('Assistant route not found'));
        }
      });

      res.json(response);
    } catch (error) {
      log.error('Chat request failed', LogContext.API, { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Chat processing failed',
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
      });
    }
  } catch (error) {
    log.error('Chat endpoint error', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
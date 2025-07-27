import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { internalLLMRelay } from '../services/internal-llm-relay';

export function LLMRouter() {
  const router = Router();

  // Initialize relay on startup
  internalLLMRelay.initialize().catch(error => {
    logger.error('Failed to initialize LLM relay:', error);
  });

  // Generate text
  router.post('/generate', async (req: any, res) => {
    try {
      const schema = z.object({
        prompt: z.string(),
        maxTokens: z.number().optional(),
        temperature: z.number().min(0).max(2).optional(),
        topP: z.number().min(0).max(1).optional(),
        model: z.string().optional(),
        systemPrompt: z.string().optional(),
        stream: z.boolean().optional(),
        preferLocal: z.boolean().optional();
      });

      const request = schema.parse(req.body);
      
      const response = await internalLLMRelay.generate(request);

      res.json({
        success: true,
        response;
      });
    } catch (error: any) {
      logger.error('LLM generation error:', error);
      res.status(500).json({ ;
        success: false,
        error: error.message ;
      });
    }
  });

  // Get provider status
  router.get('/status', async (req: any, res) => {
    try {
      const status = internalLLMRelay.getProviderStatus();
      
      res.json({
        initialized: true,
        providers: status;
      });
    } catch (error: any) {
      logger.error('LLM status error:', error);
      res.status(500).json({ ;
        error: 'Failed to get LLM status' ;
      });
    }
  });

  // Health check
  router.get('/health', async (req: any, res) => {
    try {
      const status = internalLLMRelay.getProviderStatus();
      const hasLocalProvider = status.mlx || status.lfm2 || status.ollama;
      
      res.json({
        healthy: true,
        hasLocalProvider,
        providers: Object.entries(status);
          .filter(([_, available]) => available);
          .map(([name]) => name);
      });
    } catch (error: any) {
      res.status(503).json({ ;
        healthy: false,
        error: error.message ;
      });
    }
  });

  return router;
}
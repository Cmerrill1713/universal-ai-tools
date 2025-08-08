/**
 * Assistant Router
 *
 * Provides a chat endpoint that retrieves relevant project context from Supabase
 * and injects it into the model prompt, then persists the conversation back to
 * Supabase for future use.
 */

import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/express-validator.js';
import { contextStorageService } from '../services/context-storage-service.js';
import { ollamaService } from '../services/ollama-service.js';
import { semanticContextRetrievalService } from '../services/semantic-context-retrieval.js';
import { LogContext, log } from '../utils/logger.js';
import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { body } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ status: 'ok', routes: ['POST /chat'] });
});

/**
 * POST /api/v1/assistant/chat
 * Primary assistant chat endpoint with Supabase-backed context
 */
router.post(
  '/chat',
  // Allow anonymous for quick local testing; otherwise require auth
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers.authorization && !req.headers['x-api-key']) {
      (req as any).user = { id: 'anonymous' };
      return next();
    }
    return authenticate(req, res, next);
  },
  [
    body('message').isString().withMessage('message is required'),
    body('sessionId').optional().isString(),
    body('projectPath').optional().isString(),
    body('maxContext').optional().isInt({ min: 1, max: 25 }),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const startTime = Date.now();

    try {
      const userId = (req as any).user?.id || 'anonymous';
      const {
        message,
        sessionId,
        projectPath,
        maxContext = 8,
      } = req.body as {
        message: string;
        sessionId?: string;
        projectPath?: string;
        maxContext?: number;
      };

      // Retrieve relevant context from Supabase (semantic search with fallback)
      const retrieval = await semanticContextRetrievalService.semanticSearch({
        query: message,
        userId,
        sessionId,
        projectPath,
        maxResults: Math.min(Math.max(Number(maxContext) || 8, 1), 25),
        fuseSimilarResults: true,
      });

      const topContext = retrieval.results
        .slice(0, Math.min(Math.max(Number(maxContext) || 8, 1), 25))
        .map((r) => `- (${r.contentType}) ${r.content}`)
        .join('\n');

      // Build messages for model with retrieved context
      const systemPreamble =
        'You are a helpful AI assistant. Use the following retrieved project context when it is relevant. If context is not relevant, proceed normally.';
      const contextBlock = topContext
        ? `\n\nRetrieved context (may be relevant):\n${topContext}\n\n`
        : '';

      const messages = [
        { role: 'system' as const, content: systemPreamble + contextBlock },
        { role: 'user' as const, content: message },
      ];

      // Generate response via Ollama service with graceful fallback
      let assistantText: string;
      try {
        const llmResponse = await ollamaService.generateResponse(messages);
        assistantText =
          llmResponse?.message?.content || "I'm here to help, but I couldn't generate a response.";
        // Factuality guard
        try {
          const { checkAndCorrectFactuality } = await import('../services/factuality-guard.js');
          const fact = await checkAndCorrectFactuality(assistantText, message, {
            userId,
            requestId,
            projectPath,
          });
          assistantText = fact.content;
        } catch {}
      } catch (llmError) {
        log.warn('LLM unavailable, returning fallback response', LogContext.AI, {
          error: llmError instanceof Error ? llmError.message : String(llmError),
        });
        // Verified facts first
        try {
          const { verifiedFactsService } = await import('../services/verified-facts-service.js');
          const cached = await verifiedFactsService.findFact(message);
          if (cached) {
            assistantText = cached.answer;
          } else {
            // Web lookup fallback
            const { webSearchService } = await import('../services/web-search-service.js');
            const hits = await webSearchService.searchDuckDuckGo(message, 3);
            if (hits.length > 0) {
              const cite = hits
                .map((r: any, i: number) => `(${i + 1}) ${r.title} - ${r.url}`)
                .join('\n');
              assistantText = `Here are authoritative sources I found:\n\n${cite}`;
            } else {
              assistantText =
                'Assistant is initializing. Context has been retrieved and stored. Please try again shortly.';
            }
          }
        } catch {
          assistantText =
            'Assistant is initializing. Context has been retrieved and stored. Please try again shortly.';
        }
      }

      // Persist conversation to Supabase context storage
      const transcript = `Q: ${message}\nA: ${assistantText}`;
      await contextStorageService.storeConversation(
        userId,
        transcript,
        'assistant_chat',
        projectPath
      );

      const durationMs = Date.now() - startTime;

      return res.json({
        success: true,
        data: {
          response: assistantText,
          contextUsed: retrieval.results.length,
          clusters: retrieval.clusters?.clusters?.length ?? 0,
          conversationStored: true,
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          durationMs,
        },
      });
    } catch (error) {
      log.error('Assistant chat failed', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        requestId,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'ASSISTANT_CHAT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process assistant request',
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
);

export default router;

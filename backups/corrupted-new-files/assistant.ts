/**
 * AI Assistant Router - Simple endpoint for AI Assistant frontend;
 * Provides a unified interface for the AI Assistant application;
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { apiResponseMiddleware } from '../middleware/api-response';
import type { AgentContext } from '../types/agent';
import type AgentRegistry from '../agents/agent-registry';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Store conversations in memory for now;
const conversations = new Map<string, any[]>();

/**
 * OPTIONS /api/v1/assistant/chat;
 * Handle preflight requests;
 */
router?.options('/chat', (req: Request, res: Response) => {'
  res?.header('Access-Control-Allow-Origin', '*');'
  res?.header('Access-Control-Allow-Methods', 'POST, OPTIONS');'
  res?.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');'
  res?.sendStatus(200);
});

/**
 * POST /api/v1/assistant/chat;
 * Simple chat endpoint for AI Assistant;
 */
router?.post('/chat', async (req: Request, res: Response): Promise<void> => {'
  try {
    log?.info('🤖 AI Assistant chat request', LogContext?.API, {')
      body: req?.body,
      headers: {,
        origin: req?.headers?.origin,
        "content-type": req?.headers['content-type'],'
        'user-agent': req?.headers['user-agent']'
      },
      method: req?.method,
      url: req?.url;
    });

    const { message, conversationId } = req?.body;

    if (!message) {
      res?.status(400).json({)
        success: false,
        error: 'Message is required''
      });
      return;
    }

    // Get or create conversation;
    const convId = conversationId || uuidv4();
    const messages = conversations?.get(convId) || [];

    // Add user message;
    messages?.push({)
      role: 'user','
      content: message,
      timestamp: new Date().toISOString()
    });

    // Get agent registry;
    const agentRegistry = (global as unknown).agentRegistry as AgentRegistry;

    // Use personal assistant agent for assistant requests;
    const agentName = 'personal_assistant';
    let responseContent = '';
    let confidence = 0?.8;

    if (agentRegistry) {
      try {
        const agentContext: AgentContext = {,;
          userRequest: message,
          requestId: uuidv4()
        };

        const result = await agentRegistry?.processRequest(agentName, agentContext);

        // Extract response from different possible formats;
        const agentResponse = result as unknown;
        if (agentResponse?.data?.response) {
          responseContent = agentResponse?.data?.response;
        } else if (agentResponse?.message) {
          responseContent = agentResponse?.message;
        } else if (agentResponse?.response) {
          responseContent = agentResponse?.response;
        } else {
          responseContent = "I'm here to help! Could you please rephrase your question?";'"
        }

        confidence = agentResponse?.confidence || agentResponse?.data?.confidence || 0?.8;
      } catch (error) {
        log?.error('Agent processing failed, using fallback', LogContext?.API, {')
          error: error instanceof Error ? error?.message : String(error)
        });
        responseContent = "I'm having some technical difficulties, but I'm still here to help! Please try again.";'"
      }
    } else {
      responseContent = "I'm initializing. Please try again in a moment.";'"
    }

    // Add assistant response;
    messages?.push({)
      role: 'assistant','
      content: responseContent,
      timestamp: new Date().toISOString(),
      confidence,
    });

    // Store conversation;
    conversations?.set(convId, messages);

    // Return response in expected format;
    res?.json({)
      success: true,
      conversationId: convId,
      response: responseContent,
      confidence,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log?.error('❌ AI Assistant chat error', LogContext?.API, {')
      error: error instanceof Error ? error?.message : String(error),
      stack: error instanceof Error ? error?.stack : undefined,
      body: req?.body,
      url: req?.url;
    });

    res?.status(500).json({)
      success: false,
      error: 'Failed to process message','
      details: error instanceof Error ? error?.message : String(error)
    });
  }
});

/**
 * GET /api/v1/assistant/status;
 * Health check endpoint;
 */
router?.get('/status', (req: Request, res: Response) => {'
  res?.json({)
    success: true,
    status: 'online','
    agent: 'personal_assistant','
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/v1/assistant/test;
 * Simple test endpoint;
 */
router?.post('/test', (req: Request, res: Response) => {'
  log?.info('🧪 Test endpoint hit', LogContext?.API, {')
    body: req?.body,
    headers: req?.headers;
  });

  res?.json({)
    success: true,
    message: 'Test successful','
    received: req?.body,
    timestamp: new Date().toISOString()
  });
});

// Apply response middleware;
router?.use(apiResponseMiddleware);

export default router;
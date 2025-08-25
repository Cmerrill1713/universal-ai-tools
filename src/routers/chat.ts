/**
 * Chat Router - Manages conversational interactions with AI agents
 * Provides endpoints for chat history, message handling, and conversation management
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '@/utils/logger';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/express-validator';
import { body, param, query } from 'express-validator';
import type AgentRegistry from '@/agents/agent-registry';
import type { AgentContext } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    agentName?: string;
    confidence?: number;
    tokens?: number;
    error?: string;
  };
}

interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  metadata: {
    totalTokens: number;
    agentUsage: Record<string, number>;
  };
}

// In-memory storage for now (should be moved to database)
const conversations: Map<string, Conversation> = new Map();

const router = Router();

/**
 * GET /api/v1/chat/conversations
 * List all conversations for a user
 */
router.get('/conversations', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'anonymous';

    const userConversations = Array.from(conversations.values())
      .filter((conv) => conv.userId === userId)
      .map((conv) => ({
        id: conv.id,
        title: conv.title,
        messageCount: conv.messages.length,
        lastMessage: conv.messages[conv.messages.length - 1]?.content || '',
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return res.json({
      success: true,
      data: {
        conversations: userConversations,
        total: userConversations.length,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || uuidv4(),
      },
    });
  } catch (error) {
    log.error('Failed to list conversations', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'CONVERSATION_LIST_ERROR',
        message: 'Failed to retrieve conversations',
      },
    });
  }
});

/**
 * GET /api/v1/chat/history/:conversationId
 * Get conversation history
 */
router.get(
  '/history/:conversationId',
  authenticate,
  [param('conversationId').isUUID().withMessage('Invalid conversation ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const conversation = conversations.get(conversationId || '');

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found',
          },
        });
      }

      // Check authorization
      const userId = (req as any).user?.id || 'anonymous';
      if (conversation.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this conversation',
          },
        });
      }

      return res.json({
        success: true,
        data: conversation,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to get conversation history', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.params.conversationId,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_ERROR',
          message: 'Failed to retrieve conversation history',
        },
      });
    }
  }
);

/**
 * POST /api/v1/chat/new
 * Start a new conversation
 */
router.post(
  '/new',
  authenticate,
  [
    body('title').optional().isString().withMessage('Title must be a string'),
    body('initialMessage').optional().isString().withMessage('Initial message must be a string'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const { title, initialMessage } = req.body;

      const conversation: Conversation = {
        id: uuidv4(),
        userId,
        title: title || 'New Conversation',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          totalTokens: 0,
          agentUsage: {},
        },
      };

      // Add initial message if provided
      if (initialMessage) {
        conversation.messages.push({
          id: uuidv4(),
          role: 'user',
          content: initialMessage,
          timestamp: new Date().toISOString(),
        });
      }

      conversations.set(conversation.id, conversation);

      return res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          title: conversation.title,
          messageCount: conversation.messages.length,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to create conversation', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'CONVERSATION_CREATE_ERROR',
          message: 'Failed to create conversation',
        },
      });
    }
  }
);

/**
 * POST /api/v1/chat
 * Send a message and get AI response
 */
router.post(
  '/',
  // Make authentication optional for quick chat
  (req: Request, res: Response, next: NextFunction) => {
    // If no auth header, allow anonymous access
    if (!req.headers.authorization && !req.headers['x-api-key']) {
      (req as any).user = { id: 'anonymous' };
      return next();
    }
    // Otherwise use normal authentication
    return authenticate(req, res, next);
  },
  [
    body('message').isString().withMessage('Message is required'),
    body('conversationId').optional().isUUID().withMessage('Invalid conversation ID'),
    body('agentName').optional().isString().withMessage('Agent name must be a string'),
    body('context').optional().isObject().withMessage('Context must be an object'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const { message, conversationId, agentName = 'personal_assistant', context = {} } = req.body;

      // Get or create conversation
      let conversation: Conversation;
      if (conversationId) {
        conversation = conversations.get(conversationId)!;
        if (!conversation) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'CONVERSATION_NOT_FOUND',
              message: 'Conversation not found',
            },
          });
        }

        // Check authorization
        if (conversation.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'You do not have access to this conversation',
            },
          });
        }
      } else {
        // Create new conversation
        conversation = {
          id: uuidv4(),
          userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            totalTokens: 0,
            agentUsage: {},
          },
        };
        conversations.set(conversation.id, conversation);
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      conversation.messages.push(userMessage);

      // Get agent registry
      const agentRegistry = (global as any).agentRegistry as AgentRegistry;
      if (!agentRegistry) {
        throw new Error('Agent registry not available');
      }

      // Prepare agent context with conversation history
      const agentContext: AgentContext = {
        userRequest: message,
        requestId: (req.headers['x-request-id'] as string) || uuidv4(),
        workingDirectory: process.cwd(),
        userId,
        conversationHistory: conversation.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        ...context,
      };

      // Process with agent
      const startTime = Date.now();
      let result: any;

      try {
        // Check if agent exists
        const availableAgents = agentRegistry.getAvailableAgents();
        const agentExists = availableAgents.some((agent) => agent.name === agentName);

        if (!agentExists) {
          log.warn('Agent not found, using mock response', LogContext.API, { agentName });
          // Provide a mock response for testing
          result = {
            response:
              "I'm here to help! The system is currently initializing. How can I assist you today?",
            confidence: 0.8,
            success: true,
            reasoning: 'Mock response while agents are loading',
          };
        } else {
          result = await agentRegistry.processRequest(agentName, agentContext);
        }
      } catch (agentError) {
        log.error('Agent processing failed', LogContext.API, {
          error: agentError instanceof Error ? agentError.message : String(agentError),
          agentName,
        });

        // Provide fallback response
        result = {
          response:
            "I'm experiencing some technical difficulties, but I'm still here to help! Please try again in a moment.",
          confidence: 0.5,
          success: false,
          error: agentError instanceof Error ? agentError.message : 'Unknown error',
        };
      }

      const executionTime = Date.now() - startTime;

      // Extract conversational content from agent response
      let conversationalContent = '';
      
      // Debug logging to understand response structure
      log.info('🔍 Agent response structure:', LogContext.API, {
        hasResponse: !!result.response,
        responseType: typeof result.response,
        hasData: !!result.data,
        dataType: typeof result.data,
        responseKeys: result.response ? Object.keys(result.response) : null,
        dataKeys: result.data ? Object.keys(result.data) : null,
        fullData: result.data ? JSON.stringify(result.data, null, 2).substring(0, 1000) : null,
        agentName
      });
      
      // Handle different response formats from agents
      if (result.response) {
        if (typeof result.response === 'string') {
          conversationalContent = result.response;
        } else if (result.response && typeof result.response === 'object') {
          // Try different common properties for conversational content
          if (result.response.message) {
            conversationalContent = result.response.message;
          } else if (result.response.content) {
            conversationalContent = result.response.content;
          } else if (result.response.text) {
            conversationalContent = result.response.text;
          } else if (result.response.answer) {
            conversationalContent = result.response.answer;
          } else {
            // As a last resort, try to extract from JSON
            conversationalContent = JSON.stringify(result.response, null, 2);
          }
        } else {
          conversationalContent = String(result.response);
        }
      } else if (result.data) {
        // Handle enhanced agent response format
        if (typeof result.data === 'object' && result.data.aiResponse) {
          try {
            // Parse the nested aiResponse structure
            let {aiResponse} = result.data;
            
            // If aiResponse is a string, parse it as JSON
            if (typeof aiResponse === 'string') {
              aiResponse = JSON.parse(aiResponse);
            }
            
            // Extract the conversational message from the structured response
            if (aiResponse.response && aiResponse.response.message) {
              conversationalContent = aiResponse.response.message;
            } else if (aiResponse.message) {
              conversationalContent = aiResponse.message;
            } else if (aiResponse.content) {
              conversationalContent = aiResponse.content;
            } else {
              // Fallback to the raw aiResponse
              conversationalContent = typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse, null, 2);
            }
          } catch (parseError) {
            log.warn('Failed to parse agent aiResponse', LogContext.API, { parseError });
            conversationalContent = 'I apologize, but there was an error processing my response.';
          }
        } else if (typeof result.data === 'string') {
          conversationalContent = result.data;
        } else {
          conversationalContent = JSON.stringify(result.data, null, 2);
        }
      } else {
        conversationalContent = 'I apologize, but I was unable to generate a response.';
      }

      // Add assistant response with conversational content only
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: conversationalContent,
        timestamp: new Date().toISOString(),
        metadata: {
          agentName,
          confidence: result.confidence || 0.5,
          tokens: Math.floor(executionTime / 10), // Rough estimate
          error: result.error,
        },
      };
      conversation.messages.push(assistantMessage);

      // Update conversation metadata
      conversation.updatedAt = new Date().toISOString();
      conversation.metadata.totalTokens += assistantMessage.metadata?.tokens || 0;
      conversation.metadata.agentUsage[agentName] =
        (conversation.metadata.agentUsage[agentName] || 0) + 1;

      return res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          message: assistantMessage,
          usage: {
            tokens: assistantMessage.metadata?.tokens || 0,
            executionTime: `${executionTime}ms`,
          },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: agentContext.requestId,
          agentName,
        },
      });
    } catch (error) {
      log.error('Chat processing error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'CHAT_ERROR',
          message: 'Failed to process chat message',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
);

/**
 * DELETE /api/v1/chat/:conversationId
 * Delete a conversation
 */
router.delete(
  '/:conversationId',
  authenticate,
  [param('conversationId').isUUID().withMessage('Invalid conversation ID')],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).user?.id || 'anonymous';

      const conversation = conversations.get(conversationId || '');
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found',
          },
        });
      }

      // Check authorization
      if (conversation.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this conversation',
          },
        });
      }

      if (conversationId) {
        conversations.delete(conversationId);
      }

      return res.json({
        success: true,
        data: {
          message: 'Conversation deleted successfully',
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to delete conversation', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.params.conversationId,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: 'Failed to delete conversation',
        },
      });
    }
  }
);

export default router;

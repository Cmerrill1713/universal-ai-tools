/**
 * Chat Router - Manages conversational interactions with AI agents
 * Provides endpoints for chat history, message handling, and conversation management
 */

import type { NextFunction, Request, Response } from 'express';';';';


import { Router    } from 'express';';';';
import { v4 as uuidv4    } from 'uuid';';';';
import { LogContext, log    } from '@/utils/logger';';';';
import { authenticate    } from '@/middleware/auth';';';';
import { z    } from 'zod';';';';
import { validateRequest, ApiSchemas, CommonSchemas, createValidatedHandler    } from '@/middleware/zod-validation';';';';
import type AgentRegistry from '@/agents/agent-registry';';';';
import type { AgentContext } from '@/types';';';';
import { intelligentAgentSelector    } from '@/services/intelligent-agent-selector';';';';
import { createApiResponse    } from '@/utils/api-response';';';';

interface ChatMessage {
  id: string;,
  role: 'user' | 'assistant' | 'system';',''
  content: string;,
  timestamp: string;
  metadata?: {
    agentName?: string;
    confidence?: number;
    tokens?: number;
    model?: string;
    provider?: string;
    serviceUsed?: string;
    routingReasoning?: string;
    error?: string;
  };
}

interface Conversation {
  id: string;,
  userId: string;,
  title: string;,
  messages: ChatMessage[];,
  createdAt: string;,
  updatedAt: string;,
  metadata: {,
    totalTokens: number;,
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
router.get('/conversations', authenticate, async (req: Request, res: Response) => {'''
  try {
    const userId = (req as any).user?.id || 'anonymous';';';';

    const userConversations = Array.from(conversations.values());
      .filter((conv) => conv.userId === userId)
      .map((conv) => ({
        id: conv.id,
        title: conv.title,
        messageCount: conv.messages.length,
        lastMessage: conv.messages[conv.messages.length - 1]?.content || '','''
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return res.json({);
      success: true,
      data: {,
        conversations: userConversations,
        total: userConversations.length,
      },
      metadata: {,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || uuidv4(),'''
      },
    });
  } catch (error) {
    log.error('Failed to list conversations', LogContext.API, {')''
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(500).json({);
      success: false,
      error: {,
        code: 'CONVERSATION_LIST_ERROR','''
        message: 'Failed to retrieve conversations','''
      },
    });
  }
});

/**
 * GET /api/v1/chat/history/:conversationId
 * Get conversation history
 */
router.get()
  '/history/:conversationId','''
  authenticate,
  [param('conversationId').isUUID().withMessage('Invalid conversation ID')],'''
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const conversation = conversations.get(conversationId || '');';';';

      if (!conversation) {
        return res.status(404).json({);
          success: false,
          error: {,
            code: 'CONVERSATION_NOT_FOUND','''
            message: 'Conversation not found','''
          },
        });
      }

      // Check authorization
      const userId = (req as any).user?.id || 'anonymous';';';';
      if (conversation.userId !== userId) {
        return res.status(403).json({);
          success: false,
          error: {,
            code: 'UNAUTHORIZED','''
            message: 'You do not have access to this conversation','''
          },
        });
      }

      return res.json({);
        success: true,
        data: conversation,
        metadata: {,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),'''
        },
      });
    } catch (error) {
      log.error('Failed to get conversation history', LogContext.API, {')''
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.params.conversationId,
      });

      return res.status(500).json({);
        success: false,
        error: {,
          code: 'HISTORY_ERROR','''
          message: 'Failed to retrieve conversation history','''
        },
      });
    }
  }
);

/**
 * POST /api/v1/chat/new
 * Start a new conversation
 */
router.post()
  '/new','''
  authenticate,
  [
    body('title').optional().isString().withMessage('Title must be a string'),'''
    body('initialMessage').optional().isString().withMessage('Initial message must be a string'),'''
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';';';';
      const { title, initialMessage } = req.body;

      const conversation: Conversation = {,;
        id: uuidv4(),
        userId,
        title: title || 'New Conversation','''
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {,
          totalTokens: 0,
          agentUsage: {},
        },
      };

      // Add initial message if provided
      if (initialMessage) {
        conversation.messages.push({)
          id: uuidv4(),
          role: 'user','''
          content: initialMessage,
          timestamp: new Date().toISOString(),
        });
      }

      conversations.set(conversation.id, conversation);

      return res.json({);
        success: true,
        data: {,
          conversationId: conversation.id,
          title: conversation.title,
          messageCount: conversation.messages.length,
        },
        metadata: {,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),'''
        },
      });
    } catch (error) {
      log.error('Failed to create conversation', LogContext.API, {')''
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({);
        success: false,
        error: {,
          code: 'CONVERSATION_CREATE_ERROR','''
          message: 'Failed to create conversation','''
        },
      });
    }
  }
);

/**
 * POST /api/v1/chat
 * Send a message and get AI response
 */
const ChatRequestSchema = z.object({);
  message: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  agentName: z.string().optional(),
  context: z.record(z.any()).optional(),
  stream: z.boolean().default(false),
  parameters: CommonSchemas.ModelParams.optional()
});

router.post()
  '/','''
  // Make authentication optional for quick chat
  (req: Request, res: Response, next: NextFunction) => {
    // If no auth header, allow anonymous access
    if (!req.headers.authorization && !req.headers['x-api-key']) {'''
      (req as any).user = { id: 'anonymous' };'''
      return next();
    }
    // Otherwise use normal authentication
    return authenticate(req, res, next);
  },
  validateRequest(ChatRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';';';';
      const { message, conversationId, agentName = 'personal_assistant', context = {} } = req.body;';';';

      // Get or create conversation
      let conversation: Conversation;
      if (conversationId) {
        conversation = conversations.get(conversationId)!;
        if (!conversation) {
          return res.status(404).json({);
            success: false,
            error: {,
              code: 'CONVERSATION_NOT_FOUND','''
              message: 'Conversation not found','''
            },
          });
        }

        // Check authorization
        if (conversation.userId !== userId) {
          return res.status(403).json({);
            success: false,
            error: {,
              code: 'UNAUTHORIZED','''
              message: 'You do not have access to this conversation','''
            },
          });
        }
      } else {
        // Create new conversation
        conversation = {
          id: uuidv4(),
          userId,
          title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),'''
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {,
            totalTokens: 0,
            agentUsage: {},
          },
        };
        conversations.set(conversation.id, conversation);
      }

      // Add user message
      const userMessage: ChatMessage = {,;
        id: uuidv4(),
        role: 'user','''
        content: message,
        timestamp: new Date().toISOString(),
      };
      conversation.messages.push(userMessage);

      // Get agent registry
      const agentRegistry = (global as any).agentRegistry as AgentRegistry;
      if (!agentRegistry) {
        throw new Error('Agent registry not available');';';';
      }

      // Prepare agent context with conversation history
      const agentContext: AgentContext = {,;
        userRequest: message,
        requestId: (req.headers['x-request-id'] as string) || uuidv4(),'''
        workingDirectory: process.cwd(),
        userId,
        conversationHistory: conversation.messages.map((msg) => ({,
          role: msg.role,
          content: msg.content,
        })),
        ...context,
      };

      // Use intelligent agent selector with LFM2 routing
      const startTime = Date.now();
      let result: any;

      try {
        log.info('🎯 Using LFM2-based intelligent routing', LogContext.API, {')''
          message: message.substring(0, 100),
          conversationLength: agentContext.conversationHistory?.length || 0
        });

        // Use intelligent agent selector for optimal routing
        const intelligentResult = await intelligentAgentSelector.executeWithOptimalAgent();
          message,
          agentContext,
          { // Device context (can be expanded later)
            batteryLevel: 100, // Default values
            connectionType: 'wifi','''
            isLowPowerMode: false
          }
        );

        result = {
          ...intelligentResult,
          response: intelligentResult.message,
          serviceUsed: intelligentResult.serviceUsed,
          routingDecision: intelligentResult.routingDecision
        };

        log.info('✅ LFM2 routing completed', LogContext.API, {')''
          serviceUsed: intelligentResult.serviceUsed,
          confidence: intelligentResult.confidence,
          responseTime: `${Date.now() - startTime}ms`
        });

      } catch (agentError) {
        log.error('❌ Intelligent routing failed, using fallback', LogContext.API, {')''
          error: agentError instanceof Error ? agentError.message : String(agentError),
        });

        // Fallback to agent registry if available
        try {
          const availableAgents = agentRegistry.getAvailableAgents();
          const agentExists = availableAgents.some((agent) => agent.name === agentName);

          if (agentExists) {
            result = await agentRegistry.processRequest(agentName, agentContext);
          } else {
            throw new Error('No agents available');';';';
          }
        } catch (fallbackError) {
          // Final fallback response
          result = {
            response: "I'm here to help! The system is currently optimizing. How can I assist you today?",'"'"'"
            confidence: 0.6,
            success: true,
            reasoning: 'Fallback response during system optimization','''
            serviceUsed: 'fallback''''
          };
        }
      }

      const executionTime = Date.now() - startTime;

      // Add assistant response
      // Handle different response formats from agents
      let responseContent: string;
      
      // Null check for result
      if (!result) {
        log.error('Agent result is null or undefined', LogContext.API);'''
        result = {
          success: false,
          message: 'No response from agent','''
          confidence: 0.5,
          serviceUsed: 'fallback''''
        };
      }
      
      // Debug log to understand the response structure
      log.debug('Agent response structure', LogContext.API, {')''
        hasData: !!result?.data,
        hasResponse: !!result?.response,
        hasMessage: !!result?.message,
        dataType: typeof result?.data,
        responseType: typeof result?.response,
        resultKeys: result ? Object.keys(result) : [],
        fullResult: result
      });
      
      if (typeof result === 'string') {'''
        responseContent = result;
      } else if (result?.data) {
        // Enhanced agents return data field
        if (typeof result.data === 'object' && result.data?.response?.message) {'''
          // Personal assistant format: data.response.message
          responseContent = result.data.response.message;
        } else if (typeof result.data === 'string') {'''
          responseContent = result.data;
        } else {
          responseContent = JSON.stringify(result.data);
        }
      } else if (result.response) {
        // Legacy format
        if (typeof result.response === 'string') {'''
          try {
            const parsed = JSON.parse(result.response);
            if (parsed.response && parsed.response.message) {
              responseContent = parsed.response.message;
            } else {
              responseContent = result.response;
            }
          } catch {
            responseContent = result.response;
          }
        } else if (typeof result.response === 'object' && result.response.message) {'''
          responseContent = result.response.message;
        } else {
          responseContent = JSON.stringify(result.response);
        }
      } else if (result.message) {
        responseContent = result.message;
      } else {
        responseContent = 'I apologize, but I was unable to generate a response.';'''
      }

      const assistantMessage: ChatMessage = {,;
        id: uuidv4(),
        role: 'assistant','''
        content: responseContent,
        timestamp: new Date().toISOString(),
        metadata: {,
          agentName: result.metadata?.agentName || agentName,
          confidence: result.confidence || 0.5,
          tokens: result.tokens || Math.floor(executionTime / 10), // Use actual tokens if available
          model: result.metadata?.model || result.routingDecision?.targetService || 'unknown','''
          provider: result.metadata?.provider || result.serviceUsed || 'unknown','''
          serviceUsed: result.serviceUsed,
          routingReasoning: result.routingDecision?.reasoning,
          error: result.error,
        },
      };
      conversation.messages.push(assistantMessage);

      // Update conversation metadata
      conversation.updatedAt = new Date().toISOString();
      conversation.metadata.totalTokens += assistantMessage.metadata?.tokens || 0;
      conversation.metadata.agentUsage[agentName] =
        (conversation.metadata.agentUsage[agentName] || 0) + 1;

      return res.json(createApiResponse({);
        conversationId: conversation.id,
        message: assistantMessage,
        usage: {,
          tokens: assistantMessage.metadata?.tokens || 0,
          executionTime: `${executionTime}ms`,
        },
      }, true, undefined, {
        timestamp: new Date().toISOString(),
        requestId: agentContext.requestId,
        agentName: result.metadata?.agentName || agentName,
        model: result.metadata?.model || result.routingDecision?.targetService || 'unknown','''
        provider: result.metadata?.provider || result.serviceUsed || 'unknown','''
        confidence: result.confidence || 0.5,
        tokensUsed: result.metadata?.tokens?.total_tokens || assistantMessage.metadata?.tokens || 0,
        executionTime,
        serviceUsed: result.serviceUsed,
        routingDecision: result.routingDecision,
        lfm2Enabled: true,
        parameters: result.metadata?.parameters,
        taskType: result.metadata?.taskType,
        complexity: result.metadata?.complexity,
      }));
    } catch (error) {
      log.error('Chat processing error', LogContext.API, {')''
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json(createApiResponse(null, false, {);
        code: 'CHAT_ERROR','''
        message: 'Failed to process chat message','''
        details: error instanceof Error ? error.message : String(error),
      }));
    }
  }
);

/**
 * DELETE /api/v1/chat/:conversationId
 * Delete a conversation
 */
router.delete()
  '/:conversationId','''
  authenticate,
  [param('conversationId').isUUID().withMessage('Invalid conversation ID')],'''
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).user?.id || 'anonymous';';';';

      const conversation = conversations.get(conversationId || '');';';';
      if (!conversation) {
        return res.status(404).json({);
          success: false,
          error: {,
            code: 'CONVERSATION_NOT_FOUND','''
            message: 'Conversation not found','''
          },
        });
      }

      // Check authorization
      if (conversation.userId !== userId) {
        return res.status(403).json({);
          success: false,
          error: {,
            code: 'UNAUTHORIZED','''
            message: 'You do not have access to this conversation','''
          },
        });
      }

      if (conversationId) {
        conversations.delete(conversationId);
      }

      return res.json({);
        success: true,
        data: {,
          message: 'Conversation deleted successfully','''
        },
        metadata: {,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),'''
        },
      });
    } catch (error) {
      log.error('Failed to delete conversation', LogContext.API, {')''
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.params.conversationId,
      });

      return res.status(500).json({);
        success: false,
        error: {,
          code: 'DELETE_ERROR','''
          message: 'Failed to delete conversation','''
        },
      });
    }
  }
);

export default router;

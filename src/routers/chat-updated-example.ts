/**
 * Chat Router - Updated with Standardized Validation and Error Handling
 * Demonstrates migration to the new validation and error handling system
 */

import { type Request, type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type AgentRegistry from '@/agents/agent-registry';
import { authenticate } from '@/middleware/auth';
import { 
  validateRequestBody, 
  validateQueryParams, 
  validateParams,
  validateContentType,
  validateRequestSize 
} from '@/middleware/enhanced-validation';
import { 
  chatRequestSchema, 
  paginationSchema,
  idParamSchema,
  searchSchema 
} from '@/middleware/validation-schemas';
import {
  asyncErrorHandler,
  ApiNotFoundError,
  ApiValidationError,
  ApiServiceUnavailableError
} from '@/middleware/standardized-error-handler';
import { sendSuccess, sendPaginatedSuccess, sendError } from '@/utils/api-response';
import { singleFileAgentBridge } from '@/services/single-file-agent-bridge';
import type { AgentContext } from '@/types';
import { log, LogContext } from '@/utils/logger';

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
 * List all conversations for a user with pagination and search
 * UPDATED: Now uses standardized validation and error handling
 */
router.get('/conversations',
  // Validate query parameters with automatic type coercion
  validateQueryParams(searchSchema.partial(), {
    coerceTypes: true,
    sanitize: true
  }),
  
  // Authentication
  authenticate,
  
  // Route handler with async error handling
  asyncErrorHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || 'anonymous';
    const { query, page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query as any;

    log.info('Listing conversations', LogContext.API, {
      userId,
      query,
      page,
      limit,
    });

    let userConversations = Array.from(conversations.values())
      .filter((conv) => conv.userId === userId);

    // Apply search filter if provided
    if (query) {
      const searchTerm = query.toLowerCase();
      userConversations = userConversations.filter(conv => 
        conv.title.toLowerCase().includes(searchTerm) ||
        conv.messages.some(msg => msg.content.toLowerCase().includes(searchTerm))
      );
    }

    // Apply sorting
    userConversations.sort((a, b) => {
      const aValue = a[sortBy as keyof Conversation] as string;
      const bValue = b[sortBy as keyof Conversation] as string;
      const comparison = aValue.localeCompare(bValue);
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const total = userConversations.length;
    const offset = (page - 1) * limit;
    const paginatedConversations = userConversations
      .slice(offset, offset + limit)
      .map((conv) => ({
        id: conv.id,
        title: conv.title,
        messageCount: conv.messages.length,
        lastMessage: conv.messages[conv.messages.length - 1]?.content || '',
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }));

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    sendPaginatedSuccess(res, paginatedConversations, pagination);
  })
);

/**
 * GET /api/v1/chat/history/:conversationId
 * Get conversation history
 * UPDATED: Now uses standardized parameter validation
 */
router.get('/history/:conversationId',
  // Path parameter validation
  validateParams(idParamSchema),
  
  // Query parameter validation for pagination
  validateQueryParams(paginationSchema.partial(), {
    coerceTypes: true
  }),
  
  // Authentication
  authenticate,
  
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id: conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query as any;
    const userId = (req as any).user?.id || 'anonymous';

    log.debug('Fetching conversation history', LogContext.API, {
      conversationId,
      userId,
      page,
      limit,
    });

    const conversation = conversations.get(conversationId);
    
    if (!conversation) {
      throw new ApiNotFoundError('Conversation');
    }

    if (conversation.userId !== userId) {
      throw new ApiValidationError('Access denied to conversation');
    }

    // Apply pagination to messages
    const total = conversation.messages.length;
    const offset = (page - 1) * limit;
    const paginatedMessages = conversation.messages.slice(offset, offset + limit);

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };

    const responseData = {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        metadata: conversation.metadata,
      },
      messages: paginatedMessages,
    };

    sendPaginatedSuccess(res, responseData, pagination);
  })
);

/**
 * POST /api/v1/chat/send
 * Send a chat message
 * UPDATED: Now uses comprehensive validation and error handling
 */
router.post('/send',
  // Content type validation
  validateContentType('application/json'),
  
  // Request size limit (1MB)
  validateRequestSize(1024 * 1024),
  
  // Authentication
  authenticate,
  
  // Request body validation with sanitization
  validateRequestBody(chatRequestSchema, {
    sanitize: true,
    stripUnknown: true
  }),
  
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { message, chatId, model, temperature, maxTokens, stream } = req.body;
    const userId = (req as any).user?.id || 'anonymous';

    log.info('Processing chat message', LogContext.API, {
      userId,
      messageLength: message.length,
      model: model || 'default',
      chatId,
      stream,
    });

    // Get or create conversation
    let conversation = chatId ? conversations.get(chatId) : null;
    
    if (!conversation) {
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
    } else if (conversation.userId !== userId) {
      throw new ApiValidationError('Access denied to conversation');
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    conversation.messages.push(userMessage);

    try {
      // Simulate agent processing
      const agentContext: AgentContext = {
        userRequest: message,
        requestId: uuidv4(),
        userId,
        conversationHistory: conversation.messages.slice(-10), // Last 10 messages for context
      };

      // Check for service availability
      if (model === 'unavailable-model') {
        throw new ApiServiceUnavailableError('Chat model');
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate response
      const responseContent = model === 'error-model' 
        ? 'I apologize, but I encountered an error processing your request.'
        : `Hello! I received your message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}". How can I help you further?`;

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString(),
        metadata: {
          agentName: model || 'default',
          confidence: 0.95,
          tokens: Math.floor(responseContent.length / 4), // Rough token estimate
        },
      };

      conversation.messages.push(assistantMessage);
      conversation.updatedAt = new Date().toISOString();

      // Update metadata
      conversation.metadata.totalTokens += assistantMessage.metadata?.tokens || 0;
      const agentName = assistantMessage.metadata?.agentName || 'default';
      conversation.metadata.agentUsage[agentName] = 
        (conversation.metadata.agentUsage[agentName] || 0) + 1;

      const responseData = {
        conversationId: conversation.id,
        message: assistantMessage,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          messageCount: conversation.messages.length,
        },
      };

      sendSuccess(res, responseData, 201, {
        model: model || 'default',
        tokensUsed: assistantMessage.metadata?.tokens || 0,
      });

    } catch (error) {
      log.error('Chat processing error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        userId,
        conversationId: conversation.id,
      });

      // Add error message to conversation
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
      conversation.messages.push(errorMessage);
      conversation.updatedAt = new Date().toISOString();

      // Re-throw the error to be handled by the standardized error handler
      throw error;
    }
  })
);

/**
 * DELETE /api/v1/chat/conversations/:conversationId
 * Delete a conversation
 * UPDATED: Now uses standardized validation and error handling
 */
router.delete('/conversations/:conversationId',
  // Path parameter validation
  validateParams(idParamSchema),
  
  // Authentication
  authenticate,
  
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id: conversationId } = req.params;
    const userId = (req as any).user?.id || 'anonymous';

    log.info('Deleting conversation', LogContext.API, {
      conversationId,
      userId,
    });

    const conversation = conversations.get(conversationId);
    
    if (!conversation) {
      throw new ApiNotFoundError('Conversation');
    }

    if (conversation.userId !== userId) {
      throw new ApiValidationError('Access denied to conversation');
    }

    conversations.delete(conversationId);

    sendSuccess(res, { 
      deleted: true, 
      conversationId 
    }, 200, {
      messageCount: conversation.messages.length,
    });
  })
);

export default router;

// Example of how to integrate with Express app:
/*
import chatRouter from './routers/chat-updated-example';

app.use('/api/v1/chat', chatRouter);
*/

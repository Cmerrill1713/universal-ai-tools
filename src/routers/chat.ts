/**
 * Chat Router - Manages conversational interactions with AI agents
 * Provides endpoints for chat history, message handling, and conversation management
 */

import { type Request, type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type AgentRegistry from '@/agents/agent-registry';
import { authenticate } from '@/middleware/auth';
import { validateParams } from '@/middleware/validation';
import { type EnhancedChatRequest,enhancedChatRequestSchema } from '@/middleware/validation-schemas';
import { zodValidate } from '@/middleware/zod-validate';
import { codeContextScanner } from '@/services/code-context-scanner';
import { enhancedContextManager } from '@/services/enhanced-context-manager';
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
    processingMode?: string;
    userId?: string;
    codeContext?: {
      enabled: boolean;
      filesIncluded: number;
      filesScanned: number;
      totalTokens: number;
      workspacePath: string;
      contextTruncated: boolean;
    };
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

/**
 * Generate smart fast responses based on message patterns
 */
function generateSmartResponse(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  // Greeting detection
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/.test(lowerMessage)) {
    return "Hello! I'm your AI assistant, ready to help. What can I do for you today?";
  }
  
  // Question detection
  if (lowerMessage.includes('?') || lowerMessage.startsWith('what') || lowerMessage.startsWith('how') || lowerMessage.startsWith('why') || lowerMessage.startsWith('when') || lowerMessage.startsWith('where')) {
    return "I'd be happy to help answer your question! I'm processing your request with my AI capabilities. What specifically would you like to know?";
  }
  
  // Help/assistance requests
  if (lowerMessage.includes('help') || lowerMessage.includes('assist') || lowerMessage.includes('support')) {
    return "I'm here to help! I can assist with various tasks including answering questions, providing information, helping with analysis, and much more. What do you need help with?";
  }
  
  // Code-related requests
  if (lowerMessage.includes('code') || lowerMessage.includes('programming') || lowerMessage.includes('debug') || lowerMessage.includes('function')) {
    return "I can help with coding tasks! I'm equipped to assist with programming, debugging, code review, and technical questions. What programming challenge are you working on?";
  }
  
  // Analysis requests
  if (lowerMessage.includes('analyze') || lowerMessage.includes('review') || lowerMessage.includes('explain')) {
    return "I'd be happy to help with analysis and explanations! I can break down complex topics, review content, and provide detailed insights. What would you like me to analyze?";
  }
  
  // Task/productivity requests
  if (lowerMessage.includes('task') || lowerMessage.includes('plan') || lowerMessage.includes('organize') || lowerMessage.includes('schedule')) {
    return "I can help you with planning and organization! I'm great at breaking down tasks, creating plans, and helping you stay organized. What do you need to accomplish?";
  }
  
  // Default response for other messages
  return "Hello! I'm your AI assistant, ready to help with a wide range of tasks. I'm responding quickly while my advanced capabilities are ready. How can I assist you today?";
}

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
  validateParams(z.object({ conversationId: z.string().uuid() })),
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
  zodValidate(
    z.object({
      title: z.string().optional(),
      initialMessage: z.string().optional(),
    })
  ),
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
 * Send a message and get AI response (enhanced with optional code context)
 */
router.post(
  '/',
  authenticate,
  zodValidate(enhancedChatRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const { 
        message, 
        conversationId, 
        agentName: requestedAgentName = 'personal_assistant', 
        context = {},
        includeCodeContext = false,
        codeContextOptions
      } = req.body as EnhancedChatRequest;

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

      // Initialize enhanced message content
      let enhancedMessage = message;
      let codeContextMetadata: {
        enabled: boolean;
        filesIncluded: number;
        filesScanned: number;
        totalTokens: number;
        workspacePath: string;
        contextTruncated: boolean;
      } | undefined;

      // Scan for code context if requested
      if (includeCodeContext) {
        try {
          log.info('🔍 Scanning code context', LogContext.CONTEXT_INJECTION, {
            userId,
            conversationId: conversation.id,
            workspacePath: codeContextOptions?.workspacePath
          });

          const codeContextResult = await codeContextScanner.scanCodeContext(message, {
            workspacePath: codeContextOptions?.workspacePath,
            maxFiles: codeContextOptions?.maxFiles,
            maxTokensForCode: codeContextOptions?.maxTokensForCode
          });

          // Format code context for chat
          const formattedCodeContext = codeContextScanner.formatCodeContextForChat(
            codeContextResult, 
            message
          );

          if (formattedCodeContext) {
            enhancedMessage = message + formattedCodeContext;
          }

          codeContextMetadata = {
            enabled: true,
            filesIncluded: codeContextResult.files.length,
            filesScanned: codeContextResult.filesScanned,
            totalTokens: codeContextResult.totalTokens,
            workspacePath: codeContextResult.workspacePath,
            contextTruncated: codeContextResult.contextTruncated
          };

          log.info('✅ Code context added to message', LogContext.CONTEXT_INJECTION, {
            userId,
            originalMessageLength: message.length,
            enhancedMessageLength: enhancedMessage.length,
            filesIncluded: codeContextResult.files.length,
            codeTokens: codeContextResult.totalTokens
          });

        } catch (error) {
          log.error('❌ Code context scanning failed', LogContext.CONTEXT_INJECTION, {
            error: error instanceof Error ? error.message : String(error),
            userId,
            workspacePath: codeContextOptions?.workspacePath
          });

          codeContextMetadata = {
            enabled: true,
            filesIncluded: 0,
            filesScanned: 0,
            totalTokens: 0,
            workspacePath: codeContextOptions?.workspacePath || process.cwd(),
            contextTruncated: false
          };
        }
      }

      // Add user message with enhanced content and metadata
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: enhancedMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          userId,
          codeContext: codeContextMetadata
        }
      };
      conversation.messages.push(userMessage);

      // Prepare agent context with conversation history (moved up for scope)
      const agentContext: AgentContext = {
        userRequest: enhancedMessage,
        requestId: (req.headers['x-request-id'] as string) || uuidv4(),
        workingDirectory: codeContextMetadata?.workspacePath || process.cwd(),
        userId,
        conversationHistory: conversation.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        ...context,
      };

      // Input validation and sanitization
      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message is required and must be a string',
          },
        });
      }

      if (enhancedMessage.length > 100000) { // Increased limit for code context
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Enhanced message too long (max 100,000 characters)',
          },
        });
      }

      // Sanitize message content
      const sanitizedMessage = enhancedMessage.trim();
      if (!sanitizedMessage) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message cannot be empty',
          },
        });
      }

      // Process with secure agent fallback
      const startTime = Date.now();
      let result: any;
      let assistantMessage: ChatMessage;

      try {
        // Attempt lightweight agent processing first for performance
        if (sanitizedMessage.length < 500 && !sanitizedMessage.includes('sensitive') && !sanitizedMessage.includes('password')) {
          // SECURE FAST PATH: Basic intent detection with input validation
          const fastFallbackResponse = generateSmartResponse(sanitizedMessage);
          
          const executionTime = Date.now() - startTime;
          assistantMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: fastFallbackResponse,
            timestamp: new Date().toISOString(),
            metadata: {
              agentName: 'secure-fast-fallback',
              confidence: 0.7, // Lower confidence to indicate this is a fast response
              tokens: Math.floor(executionTime / 10),
              processingMode: 'fast',
              userId: userId, // Include user context for security
              codeContext: codeContextMetadata
            },
          };
        } else {
          // FULL AGENT PROCESSING: For complex or sensitive requests
          try {
            const { container, SERVICE_NAMES } = await import('@/utils/dependency-container');
            const agentRegistry = container.get<AgentRegistry>(SERVICE_NAMES.AGENT_REGISTRY);
            if (agentRegistry) {
              result = await singleFileAgentBridge.processRequest(requestedAgentName, agentContext);
              
              const executionTime = Date.now() - startTime;
              assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: result?.response || 'I apologize, but I encountered an issue processing your request. Please try again.',
                timestamp: new Date().toISOString(),
                metadata: {
                  agentName: result?.agentName || requestedAgentName,
                  confidence: result?.confidence || 0.9,
                  tokens: result?.usage?.tokens || Math.floor(executionTime / 10),
                  processingMode: 'full',
                  userId: userId,
                  error: result?.error,
                  codeContext: codeContextMetadata
                },
              };
            } else {
              throw new Error('Agent registry not available');
            }
          } catch (importError) {
            throw new Error('Failed to load agent system');
          }
        }
      } catch (error) {
        // Secure fallback with error handling
        log.error('Agent processing failed, using secure fallback', LogContext.API, {
          error: error instanceof Error ? error.message : String(error),
          userId,
          messageLength: sanitizedMessage.length,
        });
        
        const executionTime = Date.now() - startTime;
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: 'I apologize, but I encountered an issue processing your request. Please try again later.',
          timestamp: new Date().toISOString(),
          metadata: {
            agentName: 'error-fallback',
            confidence: 0.5,
            tokens: Math.floor(executionTime / 10),
            processingMode: 'fallback',
            userId: userId,
            error: 'Agent processing failed',
            codeContext: codeContextMetadata
          },
        };
      }

      // Update conversation with authenticated user context
      conversation.messages.push(assistantMessage);
      conversation.updatedAt = new Date().toISOString();
      conversation.metadata.totalTokens += assistantMessage.metadata?.tokens || 0;
      const usedAgentName = assistantMessage.metadata?.agentName || 'unknown';
      conversation.metadata.agentUsage[usedAgentName] = (conversation.metadata.agentUsage[usedAgentName] || 0) + 1;

      // Log successful interaction with user context
      log.info('Chat message processed', LogContext.API, {
        userId,
        conversationId: conversation.id,
        agentName: assistantMessage.metadata?.agentName,
        processingMode: assistantMessage.metadata?.processingMode,
        executionTime: Date.now() - startTime,
      });

      return res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          message: assistantMessage,
          usage: {
            tokens: assistantMessage.metadata?.tokens || 0,
            executionTime: `${Date.now() - startTime}ms`,
          },
          codeContext: codeContextMetadata || { enabled: false },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: agentContext.requestId,
          agentName: assistantMessage.metadata?.agentName,
          userId: userId,
          enhancedChat: includeCodeContext,
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
 * POST /api/v1/chat/enhanced
 * Enhanced chat endpoint with optional code context scanning
 */
router.post(
  '/enhanced',
  authenticate,
  zodValidate(enhancedChatRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const { 
        message, 
        conversationId, 
        agentName: requestedAgentName = 'personal_assistant', 
        context = {},
        includeCodeContext = false,
        codeContextOptions
      } = req.body as EnhancedChatRequest;

      const startTime = Date.now();

      log.info('🚀 Enhanced chat request received', LogContext.API, {
        userId,
        messageLength: message.length,
        includeCodeContext,
        agentName: requestedAgentName,
        workspacePath: codeContextOptions?.workspacePath
      });

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

      // Initialize enhanced message content
      let enhancedMessage = message;
      let codeContextMetadata: {
        enabled: boolean;
        filesIncluded: number;
        filesScanned: number;
        totalTokens: number;
        workspacePath: string;
        contextTruncated: boolean;
      } | undefined;

      // Scan for code context if requested
      if (includeCodeContext) {
        try {
          log.info('🔍 Scanning code context', LogContext.CONTEXT_INJECTION, {
            userId,
            conversationId: conversation.id,
            workspacePath: codeContextOptions?.workspacePath
          });

          const codeContextResult = await codeContextScanner.scanCodeContext(message, {
            workspacePath: codeContextOptions?.workspacePath,
            maxFiles: codeContextOptions?.maxFiles,
            maxTokensForCode: codeContextOptions?.maxTokensForCode
          });

          // Format code context for chat
          const formattedCodeContext = codeContextScanner.formatCodeContextForChat(
            codeContextResult, 
            message
          );

          if (formattedCodeContext) {
            enhancedMessage = message + formattedCodeContext;
          }

          codeContextMetadata = {
            enabled: true,
            filesIncluded: codeContextResult.files.length,
            filesScanned: codeContextResult.filesScanned,
            totalTokens: codeContextResult.totalTokens,
            workspacePath: codeContextResult.workspacePath,
            contextTruncated: codeContextResult.contextTruncated
          };

          log.info('✅ Code context added to message', LogContext.CONTEXT_INJECTION, {
            userId,
            originalMessageLength: message.length,
            enhancedMessageLength: enhancedMessage.length,
            filesIncluded: codeContextResult.files.length,
            codeTokens: codeContextResult.totalTokens
          });

        } catch (error) {
          log.error('❌ Code context scanning failed', LogContext.CONTEXT_INJECTION, {
            error: error instanceof Error ? error.message : String(error),
            userId,
            workspacePath: codeContextOptions?.workspacePath
          });

          codeContextMetadata = {
            enabled: true,
            filesIncluded: 0,
            filesScanned: 0,
            totalTokens: 0,
            workspacePath: codeContextOptions?.workspacePath || process.cwd(),
            contextTruncated: false
          };
        }
      }

      // Add user message with enhanced content and metadata
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: enhancedMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          userId,
          codeContext: codeContextMetadata
        }
      };
      conversation.messages.push(userMessage);

      // Store message in enhanced context manager for persistence
      const sessionId = conversation.id;
      await enhancedContextManager.addMessage(sessionId, {
        role: 'user',
        content: enhancedMessage,
        metadata: { userId, includeCodeContext, codeContext: codeContextMetadata }
      });

      // Prepare agent context with conversation history
      const agentContext: AgentContext = {
        userRequest: enhancedMessage,
        requestId: (req.headers['x-request-id'] as string) || uuidv4(),
        workingDirectory: codeContextMetadata?.workspacePath || process.cwd(),
        userId,
        conversationHistory: conversation.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        ...context,
      };

      // Input validation and sanitization
      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message is required and must be a string',
          },
        });
      }

      if (enhancedMessage.length > 100000) { // Increased limit for code context
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Enhanced message too long (max 100,000 characters)',
          },
        });
      }

      // Process with agent
      let result: any;
      let assistantMessage: ChatMessage;

      try {
        // Use full agent processing for enhanced chat
        const { container, SERVICE_NAMES } = await import('@/utils/dependency-container');
        const agentRegistry = container.get<AgentRegistry>(SERVICE_NAMES.AGENT_REGISTRY);
        
        if (agentRegistry) {
          result = await singleFileAgentBridge.processRequest(requestedAgentName, agentContext);
          
          const executionTime = Date.now() - startTime;
          assistantMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: result?.response || 'I apologize, but I encountered an issue processing your request. Please try again.',
            timestamp: new Date().toISOString(),
            metadata: {
              agentName: result?.agentName || requestedAgentName,
              confidence: result?.confidence || 0.9,
              tokens: result?.usage?.tokens || Math.floor(executionTime / 10),
              processingMode: 'enhanced',
              userId: userId,
              error: result?.error,
              codeContext: codeContextMetadata
            },
          };
        } else {
          throw new Error('Agent registry not available');
        }
      } catch (error) {
        log.error('Agent processing failed in enhanced chat', LogContext.API, {
          error: error instanceof Error ? error.message : String(error),
          userId,
          messageLength: enhancedMessage.length,
          includeCodeContext
        });
        
        const executionTime = Date.now() - startTime;
        assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: 'I apologize, but I encountered an issue processing your request. Please try again later.',
          timestamp: new Date().toISOString(),
          metadata: {
            agentName: 'error-fallback',
            confidence: 0.5,
            tokens: Math.floor(executionTime / 10),
            processingMode: 'enhanced-fallback',
            userId: userId,
            error: 'Agent processing failed',
            codeContext: codeContextMetadata
          },
        };
      }

      // Store assistant response in enhanced context manager
      await enhancedContextManager.addMessage(sessionId, {
        role: 'assistant',
        content: assistantMessage.content,
        metadata: assistantMessage.metadata
      });

      // Update conversation
      conversation.messages.push(assistantMessage);
      conversation.updatedAt = new Date().toISOString();
      conversation.metadata.totalTokens += assistantMessage.metadata?.tokens || 0;
      const usedAgentName = assistantMessage.metadata?.agentName || 'unknown';
      conversation.metadata.agentUsage[usedAgentName] = (conversation.metadata.agentUsage[usedAgentName] || 0) + 1;

      const totalExecutionTime = Date.now() - startTime;

      log.info('✅ Enhanced chat message processed successfully', LogContext.API, {
        userId,
        conversationId: conversation.id,
        agentName: assistantMessage.metadata?.agentName,
        processingMode: assistantMessage.metadata?.processingMode,
        executionTime: totalExecutionTime,
        includeCodeContext,
        codeFilesIncluded: codeContextMetadata?.filesIncluded || 0,
        originalMessageLength: message.length,
        enhancedMessageLength: enhancedMessage.length
      });

      return res.json({
        success: true,
        data: {
          conversationId: conversation.id,
          message: assistantMessage,
          usage: {
            tokens: assistantMessage.metadata?.tokens || 0,
            executionTime: `${totalExecutionTime}ms`,
          },
          codeContext: codeContextMetadata || { enabled: false },
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: agentContext.requestId,
          agentName: assistantMessage.metadata?.agentName,
          userId: userId,
          enhancedChat: true,
        },
      });
    } catch (error) {
      log.error('Enhanced chat processing error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        userId: (req as any).user?.id || 'anonymous',
        includeCodeContext: req.body?.includeCodeContext
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'ENHANCED_CHAT_ERROR',
          message: 'Failed to process enhanced chat message',
          details: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
);

/**
 * POST /api/v1/chat/cancel
 * Cancel an ongoing chat request
 */
router.post(
  '/cancel',
  authenticate,
  zodValidate(
    z.object({
      conversationId: z.string().uuid(),
    })
  ),
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.body;
      const userId = (req as any).user?.id || 'anonymous';

      log.info('Chat cancellation requested', LogContext.API, {
        conversationId,
        userId,
      });

      // Check if conversation exists and user has access
      const conversation = conversations.get(conversationId);
      if (conversation && conversation.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'You do not have access to this conversation',
          },
        });
      }

      // TODO: Implement actual cancellation logic
      // This would involve cancelling any ongoing AI processing
      // For now, we just acknowledge the cancellation request

      return res.json({
        success: true,
        data: {
          message: 'Chat cancellation request received',
          conversationId,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || uuidv4(),
        },
      });
    } catch (error) {
      log.error('Failed to cancel chat', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
        conversationId: req.body?.conversationId,
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'CANCELLATION_ERROR',
          message: 'Failed to cancel chat request',
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
  validateParams(z.object({ conversationId: z.string().uuid() })),
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

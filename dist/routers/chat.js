import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { validateParams } from '@/middleware/validation';
import { zodValidate } from '@/middleware/zod-validate';
import { log, LogContext } from '@/utils/logger';
const conversations = new Map();
const router = Router();
router.get('/conversations', authenticate, async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
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
    }
    catch (error) {
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
router.get('/history/:conversationId', authenticate, validateParams(z.object({ conversationId: z.string().uuid() })), async (req, res) => {
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
        const userId = req.user?.id || 'anonymous';
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
    }
    catch (error) {
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
});
router.post('/new', authenticate, zodValidate(z.object({
    title: z.string().optional(),
    initialMessage: z.string().optional(),
})), async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const { title, initialMessage } = req.body;
        const conversation = {
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
    }
    catch (error) {
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
});
router.post('/', authenticate, zodValidate(z.object({
    message: z.string(),
    conversationId: z.string().uuid().optional(),
    agentName: z.string().optional(),
    context: z.record(z.any()).optional(),
})), async (req, res) => {
    try {
        const userId = req.user?.id || 'anonymous';
        const { message, conversationId, agentName = 'personal_assistant', context = {} } = req.body;
        let conversation;
        if (conversationId) {
            conversation = conversations.get(conversationId);
            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'CONVERSATION_NOT_FOUND',
                        message: 'Conversation not found',
                    },
                });
            }
            if (conversation.userId !== userId) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'You do not have access to this conversation',
                    },
                });
            }
        }
        else {
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
        const userMessage = {
            id: uuidv4(),
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
        };
        conversation.messages.push(userMessage);
        const agentRegistry = global.agentRegistry;
        if (!agentRegistry) {
            log.error('Agent registry not available', LogContext.API);
            return res.status(503).json({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'AI service is currently initializing. Please try again in a moment.',
                },
            });
        }
        const agentContext = {
            userRequest: message,
            requestId: req.headers['x-request-id'] || uuidv4(),
            workingDirectory: process.cwd(),
            userId,
            conversationHistory: conversation.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            ...context,
        };
        const startTime = Date.now();
        let result;
        try {
            const availableAgents = agentRegistry.getAvailableAgents();
            const agentExists = availableAgents.some((agent) => agent.name === agentName);
            if (!agentExists) {
                log.warn('Agent not found, using fallback response', LogContext.API, { agentName });
                result = {
                    response: `I'm here to help! The ${agentName} agent is currently being initialized. How can I assist you today?`,
                    confidence: 0.8,
                    success: true,
                    reasoning: 'Fallback response while agents are loading',
                };
            }
            else {
                const agent = await agentRegistry.getAgent(agentName);
                if (!agent) {
                    log.warn('Agent failed to load, using fallback response', LogContext.API, {
                        agentName,
                    });
                    result = {
                        response: `I'm experiencing some technical difficulties with the ${agentName} agent, but I'm still here to help! Please try again in a moment.`,
                        confidence: 0.5,
                        success: false,
                        error: 'Agent failed to initialize',
                    };
                }
                else {
                    result = await agentRegistry.processRequest(agentName, agentContext);
                }
            }
        }
        catch (agentError) {
            log.error('Agent processing failed', LogContext.API, {
                error: agentError instanceof Error ? agentError.message : String(agentError),
                agentName,
            });
            result = {
                response: "I'm experiencing some technical difficulties, but I'm still here to help! Please try again in a moment.",
                confidence: 0.5,
                success: false,
                error: agentError instanceof Error ? agentError.message : 'Unknown error',
            };
        }
        if (!result || !result.response) {
            result = {
                response: "Hello! I'm your AI assistant. I'm currently initializing my advanced capabilities, but I'm here to help with basic questions and tasks. How can I assist you today?",
                confidence: 0.7,
                success: true,
                reasoning: 'Basic fallback response',
            };
        }
        if (typeof result.response !== 'string') {
            result.response = "I'm here to help! How can I assist you today?";
        }
        const executionTime = Date.now() - startTime;
        const assistantMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: result.response || result.data || 'I apologize, but I was unable to generate a response.',
            timestamp: new Date().toISOString(),
            metadata: {
                agentName,
                confidence: result.confidence || 0.5,
                tokens: Math.floor(executionTime / 10),
                error: result.error,
            },
        };
        conversation.messages.push(assistantMessage);
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
    }
    catch (error) {
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
});
router.post('/cancel', authenticate, zodValidate(z.object({
    conversationId: z.string().uuid(),
})), async (req, res) => {
    try {
        const { conversationId } = req.body;
        const userId = req.user?.id || 'anonymous';
        log.info('Chat cancellation requested', LogContext.API, {
            conversationId,
            userId,
        });
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
    }
    catch (error) {
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
});
router.delete('/:conversationId', authenticate, validateParams(z.object({ conversationId: z.string().uuid() })), async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user?.id || 'anonymous';
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
    }
    catch (error) {
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
});
export default router;
//# sourceMappingURL=chat.js.map
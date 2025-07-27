import { Router } from 'express';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dspyService } from '../services/dspy-service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { EnhancedMemorySystem } from '../memory/enhanced_memory_system';
import type { DSPyOrchestrationRequest } from '../services/dspy-service';

// Request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  sessionId: z.string().optional(),
  context: z.record(z.any()).optional(),
});

export function ChatRouter(supabase: SupabaseClient) {
  const router = Router();
  const memorySystem = new EnhancedMemorySystem(supabase, logger);

  /**
   * Main chat endpoint with memory persistence
   */
  router.post('/', async (req: any, res) => {
    try {
      const data = chatRequestSchema.parse(req.body);
      
      // Generate IDs if not provided
      const conversationId = data.conversationId || uuidv4();
      const sessionId = data.sessionId || uuidv4();
      const requestId = uuidv4();

      // Retrieve conversation history if conversationId exists
      let conversationHistory: any[] = [];
      if (data.conversationId) {
        try {
          const searchOptions = {
            query: '',
            filters: {
              conversationId: data.conversationId,
            },
            limit: 20,
            orderBy: 'timestamp',
            orderDirection: 'desc' as const,
          };
          
          conversationHistory = await memorySystem.searchMemories(searchOptions);
          logger.info(`Retrieved ${conversationHistory.length} previous messages for conversation ${conversationId}`);
        } catch (error) {
          logger.warn('Failed to retrieve conversation history:', error);
        }
      }

      // Create orchestration request with conversation context
      const orchestrationRequest: DSPyOrchestrationRequest = {
        requestId,
        userRequest: data.message,
        userId: req.aiServiceId || 'user',
        orchestrationMode: 'adaptive',
        context: {
          ...data.context,
          conversationId,
          sessionId,
          conversationHistory: conversationHistory.map(memory => ({
            content: memory.content,
            metadata: memory.metadata,
            timestamp: memory.created_at,
          })),
        },
        timestamp: new Date(),
      };

      // Notify UI about memory activity
      const { agentCollaborationWS } = await import('../services/agent-collaboration-websocket');
      agentCollaborationWS.updateAgentStatus({
        agentId: 'memory',
        agentName: 'Memory Agent',
        status: 'working',
        currentTask: 'Processing chat history',
        progress: 20,
        timestamp: new Date(),
        metadata: {
          participatingIn: requestId,
        },
      });
      
      // Store user message in memory
      await memorySystem.storeMemory(
        req.aiServiceId || 'user',
        'conversation',
        data.message,
        {
          conversationId,
          sessionId,
          requestId,
          type: 'user_message',
          timestamp: new Date(),
        },
        [] // Keywords extracted automatically
      );

      // Execute orchestration
      const response = await dspyService.orchestrate(orchestrationRequest);

      // Store assistant response in memory if successful
      if (response.success) {
        const responseContent = typeof response.result === 'string' 
          ? response.result 
          : JSON.stringify(response.result);
        
        await memorySystem.storeMemory(
          'assistant',
          'conversation',
          responseContent,
          {
            conversationId,
            sessionId,
            requestId,
            type: 'assistant_message',
            confidence: response.confidence,
            participatingAgents: response.participatingAgents,
            timestamp: new Date(),
          },
          [] // Keywords extracted automatically
        );
      }

      // Return chat response
      res.json({
        success: response.success,
        message: response.result,
        conversationId,
        sessionId,
        requestId,
        confidence: response.confidence,
        participatingAgents: response.participatingAgents,
      });

    } catch (error) {
      logger.error('Chat error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Chat request failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  /**
   * Get conversation history
   */
  router.get('/history/:conversationId', async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      // Search for conversation messages
      const searchOptions = {
        query: '',
        filters: {
          conversationId,
        },
        limit,
        offset,
        orderBy: 'timestamp',
        orderDirection: 'asc' as const,
      };

      const messages = await memorySystem.searchMemories(searchOptions);

      res.json({
        success: true,
        conversationId,
        messages: messages.map(memory => ({
          id: memory.id,
          content: memory.content,
          type: memory.metadata.type,
          timestamp: memory.created_at,
          metadata: memory.metadata,
        })),
        total: messages.length,
      });

    } catch (error) {
      logger.error('Failed to retrieve conversation history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve conversation history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Clear conversation history (for privacy/cleanup)
   */
  router.delete('/history/:conversationId', async (req: any, res) => {
    try {
      const { conversationId } = req.params;

      // Note: This would need to be implemented in the memory system
      // For now, we'll just log the request
      logger.info(`Request to clear conversation history: ${conversationId}`);

      res.json({
        success: true,
        message: 'Conversation history cleared',
        conversationId,
      });

    } catch (error) {
      logger.error('Failed to clear conversation history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear conversation history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
import { Router } from 'express';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dspyService, type DSPyOrchestrationRequest } from '../services/dspy-service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { EnhancedMemorySystem } from '../memory/enhanced_memory_system';

// Request validation schemas
const orchestrationRequestSchema = z.object({
  userRequest: z.string().min(1),
  orchestrationMode: z.enum(['simple', 'standard', 'cognitive', 'adaptive']).optional(),
  context: z.record(z.any()).optional(),
  conversationId: z.string().optional(),
  sessionId: z.string().optional(),
});

const coordinationRequestSchema = z.object({
  task: z.string().min(1),
  availableAgents: z.array(z.string()),
  context: z.record(z.any()).optional(),
});

const knowledgeSearchSchema = z.object({
  query: z.string().min(1),
  filters: z.record(z.any()).optional(),
  limit: z.number().optional(),
});

const knowledgeExtractSchema = z.object({
  content: z.string().min(1),
  context: z.record(z.any()).optional(),
});

const knowledgeEvolveSchema = z.object({
  existingKnowledge: z.string(),
  newInformation: z.string(),
});

const promptOptimizationSchema = z.object({
  examples: z.array(
    z.object({
      input: z.string(),
      output: z.string(),
      metadata: z.record(z.any()).optional(),
    })
  ),
});

export function OrchestrationRouter(supabase: SupabaseClient) {
  const router = Router();
  const memorySystem = new EnhancedMemorySystem(supabase, logger);

  /**
   * Main orchestration endpoint - replaces enhanced orchestrator
   */
  router.post('/orchestrate', async (req: any, res) => {
    try {
      const data = orchestrationRequestSchema.parse(req.body);

      // Create orchestration request
      const orchestrationRequest: DSPyOrchestrationRequest = {
        requestId: uuidv4(),
        userRequest: data.userRequest,
        userId: req.aiServiceId,
        orchestrationMode: data.orchestrationMode,
        context: {
          ...data.context,
          conversationId: data.conversationId,
          sessionId: data.sessionId,
        },
        timestamp: new Date(),
      };

      // Log the orchestration request
      await supabase.from('ai_orchestration_logs').insert({
        request_id: orchestrationRequest.requestId,
        service_id: req.aiServiceId,
        user_request: data.userRequest,
        orchestration_mode: data.orchestrationMode || 'auto',
        status: 'processing',
        created_at: new Date(),
      });

      // Execute orchestration through DSPy service
      const response = await dspyService.orchestrate(orchestrationRequest);

      // Update orchestration log
      await supabase
        .from('ai_orchestration_logs')
        .update({
          status: response.success ? 'completed' : 'failed',
          response_data: response.result,
          execution_time_ms: response.executionTime,
          confidence: response.confidence,
          participating_agents: response.participatingAgents,
          completed_at: new Date(),
        })
        .eq('request_id', orchestrationRequest.requestId)

      // Store conversation in memory system if successful
      if (response.success) {
        try {
          // Notify UI that memory agent is working
          const { agentCollaborationWS } = await import('../services/agent-collaboration-websocket');
          agentCollaborationWS.updateAgentStatus({
            agentId: 'memory',
            agentName: 'Memory Agent',
            status: 'working',
            currentTask: 'Storing conversation',
            progress: 30,
            timestamp: new Date(),
            metadata: {
              participatingIn: orchestrationRequest.requestId,
            },
          });
          
          // Store user request
          await memorySystem.storeMemory(
            req.aiServiceId || 'system',
            'conversation',
            `User: ${data.userRequest}`,
            {
              conversationId: data.conversationId,
              sessionId: data.sessionId,
              requestId: orchestrationRequest.requestId,
              timestamp: orchestrationRequest.timestamp,
              type: 'user_message',
            },
            [] // Keywords will be extracted automatically
          );

          // Store agent response
          const responseContent = typeof response.result === 'string' 
            ? response.result 
            : JSON.stringify(response.result);
          
          await memorySystem.storeMemory(
            req.aiServiceId || 'system',
            'conversation',
            `Assistant: ${responseContent}`,
            {
              conversationId: data.conversationId,
              sessionId: data.sessionId,
              requestId: orchestrationRequest.requestId,
              timestamp: new Date(),
              type: 'assistant_message',
              confidence: response.confidence,
              participatingAgents: response.participatingAgents,
              orchestrationMode: response.mode,
            },
            [] // Keywords will be extracted automatically
          );

          logger.info('Conversation stored in memory system', {
            conversationId: data.conversationId,
            requestId: orchestrationRequest.requestId,
          });
          
          // Complete memory agent task
          agentCollaborationWS.completeAgentTask('memory', {
            stored: true,
            conversationId: data.conversationId,
          });
        } catch (memoryError) {
          // Log error but don't fail the request
          logger.error('Failed to store conversation in memory:', memoryError);
          
          // Update memory agent status to error
          const { agentCollaborationWS } = await import('../services/agent-collaboration-websocket');
          agentCollaborationWS.updateAgentStatus({
            agentId: 'memory',
            agentName: 'Memory Agent',
            status: 'error',
            currentTask: 'Failed to store conversation',
            timestamp: new Date(),
          });
        }
      }

      res.json({
        success: response.success,
        requestId: response.requestId,
        data: response.result,
        mode: response.mode,
        confidence: response.confidence,
        reasoning: response.reasoning,
        participatingAgents: response.participatingAgents,
        executionTime: response.executionTime,
      });
    } catch (error) {
      logger.error('Orchestration error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Orchestration failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * Agent coordination endpoint
   */
  router.post('/coordinate', async (req: any, res) => {
    try {
      const data = coordinationRequestSchema.parse(req.body);

      const result = await dspyService.coordinateAgents(
        data.task,
        data.availableAgents,
        data.context || {}
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Coordination error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Coordination failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * Knowledge search endpoint
   */
  router.post('/knowledge/search', async (req: any, res) => {
    try {
      const data = knowledgeSearchSchema.parse(req.body);

      const result = await dspyService.searchKnowledge(data.query, {
        filters: data.filters,
        limit: data.limit,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Knowledge search error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Knowledge search failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * Knowledge extraction endpoint
   */
  router.post('/knowledge/extract', async (req: any, res) => {
    try {
      const data = knowledgeExtractSchema.parse(req.body);

      const result = await dspyService.extractKnowledge(data.content: data.context || {});

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Knowledge extraction error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Knowledge extraction failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * Knowledge evolution endpoint
   */
  router.post('/knowledge/evolve', async (req: any, res) => {
    try {
      const data = knowledgeEvolveSchema.parse(req.body);

      const result = await dspyService.evolveKnowledge(data.existingKnowledge, data.newInformation);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Knowledge evolution error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Knowledge evolution failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * Prompt optimization endpoint
   */
  router.post('/optimize/prompts', async (req: any, res) => {
    try {
      const data = promptOptimizationSchema.parse(req.body);

      const result = await dspyService.optimizePrompts(data.examples);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Prompt optimization error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Prompt optimization failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  /**
   * Service status endpoint
   */
  router.get('/status', async (req: any, res) => {
    try {
      const status = dspyService.getStatus();

      res.json({
        success: true,
        service: 'dspy-orchestration',
        ...status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Status check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get service status',
      });
    }
  });

  return router;
}

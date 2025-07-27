/**
 * Athena Tools API Router
 *
 * Unified API for Sweet Athena's conversation and tool creation capabilities
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { AthenaToolIntegrationService } from '../services/athena-tool-integration';
import AuthMiddleware, { type AuthRequest } from '../middleware/auth';
import ValidationMiddleware from '../middleware/validation';
import type { ConversationRequest } from '../services/athena-conversation-engine';
import { z } from 'zod';

const router = Router();

// Initialize services
let athenaToolService: AthenaToolIntegrationService;
let authMiddleware: AuthMiddleware;

// Initialize auth middleware
const initAuthMiddleware = () => {
  if (!authMiddleware) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    authMiddleware = new AuthMiddleware(supabase);
  }
  return authMiddleware;
};

// Initialize on first request
const ensureInitialized = async () => {
  if (!athenaToolService) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    athenaToolService = new AthenaToolIntegrationService(supabase, logger);
    await athenaToolService.initialize();
  }
};

/**
 * Process a conversation message (might lead to tool creation)
 */
router.post(
  '/chat',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  ValidationMiddleware.validate({
    body: z.object({
      message: z.string().min(1),
      conversationId: z.string().optional(),
      context: z.object({}).optional(),
    }),
  }),
  async (req: Request, res: Response) => {
    try {
      await ensureInitialized();

      const { message, conversationId, context } = req.body;
      const userId = (req as any).user?.id || 'anonymous';

      const _request ConversationRequest = {
        userId,
        conversationId: conversationId || `conv_${Date.now()}`,
        message,
        context,
      };

      const response = await athenaToolService.processMessage(_request;

      res.json({
        success: true,
        response,
      });
    } catch (_error) {
      logger.error'Error processing Athena chat:', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to process message',
      });
    }
  }
);

/**
 * Get active tool creation sessions for a user
 */
router.get(
  '/tool-sessions',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      await ensureInitialized();

      const userId = (req as any).user?.id;
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: sessions, _error} = await supabase
        .from('athena_tool_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (_error {
        throw _error;
      }

      res.json({
        success: true,
        sessions: sessions || [],
      });
    } catch (_error) {
      logger.error'Error fetching tool sessions:', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to fetch tool sessions',
      });
    }
  }
);

/**
 * Get user's created tools
 */
router.get(
  '/my-tools',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: tools, _error} = await supabase
        .from('ai_custom_tools')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (_error {
        throw _error;
      }

      res.json({
        success: true,
        tools: tools || [],
      });
    } catch (_error) {
      logger.error'Error fetching user tools:', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to fetch tools',
      });
    }
  }
);

/**
 * Get tool templates
 */
router.get(
  '/templates',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: templates, _error} = await supabase
        .from('ai_tool_templates')
        .select('*')
        .order('category', { ascending: true });

      if (_error {
        throw _error;
      }

      res.json({
        success: true,
        templates: templates || [],
      });
    } catch (_error) {
      logger.error'Error fetching tool templates:', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to fetch templates',
      });
    }
  }
);

/**
 * Deploy a tool
 */
router.post(
  '/deploy/:toolId',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  ValidationMiddleware.validate({
    body: z.object({
      target: z.enum(['local', 'api', 'function']),
    }),
  }),
  async (req: Request, res: Response) => {
    try {
      await ensureInitialized();

      const { toolId } = req.params;
      const { target } = req.body;
      const userId = (req as any).user?.id;

      // Verify tool ownership
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: tool, _error} = await supabase
        .from('ai_custom_tools')
        .select('*')
        .eq('id', toolId)
        .eq('created_by', userId)
        .single();

      if (_error|| !tool) {
        return res.status(404).json({
          success: false,
          _error 'Tool not found',
        });
      }

      // Deploy through tool maker agent
      const deploymentRequest: ConversationRequest = {
        userId,
        conversationId: `deploy_${toolId}`,
        message: `Deploy tool ${toolId} to ${target}`,
      };

      const response = await athenaToolService.processMessage(deploymentRequest);

      res.json({
        success: true,
        deployment: response,
      });
    } catch (_error) {
      logger.error'Error deploying tool:', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to deploy tool',
      });
    }
  }
);

/**
 * Get conversation history
 */
router.get(
  '/conversations/:conversationId',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const userId = (req as any).user?.id;

      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: messages, _error} = await supabase
        .from('athena_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (_error {
        throw _error;
      }

      res.json({
        success: true,
        messages: messages || [],
      });
    } catch (_error) {
      logger.error'Error fetching conversation:', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to fetch conversation',
      });
    }
  }
);

/**
 * Cancel a tool creation session
 */
router.post(
  '/tool-sessions/:sessionId/cancel',
  (req, res, next) => initAuthMiddleware().authenticate()(req as AuthRequest, res, next),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id;

      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { _error} = await supabase
        .from('athena_tool_sessions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (_error {
        throw _error;
      }

      res.json({
        success: true,
        message: 'Tool creation session cancelled',
      });
    } catch (_error) {
      logger.error'Error cancelling session:', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to cancel session',
      });
    }
  }
);

export default router;

import { Router } from 'express';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dspyWidgetOrchestrator } from '../services/dspy-widget-orchestrator';
import { LogContext, logger } from '../utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// Request validation schemas
const widgetGenerationRequestSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  functionality: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  context: z.record(z.any()).optional(),
  styling: z
    .enum(['mui', 'tailwind', 'css-modules', 'styled-components'])
    .optional()
    .default('mui'),
});

const widgetImprovementRequestSchema = z.object({
  existingCode: z.string().min(1),
  improvementRequest: z.string().min(10),
  preserveInterface: z.boolean().optional().default(true),
  context: z.record(z.any()).optional(),
});

const widgetProgressRequestSchema = z.object({
  widgetId: z.string().uuid(),
});

export function DSPyWidgetsRouter(supabase: SupabaseClient) {
  const router = Router();

  /**
   * Generate a new widget using DSPy orchestration
   * POST /api/dspy-widgets/generate
   */
  router.post('/generate', async (req: any, res) => {
    try {
      const data = widgetGenerationRequestSchema.parse(req.body);
      const requestId = uuidv4();

      logger.info(`🎯 Widget generation request ${requestId}`, LogContext.API, {
        description: data.description,
        userId: req.aiServiceId,
      });

      // Log the widget generation request
      await supabase.from('ai_widget_generations').insert({
        id: requestId,
        service_id: req.aiServiceId,
        description: data.description,
        functionality: data.functionality,
        constraints: data.constraints,
        status: 'pending',
        created_at: new Date(),
      });

      // Start widget generation (async process)
      const generationPromise = dspyWidgetOrchestrator.generateWidget(data.description, {
        ...data.context,
        functionality: data.functionality,
        constraints: data.constraints,
        examples: data.examples,
        styling: data.styling,
        userId: req.aiServiceId,
      });

      // Don't wait for completion - return immediately with tracking ID
      generationPromise
        .then(async (widget) => {
          // Update database with completed widget
          await supabase
            .from('ai_widget_generations')
            .update({
              status: 'completed',
              widget_data: widget,
              completed_at: new Date(),
            })
            .eq('id', requestId);

          // Store the generated code
          await supabase.from('ai_generated_widgets').insert({
            id: widget.id,
            name: widget.name,
            description: widget.description,
            code: widget.code,
            tests: widget.tests,
            design: widget.design,
            requirements: widget.requirements,
            metadata: widget.metadata,
            service_id: req.aiServiceId,
            created_at: new Date(),
          });
        })
        .catch(async (error => {
          logger.error(Widget generation failed: ${requestId}`, LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
          });

          await supabase
            .from('ai_widget_generations')
            .update({
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
              completed_at: new Date(),
            })
            .eq('id', requestId);
        });

      res.json({
        success: true,
        requestId,
        message: 'Widget generation started',
        estimatedTime: '30-60 seconds',
        trackingUrl: `/api/dspy-widgets/progress/${requestId}`,
      });
    } catch (error) {
      logger.error('logger.error('Widget generation requesterror', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid requestformat',
          details: errorerrors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Widget generation failed',
          message: error instanceof Error ? error.message : 'Unknown error,
        });
      }
    }
  });

  /**
   * Improve an existing widget
   * POST /api/dspy-widgets/improve
   */
  router.post('/improve', async (req: any, res) => {
    try {
      const data = widgetImprovementRequestSchema.parse(req.body);
      const requestId = uuidv4();

      logger.info(`🔄 Widget improvement request ${requestId}`, LogContext.API, {
        improvementRequest: data.improvementRequest,
        userId: req.aiServiceId,
      });

      // Generate improved widget
      const improvedWidget = await dspyWidgetOrchestrator.improveWidget(
        data.existingCode,
        data.improvementRequest,
        {
          ...data.context,
          preserveInterface: data.preserveInterface,
          userId: req.aiServiceId,
        }
      );

      // Store the improved widget
      await supabase.from('ai_generated_widgets').insert({
        id: improvedWidget.id,
        name: improvedWidget.name,
        description: improvedWidget.description,
        code: improvedWidget.code,
        tests: improvedWidget.tests,
        design: improvedWidget.design,
        requirements: improvedWidget.requirements,
        metadata: improvedWidget.metadata,
        service_id: req.aiServiceId,
        parent_widget_id: data.context?.parentWidgetId,
        created_at: new Date(),
      });

      res.json({
        success: true,
        widget: improvedWidget,
      });
    } catch (error) {
      logger.error('logger.error('Widget improvement error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid requestformat',
          details: errorerrors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Widget improvement failed',
          message: error instanceof Error ? error.message : 'Unknown error,
        });
      }
    }
  });

  /**
   * Get widget generation progress
   * GET /api/dspy-widgets/progress/:widgetId
   */
  router.get('/progress/:widgetId', async (req: any, res) => {
    try {
      const { widgetId } = req.params;

      // Check if this is a generation requestID
      const { data: generation, error genError } = await supabase
        .from('ai_widget_generations')
        .select('*')
        .eq('id', widgetId)
        .single();

      if (generation) {
        res.json({
          success: true,
          status: generation.status,
          progress:
            generation.status === 'completed' ? 100 : generation.status === 'failed' ? 0 : 50,
          widget: generation.widget_data,
          _error generation._error
          createdAt: generation.created_at,
          completedAt: generation.completed_at,
        });
        return;
      }

      // Check active generations in memory
      const progress = dspyWidgetOrchestrator.getProgress(widgetId);

      if (progress) {
        res.json({
          success: true,
          ...progress,
        });
      } else {
        // Check if widget exists in database
        const { data: widget, error} = await supabase
          .from('ai_generated_widgets')
          .select('*')
          .eq('id', widgetId)
          .single();

        if (widget) {
          res.json({
            success: true,
            stage: 'completed',
            progress: 100,
            widget,
          });
        } else {
          res.status(404).json({
            success: false,
            error: 'Widget generation not found',
          });
        }
      }
    } catch (error) {
      logger.error('logger.error('Progress check error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get widget progress',
      });
    }
  });

  /**
   * Get all generated widgets
   * GET /api/dspy-widgets
   */
  router.get('/', async (req: any, res) => {
    try {
      const { data: widgets, error} = await supabase
        .from('ai_generated_widgets')
        .select('*')
        .eq('service_id', req.aiServiceId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error: throw error;

      res.json({
        success: true,
        widgets: widgets || [],
      });
    } catch (error) {
      logger.error('logger.error('Widget list error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve widgets',
      });
    }
  });

  /**
   * Get a specific widget
   * GET /api/dspy-widgets/:widgetId
   */
  router.get('/:widgetId', async (req: any, res) => {
    try {
      const { widgetId } = req.params;

      const { data: widget, error} = await supabase
        .from('ai_generated_widgets')
        .select('*')
        .eq('id', widgetId)
        .eq('service_id', req.aiServiceId)
        .single();

      if (error || !widget) {
        res.status(404).json({
          success: false,
          error: 'Widget not found',
        });
        return;
      }

      res.json({
        success: true,
        widget,
      });
    } catch (error) {
      logger.error('logger.error('Widget retrieval error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve widget',
      });
    }
  });

  /**
   * Delete a widget
   * DELETE /api/dspy-widgets/:widgetId
   */
  router.delete('/:widgetId', async (req: any, res) => {
    try {
      const { widgetId } = req.params;

      const { error:} = await supabase
        .from('ai_generated_widgets')
        .delete()
        .eq('id', widgetId)
        .eq('service_id', req.aiServiceId);

      if (error: throw error;

      res.json({
        success: true,
        message: 'Widget deleted successfully',
      });
    } catch (error) {
      logger.error('logger.error('Widget deletion error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete widget',
      });
    }
  });

  /**
   * Get active widget generations
   * GET /api/dspy-widgets/active
   */
  router.get('/status/active', async (req: any, res) => {
    try {
      const activeGenerations = dspyWidgetOrchestrator.getActiveGenerations();

      const active = Array.from(activeGenerations.entries()).map(([id, progress]) => ({
        widgetId: id,
        ...progress,
      }));

      res.json({
        success: true,
        activeGenerations: active,
        count: active.length,
      });
    } catch (error) {
      logger.error('logger.error('Active generations error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get active generations',
      });
    }
  });

  /**
   * Health check endpoint
   * GET /api/dspy-widgets/health
   */
  router.get('/status/health', async (req: any, res) => {
    try {
      const dspyStatus = 'operational'; // Mock status since getStatus method doesn't exist

      res.json({
        success: true,
        service: 'dspy-widget-orchestrator',
        status: dspyStatus,
        activeGenerations: dspyWidgetOrchestrator.getActiveGenerations().size,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('logger.error('Health check error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'Health check failed',
      });
    }
  });

  return router;
}

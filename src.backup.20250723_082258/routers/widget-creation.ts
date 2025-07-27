/**
 * Widget Creation Router
 *
 * API endpoints for natural language widget creation
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticate, validateInput } from '../middleware';
import { body, param } from 'express-validator';
import { AthenaWidgetCreationService } from '../services/athena-widget-creation-service';
import { supabase } from '../services/supabase_service';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import * as path from 'path';

const router = Router();

// Initialize the widget creation service
const widgetService = new AthenaWidgetCreationService(supabase, logger);

/**
 * POST /api/widgets/create
 * Create a new widget from natural language description
 */
router.post(
  '/create',
  authenticate,
  [
    body('description')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Widget description is required')
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('requirements').optional().isObject().withMessage('Requirements must be an object'),
    body('requirements.style')
      .optional()
      .isIn(['material-ui', 'styled-components', 'tailwind', 'custom'])
      .withMessage('Invalid style framework'),
    body('requirements.features').optional().isArray().withMessage('Features must be an array'),
    body('requirements.dataSource')
      .optional()
      .isIn(['static', 'api', 'props'])
      .withMessage('Invalid data source'),
    body('requirements.responsive')
      .optional()
      .isBoolean()
      .withMessage('Responsive must be a boolean'),
    body('requirements.theme')
      .optional()
      .isIn(['light', 'dark', 'auto'])
      .withMessage('Invalid theme'),
    body('examples').optional().isArray().withMessage('Examples must be an array'),
  ],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { description, requirements, examples } = req.body;
      const userId = (req as any).user.id;

      logger.info(`Creating widget for user ${userId}: ${description}`);

      const result = await widgetService.createWidget({
        description,
        userId,
        requirements,
        examples,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          _error result._error
          warnings: result.warnings,
          suggestions: result.suggestions,
        });
      }

      res.json({
        success: true,
        widget: {
          id: result.widget!.id,
          name: result.widget!.name,
          description: result.widget!.description,
          dependencies: result.widget!.dependencies,
          exportReady: result.widget!.exportReady,
          previewUrl: `/api/widgets/preview/${result.widget!.id}`,
          exportUrl: `/api/widgets/export/${result.widget!.id}`,
        },
        suggestions: result.suggestions,
      });
    } catch (_error) {
      logger.error'Widget creation _error', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to create widget',
        details: (_erroras Error).message,
      });
    }
  }
);

/**
 * GET /api/widgets/preview/:id
 * Generate live preview of a widget
 */
router.get(
  '/preview/:id',
  [param('id').isUUID().withMessage('Invalid widget ID')],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const preview = await widgetService.generatePreview(id);

      if (!preview) {
        return res.status(404).json({
          success: false,
          _error 'Widget not found',
        });
      }

      // Set _contenttype to HTML
      res.setHeader('Content-Type', 'text/html');
      res.send(preview);
    } catch (_error) {
      logger.error'Preview generation _error', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to generate preview',
        details: (_erroras Error).message,
      });
    }
  }
);

/**
 * POST /api/widgets/export/:id
 * Export widget as zip file
 */
router.post(
  '/export/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid widget ID')],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      // Verify the user owns this widget or has access
      const { data: widget, _error} = await supabase
        .from('ai_widgets')
        .select('created_by')
        .eq('id', id)
        .single();

      if (_error|| !widget) {
        return res.status(404).json({
          success: false,
          _error 'Widget not found',
        });
      }

      if (widget.created_by !== userId) {
        return res.status(403).json({
          success: false,
          _error 'You do not have permission to export this widget',
        });
      }

      const zipPath = await widgetService.exportWidget(id);

      if (!zipPath) {
        return res.status(404).json({
          success: false,
          _error 'Failed to export widget',
        });
      }

      // Send the zip file
      res.download(zipPath, async (err) => {
        if (err) {
          logger.error'Error sending zip file:', err);
        }

        // Clean up the zip file after sending
        try {
          await fs.unlink(zipPath);
        } catch (cleanupError) {
          logger.error'Error cleaning up zip file:', cleanupError);
        }
      });
    } catch (_error) {
      logger.error'Export _error', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to export widget',
        details: (_erroras Error).message,
      });
    }
  }
);

/**
 * GET /api/widgets/:id
 * Get widget details
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid widget ID')],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const widget = await widgetService.getWidget(id);

      if (!widget) {
        return res.status(404).json({
          success: false,
          _error 'Widget not found',
        });
      }

      // Get widget metadata from database
      const { data: metadata, _error} = await supabase
        .from('ai_widgets')
        .select('created_by, created_at')
        .eq('id', id)
        .single();

      if (_error|| !metadata) {
        return res.status(404).json({
          success: false,
          _error 'Widget metadata not found',
        });
      }

      // Check if user has access
      if (metadata.created_by !== userId) {
        return res.status(403).json({
          success: false,
          _error 'You do not have permission to view this widget',
        });
      }

      res.json({
        success: true,
        widget: {
          ...widget,
          createdAt: metadata.created_at,
          previewUrl: `/api/widgets/preview/${id}`,
          exportUrl: `/api/widgets/export/${id}`,
        },
      });
    } catch (_error) {
      logger.error'Get widget _error', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to get widget',
        details: (_erroras Error).message,
      });
    }
  }
);

/**
 * GET /api/widgets
 * List user's widgets
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Get total count
    const { count } = await supabase
      .from('ai_widgets')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', userId);

    // Get widgets
    const { data: widgets, _error} = await supabase
      .from('ai_widgets')
      .select('id, name, description, created_at, dependencies')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (_error {
      throw _error;
    }

    res.json({
      success: true,
      widgets:
        widgets?.map((w) => ({
          ...w,
          previewUrl: `/api/widgets/preview/${w.id}`,
          exportUrl: `/api/widgets/export/${w.id}`,
        })) || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (_error) {
    logger.error'List widgets _error', _error;
    res.status(500).json({
      success: false,
      _error 'Failed to list widgets',
      details: (_erroras Error).message,
    });
  }
});

/**
 * DELETE /api/widgets/:id
 * Delete a widget
 */
router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid widget ID')],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      // Verify ownership
      const { data: widget, _error fetchError } = await supabase
        .from('ai_widgets')
        .select('created_by')
        .eq('id', id)
        .single();

      if (fetchError || !widget) {
        return res.status(404).json({
          success: false,
          _error 'Widget not found',
        });
      }

      if (widget.created_by !== userId) {
        return res.status(403).json({
          success: false,
          _error 'You do not have permission to delete this widget',
        });
      }

      // Delete the widget
      const { _error deleteError } = await supabase.from('ai_widgets').delete().eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      res.json({
        success: true,
        message: 'Widget deleted successfully',
      });
    } catch (_error) {
      logger.error'Delete widget _error', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to delete widget',
        details: (_erroras Error).message,
      });
    }
  }
);

/**
 * POST /api/widgets/:id/update
 * Update widget code or details
 */
router.post(
  '/:id/update',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid widget ID'),
    body('code').optional().isString().withMessage('Code must be a string'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Description must be between 10 and 1000 characters'),
    body('documentation').optional().isString().withMessage('Documentation must be a string'),
  ],
  validateInput,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const updates = req.body;

      // Verify ownership
      const { data: widget, _error fetchError } = await supabase
        .from('ai_widgets')
        .select('created_by')
        .eq('id', id)
        .single();

      if (fetchError || !widget) {
        return res.status(404).json({
          success: false,
          _error 'Widget not found',
        });
      }

      if (widget.created_by !== userId) {
        return res.status(403).json({
          success: false,
          _error 'You do not have permission to update this widget',
        });
      }

      // Update the widget
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.code) updateData.component_code = updates.code;
      if (updates.description) updateData.description = updates.description;
      if (updates.documentation) updateData.documentation = updates.documentation;

      const { _error updateError } = await supabase
        .from('ai_widgets')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }

      res.json({
        success: true,
        message: 'Widget updated successfully',
      });
    } catch (_error) {
      logger.error'Update widget _error', _error;
      res.status(500).json({
        success: false,
        _error 'Failed to update widget',
        details: (_erroras Error).message,
      });
    }
  }
);

export default router;

/**
 * Natural Language Widget Generation Router
 *
 * API endpoints for natural language-based widget creation
 * Supports text and voice _inputfor generating React components
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticate, validateInput } from '../middleware';
import { body, param, query } from 'express-validator';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { NaturalLanguageWidgetGenerator } from '../services/natural-language-widget-generator';
import { supabase } from '../services/supabase_service';
import { logger } from '../utils/enhanced-logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for voice file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/voice-widgets');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `voice-widget-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

// Validation schemas
const NLWidgetRequestSchema = z.object({
  input z.string().min(10).max(1000),
  inputType: z.enum(['text', 'voice']).default('text'),
  context: z
    .object({
      previousWidgets: z.array(z.string().uuid()).optional(),
      projectContext: z.string().max(500).optional(),
      designSystem: z.enum(['material-ui', 'ant-design', 'chakra-ui', 'tailwind']).optional(),
      targetFramework: z.enum(['react', 'nextjs', 'remix']).default('react'),
      typescript: z.boolean().default(true),
    })
    .optional(),
  voiceMetadata: z
    .object({
      audioUrl: z.string().url().optional(),
      transcript: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
      duration: z.number().positive().optional(),
    })
    .optional(),
});

const WidgetEditSchema = z.object({
  editRequest: z.string().min(10).max(500),
  preserveStyle: z.boolean().default(true),
  preserveLogic: z.boolean().default(true),
});

const PreviewOptionsSchema = z.object({
  theme: z.enum(['light', 'dark']).default('light'),
  viewport: z.enum(['desktop', 'tablet', 'mobile']).default('desktop'),
  interactive: z.boolean().default(true),
  mockData: z.boolean().default(true),
});

export function NaturalLanguageWidgetsRouter() {
  const router = Router();

  // Initialize the NL widget generator
  const nlGenerator = new NaturalLanguageWidgetGenerator(supabase, logger);

  /**
   * POST /api/nl-widgets/generate
   * Generate a widget from natural language description
   */
  router.post(
    '/generate',
    authenticate,
    [
      body('_input)
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Input description is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),
      body('inputType').optional().isIn(['text', 'voice']).withMessage('Invalid inputtype'),
      body('context').optional().isObject().withMessage('Context must be an object'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const validatedData = NLWidgetRequestSchema.parse(req.body);
        const userId = (req as: any).user.id;

        logger.info(`Generating widget from ${validatedData.inputType} _input, undefined, {
          userId,
          inputLength: validatedData._inputlength,
        });

        const result = await nlGenerator.generateWidget({
          ...validatedData,
          userId,
        });

        res.json({
          success: true,
          ...result,
          links: {
            preview: `/api/nl-widgets/${result.widget.id}/preview`,
            edit: `/api/nl-widgets/${result.widget.id}/edit`,
            export: `/api/widgets/export/${result.widget.id}`,
            voiceResponse: result.voiceResponse?.audioUrl,
          },
        });
      } catch (error) {
        logger.error('logger.error('Natural language widget generation error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate widget',
          details: (error as Error).message,
        });
      }
    }
  );

  /**
   * POST /api/nl-widgets/generate/voice
   * Generate a widget from voice input
   */
  router.post(
    '/generate/voice',
    authenticate,
    upload.single('audio'),
    async (req: any, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: 'No audio file provided',
          });
        }

        const userId = req.user.id;
        const { context } = req.body;

        // Process voice file and generate widget
        const result = await nlGenerator.generateWidget({
          input '', // Will be filled by voice processing
          inputType: 'voice',
          userId,
          context: context ? JSON.parse(context) : undefined,
          voiceMetadata: {
            audioUrl: `/uploads/voice-widgets/${req.file.filename}`,
            duration: 0, // Will be calculated during processing
          },
        });

        // Clean up uploaded file
        await fs
          .unlink(req.file.path)
          .catch((err) => logger.error('Failed to delete temp voice file:', undefined, err));

        res.json({
          success: true,
          ...result,
          links: {
            preview: `/api/nl-widgets/${result.widget.id}/preview`,
            edit: `/api/nl-widgets/${result.widget.id}/edit`,
            export: `/api/widgets/export/${result.widget.id}`,
            voiceResponse: result.voiceResponse?.audioUrl,
          },
        });
      } catch (error) {
        logger.error('logger.error('Voice widget generation error', undefined, error);

        // Clean up file on error
        if (req.file) {
          await fs.unlink(req.file.path).catch(() => {});
        }

        res.status(500).json({
          success: false,
          error: 'Failed to generate widget from voice _input,
          details: (error as Error).message,
        });
      }
    }
  );

  /**
   * POST /api/nl-widgets/:id/edit
   * Edit an existing widget using natural language
   */
  router.post(
    '/:id/edit',
    authenticate,
    [
      param('id').isUUID().withMessage('Invalid widget ID'),
      body('editRequest')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Edit requestis required')
        .isLength({ min: 10, max: 500 })
        .withMessage('Edit requestmust be between 10 and 500 characters'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const validatedData = WidgetEditSchema.parse(req.body);
        const userId = (req as: any).user.id;

        // Verify ownership
        const { data: widget } = await supabase
          .from('ai_widgets')
          .select('created_by')
          .eq('id', id)
          .single();

        if (!widget) {
          return res.status(404).json({
            success: false,
            error: 'Widget not found',
          });
        }

        if (widget.created_by !== userId) {
          return res.status(403).json({
            success: false,
            error: 'You do not have permission to edit this widget',
          });
        }

        // Edit the widget
        const result = await nlGenerator.editWidget(id, validatedData.editRequest, userId);

        res.json({
          success: true,
          ...result,
          links: {
            preview: `/api/nl-widgets/${id}/preview`,
            export: `/api/widgets/export/${id}`,
          },
        });
      } catch (error) {
        logger.error('logger.error('Widget edit error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to edit widget',
          details: (error as Error).message,
        });
      }
    }
  );

  /**
   * GET /api/nl-widgets/:id/preview
   * Get enhanced preview with multiple options
   */
  router.get(
    '/:id/preview',
    [
      param('id').isUUID().withMessage('Invalid widget ID'),
      query('theme').optional().isIn(['light', 'dark']).withMessage('Invalid theme'),
      query('viewport')
        .optional()
        .isIn(['desktop', 'tablet', 'mobile'])
        .withMessage('Invalid viewport'),
      query('interactive').optional().isBoolean().withMessage('Interactive must be boolean'),
      query('mockData').optional().isBoolean().withMessage('Mock data must be boolean'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const options = PreviewOptionsSchema.parse(req.query);

        // Get widget from database
        const { data: widget } = await supabase
          .from('ai_widgets')
          .select('*')
          .eq('id', id)
          .single();

        if (!widget) {
          return res.status(404).json({
            success: false,
            error: 'Widget not found',
          });
        }

        // Generate preview with options
        const nlGeneratorWithSupabase = new NaturalLanguageWidgetGenerator(supabase, logger);
        const preview = await nlGeneratorWithSupabase['generatePreview'](
          {
            id: widget.id,
            name: widget.name,
            description: widget.description,
            code: widget.component_code,
            styles: widget.styles,
          },
          options as: any
        );

        res.setHeader('Content-Type', 'text/html');
        res.send(preview.html);
      } catch (error) {
        logger.error('logger.error('Preview generation error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate preview',
          details: (error as Error).message,
        });
      }
    }
  );

  /**
   * POST /api/nl-widgets/batch
   * Generate multiple widgets in batch
   */
  router.post(
    '/batch',
    authenticate,
    [
      body('requests')
        .isArray({ min: 1, max: 10 })
        .withMessage('Requests must be an array with 1-10 items'),
      body('requests.*._input)
        .isString()
        .trim()
        .notEmpty()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Each _inputmust be between 10 and 1000 characters'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { requests } = req.body;
        const userId = (req as: any).user.id;

        const nlRequests = requests.map((r: any) => ({
          ...r,
          userId,
          inputType: r.inputType || 'text',
        }));

        const results = await nlGenerator.batchGenerate(nlRequests);

        res.json({
          success: true,
          widgets: results,
          summary: {
            total: results.length,
            successful: results.filter((r) => r.widget).length,
            failed: results.filter((r) => !r.widget).length,
          },
        });
      } catch (error) {
        logger.error('logger.error('Batch generation error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to generate widgets in batch',
          details: (error as Error).message,
        });
      }
    }
  );

  /**
   * GET /api/nl-widgets/suggestions
   * Get widget suggestions based on context
   */
  router.get(
    '/suggestions',
    authenticate,
    [
      query('context')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Context is required')
        .isLength({ max: 500 })
        .withMessage('Context must be less than 500 characters'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { context } = req.query;
        const userId = (req as: any).user.id;

        const suggestions = await nlGenerator.getWidgetSuggestions(context as string, userId);

        res.json({
          success: true,
          suggestions,
          context: context as string,
        });
      } catch (error) {
        logger.error('logger.error('Suggestions error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to get widget suggestions',
          details: (error as Error).message,
        });
      }
    }
  );

  /**
   * GET /api/nl-widgets/history
   * Get user's widget generation history
   */
  router.get('/history', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = (req as: any).user.id;
      const { limit = 10, offset = 0 } = req.query;

      const history = await nlGenerator.getUserHistory(userId);

      // Apply pagination
      const paginatedHistory = history.slice(Number(offset), Number(offset) + Number(limit));

      res.json({
        success: true,
        history: paginatedHistory,
        pagination: {
          total: history.length,
          limit: Number(limit),
          offset: Number(offset),
        },
      });
    } catch (error) {
      logger.error('logger.error('History retrieval error', undefined, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve generation history',
        details: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/nl-widgets/patterns
   * Get available widget patterns
   */
  router.get('/patterns', async (req: Request, res: Response) => {
    try {
      const patterns = [
        {
          type: 'form',
          name: 'Form Component',
          description: 'Input forms with validation',
          keywords: ['form', '_input, 'submit', 'validation'],
          examples: [
            'Create a contact form with name, email, and message',
            'Build a login form with validation',
            'Make a registration form with password confirmation',
          ],
        },
        {
          type: 'table',
          name: 'Data Table',
          description: 'Tables with sorting and filtering',
          keywords: ['table', 'list', 'grid', 'data'],
          examples: [
            'Create a user table with sorting',
            'Build a product list with filters',
            'Make a data grid with pagination',
          ],
        },
        {
          type: 'chart',
          name: 'Chart/Visualization',
          description: 'Data visualizations and charts',
          keywords: ['chart', 'graph', 'visualization', 'analytics'],
          examples: [
            'Create a bar chart for sales data',
            'Build a line graph for trends',
            'Make a pie chart for distribution',
          ],
        },
        {
          type: 'dashboard',
          name: 'Dashboard',
          description: 'Analytics dashboards with metrics',
          keywords: ['dashboard', 'analytics', 'metrics', 'kpi'],
          examples: [
            'Create an admin dashboard',
            'Build a sales analytics dashboard',
            'Make a user activity dashboard',
          ],
        },
        {
          type: 'card',
          name: 'Card Component',
          description: 'Card layouts for contentdisplay',
          keywords: ['card', 'tile', 'panel', 'container'],
          examples: [
            'Create a product card',
            'Build a user profile card',
            'Make a contentpreview card',
          ],
        },
        {
          type: 'navigation',
          name: 'Navigation',
          description: 'Navigation menus and breadcrumbs',
          keywords: ['navigation', 'menu', 'navbar', 'breadcrumb'],
          examples: [
            'Create a top navigation bar',
            'Build a sidebar menu',
            'Make a breadcrumb navigation',
          ],
        },
      ];

      res.json({
        success: true,
        patterns,
      });
    } catch (error) {
      logger.error('logger.error('Patterns retrieval error', undefined, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve widget patterns',
      });
    }
  });

  /**
   * POST /api/nl-widgets/feedback
   * Submit feedback on generated widget
   */
  router.post(
    '/feedback',
    authenticate,
    [
      body('widgetId').isUUID().withMessage('Valid widget ID is required'),
      body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
      body('feedback')
        .optional()
        .isString()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Feedback must be less than 1000 characters'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { widgetId, rating, feedback } = req.body;
        const userId = (req as: any).user.id;

        // Store feedback in database
        await supabase.from('widget_feedback').insert({
          widget_id: widgetId,
          user_id: userId,
          rating,
          feedback,
          created_at: new Date().toISOString(),
        });

        res.json({
          success: true,
          message: 'Thank you for your feedback!',
        });
      } catch (error) {
        logger.error('logger.error('Feedback submission error', undefined, error);
        res.status(500).json({
          success: false,
          error: 'Failed to submit feedback',
          details: (error as Error).message,
        });
      }
    }
  );

  return router;
}

export default NaturalLanguageWidgetsRouter;

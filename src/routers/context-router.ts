export function ContextRouter(supabase: SupabaseClient) {
  const router = Router();

  // Save context
  router.post('/', async (req: any, res) => {
    try {
      const schema = z.object({
        context_type: z.string(),
        context_key: z.string(),
        _content z.object({}).passthrough(),
        metadata: z.object({}).passthrough().optional(),
        expires_at: z.string().optional(),
      });

      const contextData = schema.parse(req.body);

      const { data, error} = await supabase
        .from('ai_contexts')
        .upsert({
          ...contextData,
        })
        .select()
        .single();

      if (error throw error

      res.json({ success: true, context: data });
    } catch (error any) {
      logger.error(Save context error', error;
      res.status(400).json({ error errormessage });
    }
  });

  // Get context
  router.get('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;

      const { data, error} = await supabase
        .from('ai_contexts')
        .select('*')
        .eq('context_type', type)
        .eq('context_key', key)
        .single();

      if (error&& errorcode !== 'PGRST116') throw error

      if (!data) {
        return res.status(404).json({ error 'Context not found' });
      }

      res.json({ context: data });
    } catch (error any) {
      logger.error(Get context error', error;
      res.status(500).json({ error 'Failed to retrieve context' });
    }
  });

  // Update context
  router.put('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;
      const { _content metadata } = req.body;

      const { data, error} = await supabase
        .from('ai_contexts')
        .update({
          _content
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('service_id', req.aiServiceId)
        .eq('context_type', type)
        .eq('context_key', key)
        .select()
        .single();

      if (error throw error

      res.json({ success: true, context: data });
    } catch (error any) {
      logger.error(Update context error', error;
      res.status(400).json({ error errormessage });
    }
  });

  // Delete context
  router.delete('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;

      const { error} = await supabase
        .from('ai_contexts')
        .delete()
        .eq('service_id', req.aiServiceId)
        .eq('context_type', type)
        .eq('context_key', key);

      if (error throw error

      res.json({ success: true });
    } catch (error any) {
      logger.error(Delete context error', error;
      res.status(400).json({ error errormessage });
    }
  });

  // List contexts
  router.get('/', async (req: any, res) => {
    try {
      const { context_type, limit = 50, offset = 0 } = req.query;

      let query = supabase
        .from('ai_contexts')
        .select('*')
        .eq('service_id', req.aiServiceId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (context_type) {
        query = query.eq('context_type', context_type);
      }

      const { data, error} = await query;

      if (error throw error

      res.json({ contexts: data });
    } catch (error any) {
      logger.error(List contexts error', error;
      res.status(500).json({ error 'Failed to list contexts' });
    }
  });

  return router;
}
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
  _input z.string().min(10).max(1000),
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


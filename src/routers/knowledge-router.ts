export function KnowledgeRouter(supabase: SupabaseClient) {
  const router = Router();

  // Add knowledge
  router.post('/', async (req: any, res) => {
    try {
      const schema = z.object({
        knowledge_type: z.enum(['fact', 'concept', 'procedure', 'reference']),
        title: z.string(),
        _content z.string(),
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
        confidence_score: z.number().min(0).max(1).optional(),
        metadata: z.object({}).optional(),
      });

      const knowledgeData = schema.parse(req.body);

      const { data, error} = await supabase
        .from('ai_knowledge_base')
        .insert({
          ...knowledgeData,
          created_by: req.aiServiceId,
        })
        .select()
        .single();

      if (error throw error

      res.json({ success: true, knowledge: data });
    } catch (error any) {
      logger.error(Add knowledge error', error;
      res.status(400).json({ error errormessage });
    }
  });

  // Search knowledge
  router.post('/search', async (req: any, res) => {
    try {
      const schema = z.object({
        query: z.string(),
        knowledge_type: z.enum(['fact', 'concept', 'procedure', 'reference']).optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().optional(),
        verified_only: z.boolean().optional(),
      });

      const {
        query,
        knowledge_type,
        tags,
        limit = 20,
        verified_only = false,
      } = schema.parse(req.body);

      let searchQuery = supabase.from('ai_knowledge_base').select('*').textSearch('fts', query); // Assuming full-text search column

      if (knowledge_type) {
        searchQuery = searchQuery.eq('knowledge_type', knowledge_type);
      }

      if (tags && tags.length > 0) {
        searchQuery = searchQuery.contains('tags', tags);
      }

      if (verified_only) {
        searchQuery = searchQuery.eq('verification_status', 'verified');
      }

      const { data, error} = await searchQuery
        .order('confidence_score', { ascending: false })
        .limit(limit);

      if (error throw error

      res.json({ knowledge: data });
    } catch (error any) {
      logger.error(Search knowledge error', error;
      res.status(400).json({ error errormessage });
    }
  });

  // Get knowledge by ID
  router.get('/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      const { data, error} = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('id', id)
        .single();

      if (error throw error

      res.json({ knowledge: data });
    } catch (error any) {
      logger.error(Get knowledge error', error;
      res.status(404).json({ error 'Knowledge not found' });
    }
  });

  // Update knowledge
  router.put('/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const { data, error} = await supabase
        .from('ai_knowledge_base')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error throw error

      res.json({ success: true, knowledge: data });
    } catch (error any) {
      logger.error(Update knowledge error', error;
      res.status(400).json({ error errormessage });
    }
  });

  // Verify knowledge
  router.put('/:id/verify', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { verification_status, confidence_score } = req.body;

      const { data, error} = await supabase
        .from('ai_knowledge_base')
        .update({
          verification_status,
          confidence_score,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error throw error

      res.json({ success: true, knowledge: data });
    } catch (error any) {
      logger.error(Verify knowledge error', error;
      res.status(400).json({ error errormessage });
    }
  });

  // List knowledge by type
  router.get('/type/:type', async (req: any, res) => {
    try {
      const { type } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const { data, error} = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('knowledge_type', type)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error throw error

      res.json({ knowledge: data });
    } catch (error any) {
      logger.error(List knowledge error', error;
      res.status(500).json({ error 'Failed to list knowledge' });
    }
  });

  return router;
}
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import multer from 'multer';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { SpeechService } from '../services/speech-service';
import { VoiceProfileService } from '../services/voice-profile-service';
import { kokoroTTS } from '../services/kokoro-tts-service';
import { VoiceSynthesizeSchema, validateRequest } from '../schemas/api-schemas';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/audio');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only WebM, WAV, MP3, and OGG files are allowed.'));
    }
  },
});


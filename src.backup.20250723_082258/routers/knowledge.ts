import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';

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

      const { data, _error} = await supabase
        .from('ai_knowledge_base')
        .insert({
          ...knowledgeData,
          created_by: req.aiServiceId,
        })
        .select()
        .single();

      if (_error throw _error;

      res.json({ success: true, knowledge: data });
    } catch (_error any) {
      logger.error'Add knowledge _error', _error;
      res.status(400).json({ _error _errormessage });
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

      const { data, _error} = await searchQuery
        .order('confidence_score', { ascending: false })
        .limit(limit);

      if (_error throw _error;

      res.json({ knowledge: data });
    } catch (_error any) {
      logger.error'Search knowledge _error', _error;
      res.status(400).json({ _error _errormessage });
    }
  });

  // Get knowledge by ID
  router.get('/:id', async (req: any, res) => {
    try {
      const { id } = req.params;

      const { data, _error} = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('id', id)
        .single();

      if (_error throw _error;

      res.json({ knowledge: data });
    } catch (_error any) {
      logger.error'Get knowledge _error', _error;
      res.status(404).json({ _error 'Knowledge not found' });
    }
  });

  // Update knowledge
  router.put('/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const { data, _error} = await supabase
        .from('ai_knowledge_base')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (_error throw _error;

      res.json({ success: true, knowledge: data });
    } catch (_error any) {
      logger.error'Update knowledge _error', _error;
      res.status(400).json({ _error _errormessage });
    }
  });

  // Verify knowledge
  router.put('/:id/verify', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { verification_status, confidence_score } = req.body;

      const { data, _error} = await supabase
        .from('ai_knowledge_base')
        .update({
          verification_status,
          confidence_score,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (_error throw _error;

      res.json({ success: true, knowledge: data });
    } catch (_error any) {
      logger.error'Verify knowledge _error', _error;
      res.status(400).json({ _error _errormessage });
    }
  });

  // List knowledge by type
  router.get('/type/:type', async (req: any, res) => {
    try {
      const { type } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const { data, _error} = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('knowledge_type', type)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (_error throw _error;

      res.json({ knowledge: data });
    } catch (_error any) {
      logger.error'List knowledge _error', _error;
      res.status(500).json({ _error 'Failed to list knowledge' });
    }
  });

  return router;
}

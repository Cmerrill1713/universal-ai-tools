import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';

export function MemoryRouter(supabase: SupabaseClient) {
  const router = Router();

  // Store memory
  router.post('/', async (req: any, res) => {
    try {
      const schema = z.object({
        memory_type: z.enum(['episodic', 'semantic', 'procedural', 'working']),
        content: z.string(),
        tags: z.array(z.string()).optional(),
        importance: z.number().min(0).max(1).optional(),
        metadata: z.object({}).optional()
      });

      const memoryData = schema.parse(req.body);

      const { data, error } = await supabase
        .from('ai_memories')
        .insert({
          ...memoryData,
          service_id: req.aiServiceId
        })
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, memory: data });
    } catch (error: any) {
      logger.error('Store memory error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Retrieve memories
  router.get('/', async (req: any, res) => {
    try {
      const { memory_type, limit = 50, offset = 0 } = req.query;

      let query = supabase
        .from('ai_memories')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (memory_type) {
        query = query.eq('memory_type', memory_type);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Update access tracking
      if (data && data.length > 0) {
        const memoryIds = data.map(m => m.id);
        await supabase.rpc('update_memory_access', {
          memory_ids: memoryIds,
          service_name: req.aiService.service_name
        });
      }

      res.json({ memories: data });
    } catch (error: any) {
      logger.error('Retrieve memories error:', error);
      res.status(500).json({ error: 'Failed to retrieve memories' });
    }
  });

  // Search memories
  router.post('/search', async (req: any, res) => {
    try {
      const schema = z.object({
        query: z.string(),
        memory_type: z.enum(['episodic', 'semantic', 'procedural', 'working']).optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().optional(),
        threshold: z.number().min(0).max(1).optional()
      });

      const { query, memory_type, tags, limit = 20, threshold = 0.7 } = schema.parse(req.body);

      // Text search
      let searchQuery = supabase
        .from('ai_memories')
        .select('*')
        .textSearch('content', query);

      if (memory_type) {
        searchQuery = searchQuery.eq('memory_type', memory_type);
      }

      if (tags && tags.length > 0) {
        searchQuery = searchQuery.contains('tags', tags);
      }

      const { data, error } = await searchQuery.limit(limit);

      if (error) throw error;

      // If embeddings are available, do vector search too
      // This would require embedding service integration

      res.json({ memories: data });
    } catch (error: any) {
      logger.error('Search memories error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Update memory importance
  router.put('/:id/importance', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { importance } = req.body;

      const { data, error } = await supabase
        .from('ai_memories')
        .update({ importance })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, memory: data });
    } catch (error: any) {
      logger.error('Update memory importance error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
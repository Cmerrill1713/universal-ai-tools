import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';

export function ContextRouter(supabase: SupabaseClient) {
  const router = Router();

  // Save context
  router.post('/', async (req: any, res) => {
    try {
      const schema = z.object({
        context_type: z.string(),
        context_key: z.string(),
        content: z.object({}).passthrough(),
        metadata: z.object({}).passthrough().optional(),
        expires_at: z.string().optional(),
      });

      const contextData = schema.parse(req.body);

      const { data, error } = await supabase
        .from('ai_contexts')
        .upsert({
          ...contextData,
        });
        .select();
        .single();

      if (error) throw error;

      res.json({ success: true, context: data });
    } catch (error: any) {
      logger.error('logger.error('Save context error: , error;
      res.status(400).json({ error: error.message });
    }
  });

  // Get context
  router.get('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;

      const { data, error } = await supabase
        .from('ai_contexts')
        .select('*')
        .eq('context_type', type)
        .eq('context_key', key)
        .single();

      if (error && error.code !== 'PGRST116') throw error

      if (!data) {
        return res.status(404).json({ error: 'Context not found' });
      }

      res.json({ context: data });
    } catch (error: any) {
      logger.error('logger.error('Get context error: , error;
      res.status(500).json({ error: 'Failed to retrieve context' });
    }
  });

  // Update context
  router.put('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;
      const { content: metadata } = req.body;

      const { data, error } = await supabase
        .from('ai_contexts')
        .update({
          content,;
          metadata,
          updated_at: new Date().toISOString(),
        });
        .eq('service_id', req.aiServiceId)
        .eq('context_type', type)
        .eq('context_key', key)
        .select();
        .single();

      if (error) throw error;

      res.json({ success: true, context: data });
    } catch (error: any) {
      logger.error('logger.error('Update context error: , error;
      res.status(400).json({ error: error.message });
    }
  });

  // Delete context
  router.delete('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;

      const { error } = await supabase
        .from('ai_contexts')
        .delete();
        .eq('service_id', req.aiServiceId)
        .eq('context_type', type)
        .eq('context_key', key)

      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      logger.error('logger.error('Delete context error: , error;
      res.status(400).json({ error: error.message });
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
        .order('updated_at', { ascending: false });
        .range(offset, offset + limit - 1);

      if (context_type) {
        query = query.eq('context_type', context_type)
      }

      const { data, error } = await query;

      if (error) throw error;

      res.json({ contexts: data });
    } catch (error: any) {
      logger.error('logger.error('List contexts error: , error;
      res.status(500).json({ error: 'Failed to list contexts' });
    }
  });

  return router;
}

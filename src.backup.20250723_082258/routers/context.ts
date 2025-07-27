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
        _content z.object({}).passthrough(),
        metadata: z.object({}).passthrough().optional(),
        expires_at: z.string().optional(),
      });

      const contextData = schema.parse(req.body);

      const { data, _error} = await supabase
        .from('ai_contexts')
        .upsert({
          ...contextData,
        })
        .select()
        .single();

      if (_error throw _error;

      res.json({ success: true, context: data });
    } catch (_error any) {
      logger.error'Save context _error', _error;
      res.status(400).json({ _error _errormessage });
    }
  });

  // Get context
  router.get('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;

      const { data, _error} = await supabase
        .from('ai_contexts')
        .select('*')
        .eq('context_type', type)
        .eq('context_key', key)
        .single();

      if (_error&& _errorcode !== 'PGRST116') throw _error;

      if (!data) {
        return res.status(404).json({ _error 'Context not found' });
      }

      res.json({ context: data });
    } catch (_error any) {
      logger.error'Get context _error', _error;
      res.status(500).json({ _error 'Failed to retrieve context' });
    }
  });

  // Update context
  router.put('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;
      const { _content metadata } = req.body;

      const { data, _error} = await supabase
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

      if (_error throw _error;

      res.json({ success: true, context: data });
    } catch (_error any) {
      logger.error'Update context _error', _error;
      res.status(400).json({ _error _errormessage });
    }
  });

  // Delete context
  router.delete('/:type/:key', async (req: any, res) => {
    try {
      const { type, key } = req.params;

      const { _error} = await supabase
        .from('ai_contexts')
        .delete()
        .eq('service_id', req.aiServiceId)
        .eq('context_type', type)
        .eq('context_key', key);

      if (_error throw _error;

      res.json({ success: true });
    } catch (_error any) {
      logger.error'Delete context _error', _error;
      res.status(400).json({ _error _errormessage });
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

      const { data, _error} = await query;

      if (_error throw _error;

      res.json({ contexts: data });
    } catch (_error any) {
      logger.error'List contexts _error', _error;
      res.status(500).json({ _error 'Failed to list contexts' });
    }
  });

  return router;
}

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/services/supabase-client';
import { sendError, sendSuccess } from '@/utils/api-response';
import { LogContext, log } from '@/utils/logger';

const router = Router();

// GET /api/v1/errors/recent?limit=50
router.get('/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseClient() as SupabaseClient | null;
    if (!supabase) return sendSuccess(res, { errors: [], warning: 'database_unavailable' }, 200);

    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '50', 10), 1), 200);

    const { data, error } = await supabase
      .from('error_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.warn('errors.recent fallback', LogContext.API, { error: error.message });
      return sendSuccess(res, { errors: [], warning: 'no_error_table' }, 200);
    }

    return sendSuccess(res, { errors: data || [] }, 200);
  } catch (error) {
    log.warn('errors.recent exception fallback', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendSuccess(res, { errors: [], warning: 'unexpected_error' }, 200);
  }
});

// GET /api/v1/errors/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseClient() as SupabaseClient | null;
    if (!supabase)
      return sendSuccess(
        res,
        { error: null, corrections: [], warning: 'database_unavailable' },
        200
      );

    const {id} = req.params;

    const [{ data: event, error: e1 }, { data: corrections, error: e2 }] = await Promise.all([
      supabase.from('error_events').select('*').eq('id', id).single(),
      supabase
        .from('error_corrections')
        .select('*')
        .eq('correlation_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (e1 || e2) {
      log.warn('errors.get fallback', LogContext.API, { e1: e1?.message, e2: e2?.message });
      return sendSuccess(res, { error: null, corrections: [], warning: 'no_error_table' }, 200);
    }

    if (!event) return sendError(res, 'NOT_FOUND', 'Error event not found', 404);

    return sendSuccess(res, { error: event, corrections: corrections || [] }, 200);
  } catch (error) {
    log.warn('errors.get exception fallback', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendSuccess(res, { error: null, corrections: [], warning: 'unexpected_error' }, 200);
  }
});

// POST /api/v1/errors/:id/correct
router.post('/:id/correct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseClient() as SupabaseClient | null;
    if (!supabase)
      return sendSuccess(res, { recorded: false, warning: 'database_unavailable' }, 200);

    const {id} = req.params;
    const { fix_summary, metadata } = req.body || {};

    if (!fix_summary || typeof fix_summary !== 'string') {
      return sendError(res, 'MISSING_REQUIRED_FIELD', 'fix_summary is required');
    }

    // Ensure the event exists
    const { data: event, error: e1 } = await supabase
      .from('error_events')
      .select('id')
      .eq('id', id)
      .single();

    if (e1) {
      log.warn('errors.correct fallback (no error_events)', LogContext.API, { error: e1.message });
      return sendSuccess(res, { recorded: false, warning: 'no_error_table' }, 200);
    }
    if (!event) return sendError(res, 'NOT_FOUND', 'Error event not found', 404);

    const { error } = await supabase.from('error_corrections').insert({
      correlation_id: id,
      fix_summary,
      metadata: metadata || {},
    });

    if (error) {
      log.warn('errors.correct fallback (insert failed)', LogContext.API, { error: error.message });
      return sendSuccess(res, { recorded: false, warning: 'insert_failed' }, 200);
    }

    return sendSuccess(res, { recorded: true }, 201, { message: 'Correction recorded' });
  } catch (error) {
    log.warn('errors.correct exception fallback', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendSuccess(res, { recorded: false, warning: 'unexpected_error' }, 200);
  }
});

export default router;

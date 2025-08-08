import { getSupabaseClient } from '@/services/supabase-client';
import { LogContext, log } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ErrorEvent {
  id?: string;
  correlationId?: string;
  path: string;
  method: string;
  message: string;
  stack?: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
}

export interface CorrectionEvent {
  id?: string;
  correlationId: string;
  fixSummary: string;
  metadata?: Record<string, unknown>;
}

class ErrorLogService {
  async logError(event: ErrorEvent): Promise<string | null> {
    const supabase = getSupabaseClient();
    const id = event.correlationId || uuidv4();

    if (!supabase) {
      // Local fallback: keep minimal in-memory log for dev
      (global as any).__localErrors = (global as any).__localErrors || [];
      (global as any).__localErrors.push({ ...event, id, created_at: new Date().toISOString() });
      return id;
    }

    if (!supabase) {
      log.warn('Supabase unavailable; skipping error persist', LogContext.DATABASE, { id });
      return null;
    }

    const payload = {
      id,
      path: event.path,
      method: event.method,
      message: event.message,
      stack: event.stack || null,
      status_code: event.statusCode || 500,
      metadata: event.metadata || {},
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('error_events').insert(payload);
    if (error) {
      log.error('Failed to persist error event', LogContext.DATABASE, { error: error.message });
      return null;
    }

    return id;
  }

  async logCorrection(event: CorrectionEvent): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      (global as any).__localCorrections = (global as any).__localCorrections || [];
      (global as any).__localCorrections.push({ ...event, created_at: new Date().toISOString() });
      return true;
    }

    const payload = {
      correlation_id: event.correlationId,
      fix_summary: event.fixSummary,
      metadata: event.metadata || {},
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('error_corrections').insert(payload);
    if (error) {
      log.error('Failed to persist correction event', LogContext.DATABASE, {
        error: error.message,
      });
      return false;
    }

    return true;
  }
}

export const errorLogService = new ErrorLogService();

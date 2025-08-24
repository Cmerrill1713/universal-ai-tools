import { v4 as uuidv4 } from 'uuid';

import { getSupabaseClient } from './supabase-client.js';
import { log, LogContext } from '../utils/logger.js';

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
  private broadcastService: any = null;
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();
  private healthStatus: any = { healthy: true, lastCheck: new Date() };

  setBroadcastService(service: any): void {
    this.broadcastService = service;
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(handler);
  }

  getHealthStatus(): any {
    return this.healthStatus;
  }

  async logError(event: ErrorEvent): Promise<string | null> {
    const supabase = getSupabaseClient();
    // Always use a UUID for the primary key to satisfy DB type constraints
    const id = uuidv4();

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
      correlation_id: event.correlationId || null,
      path: event.path,
      method: event.method,
      message: event.message,
      stack: event.stack || null,
      status_code: event.statusCode || 500,
      metadata: event.metadata || {},
      created_at: new Date().toISOString(),
    } as const;

    try {
      const { error } = await supabase.from('error_events').insert(payload);
      if (error) {
        // Retry without correlation_id if column is missing in current schema
        if (/correlation_id/.test(error.message || '')) {
          const { correlation_id: _omit, ...fallbackPayload } = payload as any;
          const retry = await supabase.from('error_events').insert(fallbackPayload);
          if (retry.error) {
            log.error('Failed to persist error event', LogContext.DATABASE, {
              error: retry.error.message,
            });
            return null;
          }
        } else {
          log.error('Failed to persist error event', LogContext.DATABASE, { error: error.message });
          return null;
        }
      }
    } catch (persistErr: any) {
      // Never throw; log and continue
      log.error('Failed to persist error event', LogContext.DATABASE, {
        error: String(persistErr?.message || persistErr),
      });
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

    try {
      const { error } = await supabase.from('error_corrections').insert(payload);
      if (error) {
        log.error('Failed to persist correction event', LogContext.DATABASE, {
          error: error.message,
        });
        return false;
      }
    } catch (persistErr: any) {
      log.error('Failed to persist correction event', LogContext.DATABASE, {
        error: String(persistErr?.message || persistErr),
      });
      return false;
    }

    return true;
  }
}

export const errorLogService = new ErrorLogService();

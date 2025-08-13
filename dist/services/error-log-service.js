import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '@/services/supabase-client';
import { log, LogContext } from '@/utils/logger';
class ErrorLogService {
    async logError(event) {
        const supabase = getSupabaseClient();
        const id = uuidv4();
        if (!supabase) {
            global.__localErrors = global.__localErrors || [];
            global.__localErrors.push({ ...event, id, created_at: new Date().toISOString() });
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
        };
        try {
            const { error } = await supabase.from('error_events').insert(payload);
            if (error) {
                if (/correlation_id/.test(error.message || '')) {
                    const { correlation_id: _omit, ...fallbackPayload } = payload;
                    const retry = await supabase.from('error_events').insert(fallbackPayload);
                    if (retry.error) {
                        log.error('Failed to persist error event', LogContext.DATABASE, {
                            error: retry.error.message,
                        });
                        return null;
                    }
                }
                else {
                    log.error('Failed to persist error event', LogContext.DATABASE, { error: error.message });
                    return null;
                }
            }
        }
        catch (persistErr) {
            log.error('Failed to persist error event', LogContext.DATABASE, {
                error: String(persistErr?.message || persistErr),
            });
            return null;
        }
        return id;
    }
    async logCorrection(event) {
        const supabase = getSupabaseClient();
        if (!supabase) {
            global.__localCorrections = global.__localCorrections || [];
            global.__localCorrections.push({ ...event, created_at: new Date().toISOString() });
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
        }
        catch (persistErr) {
            log.error('Failed to persist correction event', LogContext.DATABASE, {
                error: String(persistErr?.message || persistErr),
            });
            return false;
        }
        return true;
    }
}
export const errorLogService = new ErrorLogService();
//# sourceMappingURL=error-log-service.js.map
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
let cachedClient = null;
export function getSupabaseClient() {
    try {
        if (cachedClient)
            return cachedClient;
        if (!config?.supabase?.url || !config?.supabase?.serviceKey) {
            log.warn('Supabase config missing; error logging disabled', LogContext.DATABASE);
            return null;
        }
        cachedClient = createClient(config.supabase.url, config.supabase.serviceKey);
        return cachedClient;
    }
    catch (error) {
        log.error('Failed to initialize Supabase client', LogContext.DATABASE, {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
//# sourceMappingURL=supabase-client.js.map
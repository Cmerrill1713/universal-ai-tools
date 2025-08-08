/**
 * Supabase Client Singleton
 * Shared client instance for all services
 */

import { config } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  try {
    if (cachedClient) return cachedClient;

    if (!config?.supabase?.url || !config?.supabase?.serviceKey) {
      log.warn('Supabase config missing; error logging disabled', LogContext.DATABASE);
      return null;
    }

    cachedClient = createClient(config.supabase.url, config.supabase.serviceKey);
    return cachedClient;
  } catch (error) {
    log.error('Failed to initialize Supabase client', LogContext.DATABASE, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

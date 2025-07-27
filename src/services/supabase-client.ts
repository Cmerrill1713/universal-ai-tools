/**
 * Supabase Client Singleton
 * Shared client instance for all services
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { LogContext, log } from '../utils/logger';

let supabaseClient: unknown = null;

try {
  if (config.supabase.url && config.supabase.serviceKey) {
    supabaseClient = createClient(config.supabase.url, config.supabase.serviceKey);
    log.info('✅ Supabase client initialized', LogContext.DATABASE);
  } else {
    log.warn('⚠️ Supabase configuration missing', LogContext.DATABASE);
  }
} catch (error) {
  log.error('❌ Failed to initialize Supabase client', LogContext.DATABASE, {
    error: error instanceof Error ? error.message : String(error),
  });
}

export { supabaseClient };

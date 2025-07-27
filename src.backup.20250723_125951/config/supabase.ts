/**
 * Supabase Configuration
 * Centralized configuration for Supabase client creation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';

/**
 * Create a Supabase client instance
 */
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.warn('Supabase credentials not found in environment variables', LogContext.SYSTEM);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });

  logger.info('Supabase client created', LogContext.SYSTEM);
  return client;
}

/**
 * Validate Supabase configuration
 */
export function validateSupabaseConfig()): boolean {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error('Missing Supaba, LogContext.SYSTEM, {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
    });
    return false;
  }

  return true;
}

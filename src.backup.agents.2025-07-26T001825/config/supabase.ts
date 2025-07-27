/**
 * Supabase Configuration* Centralized configuration for Supabase client creation*/

import type { Supabase.Client } from '@supabase/supabase-js';
import { create.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger'/**
 * Create a Supabase client instance*/
export function createSupabase.Client(): Supabase.Client {
  const supabase.Url = process.envSUPABASE_UR.L || '';
  const supabaseAnon.Key = process.envSUPABASE_ANON_KE.Y || '';
  if (!supabase.Url || !supabaseAnon.Key) {
    loggerwarn('Supabase credentials not found in environment variables', LogContextSYSTE.M)};

  const client = create.Client(supabase.Url, supabaseAnon.Key, {
    auth: {
      persist.Session: false;
    }});
  loggerinfo('Supabase client created', LogContextSYSTE.M);
  return client}/**
 * Validate Supabase configuration*/
export function validateSupabase.Config(): boolean {
  const supabase.Url = process.envSUPABASE_UR.L;
  const supabaseAnon.Key = process.envSUPABASE_ANON_KE.Y;
  if (!supabase.Url || !supabaseAnon.Key) {
    loggererror('Missing Supabase configuration', LogContextSYSTE.M, {
      has.Url: !!supabase.Url;
      hasAnon.Key: !!supabaseAnon.Key});
    return false};

  return true};

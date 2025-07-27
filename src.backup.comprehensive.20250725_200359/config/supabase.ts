/**
 * Supabase Configuration* Centralized configuration for Supabase client creation*/

import type { Supabase.Client } from '@supabase/supabase-js';
import { create.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger'/**
 * Create a Supabase client instance*/
export function create.Supabase.Client(): Supabase.Client {
  const supabase.Url = process.envSUPABASE_U.R.L || '';
  const supabase.Anon.Key = process.envSUPABASE_ANON_K.E.Y || '';
  if (!supabase.Url || !supabase.Anon.Key) {
    loggerwarn('Supabase credentials not found in environment variables', LogContextSYST.E.M);

  const client = create.Client(supabase.Url, supabase.Anon.Key, {
    auth: {
      persist.Session: false,
    }});
  loggerinfo('Supabase client created', LogContextSYST.E.M);
  return client}/**
 * Validate Supabase configuration*/
export function validate.Supabase.Config(): boolean {
  const supabase.Url = process.envSUPABASE_U.R.L;
  const supabase.Anon.Key = process.envSUPABASE_ANON_K.E.Y;
  if (!supabase.Url || !supabase.Anon.Key) {
    loggererror('Missing Supabase configuration', LogContextSYST.E.M, {
      has.Url: !!supabase.Url,
      has.Anon.Key: !!supabase.Anon.Key}),
    return false;

  return true;

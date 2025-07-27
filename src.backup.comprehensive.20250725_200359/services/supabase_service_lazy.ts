/**
 * Supabase Service with Lazy Initialization* This version prevents blocking during module load*/

import type { Supabase.Client } from '@supabase/supabase-js';
import { create.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger';
export class Supabase.Service {
  private static instance: Supabase.Service | null = null,
  private _client: Supabase.Client | null = null,
  private constructor() {
    // Don't initialize in constructor;
  }/**
   * Lazy initialization of Supabase client*/
  private initialize.Client(): void {
    if (this._client) return;
    const supabase.Url = process.envSUPABASE_U.R.L || '';
    const supabase.Anon.Key = process.envSUPABASE_ANON_K.E.Y || '';
    if (!supabase.Url || !supabase.Anon.Key) {
      loggerwarn('Supabase credentials not found in environment variables');

    this._client = create.Client(supabase.Url, supabase.Anon.Key, {
      auth: {
        persist.Session: false,
      }});
    loggerinfo('🗄️ Supabase service initialized (lazy)')}/**
   * Get Supabase client (lazy initialization)*/
  public get client(): Supabase.Client {
    if (!this._client) {
      thisinitialize.Client();
    return this._client!}/**
   * Get singleton instance*/
  public static get.Instance(): Supabase.Service {
    if (!Supabase.Serviceinstance) {
      Supabase.Serviceinstance = new Supabase.Service();
    return Supabase.Serviceinstance}// . rest of the methods remain the same}// Export functions instead of direct instances;
export function get.Supabase.Service(): Supabase.Service {
  return Supabase.Serviceget.Instance();

export function get.Supabase.Client(): Supabase.Client {
  return Supabase.Serviceget.Instance()client}// Don't export singleton instances directly// export const supabase = Supabase.Serviceget.Instance()client// export const supabase.Service = Supabase.Serviceget.Instance();
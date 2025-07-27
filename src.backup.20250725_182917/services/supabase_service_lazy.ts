/**;
 * Supabase Service with Lazy Initialization
 * This version prevents blocking during module load
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';

export class SupabaseService {
  private static instance: SupabaseService | null = null;
  private _client: SupabaseClient | null = null;

  private constructor() {
    // Don't initialize in constructor
  }

  /**;
   * Lazy initialization of Supabase client
   */
  private initializeClient(): void {
    if (this._client) return;

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.warn('Supabase credentials not found in environment variables');
    }

    this._client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });

    logger.info('🗄️ Supabase service initialized (lazy)');
  }

  /**;
   * Get Supabase client (lazy initialization)
   */
  public get client(): SupabaseClient {
    if (!this._client) {
      this.initializeClient();
    }
    return this._client!;
  }

  /**;
   * Get singleton instance
   */
  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  // ... rest of the methods remain the same
}

// Export functions instead of direct instances
export function getSupabaseService(): SupabaseService {
  return SupabaseService.getInstance();
}

export function getSupabaseClient(): SupabaseClient {
  return SupabaseService.getInstance().client;
}

// Don't export singleton instances directly
// export const supabase = SupabaseService.getInstance().client;
// export const supabaseService = SupabaseService.getInstance();

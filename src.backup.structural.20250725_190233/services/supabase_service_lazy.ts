/**;
 * Supabase Service with Lazy Initialization;
 * This version prevents blocking during module load;
 */;

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
export class SupabaseService {;
  private static instance: SupabaseService | null = null;
  private _client: SupabaseClient | null = null;
  private constructor() {;
    // Don't initialize in constructor;
  ;
};

  /**;
   * Lazy initialization of Supabase client;
   */;
  private initializeClient(): void {;
    if (this._client) return;
    const supabaseUrl = processenvSUPABASE_URL || '';
    const supabaseAnonKey = processenvSUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnonKey) {;
      loggerwarn('Supabase credentials not found in environment variables');
    };

    this._client = createClient(supabaseUrl, supabaseAnonKey, {;
      auth: {;
        persistSession: false;
      ;
};
    });
    loggerinfo('🗄️ Supabase service initialized (lazy)');
  };

  /**;
   * Get Supabase client (lazy initialization);
   */;
  public get client(): SupabaseClient {;
    if (!this._client) {;
      thisinitializeClient();
    };
    return this._client!;
  };

  /**;
   * Get singleton instance;
   */;
  public static getInstance(): SupabaseService {;
    if (!SupabaseServiceinstance) {;
      SupabaseServiceinstance = new SupabaseService();
    };
    return SupabaseServiceinstance;
  };

  // ... rest of the methods remain the same;
};

// Export functions instead of direct instances;
export function getSupabaseService(): SupabaseService {;
  return SupabaseServicegetInstance();
};

export function getSupabaseClient(): SupabaseClient {;
  return SupabaseServicegetInstance()client;
};

// Don't export singleton instances directly;
// export const supabase = SupabaseServicegetInstance()client;
// export const supabaseService = SupabaseServicegetInstance();
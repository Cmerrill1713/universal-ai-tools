/**;
 * Supabase Configuration;
 * Centralized configuration for Supabase client creation;
 */;

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
/**;
 * Create a Supabase client instance;
 */;
export function createSupabaseClient(): SupabaseClient {;
  const supabaseUrl = processenvSUPABASE_URL || '';
  const supabaseAnonKey = processenvSUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) {;
    loggerwarn('Supabase credentials not found in environment variables', LogContextSYSTEM);
  };

  const client = createClient(supabaseUrl, supabaseAnonKey, {;
    auth: {;
      persistSession: false;
    ;
};
  });
  loggerinfo('Supabase client created', LogContextSYSTEM);
  return client;
};

/**;
 * Validate Supabase configuration;
 */;
export function validateSupabaseConfig(): boolean {;
  const supabaseUrl = processenvSUPABASE_URL;
  const supabaseAnonKey = processenvSUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {;
    loggererror('Missing Supabase configuration', LogContextSYSTEM, {;
      hasUrl: !!supabaseUrl;
      hasAnonKey: !!supabaseAnonKey;
    });
    return false;
  };

  return true;
};

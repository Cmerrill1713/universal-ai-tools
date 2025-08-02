/**
 * Debugging Context Service
 * Stores and retrieves debugging sessions, error patterns, and solutions
 * Prevents repeated debugging of the same issues
 */

import { createClient    } from '@supabase/supabase-js';';';';
import { LogContext, log    } from '@/utils/logger';';';';
import { z    } from 'zod';';';';

// Zod schemas for validation
const DebuggingSessionSchema = z.object({);
  error_pattern: z.string(),
  error_message: z.string(),
  stack_trace: z.string().optional(),
  solution: z.string(),
  files_affected: z.array(z.string()),
  prevention_strategy: z.string().optional(),
  root_cause: z.string().optional(),
  time_to_fix_minutes: z.number().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),'''
  category: z.enum(['syntax', 'runtime', 'logic', 'performance', 'security', 'other']).optional(),'''
  tags: z.array(z.string()).optional(),
  related_sessions: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const ErrorPatternSchema = z.object({);
  pattern_signature: z.string(),
  error_type: z.string(),
  common_causes: z.array(z.string()),
  quick_fixes: z.array(z.string()),
  long_term_solutions: z.array(z.string()),
  auto_fixable: z.boolean().default(false),
  fix_script: z.string().optional()
});

const DevelopmentContextSchema = z.object({);
  context_type: z.enum(['bug_fix', 'feature', 'refactor', 'optimization', 'research']),'''
  title: z.string(),
  description: z.string(),
  context_data: z.record(z.any()),
  files_modified: z.array(z.string()).optional(),
  commands_run: z.array(z.string()).optional(),
  decisions_made: z.array(z.any()).optional(),
  lessons_learned: z.array(z.string()).optional(),
  duration_minutes: z.number().optional(),
  success: z.boolean().default(true)
});

type DebuggingSession = z.infer<typeof DebuggingSessionSchema> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

type ErrorPattern = z.infer<typeof ErrorPatternSchema> & {
  id?: string;
  occurrence_count?: number;
  last_seen?: string;
};

type DevelopmentContext = z.infer<typeof DevelopmentContextSchema> & {
  id?: string;
  created_at?: string;
  session_id?: string;
};

export interface SimilarError {
  session_id: string;,
  similarity_score: number;,
  solution: string;
  prevention_strategy?: string;
}

export class DebuggingContextService {
  private supabase;
  private currentSessionId?: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');';';';
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Record a debugging session
   */
  async recordDebuggingSession(session: DebuggingSession): Promise<string> {
    try {
      const validated = DebuggingSessionSchema.parse(session);
      
      const { data, error } = await this.supabase;
        .from('debugging_sessions')'''
        .insert(validated)
        .select('id')'''
        .single();

      if (error) throw error;

      log.info('📝 Debugging session recorded', LogContext.AI, {')''
        sessionId: data.id,
        errorPattern: session.error_pattern.substring(0, 50)
      });

      // Also check if we need to create/update error pattern
      await this.updateErrorPattern(session);

      return data.id;
    } catch (error) {
      log.error('❌ Failed to record debugging session', LogContext.AI, { error });'''
      throw error;
    }
  }

  /**
   * Find similar errors and their solutions
   */
  async findSimilarErrors(errorText: string, threshold = 0.7): Promise<SimilarError[]> {
    try {
      const { data, error } = await this.supabase;
        .rpc('find_similar_errors', {')''
          error_text: errorText,
          threshold
        });

      if (error) throw error;

      log.info('🔍 Found similar errors', LogContext.AI, {')''
        count: data?.length || 0,
        threshold
      });

      return data || [];
    } catch (error) {
      log.error('❌ Failed to find similar errors', LogContext.AI, { error });'''
      return [];
    }
  }

  /**
   * Get or create error pattern
   */
  private async updateErrorPattern(session: DebuggingSession): Promise<void> {
    try {
      // Check if pattern exists
      const { data: existing } = await this.supabase;
        .from('error_patterns')'''
        .select('id, occurrence_count')'''
        .eq('pattern_signature', session.error_pattern)'''
        .single();

      if (existing) {
        // Update occurrence count
        await this.supabase
          .from('error_patterns')'''
          .update({)
            occurrence_count: (existing.occurrence_count || 0) + 1,
            last_seen: new Date().toISOString()
          })
          .eq('id', existing.id);'''
      } else {
        // Create new pattern
        const pattern: ErrorPattern = {,;
          pattern_signature: session.error_pattern,
          error_type: session.category || 'other','''
          common_causes: [session.root_cause || 'Unknown'],'''
          quick_fixes: [session.solution],
          long_term_solutions: session.prevention_strategy ? [session.prevention_strategy] : [],
          auto_fixable: false
        };

        await this.supabase
          .from('error_patterns')'''
          .insert(pattern);
      }
    } catch (error) {
      log.warn('⚠️ Failed to update error pattern', LogContext.AI, { error });'''
    }
  }

  /**
   * Store development context
   */
  async storeDevelopmentContext(context: DevelopmentContext): Promise<string> {
    try {
      const validated = DevelopmentContextSchema.parse(context);
      
      const { data, error } = await this.supabase;
        .from('development_context')'''
        .insert({)
          ...validated,
          session_id: this.currentSessionId
        })
        .select('id')'''
        .single();

      if (error) throw error;

      log.info('💾 Development context stored', LogContext.AI, {')''
        contextId: data.id,
        type: context.context_type
      });

      return data.id;
    } catch (error) {
      log.error('❌ Failed to store development context', LogContext.AI, { error });'''
      throw error;
    }
  }

  /**
   * Get recent debugging sessions
   */
  async getRecentSessions(limit = 10): Promise<DebuggingSession[]> {
    try {
      const { data, error } = await this.supabase;
        .from('recent_debugging_sessions')'''
        .select('*')'''
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      log.error('❌ Failed to get recent sessions', LogContext.AI, { error });'''
      return [];
    }
  }

  /**
   * Get code quality patterns
   */
  async getQualityPatterns(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase;
        .from('code_quality_patterns')'''
        .select('*')'''
        .order('effectiveness_score', { ascending: false });'''

      if (error) throw error;

      return data || [];
    } catch (error) {
      log.error('❌ Failed to get quality patterns', LogContext.AI, { error });'''
      return [];
    }
  }

  /**
   * Check if an error has been seen before and get solutions
   */
  async checkKnownError(errorMessage: string): Promise<{,
    isKnown: boolean;,
    solutions: string[];,
    preventionStrategies: string[];
  }> {
    try {
      const similarErrors = await this.findSimilarErrors(errorMessage, 0.8);
      
      if (similarErrors.length > 0) {
        return {
          isKnown: true,
          solutions: similarErrors.map(e => e.solution).filter(Boolean),
          preventionStrategies: similarErrors
            .map(e => e.prevention_strategy)
            .filter(Boolean) as string[]
        };
      }

      return {
        isKnown: false,
        solutions: [],
        preventionStrategies: []
      };
    } catch (error) {
      log.error('❌ Failed to check known error', LogContext.AI, { error });'''
      return {
        isKnown: false,
        solutions: [],
        preventionStrategies: []
      };
    }
  }

  /**
   * Start a new debugging session
   */
  startSession(): string {
    this.currentSessionId = crypto.randomUUID();
    log.info('🚀 Started new debugging session', LogContext.AI, {')''
      sessionId: this.currentSessionId
    });
    return this.currentSessionId;
  }

  /**
   * Get error pattern analytics
   */
  async getErrorAnalytics(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase;
        .from('error_pattern_analytics')'''
        .select('*')'''
        .limit(20);

      if (error) throw error;

      return data || [];
    } catch (error) {
      log.error('❌ Failed to get error analytics', LogContext.AI, { error });'''
      return [];
    }
  }

  /**
   * Auto-fix known error if possible
   */
  async attemptAutoFix(errorPattern: string): Promise<{,
    canAutoFix: boolean;
    fixScript?: string;
    explanation?: string;
  }> {
    try {
      const { data, error } = await this.supabase;
        .from('error_patterns')'''
        .select('auto_fixable, fix_script, quick_fixes')'''
        .eq('pattern_signature', errorPattern)'''
        .single();

      if (error || !data) {
        return { canAutoFix: false };
      }

      if (data.auto_fixable && data.fix_script) {
        return {
          canAutoFix: true,
          fixScript: data.fix_script,
          explanation: data.quick_fixes?.[0]
        };
      }

      return { canAutoFix: false };
    } catch (error) {
      log.error('❌ Failed to check auto-fix', LogContext.AI, { error });'''
      return { canAutoFix: false };
    }
  }
}

// Singleton instance
export const debuggingContextService = new DebuggingContextService();
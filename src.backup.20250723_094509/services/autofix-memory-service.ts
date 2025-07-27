/**
 * Autofix Memory Service - Tracks and learns from code fixes using Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export interface AutofixMemory {
  id?: string;
  file_path: string;
  fix_type: string;
  original_code: string;
  fixed_code: string;
  reasoning: string;
  linterror: string;
  confidence: number;
  success: boolean;
  created_at?: string;
  session_id: string;
  metadata?: {
    line_numbers?: number[];
    imports_changed?: boolean;
    types_improved?: boolean;
    magic_numbers_extracted?: boolean;
    unused_vars_fixed?: boolean;
  };
}

export interface FixPattern {
  pattern_type: string;
  description: string;
  success_rate: number;
  usage_count: number;
  example_before: string;
  example_after: string;
}

export class AutofixMemoryService {
  private supabase: SupabaseClient;
  private sessionId: string;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.sessionId = `autofix_${Date.now()}`;
  }

  /**
   * Store a fix in memory for learning
   */
  async storeFix(fix: Omit<AutofixMemory, 'session_id'>): Promise<void> {
    try {
      const fixWithSession = {
        ...fix,
        session_id: this.sessionId,
      };

      // Generate embedding for the fix contentfor similarity search
      const content= `${fix.fix_type}: ${fix.reasoning} | ${fix.original_code} -> ${fix.fixed_code}`;

      const { data: embedding } = await this.supabase.rpc('ai_generate_embedding', {
        content
      });

      // Store in memories table with autofix-specific metadata
      const { _error memoryError } = await this.supabase.from('memories').insert({
        content
        metadata: {
          ...fixWithSession,
          memory_type: 'autofix',
          tags: [
            'autofix',
            fix.fix_type,
            fix.file_path.split('/').pop()?.split('.')[1] || 'unknown',
          ],
        },
        embedding,
        user_id: 'claude-autofix',
      });

      if (memoryError) {
        logger.warn('Failed to store autofix memory:', memoryError);
      }

      // Also store in dedicated autofix table if it exists
      await this.storeAutofixRecord(fixWithSession);

      logger.info(`📚 Stored autofix memory: ${fix.fix_type} in ${fix.file_path}`);
    } catch (error) {
      logger.error('Error storing autofix memory:', error);
    }
  }

  /**
   * Retrieve similar fixes for learning
   */
  async getSimilarFixes(currentFix: string, filePath: string, limit = 5): Promise<AutofixMemory[]> {
    try {
      // Generate embedding for current fix
      const { data: embedding } = await this.supabase.rpc('ai_generate_embedding', {
        content currentFix,
      });

      // Search for similar fixes
      const { data: memories } = await this.supabase.rpc('search_memories', {
        query_embedding: embedding,
        match_threshold: 0.6,
        match_count: limit,
        filter: { memory_type: 'autofix' },
      });

      if (!memories) return [];

      return memories
        .map((memory: any) => memory.metadata)
        .filter((fix: AutofixMemory) => fix.file_path.endsWith(filePath.split('.').pop() || ''))
        .filter((fix: AutofixMemory) => fix.success);
    } catch (error) {
      logger.error('Error retrieving similar fixes:', error);
      return [];
    }
  }

  /**
   * Get fix patterns for a specific file type
   */
  async getFixPatternsForFileType(fileExtension: string): Promise<FixPattern[]> {
    try {
      const { data } = await this.supabase
        .from('memories')
        .select('*')
        .like('metadata->>tags', `%${fileExtension}%`)
        .eq('metadata->>memory_type', 'autofix')
        .eq('metadata->>success', 'true')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!data) return [];

      // Group by fix type and calculate success patterns
      const patterns = new Map<string, FixPattern>();

      data.forEach((memory: any) => {
        const fix = memory.metadata as AutofixMemory;
        const existing = patterns.get(fix.fix_type);

        if (existing) {
          existing.usage_count++;
          existing.success_rate = (existing.success_rate + (fix.confidence || 0.8)) / 2;
        } else {
          patterns.set(fix.fix_type, {
            pattern_type: fix.fix_type,
            description: fix.reasoning,
            success_rate: fix.confidence || 0.8,
            usage_count: 1,
            example_before: fix.original_code.substring(0, 100),
            example_after: fix.fixed_code.substring(0, 100),
          });
        }
      });

      return Array.from(patterns.values()).sort((a, b) => b.success_rate - a.success_rate);
    } catch (error) {
      logger.error('Error getting fix patterns:', error);
      return [];
    }
  }

  /**
   * Store session summary
   */
  async storeSessionSummary(summary: {
    total_fixes: number;
    files_modified: string[];
    fix_types: string[];
    success_rate: number;
    duration_ms: number;
  }): Promise<void> {
    try {
      const content= `Autofix session completed: ${summary.total_fixes} fixes across ${summary.files_modified.length} files`;

      const { data: embedding } = await this.supabase.rpc('ai_generate_embedding', {
        content
      });

      await this.supabase.from('memories').insert({
        content
        metadata: {
          ...summary,
          memory_type: 'autofix_session',
          session_id: this.sessionId,
          tags: ['autofix', 'session_summary'],
        },
        embedding,
        user_id: 'claude-autofix',
      });

      logger.info(`📊 Stored autofix session summary: ${summary.total_fixes} fixes`);
    } catch (error) {
      logger.error('Error storing session summary:', error);
    }
  }

  /**
   * Get autofix insights and recommendations
   */
  async getAutofixInsights(): Promise<{
    most_common_fixes: string[];
    highest_success_patterns: FixPattern[];
    recent_learnings: string[];
    recommendations: string[];
  }> {
    try {
      const { data: recentFixes } = await this.supabase
        .from('memories')
        .select('*')
        .eq('metadata->>memory_type', 'autofix')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!recentFixes) {
        return {
          most_common_fixes: [],
          highest_success_patterns: [],
          recent_learnings: [],
          recommendations: [],
        };
      }

      // Analyze fix types
      const fixTypeCounts = new Map<string, number>();
      const learnings: string[] = [];

      recentFixes.forEach((memory: any) => {
        const fix = memory.metadata as AutofixMemory;
        fixTypeCounts.set(fix.fix_type, (fixTypeCounts.get(fix.fix_type) || 0) + 1);

        if (fix.success && fix.confidence > 0.8) {
          learnings.push(`${fix.fix_type}: ${fix.reasoning}`);
        }
      });

      const mostCommonFixes = Array.from(fixTypeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type]) => type);

      return {
        most_common_fixes: mostCommonFixes,
        highest_success_patterns: await this.getFixPatternsForFileType('ts'),
        recent_learnings: learnings.slice(0, 10),
        recommendations: [
          'Continue using type inference patterns for better TypeScript compliance',
          'Focus on removing unused imports and variables',
          'Extract magic numbers to named constants for better maintainability',
          'Prefer explicit return types over: any for better type safety',
        ],
      };
    } catch (error) {
      logger.error('Error getting autofix insights:', error);
      return {
        most_common_fixes: [],
        highest_success_patterns: [],
        recent_learnings: [],
        recommendations: [],
      };
    }
  }

  private async storeAutofixRecord(fix: AutofixMemory): Promise<void> {
    try {
      // Try to store in dedicated autofix table if it exists
      const { error} = await this.supabase.from('autofix_history').insert(fix);

      if (_error&& !error.message.includes('does not exist')) {
        logger.warn('Failed to store in autofix_history table:', error);
      }
    } catch (error) {
      // Table might not exist, that's okay - we're storing in memories table: anyway
      logger.debug('Autofix history table not available, using memories only');
    }
  }
}

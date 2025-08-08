/**
 * Context Storage Service - Store and Retrieve Context from Supabase;
 * Implements the CLAUDE?.md instruction: "Always use supabase for context. Save context to supabase for later use."
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger';
import { config } from '../config/environment';

interface ContextEntry {
  id?: string;
  content: string;
  category: 'conversation' | 'project_info' | 'error_analysis' | 'code_patterns' | 'test_results' | 'architecture_patterns';
  source: string;
  userId: string;
  projectPath?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

interface StoredContext {
  id: string;
  content: string;
  category: string;
  source: string;
  userId: string;
  projectPath: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export class ContextStorageService {
  private supabase: SupabaseClient;

  constructor() {
    this?.supabase = createClient(config?.supabase?.url, config?.supabase?.serviceKey);
  }

  /**
   * Store context to Supabase for future use;
   * Implements CLAUDE?.md instruction: "Save context to supabase for later use"
   */
  async storeContext(context: ContextEntry): Promise<string | null> {
    try {
      const { data, error } = await this?.supabase;
        .from('context_storage')
        .insert({
          content: context?.content,
          category: context?.category,
          source: context?.source,
          user_id: context?.userId,
          project_path: context?.projectPath || null,
          metadata: context?.metadata || {},
        })
        .select('id')
        .single();

      if (error) {
        log?.error('Failed to store context to Supabase', LogContext?.DATABASE, {
          error: error?.message,
          category: context?.category,
          source: context?.source;
        });
        return null;
      }

      log?.info('✅ Context stored to Supabase', LogContext?.DATABASE, {
        contextId: data?.id,
        category: context?.category,
        source: context?.source,
        contentLength: context?.content?.length;
      });

      return data?.id;
    } catch (error) {
      log?.error('Error storing context to Supabase', LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error)
      });
      return null;
    }
  }

  /**
   * Retrieve context from Supabase by category and user;
   * Implements CLAUDE?.md instruction: "Always use supabase for context"
   */
  async getContext(
    userId: string,
    category?: string,
    projectPath?: string,
    limit = 10,
  ): Promise<StoredContext[]> {
    try {
      let query = this?.supabase;
        .from('context_storage')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (category) {
        query = query?.eq('category', category);
      }

      if (projectPath) {
        query = query?.eq('project_path', projectPath);
      }

      const { data, error } = await query;

      if (error) {
        log?.error('Failed to retrieve context from Supabase', LogContext?.DATABASE, {
          error: error?.message,
          userId,
          category,
          projectPath;
        });
        return [];
      }

      log?.info('📖 Retrieved context from Supabase', LogContext?.DATABASE, {
        resultsCount: data?.length || 0,
        userId,
        category,
        projectPath;
      });

      return data || [];
    } catch (error) {
      log?.error('Error retrieving context from Supabase', LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error)
      });
      return [];
    }
  }

  /**
   * Update existing context entry;
   */
  async updateContext(contextId: string, updates: Partial<ContextEntry>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (updates?.content) updateData?.content = updates?.content;
      if (updates?.category) updateData?.category = updates?.category;
      if (updates?.source) updateData?.source = updates?.source;
      if (updates?.metadata) updateData?.metadata = updates?.metadata;
      if (updates?.projectPath) updateData?.project_path = updates?.projectPath;
      
      updateData?.updated_at = new Date().toISOString();

      const { error } = await this?.supabase;
        .from('context_storage')
        .update(updateData)
        .eq('id', contextId);

      if (error) {
        log?.error('Failed to update context in Supabase', LogContext?.DATABASE, {
          error: error?.message,
          contextId;
        });
        return false;
      }

      log?.info('✅ Context updated in Supabase', LogContext?.DATABASE, {
        contextId;
      });

      return true;
    } catch (error) {
      log?.error('Error updating context in Supabase', LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error)
      });
      return false;
    }
  }

  /**
   * Search context by content similarity;
   */
  async searchContext(
    userId: string,
    searchQuery: string,
    category?: string,
    limit = 5;
  ): Promise<StoredContext[]> {
    try {
      let query = this?.supabase;
        .from('context_storage')
        .select('*')
        .eq('user_id', userId)
        .textSearch('content', searchQuery)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (category) {
        query = query?.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        log?.error('Failed to search context in Supabase', LogContext?.DATABASE, {
          error: error?.message,
          searchQuery,
          userId,
          category;
        });
        return [];
      }

      log?.info('🔍 Context search completed', LogContext?.DATABASE, {
        resultsCount: data?.length || 0,
        searchQuery,
        userId,
        category;
      });

      return data || [];
    } catch (error) {
      log?.error('Error searching context in Supabase', LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error)
      });
      return [];
    }
  }

  /**
   * Store test results as context for future reference;
   */
  async storeTestResults(
    userId: string,
    testResults: any,
    source: string,
    projectPath?: string;
  ): Promise<string | null> {
    return this?.storeContext({
      content: JSON?.stringify(testResults, null, 2),
      category: 'test_results',
      source,
      userId,
      projectPath,
      metadata: {
        timestamp: new Date().toISOString(),
        testType: 'automated',
        resultType: typeof testResults;
      }
    });
  }

  /**
   * Store conversation history for context;
   */
  async storeConversation(
    userId: string,
    conversation: string,
    source: string,
    projectPath?: string;
  ): Promise<string | null> {
    return this?.storeContext({
      content: conversation,
      category: 'conversation',
      source,
      userId,
      projectPath,
      metadata: {
        timestamp: new Date().toISOString(),
        conversationType: 'user_assistant'
      }
    });
  }

  /**
   * Clear old context entries (cleanup)
   */
  async cleanupOldContext(userId: string, daysOld = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate?.setDate(cutoffDate?.getDate() - daysOld);

      const { data, error } = await this?.supabase;
        .from('context_storage')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate?.toISOString())
        .select('id');

      if (error) {
        log?.error('Failed to cleanup old context', LogContext?.DATABASE, {
          error: error?.message,
          userId,
          daysOld;
        });
        return 0,
      }

      const deletedCount = data?.length || 0,
      log?.info('🧹 Cleaned up old context entries', LogContext?.DATABASE, {
        deletedCount,
        userId,
        daysOld;
      });

      return deletedCount;
    } catch (error) {
      log?.error('Error cleaning up old context', LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error)
      });
      return 0,
    }
  }

  /**
   * Get context statistics for a user;
   */
  async getContextStats(userId: string): Promise<{
    totalEntries: number;
    entriesByCategory: Record<string, number>;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    try {
      const { data, error } = await this?.supabase;
        .from('context_storage')
        .select('category, created_at')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const stats = {
        totalEntries: data?.length || 0,
        entriesByCategory: {} as Record<string, number>,
        oldestEntry: null as string | null,
        newestEntry: null as string | null;
      };

      if (data && data?.length > 0) {
        // Count by category;
        data?.forEach(entry => {
          stats?.entriesByCategory[entry?.category] = 
            (stats?.entriesByCategory[entry?.category] || 0) + 1;
        });

        // Find oldest and newest entries;
        const dates = data?.map(entry => entry?.created_at).sort();
        stats?.oldestEntry = dates[0];
        stats?.newestEntry = dates[dates?.length - 1];
      }

      return stats;
    } catch (error) {
      log?.error('Error getting context stats', LogContext?.DATABASE, {
        error: error instanceof Error ? error?.message : String(error)
      });
      
      return {
        totalEntries: 0,
        entriesByCategory: {},
        oldestEntry: null,
        newestEntry: null;
      };
    }
  }
}

export const contextStorageService = new ContextStorageService();
export default contextStorageService;
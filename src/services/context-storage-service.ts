/**
 * Context Storage Service - Store and Retrieve Context from Supabase
 * Implements the CLAUDE.md instruction: "Always use supabase for context. Save context to supabase for later use."
 */

import { type SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';
import { executeSupabaseOperation, getEnhancedSupabaseClient } from './supabase-client';

interface ContextEntry {
  id?: string;
  content: string;
  category:
    | 'conversation'
    | 'project_info'
    | 'error_analysis'
    | 'code_patterns'
    | 'test_results'
    | 'architecture_patterns'
    | 'research_notes'
    | 'agent_profiles'
    | 'system_events'
    | 'training_data'
    | 'verified_answer';
  source: string;
  userId: string;
  projectPath?: string;
  importance?: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface StoredContext {
  id: string;
  content: string;
  category: string;
  source: string;
  userId: string;
  projectPath: string | null;
  tags: string[];
  importance: number;
  access_count: number;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export class ContextStorageService {
  private supabase: SupabaseClient | null = null;
  private initializationPromise: Promise<SupabaseClient> | null = null;
  
  // Memory-optimized embedding cache with Map for string keys
  private readonly embeddingCache = new Map<string, number[]>();
  private readonly recentQueries = new Map<string, WeakRef<StoredContext[]>>();
  private readonly maxRecentQueries = 20; // Limit recent query cache

  constructor() {
    // Initialize connection lazily
    this.startPeriodicCleanup();
  }

  /**
   * Start periodic cleanup to prevent memory accumulation
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupStaleQueries();
    }, 300000); // Every 5 minutes
  }

  /**
   * Clean up stale query results
   */
  private cleanupStaleQueries(): void {
    const keysToRemove: string[] = [];
    
    for (const [key, weakRef] of this.recentQueries) {
      if (!weakRef.deref()) {
        keysToRemove.push(key);
      }
    }
    
    for (const key of keysToRemove) {
      this.recentQueries.delete(key);
    }
    
    // Enforce size limit
    if (this.recentQueries.size > this.maxRecentQueries) {
      const keys = Array.from(this.recentQueries.keys());
      const keysToDelete = keys.slice(0, this.recentQueries.size - this.maxRecentQueries);
      for (const key of keysToDelete) {
        this.recentQueries.delete(key);
      }
    }
  }

  /**
   * Get Supabase client with enhanced connection management
   */
  private async getSupabaseClient(): Promise<SupabaseClient> {
    if (this.supabase) {
      return this.supabase;
    }

    // Prevent multiple initialization attempts
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = getEnhancedSupabaseClient();
    
    try {
      this.supabase = await this.initializationPromise;
      return this.supabase;
    } catch (error) {
      this.initializationPromise = null; // Reset for retry
      throw error;
    }
  }

  /**
   * Get context by ID
   */
  async getContextById(id: string): Promise<StoredContext | null> {
    return executeSupabaseOperation(async (client) => {
      const { data, error } = await client
        .from('context_storage')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        log.error('Failed to get context by ID', LogContext.AI, { error: error.message, id });
        return null;
      }

      return data;
    }, 'getContextById');
  }

  /**
   * Store context to Supabase for future use
   * Implements CLAUDE.md instruction: "Save context to supabase for later use"
   */
  async storeContext(context: ContextEntry): Promise<string | null> {
    return executeSupabaseOperation(async (client) => {
      try {
        // Generate embedding on write (best practice: embed-at-ingest)
        const embedding = await this.generateEmbedding(
          (config.llm.ollamaUrl || 'http://localhost:11434').replace(/\/$/, ''),
          context.content
        );

        const { data, error } = await client
          .from('context_storage')
          .insert({
            content: context.content,
            category: context.category,
            source: context.source,
            user_id: context.userId,
            project_path: context.projectPath || null,
            metadata: context.metadata || {},
            embedding,
          })
          .select('id')
          .single();

        if (error) {
          log.error('Failed to store context to Supabase', LogContext.DATABASE, {
            error: error.message,
            category: context.category,
            source: context.source,
          });
          return null;
        }

        log.info('✅ Context stored to Supabase', LogContext.DATABASE, {
          contextId: data.id,
          category: context.category,
          source: context.source,
          contentLength: context.content.length,
        });

        return data.id;
      } catch (error) {
        log.error('Error storing context to Supabase', LogContext.DATABASE, {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }, 'storeContext');
  }

  /**
   * Backfill embeddings for a user's context_storage rows.
   * Tries Ollama embeddings; falls back to a deterministic local 384-dim vector.
   */
  async backfillEmbeddingsForUser(userId: string, maxRows = 500): Promise<{ updated: number }> {
    return executeSupabaseOperation(async (client) => {
      const ollamaUrl = (config.llm.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');

      const { data: rows, error } = await client
        .from('context_storage')
        .select('id, content')
        .eq('user_id', userId)
        .is('embedding', null)
        .order('updated_at', { ascending: false })
        .limit(maxRows);

      if (error || !rows || rows.length === 0) {
        return { updated: 0 };
      }

      let updated = 0;
      for (const row of rows) {
        const embedding = await this.generateEmbedding(ollamaUrl, row.content);
        const { error: upErr } = await client
          .from('context_storage')
          .update({ embedding })
          .eq('id', row.id);
        if (!upErr) {updated += 1;}
      }

      return { updated };
    }, 'backfillEmbeddingsForUser');
  }

  private async generateEmbedding(ollamaUrl: string, content: string): Promise<number[]> {
    try {
      const truncated = content.length > 2000 ? `${content.slice(0, 2000)}...` : content;
      const res = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text:latest', prompt: truncated }),
      });
      if (res.ok) {
        const json: any = await res.json();
        if (Array.isArray(json?.embedding)) {return json.embedding as number[];}
      }
      return this.generateFallbackEmbedding(content);
    } catch {
      return this.generateFallbackEmbedding(content);
    }
  }

  private generateFallbackEmbedding(content: string): number[] {
    // Check cache first using content as key
    const cached = this.embeddingCache.get(content);
    if (cached) {
      return cached;
    }

    // Use 384 dimensions to match database schema
    const embedding = new Array(384).fill(0);
    const words = (content || '').toLowerCase().split(/\s+/);
    
    // Process fewer words to save computation and memory
    const maxWords = Math.min(words.length, 50); // Reduced from 100 to 50
    
    for (let i = 0; i < maxWords; i++) {
      const w = words[i];
      if (!w || w.length < 2) {continue;} // Skip very short words
      
      let h = 0;
      // Process only first 20 characters of each word to save time
      const wordChars = w.slice(0, 20);
      for (let j = 0; j < wordChars.length; j++) {
        h = (h << 5) - h + wordChars.charCodeAt(j);
        h |= 0;
      }
      const idx = Math.abs(h) % embedding.length;
      embedding[idx] += 1 / (i + 1);
    }
    
    const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    const result = mag > 0 ? embedding.map((v) => v / mag) : embedding;
    
    // Cache the result using WeakMap for automatic cleanup
    this.embeddingCache.set(content, result);
    
    return result;
  }

  /**
   * Retrieve context from Supabase by category and user
   * Implements CLAUDE.md instruction: "Always use supabase for context"
   */
  async getContext(
    userId: string,
    category?: string,
    projectPath?: string,
    limit = 10
  ): Promise<StoredContext[]> {
    return executeSupabaseOperation(async (client) => {
      let query = client
        .from('context_storage')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      if (projectPath) {
        query = query.eq('project_path', projectPath);
      }

      const { data, error } = await query;

      if (error) {
        log.error('Failed to retrieve context from Supabase', LogContext.DATABASE, {
          error: error.message,
          userId,
          category,
          projectPath,
        });
        return [];
      }

      log.info('📖 Retrieved context from Supabase', LogContext.DATABASE, {
        resultsCount: data?.length || 0,
        userId,
        category,
        projectPath,
      });

      return data || [];
    }, 'getContext');
  }

  /**
   * Update existing context entry
   */
  async updateContext(contextId: string, updates: Partial<ContextEntry>): Promise<boolean> {
    return executeSupabaseOperation(async (client) => {
      const updateData: any = {};

      if (updates.content) {
        updateData.content = updates.content;
      }
      if (updates.category) {
        updateData.category = updates.category;
      }
      if (updates.source) {
        updateData.source = updates.source;
      }
      if (updates.metadata) {
        updateData.metadata = updates.metadata;
      }
      if (updates.projectPath) {
        updateData.project_path = updates.projectPath;
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await client
        .from('context_storage')
        .update(updateData)
        .eq('id', contextId);

      if (error) {
        log.error('Failed to update context in Supabase', LogContext.DATABASE, {
          error: error.message,
          contextId,
        });
        return false;
      }

      log.info('✅ Context updated in Supabase', LogContext.DATABASE, {
        contextId,
      });

      return true;
    }, 'updateContext');
  }

  /**
   * Search context by content similarity
   */
  async searchContext(
    userId: string,
    searchQuery: string,
    category?: string,
    limit = 5
  ): Promise<StoredContext[]> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      let query = this.supabase
        .from('context_storage')
        .select('*')
        .eq('user_id', userId)
        .textSearch('content', searchQuery, { type: 'websearch' })
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      let { data, error } = await query;

      if (error) {
        // Fallback to ILIKE if websearch fails (e.g., syntax errors)
        try {
          const terms = searchQuery
            .toLowerCase()
            .split(/\s+/)
            .filter((t) => t.length > 2)
            .slice(0, 5);
          const pattern = `%${terms.join('%')}%`;
          if (!this.supabase) {
            throw new Error('Supabase client not initialized');
          }
          
          const fallback = await this.supabase
            .from('context_storage')
            .select('*')
            .eq('user_id', userId)
            .ilike('content', pattern)
            .order('updated_at', { ascending: false })
            .limit(limit);
          if (!fallback.error) {
            data = fallback.data || [];
          }
        } catch (e) {
          log.error('Failed to search context in Supabase', LogContext.DATABASE, {
            error: e instanceof Error ? e.message : String(e),
            searchQuery,
            userId,
            category,
          });
          return [];
        }
      }

      log.info('🔍 Context search completed', LogContext.DATABASE, {
        resultsCount: data?.length || 0,
        searchQuery,
        userId,
        category,
      });

      return data || [];
    } catch (error) {
      log.error('Error searching context in Supabase', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Store test results as context for future reference
   */
  async storeTestResults(
    userId: string,
    testResults: any,
    source: string,
    projectPath?: string
  ): Promise<string | null> {
    return this.storeContext({
      content: JSON.stringify(testResults, null, 2),
      category: 'test_results',
      source,
      userId,
      projectPath,
      metadata: {
        timestamp: new Date().toISOString(),
        testType: 'automated',
        resultType: typeof testResults,
      },
    });
  }

  /**
   * Store conversation history for context
   */
  async storeConversation(
    userId: string,
    conversation: string,
    source: string,
    projectPath?: string
  ): Promise<string | null> {
    return this.storeContext({
      content: conversation,
      category: 'conversation',
      source,
      userId,
      projectPath,
      metadata: {
        timestamp: new Date().toISOString(),
        conversationType: 'user_assistant',
      },
    });
  }

  /**
   * Clear old context entries (cleanup)
   */
  async cleanupOldContext(userId: string, daysOld = 30): Promise<number> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await this.supabase
        .from('context_storage')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        log.error('Failed to cleanup old context', LogContext.DATABASE, {
          error: error.message,
          userId,
          daysOld,
        });
        return 0;
      }

      const deletedCount = data?.length || 0;
      log.info('🧹 Cleaned up old context entries', LogContext.DATABASE, {
        deletedCount,
        userId,
        daysOld,
      });

      return deletedCount;
    } catch (error) {
      log.error('Error cleaning up old context', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }


  /**
   * Get contexts by IDs
   */
  async getContextsByIds(contextIds: string[]): Promise<StoredContext[]> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await this.supabase
        .from('context_storage')
        .select('*')
        .in('id', contextIds);

      if (error) {
        log.error('Failed to retrieve contexts by IDs', LogContext.DATABASE, {
          error: error.message,
          contextIds,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Error retrieving contexts by IDs', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get recent contexts for a user
   */
  async getRecentContexts(userId: string, limit = 10): Promise<StoredContext[]> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const {supabase} = this; // Type assertion after null check
      const { data, error } = await supabase
        .from('context_storage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        log.error('Failed to retrieve recent contexts', LogContext.DATABASE, {
          error: error.message,
          userId,
          limit,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      log.error('Error retrieving recent contexts', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get context statistics for a user
   */
  async getContextStats(userId: string): Promise<{
    totalEntries: number;
    entriesByCategory: Record<string, number>;
    oldestEntry: string | null;
    newestEntry: string | null;
  }> {
    try {
      if (!this.supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const {supabase} = this; // Type assertion after null check
      const { data, error } = await supabase
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
        newestEntry: null as string | null,
      };

      if (data && data.length > 0) {
        // Count by category
        data.forEach((entry) => {
          stats.entriesByCategory[entry.category] =
            (stats.entriesByCategory[entry.category] || 0) + 1;
        });

        // Find oldest and newest entries
        const dates = data.map((entry) => entry.created_at).sort();
        const [oldestEntry] = dates;
        stats.oldestEntry = oldestEntry;
        stats.newestEntry = dates[dates.length - 1];
      }

      return stats;
    } catch (error) {
      log.error('Error getting context stats', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalEntries: 0,
        entriesByCategory: {},
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Alias for getContext to match expected API interface
   */
  async retrieveContext(
    userId: string,
    category?: string,
    projectPath?: string,
    limit = 10
  ): Promise<StoredContext[]> {
    return this.getContext(userId, category, projectPath, limit);
  }
}

export const contextStorageService = new ContextStorageService();
export default contextStorageService;

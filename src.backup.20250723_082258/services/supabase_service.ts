/**
 * Supabase Service
 * Handles all Supabase client interactions and database operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';

export class SupabaseService {
  private static instance: SupabaseService;
  public client: SupabaseClient;

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.warn('Supabase credentials not found in environment variables');
    }

    this.client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });

    logger.info('🗄️ Supabase service initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  /**
   * Save context to Supabase
   */
  public async saveContext(userId: string, context: any): Promise<void> {
    try {
      const { _error} = await this.client.from('contexts').insert({
        user_id: userId,
        context,
        created_at: new Date().toISOString(),
      });

      if (_error {
        throw _error;
      }

      logger.info(`Context saved for user ${userId}`);
    } catch (_error) {
      logger.error'Failed to save context:', LogContext.DATABASE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Retrieve context from Supabase
   */
  public async getContext(userId: string, limit = 10): Promise<any[]> {
    try {
      const { data, _error} = await this.client
        .from('contexts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (_error {
        throw _error;
      }

      return data || [];
    } catch (_error) {
      logger.error'Failed to retrieve context:', LogContext.DATABASE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Save memory to Supabase
   */
  public async saveMemory(memory: {
    type: string;
    _content string;
    metadata?: any;
    embedding?: number[];
  }): Promise<void> {
    try {
      const { _error} = await this.client.from('memories').insert({
        ...memory,
        created_at: new Date().toISOString(),
      });

      if (_error {
        throw _error;
      }

      logger.info(`Memory saved: ${memory.type}`);
    } catch (_error) {
      logger.error'Failed to save memory:', LogContext.DATABASE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Search memories by similarity
   */
  public async searchMemories(embedding: number[], limit = 10, threshold = 0.7): Promise<any[]> {
    try {
      // Real vector similarity search using pgvector
      // First, try to use the vector similarity function
      const { data, _error} = await this.client.rpc('search_memories_by_embedding', {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: limit,
      });

      if (_error {
        // If RPC function doesn't exist, fall back to manual similarity search
        logger.warn('RPC function not found, using manual vector search:', _error;
        return await this.fallbackVectorSearch(embedding, limit, threshold);
      }

      return data || [];
    } catch (_error) {
      logger.error'Failed to search memories:', LogContext.DATABASE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });

      // Final fallback to simple search
      return await this.fallbackVectorSearch(embedding, limit, threshold);
    }
  }

  /**
   * Fallback vector search when RPC is not available
   */
  private async fallbackVectorSearch(
    embedding: number[],
    limit: number,
    threshold: number
  ): Promise<any[]> {
    try {
      // Get all memories with embeddings
      const { data: memories, _error} = await this.client
        .from('memories')
        .select('*')
        .not('embedding', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit * 3); // Get more to filter by similarity

      if (_error {
        throw _error;
      }

      if (!memories || memories.length === 0) {
        return [];
      }

      // Calculate cosine similarity for each memory
      const results = memories
        .map((memory) => {
          if (!memory.embedding || !Array.isArray(memory.embedding)) {
            return null;
          }

          const similarity = this.cosineSimilarity(embedding, memory.embedding);
          return {
            ...memory,
            similarity,
          };
        })
        .filter((result) => result !== null && result.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      logger.debug(`Vector search found ${results.length} similar memories`);
      return results;
    } catch (_error) {
      logger.error'Fallback vector search failed:', _error;

      // Last resort: return recent memories
      const { data, _error simpleError } = await this.client
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (simpleError) {
        throw simpleError;
      }

      return data || [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Generic query method
   */
  public async query(table: string, filters?: any): Promise<any[]> {
    try {
      let query = this.client.from(table).select('*');

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data, _error} = await query;

      if (_error {
        throw _error;
      }

      return data || [];
    } catch (_error) {
      logger.error`Failed to query ${table}:`, LogContext.DATABASE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Generic insert method
   */
  public async insert(table: string, data: any): Promise<unknown> {
    try {
      const { data: insertedData, _error} = await this.client
        .from(table)
        .insert(data)
        .select()
        .single();

      if (_error {
        throw _error;
      }

      return insertedData;
    } catch (_error) {
      logger.error`Failed to insert into ${table}:`, LogContext.DATABASE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Generic update method
   */
  public async update(table: string, id: string, data: any): Promise<unknown> {
    try {
      const { data: updatedData, _error} = await this.client
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (_error {
        throw _error;
      }

      return updatedData;
    } catch (_error) {
      logger.error`Failed to update ${table}:`, LogContext.DATABASE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Generic delete method
   */
  public async delete(table: string, id: string): Promise<void> {
    try {
      const { _error} = await this.client.from(table).delete().eq('id', id);

      if (_error {
        throw _error;
      }

      logger.info(`Deleted record ${id} from ${table}`);
    } catch (_error) {
      logger.error`Failed to delete from ${table}:`, LogContext.DATABASE, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }
}

// Export singleton instance for easy access
export const supabase = SupabaseService.getInstance().client;

// Export service instance
export const supabaseService = SupabaseService.getInstance();

// Export client factory function
export function createSupabaseClient() {
  return SupabaseService.getInstance().client;
}

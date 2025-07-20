/**
 * Supabase Service
 * Handles all Supabase client interactions and database operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { logger, LogContext } from '../utils/enhanced-logger';

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
        persistSession: false
      }
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
      const { error } = await this.client
        .from('contexts')
        .insert({
          user_id: userId,
          context,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      logger.info(`Context saved for user ${userId}`);
    } catch (error) {
      logger.error('Failed to save context:', LogContext.DATABASE, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Retrieve context from Supabase
   */
  public async getContext(userId: string, limit = 10): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('contexts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to retrieve context:', LogContext.DATABASE, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Save memory to Supabase
   */
  public async saveMemory(memory: {
    type: string;
    content: string;
    metadata?: any;
    embedding?: number[];
  }): Promise<void> {
    try {
      const { error } = await this.client
        .from('memories')
        .insert({
          ...memory,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      logger.info(`Memory saved: ${memory.type}`);
    } catch (error) {
      logger.error('Failed to save memory:', LogContext.DATABASE, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Search memories by similarity
   */
  public async searchMemories(
    embedding: number[],
    limit = 10,
    threshold = 0.7
  ): Promise<any[]> {
    try {
      // This would typically use pgvector for similarity search
      // For now, returning a placeholder implementation
      const { data, error } = await this.client
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to search memories:', LogContext.DATABASE, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
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

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error(`Failed to query ${table}:`, LogContext.DATABASE, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Generic insert method
   */
  public async insert(table: string, data: any): Promise<any> {
    try {
      const { data: insertedData, error } = await this.client
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return insertedData;
    } catch (error) {
      logger.error(`Failed to insert into ${table}:`, LogContext.DATABASE, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Generic update method
   */
  public async update(table: string, id: string, data: any): Promise<any> {
    try {
      const { data: updatedData, error } = await this.client
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return updatedData;
    } catch (error) {
      logger.error(`Failed to update ${table}:`, LogContext.DATABASE, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Generic delete method
   */
  public async delete(table: string, id: string): Promise<void> {
    try {
      const { error } = await this.client
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      logger.info(`Deleted record ${id} from ${table}`);
    } catch (error) {
      logger.error(`Failed to delete from ${table}:`, LogContext.DATABASE, { error: error instanceof Error ? error.message : String(error) });
      throw error;
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
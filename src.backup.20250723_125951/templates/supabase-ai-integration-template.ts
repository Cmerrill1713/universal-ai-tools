/* eslint-disable no-undef */
/**
 * Supabase AI Integration Template
 * Optimized patterns for AI agents working with Supabase
 *
 * Based on research and best practices for:
 * - Vector search and embeddings
 * - Real-time subscriptions for agent communication
 * - Edge functions for serverless AI processing
 * - Memory management and session persistence
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

export interface SupabaseAIConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  enableRealtime?: boolean;
  enableVectorSearch?: boolean;
}

export interface AgentMemory {
  id: string;
  agent_id: string;
  session_id: string;
  memory_type: 'conversation' | 'tool_usage' | 'learning' | 'context';
  content: any;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  created_at?: string;
  updated_at?: string;
}

export interface AgentSession {
  id: string;
  user_id: string;
  agent_id: string;
  status: 'active' | 'paused' | 'completed' | '_error);
  context: Record<string, unknown>;
  started_at: string;
  last_activity: string;
  ended_at?: string;
}

export interface VectorSearchResult {
  id: string;
  content string;
  metadata: any;
  similarity: number;
}

export class SupabaseAIClient {
  private client: SupabaseClient<Database>;
  private serviceClient?: SupabaseClient<Database>;
  private config: SupabaseAIConfig;

  constructor(config: SupabaseAIConfig {
    this.config = config;
    this.client = createClient(config.url, config.anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    if (config.serviceRoleKey) {
      this.serviceClient = createClient(config.url, config.serviceRoleKey);
    }
  }

  // Session Management
  async createSession(
    userId: string,
    agentId: string,
    context?: Record<string, unknown>
  ): Promise<AgentSession> {
    const session = {
      user_id: userId,
      agent_id: agentId,
      status: 'active' as const,
      context: context || {},
      started_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
    };

    const { data, error} = await this.client
      .from('agent_sessions')
      .insert(session)
      .select()
      .single();

    if (_error throw new Error(`Failed to create session: ${error.message}`);
    return data;
  }

  async updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<AgentSession> {
    const { data, error} = await this.client
      .from('agent_sessions')
      .update({
        ...updates,
        last_activity: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (_error throw new Error(`Failed to update session: ${error.message}`);
    return data;
  }

  async getActiveSession(userId: string, agentId: string: Promise<AgentSession | null> {
    const { data, error} = await this.client
      .from('agent_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .eq('status', 'active')
      .order('last_activity', { ascending: false, })
      .limit(1)
      .single();

    if (_error&& _errorcode !== 'PGRST116') {
      throw new Error(`Failed to get active session: ${error.message}`);
    }

    return data || null;
  }

  // Memory Management
  async storeMemory(
    memory: Omit<AgentMemory, 'id' | 'created_at' | 'updated_at'>
  ): Promise<AgentMemory> {
    const { data, error} = await this.client
      .from('agent_memories')
      .insert(memory)
      .select()
      .single();

    if (_error throw new Error(`Failed to store memory: ${error.message}`);
    return data;
  }

  async getMemories(
    agentId: string,
    sessionId?: string,
    memoryType?: AgentMemory['memory_type'],
    limit = 50
  ): Promise<AgentMemory[]> {
    let query = this.client;
      .from('agent_memories')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false, })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    if (memoryType) {
      query = query.eq('memory_type', memoryType);
    }

    const { data, error} = await query;

    if (_error throw new Error(`Failed to get memories: ${error.message}`);
    return data || [];
  }

  // Vector Search for Semantic Memory
  async semanticSearch(
    query: string,
    agentId: string,
    threshold = 0.7,
    limit = 10
  ): Promise<VectorSearchResult[]> {
    if (!this.serviceClient) {
      throw new Error('Service role key required for vector search');
    }

    // First, get embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);

    // Perform similarity search using pgvector
    const { data, error} = await this.serviceClient.rpc('semantic_search_memories', {
      query_embedding: queryEmbedding,
      agent_id: agentId,
      similarity_threshold: threshold,
      match_count: limit,
    });

    if (_error throw new Error(`Semantic search failed: ${error.message}`);

    return (;
      data?.map((item: any) => ({
        id: item.id,
        content item.content
        metadata: item.metadata,
        similarity: item.similarity,
      })) || []
    );
  }

  async generateEmbedding(text: string: Promise<number[]> {
    // Call Supabase Edge Function for embedding generation
    const { data, error} = await this.client.functions.invoke('generate-embedding', {
      body: { text },
    });

    if (_error throw new Error(`Failed to generate embedding: ${error.message}`);
    return data.embedding;
  }

  // Real-time Communication
  subscribeToAgentEvents(agentId: string, callback: (payload: any => void) {
    if (!this.config.enableRealtime) {
      console.warn('Realtime not enabled in config');
      return;
    }

    return this.client;
      .channel(`agent:${agentId}`)`
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_memories',
          filter: `agent_id=eq.${agentId}`,
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_sessions',
          filter: `agent_id=eq.${agentId}`,
        },
        callback
      )
      .subscribe();
  }

  // Tool Usage Tracking
  async logToolUsage(
    agentId: string,
    sessionId: string,
    toolName: string,
    input: any,
    output: any,
    duration: number,
    success: boolean
  ))): Promise<void> {
    const toolUsage = {
      agent_id: agentId,
      session_id: sessionId,
      memory_type: 'tool_usage' as const,
      content {
        tool_name: toolName,
        _input
        output,
        duration,
        success,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        tool_version: '1.0',
      },
    };

    await this.storeMemory(toolUsage);
  }

  // Agent Performance Analytics
  async getAgentAnalytics(agentId: string, timeRange = '24h')): Promise<unknown> {
    const result = await this.serviceClient?.rpc('get_agent_analytics', {
      agent_id: agentId,
      time_range: timeRange,
    });

    if (!result) throw new Error('Service client not initialized');
    const { data, error} = result;

    if (_error throw new Error(`Failed to get analytics: ${error.message}`);
    return data;
  }

  // Conversation Management
  async storeConversationTurn(
    agentId: string,
    sessionId: string,
    userMessage: string,
    agentResponse: string,
    metadata?: Record<string, unknown>
  ))): Promise<void> {
    const conversation = {
      agent_id: agentId,
      session_id: sessionId,
      memory_type: 'conversation' as const,
      content {
        user_message: userMessage,
        agent_response: agentResponse,
        turn_number: await this.getNextTurnNumber(sessionId),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };

    await this.storeMemory(conversation);
  }

  private async getNextTurnNumber(sessionId: string: Promise<number> {
    const { count } = await this.client
      .from('agent_memories')
      .select('*', { count: 'exact', head: true, })
      .eq('session_id', sessionId)
      .eq('memory_type', 'conversation');

    return (count || 0) + 1;
  }

  // Knowledge Base Management
  async addToKnowledgeBase(
    agentId: string,
    content string,
    metadata: Record<string, unknown>
  ))): Promise<void> {
    const embedding = await this.generateEmbedding(content;

    const knowledge = {
      agent_id: agentId,
      session_id: 'knowledge_base',
      memory_type: 'learning' as const,
      content { text: content},
      metadata,
      embedding,
    };

    await this.storeMemory(knowledge);
  }

  // Cleanup and Maintenance
  async cleanupOldMemories(agentId: string, retentionDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.serviceClient;
      ?.from('agent_memories')
      .delete({ count: 'exact' })
      .eq('agent_id', agentId)
      .lt('created_at', cutoffDate.toISOString());

    if (!result) throw new Error('Service client not initialized');
    const { count, error} = result;

    if (_error throw new Error(`Failed to cleanup memories: ${error.message}`);
    return count || 0;
  }

  // Health Check
  async healthCheck(): Promise<{ status: string; timestamp: Date; features: string[] }> {
    try {
      await this.client.from('agent_sessions').select('id').limit(1);

      const features = ['sessions', 'memories'];
      if (this.serviceClient) features.push('vector_search');
      if (this.config.enableRealtime) features.push('realtime');

      return {
        status: 'healthy',
        timestamp: new Date(),
        features,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        features: [],
      };
    }
  }
}

// Utility function to create a configured client
export function createSupabaseAIClient(config: SupabaseAIConfig: SupabaseAIClient {
  return new SupabaseAIClient(config);
}

// Helper for batch operations
export class SupabaseAIBatch {
  private client: SupabaseAIClient;
  private operations: Array<() => Promise<unknown>> = [];

  constructor(client: SupabaseAIClient {
    this.client = client;
  }

  addMemory(memory: Omit<AgentMemory, 'id' | 'created_at' | 'updated_at'>): this {
    this.operations.push(() => this.client.storeMemory(memory));
    return this;
  }

  async execute(concurrency = 5): Promise<any[]> {
    const results = [];

    for (let i = 0; i < this.operations.length; i += concurrency) {
      const batch = this.operations.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch.map((op) => op()));
      results.push(...batchResults);
    }

    return results;
  }
}

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

export class SupabaseEnhancedService {
  private supabase: SupabaseClient;
  private supabaseKey: string;
  private graphqlEndpoint: string;
  private realtimeChannels: Map<string, RealtimeChannel> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseKey = supabaseKey;
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    
    this.graphqlEndpoint = `${supabaseUrl}/graphql/v1`;
  }

  // GraphQL Operations
  async graphql(query: string, variables?: any): Promise<any> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': this.supabaseKey
        },
        body: JSON.stringify({ query, variables })
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
      }
      
      return result.data;
    } catch (error) {
      logger.error('GraphQL operation failed:', error);
      throw error;
    }
  }

  // AI Message Processing via GraphQL
  async processAIMessage(message: string, model = 'gpt-4', contextWindow = 10): Promise<any> {
    const query = `
      query ProcessAIMessage($message: String!, $model: String!, $contextWindow: Int!) {
        processAiMessage(userMessage: $message, modelName: $model, contextWindow: $contextWindow) {
          message
          model
          timestamp
        }
      }
    `;
    
    return this.graphql(query, { message, model, contextWindow });
  }

  // Memory Operations via GraphQL
  async memoryOperation(operation: 'store' | 'retrieve' | 'search', params: any): Promise<any> {
    const query = `
      query MemoryOperation($operation: String!, $content: String, $query: String, $limit: Int) {
        memoryOperation(operation: $operation, content: $content, query: $query, limitCount: $limit)
      }
    `;
    
    return this.graphql(query, { operation, ...params });
  }

  // Realtime Subscriptions
  subscribeToAgentStatus(callback: (payload: any) => void): RealtimeChannel {
    const channel = this.supabase
      .channel('agent-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_status'
        },
        callback
      )
      .subscribe();
    
    this.realtimeChannels.set('agent-status', channel);
    return channel;
  }

  subscribeToMemories(userId: string, callback: (payload: any) => void): RealtimeChannel {
    const channel = this.supabase
      .channel(`memories-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'memories',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
    
    this.realtimeChannels.set(`memories-${userId}`, channel);
    return channel;
  }

  // AI Session Broadcast
  async createAISession(): Promise<string> {
    const { data, error } = await this.supabase.rpc('create_ai_session_channel');
    if (error) throw error;
    return data;
  }

  broadcastToSession(sessionId: string, message: any): RealtimeChannel {
    const channel = this.supabase.channel(sessionId);
    
    channel
      .on('broadcast', { event: 'ai-message' }, (payload) => {
        logger.info('Received broadcast:', payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'ai-message',
            payload: message
          });
        }
      });
    
    this.realtimeChannels.set(sessionId, channel);
    return channel;
  }

  // Presence Tracking
  trackPresence(sessionId: string, userData: any): RealtimeChannel {
    const channel = this.supabase.channel(sessionId);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        logger.info('Presence state:', state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        logger.info('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        logger.info('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userData);
        }
      });
    
    return channel;
  }

  // Edge Functions
  async callEdgeFunction(functionName: string, body: any): Promise<any> {
    try {
      const { data, error } = await this.supabase.functions.invoke(functionName, {
        body
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Edge function ${functionName} failed:`, error);
      throw error;
    }
  }

  // Voice Processing via Edge Function
  async processVoice(action: 'transcribe' | 'synthesize', params: any): Promise<any> {
    return this.callEdgeFunction('voice-processor', {
      action,
      ...params
    });
  }

  // LLM Gateway via Edge Function
  async callLLM(model: string, messages: any[], options?: any): Promise<any> {
    return this.callEdgeFunction('llm-gateway', {
      model,
      messages,
      ...options
    });
  }

  // Vault Operations (Service Role Only)
  async getAPIKey(keyName: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.rpc('get_api_key', {
        key_name: keyName
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Failed to get API key ${keyName}:`, error);
      return null;
    }
  }

  // Storage Operations
  async uploadAudio(bucket: string, path: string, file: Blob): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
    
    return publicUrl;
  }

  async downloadAudio(bucket: string, path: string): Promise<Blob> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(path);
    
    if (error) throw error;
    return data;
  }

  // Analytics
  async trackEvent(eventType: string, metadata: any = {}): Promise<void> {
    try {
      await this.supabase.from('analytics_events').insert({
        event_type: eventType,
        metadata
      });
    } catch (error) {
      logger.error('Failed to track event:', error);
    }
  }

  // Model Recommendations
  async recommendModel(taskType: string, requirements?: any): Promise<any> {
    const { data, error } = await this.supabase.rpc('recommend_model_for_task', {
      task_type: taskType,
      requirements: requirements || {}
    });
    
    if (error) throw error;
    return data;
  }

  // Get LLM Usage Dashboard
  async getLLMUsage(): Promise<any> {
    const { data, error } = await this.supabase
      .from('llm_usage_dashboard')
      .select('*')
      .order('last_used', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  // Cleanup
  unsubscribeAll(): void {
    this.realtimeChannels.forEach((channel, key) => {
      channel.unsubscribe();
    });
    this.realtimeChannels.clear();
  }
}

// Export singleton instance
export const supabaseEnhanced = new SupabaseEnhancedService(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_KEY || ''
);
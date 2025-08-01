/**
 * Supabase Memory Service - Persistent conversation memory with Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger.js';

export interface ConversationMessage {
  id?: string;
  user_id: string;
  session_id?: string;
  message: string;
  response: string;
  agent_type: string;
  agent_model: string;
  confidence: number;
  timestamp: string;
  created_at?: string;
}

export interface UserPreferences {
  id?: string;
  user_id: string;
  preferred_agent?: string;
  communication_style?: string;
  topics: string[];
  preferences: Record<string, any>;
  session_start: string;
  last_activity: string;
  message_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationHistory {
  userId: string;
  messages: ConversationMessage[];
  preferences: Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>;
  context: {
    currentTopic?: string;
    sessionStart: string;
    lastActivity: string;
    messageCount: number;
  };
}

export class SupabaseMemoryService {
  private supabase: SupabaseClient;
  
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    log.info('🧠 Supabase Memory Service initialized', LogContext.SERVICE, {
      url: supabaseUrl.replace(/\/\/.*@/, '//***@') // Hide credentials in logs
    });
  }

  /**
   * Store a conversation interaction
   */
  async storeConversation(
    userId: string, 
    message: string, 
    response: string, 
    agentType: string, 
    confidence: number,
    agentModel: string = agentType,
    sessionId?: string
  ): Promise<void> {
    try {
      const conversationMessage: Omit<ConversationMessage, 'id' | 'created_at'> = {
        user_id: userId,
        session_id: sessionId,
        message,
        response,
        agent_type: agentType,
        agent_model: agentModel,
        confidence,
        timestamp: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('conversation_messages')
        .insert([conversationMessage]);

      if (error) {
        throw error;
      }

      // Update topics in user preferences
      await this.updateUserTopics(userId, message);

      log.info('💾 Conversation stored in Supabase', LogContext.SERVICE, {
        userId,
        agentType,
        confidence,
        messageLength: message.length,
        responseLength: response.length
      });

    } catch (error) {
      log.error('❌ Failed to store conversation in Supabase', LogContext.SERVICE, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Retrieve conversation history for a user
   */
  async getConversationHistory(userId: string, limit = 10): Promise<ConversationHistory | null> {
    try {
      // Get recent messages
      const { data: messages, error: messagesError } = await this.supabase
        .from('conversation_messages')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (messagesError) {
        throw messagesError;
      }

      // Get user preferences
      const { data: preferencesData, error: preferencesError } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (preferencesError && preferencesError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw preferencesError;
      }

      if (!messages || messages.length === 0) {
        return null;
      }

      // Reverse messages to get chronological order
      const sortedMessages = messages.reverse();

      const preferences: Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'> = preferencesData ? {
        user_id: preferencesData.user_id,
        preferred_agent: preferencesData.preferred_agent,
        communication_style: preferencesData.communication_style,
        topics: preferencesData.topics || [],
        preferences: preferencesData.preferences || {},
        session_start: preferencesData.session_start,
        last_activity: preferencesData.last_activity,
        message_count: preferencesData.message_count
      } : {
        user_id: userId,
        topics: [],
        preferences: {},
        session_start: sortedMessages[0]?.timestamp || new Date().toISOString(),
        last_activity: sortedMessages[sortedMessages.length - 1]?.timestamp || new Date().toISOString(),
        message_count: sortedMessages.length
      };

      const history: ConversationHistory = {
        userId,
        messages: sortedMessages,
        preferences,
        context: {
          sessionStart: preferences.session_start,
          lastActivity: preferences.last_activity,
          messageCount: preferences.message_count
        }
      };

      log.info('📖 Retrieved conversation history from Supabase', LogContext.SERVICE, {
        userId,
        messagesReturned: sortedMessages.length,
        totalMessages: preferences.message_count
      });

      return history;
      
    } catch (error) {
      log.error('❌ Failed to retrieve conversation history from Supabase', LogContext.SERVICE, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get user preferences based on conversation history
   */
  async getUserPreferences(userId: string): Promise<Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'> | null> {
    try {
      const { data, error } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        user_id: data.user_id,
        preferred_agent: data.preferred_agent,
        communication_style: data.communication_style,
        topics: data.topics || [],
        preferences: data.preferences || {},
        session_start: data.session_start,
        last_activity: data.last_activity,
        message_count: data.message_count
      };
      
    } catch (error) {
      log.error('❌ Failed to get user preferences from Supabase', LogContext.SERVICE, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get conversation context for better responses
   */
  async getConversationContext(userId: string): Promise<string | null> {
    try {
      const { data: messages, error } = await this.supabase
        .from('conversation_messages')
        .select('message, response, agent_type')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(3);

      if (error) {
        throw error;
      }

      if (!messages || messages.length === 0) {
        return null;
      }

      // Reverse to get chronological order
      const recentMessages = messages.reverse();
      const context = recentMessages
        .map(m => `User: ${m.message} | Assistant (${m.agent_type}): ${m.response.substring(0, 100)}...`)
        .join('\n');

      return `Recent conversation context:\n${context}`;
      
    } catch (error) {
      log.error('❌ Failed to get conversation context from Supabase', LogContext.SERVICE, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Update user topics based on message content
   */
  private async updateUserTopics(userId: string, message: string): Promise<void> {
    try {
      const extractedTopics = this.extractTopics(message);
      if (extractedTopics.length === 0) {
        return;
      }

      // Get current preferences
      const { data: currentPrefs, error: getError } = await this.supabase
        .from('user_preferences')
        .select('topics')
        .eq('user_id', userId)
        .single();

      if (getError && getError.code !== 'PGRST116') {
        throw getError;
      }

      const currentTopics = currentPrefs?.topics || [];
      const newTopics = [...new Set([...currentTopics, ...extractedTopics])].slice(-20); // Keep last 20 topics

      // Update or insert preferences
      const { error: upsertError } = await this.supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          topics: newTopics,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        throw upsertError;
      }

    } catch (error) {
      log.error('❌ Failed to update user topics', LogContext.SERVICE, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw here - topic extraction is not critical
    }
  }

  /**
   * Simple topic extraction from message
   */
  private extractTopics(message: string): string[] {
    const topics: string[] = [];
    const lowerMessage = message.toLowerCase();

    // Programming topics
    const programmingTopics = [
      'javascript', 'typescript', 'python', 'java', 'swift', 'go', 'rust',
      'react', 'vue', 'angular', 'node', 'express', 'api', 'database',
      'frontend', 'backend', 'fullstack', 'mobile', 'web'
    ];

    // General topics
    const generalTopics = [
      'planning', 'task', 'project', 'help', 'support', 'learning',
      'problem', 'solution', 'advice', 'guidance'
    ];

    for (const topic of [...programmingTopics, ...generalTopics]) {
      if (lowerMessage.includes(topic)) {
        topics.push(topic);
      }
    }

    return topics;
  }

  /**
   * Get memory service statistics
   */
  async getStats() {
    try {
      const { data, error } = await this.supabase
        .rpc('get_conversation_stats');

      if (error) {
        throw error;
      }

      return data || {
        totalUsers: 0,
        totalMessages: 0,
        averageMessagesPerUser: 0
      };
      
    } catch (error) {
      log.error('❌ Failed to get conversation stats from Supabase', LogContext.SERVICE, {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalUsers: 0,
        totalMessages: 0,
        averageMessagesPerUser: 0
      };
    }
  }

  /**
   * Clear old conversations (cleanup)
   */
  async cleanup(olderThanDays = 30): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .rpc('cleanup_old_conversations', { days_to_keep: olderThanDays });

      if (error) {
        throw error;
      }

      const cleaned = data || 0;
      
      if (cleaned > 0) {
        log.info('🧹 Memory cleanup completed in Supabase', LogContext.SERVICE, {
          conversationsRemoved: cleaned,
          olderThanDays
        });
      }

      return cleaned;
      
    } catch (error) {
      log.error('❌ Memory cleanup failed in Supabase', LogContext.SERVICE, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Health check for Supabase connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('conversation_messages')
        .select('count(*)')
        .limit(1);

      return !error;
    } catch (error) {
      log.error('❌ Supabase health check failed', LogContext.SERVICE, {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}

export default SupabaseMemoryService;
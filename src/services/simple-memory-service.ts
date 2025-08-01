/**
 * Simple Memory Service - Basic conversation memory without complex dependencies
 */

import { LogContext, log } from '../utils/logger.js';

export interface ConversationMemory {
  userId: string;
  messages: Array<{
    timestamp: string;
    message: string;
    response: string;
    agentType: string;
    confidence: number;
  }>;
  preferences: {
    preferredAgent?: string;
    communicationStyle?: string;
    topics: string[];
  };
  context: {
    currentTopic?: string;
    sessionStart: string;
    lastActivity: string;
    messageCount: number;
  };
}

export class SimpleMemoryService {
  private conversations: Map<string, ConversationMemory> = new Map();
  private maxMessages = 100; // Keep last 100 messages per user
  
  constructor() {
    log.info('🧠 Simple Memory Service initialized', LogContext.SERVICE);
  }

  /**
   * Store a conversation interaction
   */
  async storeConversation(
    userId: string, 
    message: string, 
    response: string, 
    agentType: string, 
    confidence: number
  ): Promise<void> {
    try {
      let memory = this.conversations.get(userId);
      
      if (!memory) {
        memory = {
          userId,
          messages: [],
          preferences: {
            topics: []
          },
          context: {
            sessionStart: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            messageCount: 0
          }
        };
        this.conversations.set(userId, memory);
        
        log.info('🆕 New conversation memory created', LogContext.SERVICE, { userId });
      }

      // Add the new message
      memory.messages.push({
        timestamp: new Date().toISOString(),
        message,
        response,
        agentType,
        confidence
      });

      // Keep only the last maxMessages
      if (memory.messages.length > this.maxMessages) {
        memory.messages = memory.messages.slice(-this.maxMessages);
      }

      // Update context
      memory.context.lastActivity = new Date().toISOString();
      memory.context.messageCount++;

      // Update preferences based on usage patterns
      this.updatePreferences(memory, message, agentType);

      log.info('💾 Conversation stored', LogContext.SERVICE, {
        userId,
        messageCount: memory.context.messageCount,
        agentType,
        confidence
      });

    } catch (error) {
      log.error('❌ Failed to store conversation', LogContext.SERVICE, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Retrieve conversation history for a user
   */
  async getConversationHistory(userId: string, limit = 10): Promise<ConversationMemory | null> {
    try {
      const memory = this.conversations.get(userId);
      
      if (!memory) {
        return null;
      }

      // Return a copy with limited messages
      const limitedMemory: ConversationMemory = {
        ...memory,
        messages: memory.messages.slice(-limit)
      };

      log.info('📖 Retrieved conversation history', LogContext.SERVICE, {
        userId,
        messagesReturned: limitedMemory.messages.length,
        totalMessages: memory.messages.length
      });

      return limitedMemory;
      
    } catch (error) {
      log.error('❌ Failed to retrieve conversation history', LogContext.SERVICE, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get user preferences based on conversation history
   */
  async getUserPreferences(userId: string): Promise<ConversationMemory['preferences'] | null> {
    try {
      const memory = this.conversations.get(userId);
      return memory?.preferences || null;
    } catch (error) {
      log.error('❌ Failed to get user preferences', LogContext.SERVICE, {
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
      const memory = this.conversations.get(userId);
      
      if (!memory || memory.messages.length === 0) {
        return null;
      }

      // Get recent messages for context
      const recentMessages = memory.messages.slice(-3);
      const context = recentMessages
        .map(m => `User: ${m.message} | Assistant (${m.agentType}): ${m.response.substring(0, 100)}...`)
        .join('\n');

      return `Recent conversation context:\n${context}`;
      
    } catch (error) {
      log.error('❌ Failed to get conversation context', LogContext.SERVICE, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Update user preferences based on interaction patterns
   */
  private updatePreferences(memory: ConversationMemory, message: string, agentType: string): void {
    // Track preferred agent
    const agentCounts = memory.messages.reduce((counts, msg) => {
      counts[msg.agentType] = (counts[msg.agentType] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const mostUsedAgent = Object.entries(agentCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    if (mostUsedAgent) {
      memory.preferences.preferredAgent = mostUsedAgent;
    }

    // Extract topics from messages
    const topics = this.extractTopics(message);
    for (const topic of topics) {
      if (!memory.preferences.topics.includes(topic)) {
        memory.preferences.topics.push(topic);
      }
    }

    // Keep only recent topics (last 20)
    if (memory.preferences.topics.length > 20) {
      memory.preferences.topics = memory.preferences.topics.slice(-20);
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
  getStats() {
    const totalUsers = this.conversations.size;
    const totalMessages = Array.from(this.conversations.values())
      .reduce((sum, memory) => sum + memory.messages.length, 0);

    return {
      totalUsers,
      totalMessages,
      averageMessagesPerUser: totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0
    };
  }

  /**
   * Clear old conversations (cleanup)
   */
  async cleanup(olderThanHours = 24): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      let cleaned = 0;

      for (const [userId, memory] of this.conversations.entries()) {
        const lastActivity = new Date(memory.context.lastActivity);
        if (lastActivity < cutoffTime) {
          this.conversations.delete(userId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        log.info('🧹 Memory cleanup completed', LogContext.SERVICE, {
          conversationsRemoved: cleaned,
          olderThanHours
        });
      }

      return cleaned;
      
    } catch (error) {
      log.error('❌ Memory cleanup failed', LogContext.SERVICE, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
}

export default SimpleMemoryService;
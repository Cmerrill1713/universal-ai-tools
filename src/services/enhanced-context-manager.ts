/**
 * Enhanced Context Manager - Automatic Context Persistence & Token Limit Management
 *
 * This service automatically manages conversation context to prevent token limits
 * and constant compacting issues by intelligently persisting context to Supabase.
 *
 * Features:
 * - Automatic context size monitoring and persistence
 * - Intelligent context compression and summarization
 * - Semantic context retrieval with relevance scoring
 * - Background context cleanup and optimization
 * - Integration with existing context-storage-service
 */

import { createClient,type SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config/environment';
import { log,LogContext } from '../utils/logger';
import { contextStorageService } from './context-storage-service';

interface ConversationContext {
  id: string;
  messages: ConversationMessage[];
  metadata: ContextMetadata;
  totalTokens: number;
  lastAccessed: Date;
  compressionLevel: number; // 0-1, where 1 is highly compressed
}

interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens: number;
  importance: number; // 0-1, relevance/importance score
  metadata?: Record<string, any>;
}

interface ContextMetadata {
  userId: string;
  sessionId: string;
  projectPath?: string;
  workingDirectory?: string;
  contextType: 'conversation' | 'project' | 'session' | 'task';
  tags: string[];
  summary?: string;
  keyTopics: string[];
}

interface ContextSummary {
  content: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  keyPoints: string[];
  preservedMessages: number;
  timestamp: Date;
}

interface ContextRetrievalOptions {
  maxTokens?: number;
  relevanceThreshold?: number;
  includeRecentMessages?: boolean;
  includeSummaries?: boolean;
  timeWindow?: number; // hours
  topicFilter?: string[];
}

export class EnhancedContextManager {
  private supabase: SupabaseClient;
  private activeContexts = new Map<string, ConversationContext>();
  private readonly MAX_ACTIVE_CONTEXTS = parseInt(process.env.CTX_MAX_ACTIVE || '50', 10);
  private readonly DEFAULT_TOKEN_LIMIT = parseInt(process.env.CTX_MAX_TOKENS || '32000', 10); // Increased from 8000 to 32000
  private readonly COMPRESSION_TRIGGER = parseInt(
    process.env.CTX_COMPRESSION_TRIGGER ||
      Math.floor((this.DEFAULT_TOKEN_LIMIT * 3) / 4).toString(),
    10
  ); // 75% of limit
  private readonly PERSISTENCE_TRIGGER = parseInt(
    process.env.CTX_PERSISTENCE_TRIGGER || Math.floor(this.DEFAULT_TOKEN_LIMIT / 2).toString(),
    10
  ); // 50% of limit
  private readonly CLEANUP_INTERVAL = parseInt(
    process.env.CTX_CLEANUP_INTERVAL_MS || (30 * 60 * 1000).toString(),
    10
  ); // 30 minutes

  // Per-session context limits to prevent global issues
  private readonly MAX_TOKENS_PER_SESSION = parseInt(process.env.SESSION_MAX_TOKENS || '64000', 10); // 64k tokens per session
  private readonly MAX_MESSAGES_PER_SESSION = parseInt(
    process.env.SESSION_MAX_MESSAGES || '1000',
    10
  ); // 1000 messages per session
  private readonly SESSION_ISOLATION_ENABLED =
    (process.env.SESSION_ISOLATION_ENABLED || 'true') === 'true'; // Enable session isolation

  // Context compression settings
  private readonly IMPORTANCE_WEIGHTS = {
    user_question: 0.9,
    assistant_answer: 0.7,
    error_message: 0.8,
    code_block: 0.6,
    system_message: 0.3,
  };

  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    this.startBackgroundCleanup();
    log.info('🧠 Enhanced Context Manager initialized', LogContext.CONTEXT_INJECTION, {
      maxActiveContexts: this.MAX_ACTIVE_CONTEXTS,
      tokenLimit: this.DEFAULT_TOKEN_LIMIT,
      compressionTrigger: this.COMPRESSION_TRIGGER,
    });
  }

  /**
   * Add a message to the conversation context with automatic persistence
   */
  async addMessage(
    sessionId: string,
    message: Omit<ConversationMessage, 'timestamp' | 'tokens' | 'importance'>
  ): Promise<{ contextId: string; shouldCompress: boolean; tokenCount: number }> {
    try {
      const contextId = this.getContextId(sessionId, message.metadata?.userId || 'anonymous');
      let context = this.activeContexts.get(contextId);

      if (!context) {
        context = await this.initializeContext(contextId, sessionId, message.metadata?.userId);
      }

      // Calculate message tokens and importance
      const tokens = this.estimateTokens(message.content);
      const importance = this.calculateMessageImportance(message);

      // Check per-session limits to prevent global context issues
      if (this.SESSION_ISOLATION_ENABLED) {
        const sessionTokens = context.totalTokens + tokens;
        const sessionMessages = context.messages.length + 1;

        if (sessionTokens > this.MAX_TOKENS_PER_SESSION) {
          // Compress this session's context before adding new message
          await this.compressContext(context);
          log.info(
            '🔧 Session context compressed due to token limit',
            LogContext.CONTEXT_INJECTION,
            {
              contextId,
              sessionTokens,
              maxTokens: this.MAX_TOKENS_PER_SESSION,
            }
          );
        }

        if (sessionMessages > this.MAX_MESSAGES_PER_SESSION) {
          // Remove oldest messages to stay under limit
          const messagesToRemove = sessionMessages - this.MAX_MESSAGES_PER_SESSION;
          context.messages = context.messages.slice(messagesToRemove);
          context.totalTokens = context.messages.reduce((sum, msg) => sum + msg.tokens, 0);
          log.info(
            '🔧 Session context trimmed due to message limit',
            LogContext.CONTEXT_INJECTION,
            {
              contextId,
              sessionMessages,
              maxMessages: this.MAX_MESSAGES_PER_SESSION,
              removedMessages: messagesToRemove,
            }
          );
        }
      }

      const fullMessage: ConversationMessage = {
        ...message,
        timestamp: new Date(),
        tokens,
        importance,
      };

      // Add message to context
      context.messages.push(fullMessage);
      context.totalTokens += tokens;
      context.lastAccessed = new Date();

      log.debug('📝 Message added to context', LogContext.CONTEXT_INJECTION, {
        contextId,
        role: message.role,
        tokens,
        importance: importance.toFixed(2),
        totalTokens: context.totalTokens,
      });

      // Check if we need to compress or persist
      const shouldCompress = context.totalTokens > this.COMPRESSION_TRIGGER;
      const shouldPersist = context.totalTokens > this.PERSISTENCE_TRIGGER;

      if (shouldPersist) {
        await this.persistContextToDatabase(context);
      }

      if (shouldCompress) {
        await this.compressContext(context);
      }

      // Update active context
      this.activeContexts.set(contextId, context);

      return {
        contextId,
        shouldCompress,
        tokenCount: context.totalTokens,
      };
    } catch (error) {
      log.error('❌ Failed to add message to context', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      throw error;
    }
  }

  /**
   * Retrieve relevant context for a conversation, automatically loading from DB if needed
   */
  async getRelevantContext(
    sessionId: string,
    userId: string,
    options: ContextRetrievalOptions = {}
  ): Promise<{
    messages: ConversationMessage[];
    summaries: ContextSummary[];
    totalTokens: number;
    source: 'memory' | 'database' | 'hybrid';
  }> {
    try {
      const {
        maxTokens = this.DEFAULT_TOKEN_LIMIT,
        relevanceThreshold = 0.3,
        includeRecentMessages = true,
        includeSummaries = true,
        timeWindow = 24,
      } = options;

      const contextId = this.getContextId(sessionId, userId);
      let context = this.activeContexts.get(contextId);
      let source: 'memory' | 'database' | 'hybrid' = 'memory';

      // If no active context, try to load from database
      if (!context) {
        context = (await this.loadContextFromDatabase(contextId, userId, timeWindow)) || undefined;
        source = context ? 'database' : 'memory';
      }

      let messages: ConversationMessage[] = [];
      let summaries: ContextSummary[] = [];
      let totalTokens = 0;

      if (context) {
        // Get recent high-importance messages
        if (includeRecentMessages) {
          messages = context.messages
            .filter((msg) => msg.importance >= relevanceThreshold)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 50); // Limit to last 50 relevant messages

          totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);
        }

        // If we exceed token limit, load summaries instead
        if (totalTokens > maxTokens && includeSummaries) {
          summaries = await this.getContextSummaries(userId, sessionId, timeWindow);
          const summaryTokens = summaries.reduce((sum, s) => sum + s.compressedTokens, 0);

          if (summaryTokens < totalTokens) {
            source = context ? 'hybrid' : 'database';
            // Keep only the most recent messages that fit
            const remainingTokens = maxTokens - summaryTokens;
            messages = this.selectMessagesByTokenBudget(messages, remainingTokens);
            totalTokens = summaryTokens + messages.reduce((sum, msg) => sum + msg.tokens, 0);
          }
        }
      }

      // If still no context, try broader database search
      if (messages.length === 0 && summaries.length === 0) {
        const dbContext = await this.searchDatabaseContext(userId, sessionId, options);
        messages = dbContext.messages;
        summaries = dbContext.summaries;
        totalTokens = dbContext.totalTokens;
        source = 'database';
      }

      log.info('🔍 Context retrieved successfully', LogContext.CONTEXT_INJECTION, {
        contextId,
        messagesCount: messages.length,
        summariesCount: summaries.length,
        totalTokens,
        source,
        userId,
      });

      return { messages, summaries, totalTokens, source };
    } catch (error) {
      log.error('❌ Failed to retrieve context', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
        userId,
      });
      return { messages: [], summaries: [], totalTokens: 0, source: 'memory' };
    }
  }

  /**
   * Compress context by summarizing older messages and keeping only important ones
   */
  private async compressContext(context: ConversationContext): Promise<void> {
    try {
      log.info('🗜️ Compressing context', LogContext.CONTEXT_INJECTION, {
        contextId: context.id,
        beforeTokens: context.totalTokens,
        beforeMessages: context.messages.length,
      });

      // Sort messages by timestamp (oldest first)
      const sortedMessages = [...context.messages].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );

      // Separate messages into groups: keep recent high-importance, compress old low-importance
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const recentMessages = sortedMessages.filter(
        (msg) => msg.timestamp.getTime() > oneHourAgo || msg.importance > 0.7
      );

      const compressibleMessages = sortedMessages.filter(
        (msg) => msg.timestamp.getTime() <= oneHourAgo && msg.importance <= 0.7
      );

      if (compressibleMessages.length > 5) {
        // Create summary of compressible messages
        const summary = await this.createMessageSummary(compressibleMessages, context.metadata);

        // Store the summary
        await this.storeContextSummary(summary, context.metadata);

        // Keep only recent and important messages
        context.messages = recentMessages;
        context.totalTokens = recentMessages.reduce((sum, msg) => sum + msg.tokens, 0);
        context.compressionLevel = Math.min(context.compressionLevel + 0.1, 1.0);

        log.info('✅ Context compressed successfully', LogContext.CONTEXT_INJECTION, {
          contextId: context.id,
          afterTokens: context.totalTokens,
          afterMessages: context.messages.length,
          compressedMessages: compressibleMessages.length,
          compressionLevel: context.compressionLevel.toFixed(2),
        });
      }
    } catch (error) {
      log.error('❌ Context compression failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        contextId: context.id,
      });
    }
  }

  /**
   * Create a summary of multiple messages
   */
  private async createMessageSummary(
    messages: ConversationMessage[],
    metadata: ContextMetadata
  ): Promise<ContextSummary> {
    try {
      // Extract key information from messages
      const combinedContent = messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
      const originalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);

      // Simple extractive summarization - identify key points
      const keyPoints = this.extractKeyPoints(messages);

      // Create compressed summary
      const summaryContent = `Summary of ${messages.length} messages (${new Date(messages[0]?.timestamp || Date.now()).toLocaleString()} - ${new Date(messages[messages.length - 1]?.timestamp || Date.now()).toLocaleString()}):
Key Points: ${keyPoints.join(', ')}
Discussion Topics: ${this.extractTopics(messages).join(', ')}`;

      const compressedTokens = this.estimateTokens(summaryContent);

      return {
        content: summaryContent,
        originalTokens,
        compressedTokens,
        compressionRatio: compressedTokens / originalTokens,
        keyPoints,
        preservedMessages: messages.filter((msg) => msg.importance > 0.8).length,
        timestamp: new Date(),
      };
    } catch (error) {
      log.error('❌ Summary creation failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback summary
      return {
        content: `Summary of ${messages.length} messages from conversation`,
        originalTokens: messages.reduce((sum, msg) => sum + msg.tokens, 0),
        compressedTokens: 20,
        compressionRatio: 0.1,
        keyPoints: ['conversation occurred'],
        preservedMessages: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Extract key points from messages using simple heuristics
   */
  private extractKeyPoints(messages: ConversationMessage[]): string[] {
    const keyPoints: string[] = [];
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'which'];
    const actionWords = ['create', 'build', 'implement', 'fix', 'update', 'add', 'remove'];

    messages.forEach((msg) => {
      if (msg.role === 'user') {
        // Extract questions and requests
        const sentences = msg.content.split(/[.!?]+/);
        sentences.forEach((sentence) => {
          const lowerSentence = sentence.toLowerCase();
          if (
            questionWords.some((word) => lowerSentence.includes(word)) ||
            actionWords.some((word) => lowerSentence.includes(word))
          ) {
            const cleaned = sentence.trim();
            if (cleaned.length > 10 && cleaned.length < 100) {
              keyPoints.push(cleaned);
            }
          }
        });
      }
    });

    return keyPoints.slice(0, 5); // Limit to top 5 key points
  }

  /**
   * Extract topics from messages
   */
  private extractTopics(messages: ConversationMessage[]): string[] {
    const topics = new Set<string>();
    const techKeywords = [
      'api',
      'database',
      'server',
      'client',
      'frontend',
      'backend',
      'typescript',
      'javascript',
      'python',
      'react',
      'node',
      'supabase',
      'redis',
      'authentication',
      'authorization',
      'error',
      'bug',
      'feature',
      'implementation',
      'testing',
    ];

    messages.forEach((msg) => {
      const content = msg.content.toLowerCase();
      techKeywords.forEach((keyword) => {
        if (content.includes(keyword)) {
          topics.add(keyword);
        }
      });
    });

    return Array.from(topics).slice(0, 8);
  }

  /**
   * Persist context to database
   */
  private async persistContextToDatabase(context: ConversationContext): Promise<void> {
    try {
      // Store conversation messages
      await contextStorageService.storeConversation(
        context.metadata.userId,
        JSON.stringify(context.messages, null, 2),
        `session_${context.metadata.sessionId}`,
        context.metadata.projectPath
      );

      log.info('💾 Context persisted to database', LogContext.CONTEXT_INJECTION, {
        contextId: context.id,
        messagesCount: context.messages.length,
        totalTokens: context.totalTokens,
      });
    } catch (error) {
      log.error('❌ Context persistence failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        contextId: context.id,
      });
    }
  }

  /**
   * Store context summary
   */
  private async storeContextSummary(
    summary: ContextSummary,
    metadata: ContextMetadata
  ): Promise<void> {
    try {
      await contextStorageService.storeContext({
        content: summary.content,
        category: 'conversation',
        source: `summary_${metadata.sessionId}`,
        userId: metadata.userId,
        projectPath: metadata.projectPath,
        metadata: {
          summaryType: 'compressed_conversation',
          originalTokens: summary.originalTokens,
          compressedTokens: summary.compressedTokens,
          compressionRatio: summary.compressionRatio,
          keyPoints: summary.keyPoints,
          preservedMessages: summary.preservedMessages,
          timestamp: summary.timestamp.toISOString(),
        },
      });

      log.info('📋 Context summary stored', LogContext.CONTEXT_INJECTION, {
        originalTokens: summary.originalTokens,
        compressedTokens: summary.compressedTokens,
        compressionRatio: summary.compressionRatio.toFixed(2),
      });
    } catch (error) {
      log.error('❌ Summary storage failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load context from database
   */
  private async loadContextFromDatabase(
    contextId: string,
    userId: string,
    timeWindowHours = 24
  ): Promise<ConversationContext | null> {
    try {
      // Get recent conversations from database
      const recentContext = await contextStorageService.getContext(
        userId,
        'conversation',
        undefined,
        20
      );

      if (recentContext.length === 0) return null;

      // Parse stored conversations
      const messages: ConversationMessage[] = [];
      const cutoffTime = Date.now() - timeWindowHours * 60 * 60 * 1000;

      for (const context of recentContext) {
        try {
          const storedMessages = JSON.parse(context.content) as ConversationMessage[];
          const recentMessages = storedMessages.filter(
            (msg) => new Date(msg.timestamp).getTime() > cutoffTime
          );
          messages.push(...recentMessages);
        } catch (parseError) {
          log.warn('⚠️ Failed to parse stored messages', LogContext.CONTEXT_INJECTION, {
            contextId: context.id,
          });
        }
      }

      if (messages.length === 0) return null;

      // Create context from loaded messages
      const totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);
      const sessionId = contextId.split('_')[1] || 'unknown';

      const loadedContext: ConversationContext = {
        id: contextId,
        messages: messages.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
        metadata: {
          userId,
          sessionId,
          contextType: 'conversation',
          tags: [],
          keyTopics: [],
        },
        totalTokens,
        lastAccessed: new Date(),
        compressionLevel: 0,
      };

      log.info('📖 Context loaded from database', LogContext.CONTEXT_INJECTION, {
        contextId,
        messagesLoaded: messages.length,
        totalTokens,
        timeWindowHours,
      });

      return loadedContext;
    } catch (error) {
      log.error('❌ Failed to load context from database', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        contextId,
        userId,
      });
      return null;
    }
  }

  /**
   * Search database for relevant context
   */
  private async searchDatabaseContext(
    userId: string,
    sessionId: string,
    options: ContextRetrievalOptions
  ): Promise<{
    messages: ConversationMessage[];
    summaries: ContextSummary[];
    totalTokens: number;
  }> {
    try {
      const summaries = await this.getContextSummaries(userId, sessionId, options.timeWindow || 24);

      // Get some recent messages too
      const recentContext = await contextStorageService.getContext(
        userId,
        'conversation',
        undefined,
        5
      );
      const messages: ConversationMessage[] = [];

      for (const context of recentContext) {
        try {
          const storedMessages = JSON.parse(context.content) as ConversationMessage[];
          messages.push(...storedMessages.slice(-10)); // Last 10 messages from each context
        } catch (parseError) {
          // Skip invalid JSON
        }
      }

      const totalTokens =
        messages.reduce((sum, msg) => sum + msg.tokens, 0) +
        summaries.reduce((sum, s) => sum + s.compressedTokens, 0);

      return { messages: messages.slice(-20), summaries, totalTokens };
    } catch (error) {
      log.error('❌ Database context search failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId,
        sessionId,
      });
      return { messages: [], summaries: [], totalTokens: 0 };
    }
  }

  /**
   * Get context summaries from database
   */
  private async getContextSummaries(
    userId: string,
    sessionId: string,
    timeWindowHours: number
  ): Promise<ContextSummary[]> {
    try {
      const summaries = await contextStorageService.searchContext(
        userId,
        `summary session_${sessionId}`,
        'conversation',
        10
      );

      return summaries
        .filter((s) => s.metadata?.summaryType === 'compressed_conversation')
        .map((s) => ({
          content: s.content,
          originalTokens: s.metadata?.originalTokens || 0,
          compressedTokens: s.metadata?.compressedTokens || this.estimateTokens(s.content),
          compressionRatio: s.metadata?.compressionRatio || 0.5,
          keyPoints: s.metadata?.keyPoints || [],
          preservedMessages: s.metadata?.preservedMessages || 0,
          timestamp: new Date(s.metadata?.timestamp || s.created_at),
        }))
        .filter((s) => {
          const cutoffTime = Date.now() - timeWindowHours * 60 * 60 * 1000;
          return s.timestamp.getTime() > cutoffTime;
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5);
    } catch (error) {
      log.error('❌ Failed to get context summaries', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        userId,
        sessionId,
      });
      return [];
    }
  }

  /**
   * Select messages that fit within a token budget
   */
  private selectMessagesByTokenBudget(
    messages: ConversationMessage[],
    tokenBudget: number
  ): ConversationMessage[] {
    const selected: ConversationMessage[] = [];
    let usedTokens = 0;

    // Sort by importance and recency
    const sorted = messages.sort((a, b) => {
      const importanceWeight = 0.7;
      const recencyWeight = 0.3;

      const aScore =
        a.importance * importanceWeight + (a.timestamp.getTime() / Date.now()) * recencyWeight;
      const bScore =
        b.importance * importanceWeight + (b.timestamp.getTime() / Date.now()) * recencyWeight;

      return bScore - aScore;
    });

    for (const message of sorted) {
      if (usedTokens + message.tokens <= tokenBudget) {
        selected.push(message);
        usedTokens += message.tokens;
      }
    }

    // Sort selected messages by timestamp for proper conversation flow
    return selected.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Initialize a new conversation context
   */
  private async initializeContext(
    contextId: string,
    sessionId: string,
    userId?: string
  ): Promise<ConversationContext> {
    const context: ConversationContext = {
      id: contextId,
      messages: [],
      metadata: {
        userId: userId || 'anonymous',
        sessionId,
        contextType: 'conversation',
        tags: [],
        keyTopics: [],
      },
      totalTokens: 0,
      lastAccessed: new Date(),
      compressionLevel: 0,
    };

    log.info('🆕 New conversation context initialized', LogContext.CONTEXT_INJECTION, {
      contextId,
      sessionId,
      userId,
    });

    return context;
  }

  /**
   * Calculate message importance based on content and role
   */
  private calculateMessageImportance(
    message: Omit<ConversationMessage, 'timestamp' | 'tokens' | 'importance'>
  ): number {
    let importance = 0.5; // Base importance

    // Role-based importance
    const roleWeight =
      this.IMPORTANCE_WEIGHTS[message.role as keyof typeof this.IMPORTANCE_WEIGHTS] || 0.5;
    importance = roleWeight;

    // Content-based importance adjustments
    const content = message.content.toLowerCase();

    // Questions are important
    if (content.includes('?') || content.match(/^(what|how|why|when|where|which)/)) {
      importance += 0.2;
    }

    // Error messages are important
    if (content.includes('error') || content.includes('failed') || content.includes('exception')) {
      importance += 0.3;
    }

    // Code blocks are moderately important
    if (content.includes('```') || content.includes('function') || content.includes('class')) {
      importance += 0.1;
    }

    // Short messages are less important
    if (message.content.length < 20) {
      importance -= 0.2;
    }

    // Very long messages might be important
    if (message.content.length > 500) {
      importance += 0.1;
    }

    return Math.max(0, Math.min(1, importance));
  }

  /**
   * Generate context ID from session and user
   */
  private getContextId(sessionId: string, userId: string): string {
    return `ctx_${sessionId}_${userId}`;
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Start background cleanup process
   */
  private startBackgroundCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.performBackgroundCleanup();
    }, this.CLEANUP_INTERVAL);

    log.info('🧹 Background cleanup started', LogContext.CONTEXT_INJECTION, {
      intervalMs: this.CLEANUP_INTERVAL,
    });
  }

  /**
   * Perform background cleanup of old contexts
   */
  private async performBackgroundCleanup(): Promise<void> {
    try {
      const now = Date.now();
      const staleThreshold = 2 * 60 * 60 * 1000; // 2 hours (increased from 1 hour)
      const contextsToCleanup: string[] = [];

      // Find stale contexts - only clean up truly inactive ones
      this.activeContexts.forEach((context, contextId) => {
        const timeSinceLastAccess = now - context.lastAccessed.getTime();
        const isStale = timeSinceLastAccess > staleThreshold;
        const isLowActivity = context.messages.length < 5 && context.totalTokens < 500; // More lenient

        // Only cleanup if both stale AND low activity to avoid affecting active sessions
        if (isStale && isLowActivity) {
          contextsToCleanup.push(contextId);
          log.debug('🧹 Marking context for cleanup', LogContext.CONTEXT_INJECTION, {
            contextId,
            timeSinceLastAccess: `${Math.round(timeSinceLastAccess / 1000 / 60)  } minutes`,
            messageCount: context.messages.length,
            totalTokens: context.totalTokens,
          });
        }
      });

      // Persist and remove stale contexts
      for (const contextId of contextsToCleanup) {
        const context = this.activeContexts.get(contextId);
        if (context) {
          await this.persistContextToDatabase(context);
          this.activeContexts.delete(contextId);
        }
      }

      // Ensure we don't exceed max active contexts - much more lenient now
      if (this.activeContexts.size > this.MAX_ACTIVE_CONTEXTS * 3) {
        // Allow 300% more contexts
        const sortedByAccess = Array.from(this.activeContexts.entries()).sort(
          ([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
        );

        // Only remove the oldest 10% of contexts to be much less aggressive
        const toRemove = sortedByAccess.slice(0, Math.floor(this.activeContexts.size * 0.1));
        for (const [contextId, context] of toRemove) {
          await this.persistContextToDatabase(context);
          this.activeContexts.delete(contextId);
        }

        log.info('🧹 Removed oldest contexts due to limit', LogContext.CONTEXT_INJECTION, {
          removedCount: toRemove.length,
          activeContexts: this.activeContexts.size,
          maxAllowed: this.MAX_ACTIVE_CONTEXTS * 3,
        });
      }

      if (contextsToCleanup.length > 0) {
        log.info('🧹 Background cleanup completed', LogContext.CONTEXT_INJECTION, {
          cleanedContexts: contextsToCleanup.length,
          activeContexts: this.activeContexts.size,
        });
      }
    } catch (error) {
      log.error('❌ Background cleanup failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get context manager statistics
   */
  public getStats(): {
    activeContexts: number;
    totalMessages: number;
    totalTokens: number;
    averageCompression: number;
  } {
    let totalMessages = 0;
    let totalTokens = 0;
    let totalCompression = 0;

    this.activeContexts.forEach((context) => {
      totalMessages += context.messages.length;
      totalTokens += context.totalTokens;
      totalCompression += context.compressionLevel;
    });

    return {
      activeContexts: this.activeContexts.size,
      totalMessages,
      totalTokens,
      averageCompression:
        this.activeContexts.size > 0 ? totalCompression / this.activeContexts.size : 0,
    };
  }

  /**
   * Manually compress a specific context
   */
  public async compressContextById(contextId: string): Promise<boolean> {
    const context = this.activeContexts.get(contextId);
    if (!context) return false;

    await this.compressContext(context);
    return true;
  }

  /**
   * Manually persist a specific context
   */
  public async persistContextById(contextId: string): Promise<boolean> {
    const context = this.activeContexts.get(contextId);
    if (!context) return false;

    await this.persistContextToDatabase(context);
    return true;
  }

  /**
   * Clear all active contexts (useful for testing)
   */
  public clearActiveContexts(): void {
    this.activeContexts.clear();
    log.info('🧹 All active contexts cleared', LogContext.CONTEXT_INJECTION);
  }

  /**
   * Shutdown the context manager
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Persist all active contexts before shutdown
    Promise.all(
      Array.from(this.activeContexts.values()).map((context) =>
        this.persistContextToDatabase(context)
      )
    ).then(() => {
      log.info('🛑 Enhanced Context Manager shutdown complete', LogContext.CONTEXT_INJECTION);
    });
  }
}

// Export singleton instance
export const enhancedContextManager = new EnhancedContextManager();
export default enhancedContextManager;

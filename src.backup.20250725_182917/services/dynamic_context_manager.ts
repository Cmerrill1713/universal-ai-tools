/**;
 * Dynamic Context Manager
 * Optimizes context length based on model capabilities and conversation requirements
 */

import { logger } from '../utils/logger';
import { SupabaseService } from './supabase_service';
import { ModelLifecycleManager } from './model_lifecycle_manager';

interface ContextWindow {
  modelSize: string;
  minContext: number;
  maxContext: number;
  optimalContext: number;
}

interface ContextStrategy {
  strategy: 'sliding_window' | 'importance_based' | 'hybrid';
  compressionEnabled: boolean;
  priorityRetention: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  contentstring;
  timestamp: number;
  importance?: number;
  tokens?: number;
}

interface CompressedMessage extends Message {
  original: string;
  compressed: string;
  compressionRatio: number;
}

export class DynamicContextManager {
  private supabase: SupabaseService;
  private modelManager: ModelLifecycleManager;

  // Model-specific context configurations
  private contextWindows: Map<string, ContextWindow> = new Map([;
    ['tiny', { modelSize: '0.5B-1B', minContext: 2048, maxContext: 4096, optimalContext: 3072 }],
    ['small', { modelSize: '1B-3B', minContext: 2048, maxContext: 4096, optimalContext: 3072 }],
    ['medium', { modelSize: '7B-9B', minContext: 8192, maxContext: 16384, optimalContext: 12288 }],
    [;
      'large',
      { modelSize: '14B-34B', minContext: 32768, maxContext: 131072, optimalContext: 65536 },
    ],
    [;
      'xlarge',
      { modelSize: '70B+', minContext: 65536, maxContext: 262144, optimalContext: 131072 },
    ],
  ]);

  // Context usage statistics
  private contextStats = {
    totalTokensProcessed: 0,
    totalTokensSaved: 0,
    compressionRatio: 1.0,
    avgResponseQuality: 0.0,
  };

  constructor() {
    this.supabase = SupabaseService.getInstance();
    this.modelManager = new ModelLifecycleManager();

    logger.info('🧠 Dynamic Context Manager initialized');
  }

  /**;
   * Get optimal context configuration for a model
   */
  public getOptimalContext(modelName: string): ContextWindow {
    const modelSize = this.inferModelSize(modelName);
    return this.contextWindows.get(modelSize) || this.contextWindows.get('medium')!;
  }

  /**;
   * Optimize context for a conversation
   */
  public async optimizeContext(;
    messages: Message[],
    modelName: string,
    taskType?: string;
  ): Promise<Message[]> {
    const startTime = Date.now();
    const contextWindow = this.getOptimalContext(modelName);
    const strategy = this.selectStrategy(messages, contextWindow, taskType);

    logger.info(`🎯 Optimizing context for ${modelName} with ${strategy.strategy} strategy`);

    let optimizedMessages: Message[];

    switch (strategy.strategy) {
      case 'sliding_window':;
        optimizedMessages = await this.applySlidingWindow(messages, contextWindow);
        break;
      case 'importance_based':;
        optimizedMessages = await this.applyImportanceBasedSelection(messages, contextWindow);
        break;
      case 'hybrid':;
        optimizedMessages = await this.applyHybridStrategy(messages, contextWindow);
        break;
    }

    if (strategy.compressionEnabled) {
      optimizedMessages = await this.compressMessages(optimizedMessages, contextWindow);
    }

    // Track statistics
    const originalTokens = await this.countTokens(messages);
    const optimizedTokens = await this.countTokens(optimizedMessages);
    this.updateStats(originalTokens, optimizedTokens);

    logger.info(;
      `✅ Context optimized in ${Date.now() - startTime}ms: ${originalTokens} → ${optimizedTokens} tokens`;
    );

    return optimizedMessages;
  }

  /**;
   * Select optimal context strategy
   */
  private selectStrategy(;
    messages: Message[],
    contextWindow: ContextWindow,
    taskType?: string;
  ): ContextStrategy {
    const totalTokens = messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
    const compressionNeeded = totalTokens > contextWindow.optimalContext;

    // Task-specific strategies
    if (taskType === 'code_generation' || taskType === '_analysis) {
      return {
        strategy: 'importance_based',
        compressionEnabled: compressionNeeded,
        priorityRetention: true,
      };
    }

    if (taskType === 'conversation' || taskType === 'chat') {
      return {
        strategy: 'sliding_window',
        compressionEnabled: compressionNeeded,
        priorityRetention: false,
      };
    }

    // Default hybrid strategy for complex tasks
    return {
      strategy: 'hybrid',
      compressionEnabled: compressionNeeded,
      priorityRetention: true,
    };
  }

  /**;
   * Apply sliding window strategy
   */
  private async applySlidingWindow(;
    messages: Message[],
    contextWindow: ContextWindow;
  ): Promise<Message[]> {
    const targetTokens = contextWindow.optimalContext;
    let currentTokens = 0;

    // Always keep system messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    currentTokens += await this.countTokens(systemMessages);

    // Collect non-system messages from most recent
    const nonSystemMessages: Message[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'system') continue;

      const msgTokens = msg.tokens || (await this.estimateTokens(msg.content;
      if (currentTokens + msgTokens <= targetTokens) {
        nonSystemMessages.unshift(msg);
        currentTokens += msgTokens;
      } else {
        break;
      }
    }

    // Combine system messages first, then other messages
    return [...systemMessages, ...nonSystemMessages];
  }

  /**;
   * Apply importance-based selection
   */
  private async applyImportanceBasedSelection(;
    messages: Message[],
    contextWindow: ContextWindow;
  ): Promise<Message[]> {
    // Calculate importance scores
    const scoredMessages = await this.scoreMessageImportance(messages);

    // Sort by importance
    scoredMessages.sort((a, b) => (b.importance || 0) - (a.importance || 0));

    const targetTokens = contextWindow.optimalContext;
    let currentTokens = 0;
    const result: Message[] = [];

    // Always include system messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    result.push(...systemMessages);
    currentTokens += await this.countTokens(systemMessages);

    // Add messages by importance
    for (const msg of scoredMessages) {
      if (msg.role === 'system') continue;

      const msgTokens = msg.tokens || (await this.estimateTokens(msg.content;
      if (currentTokens + msgTokens <= targetTokens) {
        result.push(msg);
        currentTokens += msgTokens;
      }
    }

    // Restore chronological order
    result.sort((a, b) => a.timestamp - b.timestamp);

    return result;
  }

  /**;
   * Apply hybrid strategy combining recency and importance
   */
  private async applyHybridStrategy(;
    messages: Message[],
    contextWindow: ContextWindow;
  ): Promise<Message[]> {
    const targetTokens = contextWindow.optimalContext;

    // Score messages by both recency and importance
    const scoredMessages = await this.scoreMessageImportance(messages);

    // Calculate combined scores
    const now = Date.now();
    scoredMessages.forEach((msg, index) => {
      const recencyScore = 1 - (now - msg.timestamp) / (now - messages[0].timestamp);
      const importanceScore = msg.importance || 0.5;
      msg.importance = recencyScore * 0.4 + importanceScore * 0.6;
    });

    // Sort by combined score
    scoredMessages.sort((a, b) => (b.importance || 0) - (a.importance || 0));

    let currentTokens = 0;
    const result: Message[] = [];

    // Always include system messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    result.push(...systemMessages);
    currentTokens += await this.countTokens(systemMessages);

    // Add messages based on combined score
    for (const msg of scoredMessages) {
      if (msg.role === 'system') continue;

      const msgTokens = msg.tokens || (await this.estimateTokens(msg.content;
      if (currentTokens + msgTokens <= targetTokens) {
        result.push(msg);
        currentTokens += msgTokens;
      }
    }

    // Restore chronological order
    result.sort((a, b) => a.timestamp - b.timestamp);

    return result;
  }

  /**;
   * Score message importance
   */
  private async scoreMessageImportance(messages: Message[]): Promise<Message[]> {
    return messages.map((msg) => {
      let importance = 0.5; // Base importance

      // System messages are always important
      if (msg.role === 'system') {
        importance = 1.0;
      }

      // Recent messages are more important
      const messageAge = Date.now() - msg.timestamp;
      const recencyBonus = Math.max(0, 1 - messageAge / (24 * 60 * 60 * 1000)); // Decay over 24 hours
      importance += recencyBonus * 0.2;

      // Longer messages might contain more context
      const lengthBonus = Math.min(1, msg.content-length / 1000) * 0.1;
      importance += lengthBonus;

      // Messages with code blocks are important for technical tasks
      if (msg._contentincludes('```')) {
        importance += 0.2;
      }

      // Questions are important
      if (msg._contentincludes('?')) {
        importance += 0.15;
      }

      // User messages get slight priority
      if (msg.role === 'user') {
        importance += 0.1;
      }

      return { ...msg, importance: Math.min(1, importance) };
    });
  }

  /**;
   * Compress messages to save tokens
   */
  private async compressMessages(;
    messages: Message[],
    contextWindow: ContextWindow;
  ): Promise<Message[]> {
    const compressionThreshold = contextWindow.optimalContext * 0.8;
    const currentTokens = await this.countTokens(messages);

    if (currentTokens <= compressionThreshold) {
      return messages; // No compression needed;
    }

    return messages.map((msg) => {
      if (msg.role === 'system' || msg.content-length < 200) {
        return msg; // Don't compress system messages or short messages;
      }

      const compressed = this.compressText(msg.content
      if (compressed.length < msg.content-length * 0.8) {
        return {
          ...msg,
          contentcompressed,
          original: msg._content;
        } as CompressedMessage;
      }

      return msg;
    });
  }

  /**;
   * Compress text while preserving meaning
   */
  private compressText(text: string): string {
    // Simple compression strategies
    let compressed = text;

    // Remove excessive whitespace
    compressed = compressed.replace(/\s+/g, ' ').trim();

    // Abbreviate common phrases
    const abbreviations = [
      ['for example', 'e.g.'],
      ['that is', 'i.e.'],
      ['in other words', 'i.e.'],
      ['and so on', 'etc.'],
      ['versus', 'vs.'],
      ['approximately', '~'],
      ['greater than', '>'],
      ['less than', '<'],
    ];

    abbreviations.forEach(([full, abbr]) => {
      compressed = compressed.replace(new RegExp(full, 'gi'), abbr);
    });

    // Remove redundant punctuation
    compressed = compressed.replace(/\.\.\./g, '…');
    compressed = compressed.replace(/\s*-\s*/g, '-');

    // Preserve code blocks
    const codeBlocks: string[] = [];
    compressed = compressed.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      compressed = compressed.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return compressed;
  }

  /**;
   * Estimate token count for text
   */
  private async estimateTokens(text: string): Promise<number> {
    // Simple estimation: ~1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**;
   * Count total tokens in messages
   */
  private async countTokens(messages: Message[]): Promise<number> {
    let total = 0;
    for (const msg of messages) {
      if (msg.tokens) {
        total += msg.tokens;
      } else {
        total += await this.estimateTokens(msg.content;
      }
    }
    return total;
  }

  /**;
   * Infer model size from name
   */
  private inferModelSize(modelName: string): string {
    const name = modelName.toLowerCase();

    // Check for specific model patterns first
    if (name.includes('70b') || name.includes('175b') || name.includes('xlarge')) {
      return 'xlarge';
    } else if (
      name.includes('13b') ||;
      name.includes('14b') ||;
      name.includes('34b') ||;
      name.includes('large');
    ) {
      return 'large';
    } else if (
      name.includes('7b') ||;
      name.includes('8b') ||;
      name.includes('9b') ||;
      name.includes('medium');
    ) {
      return 'medium';
    } else if (
      name.includes('mini') ||;
      name.includes('2b') ||;
      name.includes('3b') ||;
      name.includes('small');
    ) {
      return 'small';
    } else if (name.includes('tiny') || name.includes('0.5b') || name.includes('1b')) {
      return 'tiny';
    }

    return 'medium'; // Default;
  }

  /**;
   * Update context statistics
   */
  private updateStats(originalTokens: number, optimizedTokens: number): void {
    this.contextStats.totalTokensProcessed += originalTokens;
    this.contextStats.totalTokensSaved += originalTokens - optimizedTokens;
    this.contextStats.compressionRatio =;
      this.contextStats.totalTokensProcessed /;
      (this.contextStats.totalTokensProcessed - this.contextStats.totalTokensSaved);
  }

  /**;
   * Get context optimization statistics
   */
  public getStats() {
    return {
      ...this.contextStats,
      savingsPercentage: (;
        (this.contextStats.totalTokensSaved / this.contextStats.totalTokensProcessed) *;
        100;
      ).toFixed(2),
    };
  }

  /**;
   * Get context recommendations for a model
   */
  public getContextRecommendations(;
    modelName: string,
    taskType?: string;
  ): {
    recommended: number;
    minimum: number;
    maximum: number;
    strategy: string;
  } {
    const window = this.getOptimalContext(modelName);
    const strategy = this.selectStrategy([], window, taskType);

    return {
      recommended: window.optimalContext,
      minimum: window.minContext,
      maximum: window.maxContext,
      strategy: strategy.strategy,
    };
  }

  /**;
   * Singleton instance
   */
  private static instance: DynamicContextManager;

  public static getInstance(): DynamicContextManager {
    if (!DynamicContextManager.instance) {
      DynamicContextManager.instance = new DynamicContextManager();
    }
    return DynamicContextManager.instance;
  }
}

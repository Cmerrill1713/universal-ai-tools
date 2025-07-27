/**
 * Enhanced Base Agent with Vector Memory Integration
 * Extends the base agent to use the enhanced memory system
 */

import type { AgentConfig, AgentContext, AgentResponse } from './base_agent';
import { BaseAgent } from './base_agent';
import type { Memory, MemorySearchOptions } from '../memory/enhanced_memory_system';
import { EnhancedMemorySystem } from '../memory/enhanced_memory_system';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';

export interface EnhancedAgentConfig extends AgentConfig {
  useVectorMemory?: boolean;
  memorySearchThreshold?: number;
  maxMemoryResults?: number;
  autoLearn?: boolean;
}

export abstract class EnhancedBaseAgent extends BaseAgent {
  protected memorySystem: EnhancedMemorySystem;
  protected enhancedConfig: EnhancedAgentConfig;
  protected supabase: SupabaseClient;

  constructor(config: EnhancedAgentConfig, supabase: SupabaseClient, logger: Logger) {
    super(config);
    this.enhancedConfig = config;
    this.supabase = supabase;
    this.logger = logger;
    this.memorySystem = new EnhancedMemorySystem(supabase, logger);
  }

  /**
   * Enhanced process method with vector memory search
   */
  protected async process(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Search for relevant memories using vector similarity
      const relevantMemories = await this.searchRelevantMemories(context.userRequest);

      // Enhance context with memories
      const enhancedContext = {
        ...context,
        relevantMemories,
        memoryInsights: this.extractMemoryInsights(relevantMemories),
      };

      // Call the agent-specific implementation
      const response = await this.processWithMemory(enhancedContext);

      // Store the interaction as a new memory if autoLearn is enabled
      if (this.enhancedConfig.autoLearn && response.success) {
        await this.storeInteractionMemory(context.userRequest, response);
      }

      // Update memory importance based on usage
      await this.updateUsedMemories(relevantMemories, response.success);

      return {
        ...response,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        metadata: {
          ...response.metadata,
          memoriesUsed: relevantMemories.length,
          memorySearchTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(Enhanced agent processing failed: ${(error as Error).message}`);
      return {
        success: false,
        data: null,
        reasoning: `Processing failed: ${(error as Error).message}`,
        confidence: 0.1,
        _error (error as Error).message,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
      };
    }
  }

  /**
   * Agent-specific processing with memory context
   */
  protected abstract processWithMemory(
    _context: AgentContext & {
      relevantMemories: Memory[];
      memoryInsights: any;
    }
  ): Promise<AgentResponse>;

  /**
   * Search for relevant memories using vector similarity
   */
  protected async searchRelevantMemories(query: string): Promise<Memory[]> {
    if (!this.enhancedConfig.useVectorMemory) {
      return [];
    }

    try {
      const searchOptions: MemorySearchOptions = {
        query,
        similarityThreshold: this.enhancedConfig.memorySearchThreshold || 0.7,
        maxResults: this.enhancedConfig.maxMemoryResults || 10,
        agentFilter: this.config.name,
      };

      const memories = await this.memorySystem.searchMemories(searchOptions);

      this.logger.info(`Found ${memories.length} relevant memories for query`);

      return memories;
    } catch (error) {
      this.logger.warn('Memory search failed, continuing without memories:', error);
      return [];
    }
  }

  /**
   * Extract insights from memories
   */
  protected extractMemoryInsights(memories: Memory[]): any {
    if (memories.length === 0) {
      return { hasRelevantHistory: false };
    }

    // Group memories by type and category
    const byType = memories.reduce(
      (acc, mem) => {
        acc[mem.memoryType] = (acc[mem.memoryType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Extract common keywords
    const allKeywords = memories.flatMap((m) => m.keywords || []);
    const keywordFreq = allKeywords.reduce(
      (acc, kw) => {
        acc[kw] = (acc[kw] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topKeywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([kw]) => kw);

    // Calculate average importance
    const avgImportance = memories.reduce((sum, m) => sum + m.importanceScore, 0) / memories.length;

    return {
      hasRelevantHistory: true,
      memoryTypes: byType,
      topKeywords,
      averageImportance: avgImportance,
      totalMemories: memories.length,
      mostRecentMemory: memories[0], // Assuming ordered by relevance
      timeSpan: this.calculateTimeSpan(memories),
    };
  }

  /**
   * Store the current interaction as a memory
   */
  protected async storeInteractionMemory(request string, response: AgentResponse): Promise<void> {
    try {
      const memoryContent = `Request: ${request\nResponse: ${JSON.stringify(response.data)}`;

      const metadata = {
        requestType: this.categorizeRequest(request,
        responseSuccess: response.success,
        confidence: response.confidence,
        timestamp: new Date().toISOString(),
      };

      await this.memorySystem.storeMemory(
        this.config.name,
        'interaction',
        memoryContent,
        metadata,
        this.extractKeywordsFromRequest(request
      );

      this.logger.debug('Stored interaction as memory');
    } catch (error) {
      this.logger.warn('Failed to store interaction memory:', error);
    }
  }

  /**
   * Update importance of memories that were used
   */
  protected async updateUsedMemories(memories: Memory[], wasSuccessful: boolean): Promise<void> {
    if (memories.length === 0) return;

    try {
      // Boost importance for memories that led to successful outcomes
      const boost = wasSuccessful ? 0.1 : 0.02;

      for (const memory of memories.slice(0, 3)) {
        // Update top 3 most relevant
        await this.memorySystem.updateMemoryImportance(memory.id, boost);
      }
    } catch (error) {
      this.logger.warn('Failed to update memory importance:', error);
    }
  }

  /**
   * Find memories from other agents that might be relevant
   */
  protected async findCrossAgentMemories(
    query: string,
    agentList: string[]
  ): Promise<Record<string, Memory[]>> {
    try {
      return await this.memorySystem.crossAgentSearch(query, agentList, {
        maxResults: 3,
        similarityThreshold: 0.75,
      });
    } catch (error) {
      this.logger.warn('Cross-agent memory search failed:', error);
      return {};
    }
  }

  /**
   * Get memory recommendations based on user patterns
   */
  protected async getMemoryRecommendations(
    userId: string,
    currentContext?: string
  ): Promise<Memory[]> {
    try {
      return await this.memorySystem.getMemoryRecommendations(
        userId,
        this.config.name,
        currentContext
      );
    } catch (error) {
      this.logger.warn('Failed to get memory recommendations:', error);
      return [];
    }
  }

  /**
   * Helper methods
   */
  private categorizeRequest(request string): string {
    const lower = request toLowerCase();
    if (lower.includes('create') || lower.includes('new')) return 'create';
    if (lower.includes('update') || lower.includes('modify')) return 'update';
    if (lower.includes('delete') || lower.includes('remove')) return 'delete';
    if (lower.includes('find') || lower.includes('search')) return 'search';
    if (lower.includes('analyze') || lower.includes('review')) return 'analyze';
    return 'general';
  }

  private extractKeywordsFromRequest(request string): string[] {
    return request
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4 && !this.isStopWord(word))
      .slice(0, 10);
  }

  private isStopWord(word: string): boolean {
    const stopWords = [
      'please',
      'could',
      'would',
      'should',
      'might',
      'there',
      'where',
      'which',
      'these',
      'those',
    ];
    return stopWords.includes(word);
  }

  private calculateTimeSpan(memories: Memory[]): string {
    if (memories.length < 2) return 'single memory';

    const dates = memories
      .map((m) => m.metadata?.timestamp || m.metadata?.created_at)
      .filter(Boolean)
      .map((d) => new Date(d));

    if (dates.length < 2) return 'unknown timespan';

    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));

    const days = Math.floor((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24));

    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  }
}

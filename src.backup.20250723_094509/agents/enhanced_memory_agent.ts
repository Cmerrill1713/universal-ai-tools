/**
 * Enhanced Memory-Enabled Agent Base
 * Adapted from the sophisticated trading system's memory integration patterns
 */

import { EventEmitter } from 'events';
import type { AgentConfig, AgentContext, AgentResponse, PartialAgentResponse } from './base_agent';
import { BaseAgent } from './base_agent';

interface MemoryConfig {
  workingMemorySize: number;
  episodicMemoryLimit: number;
  semanticSearchLimit: number;
  enableLearning: boolean;
  enableKnowledgeSharing: boolean;
  memoryDistillationInterval: number; // seconds
}

interface MemoryRequest {
  type: 'working' | 'episodic' | 'semantic' | 'procedural';
  operation: 'store' | 'retrieve' | 'search' | 'update';
  data?: any;
  query?: string;
  context?: any;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface MemoryResponse {
  success: boolean;
  data?: any;
  metadata?: {
    timestamp: Date;
    confidence: number;
    source: string;
    relevance?: number;
  };
}

interface LearningInsight {
  id: string;
  timestamp: Date;
  agentName: string;
  category:
    | 'performance'
    | '_pattern
    | '_error
    | 'optimization'
    | 'ethics_improvement'
    | 'reflection';
  insight: string;
  confidence: number;
  applicability: string[];
}

interface PerformanceMetrics {
  taskId: string;
  executionTime: number;
  successRate: number;
  confidenceLevel: number;
  userSatisfaction?: number;
  memoryUtilization: number;
  learningEffectiveness: number;
}

export abstract class EnhancedMemoryAgent extends BaseAgent {
  protected memoryConfig: MemoryConfig;
  protected performanceHistory: PerformanceMetrics[] = [];
  protected learningInsights: LearningInsight[] = [];
  protected knowledgeBase: Map<string, any> = new Map();

  // Memory system components (mocked for now, can be replaced with real implementations)
  protected workingMemory: Map<string, any> = new Map();
  protected episodicMemory: any[] = [];
  protected semanticMemory: Map<string, any> = new Map();
  protected proceduralMemory: Map<string, any> = new Map();

  private memoryDistillationTimer?: NodeJS.Timeout;

  constructor(config: AgentConfig & { memoryConfig?: Partial<MemoryConfig> }) {
    super(config);

    this.memoryConfig = {
      workingMemorySize: 100,
      episodicMemoryLimit: 1000,
      semanticSearchLimit: 50,
      enableLearning: true,
      enableKnowledgeSharing: true,
      memoryDistillationInterval: 3600, // 1 hour
      ...config.memoryConfig,
    };

    this.initializeMemorySystems();
    this.logger.info(`🧠 Enhanced memory-enabled agent '${this.config.name}' initialized`);
  }

  private initializeMemorySystems(): void {
    // Start memory distillation process
    if (this.memoryConfig.enableLearning) {
      this.memoryDistillationTimer = setInterval(
        () => this.performMemoryDistillation(),
        this.memoryConfig.memoryDistillationInterval * 1000
      );
    }

    // Load: any persisted memories
    this.loadPersistedMemories();
  }

  /**
   * Enhanced execute method with memory integration
   */
  async execute(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Store current context in working memory
      await this.storeWorkingMemory(context);

      // Retrieve relevant memories for context enhancement
      const relevantMemories = await this.retrieveRelevantMemories(context);
      const enhancedContext = this.enhanceContextWithMemories(context, relevantMemories);

      // Execute the agent's core logic
      const partialResponse = await this.executeWithMemory(enhancedContext);

      // Convert PartialAgentResponse to AgentResponse with latency and agent ID
      const latencyMs = Date.now() - startTime;
      const response: AgentResponse = {
        ...partialResponse,
        latencyMs,
        agentId: this.config.name,
      };

      // Store the experience for learning
      await this.storeEpisode({
        context: enhancedContext,
        response,
        timestamp: new Date(),
        outcome: 'success',
      });

      // Track performance metrics
      this.trackPerformance(context, response, latencyMs);

      // Extract and store learning insights
      await this.extractLearningInsights(enhancedContext, response);

      return response;
    } catch (error) {
      // Store failed episodes for learning
      await this.storeEpisode({
        context,
        _error error instanceof Error ? error.message : String(_error,
        timestamp: new Date(),
        outcome: 'failure',
      });

      this.logger.error(Memory agent ${this.config.name} execution failed:`, error);
      throw error;
    }
  }

  /**
   * Abstract method for agent-specific execution with memory enhancement
   */
  protected abstract executeWithMemory(context: AgentContext): Promise<PartialAgentResponse>;

  /**
   * Store information in working memory
   */
  protected async storeWorkingMemory(data: any, key?: string): Promise<MemoryResponse> {
    const memoryKey = key || `working_${Date.now()}`;

    // Implement LRU eviction if memory is full
    if (this.workingMemory.size >= this.memoryConfig.workingMemorySize) {
      const oldestKey = this.workingMemory.keys().next().value;
      if (oldestKey) {
        this.workingMemory.delete(oldestKey);
      }
    }

    this.workingMemory.set(memoryKey, {
      data,
      timestamp: new Date(),
      accessCount: 0,
    });

    return {
      success: true,
      metadata: {
        timestamp: new Date(),
        confidence: 1.0,
        source: 'working_memory',
      },
    };
  }

  /**
   * Store episodic memory (experiences)
   */
  protected async storeEpisode(episode: any): Promise<MemoryResponse> {
    // Add unique ID and metadata
    const enrichedEpisode = {
      id: `episode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...episode,
      agentName: this.config.name,
      memoryType: 'episodic',
    };

    this.episodicMemory.push(enrichedEpisode);

    // Implement memory limit
    if (this.episodicMemory.length > this.memoryConfig.episodicMemoryLimit) {
      this.episodicMemory.shift(); // Remove oldest
    }

    return {
      success: true,
      metadata: {
        timestamp: new Date(),
        confidence: 0.9,
        source: 'episodic_memory',
      },
    };
  }

  /**
   * Store semantic knowledge
   */
  protected async storeSemanticMemory(concept: string, knowledge: any): Promise<MemoryResponse> {
    this.semanticMemory.set(concept, {
      knowledge,
      timestamp: new Date(),
      confidence: knowledge.confidence || 0.8,
      source: this.config.name,
      accessCount: 0,
    });

    return {
      success: true,
      metadata: {
        timestamp: new Date(),
        confidence: 0.8,
        source: 'semantic_memory',
      },
    };
  }

  /**
   * Store procedural knowledge (how-to patterns)
   */
  protected async storeProceduralMemory(procedure: string, steps: any[]): Promise<MemoryResponse> {
    this.proceduralMemory.set(procedure, {
      steps,
      timestamp: new Date(),
      successRate: 1.0,
      usage: 0,
      source: this.config.name,
    });

    return {
      success: true,
      metadata: {
        timestamp: new Date(),
        confidence: 0.8,
        source: 'procedural_memory',
      },
    };
  }

  /**
   * Search working memory for relevant information
   */
  protected async searchWorkingMemory(query: string): Promise<any[]> {
    const relevantMemories = [];

    for (const [key, memory] of Array.from(this.workingMemory.entries())) {
      if (memory.data && JSON.stringify(memory.data).toLowerCase().includes(query.toLowerCase())) {
        relevantMemories.push(memory);
      }
    }

    return relevantMemories;
  }

  /**
   * Retrieve relevant memories for context enhancement
   */
  protected async retrieveRelevantMemories(context: AgentContext): Promise<any[]> {
    const relevantMemories = [];

    // Search working memory
    for (const [key, memory] of Array.from(this.workingMemory.entries())) {
      if (this.isMemoryRelevant(memory.data, context)) {
        memory.accessCount++;
        relevantMemories.push({ type: 'working', key, ...memory });
      }
    }

    // Search episodic memory
    const relevantEpisodes = this.episodicMemory
      .filter((episode) => this.isMemoryRelevant(episode, context))
      .slice(0, 10) // Limit results
      .map((episode) => ({ type: 'episodic', ...episode }));

    relevantMemories.push(...relevantEpisodes);

    // Search semantic memory
    for (const [concept, knowledge] of Array.from(this.semanticMemory.entries())) {
      if (this.isMemoryRelevant(knowledge, context)) {
        knowledge.accessCount++;
        relevantMemories.push({ type: 'semantic', concept, ...knowledge });
      }
    }

    return relevantMemories.slice(0, this.memoryConfig.semanticSearchLimit);
  }

  /**
   * Determine if a memory is relevant to the current context
   */
  private isMemoryRelevant(memory: any, _context: AgentContext): boolean {
    const contextText = context.userRequest.toLowerCase();
    const memoryText = JSON.stringify(memory).toLowerCase();

    // Simple keyword matching (can be enhanced with semantic similarity)
    const commonWords = ['setup', 'configure', 'implement', 'create', 'fix', 'optimize'];
    const contextWords = contextText.split(' ');
    const memoryWords = memoryText.split(' ');

    const overlap = contextWords.filter(
      (word) => memoryWords.includes(word) && word.length > 3
    ).length;

    return overlap > 0;
  }

  /**
   * Enhance context with relevant memories
   */
  private enhanceContextWithMemories(_context: AgentContext, memories: any[]): AgentContext {
    return {
      ...context,
      memoryContext: {
        relevantMemories: memories,
        workingMemorySize: this.workingMemory.size,
        episodicMemorySize: this.episodicMemory.length,
        semanticMemorySize: this.semanticMemory.size,
        proceduralMemorySize: this.proceduralMemory.size,
      },
    };
  }

  /**
   * Track performance metrics for learning
   */
  private trackPerformance(
    _context: AgentContext,
    response: AgentResponse,
    executionTime: number
  ): void {
    const metrics: PerformanceMetrics = {
      taskId: context.requestId,
      executionTime,
      successRate: response.success ? 1.0 : 0.0,
      confidenceLevel: response.confidence || 0.5,
      memoryUtilization: this.calculateMemoryUtilization(),
      learningEffectiveness: this.calculateLearningEffectiveness(),
    };

    this.performanceHistory.push(metrics);

    // Keep only recent metrics
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Add a learning insight to the agent's knowledge base
   */
  protected async addLearningInsight(insight: {
    category:
      | 'performance'
      | '_pattern
      | '_error
      | 'optimization'
      | 'ethics_improvement'
      | 'reflection';
    insight: string;
    confidence: number;
    applicability: string[];
  }): Promise<void> {
    const learningInsight: LearningInsight = {
      id: `insight_${Date.now()}`,
      timestamp: new Date(),
      agentName: this.config.name,
      category: insight.category,
      insight: insight.insight,
      confidence: insight.confidence,
      applicability: insight.applicability,
    };

    this.learningInsights.push(learningInsight);
  }

  /**
   * Extract learning insights from experiences
   */
  private async extractLearningInsights(
    _context: AgentContext,
    response: AgentResponse
  ): Promise<void> {
    if (!this.memoryConfig.enableLearning) return;

    // Analyze patterns in successful executions
    if (response.success && response.confidence > 0.8) {
      await this.addLearningInsight({
        category: 'performance',
        insight: `Successful execution _pattern ${context.userRequest.substring(0, 100)}`,
        confidence: response.confidence,
        applicability: [context.userRequest.split(' ')[0]], // First word as domain
      });
    }
  }

  /**
   * Perform memory distillation to extract important patterns
   */
  private async performMemoryDistillation(): Promise<void> {
    this.logger.debug(`🧠 Performing memory distillation for agent ${this.config.name}`);

    // Analyze episodic memories for patterns
    const patterns = this.extractPatternsFromEpisodes();

    // Convert patterns to semantic knowledge
    for (const _patternof patterns) {
      await this.storeSemanticMemory(_patternconcept, _patternknowledge);
    }

    // Clean up old working memory
    this.cleanupWorkingMemory();

    this.logger.debug(`🧠 Memory distillation complete. Found ${patterns.length} patterns`);
  }

  /**
   * Extract patterns from episodic memories
   */
  private extractPatternsFromEpisodes(): any[] {
    const patterns = [];
    const successfulEpisodes = this.episodicMemory.filter((ep) => ep.outcome === 'success');

    // Group by requesttype
    const requestTypes = new Map<string, any[]>();
    for (const episode of successfulEpisodes) {
      const requestType = episode.context?.userRequest?.split(' ')[0] || 'unknown';
      if (!requestTypes.has(requestType)) {
        requestTypes.set(requestType, []);
      }
      requestTypes.get(requestType)!.push(episode);
    }

    // Extract patterns for each requesttype
    for (const [type, episodes] of Array.from(requestTypes.entries())) {
      if (episodes.length >= 3) {
        // Need multiple examples
        patterns.push({
          concept: `successful_${type}_pattern,
          knowledge: {
            requestType: type,
            commonElements: this.findCommonElements(episodes),
            successRate: 1.0,
            confidence: Math.min(0.9, episodes.length / 10),
          },
        });
      }
    }

    return patterns;
  }

  /**
   * Find common elements across episodes
   */
  private findCommonElements(episodes: any[]): any {
    // Simple implementation - can be enhanced
    return {
      averageExecutionTime:
        episodes.reduce((sum, ep) => sum + (ep.executionTime || 0), 0) / episodes.length,
      commonKeywords: this.extractCommonKeywords(episodes),
      successFactors: episodes.map((ep) => ep.response?.data).filter(Boolean),
    };
  }

  /**
   * Extract common keywords from episodes
   */
  private extractCommonKeywords(episodes: any[]): string[] {
    const allWords = episodes
      .map((ep) => ep.context?.userRequest || '')
      .join(' ')
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 3);

    const wordCounts = new Map<string, number>();
    for (const word of allWords) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }

    return Array.from(wordCounts.entries())
      .filter(([word, count]) => count >= episodes.length / 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Clean up old working memory entries
   */
  private cleanupWorkingMemory(): void {
    const now = Date.now();
    const maxAge = 1000 * 60 * 60; // 1 hour

    for (const [key, memory] of Array.from(this.workingMemory.entries())) {
      if (now - memory.timestamp.getTime() > maxAge && memory.accessCount === 0) {
        this.workingMemory.delete(key);
      }
    }
  }

  /**
   * Calculate memory utilization percentage
   */
  private calculateMemoryUtilization(): number {
    const totalCapacity =
      this.memoryConfig.workingMemorySize + this.memoryConfig.episodicMemoryLimit + 1000; // Semantic + procedural estimate

    const totalUsed =
      this.workingMemory.size +
      this.episodicMemory.length +
      this.semanticMemory.size +
      this.proceduralMemory.size;

    return totalUsed / totalCapacity;
  }

  /**
   * Calculate learning effectiveness score
   */
  private calculateLearningEffectiveness(): number {
    if (this.performanceHistory.length < 5) return 0.5;

    const recent = this.performanceHistory.slice(-10);
    const older = this.performanceHistory.slice(-20, -10);

    if (older.length === 0) return 0.5;

    const recentAvg = recent.reduce((sum, m) => sum + m.confidenceLevel, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.confidenceLevel, 0) / older.length;

    return Math.max(0, Math.min(1, recentAvg - olderAvg + 0.5));
  }

  /**
   * Load persisted memories (can be enhanced with actual persistence)
   */
  private async loadPersistedMemories(): Promise<void> {
    // Implementation for loading from persistent storage
    // For now, we'll use a simple in-memory approach
    this.logger.debug(`Loading persisted memories for agent ${this.config.name}`);
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): any {
    return {
      workingMemory: {
        size: this.workingMemory.size,
        capacity: this.memoryConfig.workingMemorySize,
        utilization: this.workingMemory.size / this.memoryConfig.workingMemorySize,
      },
      episodicMemory: {
        size: this.episodicMemory.length,
        capacity: this.memoryConfig.episodicMemoryLimit,
        utilization: this.episodicMemory.length / this.memoryConfig.episodicMemoryLimit,
      },
      semanticMemory: {
        size: this.semanticMemory.size,
        concepts: Array.from(this.semanticMemory.keys()),
      },
      proceduralMemory: {
        size: this.proceduralMemory.size,
        procedures: Array.from(this.proceduralMemory.keys()),
      },
      performance: {
        totalExecutions: this.performanceHistory.length,
        averageConfidence:
          this.performanceHistory.length > 0
            ? this.performanceHistory.reduce((sum, m) => sum + m.confidenceLevel, 0) /
              this.performanceHistory.length
            : 0,
        learningEffectiveness: this.calculateLearningEffectiveness(),
      },
      insights: {
        total: this.learningInsights.length,
        categories: Array.from(new Set(this.learningInsights.map((i) => i.category))),
      },
    };
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.memoryDistillationTimer) {
      clearInterval(this.memoryDistillationTimer);
    }

    // Perform final memory distillation
    await this.performMemoryDistillation();

    this.logger.info(`🧠 Enhanced memory agent ${this.config.name} shut down`);
  }
}

export default EnhancedMemoryAgent;

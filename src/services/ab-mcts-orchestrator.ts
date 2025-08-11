/**
 * AB-MCTS Orchestrator Service
 * Revolutionary orchestration system using Adaptive Bandit Monte Carlo Tree Search
 * Replaces traditional orchestrators with probabilistic, learning-based approach
 */

import { v4 as uuidv4 } from 'uuid';

import AgentRegistry from '@/agents/agent-registry';
import { EnhancedBaseAgent } from '@/agents/enhanced-base-agent';
import type {
  ABMCTSConfig,
  ABMCTSExecutionOptions,
  ABMCTSFeedback,
  ABMCTSSearchResult,
  ABMCTSVisualization,
  AgentContext,
  AgentResponse,
} from '@/types/ab-mcts';
import type { CircuitBreaker } from '@/utils/circuit-breaker';
import { createCircuitBreaker } from '@/utils/circuit-breaker';
import { TWO } from '@/utils/constants';
import { log, LogContext } from '@/utils/logger';

import { abMCTSService } from './ab-mcts-service';
import { multiTierLLM } from './multi-tier-llm-service';

export interface OrchestratorConfig extends Partial<ABMCTSConfig> {
  enableLearning: boolean;
  enableVisualization: boolean;
  fallbackToTraditional: boolean;
  parallelExecutions: number;
  budgetAllocation: {
    exploration: number; // Percentage for exploration
    exploitation: number; // Percentage for exploitation
  };
}

export interface OrchestratorResult {
  response: AgentResponse;
  searchResult: ABMCTSSearchResult;
  executionPath: string[];
  totalTime: number;
  resourcesUsed: {
    agents: number;
    llmCalls: number;
    tokensUsed: number;
  };
  feedback?: ABMCTSFeedback;
}

/**
 * AB-MCTS based orchestrator for agent coordination
 */
export class ABMCTSOrchestrator {
  private config: OrchestratorConfig;
  private circuitBreaker: CircuitBreaker;
  private activeSearches: Map<string, ABMCTSSearchResult> = new Map();
  private executionCache: Map<string, OrchestratorResult> = new Map();
  private agentRegistry: AgentRegistry;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      enableLearning: true,
      enableVisualization: true,
      fallbackToTraditional: true,
      parallelExecutions: 4,
      budgetAllocation: {
        exploration: 30,
        exploitation: 70,
      },
      // AB-MCTS specific config
      maxIterations: 500,
      maxDepth: 8,
      explorationConstant: 1.414,
      discountFactor: 0.95,
      maxBudget: 5000,
      timeLimit: 20000, // 20 seconds
      ...config,
    };

    this.circuitBreaker = createCircuitBreaker('ab-mcts-orchestrator', {
      failureThreshold: 3,
      timeout: this.config.timeLimit,
      successThreshold: 2,
    });

    this.agentRegistry = new AgentRegistry();
  }

  /**
   * Main orchestration method using AB-MCTS
   */
  async orchestrate(
    context: AgentContext,
    options: ABMCTSExecutionOptions = {
      useCache: true,
      enableParallelism: true,
      collectFeedback: true,
      saveCheckpoints: false,
      visualize: false,
      verboseLogging: false,
      fallbackStrategy: 'greedy',
    }
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const orchestrationId = uuidv4();

    log.info('🎯 Starting AB-MCTS orchestration', LogContext.AI, {
      orchestrationId,
      request: context.userRequest.substring(0, 100),
      enableLearning: this.config.enableLearning,
    });

    try {
      return await this.circuitBreaker.execute(
        async () => this.executeOrchestration(context, orchestrationId, options),
        async () => this.fallbackOrchestration(context)
      );
    } catch (error) {
      log.error('❌ AB-MCTS orchestration failed', LogContext.AI, {
        orchestrationId,
        error: error instanceof Error ? error.message : String(error),
        timeElapsed: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Execute orchestration using AB-MCTS
   */
  private async executeOrchestration(
    context: AgentContext,
    orchestrationId: string,
    options: ABMCTSExecutionOptions
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.getCacheKey(context);
    if (options.useCache && this.executionCache.has(cacheKey)) {
      log.info('💾 Using cached orchestration result', LogContext.AI);
      return this.executionCache.get(cacheKey)!;
    }

    // Get available agents
    const availableAgents = await this.getAvailableAgents(context);

    if (availableAgents.length === 0) {
      throw new Error('No available agents for orchestration');
    }

    // Perform AB-MCTS search
    const searchResult = await abMCTSService.search(
      {
        ...context,
        metadata: {
          ...context.metadata,
          orchestrationId,
          nodeId: 'root',
        },
      },
      availableAgents.map((a) => a.getName()),
      options
    );

    // Store active search for monitoring
    this.activeSearches.set(orchestrationId, searchResult);

    // Execute best path
    const executionResult = await this.executeBestPath(searchResult, context, availableAgents);

    // Calculate total resources used
    const totalTime = Date.now() - startTime;
    const resourcesUsed = this.calculateResourcesUsed(searchResult, executionResult);

    // Create result
    const result: OrchestratorResult = {
      response: executionResult.response,
      searchResult,
      executionPath: executionResult.path,
      totalTime,
      resourcesUsed,
      feedback: executionResult.feedback,
    };

    // Cache result
    if (options.useCache) {
      this.executionCache.set(cacheKey, result);

      // Limit cache size
      if (this.executionCache.size > 100) {
        const firstKey = this.executionCache.keys().next().value;
        if (firstKey) {
          this.executionCache.delete(firstKey);
        }
      }
    }

    // Process feedback if learning is enabled
    if (this.config.enableLearning && executionResult.feedback) {
      await abMCTSService.processFeedback(executionResult.feedback);
    }

    log.info('✅ AB-MCTS orchestration completed', LogContext.AI, {
      orchestrationId,
      bestAgent: searchResult.bestAction.agentName,
      confidence: searchResult.confidence,
      pathLength: searchResult.bestPath.length,
      totalTime,
      nodesExplored: searchResult.searchMetrics.nodesExplored,
    });

    return result;
  }

  /**
   * Execute the best path found by AB-MCTS
   */
  private async executeBestPath(
    searchResult: ABMCTSSearchResult,
    context: AgentContext,
    availableAgents: EnhancedBaseAgent[]
  ): Promise<{
    response: AgentResponse;
    path: string[];
    feedback?: ABMCTSFeedback;
  }> {
    const { bestPath } = searchResult;
    if (bestPath.length < TWO) {
      throw new Error('No valid execution path found');
    }

    // Get the agent from the best action
    const selectedAgentName = searchResult.bestAction.agentName;
    const selectedAgent = availableAgents.find((a) => a.getName() === selectedAgentName);

    if (!selectedAgent) {
      throw new Error(`Agent ${selectedAgentName} not found`);
    }

    // Execute with the selected agent
    const nodeContext: AgentContext = {
      ...context,
      metadata: {
        ...(context.metadata || {}),
        nodeId: bestPath[1]?.id || 'unknown',
        orchestrationPath: bestPath.map((n) => n.id),
      },
    };

    // Use enhanced execution with feedback
    const { response, feedback } = await selectedAgent.executeWithFeedback(nodeContext);

    return {
      response,
      path: bestPath.map((n) => n.metadata.agent || 'root'),
      feedback,
    };
  }

  /**
   * Fallback to traditional orchestration
   */
  private async fallbackOrchestration(context: AgentContext): Promise<OrchestratorResult> {
    log.warn('⚠️ Falling back to traditional orchestration', LogContext.AI);

    const startTime = Date.now();

    // Use multi-tier LLM for simple routing
    const { classification, plan } = await multiTierLLM.classifyAndPlan(
      context.userRequest,
      context.metadata || {}
    );

    // Execute with selected model
    const result = await multiTierLLM.execute(context.userRequest, context.metadata || {});

    return {
      response: {
        success: true,
        data: result.response,
        confidence: 0.7,
        message: 'Executed via fallback orchestration',
        reasoning: plan.reasoning,
        metadata: result.metadata,
      },
      searchResult: {
        bestPath: [],
        bestAction: {
          agentName: result.metadata.modelUsed,
          agentType: 'cognitive',
          estimatedCost: 100,
          estimatedTime: result.metadata.executionTime,
          requiredCapabilities: [],
        },
        confidence: 0.7,
        alternativePaths: [],
        searchMetrics: {
          nodesExplored: 1,
          iterations: 1,
          timeElapsed: Date.now() - startTime,
          averageDepth: 1,
          branchingFactor: 0,
        },
        recommendations: ['Fallback orchestration used due to AB-MCTS failure'],
      },
      executionPath: ['fallback', result.metadata.modelUsed],
      totalTime: Date.now() - startTime,
      resourcesUsed: {
        agents: 1,
        llmCalls: 1,
        tokensUsed: result.metadata.tokensUsed,
      },
    };
  }

  /**
   * Get available agents for the context
   */
  private async getAvailableAgents(context: AgentContext): Promise<EnhancedBaseAgent[]> {
    // Get available agent definitions
    const agentDefinitions = this.agentRegistry.getAvailableAgents();

    // Load agents that match context requirements
    const agents: EnhancedBaseAgent[] = [];

    for (const definition of agentDefinitions) {
      // Check if agent has required capabilities
      if (context.metadata?.requiredCapabilities) {
        const hasRequired = context.metadata.requiredCapabilities.every((req: string) =>
          definition.capabilities.includes(req)
        );
        if (!hasRequired) continue;
      }

      // Load the agent
      const agent = await this.agentRegistry.getAgent(definition.name);
      if (agent && agent instanceof EnhancedBaseAgent) {
        // Check agent performance score
        const score = agent.getProbabilisticScore(context);
        if (score > 0.1) {
          // Minimum score threshold
          agents.push(agent);
        }
      }
    }

    // Sort by probabilistic score
    return agents.sort((a, b) => {
      const scoreA = a.getProbabilisticScore(context);
      const scoreB = b.getProbabilisticScore(context);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate resources used in execution
   */
  private calculateResourcesUsed(
    searchResult: ABMCTSSearchResult,
    executionResult: unknown
  ): OrchestratorResult['resourcesUsed'] {
    const agentsUsed = new Set(searchResult.bestPath.map((n) => n.metadata.agent).filter(Boolean))
      .size;

    return {
      agents: agentsUsed,
      llmCalls: searchResult.searchMetrics.nodesExplored,
      tokensUsed: (executionResult as any)?.response?.metadata?.tokens?.total_tokens || 0,
    };
  }

  /**
   * Get visualization data for current orchestration
   */
  async getVisualization(orchestrationId: string): Promise<ABMCTSVisualization | null> {
    const searchResult = this.activeSearches.get(orchestrationId);
    if (!searchResult) return null;

    return abMCTSService.getVisualizationData() as any;
  }

  /**
   * Process user feedback for continuous improvement
   */
  async processUserFeedback(
    orchestrationId: string,
    rating: number,
    comment?: string
  ): Promise<void> {
    const searchResult = this.activeSearches.get(orchestrationId);
    if (!searchResult || searchResult.bestPath.length < TWO) return;

    const leafNode = searchResult.bestPath[searchResult.bestPath.length - 1];
    if (!leafNode) {
      throw new Error('No leaf node found in search result');
    }

    // Create feedback based on user rating
    const feedback: ABMCTSFeedback = {
      nodeId: leafNode.id,
      reward: {
        value: rating / 5, // Normalize to 0-1
        components: {
          quality: rating / 5,
          speed: 0.7, // Default
          cost: 0.7,
          user_satisfaction: rating / 5,
        },
        metadata: {
          executionTime: 0,
          tokensUsed: 0,
          memoryUsed: 0,
          errors: 0,
        },
      },
      userRating: rating,
      errorOccurred: false,
      timestamp: Date.now(),
      context: {
        taskType: 'user_feedback',
        sessionId: orchestrationId,
      },
    };

    await abMCTSService.processFeedback(feedback);

    log.info('👍 User feedback processed', LogContext.AI, {
      orchestrationId,
      rating,
      comment,
    });
  }

  /**
   * Get orchestrator statistics
   */
  getStatistics(): {
    activeSearches: number;
    cachedResults: number;
    circuitBreakerState: string;
    averageSearchTime: number;
    successRate: number;
  } {
    const cbMetrics = this.circuitBreaker.getMetrics();

    return {
      activeSearches: this.activeSearches.size,
      cachedResults: this.executionCache.size,
      circuitBreakerState: cbMetrics.state,
      averageSearchTime: 0, // Would calculate from historical data
      successRate:
        cbMetrics.totalRequests > 0 ? cbMetrics.successfulRequests / cbMetrics.totalRequests : 0,
    };
  }

  /**
   * Clear all caches and reset state
   */
  reset(): void {
    this.activeSearches.clear();
    this.executionCache.clear();
    this.circuitBreaker.reset();

    log.info('🔄 AB-MCTS orchestrator reset', LogContext.AI);
  }

  /**
   * Get cache key for context
   */
  private getCacheKey(context: AgentContext): string {
    return `${context.userRequest}_${JSON.stringify(context.metadata || {})}`;
  }

  /**
   * Parallel orchestration for multiple requests
   */
  async orchestrateParallel(
    contexts: AgentContext[],
    options: ABMCTSExecutionOptions = {
      useCache: true,
      enableParallelism: true,
      collectFeedback: true,
      saveCheckpoints: false,
      visualize: false,
      verboseLogging: false,
      fallbackStrategy: 'greedy',
    }
  ): Promise<OrchestratorResult[]> {
    log.info('🚀 Starting parallel AB-MCTS orchestration', LogContext.AI, {
      requests: contexts.length,
      parallelism: this.config.parallelExecutions,
    });

    const results: OrchestratorResult[] = [];

    // Process in batches
    for (let i = 0; i < contexts.length; i += this.config.parallelExecutions) {
      const batch = contexts.slice(i, i + this.config.parallelExecutions);

      const batchResults = await Promise.allSettled(
        batch.map((ctx) => this.orchestrate(ctx, options))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create error result
          results.push({
            response: {
              success: false,
              data: null,
              confidence: 0,
              message: 'Orchestration failed',
              reasoning: result.reason.message,
              metadata: { error: result.reason },
            },
            searchResult: {} as any,
            executionPath: [],
            totalTime: 0,
            resourcesUsed: { agents: 0, llmCalls: 0, tokensUsed: 0 },
          });
        }
      }
    }

    return results;
  }

  /**
   * Get recommendations for improving orchestration
   */
  async getRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    const stats = this.getStatistics();

    if (stats.successRate < 0.8) {
      recommendations.push('Consider increasing exploration budget to find better agent paths');
    }

    if (stats.circuitBreakerState === 'OPEN') {
      recommendations.push('Circuit breaker is open - check system health and agent availability');
    }

    if (this.executionCache.size > 80) {
      recommendations.push('Cache is nearly full - consider increasing cache size or TTL');
    }

    const agentMetrics = await this.getAgentPerformanceMetrics();
    for (const [agent, metrics] of Object.entries(agentMetrics)) {
      if (metrics.successRate < 0.5) {
        recommendations.push(
          `Agent ${agent} has low success rate - consider retraining or replacement`
        );
      }
    }

    return recommendations;
  }

  /**
   * Get performance metrics for all agents
   */
  private async getAgentPerformanceMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    const loadedAgents = this.agentRegistry.getLoadedAgents();

    for (const agentName of loadedAgents) {
      const agent = await this.agentRegistry.getAgent(agentName);
      if (agent && agent instanceof EnhancedBaseAgent) {
        metrics[agentName] = agent.getPerformanceMetrics();
      }
    }

    return metrics;
  }
}

// Export singleton instance
export const abMCTSOrchestrator = new ABMCTSOrchestrator();
export default abMCTSOrchestrator;

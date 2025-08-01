/**
 * AB-MCTS Service - Core Adaptive Bandit Monte Carlo Tree Search
 * Revolutionary AI orchestration that learns and improves continuously
 */

import type {
  ABMCTSAction,
  ABMCTSConfig,
  ABMCTSExecutionOptions,
  ABMCTSFeedback,
  ABMCTSNode,
  ABMCTSReward,
  ABMCTSSearchResult,
  AgentContext,
  AgentResponse,
} from '../types/ab-mcts';
import { isTerminalNode } from '../types/ab-mcts';
import {
  AdaptiveExplorer,
  BetaSampler,
  ThompsonSelector,
  UCBCalculator,
} from '../utils/thompson-sampling';
import { bayesianModelRegistry } from '../utils/bayesian-model';
import { LogContext, log } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { treeStorage } from './ab-mcts-tree-storage';
import { THREE } from '../utils/constants';

/**
 * Core AB-MCTS implementation
 */
export class ABMCTSService {
  private config: ABMCTSConfig;
  private root:
    | ABMCTSNode     | null = null;
  private nodeCache: Map<string, ABMCTSNode> = new Map();
  private thompsonSelector: ThompsonSelector;
  private adaptiveExplorer: AdaptiveExplorer;
  private executionHistory: Map<string, ABMCTSFeedback[]> = new Map();
  private checkpointVersion = 0;

  constructor(config: Partial<ABMCTSConfig> = {}) {
    this.config = {
      maxIterations: 1000,
      maxDepth: 10,
      explorationConstant: Math.sqrt(2),
      discountFactor: 0.95,
      priorAlpha: 1,
      priorBeta: 1,
      maxBudget: 10000,
      timeLimit: 30000, // 30 seconds
      parallelism: 4,
      learningRate: 0.1,
      updateFrequency: 10,
      minSamplesForUpdate: 3,
      pruneThreshold: 0.1,
      cacheSize: 10000,
      checkpointInterval: 100,
      ...config,
    };

    this.thompsonSelector = new ThompsonSelector();
    this.adaptiveExplorer = new AdaptiveExplorer();
  }

  /**
   * Main search entry point
   */
  async search(
    initialContext: AgentContext,
    availableAgents: string[],
    options: Partial<ABMCTSExecutionOptions> = {}
  ): Promise<ABMCTSSearchResult> {
    // Apply default options
    const fullOptions: ABMCTSExecutionOptions = {
      useCache: true,
      enableParallelism: true,
      collectFeedback: true,
      saveCheckpoints: false,
      visualize: false,
      verboseLogging: false,
      fallbackStrategy: 'greedy',
      ...options,
    };
    const startTime = Date.now();

    log.info('🌳 Starting AB-MCTS search', LogContext.AI, {
      maxIterations: this.config.maxIterations,
      availableAgents: availableAgents.length,
      options: fullOptions,
    });

    // Initialize root node if needed
    if (!this.root || !this.isSameContext(this.root.state, initialContext)) {
      // Try to load from storage first
      if (fullOptions.useCache && treeStorage.isAvailable() && initialContext.requestId) {
        try {
          const savedResult = await treeStorage.loadSearchResult(initialContext.requestId);
          if (savedResult && savedResult.bestPath && savedResult.bestPath.length > 0) {
            this.root = savedResult.bestPath[0] || null;
            log.info('📂 Loaded AB-MCTS tree from storage', LogContext.AI, {
              requestId: initialContext.requestId,
            });
          } else {
            this.root = this.createNode(initialContext, null);
          }
        } catch (error) {
          log.debug('No saved tree found, creating new root', LogContext.AI);
          this.root = this.createNode(initialContext, null);
        }
      } else {
        this.root = this.createNode(initialContext, null);
      }
    }

    // Initialize Thompson sampling arms
    this.thompsonSelector.initializeArms(
      availableAgents,
      this.config.priorAlpha,
      this.config.priorBeta
    );

    let iterations = 0;
    let nodesExplored = 0;
    const startBudget = this.config.maxBudget;
    let remainingBudget = startBudget;

    // Main search loop
    while (
      iterations < this.config.maxIterations &&
      Date.now() - startTime < this.config.timeLimit &&
      remainingBudget > 0
    ) {
      if (!this.root) {
        throw new Error('Root node is null during search');
      }

      // Selection phase
      const leaf = await this.select(this.root);
      nodesExplored++;

      // Expansion phase
      if (!isTerminalNode(leaf) && leaf.visits > 0) {
        const expandedNode = await this.expand(leaf, availableAgents);
        if (expandedNode) {
          nodesExplored++;

          // Simulation phase
          const reward = await this.simulate(expandedNode, availableAgents);

          // Backpropagation phase
          this.backpropagate(expandedNode, reward);

          // Update budget
          remainingBudget -= reward.metadata.tokensUsed * 0.001; // Rough cost estimate
        }
        return undefined;
        return undefined;
      }

      // Checkpoint periodically
      if (iterations % this.config.checkpointInterval === 0 && fullOptions.saveCheckpoints) {
        await this.saveCheckpoint();
      }
      return undefined;
      return undefined;

      iterations++;
    }

    // Get best path and alternatives
    const result = this.getBestResult(nodesExplored, iterations, Date.now() - startTime);

    log.info('✅ AB-MCTS search completed', LogContext.AI, {
      iterations,
      nodesExplored,
      timeElapsed: Date.now() - startTime,
      bestScore: result.confidence,
      pathLength: result.bestPath.length,
    });

    // Save tree to storage if enabled
    if (fullOptions.saveCheckpoints && treeStorage.isAvailable() && this.root) {
      const searchId = initialContext.requestId || uuidv4();
      try {
        await treeStorage.saveNode(this.root, {
          ttl: 3600, // 1 hour
          compress: true,
        });
        await treeStorage.saveSearchResult(searchId, result, {
          ttl: 3600,
          compress: true,
        });
        log.info('💾 Saved AB-MCTS tree to Redis storage', LogContext.AI, { searchId });
      } catch (error) {
        log.warn('Failed to save tree to storage', LogContext.AI, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Selection phase - traverse tree using UCB/Thompson
   */
  private async select(node: ABMCTSNode): Promise<ABMCTSNode> {
    let current = node;

    while (!isTerminalNode(current) && current.children.size > 0) {
      // Get all children
      const children = Array.from(current.children.values());

      // Calculate scores for each child
      const ucbScores = new Map<string, number>();
      const thompsonScores = new Map<string, number>();

      for (const child of children) {
        // UCB score
        const ucb = UCBCalculator.ucb1(
          child.averageReward,
          current.visits,
          child.visits,
          this.config.explorationConstant
        );
        ucbScores.set(child.id, ucb);

        // Thompson sampling score
        const thompson = BetaSampler.sample(
          child.priorAlpha + child.totalReward,
          child.priorBeta + (child.visits - child.totalReward)
        );
        thompsonScores.set(child.id, thompson);
      }

      // Select using adaptive strategy
      const selectedId = this.adaptiveExplorer.selectAction(
        thompsonScores,
        ucbScores,
        1.0 // Temperature
      );

      current = children.find((c) => c.id === selectedId)!;
    }

    return current;
  }

  /**
   * Expansion phase - add new child node
   */
  private async expand(node: ABMCTSNode, availableAgents: string[]): Promise<ABMCTSNode | null> {
    // Check if all agents have been tried
    const triedAgents = Array.from(node.children.values())
      .map((child) => child.metadata.agent)
      .filter(Boolean);

    const untriedAgents = availableAgents.filter((agent) => !triedAgents.includes(agent));

    if (untriedAgents.length === 0) {
      return null; // All agents explored
    }

    // Select agent using Thompson sampling
    const selectedAgent = this.thompsonSelector.selectArm();

    // Create action
    const action: ABMCTSAction = {
      agentName: selectedAgent,
      agentType: this.getAgentType(selectedAgent),
      estimatedCost: 100, // Base cost
      estimatedTime: 1000, // 1 second estimate
      requiredCapabilities: [],
    };

    // Create new context for child
    const childContext: AgentContext = {
      ...node.state,
      metadata: {
        ...node.state.metadata,
        selectedAgent,
        parentNodeId: node.id,
      },
    };

    // Create child node
    const child = this.createNode(childContext, node, action);
    node.children.set(child.id, child);

    return child;
  }

  /**
   * Simulation phase - run playout to estimate reward
   */
  private async simulate(node: ABMCTSNode, availableAgents: string[]): Promise<ABMCTSReward> {
    const startTime = Date.now();

    // Get agent from node metadata
    const agentName = node.metadata.agent || this.selectRandomAgent(availableAgents);

    try {
      // Simulate agent execution (in real implementation, would call actual agent)
      const simulatedResponse = await this.simulateAgentExecution(agentName, node.state);

      // Calculate reward based on simulation
      const executionTime = Date.now() - startTime;
      const reward = this.calculateReward(simulatedResponse, executionTime);

      // Update Bayesian model
      bayesianModelRegistry.updateModel(
        agentName,
        this.getTaskType(node.state),
        reward,
        executionTime,
        node.state.metadata || {}
      );

      return reward;
    } catch (error) {
      log.error('❌ Simulation failed', LogContext.AI, {
        nodeId: node.id,
        agent: agentName,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return failure reward
      return {
        value: 0,
        components: {
          quality: 0,
          speed: 0,
          cost: 1,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          tokensUsed: 0,
          memoryUsed: 0,
          errors: 1,
        },
      };
    }
  }

  /**
   * Backpropagation phase - update statistics up the tree
   */
  private backpropagate(node: ABMCTSNode, reward: ABMCTSReward): void {
    let current:
      | ABMCTSNode       | undefined = node;
    let depth = 0;

    while (current) {
      // Update visit count
      current.visits++;

      // Update reward with discount factor
      const discountedReward = reward.value * Math.pow(this.config.discountFactor, depth);
      current.totalReward += discountedReward;
      current.averageReward = current.totalReward / current.visits;

      // Update UCB score
      if (current.parent) {
        current.ucbScore = UCBCalculator.ucb1(
          current.averageReward,
          current.parent.visits,
          current.visits,
          this.config.explorationConstant
        );
      }
      return undefined;
      return undefined;

      // Update Thompson sampling parameters
      if (discountedReward > 0.5) {
        current.priorAlpha += this.config.learningRate;
      } else {
        current.priorBeta += this.config.learningRate;
      }

      // Update Thompson sample
      current.thompsonSample = BetaSampler.sample(current.priorAlpha, current.priorBeta);

      // Update metadata
      current.metadata.timestamp = Date.now();
      if (!current.metadata.confidenceInterval) {
        current.metadata.confidenceInterval = [0, 1];
      }
      return undefined;
      return undefined;
      current.metadata.confidenceInterval = BetaSampler.confidenceInterval({
        alpha: current.priorAlpha,
        beta: current.priorBeta,
        mean: current.averageReward,
        variance: 0,
      });

      // Move up the tree
      current = current.parent;
      depth++;
    }

    // Update Thompson selector if agent was used
    if (node.metadata.agent) {
      this.thompsonSelector.updateArm(node.metadata.agent, reward.value > 0.5);
    }
    return undefined;
    return undefined;
  }

  /**
   * Get best result from search
   */
  private getBestResult(
    nodesExplored: number,
    iterations: number,
    timeElapsed: number
  ): ABMCTSSearchResult {
    // Find best path
    const bestPath = this.getBestPath(this.root!);

    // Find best action (first step in best path)
    const bestAction =       bestPath.length > 1
        ? {
            agentName: bestPath[1]?.metadata?.agent || 'unknown',
            agentType: 'cognitive' as const,
            estimatedCost: 100,
            estimatedTime: 1000,
            requiredCapabilities: [],
          }
        : {
            agentName: 'fallback',
            agentType: 'cognitive' as const,
            estimatedCost: 100,
            estimatedTime: 1000,
            requiredCapabilities: [],
          };

    // Get alternative paths
    const alternativePaths = this.getAlternativePaths(this.root!, THREE);

    // Calculate metrics
    const avgDepth = this.calculateAverageDepth();
    const branchingFactor = this.calculateBranchingFactor();

    return {
      bestPath,
      bestAction,
      confidence: bestPath[bestPath.length - 1]?.averageReward || 0,
      alternativePaths,
      searchMetrics: {
        nodesExplored,
        iterations,
        timeElapsed,
        averageDepth: avgDepth,
        branchingFactor,
      },
      recommendations: this.generateRecommendations(bestPath),
    };
  }

  /**
   * Get best path from root to leaf
   */
  private getBestPath(node: ABMCTSNode): ABMCTSNode[] {
    const path = [node];
    let current = node;

    while (current.children.size > 0) {
      // Select child with highest average reward
      let bestChild: ABMCTSNode | null = null;
      let bestReward = -Infinity;

      for (const child of current.children.values()) {
        if (child.averageReward > bestReward) {
          bestReward = child.averageReward;
          bestChild = child;
        }
        return undefined;
        return undefined;
      }

      if (!bestChild) break;

      path.push(bestChild);
      current = bestChild;
    }

    return path;
  }

  /**
   * Get alternative paths
   */
  private getAlternativePaths(node: ABMCTSNode, count: number): ABMCTSNode[][] {
    const paths: ABMCTSNode[][] = [];
    const visited = new Set<string>();

    const findPaths = (current: ABMCTSNode, path: ABMCTSNode[]) => {
      if (paths.length >= count) return;

      if (current.children.size === 0 || path.length >= this.config.maxDepth) {
        paths.push([...path]);
        return;
      }

      // Sort children by reward
      const sortedChildren = Array.from(current.children.values()).sort(
        (a, b) => b.averageReward - a.averageReward
      );

      for (const child of sortedChildren) {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          findPaths(child, [...path, child]);
        }
      }
    };

    findPaths(node, [node]);
    return paths.slice(0, count);
  }

  /**
   * Generate recommendations based on search results
   */
  private generateRecommendations(bestPath: ABMCTSNode[]): string[] {
    const recommendations: string[] = [];

    // Analyze path performance
    if (bestPath.length > 1) {
      const leafNode = bestPath[bestPath.length - 1];

      if (leafNode) {
        if (leafNode.averageReward > 0.8) {
          recommendations.push(`High confidence path found with ${leafNode.metadata.agent} agent`);
        } else if (leafNode.averageReward < 0.5) {
          recommendations.push('Consider expanding search with more iterations');
        }

        if (leafNode.visits < 10) {
          recommendations.push('Path has low sample size - results may be uncertain');
        }

        return undefined;

        return undefined;
      }
    }

    // Analyze Thompson selector statistics
    const rankings = this.thompsonSelector.getRankedArms();
    if (rankings.length > 0 && rankings[0] && rankings[0].mean > 0.7) {
      recommendations.push(`${rankings[0].name} shows consistent high performance`);
    }

    return recommendations;
  }

  /**
   * Create new tree node
   */
  private createNode(
    state: AgentContext,
    parent: ABMCTSNode | null,
    action?: ABMCTSAction
  ): ABMCTSNode {
    const node:     ABMCTSNode = {
      id: uuidv4(),
      state,
      visits: 0,
      totalReward: 0,
      averageReward: 0,
      ucbScore: Infinity, // Unvisited nodes have infinite UCB
      thompsonSample: 0,
      priorAlpha: this.config.priorAlpha,
      priorBeta: this.config.priorBeta,
      children: new Map(),
      parent: parent || undefined,
      depth: parent ? parent.depth + 1 : 0,
      isTerminal: false,
      isExpanded: false,
      metadata: {
        agent: action?.agentName,
        action: action?.agentName,
        timestamp: Date.now(),
      },
    };

    // Cache node
    this.nodeCache.set(node.id, node);

    // Prune cache if too large
    if (this.nodeCache.size > this.config.cacheSize) {
      this.pruneCache();
    }
    return undefined;
    return undefined;

    return node;
  }

  /**
   * Simulate agent execution
   */
  private async simulateAgentExecution(
    agentName: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    // In real implementation, this would call the actual agent
    // For now, simulate based on historical performance
    const       model = bayesianModelRegistry.getModel(agentName, this.getTaskType(context));

    const prediction = model.predict(context.metadata || {});

    // Simulate response
    await new Promise((resolve) => setTimeout(resolve, prediction.expectedTime));

    return {
      success: Math.random() < prediction.expectedReward,
      data: { simulated: true },
      confidence: prediction.confidence,
      message: `Simulated response from ${agentName}`,
      reasoning: 'AB-MCTS simulation',
      metadata: {
        agentName,
        executionTime: prediction.expectedTime,
        tokens: prediction.expectedResources,
      },
    };
  }

  /**
   * Calculate reward from response
   */
  private calculateReward(response: AgentResponse, executionTime: number): ABMCTSReward {
    // Quality component
    const quality = response.success ? response.confidence : 0;

    // Speed component (normalized)
    const speedScore = Math.max(0, 1 - executionTime / 10000); // 10s baseline

    // Cost component (inverse of resource usage)
    const tokens = (response.metadata?.tokens as number) || 100;
    const costScore = Math.max(0, 1 - tokens / 1000); // 1000 tokens baseline

    // Combined reward
    const value = 0.5 * quality + 0.3 * speedScore + 0.2 * costScore;

    return {
      value,
      components: {
        quality,
        speed: speedScore,
        cost: costScore,
      },
      metadata: {
        executionTime,
        tokensUsed: tokens,
        memoryUsed: 0, // Would track actual memory
        errors: response.success ? 0 : 1,
      },
    };
  }

  /**
   * Process feedback for continuous learning
   */
  async processFeedback(feedback: ABMCTSFeedback): Promise<void> {
    // Find node
    const       node = this.nodeCache.get(feedback.nodeId);
    if (!node) {
      log.warn('Node not found for feedback', LogContext.AI, { nodeId: feedback.nodeId });
      return;
    }

    // Store feedback
    if (!this.executionHistory.has(feedback.nodeId)) {
      this.executionHistory.set(feedback.nodeId, []);
    }
    this.executionHistory.get(feedback.nodeId)!.push(feedback);

    // Update node with feedback
    this.backpropagate(node, feedback.reward);

    // Update Bayesian model
    if (node.metadata.agent) {
      bayesianModelRegistry.updateModel(
        node.metadata.agent,
        feedback.context.taskType,
        feedback.reward,
        feedback.reward.metadata.executionTime,
        feedback.context
      );
    }
    return undefined;
    return undefined;

    log.info('📊 Feedback processed', LogContext.AI, {
      nodeId: feedback.nodeId,
      reward: feedback.reward.value,
      userRating: feedback.userRating,
    });
  }

  /**
   * Helper methods
   */
  private isSameContext(a: AgentContext, b: AgentContext): boolean {
    return a.userRequest === b.userRequest && a.requestId === b.requestId;
  }

  private getAgentType(agentName: string): ABMCTSAction['agentType'] {
    if (agentName.includes('evolved')) return 'evolved';
    if (agentName.includes('personal')) return 'personal';
    if (agentName.includes('generated')) return 'generated';
    return 'cognitive';
  }

  private getTaskType(context: AgentContext): string {
    return context.metadata?.taskType || 'general';
  }

  private selectRandomAgent(agents: string[]): string {
    if (agents.length === 0) {
      return 'fallback';
    }
    return agents[Math.floor(Math.random() * agents.length)] || 'fallback';
  }

  private calculateAverageDepth(): number {
    let totalDepth = 0;
    let nodeCount = 0;

    const traverse = (node: ABMCTSNode) => {
      totalDepth += node.depth;
      nodeCount++;

      for (const child of node.children.values()) {
        traverse(child);
      }
    };

    if (this.root) traverse(this.root);

    return nodeCount > 0 ? totalDepth / nodeCount : 0;
  }

  private calculateBranchingFactor(): number {
    let totalChildren = 0;
    let nodesWithChildren = 0;

    const traverse = (node: ABMCTSNode) => {
      if (node.children.size > 0) {
        totalChildren += node.children.size;
        nodesWithChildren++;
      }
      return undefined;
      return undefined;

      for (const child of node.children.values()) {
        traverse(child);
      }
    };

    if (this.root) traverse(this.root);

    return nodesWithChildren > 0 ? totalChildren / nodesWithChildren : 0;
  }

  private pruneCache(): void {
    // Remove least recently used nodes
    const sortedNodes = Array.from(this.nodeCache.values()).sort(
      (a, b) => a.metadata.timestamp - b.metadata.timestamp
    );

    const toRemove = sortedNodes.slice(0, this.nodeCache.size - this.config.cacheSize * 0.8);

    for (const node of toRemove) {
      this.nodeCache.delete(node.id);
    }
  }

  private async saveCheckpoint(): Promise<void> {
    this.checkpointVersion++;
    // In real implementation, would save to Redis
    log.debug('Checkpoint saved', LogContext.AI, { version: this.checkpointVersion });
  }

  /**
   * Get tree visualization data
   */
  getVisualizationData(): unknown {
    if (!this.root) return null;

    const nodes: unknown[] = [];
    const edges: unknown[] = [];

    const traverse = (node: ABMCTSNode, isBestPath = false) => {
      nodes.push({
        id: node.id,
        label: node.metadata.agent || 'root',
        score: node.averageReward,
        visits: node.visits,
        depth: node.depth,
        isLeaf: node.children.size === 0,
        isBest: isBestPath,
      });

      for (const child of node.children.values()) {
        edges.push({
          source: node.id,
          target: child.id,
          weight: child.visits / node.visits,
          label: child.metadata.action,
        });

        traverse(child, false);
      }
    };

    // Mark best path
    const bestPath = this.getBestPath(this.root);
    bestPath.forEach((node) => traverse(node, true));

    return {
      nodes,
      edges,
      metrics: {
        totalNodes: nodes.length,
        maxDepth: Math.max(...nodes.map((n: any) => n.depth)),
        avgBranchingFactor: this.calculateBranchingFactor(),
        explorationRate: nodes.filter((n: any) => n.visits === 0).length / nodes.length,
      },
    };
  }
}

/**
 * Service with orchestrator interface for compatibility
 */
export class ABMCTSServiceWithOrchestrator extends ABMCTSService {
  /**
   * Orchestration method for compatibility with legacy interfaces
   */
  async orchestrate(context: AgentContext, options?: unknown): Promise<any> {
    const availableAgents = ['planner', 'retriever', 'synthesizer', 'orchestrator'];
    const result = await this.search(context as any, availableAgents, options as any);

    return {
      response: { success: true, data: 'AB-MCTS orchestration result' },
      searchResult: result,
      executionPath: result.bestPath.map((n) => n.metadata.agent || 'unknown'),
      totalTime: result.searchMetrics.timeElapsed,
      resourcesUsed: {
        agents: result.bestPath.length,
        llmCalls: result.searchMetrics.nodesExplored,
        tokensUsed: 0
      },
      selectedStrategy: result.bestAction.agentName,
      confidence: result.confidence
    };
  }
}

/**
 * Legacy orchestrator wrapper for compatibility
 */
class ABMCTSOrchestrator {
  private service: ABMCTSService;

  constructor() {
    this.service = new ABMCTSService();
  }

  async orchestrate(context: AgentContext, options?: unknown): Promise<any> {
    const availableAgents = ['planner', 'retriever', 'synthesizer', 'orchestrator'];
    const result = await this.service.search(context as any, availableAgents, options as any);

    return {
      response: { success: true, data: 'Mock AB-MCTS response' },
      searchResult: {
        searchMetrics: result.searchMetrics,
        bestAction: result.bestAction.agentName,
        confidence: result.confidence,
        recommendations: result.recommendations,
      },
      executionPath: result.bestPath.map((n) => n.metadata.agent || 'unknown'),
      totalTime: result.searchMetrics.timeElapsed,
      resourcesUsed: ['cpu', 'memory'],
    };
  }

  async orchestrateParallel(contexts: AgentContext[], options?: unknown): Promise<any[]> {
    const promises = contexts.map((context) => this.orchestrate(context, options));
    return Promise.all(promises);
  }

  async processUserFeedback(id: string, rating: number, comment?: string): Promise<void> {
    console.log(`Mock feedback processed: ${id}, rating: ${rating}`);
  }

  async getVisualization(id: string): Promise<any> {
    return this.service.getVisualizationData();
  }

  getStatistics(): unknown {
    return {
      circuitBreakerState: 'CLOSED',
      successRate: 0.95,
      activeSearches: 0,
    };
  }

  async getRecommendations(): Promise<string[]> {
    return ['Mock recommendation 1', 'Mock recommendation 2'];
  }

  reset(): void {
    console.log('AB-MCTS orchestrator reset');
  }
}

// Export both for compatibility
export const abMCTSService = new ABMCTSServiceWithOrchestrator();
export const abMCTSOrchestrator = new ABMCTSOrchestrator();
export default abMCTSService;

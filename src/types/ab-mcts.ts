/**
 * AB-MCTS (Adaptive Bandit Monte Carlo Tree Search) Type Definitions
 * Revolutionary AI orchestration system that combines:
 * - Monte Carlo Tree Search for exploration
 * - Thompson Sampling for probabilistic selection
 * - Bayesian inference for continuous learning
 */

import type { AgentContext, AgentResponse } from '@/types';

// Re-export for external use
export type { AgentContext, AgentResponse };

/**
 * Core tree node structure for AB-MCTS
 */
export interface ABMCTSNode {
  id: string;
  state: AgentContext;
  visits: number;
  totalReward: number;
  averageReward: number;
  ucbScore: number;
  thompsonSample: number;
  priorAlpha: number;
  priorBeta: number;
  children: Map<string, ABMCTSNode>;
  parent?: ABMCTSNode;
  depth: number;
  isTerminal: boolean;
  isExpanded: boolean;
  metadata: {
    agent?: string;
    action?: string;
    model?: string;
    timestamp: number;
    executionTime?: number;
    resourceCost?: number;
    confidenceInterval?: [number, number];
  };
}

/**
 * Configuration for AB-MCTS search
 */
export interface ABMCTSConfig {
  // Tree search parameters
  maxIterations: number;
  maxDepth: number;
  explorationConstant: number; // C in UCB formula
  discountFactor: number; // Gamma for future rewards

  // Thompson sampling parameters
  priorAlpha: number; // Beta distribution alpha
  priorBeta: number; // Beta distribution beta

  // Resource constraints
  maxBudget: number; // Max computational budget
  timeLimit: number; // Max time in milliseconds
  parallelism: number; // Number of parallel explorations

  // Learning parameters
  learningRate: number;
  updateFrequency: number;
  minSamplesForUpdate: number;

  // Pruning and optimization
  pruneThreshold: number; // Remove nodes below this score
  cacheSize: number; // Max cached nodes
  checkpointInterval: number; // Save state every N iterations
}

/**
 * Action space for agent selection
 */
export interface ABMCTSAction {
  agentName: string;
  agentType: 'cognitive' | 'personal' | 'evolved' | 'generated';
  estimatedCost: number;
  estimatedTime: number;
  requiredCapabilities: string[];
  modelRequirement?: string; // Specific LLM model needed
}

/**
 * Reward signal for updating the tree
 */
export interface ABMCTSReward {
  value: number; // 0-1 normalized reward
  components: {
    quality: number; // Solution quality
    speed: number; // Execution speed
    cost: number; // Resource efficiency
    user_satisfaction?: number; // User feedback
  };
  metadata: {
    executionTime: number;
    tokensUsed: number;
    memoryUsed: number;
    errors: number;
  };
}

/**
 * Search result from AB-MCTS
 */
export interface ABMCTSSearchResult {
  bestPath: ABMCTSNode[];
  bestAction: ABMCTSAction;
  confidence: number;
  alternativePaths: ABMCTSNode[][];
  searchMetrics: {
    nodesExplored: number;
    iterations: number;
    timeElapsed: number;
    averageDepth: number;
    branchingFactor: number;
  };
  recommendations: string[];
}

/**
 * Bayesian model for performance tracking
 */
export interface BayesianPerformanceModel {
  agentName: string;
  taskType: string;

  // Performance distributions
  successRate: BetaDistribution;
  executionTime: NormalDistribution;
  resourceUsage: GammaDistribution;

  // Historical data
  observations: PerformanceObservation[];
  lastUpdated: number;
  totalSamples: number;

  // Predictive metrics
  expectedPerformance: number;
  confidenceInterval: [number, number];
  reliability: number;
}

/**
 * Beta distribution for modeling success rates
 */
export interface BetaDistribution {
  alpha: number;
  beta: number;
  mean: number;
  variance: number;
  mode?: number;
}

/**
 * Normal distribution for continuous metrics
 */
export interface NormalDistribution {
  mean: number;
  variance: number;
  precision: number; // 1/variance
  standardDeviation: number;
}

/**
 * Gamma distribution for positive continuous values
 */
export interface GammaDistribution {
  shape: number; // alpha
  rate: number; // beta
  mean: number;
  variance: number;
}

/**
 * Performance observation for model updates
 */
export interface PerformanceObservation {
  timestamp: number;
  success: boolean;
  executionTime: number;
  resourceUsage: number;
  reward: number;
  context: Record<string, any>;
}

/**
 * Thompson sampling parameters
 */
export interface ThompsonSamplingParams {
  // For binary outcomes (Beta distribution)
  useBeta: boolean;
  alphas: number[];
  betas: number[];

  // For continuous outcomes (Normal-Gamma)
  useNormalGamma: boolean;
  means: number[];
  precisions: number[];
  shapes: number[];
  rates: number[];

  // Exploration parameters
  temperature: number; // Controls randomness
  epsilon: number; // Epsilon-greedy fallback
}

/**
 * Tree storage format for Redis
 */
export interface ABMCTSTreeStorage {
  rootId: string;
  nodes: Record<string, SerializedNode>;
  metadata: {
    created: number;
    lastModified: number;
    iterations: number;
    bestScore: number;
    checkpointVersion: number;
  };
}

/**
 * Serialized node format for storage
 */
export interface SerializedNode {
  id: string;
  parentId?: string;
  childrenIds: string[];
  state: string; // JSON stringified AgentContext
  stats: {
    visits: number;
    totalReward: number;
    ucbScore: number;
    thompsonSample: number;
  };
  metadata: Record<string, any>;
}

/**
 * Feedback signal for continuous learning
 */
export interface ABMCTSFeedback {
  nodeId: string;
  reward: ABMCTSReward;
  userRating?: number; // 1-5 scale
  errorOccurred: boolean;
  errorMessage?: string;
  timestamp: number;
  context: {
    taskType: string;
    userId?: string;
    sessionId: string;
  };
}

/**
 * Tree visualization data
 */
export interface ABMCTSVisualization {
  nodes: Array<{
    id: string;
    label: string;
    score: number;
    visits: number;
    depth: number;
    isLeaf: boolean;
    isBest: boolean;
  }>;
  edges: Array<{
    source: string;
    target: string;
    weight: number;
    label?: string;
  }>;
  metrics: {
    totalNodes: number;
    maxDepth: number;
    avgBranchingFactor: number;
    explorationRate: number;
  };
}

/**
 * AB-MCTS execution options
 */
export interface ABMCTSExecutionOptions {
  useCache: boolean;
  enableParallelism: boolean;
  collectFeedback: boolean;
  saveCheckpoints: boolean;
  visualize: boolean;
  verboseLogging: boolean;
  fallbackStrategy: 'greedy' | 'random' | 'fixed';
}

/**
 * Mixed model for cross-task learning (AB-MCTS-M)
 */
export interface ABMCTSMixedModel {
  globalPriors: {
    successRate: BetaDistribution;
    executionTime: NormalDistribution;
    resourceUsage: GammaDistribution;
  };
  taskSpecificModels: Map<string, BayesianPerformanceModel>;
  sharedFeatures: string[];
  transferLearningWeight: number;
}

/**
 * Resource allocation for parallel exploration
 */
export interface ABMCTSResourceAllocation {
  cpuLimit: number; // Percentage
  memoryLimit: number; // MB
  timeSlice: number; // MS per iteration
  priority: 'low' | 'medium' | 'high';
  preemptible: boolean;
}

/**
 * A/B testing configuration
 */
export interface ABMCTSExperiment {
  id: string;
  name: string;
  variants: Array<{
    name: string;
    config: Partial<ABMCTSConfig>;
    weight: number; // Traffic percentage
  }>;
  metrics: string[];
  startTime: number;
  endTime?: number;
  status: 'active' | 'paused' | 'completed';
}

// Export type guards
export function isABMCTSNode(obj: unknown): obj is ABMCTSNode {
  return (
    !!obj &&
    typeof (obj as any).id === 'string' &&
    typeof (obj as any).visits === 'number' &&
    (obj as any).children instanceof Map
  );
}

export function isTerminalNode(node: ABMCTSNode): boolean {
  return node.isTerminal || node.depth >= 10; // Max depth safeguard
}

// Export utility types
export type NodeSelector = (node: ABMCTSNode) => number;
export type RewardFunction = (response: AgentResponse, context: AgentContext) => ABMCTSReward;
export type TerminationChecker = (node: ABMCTSNode, context: AgentContext) => boolean;

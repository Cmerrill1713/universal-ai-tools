// TypeScript type definitions for AB-MCTS Rust service integration
// This file provides type-safe interfaces for interacting with the Rust AB-MCTS service

// ============================================================================
// Core Configuration Types
// ============================================================================

export interface MCTSConfig {
  maxIterations: number;
  maxDepth: number;
  explorationConstant: number;
  discountFactor: number;
  timeLimitMs: number;
  enableThompsonSampling: boolean;
  enableBayesianLearning: boolean;
  enableCaching: boolean;
  parallelSimulations: number;
  cacheConfig?: CacheConfig;
}

export interface CacheConfig {
  redisUrl: string;
  keyPrefix: string;
  defaultTtlSecs: number;
  maxRetries: number;
  retryDelay: number;
  compressionThreshold: number;
}

export interface SearchOptions {
  maxIterations: number;
  maxDepth: number;
  timeLimitMs: number;
  explorationFactor: number;
  parallelSimulations: number;
  enableEarlyTermination: boolean;
}

// ============================================================================
// Agent and Context Types
// ============================================================================

export interface AgentContext {
  task: string;
  requirements: string[];
  constraints: string[];
  contextData: Record<string, any>;
  userPreferences?: UserPreferences;
  executionContext: ExecutionContext;
}

export interface UserPreferences {
  preferredAgentTypes: string[];
  qualityWeight: number;
  speedWeight: number;
  costWeight: number;
  riskTolerance: number;
}

export interface ExecutionContext {
  sessionId: string;
  userId?: string;
  timestamp: number; // Unix timestamp in milliseconds
  budget: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export type AgentType = 
  | 'planner' 
  | 'retriever' 
  | 'synthesizer' 
  | 'personal_assistant' 
  | 'code_assistant'
  | { specialized: string };

export interface MCTSAction {
  id: string;
  agentName: string;
  agentType: AgentType;
  estimatedCost: number;
  estimatedTime: number; // milliseconds
  requiredCapabilities: string[];
  parameters: Record<string, any>;
  confidence: number;
}

// ============================================================================
// Results and Recommendations
// ============================================================================

export interface SearchResult {
  bestPath: MCTSAction[];
  confidence: number;
  expectedReward: number;
  searchStatistics: SearchStatistics;
  agentRecommendations: AgentRecommendation[];
  executionPlan: ExecutionPlan;
}

export interface SearchStatistics {
  totalIterations: number;
  nodesExplored: number;
  averageDepth: number;
  searchTimeMs: number;
  cacheHits: number;
  cacheMisses: number;
  thompsonSamples: number;
  ucbSelections: number;
}

export interface AgentRecommendation {
  agentName: string;
  agentType: AgentType;
  confidence: number;
  expectedPerformance: number;
  estimatedCost: number;
  rationale: string;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  totalEstimatedTimeMs: number;
  totalEstimatedCost: number;
  riskAssessment: RiskAssessment;
  fallbackOptions: MCTSAction[];
}

export interface ExecutionStep {
  stepNumber: number;
  action: MCTSAction;
  dependencies: number[]; // Step numbers this step depends on
  parallelExecution: boolean;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: BackoffStrategy;
  retryConditions: string[];
}

export type BackoffStrategy = 
  | { constant: number }
  | { linear: number }
  | { exponential: { base: number; multiplier: number } };

export interface RiskAssessment {
  overallRisk: number;
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
}

export interface RiskFactor {
  factorType: string;
  severity: number;
  probability: number;
  description: string;
}

// ============================================================================
// Reward and Performance Types
// ============================================================================

export interface MCTSReward {
  value: number;
  components: RewardComponents;
  metadata: RewardMetadata;
}

export interface RewardComponents {
  quality: number;
  speed: number;
  cost: number;
  userSatisfaction?: number;
}

export interface RewardMetadata {
  tokensUsed: number;
  apiCallsMade: number;
  executionTimeMs: number;
  agentPerformance: Record<string, number>;
  timestamp: number;
}

// ============================================================================
// Bridge Interface
// ============================================================================

export interface MCTSBridge {
  // Lifecycle management
  initialize(): Promise<void>;
  isReady(): boolean;
  updateConfig(config: MCTSConfig): Promise<void>;
  reset(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;

  // Session management
  generateSessionId(): string;

  // Core search functionality
  searchOptimalAgents(
    context: AgentContext,
    availableAgents: string[],
    options?: SearchOptions
  ): Promise<SearchResult>;

  recommendAgents(
    context: AgentContext,
    availableAgents: string[],
    maxRecommendations: number
  ): Promise<QuickRecommendationResult>;

  // Learning and feedback
  updateWithFeedback(
    sessionId: string,
    agentName: string,
    reward: MCTSReward
  ): Promise<void>;

  // Performance monitoring
  getPerformanceStats(): Promise<PerformanceStats>;

  // Utility functions
  validateContext(context: AgentContext): boolean;
  getConfig(): MCTSConfig;
}

export interface HealthCheckResult {
  bridgeStatus: 'healthy' | 'degraded' | 'unhealthy';
  bridgeVersion: string;
  configValid: boolean;
  timestamp: number;
  engine: {
    status: 'healthy' | 'not_initialized' | 'error';
    nodesInMemory?: number;
    totalSearches?: number;
    cacheEnabled?: boolean;
    message?: string;
  };
  features: {
    thompsonSampling: boolean;
    bayesianLearning: boolean;
    caching: boolean;
    parallelSimulation: boolean;
  };
}

export interface QuickRecommendationResult {
  recommendations: AgentRecommendation[];
  confidence: number;
  searchTimeMs: number;
  nodesExplored: number;
}

export interface PerformanceStats {
  totalIterations: number;
  nodesExplored: number;
  averageDepth: number;
  searchTimeMs: number;
  cacheHits: number;
  cacheMisses: number;
  thompsonSamples: number;
  ucbSelections: number;
  cacheHitRate: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface BridgeError {
  code: string;
  message: string;
  details?: any;
}

// Factory functions for creating test data
export namespace TestHelpers {
  export function createTestContext(task: string, sessionId?: string): AgentContext {
    return {
      task,
      requirements: [],
      constraints: [],
      contextData: {},
      executionContext: {
        sessionId: sessionId || 'test-session',
        timestamp: Date.now(),
        budget: 100,
        priority: 'normal'
      }
    };
  }

  export function createTestConfig(overrides?: Partial<MCTSConfig>): MCTSConfig {
    return {
      maxIterations: 100,
      maxDepth: 10,
      explorationConstant: 1.414,
      discountFactor: 0.9,
      timeLimitMs: 5000,
      enableThompsonSampling: true,
      enableBayesianLearning: true,
      enableCaching: false,
      parallelSimulations: 1,
      ...overrides
    };
  }

  export function createSearchOptions(overrides?: Partial<SearchOptions>): SearchOptions {
    return {
      maxIterations: 100,
      maxDepth: 10,
      timeLimitMs: 5000,
      explorationFactor: 1.414,
      parallelSimulations: 1,
      enableEarlyTermination: true,
      ...overrides
    };
  }

  export function createTestReward(value: number, overrides?: Partial<MCTSReward>): MCTSReward {
    return {
      value: value,
      components: {
        quality: 1.0,
        speed: 1.0,
        cost: 0.5,
        userSatisfaction: 1.0
      },
      metadata: {
        tokensUsed: 0,
        apiCallsMade: 0,
        executionTimeMs: 0,
        agentPerformance: {},
        timestamp: Date.now()
      },
      ...overrides
    };
  }
}
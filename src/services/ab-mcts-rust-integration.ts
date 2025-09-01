/**
 * AB-MCTS Rust Service Integration
 * 
 * Integrates the high-performance AB-MCTS Rust service with the main Universal AI Tools system.
 * Provides seamless bridge between TypeScript orchestration and Rust MCTS algorithms.
 */

import ffi from 'ffi-napi';
import path from 'path';
import { Logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance-monitor';
import { circuitBreaker } from '../utils/circuit-breaker';

const logger = Logger.getInstance().child({ service: 'ab-mcts-rust-integration' });

// Path to compiled Rust library
const RUST_LIB_PATH = path.join(__dirname, '../../rust-services/ab-mcts-service/target/release/libab_mcts_service.so');

// FFI interface definitions
interface ABMCTSRustLibrary {
  ab_mcts_initialize: (config: string) => number;
  ab_mcts_search_optimal_agents: (context: string, agents: string, options: string) => string;
  ab_mcts_recommend_agents: (context: string, agents: string, maxRecommendations: number) => string;
  ab_mcts_update_feedback: (sessionId: string, agentName: string, reward: string) => number;
  ab_mcts_get_performance_stats: () => string;
  ab_mcts_health_check: () => string;
  ab_mcts_free_string: (ptr: string) => void;
  ab_mcts_shutdown: () => number;
  ab_mcts_get_version: () => string;
}

export interface AgentContext {
  task: string;
  requirements: string[];
  constraints: string[];
  contextData: Record<string, any>;
  userPreferences?: {
    preferredAgents?: string[];
    qualityVsSpeed?: number;
    maxCost?: number;
    timeoutMs?: number;
  };
  executionContext: {
    sessionId: string;
    userId?: string;
    timestamp: number;
    budget: number;
    priority: 'Low' | 'Normal' | 'High' | 'Critical';
  };
}

export interface SearchOptions {
  maxIterations?: number;
  maxDepth?: number;
  timeLimitMs?: number;
  explorationConstant?: number;
  discountFactor?: number;
  parallelSimulations?: number;
  checkpointInterval?: number;
  enableCaching?: boolean;
  verboseLogging?: boolean;
}

export interface SearchResult {
  bestPath: Array<{
    id: string;
    agentName: string;
    agentType: string;
    estimatedCost: number;
    estimatedTimeMs: number;
    confidence: number;
  }>;
  confidence: number;
  expectedReward: number;
  searchStatistics: {
    totalIterations: number;
    nodesExplored: number;
    averageDepth: number;
    searchTimeMs: number;
    cacheHits: number;
    cacheMisses: number;
  };
  agentRecommendations: Array<{
    agentName: string;
    agentType: string;
    confidence: number;
    expectedPerformance: number;
    estimatedCost: number;
    rationale: string;
  }>;
  executionPlan: {
    steps: Array<{
      stepNumber: number;
      action: any;
      dependencies: number[];
      parallelExecution: boolean;
      timeoutMs: number;
    }>;
    totalEstimatedTimeMs: number;
    totalEstimatedCost: number;
    riskAssessment: {
      overallRisk: number;
      riskFactors: Array<{
        factorType: string;
        severity: number;
        probability: number;
        description: string;
      }>;
    };
  };
}

export interface RewardFeedback {
  value: number; // 0.0 to 1.0
  components: {
    quality: number;
    speed: number;
    cost: number;
    userSatisfaction?: number;
  };
  metadata: {
    tokensUsed: number;
    apiCallsMade: number;
    executionTimeMs: number;
    agentPerformance: Record<string, number>;
  };
}

/**
 * AB-MCTS Rust Service Integration
 */
export class ABMCTSRustIntegration {
  private library: ABMCTSRustLibrary | null = null;
  private initialized = false;
  private fallbackEnabled = true;

  constructor(private config: {
    enableFallback?: boolean;
    performanceTracking?: boolean;
    circuitBreakerConfig?: {
      failureThreshold?: number;
      resetTimeoutMs?: number;
    };
  } = {}) {
    this.fallbackEnabled = config.enableFallback ?? true;
  }

  /**
   * Initialize the Rust service integration
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing AB-MCTS Rust service integration');

      // Load the Rust library via FFI
      this.library = ffi.Library(RUST_LIB_PATH, {
        ab_mcts_initialize: ['int', ['string']],
        ab_mcts_search_optimal_agents: ['string', ['string', 'string', 'string']],
        ab_mcts_recommend_agents: ['string', ['string', 'string', 'int']],
        ab_mcts_update_feedback: ['int', ['string', 'string', 'string']],
        ab_mcts_get_performance_stats: ['string', []],
        ab_mcts_health_check: ['string', []],
        ab_mcts_free_string: ['void', ['string']],
        ab_mcts_shutdown: ['int', []],
        ab_mcts_get_version: ['string', []],
      });

      // Initialize the Rust service with default configuration
      const config = {
        max_iterations: 1000,
        max_depth: 10,
        exploration_constant: Math.SQRT2,
        discount_factor: 0.95,
        time_limit: 5000,
        enable_thompson_sampling: true,
        enable_bayesian_learning: true,
        enable_caching: true,
        parallel_simulations: 4,
        node_pool_size: 2000,
        checkpoint_interval: 100,
      };

      const result = this.library.ab_mcts_initialize(JSON.stringify(config));
      if (result !== 0) {
        throw new Error('Failed to initialize Rust AB-MCTS service');
      }

      this.initialized = true;
      logger.info('AB-MCTS Rust service integration initialized successfully');

      // Log version information
      const versionPtr = this.library.ab_mcts_get_version();
      const version = JSON.parse(versionPtr);
      logger.info('AB-MCTS Rust service version', version);
      this.library.ab_mcts_free_string(versionPtr);

    } catch (error) {
      logger.error('Failed to initialize AB-MCTS Rust service:', error);
      if (!this.fallbackEnabled) {
        throw error;
      }
      logger.warn('Continuing with TypeScript fallback implementation');
    }
  }

  /**
   * Check if the Rust service is available and healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.initialized || !this.library) {
      return false;
    }

    try {
      const healthPtr = this.library.ab_mcts_health_check();
      const health = JSON.parse(healthPtr);
      this.library.ab_mcts_free_string(healthPtr);
      
      return health.bridgeStatus === 'healthy' && health.engine?.status === 'healthy';
    } catch (error) {
      logger.warn('Health check failed for Rust service:', error);
      return false;
    }
  }

  /**
   * Search for optimal agent orchestration using MCTS
   */
  async searchOptimalAgents(
    context: AgentContext,
    availableAgents: string[],
    options?: SearchOptions
  ): Promise<SearchResult> {
    const startTime = performance.now();

    return circuitBreaker.execute(async () => {
      if (!this.initialized || !this.library) {
        throw new Error('Rust service not initialized');
      }

      const contextJson = JSON.stringify(context);
      const agentsJson = JSON.stringify(availableAgents);
      const optionsJson = options ? JSON.stringify(options) : '';

      const resultPtr = this.library.ab_mcts_search_optimal_agents(
        contextJson,
        agentsJson,
        optionsJson
      );

      if (!resultPtr) {
        throw new Error('Search operation failed');
      }

      const result = JSON.parse(resultPtr) as SearchResult;
      this.library.ab_mcts_free_string(resultPtr);

      const duration = performance.now() - startTime;
      logger.info(`MCTS search completed in ${duration.toFixed(2)}ms with ${result.confidence.toFixed(3)} confidence`);

      if (this.config.performanceTracking) {
        performanceMonitor.recordMetric('ab_mcts_search_duration', duration);
        performanceMonitor.recordMetric('ab_mcts_search_confidence', result.confidence);
        performanceMonitor.recordMetric('ab_mcts_nodes_explored', result.searchStatistics.nodesExplored);
      }

      return result;
    }, 'ab_mcts_search');
  }

  /**
   * Get quick agent recommendations without full search
   */
  async recommendAgents(
    context: AgentContext,
    availableAgents: string[],
    maxRecommendations: number = 3
  ): Promise<{ recommendations: Array<any>; confidence: number; searchTimeMs: number }> {
    const startTime = performance.now();

    return circuitBreaker.execute(async () => {
      if (!this.initialized || !this.library) {
        throw new Error('Rust service not initialized');
      }

      const contextJson = JSON.stringify(context);
      const agentsJson = JSON.stringify(availableAgents);

      const resultPtr = this.library.ab_mcts_recommend_agents(
        contextJson,
        agentsJson,
        maxRecommendations
      );

      if (!resultPtr) {
        throw new Error('Recommendation operation failed');
      }

      const result = JSON.parse(resultPtr);
      this.library.ab_mcts_free_string(resultPtr);

      const duration = performance.now() - startTime;
      logger.debug(`Agent recommendations generated in ${duration.toFixed(2)}ms`);

      if (this.config.performanceTracking) {
        performanceMonitor.recordMetric('ab_mcts_recommend_duration', duration);
        performanceMonitor.recordMetric('ab_mcts_recommend_count', result.recommendations.length);
      }

      return result;
    }, 'ab_mcts_recommend');
  }

  /**
   * Update the service with feedback from executed agents
   */
  async updateWithFeedback(
    sessionId: string,
    agentName: string,
    reward: RewardFeedback
  ): Promise<void> {
    return circuitBreaker.execute(async () => {
      if (!this.initialized || !this.library) {
        throw new Error('Rust service not initialized');
      }

      const rewardJson = JSON.stringify(reward);
      const result = this.library.ab_mcts_update_feedback(sessionId, agentName, rewardJson);

      if (result !== 0) {
        throw new Error('Failed to update feedback');
      }

      logger.debug(`Feedback updated for agent ${agentName} in session ${sessionId}`);
    }, 'ab_mcts_feedback');
  }

  /**
   * Get performance statistics from the Rust service
   */
  async getPerformanceStats(): Promise<any> {
    if (!this.initialized || !this.library) {
      throw new Error('Rust service not initialized');
    }

    const statsPtr = this.library.ab_mcts_get_performance_stats();
    if (!statsPtr) {
      throw new Error('Failed to get performance stats');
    }

    const stats = JSON.parse(statsPtr);
    this.library.ab_mcts_free_string(statsPtr);

    return stats;
  }

  /**
   * Shutdown the Rust service
   */
  async shutdown(): Promise<void> {
    if (this.initialized && this.library) {
      try {
        this.library.ab_mcts_shutdown();
        this.initialized = false;
        logger.info('AB-MCTS Rust service shut down successfully');
      } catch (error) {
        logger.error('Error shutting down Rust service:', error);
      }
    }
  }

  /**
   * Create a test context for development and testing
   */
  static createTestContext(task: string, sessionId: string): AgentContext {
    return {
      task,
      requirements: ['accurate results', 'efficient processing'],
      constraints: ['time limit: 30 seconds', 'memory limit: 512MB'],
      contextData: {
        environment: 'development',
        testFlag: true,
      },
      userPreferences: {
        preferredAgents: [],
        qualityVsSpeed: 0.7,
        maxCost: 100.0,
        timeoutMs: 30000,
      },
      executionContext: {
        sessionId,
        userId: 'test-user',
        timestamp: Date.now(),
        budget: 200.0,
        priority: 'Normal',
      },
    };
  }

  /**
   * Create test search options
   */
  static createTestSearchOptions(overrides?: Partial<SearchOptions>): SearchOptions {
    return {
      maxIterations: 100,
      maxDepth: 5,
      timeLimitMs: 2000,
      explorationConstant: Math.SQRT2,
      discountFactor: 0.9,
      parallelSimulations: 2,
      checkpointInterval: 50,
      enableCaching: false,
      verboseLogging: false,
      ...overrides,
    };
  }
}

// Export singleton instance
export const abMCTSRustService = new ABMCTSRustIntegration({
  enableFallback: true,
  performanceTracking: true,
  circuitBreakerConfig: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  },
});

// Initialize automatically when imported
abMCTSRustService.initialize().catch((error) => {
  logger.error('Failed to auto-initialize AB-MCTS Rust service:', error);
});
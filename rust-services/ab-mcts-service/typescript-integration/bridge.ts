// TypeScript wrapper for AB-MCTS Rust service
// Provides a high-level, type-safe interface for integrating with the Rust AB-MCTS service

import { 
  MCTSConfig, 
  AgentContext, 
  SearchOptions, 
  SearchResult,
  QuickRecommendationResult,
  MCTSReward,
  PerformanceStats,
  HealthCheckResult,
  MCTSBridge as IMCTSBridge,
  BridgeError
} from './types';

// This would be the actual FFI binding to the Rust code
// For now, we define the interface that the Rust bridge should implement
interface RustMCTSBridge {
  new(): RustMCTSBridge;
  initialize(): Promise<void>;
  isReady(): boolean;
  updateConfig(configJson: string): Promise<string>; // Returns error message or empty string
  reset(): Promise<string>;
  healthCheck(): Promise<string>; // Returns JSON string
  generateSessionId(): string;
  searchOptimalAgents(
    contextJson: string, 
    availableAgents: string[], 
    optionsJson?: string
  ): Promise<string>; // Returns JSON result or error
  recommendAgents(
    contextJson: string,
    availableAgents: string[],
    maxRecommendations: number
  ): Promise<string>;
  updateWithFeedback(
    sessionId: string,
    agentName: string,
    rewardJson: string
  ): Promise<string>;
  getPerformanceStats(): Promise<string>;
  validateContext(contextJson: string): boolean;
  getConfig(): string; // Returns JSON config
}

/**
 * TypeScript wrapper for the AB-MCTS Rust service
 * Provides type-safe, Promise-based interface with proper error handling
 */
export class MCTSBridge implements IMCTSBridge {
  private rustBridge: RustMCTSBridge | null = null;
  private initialized = false;

  constructor(private config?: MCTSConfig) {
    // In a real implementation, this would load the Rust binary/WASM module
    // For now, we'll simulate the interface
  }

  /**
   * Initialize the MCTS bridge and underlying Rust engine
   */
  async initialize(): Promise<void> {
    try {
      // Load Rust bridge (this would be the actual FFI binding)
      this.rustBridge = await this.loadRustBridge();
      
      if (this.config) {
        await this.updateConfig(this.config);
      }
      
      await this.rustBridge.initialize();
      this.initialized = true;
      
      console.log('MCTS Bridge initialized successfully');
    } catch (error) {
      throw new BridgeError(
        'INIT_FAILED', 
        `Failed to initialize MCTS bridge: ${error}`,
        error
      );
    }
  }

  /**
   * Check if the bridge is ready for operations
   */
  isReady(): boolean {
    return this.initialized && this.rustBridge?.isReady() === true;
  }

  /**
   * Update the MCTS configuration
   */
  async updateConfig(config: MCTSConfig): Promise<void> {
    this.ensureInitialized();
    
    try {
      const configJson = JSON.stringify(config);
      const result = await this.rustBridge!.updateConfig(configJson);
      
      if (result) {
        throw new Error(result);
      }
      
      this.config = config;
    } catch (error) {
      throw new BridgeError(
        'CONFIG_UPDATE_FAILED',
        `Failed to update configuration: ${error}`,
        error
      );
    }
  }

  /**
   * Reset the MCTS engine state
   */
  async reset(): Promise<void> {
    this.ensureInitialized();
    
    try {
      const result = await this.rustBridge!.reset();
      
      if (result) {
        throw new Error(result);
      }
    } catch (error) {
      throw new BridgeError(
        'RESET_FAILED',
        `Failed to reset MCTS engine: ${error}`,
        error
      );
    }
  }

  /**
   * Perform health check on the bridge and engine
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      if (!this.rustBridge) {
        return {
          bridgeStatus: 'unhealthy',
          bridgeVersion: '1.0.0',
          configValid: false,
          timestamp: Date.now(),
          engine: {
            status: 'not_initialized',
            message: 'Rust bridge not loaded'
          },
          features: {
            thompsonSampling: false,
            bayesianLearning: false,
            caching: false,
            parallelSimulation: false
          }
        };
      }

      const healthJson = await this.rustBridge.healthCheck();
      return JSON.parse(healthJson);
    } catch (error) {
      return {
        bridgeStatus: 'unhealthy',
        bridgeVersion: '1.0.0',
        configValid: false,
        timestamp: Date.now(),
        engine: {
          status: 'error',
          message: `Health check failed: ${error}`
        },
        features: {
          thompsonSampling: false,
          bayesianLearning: false,
          caching: false,
          parallelSimulation: false
        }
      };
    }
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    if (this.rustBridge) {
      return this.rustBridge.generateSessionId();
    }
    
    // Fallback implementation
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Search for optimal agent sequence using MCTS
   */
  async searchOptimalAgents(
    context: AgentContext,
    availableAgents: string[],
    options?: SearchOptions
  ): Promise<SearchResult> {
    this.ensureInitialized();
    
    try {
      const contextJson = JSON.stringify(context);
      const optionsJson = options ? JSON.stringify(options) : undefined;
      
      const resultJson = await this.rustBridge!.searchOptimalAgents(
        contextJson, 
        availableAgents, 
        optionsJson
      );
      
      if (resultJson.startsWith('Error:')) {
        throw new Error(resultJson.substring(6));
      }
      
      return JSON.parse(resultJson);
    } catch (error) {
      throw new BridgeError(
        'SEARCH_FAILED',
        `MCTS search failed: ${error}`,
        { context, availableAgents, options, error }
      );
    }
  }

  /**
   * Get quick agent recommendations (lightweight search)
   */
  async recommendAgents(
    context: AgentContext,
    availableAgents: string[],
    maxRecommendations: number = 3
  ): Promise<QuickRecommendationResult> {
    this.ensureInitialized();
    
    try {
      const contextJson = JSON.stringify(context);
      
      const resultJson = await this.rustBridge!.recommendAgents(
        contextJson,
        availableAgents,
        maxRecommendations
      );
      
      if (resultJson.startsWith('Error:')) {
        throw new Error(resultJson.substring(6));
      }
      
      return JSON.parse(resultJson);
    } catch (error) {
      throw new BridgeError(
        'RECOMMENDATION_FAILED',
        `Agent recommendation failed: ${error}`,
        { context, availableAgents, maxRecommendations, error }
      );
    }
  }

  /**
   * Update the engine with execution feedback for learning
   */
  async updateWithFeedback(
    sessionId: string,
    agentName: string,
    reward: MCTSReward
  ): Promise<void> {
    this.ensureInitialized();
    
    try {
      const rewardJson = JSON.stringify(reward);
      
      const result = await this.rustBridge!.updateWithFeedback(
        sessionId,
        agentName,
        rewardJson
      );
      
      if (result) {
        throw new Error(result);
      }
    } catch (error) {
      throw new BridgeError(
        'FEEDBACK_UPDATE_FAILED',
        `Failed to update with feedback: ${error}`,
        { sessionId, agentName, reward, error }
      );
    }
  }

  /**
   * Get performance statistics from the engine
   */
  async getPerformanceStats(): Promise<PerformanceStats> {
    this.ensureInitialized();
    
    try {
      const statsJson = await this.rustBridge!.getPerformanceStats();
      
      if (statsJson.startsWith('Error:')) {
        throw new Error(statsJson.substring(6));
      }
      
      return JSON.parse(statsJson);
    } catch (error) {
      throw new BridgeError(
        'STATS_RETRIEVAL_FAILED',
        `Failed to retrieve performance stats: ${error}`,
        error
      );
    }
  }

  /**
   * Validate agent context structure
   */
  validateContext(context: AgentContext): boolean {
    if (this.rustBridge) {
      try {
        const contextJson = JSON.stringify(context);
        return this.rustBridge.validateContext(contextJson);
      } catch {
        return false;
      }
    }
    
    // Fallback validation
    return !!(
      context.task && 
      context.task.trim().length > 0 &&
      context.executionContext?.sessionId &&
      context.executionContext.sessionId.trim().length > 0
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): MCTSConfig {
    if (this.rustBridge) {
      try {
        const configJson = this.rustBridge.getConfig();
        return JSON.parse(configJson);
      } catch {
        // Fallback to stored config
      }
    }
    
    return this.config || this.getDefaultConfig();
  }

  /**
   * Create a test context for development/testing
   */
  static createTestContext(task: string, sessionId?: string): AgentContext {
    return {
      task,
      requirements: ['test_requirement'],
      constraints: [],
      contextData: {},
      executionContext: {
        sessionId: sessionId || `test_session_${Date.now()}`,
        userId: 'test_user',
        timestamp: Date.now(),
        budget: 100.0,
        priority: 'normal'
      }
    };
  }

  // Private helper methods
  
  private ensureInitialized(): void {
    if (!this.isReady()) {
      throw new BridgeError(
        'NOT_INITIALIZED',
        'MCTS bridge not initialized. Call initialize() first.',
        { initialized: this.initialized, rustBridge: !!this.rustBridge }
      );
    }
  }

  private async loadRustBridge(): Promise<RustMCTSBridge> {
    // In a real implementation, this would load the Rust binary or WASM module
    // This could be done via:
    // 1. Node.js FFI (using node-ffi or similar)
    // 2. WASM module loading
    // 3. Subprocess communication
    // 4. HTTP API calls to a Rust service
    
    throw new Error('Rust bridge loading not implemented. This is a placeholder for the actual FFI integration.');
  }

  private getDefaultConfig(): MCTSConfig {
    return {
      maxIterations: 1000,
      maxDepth: 10,
      explorationConstant: 1.414,
      discountFactor: 0.95,
      timeLimitMs: 10000,
      enableThompsonSampling: true,
      enableBayesianLearning: true,
      enableCaching: false,
      parallelSimulations: 4
    };
  }
}

/**
 * Custom error class for MCTS Bridge operations
 */
export class BridgeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'BridgeError';
  }
}

/**
 * Factory function to create and initialize an MCTS bridge
 */
export async function createMCTSBridge(config?: MCTSConfig): Promise<MCTSBridge> {
  const bridge = new MCTSBridge(config);
  await bridge.initialize();
  return bridge;
}

/**
 * Helper functions for creating test data
 */
export const TestHelpers = {
  createTestContext: MCTSBridge.createTestContext,
  
  createTestConfig(overrides: Partial<MCTSConfig> = {}): MCTSConfig {
    const defaults = {
      maxIterations: 100,
      maxDepth: 5,
      explorationConstant: 1.0,
      discountFactor: 0.9,
      timeLimitMs: 5000,
      enableThompsonSampling: true,
      enableBayesianLearning: false,
      enableCaching: false,
      parallelSimulations: 2
    };
    
    return { ...defaults, ...overrides };
  },

  createSearchOptions(overrides: Partial<SearchOptions> = {}): SearchOptions {
    const defaults = {
      maxIterations: 50,
      maxDepth: 3,
      timeLimitMs: 2000,
      explorationFactor: 0.5,
      parallelSimulations: 1,
      enableEarlyTermination: true
    };
    
    return { ...defaults, ...overrides };
  },

  createTestReward(value: number, overrides: Partial<MCTSReward> = {}): MCTSReward {
    const defaults = {
      value,
      components: {
        quality: 0.8,
        speed: 0.7,
        cost: 0.6
      },
      metadata: {
        tokensUsed: 100,
        apiCallsMade: 2,
        executionTimeMs: 1500,
        agentPerformance: {},
        timestamp: Date.now()
      }
    };
    
    return { ...defaults, ...overrides };
  }
};
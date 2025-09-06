/**
 * HTTP Bridge for AB-MCTS Rust Service
 * Replaces FFI with HTTP calls for Docker compatibility
 */

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
} from './types';

export class HttpMCTSBridge implements IMCTSBridge {
  private baseUrl: string;
  private initialized = false;
  private headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  constructor(
    baseUrl: string = process.env.AB_MCTS_URL || 'http://localhost:8082',
    private config?: MCTSConfig
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    console.log(`AB-MCTS HTTP Bridge initialized with URL: ${this.baseUrl}`);
  }

  /**
   * Initialize the MCTS bridge
   */
  async initialize(): Promise<void> {
    try {
      if (this.config) {
        const response = await fetch(`${this.baseUrl}/api/v1/initialize`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(this.config),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Initialization failed: ${error}`);
        }
      }

      // Verify connection with health check
      const health = await this.healthCheck();
      if (health.bridgeStatus !== 'healthy') {
        throw new Error('Service is not healthy');
      }

      this.initialized = true;
      console.log('AB-MCTS HTTP Bridge initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize AB-MCTS bridge: ${error}`);
    }
  }

  /**
   * Check if the bridge is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Update the MCTS configuration
   */
  async updateConfig(config: MCTSConfig): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/initialize`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update config: ${error}`);
    }

    this.config = config;
  }

  /**
   * Reset the MCTS engine
   */
  async reset(): Promise<void> {
    // Re-initialize with current config
    await this.updateConfig(this.config || this.getDefaultConfig());
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/health`, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const data = await response.json();
      
      return {
        bridgeStatus: data.status === 'healthy' ? 'healthy' : 'unhealthy',
        bridgeVersion: data.version || '1.0.0',
        configValid: true,
        timestamp: Date.now(),
        engine: {
          status: data.status === 'healthy' ? 'healthy' : 'error',
          message: data.status,
        },
        features: data.features || {
          thompsonSampling: false,
          bayesianLearning: false,
          caching: false,
          parallelSimulation: false,
        },
      };
    } catch (error) {
      return {
        bridgeStatus: 'unhealthy',
        bridgeVersion: '1.0.0',
        configValid: false,
        timestamp: Date.now(),
        engine: {
          status: 'error',
          message: `Health check failed: ${error}`,
        },
        features: {
          thompsonSampling: false,
          bayesianLearning: false,
          caching: false,
          parallelSimulation: false,
        },
      };
    }
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
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

    const response = await fetch(`${this.baseUrl}/api/v1/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        context,
        available_agents: availableAgents,
        options,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MCTS search failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get quick agent recommendations
   */
  async recommendAgents(
    context: AgentContext,
    availableAgents: string[],
    maxRecommendations: number = 3
  ): Promise<QuickRecommendationResult> {
    this.ensureInitialized();

    const response = await fetch(`${this.baseUrl}/api/v1/recommend`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        context,
        available_agents: availableAgents,
        max_recommendations: maxRecommendations,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Agent recommendation failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Update with feedback for learning
   */
  async updateWithFeedback(
    sessionId: string,
    agentName: string,
    reward: MCTSReward
  ): Promise<void> {
    this.ensureInitialized();

    const response = await fetch(`${this.baseUrl}/api/v1/feedback`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        session_id: sessionId,
        agent_name: agentName,
        reward,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Feedback update failed: ${error}`);
    }
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats(): Promise<PerformanceStats> {
    const response = await fetch(`${this.baseUrl}/metrics`, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' },
    });

    if (!response.ok) {
      throw new Error(`Failed to get performance stats: ${response.statusText}`);
    }

    const metricsText = await response.text();
    
    // Parse Prometheus metrics format
    // This is a simplified parser - in production, use a proper Prometheus parser
    return {
      totalIterations: this.parseMetric(metricsText, 'ab_mcts_iterations_total') || 0,
      totalSearches: this.parseMetric(metricsText, 'ab_mcts_searches_total'),
      nodesExplored: this.parseMetric(metricsText, 'ab_mcts_nodes_explored_total') || 0,
      averageDepth: this.parseMetric(metricsText, 'ab_mcts_average_depth') || 0,
      searchTimeMs: this.parseMetric(metricsText, 'ab_mcts_search_time_ms') || 0,
      cacheHits: this.parseMetric(metricsText, 'ab_mcts_cache_hits_total') || 0,
      cacheMisses: this.parseMetric(metricsText, 'ab_mcts_cache_misses_total') || 0,
      thompsonSamples: this.parseMetric(metricsText, 'ab_mcts_thompson_samples_total') || 0,
      ucbSelections: this.parseMetric(metricsText, 'ab_mcts_ucb_selections_total') || 0,
      cacheHitRate: 0, // Calculated from hits/misses
    };
  }

  /**
   * Validate context structure
   */
  validateContext(context: AgentContext): boolean {
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
    return this.config || this.getDefaultConfig();
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AB-MCTS bridge not initialized. Call initialize() first.');
    }
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
      parallelSimulations: 4,
    };
  }

  private parseMetric(metricsText: string, metricName: string): number {
    const regex = new RegExp(`${metricName}\\s+(\\d+(?:\\.\\d+)?)`);
    const match = metricsText.match(regex);
    return match && match[1] ? parseFloat(match[1]) : 0;
  }
}

/**
 * Factory function to create and initialize an HTTP MCTS bridge
 */
export async function createHttpMCTSBridge(
  baseUrl?: string,
  config?: MCTSConfig
): Promise<HttpMCTSBridge> {
  const bridge = new HttpMCTSBridge(baseUrl, config);
  await bridge.initialize();
  return bridge;
}

/**
 * Integration with existing code - replace FFI bridge
 */
export class MCTSBridge extends HttpMCTSBridge {
  constructor(config?: MCTSConfig) {
    // Use environment variable or default URL
    const baseUrl = process.env.AB_MCTS_SERVICE_URL || 
                   process.env.AB_MCTS_URL || 
                   'http://ab-mcts-rust:8082';
    
    super(baseUrl, config);
    
    console.log('MCTSBridge using HTTP backend at:', baseUrl);
  }

  /**
   * Static method for backward compatibility
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
        priority: 'normal',
      },
    };
  }
}

// Export for backward compatibility
export { createHttpMCTSBridge as createMCTSBridge };
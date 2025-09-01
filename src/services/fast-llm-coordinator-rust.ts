import { spawn } from 'child_process';
import path from 'path';
import { CoordinationContext, FastRoutingDecision } from './fast-llm-coordinator';

interface RustCoordinatorConfig {
  enabled: boolean;
  buildPath?: string;
  fallbackToTypeScript: boolean;
  benchmarkMode?: boolean;
}

interface RustCoordinationContext {
  task_type: string;
  complexity: string;
  urgency: string;
  expected_response_length: string;
  requires_creativity: boolean;
  requires_accuracy: boolean;
  timestamp?: number;
}

interface RustExecutionResult {
  content: string;
  model: string;
  provider: string;
  tokens_used: number;
  execution_time: number;
  confidence: number;
  metadata: string; // JSON string
}

interface RustCoordinatedResult {
  response: RustExecutionResult;
  metadata: {
    routing_decision: string; // JSON string
    execution_time: number;
    tokens_used: number;
    service_used: string;
    was_load_balanced: boolean;
    confidence: number;
    performance_ratio?: number;
  };
}

interface RustPerformanceMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time: number;
  fastest_response_time: number;
  slowest_response_time: number;
  requests_per_second: number;
  error_rate: number;
  service_metrics: string; // JSON string
  routing_metrics: string; // JSON string
  load_balancing_metrics: string; // JSON string
  timestamp: number;
}

/**
 * TypeScript wrapper for Rust-based Fast LLM Coordinator
 * Provides seamless integration with existing TypeScript codebase while
 * leveraging Rust performance for routing decisions and load balancing.
 */
export class FastLLMCoordinatorRust {
  private rustModule: any = null;
  private config: RustCoordinatorConfig;
  private initialized = false;
  private fallbackCoordinator?: any;

  constructor(config: Partial<RustCoordinatorConfig> = {}) {
    this.config = {
      enabled: process.env.ENABLE_RUST_COORDINATOR !== 'false',
      buildPath: config.buildPath || path.join(process.cwd(), 'crates', 'fast-llm-coordinator'),
      fallbackToTypeScript: config.fallbackToTypeScript ?? true,
      benchmarkMode: config.benchmarkMode ?? false,
      ...config,
    };

    if (this.config.benchmarkMode) {
      console.log('🦀 Fast LLM Coordinator Rust: Benchmark mode enabled');
    }
  }

  /**
   * Initialize the Rust coordinator with optional load balancing strategy
   */
  async initialize(strategy?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.config.enabled) {
      console.log('🦀 Fast LLM Coordinator Rust: Disabled via configuration');
      await this.initializeFallback();
      return;
    }

    try {
      // Try to load the compiled Rust module
      const modulePath = path.join(this.config.buildPath!, 'target', 'release', 'fast_llm_coordinator.node');
      
      try {
        this.rustModule = require(modulePath);
        await this.rustModule.initializeCoordinator(strategy);
        this.initialized = true;
        
        console.log(`🦀 Fast LLM Coordinator Rust: Initialized successfully with strategy: ${strategy || 'hybrid'}`);
        
        if (this.config.benchmarkMode) {
          await this.runBenchmark();
        }
        
        return;
      } catch (moduleError) {
        console.log('🦀 Fast LLM Coordinator Rust: Compiled module not found, attempting to build...');
        
        // Build the Rust module
        await this.buildRustModule();
        
        // Try loading again
        this.rustModule = require(modulePath);
        await this.rustModule.initializeCoordinator(strategy);
        this.initialized = true;
        
        console.log(`🦀 Fast LLM Coordinator Rust: Built and initialized with strategy: ${strategy || 'hybrid'}`);
        
        if (this.config.benchmarkMode) {
          await this.runBenchmark();
        }
      }
    } catch (error) {
      console.error('🦀 Fast LLM Coordinator Rust: Initialization failed:', error);
      
      if (this.config.fallbackToTypeScript) {
        console.log('🦀 Fast LLM Coordinator Rust: Falling back to TypeScript implementation');
        await this.initializeFallback();
      } else {
        throw new Error(`Failed to initialize Rust Fast LLM Coordinator: ${error}`);
      }
    }
  }

  /**
   * Initialize TypeScript fallback coordinator
   */
  private async initializeFallback(): Promise<void> {
    try {
      const { FastLLMCoordinator } = await import('./fast-llm-coordinator');
      this.fallbackCoordinator = new FastLLMCoordinator();
      this.initialized = true;
      console.log('🦀 Fast LLM Coordinator: Using TypeScript fallback');
    } catch (error) {
      throw new Error(`Failed to initialize TypeScript fallback: ${error}`);
    }
  }

  /**
   * Build the Rust module using Cargo
   */
  private async buildRustModule(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🦀 Fast LLM Coordinator Rust: Building module...');
      
      const buildProcess = spawn('cargo', ['build', '--release'], {
        cwd: this.config.buildPath,
        stdio: this.config.benchmarkMode ? 'inherit' : 'pipe',
      });

      let stderr = '';

      if (!this.config.benchmarkMode) {
        buildProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('🦀 Fast LLM Coordinator Rust: Build completed successfully');
          resolve();
        } else {
          console.error('🦀 Fast LLM Coordinator Rust: Build failed');
          if (stderr) console.error(stderr);
          reject(new Error(`Rust build failed with code ${code}`));
        }
      });

      buildProcess.on('error', (error) => {
        reject(new Error(`Failed to start Rust build: ${error.message}`));
      });
    });
  }

  /**
   * Make a routing decision for the given request
   */
  async makeRoutingDecision(
    userRequest: string,
    context: CoordinationContext
  ): Promise<FastRoutingDecision> {
    await this.ensureInitialized();

    if (this.rustModule) {
      try {
        const rustContext: RustCoordinationContext = {
          task_type: context.taskType || 'general',
          complexity: context.complexity || 'medium',
          urgency: this.mapUrgencyToString(context.urgency),
          expected_response_length: this.mapResponseLengthToString(context.expectedResponseLength),
          requires_creativity: context.requiresCreativity || false,
          requires_accuracy: context.requiresAccuracy || true,
          timestamp: Date.now() / 1000,
        };

        const decisionJson = await this.rustModule.makeRoutingDecision(userRequest, rustContext);
        const decision = JSON.parse(decisionJson);

        return {
          targetService: decision.target_service,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
          complexity: decision.complexity,
          priority: decision.priority || 5,
          routingTimeMs: decision.routing_time_ms,
          alternativeServices: decision.alternative_services || [],
        };
      } catch (error) {
        console.warn('🦀 Fast LLM Coordinator Rust: Routing decision failed, falling back:', error);
        if (this.config.fallbackToTypeScript && this.fallbackCoordinator) {
          return this.fallbackCoordinator.makeRoutingDecision(userRequest, context);
        }
        throw error;
      }
    }

    if (this.fallbackCoordinator) {
      return this.fallbackCoordinator.makeRoutingDecision(userRequest, context);
    }

    throw new Error('No coordinator available (neither Rust nor TypeScript)');
  }

  /**
   * Execute a request with full coordination
   */
  async executeWithCoordination(
    userRequest: string,
    context: CoordinationContext
  ): Promise<{
    response: any;
    metadata: {
      routingDecision: FastRoutingDecision;
      executionTimeMs: number;
      tokensUsed: number;
      serviceUsed: string;
      wasLoadBalanced: boolean;
      confidence: number;
      performanceRatio?: number;
    };
  }> {
    await this.ensureInitialized();

    if (this.rustModule) {
      try {
        const rustContext: RustCoordinationContext = {
          task_type: context.taskType || 'general',
          complexity: context.complexity || 'medium',
          urgency: this.mapUrgencyToString(context.urgency),
          expected_response_length: this.mapResponseLengthToString(context.expectedResponseLength),
          requires_creativity: context.requiresCreativity || false,
          requires_accuracy: context.requiresAccuracy || true,
          timestamp: Date.now() / 1000,
        };

        const result: RustCoordinatedResult = await this.rustModule.executeWithCoordination(
          userRequest,
          rustContext
        );

        const routingDecision = JSON.parse(result.metadata.routing_decision);
        const responseMetadata = JSON.parse(result.response.metadata);

        return {
          response: {
            content: result.response.content,
            model: result.response.model,
            provider: result.response.provider,
            tokensUsed: result.response.tokens_used,
            executionTime: result.response.execution_time,
            confidence: result.response.confidence,
            metadata: responseMetadata,
          },
          metadata: {
            routingDecision: {
              targetService: routingDecision.target_service,
              confidence: routingDecision.confidence,
              reasoning: routingDecision.reasoning,
              complexity: routingDecision.complexity,
              priority: routingDecision.priority || 5,
              routingTimeMs: routingDecision.routing_time_ms,
              alternativeServices: routingDecision.alternative_services || [],
            },
            executionTimeMs: result.metadata.execution_time,
            tokensUsed: result.metadata.tokens_used,
            serviceUsed: result.metadata.service_used,
            wasLoadBalanced: result.metadata.was_load_balanced,
            confidence: result.metadata.confidence,
            performanceRatio: result.metadata.performance_ratio,
          },
        };
      } catch (error) {
        console.warn('🦀 Fast LLM Coordinator Rust: Execution failed, falling back:', error);
        if (this.config.fallbackToTypeScript && this.fallbackCoordinator) {
          return this.fallbackCoordinator.executeWithCoordination(userRequest, context);
        }
        throw error;
      }
    }

    if (this.fallbackCoordinator) {
      return this.fallbackCoordinator.executeWithCoordination(userRequest, context);
    }

    throw new Error('No coordinator available (neither Rust nor TypeScript)');
  }

  /**
   * Coordinate multiple agents for complex tasks
   */
  async coordinateMultipleAgents(
    primaryTask: string,
    supportingTasks: string[]
  ): Promise<{
    primary: any;
    supporting: any[];
    coordination: {
      totalTime: number;
      fastDecisions: number;
      servicesUsed: string[];
      loadBalancingEffectiveness: number;
      totalTokens: number;
    };
  }> {
    await this.ensureInitialized();

    if (this.rustModule) {
      try {
        const result = await this.rustModule.coordinateMultipleAgents(primaryTask, supportingTasks);
        const coordination = JSON.parse(result.coordination);

        return {
          primary: {
            content: result.primary.content,
            model: result.primary.model,
            provider: result.primary.provider,
            tokensUsed: result.primary.tokens_used,
            executionTime: result.primary.execution_time,
            confidence: result.primary.confidence,
            metadata: JSON.parse(result.primary.metadata),
          },
          supporting: result.supporting.map((support: RustExecutionResult) => ({
            content: support.content,
            model: support.model,
            provider: support.provider,
            tokensUsed: support.tokens_used,
            executionTime: support.execution_time,
            confidence: support.confidence,
            metadata: JSON.parse(support.metadata),
          })),
          coordination: {
            totalTime: coordination.total_time,
            fastDecisions: coordination.fast_decisions,
            servicesUsed: coordination.services_used,
            loadBalancingEffectiveness: coordination.load_balancing_effectiveness,
            totalTokens: coordination.total_tokens,
          },
        };
      } catch (error) {
        console.warn('🦀 Fast LLM Coordinator Rust: Multi-agent coordination failed, falling back:', error);
        if (this.config.fallbackToTypeScript && this.fallbackCoordinator) {
          return this.fallbackCoordinator.coordinateMultipleAgents(primaryTask, supportingTasks);
        }
        throw error;
      }
    }

    if (this.fallbackCoordinator) {
      return this.fallbackCoordinator.coordinateMultipleAgents(primaryTask, supportingTasks);
    }

    throw new Error('No coordinator available (neither Rust nor TypeScript)');
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<any> {
    await this.ensureInitialized();

    if (this.rustModule) {
      try {
        const status = await this.rustModule.getSystemStatus();
        return {
          fastModels: JSON.parse(status.fast_models),
          services: JSON.parse(status.services),
          performance: JSON.parse(status.performance),
          loadBalancing: JSON.parse(status.load_balancing),
          resourceMetrics: JSON.parse(status.resource_metrics),
          implementation: 'rust',
        };
      } catch (error) {
        console.warn('🦀 Fast LLM Coordinator Rust: System status failed, falling back:', error);
        if (this.config.fallbackToTypeScript && this.fallbackCoordinator) {
          const fallbackStatus = await this.fallbackCoordinator.getSystemStatus();
          return { ...fallbackStatus, implementation: 'typescript_fallback' };
        }
        throw error;
      }
    }

    if (this.fallbackCoordinator) {
      const fallbackStatus = await this.fallbackCoordinator.getSystemStatus();
      return { ...fallbackStatus, implementation: 'typescript' };
    }

    throw new Error('No coordinator available (neither Rust nor TypeScript)');
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    await this.ensureInitialized();

    if (this.rustModule) {
      try {
        const metrics: RustPerformanceMetrics = this.rustModule.getPerformanceMetrics();
        return {
          totalRequests: metrics.total_requests,
          successfulRequests: metrics.successful_requests,
          failedRequests: metrics.failed_requests,
          averageResponseTime: metrics.average_response_time,
          fastestResponseTime: metrics.fastest_response_time,
          slowestResponseTime: metrics.slowest_response_time,
          requestsPerSecond: metrics.requests_per_second,
          errorRate: metrics.error_rate,
          serviceMetrics: JSON.parse(metrics.service_metrics),
          routingMetrics: JSON.parse(metrics.routing_metrics),
          loadBalancingMetrics: JSON.parse(metrics.load_balancing_metrics),
          timestamp: metrics.timestamp,
          implementation: 'rust',
        };
      } catch (error) {
        console.warn('🦀 Fast LLM Coordinator Rust: Performance metrics failed, falling back:', error);
        if (this.config.fallbackToTypeScript && this.fallbackCoordinator) {
          const fallbackMetrics = await this.fallbackCoordinator.getPerformanceMetrics();
          return { ...fallbackMetrics, implementation: 'typescript_fallback' };
        }
        throw error;
      }
    }

    if (this.fallbackCoordinator) {
      const fallbackMetrics = await this.fallbackCoordinator.getPerformanceMetrics();
      return { ...fallbackMetrics, implementation: 'typescript' };
    }

    throw new Error('No coordinator available (neither Rust nor TypeScript)');
  }

  /**
   * Get service performance comparison
   */
  async getServicePerformanceComparison(): Promise<any> {
    await this.ensureInitialized();

    if (this.rustModule) {
      try {
        const comparison = this.rustModule.getServicePerformanceComparison();
        return JSON.parse(comparison);
      } catch (error) {
        console.warn('🦀 Fast LLM Coordinator Rust: Service comparison failed, falling back:', error);
        if (this.config.fallbackToTypeScript && this.fallbackCoordinator) {
          return this.fallbackCoordinator.getServicePerformanceComparison();
        }
        throw error;
      }
    }

    if (this.fallbackCoordinator) {
      return this.fallbackCoordinator.getServicePerformanceComparison();
    }

    throw new Error('No coordinator available (neither Rust nor TypeScript)');
  }

  /**
   * Quick health check
   */
  async healthCheck(): Promise<{ status: string; healthy_services: number; total_services: number; timestamp: string; implementation: string }> {
    await this.ensureInitialized();

    if (this.rustModule) {
      try {
        const healthJson = await this.rustModule.healthCheck();
        const health = JSON.parse(healthJson);
        return { ...health, implementation: 'rust' };
      } catch (error) {
        console.warn('🦀 Fast LLM Coordinator Rust: Health check failed, falling back:', error);
        if (this.config.fallbackToTypeScript && this.fallbackCoordinator) {
          const fallbackHealth = await this.fallbackCoordinator.healthCheck();
          return { ...fallbackHealth, implementation: 'typescript_fallback' };
        }
        throw error;
      }
    }

    if (this.fallbackCoordinator) {
      const fallbackHealth = await this.fallbackCoordinator.healthCheck();
      return { ...fallbackHealth, implementation: 'typescript' };
    }

    throw new Error('No coordinator available (neither Rust nor TypeScript)');
  }

  /**
   * Run benchmark to demonstrate performance improvements
   */
  async runBenchmark(): Promise<void> {
    if (!this.rustModule) {
      console.log('🦀 Fast LLM Coordinator Rust: Skipping benchmark (Rust module not available)');
      return;
    }

    try {
      console.log('🦀 Fast LLM Coordinator Rust: Running performance benchmark...');
      
      // Run the Rust benchmark example
      const benchmarkProcess = spawn('cargo', ['run', '--release', '--example', 'coordinator_benchmark'], {
        cwd: this.config.buildPath,
        stdio: 'inherit',
      });

      return new Promise((resolve, reject) => {
        benchmarkProcess.on('close', (code) => {
          if (code === 0) {
            console.log('🦀 Fast LLM Coordinator Rust: Benchmark completed successfully');
            resolve();
          } else {
            console.error('🦀 Fast LLM Coordinator Rust: Benchmark failed');
            reject(new Error(`Benchmark failed with code ${code}`));
          }
        });

        benchmarkProcess.on('error', (error) => {
          reject(new Error(`Failed to start benchmark: ${error.message}`));
        });
      });
    } catch (error) {
      console.error('🦀 Fast LLM Coordinator Rust: Benchmark error:', error);
    }
  }

  /**
   * Ensure the coordinator is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Map TypeScript urgency to Rust string format
   */
  private mapUrgencyToString(urgency?: any): string {
    if (typeof urgency === 'string') return urgency.toLowerCase();
    if (typeof urgency === 'object' && urgency?.level) return urgency.level.toLowerCase();
    return 'medium';
  }

  /**
   * Map TypeScript response length to Rust string format
   */
  private mapResponseLengthToString(responseLength?: any): string {
    if (typeof responseLength === 'string') return responseLength.toLowerCase();
    if (typeof responseLength === 'object' && responseLength?.length) return responseLength.length.toLowerCase();
    return 'medium';
  }

  /**
   * Get current implementation type
   */
  get implementationType(): string {
    return this.rustModule ? 'rust' : this.fallbackCoordinator ? 'typescript' : 'none';
  }

  /**
   * Check if Rust implementation is available
   */
  get isRustAvailable(): boolean {
    return this.rustModule !== null;
  }

  /**
   * Get configuration
   */
  get configuration(): RustCoordinatorConfig {
    return { ...this.config };
  }
}

// Export singleton instance for easy use
export const fastLLMCoordinatorRust = new FastLLMCoordinatorRust({
  benchmarkMode: process.env.NODE_ENV === 'development',
});

// Default export
export default FastLLMCoordinatorRust;
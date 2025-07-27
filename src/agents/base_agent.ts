/**
 * Base Agent Framework for Universal AI Tools
 * Adapted from the sophisticated trading platform agent architecture
 */

import { EventEmitter } from 'events';

const GOOD_CONFIDENCE = 0.7;
const MODERATE_CONFIDENCE = 0.6;

export interface AgentCapability {
  name: string;
  description: string;
  inputSchema: object;
  outputSchema: object;
}

export interface AgentMetrics {
  totalRequests: number;
  successfulRequests: number;
  averageLatencyMs: number;
  lastExecuted?: Date;
  performanceScore: number;
}

export interface AgentConfig {
  name: string;
  description: string;
  priority: number; // 1-10, higher is more important
  capabilities: AgentCapability[];
  maxLatencyMs: number;
  retryAttempts: number;
  dependencies: string[];
  memoryEnabled: boolean;
  category?: string;
  memoryConfig?: Record<string, unknown>;
}

export interface AgentContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  userRequest: string;
  previousContext?: Record<string, unknown>;
  systemState?: Record<string, unknown>;
  timestamp: Date;
  memoryContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse<T = unknown> {
  success: boolean;
  data: T;
  reasoning: string;
  confidence: number; // 0.0 - 1.0
  latencyMs: number;
  agentId: string;
  error?: string;
  nextActions?: string[];
  memoryUpdates?: Record<string, unknown>[];
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface PartialAgentResponse<T = unknown> {
  success: boolean;
  data: T;
  reasoning: string;
  confidence: number; // 0.0 - 1.0
  error?: string;
  nextActions?: string[];
  memoryUpdates?: Record<string, unknown>[];
  message?: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseAgent extends EventEmitter {
  public config: AgentConfig;
  protected metrics: AgentMetrics;
  protected isInitialized = false;
  protected memoryCoordinator?: unknown;
  protected logger: unknown;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.logger = console; // Initialize with fallback
    this.setupLogger();
    this.setupEventListeners();
  }

  private async setupLogger(): Promise<void> {
    try {
      const { logger } = await import('../utils/logger.js');
      this.logger = logger;
    } catch (error) {
      this.logger = console; // Fallback to console
    }
  }

  private initializeMetrics(): AgentMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      averageLatencyMs: 0,
      performanceScore: 1.0,
    };
  }

  private setupEventListeners(): void {
    this.on('request_started', this.onRequestStarted.bind(this));
    this.on('request_completed', this.onRequestCompleted.bind(this));
    this.on('request_failed', this.onRequestFailed.bind(this));
  }

  /**
   * Initialize the agent with dependencies and memory systems
   */
  async initialize(memoryCoordinator?: unknown): Promise<void> {
    try {
      this.memoryCoordinator = memoryCoordinator;

      // Load agent-specific memory if enabled
      if (this.config.memoryEnabled && this.memoryCoordinator) {
        await this.loadMemory();
      }

      // Perform agent-specific initialization
      await this.onInitialize();

      this.isInitialized = true;
      this.logger.info(`✅ Agent ${this.config.name} initialized successfully`);
    } catch (error) {
      this.logger.error(`❌ Failed to initialize agent ${this.config.name}:`, error);
      throw error;
    }
  }

  /**
   * Main execution method - processes requests and returns responses
   */
  async execute(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    const { requestId } = context;

    this.emit('request_started', { agentId: this.config.name, requestId, context });

    try {
      // Validate agent is initialized
      if (!this.isInitialized) {
        throw new Error(`Agent ${this.config.name} not initialized`);
      }

      // Update metrics
      this.metrics.totalRequests++;

      // Retrieve relevant memory if enabled
      let memoryContext = null;
      if (this.config.memoryEnabled && this.memoryCoordinator) {
        memoryContext = await this.retrieveMemory(context);
      }

      // Execute agent-specific logic with timeout protection
      const result = await this.processWithTimeout({
        ...context,
        memoryContext,
      });

      // Store results in memory if enabled
      if (this.config.memoryEnabled && this.memoryCoordinator && result.success) {
        await this.storeMemory(context, result);
      }

      // Calculate latency
      const latencyMs = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(latencyMs, true);

      // Check latency target
      if (latencyMs > this.config.maxLatencyMs) {
        this.logger.warn(
          `⚠️ Agent ${this.config.name} exceeded latency target: ${latencyMs}ms > ${this.config.maxLatencyMs}ms`
        );
      }

      const response: AgentResponse = {
        ...result,
        latencyMs,
        agentId: this.config.name,
      };

      this.emit('request_completed', { agentId: this.config.name, requestId, response });
      return response;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.updateMetrics(latencyMs, false);

      const errorResponse: AgentResponse = {
        success: false,
        data: null,
        reasoning: `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
        confidence: 0,
        latencyMs,
        agentId: this.config.name,
        error: error instanceof Error ? error.message : String(error),
      };

      this.emit('request_failed', { agentId: this.config.name, requestId, error: errorResponse });
      return errorResponse;
    }
  }

  private async processWithTimeout(
    context: AgentContext & { memoryContext?: unknown }
  ): Promise<PartialAgentResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Agent execution timeout after ${this.config.maxLatencyMs}ms`));
      }, this.config.maxLatencyMs);

      this.process(context)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get current agent status and metrics
   */
  getStatus(): unknown {
    return {
      name: this.config.name,
      isInitialized: this.isInitialized,
      metrics: { ...this.metrics },
      config: {
        priority: this.config.priority,
        capabilities: this.config.capabilities.map((c) => c.name),
        dependencies: this.config.dependencies,
      },
      healthScore: this.calculateHealthScore(),
    };
  }

  /**
   * Gracefully shutdown the agent
   */
  async shutdown(): Promise<void> {
    try {
      await this.onShutdown();
      this.removeAllListeners();
      this.isInitialized = false;
      this.logger.info(`✅ Agent ${this.config.name} shutdown complete`);
    } catch (error) {
      this.logger.error(`❌ Error during agent shutdown:`, error);
    }
  }

  // Abstract methods to be implemented by specific agents
  protected abstract onInitialize(): Promise<void>;
  protected abstract process(
    context: AgentContext & { memoryContext?: unknown }
  ): Promise<PartialAgentResponse>;
  protected abstract onShutdown(): Promise<void>;

  // Memory management methods
  protected async loadMemory(): Promise<void> {
    if (!this.memoryCoordinator) return;

    try {
      // Load agent-specific memory patterns
      if (
        this.memoryCoordinator &&
        typeof this.memoryCoordinator === 'object' &&
        'retrieveAgentMemory' in this.memoryCoordinator &&
        typeof this.memoryCoordinator.retrieveAgentMemory === 'function'
      ) {
        await this.memoryCoordinator.retrieveAgentMemory(this.config.name);
      }
      this.logger.debug(`📚 Loaded memory for agent ${this.config.name}`);
    } catch (error) {
      this.logger.warn(`⚠️ Failed to load memory for agent ${this.config.name}:`, error);
    }
  }

  protected async retrieveMemory(context: AgentContext): Promise<any> {
    if (!this.memoryCoordinator) return null;

    try {
      if (
        this.memoryCoordinator &&
        typeof this.memoryCoordinator === 'object' &&
        'retrieveRelevantMemory' in this.memoryCoordinator &&
        typeof this.memoryCoordinator.retrieveRelevantMemory === 'function'
      ) {
        return await this.memoryCoordinator.retrieveRelevantMemory(
          this.config.name,
          context.userRequest
        );
      }
      return null;
    } catch (error) {
      this.logger.warn(`⚠️ Failed to retrieve memory:`, error);
      return null;
    }
  }

  protected async storeMemory(context: AgentContext, result: PartialAgentResponse): Promise<void> {
    if (!this.memoryCoordinator) return;

    try {
      if (
        this.memoryCoordinator &&
        typeof this.memoryCoordinator === 'object' &&
        'storeAgentMemory' in this.memoryCoordinator &&
        typeof this.memoryCoordinator.storeAgentMemory === 'function'
      ) {
        await this.memoryCoordinator.storeAgentMemory(this.config.name, context, result);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Failed to store memory:`, error);
    }
  }

  // Event handlers
  protected onRequestStarted(event: unknown): void {
    if (event && typeof event === 'object' && 'requestId' in event) {
      this.logger.debug(`🚀 Agent ${this.config.name} processing request ${event.requestId}`);
    }
  }

  protected onRequestCompleted(event: unknown): void {
    if (event && typeof event === 'object' && 'requestId' in event) {
      this.logger.debug(`✅ Agent ${this.config.name} completed request ${event.requestId}`);
    }
  }

  protected onRequestFailed(event: unknown): void {
    if (event && typeof event === 'object' && 'requestId' in event && 'error' in event) {
      this.logger.error(
        `❌ Agent ${this.config.name} failed request ${event.requestId}:`,
        event.error
      );
    }
  }

  // Utility methods
  private updateMetrics(latencyMs: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    }

    // Update rolling average latency
    if (this.metrics.totalRequests === 1) {
      this.metrics.averageLatencyMs = latencyMs;
    } else {
      // Exponential moving average
      const alpha = 0.1;
      this.metrics.averageLatencyMs =
        alpha * latencyMs + (1 - alpha) * this.metrics.averageLatencyMs;
    }

    this.metrics.lastExecuted = new Date();
    this.metrics.performanceScore = this.calculatePerformanceScore();
  }

  private calculatePerformanceScore(): number {
    if (this.metrics.totalRequests === 0) return 1.0;

    const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
    const latencyScore = Math.max(0, 1 - this.metrics.averageLatencyMs / this.config.maxLatencyMs);

    return successRate * GOOD_CONFIDENCE + latencyScore * 0.3;
  }

  private calculateHealthScore(): number {
    if (!this.isInitialized) return 0;

    const performanceWeight = MODERATE_CONFIDENCE;
    const uptimeWeight = 0.2;
    const errorRateWeight = 0.2;

    const errorRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.totalRequests - this.metrics.successfulRequests) /
          this.metrics.totalRequests
        : 0;

    const healthScore =
      this.metrics.performanceScore * performanceWeight +
      1.0 * uptimeWeight + // Uptime is 100% if initialized
      (1 - errorRate) * errorRateWeight;

    return Math.max(0, Math.min(1, healthScore));
  }
}

export default BaseAgent;

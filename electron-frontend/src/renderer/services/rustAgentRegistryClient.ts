/**
 * Rust Agent Registry Client
 *
 * High-performance client for connecting to the Rust Agent Registry service
 * Provides sub-millisecond performance tracking, agent discovery, and orchestration
 *
 * Phase 2: Agent Registry Coordination
 */

import Logger from '../utils/logger';

// Agent Registry Types (matching Rust definitions)
export enum AgentType {
  CONVERSATIONAL = 'conversational',
  CODE_ASSISTANT = 'code_assistant',
  DATA_PROCESSOR = 'data_processor',
  CONTENT_CREATOR = 'content_creator',
  RESEARCHER = 'researcher',
  TASK_AUTOMATOR = 'task_automator',
  SECURITY_ANALYZER = 'security_analyzer',
  PERFORMANCE_OPTIMIZER = 'performance_optimizer',
  CUSTOM = 'custom',
}

export enum AgentCapability {
  NATURAL_LANGUAGE_PROCESSING = 'natural_language_processing',
  CODE_GENERATION = 'code_generation',
  IMAGE_PROCESSING = 'image_processing',
  AUDIO_PROCESSING = 'audio_processing',
  VIDEO_PROCESSING = 'video_processing',
  WEB_SCRAPING = 'web_scraping',
  API_INTEGRATION = 'api_integration',
  DATABASE_OPERATIONS = 'database_operations',
  FILE_SYSTEM_OPERATIONS = 'file_system_operations',
  NETWORK_OPERATIONS = 'network_operations',
  REAL_TIME_COMMUNICATION = 'real_time_communication',
  SCHEDULING = 'scheduling',
  MONITORING = 'monitoring',
  CUSTOM = 'custom',
}

export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BUSY = 'busy',
  ERROR = 'error',
  MAINTENANCE = 'maintenance',
  DECOMMISSIONING = 'decommissioning',
}

export interface AgentConfig {
  max_concurrent_executions: number;
  default_timeout_seconds: number;
  memory_limit_mb?: number;
  cpu_limit_cores?: number;
  environment: Record<string, string>;
  parameters: Record<string, any>;
  health_check?: HealthCheckConfig;
  retry_config?: RetryConfig;
}

export interface HealthCheckConfig {
  endpoint: string;
  interval_seconds: number;
  timeout_seconds: number;
  failure_threshold: number;
}

export interface RetryConfig {
  max_retries: number;
  initial_delay_ms: number;
  backoff_multiplier: number;
  max_delay_ms: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  agent_type: AgentType;
  description: string;
  capabilities: AgentCapability[];
  config: AgentConfig;
  version: string;
  endpoint?: string;
  status: AgentStatus;
  created_at: string;
  updated_at: string;
  last_seen?: string;
  metadata: Record<string, any>;
}

export interface AgentMetrics {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  cpu_usage_percent: number;
  memory_usage_mb: number;
  network_io_bytes: number;
  disk_io_bytes: number;
  error_rate: number;
  uptime_percent: number;
}

export interface Agent {
  definition: AgentDefinition;
  execution_count: number;
  error_count: number;
  avg_execution_time_ms: number;
  last_execution?: string;
  health_score: number;
  metrics: AgentMetrics;
}

export interface AgentExecutionRequest {
  input: any;
  context?: Record<string, any>;
  timeout_seconds?: number;
}

export interface AgentExecutionResult {
  success: boolean;
  output: any;
  execution_time_ms: number;
  agent_id: string;
  agent_name: string;
  metadata: Record<string, any>;
}

export interface AgentStatusInfo {
  status: AgentStatus;
  last_seen: string;
  health_score: number;
  execution_count: number;
  error_count: number;
  metadata: Record<string, any>;
}

export interface AgentHealthCheck {
  healthy: boolean;
  response_time_ms: number;
  last_check: string;
  error_message?: string;
  metadata: Record<string, any>;
}

export interface RegisterAgentRequest {
  name: string;
  agent_type: AgentType;
  description: string;
  capabilities: AgentCapability[];
  config: AgentConfig;
  version: string;
  endpoint?: string;
}

export interface AgentQueryParams {
  agent_type?: AgentType;
  status?: AgentStatus;
  capability?: string;
  limit?: number;
  offset?: number;
}

export interface RustAgentRegistryHealth {
  status: string;
  version: string;
  uptime_seconds: number;
  registered_agents: number;
  active_agents: number;
  total_executions: number;
}

export interface AgentPerformanceMetrics {
  agent_id: string;
  response_time_ms: number;
  throughput_ops_per_sec: number;
  error_rate: number;
  health_score: number;
  last_updated: string;
  sub_millisecond_operations: number;
  cache_hit_rate: number;
}

export interface AgentDiscoveryResult {
  agents: AgentDefinition[];
  total_count: number;
  performance_ranking: string[];
  recommendations: {
    agent_id: string;
    confidence: number;
    reasoning: string[];
  }[];
}

export interface LoadBalancingStrategy {
  strategy_type: 'round_robin' | 'least_connections' | 'fastest_response' | 'health_score';
  weight_factors: {
    response_time: number;
    health_score: number;
    error_rate: number;
    current_load: number;
  };
  failover_thresholds: {
    max_response_time_ms: number;
    min_health_score: number;
    max_error_rate: number;
  };
}

export class RustAgentRegistryClient {
  private baseUrl: string;
  private performanceCache = new Map<string, AgentPerformanceMetrics>();
  private connectionPool: Map<string, AbortController> = new Map();
  private metricsUpdateInterval?: NodeJS.Timeout;

  // Sub-millisecond performance tracking
  private performanceHistory: Map<string, number[]> = new Map();
  private loadBalancingStrategy: LoadBalancingStrategy;

  constructor(baseUrl = 'http://localhost:8081') {
    this.baseUrl = baseUrl.replace(/\/$/, '');

    // Default load balancing strategy optimized for sub-millisecond performance
    this.loadBalancingStrategy = {
      strategy_type: 'fastest_response',
      weight_factors: {
        response_time: 0.4,
        health_score: 0.3,
        error_rate: 0.2,
        current_load: 0.1,
      },
      failover_thresholds: {
        max_response_time_ms: 5,
        min_health_score: 0.8,
        max_error_rate: 0.05,
      },
    };

    Logger.debug('🦀 Rust Agent Registry Client initialized:', {
      baseUrl: this.baseUrl,
      loadBalancingStrategy: this.loadBalancingStrategy.strategy_type,
    });

    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  /**
   * Phase 2: Core connection to Rust Agent Registry
   */

  async getRegistryHealth(): Promise<RustAgentRegistryHealth> {
    const startTime = performance.now();

    try {
      const response = await this.makeRequest<RustAgentRegistryHealth>('/health');

      const responseTime = performance.now() - startTime;
      Logger.debug('🏥 Registry health check completed:', {
        status: response.status,
        response_time_ms: Math.round(responseTime * 100) / 100,
        active_agents: response.active_agents,
      });

      return response;
    } catch (error) {
      Logger.error('❌ Registry health check failed:', error);
      throw new Error(
        `Registry health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async listAgents(params?: AgentQueryParams): Promise<AgentDefinition[]> {
    const startTime = performance.now();

    try {
      const queryString = params ? this.buildQueryString(params) : '';
      const agents = await this.makeRequest<AgentDefinition[]>(`/agents${queryString}`);

      const responseTime = performance.now() - startTime;
      Logger.debug('📋 Agent list retrieved:', {
        count: agents.length,
        response_time_ms: Math.round(responseTime * 100) / 100,
        filters: params,
      });

      return agents;
    } catch (error) {
      Logger.error('❌ Failed to list agents:', error);
      throw new Error(
        `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async registerAgent(request: RegisterAgentRequest): Promise<AgentDefinition> {
    const startTime = performance.now();

    try {
      const agent = await this.makeRequest<AgentDefinition>('/agents', {
        method: 'POST',
        body: JSON.stringify(request),
      });

      const responseTime = performance.now() - startTime;
      Logger.info('✅ Agent registered successfully:', {
        agent_id: agent.id,
        name: agent.name,
        type: agent.agent_type,
        capabilities_count: agent.capabilities.length,
        response_time_ms: Math.round(responseTime * 100) / 100,
      });

      return agent;
    } catch (error) {
      Logger.error('❌ Failed to register agent:', error);
      throw new Error(
        `Failed to register agent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getAgent(agentId: string): Promise<AgentDefinition | null> {
    const startTime = performance.now();

    try {
      const agent = await this.makeRequest<AgentDefinition>(`/agents/${agentId}`);

      const responseTime = performance.now() - startTime;
      this.updatePerformanceMetrics(agentId, responseTime);

      return agent;
    } catch (error) {
      if ((error as any).status === 404) {
        return null;
      }
      Logger.error(`❌ Failed to get agent ${agentId}:`, error);
      throw error;
    }
  }

  async executeAgent(
    agentId: string,
    request: AgentExecutionRequest
  ): Promise<AgentExecutionResult> {
    const startTime = performance.now();

    try {
      Logger.debug(`🚀 Executing agent ${agentId}:`, {
        has_context: !!request.context,
        timeout_seconds: request.timeout_seconds,
      });

      const result = await this.makeRequest<AgentExecutionResult>(`/agents/${agentId}/execute`, {
        method: 'POST',
        body: JSON.stringify(request),
        timeout: (request.timeout_seconds || 30) * 1000,
      });

      const totalResponseTime = performance.now() - startTime;

      // Update performance metrics
      this.updatePerformanceMetrics(agentId, totalResponseTime);

      Logger.debug(`✅ Agent execution completed:`, {
        agent_id: agentId,
        success: result.success,
        execution_time_ms: result.execution_time_ms,
        total_response_time_ms: Math.round(totalResponseTime * 100) / 100,
      });

      return result;
    } catch (error) {
      Logger.error(`❌ Agent execution failed for ${agentId}:`, error);
      throw error;
    }
  }

  async getAgentStatus(agentId: string): Promise<AgentStatusInfo> {
    const startTime = performance.now();

    try {
      const status = await this.makeRequest<AgentStatusInfo>(`/agents/${agentId}/status`);

      const responseTime = performance.now() - startTime;
      this.updatePerformanceMetrics(agentId, responseTime);

      return status;
    } catch (error) {
      Logger.error(`❌ Failed to get agent status for ${agentId}:`, error);
      throw error;
    }
  }

  async checkAgentHealth(agentId: string): Promise<AgentHealthCheck> {
    const startTime = performance.now();

    try {
      const health = await this.makeRequest<AgentHealthCheck>(`/agents/${agentId}/health`, {
        method: 'POST',
      });

      const responseTime = performance.now() - startTime;
      this.updatePerformanceMetrics(agentId, responseTime);

      return health;
    } catch (error) {
      Logger.error(`❌ Health check failed for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Phase 2: Advanced Agent Discovery and Performance Optimization
   */

  async discoverOptimalAgents(
    requiredCapabilities: AgentCapability[],
    taskComplexity: 'simple' | 'moderate' | 'complex' = 'moderate',
    performanceRequirements?: {
      max_response_time_ms?: number;
      min_health_score?: number;
      max_error_rate?: number;
    }
  ): Promise<AgentDiscoveryResult> {
    const startTime = performance.now();

    try {
      // Get all agents with required capabilities
      const allAgents = await this.listAgents();

      // Filter agents by capabilities
      const capableAgents = allAgents.filter(agent =>
        requiredCapabilities.every(
          capability =>
            agent.capabilities.includes(capability) ||
            agent.capabilities.includes(AgentCapability.CUSTOM)
        )
      );

      // Get performance metrics for each capable agent
      const agentPerformance = await Promise.all(
        capableAgents.map(async agent => {
          const metrics = this.getAgentPerformanceMetrics(agent.id);
          const status = await this.getAgentStatus(agent.id);

          return {
            agent,
            metrics,
            status,
          };
        })
      );

      // Apply performance requirements filtering
      const filteredAgents = agentPerformance.filter(({ metrics, status }) => {
        if (performanceRequirements) {
          if (
            performanceRequirements.max_response_time_ms &&
            metrics.response_time_ms > performanceRequirements.max_response_time_ms
          ) {
            return false;
          }
          if (
            performanceRequirements.min_health_score &&
            metrics.health_score < performanceRequirements.min_health_score
          ) {
            return false;
          }
          if (
            performanceRequirements.max_error_rate &&
            metrics.error_rate > performanceRequirements.max_error_rate
          ) {
            return false;
          }
        }

        return status.status === AgentStatus.ACTIVE;
      });

      // Rank agents by performance score
      const rankedAgents = filteredAgents
        .map(({ agent, metrics }) => ({
          agent,
          score: this.calculatePerformanceScore(metrics, taskComplexity),
        }))
        .sort((a, b) => b.score - a.score);

      const responseTime = performance.now() - startTime;

      Logger.debug('🔍 Agent discovery completed:', {
        total_agents: allAgents.length,
        capable_agents: capableAgents.length,
        filtered_agents: rankedAgents.length,
        response_time_ms: Math.round(responseTime * 100) / 100,
        top_agent: rankedAgents[0]?.agent.name,
      });

      return {
        agents: rankedAgents.map(r => r.agent),
        total_count: rankedAgents.length,
        performance_ranking: rankedAgents.map(r => r.agent.id),
        recommendations: rankedAgents.slice(0, 3).map(({ agent, score }) => ({
          agent_id: agent.id,
          confidence: Math.min(score, 1.0),
          reasoning: this.generateRecommendationReasoning(agent, score, taskComplexity),
        })),
      };
    } catch (error) {
      Logger.error('❌ Agent discovery failed:', error);
      throw error;
    }
  }

  /**
   * Phase 2: Load Balancing and Health Monitoring
   */

  async getOptimalAgentForExecution(
    requiredCapabilities: AgentCapability[],
    taskContext?: Record<string, any>
  ): Promise<AgentDefinition | null> {
    const discovery = await this.discoverOptimalAgents(requiredCapabilities);

    if (discovery.agents.length === 0) {
      return null;
    }

    // Apply load balancing strategy
    const optimalAgent = this.applyLoadBalancingStrategy(discovery.agents);

    Logger.debug('🎯 Optimal agent selected:', {
      agent_id: optimalAgent.id,
      name: optimalAgent.name,
      strategy: this.loadBalancingStrategy.strategy_type,
      capabilities: optimalAgent.capabilities.length,
    });

    return optimalAgent;
  }

  updateLoadBalancingStrategy(strategy: Partial<LoadBalancingStrategy>): void {
    this.loadBalancingStrategy = {
      ...this.loadBalancingStrategy,
      ...strategy,
    };

    Logger.debug('🔄 Load balancing strategy updated:', {
      strategy_type: this.loadBalancingStrategy.strategy_type,
      weight_factors: this.loadBalancingStrategy.weight_factors,
    });
  }

  getAgentPerformanceMetrics(agentId: string): AgentPerformanceMetrics {
    return (
      this.performanceCache.get(agentId) || {
        agent_id: agentId,
        response_time_ms: 1000, // Default fallback
        throughput_ops_per_sec: 10,
        error_rate: 0.1,
        health_score: 0.7,
        last_updated: new Date().toISOString(),
        sub_millisecond_operations: 0,
        cache_hit_rate: 0.0,
      }
    );
  }

  getAllPerformanceMetrics(): Map<string, AgentPerformanceMetrics> {
    return new Map(this.performanceCache);
  }

  /**
   * Private helper methods
   */

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();

    // Set up timeout
    const timeout = options.timeout || 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...options.headers,
        },
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private buildQueryString(params: Record<string, any>): string {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query.append(key, String(value));
      }
    });
    return query.toString() ? `?${query.toString()}` : '';
  }

  private updatePerformanceMetrics(agentId: string, responseTimeMs: number): void {
    const existing = this.performanceCache.get(agentId);
    const history = this.performanceHistory.get(agentId) || [];

    // Add new response time to history (keep last 100 measurements)
    history.push(responseTimeMs);
    if (history.length > 100) {
      history.shift();
    }
    this.performanceHistory.set(agentId, history);

    // Calculate metrics
    const avgResponseTime = history.reduce((sum, time) => sum + time, 0) / history.length;
    const subMillisecondOps = history.filter(time => time < 1).length;

    const metrics: AgentPerformanceMetrics = {
      agent_id: agentId,
      response_time_ms: Math.round(avgResponseTime * 100) / 100,
      throughput_ops_per_sec: history.length > 0 ? Math.round(1000 / avgResponseTime) : 0,
      error_rate: existing?.error_rate || 0.0,
      health_score: existing?.health_score || 1.0,
      last_updated: new Date().toISOString(),
      sub_millisecond_operations: subMillisecondOps,
      cache_hit_rate: existing?.cache_hit_rate || 0.0,
    };

    this.performanceCache.set(agentId, metrics);
  }

  private calculatePerformanceScore(
    metrics: AgentPerformanceMetrics,
    taskComplexity: 'simple' | 'moderate' | 'complex'
  ): number {
    const weights = this.loadBalancingStrategy.weight_factors;

    // Normalize response time (lower is better)
    const responseTimeScore = Math.max(0, 1 - metrics.response_time_ms / 1000);

    // Health score is already normalized (0-1)
    const healthScore = metrics.health_score;

    // Error rate score (lower is better)
    const errorScore = Math.max(0, 1 - metrics.error_rate);

    // Current load score (estimated from throughput)
    const loadScore = Math.min(1, metrics.throughput_ops_per_sec / 100);

    // Task complexity adjustment
    const complexityMultiplier =
      taskComplexity === 'simple' ? 1.2 : taskComplexity === 'complex' ? 0.8 : 1.0;

    const totalScore =
      (responseTimeScore * weights.response_time +
        healthScore * weights.health_score +
        errorScore * weights.error_rate +
        loadScore * weights.current_load) *
      complexityMultiplier;

    return Math.max(0, Math.min(1, totalScore));
  }

  private applyLoadBalancingStrategy(agents: AgentDefinition[]): AgentDefinition {
    switch (this.loadBalancingStrategy.strategy_type) {
      case 'fastest_response':
        return agents.reduce((fastest, current) => {
          const fastestMetrics = this.getAgentPerformanceMetrics(fastest.id);
          const currentMetrics = this.getAgentPerformanceMetrics(current.id);
          return currentMetrics.response_time_ms < fastestMetrics.response_time_ms
            ? current
            : fastest;
        });

      case 'health_score':
        return agents.reduce((healthiest, current) => {
          const healthiestMetrics = this.getAgentPerformanceMetrics(healthiest.id);
          const currentMetrics = this.getAgentPerformanceMetrics(current.id);
          return currentMetrics.health_score > healthiestMetrics.health_score
            ? current
            : healthiest;
        });

      case 'round_robin':
      case 'least_connections':
      default:
        // Default to first agent (round robin would require state)
        return agents[0];
    }
  }

  private generateRecommendationReasoning(
    agent: AgentDefinition,
    score: number,
    taskComplexity: string
  ): string[] {
    const reasoning = [];
    const metrics = this.getAgentPerformanceMetrics(agent.id);

    if (metrics.response_time_ms < 5) {
      reasoning.push('Sub-5ms response time for excellent performance');
    }

    if (metrics.health_score > 0.9) {
      reasoning.push('High health score indicates reliable operation');
    }

    if (metrics.error_rate < 0.05) {
      reasoning.push('Low error rate demonstrates stability');
    }

    if (agent.capabilities.length > 5) {
      reasoning.push('Versatile agent with extensive capabilities');
    }

    reasoning.push(
      `Optimized for ${taskComplexity} tasks with ${Math.round(score * 100)}% confidence`
    );

    return reasoning;
  }

  private startPerformanceMonitoring(): void {
    this.metricsUpdateInterval = setInterval(async () => {
      try {
        const agents = await this.listAgents({ status: AgentStatus.ACTIVE });

        // Update cache hit rates and other derived metrics
        agents.forEach(agent => {
          const existing = this.performanceCache.get(agent.id);
          if (existing) {
            // Simulate cache hit rate updates (would come from real metrics in production)
            existing.cache_hit_rate = Math.min(1.0, existing.cache_hit_rate + 0.01);
          }
        });
      } catch (error) {
        Logger.warn('⚠️ Performance monitoring update failed:', error);
      }
    }, 30000); // Update every 30 seconds
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.metricsUpdateInterval) {
      clearInterval(this.metricsUpdateInterval);
    }

    // Abort any pending requests
    this.connectionPool.forEach(controller => controller.abort());
    this.connectionPool.clear();

    Logger.debug('🧹 Rust Agent Registry Client destroyed');
  }
}

// Export singleton instance
export const rustAgentRegistryClient = new RustAgentRegistryClient();

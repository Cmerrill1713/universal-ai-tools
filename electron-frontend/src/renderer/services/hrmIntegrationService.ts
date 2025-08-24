import Logger from '../utils/logger';
import { agentHealthMonitor, LoadBalancingDecision } from './agentHealthMonitor';
import {
  agentDiscoveryService,
  DiscoveryRequest,
  AgentDiscoveryResult,
} from './agentDiscoveryService';
/**
 * HRM Integration Service
 *
 * Enhanced service integrating HRM Universal Decision Engine with Rust Agent Registry
 * Phase 1: HRM Integration Foundation ✅ COMPLETE
 * Phase 2: Agent Registry Coordination 🚧 IN PROGRESS
 *
 * Handles decision caching, confidence thresholding, intelligent fallbacks,
 * and sub-millisecond agent performance coordination.
 */

import {
  DecisionContext,
  DecisionResult,
  DecisionType,
  TaskExecutionRequest,
  unifiedAgentDecisionService,
} from './unifiedAgentDecisionService';

import {
  rustAgentRegistryClient,
  AgentCapability,
  AgentType,
  AgentDefinition,
  AgentPerformanceMetrics,
  LoadBalancingStrategy,
} from './rustAgentRegistryClient';

export interface HRMIntegrationConfig {
  confidenceThreshold: number;
  cacheDecisionTimeoutMs: number;
  maxRetryAttempts: number;
  fallbackStrategy: 'conservative' | 'aggressive' | 'adaptive';
  enableDecisionCaching: boolean;
  enableConfidenceFiltering: boolean;

  // Phase 2: Rust Agent Registry Configuration
  enableRustAgentRegistry: boolean;
  agentRegistryUrl: string;
  subMillisecondOptimization: boolean;
  agentHealthMonitoringInterval: number;
  loadBalancingStrategy: LoadBalancingStrategy;
  performanceThresholds: {
    maxResponseTimeMs: number;
    minHealthScore: number;
    maxErrorRate: number;
  };
}

export interface CachedDecision {
  decision: DecisionResult;
  timestamp: number;
  contextHash: string;
  hitCount: number;
}

export interface HRMPerformanceMetrics {
  totalDecisions: number;
  successfulDecisions: number;
  averageConfidence: number;
  averageResponseTimeMs: number;
  cacheHitRate: number;
  fallbackUsageRate: number;
  confidenceDistribution: {
    high: number; // >0.8
    medium: number; // 0.5-0.8
    low: number; // <0.5
  };

  // Phase 2: Rust Agent Registry Metrics
  rustAgentRegistryMetrics?: {
    connectedAgents: number;
    activeAgents: number;
    subMillisecondOperations: number;
    averageAgentResponseTime: number;
    agentHealthScore: number;
    loadBalancingEfficiency: number;
  };
}

const DEFAULT_CONFIG: HRMIntegrationConfig = {
  confidenceThreshold: 0.6,
  cacheDecisionTimeoutMs: 300000, // 5 minutes
  maxRetryAttempts: 2,
  fallbackStrategy: 'adaptive',
  enableDecisionCaching: true,
  enableConfidenceFiltering: true,

  // Phase 2: Rust Agent Registry Defaults
  enableRustAgentRegistry: true,
  agentRegistryUrl: 'http://localhost:8081',
  subMillisecondOptimization: true,
  agentHealthMonitoringInterval: 30000, // 30 seconds
  loadBalancingStrategy: {
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
  },
  performanceThresholds: {
    maxResponseTimeMs: 10,
    minHealthScore: 0.7,
    maxErrorRate: 0.1,
  },
};

export class HRMIntegrationService {
  private config: HRMIntegrationConfig;
  private decisionCache = new Map<string, CachedDecision>();
  private performanceMetrics: HRMPerformanceMetrics = {
    totalDecisions: 0,
    successfulDecisions: 0,
    averageConfidence: 0,
    averageResponseTimeMs: 0,
    cacheHitRate: 0,
    fallbackUsageRate: 0,
    confidenceDistribution: { high: 0, medium: 0, low: 0 },
  };

  constructor(config: Partial<HRMIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    Logger.debug('🧠 HRM Integration Service initialized:', {
      confidenceThreshold: this.config.confidenceThreshold,
      cacheEnabled: this.config.enableDecisionCaching,
      fallbackStrategy: this.config.fallbackStrategy,
    });

    // Clean up cache periodically
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   * Make an intelligent decision with enhanced HRM features
   */
  async makeEnhancedDecision(context: DecisionContext): Promise<DecisionResult> {
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (this.config.enableDecisionCaching) {
        const cached = this.getCachedDecision(context);
        if (cached) {
          this.updateMetrics(cached, true, Date.now() - startTime);
          return cached;
        }
      }

      // Make HRM decision with retry logic
      let decision: DecisionResult | null = null;
      let attempts = 0;

      while (!decision && attempts < this.config.maxRetryAttempts) {
        try {
          decision = await unifiedAgentDecisionService.makeDecision(context);
          break;
        } catch (error) {
          attempts++;
          Logger.warn(`HRM decision attempt ${attempts} failed:`, error);

          if (attempts < this.config.maxRetryAttempts) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          }
        }
      }

      if (!decision) {
        throw new Error(`HRM decision failed after ${this.config.maxRetryAttempts} attempts`);
      }

      // Apply confidence filtering
      if (
        this.config.enableConfidenceFiltering &&
        decision.confidence < this.config.confidenceThreshold
      ) {
        Logger.warn(`⚠️ HRM decision below confidence threshold:`, {
          decision_id: decision.decision_id,
          confidence: decision.confidence,
          threshold: this.config.confidenceThreshold,
        });

        // Enhance decision with fallback strategy
        decision = this.enhanceDecisionWithFallback(decision, context);
      }

      // Cache the decision
      if (this.config.enableDecisionCaching) {
        this.cacheDecision(context, decision);
      }

      this.updateMetrics(decision, false, Date.now() - startTime);
      return decision;
    } catch (error) {
      Logger.error('Enhanced HRM decision failed:', error);

      // Generate fallback decision with higher confidence
      const fallbackDecision = await this.generateIntelligentFallback(context, error);
      this.updateMetrics(fallbackDecision, false, Date.now() - startTime);

      return fallbackDecision;
    }
  }

  /**
   * Get optimal agent routing for a specific task using HRM intelligence
   */
  async getOptimalAgentRouting(request: TaskExecutionRequest): Promise<{
    primaryAgent: string;
    backupAgents: string[];
    confidence: number;
    reasoning: string[];
    estimatedPerformance: {
      timeMs: number;
      successProbability: number;
      resourceUsage: number;
    };
  }> {
    const context: DecisionContext = {
      decision_type: DecisionType.AGENT_ROUTING,
      request_data: {
        task_type: request.task_type,
        complexity: request.complexity,
        description: request.task_description,
        user_experience: request.user_context.experience_level,
        frontend_framework: request.user_context.frontend_framework,
      },
      constraints: {
        max_time_ms: request.execution_constraints?.max_time_ms,
        max_memory_mb: request.execution_constraints?.max_memory_mb,
        require_human_approval: request.execution_constraints?.require_human_approval,
      },
      available_options: await unifiedAgentDecisionService.getAvailableAgents(),
    };

    const decision = await this.makeEnhancedDecision(context);

    // Extract routing information from HRM decision
    const selectedOption = decision.selected_option;
    const primaryAgent =
      selectedOption.agent_id || selectedOption.primary_agent || request.task_type;
    const backupAgents = decision.alternative_options
      .map(opt => opt.agent_id || opt.primary_agent)
      .filter(Boolean)
      .slice(0, 2);

    return {
      primaryAgent,
      backupAgents,
      confidence: decision.confidence,
      reasoning: decision.reasoning_steps,
      estimatedPerformance: {
        timeMs: decision.estimated_resources?.estimated_time_ms || 5000,
        successProbability: decision.confidence * 0.9, // Slight discount for uncertainty
        resourceUsage: decision.estimated_resources?.memory_mb || 256,
      },
    };
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): HRMPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      totalDecisions: 0,
      successfulDecisions: 0,
      averageConfidence: 0,
      averageResponseTimeMs: 0,
      cacheHitRate: 0,
      fallbackUsageRate: 0,
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
    };

    Logger.debug('📊 HRM performance metrics reset');
  }

  // Private helper methods

  private getCachedDecision(context: DecisionContext): DecisionResult | null {
    const contextHash = this.hashContext(context);
    const cached = this.decisionCache.get(contextHash);

    if (!cached) return null;

    // Check if cache entry is still valid
    const now = Date.now();
    if (now - cached.timestamp > this.config.cacheDecisionTimeoutMs) {
      this.decisionCache.delete(contextHash);
      return null;
    }

    // Update hit count
    cached.hitCount++;

    Logger.debug('💾 Using cached HRM decision:', {
      decision_id: cached.decision.decision_id,
      age_ms: now - cached.timestamp,
      hit_count: cached.hitCount,
    });

    return cached.decision;
  }

  private cacheDecision(context: DecisionContext, decision: DecisionResult): void {
    const contextHash = this.hashContext(context);
    this.decisionCache.set(contextHash, {
      decision,
      timestamp: Date.now(),
      contextHash,
      hitCount: 0,
    });

    Logger.debug('💾 Cached HRM decision:', {
      decision_id: decision.decision_id,
      confidence: decision.confidence,
      cache_size: this.decisionCache.size,
    });
  }

  private hashContext(context: DecisionContext): string {
    // Create a hash of the context for caching
    const key = {
      type: context.decision_type,
      task_type: context.request_data?.task_type,
      complexity: context.request_data?.complexity,
      constraints: context.constraints,
    };

    return btoa(JSON.stringify(key)).slice(0, 16);
  }

  private enhanceDecisionWithFallback(
    decision: DecisionResult,
    context: DecisionContext
  ): DecisionResult {
    Logger.debug('🔄 Enhancing low-confidence decision with fallback strategy');

    const fallbackOption = this.getFallbackOption(context);

    return {
      ...decision,
      selected_option: fallbackOption,
      reasoning_steps: [
        ...decision.reasoning_steps,
        `Applied ${this.config.fallbackStrategy} fallback strategy due to low confidence (${decision.confidence})`,
      ],
      fallback_strategy: {
        reason: 'low_confidence',
        original_confidence: decision.confidence,
        threshold: this.config.confidenceThreshold,
        strategy: this.config.fallbackStrategy,
      },
      confidence: Math.max(decision.confidence, 0.4), // Boost confidence slightly
    };
  }

  private getFallbackOption(context: DecisionContext): Record<string, any> {
    switch (this.config.fallbackStrategy) {
      case 'conservative':
        return {
          agent_id: 'frontend-developer',
          action: 'use_general_purpose',
          reasoning: 'Conservative fallback to most reliable agent',
        };
      case 'aggressive':
        return {
          agent_id: context.request_data?.task_type || 'react-expert',
          action: 'use_specialized',
          reasoning: 'Aggressive fallback to specialized agent',
        };
      case 'adaptive':
      default: {
        // Choose based on task complexity
        const complexity = context.request_data?.complexity || 'moderate';
        return {
          agent_id: complexity === 'simple' ? 'frontend-developer' : 'react-expert',
          action: 'adaptive_selection',
          reasoning: `Adaptive fallback based on complexity: ${complexity}`,
        };
      }
    }
  }

  private async generateIntelligentFallback(
    context: DecisionContext,
    error: any
  ): Promise<DecisionResult> {
    Logger.warn('🆘 Generating intelligent fallback decision:', {
      decision_type: context.decision_type,
      error: error instanceof Error ? error.message : String(error),
    });

    const fallbackOption = this.getFallbackOption(context);

    return {
      decision_id: `fallback-enhanced-${Date.now()}`,
      selected_option: fallbackOption,
      confidence: 0.4, // Higher than basic fallback
      reasoning_steps: [
        `HRM engine failed: ${error instanceof Error ? error.message : String(error)}`,
        `Applied intelligent ${this.config.fallbackStrategy} fallback strategy`,
        `Selected ${fallbackOption.agent_id} based on context analysis`,
      ],
      alternative_options: [],
      estimated_impact: { reliability: -0.1, performance: -0.05 },
      monitoring_metrics: ['fallback_usage', 'hrm_availability', 'decision_quality'],
      fallback_strategy: {
        reason: 'hrm_failure',
        strategy: this.config.fallbackStrategy,
        error_type: error instanceof Error ? error.constructor.name : 'unknown',
        retry_attempts: this.config.maxRetryAttempts,
      },
      execution_parameters: {
        ...context.request_data,
        fallback_mode: true,
        enhanced_fallback: true,
      },
      estimated_resources: {
        cpu_usage: 25,
        memory_mb: 128,
        estimated_time_ms: 3000,
      },
      risk_assessment: {
        risk_level: 'MEDIUM',
        potential_issues: [
          'Reduced decision quality without HRM intelligence',
          'May not consider all available context',
          'Lower optimization for specific use case',
        ],
        mitigation_strategies: [
          'Monitor HRM engine health for recovery',
          'Use enhanced fallback logic with context analysis',
          'Track decision outcomes for learning',
        ],
      },
      timestamp: new Date().toISOString(),
    };
  }

  private updateMetrics(
    decision: DecisionResult,
    fromCache: boolean,
    responseTimeMs: number
  ): void {
    this.performanceMetrics.totalDecisions++;

    if (decision.confidence >= 0.5) {
      this.performanceMetrics.successfulDecisions++;
    }

    // Update confidence distribution
    if (decision.confidence >= 0.8) {
      this.performanceMetrics.confidenceDistribution.high++;
    } else if (decision.confidence >= 0.5) {
      this.performanceMetrics.confidenceDistribution.medium++;
    } else {
      this.performanceMetrics.confidenceDistribution.low++;
    }

    // Update averages
    const total = this.performanceMetrics.totalDecisions;
    this.performanceMetrics.averageConfidence =
      (this.performanceMetrics.averageConfidence * (total - 1) + decision.confidence) / total;

    if (!fromCache) {
      this.performanceMetrics.averageResponseTimeMs =
        (this.performanceMetrics.averageResponseTimeMs * (total - 1) + responseTimeMs) / total;
    }

    // Update rates
    const cacheHits = fromCache ? 1 : 0;
    this.performanceMetrics.cacheHitRate =
      (this.performanceMetrics.cacheHitRate * (total - 1) + cacheHits) / total;

    const fallbackUsage = decision.fallback_strategy ? 1 : 0;
    this.performanceMetrics.fallbackUsageRate =
      (this.performanceMetrics.fallbackUsageRate * (total - 1) + fallbackUsage) / total;
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, cached] of this.decisionCache.entries()) {
      if (now - cached.timestamp > this.config.cacheDecisionTimeoutMs) {
        this.decisionCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.debug(
        `🧹 Cleaned ${cleaned} expired cache entries. Cache size: ${this.decisionCache.size}`
      );
    }
  }

  // ============================================================================
  // PHASE 2: RUST AGENT REGISTRY COORDINATION METHODS
  // ============================================================================

  /**
   * Phase 2: Get enhanced agent routing with Rust Agent Registry integration
   */
  async getOptimalAgentRoutingWithRegistry(request: TaskExecutionRequest): Promise<{
    primaryAgent: string;
    backupAgents: string[];
    confidence: number;
    reasoning: string[];
    estimatedPerformance: {
      timeMs: number;
      successProbability: number;
      resourceUsage: number;
    };
    registryMetrics?: {
      agentId: string;
      responseTimeMs: number;
      healthScore: number;
      subMillisecondOps: number;
    };
  }> {
    if (!this.config.enableRustAgentRegistry) {
      // Fallback to Phase 1 HRM-only routing
      return await this.getOptimalAgentRouting(request);
    }

    const startTime = performance.now();

    try {
      Logger.debug('🦀 Phase 2: Getting optimal agent routing with Rust Agent Registry');

      // Map task type to agent capabilities
      const requiredCapabilities = this.mapTaskTypeToCapabilities(request.task_type);
      const taskComplexity = request.complexity || 'moderate';

      // Get optimal agent from Rust Agent Registry
      const optimalAgent = await rustAgentRegistryClient.getOptimalAgentForExecution(
        requiredCapabilities,
        { task_description: request.task_description }
      );

      if (!optimalAgent) {
        Logger.warn('⚠️ No optimal agent found in registry, falling back to HRM routing');
        return await this.getOptimalAgentRouting(request);
      }

      // Get performance metrics from registry
      const performanceMetrics = rustAgentRegistryClient.getAgentPerformanceMetrics(
        optimalAgent.id
      );

      // Discover backup agents
      const discovery = await rustAgentRegistryClient.discoverOptimalAgents(
        requiredCapabilities,
        taskComplexity,
        this.config.performanceThresholds
      );

      const backupAgents = discovery.agents
        .filter(agent => agent.id !== optimalAgent.id)
        .slice(0, 2)
        .map(agent => agent.name);

      const responseTime = performance.now() - startTime;

      // Calculate confidence based on agent performance
      const confidence = Math.min(0.95, performanceMetrics.health_score * 0.9 + 0.1);

      const reasoning = [
        `Selected ${optimalAgent.name} from Rust Agent Registry`,
        `Agent health score: ${Math.round(performanceMetrics.health_score * 100)}%`,
        `Average response time: ${Math.round(performanceMetrics.response_time_ms * 100) / 100}ms`,
        `Sub-millisecond operations: ${performanceMetrics.sub_millisecond_operations}`,
        ...(discovery.recommendations.find(r => r.agent_id === optimalAgent.id)?.reasoning || []),
      ];

      Logger.debug('🎯 Phase 2 optimal agent routing completed:', {
        primary_agent: optimalAgent.name,
        backup_agents: backupAgents.length,
        confidence: Math.round(confidence * 100),
        response_time_ms: Math.round(responseTime * 100) / 100,
        agent_health_score: Math.round(performanceMetrics.health_score * 100),
      });

      return {
        primaryAgent: optimalAgent.name,
        backupAgents,
        confidence,
        reasoning,
        estimatedPerformance: {
          timeMs: performanceMetrics.response_time_ms,
          successProbability: confidence,
          resourceUsage: 256, // Estimated MB
        },
        registryMetrics: {
          agentId: optimalAgent.id,
          responseTimeMs: performanceMetrics.response_time_ms,
          healthScore: performanceMetrics.health_score,
          subMillisecondOps: performanceMetrics.sub_millisecond_operations,
        },
      };
    } catch (error) {
      Logger.error('❌ Phase 2 agent routing with registry failed:', error);
      Logger.info('🔄 Falling back to Phase 1 HRM routing');

      // Graceful fallback to Phase 1 HRM routing
      return await this.getOptimalAgentRouting(request);
    }
  }

  /**
   * Phase 2: Enhanced decision making with agent registry integration
   */
  async makeEnhancedDecisionWithRegistry(context: DecisionContext): Promise<DecisionResult> {
    if (!this.config.enableRustAgentRegistry) {
      return await this.makeEnhancedDecision(context);
    }

    const startTime = performance.now();

    try {
      // First get HRM decision
      const hrmDecision = await this.makeEnhancedDecision(context);

      // If it's an agent routing decision, enhance it with registry data
      if (context.decision_type === DecisionType.AGENT_ROUTING) {
        Logger.debug('🔗 Phase 2: Enhancing HRM decision with Rust Agent Registry data');

        const taskCapabilities = this.extractCapabilitiesFromContext(context);
        const registryAgents =
          await rustAgentRegistryClient.discoverOptimalAgents(taskCapabilities);

        if (registryAgents.agents.length > 0) {
          const topAgent = registryAgents.agents[0];
          const agentMetrics = rustAgentRegistryClient.getAgentPerformanceMetrics(topAgent.id);

          // Enhance HRM decision with registry insights
          const enhancedDecision: DecisionResult = {
            ...hrmDecision,
            confidence: Math.max(hrmDecision.confidence, agentMetrics.health_score * 0.8),
            selected_option: {
              ...hrmDecision.selected_option,
              agent_id: topAgent.name,
              registry_enhanced: true,
              performance_metrics: agentMetrics,
            },
            reasoning_steps: [
              ...hrmDecision.reasoning_steps,
              `Enhanced with Rust Agent Registry: selected ${topAgent.name}`,
              `Agent health score: ${Math.round(agentMetrics.health_score * 100)}%`,
              `Sub-millisecond performance: ${agentMetrics.sub_millisecond_operations} operations`,
            ],
            alternative_options: registryAgents.agents.slice(1, 3).map(agent => ({
              agent_id: agent.name,
              agent_type: agent.agent_type,
              capabilities: agent.capabilities,
              performance_score: rustAgentRegistryClient.getAgentPerformanceMetrics(agent.id)
                .health_score,
            })),
          };

          const responseTime = performance.now() - startTime;
          Logger.debug('✅ Phase 2 enhanced decision completed:', {
            decision_id: enhancedDecision.decision_id,
            confidence: Math.round(enhancedDecision.confidence * 100),
            agent_selected: topAgent.name,
            response_time_ms: Math.round(responseTime * 100) / 100,
          });

          return enhancedDecision;
        }
      }

      // Return original HRM decision if no enhancement available
      return hrmDecision;
    } catch (error) {
      Logger.error('❌ Phase 2 enhanced decision with registry failed:', error);
      return await this.makeEnhancedDecision(context);
    }
  }

  /**
   * Phase 2: Get comprehensive performance metrics including registry data
   */
  getEnhancedPerformanceMetrics(): HRMPerformanceMetrics {
    const baseMetrics = this.getPerformanceMetrics();

    if (!this.config.enableRustAgentRegistry) {
      return baseMetrics;
    }

    try {
      const registryMetrics = rustAgentRegistryClient.getAllPerformanceMetrics();
      const registryMetricsArray = Array.from(registryMetrics.values());

      if (registryMetricsArray.length === 0) {
        return baseMetrics;
      }

      const connectedAgents = registryMetricsArray.length;
      const activeAgents = registryMetricsArray.filter(m => m.health_score > 0.5).length;
      const subMillisecondOps = registryMetricsArray.reduce(
        (sum, m) => sum + m.sub_millisecond_operations,
        0
      );
      const avgResponseTime =
        registryMetricsArray.reduce((sum, m) => sum + m.response_time_ms, 0) / connectedAgents;
      const avgHealthScore =
        registryMetricsArray.reduce((sum, m) => sum + m.health_score, 0) / connectedAgents;

      // Calculate load balancing efficiency (higher when agents have similar performance)
      const responseTimes = registryMetricsArray.map(m => m.response_time_ms);
      const avgTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      const variance =
        responseTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / responseTimes.length;
      const loadBalancingEfficiency = Math.max(0, 1 - Math.sqrt(variance) / avgTime);

      return {
        ...baseMetrics,
        rustAgentRegistryMetrics: {
          connectedAgents,
          activeAgents,
          subMillisecondOperations: subMillisecondOps,
          averageAgentResponseTime: Math.round(avgResponseTime * 100) / 100,
          agentHealthScore: Math.round(avgHealthScore * 100) / 100,
          loadBalancingEfficiency: Math.round(loadBalancingEfficiency * 100) / 100,
        },
      };
    } catch (error) {
      Logger.warn('⚠️ Failed to get registry metrics:', error);
      return baseMetrics;
    }
  }

  /**
   * Phase 2: Configure load balancing strategy
   */
  updateLoadBalancingStrategy(strategy: Partial<LoadBalancingStrategy>): void {
    if (this.config.enableRustAgentRegistry) {
      this.config.loadBalancingStrategy = {
        ...this.config.loadBalancingStrategy,
        ...strategy,
      };

      rustAgentRegistryClient.updateLoadBalancingStrategy(strategy);

      Logger.debug('🔄 Phase 2: Load balancing strategy updated:', {
        strategy_type: this.config.loadBalancingStrategy.strategy_type,
        response_time_weight: this.config.loadBalancingStrategy.weight_factors.response_time,
      });
    }
  }

  /**
   * Phase 2: Get agent health monitoring data
   */
  async getAgentHealthMonitoring(): Promise<{
    totalAgents: number;
    healthyAgents: number;
    unhealthyAgents: number;
    averageHealthScore: number;
    topPerformingAgents: Array<{
      agentId: string;
      agentName: string;
      healthScore: number;
      responseTimeMs: number;
      subMillisecondOps: number;
    }>;
  }> {
    if (!this.config.enableRustAgentRegistry) {
      return {
        totalAgents: 0,
        healthyAgents: 0,
        unhealthyAgents: 0,
        averageHealthScore: 0,
        topPerformingAgents: [],
      };
    }

    try {
      const registryHealth = await rustAgentRegistryClient.getRegistryHealth();
      const agents = await rustAgentRegistryClient.listAgents();
      const performanceMetrics = rustAgentRegistryClient.getAllPerformanceMetrics();

      const healthyAgents = Array.from(performanceMetrics.values()).filter(
        m => m.health_score > 0.7
      ).length;
      const unhealthyAgents = agents.length - healthyAgents;
      const avgHealthScore =
        Array.from(performanceMetrics.values()).reduce((sum, m) => sum + m.health_score, 0) /
        performanceMetrics.size;

      const topPerformingAgents = Array.from(performanceMetrics.entries())
        .sort(([, a], [, b]) => b.health_score - a.health_score)
        .slice(0, 5)
        .map(([agentId, metrics]) => {
          const agent = agents.find(a => a.id === agentId);
          return {
            agentId,
            agentName: agent?.name || 'Unknown',
            healthScore: Math.round(metrics.health_score * 100) / 100,
            responseTimeMs: Math.round(metrics.response_time_ms * 100) / 100,
            subMillisecondOps: metrics.sub_millisecond_operations,
          };
        });

      return {
        totalAgents: registryHealth.registered_agents,
        healthyAgents,
        unhealthyAgents,
        averageHealthScore: Math.round(avgHealthScore * 100) / 100,
        topPerformingAgents,
      };
    } catch (error) {
      Logger.error('❌ Failed to get agent health monitoring:', error);
      throw error;
    }
  }

  // Helper methods for Phase 2

  private mapTaskTypeToCapabilities(taskType: string): AgentCapability[] {
    const capabilityMap: Record<string, AgentCapability[]> = {
      'frontend-developer': [AgentCapability.CODE_GENERATION, AgentCapability.API_INTEGRATION],
      'backend-developer': [
        AgentCapability.CODE_GENERATION,
        AgentCapability.DATABASE_OPERATIONS,
        AgentCapability.API_INTEGRATION,
      ],
      'data-analyst': [
        AgentCapability.DATABASE_OPERATIONS,
        AgentCapability.NATURAL_LANGUAGE_PROCESSING,
      ],
      'content-creator': [AgentCapability.NATURAL_LANGUAGE_PROCESSING],
      'system-administrator': [AgentCapability.MONITORING, AgentCapability.NETWORK_OPERATIONS],
      'security-analyst': [AgentCapability.MONITORING, AgentCapability.NETWORK_OPERATIONS],
      researcher: [AgentCapability.WEB_SCRAPING, AgentCapability.NATURAL_LANGUAGE_PROCESSING],
      'general-purpose': [
        AgentCapability.NATURAL_LANGUAGE_PROCESSING,
        AgentCapability.API_INTEGRATION,
      ],
    };

    return capabilityMap[taskType] || [AgentCapability.NATURAL_LANGUAGE_PROCESSING];
  }

  private extractCapabilitiesFromContext(context: DecisionContext): AgentCapability[] {
    const taskType = context.request_data?.task_type || 'general-purpose';
    return this.mapTaskTypeToCapabilities(taskType);
  }

  // Phase 2: Enhanced Health Monitoring and Load Balancing Integration

  /**
   * Initialize health monitoring system
   */
  async initializeHealthMonitoring(): Promise<void> {
    try {
      if (!agentHealthMonitor.isMonitoringActive()) {
        await agentHealthMonitor.startMonitoring();
        Logger.info('🏥 Agent Health Monitoring initialized successfully');
      } else {
        Logger.debug('Agent Health Monitoring already active');
      }
    } catch (error) {
      Logger.error('Failed to initialize health monitoring:', error);
    }
  }

  /**
   * Shutdown health monitoring system
   */
  shutdownHealthMonitoring(): void {
    try {
      agentHealthMonitor.stopMonitoring();
      Logger.info('🛑 Agent Health Monitoring shutdown complete');
    } catch (error) {
      Logger.error('Error during health monitoring shutdown:', error);
    }
  }

  /**
   * Get intelligent load balancing recommendation with health awareness
   */
  async getIntelligentLoadBalancingRecommendation(
    taskType: string,
    performanceRequirements?: {
      max_response_time_ms?: number;
      min_health_score?: number;
      min_success_rate?: number;
    }
  ): Promise<LoadBalancingDecision | null> {
    const capabilities = this.mapTaskTypeToCapabilities(taskType);
    const capabilityStrings = capabilities.map(cap =>
      typeof cap === 'string' ? cap : cap.toString().toLowerCase()
    );

    return agentHealthMonitor.getLoadBalancingRecommendation(
      capabilityStrings,
      performanceRequirements
    );
  }

  /**
   * Get comprehensive monitoring statistics
   */
  async getSystemHealthOverview() {
    const [monitoringStats, activeAlerts, hrmStats] = await Promise.all([
      agentHealthMonitor.getMonitoringStats(),
      agentHealthMonitor.getActiveAlerts(),
      this.getAgentHealthMonitoring(),
    ]);

    return {
      monitoring: monitoringStats,
      alerts: {
        active: activeAlerts,
        critical: activeAlerts.filter(alert => alert.severity === 'critical').length,
        high: activeAlerts.filter(alert => alert.severity === 'high').length,
        medium: activeAlerts.filter(alert => alert.severity === 'medium').length,
        low: activeAlerts.filter(alert => alert.severity === 'low').length,
      },
      registry: hrmStats.registryHealth,
      performance: {
        averageResponseTime: monitoringStats.averageResponseTime,
        systemHealthScore: monitoringStats.averageHealthScore,
        uptime: monitoringStats.monitoringUptime,
        lastCheck: monitoringStats.lastHealthCheck,
      },
      recommendations: await this.generateHealthRecommendations(activeAlerts),
    };
  }

  /**
   * Generate actionable health recommendations based on current state
   */
  private async generateHealthRecommendations(activeAlerts: any[]): Promise<string[]> {
    const recommendations: string[] = [];

    if (activeAlerts.length === 0) {
      recommendations.push('✅ All agents are healthy - no immediate action required');
      return recommendations;
    }

    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    const highAlerts = activeAlerts.filter(alert => alert.severity === 'high');
    const performanceAlerts = activeAlerts.filter(alert => alert.alertType === 'performance_issue');

    if (criticalAlerts.length > 0) {
      recommendations.push(
        `🚨 CRITICAL: ${criticalAlerts.length} agent(s) in critical state - immediate intervention required`
      );
      recommendations.push('Consider restarting affected agents or scaling up resources');
    }

    if (highAlerts.length > 0) {
      recommendations.push(
        `⚠️ HIGH: ${highAlerts.length} agent(s) experiencing health degradation`
      );
      recommendations.push('Monitor closely and consider load redistribution');
    }

    if (performanceAlerts.length > 0) {
      recommendations.push(
        `🐌 PERFORMANCE: ${performanceAlerts.length} agent(s) showing slow response times`
      );
      recommendations.push('Consider optimizing agent configurations or increasing resources');
    }

    // System-wide recommendations
    const stats = await agentHealthMonitor.getMonitoringStats();
    const healthyRatio = stats.healthyAgents / stats.totalAgents;

    if (healthyRatio < 0.7) {
      recommendations.push(
        '📊 System health below optimal - consider scaling or maintenance window'
      );
    }

    return recommendations;
  }

  /**
   * Force health check on all agents
   */
  async forceSystemHealthCheck(): Promise<{
    totalChecked: number;
    healthyAgents: number;
    unhealthyAgents: number;
    newAlerts: number;
  }> {
    const agents = await rustAgentRegistryClient.listAgents();
    const results = await Promise.allSettled(
      agents.map(agent => agentHealthMonitor.forceHealthCheck(agent.id))
    );

    let healthyCount = 0;
    let unhealthyCount = 0;
    let newAlerts = 0;

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.isHealthy) {
        healthyCount++;
      } else {
        unhealthyCount++;
        if (result.status === 'rejected') {
          newAlerts++;
        }
      }
    });

    return {
      totalChecked: agents.length,
      healthyAgents: healthyCount,
      unhealthyAgents: unhealthyCount,
      newAlerts,
    };
  }

  // Phase 2: Intelligent Agent Discovery Integration

  /**
   * Discover optimal agents for task execution with HRM intelligence
   */
  async discoverOptimalAgentsWithHRM(
    taskType: string,
    complexity: 'low' | 'medium' | 'high' | 'extreme',
    additionalRequirements?: {
      urgency?: 'low' | 'medium' | 'high' | 'critical';
      domain?: string;
      resource_constraints?: {
        max_memory_mb?: number;
        max_cpu_percent?: number;
      };
    }
  ): Promise<AgentDiscoveryResult | null> {
    const capabilities = this.mapTaskTypeToCapabilities(taskType);
    const capabilityStrings = capabilities.map(cap =>
      typeof cap === 'string' ? cap : cap.toString().toLowerCase()
    );

    // Create enhanced discovery request
    const discoveryRequest: DiscoveryRequest = {
      taskType,
      complexity,
      requiredCapabilities: capabilityStrings,
      performanceRequirements: {
        max_response_time_ms: complexity === 'high' ? 2000 : complexity === 'extreme' ? 1000 : 5000,
        min_health_score: complexity === 'extreme' ? 0.9 : complexity === 'high' ? 0.8 : 0.7,
        min_success_rate: 0.85,
        resource_constraints: additionalRequirements?.resource_constraints,
      },
      contextualHints: {
        domain: additionalRequirements?.domain,
        urgency: additionalRequirements?.urgency || 'medium',
      },
    };

    const discoveryResult = await agentDiscoveryService.discoverAgents(discoveryRequest);

    if (discoveryResult) {
      Logger.info('🎯 HRM-enhanced agent discovery completed', {
        primaryAgent: discoveryResult.primaryAgent.name,
        confidence: Math.round(discoveryResult.confidence * 100),
        strategy: discoveryResult.recommendedStrategy.strategy,
        searchTimeMs: discoveryResult.discoveryMetrics.searchTimeMs,
      });
    }

    return discoveryResult;
  }

  /**
   * Register new agent with HRM integration and health monitoring
   */
  async registerAgentWithHRMIntegration(agentData: {
    name: string;
    agentType: string;
    description: string;
    capabilities: string[];
    endpoint?: string;
    version?: string;
    configuration?: {
      max_concurrent_executions?: number;
      default_timeout_seconds?: number;
      memory_limit_mb?: number;
      cpu_limit_cores?: number;
    };
  }) {
    Logger.info('📝 Registering new agent with HRM integration...', {
      name: agentData.name,
      type: agentData.agentType,
    });

    const registrationResult = await agentDiscoveryService.registerAgent({
      name: agentData.name,
      agentType: agentData.agentType,
      description: agentData.description,
      capabilities: agentData.capabilities,
      endpoint: agentData.endpoint,
      version: agentData.version,
      configuration: agentData.configuration,
    });

    if (registrationResult.success && registrationResult.agentDefinition) {
      // Initialize health monitoring for the new agent
      try {
        await agentHealthMonitor.forceHealthCheck(registrationResult.agentDefinition.id);
        Logger.info('✅ Health monitoring initialized for new agent');
      } catch (error) {
        Logger.warn('Health monitoring setup failed, will retry automatically:', error);
      }
    }

    return registrationResult;
  }

  /**
   * Enhanced decision making with integrated discovery
   */
  async makeEnhancedDecisionWithDiscovery(context: DecisionContext): Promise<
    DecisionResult & {
      discoveryResult?: AgentDiscoveryResult;
      registryMetrics?: any;
    }
  > {
    const taskType = context.request_data?.task_type || 'general-purpose';
    const complexity = this.inferComplexityFromContext(context);

    // Use intelligent discovery for agent selection
    const discoveryResult = await this.discoverOptimalAgentsWithHRM(taskType, complexity, {
      urgency: context.request_data?.priority === 'high' ? 'high' : 'medium',
      domain: context.request_data?.domain,
    });

    // Fall back to registry-enhanced decision if discovery fails
    if (!discoveryResult) {
      Logger.warn('Discovery failed, falling back to registry-enhanced decision');
      return this.makeEnhancedDecisionWithRegistry(context);
    }

    // Create HRM decision using discovered agent
    const baseDecision = await this.makeEnhancedDecisionWithRegistry(context);

    // Enhanced decision with discovery insights
    const enhancedDecision = {
      ...baseDecision,
      confidence: Math.min(0.95, baseDecision.confidence * discoveryResult.confidence),
      reasoning_steps: [
        ...baseDecision.reasoning_steps,
        {
          step: baseDecision.reasoning_steps.length + 1,
          description: 'Intelligent agent discovery integration',
          confidence: discoveryResult.confidence,
          reasoning: `Selected optimal agent "${discoveryResult.primaryAgent.name}" using ${discoveryResult.recommendedStrategy.strategy} strategy`,
          alternatives_considered: discoveryResult.alternativeAgents.length,
        },
      ],
      discoveryResult,
      registry_metrics: {
        ...baseDecision.registry_metrics,
        discovery_time_ms: discoveryResult.discoveryMetrics.searchTimeMs,
        agents_evaluated: discoveryResult.discoveryMetrics.agentsEvaluated,
        execution_strategy: discoveryResult.recommendedStrategy.strategy,
      },
    };

    Logger.debug('🧠 Enhanced HRM decision with discovery completed', {
      decisionId: enhancedDecision.decision_id,
      confidence: Math.round(enhancedDecision.confidence * 100),
      selectedAgent: discoveryResult.primaryAgent.name,
      strategy: discoveryResult.recommendedStrategy.strategy,
      discoveryTimeMs: discoveryResult.discoveryMetrics.searchTimeMs,
    });

    return enhancedDecision;
  }

  /**
   * Infer task complexity from decision context
   */
  private inferComplexityFromContext(
    context: DecisionContext
  ): 'low' | 'medium' | 'high' | 'extreme' {
    const taskType = context.request_data?.task_type;
    const hasConstraints = !!context.request_data?.execution_constraints;
    const requiresApproval = context.request_data?.execution_constraints?.require_human_approval;
    const priority = context.request_data?.priority;

    if (priority === 'critical' || requiresApproval) {
      return 'extreme';
    }

    if (priority === 'high' || hasConstraints) {
      return 'high';
    }

    if (taskType === 'code-generation' || taskType === 'data-analysis' || taskType === 'research') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get comprehensive agent discovery statistics
   */
  async getDiscoveryStatistics() {
    return {
      cacheStatus: 'Active', // Discovery service manages its own cache
      lastDiscoveryTime: new Date(),
      discoveryMethods: [
        'Capability-based matching',
        'Health-aware filtering',
        'Performance-based scoring',
        'Contextual intelligence',
        'Strategy recommendation',
      ],
    };
  }
}

// Export singleton instance
export const hrmIntegrationService = new HRMIntegrationService();

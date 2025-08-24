/**
 * Agent Discovery and Registration Service
 * Intelligent agent discovery, registration, and capability matching system
 * Part of Phase 2: Agent Registry Coordination
 */

import { Logger } from '../utils/logger';
import { rustAgentRegistryClient } from './rustAgentRegistryClient';
import { agentHealthMonitor } from './agentHealthMonitor';
import { hrmIntegrationService } from './hrmIntegrationService';
import type {
  AgentDefinition,
  AgentCapability,
  AgentType,
  AgentConfig,
} from './rustAgentRegistryClient';

export interface DiscoveryRequest {
  taskType: string;
  complexity: 'low' | 'medium' | 'high' | 'extreme';
  requiredCapabilities: string[];
  performanceRequirements?: {
    max_response_time_ms?: number;
    min_health_score?: number;
    min_success_rate?: number;
    resource_constraints?: {
      max_memory_mb?: number;
      max_cpu_percent?: number;
    };
  };
  contextualHints?: {
    domain?: string;
    language?: string;
    industry?: string;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface AgentDiscoveryResult {
  primaryAgent: AgentDefinition;
  alternativeAgents: AgentDefinition[];
  confidence: number;
  reasoning: string[];
  discoveryMetrics: {
    searchTimeMs: number;
    agentsEvaluated: number;
    capabilityMatchScore: number;
    healthScoreWeight: number;
    performanceWeight: number;
  };
  recommendedStrategy: {
    strategy: 'single_agent' | 'parallel_execution' | 'sequential_pipeline' | 'fallback_chain';
    executionPlan: Array<{
      agentId: string;
      agentName: string;
      role: 'primary' | 'secondary' | 'fallback' | 'validator';
      expectedContribution: string;
    }>;
  };
}

export interface AgentRegistrationRequest {
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
    environment_variables?: Record<string, string>;
    custom_parameters?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}

export interface RegistrationResult {
  success: boolean;
  agentDefinition?: AgentDefinition;
  registrationId: string;
  error?: string;
  warnings?: string[];
  healthCheckStatus: 'passed' | 'failed' | 'pending';
  estimatedCapabilities: string[];
}

class AgentDiscoveryService {
  private discoveryCache = new Map<string, { result: AgentDiscoveryResult; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly CAPABILITY_WEIGHTS = {
    exact_match: 1.0,
    partial_match: 0.7,
    related_capability: 0.4,
    domain_knowledge: 0.3,
    general_purpose: 0.1,
  };

  /**
   * Discover optimal agents for a given task with intelligent matching
   */
  async discoverAgents(request: DiscoveryRequest): Promise<AgentDiscoveryResult | null> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request);

    // Check cache first
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      Logger.debug('🎯 Using cached agent discovery result');
      return cached;
    }

    Logger.debug('🔍 Starting intelligent agent discovery...', {
      taskType: request.taskType,
      complexity: request.complexity,
      requiredCapabilities: request.requiredCapabilities.length,
      hasPerformanceRequirements: !!request.performanceRequirements,
      hasContextualHints: !!request.contextualHints,
    });

    try {
      // Get all available agents
      const allAgents = await rustAgentRegistryClient.listAgents();

      if (allAgents.length === 0) {
        Logger.warn('No agents available for discovery');
        return null;
      }

      // Enhanced capability matching with contextual understanding
      const scoredAgents = await this.scoreAgentsFunctionally(allAgents, request);

      if (scoredAgents.length === 0) {
        Logger.warn('No suitable agents found for task requirements');
        return null;
      }

      // Apply performance and health filtering
      const filteredAgents = await this.applyPerformanceFiltering(scoredAgents, request);

      if (filteredAgents.length === 0) {
        Logger.warn('No agents meet performance requirements');
        return null;
      }

      // Generate execution strategy
      const executionStrategy = this.generateExecutionStrategy(filteredAgents, request);

      // Build discovery result
      const result: AgentDiscoveryResult = {
        primaryAgent: filteredAgents[0].agent,
        alternativeAgents: filteredAgents.slice(1, 4).map(scored => scored.agent),
        confidence: filteredAgents[0].totalScore,
        reasoning: filteredAgents[0].reasoning,
        discoveryMetrics: {
          searchTimeMs: Date.now() - startTime,
          agentsEvaluated: allAgents.length,
          capabilityMatchScore: filteredAgents[0].capabilityScore,
          healthScoreWeight: filteredAgents[0].healthScore,
          performanceWeight: filteredAgents[0].performanceScore,
        },
        recommendedStrategy: executionStrategy,
      };

      // Cache the result
      this.setCachedResult(cacheKey, result);

      Logger.debug('✅ Agent discovery completed successfully', {
        primaryAgent: result.primaryAgent.name,
        alternativeCount: result.alternativeAgents.length,
        confidence: Math.round(result.confidence * 100),
        searchTimeMs: result.discoveryMetrics.searchTimeMs,
        strategy: result.recommendedStrategy.strategy,
      });

      return result;
    } catch (error) {
      Logger.error('Agent discovery failed:', error);
      return null;
    }
  }

  /**
   * Score agents based on functional capability matching with context awareness
   */
  private async scoreAgentsFunctionally(
    agents: AgentDefinition[],
    request: DiscoveryRequest
  ): Promise<
    Array<{
      agent: AgentDefinition;
      capabilityScore: number;
      healthScore: number;
      performanceScore: number;
      totalScore: number;
      reasoning: string[];
    }>
  > {
    const scoredAgents = await Promise.all(
      agents.map(async agent => {
        const reasoning: string[] = [];

        // Capability matching score
        const capabilityScore = this.calculateCapabilityScore(agent, request, reasoning);

        // Health score from monitoring system
        let healthScore = 0.8; // Default if no health data
        try {
          const metrics = await rustAgentRegistryClient.getAgentPerformanceMetrics(agent.id);
          healthScore = metrics.health_score;
          reasoning.push(`Agent health score: ${Math.round(healthScore * 100)}%`);
        } catch {
          reasoning.push('Health metrics unavailable, using default score');
        }

        // Performance score based on historical data
        const performanceScore = await this.calculatePerformanceScore(agent, request, reasoning);

        // Contextual bonus scoring
        const contextualScore = this.calculateContextualScore(agent, request, reasoning);

        // Weighted total score
        const totalScore =
          capabilityScore * 0.4 +
          healthScore * 0.25 +
          performanceScore * 0.25 +
          contextualScore * 0.1;

        return {
          agent,
          capabilityScore,
          healthScore,
          performanceScore,
          totalScore,
          reasoning,
        };
      })
    );

    // Sort by total score (descending)
    return scoredAgents
      .sort((a, b) => b.totalScore - a.totalScore)
      .filter(scored => scored.totalScore > 0.3); // Minimum viability threshold
  }

  /**
   * Calculate capability matching score with intelligent fuzzy matching
   */
  private calculateCapabilityScore(
    agent: AgentDefinition,
    request: DiscoveryRequest,
    reasoning: string[]
  ): number {
    const agentCapabilities = agent.capabilities.map(cap =>
      typeof cap === 'string' ? cap.toLowerCase() : cap.toString().toLowerCase()
    );
    const requiredCapabilities = request.requiredCapabilities.map(cap => cap.toLowerCase());

    let totalScore = 0;
    let matchedCapabilities = 0;

    for (const required of requiredCapabilities) {
      let bestMatch = 0;
      let matchType = '';

      for (const agentCap of agentCapabilities) {
        // Exact match
        if (agentCap === required) {
          bestMatch = Math.max(bestMatch, this.CAPABILITY_WEIGHTS.exact_match);
          matchType = 'exact';
        }
        // Partial match (contains)
        else if (agentCap.includes(required) || required.includes(agentCap)) {
          bestMatch = Math.max(bestMatch, this.CAPABILITY_WEIGHTS.partial_match);
          if (!matchType) matchType = 'partial';
        }
        // Semantic/domain matching
        else if (this.isRelatedCapability(required, agentCap)) {
          bestMatch = Math.max(bestMatch, this.CAPABILITY_WEIGHTS.related_capability);
          if (!matchType) matchType = 'related';
        }
      }

      // General purpose agents can handle basic tasks
      if (bestMatch === 0 && this.isGeneralPurposeCapable(agent, required)) {
        bestMatch = this.CAPABILITY_WEIGHTS.general_purpose;
        matchType = 'general';
      }

      if (bestMatch > 0) {
        totalScore += bestMatch;
        matchedCapabilities++;
        reasoning.push(
          `Capability "${required}": ${matchType} match (${Math.round(bestMatch * 100)}%)`
        );
      } else {
        reasoning.push(`Capability "${required}": No match found`);
      }
    }

    const finalScore =
      requiredCapabilities.length > 0 ? totalScore / requiredCapabilities.length : 0;
    reasoning.push(`Overall capability score: ${Math.round(finalScore * 100)}%`);

    return finalScore;
  }

  /**
   * Calculate performance score based on historical metrics and requirements
   */
  private async calculatePerformanceScore(
    agent: AgentDefinition,
    request: DiscoveryRequest,
    reasoning: string[]
  ): Promise<number> {
    try {
      const metrics = await rustAgentRegistryClient.getAgentPerformanceMetrics(agent.id);
      let score = 0.5; // Base score

      // Response time scoring
      const responseTime = metrics.avg_response_time_ms;
      if (request.performanceRequirements?.max_response_time_ms) {
        const maxTime = request.performanceRequirements.max_response_time_ms;
        if (responseTime <= maxTime) {
          score += 0.3 * (1 - responseTime / maxTime);
          reasoning.push(`Response time within limits: ${responseTime}ms <= ${maxTime}ms`);
        } else {
          reasoning.push(`Response time exceeds limit: ${responseTime}ms > ${maxTime}ms`);
        }
      }

      // Success rate scoring
      const successRate = 1.0 - metrics.error_rate;
      if (request.performanceRequirements?.min_success_rate) {
        const minRate = request.performanceRequirements.min_success_rate;
        if (successRate >= minRate) {
          score += 0.2 * (successRate / minRate);
          reasoning.push(
            `Success rate meets requirement: ${Math.round(successRate * 100)}% >= ${Math.round(minRate * 100)}%`
          );
        } else {
          score -= 0.2;
          reasoning.push(
            `Success rate below requirement: ${Math.round(successRate * 100)}% < ${Math.round(minRate * 100)}%`
          );
        }
      }

      return Math.max(0, Math.min(1, score));
    } catch (error) {
      reasoning.push('Performance metrics unavailable, using default score');
      return 0.5;
    }
  }

  /**
   * Calculate contextual scoring based on domain knowledge and hints
   */
  private calculateContextualScore(
    agent: AgentDefinition,
    request: DiscoveryRequest,
    reasoning: string[]
  ): number {
    let score = 0;

    if (!request.contextualHints) return 0;

    // Domain expertise scoring
    if (request.contextualHints.domain) {
      const domain = request.contextualHints.domain.toLowerCase();
      const agentName = agent.name.toLowerCase();
      const agentDescription = agent.description.toLowerCase();

      if (agentName.includes(domain) || agentDescription.includes(domain)) {
        score += 0.5;
        reasoning.push(`Domain expertise detected: ${request.contextualHints.domain}`);
      }
    }

    // Urgency matching
    if (request.contextualHints.urgency) {
      const urgency = request.contextualHints.urgency;
      // High-performance agents for urgent tasks
      if (urgency === 'critical' || urgency === 'high') {
        if (agent.agent_type === 'task_automator' || agent.agent_type === 'performance_optimizer') {
          score += 0.3;
          reasoning.push(`Agent type suitable for urgent tasks: ${agent.agent_type}`);
        }
      }
    }

    return Math.min(1, score);
  }

  /**
   * Check if two capabilities are semantically related
   */
  private isRelatedCapability(required: string, available: string): boolean {
    const relationshipMap = {
      code: ['programming', 'development', 'software', 'coding'],
      data: ['analysis', 'processing', 'science', 'analytics'],
      text: ['language', 'nlp', 'writing', 'content'],
      web: ['scraping', 'crawling', 'http', 'api'],
      file: ['storage', 'filesystem', 'document', 'io'],
      image: ['vision', 'visual', 'graphics', 'photo'],
      audio: ['sound', 'voice', 'speech', 'music'],
      network: ['connection', 'socket', 'protocol', 'communication'],
    };

    for (const [key, related] of Object.entries(relationshipMap)) {
      if (
        (required.includes(key) && related.some(r => available.includes(r))) ||
        (available.includes(key) && related.some(r => required.includes(r)))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if agent can handle capability as general purpose
   */
  private isGeneralPurposeCapable(agent: AgentDefinition, required: string): boolean {
    const generalCapabilities = ['natural_language_processing', 'api_integration'];
    const agentCapabilities = agent.capabilities.map(cap =>
      typeof cap === 'string' ? cap.toLowerCase() : cap.toString().toLowerCase()
    );

    return (
      generalCapabilities.some(cap => agentCapabilities.includes(cap)) &&
      ['conversational', 'code_assistant'].includes(agent.agent_type as string)
    );
  }

  /**
   * Apply performance filtering based on requirements
   */
  private async applyPerformanceFiltering(
    scoredAgents: Array<{
      agent: AgentDefinition;
      capabilityScore: number;
      healthScore: number;
      performanceScore: number;
      totalScore: number;
      reasoning: string[];
    }>,
    request: DiscoveryRequest
  ): Promise<typeof scoredAgents> {
    if (!request.performanceRequirements) {
      return scoredAgents;
    }

    const requirements = request.performanceRequirements;
    const filtered = [];

    for (const scored of scoredAgents) {
      let passesFilter = true;

      // Health score filter
      if (requirements.min_health_score && scored.healthScore < requirements.min_health_score) {
        scored.reasoning.push(
          `Filtered out: Health score ${Math.round(scored.healthScore * 100)}% below minimum ${Math.round(requirements.min_health_score * 100)}%`
        );
        passesFilter = false;
      }

      // Performance filters would go here (response time, etc.)

      if (passesFilter) {
        filtered.push(scored);
      }
    }

    return filtered;
  }

  /**
   * Generate execution strategy based on discovered agents and task complexity
   */
  private generateExecutionStrategy(
    scoredAgents: Array<{ agent: AgentDefinition; totalScore: number; reasoning: string[] }>,
    request: DiscoveryRequest
  ): AgentDiscoveryResult['recommendedStrategy'] {
    const complexity = request.complexity;
    const agentCount = scoredAgents.length;

    // Simple strategy selection based on complexity and available agents
    if (complexity === 'low' || agentCount === 1) {
      return {
        strategy: 'single_agent',
        executionPlan: [
          {
            agentId: scoredAgents[0].agent.id,
            agentName: scoredAgents[0].agent.name,
            role: 'primary',
            expectedContribution: 'Complete task execution',
          },
        ],
      };
    }

    if (complexity === 'high' || complexity === 'extreme') {
      return {
        strategy: 'fallback_chain',
        executionPlan: scoredAgents.slice(0, 3).map((scored, index) => ({
          agentId: scored.agent.id,
          agentName: scored.agent.name,
          role: index === 0 ? 'primary' : index === 1 ? 'secondary' : 'fallback',
          expectedContribution:
            index === 0
              ? 'Primary execution'
              : index === 1
                ? 'Backup execution'
                : 'Fallback option',
        })),
      };
    }

    return {
      strategy: 'sequential_pipeline',
      executionPlan: scoredAgents.slice(0, 2).map((scored, index) => ({
        agentId: scored.agent.id,
        agentName: scored.agent.name,
        role: index === 0 ? 'primary' : 'validator',
        expectedContribution: index === 0 ? 'Main processing' : 'Result validation',
      })),
    };
  }

  /**
   * Register a new agent with the system
   */
  async registerAgent(request: AgentRegistrationRequest): Promise<RegistrationResult> {
    const startTime = Date.now();
    const registrationId = `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    Logger.info('📝 Starting agent registration...', {
      name: request.name,
      type: request.agentType,
      capabilities: request.capabilities.length,
      registrationId,
    });

    try {
      // Map capabilities to AgentCapability enum
      const mappedCapabilities = this.mapStringCapabilitiesToEnum(request.capabilities);

      // Map agent type to AgentType enum
      const mappedAgentType = this.mapStringAgentTypeToEnum(request.agentType);

      // Create agent configuration
      const agentConfig: AgentConfig = {
        max_concurrent_executions: request.configuration?.max_concurrent_executions || 10,
        default_timeout_seconds: request.configuration?.default_timeout_seconds || 30,
        memory_limit_mb: request.configuration?.memory_limit_mb,
        cpu_limit_cores: request.configuration?.cpu_limit_cores,
        environment: request.configuration?.environment_variables || {},
        parameters: request.configuration?.custom_parameters || {},
        health_check: request.endpoint
          ? {
              endpoint: `${request.endpoint}/health`,
              interval_seconds: 60,
              timeout_seconds: 10,
              failure_threshold: 3,
            }
          : undefined,
        retry_config: {
          max_retries: 3,
          initial_delay_ms: 1000,
          backoff_multiplier: 2.0,
          max_delay_ms: 10000,
        },
      };

      // Register with Rust Agent Registry
      const agentDefinition = await rustAgentRegistryClient.registerAgent({
        name: request.name,
        agent_type: mappedAgentType,
        description: request.description,
        capabilities: mappedCapabilities,
        config: agentConfig,
        version: request.version || '1.0.0',
        endpoint: request.endpoint,
      });

      // Perform initial health check
      let healthCheckStatus: 'passed' | 'failed' | 'pending' = 'pending';
      if (request.endpoint) {
        try {
          await rustAgentRegistryClient.checkAgentHealth(agentDefinition.id);
          healthCheckStatus = 'passed';
        } catch {
          healthCheckStatus = 'failed';
        }
      }

      const registrationTime = Date.now() - startTime;

      Logger.info('✅ Agent registration completed successfully', {
        agentId: agentDefinition.id,
        name: agentDefinition.name,
        registrationId,
        registrationTimeMs: registrationTime,
        healthCheckStatus,
      });

      return {
        success: true,
        agentDefinition,
        registrationId,
        healthCheckStatus,
        estimatedCapabilities: request.capabilities,
      };
    } catch (error) {
      Logger.error('❌ Agent registration failed:', error);

      return {
        success: false,
        registrationId,
        error: error instanceof Error ? error.message : String(error),
        healthCheckStatus: 'failed',
        estimatedCapabilities: [],
      };
    }
  }

  /**
   * Map string capabilities to AgentCapability enum
   */
  private mapStringCapabilitiesToEnum(capabilities: string[]): AgentCapability[] {
    const mappingTable: Record<string, AgentCapability> = {
      natural_language_processing: AgentCapability.NATURAL_LANGUAGE_PROCESSING,
      nlp: AgentCapability.NATURAL_LANGUAGE_PROCESSING,
      code_generation: AgentCapability.CODE_GENERATION,
      coding: AgentCapability.CODE_GENERATION,
      programming: AgentCapability.CODE_GENERATION,
      image_processing: AgentCapability.IMAGE_PROCESSING,
      vision: AgentCapability.IMAGE_PROCESSING,
      audio_processing: AgentCapability.AUDIO_PROCESSING,
      speech: AgentCapability.AUDIO_PROCESSING,
      voice: AgentCapability.AUDIO_PROCESSING,
      video_processing: AgentCapability.VIDEO_PROCESSING,
      web_scraping: AgentCapability.WEB_SCRAPING,
      scraping: AgentCapability.WEB_SCRAPING,
      api_integration: AgentCapability.API_INTEGRATION,
      api: AgentCapability.API_INTEGRATION,
      database_operations: AgentCapability.DATABASE_OPERATIONS,
      database: AgentCapability.DATABASE_OPERATIONS,
      db: AgentCapability.DATABASE_OPERATIONS,
      file_system_operations: AgentCapability.FILE_SYSTEM_OPERATIONS,
      file_system: AgentCapability.FILE_SYSTEM_OPERATIONS,
      filesystem: AgentCapability.FILE_SYSTEM_OPERATIONS,
      network_operations: AgentCapability.NETWORK_OPERATIONS,
      network: AgentCapability.NETWORK_OPERATIONS,
      real_time_communication: AgentCapability.REAL_TIME_COMMUNICATION,
      websocket: AgentCapability.REAL_TIME_COMMUNICATION,
      scheduling: AgentCapability.SCHEDULING,
      automation: AgentCapability.SCHEDULING,
      monitoring: AgentCapability.MONITORING,
      alerts: AgentCapability.MONITORING,
    };

    return capabilities
      .map(cap => mappingTable[cap.toLowerCase()] || AgentCapability.CUSTOM(cap))
      .filter(cap => cap !== undefined);
  }

  /**
   * Map string agent type to AgentType enum
   */
  private mapStringAgentTypeToEnum(agentType: string): AgentType {
    const mappingTable: Record<string, AgentType> = {
      conversational: AgentType.CONVERSATIONAL,
      code_assistant: AgentType.CODE_ASSISTANT,
      data_processor: AgentType.DATA_PROCESSOR,
      content_creator: AgentType.CONTENT_CREATOR,
      researcher: AgentType.RESEARCHER,
      task_automator: AgentType.TASK_AUTOMATOR,
      security_analyzer: AgentType.SECURITY_ANALYZER,
      performance_optimizer: AgentType.PERFORMANCE_OPTIMIZER,
    };

    return mappingTable[agentType.toLowerCase()] || AgentType.CUSTOM(agentType);
  }

  /**
   * Generate cache key for discovery requests
   */
  private generateCacheKey(request: DiscoveryRequest): string {
    const key = {
      taskType: request.taskType,
      complexity: request.complexity,
      capabilities: request.requiredCapabilities.sort(),
      requirements: request.performanceRequirements,
      context: request.contextualHints,
    };
    return btoa(JSON.stringify(key));
  }

  /**
   * Get cached discovery result if still valid
   */
  private getCachedResult(cacheKey: string): AgentDiscoveryResult | null {
    const cached = this.discoveryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.result;
    }
    if (cached) {
      this.discoveryCache.delete(cacheKey);
    }
    return null;
  }

  /**
   * Cache discovery result
   */
  private setCachedResult(cacheKey: string, result: AgentDiscoveryResult): void {
    this.discoveryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    if (this.discoveryCache.size > 100) {
      const oldEntries = Array.from(this.discoveryCache.entries())
        .filter(([, data]) => Date.now() - data.timestamp > this.CACHE_TTL_MS)
        .map(([key]) => key);

      oldEntries.forEach(key => this.discoveryCache.delete(key));
    }
  }

  /**
   * Clear discovery cache
   */
  clearCache(): void {
    this.discoveryCache.clear();
    Logger.debug('🗑️ Agent discovery cache cleared');
  }
}

// Export singleton instance
export const agentDiscoveryService = new AgentDiscoveryService();
export default agentDiscoveryService;

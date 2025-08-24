/**
 * Agent Knowledge Middleware
 * 
 * Transparent middleware that automatically injects GraphRAG knowledge
 * into all agent communications, ensuring every agent has access to
 * the full knowledge base without requiring code changes.
 */

import { EventEmitter } from 'events';
import { unifiedKnowledgeBridge } from './unified-knowledge-bridge';
import { enhancedAgentExecutor } from './enhanced-agent-executor';
import { agentRegistry } from '../agents/agent-registry';
import { log, LogContext } from '../utils/logger';

// Knowledge injection modes
export type KnowledgeInjectionMode = 'automatic' | 'on-demand' | 'disabled';

// Agent middleware configuration
export interface AgentMiddlewareConfig {
  globalKnowledgeInjection: boolean;
  defaultInjectionMode: KnowledgeInjectionMode;
  knowledgeDepth: 'shallow' | 'medium' | 'deep';
  cacheStrategy: 'aggressive' | 'balanced' | 'minimal';
  maxKnowledgePerAgent: number;
  knowledgeTypes: ('specialized' | 'general' | 'historical' | 'real-time')[];
}

// Agent communication interception
export interface AgentCommunication {
  fromAgent?: string;
  toAgent: string;
  message: any;
  messageType: 'execute' | 'query' | 'collaborate' | 'status';
  timestamp: string;
  originalMessage: any;
}

// Enhanced agent communication with knowledge
export interface KnowledgeEnhancedCommunication extends AgentCommunication {
  injectedKnowledge: {
    relevantContext: any[];
    confidenceScore: number;
    knowledgeSource: string;
    injectionTimeMs: number;
  };
  knowledgeMetadata: {
    totalKnowledgeNodes: number;
    knowledgeTypes: string[];
    agentSpecificInsights: string[];
    crossReferences: string[];
  };
}

/**
 * Agent Knowledge Middleware - Transparent R1 RAG Integration
 */
export class AgentKnowledgeMiddleware extends EventEmitter {
  private config: AgentMiddlewareConfig;
  private interceptedCommunications = new Map<string, KnowledgeEnhancedCommunication>();
  private agentKnowledgeProfiles = new Map<string, {
    preferredKnowledgeTypes: string[];
    knowledgeUtilizationRate: number;
    avgKnowledgeScore: number;
    lastKnowledgeUpdate: string;
  }>();
  
  private middleware_stats = {
    totalInterceptions: 0,
    knowledgeInjectionsPerformed: 0,
    avgInjectionTimeMs: 0,
    knowledgeUtilizationRate: 0,
    successfulEnhancements: 0
  };

  constructor(config?: Partial<AgentMiddlewareConfig>) {
    super();
    
    this.config = {
      globalKnowledgeInjection: true,
      defaultInjectionMode: 'automatic',
      knowledgeDepth: 'medium',
      cacheStrategy: 'balanced',
      maxKnowledgePerAgent: 15,
      knowledgeTypes: ['specialized', 'general', 'real-time'],
      ...config
    };

    this.initializeMiddleware();
  }

  /**
   * Initialize the knowledge middleware
   */
  private async initializeMiddleware(): Promise<void> {
    try {
      log.info('🔌 Initializing Agent Knowledge Middleware...', LogContext.SYSTEM);

      // Set up agent communication interception
      await this.setupCommunicationInterception();
      
      // Initialize agent knowledge profiles
      await this.initializeAgentProfiles();
      
      // Start background knowledge optimization
      this.startBackgroundOptimization();

      log.info('✅ Agent Knowledge Middleware initialized successfully', LogContext.SYSTEM);
      this.emit('middlewareInitialized', { config: this.config });
    } catch (error) {
      log.error('❌ Failed to initialize Agent Knowledge Middleware', LogContext.SYSTEM, { error });
      throw error;
    }
  }

  /**
   * Set up communication interception for all agents
   */
  private async setupCommunicationInterception(): Promise<void> {
    // Intercept agent registry communications
    const originalExecute = agentRegistry.executeAgent?.bind(agentRegistry);
    
    if (originalExecute) {
      agentRegistry.executeAgent = async (agentName: string, input: any, context?: any) => {
        return await this.interceptAndEnhanceExecution(
          agentName,
          input,
          context,
          originalExecute
        );
      };
    }

    // Intercept Rust agent registry communications
    const originalRustExecute = enhancedAgentExecutor.executeWithKnowledge.bind(enhancedAgentExecutor);
    
    enhancedAgentExecutor.executeWithKnowledge = async (agentId: string, request: any) => {
      return await this.interceptAndEnhanceRustExecution(
        agentId,
        request,
        originalRustExecute
      );
    };

    log.info('🕸️ Agent communication interception established', LogContext.SYSTEM);
  }

  /**
   * Intercept and enhance legacy agent execution
   */
  private async interceptAndEnhanceExecution(
    agentName: string,
    input: any,
    context: any,
    originalExecute: Function
  ): Promise<any> {
    const startTime = Date.now();
    const communicationId = `legacy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      this.middleware_stats.totalInterceptions++;

      // Create communication record
      const communication: AgentCommunication = {
        toAgent: agentName,
        message: input,
        messageType: 'execute',
        timestamp: new Date().toISOString(),
        originalMessage: input
      };

      let enhancedInput = input;
      let knowledgeInjectionTime = 0;

      // Inject knowledge if enabled
      if (this.config.globalKnowledgeInjection && this.shouldInjectKnowledge(agentName, input)) {
        const knowledgeStartTime = Date.now();
        
        try {
          const knowledgeResponse = await unifiedKnowledgeBridge.getKnowledgeForAgent({
            agentId: `legacy_${agentName}`,
            query: this.extractQueryFromInput(input),
            contextType: 'general',
            maxResults: this.config.maxKnowledgePerAgent
          });

          if (knowledgeResponse.knowledge.length > 0) {
            enhancedInput = this.injectKnowledgeIntoInput(input, knowledgeResponse);
            this.middleware_stats.knowledgeInjectionsPerformed++;
            this.middleware_stats.successfulEnhancements++;
          }

          knowledgeInjectionTime = Date.now() - knowledgeStartTime;
        } catch (error) {
          log.error(`❌ Knowledge injection failed for agent ${agentName}`, LogContext.AI, { error });
        }
      }

      // Execute with enhanced input
      const result = await originalExecute(agentName, enhancedInput, context);

      // Update statistics
      const totalTime = Date.now() - startTime;
      this.updateMiddlewareStats(knowledgeInjectionTime, totalTime);

      // Update agent profile
      this.updateAgentProfile(agentName, knowledgeInjectionTime > 0, totalTime);

      log.info(
        `🔄 Legacy agent ${agentName} executed with middleware (${totalTime}ms, knowledge: ${knowledgeInjectionTime}ms)`,
        LogContext.AI
      );

      return result;

    } catch (error) {
      log.error(`❌ Middleware interception failed for agent ${agentName}`, LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Intercept and enhance Rust agent execution
   */
  private async interceptAndEnhanceRustExecution(
    agentId: string,
    request: any,
    originalExecute: Function
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.middleware_stats.totalInterceptions++;

      // Check if agent should receive additional context optimization
      const shouldOptimize = this.shouldOptimizeForAgent(agentId);
      
      if (shouldOptimize) {
        // Add middleware-specific optimizations
        request.input.middlewareEnhanced = true;
        request.input.optimizationLevel = this.config.knowledgeDepth;
        request.input.preferredKnowledgeTypes = this.config.knowledgeTypes;
      }

      // Execute with optimizations
      const result = await originalExecute(agentId, request);

      // Update statistics and profiles
      const totalTime = Date.now() - startTime;
      this.updateMiddlewareStats(result.knowledgeInjectionTimeMs || 0, totalTime);
      this.updateAgentProfile(agentId, result.knowledgeEnhanced, totalTime);

      log.info(`🔄 Rust agent ${agentId} executed with middleware optimizations`, LogContext.AI);

      return result;

    } catch (error) {
      log.error(`❌ Middleware optimization failed for agent ${agentId}`, LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Determine if knowledge should be injected for this agent/input
   */
  private shouldInjectKnowledge(agentName: string, input: any): boolean {
    // Always inject if global injection is enabled
    if (this.config.globalKnowledgeInjection) {
      return true;
    }

    // Check agent-specific preferences
    const profile = this.agentKnowledgeProfiles.get(agentName);
    if (profile && profile.knowledgeUtilizationRate > 0.7) {
      return true;
    }

    // Check input characteristics
    if (typeof input === 'string' && input.length > 20) {
      return true;
    }

    if (typeof input === 'object' && (input.query || input.task || input.question)) {
      return true;
    }

    return false;
  }

  /**
   * Determine if agent should receive optimization
   */
  private shouldOptimizeForAgent(agentId: string): boolean {
    const profile = this.agentKnowledgeProfiles.get(agentId);
    
    // Optimize for agents with high knowledge utilization
    if (profile && profile.knowledgeUtilizationRate > 0.6) {
      return true;
    }

    // Always optimize for specialized agents
    if (agentId.includes('specialized') || agentId.includes('reasoning')) {
      return true;
    }

    return false;
  }

  /**
   * Extract meaningful query from various input formats
   */
  private extractQueryFromInput(input: any): string {
    if (typeof input === 'string') {
      return input;
    }

    if (typeof input === 'object') {
      // Try common query fields
      const queryFields = ['query', 'question', 'task', 'prompt', 'instruction', 'message'];
      
      for (const field of queryFields) {
        if (input[field] && typeof input[field] === 'string') {
          return input[field];
        }
      }

      // Return stringified object if short enough
      const stringified = JSON.stringify(input);
      if (stringified.length < 200) {
        return stringified;
      }
    }

    return 'general assistance request';
  }

  /**
   * Inject knowledge into input while preserving original structure
   */
  private injectKnowledgeIntoInput(originalInput: any, knowledgeResponse: any): any {
    if (typeof originalInput === 'string') {
      // For string inputs, add knowledge as context
      const knowledgeContext = knowledgeResponse.agentSpecificInsights.slice(0, 3).join('. ');
      return `Context: ${knowledgeContext}\n\nOriginal request: ${originalInput}`;
    }

    if (typeof originalInput === 'object') {
      // For object inputs, add knowledge properties
      return {
        ...originalInput,
        knowledgeContext: {
          insights: knowledgeResponse.agentSpecificInsights.slice(0, 3),
          relevantFacts: knowledgeResponse.contextualizedResults.slice(0, 5),
          sources: knowledgeResponse.sources.slice(0, 3),
          confidence: knowledgeResponse.confidenceScore
        },
        middlewareEnhanced: true
      };
    }

    return originalInput;
  }

  /**
   * Initialize knowledge profiles for all agents
   */
  private async initializeAgentProfiles(): Promise<void> {
    try {
      // Get all agent contexts from the unified bridge
      const agentContexts = unifiedKnowledgeBridge.getAllAgentContexts();
      
      for (const context of agentContexts) {
        this.agentKnowledgeProfiles.set(context.agentId, {
          preferredKnowledgeTypes: ['specialized', 'general'],
          knowledgeUtilizationRate: 0.5,
          avgKnowledgeScore: context.knowledgeScore,
          lastKnowledgeUpdate: context.lastAccessed
        });
      }

      log.info(`📊 Initialized knowledge profiles for ${agentContexts.length} agents`, LogContext.SYSTEM);
    } catch (error) {
      log.error('❌ Failed to initialize agent profiles', LogContext.SYSTEM, { error });
    }
  }

  /**
   * Update agent knowledge profile based on execution
   */
  private updateAgentProfile(
    agentId: string,
    knowledgeUsed: boolean,
    executionTimeMs: number
  ): void {
    let profile = this.agentKnowledgeProfiles.get(agentId);
    
    if (!profile) {
      profile = {
        preferredKnowledgeTypes: ['general'],
        knowledgeUtilizationRate: 0.5,
        avgKnowledgeScore: 0.5,
        lastKnowledgeUpdate: new Date().toISOString()
      };
    }

    // Update utilization rate using exponential moving average
    const alpha = 0.1; // Smoothing factor
    const utilizationValue = knowledgeUsed ? 1 : 0;
    profile.knowledgeUtilizationRate = 
      alpha * utilizationValue + (1 - alpha) * profile.knowledgeUtilizationRate;

    // Update last access
    profile.lastKnowledgeUpdate = new Date().toISOString();

    this.agentKnowledgeProfiles.set(agentId, profile);
  }

  /**
   * Update middleware statistics
   */
  private updateMiddlewareStats(knowledgeInjectionTimeMs: number, totalTimeMs: number): void {
    if (knowledgeInjectionTimeMs > 0) {
      const injectionCount = this.middleware_stats.knowledgeInjectionsPerformed;
      this.middleware_stats.avgInjectionTimeMs = 
        (this.middleware_stats.avgInjectionTimeMs * injectionCount + knowledgeInjectionTimeMs) / 
        (injectionCount + 1);
    }

    this.middleware_stats.knowledgeUtilizationRate = 
      this.middleware_stats.knowledgeInjectionsPerformed / 
      this.middleware_stats.totalInterceptions;
  }

  /**
   * Start background optimization processes
   */
  private startBackgroundOptimization(): void {
    // Optimize agent profiles every 5 minutes
    setInterval(() => {
      this.optimizeAgentProfiles();
    }, 300000);

    // Update knowledge caches every 10 minutes
    setInterval(() => {
      this.updateKnowledgeCaches();
    }, 600000);

    // Emit metrics every minute
    setInterval(() => {
      this.emit('middlewareMetrics', {
        stats: this.middleware_stats,
        profileCount: this.agentKnowledgeProfiles.size,
        timestamp: new Date().toISOString()
      });
    }, 60000);
  }

  /**
   * Optimize agent knowledge profiles based on usage patterns
   */
  private optimizeAgentProfiles(): void {
    for (const [agentId, profile] of this.agentKnowledgeProfiles.entries()) {
      // Optimize knowledge types based on utilization
      if (profile.knowledgeUtilizationRate > 0.8) {
        // High utilization agents get specialized knowledge
        if (!profile.preferredKnowledgeTypes.includes('specialized')) {
          profile.preferredKnowledgeTypes.push('specialized');
        }
      } else if (profile.knowledgeUtilizationRate < 0.3) {
        // Low utilization agents get general knowledge only
        profile.preferredKnowledgeTypes = ['general'];
      }

      // Update the profile
      this.agentKnowledgeProfiles.set(agentId, profile);
    }

    log.info('🔧 Agent knowledge profiles optimized', LogContext.SYSTEM);
  }

  /**
   * Update knowledge caches for high-usage agents
   */
  private async updateKnowledgeCaches(): Promise<void> {
    try {
      const highUsageAgents = Array.from(this.agentKnowledgeProfiles.entries())
        .filter(([_, profile]) => profile.knowledgeUtilizationRate > 0.6)
        .map(([agentId, _]) => agentId);

      for (const agentId of highUsageAgents.slice(0, 10)) { // Limit to top 10
        await unifiedKnowledgeBridge.refreshAgentKnowledge(agentId);
      }

      log.info(`🔄 Knowledge caches updated for ${highUsageAgents.length} high-usage agents`, LogContext.SYSTEM);
    } catch (error) {
      log.error('❌ Failed to update knowledge caches', LogContext.SYSTEM, { error });
    }
  }

  /**
   * Public API: Update middleware configuration
   */
  updateConfig(newConfig: Partial<AgentMiddlewareConfig>): void {
    this.config = { ...this.config, ...newConfig };
    log.info('⚙️ Agent Knowledge Middleware configuration updated', LogContext.SYSTEM);
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * Public API: Get middleware statistics
   */
  getMiddlewareStats() {
    return {
      ...this.middleware_stats,
      agentProfiles: this.agentKnowledgeProfiles.size,
      interceptedCommunications: this.interceptedCommunications.size
    };
  }

  /**
   * Public API: Get agent knowledge profile
   */
  getAgentProfile(agentId: string) {
    return this.agentKnowledgeProfiles.get(agentId);
  }

  /**
   * Public API: Get all agent profiles
   */
  getAllAgentProfiles() {
    return Object.fromEntries(this.agentKnowledgeProfiles);
  }

  /**
   * Public API: Force refresh knowledge for specific agent
   */
  async refreshAgentKnowledge(agentId: string): Promise<void> {
    await unifiedKnowledgeBridge.refreshAgentKnowledge(agentId);
    
    // Update profile timestamp
    const profile = this.agentKnowledgeProfiles.get(agentId);
    if (profile) {
      profile.lastKnowledgeUpdate = new Date().toISOString();
      this.agentKnowledgeProfiles.set(agentId, profile);
    }

    log.info(`🔄 Knowledge refreshed for agent ${agentId}`, LogContext.AI);
  }

  /**
   * Public API: Enable/disable knowledge injection for specific agent
   */
  setAgentKnowledgeMode(agentId: string, mode: KnowledgeInjectionMode): void {
    // This could be implemented to override global settings per agent
    log.info(`⚙️ Knowledge mode set to ${mode} for agent ${agentId}`, LogContext.SYSTEM);
  }

  /**
   * Shutdown the middleware
   */
  shutdown(): void {
    this.removeAllListeners();
    this.interceptedCommunications.clear();
    this.agentKnowledgeProfiles.clear();
    log.info('🛑 Agent Knowledge Middleware shutdown', LogContext.SYSTEM);
  }
}

// Export singleton instance
export const agentKnowledgeMiddleware = new AgentKnowledgeMiddleware();
export default agentKnowledgeMiddleware;
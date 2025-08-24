/**
 * Unified Knowledge Bridge
 * 
 * Central service that connects all agents to the R1 RAG system,
 * providing seamless knowledge flow and context sharing across
 * the entire agent ecosystem.
 * 
 * Features:
 * - Direct R1 RAG integration for all agents
 * - Unified context management
 * - Agent-specific knowledge contextualization
 * - Real-time knowledge synchronization
 * - Performance-optimized knowledge retrieval
 */

import { EventEmitter } from 'events';
import { knowledgeGraphService, type GraphQuery, type GraphPath } from './graph-rag/knowledge-graph-service';
import { rustAgentRegistry, type RustAgentDefinition } from './rust-agent-registry-client';
import { contextStorageService } from './context-storage-service';
import { semanticContextRetrievalService } from './semantic-context-retrieval';
import { log, LogContext } from '../utils/logger';

// Unified Knowledge Types
export interface AgentKnowledgeContext {
  agentId: string;
  agentName: string;
  agentType: string;
  personalizedContext: Record<string, any>;
  relevantKnowledge: GraphPath[];
  contextHistory: string[];
  lastAccessed: string;
  knowledgeScore: number;
}

export interface KnowledgeRequest {
  agentId: string;
  query: string;
  contextType?: 'specialized' | 'general' | 'historical' | 'real-time';
  maxResults?: number;
  includeRelated?: boolean;
  timeRange?: {
    start?: string;
    end?: string;
  };
}

export interface KnowledgeResponse {
  knowledge: GraphPath[];
  contextualizedResults: Record<string, any>[];
  agentSpecificInsights: string[];
  confidenceScore: number;
  sources: string[];
  relatedAgents: string[];
  recommendedActions: string[];
}

export interface UnifiedKnowledgeMetrics {
  totalAgents: number;
  activeKnowledgeSessions: number;
  knowledgeRetrievals: number;
  averageRetrievalTimeMs: number;
  contextSharingEvents: number;
  knowledgeGraphNodes: number;
  agentCollaborations: number;
}

/**
 * Unified Knowledge Bridge Service
 * Central orchestrator for agent-knowledge integration
 */
export class UnifiedKnowledgeBridge extends EventEmitter {
  private agentContexts = new Map<string, AgentKnowledgeContext>();
  private knowledgeSessions = new Map<string, Set<string>>(); // agentId -> active session IDs
  private crossAgentKnowledge = new Map<string, string[]>(); // knowledge ID -> agent IDs
  private metrics: UnifiedKnowledgeMetrics;
  
  // Performance optimization
  private knowledgeCache = new Map<string, { data: KnowledgeResponse; timestamp: number }>();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CONCURRENT_QUERIES = 10;
  private activeQueries = new Set<string>();

  constructor() {
    super();
    
    this.metrics = {
      totalAgents: 0,
      activeKnowledgeSessions: 0,
      knowledgeRetrievals: 0,
      averageRetrievalTimeMs: 0,
      contextSharingEvents: 0,
      knowledgeGraphNodes: 0,
      agentCollaborations: 0
    };

    this.initializeKnowledgeBridge();
  }

  /**
   * Initialize the unified knowledge bridge
   */
  private async initializeKnowledgeBridge(): Promise<void> {
    try {
      log.info('🌉 Initializing Unified Knowledge Bridge...', LogContext.SYSTEM);

      // Register event handlers for real-time synchronization
      this.setupEventHandlers();
      
      // Initialize agent contexts from registry
      await this.initializeAgentContexts();
      
      // Start background knowledge synchronization
      this.startBackgroundSync();
      
      log.info('✅ Unified Knowledge Bridge initialized successfully', LogContext.SYSTEM);
      this.emit('bridgeInitialized', { metrics: this.metrics });
    } catch (error) {
      log.error('❌ Failed to initialize Unified Knowledge Bridge', LogContext.SYSTEM, { error });
      throw error;
    }
  }

  /**
   * Initialize contexts for all registered agents
   */
  private async initializeAgentContexts(): Promise<void> {
    try {
      // Get all agents from Rust registry
      const agents = await rustAgentRegistry.listAgents();
      
      for (const agent of agents) {
        await this.createAgentContext(agent);
      }
      
      this.metrics.totalAgents = agents.length;
      log.info(`📋 Initialized contexts for ${agents.length} agents`, LogContext.SYSTEM);
    } catch (error) {
      log.error('❌ Failed to initialize agent contexts', LogContext.SYSTEM, { error });
    }
  }

  /**
   * Create knowledge context for a specific agent
   */
  public async createAgentContext(agent: RustAgentDefinition): Promise<AgentKnowledgeContext> {
    const context: AgentKnowledgeContext = {
      agentId: agent.id,
      agentName: agent.name,
      agentType: agent.agentType,
      personalizedContext: {
        capabilities: agent.capabilities,
        preferences: {},
        learningHistory: [],
        collaborationPatterns: []
      },
      relevantKnowledge: [],
      contextHistory: [],
      lastAccessed: new Date().toISOString(),
      knowledgeScore: 0.5 // Initial neutral score
    };

    // Pre-load relevant knowledge based on agent capabilities
    await this.preloadAgentKnowledge(context);
    
    this.agentContexts.set(agent.id, context);
    
    log.info(`📝 Created knowledge context for agent: ${agent.name}`, LogContext.AI);
    return context;
  }

  /**
   * Pre-load relevant knowledge for an agent based on its capabilities
   */
  private async preloadAgentKnowledge(context: AgentKnowledgeContext): Promise<void> {
    try {
      // Build knowledge query based on agent capabilities
      const capabilities = context.personalizedContext.capabilities || [];
      const capabilityQuery = capabilities.map((cap: any) => cap.name).join(' ');
      
      if (capabilityQuery) {
        const graphQuery: GraphQuery = {
          query: capabilityQuery,
          maxHops: 2,
          includeNeighbors: true,
          useRL: true // Use R1 reasoning for enhanced retrieval
        };
        
        const knowledge = await knowledgeGraphService.retrieveWithGraph(graphQuery);
        context.relevantKnowledge = knowledge.slice(0, 10); // Top 10 most relevant
        context.knowledgeScore = knowledge.length > 0 ? 0.8 : 0.3;
      }
    } catch (error) {
      log.error(`❌ Failed to preload knowledge for agent ${context.agentName}`, LogContext.AI, { error });
    }
  }

  /**
   * Main method: Get contextualized knowledge for any agent
   */
  public async getKnowledgeForAgent(request: KnowledgeRequest): Promise<KnowledgeResponse> {
    const startTime = Date.now();
    const cacheKey = `${request.agentId}:${request.query}:${request.contextType || 'general'}`;
    
    try {
      // Check cache first
      const cachedResult = this.getCachedKnowledge(cacheKey);
      if (cachedResult) {
        this.metrics.knowledgeRetrievals++;
        return cachedResult;
      }

      // Rate limiting
      if (this.activeQueries.size >= this.MAX_CONCURRENT_QUERIES) {
        throw new Error('Knowledge bridge at capacity, please retry');
      }

      this.activeQueries.add(cacheKey);

      // Get agent context
      const agentContext = this.agentContexts.get(request.agentId);
      if (!agentContext) {
        throw new Error(`Agent context not found for ID: ${request.agentId}`);
      }

      // Step 1: Enhanced R1 RAG retrieval
      const graphQuery: GraphQuery = {
        query: request.query,
        maxHops: request.contextType === 'specialized' ? 3 : 2,
        includeNeighbors: request.includeRelated !== false,
        useRL: true // Always use R1 reasoning
      };

      const graphKnowledge = await knowledgeGraphService.retrieveWithGraph(graphQuery);

      // Step 2: Get agent-specific contextual knowledge
      const contextualKnowledge = await this.getContextualKnowledge(request, agentContext);

      // Step 3: Cross-agent knowledge sharing
      const sharedKnowledge = await this.getCrossAgentKnowledge(request, agentContext);

      // Step 4: Combine and contextualize results
      const combinedKnowledge = this.combineKnowledgeSources(
        graphKnowledge,
        contextualKnowledge,
        sharedKnowledge,
        agentContext
      );

      // Step 5: Generate agent-specific insights
      const insights = await this.generateAgentInsights(combinedKnowledge, agentContext);

      // Step 6: Find related agents for potential collaboration
      const relatedAgents = await this.findRelatedAgents(request, agentContext);

      const response: KnowledgeResponse = {
        knowledge: combinedKnowledge,
        contextualizedResults: await this.contextualizeResults(combinedKnowledge, agentContext),
        agentSpecificInsights: insights,
        confidenceScore: this.calculateConfidenceScore(combinedKnowledge),
        sources: this.extractSources(combinedKnowledge),
        relatedAgents,
        recommendedActions: await this.generateRecommendedActions(combinedKnowledge, agentContext)
      };

      // Update metrics and cache
      const executionTime = Date.now() - startTime;
      this.updateMetrics(executionTime);
      this.cacheKnowledge(cacheKey, response);

      // Update agent context with new knowledge
      await this.updateAgentContext(request.agentId, response);

      log.info(`🧠 Knowledge retrieved for agent ${agentContext.agentName} in ${executionTime}ms`, LogContext.AI);
      this.emit('knowledgeRetrieved', { agentId: request.agentId, response, executionTime });

      return response;

    } catch (error) {
      log.error(`❌ Failed to get knowledge for agent ${request.agentId}`, LogContext.AI, { error });
      throw error;
    } finally {
      this.activeQueries.delete(cacheKey);
    }
  }

  /**
   * Get contextual knowledge specific to the agent's history and preferences
   */
  private async getContextualKnowledge(
    request: KnowledgeRequest, 
    agentContext: AgentKnowledgeContext
  ): Promise<GraphPath[]> {
    try {
      // Get context from Supabase based on agent's history
      const contextResults = await contextStorageService.search({
        query: request.query,
        limit: 5,
        categories: [agentContext.agentType, 'agent_context', agentContext.agentName]
      });

      // Convert context results to graph paths
      const contextPaths: GraphPath[] = contextResults.map(result => ({
        nodes: [{
          id: `context_${result.id}`,
          type: 'context',
          name: result.category,
          properties: {
            content: result.content,
            source: result.source,
            timestamp: result.created_at
          },
          importance: 0.7
        }],
        relationships: [],
        score: 0.7,
        reasoning: [`Contextual knowledge from ${result.source}`]
      }));

      return contextPaths;
    } catch (error) {
      log.error('❌ Failed to get contextual knowledge', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Get knowledge shared across similar agents
   */
  private async getCrossAgentKnowledge(
    request: KnowledgeRequest,
    agentContext: AgentKnowledgeContext
  ): Promise<GraphPath[]> {
    try {
      // Find agents of similar type
      const similarAgents = await rustAgentRegistry.listAgents({
        agentType: agentContext.agentType as any,
        status: 'active'
      });

      const crossAgentPaths: GraphPath[] = [];

      // Get successful patterns from similar agents
      for (const agent of similarAgents.slice(0, 3)) { // Limit to 3 similar agents
        if (agent.id === agentContext.agentId) continue;

        const agentHistory = this.agentContexts.get(agent.id);
        if (agentHistory && agentHistory.relevantKnowledge.length > 0) {
          // Add top knowledge from similar agents
          crossAgentPaths.push(...agentHistory.relevantKnowledge.slice(0, 2));
        }
      }

      return crossAgentPaths;
    } catch (error) {
      log.error('❌ Failed to get cross-agent knowledge', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Combine knowledge from multiple sources
   */
  private combineKnowledgeSources(
    graphKnowledge: GraphPath[],
    contextualKnowledge: GraphPath[],
    sharedKnowledge: GraphPath[],
    agentContext: AgentKnowledgeContext
  ): GraphPath[] {
    // Combine all knowledge sources
    const allKnowledge = [
      ...graphKnowledge.map(k => ({ ...k, score: k.score * 1.0 })), // Full weight for graph knowledge
      ...contextualKnowledge.map(k => ({ ...k, score: k.score * 0.8 })), // Slight reduction for context
      ...sharedKnowledge.map(k => ({ ...k, score: k.score * 0.6 })) // Lower weight for shared knowledge
    ];

    // Remove duplicates and sort by score
    const uniqueKnowledge = allKnowledge
      .filter((knowledge, index, array) => 
        array.findIndex(k => k.nodes[0]?.id === knowledge.nodes[0]?.id) === index
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Top 20 results

    return uniqueKnowledge;
  }

  /**
   * Generate agent-specific insights from knowledge
   */
  private async generateAgentInsights(
    knowledge: GraphPath[],
    agentContext: AgentKnowledgeContext
  ): Promise<string[]> {
    const insights: string[] = [];

    // Capability-based insights
    const capabilities = agentContext.personalizedContext.capabilities || [];
    for (const capability of capabilities) {
      const relevantKnowledge = knowledge.filter(k => 
        k.reasoning.some(r => r.toLowerCase().includes(capability.name?.toLowerCase() || ''))
      );
      
      if (relevantKnowledge.length > 0) {
        insights.push(`Found ${relevantKnowledge.length} knowledge paths relevant to your ${capability.name} capability`);
      }
    }

    // Pattern-based insights
    const entityTypes = new Set(knowledge.flatMap(k => k.nodes.map(n => n.type)));
    if (entityTypes.size > 3) {
      insights.push(`Knowledge spans ${entityTypes.size} different domains, suggesting complex interconnections`);
    }

    // Historical comparison
    if (agentContext.contextHistory.length > 5) {
      insights.push('Based on your interaction history, this knowledge aligns with your previous successful patterns');
    }

    return insights.slice(0, 5); // Top 5 insights
  }

  /**
   * Find agents that could collaborate on this knowledge
   */
  private async findRelatedAgents(
    request: KnowledgeRequest,
    agentContext: AgentKnowledgeContext
  ): Promise<string[]> {
    try {
      // Search for agents with relevant capabilities
      const searchResults = await rustAgentRegistry.searchAgents(request.query);
      
      return searchResults
        .filter(agent => agent.id !== agentContext.agentId && agent.status === 'active')
        .slice(0, 3)
        .map(agent => agent.name);
    } catch (error) {
      log.error('❌ Failed to find related agents', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Generate recommended actions based on knowledge
   */
  private async generateRecommendedActions(
    knowledge: GraphPath[],
    agentContext: AgentKnowledgeContext
  ): Promise<string[]> {
    const actions: string[] = [];

    // High-confidence knowledge actions
    const highConfidenceKnowledge = knowledge.filter(k => k.score > 0.8);
    if (highConfidenceKnowledge.length > 0) {
      actions.push('Execute high-confidence knowledge paths immediately');
    }

    // Collaborative actions
    const complexKnowledge = knowledge.filter(k => k.nodes.length > 3);
    if (complexKnowledge.length > 0) {
      actions.push('Consider multi-agent collaboration for complex knowledge paths');
    }

    // Learning actions
    if (knowledge.length > 10) {
      actions.push('Update knowledge preferences based on successful patterns');
    }

    return actions.slice(0, 3);
  }

  /**
   * Contextualize results for specific agent
   */
  private async contextualizeResults(
    knowledge: GraphPath[],
    agentContext: AgentKnowledgeContext
  ): Promise<Record<string, any>[]> {
    return knowledge.map(k => ({
      summary: k.reasoning.join(' → '),
      relevanceToAgent: this.calculateRelevanceToAgent(k, agentContext),
      actionability: k.score > 0.7 ? 'high' : k.score > 0.4 ? 'medium' : 'low',
      collaboration: k.nodes.length > 2 ? 'recommended' : 'optional',
      entities: k.nodes.map(n => ({ name: n.name, type: n.type })),
      confidence: k.score
    }));
  }

  /**
   * Calculate how relevant knowledge is to a specific agent
   */
  private calculateRelevanceToAgent(knowledge: GraphPath, agentContext: AgentKnowledgeContext): number {
    let relevance = knowledge.score; // Base relevance

    // Boost relevance for agent type matches
    if (knowledge.nodes.some(n => n.type === agentContext.agentType)) {
      relevance += 0.2;
    }

    // Boost for capability matches
    const capabilities = agentContext.personalizedContext.capabilities || [];
    for (const capability of capabilities) {
      if (knowledge.reasoning.some(r => r.toLowerCase().includes(capability.name?.toLowerCase() || ''))) {
        relevance += 0.1;
      }
    }

    return Math.min(1.0, relevance);
  }

  /**
   * Calculate confidence score for knowledge response
   */
  private calculateConfidenceScore(knowledge: GraphPath[]): number {
    if (knowledge.length === 0) return 0;
    
    const avgScore = knowledge.reduce((sum, k) => sum + k.score, 0) / knowledge.length;
    const varietyBonus = Math.min(0.2, knowledge.length * 0.02); // Bonus for variety
    
    return Math.min(1.0, avgScore + varietyBonus);
  }

  /**
   * Extract sources from knowledge paths
   */
  private extractSources(knowledge: GraphPath[]): string[] {
    const sources = new Set<string>();
    
    knowledge.forEach(k => {
      k.nodes.forEach(n => {
        if (n.properties?.source) {
          sources.add(n.properties.source);
        }
      });
    });

    return Array.from(sources).slice(0, 5);
  }

  /**
   * Update agent context with new knowledge
   */
  private async updateAgentContext(
    agentId: string,
    response: KnowledgeResponse
  ): Promise<void> {
    const context = this.agentContexts.get(agentId);
    if (!context) return;

    // Update context history
    context.contextHistory.push(new Date().toISOString());
    if (context.contextHistory.length > 50) {
      context.contextHistory = context.contextHistory.slice(-25); // Keep last 25
    }

    // Update relevant knowledge with top results
    context.relevantKnowledge = [
      ...response.knowledge.slice(0, 5), // Top 5 new knowledge
      ...context.relevantKnowledge.slice(0, 5) // Keep top 5 existing
    ].slice(0, 10); // Total limit of 10

    // Update knowledge score based on success
    context.knowledgeScore = response.confidenceScore;
    context.lastAccessed = new Date().toISOString();

    // Store updated context
    this.agentContexts.set(agentId, context);
  }

  /**
   * Cache management
   */
  private getCachedKnowledge(cacheKey: string): KnowledgeResponse | null {
    const cached = this.knowledgeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private cacheKnowledge(cacheKey: string, response: KnowledgeResponse): void {
    this.knowledgeCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });

    // Cleanup old cache entries
    if (this.knowledgeCache.size > 100) {
      const oldestKeys = Array.from(this.knowledgeCache.keys()).slice(0, 20);
      oldestKeys.forEach(key => this.knowledgeCache.delete(key));
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(executionTimeMs: number): void {
    this.metrics.knowledgeRetrievals++;
    this.metrics.averageRetrievalTimeMs = (
      (this.metrics.averageRetrievalTimeMs * (this.metrics.knowledgeRetrievals - 1)) + 
      executionTimeMs
    ) / this.metrics.knowledgeRetrievals;
    this.metrics.activeKnowledgeSessions = this.agentContexts.size;
  }

  /**
   * Setup event handlers for real-time synchronization
   */
  private setupEventHandlers(): void {
    // Listen for new agents
    rustAgentRegistry.on('agentRegistered', async (agent: RustAgentDefinition) => {
      await this.createAgentContext(agent);
      this.metrics.totalAgents++;
    });

    // Listen for agent unregistration
    rustAgentRegistry.on('agentUnregistered', (agentId: string) => {
      this.agentContexts.delete(agentId);
      this.metrics.totalAgents--;
    });

    // Listen for knowledge graph updates
    knowledgeGraphService.on('graphUpdated', () => {
      // Invalidate relevant caches
      this.knowledgeCache.clear();
      log.info('📊 Knowledge cache invalidated due to graph update', LogContext.AI);
    });
  }

  /**
   * Start background synchronization
   */
  private startBackgroundSync(): void {
    // Sync agent contexts every 5 minutes
    setInterval(async () => {
      try {
        await this.syncAgentContexts();
      } catch (error) {
        log.error('❌ Background sync failed', LogContext.SYSTEM, { error });
      }
    }, 300000); // 5 minutes

    // Clean up caches every hour
    setInterval(() => {
      this.cleanupCaches();
    }, 3600000); // 1 hour
  }

  /**
   * Sync agent contexts with registry
   */
  private async syncAgentContexts(): Promise<void> {
    const agents = await rustAgentRegistry.listAgents();
    const currentAgentIds = new Set(agents.map(a => a.id));
    const contextAgentIds = new Set(this.agentContexts.keys());

    // Remove contexts for agents that no longer exist
    for (const agentId of contextAgentIds) {
      if (!currentAgentIds.has(agentId)) {
        this.agentContexts.delete(agentId);
      }
    }

    // Add contexts for new agents
    for (const agent of agents) {
      if (!contextAgentIds.has(agent.id)) {
        await this.createAgentContext(agent);
      }
    }

    log.info(`🔄 Synced contexts for ${agents.length} agents`, LogContext.SYSTEM);
  }

  /**
   * Cleanup old caches
   */
  private cleanupCaches(): void {
    const now = Date.now();
    for (const [key, cached] of this.knowledgeCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.knowledgeCache.delete(key);
      }
    }
  }

  /**
   * Get metrics for monitoring
   */
  public getMetrics(): UnifiedKnowledgeMetrics {
    return { ...this.metrics };
  }

  /**
   * Get agent context for monitoring
   */
  public getAgentContext(agentId: string): AgentKnowledgeContext | undefined {
    return this.agentContexts.get(agentId);
  }

  /**
   * Get all agent contexts
   */
  public getAllAgentContexts(): AgentKnowledgeContext[] {
    return Array.from(this.agentContexts.values());
  }

  /**
   * Force refresh of agent knowledge
   */
  public async refreshAgentKnowledge(agentId: string): Promise<void> {
    const context = this.agentContexts.get(agentId);
    if (context) {
      await this.preloadAgentKnowledge(context);
      log.info(`🔄 Refreshed knowledge for agent: ${context.agentName}`, LogContext.AI);
    }
  }

  /**
   * Shutdown the bridge
   */
  public shutdown(): void {
    this.removeAllListeners();
    this.knowledgeCache.clear();
    this.agentContexts.clear();
    log.info('🛑 Unified Knowledge Bridge shutdown', LogContext.SYSTEM);
  }
}

// Export singleton instance
export const unifiedKnowledgeBridge = new UnifiedKnowledgeBridge();
export default unifiedKnowledgeBridge;
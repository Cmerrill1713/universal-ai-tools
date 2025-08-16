import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

import { config } from '@/config/environment';
import { a2aMesh } from '@/services/a2a-communication-mesh';
import { AgentCategory, type AgentConfig, type AgentDefinition } from '@/types';
import { log,LogContext } from '@/utils/logger';

import type { BaseAgent } from './base-agent';
// Enhanced agent imports
import { EnhancedPlannerAgent } from './cognitive/enhanced-planner-agent';
import { EnhancedRetrieverAgent } from './cognitive/enhanced-retriever-agent';
import { EnhancedSynthesizerAgent } from './cognitive/enhanced-synthesizer-agent';
import type { EnhancedBaseAgent } from './enhanced-base-agent';
import { EnhancedPersonalAssistantAgent } from './personal/enhanced-personal-assistant-agent';
import { ConversationalVoiceAgent } from './specialized/conversational-voice-agent';
import { EnhancedCodeAssistantAgent } from './specialized/enhanced-code-assistant-agent';
import { EnhancedCodebaseOptimizerAgent } from './specialized/enhanced-codebase-optimizer-agent';
// New domain-specific agents for R1 RAG system
import { GraphRAGReasoningAgent } from './specialized/graphrag-reasoning-agent';
import { MultiTierRouterAgent } from './specialized/multi-tier-router-agent';
import { PerformanceOptimizationAgent } from './specialized/performance-optimization-agent';
import { R1ReasoningAgent } from './specialized/r1-reasoning-agent';
// HRM agent removed for Apple Silicon environment (CUDA/flash_attn not supported)

export interface AgentLoadingLock {
  [agentName: string]: Promise<BaseAgent | null>;
}

export class AgentRegistry extends EventEmitter {
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private loadedAgents: Map<string, BaseAgent | EnhancedBaseAgent> = new Map();
  private agentUsage: Map<string, Date> = new Map();
  private loadingLocks: Map<string, Promise<BaseAgent | EnhancedBaseAgent | null>> = new Map();
  private supabase: unknown;
  private cleanupTimer?: NodeJS.Timeout;
  private maxLoadedAgents = 10; // Limit concurrent loaded agents

  constructor() {
    super();
    // Initialize Supabase client
    // SECURITY: Use environment variables or Supabase Vault for API keys in production
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
      throw new Error('SUPABASE_ANON_KEY environment variable is required');
    }

    this.supabase = createClient(
      config.database.url.includes('supabase')
        ? config.database.url
        : process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      supabaseAnonKey
    );
    this.registerBuiltInAgents();
    this.startCleanupScheduler();
    log.info(
      `Agent Registry initialized with ${this.agentDefinitions.size} agent definitions`,
      LogContext.AGENT
    );
  }

  private registerBuiltInAgents(): void {
    // Core agents
    this.registerAgent({
      name: 'planner',
      category: AgentCategory.CORE,
      description: 'Strategic task planning and decomposition with memory integration',
      priority: 1,
      className: 'PlannerAgent',
      modulePath: './cognitive/planner-agent',
      dependencies: [],
      capabilities: ['planning', 'task_decomposition', 'strategy'],
      memoryEnabled: true,
      maxLatencyMs: 10000,
      retryAttempts: 3,
    });

    this.registerAgent({
      name: 'synthesizer',
      category: AgentCategory.COGNITIVE,
      description: 'Advanced information synthesis and consensus building',
      priority: 2,
      className: 'SynthesizerAgent',
      modulePath: './cognitive/synthesizer-agent',
      dependencies: ['planner'],
      capabilities: ['synthesis', 'consensus', 'analysis'],
      memoryEnabled: true,
      maxLatencyMs: 8000,
      retryAttempts: 2,
    });

    this.registerAgent({
      name: 'retriever',
      category: AgentCategory.COGNITIVE,
      description: 'Intelligent information retrieval and context gathering',
      priority: 2,
      className: 'RetrieverAgent',
      modulePath: './cognitive/retriever-agent',
      dependencies: [],
      capabilities: ['information_retrieval', 'context_gathering', 'search'],
      memoryEnabled: true,
      maxLatencyMs: 5000,
      retryAttempts: 2,
    });

    // Personal agents
    this.registerAgent({
      name: 'personal_assistant',
      category: AgentCategory.PERSONAL,
      description: 'High-level personal AI assistant with vector memory',
      priority: 1,
      className: 'PersonalAssistantAgent',
      modulePath: './personal/personal-assistant-agent',
      dependencies: ['planner', 'retriever'],
      capabilities: ['assistance', 'coordination', 'task_management'],
      memoryEnabled: true,
      maxLatencyMs: 8000,
      retryAttempts: 2,
    });

    this.registerAgent({
      name: 'code_assistant',
      category: AgentCategory.SPECIALIZED,
      description: 'Advanced code generation, analysis, and refactoring',
      priority: 3,
      className: 'CodeAssistantAgent',
      modulePath: './specialized/code-assistant-agent',
      dependencies: ['planner'],
      capabilities: ['code_generation', 'code_analysis', 'refactoring'],
      memoryEnabled: true,
      maxLatencyMs: 15000,
      retryAttempts: 2,
    });

    // Domain-specific agents for R1 RAG system
    this.registerAgent({
      name: 'graphrag_reasoning',
      category: AgentCategory.SPECIALIZED,
      description: 'Advanced knowledge graph construction and graph-based reasoning',
      priority: 2,
      className: 'GraphRAGReasoningAgent',
      modulePath: './specialized/graphrag-reasoning-agent',
      dependencies: ['retriever'],
      capabilities: ['knowledge_graph_construction', 'graph_based_reasoning', 'entity_relationship_extraction'],
      memoryEnabled: true,
      maxLatencyMs: 8000,
      retryAttempts: 2,
    });

    this.registerAgent({
      name: 'r1_reasoning',
      category: AgentCategory.SPECIALIZED,
      description: 'Advanced R1 reasoning with Think-Generate-Retrieve-Rethink cycles',
      priority: 2,
      className: 'R1ReasoningAgent',
      modulePath: './specialized/r1-reasoning-agent',
      dependencies: ['retriever'],
      capabilities: ['r1_reasoning_cycles', 'multi_step_thinking', 'dynamic_retrieval'],
      memoryEnabled: true,
      maxLatencyMs: 12000,
      retryAttempts: 2,
    });

    this.registerAgent({
      name: 'multi_tier_router',
      category: AgentCategory.SPECIALIZED,
      description: 'Intelligent multi-tier model routing and selection',
      priority: 1,
      className: 'MultiTierRouterAgent',
      modulePath: './specialized/multi-tier-router-agent',
      dependencies: [],
      capabilities: ['tier_routing', 'complexity_analysis', 'performance_optimization'],
      memoryEnabled: true,
      maxLatencyMs: 3000,
      retryAttempts: 3,
    });

    this.registerAgent({
      name: 'performance_optimization',
      category: AgentCategory.SPECIALIZED,
      description: 'Performance optimization for sub-3 second response times',
      priority: 3,
      className: 'PerformanceOptimizationAgent',
      modulePath: './specialized/performance-optimization-agent',
      dependencies: [],
      capabilities: ['latency_optimization', 'throughput_optimization', 'bottleneck_analysis'],
      memoryEnabled: true,
      maxLatencyMs: 5000,
      retryAttempts: 2,
    });

    this.registerAgent({
      name: 'codebase_optimizer',
      category: AgentCategory.SPECIALIZED,
      description: 'Comprehensive codebase analysis, optimization, and quality improvement',
      priority: 3,
      className: 'EnhancedCodebaseOptimizerAgent',
      modulePath: './specialized/enhanced-codebase-optimizer-agent',
      dependencies: [],
      capabilities: ['codebase_analysis', 'code_optimization', 'performance_analysis', 'security_analysis', 'code_quality_assessment', 'automated_refactoring'],
      memoryEnabled: true,
      maxLatencyMs: 30000, // Allow longer execution time for codebase analysis
      retryAttempts: 2,
    });

    this.registerAgent({
      name: 'conversational_voice',
      category: AgentCategory.SPECIALIZED,
      description: 'Advanced conversational voice agent for natural voice interactions',
      priority: 3,
      className: 'ConversationalVoiceAgent',
      modulePath: './specialized/conversational-voice-agent',
      dependencies: [],
      capabilities: ['voice_conversation', 'voice_command_processing', 'conversational_memory', 'voice_response_optimization', 'emotion_detection'],
      memoryEnabled: true,
      maxLatencyMs: 5000, // Voice interactions need faster response
      retryAttempts: 2,
    });

    // HRM registration removed

    log.info(`Registered ${this.agentDefinitions.size} built-in agents`, LogContext.AGENT);
  }

  private registerAgent(definition: AgentDefinition): void {
    this.agentDefinitions.set(definition.name, definition);
    this.emit('agent_registered', { agentName: definition.name, definition });
  }

  private createEnhancedAgent(agentName: string, config: AgentConfig): EnhancedBaseAgent | null {
    switch (agentName) {
      case 'planner':
        return new EnhancedPlannerAgent(config);

      case 'retriever':
        return new EnhancedRetrieverAgent(config);

      case 'synthesizer':
        return new EnhancedSynthesizerAgent(config);

      case 'personal_assistant':
        return new EnhancedPersonalAssistantAgent(config);

      case 'code_assistant':
        return new EnhancedCodeAssistantAgent(config);

      case 'graphrag_reasoning':
        return new GraphRAGReasoningAgent(config);

      case 'r1_reasoning':
        return new R1ReasoningAgent(config);

      case 'multi_tier_router':
        return new MultiTierRouterAgent(config);

      case 'performance_optimization':
        return new PerformanceOptimizationAgent(config);

      case 'codebase_optimizer':
        return new EnhancedCodebaseOptimizerAgent(config);

      case 'conversational_voice':
        return new ConversationalVoiceAgent(config);

      // case 'hrm': // removed
      //   return new HRMSapientAgent(config);

      default:
        return null;
    }
  }

  public async getAgent(agentName: string): Promise<BaseAgent | EnhancedBaseAgent | null> {
    // PERFORMANCE OPTIMIZATION: Fail fast if system is under load
    const memUsage = process.memoryUsage();
    const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (heapPercent > 80) {
      log.warn(`Memory usage high (${Math.round(heapPercent)}%), skipping agent load for performance`, LogContext.AGENT);
      return null;
    }

    // Return loaded agent if available
    if (this.loadedAgents.has(agentName)) {
      this.agentUsage.set(agentName, new Date());
      return this.loadedAgents.get(agentName)!;
    }

    // PERFORMANCE OPTIMIZATION: Limit concurrent agent loading
    if (this.loadingLocks.size >= 2) {
      log.warn(`Too many concurrent agent loads, rejecting request for ${agentName}`, LogContext.AGENT);
      return null;
    }

    // Check if we need to unload agents before loading new ones
    if (this.loadedAgents.size >= this.maxLoadedAgents) {
      await this.unloadLeastRecentlyUsedAgent();
    }

    // Use loading lock to prevent duplicate loading
    if (this.loadingLocks.has(agentName)) {
      return this.loadingLocks.get(agentName)!;
    }

    // Start loading process with timeout
    const loadingPromise = Promise.race([
      this.loadAgent(agentName),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Agent load timeout')), 5000)
      )
    ]).catch((error) => {
      log.warn(`Agent loading failed or timed out: ${agentName}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    });
    
    this.loadingLocks.set(agentName, loadingPromise);

    try {
      const agent = await loadingPromise;
      if (agent) {
        this.loadedAgents.set(agentName, agent);
        this.agentUsage.set(agentName, new Date());
        log.info(`Lazy-loaded agent: ${agentName}`, LogContext.AGENT);
        this.emit('agent_loaded', { agentName, agent });
      }
      return agent;
    } finally {
      this.loadingLocks.delete(agentName);
    }
  }

  private async unloadLeastRecentlyUsedAgent(): Promise<void> {
    // Find least recently used non-core agent
    let oldestAgent: string | null = null;
    let oldestTime = Date.now();

    for (const [agentName, lastUsed] of this.agentUsage.entries()) {
      const definition = this.agentDefinitions.get(agentName);
      // Don't unload core agents
      if (definition?.category === AgentCategory.CORE) continue;
      
      if (lastUsed.getTime() < oldestTime) {
        oldestTime = lastUsed.getTime();
        oldestAgent = agentName;
      }
    }

    if (oldestAgent) {
      const agent = this.loadedAgents.get(oldestAgent);
      if (agent) {
        await agent.shutdown();
        this.loadedAgents.delete(oldestAgent);
        this.agentUsage.delete(oldestAgent);
        log.info(`Unloaded LRU agent: ${oldestAgent}`, LogContext.AGENT);
      }
    }
  }

  private startCleanupScheduler(): void {
    this.cleanupTimer = setInterval(() => {
      this.performMemoryCleanup();
    }, 2 * 60 * 1000); // Every 2 minutes
  }

  private performMemoryCleanup(): void {
    // Force garbage collection if available
    if (global.gc && this.loadedAgents.size === 0) {
      global.gc();
    }
    
    // Clear old loading locks
    for (const [agentName, promise] of this.loadingLocks.entries()) {
      // Check if promise is still pending after 30 seconds
      const timeout = setTimeout(() => {
        this.loadingLocks.delete(agentName);
      }, 30000);
      
      promise.finally(() => clearTimeout(timeout));
    }
  }

  private async loadAgent(agentName: string): Promise<BaseAgent | EnhancedBaseAgent | null> {
    try {
      const definition = this.agentDefinitions.get(agentName);
      if (!definition) {
        log.warn(`Agent definition not found: ${agentName}`, LogContext.AGENT);
        return null;
      }

      // Load dependencies first
      for (const depName of definition.dependencies) {
        if (!this.loadedAgents.has(depName)) {
          const depAgent = await this.getAgent(depName);
          if (!depAgent) {
            log.warn(`Failed to load dependency '${depName}' for '${agentName}'`, LogContext.AGENT);
          }
        }
      }

      // Create agent configuration
      const config: AgentConfig = {
        name: definition.name,
        description: definition.description,
        priority: definition.priority,
        capabilities: definition.capabilities.map((cap) => ({
          name: cap,
          description: `${cap} capability`,
          inputSchema: {},
          outputSchema: {},
        })),
        maxLatencyMs: definition.maxLatencyMs,
        retryAttempts: definition.retryAttempts,
        dependencies: definition.dependencies,
        memoryEnabled: definition.memoryEnabled,
        toolExecutionEnabled: true,
        allowedTools: [],
      };

      // Create enhanced agent based on agent name
      const agent = this.createEnhancedAgent(definition.name, config);
      if (agent) {
        await agent.initialize();
        return agent;
      }

      // No enhanced agent available
      log.error(`No enhanced agent available for ${agentName}`, LogContext.AGENT);
      return null;
    } catch (error) {
      log.error(`Failed to load agent: ${agentName}`, LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public getAvailableAgents(): AgentDefinition[] {
    return Array.from(this.agentDefinitions.values());
  }

  public getLoadedAgents(): string[] {
    return Array.from(this.loadedAgents.keys());
  }

  public getCoreAgents(): string[] {
    return Array.from(this.agentDefinitions.values())
      .filter((def) => def.category === AgentCategory.CORE)
      .map((def) => def.name);
  }

  public async processRequest(agentName: string, context: unknown): Promise<unknown> {
    const agent = await this.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found or failed to load`);
    }

    // Register agent in A2A mesh if not already registered
    if (!a2aMesh.getAgentConnections().find((conn) => conn.agentName === agentName)) {
      const definition = this.agentDefinitions.get(agentName);
      const capabilities = definition?.capabilities || [];
      a2aMesh.registerAgent(agentName, capabilities);
    }

    // Mark agent as used
    this.agentUsage.set(agentName, new Date());

    // Process the request with learning-enabled execution if supported
    const enhanced = agent as any;
    if (typeof enhanced.executeWithFeedback === 'function') {
      try {
        const { response, feedback } = await enhanced.executeWithFeedback(context as any);
        // Optional: emit event for learning telemetry
        this.emit('agent_feedback', { agentName, feedback });
        return response;
      } catch {
        // Fallback to regular execution on error
        return await agent.execute(context as any);
      }
    }

    return await agent.execute(context as any);
  }

  public async processParallelRequests(
    agentRequests: Array<{ agentName: string; context: unknown }>
  ): Promise<Array<{ agentName: string; result: unknown; error?: string }>> {
    log.info(`Processing ${agentRequests.length} parallel agent requests`, LogContext.AGENT);

    const promises = agentRequests.map(async ({ agentName, context }) => {
      try {
        const result = await this.processRequest(agentName, context);
        return { agentName, result };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Parallel agent execution failed: ${agentName}`, LogContext.AGENT, {
          error: errorMessage,
        });
        return { agentName, result: null, error: errorMessage };
      }
    });

    const results = await Promise.all(promises);

    log.info(`Completed ${agentRequests.length} parallel agent requests`, LogContext.AGENT, {
      successful: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
    });

    return results;
  }

  private async createTaskRecord(
    taskId: string,
    primaryAgent: string,
    supportingAgents: string[],
    context: unknown
  ): Promise<void> {
    try {
      const { error } = await (this as any).supabase.from('tasks').insert({
        id: taskId,
        agent_name: primaryAgent,
        supporting_agents: supportingAgents,
        user_request: (context as any).userRequest || 'No request specified',
        context,
        status: 'running',
        priority: 'medium',
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      });

      if (error) {
        log.warn('Failed to create task record in Supabase', LogContext.AGENT, {
          error: error.message,
          taskId,
        });
      } else {
        log.info('✅ Task record created in Supabase', LogContext.AGENT, { taskId, primaryAgent });
      }
    } catch (error) {
      log.error('Error creating task record', LogContext.AGENT, { error, taskId });
    }
  }

  private async updateTaskRecord(
    taskId: string,
    results: unknown,
    status: 'completed' | 'failed'
  ): Promise<void> {
    try {
      const { error } = await (this as any).supabase
        .from('tasks')
        .update({
          status,
          result: results,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (error) {
        log.warn('Failed to update task record in Supabase', LogContext.AGENT, {
          error: error.message,
          taskId,
        });
      } else {
        log.info('✅ Task record updated in Supabase', LogContext.AGENT, { taskId, status });
      }
    } catch (error) {
      log.error('Error updating task record', LogContext.AGENT, { error, taskId });
    }
  }

  public async orchestrateAgents(
    primaryAgent: string,
    supportingAgents: string[],
    context: unknown
  ): Promise<{
    primary: unknown;
    supporting: Array<{ agentName: string; result: unknown; error?: string }>;
    synthesis?: unknown;
    optimization?: unknown;
  }> {
    log.info(
      `Orchestrating agents: primary=${primaryAgent}, supporting=[${supportingAgents.join(', ')}]`,
      LogContext.AGENT
    );

    // Create task record in Supabase
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.createTaskRecord(taskId, primaryAgent, supportingAgents, context);

    // Try to use DSPy for optimization if available
    let dspyOptimization: any = null;
    try {
      const { dspyService } = await import('../services/dspy-service');
      if (dspyService.isReady()) {
        const userRequest = (context as any)?.userRequest || 'Agent orchestration task';
        dspyOptimization = await dspyService.orchestrate({
          userRequest,
          userId: (context as any)?.userId || 'system',
          context: {
            primaryAgent,
            supportingAgents,
            taskId,
          }
        });
        log.info('✅ DSPy optimization applied to agent orchestration', LogContext.AGENT);
      }
    } catch {
      log.debug('DSPy optimization not available for orchestration', LogContext.AGENT);
    }

    // Execute primary and supporting agents in parallel
    const [primaryResult, supportingResults] = await Promise.all([
      this.processRequest(primaryAgent, context).catch((error) => ({ error: error.message })),
      this.processParallelRequests(supportingAgents.map((name) => ({ agentName: name, context }))),
    ]);

    // Optionally synthesize results if we have a synthesizer agent
    let synthesis: unknown;
    if (this.agentDefinitions.has('synthesizer')) {
      try {
        const synthesisContext = {
          ...(context as Record<string, unknown>),
          userRequest: `Synthesize results from ${primaryAgent} and supporting agents`,
          primaryResult,
          supportingResults: supportingResults.filter((r) => !r.error).map((r) => r.result),
        };
        synthesis = await this.processRequest('synthesizer', synthesisContext);
      } catch (error) {
        log.warn('Failed to synthesize orchestrated results', LogContext.AGENT, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const results = {
      primary: primaryResult,
      supporting: supportingResults,
      synthesis,
      optimization: dspyOptimization,
    };

    // Update task record with results
    const hasErrors = (primaryResult as any)?.error || supportingResults.some((r) => r.error);
    await this.updateTaskRecord(taskId, results, hasErrors ? 'failed' : 'completed');

    return results;
  }

  /**
   * Request collaboration between multiple agents using A2A mesh
   */
  public async requestCollaboration(
    task: string,
    requiredCapabilities: string[],
    teamSize = 3,
    initiator = 'system'
  ): Promise<string> {
    log.info(`🤝 Requesting agent collaboration for: ${task}`, LogContext.AGENT, {
      capabilities: requiredCapabilities,
      teamSize,
    });

    // Find optimal team using A2A mesh
    const team = a2aMesh.findAgentTeam(requiredCapabilities, teamSize);

    if (team.length === 0) {
      throw new Error('No agents available for collaboration');
    }

    // Ensure all team agents are loaded
    for (const agentName of team) {
      await this.getAgent(agentName);
    }

    // Start collaboration session
    const sessionId = await a2aMesh.requestCollaboration({
      initiator,
      participants: team,
      task,
      context: { requiredCapabilities },
      expectedDuration: 30000, // 30 seconds
      priority: 'high',
    });

    log.info(`✅ Collaboration session started: ${sessionId}`, LogContext.AGENT, {
      team: team.join(', '),
    });

    return sessionId;
  }

  /**
   * Enable knowledge sharing between agents
   */
  public async shareKnowledge(
    fromAgent: string,
    knowledgeType: string,
    data: unknown,
    relevantCapabilities: string[],
    confidence = 0.8
  ): Promise<void> {
    log.info(`🧠 Sharing knowledge from ${fromAgent}`, LogContext.AGENT, {
      type: knowledgeType,
      confidence,
    });

    await a2aMesh.shareKnowledge(fromAgent, {
      type: knowledgeType,
      data,
      relevantTo: relevantCapabilities,
      confidence,
    });
  }

  /**
   * Get optimal agent for specific task
   */
  public findOptimalAgent(requiredCapabilities: string[]): string | null {
    return a2aMesh.findOptimalAgent(requiredCapabilities);
  }

  /**
   * Get communication mesh status
   */
  public getMeshStatus(): unknown {
    return a2aMesh.getMeshStatus();
  }

  public async unloadIdleAgents(maxIdleMinutes = 30): Promise<void> {
    const now = new Date();
    const toUnload: string[] = [];

    for (const [agentName, lastUsed] of this.agentUsage.entries()) {
      const idleTimeMs = now.getTime() - lastUsed.getTime();
      const idleMinutes = idleTimeMs / (1000 * 60);

      const definition = this.agentDefinitions.get(agentName);
      if (
        definition &&
        definition.category !== AgentCategory.CORE &&
        idleMinutes > maxIdleMinutes
      ) {
        toUnload.push(agentName);
      }
    }

    for (const agentName of toUnload) {
      const agent = this.loadedAgents.get(agentName);
      if (agent) {
        await agent.shutdown();
        this.loadedAgents.delete(agentName);
        this.agentUsage.delete(agentName);
        log.info(`Unloaded idle agent: ${agentName}`, LogContext.AGENT);
        this.emit('agent_unloaded', { agentName });
      }
    }
  }

  public async shutdown(): Promise<void> {
    log.info('Shutting down Agent Registry...', LogContext.AGENT);

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    const shutdownPromises = Array.from(this.loadedAgents.values()).map((agent) =>
      agent
        .shutdown()
        .catch((error) => log.error('Error shutting down agent', LogContext.AGENT, { error }))
    );

    await Promise.all(shutdownPromises);

    this.loadedAgents.clear();
    this.agentUsage.clear();
    this.loadingLocks.clear();

    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }

    log.info('Agent Registry shutdown completed', LogContext.AGENT);
  }
}

export default AgentRegistry;

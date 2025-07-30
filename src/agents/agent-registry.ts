import { EventEmitter } from 'events';
import type { AgentConfig, AgentDefinition } from '@/types';
import { AgentCategory } from '@/types';
import { BaseAgent } from './base-agent';
import type { EnhancedBaseAgent } from './enhanced-base-agent';
import { LogContext, log } from '@/utils/logger';
import { a2aMesh } from '@/services/a2a-communication-mesh';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';

// Enhanced agent imports
import { EnhancedPlannerAgent } from './cognitive/enhanced-planner-agent';
import { EnhancedRetrieverAgent } from './cognitive/enhanced-retriever-agent';
import { EnhancedSynthesizerAgent } from './cognitive/enhanced-synthesizer-agent';
import { EnhancedPersonalAssistantAgent } from './personal/enhanced-personal-assistant-agent';
import { EnhancedCodeAssistantAgent } from './specialized/enhanced-code-assistant-agent';

export interface AgentLoadingLock {
  [agentName: string]: Promise<BaseAgent | null>;
}

export class AgentRegistry extends EventEmitter {
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private loadedAgents: Map<string, BaseAgent | EnhancedBaseAgent> = new Map();
  private agentUsage: Map<string, Date> = new Map();
  private loadingLocks: Map<string, Promise<BaseAgent | EnhancedBaseAgent | null>> = new Map();
  private supabase: unknown;

  constructor() {
    super();
    // Initialize Supabase client
    this.supabase = // TODO: Refactor nested ternary
      createClient(
        config.database.url.includes('supabase')
          ? config.database.url
          : process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
        process.env.SUPABASE_ANON_KEY ||
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      );
    this.registerBuiltInAgents();
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

      default:
        return null;
    }
  }

  public async getAgent(agentName: string): Promise<BaseAgent | EnhancedBaseAgent | null> {
    // Return loaded agent if available
    if (this.loadedAgents.has(agentName)) {
      this.agentUsage.set(agentName, new Date());
      return this.loadedAgents.get(agentName)!;
    }

    // Use loading lock to prevent duplicate loading
    if (this.loadingLocks.has(agentName)) {
      return this.loadingLocks.get(agentName)!;
    }

    // Start loading process
    const loadingPromise = this.loadAgent(agentName);
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

      // Fallback to mock agent if enhanced agent not available
      log.warn(`No enhanced agent available for ${agentName}, using mock agent`, LogContext.AGENT);
      const mockAgent = new MockAgent(config);
      await mockAgent.initialize();
      return mockAgent;
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

    // Process the request
    const result = await agent.execute(context as any);
    return result;
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
  }> {
    log.info(
      `Orchestrating agents: // TODO: Refactor nested ternary
primary=${primaryAgent}, supporting=[${supportingAgents.join(', ')}]`,
      LogContext.AGENT
    );

    // Create task record in Supabase
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.createTaskRecord(taskId, primaryAgent, supportingAgents, context);

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
          ...context,
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

    const shutdownPromises = Array.from(this.loadedAgents.values()).map((agent) =>
      agent
        .shutdown()
        .catch((error) => log.error('Error shutting down agent', LogContext.AGENT, { error }))
    );

    await Promise.all(shutdownPromises);

    this.loadedAgents.clear();
    this.agentUsage.clear();
    this.loadingLocks.clear();

    log.info('Agent Registry shutdown completed', LogContext.AGENT);
  }
}

// Temporary mock agent for testing
class MockAgent extends BaseAgent {
  protected async process(context: unknown): Promise<any> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    return this.createSuccessResponse(
      {
        processed: true,
        agentName: this.config.name,
        userRequest: (context as any).userRequest,
        capabilities: this.getCapabilities(),
      },
      `Mock processing completed by ${this.config.name}`,
      0.7,
      `This is a mock response from ${(this as any).config.name}. The agent processed the request: "${(context as any).userRequest}"`
    );
  }
}

export default AgentRegistry;

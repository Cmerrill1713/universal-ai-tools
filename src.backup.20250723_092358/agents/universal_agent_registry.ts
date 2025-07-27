/**
 * Universal Agent Registry - Lazy Loading System
 * Adapted from the trading platform's sophisticated agent management
 */

import type { AgentConfig, BaseAgent } from './base_agent';
import { EventEmitter } from 'events';

export interface AgentDefinition {
  name: string;
  category: AgentCategory;
  description: string;
  priority: number;
  className: string;
  modulePath: string;
  dependencies: string[];
  capabilities: string[];
  memoryEnabled: boolean;
  maxLatencyMs: number;
  retryAttempts: number;
}

export enum AgentCategory {
  CORE = 'core',
  COGNITIVE = 'cognitive',
  UTILITY = 'utility',
  SPECIALIZED = 'specialized',
  PERSONAL = 'personal',
}

export interface AgentLoadingLock {
  [agentName: string]: Promise<BaseAgent | null>;
}

export class UniversalAgentRegistry extends EventEmitter {
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private loadedAgents: Map<string, BaseAgent> = new Map();
  private agentUsage: Map<string, Date> = new Map();
  private loadingLocks: Map<string, Promise<BaseAgent | null>> = new Map();
  private memoryCoordinator: any;
  private supabase: any;
  private logger: any = console;

  constructor(memoryCoordinator?: any, supabase?: any) {
    super();
    this.memoryCoordinator = memoryCoordinator;
    this.supabase = supabase;
    this.registerCognitiveAgents();
    this.registerPersonalAgents();
    this.logger.info(
      `✅ Universal Agent Registry initialized with ${this.agentDefinitions.size} agent definitions`
    );
  }

  /**
   * Register the 10 cognitive agents for Universal AI Tools
   */
  private registerCognitiveAgents(): void {
    const cognitiveAgents: AgentDefinition[] = [
      {
        name: 'planner',
        category: AgentCategory.CORE,
        description: 'Strategic task planning and decomposition with memory integration',
        priority: 1,
        className: 'EnhancedPlannerAgent',
        modulePath: './cognitive/enhanced_planner_agent',
        dependencies: [],
        capabilities: [
          'task_planning',
          'goal_decomposition',
          'strategy_design',
          'memory_based_optimization',
        ],
        memoryEnabled: true,
        maxLatencyMs: 100,
        retryAttempts: 3,
      },
      {
        name: 'retriever',
        category: AgentCategory.CORE,
        description: 'Information gathering and context retrieval',
        priority: 1,
        className: 'RetrieverAgent',
        modulePath: './cognitive/retriever_agent',
        dependencies: [],
        capabilities: ['information_search', 'context_retrieval', 'knowledge_lookup'],
        memoryEnabled: true,
        maxLatencyMs: 200,
        retryAttempts: 2,
      },
      {
        name: 'devils_advocate',
        category: AgentCategory.COGNITIVE,
        description: 'Critical _analysisand risk assessment',
        priority: 2,
        className: 'DevilsAdvocateAgent',
        modulePath: './cognitive/devils_advocate_agent',
        dependencies: ['retriever'],
        capabilities: ['critical__analysis, 'risk_assessment', 'stress_testing'],
        memoryEnabled: true,
        maxLatencyMs: 150,
        retryAttempts: 2,
      },
      {
        name: 'synthesizer',
        category: AgentCategory.COGNITIVE,
        description: 'Information integration and solution synthesis',
        priority: 2,
        className: 'SynthesizerAgent',
        modulePath: './cognitive/synthesizer_agent',
        dependencies: ['retriever', 'planner'],
        capabilities: ['information_synthesis', 'solution_integration', 'pattern_matching'],
        memoryEnabled: true,
        maxLatencyMs: 120,
        retryAttempts: 2,
      },
      {
        name: 'reflector',
        category: AgentCategory.COGNITIVE,
        description: 'Self-assessment and learning optimization',
        priority: 3,
        className: 'ReflectorAgent',
        modulePath: './cognitive/reflector_agent',
        dependencies: ['synthesizer'],
        capabilities: ['self_assessment', 'learning_optimization', 'performance__analysis],
        memoryEnabled: true,
        maxLatencyMs: 100,
        retryAttempts: 1,
      },
      {
        name: 'user_intent',
        category: AgentCategory.CORE,
        description: 'Understanding user goals and context',
        priority: 1,
        className: 'UserIntentAgent',
        modulePath: './cognitive/user_intent_agent',
        dependencies: [],
        capabilities: ['intent_recognition', 'goal_inference', 'context_understanding'],
        memoryEnabled: true,
        maxLatencyMs: 80,
        retryAttempts: 3,
      },
      {
        name: 'tool_maker',
        category: AgentCategory.SPECIALIZED,
        description: 'Dynamic tool creation and customization',
        priority: 2,
        className: 'ToolMakerAgent',
        modulePath: './cognitive/tool_maker_agent',
        dependencies: ['planner', 'user_intent'],
        capabilities: ['tool_creation', 'code_generation', 'customization'],
        memoryEnabled: true,
        maxLatencyMs: 300,
        retryAttempts: 2,
      },
      {
        name: 'ethics',
        category: AgentCategory.CORE,
        description: 'Safety validation and compliance checking',
        priority: 2,
        className: 'EthicsAgent',
        modulePath: './cognitive/ethics_agent',
        dependencies: [],
        capabilities: ['safety_validation', 'compliance_checking', 'ethical__analysis],
        memoryEnabled: true,
        maxLatencyMs: 100,
        retryAttempts: 3,
      },
      {
        name: 'resource_manager',
        category: AgentCategory.UTILITY,
        description: 'System resource optimization and monitoring',
        priority: 3,
        className: 'ResourceManagerAgent',
        modulePath: './cognitive/resource_manager_agent',
        dependencies: [],
        capabilities: ['resource_optimization', 'performance_monitoring', 'system_health'],
        memoryEnabled: false,
        maxLatencyMs: 50,
        retryAttempts: 1,
      },
      {
        name: 'orchestrator',
        category: AgentCategory.CORE,
        description: 'Central coordination and decision making',
        priority: 1,
        className: 'OrchestratorAgent',
        modulePath: './cognitive/orchestrator_agent',
        dependencies: ['planner', 'synthesizer', 'ethics'],
        capabilities: ['coordination', 'decision_making', 'consensus_building'],
        memoryEnabled: true,
        maxLatencyMs: 150,
        retryAttempts: 3,
      },
      {
        name: 'pydantic_ai',
        category: AgentCategory.COGNITIVE,
        description: 'Type-safe AI interactions with structured validation',
        priority: 2,
        className: 'PydanticAIAgent',
        modulePath: './cognitive/pydantic_ai_agent',
        dependencies: ['user_intent'],
        capabilities: [
          'structured_response',
          'validate_data',
          'cognitive__analysis,
          'task_planning',
          'code_generation',
        ],
        memoryEnabled: true,
        maxLatencyMs: 200,
        retryAttempts: 2,
      },
    ];

    cognitiveAgents.forEach((agent) => {
      this.agentDefinitions.set(agent.name, agent);
    });
  }

  /**
   * Register the personal productivity agents
   */
  private registerPersonalAgents(): void {
    const personalAgents: AgentDefinition[] = [
      {
        name: 'personal_assistant',
        category: AgentCategory.PERSONAL,
        description:
          'High-level personal AI assistant with vector memory for intelligent coordination',
        priority: 1,
        className: 'EnhancedPersonalAssistantAgent',
        modulePath: './personal/enhanced_personal_assistant_agent',
        dependencies: [
          'calendar_agent',
          'photo_organizer',
          'file_manager',
          'code_assistant',
          'system_control',
          'web_scraper',
          'tool_maker',
        ],
        capabilities: [
          'comprehensive_assistance',
          'smart_planning',
          'proactive_assistance',
          'memory_driven_intelligence',
        ],
        memoryEnabled: true,
        maxLatencyMs: 10000,
        retryAttempts: 3,
      },
      {
        name: 'calendar_agent',
        category: AgentCategory.PERSONAL,
        description: 'Intelligent calendar management and scheduling assistant',
        priority: 2,
        className: 'CalendarAgent',
        modulePath: './personal/calendar_agent',
        dependencies: ['ollama_assistant'],
        capabilities: ['create_event', 'find_free_time', 'analyze_schedule'],
        memoryEnabled: true,
        maxLatencyMs: 3000,
        retryAttempts: 2,
      },
      {
        name: 'photo_organizer',
        category: AgentCategory.PERSONAL,
        description:
          'Intelligent photo organization with face recognition and ML-powered categorization',
        priority: 3,
        className: 'PhotoOrganizerAgent',
        modulePath: './personal/photo_organizer_agent',
        dependencies: ['ollama_assistant'],
        capabilities: ['organize_photos', 'detect_faces', 'find_duplicates', 'create_smart_albums'],
        memoryEnabled: true,
        maxLatencyMs: 10000,
        retryAttempts: 2,
      },
      {
        name: 'file_manager',
        category: AgentCategory.PERSONAL,
        description: 'Intelligent file and document management with automated organization',
        priority: 3,
        className: 'FileManagerAgent',
        modulePath: './personal/file_manager_agent',
        dependencies: ['ollama_assistant'],
        capabilities: ['organize_files', 'find_duplicates', 'analyze_content, 'smart_search'],
        memoryEnabled: true,
        maxLatencyMs: 5000,
        retryAttempts: 2,
      },
      {
        name: 'code_assistant',
        category: AgentCategory.PERSONAL,
        description: 'Intelligent development workflow automation and code generation',
        priority: 2,
        className: 'CodeAssistantAgent',
        modulePath: './personal/code_assistant_agent',
        dependencies: ['ollama_assistant'],
        capabilities: ['generate_code', 'analyze_project', 'refactor_code', 'git_operations'],
        memoryEnabled: true,
        maxLatencyMs: 15000,
        retryAttempts: 2,
      },
      {
        name: 'system_control',
        category: AgentCategory.PERSONAL,
        description: 'macOS system integration and intelligent automation',
        priority: 3,
        className: 'SystemControlAgent',
        modulePath: './personal/system_control_agent',
        dependencies: ['ollama_assistant'],
        capabilities: ['system_status', 'app_control', 'system_preferences', 'automation'],
        memoryEnabled: true,
        maxLatencyMs: 5000,
        retryAttempts: 2,
      },
      {
        name: 'web_scraper',
        category: AgentCategory.PERSONAL,
        description: 'Intelligent web scraping, monitoring, and data extraction',
        priority: 4,
        className: 'WebScraperAgent',
        modulePath: './personal/web_scraper_agent',
        dependencies: ['ollama_assistant'],
        capabilities: ['scrape_website', 'monitor_website', 'api_request],
        memoryEnabled: true,
        maxLatencyMs: 10000,
        retryAttempts: 3,
      },
      {
        name: 'tool_maker',
        category: AgentCategory.PERSONAL,
        description: 'Dynamic tool creation and customization engine',
        priority: 4,
        className: 'ToolMakerAgent',
        modulePath: './personal/tool_maker_agent',
        dependencies: ['ollama_assistant'],
        capabilities: ['create_tool', 'generate_integration', 'create_workflow'],
        memoryEnabled: true,
        maxLatencyMs: 20000,
        retryAttempts: 2,
      },
    ];

    personalAgents.forEach((agent) => {
      this.agentDefinitions.set(agent.name, agent);
    });
  }

  /**
   * Get an agent, loading it lazily if needed
   */
  async getAgent(agentName: string): Promise<BaseAgent | null> {
    // Return already loaded agent
    if (this.loadedAgents.has(agentName)) {
      this.agentUsage.set(agentName, new Date());
      return this.loadedAgents.get(agentName)!;
    }

    // Check if agent definition exists
    if (!this.agentDefinitions.has(agentName)) {
      this.logger.warn(`⚠️ Agent '${agentName}' not found in registry`);
      return null;
    }

    // Handle concurrent loading attempts
    if (this.loadingLocks.has(agentName)) {
      return await this.loadingLocks.get(agentName)!;
    }

    // Start loading process
    const loadingPromise = this.loadAgent(agentName);
    this.loadingLocks.set(agentName, loadingPromise);

    try {
      const agent = await loadingPromise;
      if (agent) {
        this.loadedAgents.set(agentName, agent);
        this.agentUsage.set(agentName, new Date());
        this.logger.info(`✅ Lazy-loaded agent: ${agentName}`);
        this.emit('agent_loaded', { agentName, agent });
      }
      return agent;
    } finally {
      this.loadingLocks.delete(agentName);
    }
  }

  /**
   * Load a specific agent and its dependencies
   */
  private async loadAgent(agentName: string): Promise<BaseAgent | null> {
    try {
      const definition = this.agentDefinitions.get(agentName)!;

      // Load dependencies first
      for (const depName of definition.dependencies) {
        if (!this.loadedAgents.has(depName)) {
          const depAgent = await this.getAgent(depName);
          if (!depAgent) {
            this.logger.warn(`⚠️ Failed to load dependency '${depName}' for '${agentName}'`);
          }
        }
      }

      // Import and instantiate the agent
      const AgentClass = await this.importAgentClass(definition);
      if (!AgentClass) {
        throw new Error(`Failed to import agent class: ${definition.className}`);
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
      };

      // Instantiate and initialize agent
      let agent;
      if (definition.category === AgentCategory.PERSONAL) {
        // Personal agents need supabase client
        agent = new AgentClass(this.supabase);
      } else {
        // Other agents use config
        agent = new AgentClass(config);
      }
      await agent.initialize(this.memoryCoordinator);

      return agent;
    } catch (error) {
      this.logger.error(❌ Failed to load agent '${agentName}':`, error);
      return null;
    }
  }

  /**
   * Dynamically import agent class
   */
  private async importAgentClass(definition: AgentDefinition): Promise<unknown> {
    try {
      // Import based on category and module path
      if (definition.category === AgentCategory.PERSONAL) {
        switch (definition.name) {
          case 'personal_assistant':
            const { default: PersonalAssistantAgent } = await import(
              './personal/personal_assistant_agent'
            );
            return PersonalAssistantAgent;
          case 'calendar_agent':
            const { default: CalendarAgent } = await import('./personal/calendar_agent');
            return CalendarAgent;
          case 'photo_organizer':
            const { default: PhotoOrganizerAgent } = await import(
              './personal/photo_organizer_agent'
            );
            return PhotoOrganizerAgent;
          case 'file_manager':
            const { default: FileManagerAgent } = await import('./personal/file_manager_agent');
            return FileManagerAgent;
          case 'code_assistant':
            const { default: CodeAssistantAgent } = await import('./personal/code_assistant_agent');
            return CodeAssistantAgent;
          case 'system_control':
            const { default: SystemControlAgent } = await import('./personal/system_control_agent');
            return SystemControlAgent;
          case 'web_scraper':
            const { default: WebScraperAgent } = await import('./personal/web_scraper_agent');
            return WebScraperAgent;
          case 'tool_maker':
            const { default: ToolMakerAgent } = await import('./personal/tool_maker_agent');
            return ToolMakerAgent;
        }
      } else {
        // Import cognitive agents
        switch (definition.name) {
          case 'planner':
            const { default: EnhancedPlannerAgent } = await import(
              './cognitive/enhanced_planner_agent'
            );
            return EnhancedPlannerAgent;
          case 'retriever':
            const { default: RetrieverAgent } = await import('./cognitive/retriever_agent');
            return RetrieverAgent;
          case 'devils_advocate':
            const { default: DevilsAdvocateAgent } = await import(
              './cognitive/devils_advocate_agent'
            );
            return DevilsAdvocateAgent;
          case 'synthesizer':
            const { default: SynthesizerAgent } = await import('./cognitive/synthesizer_agent');
            return SynthesizerAgent;
          case 'reflector':
            const { default: ReflectorAgent } = await import('./cognitive/reflector_agent');
            return ReflectorAgent;
          case 'user_intent':
            const { default: UserIntentAgent } = await import('./cognitive/user_intent_agent');
            return UserIntentAgent;
          case 'tool_maker':
            const { default: ToolMakerAgent } = await import('./cognitive/tool_maker_agent');
            return ToolMakerAgent;
          case 'ethics':
            const { default: EthicsAgent } = await import('./cognitive/ethics_agent');
            return EthicsAgent;
          case 'resource_manager':
            const { default: ResourceManagerAgent } = await import(
              './cognitive/resource_manager_agent'
            );
            return ResourceManagerAgent;
          case 'orchestrator':
            const { default: OrchestratorAgent } = await import('./cognitive/orchestrator_agent');
            return OrchestratorAgent;
          case 'pydantic_ai':
            const { PydanticAIAgent } = await import('./cognitive/pydantic_ai_agent');
            return PydanticAIAgent;
          default:
            throw new Error(`Unknown cognitive agent: ${definition.name}`);
        }
      }
    } catch (error) {
      this.logger.error(❌ Failed to import agent class ${definition.className}:`, error);
      return null;
    }
  }

  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Universal Agent Registry...');
    // Registry is already initialized in constructor
    this.logger.info('✅ Universal Agent Registry initialized');
  }

  /**
   * Process a requestthrough the appropriate agent
   */
  async processRequest(agentName: string, context: any): Promise<unknown> {
    const agent = await this.loadAgent(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found or failed to load`);
    }

    // Mark agent as used
    this.agentUsage.set(agentName, new Date());

    // Process the request
    return await agent.execute(context);
  }

  /**
   * Get core agents that should be preloaded
   */
  getCoreAgents(): string[] {
    return Array.from(this.agentDefinitions.values())
      .filter((def) => def.category === AgentCategory.CORE)
      .sort((a, b) => a.priority - b.priority)
      .map((def) => def.name);
  }

  /**
   * Get all cognitive agents
   */
  getCognitiveAgents(): string[] {
    return Array.from(this.agentDefinitions.values())
      .filter((def) => def.category === AgentCategory.COGNITIVE)
      .sort((a, b) => a.priority - b.priority)
      .map((def) => def.name);
  }

  /**
   * Get all personal agents
   */
  getPersonalAgents(): string[] {
    return Array.from(this.agentDefinitions.values())
      .filter((def) => def.category === AgentCategory.PERSONAL)
      .sort((a, b) => a.priority - b.priority)
      .map((def) => def.name);
  }

  /**
   * Preload core agents for better performance
   */
  async preloadCoreAgents(): Promise<void> {
    const coreAgents = this.getCoreAgents();
    this.logger.info(`🚀 Preloading ${coreAgents.length} core agents...`);

    const loadPromises = coreAgents.map((agentName) => this.getAgent(agentName));
    const results = await Promise.allSettled(loadPromises);

    const loaded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.info(`✅ Preloaded ${loaded} core agents (${failed} failed)`);
  }

  /**
   * Get registry status and metrics
   */
  getStatus(): any {
    const definitions = Array.from(this.agentDefinitions.values());
    const loaded = Array.from(this.loadedAgents.keys());

    return {
      totalDefinitions: definitions.length,
      loadedAgents: loaded.length,
      agentsByCategory: {
        core: definitions.filter((d) => d.category === AgentCategory.CORE).length,
        cognitive: definitions.filter((d) => d.category === AgentCategory.COGNITIVE).length,
        utility: definitions.filter((d) => d.category === AgentCategory.UTILITY).length,
        specialized: definitions.filter((d) => d.category === AgentCategory.SPECIALIZED).length,
        personal: definitions.filter((d) => d.category === AgentCategory.PERSONAL).length,
      },
      loadedAgentsList: loaded,
      coreAgents: this.getCoreAgents(),
      cognitiveAgents: this.getCognitiveAgents(),
      personalAgents: this.getPersonalAgents(),
    };
  }

  /**
   * Unload agents that haven't been used recently
   */
  async unloadUnusedAgents(maxIdleMinutes = 30): Promise<void> {
    const currentTime = new Date();
    const toUnload: string[] = [];

    for (const [agentName, lastUsed] of this.agentUsage.entries()) {
      if (this.loadedAgents.has(agentName)) {
        const idleTimeMs = currentTime.getTime() - lastUsed.getTime();
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
    }

    for (const agentName of toUnload) {
      const agent = this.loadedAgents.get(agentName);
      if (agent) {
        await agent.shutdown();
        this.loadedAgents.delete(agentName);
        this.agentUsage.delete(agentName);
        this.logger.info(`♻️ Unloaded idle agent: ${agentName}`);
        this.emit('agent_unloaded', { agentName });
      }
    }

    if (toUnload.length > 0) {
      this.logger.info(`♻️ Unloaded ${toUnload.length} idle agents`);
    }
  }

  /**
   * Get agent information
   */
  getAgentInfo(agentName: string): any {
    const definition = this.agentDefinitions.get(agentName);
    if (!definition) return null;

    const isLoaded = this.loadedAgents.has(agentName);
    const lastUsed = this.agentUsage.get(agentName);
    const agent = this.loadedAgents.get(agentName);

    return {
      ...definition,
      isLoaded,
      lastUsed: lastUsed?.toISOString(),
      status: agent?.getStatus(),
    };
  }

  /**
   * Gracefully shutdown all agents
   */
  async shutdown(): Promise<void> {
    this.logger.info('🔄 Shutting down Universal Agent Registry...');

    const shutdownPromises = Array.from(this.loadedAgents.values()).map((agent) =>
      agent.shutdown().catch((error => this.logger.error(Error shutting down agent:`, error)
    );

    await Promise.allSettled(shutdownPromises);

    this.loadedAgents.clear();
    this.agentUsage.clear();
    this.loadingLocks.clear();
    this.removeAllListeners();

    this.logger.info('✅ Universal Agent Registry shutdown complete');
  }
}

export default UniversalAgentRegistry;

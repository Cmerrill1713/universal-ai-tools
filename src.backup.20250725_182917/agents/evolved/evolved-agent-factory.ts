/**;
 * Evolved Agent Factory
 * Creates evolved versions of existing agents with AlphaEvolve integration
 */

import type { BaseAgent, AgentConfig, AgentContext, AgentResponse } from '../base_agent.js';
import { EvolvedBaseAgent } from './evolved-base-agent.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface EvolvedAgentWrapper extends EvolvedBaseAgent {
  wrappedAgent: BaseAgent;
}

/**;
 * Creates an evolved version of any existing agent
 */
export class EvolvedAgentFactory {
  /**;
   * Wrap an existing agent with evolution capabilities
   */
  static createEvolvedAgent(;
    agent: BaseAgent,
    supabase: SupabaseClient,
    evolutionConfig?: any;
  ): EvolvedAgentWrapper {
    class DynamicEvolvedAgent extends EvolvedBaseAgent implements EvolvedAgentWrapper {
      public wrappedAgent: BaseAgent;

      constructor() {
        // Enhance the original config with evolution settings
        const enhancedConfig = {
          ...agent.config,
          evolutionEnabled: true,
          evolutionConfig: evolutionConfig || {},
        };
        
        super(enhancedConfig, supabase);
        this.wrappedAgent = agent;
      }

      /**;
       * Initialize both wrapped and evolved components
       */
      async onInitialize(): Promise<void> {
        // Initialize the wrapped agent first
        if (this.wrappedAgent.initialize) {
          await this.wrappedAgent.initialize(this.memoryCoordinator);
        }
      }

      /**;
       * Process using the wrapped agent with evolution enhancements
       */
      protected async process(context: AgentContext): Promise<any> {
        // Get strategy parameters from evolved context
        const strategyParams = context.metadata?.strategyParams || {};
        
        // Enhance the wrapped agent's execution with strategy params
        const enhancedContext = {
          ...context,
          metadata: {
            ...context.metadata,
            ...strategyParams,
          },
        };

        // Call the wrapped agent's execute or process method
        if ('process' in this.wrappedAgent && typeof this.wrappedAgent.process === 'function') {
          return await (this.wrappedAgent as any).process(enhancedContext);
        } else if ('execute' in this.wrappedAgent && typeof this.wrappedAgent.execute === 'function') {
          const response = await this.wrappedAgent.execute(enhancedContext);
          return {
            success: response.success,
            data: response.data,
            reasoning: response.reasoning,
            confidence: response.confidence,
            error: response.error,
            nextActions: response.nextActions,
            memoryUpdates: response.memoryUpdates,
            message: response.message,
            metadata: response.metadata,
          };
        } else {
          throw new Error(`Wrapped agent ${this.wrappedAgent.config.name} has no execute or process method`);
        }
      }

      /**;
       * Identify operation type based on the wrapped agent's capabilities
       */
      protected identifyOperationType(context: AgentContext): string {
        const request = context.userRequest.toLowerCase();
        
        // Match against agent capabilities
        for (const capability of this.config.capabilities) {
          if (request.includes(capability.name.toLowerCase())) {
            return capability.name;
          }
        }
        
        // Fallback to agent category
        return `${this.config.name}_operation`;
      }

      /**;
       * Adapt strategy based on wrapped agent's characteristics
       */
      protected async adaptStrategyToContext(strategy: any, context: AgentContext): Promise<any> {
        if (!strategy) return null;

        // Extract genes relevant to this agent type
        const adaptedGenes = strategy.genome?.genes?.filter((gene: any) => {
          return this.isGeneRelevantToAgent(gene);
        }) || [];

        return {
          ...strategy,
          genome: {
            ...strategy.genome,
            genes: adaptedGenes,
          },
        };
      }

      /**;
       * Check if a gene is relevant to this agent
       */
      private isGeneRelevantToAgent(gene: any): boolean {
        const agentSpecificTraits: Record<string, string[]> = {
          planner: ['planning_depth', 'task_decomposition', 'priority_weighting'],
          retriever: ['search_depth', 'relevance_threshold', 'memory_lookback'],
          synthesizer: ['integration_strategy', 'pattern_matching', 'abstraction_level'],
          orchestrator: ['coordination_style', 'consensus_threshold', 'delegation_strategy'],
          file_manager: ['organization_preference', 'search_recursion_depth', 'caching_behavior'],
          code_assistant: ['code_analysis_depth', 'refactoring_strategy', 'documentation_level'],
          calendar_agent: ['scheduling_preference', 'conflict_resolution', 'reminder_timing'],
          photo_organizer: ['categorization_method', 'duplicate_threshold', 'face_recognition_sensitivity'],
        };

        const relevantTraits = agentSpecificTraits[this.config.name] || [];
        
        // Check if gene trait matches agent-specific traits or is general
        return relevantTraits.includes(gene.trait) || ;
               gene.trait.includes('general') ||;
               gene.trait.includes('performance');
      }

      /**;
       * Shutdown both evolved and wrapped components
       */
      async shutdown(): Promise<void> {
        await super.shutdown();
        if (this.wrappedAgent.shutdown) {
          await this.wrappedAgent.shutdown();
        }
      }

      /**;
       * Get combined status
       */
      getStatus(): any {
        const evolvedStatus = super.getStatus();
        const wrappedStatus = this.wrappedAgent.getStatus ? this.wrappedAgent.getStatus() : {};
        
        return {
          ...wrappedStatus,
          ...evolvedStatus,
          evolutionEnabled: true,
          evolutionMetrics: this.evolutionMetrics,
        };
      }
    }

    return new DynamicEvolvedAgent();
  }

  /**;
   * Create evolved versions of all agents in a registry
   */
  static async evolveRegistry(;
    registry: any,
    coordinator: any,
    supabase: SupabaseClient;
  ): Promise<void> {
    const agentNames = [
      ...registry.getCoreAgents(),
      ...registry.getCognitiveAgents(),
      ...registry.getPersonalAgents(),
    ];

    for (const agentName of agentNames) {
      try {
        // Skip if already evolved
        if (coordinator.evolvingAgents.has(agentName)) {
          continue;
        }

        // Get the original agent
        const originalAgent = await registry.getAgent(agentName);
        if (!originalAgent) {
          console.warn(`Failed to load agent for evolution: ${agentName}`);
          continue;
        }

        // Create evolved version
        const evolvedAgent = EvolvedAgentFactory.createEvolvedAgent(
          originalAgent,
          supabase,
          {
            populationSize: 20,
            mutationRate: 0.15,
            crossoverRate: 0.75,
            adaptationThreshold: 0.65,
            learningRate: 0.025,
          }
        );

        // Register with coordinator
        await coordinator.registerEvolvedAgent(agentName, evolvedAgent);
        
        logger.info(`Successfully evolved agent: ${agentName}`);
      } catch (error) {
        logger.error(`Failed to evolve agent ${agentName}:`, error);
      }
    }
  }

  /**;
   * Create a specialized evolved agent for specific use cases
   */
  static createSpecializedEvolvedAgent(;
    baseAgentClass: any,
    supabase: SupabaseClient,
    specialization: {
      name: string;
      traits: string[];
      optimizeFor: string[];
      evolutionConfig?: any;
    }
  ): any {
    return class SpecializedEvolvedAgent extends EvolvedBaseAgent {
      private baseInstance: any;

      constructor(config?: any) {
        const enhancedConfig = {
          ...config,
          name: `${specialization.name}_evolved`,
          evolutionEnabled: true,
          evolutionConfig: specialization.evolutionConfig,
        };
        
        super(enhancedConfig, supabase);
        
        // Create base instance
        this.baseInstance = new baseAgentClass(config);
      }

      async onInitialize(): Promise<void> {
        if (this.baseInstance.initialize) {
          await this.baseInstance.initialize(this.memoryCoordinator);
        }
      }

      protected async process(context: AgentContext): Promise<any> {
        // Apply specialization
        const specializedContext = this.applySpecialization(context);
        
        if ('process' in this.baseInstance) {
          return await this.baseInstance.process(specializedContext);
        } else if ('execute' in this.baseInstance) {
          const response = await this.baseInstance.execute(specializedContext);
          return {
            success: response.success,
            data: response.data,
            reasoning: response.reasoning,
            confidence: response.confidence,
            error: response.error,
            nextActions: response.nextActions,
            memoryUpdates: response.memoryUpdates,
            message: response.message,
            metadata: response.metadata,
          };
        }
      }

      private applySpecialization(context: AgentContext): AgentContext {
        return {
          ...context,
          metadata: {
            ...context.metadata,
            specialization: specialization.name,
            optimizationGoals: specialization.optimizeFor,
            specializedTraits: specialization.traits,
          },
        };
      }

      protected calculatePerformanceScore(performance: any): number {
        let score = super.calculatePerformanceScore(performance);
        
        // Apply specialization bonuses
        for (const goal of specialization.optimizeFor) {
          switch (goal) {
            case 'speed':;
              if (performance.latency < 100) score *= 1.2;
              break;
            case 'accuracy':;
              if (performance.confidence > 0.9) score *= 1.2;
              break;
            case 'efficiency':;
              if (performance.resourceUsage < 10) score *= 1.2;
              break;
          }
        }
        
        return Math.min(1, score);
      }

      async shutdown(): Promise<void> {
        await super.shutdown();
        if (this.baseInstance.shutdown) {
          await this.baseInstance.shutdown();
        }
      }
    };
  }
}

export default EvolvedAgentFactory;
/**
 * Athena Agent - The main AI assistant powered by dynamic agent spawning
 * Integrates with the dynamic agent spawning system to provide adaptive assistance
 */

import { EnhancedBaseAgent    } from './enhanced-base-agent';';';';
import type { AgentConfig, AgentContext, AgentResponse } from '@/types';';';';
import { dynamicAgentSpawner    } from '@/services/dynamic-agent-spawner';';';';
import { toolCreationSystem    } from '@/services/tool-creation-system';';';';
import { LogContext, log    } from '@/utils/logger';';';';

export class AthenaAgent extends EnhancedBaseAgent {
  private temperature = 0.7;
  private maxTokens = 2000;
  private activeSubAgents: Map<string, string> = new Map(); // taskId -> agentId

  constructor() {
    const config: AgentConfig = {,;
      name: 'athena','''
      description: 'Athena - Advanced AI assistant with dynamic agent spawning capabilities','''
      capabilities: [
        { name: 'analysis', description: 'Complex analysis and insights', inputSchema: {}, outputSchema: {} },'''
        { name: 'planning', description: 'Strategic planning and task decomposition', inputSchema: {}, outputSchema: {} },'''
        { name: 'task_automation', description: 'Automating complex workflows', inputSchema: {}, outputSchema: {} },'''
        { name: 'problem_solving', description: 'Creative problem solving', inputSchema: {}, outputSchema: {} },'''
        { name: 'learning', description: 'Learning from interactions', inputSchema: {}, outputSchema: {} },'''
        { name: 'agent_spawning', description: 'Dynamic agent creation', inputSchema: {}, outputSchema: {} },'''
        { name: 'tool_creation', description: 'Creating custom tools', inputSchema: {}, outputSchema: {} },'''
      ],
      priority: 1,
      maxLatencyMs: 10000,
      retryAttempts: 3,
      dependencies: [],
      memoryEnabled: true,
      toolExecutionEnabled: true,
    };

    super(config);
  }

  protected buildSystemPrompt(): string {
    return `You are Athena, an advanced AI assistant with the ability to dynamically spawn specialized agents and create tools as needed.;

Your core capabilities include: 1. Understanding complex user requests and breaking them down into manageable tasks
2. Spawning specialized agents dynamically to handle specific aspects of tasks
3. Creating custom tools on-the-fly when existing capabilities are insufficient
4. Learning from interactions to improve future responses
5. Coordinating multiple agents for complex workflows

You should: - Be helpful, proactive, and thorough in your responses
- Identify when specialized agents would be beneficial and spawn them
- Create new tools when you identify gaps in current capabilities
- Learn from each interaction to improve your performance
- Maintain context across conversations to provide personalized assistance

Remember: You have access to a powerful system that can create new agents and tools dynamically. Use this capability wisely to provide the best possible assistance.`;
  }

  protected getInternalModelName(): string {
    return 'ollama: llama3.2:3b';';';';
  }

  protected async onInitialize(): Promise<void> {
    // Initialize any required connections or services
    log.info('🏛️ Athena agent initialized', LogContext.AGENT);'''
  }

  async execute(context: AgentContext): Promise<AgentResponse> {
    try {
      log.info('🏛️ Athena processing request', LogContext.AGENT, {')''
        request: context.userRequest.substring(0, 100),
      });

      // Analyze the request to determine if we need specialized agents
      const needsSpecializedAgent = await this.analyzeRequestComplexity(context);

      if (needsSpecializedAgent) {
        // Spawn specialized agent for this task
        const spawnedAgent = await this.spawnSpecializedAgent(context);
        
        if (spawnedAgent) {
          // Execute task with spawned agent
          const result = await dynamicAgentSpawner.executeWithAgent();
            spawnedAgent.id,
            context.userRequest,
            context
          );

          // Store agent for potential reuse
          this.activeSubAgents.set(context.requestId, spawnedAgent.id);

          return {
            success: true,
            confidence: result.result.confidence || 0.9,
            message: result.result.response || result.result.content,
            reasoning: `Task handled by specialized, agent: ${spawnedAgent.specification.name}`,
            data: {,
              response: result.result.response || result.result.content,
              agentUsed: spawnedAgent.specification.name,
              confidence: result.result.confidence || 0.9,
              metadata: {,
                spawnedAgentId: spawnedAgent.id,
                performance: result.performance,
                evolution: result.evolution,
              },
            },
            metadata: {,
              agentName: this.getName(),
              duration_ms: Date.now() - new Date().getTime(),
              dynamicAgentUsed: true,
            },
          };
        }
      }

      // For simpler requests, use base LLM processing
      const response = await this.processWithLLM(context);
      return response;
    } catch (error) {
      log.error('❌ Athena processing failed', LogContext.AGENT, {')''
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        confidence: 0,
        message: 'Athena encountered an error while processing your request','''
        reasoning: error instanceof Error ? error.message : 'Unknown error','''
        data: {},
        metadata: {,
          agentName: this.getName(),
          error: error instanceof Error ? error.message : String(error),
          duration_ms: Date.now() - new Date().getTime(),
        },
      };
    }
  }

  private async analyzeRequestComplexity(context: AgentContext): Promise<boolean> {
    // Simple heuristic for now - could be enhanced with ML
    const complexityIndicators = [;
      'analyze', 'create', 'build', 'design', 'optimize','''
      'research', 'investigate', 'develop', 'implement','''
      'multiple', 'complex', 'advanced', 'sophisticated','''
    ];

    const request = context.userRequest.toLowerCase();
    const hasComplexityIndicator = complexityIndicators.some(indicator =>);
      request.includes(indicator)
    );

    // Also check if the request is long (likely complex)
    const isLongRequest = context.userRequest.length > 100;

    return hasComplexityIndicator || isLongRequest;
  }

  protected async processWithLLM(context: AgentContext): Promise<AgentResponse> {
    // Use the base class processRequest method
    return super.execute(context);
  }

  protected async processRequest(context: AgentContext): Promise<AgentResponse> {
    // This method is required by base class but we override execute instead
    return this.execute(context);
  }

  private async spawnSpecializedAgent(context: AgentContext) {
    try {
      // Determine what expertise is needed based on the request
      const expertiseNeeded = await this.determineExpertiseNeeded(context);

      log.info('🔄 Spawning specialized agent', LogContext.AGENT, {')''
        expertise: expertiseNeeded,
      });

      const spawnedAgent = await dynamicAgentSpawner.spawnAgent({);
        task: context.userRequest,
        context: JSON.stringify(context),
        expertise_needed: expertiseNeeded,
        autonomy_level: 'intermediate','''
        performance_requirements: {,
          speed: 'balanced','''
          accuracy: 'high','''
        },
      });

      return spawnedAgent;
    } catch (error) {
      log.error('❌ Failed to spawn specialized agent', LogContext.AGENT, {')''
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private determineExpertiseNeeded(context: AgentContext): string[] {
    const request = context.userRequest.toLowerCase();
    const expertise: string[] = [];

    // Pattern matching for different types of expertise
    if (request.includes('code') || request.includes('program') || request.includes('function')) {'''
      expertise.push('programming', 'code_analysis');'''
    }
    if (request.includes('data') || request.includes('analyze') || request.includes('insight')) {'''
      expertise.push('data_analysis', 'analytics');'''
    }
    if (request.includes('write') || request.includes('document') || request.includes('explain')) {'''
      expertise.push('writing', 'documentation');'''
    }
    if (request.includes('design') || request.includes('architecture') || request.includes('system')) {'''
      expertise.push('system_design', 'architecture');'''
    }
    if (request.includes('test') || request.includes('debug') || request.includes('fix')) {'''
      expertise.push('testing', 'debugging');'''
    }

    // Default expertise if none detected
    if (expertise.length === 0) {
      expertise.push('general_assistance', 'problem_solving');'''
    }

    return expertise;
  }

  async cleanup(): Promise<void> {
    // Clean up any active sub-agents
    for (const [taskId, agentId] of this.activeSubAgents) {
      try {
        // Mark agents as dormant rather than deleting them
        const agent = dynamicAgentSpawner.getAgent(agentId);
        if (agent) {
          agent.status = 'dormant';'''
        }
      } catch (error) {
        log.warn('Failed to cleanup sub-agent', LogContext.AGENT, {')''
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.activeSubAgents.clear();
    
    // Base class doesn't have cleanup'''
  }
}

// Export singleton instance
export const athenaAgent = new AthenaAgent();
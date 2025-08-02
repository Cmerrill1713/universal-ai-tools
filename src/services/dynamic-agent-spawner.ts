/**
 * Dynamic Agent Spawner - Athena AI Assistant
 * Creates new agents dynamically based on user requirements and context
 * Features autonomous agent creation, tool generation, and self-improvement
 */

import { LogContext, log } from '@/utils/logger';
import { llmRouter } from './llm-router-service';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

interface AgentSpecification {
  name: string;
  purpose: string;
  capabilities: string[];
  tools: ToolDefinition[];
  systemPrompt: string;
  personality: string;
  expertise: string[];
  autonomyLevel: 'basic' | 'intermediate' | 'advanced' | 'autonomous';
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  implementation: string;
  type: 'api_call' | 'computation' | 'data_processing' | 'file_operation' | 'custom';
}

interface SpawnedAgent {
  id: string;
  specification: AgentSpecification;
  createdAt: Date;
  performance: AgentPerformance;
  evolutionHistory: EvolutionEvent[];
  status: 'active' | 'learning' | 'evolving' | 'dormant';
}

interface AgentPerformance {
  tasksCompleted: number;
  successRate: number;
  averageResponseTime: number;
  userSatisfaction: number;
  learningRate: number;
  adaptabilityScore: number;
}

interface EvolutionEvent {
  timestamp: Date;
  type: 'capability_added' | 'tool_created' | 'prompt_optimized' | 'performance_improved';
  description: string;
  impact: number;
  metrics: Record<string, any>;
}

export class DynamicAgentSpawner {
  private supabase;
  private spawnedAgents: Map<string, SpawnedAgent> = new Map();
  private evolutionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
    );
    this.startEvolutionCycle();
  }

  /**
   * Spawn a new agent based on user requirements
   */
  async spawnAgent(requirements: {
    task: string;
    context: string;
    expertise_needed: string[];
    autonomy_level?: 'basic' | 'intermediate' | 'advanced' | 'autonomous';
    performance_requirements?: {
      speed?: 'fast' | 'balanced' | 'thorough';
      accuracy?: 'high' | 'medium' | 'low';
      creativity?: 'high' | 'medium' | 'low';
    };
  }): Promise<SpawnedAgent> {
    log.info('🤖 Spawning new agent', LogContext.AGENT, { 
      task: requirements.task,
      expertiseNeeded: requirements.expertise_needed
    });

    try {
      // Analyze requirements and generate agent specification
      const specification = await this.generateAgentSpecification(requirements);
      
      // Create tools for the agent
      const tools = await this.generateToolsForAgent(specification);
      specification.tools = tools;

      // Create spawned agent instance
      const spawnedAgent: SpawnedAgent = {
        id: uuidv4(),
        specification,
        createdAt: new Date(),
        performance: {
          tasksCompleted: 0,
          successRate: 1.0,
          averageResponseTime: 0,
          userSatisfaction: 1.0,
          learningRate: 0.1,
          adaptabilityScore: 0.5
        },
        evolutionHistory: [],
        status: 'active'
      };

      // Store agent in memory and database
      this.spawnedAgents.set(spawnedAgent.id, spawnedAgent);
      await this.persistAgent(spawnedAgent);

      log.info('✅ Agent spawned successfully', LogContext.AGENT, {
        agentId: spawnedAgent.id,
        name: specification.name,
        capabilities: specification.capabilities.length,
        tools: tools.length
      });

      return spawnedAgent;

    } catch (error) {
      log.error('❌ Failed to spawn agent', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Generate agent specification using LLM
   */
  private async generateAgentSpecification(requirements: any): Promise<AgentSpecification> {
    const prompt = `Create a specialized AI agent specification for the following requirements:

Task: ${requirements.task}
Context: ${requirements.context}
Expertise Needed: ${requirements.expertise_needed.join(', ')}
Autonomy Level: ${requirements.autonomy_level || 'intermediate'}

Generate a JSON response with:
{
  "name": "Agent name (creative and descriptive)",
  "purpose": "Clear purpose statement",
  "capabilities": ["capability1", "capability2", ...],
  "systemPrompt": "Detailed system prompt for the agent",
  "personality": "Agent personality traits",
  "expertise": ["domain1", "domain2", ...],
  "autonomyLevel": "${requirements.autonomy_level || 'intermediate'}"
}

Make the agent highly specialized for the task while being creative and effective.`;

    const response = await llmRouter.generateResponse('planner-pro', [
      {
        role: 'system',
        content: 'You are an expert AI agent architect. Create precise, effective agent specifications in JSON format.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.7,
      maxTokens: 1000
    });

    // Parse JSON response
    let specification: AgentSpecification;
    try {
      const cleanedContent = response.content.replace(/```json\n?|\n?```/g, '').trim();
      specification = JSON.parse(cleanedContent);
    } catch (parseError) {
      log.warn('Failed to parse agent specification, using fallback', LogContext.AGENT);
      specification = this.createFallbackSpecification(requirements);
    }

    return specification;
  }

  /**
   * Generate tools for the agent based on its specification
   */
  private async generateToolsForAgent(specification: AgentSpecification): Promise<ToolDefinition[]> {
    const toolPrompt = `Generate 3-5 specialized tools for an AI agent with these specifications:

Name: ${specification.name}
Purpose: ${specification.purpose}
Capabilities: ${specification.capabilities.join(', ')}
Expertise: ${specification.expertise.join(', ')}

Create tools that would help this agent excel at its purpose. Return JSON array:
[
  {
    "name": "tool_name",
    "description": "What this tool does",
    "parameters": {"param1": "type", "param2": "type"},
    "implementation": "JavaScript/TypeScript implementation code",
    "type": "api_call|computation|data_processing|file_operation|custom"
  }
]

Make tools practical, specific, and highly relevant to the agent's purpose.`;

    const response = await llmRouter.generateResponse('code-expert', [
      {
        role: 'system',
        content: 'You are an expert tool creator. Generate practical, working tools for AI agents in JSON format.'
      },
      {
        role: 'user',
        content: toolPrompt
      }
    ], {
      temperature: 0.6,
      maxTokens: 1500
    });

    // Parse tools response
    let tools: ToolDefinition[];
    try {
      const cleanedContent = response.content.replace(/```json\n?|\n?```/g, '').trim();
      tools = JSON.parse(cleanedContent);
    } catch (parseError) {
      log.warn('Failed to parse tool definitions, using basic tools', LogContext.AGENT);
      tools = this.createBasicTools(specification);
    }

    return tools;
  }

  /**
   * Execute task using spawned agent
   */
  async executeWithAgent(agentId: string, task: string, context?: any): Promise<{
    result: any;
    performance: AgentPerformance;
    evolution?: EvolutionEvent;
  }> {
    const agent = this.spawnedAgents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const startTime = Date.now();
    
    try {
      // Build context-aware prompt
      const agentPrompt = this.buildAgentPrompt(agent, task, context);
      
      // Execute task with agent's specialized prompt
      const response = await llmRouter.generateResponse('planner-pro', [
        {
          role: 'system',
          content: agentPrompt
        },
        {
          role: 'user',
          content: task
        }
      ], {
        temperature: 0.7,
        maxTokens: 2000,
        includeContext: true
      });

      const executionTime = Date.now() - startTime;

      // Update performance metrics
      agent.performance.tasksCompleted++;
      agent.performance.averageResponseTime = 
        (agent.performance.averageResponseTime * (agent.performance.tasksCompleted - 1) + executionTime) / 
        agent.performance.tasksCompleted;

      // Check if agent should evolve
      const evolution = await this.checkForEvolution(agent, response, executionTime);
      
      await this.persistAgent(agent);

      return {
        result: response,
        performance: agent.performance,
        evolution
      };

    } catch (error) {
      // Handle failure and potentially trigger evolution
      agent.performance.successRate = 
        (agent.performance.successRate * agent.performance.tasksCompleted) / 
        (agent.performance.tasksCompleted + 1);
      
      throw error;
    }
  }

  /**
   * Check if agent should evolve based on performance
   */
  private async checkForEvolution(
    agent: SpawnedAgent, 
    response: any, 
    executionTime: number
  ): Promise<EvolutionEvent | undefined> {
    // Evolution triggers
    const shouldEvolve = 
      agent.performance.tasksCompleted > 5 && 
      (agent.performance.successRate < 0.8 || 
       agent.performance.averageResponseTime > 10000 ||
       agent.performance.tasksCompleted % 10 === 0);

    if (!shouldEvolve) return undefined;

    // Determine evolution type
    let evolutionType: EvolutionEvent['type'];
    let description: string;
    
    if (agent.performance.successRate < 0.8) {
      evolutionType = 'prompt_optimized';
      description = 'Optimized system prompt to improve success rate';
      await this.optimizeAgentPrompt(agent);
    } else if (agent.performance.averageResponseTime > 10000) {
      evolutionType = 'performance_improved';
      description = 'Enhanced response speed optimization';
      await this.optimizeAgentPerformance(agent);
    } else {
      evolutionType = 'capability_added';
      description = 'Added new capability based on usage patterns';
      await this.addAgentCapability(agent);
    }

    const evolutionEvent: EvolutionEvent = {
      timestamp: new Date(),
      type: evolutionType,
      description,
      impact: 0.1,
      metrics: {
        successRate: agent.performance.successRate,
        avgResponseTime: agent.performance.averageResponseTime,
        tasksCompleted: agent.performance.tasksCompleted
      }
    };

    agent.evolutionHistory.push(evolutionEvent);
    agent.status = 'evolving';

    log.info('🧬 Agent evolution triggered', LogContext.AGENT, {
      agentId: agent.id,
      evolutionType,
      description
    });

    return evolutionEvent;
  }

  /**
   * Build agent-specific prompt
   */
  private buildAgentPrompt(agent: SpawnedAgent, task: string, context?: any): string {
    const spec = agent.specification;
    
    return `${spec.systemPrompt}

AGENT IDENTITY:
- Name: ${spec.name}
- Purpose: ${spec.purpose}
- Personality: ${spec.personality}
- Expertise: ${spec.expertise.join(', ')}
- Autonomy Level: ${spec.autonomyLevel}

CAPABILITIES:
${spec.capabilities.map(cap => `- ${cap}`).join('\n')}

AVAILABLE TOOLS:
${spec.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

PERFORMANCE CONTEXT:
- Tasks Completed: ${agent.performance.tasksCompleted}
- Success Rate: ${(agent.performance.successRate * 100).toFixed(1)}%
- Evolution Events: ${agent.evolutionHistory.length}

${context ? `ADDITIONAL CONTEXT:\n${JSON.stringify(context, null, 2)}` : ''}

Provide a comprehensive, expert response using your specialized knowledge and tools.`;
  }

  /**
   * Start evolution cycle for continuous improvement
   */
  private startEvolutionCycle(): void {
    this.evolutionInterval = setInterval(async () => {
      for (const [agentId, agent] of this.spawnedAgents) {
        if (agent.status === 'active' && agent.performance.tasksCompleted > 0) {
          await this.performPeriodicEvolution(agent);
        }
      }
    }, 15 * 60 * 1000); // Every 15 minutes

    log.info('🔄 Agent evolution cycle started', LogContext.AGENT);
  }

  /**
   * Get all spawned agents
   */
  getSpawnedAgents(): SpawnedAgent[] {
    return Array.from(this.spawnedAgents.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): SpawnedAgent | undefined {
    return this.spawnedAgents.get(agentId);
  }

  /**
   * Helper methods for evolution
   */
  private async optimizeAgentPrompt(agent: SpawnedAgent): Promise<void> {
    // Use LLM to optimize the system prompt based on performance
    const optimizationPrompt = `Optimize this agent's system prompt to improve performance:

Current Prompt: ${agent.specification.systemPrompt}
Performance Issues: Success rate ${(agent.performance.successRate * 100).toFixed(1)}%

Provide an improved system prompt that addresses the performance issues.`;

    const response = await llmRouter.generateResponse('planner-pro', [
      { role: 'system', content: 'You are an expert AI prompt engineer.' },
      { role: 'user', content: optimizationPrompt }
    ]);

    agent.specification.systemPrompt = response.content;
  }

  private async optimizeAgentPerformance(agent: SpawnedAgent): Promise<void> {
    // Adjust parameters for better performance
    agent.performance.learningRate *= 1.1;
    agent.performance.adaptabilityScore = Math.min(1.0, agent.performance.adaptabilityScore + 0.1);
  }

  private async addAgentCapability(agent: SpawnedAgent): Promise<void> {
    // Add new capability based on recent tasks
    const newCapability = `advanced_${agent.specification.expertise[0]?.toLowerCase()}_analysis`;
    if (!agent.specification.capabilities.includes(newCapability)) {
      agent.specification.capabilities.push(newCapability);
    }
  }

  private async performPeriodicEvolution(agent: SpawnedAgent): Promise<void> {
    // Periodic self-improvement
    if (Math.random() < agent.performance.learningRate) {
      agent.performance.adaptabilityScore = Math.min(1.0, agent.performance.adaptabilityScore + 0.05);
    }
  }

  private createFallbackSpecification(requirements: any): AgentSpecification {
    return {
      name: `${requirements.expertise_needed[0]?.toUpperCase() || 'General'} Assistant`,
      purpose: `Specialized assistant for ${requirements.task}`,
      capabilities: ['analysis', 'problem_solving', 'task_completion'],
      tools: [],
      systemPrompt: `You are a specialized AI assistant focused on ${requirements.task}. Provide expert guidance and solutions.`,
      personality: 'professional, helpful, detail-oriented',
      expertise: requirements.expertise_needed || ['general'],
      autonomyLevel: requirements.autonomy_level || 'intermediate'
    };
  }

  private createBasicTools(specification: AgentSpecification): ToolDefinition[] {
    return [
      {
        name: 'analyze_data',
        description: 'Analyze and process data for insights',
        parameters: { data: 'any', analysis_type: 'string' },
        implementation: 'return { analysis: data, insights: [] };',
        type: 'data_processing'
      },
      {
        name: 'generate_report',
        description: 'Generate comprehensive reports',
        parameters: { topic: 'string', data: 'any' },
        implementation: 'return { report: `Report on ${topic}`, data };',
        type: 'custom'
      }
    ];
  }

  private async persistAgent(agent: SpawnedAgent): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('spawned_agents')
        .upsert({
          id: agent.id,
          specification: agent.specification,
          performance: agent.performance,
          evolution_history: agent.evolutionHistory,
          status: agent.status,
          created_at: agent.createdAt.toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        log.warn('Failed to persist agent to database', LogContext.AGENT, { error: error.message });
      }
    } catch (error) {
      log.warn('Database persistence failed, continuing in memory', LogContext.AGENT);
    }
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.evolutionInterval) {
      clearInterval(this.evolutionInterval);
    }
  }
}

export const dynamicAgentSpawner = new DynamicAgentSpawner();
export default dynamicAgentSpawner;
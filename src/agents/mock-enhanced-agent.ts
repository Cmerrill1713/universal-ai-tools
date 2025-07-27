/**
 * Mock Enhanced Agent for Testing AB-MCTS
 * Properly implements all required methods
 */

import { EnhancedBaseAgent } from './enhanced-base-agent';
import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import type { ABMCTSFeedback } from '@/types/ab-mcts';
import { ABMCTSReward } from '@/types/ab-mcts';
import { LogContext, log } from '@/utils/logger';

export interface MockAgentOptions {
  successRate?: number;
  baseExecutionTime?: number;
  capabilities?: string[];
  temperature?: number;
  maxTokens?: number;
}

export class MockEnhancedAgent extends EnhancedBaseAgent {
  private mockOptions: MockAgentOptions;
  private; // TODO: Refactor nested ternary
  executionCount = 0;

  constructor(config: AgentConfig, options: MockAgentOptions = {}) {
    super(config);
    this.mockOptions = {
      successRate: 0.7,
      baseExecutionTime: 1000,
      capabilities: config.capabilities.map((c) => c.name),
      temperature: 0.7,
      maxTokens: 1000,
      ...options,
    };
  }

  protected buildSystemPrompt(): string {
    return `You are ${this.config.name}, a specialized AI agent with capabilities: ${this.mockOptions.capabilities?.join(', ')}. 
    Your priority is ${this.config.priority} and you aim for high-quality results.`;
  }

  protected getInternalModelName(): string {
    return `mock-model-${this.config.name}`;
  }

  protected getTemperature(): number {
    return this.mockOptions.temperature || 0.7;
  }

  protected getMaxTokens(): number {
    return this.mockOptions.maxTokens || 1000;
  }

  public async execute(context: AgentContext): Promise<AgentResponse> {
    this.executionCount++;
    const startTime = Date.now();

    // Simulate execution time with some variance
    const executionTime = this.mockOptions.baseExecutionTime! + (Math.random() * 500 - 250);
    await new Promise((resolve) => setTimeout(resolve, executionTime));

    // Determine success based on agent's success rate
    const success = Math.random() < this.mockOptions.successRate!;

    // Calculate confidence based on various factors
    let confidence = this.mockOptions.successRate!;

    // Adjust confidence based on context match
    if (context.metadata?.requiredCapabilities) {
      const hasAllCapabilities = context.metadata.requiredCapabilities.every((req: string) =>
        this.mockOptions.capabilities?.includes(req)
      );
      // TODO: Refactor nested ternary
      confidence = hasAllCapabilities ? confidence + 0.1 : confidence - 0.2;
    }

    // Add some randomness
    confidence = Math.max(0.1, Math.min(0.95, confidence + (Math.random() * 0.2 - 0.1)));

    const tokensUsed = Math.floor(Math.random() * 500 + 200);

    const response: AgentResponse = {
      success,
      data: {
        result: `${this.config.name} processed request: "${context.userRequest}"`,
        executionNumber: this.executionCount,
        capabilities: this.mockOptions.capabilities,
        processingTime: Date.now() - startTime,
      },
      confidence: success ? confidence : confidence * 0.5,
      message: success
        ? `Successfully completed task using ${this.config.name}`
        : `Failed to complete task: simulated failure`,
      reasoning: `Used ${this.mockOptions.capabilities?.join(', ')} capabilities with ${(confidence * 100).toFixed(1)}% confidence`,
      metadata: {
        agentName: this.config.name,
        executionTime: Date.now() - startTime,
        model: this.getInternalModelName(),
        provider: 'mock',
        tokens: {
          prompt_tokens: Math.floor(tokensUsed * 0.3),
          completion_tokens: Math.floor(tokensUsed * 0.7),
          total_tokens: tokensUsed,
        },
      },
    };

    // Update performance tracking
    const // TODO: Refactor nested ternary
      reward = this.calculateReward(response, Date.now() - startTime, context);
    const feedback: ABMCTSFeedback = {
      nodeId: context.metadata?.nodeId || `mock-${Date.now()}`,
      reward,
      errorOccurred: !success,
      errorMessage: success ? undefined : 'Simulated failure',
      timestamp: Date.now(),
      context: {
        taskType: context.metadata?.taskType || 'general',
        userId: context.userId,
        sessionId: context.requestId,
      },
    };

    this.updatePerformance(context, response, feedback);

    return response;
  }

  public async spawnVariant(): Promise<EnhancedBaseAgent | null> {
    if (!this.shouldSpawnVariant()) {
      return null;
    }

    // Create a variant with modified parameters
    const variantConfig: AgentConfig = {
      ...this.config,
      name: `${this.config.name}-variant-${this.dynamicSpawnCount}`,
      description: `${this.config.description} (evolved variant)`,
    };

    const variantOptions: MockAgentOptions = {
      ...this.mockOptions,
      successRate: Math.min(0.95, this.mockOptions.successRate! + 0.1),
      baseExecutionTime: Math.max(500, this.mockOptions.baseExecutionTime! * 0.8),
    };

    log.info(`🧬 Spawned variant agent: ${variantConfig.name}`, LogContext.AGENT, {
      parentSuccessRate: this.getSuccessRate(),
      variantSuccessRate: variantOptions.successRate,
    });

    return new MockEnhancedAgent(variantConfig, variantOptions);
  }
}

/**
 * Create a set of mock agents for testing
 */
export function createMockAgents(): MockEnhancedAgent[] {
  const agents: MockEnhancedAgent[] = [
    new MockEnhancedAgent(
      {
        name: 'planner-agent',
        description: 'Strategic planning and task decomposition',
        priority: 1,
        capabilities: [
          { name: 'planning', description: 'Task planning', inputSchema: {}, outputSchema: {} },
          {
            name: 'reasoning',
            description: 'Logical reasoning',
            inputSchema: {},
            outputSchema: {},
          },
        ],
        maxLatencyMs: 5000,
        retryAttempts: THREE,
        dependencies: [],
      },
      { successRate: 0.85, baseExecutionTime: 800 }
    ),

    new MockEnhancedAgent(
      {
        name: 'code-agent',
        description: 'Code generation and debugging',
        priority: 2,
        capabilities: [
          { name: 'coding', description: 'Code generation', inputSchema: {}, outputSchema: {} },
          { name: 'debugging', description: 'Debug code', inputSchema: {}, outputSchema: {} },
        ],
        maxLatencyMs: 10000,
        retryAttempts: 2,
        dependencies: [],
      },
      { successRate: 0.75, baseExecutionTime: 1500 }
    ),

    new MockEnhancedAgent(
      {
        name: 'research-agent',
        description: 'Information gathering and analysis',
        priority: 3,
        capabilities: [
          { name: 'research', description: 'Research topics', inputSchema: {}, outputSchema: {} },
          { name: 'analysis', description: 'Analyze data', inputSchema: {}, outputSchema: {} },
        ],
        maxLatencyMs: 8000,
        retryAttempts: THREE,
        dependencies: [],
      },
      { successRate: 0.8, baseExecutionTime: 1200 }
    ),

    new MockEnhancedAgent(
      {
        name: 'creative-agent',
        description: 'Creative content generation',
        priority: 4,
        capabilities: [
          { name: 'creative', description: 'Creative writing', inputSchema: {}, outputSchema: {} },
          { name: 'writing', description: 'Content writing', inputSchema: {}, outputSchema: {} },
        ],
        maxLatencyMs: 6000,
        retryAttempts: 2,
        dependencies: [],
      },
      { successRate: 0.7, baseExecutionTime: 1000 }
    ),

    new MockEnhancedAgent(
      {
        name: 'fast-agent',
        description: 'Quick response for simple tasks',
        priority: 5,
        capabilities: [
          { name: 'quick', description: 'Quick responses', inputSchema: {}, outputSchema: {} },
          { name: 'simple', description: 'Simple tasks', inputSchema: {}, outputSchema: {} },
        ],
        maxLatencyMs: 2000,
        retryAttempts: 1,
        dependencies: [],
      },
      { successRate: 0.9, baseExecutionTime: 300 }
    ),
  ];

  return agents;
}

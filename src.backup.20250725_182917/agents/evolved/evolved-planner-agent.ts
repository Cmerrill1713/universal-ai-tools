/**;
 * Evolved Planner Agent
 * Enhanced planning agent with self-improving strategies
 */

import { EnhancedPlannerAgent } from '../cognitive/enhanced_planner_agent.js';
import { EvolvedBaseAgent } from './evolved-base-agent.js';
import type { AgentContext, AgentResponse } from '../base_agent.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export class EvolvedPlannerAgent extends EvolvedBaseAgent {
  private plannerInstance: EnhancedPlannerAgent;

  constructor(supabase: SupabaseClient) {
    super(;)
      {
        name: 'planner',
        description: 'Evolved strategic task planning with adaptive strategies',
        priority: 1,
        capabilities: [;
          {
            name: 'task_planning',
            description: 'Strategic task decomposition with evolution',
            inputSchema: {},
            outputSchema: {},
          },
          {
            name: 'goal_decomposition', ;
            description: 'Break down complex goals adaptively',
            inputSchema: {},
            outputSchema: {},
          },
          {
            name: 'strategy_design',
            description: 'Design execution strategies that improve over time',
            inputSchema: {},
            outputSchema: {},
          },
        ],
        maxLatencyMs: 2000,
        retryAttempts: 3,
        dependencies: [],
        memoryEnabled: true,
        evolutionEnabled: true,
        evolutionConfig: {
          populationSize: 25,
          mutationRate: 0.18,
          crossoverRate: 0.8,
          adaptationThreshold: 0.7,
          learningRate: 0.03,
        },
      },
      supabase;
    );

    // Create wrapped planner instance
    this.plannerInstance = new EnhancedPlannerAgent({
      name: 'planner_base',
      description: 'Base planner for evolution',
      priority: 1,
      capabilities: [],
      maxLatencyMs: 2000,
      retryAttempts: 3,
      dependencies: [],
      memoryEnabled: true,
    });
  }

  async onInitialize(): Promise<void> {
    await this.plannerInstance.initialize(this.memoryCoordinator);
  }

  protected async process(context: AgentContext): Promise<any> {
    // Extract evolved strategy parameters
    const strategy = context.metadata?.strategyParams || {};
    
    // Apply evolved parameters to planning
    const evolvedContext = this.applyEvolvedStrategy(context, strategy);
    
    // Execute planning with evolved parameters
    const planResult = await this.plannerInstance.execute(evolvedContext);
    
    // Enhance plan with evolution insights
    if (planResult.success && planResult.data) {
      planResult.data = this.enhancePlanWithEvolution(planResult.data, strategy);
    }

    return {
      success: planResult.success,
      data: planResult.data,
      reasoning: this.enhanceReasoning(planResult.reasoning, strategy),
      confidence: this.adjustConfidence(planResult.confidence, strategy),
      error: planResult.error,
      nextActions: planResult.nextActions,
      memoryUpdates: planResult.memoryUpdates,
      metadata: {
        ...planResult.metadata,
        evolutionGeneration: context.metadata?.evolutionGeneration,
        strategyApplied: strategy,
      },
    };
  }

  private applyEvolvedStrategy(context: AgentContext, strategy: any): AgentContext {
    // Apply evolved parameters to context
    const evolvedContext = { ...context };
    
    // Planning depth evolution
    if (strategy.planningdepth) {
      evolvedContext.metadata = {
        ...evolvedContext.metadata,
        planningDepth: Math.round(strategy.planningdepth * 10), // Scale to 1-10;
      };
    }

    // Task decomposition strategy
    if (strategy.taskdecomposition) {
      evolvedContext.metadata = {
        ...evolvedContext.metadata,
        decompositionStrategy: this.getDecompositionStrategy(strategy.taskdecomposition),
      };
    }

    // Priority weighting
    if (strategy.priorityweighting) {
      evolvedContext.metadata = {
        ...evolvedContext.metadata,
        priorityWeights: {
          urgency: strategy.priorityweighting,
          importance: 1 - strategy.priorityweighting,
          complexity: strategy.complexityweight || 0.5,
        },
      };
    }

    // Parallelization preference
    if (strategy.parallelization) {
      evolvedContext.metadata = {
        ...evolvedContext.metadata,
        preferParallel: strategy.parallelization > 0.5,
        maxParallelTasks: Math.round(strategy.parallelization * 5) + 1,
      };
    }

    return evolvedContext;
  }

  private getDecompositionStrategy(value: number): string {
    if (value < 0.33) return 'hierarchical';
    if (value < 0.67) return 'sequential';
    return 'adaptive';
  }

  private enhancePlanWithEvolution(plan: any, strategy: any): any {
    if (!plan.tasks) return plan;

    // Apply evolved optimization to tasks
    const optimizedTasks = plan.tasks.map((task: any) => {
      // Adjust task priority based on evolution
      if (strategy.priorityweighting && task.priority !== undefined) {
        task.evolutionAdjustedPriority = this.calculateEvolvedPriority(;
          task,
          strategy.priorityweighting;
        );
      }

      // Add parallelization hints
      if (strategy.parallelization && strategy.parallelization > 0.5) {
        task.canParallelize = !task.dependencies || task.dependencies.length === 0;
      }

      // Add complexity estimates
      if (strategy.complexityweight) {
        task.complexityScore = this.estimateComplexity(task, strategy.complexityweight);
      }

      return task;
    });

    // Reorder tasks based on evolved strategy
    if (strategy.executionorder) {
      optimizedTasks.sort((a: any, b: any) => {
        const scoreA = this.calculateTaskScore(a, strategy);
        const scoreB = this.calculateTaskScore(b, strategy);
        return scoreB - scoreA;
      });
    }

    return {
      ...plan,
      tasks: optimizedTasks,
      evolutionOptimized: true,
      strategySignature: this.generateStrategySignature(strategy),
    };
  }

  private calculateEvolvedPriority(task: any, weight: number): number {
    const basePriority = task.priority || 0.5;
    const urgency = task.urgent ? 1 : 0;
    const importance = task.important ? 1 : 0;
    
    return (;
      basePriority * (1 - weight) +;
      urgency * weight * 0.6 +;
      importance * weight * 0.4;
    );
  }

  private estimateComplexity(task: any, weight: number): number {
    let complexity = 0.5; // Base complexity
    
    // Adjust based on task characteristics
    if (task.subtasks && task.subtasks.length > 0) {
      complexity += 0.1 * Math.min(task.subtasks.length, 5);
    }
    
    if (task.dependencies && task.dependencies.length > 0) {
      complexity += 0.1 * Math.min(task.dependencies.length, 3);
    }
    
    if (task.estimatedDuration && task.estimatedDuration > 3600) {
      complexity += 0.2;
    }
    
    return Math.min(1, complexity * weight);
  }

  private calculateTaskScore(task: any, strategy: any): number {
    let score = 0;
    
    if (task.evolutionAdjustedPriority) {
      score += task.evolutionAdjustedPriority * 0.4;
    }
    
    if (task.complexityScore) {
      // Prefer simpler tasks if strategy suggests it
      score += (1 - task.complexityScore) * 0.3;
    }
    
    if (task.canParallelize && strategy.parallelization > 0.5) {
      score += 0.3;
    }
    
    return score;
  }

  private enhanceReasoning(reasoning: string, strategy: any): string {
    const insights = [];
    
    if (strategy.planningdepth) {
      insights.push(`Using evolved planning depth: ${Math.round(strategy.planningdepth * 10)}/10`);
    }
    
    if (strategy.taskdecomposition) {
      insights.push(`Decomposition strategy: ${this.getDecompositionStrategy(strategy.taskdecomposition)}`);
    }
    
    if (insights.length > 0) {
      return `${reasoning}\n\nEvolution insights: ${insights.join(', ')}`;
    }
    
    return reasoning;
  }

  private adjustConfidence(baseConfidence: number, strategy: any): number {
    // Adjust confidence based on strategy fitness
    if (strategy._fitness) {
      return baseConfidence * 0.7 + strategy._fitness * 0.3;
    }
    return baseConfidence;
  }

  private generateStrategySignature(strategy: any): string {
    const keys = Object.keys(strategy).sort();
    const values = keys.map(k => `${k}:${Math.round(strategy[k] * 100) / 100}`);
    return values.join('|');
  }

  protected identifyOperationType(context: AgentContext): string {
    const request = context.userRequest.toLowerCase();
    
    if (request.includes('plan') || request.includes('strategy')) {
      return 'strategic_planning';
    }
    if (request.includes('break') || request.includes('decompose')) {
      return 'task_decomposition';
    }
    if (request.includes('prioriti') || request.includes('order')) {
      return 'prioritization';
    }
    if (request.includes('optimize') || request.includes('improve')) {
      return 'optimization';
    }
    
    return 'general_planning';
  }

  /**;
   * Get planner-specific evolution status
   */
  async getPlannerEvolutionStatus(): Promise<any> {
    const baseStatus = await this.getEvolutionStatus();
    
    // Add planner-specific metrics
    const plannerMetrics = {
      averagePlanComplexity: this.calculateAveragePlanComplexity(),
      successfulPlanRate: this.calculateSuccessfulPlanRate(),
      evolutionImprovements: this.getEvolutionImprovements(),
    };
    
    return {
      ...baseStatus,
      plannerSpecific: plannerMetrics,
    };
  }

  private calculateAveragePlanComplexity(): number {
    const complexities = Array.from(this.performanceHistory.get('strategic_planning') || []);
    if (complexities.length === 0) return 0;
    return complexities.reduce((a, b) => a + b, 0) / complexities.length;
  }

  private calculateSuccessfulPlanRate(): number {
    let total = 0;
    let successful = 0;
    
    for (const [_, history] of this.performanceHistory) {
      total += history.length;
      successful += history.filter(score => score > 0.7).length;
    }
    
    return total > 0 ? successful / total : 0;
  }

  private getEvolutionImprovements(): any[] {
    const improvements = [];
    
    for (const [operation, history] of this.performanceHistory) {
      if (history.length >= 10) {
        const early = history.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        const recent = history.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const improvement = ((recent - early) / early) * 100;
        
        if (improvement > 0) {
          improvements.push({
            operation,
            improvement: Math.round(improvement),
            trend: improvement > 10 ? 'significant' : 'moderate',
          });
        }
      }
    }
    
    return improvements;
  }

  async shutdown(): Promise<void> {
    await super.shutdown();
    if (this.plannerInstance.shutdown) {
      await this.plannerInstance.shutdown();
    }
  }
}

export default EvolvedPlannerAgent;
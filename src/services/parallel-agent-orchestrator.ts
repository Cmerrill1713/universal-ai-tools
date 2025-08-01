/**
 * Parallel Agent Orchestrator - Enhanced Parallel Execution System
 * Leverages existing custom agents with intelligent parallel task distribution
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '@/utils/logger';
import type { AgentRegistry } from '@/agents/agent-registry';
import type { ABMCTSService } from './ab-mcts-service';
import type { ContextStorageService } from './context-storage-service';

export interface ParallelTask {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[];
  context: Record<string, any>;
  estimatedDuration?: number;
  maxRetries?: number;
}

export interface ParallelExecutionResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  agentUsed: string;
  retryCount: number;
}

export interface ParallelExecutionPlan {
  id: string;
  name: string;
  tasks: ParallelTask[];
  maxConcurrency: number;
  timeout: number;
  strategy: 'balanced' | 'speed' | 'quality' | 'resource_optimized';
  context: Record<string, any>;
}

export interface AgentWorkload {
  agentName: string;
  currentTasks: number;
  maxCapacity: number;
  capabilities: string[];
  performance: {
    averageTime: number;
    successRate: number;
    qualityScore: number;
  };
  isAvailable: boolean;
}

export class ParallelAgentOrchestrator extends EventEmitter {
  private activePlans: Map<string, ParallelExecutionPlan> = new Map();
  private agentWorkloads: Map<string, AgentWorkload> = new Map();
  private taskQueue: ParallelTask[] = [];
  private runningTasks: Map<string, Promise<ParallelExecutionResult>> = new Map();

  constructor(
    private agentRegistry: AgentRegistry,
    private abmctsService: ABMCTSService,
    private contextService: ContextStorageService
  ) {
    super();
    this.initializeAgentWorkloads();
  }

  /**
   * Initialize workload tracking for all available agents
   */
  private async initializeAgentWorkloads(): Promise<void> {
    const availableAgents = this.agentRegistry.getAvailableAgents();
    
    for (const agentDef of availableAgents) {
      this.agentWorkloads.set(agentDef.name, {
        agentName: agentDef.name,
        currentTasks: 0,
        maxCapacity: this.getAgentMaxCapacity(agentDef.name),
        capabilities: agentDef.capabilities,
        performance: {
          averageTime: 2000, // Default 2 seconds
          successRate: 0.95,
          qualityScore: 0.85
        },
        isAvailable: true
      });
    }

    log.info('✅ Agent workload tracking initialized', LogContext.AGENT, {
      agentCount: this.agentWorkloads.size,
      totalCapacity: Array.from(this.agentWorkloads.values())
        .reduce((sum, w) => sum + w.maxCapacity, 0)
    });
  }

  /**
   * Get maximum concurrent capacity for specific agent types
   */
  private getAgentMaxCapacity(agentName: string): number {
    const capacityMap: Record<string, number> = {
      'athena': 3, // High capacity for main orchestrator
      'planner': 2, // Strategic planning can handle multiple plans
      'retriever': 4, // Information retrieval can be highly parallel
      'synthesizer': 2, // Synthesis requires focus
      'personal_assistant': 3, // Personal tasks can be parallel
      'code_assistant': 2, // Code tasks need attention to detail
    };
    
    return capacityMap[agentName] || 1; // Default to 1 for unknown agents
  }

  /**
   * Execute a parallel execution plan with intelligent task distribution
   */
  async executePlan(plan: ParallelExecutionPlan): Promise<ParallelExecutionResult[]> {
    log.info('🚀 Starting parallel execution plan', LogContext.AGENT, {
      planId: plan.id,
      taskCount: plan.tasks.length,
      maxConcurrency: plan.maxConcurrency,
      strategy: plan.strategy
    });

    this.activePlans.set(plan.id, plan);
    const startTime = Date.now();

    try {
      // Group tasks by dependencies and priority
      const taskGroups = this.groupTasksForExecution(plan.tasks);
      const allResults: ParallelExecutionResult[] = [];

      // Execute task groups sequentially, but tasks within groups in parallel
      for (let groupIndex = 0; groupIndex < taskGroups.length; groupIndex++) {
        const taskGroup = taskGroups[groupIndex];
        
        log.info(`⚡ Executing task group ${groupIndex + 1}/${taskGroups.length}`, LogContext.AGENT, {
          planId: plan.id,
          tasksInGroup: taskGroup.length,
          taskNames: taskGroup.map(t => t.name)
        });

        // Execute tasks in this group in parallel with concurrency control
        const groupResults = await this.executeTaskGroupWithConcurrencyControl(
          taskGroup, 
          plan.maxConcurrency,
          plan.strategy,
          plan.context
        );

        allResults.push(...groupResults);

        // Check for critical failures
        const criticalFailures = groupResults.filter(r => 
          !r.success && plan.tasks.find(t => t.id === r.taskId)?.priority === 'critical'
        );

        if (criticalFailures.length > 0) {
          log.error('❌ Critical task failures, aborting plan', LogContext.AGENT, {
            planId: plan.id,
            failedTasks: criticalFailures.map(f => f.taskId)
          });
          
          this.emit('planFailed', plan.id, criticalFailures);
          return allResults;
        }
      }

      const totalTime = Date.now() - startTime;
      const successCount = allResults.filter(r => r.success).length;
      const failureCount = allResults.filter(r => !r.success).length;

      log.info('🎉 Parallel execution plan completed', LogContext.AGENT, {
        planId: plan.id,
        totalTime: `${totalTime}ms`,
        totalTasks: allResults.length,
        successful: successCount,
        failed: failureCount,
        successRate: `${Math.round(successCount / allResults.length * 100)}%`
      });

      this.emit('planCompleted', plan.id, allResults);
      return allResults;

    } catch (error) {
      log.error('❌ Parallel execution plan failed', LogContext.AGENT, {
        planId: plan.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.emit('planError', plan.id, error);
      throw error;
    } finally {
      this.activePlans.delete(plan.id);
    }
  }

  /**
   * Execute a task group with intelligent concurrency control
   */
  private async executeTaskGroupWithConcurrencyControl(
    tasks: ParallelTask[],
    maxConcurrency: number,
    strategy: string,
    globalContext: Record<string, any>
  ): Promise<ParallelExecutionResult[]> {
    const results: ParallelExecutionResult[] = [];
    const executing: Promise<ParallelExecutionResult>[] = [];
    let taskIndex = 0;

    while (taskIndex < tasks.length || executing.length > 0) {
      // Start new tasks up to concurrency limit
      while (executing.length < maxConcurrency && taskIndex < tasks.length) {
        const task = tasks[taskIndex];
        const optimalAgent = this.findOptimalAgentForTask(task, strategy);
        
        if (optimalAgent) {
          const executionPromise = this.executeTaskWithAgent(task, optimalAgent, globalContext);
          executing.push(executionPromise);
          this.updateAgentWorkload(optimalAgent, 1);
          taskIndex++;
          
          log.info(`🎯 Started task execution`, LogContext.AGENT, {
            taskId: task.id,
            taskName: task.name,
            agentUsed: optimalAgent,
            currentConcurrency: executing.length
          });
        } else {
          // No available agents, wait for one to finish
          if (executing.length > 0) {
            const result = await Promise.race(executing);
            results.push(result);
            
            // Remove completed task from executing array
            const completedIndex = executing.findIndex(p => p === Promise.resolve(result));
            if (completedIndex !== -1) {
              executing.splice(completedIndex, 1);
            }
          return undefined;
          return undefined;
            
            this.updateAgentWorkload(result.agentUsed, -1);
          } else {
            // No agents available and nothing executing - skip this task
            log.warn('⚠️ No agents available for task, skipping', LogContext.AGENT, {
              taskId: task.id,
              requiredCapabilities: task.requiredCapabilities
            });
            taskIndex++;
          }
        }
      }

      // Wait for at least one task to complete if we're at max concurrency
      if (executing.length > 0) {
        const result = await Promise.race(executing);
        results.push(result);
        
        // Remove completed task from executing array
        const completedIndex = executing.findIndex(p => p === Promise.resolve(result));
        if (completedIndex !== -1) {
          executing.splice(completedIndex, 1);
        }
      return undefined;
      return undefined;
        
        this.updateAgentWorkload(result.agentUsed, -1);
      }
    }

    return results;
  }

  /**
   * Execute a single task with the assigned agent
   */
  private async executeTaskWithAgent(
    task: ParallelTask,
    agentName: string,
    globalContext: Record<string, any>
  ): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = task.maxRetries || 2;

    while (retryCount <= maxRetries) {
      try {
        // Create execution context
        const executionContext = {
          userRequest: `Execute parallel task: ${task.name}\n\nDescription: ${task.description}`,
          taskId: task.id,
          taskName: task.name,
          requiredCapabilities: task.requiredCapabilities,
          priority: task.priority,
          ...task.context,
          ...globalContext,
          requestId: `parallel_${task.id}_${Date.now()}_${retryCount}`
        };

        // Use AB-MCTS for complex/critical tasks
        let result;
        if (task.priority === 'critical' || task.requiredCapabilities.length > 2) {
          result = await this.abmctsService.orchestrate({
            task: executionContext.userRequest,
            agents: [agentName, ...task.requiredCapabilities.slice(0, 2)],
            explorationRate: 0.15, // Lower exploration for parallel execution
            maxIterations: 25,
            context: executionContext
          });
        } else {
          // Direct agent execution for simpler tasks
          result = await this.agentRegistry.processRequest(agentName, executionContext);
        }

        // Task completed successfully
        const executionTime = Date.now() - startTime;
        this.updateAgentPerformance(agentName, executionTime, true);

        return {
          taskId: task.id,
          success: true,
          result,
          executionTime,
          agentUsed: agentName,
          retryCount
        };

      } catch (error) {
        retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        log.warn(`⚠️ Task execution attempt ${retryCount} failed`, LogContext.AGENT, {
          taskId: task.id,
          agentUsed: agentName,
          error: errorMessage,
          retriesRemaining: maxRetries - retryCount
        });

        if (retryCount > maxRetries) {
          // All retries exhausted
          const executionTime = Date.now() - startTime;
          this.updateAgentPerformance(agentName, executionTime, false);

          return {
            taskId: task.id,
            success: false,
            error: errorMessage,
            executionTime,
            agentUsed: agentName,
            retryCount: retryCount - 1
          };
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Unexpected end of retry loop');
  }

  /**
   * Find optimal agent for a task based on strategy and current workloads
   */
  private findOptimalAgentForTask(task: ParallelTask, strategy: string): string | null {
    const availableAgents = Array.from(this.agentWorkloads.values())
      .filter(workload => 
        workload.isAvailable &&
        workload.currentTasks < workload.maxCapacity &&
        task.requiredCapabilities.some(cap => workload.capabilities.includes(cap))
      );

    if (availableAgents.length === 0) {
      return null;
    }

    // Select agent based on strategy
    let selectedAgent: AgentWorkload;

    switch (strategy) {
      case 'speed':
        // Prioritize fastest agents
        selectedAgent = availableAgents.reduce((best, current) => 
          current.performance.averageTime < best.performance.averageTime ? current : best
        );
        break;

      case 'quality':
        // Prioritize highest quality agents
        selectedAgent = availableAgents.reduce((best, current) => 
          current.performance.qualityScore > best.performance.qualityScore ? current : best
        );
        break;

      case 'resource_optimized':
        // Prioritize agents with lowest current workload
        selectedAgent = availableAgents.reduce((best, current) => 
          (current.currentTasks / current.maxCapacity) < (best.currentTasks / best.maxCapacity) 
            ? current : best
        );
        break;

      case 'balanced':
      default:
        // Balance speed, quality, and workload
        selectedAgent = availableAgents.reduce((best, current) => {
          const bestScore = this.calculateAgentScore(best, task);
          const currentScore = this.calculateAgentScore(current, task);
          return currentScore > bestScore ? current : best;
        });
        break;
    }

    return selectedAgent.agentName;
  }

  /**
   * Calculate agent suitability score for balanced strategy
   */
  private calculateAgentScore(workload: AgentWorkload, task: ParallelTask): number {
    let score = 0;

    // Capability match (40% weight)
    const matchingCaps = task.requiredCapabilities.filter(cap => 
      workload.capabilities.includes(cap)
    ).length;
    score += (matchingCaps / task.requiredCapabilities.length) * 40;

    // Performance metrics (40% weight)
    score += (workload.performance.successRate * 20);
    score += (workload.performance.qualityScore * 10);
    score += ((5000 - Math.min(workload.performance.averageTime, 5000)) / 5000) * 10;

    // Workload balance (20% weight)
    const workloadRatio = workload.currentTasks / workload.maxCapacity;
    score += (1 - workloadRatio) * 20;

    return score;
  }

  /**
   * Group tasks for execution based on dependencies
   */
  private groupTasksForExecution(tasks: ParallelTask[]): ParallelTask[][] {
    const groups: ParallelTask[][] = [];
    const completed = new Set<string>();
    const remaining = [...tasks];

    while (remaining.length > 0) {
      const ready = remaining.filter(task => 
        task.dependencies.every(dep => completed.has(dep))
      );

      if (ready.length === 0) {
        // Handle circular dependencies by adding all remaining tasks
        log.warn('⚠️ Possible circular dependencies detected', LogContext.AGENT, {
          remainingTasks: remaining.map(t => t.name)
        });
        groups.push([...remaining]);
        break;
      }

      // Prioritize critical tasks
      const critical = ready.filter(t => t.priority === 'critical');
      const nonCritical = ready.filter(t => t.priority !== 'critical');

      if (critical.length > 0) {
        groups.push(critical);
        critical.forEach(t => {
          completed.add(t.id);
          const index = remaining.findIndex(r => r.id === t.id);
          if (index !== -1) remaining.splice(index, 1);
        });
      }

      if (nonCritical.length > 0) {
        groups.push(nonCritical);
        nonCritical.forEach(t => {
          completed.add(t.id);
          const index = remaining.findIndex(r => r.id === t.id);
          if (index !== -1) remaining.splice(index, 1);
        });
      }
    }

    return groups;
  }

  /**
   * Update agent workload tracking
   */
  private updateAgentWorkload(agentName: string, delta: number): void {
    const workload = this.agentWorkloads.get(agentName);
    if (workload) {
      workload.currentTasks = Math.max(0, workload.currentTasks + delta);
      workload.isAvailable = workload.currentTasks < workload.maxCapacity;
    }
    return undefined;
    return undefined;
  }

  /**
   * Update agent performance metrics based on execution results
   */
  private updateAgentPerformance(
    agentName: string, 
    executionTime: number, 
    success: boolean
  ): void {
    const workload = this.agentWorkloads.get(agentName);
    if (workload) {
      // Update moving averages
      const alpha = 0.2; // Learning rate
      
      workload.performance.averageTime = 
        workload.performance.averageTime * (1 - alpha) + executionTime * alpha;
      
      workload.performance.successRate = 
        workload.performance.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
      
      // Quality score is updated based on success and speed
      const speedFactor = Math.max(0, 1 - executionTime / 10000); // Penalize slow execution
      const qualityUpdate = success ? (0.8 + speedFactor * 0.2) : 0.3;
      
      workload.performance.qualityScore = 
        workload.performance.qualityScore * (1 - alpha) + qualityUpdate * alpha;
    }
    return undefined;
    return undefined;
  }

  /**
   * Get current system load and performance metrics
   */
  getSystemMetrics(): {
    totalAgents: number;
    activeAgents: number;
    totalCapacity: number;
    currentLoad: number;
    loadPercentage: number;
    averagePerformance: {
      averageTime: number;
      successRate: number;
      qualityScore: number;
    };
  } {
    const workloads = Array.from(this.agentWorkloads.values());
    const totalCapacity = workloads.reduce((sum, w) => sum + w.maxCapacity, 0);
    const currentLoad = workloads.reduce((sum, w) => sum + w.currentTasks, 0);
    const activeAgents = workloads.filter(w => w.currentTasks > 0).length;

    const avgPerformance = workloads.reduce(
      (avg, w) => ({
        averageTime: avg.averageTime + w.performance.averageTime / workloads.length,
        successRate: avg.successRate + w.performance.successRate / workloads.length,
        qualityScore: avg.qualityScore + w.performance.qualityScore / workloads.length,
      }),
      { averageTime: 0, successRate: 0, qualityScore: 0 }
    );

    return {
      totalAgents: workloads.length,
      activeAgents,
      totalCapacity,
      currentLoad,
      loadPercentage: Math.round((currentLoad / totalCapacity) * 100),
      averagePerformance: avgPerformance
    };
  }
}

// Export singleton factory
export let parallelAgentOrchestrator: ParallelAgentOrchestrator | null = null;

export function createParallelAgentOrchestrator(
  agentRegistry: AgentRegistry,
  abmctsService: ABMCTSService,
  contextService: ContextStorageService
): ParallelAgentOrchestrator {
  parallelAgentOrchestrator = new ParallelAgentOrchestrator(
    agentRegistry,
    abmctsService,
    contextService
  );
  return parallelAgentOrchestrator;
}
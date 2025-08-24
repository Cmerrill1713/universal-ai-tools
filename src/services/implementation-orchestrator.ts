import { v4 as uuidv4 } from 'uuid';
import { log, LogContext } from '../utils/logger';
import { AgentRegistry } from './agent-registry';

export interface ImplementationTask {
  id: string;
  name: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2';
  effort: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  assignedAgent?: string;
  estimatedDuration: number; // in minutes
  actualDuration?: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

export interface ImplementationResult {
  taskId: string;
  success: boolean;
  output: any;
  duration: number;
  agent: string;
  error?: string;
  metadata: Record<string, any>;
}

export interface ParallelExecutionPlan {
  id: string;
  tasks: ImplementationTask[];
  executionGroups: ExecutionGroup[];
  estimatedTotalTime: number;
  criticalPath: string[];
  resourceAllocation: ResourceAllocation;
}

export interface ExecutionGroup {
  id: string;
  name: string;
  tasks: ImplementationTask[];
  canExecuteInParallel: boolean;
  dependencies: string[];
  estimatedDuration: number;
  assignedAgents: string[];
}

export interface ResourceAllocation {
  maxConcurrentAgents: number;
  agentCapabilities: Map<string, string[]>;
  loadBalancing: 'round_robin' | 'capability_based' | 'load_based';
}

export class ImplementationOrchestrator {
  private agentRegistry: AgentRegistry;
  private activeExecutions: Map<
    string,
    {
      plan: ParallelExecutionPlan;
      startTime: Date;
      status: 'running' | 'completed' | 'failed';
      results: Map<string, ImplementationResult>;
    }
  > = new Map();

  constructor(agentRegistry: AgentRegistry) {
    this.agentRegistry = agentRegistry;
  }

  /**
   * Create parallel execution plan for implementation tasks
   */
  async createExecutionPlan(tasks: ImplementationTask[]): Promise<ParallelExecutionPlan> {
    log.info('📋 Creating parallel execution plan', LogContext.AI, {
      taskCount: tasks.length,
      priorities: tasks.map((t) => t.priority),
    });

    // Analyze dependencies and create execution groups
    const executionGroups = this.createExecutionGroups(tasks);

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(executionGroups);

    // Estimate total time
    const estimatedTotalTime = this.estimateTotalTime(executionGroups);

    // Allocate resources
    const resourceAllocation = this.allocateResources(executionGroups);

    const plan: ParallelExecutionPlan = {
      id: uuidv4(),
      tasks,
      executionGroups,
      estimatedTotalTime,
      criticalPath,
      resourceAllocation,
    };

    log.info('✅ Execution plan created', LogContext.AI, {
      planId: plan.id,
      estimatedTime: `${estimatedTotalTime} minutes`,
      criticalPath: criticalPath.join(' → '),
    });

    return plan;
  }

  /**
   * Execute implementation plan in parallel
   */
  async executePlan(plan: ParallelExecutionPlan): Promise<Map<string, ImplementationResult>> {
    const executionId = uuidv4();
    const startTime = new Date();

    log.info('🚀 Starting parallel implementation execution', LogContext.AI, {
      executionId,
      planId: plan.id,
      taskCount: plan.tasks.length,
      estimatedTime: `${plan.estimatedTotalTime} minutes`,
    });

    // Track execution
    this.activeExecutions.set(executionId, {
      plan,
      startTime,
      status: 'running',
      results: new Map(),
    });

    try {
      const results = new Map<string, ImplementationResult>();

      // Execute groups in dependency order with parallel execution within groups
      for (const group of plan.executionGroups) {
        log.info(`🔄 Executing group: ${group.name}`, LogContext.AI, {
          groupId: group.id,
          taskCount: group.tasks.length,
          canParallel: group.canExecuteInParallel,
        });

        if (group.canExecuteInParallel) {
          // Execute tasks in parallel
          const groupResults = await this.executeGroupParallel(group);
          groupResults.forEach((result, taskId) => {
            results.set(taskId, result);
          });
        } else {
          // Execute tasks sequentially
          for (const task of group.tasks) {
            const result = await this.executeTask(task);
            results.set(task.id, result);
          }
        }
      }

      // Update execution status
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'completed';
        execution.results = results;
      }

      log.info('✅ Parallel implementation execution completed', LogContext.AI, {
        executionId,
        completedTasks: results.size,
        totalTime: Date.now() - startTime.getTime(),
      });

      return results;
    } catch (error) {
      // Update execution status
      const execution = this.activeExecutions.get(executionId);
      if (execution) {
        execution.status = 'failed';
      }

      log.error('❌ Parallel implementation execution failed', LogContext.AI, {
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Execute a group of tasks in parallel
   */
  private async executeGroupParallel(
    group: ExecutionGroup
  ): Promise<Map<string, ImplementationResult>> {
    const results = new Map<string, ImplementationResult>();

    // Create execution promises for all tasks in the group
    const executionPromises = group.tasks.map((task) =>
      this.executeTask(task).then((result) => ({ taskId: task.id, result }))
    );

    // Execute all tasks in parallel
    const completedResults = await Promise.allSettled(executionPromises);

    // Process results
    for (const result of completedResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.taskId, result.value.result);
      } else {
        // Handle failed task
        const failedTask = group.tasks.find((t) => t.id === result.reason?.taskId);
        if (failedTask) {
          const errorResult: ImplementationResult = {
            taskId: failedTask.id,
            success: false,
            output: null,
            duration: 0,
            agent: 'unknown',
            error: result.reason?.message || 'Task execution failed',
            metadata: { status: 'failed' },
          };
          results.set(failedTask.id, errorResult);
        }
      }
    }

    return results;
  }

  /**
   * Execute a single implementation task
   */
  private async executeTask(task: ImplementationTask): Promise<ImplementationResult> {
    const startTime = Date.now();

    log.info(`🔄 Executing task: ${task.name}`, LogContext.AI, {
      taskId: task.id,
      priority: task.priority,
      estimatedDuration: task.estimatedDuration,
    });

    try {
      // Update task status
      task.status = 'in_progress';
      task.startTime = startTime;

      // Select appropriate agent based on task requirements
      const agent = await this.selectAgentForTask(task);
      task.assignedAgent = agent;

      // Execute task using selected agent
      const output = await this.executeTaskWithAgent(task, agent);

      const duration = Date.now() - startTime.getTime();

      // Update task status
      task.status = 'completed';
      task.endTime = new Date();
      task.actualDuration = duration;

      const result: ImplementationResult = {
        taskId: task.id,
        success: true,
        output,
        duration,
        agent,
        metadata: {
          priority: task.priority,
          impact: task.impact,
          risk: task.risk,
        },
      };

      log.info(`✅ Task completed: ${task.name}`, LogContext.AI, {
        taskId: task.id,
        agent,
        duration: `${duration}ms`,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime.getTime();

      // Update task status
      task.status = 'failed';
      task.endTime = new Date();
      task.actualDuration = duration;
      task.error = error instanceof Error ? error.message : String(error);

      const result: ImplementationResult = {
        taskId: task.id,
        success: false,
        output: null,
        duration,
        agent: task.assignedAgent || 'unknown',
        error: task.error,
        metadata: {
          priority: task.priority,
          impact: task.impact,
          risk: task.risk,
        },
      };

      log.error(`❌ Task failed: ${task.name}`, LogContext.AI, {
        taskId: task.id,
        error: task.error,
        duration: `${duration}ms`,
      });

      return result;
    }
  }

  /**
   * Select appropriate agent for a task
   */
  private async selectAgentForTask(task: ImplementationTask): Promise<string> {
    // Simple agent selection based on task type
    // In a real implementation, this would use more sophisticated routing

    if (task.name.toLowerCase().includes('swift')) {
      return 'swift-developer';
    } else if (
      task.name.toLowerCase().includes('jwt') ||
      task.name.toLowerCase().includes('auth')
    ) {
      return 'security-engineer';
    } else if (task.name.toLowerCase().includes('test')) {
      return 'test-automator';
    } else if (
      task.name.toLowerCase().includes('websocket') ||
      task.name.toLowerCase().includes('realtime')
    ) {
      return 'backend-developer';
    } else if (
      task.name.toLowerCase().includes('api') ||
      task.name.toLowerCase().includes('documentation')
    ) {
      return 'api-documenter';
    } else {
      return 'full-stack-developer';
    }
  }

  /**
   * Execute task using selected agent
   */
  private async executeTaskWithAgent(task: ImplementationTask, agentName: string): Promise<any> {
    // This would integrate with the actual agent execution system
    // For now, we'll simulate the execution

    log.info(`🤖 Agent ${agentName} executing task: ${task.name}`, LogContext.AI, {
      taskId: task.id,
      agent: agentName,
    });

    // Simulate task execution time based on estimated duration
    const executionTime = Math.min(task.estimatedDuration * 1000, 30000); // Cap at 30 seconds
    await new Promise((resolve) => setTimeout(resolve, executionTime));

    // Return simulated output
    return {
      status: 'completed',
      agent: agentName,
      task: task.name,
      timestamp: new Date().toISOString(),
      metadata: {
        estimatedDuration: task.estimatedDuration,
        actualDuration: executionTime / 1000,
        priority: task.priority,
      },
    };
  }

  /**
   * Create execution groups based on dependencies
   */
  private createExecutionGroups(tasks: ImplementationTask[]): ExecutionGroup[] {
    const groups: ExecutionGroup[] = [];
    const processedTasks = new Set<string>();

    // Group 1: Swift-Backend Integration (P0 - Critical)
    const swiftGroup: ExecutionGroup = {
      id: 'swift-integration',
      name: 'Swift-Backend Integration',
      tasks: tasks.filter((t) => t.name.toLowerCase().includes('swift')),
      canExecuteInParallel: true,
      dependencies: [],
      estimatedDuration: 0,
      assignedAgents: [],
    };
    swiftGroup.estimatedDuration = Math.max(...swiftGroup.tasks.map((t) => t.estimatedDuration));
    groups.push(swiftGroup);
    swiftGroup.tasks.forEach((t) => processedTasks.add(t.id));

    // Group 2: JWT Authentication (P0 - Critical)
    const jwtGroup: ExecutionGroup = {
      id: 'jwt-authentication',
      name: 'JWT Authentication',
      tasks: tasks.filter(
        (t) => t.name.toLowerCase().includes('jwt') || t.name.toLowerCase().includes('auth')
      ),
      canExecuteInParallel: false, // Sequential due to dependencies
      dependencies: ['swift-integration'],
      estimatedDuration: 0,
      assignedAgents: [],
    };
    jwtGroup.estimatedDuration = jwtGroup.tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
    groups.push(jwtGroup);
    jwtGroup.tasks.forEach((t) => processedTasks.add(t.id));

    // Group 3: Real-time Features (P1 - High)
    const realtimeGroup: ExecutionGroup = {
      id: 'realtime-features',
      name: 'Real-time Features',
      tasks: tasks.filter(
        (t) =>
          t.name.toLowerCase().includes('websocket') || t.name.toLowerCase().includes('realtime')
      ),
      canExecuteInParallel: true,
      dependencies: ['jwt-authentication'],
      estimatedDuration: 0,
      assignedAgents: [],
    };
    realtimeGroup.estimatedDuration = Math.max(
      ...realtimeGroup.tasks.map((t) => t.estimatedDuration)
    );
    groups.push(realtimeGroup);
    realtimeGroup.tasks.forEach((t) => processedTasks.add(t.id));

    // Group 4: Testing & Documentation (P1/P2 - Medium)
    const testingGroup: ExecutionGroup = {
      id: 'testing-documentation',
      name: 'Testing & Documentation',
      tasks: tasks.filter(
        (t) =>
          t.name.toLowerCase().includes('test') ||
          t.name.toLowerCase().includes('api') ||
          t.name.toLowerCase().includes('documentation')
      ),
      canExecuteInParallel: true,
      dependencies: ['realtime-features'],
      estimatedDuration: 0,
      assignedAgents: [],
    };
    testingGroup.estimatedDuration = Math.max(
      ...testingGroup.tasks.map((t) => t.estimatedDuration)
    );
    groups.push(testingGroup);
    testingGroup.tasks.forEach((t) => processedTasks.add(t.id));

    // Handle any remaining tasks
    const remainingTasks = tasks.filter((t) => !processedTasks.has(t.id));
    if (remainingTasks.length > 0) {
      const remainingGroup: ExecutionGroup = {
        id: 'remaining-tasks',
        name: 'Remaining Tasks',
        tasks: remainingTasks,
        canExecuteInParallel: true,
        dependencies: [],
        estimatedDuration: 0,
        assignedAgents: [],
      };
      remainingGroup.estimatedDuration = Math.max(
        ...remainingGroup.tasks.map((t) => t.estimatedDuration)
      );
      groups.push(remainingGroup);
    }

    return groups;
  }

  /**
   * Calculate critical path through execution groups
   */
  private calculateCriticalPath(groups: ExecutionGroup[]): string[] {
    const criticalPath: string[] = [];

    for (const group of groups) {
      if (
        group.dependencies.length === 0 ||
        group.dependencies.every((dep) => criticalPath.includes(dep))
      ) {
        criticalPath.push(group.id);
      }
    }

    return criticalPath;
  }

  /**
   * Estimate total execution time
   */
  private estimateTotalTime(groups: ExecutionGroup[]): number {
    let totalTime = 0;

    for (const group of groups) {
      if (group.dependencies.length === 0) {
        totalTime += group.estimatedDuration;
      } else {
        // Add to total time (sequential execution)
        totalTime += group.estimatedDuration;
      }
    }

    return totalTime;
  }

  /**
   * Allocate resources for execution
   */
  private allocateResources(groups: ExecutionGroup[]): ResourceAllocation {
    const maxConcurrentAgents = Math.min(6, groups.length); // Cap at 6 concurrent agents

    const agentCapabilities = new Map<string, string[]>([
      ['swift-developer', ['swift', 'ios', 'macos', 'swiftui']],
      ['security-engineer', ['jwt', 'authentication', 'security', 'crypto']],
      ['backend-developer', ['websocket', 'realtime', 'api', 'go', 'rust']],
      ['test-automator', ['testing', 'qa', 'automation', 'coverage']],
      ['api-documenter', ['documentation', 'api', 'swagger', 'openapi']],
      ['full-stack-developer', ['general', 'integration', 'coordination']],
    ]);

    return {
      maxConcurrentAgents,
      agentCapabilities,
      loadBalancing: 'capability_based',
    };
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string) {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Get all active executions
   */
  getAllActiveExecutions() {
    return Array.from(this.activeExecutions.entries()).map(([id, execution]) => ({
      id,
      ...execution,
    }));
  }
}

import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { ResourceUsage } from './agent-performance-tracker';
import { AgentPerformanceTracker } from './agent-performance-tracker';

// Pydantic-style schemas for type safety
const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'failed', 'validated']),
  assignedAgent: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  result: z.any().optional(),
  _error: z.string().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  validatedAt: z.date().optional(),
  attempts: z.number().default(0),
  maxAttempts: z.number().default(3),
  estimatedDuration: z.number().optional(), // in milliseconds
  actualDuration: z.number().optional(),
  validationScore: z.number().min(0).max(100).optional(),
});

const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  capabilities: z.array(z.string()),
  status: z.enum(['idle', 'busy', '_error, 'offline']),
  currentTask: z.string().optional(),
  tasksCompleted: z.number().default(0),
  tasksFailed: z.number().default(0),
  averageCompletionTime: z.number().default(0),
  reliability: z.number().min(0).max(100).default(100), // percentage
  lastActive: z.date(),
});

const SwarmMetricsSchema = z.object({
  totalTasks: z.number(),
  completedTasks: z.number(),
  failedTasks: z.number(),
  validatedTasks: z.number(),
  pendingTasks: z.number(),
  inProgressTasks: z.number(),
  completionPercentage: z.number(),
  validationPercentage: z.number(),
  averageTaskDuration: z.number(),
  estimatedTimeRemaining: z.number(),
  agentUtilization: z.number(), // percentage
  swarmEfficiency: z.number(), // percentage
});

type Task = z.infer<typeof TaskSchema>;
type Agent = z.infer<typeof AgentSchema>;
type SwarmMetrics = z.infer<typeof SwarmMetricsSchema>;

export interface SwarmConfig {
  maxConcurrentTasks: number;
  taskTimeout: number; // milliseconds
  validationRequired: boolean;
  autoRetry: boolean;
  priorityWeights: {
    high: number;
    medium: number;
    low: number;
  };
}

export class SwarmOrchestrator extends EventEmitter {
  private supabase: SupabaseClient;
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();
  private taskQueue: string[] = [];
  private config: SwarmConfig;
  private isRunning = false;
  private orchestrationInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private performanceTracker: AgentPerformanceTracker;

  constructor(supabase: SupabaseClient, config?: Partial<SwarmConfig>) {
    super();
    this.supabase = supabase;
    this.config = {
      maxConcurrentTasks: 10,
      taskTimeout: 300000, // 5 minutes
      validationRequired: true,
      autoRetry: true,
      priorityWeights: {
        high: 3,
        medium: 2,
        low: 1,
      },
      ...config,
    };

    // Initialize performance tracker
    this.performanceTracker = new AgentPerformanceTracker({
      supabase: this.supabase,
      realTimeUpdates: true,
      aggregationIntervals: ['hour', 'day', 'week'],
    });

    // Forward performance events
    this.performanceTracker.on('taskStarted', (data) => {
      this.emit('performance:taskStarted', data);
    });

    this.performanceTracker.on('taskCompleted', (data) => {
      this.emit('performance:taskCompleted', data);
    });

    this.performanceTracker.on('metricRecorded', (data) => {
      this.emit('performance:metricRecorded', data);
    });

    logger.info('SwarmOrchestrator initialized', LogContext.SYSTEM, this.config);
  }

  // Agent Management
  async registerAgent(agent: Omit<Agent, 'lastActive'>))): Promise<void> {
    const fullAgent: Agent = {
      ...agent,
      lastActive: new Date(),
    };

    this.agents.set(agent.id, fullAgent;

    // Store in Supabase
    await this.supabase.from('swarm_agents').upsert({
      id: fullAgent.id,
      name: fullAgent.name,
      type: fullAgent.type,
      capabilities: fullAgent.capabilities,
      status: fullAgent.status,
      reliability: fullAgent.reliability,
      last_active: fullAgent.lastActive,
    });

    this.emit('agent:registered', fullAgent);
    logger.info('Agent registered', LogContext.SYSTEM, { agentId: agent.id, name: agent.name });
  }

  async updateAgentStatus(
    agentId: string,
    status: Agent['status'],
    currentTask?: string
  ))): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.status = status;
    agent.currentTask = currentTask;
    agent.lastActive = new Date();

    await this.supabase
      .from('swarm_agents')
      .update({
        status,
        current_task: currentTask,
        last_active: agent.lastActive,
      })
      .eq('id', agentId);

    this.emit('agent:status', { agentId, status, currentTask });
  }

  // Task Management
  async addTask(task: Omit<Task, 'id' | 'attempts'>): Promise<string> {
    const taskId = randomUUID();
    const fullTask: Task = {
      ...task,
      id: taskId,
      attempts: 0,
    };

    this.tasks.set(taskId, fullTask;
    this.taskQueue.push(taskId);

    // Store in Supabase
    await this.supabase.from('swarm_tasks').insert({
      id: taskId,
      name: fullTask.name,
      description: fullTask.description,
      priority: fullTask.priority,
      status: fullTask.status,
      dependencies: fullTask.dependencies,
      estimated_duration: fullTask.estimatedDuration,
    });

    this.emit('task:added', fullTask);
    logger.info('Task added to swarm', LogContext.SYSTEM, { taskId, name: task.name });

    return taskId;
  }

  async addBulkTasks(tasks: Omit<Task, 'id' | 'attempts'>[]): Promise<string[]> {
    const taskIds: string[] = [];

    for (const task of tasks) {
      const taskId = await this.addTask(task);
      taskIds.push(taskId);
    }

    return taskIds;
  }

  // Swarm Orchestration
  async start())): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Starting swarm orchestration', LogContext.SYSTEM);

    // Start orchestration loop
    this.orchestrationInterval = setInterval(() => {
      this.orchestrate();
    }, 1000); // Run every second

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000); // Every 5 seconds

    this.emit('swarm:started');
  }

  async stop())): Promise<void> {
    this.isRunning = false;

    if (this.orchestrationInterval) {
      clearInterval(this.orchestrationInterval);
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Cleanup performance tracker
    this.performanceTracker.destroy();

    logger.info('Stopping swarm orchestration', LogContext.SYSTEM);
    this.emit('swarm:stopped');
  }

  private async orchestrate())): Promise<void> {
    // Get available agents
    const availableAgents = Array.from(this.agents.values()).filter(
      (agent) => agent.status === 'idle' && agent.reliability > 50
    );

    if (availableAgents.length === 0) return;

    // Get assignable tasks
    const assignableTasks = this.getAssignableTasks();

    // Assign tasks to agents
    for (const agent of availableAgents) {
      const task = this.selectTaskForAgent(agent, assignableTasks;
      if (task) {
        await this.assignTaskToAgent(task, agent;
        assignableTasks.splice(assignableTasks.indexOf(task), 1);
      }

      if (assignableTasks.length === 0) break;
    }
  }

  private getAssignableTasks(): Task[] {
    return Array.from(this.tasks.values());
      .filter((task) => {
        // Check if task is ready
        if (task.status !== 'pending') return false;

        // Check dependencies
        for (const depId of task.dependencies) {
          const depTask = this.tasks.get(depId);
          if (!depTask || depTask.status !== 'validated') {
            return false;
          }
        }

        return true;
      })
      .sort((a, b => {
        // Sort by priority
        const priorityA = this.config.priorityWeights[a.priority];
        const priorityB = this.config.priorityWeights[b.priority];
        return priorityB - priorityA;
      });
  }

  private selectTaskForAgent(agent: Agent, tasks: Task[]): Task | null {
    // Simple matching for now - can be enhanced with capability matching
    return tasks[0] || null;
  }

  private async assignTaskToAgent(task: Task, agent: Agent)): Promise<void> {
    task.status = 'assigned';
    task.assignedAgent = agent.id;
    task.startedAt = new Date();
    task.attempts++;

    agent.status = 'busy';
    agent.currentTask = task.id;

    // Update in Supabase
    await Promise.all([
      this.supabase
        .from('swarm_tasks')
        .update({
          status: task.status,
          assigned_agent: task.assignedAgent,
          started_at: task.startedAt,
          attempts: task.attempts,
        })
        .eq('id', task.id),

      this.updateAgentStatus(agent.id, 'busy', task.id),
    ]);

    // Track performance - task started
    await this.performanceTracker.startTaskExecution(
      agent.id,
      agent.name,
      agent.type,
      task.id,
      task.name,
      this.calculateTaskComplexity(task)
    );

    this.emit('task:assigned', { task, agent });
    logger.info('Task assigned to agent', LogContext.SYSTEM, {
      taskId: task.id,
      agentId: agent.id,
      taskName: task.name,
      agentName: agent.name,
    });

    // Set timeout for task
    setTimeout(() => {
      this.handleTaskTimeout(task.id);
    }, this.config.taskTimeout);

    // Simulate task execution (in real implementation, this would be handled by the: agent
    this.simulateTaskExecution(task, agent;
  }

  private async simulateTaskExecution(task: Task, agent: Agent)): Promise<void> {
    // Update task status to in_progress
    task.status = 'in_progress';
    await this.supabase.from('swarm_tasks').update({ status: 'in_progress' }).eq('id', task.id);

    this.emit('task:progress', { taskId: task.id, progress: 50 });

    // Simulate work being done
    const duration = task.estimatedDuration || Math.random() * 30000 + 10000; // 10-40 seconds

    setTimeout(async () => {
      // Simulate success/failure (90% success: rate
      const success = Math.random() > 0.1;

      if (success) {
        await this.completeTask(task.id, {
          success: true,
          result: `Task ${task.name} completed successfully`,
        });
      } else {
        await this.failTask(task.id, 'Simulated failure for demonstration');
      }
    }, duration);
  }

  async completeTask(
    taskId: string,
    result: { success: boolean; result?: any; error: string, }
  ))): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const agent = this.agents.get(task.assignedAgent!);
    if (!agent) return;

    task.status = result.success ? 'completed' : 'failed';
    task.result = result.result;
    task._error= result.error
    task.completedAt = new Date();
    task.actualDuration = task.completedAt.getTime() - task.startedAt!.getTime();

    // Simulate resource usage
    const resourceUsage: ResourceUsage = {
      cpu_percentage: Math.random() * 80 + 20, // 20-100%
      memory_mb: Math.random() * 1536 + 512, // 512-2048 MB
      network_kb: Math.random() * 1024,
      disk_io_kb: Math.random() * 512,
    };

    // Track performance - task completed
    await this.performanceTracker.endTaskExecution(
      agent.id,
      agent.name,
      agent.type,
      task.id,
      result.success,
      result.error
      resourceUsage
    );

    // Update agent stats
    if (result.success) {
      agent.tasksCompleted++;
    } else {
      agent.tasksFailed++;
    }

    // Update agent reliability
    const totalTasks = agent.tasksCompleted + agent.tasksFailed;
    agent.reliability = Math.round((agent.tasksCompleted / totalTasks) * 100);

    // Calculate average completion time
    if (result.success && task.actualDuration) {
      agent.averageCompletionTime = Math.round(
        (agent.averageCompletionTime * (agent.tasksCompleted - 1) + task.actualDuration) /
          agent.tasksCompleted
      );
    }

    // Free up agent
    agent.status = 'idle';
    agent.currentTask = undefined;

    // Update in Supabase
    await Promise.all([
      this.supabase
        .from('swarm_tasks')
        .update({
          status: task.status,
          result: task.result,
          _error task._error
          completed_at: task.completedAt,
          actual_duration: task.actualDuration,
        })
        .eq('id', taskId),

      this.supabase
        .from('swarm_agents')
        .update({
          tasks_completed: agent.tasksCompleted,
          tasks_failed: agent.tasksFailed,
          reliability: agent.reliability,
          average_completion_time: agent.averageCompletionTime,
          status: 'idle',
          current_task: null,
        })
        .eq('id', agent.id),
    ]);

    this.emit('task:completed', task);
    logger.info('Task completed', LogContext.SYSTEM, {
      taskId,
      success: result.success,
      duration: task.actualDuration,
    });

    // Trigger validation if required
    if (this.config.validationRequired && result.success) {
      await this.validateTask(taskId);
    }
  }

  async failTask(taskId: string, error: string)): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Check if we should retry
    if (this.config.autoRetry && task.attempts < task.maxAttempts) {
      task.status = 'pending';
      task.assignedAgent = undefined;

      logger.info('Task failed, queuing for retry', LogContext.SYSTEM, {
        taskId,
        attempts: task.attempts,
        maxAttempts: task.maxAttempts,
        _error
      });

      await this.supabase
        .from('swarm_tasks')
        .update({
          status: 'pending',
          assigned_agent: null,
        })
        .eq('id', taskId);

      this.emit('task:retry', task);
    } else {
      await this.completeTask(taskId, { success: false, error});
    }
  }

  private async handleTaskTimeout(taskId: string)): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed' || task.status === 'failed') return;

    logger.warn('Task timeout', LogContext.SYSTEM, { taskId, taskName: task.name });
    await this.failTask(taskId, 'Task timed out');
  }

  async validateTask(taskId: string)): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'completed') return;

    // Simulate validation (in real implementation, this would be done by a validator: agent
    const validationScore = Math.random() * 30 + 70; // 70-100%

    task.status = 'validated';
    task.validatedAt = new Date();
    task.validationScore = Math.round(validationScore);

    await this.supabase
      .from('swarm_tasks')
      .update({
        status: 'validated',
        validated_at: task.validatedAt,
        validation_score: task.validationScore,
      })
      .eq('id', taskId);

    this.emit('task:validated', task);
    logger.info('Task validated', LogContext.SYSTEM, {
      taskId,
      validationScore: task.validationScore,
    });
  }

  // Metrics and Monitoring
  async getMetrics(): Promise<SwarmMetrics> {
    const tasks = Array.from(this.tasks.values());
    const agents = Array.from(this.agents.values());

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const failedTasks = tasks.filter((t) => t.status === 'failed').length;
    const validatedTasks = tasks.filter((t) => t.status === 'validated').length;
    const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
    const inProgressTasks = tasks.filter(
      (t) => t.status === 'assigned' || t.status === 'in_progress'
    ).length;

    const completionPercentage =;
      totalTasks > 0 ? Math.round((validatedTasks / totalTasks) * 100) : 0;

    const validationPercentage =;
      completedTasks > 0 ? Math.round((validatedTasks / completedTasks) * 100) : 0;

    const completedTasksWithDuration = tasks.filter((t) => t.actualDuration);
    const averageTaskDuration =;
      completedTasksWithDuration.length > 0
        ? Math.round(
            completedTasksWithDuration.reduce((sum, t) => sum + t.actualDuration!, 0) /
              completedTasksWithDuration.length
          )
        : 0;

    const busyAgents = agents.filter((a) => a.status === 'busy').length;
    const agentUtilization = agents.length > 0 ? Math.round((busyAgents / agents.length) * 100) : 0;

    // Calculate estimated time remaining
    const remainingTasks = pendingTasks + inProgressTasks;
    const averageAgentTime =;
      agents.length > 0
        ? agents.reduce((sum, a) => sum + a.averageCompletionTime, 0) / agents.length
        : averageTaskDuration;

    const estimatedTimeRemaining =;
      remainingTasks > 0 && agents.length > 0
        ? Math.round((remainingTasks * averageAgentTime) / Math.max(1, agents.length - busyAgents))
        : 0;

    // Calculate swarm efficiency
    const totalPossibleTasks = agents.reduce((sum, a) => sum + a.tasksCompleted + a.tasksFailed, 0);
    const successfulTasks = agents.reduce((sum, a) => sum + a.tasksCompleted, 0);
    const swarmEfficiency =;
      totalPossibleTasks > 0 ? Math.round((successfulTasks / totalPossibleTasks) * 100) : 100;

    const metrics: SwarmMetrics = {
      totalTasks,
      completedTasks,
      failedTasks,
      validatedTasks,
      pendingTasks,
      inProgressTasks,
      completionPercentage,
      validationPercentage,
      averageTaskDuration,
      estimatedTimeRemaining,
      agentUtilization,
      swarmEfficiency,
    };

    return metrics;
  }

  private async collectMetrics())): Promise<void> {
    const metrics = await this.getMetrics();

    // Store metrics in Supabase
    await this.supabase.from('swarm_metrics').insert({
      metrics,
      collected_at: new Date(),
    });

    this.emit('metrics:updated', metrics);

    // Log progress
    logger.info('Swarm metrics', LogContext.SYSTEM, {
      completion: `${metrics.completionPercentage}%`,
      validation: `${metrics.validationPercentage}%`,
      efficiency: `${metrics.swarmEfficiency}%`,
      remaining: `${Math.round(metrics.estimatedTimeRemaining / 60000)}m`,
    });

    // Check if we're done
    if (metrics.completionPercentage === 100) {
      logger.info('🎉 All tasks completed and validated!', LogContext.SYSTEM);
      this.emit('swarm:complete');
    }
  }

  // Progress Reporting
  async getProgressReport(): Promise<string> {
    const metrics = await this.getMetrics();
    const agents = Array.from(this.agents.values());
    const tasks = Array.from(this.tasks.values());

    let report = '# Swarm Progress Report\n\n';
    report += `## Overall Progress: ${metrics.completionPercentage}%\n\n`;
    report += `### Task Summary\n`;
    report += `- Total Tasks: ${metrics.totalTasks}\n`;
    report += `- Validated: ${metrics.validatedTasks} ✓\n`;
    report += `- Completed: ${metrics.completedTasks}\n`;
    report += `- In Progress: ${metrics.inProgressTasks}\n`;
    report += `- Pending: ${metrics.pendingTasks}\n`;
    report += `- Failed: ${metrics.failedTasks}\n\n`;

    report += `### Performance Metrics\n`;
    report += `- Validation Rate: ${metrics.validationPercentage}%\n`;
    report += `- Average Task Duration: ${Math.round(metrics.averageTaskDuration / 1000)}s\n`;
    report += `- Swarm Efficiency: ${metrics.swarmEfficiency}%\n`;
    report += `- Agent Utilization: ${metrics.agentUtilization}%\n`;
    report += `- ETA: ${Math.round(metrics.estimatedTimeRemaining / 60000)} minutes\n\n`;

    report += `### Agent Performance\n`;
    for (const agent of agents) {
      report += `#### ${agent.name} (${agent.id})\n`;
      report += `- Status: ${agent.status}\n`;
      report += `- Completed: ${agent.tasksCompleted}\n`;
      report += `- Failed: ${agent.tasksFailed}\n`;
      report += `- Reliability: ${agent.reliability}%\n`;
      report += `- Avg Time: ${Math.round(agent.averageCompletionTime / 1000)}s\n\n`;
    }

    report += `### Task Details\n`;
    for (const task of tasks) {
      const status =;
        task.status === 'validated'
          ? '✓'
          : task.status === 'failed'
            ? '✗'
            : task.status === 'in_progress'
              ? '⟳'
              : task.status === 'pending'
                ? '○'
                : '◐';

      report += `- [${status}] ${task.name}`;
      if (task.validationScore) {
        report += ` (${task.validationScore}%)`;
      }
      if (task.actualDuration) {
        report += ` - ${Math.round(task.actualDuration / 1000)}s`;
      }
      report += '\n';
    }

    return report;
  }

  private calculateTaskComplexity(task: Task: number {
    // Calculate complexity based on various factors
    let complexity = 1; // Base complexity

    // Factor in dependencies
    if (task.dependencies.length > 0) {
      complexity += task.dependencies.length * 0.5;
    }

    // Factor in priority
    if (task.priority === 'high') {
      complexity += 1;
    } else if (task.priority === 'medium') {
      complexity += 0.5;
    }

    // Factor in retry attempts
    if (task.attempts > 0) {
      complexity += task.attempts * 0.3;
    }

    // Factor in estimated duration
    if (task.estimatedDuration) {
      if (task.estimatedDuration > 60000) {
        // > 1 minute
        complexity += 1;
      }
      if (task.estimatedDuration > 300000) {
        // > 5 minutes
        complexity += 1;
      }
    }

    // Cap at level 5
    return Math.min(Math.round(complexity), 5);
  }

  // Get performance metrics for agents
  async getAgentPerformanceMetrics(agentId?: string): Promise<unknown> {
    if (agentId) {
      return this.performanceTracker.getAgentPerformanceSummary(agentId);
    }

    // Get metrics for all agents
    const agentIds = Array.from(this.agents.keys());
    const comparisons = await this.performanceTracker.compareAgents(agentIds);
    return Object.fromEntries(comparisons);
  }

  // Get performance trends
  async getPerformanceTrends(
    agentId: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day',
    lookback = 7
  ): Promise<any[]> {
    return this.performanceTracker.getPerformanceTrends(agentId, period, lookback;
  }
}

// Factory function
export function createSwarmOrchestrator(
  supabase: SupabaseClient,
  config?: Partial<SwarmConfig>
): SwarmOrchestrator {
  return new SwarmOrchestrator(supabase, config;
}

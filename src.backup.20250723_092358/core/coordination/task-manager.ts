import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { DSPyTaskExecutor } from './dspy-task-executor';

export interface Task {
  id: string;
  planId: string;
  type: 'research' | 'test' | 'execute' | 'monitor' | 'coordinate';
  description: string;
  assignedAgent: string;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  _input: any;
  output?: any;
  startTime?: number;
  endTime?: number;
  error: string;
  metadata: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  estimatedDuration?: number;
}

export interface TaskCreateRequest {
  planId: string;
  type: Task['type'];
  description: string;
  assignedAgent: string;
  dependencies?: string[];
  priority?: Task['priority'];
  _input: any;
  timeout?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskUpdateRequest {
  status?: Task['status'];
  output?: any;
  error: string;
  metadata?: Record<string, unknown>;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output?: any;
  error: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface TaskDependencyGraph {
  tasks: Map<string, Task>;
  dependencies: Map<string, string[]>; // taskId -> dependent task IDs
  dependents: Map<string, string[]>; // taskId -> tasks that depend on this
}

export class TaskManager extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private taskQueue: Task[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private completedTasks: Map<string, Task> = new Map();
  private failedTasks: Map<string, Task> = new Map();
  private dependencyGraph: TaskDependencyGraph = {
    tasks: new Map(),
    dependencies: new Map(),
    dependents: new Map(),
  };
  private maxConcurrentTasks = 10;
  private taskTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private taskExecutor: DSPyTaskExecutor;

  constructor(maxConcurrentTasks = 10) {
    super();
    this.maxConcurrentTasks = maxConcurrentTasks;
    this.taskExecutor = new DSPyTaskExecutor(this);
    this.startTaskProcessor();
  }

  async createTask(request TaskCreateRequest): Promise<Task> {
    const task: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      planId: requestplanId,
      type: requesttype,
      description: requestdescription,
      assignedAgent: requestassignedAgent,
      dependencies: requestdependencies || [],
      status: 'pending',
      priority: requestpriority || 'medium',
      input request_input
      metadata: requestmetadata || {},
      retryCount: 0,
      maxRetries: requestmaxRetries || 3,
      timeout: requesttimeout || 60000, // 1 minute default
      estimatedDuration: this.estimateTaskDuration(requesttype),
    };

    this.tasks.set(task.id, task);
    this.dependencyGraph.tasks.set(task.id, task);

    // Build dependency graph
    this.buildDependencyGraph(task);

    // Add to queue if dependencies are satisfied
    if (this.areDependenciesSatisfied(task)) {
      this.addToQueue(task);
    }

    logger.info(`📋 Task created: ${task.id} (${task.type}) assigned to ${task.assignedAgent}`);
    this.emit('task_created', task);

    return task;
  }

  private buildDependencyGraph(task: Task): void {
    // Set up dependencies
    if (task.dependencies.length > 0) {
      this.dependencyGraph.dependencies.set(task.id, task.dependencies);

      // Add this task as a dependent of its dependencies
      task.dependencies.forEach((depId) => {
        if (!this.dependencyGraph.dependents.has(depId)) {
          this.dependencyGraph.dependents.set(depId, []);
        }
        this.dependencyGraph.dependents.get(depId)!.push(task.id);
      });
    }
  }

  private areDependenciesSatisfied(task: Task): boolean {
    return task.dependencies.every((depId) => {
      const depTask = this.tasks.get(depId);
      return depTask && depTask.status === 'completed';
    });
  }

  private addToQueue(task: Task): void {
    // Insert task in priority order
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const taskPriority = priorityOrder[task.priority];

    let insertIndex = this.taskQueue.length;
    for (let i = 0; i < this.taskQueue.length; i++) {
      const queuedTaskPriority = priorityOrder[this.taskQueue[i].priority];
      if (taskPriority > queuedTaskPriority) {
        insertIndex = i;
        break;
      }
    }

    this.taskQueue.splice(insertIndex, 0, task);
    logger.info(`📥 Task queued: ${task.id} (position ${insertIndex + 1})`);
  }

  private startTaskProcessor(): void {
    setInterval(() => {
      this.processTaskQueue();
    }, 1000); // Process every second
  }

  private async processTaskQueue(): Promise<void> {
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      return; // At capacity
    }

    const readyTasks = this.taskQueue.filter(
      (task) => this.areDependenciesSatisfied(task) && task.status === 'pending'
    );

    const tasksToStart = readyTasks.slice(0, this.maxConcurrentTasks - this.runningTasks.size);

    for (const task of tasksToStart) {
      await this.startTask(task);
    }
  }

  private async startTask(task: Task): Promise<void> {
    // Remove from queue
    const queueIndex = this.taskQueue.indexOf(task);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
    }

    // Mark as running
    task.status = 'running';
    task.startTime = Date.now();
    this.runningTasks.set(task.id, task);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.handleTaskTimeout(task.id);
    }, task.timeout);
    this.taskTimeouts.set(task.id, timeoutId);

    logger.info(`🚀 Task started: ${task.id} (${task.type})`);
    this.emit('task_started', task);

    try {
      // Execute task (this would be handled by the agent)
      await this.executeTask(task);
    } catch (error) {
      await this.handleTaskError(task.id, error);
    }
  }

  private async executeTask(task: Task): Promise<void> {
    // This is a placeholder - actual execution would be handled by the assigned agent
    // The agent would call updateTask with the result
    logger.info(`⚡ Executing task: ${task.id}`);

    // Simulate task execution by emitting an event
    this.emit('task_executionrequested', {
      task,
      agentId: task.assignedAgent,
    });
  }

  async updateTask(taskId: string, update: TaskUpdateRequest): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const oldStatus = task.status;

    // Update task properties
    if (update.status) task.status = update.status;
    if (update.output !== undefined) task.output = update.output;
    if (update._error task._error= update._error
    if (update.metadata) Object.assign(task.metadata, update.metadata);

    // Handle status changes
    if (update.status && update.status !== oldStatus) {
      await this.handleStatusChange(task, oldStatus, update.status);
    }

    logger.info(`📝 Task updated: ${taskId} (${oldStatus} → ${task.status})`);
    this.emit('task_updated', { task, oldStatus, newStatus: task.status });
  }

  private async handleStatusChange(
    task: Task,
    oldStatus: Task['status'],
    newStatus: Task['status']
  ): Promise<void> {
    // Clean up timeout
    const timeoutId = this.taskTimeouts.get(task.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.taskTimeouts.delete(task.id);
    }

    // Handle completion
    if (newStatus === 'completed') {
      task.endTime = Date.now();
      this.runningTasks.delete(task.id);
      this.completedTasks.set(task.id, task);

      logger.info(`✅ Task completed: ${task.id} (${task.endTime - task.startTime!}ms)`);
      this.emit('task_completed', task);

      // Check if dependent tasks can now be queued
      await this.checkDependentTasks(task.id);
    }

    // Handle failure
    if (newStatus === 'failed') {
      task.endTime = Date.now();
      this.runningTasks.delete(task.id);

      // Try to retry if retries are available
      if (task.retryCount < task.maxRetries) {
        await this.retryTask(task);
      } else {
        this.failedTasks.set(task.id, task);
        logger.error(❌ Task failed permanently: ${task.id}`);
        this.emit('task_failed', task);

        // Handle dependent tasks
        await this.handleDependentTaskFailure(task.id);
      }
    }

    // Handle cancellation
    if (newStatus === 'cancelled') {
      task.endTime = Date.now();
      this.runningTasks.delete(task.id);

      logger.warn(`🚫 Task cancelled: ${task.id}`);
      this.emit('task_cancelled', task);

      // Handle dependent tasks
      await this.handleDependentTaskFailure(task.id);
    }
  }

  private async retryTask(task: Task): Promise<void> {
    task.retryCount++;
    task.status = 'pending';
    task._error= undefined;
    task.startTime = undefined;
    task.endTime = undefined;

    logger.info(`🔄 Retrying task: ${task.id} (attempt ${task.retryCount}/${task.maxRetries})`);
    this.emit('task_retry', task);

    // Add back to queue
    this.addToQueue(task);
  }

  private async handleTaskTimeout(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') return;

    logger.warn(`⏱️ Task timeout: ${taskId}`);
    await this.updateTask(taskId, {
      status: 'failed',
      error: 'Task timeout',
    });
  }

  private async handleTaskError(taskId: string, error any): Promise<void> {
    logger.error(❌ Task _error ${taskId}`, error);
    await this.updateTask(taskId, {
      status: 'failed',
      _error error.message || 'Unknown error,
    });
  }

  private async checkDependentTasks(completedTaskId: string): Promise<void> {
    const dependents = this.dependencyGraph.dependents.get(completedTaskId) || [];

    for (const dependentId of dependents) {
      const dependentTask = this.tasks.get(dependentId);
      if (dependentTask && dependentTask.status === 'pending') {
        if (this.areDependenciesSatisfied(dependentTask)) {
          this.addToQueue(dependentTask);
        }
      }
    }
  }

  private async handleDependentTaskFailure(failedTaskId: string): Promise<void> {
    const dependents = this.dependencyGraph.dependents.get(failedTaskId) || [];

    for (const dependentId of dependents) {
      const dependentTask = this.tasks.get(dependentId);
      if (dependentTask && dependentTask.status === 'pending') {
        logger.warn(`🚫 Cancelling dependent task: ${dependentId}`);
        await this.updateTask(dependentId, {
          status: 'cancelled',
          _error `Dependency failed: ${failedTaskId}`,
        });
      }
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null;
  }

  async getTasksByPlan(planId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((task) => task.planId === planId);
  }

  async getTasksByAgent(agentId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((task) => task.assignedAgent === agentId);
  }

  async getTasksByStatus(status: Task['status']): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((task) => task.status === status);
  }

  async getTaskStats(): Promise<{
    total: number;
    byStatus: Record<Task['status'], number>;
    byType: Record<Task['type'], number>;
    byPriority: Record<Task['priority'], number>;
    averageDuration: number;
    successRate: number;
  }> {
    const tasks = Array.from(this.tasks.values());
    const total = tasks.length;

    const byStatus: Record<Task['status'], number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    const byType: Record<Task['type'], number> = {
      research: 0,
      test: 0,
      execute: 0,
      monitor: 0,
      coordinate: 0,
    };

    const byPriority: Record<Task['priority'], number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let totalDuration = 0;
    let completedCount = 0;

    tasks.forEach((task) => {
      byStatus[task.status]++;
      byType[task.type]++;
      byPriority[task.priority]++;

      if (task.status === 'completed' && task.startTime && task.endTime) {
        totalDuration += task.endTime - task.startTime;
        completedCount++;
      }
    });

    const averageDuration = completedCount > 0 ? totalDuration / completedCount : 0;
    const successRate = total > 0 ? (byStatus.completed / total) * 100 : 0;

    return {
      total,
      byStatus,
      byType,
      byPriority,
      averageDuration,
      successRate,
    };
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      throw new Error(`Cannot cancel task in status: ${task.status}`);
    }

    await this.updateTask(taskId, { status: 'cancelled' });
  }

  async getPendingTasks(): Promise<Task[]> {
    return this.taskQueue.filter((task) => task.status === 'pending');
  }

  async getRunningTasks(): Promise<Task[]> {
    return Array.from(this.runningTasks.values());
  }

  private estimateTaskDuration(type: Task['type']): number {
    // Estimate based on task type (in milliseconds)
    const estimates = {
      research: 30000, // 30 seconds
      test: 15000, // 15 seconds
      execute: 10000, // 10 seconds
      monitor: 5000, // 5 seconds
      coordinate: 2000, // 2 seconds
    };

    return estimates[type] || 10000;
  }

  async cleanup(): Promise<void> {
    // Clean up old completed and failed tasks (older than 1 hour)
    const cutoff = Date.now() - 3600000; // 1 hour
    const tasksToClean = Array.from(this.tasks.values()).filter(
      (task) =>
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        task.endTime &&
        task.endTime < cutoff
    );

    tasksToClean.forEach((task) => {
      this.tasks.delete(task.id);
      this.completedTasks.delete(task.id);
      this.failedTasks.delete(task.id);
      this.dependencyGraph.tasks.delete(task.id);
      this.dependencyGraph.dependencies.delete(task.id);
      this.dependencyGraph.dependents.delete(task.id);
    });

    if (tasksToClean.length > 0) {
      logger.info(`🧹 Cleaned up ${tasksToClean.length} old tasks`);
    }
  }

  async shutdown(): Promise<void> {
    // Cancel all running tasks
    const runningTasks = Array.from(this.runningTasks.values());
    for (const task of runningTasks) {
      await this.cancelTask(task.id);
    }

    // Clear all timeouts
    this.taskTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.taskTimeouts.clear();

    // Shutdown the task executor
    await this.taskExecutor.shutdown();

    logger.info('🔥 Task manager shut down');
  }
}

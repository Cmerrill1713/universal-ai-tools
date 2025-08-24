/**
 * Workflow Execution Pipelines
 * Advanced parallel and sequential agent execution with performance optimization
 * Part of Phase 3: Multi-Layer Orchestration - Execution Pipeline Implementation
 */

import { Logger } from '../utils/logger';
import { rustAgentRegistryClient } from './rustAgentRegistryClient';
import { agentHealthMonitor } from './agentHealthMonitor';
import type {
  WorkflowStep,
  WorkflowExecution,
  WorkflowDefinition,
} from './workflowOrchestrationEngine';
import type { AgentDefinition, AgentMetrics } from './rustAgentRegistryClient';

interface ExecutionPipelineContext {
  workflowId: string;
  executionId: string;
  stepId: string;
  input: any;
  previousResults: Record<string, any>;
  globalContext: Record<string, any>;
  timeoutMs: number;
  retryAttempt?: number;
}

interface PipelineExecutionResult {
  success: boolean;
  output: any;
  executionTimeMs: number;
  agentsUsed: string[];
  performanceMetrics: PipelineMetrics;
  errors?: PipelineExecutionError[];
  warnings?: string[];
}

interface PipelineMetrics {
  totalAgents: number;
  successfulAgents: number;
  failedAgents: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  throughput: number; // executions per second
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
  concurrencyLevel: number;
  queueTime: number;
  processingTime: number;
}

interface PipelineExecutionError {
  agentId: string;
  agentName: string;
  errorType: 'timeout' | 'execution_failed' | 'agent_unavailable' | 'capability_mismatch';
  errorMessage: string;
  timestamp: Date;
  retryable: boolean;
}

interface AgentExecutionTask {
  taskId: string;
  agent: AgentDefinition;
  input: any;
  context: Record<string, any>;
  timeout: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependencies?: string[]; // For sequential execution
}

interface AgentExecutionResult {
  taskId: string;
  agentId: string;
  agentName: string;
  success: boolean;
  output: any;
  executionTimeMs: number;
  error?: PipelineExecutionError;
  metrics: {
    queueTimeMs: number;
    processingTimeMs: number;
    responseTimeMs: number;
  };
}

class WorkflowExecutionPipelinesService {
  private readonly MAX_CONCURRENT_AGENTS = 20;
  private readonly DEFAULT_TIMEOUT_MS = 30000;
  private readonly QUEUE_MONITORING_INTERVAL_MS = 1000;

  // Execution queues for different priority levels
  private highPriorityQueue: AgentExecutionTask[] = [];
  private normalPriorityQueue: AgentExecutionTask[] = [];
  private lowPriorityQueue: AgentExecutionTask[] = [];

  // Active executions tracking
  private activeExecutions = new Map<string, AgentExecutionTask>();
  private executionResults = new Map<string, AgentExecutionResult>();

  // Performance tracking
  private pipelineMetrics = new Map<string, PipelineMetrics>();
  private isProcessingQueue = false;

  constructor() {
    this.startQueueProcessor();
  }

  /**
   * Execute single agent step with optimized performance
   */
  async executeSingleAgentStep(
    step: WorkflowStep,
    agent: AgentDefinition,
    context: ExecutionPipelineContext
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    Logger.info(`🎯 Executing single agent step: ${step.stepName} with agent ${agent.name}`);

    const task: AgentExecutionTask = {
      taskId: `${context.executionId}_${step.stepId}_${Date.now()}`,
      agent,
      input: context.input,
      context: context.globalContext,
      timeout: context.timeoutMs || this.DEFAULT_TIMEOUT_MS,
      priority: this.determinePriority(step, context),
    };

    try {
      // Execute single agent task
      const result = await this.executeAgentTask(task);

      const executionTime = Date.now() - startTime;
      const metrics = this.calculatePipelineMetrics([result], startTime);

      if (result.success) {
        Logger.info(`✅ Single agent step completed in ${executionTime}ms`);

        return {
          success: true,
          output: result.output,
          executionTimeMs: executionTime,
          agentsUsed: [result.agentId],
          performanceMetrics: metrics,
        };
      } else {
        Logger.error(`❌ Single agent step failed:`, result.error);

        return {
          success: false,
          output: null,
          executionTimeMs: executionTime,
          agentsUsed: [result.agentId],
          performanceMetrics: metrics,
          errors: result.error ? [result.error] : [],
        };
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      Logger.error(`💥 Single agent step execution error:`, error);

      return {
        success: false,
        output: null,
        executionTimeMs: executionTime,
        agentsUsed: [agent.id],
        performanceMetrics: this.createEmptyMetrics(),
        errors: [
          {
            agentId: agent.id,
            agentName: agent.name,
            errorType: 'execution_failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
            retryable: true,
          },
        ],
      };
    }
  }

  /**
   * Execute parallel agents step with intelligent load balancing
   */
  async executeParallelAgentsStep(
    step: WorkflowStep,
    agents: AgentDefinition[],
    context: ExecutionPipelineContext
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    Logger.info(`🔀 Executing parallel agents step: ${step.stepName} with ${agents.length} agents`);

    // Create parallel execution tasks
    const tasks: AgentExecutionTask[] = agents.map((agent, index) => ({
      taskId: `${context.executionId}_${step.stepId}_parallel_${index}_${Date.now()}`,
      agent,
      input: context.input,
      context: {
        ...context.globalContext,
        parallelIndex: index,
        totalParallelAgents: agents.length,
      },
      timeout: context.timeoutMs || this.DEFAULT_TIMEOUT_MS,
      priority: this.determinePriority(step, context),
    }));

    try {
      // Execute all tasks in parallel with concurrency control
      const results = await this.executeParallelTasks(tasks);
      const executionTime = Date.now() - startTime;
      const metrics = this.calculatePipelineMetrics(results, startTime);

      // Analyze results
      const successfulResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);

      Logger.info(
        `🔀 Parallel execution completed: ${successfulResults.length}/${results.length} successful in ${executionTime}ms`
      );

      // Determine overall success based on strategy
      const overallSuccess = this.evaluateParallelSuccess(successfulResults, failedResults, step);

      // Aggregate outputs from successful executions
      const aggregatedOutput = this.aggregateParallelOutputs(successfulResults, step);

      return {
        success: overallSuccess,
        output: aggregatedOutput,
        executionTimeMs: executionTime,
        agentsUsed: results.map(r => r.agentId),
        performanceMetrics: metrics,
        errors: failedResults.map(r => r.error).filter(Boolean) as PipelineExecutionError[],
        warnings:
          failedResults.length > 0
            ? [`${failedResults.length} out of ${results.length} parallel agents failed`]
            : undefined,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      Logger.error(`💥 Parallel agents execution error:`, error);

      return {
        success: false,
        output: null,
        executionTimeMs: executionTime,
        agentsUsed: agents.map(a => a.id),
        performanceMetrics: this.createEmptyMetrics(),
        errors: [
          {
            agentId: 'parallel_execution',
            agentName: 'Parallel Pipeline',
            errorType: 'execution_failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
            retryable: true,
          },
        ],
      };
    }
  }

  /**
   * Execute sequential agents step with dependency management
   */
  async executeSequentialAgentsStep(
    step: WorkflowStep,
    agents: AgentDefinition[],
    context: ExecutionPipelineContext
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    Logger.info(
      `➡️ Executing sequential agents step: ${step.stepName} with ${agents.length} agents`
    );

    const results: AgentExecutionResult[] = [];
    const errors: PipelineExecutionError[] = [];
    let currentInput = context.input;
    let allSuccessful = true;

    try {
      // Execute agents sequentially, chaining outputs
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const task: AgentExecutionTask = {
          taskId: `${context.executionId}_${step.stepId}_seq_${i}_${Date.now()}`,
          agent,
          input: currentInput,
          context: {
            ...context.globalContext,
            sequenceIndex: i,
            totalSequenceAgents: agents.length,
            previousResults: results.map(r => r.output),
          },
          timeout: context.timeoutMs || this.DEFAULT_TIMEOUT_MS,
          priority: this.determinePriority(step, context),
          dependencies: i > 0 ? [results[i - 1].taskId] : undefined,
        };

        Logger.debug(`➡️ Executing agent ${i + 1}/${agents.length}: ${agent.name}`);

        const result = await this.executeAgentTask(task);
        results.push(result);

        if (result.success) {
          // Chain output to next agent's input
          currentInput = result.output;
          Logger.debug(`✅ Agent ${i + 1} completed, chaining output to next agent`);
        } else {
          allSuccessful = false;
          if (result.error) {
            errors.push(result.error);
          }

          // Handle failure strategy for sequential execution
          const shouldContinue = this.shouldContinueSequentialExecution(step, result, i);
          if (!shouldContinue) {
            Logger.error(`🛑 Sequential execution stopped at agent ${i + 1} due to failure`);
            break;
          } else {
            Logger.warn(`⚠️ Sequential execution continuing despite failure at agent ${i + 1}`);
            // Use original input for next agent if current failed
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const metrics = this.calculatePipelineMetrics(results, startTime);

      Logger.info(
        `➡️ Sequential execution completed: ${results.filter(r => r.success).length}/${results.length} successful in ${executionTime}ms`
      );

      // For sequential execution, output is typically the last successful result
      const finalOutput = this.determineSequentialOutput(results, step);

      return {
        success: allSuccessful,
        output: finalOutput,
        executionTimeMs: executionTime,
        agentsUsed: results.map(r => r.agentId),
        performanceMetrics: metrics,
        errors: errors.length > 0 ? errors : undefined,
        warnings: !allSuccessful
          ? [`Sequential execution had ${errors.length} failures`]
          : undefined,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      Logger.error(`💥 Sequential agents execution error:`, error);

      return {
        success: false,
        output: null,
        executionTimeMs: executionTime,
        agentsUsed: agents.map(a => a.id),
        performanceMetrics: this.createEmptyMetrics(),
        errors: [
          {
            agentId: 'sequential_execution',
            agentName: 'Sequential Pipeline',
            errorType: 'execution_failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
            retryable: true,
          },
        ],
      };
    }
  }

  /**
   * Execute agent task with comprehensive monitoring
   */
  private async executeAgentTask(task: AgentExecutionTask): Promise<AgentExecutionResult> {
    const queueStartTime = Date.now();

    // Add task to appropriate priority queue
    await this.enqueueTask(task);

    // Wait for task completion
    const result = await this.waitForTaskCompletion(task.taskId);
    const queueTime = result.metrics.queueTimeMs;

    Logger.debug(
      `🎯 Agent task completed: ${task.agent.name} (queue: ${queueTime}ms, processing: ${result.metrics.processingTimeMs}ms)`
    );

    return result;
  }

  /**
   * Execute multiple tasks in parallel with concurrency control
   */
  private async executeParallelTasks(tasks: AgentExecutionTask[]): Promise<AgentExecutionResult[]> {
    // Enqueue all tasks
    const enqueuePromises = tasks.map(task => this.enqueueTask(task));
    await Promise.all(enqueuePromises);

    // Wait for all task completions
    const resultPromises = tasks.map(task => this.waitForTaskCompletion(task.taskId));
    const results = await Promise.all(resultPromises);

    return results;
  }

  /**
   * Add task to appropriate priority queue
   */
  private async enqueueTask(task: AgentExecutionTask): Promise<void> {
    const queue = this.getQueueByPriority(task.priority);
    queue.push(task);

    Logger.debug(
      `📥 Task enqueued: ${task.taskId} (priority: ${task.priority}, queue size: ${queue.length})`
    );
  }

  /**
   * Wait for task completion and return result
   */
  private async waitForTaskCompletion(taskId: string): Promise<AgentExecutionResult> {
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const result = this.executionResults.get(taskId);
        if (result) {
          this.executionResults.delete(taskId); // Cleanup
          resolve(result);
        } else {
          // Check if task is still active or if we should timeout
          setTimeout(checkCompletion, 100);
        }
      };

      setTimeout(checkCompletion, 0);
    });
  }

  /**
   * Get queue by priority level
   */
  private getQueueByPriority(
    priority: 'low' | 'normal' | 'high' | 'critical'
  ): AgentExecutionTask[] {
    switch (priority) {
      case 'critical':
      case 'high':
        return this.highPriorityQueue;
      case 'normal':
        return this.normalPriorityQueue;
      case 'low':
        return this.lowPriorityQueue;
      default:
        return this.normalPriorityQueue;
    }
  }

  /**
   * Process task queues with priority-based scheduling
   */
  private startQueueProcessor(): void {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    const processQueue = async () => {
      try {
        // Process high priority tasks first
        await this.processQueueBatch(this.highPriorityQueue, 'high');

        // Then normal priority
        await this.processQueueBatch(this.normalPriorityQueue, 'normal');

        // Finally low priority
        await this.processQueueBatch(this.lowPriorityQueue, 'low');
      } catch (error) {
        Logger.error('Queue processing error:', error);
      }

      // Schedule next processing cycle
      setTimeout(processQueue, this.QUEUE_MONITORING_INTERVAL_MS);
    };

    processQueue();
  }

  /**
   * Process a batch of tasks from specific queue
   */
  private async processQueueBatch(queue: AgentExecutionTask[], priority: string): Promise<void> {
    const availableSlots = this.MAX_CONCURRENT_AGENTS - this.activeExecutions.size;
    const tasksToProcess = queue.splice(0, Math.min(availableSlots, queue.length));

    if (tasksToProcess.length === 0) return;

    Logger.debug(
      `🔄 Processing ${tasksToProcess.length} ${priority} priority tasks (${this.activeExecutions.size} active)`
    );

    // Process tasks concurrently
    const processPromises = tasksToProcess.map(task => this.processTask(task));
    await Promise.all(processPromises);
  }

  /**
   * Process individual task
   */
  private async processTask(task: AgentExecutionTask): Promise<void> {
    const processingStartTime = Date.now();
    const queueTime = processingStartTime - parseInt(task.taskId.split('_').pop()!);

    this.activeExecutions.set(task.taskId, task);

    try {
      // Execute agent
      const executionResult = await rustAgentRegistryClient.executeAgent(
        task.agent.id,
        task.input,
        task.context,
        task.timeout
      );

      const processingTime = Date.now() - processingStartTime;
      const responseTime = processingTime; // For individual tasks, processing time = response time

      const result: AgentExecutionResult = {
        taskId: task.taskId,
        agentId: task.agent.id,
        agentName: task.agent.name,
        success: executionResult.success,
        output: executionResult.output,
        executionTimeMs: processingTime,
        metrics: {
          queueTimeMs: queueTime,
          processingTimeMs: processingTime,
          responseTimeMs: responseTime,
        },
      };

      this.executionResults.set(task.taskId, result);
      Logger.debug(`✅ Task completed: ${task.taskId} in ${processingTime}ms`);
    } catch (error) {
      const processingTime = Date.now() - processingStartTime;
      const responseTime = processingTime;

      const result: AgentExecutionResult = {
        taskId: task.taskId,
        agentId: task.agent.id,
        agentName: task.agent.name,
        success: false,
        output: null,
        executionTimeMs: processingTime,
        error: {
          agentId: task.agent.id,
          agentName: task.agent.name,
          errorType: 'execution_failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          retryable: true,
        },
        metrics: {
          queueTimeMs: queueTime,
          processingTimeMs: processingTime,
          responseTimeMs: responseTime,
        },
      };

      this.executionResults.set(task.taskId, result);
      Logger.error(`❌ Task failed: ${task.taskId}`, error);
    } finally {
      this.activeExecutions.delete(task.taskId);
    }
  }

  /**
   * Calculate comprehensive pipeline metrics
   */
  private calculatePipelineMetrics(
    results: AgentExecutionResult[],
    startTime: number
  ): PipelineMetrics {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    const responseTimes = results.map(r => r.metrics.responseTimeMs);
    const processingTimes = results.map(r => r.metrics.processingTimeMs);
    const queueTimes = results.map(r => r.metrics.queueTimeMs);

    const totalTime = Date.now() - startTime;
    const avgQueueTime = queueTimes.reduce((sum, t) => sum + t, 0) / queueTimes.length;
    const avgProcessingTime =
      processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;

    return {
      totalAgents: results.length,
      successfulAgents: successfulResults.length,
      failedAgents: failedResults.length,
      averageResponseTime: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      throughput: results.length / (totalTime / 1000), // agents per second
      resourceUtilization: {
        cpu: Math.min(100, (this.activeExecutions.size / this.MAX_CONCURRENT_AGENTS) * 100),
        memory: 0, // Would integrate with actual monitoring
        network: 0, // Would integrate with actual monitoring
      },
      concurrencyLevel: Math.min(results.length, this.MAX_CONCURRENT_AGENTS),
      queueTime: avgQueueTime,
      processingTime: avgProcessingTime,
    };
  }

  /**
   * Helper methods for execution strategies
   */
  private determinePriority(
    step: WorkflowStep,
    context: ExecutionPipelineContext
  ): 'low' | 'normal' | 'high' | 'critical' {
    // Determine priority based on step configuration, timeout, and context
    if (context.timeoutMs < 5000) return 'critical';
    if (step.stepType === 'conditional' || step.stepType === 'merge') return 'high';
    if (context.retryAttempt && context.retryAttempt > 1) return 'normal';
    return 'normal';
  }

  private evaluateParallelSuccess(
    successfulResults: AgentExecutionResult[],
    failedResults: AgentExecutionResult[],
    step: WorkflowStep
  ): boolean {
    const totalAgents = successfulResults.length + failedResults.length;
    const successRate = successfulResults.length / totalAgents;

    // Could be configured per step, for now use simple majority
    return successRate >= 0.5; // At least 50% must succeed
  }

  private aggregateParallelOutputs(results: AgentExecutionResult[], step: WorkflowStep): any {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0].output;

    // Default aggregation: combine all outputs into array
    // Could be customized based on step configuration
    return {
      type: 'parallel_aggregation',
      results: results.map(r => ({
        agentId: r.agentId,
        agentName: r.agentName,
        output: r.output,
      })),
      summary: {
        totalAgents: results.length,
        executionTime: Math.max(...results.map(r => r.executionTimeMs)),
      },
    };
  }

  private shouldContinueSequentialExecution(
    step: WorkflowStep,
    failedResult: AgentExecutionResult,
    agentIndex: number
  ): boolean {
    // Could be configured per step
    // For now, stop on any failure unless it's a retryable error
    return failedResult.error?.retryable === true && agentIndex < 2; // Continue only for first few agents
  }

  private determineSequentialOutput(results: AgentExecutionResult[], step: WorkflowStep): any {
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) return null;

    // Return the last successful result
    const lastSuccessful = successfulResults[successfulResults.length - 1];

    return {
      type: 'sequential_chain',
      finalOutput: lastSuccessful.output,
      chainSummary: {
        totalSteps: results.length,
        successfulSteps: successfulResults.length,
        finalAgent: lastSuccessful.agentName,
        totalExecutionTime: results.reduce((sum, r) => sum + r.executionTimeMs, 0),
      },
      intermediateResults: successfulResults.map(r => ({
        agentId: r.agentId,
        agentName: r.agentName,
        output: r.output,
      })),
    };
  }

  private createEmptyMetrics(): PipelineMetrics {
    return {
      totalAgents: 0,
      successfulAgents: 0,
      failedAgents: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      throughput: 0,
      resourceUtilization: { cpu: 0, memory: 0, network: 0 },
      concurrencyLevel: 0,
      queueTime: 0,
      processingTime: 0,
    };
  }

  /**
   * Get current queue status for monitoring
   */
  getQueueStatus(): {
    highPriority: number;
    normal: number;
    low: number;
    active: number;
    total: number;
  } {
    return {
      highPriority: this.highPriorityQueue.length,
      normal: this.normalPriorityQueue.length,
      low: this.lowPriorityQueue.length,
      active: this.activeExecutions.size,
      total:
        this.highPriorityQueue.length +
        this.normalPriorityQueue.length +
        this.lowPriorityQueue.length,
    };
  }

  /**
   * Get pipeline performance statistics
   */
  getPipelineStatistics(): Record<string, PipelineMetrics> {
    return Object.fromEntries(this.pipelineMetrics);
  }
}

// Export singleton instance
export const workflowExecutionPipelines = new WorkflowExecutionPipelinesService();
export default workflowExecutionPipelines;

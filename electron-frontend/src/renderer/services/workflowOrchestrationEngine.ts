/**
 * Workflow Orchestration Engine Service
 * Advanced multi-agent workflow orchestration with parallel/sequential execution
 * Part of Phase 3: Multi-Layer Orchestration
 */

import { Logger } from '../utils/logger';
import { rustAgentRegistryClient } from './rustAgentRegistryClient';
import { agentDiscoveryService } from './agentDiscoveryService';
import { agentHealthMonitor } from './agentHealthMonitor';
import { hrmIntegrationService } from './hrmIntegrationService';
import { workflowValidationFramework } from './workflowValidationFramework';
import { workflowExecutionPipelines } from './workflowExecutionPipelines';
import { workflowErrorRecovery } from './workflowErrorRecovery';
import type { AgentDefinition, AgentCapability } from './rustAgentRegistryClient';
import type { DecisionContext, DecisionResult } from './hrmIntegrationService';
import type { WorkflowError } from './workflowErrorRecovery';

export interface WorkflowStep {
  stepId: string;
  stepName: string;
  stepType:
    | 'single_agent'
    | 'parallel_agents'
    | 'sequential_agents'
    | 'conditional'
    | 'merge'
    | 'transform';
  requiredCapabilities: AgentCapability[];
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  dependencies?: string[]; // stepIds this step depends on
  conditions?: WorkflowCondition[];
  retryConfig?: RetryConfiguration;
  timeout?: number; // milliseconds
  metadata?: Record<string, any>;
}

export interface WorkflowCondition {
  conditionId: string;
  type: 'input_validation' | 'output_validation' | 'context_check' | 'performance_threshold';
  expression: string; // JSON Logic or simple expression
  onTrue?: string; // stepId to execute if condition is true
  onFalse?: string; // stepId to execute if condition is false
  description?: string;
}

export interface RetryConfiguration {
  maxRetries: number;
  retryDelay: number; // milliseconds
  backoffMultiplier?: number; // exponential backoff
  retryOnFailure: boolean;
  retryOnTimeout: boolean;
  alternativeAgents?: boolean; // try different agents on retry
}

export interface WorkflowDefinition {
  workflowId: string;
  name: string;
  description: string;
  version: string;
  steps: WorkflowStep[];
  globalTimeout?: number; // milliseconds
  errorHandling: WorkflowErrorHandling;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
}

export interface WorkflowErrorHandling {
  onStepFailure: 'stop' | 'continue' | 'retry' | 'fallback';
  fallbackWorkflow?: string; // workflowId
  errorNotifications: boolean;
  preservePartialResults: boolean;
  rollbackOnFailure?: boolean;
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  startTime: Date;
  endTime?: Date;
  totalDuration?: number; // milliseconds
  results: Record<string, any>; // stepId -> result
  errors: Record<string, any>; // stepId -> error
  context: Record<string, any>;
  performanceMetrics: WorkflowMetrics;
  agentAssignments: Record<string, string[]>; // stepId -> agentIds
}

export interface WorkflowMetrics {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  parallelStepsCount: number;
  sequentialStepsCount: number;
  averageStepDuration: number;
  longestStepDuration: number;
  shortestStepDuration: number;
  totalAgentsUsed: number;
  peakConcurrentSteps: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
  totalExecutionTime?: number;
  errorCount: number;
  fallbackExecutions?: number;
}

export interface WorkflowValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  type: 'circular_dependency' | 'missing_dependency' | 'invalid_capability' | 'schema_mismatch';
  stepId?: string;
  message: string;
  severity: 'critical' | 'error';
}

export interface ValidationWarning {
  type: 'performance_concern' | 'resource_intensive' | 'timeout_risk' | 'capability_overlap';
  stepId?: string;
  message: string;
  impact: 'high' | 'medium' | 'low';
}

export interface ValidationSuggestion {
  type: 'optimization' | 'best_practice' | 'alternative_approach';
  stepId?: string;
  message: string;
  benefit: string;
}

class WorkflowOrchestrationEngineService {
  private activeExecutions = new Map<string, WorkflowExecution>();
  private workflowDefinitions = new Map<string, WorkflowDefinition>();
  private executionHistory = new Map<string, WorkflowExecution[]>();
  private readonly MAX_CONCURRENT_EXECUTIONS = 10;
  private readonly MAX_EXECUTION_HISTORY = 100;

  /**
   * Register a new workflow definition with comprehensive validation
   */
  async registerWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
    Logger.info(`🔄 Registering workflow: ${workflow.name} (${workflow.workflowId})`);

    // Comprehensive workflow validation using validation framework
    const validationResult = await workflowValidationFramework.validateWorkflow(workflow);
    if (!validationResult.isValid) {
      Logger.error('Workflow validation failed:', validationResult.errors);
      throw new Error(
        `Workflow validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
      );
    }

    // Store workflow definition
    this.workflowDefinitions.set(workflow.workflowId, {
      ...workflow,
      updatedAt: new Date(),
    });

    Logger.info(`✅ Workflow registered successfully: ${workflow.name}`);
    return {
      success: true,
      validationResult,
      workflowId: workflow.workflowId,
      registeredAt: new Date(),
    };
  }

  /**
   * Execute a workflow with intelligent orchestration
   */
  async executeWorkflow(
    workflowId: string,
    initialContext: Record<string, any> = {},
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflowDefinitions.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Check execution limits
    if (this.activeExecutions.size >= this.MAX_CONCURRENT_EXECUTIONS) {
      throw new Error('Maximum concurrent workflow executions reached');
    }

    const executionId = `exec_${workflowId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    Logger.info(`🚀 Starting workflow execution: ${workflow.name} (${executionId})`);

    const execution: WorkflowExecution = {
      executionId,
      workflowId,
      status: 'running',
      completedSteps: [],
      failedSteps: [],
      startTime: new Date(),
      results: {},
      errors: {},
      context: { ...initialContext },
      performanceMetrics: {
        totalSteps: workflow.steps.length,
        completedSteps: 0,
        failedSteps: 0,
        parallelStepsCount: workflow.steps.filter(s => s.stepType === 'parallel_agents').length,
        sequentialStepsCount: workflow.steps.filter(s => s.stepType === 'sequential_agents').length,
        averageStepDuration: 0,
        longestStepDuration: 0,
        shortestStepDuration: 0,
        totalAgentsUsed: 0,
        peakConcurrentSteps: 0,
        resourceUtilization: { cpu: 0, memory: 0, network: 0 },
        errorCount: 0,
        fallbackExecutions: 0,
      },
      agentAssignments: {},
    };

    this.activeExecutions.set(executionId, execution);

    try {
      // Execute workflow with intelligent orchestration
      await this.executeWorkflowSteps(workflow, execution, options);

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.totalDuration = execution.endTime.getTime() - execution.startTime.getTime();

      Logger.info(
        `✅ Workflow execution completed: ${executionId} in ${execution.totalDuration}ms`
      );
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.totalDuration = execution.endTime
        ? execution.endTime.getTime() - execution.startTime.getTime()
        : 0;

      Logger.error(`❌ Workflow execution failed: ${executionId}`, error);

      // Handle error according to workflow error handling configuration
      await this.handleWorkflowError(workflow, execution, error);
    } finally {
      // Move to history and cleanup
      this.moveExecutionToHistory(execution);
      this.activeExecutions.delete(executionId);
    }

    return execution;
  }

  /**
   * Execute workflow steps with intelligent orchestration logic
   */
  private async executeWorkflowSteps(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const stepExecutionOrder = this.calculateStepExecutionOrder(workflow.steps);
    const concurrentStepGroups = this.groupStepsForConcurrentExecution(
      stepExecutionOrder,
      workflow.steps
    );

    Logger.debug(`📋 Executing workflow with ${concurrentStepGroups.length} step groups`);

    for (const stepGroup of concurrentStepGroups) {
      // Execute steps in current group (potentially in parallel)
      await this.executeStepGroup(stepGroup, workflow, execution, options);

      // Update execution metrics
      execution.performanceMetrics.peakConcurrentSteps = Math.max(
        execution.performanceMetrics.peakConcurrentSteps,
        stepGroup.length
      );
    }
  }

  /**
   * Execute a group of steps (parallel execution within group)
   */
  private async executeStepGroup(
    stepGroup: WorkflowStep[],
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    if (stepGroup.length === 1) {
      // Single step execution
      await this.executeStep(stepGroup[0], workflow, execution, options);
    } else {
      // Parallel step execution
      Logger.debug(`🔀 Executing ${stepGroup.length} steps in parallel`);

      const stepPromises = stepGroup.map(step =>
        this.executeStep(step, workflow, execution, options).catch(error => {
          Logger.error(`Step ${step.stepId} failed in parallel group:`, error);
          throw error;
        })
      );

      await Promise.all(stepPromises);
    }
  }

  /**
   * Execute individual workflow step with agent coordination
   */
  private async executeStep(
    step: WorkflowStep,
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const stepStartTime = Date.now();
    Logger.info(`🎯 Executing step: ${step.stepName} (${step.stepId})`);

    execution.currentStep = step.stepId;

    try {
      // Pre-execution validation
      await this.validateStepExecution(step, execution);

      // Agent discovery and assignment
      const assignedAgents = await this.assignAgentsToStep(step, execution);
      execution.agentAssignments[step.stepId] = assignedAgents.map(agent => agent.id);

      // Execute step based on type
      let stepResult: any;
      switch (step.stepType) {
        case 'single_agent':
          stepResult = await this.executeSingleAgentStep(step, assignedAgents[0], execution);
          break;
        case 'parallel_agents':
          stepResult = await this.executeParallelAgentsStep(step, assignedAgents, execution);
          break;
        case 'sequential_agents':
          stepResult = await this.executeSequentialAgentsStep(step, assignedAgents, execution);
          break;
        case 'conditional':
          stepResult = await this.executeConditionalStep(step, execution);
          break;
        case 'merge':
          stepResult = await this.executeMergeStep(step, execution);
          break;
        case 'transform':
          stepResult = await this.executeTransformStep(step, execution);
          break;
        default:
          throw new Error(`Unsupported step type: ${step.stepType}`);
      }

      // Store step result and update execution
      execution.results[step.stepId] = stepResult;
      execution.completedSteps.push(step.stepId);
      execution.performanceMetrics.completedSteps++;
      execution.performanceMetrics.totalAgentsUsed += assignedAgents.length;

      const stepDuration = Date.now() - stepStartTime;
      this.updateStepDurationMetrics(execution, stepDuration);

      Logger.info(`✅ Step completed: ${step.stepName} in ${stepDuration}ms`);
    } catch (error) {
      const stepDuration = Date.now() - stepStartTime;
      execution.errors[step.stepId] = error;
      execution.failedSteps.push(step.stepId);
      execution.performanceMetrics.failedSteps++;

      // Handle step failure according to retry configuration
      if (step.retryConfig && step.retryConfig.maxRetries > 0) {
        Logger.warn(
          `🔄 Retrying step: ${step.stepName} (attempt 1/${step.retryConfig.maxRetries})`
        );
        await this.retryStepExecution(step, workflow, execution, options, 1);
      } else {
        Logger.error(`❌ Step failed: ${step.stepName} in ${stepDuration}ms`, error);

        // Handle according to workflow error handling
        if (workflow.errorHandling.onStepFailure === 'stop') {
          throw error;
        } else if (
          workflow.errorHandling.onStepFailure === 'fallback' &&
          workflow.errorHandling.fallbackWorkflow
        ) {
          await this.executeFallbackWorkflow(workflow.errorHandling.fallbackWorkflow, execution);
        }
        // For 'continue' mode, we continue to next step
      }
    } finally {
      execution.currentStep = undefined;
    }
  }

  /**
   * Assign optimal agents to workflow step using discovery service
   */
  private async assignAgentsToStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<AgentDefinition[]> {
    const discoveryResult = await agentDiscoveryService.discoverAgents({
      requiredCapabilities: step.requiredCapabilities,
      taskType: step.stepType === 'single_agent' ? 'single_execution' : 'batch_processing',
      contextualIntelligence: {
        domain: 'workflow_orchestration',
        taskComplexity: 'medium',
        expectedDuration: step.timeout || 30000,
        resourceRequirements: 'standard',
      },
      performanceRequirements: {
        maxResponseTimeMs: step.timeout || 30000,
        minSuccessRate: 0.8,
        minHealthScore: 0.7,
      },
    });

    if (!discoveryResult || discoveryResult.agents.length === 0) {
      throw new Error(`No suitable agents found for step: ${step.stepName}`);
    }

    // Return appropriate number of agents based on step type
    switch (step.stepType) {
      case 'single_agent':
        return [discoveryResult.agents[0]];
      case 'parallel_agents':
        return discoveryResult.agents;
      case 'sequential_agents':
        return discoveryResult.agents;
      default:
        return [discoveryResult.agents[0]];
    }
  }

  // Note: Workflow validation is now handled by workflowValidationFramework

  // Additional helper methods for step execution, dependency resolution, etc.
  private calculateStepExecutionOrder(steps: WorkflowStep[]): WorkflowStep[][] {
    // Topological sort with dependency resolution
    const resolved: WorkflowStep[] = [];
    const remaining = [...steps];
    const levels: WorkflowStep[][] = [];

    while (remaining.length > 0) {
      const currentLevel: WorkflowStep[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const step = remaining[i];
        const dependencies = step.dependencies || [];

        // Check if all dependencies are resolved
        const canExecute = dependencies.every(
          depId => resolved.find(s => s.stepId === depId) !== undefined
        );

        if (canExecute) {
          currentLevel.push(step);
          resolved.push(step);
          remaining.splice(i, 1);
        }
      }

      if (currentLevel.length === 0 && remaining.length > 0) {
        throw new Error('Circular dependency detected in workflow steps');
      }

      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }
    }

    return levels;
  }

  private groupStepsForConcurrentExecution(
    stepLevels: WorkflowStep[][],
    allSteps: WorkflowStep[]
  ): WorkflowStep[][] {
    // Group steps within each level that can be executed concurrently
    return stepLevels.map(level => {
      // For now, all steps in the same dependency level can be executed concurrently
      // This could be enhanced with resource constraints and agent availability
      return level;
    });
  }

  private detectCircularDependencies(steps: WorkflowStep[]): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) {
        const circleStart = path.indexOf(stepId);
        return path.slice(circleStart).concat(stepId);
      }

      if (visited.has(stepId)) {
        return false;
      }

      visited.add(stepId);
      recursionStack.add(stepId);
      path.push(stepId);

      const step = steps.find(s => s.stepId === stepId);
      if (step && step.dependencies) {
        for (const depId of step.dependencies) {
          const result = dfs(depId);
          if (result) return result;
        }
      }

      recursionStack.delete(stepId);
      path.pop();
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.stepId)) {
        const result = dfs(step.stepId);
        if (result) return result as string[];
      }
    }

    return [];
  }

  private identifyParallelizableSteps(steps: WorkflowStep[]): string[] {
    // Identify steps that could potentially be parallelized
    const parallelizable: string[] = [];

    for (const step of steps) {
      if (!step.dependencies || step.dependencies.length === 0) {
        // Steps with no dependencies could be parallelized
        const similarSteps = steps.filter(
          s =>
            s.stepId !== step.stepId &&
            (!s.dependencies || s.dependencies.length === 0) &&
            s.stepType === step.stepType
        );

        if (similarSteps.length > 0) {
          parallelizable.push(step.stepId);
        }
      }
    }

    return parallelizable;
  }

  private updateStepDurationMetrics(execution: WorkflowExecution, stepDuration: number): void {
    const metrics = execution.performanceMetrics;

    if (metrics.longestStepDuration === 0 || stepDuration > metrics.longestStepDuration) {
      metrics.longestStepDuration = stepDuration;
    }

    if (metrics.shortestStepDuration === 0 || stepDuration < metrics.shortestStepDuration) {
      metrics.shortestStepDuration = stepDuration;
    }

    // Update average (running average)
    const totalStepsCompleted = metrics.completedSteps;
    metrics.averageStepDuration =
      (metrics.averageStepDuration * (totalStepsCompleted - 1) + stepDuration) /
      totalStepsCompleted;
  }

  private moveExecutionToHistory(execution: WorkflowExecution): void {
    const workflowId = execution.workflowId;

    if (!this.executionHistory.has(workflowId)) {
      this.executionHistory.set(workflowId, []);
    }

    const history = this.executionHistory.get(workflowId)!;
    history.push(execution);

    // Keep only recent history
    if (history.length > this.MAX_EXECUTION_HISTORY) {
      history.shift();
    }
  }

  // Step execution methods using execution pipelines
  private async executeSingleAgentStep(
    step: WorkflowStep,
    agent: AgentDefinition,
    execution: WorkflowExecution
  ): Promise<any> {
    const context = {
      workflowId: execution.workflowId,
      executionId: execution.executionId,
      stepId: step.stepId,
      input: this.getStepInput(step, execution),
      previousResults: execution.results,
      globalContext: execution.context,
      timeoutMs: step.timeout || 30000,
    };

    const result = await workflowExecutionPipelines.executeSingleAgentStep(step, agent, context);

    if (!result.success && result.errors) {
      throw new Error(
        `Single agent step failed: ${result.errors.map(e => e.errorMessage).join(', ')}`
      );
    }

    return result.output;
  }

  private async executeParallelAgentsStep(
    step: WorkflowStep,
    agents: AgentDefinition[],
    execution: WorkflowExecution
  ): Promise<any> {
    const context = {
      workflowId: execution.workflowId,
      executionId: execution.executionId,
      stepId: step.stepId,
      input: this.getStepInput(step, execution),
      previousResults: execution.results,
      globalContext: execution.context,
      timeoutMs: step.timeout || 30000,
    };

    const result = await workflowExecutionPipelines.executeParallelAgentsStep(
      step,
      agents,
      context
    );

    if (!result.success && result.errors) {
      throw new Error(
        `Parallel agents step failed: ${result.errors.map(e => e.errorMessage).join(', ')}`
      );
    }

    return result.output;
  }

  private async executeSequentialAgentsStep(
    step: WorkflowStep,
    agents: AgentDefinition[],
    execution: WorkflowExecution
  ): Promise<any> {
    const context = {
      workflowId: execution.workflowId,
      executionId: execution.executionId,
      stepId: step.stepId,
      input: this.getStepInput(step, execution),
      previousResults: execution.results,
      globalContext: execution.context,
      timeoutMs: step.timeout || 30000,
    };

    const result = await workflowExecutionPipelines.executeSequentialAgentsStep(
      step,
      agents,
      context
    );

    if (!result.success && result.errors) {
      throw new Error(
        `Sequential agents step failed: ${result.errors.map(e => e.errorMessage).join(', ')}`
      );
    }

    return result.output;
  }

  /**
   * Get input for step execution based on dependencies and previous results
   */
  private getStepInput(step: WorkflowStep, execution: WorkflowExecution): any {
    if (!step.dependencies || step.dependencies.length === 0) {
      // No dependencies, use workflow initial input
      return execution.context.initialInput || execution.context;
    }

    if (step.dependencies.length === 1) {
      // Single dependency, use its output
      const depId = step.dependencies[0];
      return execution.results[depId];
    }

    // Multiple dependencies, combine their outputs
    const combinedInput: Record<string, any> = {};
    for (const depId of step.dependencies) {
      combinedInput[depId] = execution.results[depId];
    }
    return combinedInput;
  }

  private async executeConditionalStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    // Implementation for conditional step execution
    throw new Error('Conditional step execution not yet implemented');
  }

  private async executeMergeStep(step: WorkflowStep, execution: WorkflowExecution): Promise<any> {
    // Implementation for merge step execution
    throw new Error('Merge step execution not yet implemented');
  }

  private async executeTransformStep(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<any> {
    // Implementation for transform step execution
    throw new Error('Transform step execution not yet implemented');
  }

  private async validateStepExecution(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<void> {
    // Use validation framework for runtime step validation
    const workflow = this.workflowDefinitions.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${execution.workflowId}`);
    }

    const validationIssues = await workflowValidationFramework.validateWorkflowExecution(
      workflow,
      step.stepId,
      execution.context
    );

    const criticalIssues = validationIssues.filter(
      issue => issue.severity === 'critical' || issue.severity === 'error'
    );
    if (criticalIssues.length > 0) {
      throw new Error(
        `Step validation failed: ${criticalIssues.map(issue => issue.message).join(', ')}`
      );
    }

    // Log warnings for non-critical issues
    const warnings = validationIssues.filter(issue => issue.severity === 'warning');
    if (warnings.length > 0) {
      Logger.warn(
        `Step validation warnings for ${step.stepId}:`,
        warnings.map(w => w.message)
      );
    }
  }

  private async retryStepExecution(
    step: WorkflowStep,
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    options: WorkflowExecutionOptions,
    attempt: number
  ): Promise<void> {
    Logger.info(`🔄 Retrying step execution: ${step.stepName} (attempt ${attempt})`);

    // Get assigned agents for the step
    const assignedAgents = await this.assignAgentsToStep(step, execution);
    if (assignedAgents.length === 0) {
      throw new Error(`No agents available for retry of step: ${step.stepName}`);
    }

    // Use error recovery service for intelligent retry
    const retryResult = await workflowErrorRecovery.retryStepExecution(
      workflow,
      execution,
      step,
      assignedAgents[0], // Use first assigned agent for retry
      attempt
    );

    if (retryResult.success) {
      // Store retry result and update execution
      execution.results[step.stepId] = retryResult.result;
      execution.completedSteps.push(step.stepId);
      execution.performanceMetrics.completedSteps++;

      Logger.info(`✅ Step retry successful: ${step.stepName} (attempt ${attempt})`);
    } else if (retryResult.error) {
      // Handle retry failure with error recovery
      const recoveryResult = await workflowErrorRecovery.recoverFromError(
        workflow,
        execution,
        step,
        retryResult.error
      );

      if (recoveryResult.success && recoveryResult.continueExecution) {
        Logger.info(`✅ Step recovered using strategy: ${recoveryResult.strategy}`);

        // Apply recovery actions
        if (recoveryResult.action === 'alternative_agent' && recoveryResult.newAgent) {
          // Retry with alternative agent
          await this.retryWithAlternativeAgent(
            step,
            workflow,
            execution,
            recoveryResult.newAgent,
            attempt
          );
        } else if (recoveryResult.action === 'retry' && recoveryResult.modifiedStep) {
          // Retry with modified step configuration
          const modifiedStep = { ...step, ...recoveryResult.modifiedStep };
          await this.retryStepExecution(modifiedStep, workflow, execution, options, attempt + 1);
        } else if (recoveryResult.action === 'skip_step') {
          // Skip step gracefully
          execution.results[step.stepId] = { skipped: true, reason: recoveryResult.message };
          execution.completedSteps.push(step.stepId);
          Logger.info(`⏭️ Step skipped: ${step.stepName} - ${recoveryResult.message}`);
        }
      } else {
        // Recovery failed, propagate error
        execution.errors[step.stepId] = retryResult.error;
        execution.failedSteps.push(step.stepId);
        execution.performanceMetrics.failedSteps++;
        throw new Error(`Step retry and recovery failed: ${retryResult.error.errorMessage}`);
      }
    }
  }

  /**
   * Retry step execution with alternative agent
   */
  private async retryWithAlternativeAgent(
    step: WorkflowStep,
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    alternativeAgent: AgentDefinition,
    attempt: number
  ): Promise<void> {
    Logger.info(`🔄 Retrying with alternative agent: ${alternativeAgent.name}`);

    try {
      let stepResult: any;

      // Execute with alternative agent based on step type
      switch (step.stepType) {
        case 'single_agent':
          stepResult = await this.executeSingleAgentStep(step, alternativeAgent, execution);
          break;
        case 'parallel_agents':
          stepResult = await this.executeParallelAgentsStep(step, [alternativeAgent], execution);
          break;
        case 'sequential_agents':
          stepResult = await this.executeSequentialAgentsStep(step, [alternativeAgent], execution);
          break;
        default:
          throw new Error(`Unsupported step type for alternative agent: ${step.stepType}`);
      }

      // Store successful result
      execution.results[step.stepId] = stepResult;
      execution.completedSteps.push(step.stepId);
      execution.performanceMetrics.completedSteps++;
      execution.agentAssignments[step.stepId] = [alternativeAgent.id];

      Logger.info(`✅ Alternative agent retry successful: ${alternativeAgent.name}`);
    } catch (error) {
      Logger.error(`❌ Alternative agent retry failed: ${alternativeAgent.name}`, error);

      // Store error and mark as failed
      execution.errors[step.stepId] = {
        errorId: `alt_agent_failed_${step.stepId}_${Date.now()}`,
        errorType: 'execution_failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        stepId: step.stepId,
        agentId: alternativeAgent.id,
        severity: 'high',
        recoverable: false,
        retryable: false,
      };
      execution.failedSteps.push(step.stepId);
      execution.performanceMetrics.failedSteps++;

      throw error;
    }
  }

  /**
   * Execute fallback workflow when primary workflow fails
   */
  private async executeFallbackWorkflow(
    fallbackWorkflowId: string,
    execution: WorkflowExecution
  ): Promise<void> {
    try {
      Logger.info(`🔄 Executing fallback workflow: ${fallbackWorkflowId}`);

      const fallbackWorkflow = this.registeredWorkflows.get(fallbackWorkflowId);
      if (!fallbackWorkflow) {
        throw new Error(`Fallback workflow not found: ${fallbackWorkflowId}`);
      }

      // Create new execution context for fallback
      const fallbackExecution = await this.executeWorkflow(fallbackWorkflowId, execution.context, {
        priority: 'high', // Fallback workflows get high priority
        enableDetailedLogging: true,
        agentSelectionStrategy: 'most_reliable',
      });

      // Merge results back to original execution
      execution.results = { ...execution.results, ...fallbackExecution.results };
      execution.context = { ...execution.context, ...fallbackExecution.context };

      // Update status
      execution.status = 'completed_with_fallback';
      execution.performanceMetrics.fallbackExecutions =
        (execution.performanceMetrics.fallbackExecutions || 0) + 1;

      Logger.info(`✅ Fallback workflow completed successfully: ${fallbackWorkflowId}`);
    } catch (error) {
      Logger.error(`❌ Fallback workflow execution failed: ${fallbackWorkflowId}`, error);
      execution.status = 'failed';
      throw error;
    }
  }

  /**
   * Handle comprehensive workflow error management
   */
  private async handleWorkflowError(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    error: any
  ): Promise<void> {
    Logger.error(`🚨 Handling workflow error for ${workflow.workflowId}:`, error);

    try {
      // Create structured error entry
      const workflowError: WorkflowError = {
        errorId: `workflow_error_${execution.executionId}_${Date.now()}`,
        errorType: 'workflow_failure',
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        stepId: execution.currentStepId || 'unknown',
        agentId: 'orchestrator',
        severity: 'critical',
        recoverable: false,
        retryable: false,
        context: {
          workflowId: workflow.workflowId,
          executionId: execution.executionId,
          completedSteps: execution.completedSteps.length,
          failedSteps: execution.failedSteps.length,
          stackTrace: error instanceof Error ? error.stack : undefined,
        },
      };

      execution.errors['workflow_level'] = workflowError;
      execution.status = 'failed';
      execution.endTime = new Date();

      // Update performance metrics
      execution.performanceMetrics.totalExecutionTime =
        execution.endTime.getTime() - execution.startTime.getTime();
      execution.performanceMetrics.errorCount++;

      // Attempt error recovery if available
      const recoveryResult = await workflowErrorRecovery.recoverFromError(
        workflow,
        execution,
        { stepId: 'workflow_level', stepType: 'single_agent' } as WorkflowStep,
        workflowError
      );

      if (recoveryResult.success && recoveryResult.fallbackWorkflowId) {
        Logger.info(`🔄 Attempting error recovery with fallback workflow`);
        await this.executeFallbackWorkflow(recoveryResult.fallbackWorkflowId, execution);
      } else {
        Logger.error(`❌ No recovery strategy available for workflow error`);
      }

      // Cleanup resources and notify monitoring systems
      await this.cleanupFailedExecution(execution);
    } catch (recoveryError) {
      Logger.error(`❌ Error recovery failed:`, recoveryError);
      execution.status = 'failed_unrecoverable';
    }
  }

  /**
   * Cleanup resources after failed execution
   */
  private async cleanupFailedExecution(execution: WorkflowExecution): Promise<void> {
    try {
      Logger.info(`🧹 Cleaning up failed execution: ${execution.executionId}`);

      // Cancel any pending agent tasks
      const pendingAgentTasks = Object.keys(execution.agentAssignments).filter(
        stepId => !execution.completedSteps.includes(stepId)
      );

      for (const stepId of pendingAgentTasks) {
        const agentIds = execution.agentAssignments[stepId] || [];
        for (const agentId of agentIds) {
          try {
            // Attempt to cancel agent task if supported
            Logger.debug(`Attempting to cancel agent task: ${agentId} for step: ${stepId}`);
          } catch (cancelError) {
            Logger.warn(`Failed to cancel agent task: ${agentId}`, cancelError);
          }
        }
      }

      // Update monitoring metrics
      if (agentHealthMonitor.isMonitoringActive()) {
        const stats = await agentHealthMonitor.getMonitoringStats();
        Logger.debug('Updated monitoring stats after cleanup:', stats);
      }

      Logger.info(`✅ Cleanup completed for execution: ${execution.executionId}`);
    } catch (cleanupError) {
      Logger.error(`❌ Cleanup failed for execution: ${execution.executionId}`, cleanupError);
    }
  }

  /**
   * Get comprehensive orchestration status and real-time metrics
   */
  async getOrchestrationStatus(): Promise<OrchestrationStatus> {
    const activeExecutions = Array.from(this.activeExecutions.values());
    const registeredWorkflows = Array.from(this.registeredWorkflows.values());

    // Calculate aggregate metrics
    const totalExecutions = activeExecutions.length;
    const runningExecutions = activeExecutions.filter(e => e.status === 'running').length;
    const completedExecutions = activeExecutions.filter(e => e.status === 'completed').length;
    const failedExecutions = activeExecutions.filter(e => e.status === 'failed').length;

    // Calculate resource utilization
    const totalSteps = activeExecutions.reduce(
      (sum, e) => sum + e.performanceMetrics.totalSteps,
      0
    );
    const completedSteps = activeExecutions.reduce(
      (sum, e) => sum + e.performanceMetrics.completedSteps,
      0
    );
    const totalAgents = activeExecutions.reduce(
      (sum, e) => sum + e.performanceMetrics.totalAgentsUsed,
      0
    );

    // Get agent health metrics if monitoring is active
    const agentHealthStatus = agentHealthMonitor.isMonitoringActive()
      ? await agentHealthMonitor.getMonitoringStats()
      : null;

    // Calculate average execution times
    const completedWithTimes = activeExecutions.filter(e => e.endTime && e.startTime);
    const averageExecutionTime =
      completedWithTimes.length > 0
        ? completedWithTimes.reduce(
            (sum, e) => sum + (e.endTime!.getTime() - e.startTime.getTime()),
            0
          ) / completedWithTimes.length
        : 0;

    return {
      timestamp: new Date(),
      systemStatus: 'operational',
      workflow: {
        registeredCount: registeredWorkflows.length,
        activeExecutions: totalExecutions,
        runningExecutions,
        completedExecutions,
        failedExecutions,
        completionRate: totalExecutions > 0 ? completedExecutions / totalExecutions : 0,
      },
      performance: {
        totalSteps,
        completedSteps,
        stepCompletionRate: totalSteps > 0 ? completedSteps / totalSteps : 0,
        averageExecutionTimeMs: averageExecutionTime,
        totalAgentsUsed: totalAgents,
        peakConcurrentExecutions: runningExecutions,
      },
      resources: {
        agentHealthStatus,
        validationFrameworkActive: true,
        executionPipelinesActive: true,
        errorRecoveryActive: true,
        memoryUsage: process.memoryUsage ? process.memoryUsage() : undefined,
      },
      recentActivity: {
        recentExecutions: activeExecutions
          .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
          .slice(0, 10)
          .map(e => ({
            executionId: e.executionId,
            workflowId: e.workflowId,
            status: e.status,
            startTime: e.startTime,
            endTime: e.endTime,
            stepProgress: `${e.completedSteps.length}/${e.performanceMetrics.totalSteps}`,
            duration: e.endTime
              ? e.endTime.getTime() - e.startTime.getTime()
              : Date.now() - e.startTime.getTime(),
          })),
        activeErrors: activeExecutions
          .flatMap(e => Object.values(e.errors))
          .filter((error: any) => error.severity === 'critical' || error.severity === 'high')
          .slice(0, 5),
      },
    };
  }

  /**
   * Get detailed execution status for specific workflow
   */
  getExecutionDetails(executionId: string): WorkflowExecution | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Cancel active execution
   */
  async cancelExecution(
    executionId: string,
    reason: string = 'User requested cancellation'
  ): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      Logger.warn(`❌ Cannot cancel execution - not found: ${executionId}`);
      return false;
    }

    if (execution.status !== 'running') {
      Logger.warn(
        `❌ Cannot cancel execution - not running: ${executionId} (status: ${execution.status})`
      );
      return false;
    }

    try {
      Logger.info(`🛑 Cancelling execution: ${executionId} - Reason: ${reason}`);

      execution.status = 'cancelled';
      execution.endTime = new Date();
      execution.errors['cancellation'] = {
        errorId: `cancellation_${executionId}_${Date.now()}`,
        errorType: 'user_cancellation',
        errorMessage: reason,
        timestamp: new Date(),
        stepId: execution.currentStepId || 'unknown',
        agentId: 'orchestrator',
        severity: 'low',
        recoverable: false,
        retryable: false,
      };

      // Cleanup resources
      await this.cleanupFailedExecution(execution);

      Logger.info(`✅ Execution cancelled successfully: ${executionId}`);
      return true;
    } catch (error) {
      Logger.error(`❌ Failed to cancel execution: ${executionId}`, error);
      return false;
    }
  }
}

interface OrchestrationStatus {
  timestamp: Date;
  systemStatus: 'operational' | 'degraded' | 'critical' | 'maintenance';
  workflow: {
    registeredCount: number;
    activeExecutions: number;
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    completionRate: number;
  };
  performance: {
    totalSteps: number;
    completedSteps: number;
    stepCompletionRate: number;
    averageExecutionTimeMs: number;
    totalAgentsUsed: number;
    peakConcurrentExecutions: number;
  };
  resources: {
    agentHealthStatus: any;
    validationFrameworkActive: boolean;
    executionPipelinesActive: boolean;
    errorRecoveryActive: boolean;
    memoryUsage?: NodeJS.MemoryUsage;
  };
  recentActivity: {
    recentExecutions: {
      executionId: string;
      workflowId: string;
      status: string;
      startTime: Date;
      endTime?: Date;
      stepProgress: string;
      duration: number;
    }[];
    activeErrors: any[];
  };
}

interface ValidationResult {
  success: boolean;
  validationResult: WorkflowValidationResult;
  workflowId: string;
  registeredAt: Date;
}

interface WorkflowExecutionOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical';
  timeoutOverride?: number;
  agentSelectionStrategy?: 'optimal' | 'fastest' | 'most_reliable' | 'load_balanced';
  enableDetailedLogging?: boolean;
  preserveIntermediateResults?: boolean;
  enableRollbackOnFailure?: boolean;
}

// Export singleton instance
export const workflowOrchestrationEngine = new WorkflowOrchestrationEngineService();
export default workflowOrchestrationEngine;

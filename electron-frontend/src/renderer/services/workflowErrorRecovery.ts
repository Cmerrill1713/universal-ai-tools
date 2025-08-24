/**
 * Workflow Error Recovery and Retry System
 * Advanced error handling with intelligent retry strategies and fallback mechanisms
 * Part of Phase 3: Multi-Layer Orchestration - Error Recovery Implementation
 */

import { Logger } from '../utils/logger';
import { rustAgentRegistryClient } from './rustAgentRegistryClient';
import { agentDiscoveryService } from './agentDiscoveryService';
import type {
  WorkflowStep,
  WorkflowExecution,
  WorkflowDefinition,
  RetryConfiguration,
} from './workflowOrchestrationEngine';
import type { AgentDefinition } from './rustAgentRegistryClient';

export interface ErrorRecoveryStrategy {
  strategyId: string;
  name: string;
  description: string;
  applicableErrorTypes: ErrorType[];
  priority: number; // Lower number = higher priority
  recoveryAction: (context: ErrorRecoveryContext) => Promise<RecoveryResult>;
}

export interface ErrorRecoveryContext {
  workflowId: string;
  executionId: string;
  stepId: string;
  step: WorkflowStep;
  error: WorkflowError;
  execution: WorkflowExecution;
  attemptNumber: number;
  previousAttempts: RecoveryAttempt[];
  availableAgents?: AgentDefinition[];
}

export interface WorkflowError {
  errorId: string;
  errorType: ErrorType;
  errorMessage: string;
  timestamp: Date;
  stepId: string;
  agentId?: string;
  stackTrace?: string;
  contextData?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  retryable: boolean;
}

export type ErrorType =
  | 'agent_timeout'
  | 'agent_unavailable'
  | 'capability_mismatch'
  | 'execution_failed'
  | 'validation_failed'
  | 'resource_exhausted'
  | 'network_error'
  | 'dependency_failed'
  | 'configuration_error'
  | 'unknown_error';

export interface RecoveryResult {
  success: boolean;
  strategy: string;
  action: 'retry' | 'alternative_agent' | 'fallback_workflow' | 'skip_step' | 'fail_gracefully';
  newAgent?: AgentDefinition;
  modifiedStep?: Partial<WorkflowStep>;
  fallbackWorkflowId?: string;
  delayMs?: number;
  message: string;
  continueExecution: boolean;
}

export interface RecoveryAttempt {
  attemptId: string;
  timestamp: Date;
  strategy: string;
  action: string;
  success: boolean;
  error?: string;
  executionTimeMs: number;
  agentUsed?: string;
}

export interface RetryMetrics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryDelay: number;
  maxRetryDelay: number;
  strategiesUsed: Record<string, number>;
  errorTypesEncountered: Record<ErrorType, number>;
  recoverySuccessRate: number;
}

class WorkflowErrorRecoveryService {
  private recoveryStrategies = new Map<string, ErrorRecoveryStrategy>();
  private retryMetrics = new Map<string, RetryMetrics>();
  private activeRecoveries = new Map<string, ErrorRecoveryContext>();

  constructor() {
    this.initializeRecoveryStrategies();
  }

  /**
   * Attempt to recover from workflow step error
   */
  async recoverFromError(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    step: WorkflowStep,
    error: WorkflowError
  ): Promise<RecoveryResult> {
    const recoveryId = `${execution.executionId}_${step.stepId}_${Date.now()}`;

    Logger.warn(`🔄 Starting error recovery for step ${step.stepId}:`, {
      errorType: error.errorType,
      errorMessage: error.errorMessage,
      attemptNumber: this.getAttemptNumber(execution.executionId, step.stepId),
    });

    const context: ErrorRecoveryContext = {
      workflowId: workflow.workflowId,
      executionId: execution.executionId,
      stepId: step.stepId,
      step,
      error,
      execution,
      attemptNumber: this.getAttemptNumber(execution.executionId, step.stepId),
      previousAttempts: this.getPreviousAttempts(execution.executionId, step.stepId),
    };

    this.activeRecoveries.set(recoveryId, context);

    try {
      // Find applicable recovery strategies
      const applicableStrategies = this.findApplicableStrategies(error, context);

      if (applicableStrategies.length === 0) {
        Logger.error(`❌ No applicable recovery strategies for error type: ${error.errorType}`);
        return this.createFailureResult(error, 'No applicable recovery strategies found');
      }

      // Try recovery strategies in order of priority
      for (const strategy of applicableStrategies) {
        Logger.debug(`🎯 Attempting recovery strategy: ${strategy.name}`);

        const recoveryStart = Date.now();

        try {
          const result = await strategy.recoveryAction(context);
          const recoveryTime = Date.now() - recoveryStart;

          // Record recovery attempt
          await this.recordRecoveryAttempt(context, strategy, result, recoveryTime);

          if (result.success) {
            Logger.info(`✅ Recovery successful using strategy: ${strategy.name}`);
            this.updateRecoveryMetrics(workflow.workflowId, strategy, true);
            return result;
          } else {
            Logger.warn(`⚠️ Recovery strategy failed: ${strategy.name} - ${result.message}`);
          }
        } catch (strategyError) {
          const recoveryTime = Date.now() - recoveryStart;
          Logger.error(`💥 Recovery strategy error: ${strategy.name}`, strategyError);

          await this.recordRecoveryAttempt(
            context,
            strategy,
            {
              success: false,
              strategy: strategy.strategyId,
              action: 'fail_gracefully',
              message:
                strategyError instanceof Error ? strategyError.message : String(strategyError),
              continueExecution: false,
            },
            recoveryTime
          );
        }
      }

      // All strategies failed
      Logger.error(`❌ All recovery strategies failed for step ${step.stepId}`);
      this.updateRecoveryMetrics(workflow.workflowId, null, false);

      return this.createFailureResult(error, 'All recovery strategies exhausted');
    } finally {
      this.activeRecoveries.delete(recoveryId);
    }
  }

  /**
   * Retry step execution with intelligent backoff
   */
  async retryStepExecution(
    workflow: WorkflowDefinition,
    execution: WorkflowExecution,
    step: WorkflowStep,
    agent: AgentDefinition,
    attemptNumber: number
  ): Promise<{ success: boolean; result?: any; error?: WorkflowError }> {
    const retryConfig = step.retryConfig || this.getDefaultRetryConfig();

    if (attemptNumber > retryConfig.maxRetries) {
      return {
        success: false,
        error: {
          errorId: `retry_exhausted_${step.stepId}_${Date.now()}`,
          errorType: 'execution_failed',
          errorMessage: `Maximum retry attempts (${retryConfig.maxRetries}) exceeded`,
          timestamp: new Date(),
          stepId: step.stepId,
          agentId: agent.id,
          severity: 'high',
          recoverable: false,
          retryable: false,
        },
      };
    }

    // Calculate retry delay with backoff
    const delay = this.calculateRetryDelay(retryConfig, attemptNumber);

    if (delay > 0) {
      Logger.info(
        `⏳ Waiting ${delay}ms before retry attempt ${attemptNumber}/${retryConfig.maxRetries}`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    Logger.info(
      `🔄 Retry attempt ${attemptNumber}/${retryConfig.maxRetries} for step: ${step.stepName}`
    );

    try {
      // Determine if we should use alternative agent
      const executionAgent = retryConfig.alternativeAgents
        ? await this.getAlternativeAgent(step, agent, attemptNumber)
        : agent;

      // Execute with timeout
      const timeoutMs = step.timeout || 30000;
      const executionPromise = rustAgentRegistryClient.executeAgent(
        executionAgent.id,
        this.getStepInput(step, execution),
        { ...execution.context, retryAttempt: attemptNumber },
        timeoutMs
      );

      const result = await Promise.race([
        executionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Retry timeout')), timeoutMs)),
      ]);

      Logger.info(`✅ Retry attempt ${attemptNumber} succeeded for step: ${step.stepName}`);

      return {
        success: true,
        result: (result as any).output || result,
      };
    } catch (error) {
      Logger.warn(`⚠️ Retry attempt ${attemptNumber} failed:`, error);

      return {
        success: false,
        error: {
          errorId: `retry_failed_${step.stepId}_${attemptNumber}_${Date.now()}`,
          errorType: this.classifyError(error),
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          stepId: step.stepId,
          agentId: agent.id,
          severity: 'medium',
          recoverable: attemptNumber < retryConfig.maxRetries,
          retryable: true,
        },
      };
    }
  }

  /**
   * Initialize built-in recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    // Strategy 1: Alternative Agent Selection
    this.addRecoveryStrategy({
      strategyId: 'alternative_agent',
      name: 'Alternative Agent Selection',
      description: 'Find and use alternative agents with same capabilities',
      applicableErrorTypes: ['agent_timeout', 'agent_unavailable', 'execution_failed'],
      priority: 1,
      recoveryAction: async context => {
        const alternativeAgents = await this.findAlternativeAgents(context.step, context.execution);

        if (alternativeAgents.length === 0) {
          return {
            success: false,
            strategy: 'alternative_agent',
            action: 'fail_gracefully',
            message: 'No alternative agents available',
            continueExecution: false,
          };
        }

        const bestAgent = alternativeAgents[0]; // Already sorted by suitability

        return {
          success: true,
          strategy: 'alternative_agent',
          action: 'alternative_agent',
          newAgent: bestAgent,
          message: `Using alternative agent: ${bestAgent.name}`,
          continueExecution: true,
        };
      },
    });

    // Strategy 2: Timeout Extension
    this.addRecoveryStrategy({
      strategyId: 'extend_timeout',
      name: 'Timeout Extension',
      description: 'Extend timeout for timeout-related errors',
      applicableErrorTypes: ['agent_timeout'],
      priority: 2,
      recoveryAction: async context => {
        const currentTimeout = context.step.timeout || 30000;
        const newTimeout = Math.min(currentTimeout * 2, 300000); // Max 5 minutes

        if (newTimeout === currentTimeout) {
          return {
            success: false,
            strategy: 'extend_timeout',
            action: 'fail_gracefully',
            message: 'Already at maximum timeout',
            continueExecution: false,
          };
        }

        return {
          success: true,
          strategy: 'extend_timeout',
          action: 'retry',
          modifiedStep: { timeout: newTimeout },
          message: `Extended timeout from ${currentTimeout}ms to ${newTimeout}ms`,
          continueExecution: true,
        };
      },
    });

    // Strategy 3: Capability Relaxation
    this.addRecoveryStrategy({
      strategyId: 'relax_capabilities',
      name: 'Capability Relaxation',
      description: 'Relax capability requirements to find more agents',
      applicableErrorTypes: ['capability_mismatch', 'agent_unavailable'],
      priority: 3,
      recoveryAction: async context => {
        const originalCapabilities = context.step.requiredCapabilities;
        const relaxedCapabilities = this.relaxCapabilities(originalCapabilities);

        const agentsWithRelaxed = await agentDiscoveryService.discoverAgents({
          requiredCapabilities: relaxedCapabilities,
          taskType: 'single_execution',
          contextualIntelligence: {
            domain: 'error_recovery',
            taskComplexity: 'low',
            expectedDuration: context.step.timeout || 30000,
            resourceRequirements: 'minimal',
          },
          performanceRequirements: {
            maxResponseTimeMs: context.step.timeout || 30000,
            minSuccessRate: 0.6, // Lower success rate acceptable for recovery
            minHealthScore: 0.5,
          },
        });

        if (!agentsWithRelaxed || agentsWithRelaxed.agents.length === 0) {
          return {
            success: false,
            strategy: 'relax_capabilities',
            action: 'fail_gracefully',
            message: 'No agents found even with relaxed capabilities',
            continueExecution: false,
          };
        }

        return {
          success: true,
          strategy: 'relax_capabilities',
          action: 'alternative_agent',
          newAgent: agentsWithRelaxed.agents[0],
          modifiedStep: { requiredCapabilities: relaxedCapabilities },
          message: `Using agent with relaxed capabilities: ${agentsWithRelaxed.agents[0].name}`,
          continueExecution: true,
        };
      },
    });

    // Strategy 4: Step Decomposition
    this.addRecoveryStrategy({
      strategyId: 'decompose_step',
      name: 'Step Decomposition',
      description: 'Break complex step into smaller, simpler steps',
      applicableErrorTypes: ['execution_failed', 'resource_exhausted'],
      priority: 4,
      recoveryAction: async context => {
        // This is a complex strategy that would need domain-specific logic
        // For now, we'll provide a basic implementation

        if (context.attemptNumber > 1) {
          return {
            success: false,
            strategy: 'decompose_step',
            action: 'fail_gracefully',
            message: 'Step decomposition not available for retry attempts',
            continueExecution: false,
          };
        }

        // In a real implementation, this would analyze the step and create sub-steps
        return {
          success: false,
          strategy: 'decompose_step',
          action: 'fail_gracefully',
          message: 'Step decomposition not yet implemented',
          continueExecution: false,
        };
      },
    });

    // Strategy 5: Graceful Degradation
    this.addRecoveryStrategy({
      strategyId: 'graceful_degradation',
      name: 'Graceful Degradation',
      description: 'Continue with partial results or skip non-critical steps',
      applicableErrorTypes: ['execution_failed', 'dependency_failed'],
      priority: 5,
      recoveryAction: async context => {
        // Determine if step is critical for workflow success
        const isCritical = this.isStepCritical(context.step, context.execution);

        if (isCritical) {
          return {
            success: false,
            strategy: 'graceful_degradation',
            action: 'fail_gracefully',
            message: 'Cannot skip critical step',
            continueExecution: false,
          };
        }

        return {
          success: true,
          strategy: 'graceful_degradation',
          action: 'skip_step',
          message: `Skipping non-critical step: ${context.step.stepName}`,
          continueExecution: true,
        };
      },
    });

    Logger.info(`✅ Initialized ${this.recoveryStrategies.size} error recovery strategies`);
  }

  private addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.strategyId, strategy);
  }

  private findApplicableStrategies(
    error: WorkflowError,
    context: ErrorRecoveryContext
  ): ErrorRecoveryStrategy[] {
    const applicable = Array.from(this.recoveryStrategies.values())
      .filter(strategy => strategy.applicableErrorTypes.includes(error.errorType))
      .sort((a, b) => a.priority - b.priority);

    Logger.debug(
      `Found ${applicable.length} applicable recovery strategies for ${error.errorType}`
    );
    return applicable;
  }

  private async findAlternativeAgents(
    step: WorkflowStep,
    execution: WorkflowExecution
  ): Promise<AgentDefinition[]> {
    const discovery = await agentDiscoveryService.discoverAgents({
      requiredCapabilities: step.requiredCapabilities,
      taskType: 'single_execution',
      contextualIntelligence: {
        domain: 'error_recovery',
        taskComplexity: 'medium',
        expectedDuration: step.timeout || 30000,
        resourceRequirements: 'standard',
      },
      performanceRequirements: {
        maxResponseTimeMs: step.timeout || 30000,
        minSuccessRate: 0.7,
        minHealthScore: 0.6,
      },
    });

    return discovery ? discovery.agents : [];
  }

  private async getAlternativeAgent(
    step: WorkflowStep,
    currentAgent: AgentDefinition,
    attemptNumber: number
  ): Promise<AgentDefinition> {
    const alternatives = await this.findAlternativeAgents(step, {} as WorkflowExecution);

    // Filter out the current agent and any previously failed agents
    const viableAlternatives = alternatives.filter(agent => agent.id !== currentAgent.id);

    if (viableAlternatives.length === 0) {
      return currentAgent; // No alternatives, use current agent
    }

    // Use different alternative based on attempt number
    const alternativeIndex = (attemptNumber - 1) % viableAlternatives.length;
    return viableAlternatives[alternativeIndex];
  }

  private relaxCapabilities(originalCapabilities: any[]): any[] {
    // Simplify capability requirements for recovery
    return originalCapabilities.map(cap => ({
      ...cap,
      // Reduce precision requirements
      precision: cap.precision ? Math.max(0.5, cap.precision - 0.2) : undefined,
      // Remove strict version requirements
      version: undefined,
      // Make optional capabilities truly optional
      required: cap.required === true ? false : cap.required,
    }));
  }

  private isStepCritical(step: WorkflowStep, execution: WorkflowExecution): boolean {
    // Simple heuristic: steps with many dependencies are likely critical
    const dependentSteps = execution.workflowId
      ? this.getStepsThatDependOn(step.stepId, execution)
      : [];

    return (
      dependentSteps.length > 2 || step.stepType === 'merge' || step.stepType === 'conditional'
    );
  }

  private getStepsThatDependOn(stepId: string, execution: WorkflowExecution): string[] {
    // This would be implemented with access to full workflow definition
    // For now, return empty array
    return [];
  }

  private calculateRetryDelay(retryConfig: RetryConfiguration, attemptNumber: number): number {
    const baseDelay = retryConfig.retryDelay;
    const backoffMultiplier = retryConfig.backoffMultiplier || 2;

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attemptNumber - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;

    return Math.floor(exponentialDelay + jitter);
  }

  private classifyError(error: any): ErrorType {
    const errorMessage =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (errorMessage.includes('timeout')) return 'agent_timeout';
    if (errorMessage.includes('unavailable') || errorMessage.includes('not found'))
      return 'agent_unavailable';
    if (errorMessage.includes('capability') || errorMessage.includes('unsupported'))
      return 'capability_mismatch';
    if (errorMessage.includes('network') || errorMessage.includes('connection'))
      return 'network_error';
    if (errorMessage.includes('resource') || errorMessage.includes('memory'))
      return 'resource_exhausted';
    if (errorMessage.includes('validation')) return 'validation_failed';
    if (errorMessage.includes('dependency')) return 'dependency_failed';

    return 'execution_failed';
  }

  private createFailureResult(error: WorkflowError, message: string): RecoveryResult {
    return {
      success: false,
      strategy: 'none',
      action: 'fail_gracefully',
      message: `${message}: ${error.errorMessage}`,
      continueExecution: false,
    };
  }

  private getDefaultRetryConfig(): RetryConfiguration {
    return {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      retryOnFailure: true,
      retryOnTimeout: true,
      alternativeAgents: true,
    };
  }

  private getStepInput(step: WorkflowStep, execution: WorkflowExecution): any {
    // This should match the logic in workflowOrchestrationEngine
    if (!step.dependencies || step.dependencies.length === 0) {
      return execution.context.initialInput || execution.context;
    }

    if (step.dependencies.length === 1) {
      const depId = step.dependencies[0];
      return execution.results[depId];
    }

    const combinedInput: Record<string, any> = {};
    for (const depId of step.dependencies) {
      combinedInput[depId] = execution.results[depId];
    }
    return combinedInput;
  }

  private getAttemptNumber(executionId: string, stepId: string): number {
    // This would track attempts in a persistent store
    // For now, return 1
    return 1;
  }

  private getPreviousAttempts(executionId: string, stepId: string): RecoveryAttempt[] {
    // This would retrieve previous attempts from storage
    // For now, return empty array
    return [];
  }

  private async recordRecoveryAttempt(
    context: ErrorRecoveryContext,
    strategy: ErrorRecoveryStrategy,
    result: RecoveryResult,
    executionTimeMs: number
  ): Promise<void> {
    const attempt: RecoveryAttempt = {
      attemptId: `${context.executionId}_${context.stepId}_${strategy.strategyId}_${Date.now()}`,
      timestamp: new Date(),
      strategy: strategy.name,
      action: result.action,
      success: result.success,
      error: result.success ? undefined : result.message,
      executionTimeMs,
      agentUsed: result.newAgent?.id,
    };

    // In a real implementation, this would persist the attempt
    Logger.debug('Recovery attempt recorded:', attempt);
  }

  private updateRecoveryMetrics(
    workflowId: string,
    strategy: ErrorRecoveryStrategy | null,
    success: boolean
  ): void {
    if (!this.retryMetrics.has(workflowId)) {
      this.retryMetrics.set(workflowId, {
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        averageRetryDelay: 0,
        maxRetryDelay: 0,
        strategiesUsed: {},
        errorTypesEncountered: {} as Record<ErrorType, number>,
        recoverySuccessRate: 0,
      });
    }

    const metrics = this.retryMetrics.get(workflowId)!;
    metrics.totalRetries++;

    if (success) {
      metrics.successfulRetries++;
    } else {
      metrics.failedRetries++;
    }

    if (strategy) {
      metrics.strategiesUsed[strategy.strategyId] =
        (metrics.strategiesUsed[strategy.strategyId] || 0) + 1;
    }

    metrics.recoverySuccessRate = metrics.successfulRetries / metrics.totalRetries;
  }

  /**
   * Get recovery metrics for a workflow
   */
  getRecoveryMetrics(workflowId: string): RetryMetrics | null {
    return this.retryMetrics.get(workflowId) || null;
  }

  /**
   * Get all recovery strategies
   */
  getRecoveryStrategies(): ErrorRecoveryStrategy[] {
    return Array.from(this.recoveryStrategies.values());
  }

  /**
   * Get currently active recoveries
   */
  getActiveRecoveries(): ErrorRecoveryContext[] {
    return Array.from(this.activeRecoveries.values());
  }
}

// Export singleton instance
export const workflowErrorRecovery = new WorkflowErrorRecoveryService();
export default workflowErrorRecovery;

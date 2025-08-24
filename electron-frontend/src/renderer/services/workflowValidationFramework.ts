/**
 * Workflow Validation Framework
 * Advanced validation system for workflow definitions and runtime checks
 * Part of Phase 3: Multi-Layer Orchestration - Workflow Validation System
 */

import { Logger } from '../utils/logger';
import { rustAgentRegistryClient } from './rustAgentRegistryClient';
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowCondition,
  WorkflowValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationSuggestion,
} from './workflowOrchestrationEngine';
import type { AgentCapability } from './rustAgentRegistryClient';

interface ValidatorRule {
  ruleId: string;
  name: string;
  description: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: 'structure' | 'dependencies' | 'performance' | 'security' | 'best_practices';
  validator: (workflow: WorkflowDefinition) => Promise<ValidationIssue[]>;
}

interface ValidationIssue {
  ruleId: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  category: string;
  stepId?: string;
  message: string;
  details?: string;
  suggestedFix?: string;
  impact?: string;
}

interface ValidationContext {
  availableCapabilities: AgentCapability[];
  systemLimits: {
    maxConcurrentSteps: number;
    maxStepTimeout: number;
    maxWorkflowTimeout: number;
    maxRetryAttempts: number;
  };
  performanceBenchmarks: {
    typicalStepDuration: Record<string, number>; // stepType -> average duration
    resourceConsumption: Record<string, number>; // stepType -> resource usage
  };
}

class WorkflowValidationFrameworkService {
  private validatorRules: Map<string, ValidatorRule> = new Map();
  private validationContext: ValidationContext | null = null;

  constructor() {
    this.initializeValidatorRules();
  }

  /**
   * Initialize validation context with system information
   */
  async initializeValidationContext(): Promise<void> {
    Logger.info('🔍 Initializing workflow validation context...');

    try {
      const availableCapabilities = await rustAgentRegistryClient.getAvailableCapabilities();

      this.validationContext = {
        availableCapabilities,
        systemLimits: {
          maxConcurrentSteps: 20,
          maxStepTimeout: 600000, // 10 minutes
          maxWorkflowTimeout: 3600000, // 1 hour
          maxRetryAttempts: 5,
        },
        performanceBenchmarks: {
          typicalStepDuration: {
            single_agent: 2000,
            parallel_agents: 5000,
            sequential_agents: 10000,
            conditional: 500,
            merge: 1000,
            transform: 1500,
          },
          resourceConsumption: {
            single_agent: 1.0,
            parallel_agents: 3.0,
            sequential_agents: 2.0,
            conditional: 0.2,
            merge: 0.5,
            transform: 0.8,
          },
        },
      };

      Logger.info('✅ Validation context initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize validation context:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive workflow validation
   */
  async validateWorkflow(workflow: WorkflowDefinition): Promise<WorkflowValidationResult> {
    if (!this.validationContext) {
      await this.initializeValidationContext();
    }

    Logger.info(`🔍 Validating workflow: ${workflow.name} (${workflow.workflowId})`);

    const issues: ValidationIssue[] = [];

    // Run all validator rules
    for (const [ruleId, rule] of this.validatorRules) {
      try {
        const ruleIssues = await rule.validator(workflow);
        issues.push(...ruleIssues);
      } catch (error) {
        Logger.error(`Validator rule ${ruleId} failed:`, error);
        issues.push({
          ruleId: 'validation_error',
          severity: 'error',
          category: 'structure',
          message: `Validation rule ${ruleId} failed: ${error.message}`,
        });
      }
    }

    // Categorize issues
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
        case 'error':
          errors.push({
            type: issue.category as any,
            stepId: issue.stepId,
            message: issue.message,
            severity: issue.severity as 'critical' | 'error',
          });
          break;
        case 'warning':
          warnings.push({
            type: issue.category as any,
            stepId: issue.stepId,
            message: issue.message,
            impact: this.determineImpactLevel(issue),
          });
          break;
        case 'info':
          suggestions.push({
            type: 'optimization',
            stepId: issue.stepId,
            message: issue.message,
            benefit: issue.suggestedFix || 'Improved workflow performance',
          });
          break;
      }
    }

    const isValid = errors.length === 0;

    Logger.info(`✅ Workflow validation completed: ${isValid ? 'VALID' : 'INVALID'}`, {
      errors: errors.length,
      warnings: warnings.length,
      suggestions: suggestions.length,
    });

    return {
      isValid,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Validate workflow at runtime (dynamic validation)
   */
  async validateWorkflowExecution(
    workflow: WorkflowDefinition,
    currentStep: string,
    executionContext: Record<string, any>
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const step = workflow.steps.find(s => s.stepId === currentStep);

    if (!step) {
      issues.push({
        ruleId: 'runtime_step_not_found',
        severity: 'critical',
        category: 'structure',
        stepId: currentStep,
        message: `Step ${currentStep} not found in workflow definition`,
      });
      return issues;
    }

    // Runtime-specific validations
    await this.validateStepPreconditions(step, executionContext, issues);
    await this.validateResourceAvailability(step, issues);
    await this.validateAgentAvailability(step, issues);

    return issues;
  }

  /**
   * Initialize all validator rules
   */
  private initializeValidatorRules(): void {
    // Structural validation rules
    this.addValidatorRule({
      ruleId: 'no_empty_steps',
      name: 'No Empty Steps',
      description: 'Workflow must contain at least one step',
      severity: 'critical',
      category: 'structure',
      validator: async workflow => {
        if (!workflow.steps || workflow.steps.length === 0) {
          return [
            {
              ruleId: 'no_empty_steps',
              severity: 'critical',
              category: 'structure',
              message: 'Workflow must contain at least one step',
              suggestedFix: 'Add workflow steps',
            },
          ];
        }
        return [];
      },
    });

    this.addValidatorRule({
      ruleId: 'unique_step_ids',
      name: 'Unique Step IDs',
      description: 'All step IDs must be unique within a workflow',
      severity: 'critical',
      category: 'structure',
      validator: async workflow => {
        const stepIds = new Set<string>();
        const duplicates: string[] = [];

        for (const step of workflow.steps) {
          if (stepIds.has(step.stepId)) {
            duplicates.push(step.stepId);
          } else {
            stepIds.add(step.stepId);
          }
        }

        return duplicates.map(stepId => ({
          ruleId: 'unique_step_ids',
          severity: 'critical' as const,
          category: 'structure',
          stepId,
          message: `Duplicate step ID: ${stepId}`,
          suggestedFix: 'Use unique step IDs',
        }));
      },
    });

    // Dependency validation rules
    this.addValidatorRule({
      ruleId: 'valid_dependencies',
      name: 'Valid Dependencies',
      description: 'All step dependencies must reference existing steps',
      severity: 'error',
      category: 'dependencies',
      validator: async workflow => {
        const issues: ValidationIssue[] = [];
        const stepIds = new Set(workflow.steps.map(s => s.stepId));

        for (const step of workflow.steps) {
          if (step.dependencies) {
            for (const depId of step.dependencies) {
              if (!stepIds.has(depId)) {
                issues.push({
                  ruleId: 'valid_dependencies',
                  severity: 'error',
                  category: 'dependencies',
                  stepId: step.stepId,
                  message: `Step ${step.stepId} depends on non-existent step: ${depId}`,
                  suggestedFix: 'Remove invalid dependency or add missing step',
                });
              }
            }
          }
        }

        return issues;
      },
    });

    this.addValidatorRule({
      ruleId: 'no_circular_dependencies',
      name: 'No Circular Dependencies',
      description: 'Workflow must not contain circular dependencies',
      severity: 'critical',
      category: 'dependencies',
      validator: async workflow => {
        const circularPath = this.detectCircularDependencies(workflow.steps);
        if (circularPath.length > 0) {
          return [
            {
              ruleId: 'no_circular_dependencies',
              severity: 'critical',
              category: 'dependencies',
              message: `Circular dependency detected: ${circularPath.join(' → ')}`,
              suggestedFix: 'Remove circular dependencies by restructuring step order',
            },
          ];
        }
        return [];
      },
    });

    // Performance validation rules
    this.addValidatorRule({
      ruleId: 'reasonable_timeouts',
      name: 'Reasonable Timeouts',
      description: 'Step timeouts should be within reasonable limits',
      severity: 'warning',
      category: 'performance',
      validator: async workflow => {
        const issues: ValidationIssue[] = [];

        for (const step of workflow.steps) {
          if (step.timeout) {
            if (step.timeout > this.validationContext!.systemLimits.maxStepTimeout) {
              issues.push({
                ruleId: 'reasonable_timeouts',
                severity: 'warning',
                category: 'performance',
                stepId: step.stepId,
                message: `Step timeout (${step.timeout}ms) exceeds recommended maximum (${this.validationContext!.systemLimits.maxStepTimeout}ms)`,
                suggestedFix: 'Consider breaking into smaller steps or increasing system limits',
                impact: 'May cause resource exhaustion',
              });
            }

            if (step.timeout < 1000) {
              issues.push({
                ruleId: 'reasonable_timeouts',
                severity: 'info',
                category: 'performance',
                stepId: step.stepId,
                message: `Step timeout (${step.timeout}ms) is very short and may cause frequent timeouts`,
                suggestedFix: 'Consider increasing timeout for reliability',
              });
            }
          }
        }

        return issues;
      },
    });

    this.addValidatorRule({
      ruleId: 'excessive_parallelism',
      name: 'Excessive Parallelism',
      description: 'Workflow should not exceed system concurrency limits',
      severity: 'warning',
      category: 'performance',
      validator: async workflow => {
        const maxConcurrentSteps = this.calculateMaxConcurrentSteps(workflow.steps);

        if (maxConcurrentSteps > this.validationContext!.systemLimits.maxConcurrentSteps) {
          return [
            {
              ruleId: 'excessive_parallelism',
              severity: 'warning',
              category: 'performance',
              message: `Workflow may execute up to ${maxConcurrentSteps} concurrent steps, exceeding system limit (${this.validationContext!.systemLimits.maxConcurrentSteps})`,
              suggestedFix: 'Add dependencies to reduce parallelism or increase system limits',
              impact: 'May cause resource contention and degraded performance',
            },
          ];
        }

        return [];
      },
    });

    // Capability validation rules
    this.addValidatorRule({
      ruleId: 'available_capabilities',
      name: 'Available Capabilities',
      description: 'Required capabilities should be available in the system',
      severity: 'warning',
      category: 'structure',
      validator: async workflow => {
        const issues: ValidationIssue[] = [];
        const availableCapNames = this.validationContext!.availableCapabilities.map(c => c.name);

        for (const step of workflow.steps) {
          for (const capability of step.requiredCapabilities) {
            if (!availableCapNames.includes(capability.name)) {
              issues.push({
                ruleId: 'available_capabilities',
                severity: 'warning',
                category: 'structure',
                stepId: step.stepId,
                message: `Required capability '${capability.name}' may not be available`,
                suggestedFix: 'Verify capability availability or provide alternative',
                impact: 'Step may fail due to missing capabilities',
              });
            }
          }
        }

        return issues;
      },
    });

    // Best practices validation rules
    this.addValidatorRule({
      ruleId: 'step_naming_convention',
      name: 'Step Naming Convention',
      description: 'Steps should follow consistent naming conventions',
      severity: 'info',
      category: 'best_practices',
      validator: async workflow => {
        const issues: ValidationIssue[] = [];
        const namePattern = /^[a-z][a-z0-9_]*[a-z0-9]$/; // snake_case pattern

        for (const step of workflow.steps) {
          if (!namePattern.test(step.stepId)) {
            issues.push({
              ruleId: 'step_naming_convention',
              severity: 'info',
              category: 'best_practices',
              stepId: step.stepId,
              message: `Step ID '${step.stepId}' doesn't follow snake_case naming convention`,
              suggestedFix: 'Use snake_case naming (e.g., process_data, send_notification)',
            });
          }

          if (!step.stepName || step.stepName.trim().length === 0) {
            issues.push({
              ruleId: 'step_naming_convention',
              severity: 'warning',
              category: 'best_practices',
              stepId: step.stepId,
              message: 'Step should have a descriptive name',
              suggestedFix: 'Add a clear, descriptive name for the step',
            });
          }
        }

        return issues;
      },
    });

    this.addValidatorRule({
      ruleId: 'retry_configuration',
      name: 'Retry Configuration',
      description: 'Steps should have reasonable retry configurations',
      severity: 'info',
      category: 'best_practices',
      validator: async workflow => {
        const issues: ValidationIssue[] = [];

        for (const step of workflow.steps) {
          if (!step.retryConfig) {
            if (step.stepType === 'single_agent' || step.stepType === 'parallel_agents') {
              issues.push({
                ruleId: 'retry_configuration',
                severity: 'info',
                category: 'best_practices',
                stepId: step.stepId,
                message: 'Consider adding retry configuration for resilience',
                suggestedFix: 'Add retry configuration with reasonable limits',
              });
            }
          } else {
            if (
              step.retryConfig.maxRetries > this.validationContext!.systemLimits.maxRetryAttempts
            ) {
              issues.push({
                ruleId: 'retry_configuration',
                severity: 'warning',
                category: 'performance',
                stepId: step.stepId,
                message: `Max retries (${step.retryConfig.maxRetries}) exceeds recommended limit (${this.validationContext!.systemLimits.maxRetryAttempts})`,
                suggestedFix: 'Reduce retry attempts or investigate root cause of failures',
              });
            }
          }
        }

        return issues;
      },
    });

    Logger.info(`✅ Initialized ${this.validatorRules.size} validation rules`);
  }

  private addValidatorRule(rule: ValidatorRule): void {
    this.validatorRules.set(rule.ruleId, rule);
  }

  /**
   * Detect circular dependencies in workflow steps
   */
  private detectCircularDependencies(steps: WorkflowStep[]): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (stepId: string): string[] | null => {
      if (recursionStack.has(stepId)) {
        const circleStart = path.indexOf(stepId);
        return path.slice(circleStart).concat([stepId]);
      }

      if (visited.has(stepId)) {
        return null;
      }

      visited.add(stepId);
      recursionStack.add(stepId);
      path.push(stepId);

      const step = steps.find(s => s.stepId === stepId);
      if (step?.dependencies) {
        for (const depId of step.dependencies) {
          const result = dfs(depId);
          if (result) return result;
        }
      }

      recursionStack.delete(stepId);
      path.pop();
      return null;
    };

    for (const step of steps) {
      if (!visited.has(step.stepId)) {
        const result = dfs(step.stepId);
        if (result) return result;
      }
    }

    return [];
  }

  /**
   * Calculate maximum concurrent steps in workflow
   */
  private calculateMaxConcurrentSteps(steps: WorkflowStep[]): number {
    // Build dependency graph and calculate levels
    const levels = this.calculateDependencyLevels(steps);

    // Find maximum concurrent steps in any level
    return Math.max(...levels.map(level => level.length));
  }

  private calculateDependencyLevels(steps: WorkflowStep[]): WorkflowStep[][] {
    const resolved: Set<string> = new Set();
    const levels: WorkflowStep[][] = [];
    const remaining = [...steps];

    while (remaining.length > 0) {
      const currentLevel: WorkflowStep[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
        const step = remaining[i];
        const dependencies = step.dependencies || [];

        const canExecute = dependencies.every(depId => resolved.has(depId));

        if (canExecute) {
          currentLevel.push(step);
          resolved.add(step.stepId);
          remaining.splice(i, 1);
        }
      }

      if (currentLevel.length === 0 && remaining.length > 0) {
        // This should have been caught by circular dependency detection
        break;
      }

      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }
    }

    return levels;
  }

  private determineImpactLevel(issue: ValidationIssue): 'high' | 'medium' | 'low' {
    if (issue.category === 'performance' || issue.category === 'security') {
      return 'high';
    }
    if (issue.category === 'dependencies') {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Runtime validation methods
   */
  private async validateStepPreconditions(
    step: WorkflowStep,
    executionContext: Record<string, any>,
    issues: ValidationIssue[]
  ): Promise<void> {
    // Validate input schema if defined
    if (step.inputSchema) {
      const inputValidation = this.validateDataAgainstSchema(executionContext, step.inputSchema);
      if (!inputValidation.isValid) {
        issues.push({
          ruleId: 'runtime_input_validation',
          severity: 'error',
          category: 'structure',
          stepId: step.stepId,
          message: `Input validation failed: ${inputValidation.errors.join(', ')}`,
        });
      }
    }

    // Validate step conditions
    if (step.conditions) {
      for (const condition of step.conditions) {
        const conditionResult = await this.evaluateCondition(condition, executionContext);
        if (!conditionResult.isValid) {
          issues.push({
            ruleId: 'runtime_condition_validation',
            severity: 'warning',
            category: 'structure',
            stepId: step.stepId,
            message: `Condition ${condition.conditionId} evaluation failed: ${conditionResult.error}`,
          });
        }
      }
    }
  }

  private async validateResourceAvailability(
    step: WorkflowStep,
    issues: ValidationIssue[]
  ): Promise<void> {
    // Check system resource availability
    const resourceRequirement =
      this.validationContext!.performanceBenchmarks.resourceConsumption[step.stepType] || 1.0;

    // This would integrate with actual system monitoring
    const availableResources = 10.0; // Mock value

    if (resourceRequirement > availableResources) {
      issues.push({
        ruleId: 'runtime_resource_availability',
        severity: 'warning',
        category: 'performance',
        stepId: step.stepId,
        message: `Insufficient resources: required ${resourceRequirement}, available ${availableResources}`,
        suggestedFix: 'Wait for resources to become available or reduce resource requirements',
      });
    }
  }

  private async validateAgentAvailability(
    step: WorkflowStep,
    issues: ValidationIssue[]
  ): Promise<void> {
    // Check if agents with required capabilities are available
    try {
      const agents = await rustAgentRegistryClient.listAgents();
      const suitableAgents = agents.filter(agent =>
        step.requiredCapabilities.every(reqCap =>
          agent.capabilities.some(agentCap => agentCap.name === reqCap.name)
        )
      );

      if (suitableAgents.length === 0) {
        issues.push({
          ruleId: 'runtime_agent_availability',
          severity: 'error',
          category: 'structure',
          stepId: step.stepId,
          message: 'No suitable agents available for required capabilities',
          suggestedFix: 'Wait for agents to become available or modify capability requirements',
        });
      }
    } catch (error) {
      issues.push({
        ruleId: 'runtime_agent_check_failed',
        severity: 'warning',
        category: 'structure',
        stepId: step.stepId,
        message: `Failed to check agent availability: ${error.message}`,
      });
    }
  }

  private validateDataAgainstSchema(
    data: any,
    schema: Record<string, any>
  ): { isValid: boolean; errors: string[] } {
    // Simple schema validation - in production, use a proper JSON schema validator
    const errors: string[] = [];

    for (const [key, schemaRule] of Object.entries(schema)) {
      if (schemaRule.required && !(key in data)) {
        errors.push(`Missing required field: ${key}`);
      }

      if (key in data && schemaRule.type && typeof data[key] !== schemaRule.type) {
        errors.push(
          `Field ${key} has incorrect type: expected ${schemaRule.type}, got ${typeof data[key]}`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private async evaluateCondition(
    condition: WorkflowCondition,
    context: Record<string, any>
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Simple condition evaluation - in production, use a proper expression engine
      switch (condition.type) {
        case 'input_validation':
          return { isValid: true }; // Already handled in input validation
        case 'context_check':
          // Simple context checks
          return { isValid: Object.keys(context).length > 0 };
        case 'performance_threshold':
          return { isValid: true }; // Would integrate with actual performance monitoring
        default:
          return { isValid: true };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get validation rule information
   */
  getValidationRules(): ValidatorRule[] {
    return Array.from(this.validatorRules.values());
  }

  /**
   * Get validation statistics
   */
  getValidationStatistics(): {
    totalRules: number;
    rulesByCategory: Record<string, number>;
    rulesBySeverity: Record<string, number>;
  } {
    const rules = Array.from(this.validatorRules.values());
    const rulesByCategory: Record<string, number> = {};
    const rulesBySeverity: Record<string, number> = {};

    for (const rule of rules) {
      rulesByCategory[rule.category] = (rulesByCategory[rule.category] || 0) + 1;
      rulesBySeverity[rule.severity] = (rulesBySeverity[rule.severity] || 0) + 1;
    }

    return {
      totalRules: rules.length,
      rulesByCategory,
      rulesBySeverity,
    };
  }
}

// Export singleton instance
export const workflowValidationFramework = new WorkflowValidationFrameworkService();
export default workflowValidationFramework;

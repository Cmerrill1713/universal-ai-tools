/**
 * Autonomous Action Loop Service
 * Bridges the gap between learning insights and automatic implementation
 *
 * This service:
 * 1. Collects insights from all learning systems
 * 2. Assesses implementation risk and confidence
 * 3. Automatically implements safe, high-confidence changes
 * 4. Monitors results and rolls back if performance degrades
 * 5. Learns from its own implementation decisions
 */

import { createClient } from '@supabase/supabase-js';

import { TaskType } from '@/types';

import { config } from '../config/environment';
import { log,LogContext } from '../utils/logger';
import type { FeedbackInsight, LearningSignal } from './feedback-integration-service';
import { feedbackIntegrationService } from './feedback-integration-service';
import { mlParameterOptimizer } from './ml-parameter-optimizer';
import type { OptimizationInsight , ParameterEffectiveness } from './parameter-analytics-service';
import { parameterAnalyticsService } from './parameter-analytics-service';

export interface AutonomousAction {
  id: string;
  type: 'parameter_adjustment' | 'model_switch' | 'prompt_optimization' | 'feature_toggle' | 'configuration_update';
  priority: 'critical' | 'high' | 'medium' | 'low';

  // What the action will change
  target: {
    service: string;
    component: string;
    property: string;
    taskType?: TaskType;
  };

  // The actual change
  change: {
    from: any;
    to: any;
    rationale: string;
  };

  // Risk and confidence assessment
  assessment: {
    riskLevel: 'low' | 'medium' | 'high';
    confidenceScore: number; // 0-1
    expectedImpact: number; // -1 to 1 (negative = harmful, positive = beneficial)
    implementationComplexity: 'simple' | 'moderate' | 'complex';
    reversibilityScore: number; // 0-1 (how easy to roll back)
  };

  // Evidence supporting the action
  evidence: {
    sources: string[]; // Which insights led to this action
    supportingData: any[];
    historicalPerformance: any;
    userImpact: {
      affectedUsers: number;
      potentialBenefit: string;
    };
  };

  // Execution plan
  execution: {
    method: 'immediate' | 'gradual_rollout' | 'ab_test' | 'canary_deployment';
    rollbackTriggers: Array<{
      metric: string;
      threshold: number;
      operator: 'lt' | 'gt' | 'eq';
    }>;
    monitoringPeriod: number; // milliseconds
    successCriteria: Array<{
      metric: string;
      improvementTarget: number;
    }>;
  };

  // Metadata
  createdAt: Date;
  implementedAt?: Date;
  status: 'pending' | 'approved' | 'implementing' | 'active' | 'rolled_back' | 'completed';
  implementationResult?: ImplementationResult;
}

export interface ImplementationResult {
  success: boolean;
  metricsBeforeAfter: {
    before: Record<string, number>;
    after: Record<string, number>;
    improvement: Record<string, number>;
  };
  duration: number;
  issues: string[];
  userFeedback?: {
    positive: number;
    negative: number;
    neutral: number;
  };
  rollbackRequired: boolean;
  rollbackReason?: string;
}

export interface RiskAssessmentCriteria {
  taskType: TaskType;
  maxRiskLevel: 'low' | 'medium' | 'high';
  minConfidence: number;
  requiresApproval: boolean;
  blacklistedProperties: string[];
  maxImpactRadius: number; // How many users affected
}

export interface AutonomousActionPolicy {
  enabled: boolean;
  maxActionsPerHour: number;
  maxConcurrentActions: number;
  riskThresholds: {
    low: { minConfidence: number, autoApprove: boolean };
    medium: { minConfidence: number, autoApprove: boolean };
    high: { minConfidence: number, autoApprove: boolean };
  };
  cooldownPeriods: {
    afterRollback: number; // ms to wait after a rollback
    betweenSimilarActions: number; // ms between similar action types
  };
  safeguards: {
    maxParameterChange: number; // Maximum % change in a parameter
    requireUserApprovalFor: string[]; // Action types requiring approval
    emergencyStop: boolean; // Can emergency stop all autonomous actions
  };
}

export class AutonomousActionLoopService {
  private supabase: any;
  private actionQueue: AutonomousAction[] = [];
  private activeActions: Map<string, AutonomousAction> = new Map();
  private implementationHistory: ImplementationResult[] = [];
  private policy: AutonomousActionPolicy = {
    enabled: false,
    maxActionsPerHour: 5,
    maxConcurrentActions: 2,
    riskThresholds: {
      low: { minConfidence: 0.85, autoApprove: true },
      medium: { minConfidence: 0.9, autoApprove: false },
      high: { minConfidence: 0.95, autoApprove: false }
    },
    cooldownPeriods: {
      afterRollback: 3600000, // 1 hour
      betweenSimilarActions: 1800000 // 30 minutes
    },
    safeguards: {
      maxParameterChange: 0.2, // 20%
      requireUserApprovalFor: ['model_switch', 'feature_toggle'],
      emergencyStop: false
    }
  };
  private riskAssessmentCache: Map<string, number> = new Map();

  // State tracking
  private isProcessing = false;
  private lastInsightCollection: Date = new Date();
  private actionMetrics: {
    totalActions: number;
    successfulActions: number;
    rolledBackActions: number;
    averageImprovement: number;
  } = {
    totalActions: 0,
    successfulActions: 0,
    rolledBackActions: 0,
    averageImprovement: 0
  };

  constructor() {
    this.initializeSupabase();
    this.initializePolicy();
    this.startAutonomousLoop();

    log.info('🤖 Autonomous Action Loop Service initialized', LogContext.AI, {
      enabled: this.policy.enabled,
      maxActionsPerHour: this.policy.maxActionsPerHour
    });
  }

  private initializeSupabase(): void {
    try {
      if (!config.supabase.url || !config.supabase.serviceKey) {
        throw new Error('Supabase configuration missing for Autonomous Action Loop');
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
      log.info('✅ Autonomous Action Loop connected to Supabase', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to initialize Autonomous Action Loop Service', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private initializePolicy(): void {
    this.policy = {
      enabled: process.env.ENABLE_AUTONOMOUS_ACTIONS === 'true',
      maxActionsPerHour: parseInt(process.env.MAX_AUTONOMOUS_ACTIONS_PER_HOUR || '5'),
      maxConcurrentActions: parseInt(process.env.MAX_CONCURRENT_AUTONOMOUS_ACTIONS || '2'),
      riskThresholds: {
        low: {
          minConfidence: parseFloat(process.env.LOW_RISK_MIN_CONFIDENCE || '0.85'),
          autoApprove: true
        },
        medium: {
          minConfidence: parseFloat(process.env.MEDIUM_RISK_MIN_CONFIDENCE || '0.9'),
          autoApprove: process.env.AUTO_APPROVE_MEDIUM_RISK === 'true'
        },
        high: {
          minConfidence: parseFloat(process.env.HIGH_RISK_MIN_CONFIDENCE || '0.95'),
          autoApprove: false
        }
      },
      cooldownPeriods: {
        afterRollback: parseInt(process.env.ROLLBACK_COOLDOWN_MS || '3600000'), // 1 hour
        betweenSimilarActions: parseInt(process.env.SIMILAR_ACTION_COOLDOWN_MS || '1800000') // 30 minutes
      },
      safeguards: {
        maxParameterChange: parseFloat(process.env.MAX_PARAMETER_CHANGE_PERCENT || '20') / 100,
        requireUserApprovalFor: (process.env.REQUIRE_APPROVAL_FOR || 'model_switch,feature_toggle').split(','),
        emergencyStop: false
      }
    };
  }

  /**
   * Main autonomous loop - collects insights and generates actions
   */
  private async startAutonomousLoop(): Promise<void> {
    if (!this.policy.enabled) {
      log.info('🚫 Autonomous Action Loop disabled in configuration', LogContext.AI);
      return;
    }

    // Run every 15 minutes
    setInterval(async () => {
      if (this.isProcessing || this.policy.safeguards.emergencyStop) {
        return;
      }

      this.isProcessing = true;
      try {
        await this.collectAndProcessInsights();
        await this.processActionQueue();
        await this.monitorActiveActions();
      } catch (error) {
        log.error('❌ Error in autonomous action loop', LogContext.AI, { error });
      } finally {
        this.isProcessing = false;
      }
    }, 15 * 60 * 1000); // 15 minutes

    log.info('🔄 Autonomous action loop started', LogContext.AI);
  }

  /**
   * Collect insights from all learning systems and generate actions
   */
  private async collectAndProcessInsights(): Promise<void> {
    log.info('🧠 Collecting insights from learning systems', LogContext.AI);

    const insights = await this.gatherAllInsights();
    const potentialActions: AutonomousAction[] = [];

    // Process each type of insight
    for (const insight of insights.feedbackInsights) {
      const actions = await this.generateActionsFromFeedback(insight);
      potentialActions.push(...actions);
    }

    for (const insight of insights.optimizationInsights) {
      const actions = await this.generateActionsFromOptimization(insight);
      potentialActions.push(...actions);
    }

    for (const signal of insights.learningSignals) {
      const actions = await this.generateActionsFromSignal(signal);
      potentialActions.push(...actions);
    }

    // Assess risk and filter actions
    const assessedActions = await Promise.all(
      potentialActions.map(action => this.assessActionRisk(action))
    );

    // Add approved actions to queue
    const approvedActions = assessedActions.filter(action =>
      this.shouldAutoImplement(action)
    );

    for (const action of approvedActions) {
      await this.enqueueAction(action);
    }

    log.info('📝 Generated autonomous actions', LogContext.AI, {
      totalInsights: insights.feedbackInsights.length + insights.optimizationInsights.length + insights.learningSignals.length,
      potentialActions: potentialActions.length,
      approvedActions: approvedActions.length
    });
  }

  /**
   * Gather all insights from the learning systems
   */
  private async gatherAllInsights(): Promise<{
    feedbackInsights: FeedbackInsight[];
    optimizationInsights: OptimizationInsight[];
    learningSignals: LearningSignal[];
    parameterEffectiveness: ParameterEffectiveness[];
  }> {
    try {
      const [feedbackInsights, learningSignals] = await Promise.all([
        feedbackIntegrationService.generateFeedbackInsights(),
        feedbackIntegrationService.getLearningSignals()
      ]);

      // Get optimization insights for all task types
      const optimizationInsights = await mlParameterOptimizer.getOptimizationInsights();

      // Get parameter effectiveness data
      const parameterEffectiveness: ParameterEffectiveness[] = [];
      for (const taskType of Object.values(TaskType)) {
        const effectiveness = await parameterAnalyticsService.getParameterEffectiveness(taskType);
        parameterEffectiveness.push(...effectiveness);
      }

      return {
        feedbackInsights,
        optimizationInsights,
        learningSignals,
        parameterEffectiveness
      };
    } catch (error) {
      log.error('❌ Failed to gather insights', LogContext.AI, { error });
      return { feedbackInsights: [], optimizationInsights: [], learningSignals: [], parameterEffectiveness: [] };
    }
  }

  /**
   * Generate actions from feedback insights
   */
  private async generateActionsFromFeedback(insight: FeedbackInsight): Promise<AutonomousAction[]> {
    const actions: AutonomousAction[] = [];

    if (insight.type === 'parameter_adjustment' && insight.confidence > 0.7) {
      // Extract parameter adjustment from insight recommendation
      const parameterMatch = insight.recommendation.match(/(\w+):\s*([0-9.]+)/g);

      if (parameterMatch && insight.taskType) {
        for (const match of parameterMatch) {
          const [param, value] = match.split(':').map(s => s.trim());

          actions.push({
            id: this.generateActionId(),
            type: 'parameter_adjustment',
            priority: insight.priority,
            target: {
              service: 'intelligent-parameter-service',
              component: 'task-profiles',
              property: param || 'unknown',
              taskType: insight.taskType || 'unknown'
            },
            change: {
              from: null, // Will be populated during risk assessment
              to: parseFloat(value || '0'),
              rationale: insight.insight || 'No rationale provided'
            },
            assessment: {
              riskLevel: 'low', // Will be assessed
              confidenceScore: insight.confidence,
              expectedImpact: insight.estimatedImprovement / 100,
              implementationComplexity: 'simple',
              reversibilityScore: 0.95 // Parameter changes are easily reversible
            },
            evidence: {
              sources: [`feedback-insight-${insight.taskType}`],
              supportingData: insight.supportingFeedbacks,
              historicalPerformance: { affectedUsers: insight.affectedUsers },
              userImpact: {
                affectedUsers: insight.affectedUsers,
                potentialBenefit: `${insight.estimatedImprovement}% improvement in user satisfaction`
              }
            },
            execution: {
              method: 'gradual_rollout',
              rollbackTriggers: [
                { metric: 'user_satisfaction', threshold: -0.1, operator: 'lt' },
                { metric: 'error_rate', threshold: 0.05, operator: 'gt' }
              ],
              monitoringPeriod: 24 * 60 * 60 * 1000, // 24 hours
              successCriteria: [
                { metric: 'user_satisfaction', improvementTarget: insight.estimatedImprovement / 100 }
              ]
            },
            createdAt: new Date(),
            status: 'pending'
          });
        }
      }
    }

    return actions;
  }

  /**
   * Generate actions from optimization insights
   */
  private async generateActionsFromOptimization(insight: OptimizationInsight): Promise<AutonomousAction[]> {
    const actions: AutonomousAction[] = [];

    if (insight.confidence > 0.8 && insight.supportingData.improvementPercent > 10) {
      // Parse optimal parameters from recommendation
      const parameterMatches = insight.recommendation.match(/(temp|tokens)=([0-9.]+)/g);

      if (parameterMatches && insight.taskType) {
        for (const match of parameterMatches) {
          const [param, value] = match.split('=');
          const propertyName = param === 'temp' ? 'temperature' : 'maxTokens';

          actions.push({
            id: this.generateActionId(),
            type: 'parameter_adjustment',
            priority: insight.impact === 'high' ? 'high' : insight.impact === 'medium' ? 'medium' : 'low',
            target: {
              service: 'intelligent-parameter-service',
              component: 'task-profiles',
              property: propertyName,
              taskType: insight.taskType
            },
            change: {
              from: null, // Will be populated
              to: parseFloat(value || '0'),
              rationale: `ML optimization discovered ${insight.supportingData.improvementPercent}% improvement`
            },
            assessment: {
              riskLevel: 'low',
              confidenceScore: insight.confidence,
              expectedImpact: insight.supportingData.improvementPercent / 100,
              implementationComplexity: 'simple',
              reversibilityScore: 0.95
            },
            evidence: {
              sources: [`ml-optimization-${insight.taskType}`],
              supportingData: [insight.supportingData],
              historicalPerformance: {
                sampleSize: insight.supportingData.sampleSize,
                currentMetric: insight.supportingData.currentMetric,
                optimizedMetric: insight.supportingData.optimizedMetric
              },
              userImpact: {
                affectedUsers: Math.floor(insight.supportingData.sampleSize * 10), // Estimate
                potentialBenefit: `${insight.supportingData.improvementPercent}% performance improvement`
              }
            },
            execution: {
              method: 'ab_test',
              rollbackTriggers: [
                { metric: 'performance_score', threshold: -0.05, operator: 'lt' },
                { metric: 'response_time', threshold: 1.2, operator: 'gt' }
              ],
              monitoringPeriod: 48 * 60 * 60 * 1000, // 48 hours
              successCriteria: [
                { metric: 'performance_score', improvementTarget: insight.supportingData.improvementPercent / 100 }
              ]
            },
            createdAt: new Date(),
            status: 'pending'
          });
        }
      }
    }

    return actions;
  }

  /**
   * Generate actions from learning signals
   */
  private async generateActionsFromSignal(signal: LearningSignal): Promise<AutonomousAction[]> {
    const actions: AutonomousAction[] = [];

    if (signal.strength > 0.8) {
      let changeValue: number;
      const currentValue = 0.5; // Default, will be populated during risk assessment

      switch (signal.recommendedAction) {
        case 'increase':
          changeValue = Math.min(1.0, currentValue * 1.1);
          break;
        case 'decrease':
          changeValue = Math.max(0.1, currentValue * 0.9);
          break;
        case 'maintain':
          return []; // No action needed
        case 'experiment':
          changeValue = currentValue + (Math.random() - 0.5) * 0.2; // Small random adjustment
          break;
        default:
          return [];
      }

      actions.push({
        id: this.generateActionId(),
        type: 'parameter_adjustment',
        priority: 'medium',
        target: {
          service: 'intelligent-parameter-service',
          component: 'task-profiles',
          property: signal.parameterAffected,
          taskType: signal.taskType
        },
        change: {
          from: null, // Will be populated
          to: changeValue,
          rationale: signal.signal
        },
        assessment: {
          riskLevel: 'low',
          confidenceScore: signal.strength,
          expectedImpact: signal.strength * 0.1, // Conservative estimate
          implementationComplexity: 'simple',
          reversibilityScore: 0.95
        },
        evidence: {
          sources: [`learning-signal-${signal.source}`],
          supportingData: signal.evidence,
          historicalPerformance: {},
          userImpact: {
            affectedUsers: 50, // Conservative estimate
            potentialBenefit: `Addressing ${signal.signal}`
          }
        },
        execution: {
          method: 'gradual_rollout',
          rollbackTriggers: [
            { metric: 'user_satisfaction', threshold: -0.05, operator: 'lt' }
          ],
          monitoringPeriod: 12 * 60 * 60 * 1000, // 12 hours
          successCriteria: [
            { metric: 'user_satisfaction', improvementTarget: 0.05 }
          ]
        },
        createdAt: new Date(),
        status: 'pending'
      });
    }

    return actions;
  }

  /**
   * Assess the risk of implementing an action
   */
  private async assessActionRisk(action: AutonomousAction): Promise<AutonomousAction> {
    // Get current value to calculate change magnitude
    const currentValue = await this.getCurrentParameterValue(action.target);
    action.change.from = currentValue;

    // Calculate change magnitude
    const changeMagnitude = Math.abs((action.change.to - currentValue) / currentValue);

    // Risk assessment based on multiple factors
    let riskScore = 0;

    // Factor 1: Change magnitude
    if (changeMagnitude > this.policy.safeguards.maxParameterChange) {
      riskScore += 0.4;
    } else if (changeMagnitude > this.policy.safeguards.maxParameterChange * 0.5) {
      riskScore += 0.2;
    }

    // Factor 2: User impact
    if (action.evidence.userImpact.affectedUsers > 1000) {
      riskScore += 0.3;
    } else if (action.evidence.userImpact.affectedUsers > 100) {
      riskScore += 0.1;
    }

    // Factor 3: Implementation complexity
    const complexityRisk = { simple: 0, moderate: 0.1, complex: 0.3 };
    riskScore += complexityRisk[action.assessment.implementationComplexity];

    // Factor 4: Confidence level (inverse relationship)
    riskScore += (1 - action.assessment.confidenceScore) * 0.2;

    // Determine risk level
    if (riskScore < 0.3) {
      action.assessment.riskLevel = 'low';
    } else if (riskScore < 0.6) {
      action.assessment.riskLevel = 'medium';
    } else {
      action.assessment.riskLevel = 'high';
    }

    // Cache risk assessment
    this.riskAssessmentCache.set(action.id, riskScore);

    return action;
  }

  /**
   * Determine if an action should be auto-implemented
   */
  private shouldAutoImplement(action: AutonomousAction): boolean {
    const threshold = this.policy.riskThresholds[action.assessment.riskLevel];

    // Check confidence threshold
    if (action.assessment.confidenceScore < threshold.minConfidence) {
      return false;
    }

    // Check if auto-approval is enabled for this risk level
    if (!threshold.autoApprove) {
      return false;
    }

    // Check if action type requires approval
    if (this.policy.safeguards.requireUserApprovalFor.includes(action.type)) {
      return false;
    }

    // Check cooldown periods
    if (this.isInCooldownPeriod(action)) {
      return false;
    }

    // Check rate limits
    if (!this.isWithinRateLimit()) {
      return false;
    }

    return true;
  }

  private async enqueueAction(action: AutonomousAction): Promise<void> {
    this.actionQueue.push(action);

    // Store in database
    await this.supabase.from('autonomous_actions').insert({
      id: action.id,
      type: action.type,
      priority: action.priority,
      target: action.target,
      change: action.change,
      assessment: action.assessment,
      evidence: action.evidence,
      execution: action.execution,
      status: action.status,
      created_at: action.createdAt.toISOString()
    });

    log.info('📥 Enqueued autonomous action', LogContext.AI, {
      actionId: action.id,
      type: action.type,
      riskLevel: action.assessment.riskLevel,
      confidence: action.assessment.confidenceScore
    });
  }

  private async processActionQueue(): Promise<void> {
    if (this.actionQueue.length === 0) return;

    // Sort by priority and confidence
    this.actionQueue.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const aScore = priorityWeight[a.priority] * a.assessment.confidenceScore;
      const bScore = priorityWeight[b.priority] * b.assessment.confidenceScore;
      return bScore - aScore;
    });

    // Process actions up to concurrent limit
    const actionsToProcess = this.actionQueue.splice(0,
      Math.min(
        this.policy.maxConcurrentActions - this.activeActions.size,
        this.actionQueue.length
      )
    );

    for (const action of actionsToProcess) {
      await this.implementAction(action);
    }
  }

  private async implementAction(action: AutonomousAction): Promise<void> {
    log.info('🚀 Implementing autonomous action', LogContext.AI, {
      actionId: action.id,
      type: action.type,
      target: action.target
    });

    action.status = 'implementing';
    action.implementedAt = new Date();
    this.activeActions.set(action.id, action);

    try {
      // Capture baseline metrics
      const beforeMetrics = await this.captureMetrics(action);

      // Implement the actual change
      await this.executeChange(action);

      // Start monitoring
      this.startActionMonitoring(action, beforeMetrics);

      action.status = 'active';
      this.actionMetrics.totalActions++;

      log.info('✅ Action implementation started', LogContext.AI, {
        actionId: action.id,
        monitoringPeriod: action.execution.monitoringPeriod
      });

    } catch (error) {
      log.error('❌ Failed to implement action', LogContext.AI, {
        actionId: action.id,
        error
      });

      action.status = 'rolled_back';
      action.implementationResult = {
        success: false,
        metricsBeforeAfter: { before: {}, after: {}, improvement: {} },
        duration: 0,
        issues: [error instanceof Error ? error.message : String(error)],
        rollbackRequired: true,
        rollbackReason: 'Implementation failed'
      };

      this.activeActions.delete(action.id);
    }
  }

  private async executeChange(action: AutonomousAction): Promise<void> {
    // This would integrate with the actual services to make changes
    // For now, we'll simulate the change and log it

    switch (action.type) {
      case 'parameter_adjustment':
        await this.adjustParameter(action);
        break;
      case 'model_switch':
        await this.switchModel(action);
        break;
      case 'prompt_optimization':
        await this.optimizePrompt(action);
        break;
      case 'configuration_update':
        await this.updateConfiguration(action);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async adjustParameter(action: AutonomousAction): Promise<void> {
    // This would update the actual parameter in the intelligent parameter service
    log.info('🔧 Adjusting parameter', LogContext.AI, {
      service: action.target.service,
      property: action.target.property,
      from: action.change.from,
      to: action.change.to,
      taskType: action.target.taskType
    });

    // For now, we simulate the change by storing it in our tracking
    // In a real implementation, this would call the appropriate service
  }

  private async switchModel(action: AutonomousAction): Promise<void> {
    log.info('🔄 Switching model', LogContext.AI, {
      from: action.change.from,
      to: action.change.to,
      rationale: action.change.rationale
    });
  }

  private async optimizePrompt(action: AutonomousAction): Promise<void> {
    log.info('📝 Optimizing prompt', LogContext.AI, {
      target: action.target,
      change: action.change
    });
  }

  private async updateConfiguration(action: AutonomousAction): Promise<void> {
    log.info('⚙️ Updating configuration', LogContext.AI, {
      component: action.target.component,
      property: action.target.property,
      change: action.change
    });
  }

  private startActionMonitoring(action: AutonomousAction, beforeMetrics: Record<string, number>): void {
    setTimeout(async () => {
      await this.evaluateActionResults(action, beforeMetrics);
    }, action.execution.monitoringPeriod);
  }

  private async evaluateActionResults(action: AutonomousAction, beforeMetrics: Record<string, number>): Promise<void> {
    log.info('📊 Evaluating action results', LogContext.AI, {
      actionId: action.id,
      monitoringComplete: true
    });

    try {
      const afterMetrics = await this.captureMetrics(action);
      const improvement = this.calculateImprovement(beforeMetrics, afterMetrics);

      // Check rollback triggers
      let shouldRollback = false;
      let rollbackReason = '';

      for (const trigger of action.execution.rollbackTriggers) {
        const currentValue = afterMetrics[trigger.metric] || 0;
        const baselineValue = beforeMetrics[trigger.metric] || 0;
        const changeValue = currentValue - baselineValue;

        if (this.triggerConditionMet(changeValue, trigger)) {
          shouldRollback = true;
          rollbackReason = `${trigger.metric} trigger: ${changeValue} ${trigger.operator} ${trigger.threshold}`;
          break;
        }
      }

      // Check success criteria
      let successCriteriaMet = true;
      for (const criteria of action.execution.successCriteria) {
        const improvementValue = improvement[criteria.metric] || 0;
        if (improvementValue < criteria.improvementTarget) {
          successCriteriaMet = false;
          break;
        }
      }

      const implementationResult: ImplementationResult = {
        success: !shouldRollback && successCriteriaMet,
        metricsBeforeAfter: {
          before: beforeMetrics,
          after: afterMetrics,
          improvement
        },
        duration: action.execution.monitoringPeriod,
        issues: shouldRollback ? [rollbackReason] : [],
        rollbackRequired: shouldRollback,
        rollbackReason: shouldRollback ? rollbackReason : undefined
      };

      action.implementationResult = implementationResult;

      if (shouldRollback) {
        await this.rollbackAction(action, rollbackReason);
      } else {
        action.status = 'completed';
        this.actionMetrics.successfulActions++;
        this.actionMetrics.averageImprovement =
          (this.actionMetrics.averageImprovement * (this.actionMetrics.successfulActions - 1) +
           Object.values(improvement).reduce((sum, val) => sum + val, 0) / Object.keys(improvement).length) /
          this.actionMetrics.successfulActions;

        log.info('🎉 Action completed successfully', LogContext.AI, {
          actionId: action.id,
          improvement
        });
      }

      this.activeActions.delete(action.id);
      this.implementationHistory.push(implementationResult);

      // Learn from this implementation
      await this.learnFromImplementation(action, implementationResult);

    } catch (error) {
      log.error('❌ Error evaluating action results', LogContext.AI, {
        actionId: action.id,
        error
      });

      await this.rollbackAction(action, 'Evaluation failed');
    }
  }

  private async rollbackAction(action: AutonomousAction, reason: string): Promise<void> {
    log.warn('🔄 Rolling back action', LogContext.AI, {
      actionId: action.id,
      reason
    });

    try {
      // Revert the change
      const rollbackAction = {
        ...action,
        change: {
          from: action.change.to,
          to: action.change.from,
          rationale: `Rollback: ${reason}`
        }
      };

      await this.executeChange(rollbackAction);

      action.status = 'rolled_back';
      this.actionMetrics.rolledBackActions++;

      log.info('✅ Action rolled back successfully', LogContext.AI, {
        actionId: action.id
      });

    } catch (error) {
      log.error('❌ Failed to rollback action', LogContext.AI, {
        actionId: action.id,
        error
      });
    }
  }

  private async learnFromImplementation(action: AutonomousAction, result: ImplementationResult): Promise<void> {
    // Learn from successful and failed implementations to improve future risk assessment
    const learningData = {
      actionType: action.type,
      riskLevel: action.assessment.riskLevel,
      confidenceScore: action.assessment.confidenceScore,
      expectedImpact: action.assessment.expectedImpact,
      actualSuccess: result.success,
      actualImprovement: Object.values(result.metricsBeforeAfter.improvement).reduce((sum, val) => sum + val, 0) / Object.keys(result.metricsBeforeAfter.improvement).length,
      rollbackRequired: result.rollbackRequired
    };

    // Store learning data for future risk assessments
    await this.supabase.from('autonomous_learning').insert({
      action_id: action.id,
      learning_data: learningData,
      timestamp: new Date().toISOString()
    });

    // Adjust risk assessment for similar future actions
    this.adjustRiskAssessmentModel(learningData);
  }

  private adjustRiskAssessmentModel(learningData: any): void {
    // This would adjust the risk assessment model based on outcomes
    // For now, we'll just log the learning
    log.debug('🧠 Learning from implementation', LogContext.AI, {
      actionType: learningData.actionType,
      predicted: learningData.expectedImpact,
      actual: learningData.actualImprovement,
      success: learningData.actualSuccess
    });
  }

  private async monitorActiveActions(): Promise<void> {
    // Check if any active actions need immediate attention
    for (const [actionId, action] of this.activeActions.entries()) {
      const timeSinceImplementation = Date.now() - (action.implementedAt?.getTime() || 0);

      // Check for emergency conditions that might require immediate rollback
      if (timeSinceImplementation > action.execution.monitoringPeriod * 0.5) {
        const currentMetrics = await this.captureMetrics(action);

        // Check if any critical thresholds are breached
        for (const trigger of action.execution.rollbackTriggers) {
          if (trigger.metric === 'error_rate' && (currentMetrics[trigger.metric] || 0) > trigger.threshold) {
            log.warn('🚨 Emergency rollback triggered', LogContext.AI, {
              actionId,
              metric: trigger.metric,
              value: currentMetrics[trigger.metric],
              threshold: trigger.threshold
            });

            await this.rollbackAction(action, `Emergency rollback: ${trigger.metric} exceeded threshold`);
            break;
          }
        }
      }
    }
  }

  // Utility methods
  private async getCurrentParameterValue(target: AutonomousAction['target']): Promise<number> {
    // This would fetch the current value from the appropriate service
    // For now, return a mock value
    return 0.5;
  }

  private async captureMetrics(action: AutonomousAction): Promise<Record<string, number>> {
    // This would capture relevant metrics for the action
    // For now, return mock metrics
    return {
      user_satisfaction: 4.2,
      performance_score: 0.85,
      response_time: 1500,
      error_rate: 0.02
    };
  }

  private calculateImprovement(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
    const improvement: Record<string, number> = {};

    for (const metric in before) {
      if (metric in after) {
        const beforeVal = before[metric] || 0;
        const afterVal = after[metric] || 0;
        improvement[metric] = beforeVal !== 0 ? (afterVal - beforeVal) / beforeVal : 0;
      }
    }

    return improvement;
  }

  private triggerConditionMet(value: number, trigger: AutonomousAction['execution']['rollbackTriggers'][0]): boolean {
    switch (trigger.operator) {
      case 'lt': return value < trigger.threshold;
      case 'gt': return value > trigger.threshold;
      case 'eq': return Math.abs(value - trigger.threshold) < 0.001;
      default: return false;
    }
  }

  private isInCooldownPeriod(action: AutonomousAction): boolean {
    const now = Date.now();

    // Check if we recently rolled back a similar action
    for (const result of this.implementationHistory.slice(-10)) {
      if (result.rollbackRequired) {
        const timeSinceRollback = now - (result.duration || 0);
        if (timeSinceRollback < this.policy.cooldownPeriods.afterRollback) {
          return true;
        }
      }
    }

    // Check for similar recent actions
    const recentSimilarActions = this.implementationHistory
      .filter(r => r.success && (now - (r.duration || 0)) < this.policy.cooldownPeriods.betweenSimilarActions)
      .length;

    return recentSimilarActions > 0;
  }

  private isWithinRateLimit(): boolean {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recentActions = this.implementationHistory.filter(r => (r.duration || 0) > hourAgo).length;
    return recentActions < this.policy.maxActionsPerHour;
  }

  private generateActionId(): string {
    return `auto_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  public async queueAction(action: AutonomousAction): Promise<void> {
    await this.enqueueAction(action);
  }

  public async getActionStatus(): Promise<{
    activeActions: number;
    queuedActions: number;
    metrics: {
      totalActions: number;
      successfulActions: number;
      rolledBackActions: number;
      averageImprovement: number;
    };
    policy: AutonomousActionPolicy;
  }> {
    return {
      activeActions: this.activeActions.size,
      queuedActions: this.actionQueue.length,
      metrics: this.actionMetrics,
      policy: this.policy
    };
  }

  public async pauseAutonomousActions(): Promise<void> {
    this.policy.safeguards.emergencyStop = true;
    log.info('⏸️ Autonomous actions paused', LogContext.AI);
  }

  public async resumeAutonomousActions(): Promise<void> {
    this.policy.safeguards.emergencyStop = false;
    log.info('▶️ Autonomous actions resumed', LogContext.AI);
  }

  public async getActionHistory(limit = 20): Promise<AutonomousAction[]> {
    const { data, error } = await this.supabase
      .from('autonomous_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('❌ Failed to fetch action history', LogContext.AI, { error });
      return [];
    }

    return data || [];
  }
}

// Export singleton instance
export const autonomousActionLoopService = new AutonomousActionLoopService();
export default autonomousActionLoopService;

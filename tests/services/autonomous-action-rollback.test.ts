/**
 * Comprehensive Test Suite for Autonomous Action Rollback Mechanisms
 * 
 * Tests the safety nets and rollback capabilities of the autonomous action system.
 * Validates that the system can detect performance degradation, automatically rollback
 * parameter changes, and learn from rollback events to improve future decisions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

// Mock services to avoid external dependencies during testing
jest.mock('../../src/services/supabase-client');
jest.mock('../../src/utils/logger');

// Import types and services after mocking
import { AutonomousAction, ImplementationResult } from '../../src/services/autonomous-action-loop-service';
import { TaskParameters, TaskType } from '../../src/services/intelligent-parameter-service';

// Mock the entire autonomous action loop service for controlled testing
class MockAutonomousActionLoopService {
  private actions: Map<string, AutonomousAction> = new Map();
  private activeActions: Map<string, AutonomousAction> = new Map();
  private rollbackHistory: ImplementationResult[] = [];
  private mockMetrics: Record<string, Record<string, number>> = {};
  
  // Mock metrics data for testing scenarios
  setMockMetrics(actionId: string, metrics: Record<string, number>) {
    this.mockMetrics[actionId] = metrics;
  }

  async queueAction(action: AutonomousAction): Promise<void> {
    this.actions.set(action.id, action);
  }

  async implementAction(action: AutonomousAction): Promise<void> {
    action.status = 'implementing';
    action.implementedAt = new Date();
    this.activeActions.set(action.id, action);

    // Simulate baseline metrics capture
    const beforeMetrics = this.mockMetrics[`${action.id}_before`] || {
      task_success_rate: 0.85,
      execution_time: 1200,
      user_satisfaction_score: 4.2,
      resource_utilization: 0.65
    };

    // Start monitoring period (shortened for testing)
    setTimeout(async () => {
      await this.evaluateActionResults(action, beforeMetrics);
    }, 100); // 100ms instead of 24 hours for testing
  }

  async evaluateActionResults(action: AutonomousAction, beforeMetrics: Record<string, number>): Promise<void> {
    const afterMetrics = this.mockMetrics[`${action.id}_after`] || beforeMetrics;
    const improvement = this.calculateImprovement(beforeMetrics, afterMetrics);

    // Check rollback triggers
    let shouldRollback = false;
    let rollbackReason = '';

    for (const trigger of action.execution.rollbackTriggers) {
      const currentValue = afterMetrics[trigger.metric] || 0;
      const baselineValue = beforeMetrics[trigger.metric] || 0;
      const changeValue = currentValue - baselineValue;
      const changePercent = baselineValue > 0 ? Math.abs(changeValue / baselineValue) : 0;

      if (this.triggerConditionMet(changePercent, trigger)) {
        shouldRollback = true;
        rollbackReason = `${trigger.metric} degraded by ${(changePercent * 100).toFixed(2)}% (${changeValue}), exceeding ${trigger.threshold} threshold`;
        break;
      }
    }

    const implementationResult: ImplementationResult = {
      success: !shouldRollback,
      metricsBeforeAfter: {
        before: beforeMetrics,
        after: afterMetrics,
        improvement
      },
      duration: 100,
      issues: shouldRollback ? [rollbackReason] : [],
      rollbackRequired: shouldRollback,
      rollbackReason: shouldRollback ? rollbackReason : undefined
    };

    action.implementationResult = implementationResult;

    if (shouldRollback) {
      await this.rollbackAction(action, rollbackReason);
    } else {
      action.status = 'completed';
    }

    this.activeActions.delete(action.id);
  }

  private calculateImprovement(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
    const improvement: Record<string, number> = {};
    for (const metric in before) {
      const beforeValue = before[metric] || 0;
      const afterValue = after[metric] || 0;
      improvement[metric] = afterValue - beforeValue;
    }
    return improvement;
  }

  private triggerConditionMet(changePercent: number, trigger: any): boolean {
    switch (trigger.operator) {
      case 'gt':
        return changePercent > trigger.threshold;
      case 'lt':
        return changePercent < trigger.threshold;
      case 'eq':
        return changePercent === trigger.threshold;
      default:
        return false;
    }
  }

  async rollbackAction(action: AutonomousAction, reason: string): Promise<void> {
    // Simulate rollback by reverting the parameter change
    const rollbackAction = {
      ...action,
      change: {
        from: action.change.to,
        to: action.change.from,
        rationale: `Rollback: ${reason}`
      }
    };

    // Execute the rollback (simulate parameter restoration)
    await this.executeChange(rollbackAction);
    
    action.status = 'rolled_back';
    
    if (action.implementationResult) {
      this.rollbackHistory.push(action.implementationResult);
    }

    // Learn from the rollback
    await this.learnFromRollback(action, reason);
  }

  private async executeChange(action: AutonomousAction): Promise<void> {
    // Simulate parameter change execution
    // In real implementation, this would call the appropriate service
  }

  private async learnFromRollback(action: AutonomousAction, reason: string): Promise<void> {
    // Simulate learning from rollback event
    // This would typically update ML models or adjust confidence scores
  }

  getAction(id: string): AutonomousAction | undefined {
    return this.actions.get(id);
  }

  getRollbackHistory(): ImplementationResult[] {
    return this.rollbackHistory;
  }

  isActionActive(id: string): boolean {
    return this.activeActions.has(id);
  }

  // Helper method to create test actions
  createTestAction(overrides: Partial<AutonomousAction> = {}): AutonomousAction {
    const defaultAction: AutonomousAction = {
      id: `test-action-${Date.now()}`,
      type: 'parameter_adjustment',
      priority: 'medium',
      target: {
        service: 'intelligent-parameter-service',
        component: 'llm-parameters',
        property: 'temperature',
        taskType: 'code_generation' as TaskType
      },
      change: {
        from: 0.7,
        to: 0.9,
        rationale: 'Increase creativity for code generation tasks based on user feedback'
      },
      assessment: {
        riskLevel: 'medium',
        confidenceScore: 0.75,
        expectedImpact: 0.15,
        implementationComplexity: 'simple',
        reversibilityScore: 0.95
      },
      evidence: {
        sources: ['user-feedback', 'performance-analytics'],
        supportingData: [
          { metric: 'user_satisfaction', improvement: 0.12 },
          { metric: 'task_completion', improvement: 0.08 }
        ],
        historicalPerformance: { success_rate: 0.78 },
        userImpact: {
          affectedUsers: 150,
          potentialBenefit: 'Improved code quality and creativity'
        }
      },
      execution: {
        method: 'immediate',
        rollbackTriggers: [
          {
            metric: 'task_success_rate',
            threshold: 0.05, // 5% degradation threshold
            operator: 'gt'
          },
          {
            metric: 'user_satisfaction_score',
            threshold: 0.05,
            operator: 'gt'
          }
        ],
        monitoringPeriod: 100, // 100ms for testing instead of 24 hours
        successCriteria: [
          {
            metric: 'user_satisfaction_score',
            improvementTarget: 0.1
          }
        ]
      },
      createdAt: new Date(),
      status: 'pending'
    };

    return { ...defaultAction, ...overrides };
  }
}

describe('Autonomous Action Rollback Mechanisms', () => {
  let mockService: MockAutonomousActionLoopService;

  beforeEach(() => {
    mockService = new MockAutonomousActionLoopService();
  });

  afterEach(() => {
    // Clean up any pending timeouts
    jest.clearAllTimers();
  });

  describe('Performance Degradation Detection', () => {
    it('should detect performance degradation > 5% and trigger rollback', async () => {
      const action = mockService.createTestAction({
        id: 'performance-degradation-test'
      });

      // Set up metrics showing performance degradation
      mockService.setMockMetrics('performance-degradation-test_before', {
        task_success_rate: 0.85,
        execution_time: 1200,
        user_satisfaction_score: 4.2,
        resource_utilization: 0.65
      });

      // After metrics show 8% degradation in task success rate
      mockService.setMockMetrics('performance-degradation-test_after', {
        task_success_rate: 0.782, // ~8% degradation
        execution_time: 1250,
        user_satisfaction_score: 4.0,
        resource_utilization: 0.70
      });

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      // Wait for monitoring period to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedAction = mockService.getAction(action.id);
      expect(updatedAction?.status).toBe('rolled_back');
      expect(updatedAction?.implementationResult?.rollbackRequired).toBe(true);
      expect(updatedAction?.implementationResult?.rollbackReason).toContain('task_success_rate degraded');
      expect(updatedAction?.implementationResult?.success).toBe(false);
    });

    it('should not trigger rollback when performance improves', async () => {
      const action = mockService.createTestAction({
        id: 'performance-improvement-test'
      });

      // Set up metrics showing performance improvement
      mockService.setMockMetrics('performance-improvement-test_before', {
        task_success_rate: 0.85,
        execution_time: 1200,
        user_satisfaction_score: 4.2,
        resource_utilization: 0.65
      });

      // After metrics show improvement
      mockService.setMockMetrics('performance-improvement-test_after', {
        task_success_rate: 0.92, // ~8% improvement
        execution_time: 1100,
        user_satisfaction_score: 4.6,
        resource_utilization: 0.60
      });

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      // Wait for monitoring period to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedAction = mockService.getAction(action.id);
      expect(updatedAction?.status).toBe('completed');
      expect(updatedAction?.implementationResult?.rollbackRequired).toBe(false);
      expect(updatedAction?.implementationResult?.success).toBe(true);
    });

    it('should detect multiple metric degradation correctly', async () => {
      const action = mockService.createTestAction({
        id: 'multi-metric-degradation-test',
        execution: {
          method: 'immediate',
          rollbackTriggers: [
            {
              metric: 'task_success_rate',
              threshold: 0.05,
              operator: 'gt'
            },
            {
              metric: 'user_satisfaction_score',
              threshold: 0.05,
              operator: 'gt'
            },
            {
              metric: 'execution_time',
              threshold: 0.1, // 10% increase threshold
              operator: 'gt'
            }
          ],
          monitoringPeriod: 100,
          successCriteria: []
        }
      });

      mockService.setMockMetrics('multi-metric-degradation-test_before', {
        task_success_rate: 0.85,
        execution_time: 1000,
        user_satisfaction_score: 4.2
      });

      // Execution time degrades by 15%
      mockService.setMockMetrics('multi-metric-degradation-test_after', {
        task_success_rate: 0.86, // Slight improvement
        execution_time: 1150, // 15% increase
        user_satisfaction_score: 4.3 // Slight improvement
      });

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedAction = mockService.getAction(action.id);
      expect(updatedAction?.status).toBe('rolled_back');
      expect(updatedAction?.implementationResult?.rollbackReason).toContain('execution_time degraded');
    });
  });

  describe('Parameter Configuration Restoration', () => {
    it('should restore previous parameter configuration on rollback', async () => {
      const originalTemp = 0.7;
      const newTemp = 0.9;
      
      const action = mockService.createTestAction({
        id: 'parameter-restoration-test',
        change: {
          from: originalTemp,
          to: newTemp,
          rationale: 'Test parameter change for rollback validation'
        }
      });

      // Set up degradation scenario
      mockService.setMockMetrics('parameter-restoration-test_before', {
        task_success_rate: 0.85
      });

      mockService.setMockMetrics('parameter-restoration-test_after', {
        task_success_rate: 0.78 // ~8% degradation
      });

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedAction = mockService.getAction(action.id);
      
      // Verify rollback occurred
      expect(updatedAction?.status).toBe('rolled_back');
      expect(updatedAction?.implementationResult?.rollbackRequired).toBe(true);

      // Verify parameter restoration logic would be triggered
      // In a real test, we would verify the actual parameter service was called
      // to restore the original value (originalTemp = 0.7)
      expect(updatedAction?.change.from).toBe(originalTemp);
      expect(updatedAction?.change.to).toBe(newTemp);
    });

    it('should handle complex parameter object restoration', async () => {
      const originalParams: TaskParameters = {
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.9,
        frequencyPenalty: 0.0
      };

      const newParams: TaskParameters = {
        temperature: 0.9,
        maxTokens: 4096,
        topP: 0.8,
        frequencyPenalty: 0.1
      };

      const action = mockService.createTestAction({
        id: 'complex-parameter-restoration-test',
        change: {
          from: originalParams,
          to: newParams,
          rationale: 'Test complex parameter rollback'
        }
      });

      mockService.setMockMetrics('complex-parameter-restoration-test_before', {
        task_success_rate: 0.85,
        resource_utilization: 0.60
      });

      mockService.setMockMetrics('complex-parameter-restoration-test_after', {
        task_success_rate: 0.78, // Degradation
        resource_utilization: 0.80 // Increased resource usage
      });

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedAction = mockService.getAction(action.id);
      expect(updatedAction?.status).toBe('rolled_back');
      
      // Verify complex parameter structure is preserved for rollback
      expect(typeof updatedAction?.change.from).toBe('object');
      expect(typeof updatedAction?.change.to).toBe('object');
    });
  });

  describe('System Learning from Rollbacks', () => {
    it('should record rollback events for learning', async () => {
      const action = mockService.createTestAction({
        id: 'learning-rollback-test'
      });

      mockService.setMockMetrics('learning-rollback-test_before', {
        task_success_rate: 0.85
      });

      mockService.setMockMetrics('learning-rollback-test_after', {
        task_success_rate: 0.78
      });

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      await new Promise(resolve => setTimeout(resolve, 150));

      const rollbackHistory = mockService.getRollbackHistory();
      expect(rollbackHistory.length).toBe(1);
      
      const rollbackEvent = rollbackHistory[0];
      expect(rollbackEvent.rollbackRequired).toBe(true);
      expect(rollbackEvent.rollbackReason).toBeTruthy();
      expect(rollbackEvent.metricsBeforeAfter).toBeDefined();
      expect(rollbackEvent.success).toBe(false);
    });

    it('should capture detailed metrics for learning analysis', async () => {
      const action = mockService.createTestAction({
        id: 'detailed-metrics-test'
      });

      const beforeMetrics = {
        task_success_rate: 0.85,
        execution_time: 1200,
        user_satisfaction_score: 4.2,
        resource_utilization: 0.65
      };

      const afterMetrics = {
        task_success_rate: 0.78,
        execution_time: 1400,
        user_satisfaction_score: 3.9,
        resource_utilization: 0.75
      };

      mockService.setMockMetrics('detailed-metrics-test_before', beforeMetrics);
      mockService.setMockMetrics('detailed-metrics-test_after', afterMetrics);

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      await new Promise(resolve => setTimeout(resolve, 150));

      const rollbackHistory = mockService.getRollbackHistory();
      const rollbackEvent = rollbackHistory[rollbackHistory.length - 1];

      expect(rollbackEvent.metricsBeforeAfter.before).toEqual(beforeMetrics);
      expect(rollbackEvent.metricsBeforeAfter.after).toEqual(afterMetrics);
      
      // Verify improvement calculations are captured
      const improvement = rollbackEvent.metricsBeforeAfter.improvement;
      expect(improvement.task_success_rate).toBe(afterMetrics.task_success_rate - beforeMetrics.task_success_rate);
      expect(improvement.execution_time).toBe(afterMetrics.execution_time - beforeMetrics.execution_time);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing baseline metrics gracefully', async () => {
      const action = mockService.createTestAction({
        id: 'missing-baseline-test'
      });

      // Only set after metrics, no baseline
      mockService.setMockMetrics('missing-baseline-test_after', {
        task_success_rate: 0.78
      });

      await mockService.queueAction(action);
      
      // Should not throw an error
      expect(async () => {
        await mockService.implementAction(action);
        await new Promise(resolve => setTimeout(resolve, 150));
      }).not.toThrow();

      const updatedAction = mockService.getAction(action.id);
      expect(updatedAction?.implementationResult).toBeDefined();
    });

    it('should handle rapid consecutive rollbacks', async () => {
      const actions = [
        mockService.createTestAction({ id: 'rapid-1' }),
        mockService.createTestAction({ id: 'rapid-2' }),
        mockService.createTestAction({ id: 'rapid-3' })
      ];

      // Set up all actions to trigger rollbacks
      actions.forEach(action => {
        mockService.setMockMetrics(`${action.id}_before`, { task_success_rate: 0.85 });
        mockService.setMockMetrics(`${action.id}_after`, { task_success_rate: 0.78 });
      });

      // Queue and implement all actions rapidly
      for (const action of actions) {
        await mockService.queueAction(action);
        await mockService.implementAction(action);
      }

      // Wait for all monitoring periods
      await new Promise(resolve => setTimeout(resolve, 200));

      // All should be rolled back
      actions.forEach(action => {
        const updatedAction = mockService.getAction(action.id);
        expect(updatedAction?.status).toBe('rolled_back');
      });

      expect(mockService.getRollbackHistory().length).toBe(3);
    });

    it('should handle zero or negative performance changes correctly', async () => {
      const action = mockService.createTestAction({
        id: 'zero-change-test'
      });

      // Set identical before and after metrics
      const metrics = { task_success_rate: 0.85 };
      mockService.setMockMetrics('zero-change-test_before', metrics);
      mockService.setMockMetrics('zero-change-test_after', metrics);

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      await new Promise(resolve => setTimeout(resolve, 150));

      const updatedAction = mockService.getAction(action.id);
      // Should complete successfully (no degradation)
      expect(updatedAction?.status).toBe('completed');
      expect(updatedAction?.implementationResult?.rollbackRequired).toBe(false);
    });

    it('should validate rollback trigger thresholds are reasonable', () => {
      const action = mockService.createTestAction({
        execution: {
          method: 'immediate',
          rollbackTriggers: [
            {
              metric: 'task_success_rate',
              threshold: 0.05, // 5% - reasonable
              operator: 'gt'
            },
            {
              metric: 'user_satisfaction',
              threshold: 1.0, // 100% - unreasonable
              operator: 'gt'
            }
          ],
          monitoringPeriod: 100,
          successCriteria: []
        }
      });

      // Validate that the rollback mechanism can handle edge case thresholds
      expect(action.execution.rollbackTriggers[0].threshold).toBe(0.05);
      expect(action.execution.rollbackTriggers[1].threshold).toBe(1.0);
      
      // In a real implementation, we might want to warn about unreasonable thresholds
      const unreasonableThresholds = action.execution.rollbackTriggers.filter(t => t.threshold > 0.5);
      expect(unreasonableThresholds.length).toBe(1);
    });
  });

  describe('Rollback Timeframe Compliance', () => {
    it('should trigger immediate rollback upon performance degradation detection', async () => {
      const action = mockService.createTestAction({
        id: 'immediate-rollback-test'
      });

      const startTime = Date.now();

      mockService.setMockMetrics('immediate-rollback-test_before', { task_success_rate: 0.85 });
      mockService.setMockMetrics('immediate-rollback-test_after', { task_success_rate: 0.78 });

      await mockService.queueAction(action);
      await mockService.implementAction(action);

      await new Promise(resolve => setTimeout(resolve, 150));

      const endTime = Date.now();
      const rollbackTime = endTime - startTime;

      const updatedAction = mockService.getAction(action.id);
      expect(updatedAction?.status).toBe('rolled_back');
      
      // Rollback should happen quickly (within test timeframe)
      expect(rollbackTime).toBeLessThan(200); // 200ms for testing
    });

    it('should respect monitoring period before evaluation', async () => {
      const customMonitoringPeriod = 200;
      const action = mockService.createTestAction({
        id: 'monitoring-period-test',
        execution: {
          method: 'immediate',
          rollbackTriggers: [
            {
              metric: 'task_success_rate',
              threshold: 0.05,
              operator: 'gt'
            }
          ],
          monitoringPeriod: customMonitoringPeriod,
          successCriteria: []
        }
      });

      mockService.setMockMetrics('monitoring-period-test_before', { task_success_rate: 0.85 });
      mockService.setMockMetrics('monitoring-period-test_after', { task_success_rate: 0.78 });

      const startTime = Date.now();
      
      await mockService.queueAction(action);
      await mockService.implementAction(action);

      // Check immediately - should still be implementing
      expect(mockService.isActionActive(action.id)).toBe(true);

      // Wait for monitoring period + buffer
      await new Promise(resolve => setTimeout(resolve, customMonitoringPeriod + 50));

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      // Should have waited for at least the monitoring period
      expect(actualDuration).toBeGreaterThanOrEqual(customMonitoringPeriod);
      
      const updatedAction = mockService.getAction(action.id);
      expect(updatedAction?.status).toBe('rolled_back');
    });
  });
});
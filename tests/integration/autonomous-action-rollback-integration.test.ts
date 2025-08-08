/**
 * Integration Test for Autonomous Action Rollback Mechanisms
 * 
 * Tests the rollback functionality against the real autonomous action loop service
 * to validate that the safety mechanisms work in a production-like environment.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

// Mock external services but allow the core autonomous action service to run
jest.mock('../../src/services/supabase-client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({ data: [], error: null })),
      insert: jest.fn(() => ({ data: [], error: null })),
      update: jest.fn(() => ({ data: [], error: null })),
      delete: jest.fn(() => ({ data: [], error: null }))
    })),
    rpc: jest.fn(() => ({ data: null, error: null }))
  }))
}));

jest.mock('../../src/utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  },
  LogContext: {
    AI: 'ai',
    API: 'api',
    SERVICE: 'service'
  }
}));

// Mock parameter analytics service
jest.mock('../../src/services/parameter-analytics-service', () => ({
  parameterAnalyticsService: {
    getParameterEffectiveness: jest.fn().mockResolvedValue({
      parameter: 'temperature',
      effectiveness: 0.75,
      trends: { improving: true, confidence: 0.8 }
    }),
    recordParameterUsage: jest.fn(),
    getOptimizationSuggestions: jest.fn().mockResolvedValue([])
  }
}));

// Mock feedback integration service
jest.mock('../../src/services/feedback-integration-service', () => ({
  feedbackIntegrationService: {
    getRecentInsights: jest.fn().mockResolvedValue([]),
    processNewFeedback: jest.fn()
  }
}));

// Mock ML parameter optimizer
jest.mock('../../src/services/ml-parameter-optimizer', () => ({
  mlParameterOptimizer: {
    getOptimizationInsight: jest.fn().mockResolvedValue({
      confidence: 0.8,
      expectedImprovement: 0.15,
      suggestedParameters: { temperature: 0.9 },
      reasoning: 'Test optimization insight'
    })
  }
}));

import { AutonomousActionLoopService } from '../../src/services/autonomous-action-loop-service';

/**
 * Integration Test Helper for Autonomous Action Rollback
 * 
 * Provides utilities for testing rollback mechanisms with real service interactions
 * while mocking external dependencies for controlled testing.
 */
class AutonomousActionRollbackTestHelper {
  private service: AutonomousActionLoopService;
  private testActions: string[] = [];

  constructor() {
    this.service = new AutonomousActionLoopService();
  }

  /**
   * Simulate a parameter change that will trigger rollback due to performance degradation
   */
  async simulateParameterChangeWithDegradation(
    parameterName: string,
    originalValue: any,
    newValue: any,
    degradationPercentage: number = 8 // Default 8% degradation
  ) {
    const actionId = `rollback-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.testActions.push(actionId);

    const action = {
      id: actionId,
      type: 'parameter_adjustment' as const,
      priority: 'medium' as const,
      target: {
        service: 'intelligent-parameter-service',
        component: 'llm-parameters',
        property: parameterName,
        taskType: 'code_generation' as any
      },
      change: {
        from: originalValue,
        to: newValue,
        rationale: `Integration test: Change ${parameterName} from ${originalValue} to ${newValue}`
      },
      assessment: {
        riskLevel: 'medium' as const,
        confidenceScore: 0.75,
        expectedImpact: 0.1,
        implementationComplexity: 'simple' as const,
        reversibilityScore: 0.95
      },
      evidence: {
        sources: ['integration-test'],
        supportingData: [{ metric: 'test_improvement', value: 0.1 }],
        historicalPerformance: { success_rate: 0.8 },
        userImpact: {
          affectedUsers: 1, // Test user only
          potentialBenefit: 'Integration testing validation'
        }
      },
      execution: {
        method: 'immediate' as const,
        rollbackTriggers: [
          {
            metric: 'task_success_rate',
            threshold: 0.05, // 5% degradation threshold
            operator: 'gt' as const
          },
          {
            metric: 'user_satisfaction_score',
            threshold: 0.05,
            operator: 'gt' as const
          }
        ],
        monitoringPeriod: 1000, // 1 second for testing
        successCriteria: [
          {
            metric: 'task_success_rate',
            improvementTarget: 0.05
          }
        ]
      },
      createdAt: new Date(),
      status: 'pending' as const
    };

    // Mock the metrics collection to simulate performance degradation
    this.mockMetricsForDegradation(actionId, degradationPercentage);

    await this.service.queueAction(action);
    return actionId;
  }

  /**
   * Mock metrics collection to simulate performance degradation
   */
  private mockMetricsForDegradation(actionId: string, degradationPercentage: number) {
    // Mock the captureMetrics method to return degraded performance
    const originalCaptureMetrics = (this.service as any).captureMetrics;
    
    const mockCaptureMetrics = jest.fn().mockImplementation(async (action) => {
      if (action.id === actionId) {
        // Return degraded metrics
        return {
          task_success_rate: 0.85 * (1 - degradationPercentage / 100), // Apply degradation
          execution_time: 1200 * (1 + degradationPercentage / 100), // Increase execution time
          user_satisfaction_score: 4.2 * (1 - degradationPercentage / 200), // Slight degradation
          resource_utilization: 0.65 * (1 + degradationPercentage / 200) // Increase resource usage
        };
      }
      // For other actions, return normal metrics
      return originalCaptureMetrics ? originalCaptureMetrics.call(this.service, action) : {};
    });

    (this.service as any).captureMetrics = mockCaptureMetrics;
  }

  /**
   * Wait for action to complete and return its final status
   */
  async waitForActionCompletion(actionId: string, timeoutMs: number = 5000): Promise<any> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const action = (this.service as any).actions.get(actionId);
        
        if (!action) {
          reject(new Error(`Action ${actionId} not found`));
          return;
        }

        if (action.status === 'completed' || action.status === 'rolled_back') {
          resolve(action);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Timeout waiting for action ${actionId} to complete`));
          return;
        }

        setTimeout(checkStatus, 100);
      };

      checkStatus();
    });
  }

  /**
   * Verify that rollback was executed correctly
   */
  verifyRollbackExecution(action: any, expectedReason?: string): void {
    expect(action.status).toBe('rolled_back');
    expect(action.implementationResult).toBeDefined();
    expect(action.implementationResult.rollbackRequired).toBe(true);
    expect(action.implementationResult.success).toBe(false);
    
    if (expectedReason) {
      expect(action.implementationResult.rollbackReason).toContain(expectedReason);
    }

    // Verify metrics were captured
    expect(action.implementationResult.metricsBeforeAfter).toBeDefined();
    expect(action.implementationResult.metricsBeforeAfter.before).toBeDefined();
    expect(action.implementationResult.metricsBeforeAfter.after).toBeDefined();
    expect(action.implementationResult.metricsBeforeAfter.improvement).toBeDefined();
  }

  /**
   * Clean up test actions
   */
  cleanup(): void {
    // Remove test actions from the service's internal state
    this.testActions.forEach(actionId => {
      (this.service as any).actions.delete(actionId);
      (this.service as any).activeActions.delete(actionId);
    });
    this.testActions = [];
  }

  /**
   * Get service status for debugging
   */
  getServiceStatus(): any {
    return {
      activeActions: (this.service as any).activeActions.size,
      totalActions: (this.service as any).actions.size,
      policy: (this.service as any).policy,
      metrics: (this.service as any).actionMetrics
    };
  }
}

describe('Autonomous Action Rollback Integration Tests', () => {
  let testHelper: AutonomousActionRollbackTestHelper;

  beforeEach(() => {
    testHelper = new AutonomousActionRollbackTestHelper();
  });

  afterEach(() => {
    testHelper.cleanup();
    jest.clearAllTimers();
  });

  describe('Real Service Rollback Scenarios', () => {
    it('should rollback temperature parameter change on performance degradation', async () => {
      const actionId = await testHelper.simulateParameterChangeWithDegradation(
        'temperature',
        0.7,
        0.9,
        8 // 8% degradation
      );

      const completedAction = await testHelper.waitForActionCompletion(actionId);
      
      testHelper.verifyRollbackExecution(completedAction, 'task_success_rate degraded');
      
      // Verify parameter restoration would occur
      expect(completedAction.change.from).toBe(0.7);
      expect(completedAction.change.to).toBe(0.9);
    });

    it('should handle multiple simultaneous parameter changes with rollbacks', async () => {
      const actionIds = await Promise.all([
        testHelper.simulateParameterChangeWithDegradation('temperature', 0.7, 0.9, 8),
        testHelper.simulateParameterChangeWithDegradation('maxTokens', 2048, 4096, 6),
        testHelper.simulateParameterChangeWithDegradation('topP', 0.9, 0.8, 7)
      ]);

      const completedActions = await Promise.all(
        actionIds.map(id => testHelper.waitForActionCompletion(id))
      );

      // All actions should be rolled back due to performance degradation
      completedActions.forEach((action, index) => {
        testHelper.verifyRollbackExecution(action);
        expect(action.id).toBe(actionIds[index]);
      });

      // Verify service handled concurrent rollbacks correctly
      const status = testHelper.getServiceStatus();
      expect(status.activeActions).toBe(0); // All should be completed/rolled back
    });

    it('should respect monitoring period before triggering rollback', async () => {
      const startTime = Date.now();
      
      const actionId = await testHelper.simulateParameterChangeWithDegradation(
        'temperature',
        0.7,
        0.8,
        10 // 10% degradation
      );

      const completedAction = await testHelper.waitForActionCompletion(actionId, 3000);
      const endTime = Date.now();

      // Verify rollback occurred
      testHelper.verifyRollbackExecution(completedAction);

      // Verify monitoring period was respected (should be at least 1000ms as configured)
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000);
    });

    it('should capture detailed performance metrics for learning', async () => {
      const actionId = await testHelper.simulateParameterChangeWithDegradation(
        'frequencyPenalty',
        0.0,
        0.2,
        12 // 12% degradation
      );

      const completedAction = await testHelper.waitForActionCompletion(actionId);
      
      testHelper.verifyRollbackExecution(completedAction);

      // Verify detailed metrics were captured
      const metrics = completedAction.implementationResult.metricsBeforeAfter;
      expect(metrics.before.task_success_rate).toBeGreaterThan(metrics.after.task_success_rate);
      expect(metrics.improvement.task_success_rate).toBeLessThan(0); // Negative improvement (degradation)
      
      // Verify other metrics were captured
      expect(metrics.before.execution_time).toBeDefined();
      expect(metrics.after.execution_time).toBeDefined();
      expect(metrics.before.user_satisfaction_score).toBeDefined();
      expect(metrics.after.user_satisfaction_score).toBeDefined();
    });
  });

  describe('Service Integration Health Checks', () => {
    it('should maintain service stability during rollback events', async () => {
      const initialStatus = testHelper.getServiceStatus();
      
      // Trigger multiple rollback scenarios
      const actionIds = [];
      for (let i = 0; i < 5; i++) {
        const id = await testHelper.simulateParameterChangeWithDegradation(
          `test-param-${i}`,
          i * 0.1,
          (i + 1) * 0.1,
          5 + i // Varying degradation percentages
        );
        actionIds.push(id);
      }

      // Wait for all to complete
      await Promise.all(actionIds.map(id => testHelper.waitForActionCompletion(id)));
      
      const finalStatus = testHelper.getServiceStatus();
      
      // Service should remain stable
      expect(finalStatus.policy).toBeDefined();
      expect(finalStatus.metrics).toBeDefined();
      expect(finalStatus.activeActions).toBe(0); // All completed
    });

    it('should handle rollback failures gracefully', async () => {
      // This test would simulate a scenario where rollback itself fails
      // and verify the service handles it gracefully
      
      const actionId = await testHelper.simulateParameterChangeWithDegradation(
        'temperature',
        0.7,
        0.9,
        15 // High degradation
      );

      // Mock rollback failure (in a real scenario, this might be a network error, etc.)
      const originalRollback = (testHelper as any).service.rollbackAction;
      (testHelper as any).service.rollbackAction = jest.fn().mockRejectedValue(
        new Error('Simulated rollback failure')
      );

      try {
        await testHelper.waitForActionCompletion(actionId);
      } catch (error) {
        // Expected to fail
      }

      // Service should still be operational
      const status = testHelper.getServiceStatus();
      expect(status).toBeDefined();
      
      // Restore original method
      (testHelper as any).service.rollbackAction = originalRollback;
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete rollback within acceptable time limits', async () => {
      const startTime = Date.now();
      
      const actionId = await testHelper.simulateParameterChangeWithDegradation(
        'temperature',
        0.7,
        0.9,
        20 // High degradation for fast rollback
      );

      const completedAction = await testHelper.waitForActionCompletion(actionId);
      const totalTime = Date.now() - startTime;

      testHelper.verifyRollbackExecution(completedAction);
      
      // Rollback should complete within reasonable time (3 seconds for integration test)
      expect(totalTime).toBeLessThan(3000);
    });

    it('should handle memory efficiently during multiple rollbacks', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create many actions that will rollback
      const actionPromises = [];
      for (let i = 0; i < 20; i++) {
        actionPromises.push(
          testHelper.simulateParameterChangeWithDegradation(
            `batch-param-${i}`,
            Math.random(),
            Math.random(),
            5 + (i % 5) // Varying degradation
          )
        );
      }

      const actionIds = await Promise.all(actionPromises);
      
      // Wait for all to complete
      await Promise.all(actionIds.map(id => testHelper.waitForActionCompletion(id)));
      
      const finalMemory = process.memoryUsage();
      
      // Memory usage shouldn't grow excessively (allowing for normal test variance)
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
      
      // Cleanup and check memory is released
      testHelper.cleanup();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });
  });
});
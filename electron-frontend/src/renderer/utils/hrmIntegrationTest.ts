/**
 * HRM Integration Test Suite
 *
 * Comprehensive test suite for Phase 1 HRM integration
 * Tests decision making, fallback strategies, caching, and performance monitoring
 */

import Logger from './logger';
import {
  DecisionContext,
  DecisionType,
  TaskExecutionRequest,
} from '../services/unifiedAgentDecisionService';
import { hrmIntegrationService, HRMIntegrationConfig } from '../services/hrmIntegrationService';

export interface HRMTestResults {
  testName: string;
  success: boolean;
  duration: number;
  details: Record<string, any>;
  errors?: string[];
}

export interface HRMTestSuite {
  overall: {
    testsRun: number;
    testsPassed: number;
    totalDuration: number;
    success: boolean;
  };
  results: HRMTestResults[];
  summary: {
    decisionAccuracy: number;
    fallbackReliability: number;
    cachingEfficiency: number;
    performanceConsistency: number;
  };
}

export class HRMIntegrationTester {
  private testResults: HRMTestResults[] = [];
  private startTime = 0;

  /**
   * Run comprehensive HRM integration test suite
   */
  async runFullTestSuite(): Promise<HRMTestSuite> {
    Logger.warn('🧪 Starting HRM Integration Test Suite...');
    this.startTime = Date.now();
    this.testResults = [];

    try {
      // Test 1: Basic Decision Making
      await this.testBasicDecisionMaking();

      // Test 2: Agent Routing Intelligence
      await this.testAgentRoutingIntelligence();

      // Test 3: Fallback Strategy Reliability
      await this.testFallbackStrategies();

      // Test 4: Decision Caching
      await this.testDecisionCaching();

      // Test 5: Confidence Filtering
      await this.testConfidenceFiltering();

      // Test 6: Performance Under Load
      await this.testPerformanceUnderLoad();

      // Test 7: Error Recovery
      await this.testErrorRecovery();

      const summary = this.generateTestSummary();

      Logger.warn(`✅ HRM Integration Test Suite completed:`, {
        tests_run: this.testResults.length,
        tests_passed: this.testResults.filter(r => r.success).length,
        success_rate: Math.round(
          (this.testResults.filter(r => r.success).length / this.testResults.length) * 100
        ),
        total_duration: Date.now() - this.startTime,
      });

      return summary;
    } catch (error) {
      Logger.error('❌ HRM Integration Test Suite failed:', error);
      throw error;
    }
  }

  /**
   * Test 1: Basic HRM decision making functionality
   */
  private async testBasicDecisionMaking(): Promise<void> {
    const testStart = Date.now();
    const testName = 'Basic Decision Making';

    try {
      Logger.debug(`🔬 Testing: ${testName}`);

      const context: DecisionContext = {
        decision_type: DecisionType.AGENT_ROUTING,
        request_data: {
          task_type: 'frontend-developer',
          complexity: 'moderate',
          description: 'Create a React component with TypeScript',
        },
        constraints: {
          max_time_ms: 30000,
          max_memory_mb: 512,
        },
        available_options: [
          { agent_id: 'frontend-developer', capabilities: ['react', 'typescript'] },
          { agent_id: 'react-expert', capabilities: ['react', 'components'] },
          { agent_id: 'typescript-pro', capabilities: ['typescript', 'types'] },
        ],
      };

      const decision = await hrmIntegrationService.makeEnhancedDecision(context);

      const testResults = {
        hasDecisionId: !!decision.decision_id,
        hasSelectedOption: !!decision.selected_option,
        confidenceInRange: decision.confidence >= 0 && decision.confidence <= 1,
        hasReasoningSteps: decision.reasoning_steps.length > 0,
        hasTimestamp: !!decision.timestamp,
        estimatedResourcesValid: decision.estimated_resources.estimated_time_ms > 0,
        riskAssessmentPresent: !!decision.risk_assessment.risk_level,
      };

      const allTestsPassed = Object.values(testResults).every(result => result === true);

      this.testResults.push({
        testName,
        success: allTestsPassed,
        duration: Date.now() - testStart,
        details: {
          decision_id: decision.decision_id,
          confidence: decision.confidence,
          selected_agent: decision.selected_option.agent_id,
          reasoning_steps: decision.reasoning_steps.length,
          test_results: testResults,
        },
      });
    } catch (error) {
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - testStart,
        details: {},
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  /**
   * Test 2: Agent routing intelligence with different task complexities
   */
  private async testAgentRoutingIntelligence(): Promise<void> {
    const testStart = Date.now();
    const testName = 'Agent Routing Intelligence';

    try {
      Logger.debug(`🔬 Testing: ${testName}`);

      const testCases = [
        { complexity: 'simple', expectedAgent: 'frontend-developer' },
        { complexity: 'moderate', expectedAgent: 'react-expert' },
        { complexity: 'complex', expectedAgent: 'typescript-pro' },
      ];

      const results = [];

      for (const testCase of testCases) {
        const request: TaskExecutionRequest = {
          task_type: 'frontend-developer',
          complexity: testCase.complexity as any,
          task_description: `${testCase.complexity} React component task`,
          user_context: {
            profile_id: 'test-user',
            preferences: {},
            experience_level: 'intermediate',
            frontend_framework: 'react',
          },
          execution_constraints: {},
          parameters: {},
        };

        const routing = await hrmIntegrationService.getOptimalAgentRouting(request);

        results.push({
          complexity: testCase.complexity,
          primary_agent: routing.primaryAgent,
          confidence: routing.confidence,
          backup_agents: routing.backupAgents.length,
          reasoning_steps: routing.reasoning.length,
          estimated_success: routing.estimatedPerformance.successProbability,
        });
      }

      const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

      this.testResults.push({
        testName,
        success: averageConfidence > 0.5 && results.every(r => r.primary_agent),
        duration: Date.now() - testStart,
        details: {
          test_cases: results.length,
          average_confidence: Math.round(averageConfidence * 100) / 100,
          routing_results: results,
        },
      });
    } catch (error) {
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - testStart,
        details: {},
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  /**
   * Test 3: Fallback strategy reliability
   */
  private async testFallbackStrategies(): Promise<void> {
    const testStart = Date.now();
    const testName = 'Fallback Strategy Reliability';

    try {
      Logger.debug(`🔬 Testing: ${testName}`);

      const fallbackStrategies: Array<HRMIntegrationConfig['fallbackStrategy']> = [
        'conservative',
        'aggressive',
        'adaptive',
      ];

      const results = [];

      for (const strategy of fallbackStrategies) {
        // Create a temporary integration service with this strategy
        const testService = new (
          await import('../services/hrmIntegrationService')
        ).HRMIntegrationService({
          fallbackStrategy: strategy,
          confidenceThreshold: 0.9, // High threshold to trigger fallback
        });

        const context: DecisionContext = {
          decision_type: DecisionType.AGENT_ROUTING,
          request_data: {
            task_type: 'test-task',
            complexity: 'moderate',
          },
        };

        const decision = await testService.makeEnhancedDecision(context);

        results.push({
          strategy,
          fallback_triggered: !!decision.fallback_strategy,
          confidence: decision.confidence,
          selected_agent: decision.selected_option.agent_id || decision.selected_option.action,
          reasoning_steps: decision.reasoning_steps.length,
        });
      }

      const allTriggeredFallback = results.every(r => r.fallback_triggered);

      this.testResults.push({
        testName,
        success: allTriggeredFallback && results.length === fallbackStrategies.length,
        duration: Date.now() - testStart,
        details: {
          strategies_tested: fallbackStrategies.length,
          fallback_success_rate: results.filter(r => r.fallback_triggered).length / results.length,
          strategy_results: results,
        },
      });
    } catch (error) {
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - testStart,
        details: {},
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  /**
   * Test 4: Decision caching functionality
   */
  private async testDecisionCaching(): Promise<void> {
    const testStart = Date.now();
    const testName = 'Decision Caching';

    try {
      Logger.debug(`🔬 Testing: ${testName}`);

      const context: DecisionContext = {
        decision_type: DecisionType.AGENT_ROUTING,
        request_data: {
          task_type: 'cache-test',
          complexity: 'simple',
        },
      };

      // Make initial decision (should not be cached)
      const decision1Start = Date.now();
      const decision1 = await hrmIntegrationService.makeEnhancedDecision(context);
      const decision1Time = Date.now() - decision1Start;

      // Make same decision again (should be cached and faster)
      const decision2Start = Date.now();
      const decision2 = await hrmIntegrationService.makeEnhancedDecision(context);
      const decision2Time = Date.now() - decision2Start;

      const metrics = hrmIntegrationService.getPerformanceMetrics();

      this.testResults.push({
        testName,
        success: decision2Time < decision1Time && metrics.cacheHitRate > 0,
        duration: Date.now() - testStart,
        details: {
          first_decision_time: decision1Time,
          second_decision_time: decision2Time,
          speed_improvement: Math.round(((decision1Time - decision2Time) / decision1Time) * 100),
          cache_hit_rate: Math.round(metrics.cacheHitRate * 100),
          same_decision_id: decision1.decision_id === decision2.decision_id,
        },
      });
    } catch (error) {
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - testStart,
        details: {},
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  /**
   * Test 5: Confidence filtering
   */
  private async testConfidenceFiltering(): Promise<void> {
    const testStart = Date.now();
    const testName = 'Confidence Filtering';

    try {
      Logger.debug(`🔬 Testing: ${testName}`);

      // Test with high confidence threshold to trigger enhancement
      const testService = new (
        await import('../services/hrmIntegrationService')
      ).HRMIntegrationService({
        confidenceThreshold: 0.95, // Very high threshold
        enableConfidenceFiltering: true,
      });

      const context: DecisionContext = {
        decision_type: DecisionType.AGENT_ROUTING,
        request_data: {
          task_type: 'confidence-test',
          complexity: 'moderate',
        },
      };

      const decision = await testService.makeEnhancedDecision(context);

      this.testResults.push({
        testName,
        success: decision.confidence >= 0.4, // Should be enhanced from low confidence
        duration: Date.now() - testStart,
        details: {
          original_confidence: decision.fallback_strategy?.original_confidence,
          enhanced_confidence: decision.confidence,
          confidence_enhanced: !!decision.fallback_strategy?.original_confidence,
          threshold_applied: 0.95,
        },
      });
    } catch (error) {
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - testStart,
        details: {},
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  /**
   * Test 6: Performance under load
   */
  private async testPerformanceUnderLoad(): Promise<void> {
    const testStart = Date.now();
    const testName = 'Performance Under Load';

    try {
      Logger.debug(`🔬 Testing: ${testName}`);

      const concurrentRequests = 10;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const context: DecisionContext = {
          decision_type: DecisionType.AGENT_ROUTING,
          request_data: {
            task_type: `load-test-${i}`,
            complexity: i % 2 === 0 ? 'simple' : 'complex',
          },
        };

        promises.push(hrmIntegrationService.makeEnhancedDecision(context));
      }

      const results = await Promise.all(promises);
      const metrics = hrmIntegrationService.getPerformanceMetrics();

      const averageResponseTime = metrics.averageResponseTimeMs;
      const successRate = results.filter(r => r.decision_id).length / results.length;

      this.testResults.push({
        testName,
        success: averageResponseTime < 5000 && successRate > 0.8,
        duration: Date.now() - testStart,
        details: {
          concurrent_requests: concurrentRequests,
          success_rate: Math.round(successRate * 100),
          average_response_time: Math.round(averageResponseTime),
          total_decisions: metrics.totalDecisions,
          cache_efficiency: Math.round(metrics.cacheHitRate * 100),
        },
      });
    } catch (error) {
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - testStart,
        details: {},
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  /**
   * Test 7: Error recovery and resilience
   */
  private async testErrorRecovery(): Promise<void> {
    const testStart = Date.now();
    const testName = 'Error Recovery';

    try {
      Logger.debug(`🔬 Testing: ${testName}`);

      // Test with invalid context to trigger error handling
      const invalidContext: DecisionContext = {
        decision_type: 'invalid_type' as any,
        request_data: null as any,
      };

      const decision = await hrmIntegrationService.makeEnhancedDecision(invalidContext);

      // Should still return a valid decision through error recovery
      const validDecision = !!(
        decision.decision_id &&
        decision.selected_option &&
        decision.reasoning_steps.length > 0
      );

      this.testResults.push({
        testName,
        success: validDecision && !!decision.fallback_strategy,
        duration: Date.now() - testStart,
        details: {
          recovered_from_error: validDecision,
          fallback_triggered: !!decision.fallback_strategy,
          decision_id: decision.decision_id,
          confidence: decision.confidence,
          error_handling: decision.fallback_strategy?.reason,
        },
      });
    } catch (error) {
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - testStart,
        details: {},
        errors: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  /**
   * Generate comprehensive test summary
   */
  private generateTestSummary(): HRMTestSuite {
    const testsRun = this.testResults.length;
    const testsPassed = this.testResults.filter(r => r.success).length;
    const totalDuration = Date.now() - this.startTime;

    // Calculate summary metrics
    const decisionAccuracy = testsPassed / testsRun;
    const fallbackTest = this.testResults.find(r => r.testName === 'Fallback Strategy Reliability');
    const fallbackReliability = fallbackTest?.success ? 1.0 : 0.0;

    const cachingTest = this.testResults.find(r => r.testName === 'Decision Caching');
    const cachingEfficiency = cachingTest?.success ? 1.0 : 0.0;

    const performanceTest = this.testResults.find(r => r.testName === 'Performance Under Load');
    const performanceConsistency = performanceTest?.success ? 1.0 : 0.0;

    return {
      overall: {
        testsRun,
        testsPassed,
        totalDuration,
        success: decisionAccuracy >= 0.8, // 80% pass rate required
      },
      results: this.testResults,
      summary: {
        decisionAccuracy: Math.round(decisionAccuracy * 100) / 100,
        fallbackReliability: Math.round(fallbackReliability * 100) / 100,
        cachingEfficiency: Math.round(cachingEfficiency * 100) / 100,
        performanceConsistency: Math.round(performanceConsistency * 100) / 100,
      },
    };
  }
}

// Export test runner function
export async function runHRMIntegrationTests(): Promise<HRMTestSuite> {
  const tester = new HRMIntegrationTester();
  return await tester.runFullTestSuite();
}

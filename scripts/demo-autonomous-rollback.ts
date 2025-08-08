#!/usr/bin/env tsx
/**
 * Autonomous Action Rollback Demonstration Script
 * 
 * This script demonstrates the autonomous action system's rollback capabilities
 * by simulating parameter changes, monitoring performance, and showcasing
 * the automatic rollback mechanisms when performance degrades.
 * 
 * Usage:
 * npm run demo:autonomous-rollback
 * or
 * npx tsx scripts/demo-autonomous-rollback.ts
 */

import { LogContext, log } from '../src/utils/logger';
import { AutonomousActionLoopService, AutonomousAction } from '../src/services/autonomous-action-loop-service';
import { TaskType } from '../src/services/intelligent-parameter-service';

interface DemoScenario {
  name: string;
  description: string;
  parameterChange: {
    from: any;
    to: any;
    property: string;
  };
  expectedOutcome: 'rollback' | 'success';
  simulatedMetrics: {
    before: Record<string, number>;
    after: Record<string, number>;
  };
}

class AutonomousRollbackDemo {
  private service: AutonomousActionLoopService;
  private demoActions: Map<string, AutonomousAction> = new Map();

  constructor() {
    this.service = new AutonomousActionLoopService();
  }

  async runDemo(): Promise<void> {
    console.log('\n🤖 Autonomous Action Rollback Demonstration');
    console.log('================================================\n');

    const scenarios: DemoScenario[] = [
      {
        name: 'Temperature Increase - Performance Degradation',
        description: 'Increase temperature from 0.7 to 0.95, causing 8% performance degradation',
        parameterChange: {
          from: 0.7,
          to: 0.95,
          property: 'temperature'
        },
        expectedOutcome: 'rollback',
        simulatedMetrics: {
          before: {
            task_success_rate: 0.85,
            execution_time: 1200,
            user_satisfaction_score: 4.2,
            resource_utilization: 0.65
          },
          after: {
            task_success_rate: 0.782, // 8% degradation
            execution_time: 1300,
            user_satisfaction_score: 4.0,
            resource_utilization: 0.70
          }
        }
      },
      {
        name: 'Max Tokens Optimization - Performance Improvement',
        description: 'Increase maxTokens from 2048 to 3072, resulting in improved performance',
        parameterChange: {
          from: 2048,
          to: 3072,
          property: 'maxTokens'
        },
        expectedOutcome: 'success',
        simulatedMetrics: {
          before: {
            task_success_rate: 0.82,
            execution_time: 1400,
            user_satisfaction_score: 4.0,
            resource_utilization: 0.70
          },
          after: {
            task_success_rate: 0.88, // 7% improvement
            execution_time: 1350,
            user_satisfaction_score: 4.4,
            resource_utilization: 0.72
          }
        }
      },
      {
        name: 'Top-P Adjustment - Marginal Degradation',
        description: 'Adjust topP from 0.9 to 0.6, causing 6% degradation triggering rollback',
        parameterChange: {
          from: 0.9,
          to: 0.6,
          property: 'topP'
        },
        expectedOutcome: 'rollback',
        simulatedMetrics: {
          before: {
            task_success_rate: 0.87,
            execution_time: 1100,
            user_satisfaction_score: 4.3,
            resource_utilization: 0.60
          },
          after: {
            task_success_rate: 0.818, // 6% degradation
            execution_time: 1180,
            user_satisfaction_score: 4.1,
            resource_utilization: 0.65
          }
        }
      }
    ];

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      console.log(`\n📋 Scenario ${i + 1}: ${scenario.name}`);
      console.log(`Description: ${scenario.description}`);
      console.log(`Expected Outcome: ${scenario.expectedOutcome.toUpperCase()}\n`);

      await this.runScenario(scenario, i + 1);
      
      // Wait between scenarios for better readability
      if (i < scenarios.length - 1) {
        await this.sleep(2000);
      }
    }

    console.log('\n🎯 Demo Summary');
    console.log('================');
    await this.printDemoSummary();
  }

  private async runScenario(scenario: DemoScenario, scenarioNumber: number): Promise<void> {
    const actionId = `demo-scenario-${scenarioNumber}-${Date.now()}`;
    
    const action = this.createDemoAction(actionId, scenario);
    this.demoActions.set(actionId, action);

    // Mock the metrics for this scenario
    this.mockMetricsForScenario(actionId, scenario);

    console.log(`⚡ Initiating parameter change...`);
    console.log(`   Property: ${scenario.parameterChange.property}`);
    console.log(`   From: ${JSON.stringify(scenario.parameterChange.from)}`);
    console.log(`   To: ${JSON.stringify(scenario.parameterChange.to)}`);

    await this.service.queueAction(action);
    
    console.log(`⏳ Monitoring performance for ${action.execution.monitoringPeriod}ms...`);
    
    const startTime = Date.now();
    const result = await this.waitForActionCompletion(actionId);
    const duration = Date.now() - startTime;

    console.log(`✅ Action completed in ${duration}ms`);
    console.log(`Status: ${result.status.toUpperCase()}`);
    
    if (result.implementationResult) {
      this.printActionResults(result.implementationResult, scenario);
    }

    // Validate the outcome matches expectations
    this.validateScenarioOutcome(result, scenario);
  }

  private createDemoAction(actionId: string, scenario: DemoScenario): AutonomousAction {
    return {
      id: actionId,
      type: 'parameter_adjustment',
      priority: 'medium',
      target: {
        service: 'intelligent-parameter-service',
        component: 'llm-parameters',
        property: scenario.parameterChange.property,
        taskType: 'code_generation' as TaskType
      },
      change: {
        from: scenario.parameterChange.from,
        to: scenario.parameterChange.to,
        rationale: `Demo: ${scenario.description}`
      },
      assessment: {
        riskLevel: 'medium',
        confidenceScore: 0.8,
        expectedImpact: scenario.expectedOutcome === 'success' ? 0.1 : -0.05,
        implementationComplexity: 'simple',
        reversibilityScore: 0.95
      },
      evidence: {
        sources: ['demo-simulation'],
        supportingData: [
          { metric: 'historical_performance', value: 0.85 }
        ],
        historicalPerformance: { success_rate: 0.85 },
        userImpact: {
          affectedUsers: 1,
          potentialBenefit: 'Demonstration of rollback capabilities'
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
          },
          {
            metric: 'execution_time',
            threshold: 0.1, // 10% increase threshold
            operator: 'gt'
          }
        ],
        monitoringPeriod: 2000, // 2 seconds for demo
        successCriteria: [
          {
            metric: 'task_success_rate',
            improvementTarget: 0.02
          }
        ]
      },
      createdAt: new Date(),
      status: 'pending'
    };
  }

  private mockMetricsForScenario(actionId: string, scenario: DemoScenario): void {
    // Override the captureMetrics method to return our simulated metrics
    const originalCaptureMetrics = (this.service as any).captureMetrics;
    
    (this.service as any).captureMetrics = async (action: AutonomousAction) => {
      if (action.id === actionId) {
        // Simulate delay for metrics collection
        await this.sleep(500);
        return scenario.simulatedMetrics.after;
      }
      
      // For other actions, use original method or default metrics
      if (originalCaptureMetrics) {
        return originalCaptureMetrics.call(this.service, action);
      }
      
      return scenario.simulatedMetrics.before;
    };

    // Mock initial metrics capture
    const originalImplementAction = (this.service as any).implementAction;
    (this.service as any).implementAction = async (action: AutonomousAction) => {
      if (action.id === actionId) {
        // Simulate implementation with our predefined before metrics
        action.status = 'implementing';
        action.implementedAt = new Date();
        (this.service as any).activeActions.set(action.id, action);

        // Start monitoring with our simulated before metrics
        setTimeout(async () => {
          await (this.service as any).evaluateActionResults(action, scenario.simulatedMetrics.before);
        }, action.execution.monitoringPeriod);
      } else if (originalImplementAction) {
        return originalImplementAction.call(this.service, action);
      }
    };
  }

  private printActionResults(result: any, scenario: DemoScenario): void {
    console.log(`\n📊 Performance Metrics:`);
    console.log(`   Before Implementation:`);
    Object.entries(scenario.simulatedMetrics.before).forEach(([metric, value]) => {
      console.log(`     ${metric}: ${this.formatMetricValue(value)}`);
    });
    
    console.log(`   After Implementation:`);
    Object.entries(scenario.simulatedMetrics.after).forEach(([metric, value]) => {
      console.log(`     ${metric}: ${this.formatMetricValue(value)}`);
    });
    
    console.log(`   Performance Change:`);
    Object.entries(result.metricsBeforeAfter.improvement).forEach(([metric, value]) => {
      const changePercent = scenario.simulatedMetrics.before[metric] > 0 
        ? ((value as number) / scenario.simulatedMetrics.before[metric] * 100).toFixed(2)
        : '0.00';
      const direction = (value as number) >= 0 ? '⬆️' : '⬇️';
      console.log(`     ${metric}: ${direction} ${changePercent}% (${this.formatMetricValue(value as number)})`);
    });

    if (result.rollbackRequired) {
      console.log(`\n🔄 Rollback Details:`);
      console.log(`   Reason: ${result.rollbackReason}`);
      console.log(`   Action: Restore previous parameter configuration`);
      console.log(`   Timeframe: Immediate upon detection`);
    } else {
      console.log(`\n✅ Change Applied Successfully`);
      console.log(`   Performance improved or remained stable`);
    }
  }

  private formatMetricValue(value: number): string {
    if (value < 1 && value > 0) {
      return value.toFixed(3);
    } else if (value > 1000) {
      return Math.round(value).toString();
    } else {
      return value.toFixed(2);
    }
  }

  private validateScenarioOutcome(result: any, scenario: DemoScenario): void {
    const actualOutcome = result.status === 'rolled_back' ? 'rollback' : 'success';
    
    if (actualOutcome === scenario.expectedOutcome) {
      console.log(`✅ Scenario validated - Expected ${scenario.expectedOutcome}, got ${actualOutcome}`);
    } else {
      console.log(`❌ Scenario validation failed - Expected ${scenario.expectedOutcome}, got ${actualOutcome}`);
    }
  }

  private async waitForActionCompletion(actionId: string, timeoutMs: number = 10000): Promise<any> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        const action = this.demoActions.get(actionId) || (this.service as any).actions.get(actionId);
        
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

  private async printDemoSummary(): Promise<void> {
    const allActions = Array.from(this.demoActions.values());
    const rolledBackActions = allActions.filter(a => a.status === 'rolled_back');
    const successfulActions = allActions.filter(a => a.status === 'completed');

    console.log(`Total Actions: ${allActions.length}`);
    console.log(`Successful Changes: ${successfulActions.length}`);
    console.log(`Rolled Back Changes: ${rolledBackActions.length}`);
    console.log(`Rollback Success Rate: ${((rolledBackActions.length / allActions.length) * 100).toFixed(1)}%`);

    console.log(`\n🔒 Safety Mechanisms Demonstrated:`);
    console.log(`   ✅ Performance degradation detection (>5% threshold)`);
    console.log(`   ✅ Automatic parameter restoration on rollback`);
    console.log(`   ✅ Immediate rollback upon detection`);
    console.log(`   ✅ Comprehensive metrics capture for learning`);
    console.log(`   ✅ Risk assessment and confidence scoring`);

    if (rolledBackActions.length > 0) {
      console.log(`\n📚 Learning Opportunities:`);
      rolledBackActions.forEach((action, index) => {
        const reason = action.implementationResult?.rollbackReason || 'Unknown';
        console.log(`   ${index + 1}. ${action.target.property} change: ${reason}`);
      });
    }

    console.log(`\n🎉 Demo completed successfully! The autonomous action system`);
    console.log(`   demonstrated robust rollback capabilities and self-healing mechanisms.`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  try {
    const demo = new AutonomousRollbackDemo();
    await demo.runDemo();
    process.exit(0);
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  main();
}

export { AutonomousRollbackDemo };
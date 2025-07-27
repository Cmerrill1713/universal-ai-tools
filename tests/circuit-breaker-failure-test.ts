import {
  CircuitBreakerService,
  withCircuitBreaker,
  httpWithCircuitBreaker,
} from '../src/services/circuit-breaker';
import { logger } from '../src/utils/logger';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

interface TestResult {
  testName: string;
  success: boolean;
  circuitState: string;
  metrics: unknown;
  error?: string;
  duration: number;
  fallbackTriggered: boolean;
}

interface TestSuite {
  suiteName: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    openCircuits: string[];
  };
}

class CircuitBreakerFailureTests {
  private circuitBreaker: CircuitBreakerService;
  private testResults: TestSuite[] = [];
  private alertsTriggered: string[] = [];

  constructor() {
    this.// TODO: Refactor nested ternary
circuitBreaker = new CircuitBreakerService();
    this.setupAlertMonitoring();
  }

  private setupAlertMonitoring() {
    this.circuitBreaker.on('circuit-open', (data) => {
      this.alertsTriggered.push(`ALERT: Circuit ${data.name} opened`);
      console.log(`🔴 ALERT: Circuit breaker ${data.name} opened!`);
    });

    this.circuitBreaker.on('circuit-close', (data) => {
      this.alertsTriggered.push(`ALERT: Circuit ${data.name} closed`);
      console.log(`🟢 ALERT: Circuit breaker ${data.name} closed!`);
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Circuit Breaker Failure Tests...\n');

    await this.testDatabaseCircuitBreaker();
    await this.testHttpServiceCircuitBreakers();
    await this.testRedisCircuitBreaker();
    await this.testAIServiceCircuitBreakers();
    await this.testMonitoringAndAlerts();

    this.generateReport();
  }

  // 1. Test Database Circuit Breaker
  async testDatabaseCircuitBreaker(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Database Circuit Breaker Tests',
      results: [],
      summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
    };

    console.log('📊 Testing Database Circuit Breaker...');

    // Test 1: Simulate database connection failures
    await this.runTest(suite, 'Database Connection Failures', async () => {
      let fallbackTriggered = false;

      // Simulate 10 consecutive database failures
      for (let i = 0; i < 10; i++) {
        try {
          await this.circuitBreaker.databaseQuery(
            'user-lookup',
            async () => {
              throw new Error('Connection refused');
            },
            {
              fallback: () => {
                fallbackTriggered = true;
                throw new Error('Database temporarily unavailable');
              },
            }
          );
        } catch (error) {
          // Expected to fail
        }
        await this.sleep(100);
      }

      const metrics = this.circuitBreaker.getMetrics('db-user-lookup');
      return {
        success: metrics?.state === 'open' && fallbackTriggered,
        fallbackTriggered,
        metrics,
      };
    });

    // Test 2: Database timeout scenarios
    await this.runTest(suite, 'Database Timeout Scenarios', async () => {
      let fallbackTriggered = false;

      // Simulate slow database queries that timeout
      for (let i = 0; i < 6; i++) {
        try {
          await this.circuitBreaker.databaseQuery(
            'slow-query',
            async () => {
              return new Promise((resolve) => {
                setTimeout(resolve, 6000); // Longer than 5s timeout
              });
            },
            {
              timeout: MILLISECONDS_IN_SECOND, // 1 second timeout
              fallback: () => {
                fallbackTriggered = true;
                throw new Error('Query timeout');
              },
            }
          );
        } catch (error) {
          // Expected to timeout
        }
        await this.sleep(200);
      }

      const metrics = this.circuitBreaker.getMetrics('db-slow-query');
      return {
        success: metrics?.timeouts > 0 && fallbackTriggered,
        fallbackTriggered,
        metrics,
      };
    });

    // Test 3: Recovery after database restoration
    await this.runTest(suite, 'Database Recovery After Restoration', async () => {
      // Reset the circuit
      this.circuitBreaker.reset('db-user-lookup');
      await this.sleep(1000);

      // Simulate successful database operations
      let // TODO: Refactor nested ternary
successCount = 0;
      for (let i = 0; i < 5; i++) {
        try {
          await this.circuitBreaker.databaseQuery('user-lookup', async () => {
            return { id: i, name: `User ${i}` };
          });
          successCount++;
        } catch (error) {
          // Should not fail
        }
        await this.sleep(100);
      }

      const metrics = this.circuitBreaker.getMetrics('db-user-lookup');
      return {
        success: metrics?.state === 'closed' && successCount === 5,
        fallbackTriggered: false,
        metrics,
      };
    });

    this.testResults.push(suite);
  }

  // 2. Test HTTP Service Circuit Breakers
  async testHttpServiceCircuitBreakers(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'HTTP Service Circuit Breaker Tests',
      results: [],
      summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
    };

    console.log('🌐 Testing HTTP Service Circuit Breakers...');

    // Test 1: External API failures
    await this.runTest(suite, 'External API Failures', async () => {
      let fallbackTriggered = false;

      // Simulate API failures
      for (let i = 0; i < 8; i++) {
        try {
          await this.circuitBreaker.httpRequest(
            'external-api',
            {
              url: 'https://httpstat.us/500',
              timeout: 5000,
            },
            {
              fallback: () => {
                fallbackTriggered = true;
                return { data: null, fallback: true };
              },
            }
          );
        } catch (error) {
          // Expected to fail
        }
        await this.sleep(200);
      }

      const metrics = this.circuitBreaker.getMetrics('external-api');
      return {
        success: metrics?.failures > 0 && fallbackTriggered,
        fallbackTriggered,
        metrics,
      };
    });

    // Test 2: Timeout and retry logic
    await this.runTest(suite, 'HTTP Timeout and Retry Logic', async () => {
      let fallbackTriggered = false;

      // Simulate timeout scenarios
      for (let // TODO: Refactor nested ternary
i = 0; i < 5; i++) {
        try {
          await this.circuitBreaker.httpRequest(
            'slow-api',
            {
              url: 'https://httpstat.us/200?sleep=10000', // 10 second delay
              timeout: 2000, // 2 second timeout
            },
            {
              timeout: 2000,
              fallback: () => {
                fallbackTriggered = true;
                return { data: null, fallback: true };
              },
            }
          );
        } catch (error) {
          // Expected to timeout
        }
        await this.sleep(300);
      }

      const metrics = this.circuitBreaker.getMetrics('slow-api');
      return {
        success: metrics?.timeouts > 0 && fallbackTriggered,
        fallbackTriggered,
        metrics,
      };
    });

    // Test 3: Circuit breaker thresholds
    await this.runTest(suite, 'Circuit Breaker Thresholds', async () => {
      // Test with low threshold
      let fallbackTriggered = false;

      for (let // TODO: Refactor nested ternary
i = 0; i < THREE; i++) {
        try {
          await this.circuitBreaker.httpRequest(
            'threshold-test',
            {
              url: 'https://httpstat.us/503',
            },
            {
              errorThresholdPercentage: 30, // Low threshold
              fallback: () => {
                fallbackTriggered = true;
                return { data: null, fallback: true };
              },
            }
          );
        } catch (error) {
          // Expected to fail
        }
        await this.sleep(100);
      }

      const metrics = this.circuitBreaker.getMetrics('threshold-test');
      return {
        success: metrics?.state === 'open' || metrics?.failures > 0,
        fallbackTriggered,
        metrics,
      };
    });

    this.testResults.push(suite);
  }

  // 3. Test Redis Circuit Breaker
  async testRedisCircuitBreaker(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Redis Circuit Breaker Tests',
      results: [],
      summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
    };

    console.log('🔴 Testing Redis Circuit Breaker...');

    // Test 1: Redis connection failures
    await this.runTest(suite, 'Redis Connection Failures', async () => {
      let fallbackTriggered = false;

      // Simulate Redis connection failures
      for (let i = 0; i < 6; i++) {
        try {
          await this.circuitBreaker.redisOperation(
            'get',
            async () => {
              throw new Error('Redis connection failed');
            },
            {
              fallback: () => {
                fallbackTriggered = true;
                return null;
              },
            }
          );
        } catch (error) {
          // Expected to fail
        }
        await this.sleep(150);
      }

      const metrics = this.circuitBreaker.getMetrics('redis-get');
      return {
        success: metrics?.failures > 0 && fallbackTriggered,
        fallbackTriggered,
        metrics,
      };
    });

    // Test 2: Cache fallback behavior
    await this.runTest(suite, 'Cache Fallback Behavior', async () => {
      let fallbackExecuted = false;

      // Test fallback when Redis is down
      try {
        const // TODO: Refactor nested ternary
result = await this.circuitBreaker.redisOperation(
          'cache-miss',
          async () => {
            throw new Error('Redis unavailable');
          },
          {
            fallback: () => {
              fallbackExecuted = true;
              return null; // Cache miss fallback
            },
          }
        );

        return {
          success: result === null && fallbackExecuted,
          fallbackTriggered: fallbackExecuted,
          metrics: this.circuitBreaker.getMetrics('redis-cache-miss'),
        };
      } catch (error) {
        return {
          success: false,
          fallbackTriggered: fallbackExecuted,
          metrics: this.circuitBreaker.getMetrics('redis-cache-miss'),
        };
      }
    });

    // Test 3: Recovery procedures
    await this.runTest(suite, 'Redis Recovery Procedures', async () => {
      // Reset Redis circuit breaker
      this.circuitBreaker.reset('redis-get');
      await this.sleep(500);

      let successCount = 0;
      // Simulate successful Redis operations
      for (let i = 0; i < THREE; i++) {
        try {
          await this.circuitBreaker.redisOperation('recovery-test', async () => {
            return `value-${i}`;
          });
          successCount++;
        } catch (error) {
          // Should not fail
        }
        await this.sleep(100);
      }

      const metrics = this.circuitBreaker.getMetrics('redis-recovery-test');
      return {
        success: metrics?.successes === 3 && successCount === THREE,
        fallbackTriggered: false,
        metrics,
      };
    });

    this.testResults.push(suite);
  }

  // 4. Test AI Service Circuit Breakers
  async testAIServiceCircuitBreakers(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'AI Service Circuit Breaker Tests',
      results: [],
      summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
    };

    console.log('🤖 Testing AI Service Circuit Breakers...');

    // Test 1: Ollama service failures
    await this.runTest(suite, 'Ollama Service Failures', async () => {
      let fallbackTriggered = false;

      // Simulate Ollama service failures
      for (let i = 0; i < 4; i++) {
        try {
          await this.circuitBreaker.modelInference(
            'llama2',
            async () => {
              throw new Error('Ollama service unavailable');
            },
            {
              fallback: () => {
                fallbackTriggered = true;
                throw new Error('Model temporarily unavailable');
              },
            }
          );
        } catch (error) {
          // Expected to fail
        }
        await this.sleep(200);
      }

      const metrics = this.circuitBreaker.getMetrics('model-llama2');
      return {
        success: metrics?.failures > 0 && fallbackTriggered,
        fallbackTriggered,
        metrics,
      };
    });

    // Test 2: Model inference failures
    await this.runTest(suite, 'Model Inference Failures', async () => {
      let fallbackTriggered = false;

      // Simulate model inference timeouts
      for (let // TODO: Refactor nested ternary
i = 0; i < THREE; i++) {
        try {
          await this.circuitBreaker.modelInference(
            'gpt-3.5',
            async () => {
              return new Promise((resolve) => {
                setTimeout(resolve, 35000); // Longer than 30s timeout
              });
            },
            {
              timeout: 5000, // 5 second timeout for testing
              fallback: () => {
                fallbackTriggered = true;
                throw new Error('Model inference timeout');
              },
            }
          );
        } catch (error) {
          // Expected to timeout
        }
        await this.sleep(300);
      }

      const metrics = this.circuitBreaker.getMetrics('model-gpt-3.5');
      return {
        success: metrics?.timeouts > 0 && fallbackTriggered,
        fallbackTriggered,
        metrics,
      };
    });

    // Test 3: Alternative model fallbacks
    await this.runTest(suite, 'Alternative Model Fallbacks', async () => {
      let fallbackExecuted = false;

      try {
        const result = await this.circuitBreaker.modelInference(
          'claude-3',
          async () => {
            throw new Error('Claude model unavailable');
          },
          {
            fallback: async () => {
              fallbackExecuted = true;
              // Simulate fallback to simpler model
              return 'Fallback response from simpler model';
            },
          }
        );

        return {
          success: result === 'Fallback response from simpler model' && fallbackExecuted,
          fallbackTriggered: fallbackExecuted,
          metrics: this.circuitBreaker.getMetrics('model-claude-3'),
        };
      } catch (error) {
        return {
          success: false,
          fallbackTriggered: fallbackExecuted,
          metrics: this.circuitBreaker.getMetrics('model-claude-3'),
        };
      }
    });

    this.testResults.push(suite);
  }

  // 5. Test Monitoring and Alerts
  async testMonitoringAndAlerts(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Monitoring and Alerts Tests',
      results: [],
      summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
    };

    console.log('📊 Testing Monitoring and Alerts...');

    // Test 1: Circuit breaker metrics
    await this.runTest(suite, 'Circuit Breaker Metrics Collection', async () => {
      const allMetrics = this.circuitBreaker.getAllMetrics();
      const hasMetrics = allMetrics.length > 0;

      // Check if metrics contain expected fields
      const validMetrics = allMetrics.every(
        (metric) =>
          metric.name &&
          typeof metric.requests === 'number' &&
          typeof metric.failures === 'number' &&
          typeof metric.successes === 'number'
      );

      return {
        success: hasMetrics && validMetrics,
        fallbackTriggered: false,
        metrics: { totalCircuits: allMetrics.length, allMetrics },
      };
    });

    // Test 2: Alert generation
    await this.runTest(suite, 'Alert Generation', async () => {
      const alertsCount = this.alertsTriggered.length;

      return {
        success: alertsCount > 0,
        fallbackTriggered: false,
        metrics: {
          alertsTriggered: this.alertsTriggered,
          alertCount: alertsCount,
        },
      };
    });

    // Test 3: Health check functionality
    await this.runTest(suite, 'Health Check Functionality', async () => {
      const healthCheck = this.circuitBreaker.healthCheck();

      const hasValidStructure =
        typeof healthCheck.healthy === 'boolean' &&
        Array.isArray(healthCheck.openCircuits) &&
        Array.isArray(healthCheck.metrics);

      return {
        success: hasValidStructure,
        fallbackTriggered: false,
        metrics: healthCheck,
      };
    });

    this.testResults.push(suite);
  }

  private async runTest(
    suite: TestSuite,
    testName: string,
    testFn: () => Promise<{ success: boolean; fallbackTriggered: boolean; metrics: unknown }>
  ): Promise<void> {
    const startTime = Date.now();
    console.log(`  🧪 Running: ${testName}`);

    try {
      const result = await testFn();
      const duration = Date.now() - startTime;

      const testResult: TestResult = {
        testName,
        success: result.success,
        circuitState: result.metrics?.state || 'unknown',
        metrics: result.metrics,
        duration,
        fallbackTriggered: result.fallbackTriggered,
      };

      suite.results.push(testResult);
      suite.summary.total++;

      if (result.success) {
        suite.summary.passed++;
        console.log(`    ✅ PASSED (${duration}ms)`);
      } else {
        suite.summary.failed++;
        console.log(`    ❌ FAILED (${duration}ms)`);
      }

      if (result.metrics?.// TODO: Refactor nested ternary
state === 'open') {
        suite.summary.openCircuits.push(testName);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult: TestResult = {
        testName,
        success: false,
        circuitState: 'error',
        metrics: null,
        error: error instanceof Error ? error.message : String(error),
        duration,
        fallbackTriggered: false,
      };

      suite.results.push(testResult);
      suite.summary.total++;
      suite.summary.failed++;
      console.log(`    ❌ ERROR: ${error} (${duration}ms)`);
    }
  }

  private generateReport(): void {
    console.log('\n📋 Circuit Breaker Test Report');
    console.log('='.repeat(50));

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let allOpenCircuits: string[] = [];

    this.testResults.forEach((suite) => {
      console.log(`\n${suite.suiteName}:`);
      console.log(
        `  Total: ${suite.summary.total}, Passed: ${suite.summary.passed}, Failed: ${suite.summary.failed}`
      );

      if (suite.summary.openCircuits.length > 0) {
        console.log(`  Open Circuits: ${suite.summary.openCircuits.join(', ')}`);
        allOpenCircuits.push(...suite.summary.openCircuits);
      }

      totalTests += suite.summary.total;
      totalPassed += suite.summary.passed;
      totalFailed += suite.summary.failed;
    });

    console.log('\n📊 Overall Summary:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)`);

    if (allOpenCircuits.length > 0) {
      console.log(`  🔴 Open Circuits: ${allOpenCircuits.length}`);
    }

    console.log('\n🚨 Alerts Triggered:');
    this.alertsTriggered.forEach((alert) => console.log(`  ${alert}`));

    console.log('\n💡 Recommendations:');
    this.generateRecommendations();

    // Final health check
    console.log('\n🏥 Final Health Check:');
    const finalHealth = this.circuitBreaker.healthCheck();
    console.log(`  System Healthy: ${finalHealth.healthy ? '✅' : '❌'}`);
    console.log(`  Open Circuits: ${finalHealth.openCircuits.length}`);
  }

  private generateRecommendations(): void {
    const recommendations = [
      '1. Monitor failure rates continuously',
      '2. Adjust timeout values based on service SLAs',
      '3. Implement progressive fallback strategies',
      '4. Set up automated alerts for circuit state changes',
      '5. Consider implementing bulkhead pattern for isolation',
      '6. Regular testing of circuit breaker thresholds',
      '7. Implement graceful degradation for critical services',
    ];

    recommendations.forEach((rec) => console.log(`  ${rec}`));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export for use in other tests
export { CircuitBreakerFailureTests };

// Run tests if this file is executed directly
if (require.main === module) {
  const tests = new CircuitBreakerFailureTests();
  tests.runAllTests().catch(console.error);
}

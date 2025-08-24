#!/usr/bin/env node

/**
 * Integrated Circuit Breaker Test Suite
 * Tests the actual circuit breaker service implementation with real failure scenarios
 */

import { CircuitBreakerService } from './src/services/circuit-breaker.ts';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

class IntegratedCircuitBreakerTests {
  constructor() {
    this.circuitBreaker = new CircuitBreakerService();
    this.testResults = [];
    this.alertsTriggered = [];
    this.monitoringData = {
      circuitStates: new Map(),
      performanceMetrics: [],
      alertHistory: [],
    };

    this.setupMonitoring();
  }

  setupMonitoring() {
    // Monitor circuit breaker events
    this.circuitBreaker.on('circuit-open', (data) => {
      const alert = {
        timestamp: new Date(),
        type: 'CIRCUIT_OPEN',
        circuit: data.name,
        severity: 'CRITICAL',
      };
      this.alertsTriggered.push(alert);
      this.monitoringData.alertHistory.push(alert);
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(
        `🔴 CRITICAL ALERT: Circuit ${data.name} opened at ${alert.timestamp.toISOString()}`
      );
    });

    this.circuitBreaker.on('circuit-close', (data) => {
      const alert = {
        timestamp: new Date(),
        type: 'CIRCUIT_CLOSE',
        circuit: data.name,
        severity: 'INFO',
      };
      this.alertsTriggered.push(alert);
      this.monitoringData.alertHistory.push(alert);
      console.log(`🟢 INFO: Circuit ${data.name} closed at ${alert.timestamp.toISOString()}`);
    });
  }

  async runAllTests() {
    console.log('🧪 Starting Integrated Circuit Breaker Failure Tests...\n');

    // Test database circuit breaker with real Supabase scenarios
    await this.testSupabaseDatabaseFailures();

    // Test HTTP circuit breakers with real external APIs
    await this.testExternalAPIFailures();

    // Test Redis circuit breaker scenarios
    await this.testRedisFailureScenarios();

    // Test AI service circuit breakers (Ollama integration)
    await this.testOllamaServiceFailures();

    // Test monitoring and alerting system
    await this.testMonitoringSystem();

    // Test recovery and self-healing
    await this.testRecoveryMechanisms();

    this.generateComprehensiveReport();
  }

  async testSupabaseDatabaseFailures() {
    console.log('🗄️ Testing Supabase Database Circuit Breaker...\n');

    // Test 1: Simulate database connection timeout
    await this.runTest('Supabase Connection Timeout', async () => {
      let timeouts = 0;
      let fallbacksExecuted = 0;

      for (let i = 0; i < 5; i++) {
        try {
          await this.circuitBreaker.databaseQuery(
            'user-lookup-timeout',
            async () => {
              // Simulate very slow query
              return new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('Query timeout')), 6000);
              });
            },
            {
              timeout: 2000,
              errorThresholdPercentage: 40,
              fallback: () => {
                fallbacksExecuted++;
                return { error: 'Database temporarily unavailable', fallback: true };
              },
            }
          );
        } catch (error) {
          if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
            timeouts++;
          }
        }
        await this.sleep(300);
      }

      const metrics = this.circuitBreaker.getMetrics('db-user-lookup-timeout');
      return {
        success: timeouts > 0 || metrics?.state === 'open',
        metrics: {
          ...metrics,
          timeouts,
          fallbacksExecuted,
        },
      };
    });

    // Test 2: Simulate database query failures
    await this.runTest('Supabase Query Failures', async () => {
      let queryFailures = 0;
      let circuitOpened = false;

      for (let i = 0; i < 6; i++) {
        try {
          await this.circuitBreaker.databaseQuery(
            'complex-query',
            async () => {
              throw new Error('Table does not exist');
            },
            {
              errorThresholdPercentage: 50,
              fallback: () => {
                throw new Error('Database fallback: Service degraded');
              },
            }
          );
        } catch (error) {
          queryFailures++;
        }

        const currentMetrics = this.circuitBreaker.getMetrics('db-complex-query');
        if (currentMetrics?.state === 'open') {
          circuitOpened = true;
        }

        await this.sleep(200);
      }

      return {
        success: circuitOpened && queryFailures > 0,
        metrics: {
          queryFailures,
          circuitOpened,
          finalState: this.circuitBreaker.getMetrics('db-complex-query')?.state,
        },
      };
    });
  }

  async testExternalAPIFailures() {
    console.log('🌐 Testing External API Circuit Breakers...\n');

    // Test 1: Real HTTP 500 errors
    await this.runTest('External API HTTP 500 Errors', async () => {
      let http500Errors = 0;
      let fallbackResponses = 0;

      for (let i = 0; i < 4; i++) {
        try {
          const response = await this.circuitBreaker.httpRequest(
            'external-api-500',
            {
              url: 'https://httpstat.us/500',
              timeout: 5000,
            },
            {
              errorThresholdPercentage: 40,
              fallback: () => {
                fallbackResponses++;
                return { data: null, error: 'Service temporarily unavailable', fallback: true };
              },
            }
          );

          if (response && response.fallback) {
            fallbackResponses++;
          }
        } catch (error) {
          if (error.response && error.response.status === 500) {
            http500Errors++;
          }
        }
        await this.sleep(400);
      }

      const metrics = this.circuitBreaker.getMetrics('external-api-500');
      return {
        success: http500Errors > 0 || metrics?.failures > 0,
        metrics: {
          ...metrics,
          http500Errors,
          fallbackResponses,
        },
      };
    });

    // Test 2: API rate limiting simulation
    await this.runTest('API Rate Limiting Failures', async () => {
      let rateLimitErrors = 0;
      let circuitTripped = false;

      for (let i = 0; i < 5; i++) {
        try {
          await this.circuitBreaker.httpRequest(
            'rate-limited-api',
            {
              url: 'https://httpstat.us/429',
              timeout: 5000,
            },
            {
              errorThresholdPercentage: 30,
              fallback: () => ({ data: 'Rate limit fallback', fallback: true }),
            }
          );
        } catch (error) {
          if (error.response && error.response.status === 429) {
            rateLimitErrors++;
          }
        }

        const currentMetrics = this.circuitBreaker.getMetrics('rate-limited-api');
        if (currentMetrics?.state === 'open') {
          circuitTripped = true;
        }

        await this.sleep(300);
      }

      return {
        success: rateLimitErrors > 0 || circuitTripped,
        metrics: {
          rateLimitErrors,
          circuitTripped,
          finalState: this.circuitBreaker.getMetrics('rate-limited-api')?.state,
        },
      };
    });
  }

  async testRedisFailureScenarios() {
    console.log('🔴 Testing Redis Circuit Breaker Scenarios...\n');

    // Test 1: Redis connection failures
    await this.runTest('Redis Connection Failures', async () => {
      let connectionFailures = 0;
      let cacheHits = 0;

      for (let i = 0; i < 5; i++) {
        try {
          const result = await this.circuitBreaker.redisOperation(
            'get-user-session',
            async () => {
              throw new Error('Redis connection refused');
            },
            {
              errorThresholdPercentage: 40,
              fallback: () => {
                // Return null for cache miss
                return null;
              },
            }
          );

          if (result === null) {
            cacheHits++; // Actually cache misses, but handled gracefully
          }
        } catch (error) {
          if (error.message.includes('Redis')) {
            connectionFailures++;
          }
        }
        await this.sleep(200);
      }

      const metrics = this.circuitBreaker.getMetrics('redis-get-user-session');
      return {
        success: connectionFailures > 0 && cacheHits > 0,
        metrics: {
          ...metrics,
          connectionFailures,
          gracefulCacheMisses: cacheHits,
        },
      };
    });

    // Test 2: Redis timeout scenarios
    await this.runTest('Redis Operation Timeouts', async () => {
      let timeouts = 0;

      for (let i = 0; i < 4; i++) {
        try {
          await this.circuitBreaker.redisOperation(
            'slow-redis-op',
            async () => {
              return new Promise((resolve) => {
                setTimeout(resolve, 3000); // 3 second delay
              });
            },
            {
              timeout: 1000, // 1 second timeout
              fallback: () => null,
            }
          );
        } catch (error) {
          if (error.code === 'ETIMEDOUT') {
            timeouts++;
          }
        }
        await this.sleep(250);
      }

      return {
        success: timeouts > 0,
        metrics: {
          timeouts,
          finalState: this.circuitBreaker.getMetrics('redis-slow-redis-op')?.state,
        },
      };
    });
  }

  async testOllamaServiceFailures() {
    console.log('🤖 Testing Ollama AI Service Circuit Breakers...\n');

    // Test 1: Ollama service unavailable
    await this.runTest('Ollama Service Unavailable', async () => {
      let serviceErrors = 0;
      let fallbacksUsed = 0;

      for (let i = 0; i < 3; i++) {
        try {
          const result = await this.circuitBreaker.modelInference(
            'llama2-7b',
            async () => {
              throw new Error('Ollama service is not running');
            },
            {
              timeout: 15000,
              errorThresholdPercentage: 25, // Very sensitive for AI services
              fallback: async () => {
                fallbacksUsed++;
                return 'I apologize, but the AI service is temporarily unavailable. Please try again later.';
              },
            }
          );

          if (result && result.includes('temporarily unavailable')) {
            fallbacksUsed++;
          }
        } catch (error) {
          if (error.message.includes('Ollama')) {
            serviceErrors++;
          }
        }
        await this.sleep(500);
      }

      const metrics = this.circuitBreaker.getMetrics('model-llama2-7b');
      return {
        success: serviceErrors > 0 || fallbacksUsed > 0,
        metrics: {
          ...metrics,
          serviceErrors,
          fallbacksUsed,
        },
      };
    });

    // Test 2: Model inference timeout
    await this.runTest('Model Inference Timeout', async () => {
      let inferenceTimeouts = 0;

      for (let i = 0; i < 2; i++) {
        try {
          await this.circuitBreaker.modelInference(
            'gpt-4-slow',
            async () => {
              return new Promise((resolve) => {
                setTimeout(resolve, 25000); // 25 second delay
              });
            },
            {
              timeout: 8000, // 8 second timeout
              fallback: () => 'Quick response: I understand you need a fast answer.',
            }
          );
        } catch (error) {
          if (error.code === 'ETIMEDOUT') {
            inferenceTimeouts++;
          }
        }
        await this.sleep(1000);
      }

      return {
        success: inferenceTimeouts > 0,
        metrics: {
          inferenceTimeouts,
          finalState: this.circuitBreaker.getMetrics('model-gpt-4-slow')?.state,
        },
      };
    });
  }

  async testMonitoringSystem() {
    console.log('📊 Testing Monitoring and Alerting System...\n');

    // Test 1: Metrics collection
    await this.runTest('Metrics Collection and Aggregation', async () => {
      const allMetrics = this.circuitBreaker.getAllMetrics();
      const metricsValid = allMetrics.every(
        (metric) =>
          metric.name &&
          typeof metric.requests === 'number' &&
          typeof metric.failures === 'number' &&
          typeof metric.successes === 'number' &&
          ['open', 'closed', 'half-open'].includes(metric.state)
      );

      // Check if we have metrics for our test circuits
      const hasTestMetrics = allMetrics.some((m) => m.name.includes('user-lookup-timeout'));

      return {
        success: metricsValid && hasTestMetrics && allMetrics.length > 0,
        metrics: {
          totalCircuits: allMetrics.length,
          validMetrics: metricsValid,
          sampleMetrics: allMetrics.slice(0, 3),
        },
      };
    });

    // Test 2: Alert system validation
    await this.runTest('Alert System Validation', async () => {
      const alertCount = this.alertsTriggered.length;
      const hasOpenAlerts = this.alertsTriggered.some((alert) => alert.type === 'CIRCUIT_OPEN');
      const alertStructureValid = this.alertsTriggered.every(
        (alert) => alert.timestamp && alert.type && alert.circuit && alert.severity
      );

      return {
        success: alertCount > 0 && hasOpenAlerts && alertStructureValid,
        metrics: {
          totalAlerts: alertCount,
          openAlerts: this.alertsTriggered.filter((a) => a.type === 'CIRCUIT_OPEN').length,
          closeAlerts: this.alertsTriggered.filter((a) => a.type === 'CIRCUIT_CLOSE').length,
          alertStructureValid,
        },
      };
    });

    // Test 3: Health check functionality
    await this.runTest('Health Check System', async () => {
      const healthCheck = this.circuitBreaker.healthCheck();

      const healthCheckValid =
        typeof healthCheck.healthy === 'boolean' &&
        Array.isArray(healthCheck.openCircuits) &&
        Array.isArray(healthCheck.metrics);

      // The system should not be healthy if we have open circuits
      const logicallyConsistent =
        healthCheck.openCircuits.length === 0 ? healthCheck.healthy : !healthCheck.healthy;

      return {
        success: healthCheckValid && logicallyConsistent,
        metrics: {
          ...healthCheck,
          logicallyConsistent,
        },
      };
    });
  }

  async testRecoveryMechanisms() {
    console.log('🔄 Testing Recovery and Self-Healing Mechanisms...\n');

    // Test 1: Automatic circuit recovery
    await this.runTest('Automatic Circuit Recovery', async () => {
      // Create a circuit that will fail and then recover
      const circuitName = 'recovery-demo';
      let initialFailures = 0;
      let recoverySuccesses = 0;

      // First, cause the circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await this.circuitBreaker.databaseQuery(
            circuitName,
            async () => {
              throw new Error('Temporary service failure');
            },
            {
              timeout: 3000,
              errorThresholdPercentage: 40,
              resetTimeout: 3000, // Short reset for testing
            }
          );
        } catch (error) {
          initialFailures++;
        }
        await this.sleep(200);
      }

      const circuitAfterFailures = this.circuitBreaker.getMetrics(`db-${circuitName}`);
      const wasOpen = circuitAfterFailures?.state === 'open';

      // Wait for reset timeout
      await this.sleep(4000);

      // Now simulate service recovery
      for (let i = 0; i < 3; i++) {
        try {
          await this.circuitBreaker.databaseQuery(circuitName, async () => {
            return { id: i, status: 'recovered' };
          });
          recoverySuccesses++;
        } catch (error) {
          // Should not fail
        }
        await this.sleep(300);
      }

      const finalMetrics = this.circuitBreaker.getMetrics(`db-${circuitName}`);

      return {
        success: wasOpen && recoverySuccesses > 0 && finalMetrics?.state === 'closed',
        metrics: {
          initialFailures,
          wasOpen,
          recoverySuccesses,
          finalState: finalMetrics?.state,
          finalSuccesses: finalMetrics?.successes,
        },
      };
    });

    // Test 2: Manual circuit reset
    await this.runTest('Manual Circuit Reset', async () => {
      // Find an open circuit to reset
      const healthCheck = this.circuitBreaker.healthCheck();
      const openCircuits = healthCheck.openCircuits;

      if (openCircuits.length === 0) {
        // Create an open circuit first
        try {
          await this.circuitBreaker.httpRequest(
            'manual-reset-test',
            { url: 'https://httpstat.us/500' },
            { errorThresholdPercentage: 10 }
          );
        } catch (error) {}
      }

      const circuitToReset = openCircuits[0] || 'manual-reset-test';
      const beforeReset = this.circuitBreaker.getMetrics(circuitToReset);

      // Manually reset the circuit
      this.circuitBreaker.reset(circuitToReset);

      const afterReset = this.circuitBreaker.getMetrics(circuitToReset);

      return {
        success: beforeReset?.state !== 'closed' && afterReset?.state === 'closed',
        metrics: {
          circuitToReset,
          beforeResetState: beforeReset?.state,
          afterResetState: afterReset?.state,
        },
      };
    });
  }

  async runTest(testName, testFunction) {
    const startTime = Date.now();
    console.log(`  🧪 Running: ${testName}`);

    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;

      this.testResults.push({
        name: testName,
        success: result.success,
        duration,
        metrics: result.metrics,
        timestamp: new Date(),
      });

      if (result.success) {
        console.log(`    ✅ PASSED (${duration}ms)`);
      } else {
        console.log(`    ❌ FAILED (${duration}ms)`);
      }

      // Store performance metrics
      this.monitoringData.performanceMetrics.push({
        testName,
        duration,
        success: result.success,
        timestamp: new Date(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`    💥 ERROR: ${error.message} (${duration}ms)`);

      this.testResults.push({
        name: testName,
        success: false,
        duration,
        error: error.message,
        timestamp: new Date(),
      });
    }

    console.log(); // Add spacing between tests
  }

  generateComprehensiveReport() {
    console.log('\n📋 Comprehensive Circuit Breaker Test Report');
    console.log('='.repeat(60));

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter((t) => t.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`\n📊 Test Execution Summary:`);
    console.log(`  Total Tests Executed: ${totalTests}`);
    console.log(`  Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);

    // Performance Analysis
    const avgDuration = this.testResults.reduce((sum, test) => sum + test.duration, 0) / totalTests;
    const maxDuration = Math.max(...this.testResults.map((t) => t.duration));
    const minDuration = Math.min(...this.testResults.map((t) => t.duration));

    console.log(`\n⚡ Performance Analysis:`);
    console.log(`  Average Test Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`  Fastest Test: ${minDuration}ms`);
    console.log(`  Slowest Test: ${maxDuration}ms`);

    // Circuit Breaker Health Analysis
    const finalHealthCheck = this.circuitBreaker.healthCheck();
    console.log(`\n🏥 Final System Health Check:`);
    console.log(`  System Healthy: ${finalHealthCheck.healthy ? '✅' : '❌'}`);
    console.log(`  Open Circuits: ${finalHealthCheck.openCircuits.length}`);
    console.log(`  Total Circuits Monitored: ${finalHealthCheck.metrics.length}`);

    if (finalHealthCheck.openCircuits.length > 0) {
      console.log(`  🔴 Open Circuits: ${finalHealthCheck.openCircuits.join(', ')}`);
    }

    // Alert Analysis
    console.log(`\n🚨 Alert System Analysis:`);
    console.log(`  Total Alerts Triggered: ${this.alertsTriggered.length}`);
    console.log(
      `  Critical Alerts (Circuit Open): ${this.alertsTriggered.filter((a) => a.type === 'CIRCUIT_OPEN').length}`
    );
    console.log(
      `  Recovery Alerts (Circuit Close): ${this.alertsTriggered.filter((a) => a.type === 'CIRCUIT_CLOSE').length}`
    );

    // Recent alerts
    console.log(`\n📋 Recent Alert History:`);
    this.alertsTriggered.slice(-5).forEach((alert) => {
      const severity =
        alert.severity === 'CRITICAL' ? '🔴' : alert.severity === 'WARNING' ? '🟡' : '🟢';
      console.log(
        `  ${severity} ${alert.type}: ${alert.circuit} at ${alert.timestamp.toLocaleTimeString()}`
      );
    });

    // Failure Recovery Analysis
    console.log(`\n🔄 Failure Recovery Performance:`);
    const recoveryTests = this.testResults.filter((t) => t.name.includes('Recovery'));
    const recoverySuccessRate =
      recoveryTests.length > 0
        ? ((recoveryTests.filter((t) => t.success).length / recoveryTests.length) * 100).toFixed(1)
        : 'No recovery tests';
    console.log(`  Recovery Test Success Rate: ${recoverySuccessRate}%`);

    // Circuit Breaker Metrics Summary
    console.log(`\n📊 Circuit Breaker Metrics Summary:`);
    const allMetrics = this.circuitBreaker.getAllMetrics();
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requests, 0);
    const totalFailures = allMetrics.reduce((sum, m) => sum + m.failures, 0);
    const totalSuccesses = allMetrics.reduce((sum, m) => sum + m.successes, 0);

    console.log(`  Total Requests Processed: ${totalRequests}`);
    console.log(`  Total Failures: ${totalFailures}`);
    console.log(`  Total Successes: ${totalSuccesses}`);
    console.log(
      `  Overall Failure Rate: ${totalRequests > 0 ? ((totalFailures / totalRequests) * 100).toFixed(1) : 0}%`
    );

    // Threshold Tuning Recommendations
    console.log(`\n🎯 Threshold Tuning Recommendations:`);
    const recommendations = [
      '1. Database Circuit Breakers:',
      '   - Timeout: 5-10 seconds for complex queries',
      '   - Error Threshold: 40-50% for transient connection issues',
      '   - Reset Timeout: 30-60 seconds for database recovery',
      '',
      '2. HTTP Service Circuit Breakers:',
      '   - Timeout: 10-30 seconds based on service SLA',
      '   - Error Threshold: 50-70% for external services',
      '   - Reset Timeout: 30 seconds for quick recovery testing',
      '',
      '3. Redis Circuit Breakers:',
      '   - Timeout: 1-2 seconds for cache operations',
      '   - Error Threshold: 30-40% (cache failures are less critical)',
      '   - Reset Timeout: 10-15 seconds for cache recovery',
      '',
      '4. AI Service Circuit Breakers:',
      '   - Timeout: 30-60 seconds for model inference',
      '   - Error Threshold: 25-30% (AI services are resource-intensive)',
      '   - Reset Timeout: 60-120 seconds for model warmup',
      '',
      '5. General Recommendations:',
      '   - Implement progressive timeouts (increase timeout on consecutive failures)',
      '   - Use bulkhead pattern to isolate critical services',
      '   - Set up real-time monitoring dashboards',
      '   - Implement automated alerting for production',
      '   - Regular load testing to validate thresholds',
      '   - Consider graceful degradation strategies',
      '   - Implement circuit breaker metrics in APM tools',
    ];

    recommendations.forEach((rec) => console.log(`  ${rec}`));

    console.log(`\n✅ Circuit Breaker Testing Complete!`);
    console.log(`📊 Full test results and metrics are available for analysis.`);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run the comprehensive tests
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new IntegratedCircuitBreakerTests();
  tests.runAllTests().catch(console.error);
}

export default IntegratedCircuitBreakerTests;

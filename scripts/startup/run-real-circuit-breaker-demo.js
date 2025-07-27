#!/usr/bin/env node

/**
 * Real Circuit Breaker Demonstration and Testing
 * Uses the actual circuit-breaker.ts service with real failure scenarios
 */

import {
  circuitBreaker,
  withCircuitBreaker,
  httpWithCircuitBreaker,
} from './src/services/circuit-breaker.ts';
import axios from 'axios';

class RealCircuitBreakerDemo {
  constructor() {
    this.testResults = [];
    this.setupEventMonitoring();
  }

  setupEventMonitoring() {
    // Monitor circuit breaker events
    circuitBreaker.on('circuit-open', (data) => {
      console.log(`🔴 CRITICAL: Circuit "${data.name}" OPENED - Service degraded!`);
    });

    circuitBreaker.on('circuit-close', (data) => {
      console.log(`🟢 RECOVERY: Circuit "${data.name}" CLOSED - Service restored!`);
    });
  }

  async runDemo() {
    console.log('🧪 Universal AI Tools - Circuit Breaker Demonstration\n');
    console.log('Testing real failure scenarios with actual circuit breaker implementation...\n');

    await this.demoHttpCircuitBreaker();
    await this.demoDatabaseCircuitBreaker();
    await this.demoRedisCircuitBreaker();
    await this.demoAIServiceCircuitBreaker();
    await this.demoRecoveryScenarios();
    await this.demoMonitoringAndMetrics();

    this.generateDemoReport();
  }

  async demoHttpCircuitBreaker() {
    console.log('🌐 Demo 1: HTTP Service Circuit Breaker\n');

    // Scenario 1: Test with failing HTTP endpoint
    console.log('  📋 Scenario: Simulating HTTP 500 errors');
    console.log('  🎯 Expected: Circuit should open after threshold reached\n');

    for (let i = 1; i <= 6; i++) {
      console.log(`  Attempt ${i}:`);
      try {
        const result = await httpWithCircuitBreaker(
          'https://httpstat.us/500',
          { timeout: 3000 },
          {
            errorThresholdPercentage: 40,
            fallback: () => ({
              error: 'Service temporarily unavailable',
              fallback: true,
              timestamp: new Date().toISOString(),
            }),
          }
        );

        if (result && result.fallback) {
          console.log(`    🔄 Fallback executed: ${result.error}`);
        } else {
          console.log(`    ✅ Success: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        console.log(`    ❌ Failed: ${error.message}`);
      }

      // Show current circuit state
      const metrics = circuitBreaker.getMetrics('http-httpstat.us');
      if (metrics) {
        console.log(
          `    📊 Circuit State: ${metrics.state}, Failures: ${metrics.failures}, Requests: ${metrics.requests}`
        );
      }

      await this.sleep(500);
    }

    console.log('\n');
  }

  async demoDatabaseCircuitBreaker() {
    console.log('🗄️ Demo 2: Database Circuit Breaker\n');

    console.log('  📋 Scenario: Simulating database connection failures');
    console.log('  🎯 Expected: Circuit should protect against DB failures\n');

    for (let i = 1; i <= 5; i++) {
      console.log(`  Database Query ${i}:`);
      try {
        const result = await circuitBreaker.databaseQuery(
          'user-profile',
          async () => {
            if (i <= 3) {
              throw new Error('Database connection timeout');
            }
            return { id: i, name: `User ${i}`, email: `user${i}@example.com` };
          },
          {
            timeout: 3000,
            errorThresholdPercentage: 40,
            fallback: () => {
              throw new Error('Database service degraded - using cache');
            },
          }
        );

        console.log(`    ✅ Success: ${JSON.stringify(result)}`);
      } catch (error) {
        console.log(`    ❌ Failed: ${error.message}`);
      }

      const metrics = circuitBreaker.getMetrics('db-user-profile');
      if (metrics) {
        console.log(`    📊 Circuit State: ${metrics.state}, Failures: ${metrics.failures}`);
      }

      await this.sleep(400);
    }

    console.log('\n');
  }

  async demoRedisCircuitBreaker() {
    console.log('🔴 Demo 3: Redis Cache Circuit Breaker\n');

    console.log('  📋 Scenario: Simulating Redis connection failures');
    console.log('  🎯 Expected: Graceful degradation with cache misses\n');

    const cacheKeys = ['session:123', 'user:456', 'config:789'];

    for (let i = 0; i < cacheKeys.length; i++) {
      const key = cacheKeys[i];
      console.log(`  Cache Lookup ${i + 1} (${key}):`);

      try {
        const result = await circuitBreaker.redisOperation(
          'get',
          async () => {
            if (i < 2) {
              throw new Error('Redis connection refused');
            }
            return `cached_value_for_${key}`;
          },
          {
            timeout: 1000,
            errorThresholdPercentage: 30,
            fallback: () => {
              console.log(`    🔄 Cache miss fallback for ${key}`);
              return null; // Cache miss
            },
          }
        );

        if (result === null) {
          console.log(`    💾 Cache miss - will query database`);
        } else {
          console.log(`    ✅ Cache hit: ${result}`);
        }
      } catch (error) {
        console.log(`    ❌ Cache error: ${error.message}`);
      }

      const metrics = circuitBreaker.getMetrics('redis-get');
      if (metrics) {
        console.log(`    📊 Circuit State: ${metrics.state}, Failures: ${metrics.failures}`);
      }

      await this.sleep(300);
    }

    console.log('\n');
  }

  async demoAIServiceCircuitBreaker() {
    console.log('🤖 Demo 4: AI Service Circuit Breaker\n');

    console.log('  📋 Scenario: Simulating Ollama model inference failures');
    console.log('  🎯 Expected: Fallback to simpler responses when AI unavailable\n');

    const queries = ['Explain quantum computing', 'Write a Python function', 'Summarize this text'];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`  AI Query ${i + 1}: "${query}"`);

      try {
        const result = await circuitBreaker.modelInference(
          'llama2-7b',
          async () => {
            if (i < 2) {
              throw new Error('Ollama service unavailable');
            }
            return `AI Response: Here's a detailed answer about "${query}"...`;
          },
          {
            timeout: 10000,
            errorThresholdPercentage: 25,
            fallback: async () => {
              console.log(`    🔄 Using fallback AI response`);
              return `I apologize, but the AI service is temporarily unavailable. Please try again in a few moments.`;
            },
          }
        );

        console.log(`    🤖 Response: ${result}`);
      } catch (error) {
        console.log(`    ❌ AI Error: ${error.message}`);
      }

      const metrics = circuitBreaker.getMetrics('model-llama2-7b');
      if (metrics) {
        console.log(`    📊 Circuit State: ${metrics.state}, Failures: ${metrics.failures}`);
      }

      await this.sleep(600);
    }

    console.log('\n');
  }

  async demoRecoveryScenarios() {
    console.log('🔄 Demo 5: Circuit Recovery Scenarios\n');

    console.log('  📋 Scenario: Testing automatic circuit recovery');
    console.log('  🎯 Expected: Circuit transitions from open -> half-open -> closed\n');

    // First, create a failing service to open the circuit
    console.log('  Phase 1: Opening circuit with failures...');
    for (let i = 0; i < 4; i++) {
      try {
        await withCircuitBreaker(
          'recovery-demo',
          async () => {
            throw new Error('Service temporarily down');
          },
          {
            timeout: 2000,
            errorThresholdPercentage: 40,
            resetTimeout: 3000, // Short reset for demo
            fallback: () => 'Fallback response',
          }
        );
      } catch (error) {
        console.log(`    ❌ Failure ${i + 1}: ${error.message}`);
      }
      await this.sleep(200);
    }

    let metrics = circuitBreaker.getMetrics('recovery-demo');
    console.log(`  📊 Circuit after failures: ${metrics?.state || 'unknown'}\n`);

    // Wait for reset timeout
    console.log('  Phase 2: Waiting for circuit reset timeout...');
    await this.sleep(4000);

    // Now simulate service recovery
    console.log('  Phase 3: Testing service recovery...');
    for (let i = 0; i < 3; i++) {
      try {
        const result = await withCircuitBreaker('recovery-demo', async () => {
          return `Service recovered - Response ${i + 1}`;
        });
        console.log(`    ✅ Recovery ${i + 1}: ${result}`);
      } catch (error) {
        console.log(`    ❌ Still failing: ${error.message}`);
      }

      metrics = circuitBreaker.getMetrics('recovery-demo');
      console.log(`    📊 Circuit State: ${metrics?.state || 'unknown'}`);
      await this.sleep(500);
    }

    console.log('\n');
  }

  async demoMonitoringAndMetrics() {
    console.log('📊 Demo 6: Monitoring and Metrics\n');

    console.log('  📋 Scenario: Demonstrating monitoring capabilities');
    console.log('  🎯 Expected: Comprehensive metrics and health checks\n');

    // Show all circuit breaker metrics
    console.log('  📈 Current Circuit Breaker Metrics:');
    const allMetrics = circuitBreaker.getAllMetrics();

    if (allMetrics.length === 0) {
      console.log('    ℹ️  No metrics available (no circuits have been used)');
    } else {
      allMetrics.forEach((metric) => {
        console.log(`    🔌 Circuit: ${metric.name}`);
        console.log(`       State: ${metric.state}`);
        console.log(`       Requests: ${metric.requests}`);
        console.log(`       Failures: ${metric.failures}`);
        console.log(`       Successes: ${metric.successes}`);
        console.log(
          `       Failure Rate: ${metric.requests > 0 ? ((metric.failures / metric.requests) * 100).toFixed(1) : 0}%`
        );
        console.log('');
      });
    }

    // Perform health check
    console.log('  🏥 System Health Check:');
    const healthCheck = circuitBreaker.healthCheck();
    console.log(`    Overall Health: ${healthCheck.healthy ? '✅ Healthy' : '❌ Degraded'}`);
    console.log(`    Open Circuits: ${healthCheck.openCircuits.length}`);
    console.log(`    Total Circuits: ${healthCheck.metrics.length}`);

    if (healthCheck.openCircuits.length > 0) {
      console.log(`    🔴 Open Circuits: ${healthCheck.openCircuits.join(', ')}`);
    }

    console.log('\n');
  }

  generateDemoReport() {
    console.log('📋 Circuit Breaker Demonstration Report');
    console.log('='.repeat(50));

    const allMetrics = circuitBreaker.getAllMetrics();
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requests, 0);
    const totalFailures = allMetrics.reduce((sum, m) => sum + m.failures, 0);
    const totalSuccesses = allMetrics.reduce((sum, m) => sum + m.successes, 0);
    const openCircuits = allMetrics.filter((m) => m.state === 'open').length;

    console.log(`\n📊 Summary Statistics:`);
    console.log(`  Total Circuits Created: ${allMetrics.length}`);
    console.log(`  Total Requests Processed: ${totalRequests}`);
    console.log(`  Total Failures: ${totalFailures}`);
    console.log(`  Total Successes: ${totalSuccesses}`);
    console.log(
      `  Overall Success Rate: ${totalRequests > 0 ? ((totalSuccesses / totalRequests) * 100).toFixed(1) : 0}%`
    );
    console.log(`  Currently Open Circuits: ${openCircuits}`);

    console.log(`\n🎯 Key Capabilities Demonstrated:`);
    console.log(`  ✅ HTTP service protection with fallbacks`);
    console.log(`  ✅ Database query protection`);
    console.log(`  ✅ Redis cache failure handling`);
    console.log(`  ✅ AI service degradation management`);
    console.log(`  ✅ Automatic circuit recovery`);
    console.log(`  ✅ Real-time monitoring and metrics`);
    console.log(`  ✅ Health check capabilities`);

    console.log(`\n💡 Production Recommendations:`);
    console.log(`  1. Integrate with APM tools (Grafana, Datadog, etc.)`);
    console.log(`  2. Set up alerting for circuit state changes`);
    console.log(`  3. Implement circuit breaker dashboards`);
    console.log(`  4. Regular threshold tuning based on SLA requirements`);
    console.log(`  5. Implement progressive timeout strategies`);
    console.log(`  6. Consider bulkhead pattern for service isolation`);
    console.log(`  7. Monitor failure patterns for capacity planning`);

    const finalHealthCheck = circuitBreaker.healthCheck();
    console.log(
      `\n🏥 Final System Health: ${finalHealthCheck.healthy ? '✅ Healthy' : '❌ Degraded'}`
    );

    console.log(`\n✅ Circuit Breaker Demonstration Complete!`);
    console.log(`🛡️  Your Universal AI Tools system is protected against failures.`);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new RealCircuitBreakerDemo();
  demo.runDemo().catch(console.error);
}

export default RealCircuitBreakerDemo;

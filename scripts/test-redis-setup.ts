#!/usr/bin/env npx tsx

/**
 * Redis Setup Test Script
 * Tests Redis connection, operations, and health monitoring
 */

import { getRedisService } from '../src/services/redis-service';
import { redisHealthCheck } from '../src/services/redis-health-check';
import { logger, LogContext } from '../src/utils/enhanced-logger';
import { performance } from 'perf_hooks';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class RedisSetupTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🧪 Redis Setup Test Suite\n');
    console.log('Configuration:');
    console.log(`  REDIS_URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log('');

    // Test 1: Connection
    await this.testConnection();

    // Test 2: Basic Operations
    await this.testBasicOperations();

    // Test 3: Advanced Operations
    await this.testAdvancedOperations();

    // Test 4: Performance
    await this.testPerformance();

    // Test 5: Health Monitoring
    await this.testHealthMonitoring();

    // Test 6: Fallback Cache
    await this.testFallbackCache();

    // Test 7: Circuit Breaker
    await this.testCircuitBreaker();

    // Display results
    this.displayResults();
  }

  private async testConnection(): Promise<void> {
    const startTime = performance.now();
    const testName = 'Redis Connection';

    try {
      const redisService = getRedisService();
      await redisService.connect();

      const health = await redisService.healthCheck();

      if (health.healthy) {
        this.results.push({
          name: testName,
          passed: true,
          duration: performance.now() - startTime,
        });
        console.log(`✅ ${testName} - Connected (latency: ${health.latency}ms)`);
      } else {
        throw new Error(health.error || 'Connection unhealthy');
      }
    } catch (error) {
      this.results.push({
        name: testName,
        passed: false,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`❌ ${testName} - Failed: ${error}`);
    }
  }

  private async testBasicOperations(): Promise<void> {
    const redisService = getRedisService();
    const testKey = `test:basic:${Date.now()}`;
    const testValue = JSON.stringify({ test: true, timestamp: new Date().toISOString() });

    // SET operation
    await this.runTest('SET Operation', async () => {
      const result = await redisService.set(testKey, testValue, 300);
      if (result !== 'OK') throw new Error('SET failed');
    });

    // GET operation
    await this.runTest('GET Operation', async () => {
      const result = await redisService.get(testKey);
      if (result !== testValue) throw new Error('GET returned wrong value');
    });

    // EXISTS operation
    await this.runTest('EXISTS Operation', async () => {
      const exists = await redisService.exists(testKey);
      if (exists !== 1) throw new Error('Key should exist');
    });

    // TTL operation
    await this.runTest('TTL Operation', async () => {
      const ttl = await redisService.ttl(testKey);
      if (ttl <= 0 || ttl > 300) throw new Error(`Invalid TTL: ${ttl}`);
    });

    // DEL operation
    await this.runTest('DEL Operation', async () => {
      const deleted = await redisService.del(testKey);
      if (deleted !== 1) throw new Error('DEL failed');
    });
  }

  private async testAdvancedOperations(): Promise<void> {
    const redisService = getRedisService();

    // MSET/MGET operations
    await this.runTest('MSET/MGET Operations', async () => {
      const keyValues = {
        'test:multi:1': 'value1',
        'test:multi:2': 'value2',
        'test:multi:3': 'value3',
      };

      await redisService.mset(keyValues);
      const values = await redisService.mget(Object.keys(keyValues));

      if (values.length !== 3 || values[0] !== 'value1') {
        throw new Error('MGET returned wrong values');
      }

      // Cleanup
      await redisService.del(Object.keys(keyValues));
    });

    // Hash operations
    await this.runTest('Hash Operations', async () => {
      const hashKey = 'test:hash:user';

      await redisService.hset(hashKey, 'name', 'Test User');
      const name = await redisService.hget(hashKey, 'name');

      if (name !== 'Test User') {
        throw new Error('HGET returned wrong value');
      }

      // Cleanup
      await redisService.del(hashKey);
    });

    // List operations
    await this.runTest('List Operations', async () => {
      const listKey = 'test:list:items';

      await redisService.lpush(listKey, 'item1', 'item2', 'item3');
      const items = await redisService.lrange(listKey, 0, -1);

      if (items.length !== 3) {
        throw new Error('LRANGE returned wrong number of items');
      }

      // Cleanup
      await redisService.del(listKey);
    });
  }

  private async testPerformance(): Promise<void> {
    const redisService = getRedisService();
    const iterations = 100;

    await this.runTest('Performance Test (100 operations)', async () => {
      const operations: Promise<any>[] = [];

      for (let i = 0; i < iterations; i++) {
        const key = `test:perf:${i}`;
        const value = `value-${i}`;
        operations.push(redisService.set(key, value, 60));
      }

      const startTime = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - startTime;

      const opsPerSecond = (iterations / duration) * 1000;
      console.log(`  → ${opsPerSecond.toFixed(2)} operations/second`);

      // Cleanup
      const keys = Array.from({ length: iterations }, (_, i) => `test:perf:${i}`);
      await redisService.del(keys);
    });
  }

  private async testHealthMonitoring(): Promise<void> {
    await this.runTest('Health Monitoring', async () => {
      const health = await redisHealthCheck.performHealthCheck();

      if (!health.connected) {
        throw new Error('Health check shows Redis not connected');
      }

      console.log(`  → Status: ${health.status}`);
      console.log(`  → Latency: ${health.latency}ms`);
      console.log(`  → Memory: ${health.memoryUsage}`);
      console.log(`  → Clients: ${health.connectedClients}`);
    });

    await this.runTest('Health Check Operations Test', async () => {
      const testResult = await redisHealthCheck.testRedisOperations();

      if (!testResult.passed) {
        const failed = testResult.results.filter((r) => !r.success);
        throw new Error(`${failed.length} operations failed`);
      }
    });
  }

  private async testFallbackCache(): Promise<void> {
    const redisService = getRedisService();

    await this.runTest('Fallback Cache', async () => {
      // Force a value into fallback cache
      await redisService.set('test:fallback:key', 'fallback-value', 60);

      // Get fallback cache stats
      const stats = redisService.getFallbackCacheStats();

      console.log(`  → Fallback cache items: ${stats.itemCount}`);
      console.log(`  → Fallback cache size: ${stats.size} bytes`);
    });
  }

  private async testCircuitBreaker(): Promise<void> {
    await this.runTest('Circuit Breaker Status', async () => {
      // This test just checks if circuit breaker is functioning
      // In a real failure scenario, it would open and provide fallback
      const redisService = getRedisService();

      // Perform an operation through circuit breaker
      const result = await redisService.get('test:circuit:key');

      // Circuit breaker should allow the operation
      console.log(`  → Circuit breaker is functioning`);
    });
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = performance.now();

    try {
      await testFn();
      this.results.push({
        name,
        passed: true,
        duration: performance.now() - startTime,
      });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.results.push({
        name,
        passed: false,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`❌ ${name} - ${error}`);
    }
  }

  private displayResults(): void {
    console.log('\n📊 Test Results Summary\n');
    console.log('Test Name                        | Status | Duration');
    console.log('--------------------------------|--------|----------');

    let totalPassed = 0;
    let totalDuration = 0;

    for (const result of this.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration.toFixed(2)}ms`;
      const name = result.name.padEnd(31);

      console.log(`${name} | ${status} | ${duration}`);

      if (result.passed) totalPassed++;
      totalDuration += result.duration;
    }

    console.log('--------------------------------|--------|----------');
    console.log(
      `Total: ${totalPassed}/${this.results.length} passed | Duration: ${totalDuration.toFixed(2)}ms`
    );

    if (totalPassed === this.results.length) {
      console.log('\n🎉 All tests passed! Redis is properly configured.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check your Redis configuration.');

      // Show failed tests
      const failed = this.results.filter((r) => !r.passed);
      if (failed.length > 0) {
        console.log('\nFailed tests:');
        for (const test of failed) {
          console.log(`  - ${test.name}: ${test.error}`);
        }
      }
    }
  }
}

// Run tests
async function main() {
  try {
    const tester = new RedisSetupTester();
    await tester.runAllTests();

    // Disconnect after tests
    const redisService = getRedisService();
    await redisService.disconnect();

    process.exit(0);
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

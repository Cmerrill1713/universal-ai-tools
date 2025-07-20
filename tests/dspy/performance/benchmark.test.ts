import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DSPyService } from '../../../src/services/dspy-service';
import { EnhancedOrchestrator } from '../../../src/agents/enhanced_orchestrator';
import { UniversalAgentRegistry } from '../../../src/agents/universal_agent_registry';
import { logger } from '../../../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

interface BenchmarkResult {
  testName: string;
  oldSystem: {
    avgTime: number;
    minTime: number;
    maxTime: number;
    successRate: number;
    memoryUsage: number;
  };
  newSystem: {
    avgTime: number;
    minTime: number;
    maxTime: number;
    successRate: number;
    memoryUsage: number;
  };
  improvement: {
    speedup: number;
    memoryReduction: number;
    successRateChange: number;
  };
}

describe('DSPy Performance Benchmarks', () => {
  let dspyService: DSPyService;
  let oldOrchestrator: EnhancedOrchestrator;
  let benchmarkResults: BenchmarkResult[] = [];
  const ITERATIONS = 10; // Number of iterations per test
  const WARMUP_ITERATIONS = 3; // Warmup iterations to stabilize performance

  beforeAll(async () => {
    logger.info('🏁 Starting performance benchmarks...');
    
    // Initialize services
    dspyService = new DSPyService();
    oldOrchestrator = new EnhancedOrchestrator({
      supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
      supabaseKey: process.env.SUPABASE_SERVICE_KEY || 'test-key',
      enableMLX: false,
      enableAdaptiveTools: false,
      enableCaching: false
    });
    
    // Ensure services are ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run warmup iterations
    await runWarmup();
  });

  afterAll(async () => {
    // Generate benchmark report
    await generateBenchmarkReport();
    
    // Cleanup
    await dspyService.shutdown();
  });

  async function runWarmup(): Promise<void> {
    logger.info('Running warmup iterations...');
    
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      await dspyService.orchestrate({
        requestId: uuidv4(),
        userRequest: 'Warmup request',
        userId: 'warmup',
        timestamp: new Date()
      });
      
      await oldOrchestrator.processRequest({
        requestId: uuidv4(),
        userRequest: 'Warmup request',
        userId: 'warmup',
        timestamp: new Date()
      });
    }
  }

  async function measurePerformance(
    name: string,
    oldSystemFn: () => Promise<any>,
    newSystemFn: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const oldMetrics = {
      times: [] as number[],
      successes: 0,
      memoryUsages: [] as number[]
    };
    
    const newMetrics = {
      times: [] as number[],
      successes: 0,
      memoryUsages: [] as number[]
    };

    // Measure old system
    for (let i = 0; i < ITERATIONS; i++) {
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      try {
        await oldSystemFn();
        oldMetrics.successes++;
      } catch (error) {
        logger.error(`Old system error in ${name}:`, error);
      }
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      oldMetrics.times.push(endTime - startTime);
      oldMetrics.memoryUsages.push(endMemory - startMemory);
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Measure new system
    for (let i = 0; i < ITERATIONS; i++) {
      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();
      
      try {
        await newSystemFn();
        newMetrics.successes++;
      } catch (error) {
        logger.error(`New system error in ${name}:`, error);
      }
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      newMetrics.times.push(endTime - startTime);
      newMetrics.memoryUsages.push(endMemory - startMemory);
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate statistics
    const oldStats = calculateStats(oldMetrics);
    const newStats = calculateStats(newMetrics);

    const result: BenchmarkResult = {
      testName: name,
      oldSystem: oldStats,
      newSystem: newStats,
      improvement: {
        speedup: oldStats.avgTime / newStats.avgTime,
        memoryReduction: (oldStats.memoryUsage - newStats.memoryUsage) / oldStats.memoryUsage * 100,
        successRateChange: newStats.successRate - oldStats.successRate
      }
    };

    benchmarkResults.push(result);
    return result;
  }

  function calculateStats(metrics: {
    times: number[];
    successes: number;
    memoryUsages: number[];
  }) {
    const times = metrics.times.sort((a, b) => a - b);
    const memoryUsages = metrics.memoryUsages;

    return {
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: times[0] || 0,
      maxTime: times[times.length - 1] || 0,
      successRate: metrics.successes / ITERATIONS * 100,
      memoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
    };
  }

  describe('Simple Request Orchestration', () => {
    it('should benchmark simple orchestration requests', async () => {
      const result = await measurePerformance(
        'Simple Orchestration',
        async () => {
          await oldOrchestrator.processRequest({
            requestId: uuidv4(),
            userRequest: 'What is the weather today?',
            userId: 'benchmark-user',
            timestamp: new Date()
          });
        },
        async () => {
          await dspyService.orchestrate({
            requestId: uuidv4(),
            userRequest: 'What is the weather today?',
            userId: 'benchmark-user',
            orchestrationMode: 'simple',
            timestamp: new Date()
          });
        }
      );

      logger.info(`Simple orchestration speedup: ${result.improvement.speedup.toFixed(2)}x`);
      
      expect(result.newSystem.successRate).toBeGreaterThanOrEqual(result.oldSystem.successRate);
      expect(result.improvement.speedup).toBeGreaterThan(0.8); // At least 80% of old performance
    });
  });

  describe('Complex Multi-Agent Coordination', () => {
    it('should benchmark complex agent coordination', async () => {
      const complexRequest = `
        Create a comprehensive data analysis system that:
        1. Reads data from multiple CSV files
        2. Performs statistical analysis
        3. Generates visualizations
        4. Creates a report with insights
        5. Implements caching for performance
      `;

      const result = await measurePerformance(
        'Complex Agent Coordination',
        async () => {
          await oldOrchestrator.orchestrate(complexRequest, 'benchmark-user');
        },
        async () => {
          await dspyService.orchestrate({
            requestId: uuidv4(),
            userRequest: complexRequest,
            userId: 'benchmark-user',
            orchestrationMode: 'cognitive',
            timestamp: new Date()
          });
        }
      );

      logger.info(`Complex coordination speedup: ${result.improvement.speedup.toFixed(2)}x`);
      
      expect(result.newSystem.successRate).toBeGreaterThanOrEqual(95);
      expect(result.improvement.speedup).toBeGreaterThan(1.0); // Should be faster than old system
    });
  });

  describe('Knowledge Search Performance', () => {
    it('should benchmark knowledge search operations', async () => {
      const searchQueries = [
        'TypeScript async await patterns',
        'Machine learning optimization techniques',
        'Docker container best practices',
        'React performance optimization',
        'PostgreSQL query optimization'
      ];

      const result = await measurePerformance(
        'Knowledge Search',
        async () => {
          // Old system doesn't have direct knowledge search, simulate with orchestration
          for (const query of searchQueries) {
            await oldOrchestrator.orchestrate(
              `Search for information about: ${query}`,
              'benchmark-user'
            );
          }
        },
        async () => {
          for (const query of searchQueries) {
            await dspyService.searchKnowledge(query, { limit: 10 });
          }
        }
      );

      logger.info(`Knowledge search speedup: ${result.improvement.speedup.toFixed(2)}x`);
      
      expect(result.improvement.speedup).toBeGreaterThan(1.5); // Should be significantly faster
      expect(result.newSystem.successRate).toBe(100);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should benchmark concurrent request performance', async () => {
      const concurrentRequests = 5;
      
      const result = await measurePerformance(
        'Concurrent Requests',
        async () => {
          const promises = Array.from({ length: concurrentRequests }, (_, i) =>
            oldOrchestrator.orchestrate(
              `Concurrent request ${i}`,
              `user-${i}`
            )
          );
          await Promise.all(promises);
        },
        async () => {
          const promises = Array.from({ length: concurrentRequests }, (_, i) =>
            dspyService.orchestrate({
              requestId: uuidv4(),
              userRequest: `Concurrent request ${i}`,
              userId: `user-${i}`,
              timestamp: new Date()
            })
          );
          await Promise.all(promises);
        }
      );

      logger.info(`Concurrent handling speedup: ${result.improvement.speedup.toFixed(2)}x`);
      
      expect(result.newSystem.successRate).toBeGreaterThanOrEqual(result.oldSystem.successRate);
      expect(result.improvement.speedup).toBeGreaterThan(1.2); // Should handle concurrency better
    });
  });

  describe('Memory Efficiency', () => {
    it('should benchmark memory usage for large contexts', async () => {
      const largeContext = {
        data: Array(1000).fill(0).map((_, i) => ({
          id: i,
          content: 'x'.repeat(1000),
          metadata: { tags: ['tag1', 'tag2', 'tag3'] }
        })),
        history: Array(100).fill('Previous interaction')
      };

      const result = await measurePerformance(
        'Large Context Handling',
        async () => {
          await oldOrchestrator.orchestrate(
            'Process this large dataset',
            'benchmark-user',
            { context: largeContext }
          );
        },
        async () => {
          await dspyService.orchestrate({
            requestId: uuidv4(),
            userRequest: 'Process this large dataset',
            userId: 'benchmark-user',
            context: largeContext,
            timestamp: new Date()
          });
        }
      );

      logger.info(`Memory efficiency improvement: ${result.improvement.memoryReduction.toFixed(2)}%`);
      
      expect(result.improvement.memoryReduction).toBeGreaterThan(0); // Should use less memory
    });
  });

  describe('Adaptive Mode Performance', () => {
    it('should benchmark adaptive orchestration mode', async () => {
      const adaptiveRequests = [
        'Simple: What time is it?',
        'Medium: Explain quantum computing',
        'Complex: Design a microservices architecture for an e-commerce platform',
        'Simple: Hello',
        'Complex: Implement a distributed caching system with Redis'
      ];

      const result = await measurePerformance(
        'Adaptive Mode',
        async () => {
          for (const request of adaptiveRequests) {
            await oldOrchestrator.orchestrate(request, 'benchmark-user');
          }
        },
        async () => {
          for (const request of adaptiveRequests) {
            await dspyService.orchestrate({
              requestId: uuidv4(),
              userRequest: request,
              userId: 'benchmark-user',
              orchestrationMode: 'adaptive',
              timestamp: new Date()
            });
          }
        }
      );

      logger.info(`Adaptive mode speedup: ${result.improvement.speedup.toFixed(2)}x`);
      
      expect(result.improvement.speedup).toBeGreaterThan(1.3); // Adaptive should be more efficient
    });
  });

  describe('Error Recovery Performance', () => {
    it('should benchmark error handling and recovery', async () => {
      const problematicRequests = [
        { request: 'Normal request', shouldFail: false },
        { request: '', shouldFail: true }, // Empty request
        { request: 'Another normal request', shouldFail: false },
        { request: '🔥'.repeat(1000), shouldFail: true }, // Unusual input
        { request: 'Final normal request', shouldFail: false }
      ];

      const result = await measurePerformance(
        'Error Recovery',
        async () => {
          for (const { request } of problematicRequests) {
            try {
              await oldOrchestrator.orchestrate(request, 'benchmark-user');
            } catch (error) {
              // Expected for some requests
            }
          }
        },
        async () => {
          for (const { request } of problematicRequests) {
            await dspyService.orchestrate({
              requestId: uuidv4(),
              userRequest: request,
              userId: 'benchmark-user',
              timestamp: new Date()
            });
          }
        }
      );

      logger.info(`Error recovery speedup: ${result.improvement.speedup.toFixed(2)}x`);
      
      // New system should handle errors more gracefully
      expect(result.newSystem.successRate).toBeGreaterThanOrEqual(60); // At least 3/5 should succeed
    });
  });

  async function generateBenchmarkReport(): Promise<void> {
    const reportPath = path.join(
      process.cwd(),
      'tests',
      'dspy',
      'performance',
      `benchmark-report-${new Date().toISOString().split('T')[0]}.json`
    );

    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: benchmarkResults.length,
      averageSpeedup: benchmarkResults.reduce((sum, r) => sum + r.improvement.speedup, 0) / benchmarkResults.length,
      averageMemoryReduction: benchmarkResults.reduce((sum, r) => sum + r.improvement.memoryReduction, 0) / benchmarkResults.length,
      results: benchmarkResults,
      systemInfo: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      }
    };

    await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
    
    logger.info(`\n📊 Benchmark Summary:`);
    logger.info(`Total Tests: ${summary.totalTests}`);
    logger.info(`Average Speedup: ${summary.averageSpeedup.toFixed(2)}x`);
    logger.info(`Average Memory Reduction: ${summary.averageMemoryReduction.toFixed(2)}%`);
    logger.info(`Report saved to: ${reportPath}`);
    
    // Log individual test results
    logger.info('\n📈 Individual Test Results:');
    benchmarkResults.forEach(result => {
      logger.info(`\n${result.testName}:`);
      logger.info(`  Speedup: ${result.improvement.speedup.toFixed(2)}x`);
      logger.info(`  Memory Reduction: ${result.improvement.memoryReduction.toFixed(2)}%`);
      logger.info(`  Success Rate Change: ${result.improvement.successRateChange.toFixed(2)}%`);
      logger.info(`  Old Avg Time: ${result.oldSystem.avgTime.toFixed(2)}ms`);
      logger.info(`  New Avg Time: ${result.newSystem.avgTime.toFixed(2)}ms`);
    });
  }
});
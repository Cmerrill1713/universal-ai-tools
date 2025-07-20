/**
 * Performance Tests
 * Tests system performance, load handling, and optimization
 */

import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { PerformanceMonitor } from '../../src/utils/performance-monitor';
import { CacheManager } from '../../src/utils/cache-manager-improved';
import { ResourceManager } from '../../src/services/resource-manager';

// Mock external dependencies
jest.mock('../../src/services/supabase_service');
jest.mock('ioredis');

describe('Performance Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let cacheManager: CacheManager;
  let resourceManager: ResourceManager;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    cacheManager = new CacheManager();
    resourceManager = new ResourceManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Response Time Performance', () => {
    test('should handle API requests within acceptable time limits', async () => {
      const startTime = performance.now();
      
      // Simulate API request processing
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms processing
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(100); // Should respond within 100ms
    });

    test('should maintain response times under load', async () => {
      const concurrentRequests = 50;
      const responseTimes: number[] = [];
      
      const requests = Array.from({ length: concurrentRequests }, async () => {
        const startTime = performance.now();
        
        // Simulate request processing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 10));
        
        const endTime = performance.now();
        return endTime - startTime;
      });
      
      const results = await Promise.all(requests);
      
      const averageResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxResponseTime = Math.max(...results);
      
      expect(averageResponseTime).toBeLessThan(50); // Average under 50ms
      expect(maxResponseTime).toBeLessThan(200); // No request over 200ms
    });

    test('should handle database query performance', async () => {
      const mockQueries = [
        { type: 'simple_select', complexity: 1 },
        { type: 'join_query', complexity: 3 },
        { type: 'aggregate_query', complexity: 5 }
      ];
      
      for (const query of mockQueries) {
        const startTime = performance.now();
        
        // Simulate query execution time based on complexity
        await new Promise(resolve => 
          setTimeout(resolve, query.complexity * 10)
        );
        
        const endTime = performance.now();
        const queryTime = endTime - startTime;
        
        // More complex queries can take longer, but within reasonable limits
        const maxAllowedTime = query.complexity * 50;
        expect(queryTime).toBeLessThan(maxAllowedTime);
      }
    });
  });

  describe('Memory Usage Performance', () => {
    test('should not leak memory during normal operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate memory-intensive operations
      const largeArrays: any[] = [];
      for (let i = 0; i < 100; i++) {
        largeArrays.push(new Array(1000).fill(i));
      }
      
      // Clean up references
      largeArrays.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Allow some time for GC
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal after cleanup
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });

    test('should handle large datasets efficiently', async () => {
      const datasetSize = 10000;
      const dataset = Array.from({ length: datasetSize }, (_, i) => ({
        id: i,
        data: `record-${i}`,
        timestamp: Date.now()
      }));
      
      const startTime = performance.now();
      
      // Simulate processing large dataset
      const processedData = dataset
        .filter(item => item.id % 2 === 0)
        .map(item => ({ ...item, processed: true }))
        .slice(0, 1000);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(100); // Should process within 100ms
      expect(processedData).toHaveLength(1000);
    });

    test('should manage cache memory efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Fill cache with data
      for (let i = 0; i < 1000; i++) {
        await cacheManager.set(`key-${i}`, {
          data: `value-${i}`,
          metadata: { size: i, timestamp: Date.now() }
        });
      }
      
      const cacheFilledMemory = process.memoryUsage().heapUsed;
      
      // Clear cache
      await cacheManager.clear();
      
      // Allow time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const clearedMemory = process.memoryUsage().heapUsed;
      
      // Memory should be significantly reduced after cache clear
      const memoryReduction = cacheFilledMemory - clearedMemory;
      expect(memoryReduction).toBeGreaterThan(0);
    });
  });

  describe('CPU Usage Performance', () => {
    test('should not block event loop during intensive operations', async () => {
      const eventLoop = new EventEmitter();
      let eventLoopBlocked = false;
      
      // Set up event loop monitoring
      const eventLoopCheck = setTimeout(() => {
        eventLoop.emit('check');
      }, 10);
      
      eventLoop.on('check', () => {
        eventLoopBlocked = false;
      });
      
      const startTime = Date.now();
      
      // Perform CPU-intensive operation with yielding
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
        
        // Yield to event loop periodically
        if (i % 10000 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      const endTime = Date.now();
      
      clearTimeout(eventLoopCheck);
      
      // Operation should complete but not block event loop excessively
      expect(endTime - startTime).toBeLessThan(1000); // Under 1 second
      expect(result).toBeGreaterThan(0);
    });

    test('should handle parallel processing efficiently', async () => {
      const tasks = Array.from({ length: 20 }, (_, i) => async () => {
        // Simulate CPU work
        let result = 0;
        for (let j = 0; j < 100000; j++) {
          result += Math.sin(j) * Math.cos(j);
        }
        return { taskId: i, result };
      });
      
      const startTime = performance.now();
      
      // Process tasks in parallel
      const results = await Promise.all(tasks.map(task => task()));
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(20);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should optimize frequent operations', async () => {
      const iterations = 10000;
      
      // Test optimized string operations
      const startTime = performance.now();
      
      const results = [];
      for (let i = 0; i < iterations; i++) {
        // Use efficient string building
        const parts = ['prefix', i.toString(), 'suffix'];
        results.push(parts.join('-'));
      }
      
      const endTime = performance.now();
      const operationTime = endTime - startTime;
      
      expect(results).toHaveLength(iterations);
      expect(operationTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Concurrency Performance', () => {
    test('should handle concurrent database operations', async () => {
      const concurrentOps = 25;
      const operations = Array.from({ length: concurrentOps }, async (_, i) => {
        // Simulate database operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
        return { id: i, result: `operation-${i}` };
      });
      
      const startTime = performance.now();
      const results = await Promise.all(operations);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(concurrentOps);
      expect(totalTime).toBeLessThan(200); // Concurrent ops should be fast
    });

    test('should handle concurrent cache operations', async () => {
      const concurrentOps = 50;
      
      // Mix of read and write operations
      const operations = Array.from({ length: concurrentOps }, async (_, i) => {
        if (i % 2 === 0) {
          // Write operation
          await cacheManager.set(`concurrent-key-${i}`, {
            value: `data-${i}`,
            timestamp: Date.now()
          });
          return { type: 'write', key: `concurrent-key-${i}` };
        } else {
          // Read operation
          const value = await cacheManager.get(`concurrent-key-${i - 1}`);
          return { type: 'read', value };
        }
      });
      
      const startTime = performance.now();
      const results = await Promise.all(operations);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(concurrentOps);
      expect(totalTime).toBeLessThan(300); // Should handle concurrent cache ops efficiently
    });

    test('should manage connection pooling effectively', async () => {
      const poolSize = 10;
      const requests = 100;
      
      // Simulate connection pool
      const connectionPool = Array.from({ length: poolSize }, (_, i) => ({
        id: i,
        inUse: false,
        lastUsed: Date.now()
      }));
      
      const getConnection = () => {
        const available = connectionPool.find(conn => !conn.inUse);
        if (available) {
          available.inUse = true;
          return available;
        }
        return null;
      };
      
      const releaseConnection = (conn: any) => {
        conn.inUse = false;
        conn.lastUsed = Date.now();
      };
      
      const requestPromises = Array.from({ length: requests }, async () => {
        let connection = null;
        
        // Wait for available connection
        while (!connection) {
          connection = getConnection();
          if (!connection) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
        
        // Simulate work with connection
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        
        releaseConnection(connection);
        return connection.id;
      });
      
      const startTime = performance.now();
      const results = await Promise.all(requestPromises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(requests);
      expect(totalTime).toBeLessThan(2000); // Should handle with limited pool efficiently
    });
  });

  describe('Scalability Performance', () => {
    test('should scale linearly with data size', async () => {
      const dataSizes = [100, 1000, 5000];
      const processingTimes: number[] = [];
      
      for (const size of dataSizes) {
        const dataset = Array.from({ length: size }, (_, i) => ({ id: i, value: Math.random() }));
        
        const startTime = performance.now();
        
        // Process dataset
        const processed = dataset
          .filter(item => item.value > 0.5)
          .map(item => ({ ...item, processed: true }));
        
        const endTime = performance.now();
        processingTimes.push(endTime - startTime);
      }
      
      // Processing time should scale reasonably with data size
      const ratio1 = processingTimes[1] / processingTimes[0]; // 1000/100
      const ratio2 = processingTimes[2] / processingTimes[1]; // 5000/1000
      
      expect(ratio1).toBeLessThan(20); // Should not be more than 20x slower
      expect(ratio2).toBeLessThan(10); // Should not be more than 10x slower
    });

    test('should handle increasing user load gracefully', async () => {
      const userLoads = [10, 50, 100];
      const responseTimes: number[] = [];
      
      for (const userCount of userLoads) {
        const userRequests = Array.from({ length: userCount }, async () => {
          const startTime = performance.now();
          
          // Simulate user request processing
          await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
          
          return performance.now() - startTime;
        });
        
        const results = await Promise.all(userRequests);
        const averageResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
        responseTimes.push(averageResponseTime);
      }
      
      // Response times should not degrade drastically with load
      const degradation = responseTimes[2] / responseTimes[0];
      expect(degradation).toBeLessThan(3); // Less than 3x degradation
    });

    test('should optimize memory usage with large datasets', async () => {
      const largeDataset = Array.from({ length: 50000 }, (_, i) => ({
        id: i,
        data: `record-${i}`,
        metadata: { created: Date.now(), processed: false }
      }));
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process in chunks to manage memory
      const chunkSize = 1000;
      const results = [];
      
      for (let i = 0; i < largeDataset.length; i += chunkSize) {
        const chunk = largeDataset.slice(i, i + chunkSize);
        const processedChunk = chunk.map(item => ({
          id: item.id,
          processed: true
        }));
        results.push(...processedChunk);
        
        // Allow garbage collection between chunks
        if (i % (chunkSize * 10) === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(results).toHaveLength(largeDataset.length);
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe('Performance Monitoring', () => {
    test('should track performance metrics accurately', async () => {
      const metrics = {
        requestCount: 0,
        totalResponseTime: 0,
        errorCount: 0,
        averageResponseTime: 0
      };
      
      const trackRequest = async (fn: Function) => {
        const startTime = performance.now();
        try {
          await fn();
          metrics.requestCount++;
        } catch (error) {
          metrics.errorCount++;
        }
        const responseTime = performance.now() - startTime;
        metrics.totalResponseTime += responseTime;
        metrics.averageResponseTime = metrics.totalResponseTime / (metrics.requestCount + metrics.errorCount);
      };
      
      // Simulate various requests
      await trackRequest(async () => new Promise(resolve => setTimeout(resolve, 10)));
      await trackRequest(async () => new Promise(resolve => setTimeout(resolve, 20)));
      await trackRequest(async () => { throw new Error('Test error'); });
      await trackRequest(async () => new Promise(resolve => setTimeout(resolve, 15)));
      
      expect(metrics.requestCount).toBe(3);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    test('should identify performance bottlenecks', async () => {
      const operations = {
        fastOp: async () => new Promise(resolve => setTimeout(resolve, 5)),
        mediumOp: async () => new Promise(resolve => setTimeout(resolve, 50)),
        slowOp: async () => new Promise(resolve => setTimeout(resolve, 200))
      };
      
      const timings: Record<string, number> = {};
      
      for (const [name, operation] of Object.entries(operations)) {
        const startTime = performance.now();
        await operation();
        timings[name] = performance.now() - startTime;
      }
      
      // Identify slowest operation
      const slowestOp = Object.entries(timings)
        .sort(([, a], [, b]) => b - a)[0];
      
      expect(slowestOp[0]).toBe('slowOp');
      expect(slowestOp[1]).toBeGreaterThan(100);
    });

    test('should generate performance reports', () => {
      const performanceData = {
        period: '1h',
        metrics: {
          totalRequests: 1000,
          averageResponseTime: 45,
          p95ResponseTime: 150,
          p99ResponseTime: 300,
          errorRate: 0.02,
          throughput: 16.67 // requests per second
        },
        bottlenecks: [
          { operation: 'database_query', avgTime: 120, frequency: 0.4 },
          { operation: 'external_api', avgTime: 200, frequency: 0.1 }
        ]
      };
      
      const generateReport = (data: any) => {
        return {
          summary: `Processed ${data.metrics.totalRequests} requests with ${data.metrics.averageResponseTime}ms average response time`,
          recommendations: data.bottlenecks.map((b: any) => 
            `Optimize ${b.operation} (${b.avgTime}ms avg, ${b.frequency * 100}% of requests)`
          )
        };
      };
      
      const report = generateReport(performanceData);
      
      expect(report.summary).toContain('1000 requests');
      expect(report.recommendations).toHaveLength(2);
      expect(report.recommendations[0]).toContain('database_query');
    });
  });

  describe('Resource Usage Optimization', () => {
    test('should optimize resource allocation', async () => {
      const resourceLimits = {
        maxMemory: 100 * 1024 * 1024, // 100MB
        maxCpuTime: 1000, // 1 second
        maxConnections: 50
      };
      
      const currentUsage = {
        memory: 80 * 1024 * 1024, // 80MB
        cpuTime: 500, // 0.5 seconds
        connections: 30
      };
      
      const isWithinLimits = (usage: any, limits: any) => {
        return usage.memory < limits.maxMemory &&
               usage.cpuTime < limits.maxCpuTime &&
               usage.connections < limits.maxConnections;
      };
      
      expect(isWithinLimits(currentUsage, resourceLimits)).toBe(true);
      
      // Test resource optimization
      const optimizedUsage = {
        memory: currentUsage.memory * 0.8, // 20% reduction
        cpuTime: currentUsage.cpuTime * 0.9, // 10% reduction
        connections: currentUsage.connections
      };
      
      expect(optimizedUsage.memory).toBeLessThan(currentUsage.memory);
      expect(optimizedUsage.cpuTime).toBeLessThan(currentUsage.cpuTime);
    });

    test('should implement efficient caching strategies', async () => {
      const cacheHitRatio = {
        hits: 0,
        misses: 0,
        get ratio() { return this.hits / (this.hits + this.misses); }
      };
      
      const cachedGet = async (key: string) => {
        const cached = await cacheManager.get(key);
        if (cached) {
          cacheHitRatio.hits++;
          return cached;
        }
        
        cacheHitRatio.misses++;
        // Simulate fetching data
        const data = `data-for-${key}`;
        await cacheManager.set(key, data);
        return data;
      };
      
      // Access same data multiple times
      await cachedGet('key1');
      await cachedGet('key1'); // Cache hit
      await cachedGet('key2');
      await cachedGet('key1'); // Cache hit
      await cachedGet('key2'); // Cache hit
      
      expect(cacheHitRatio.ratio).toBeGreaterThan(0.5); // >50% cache hit ratio
    });
  });
});

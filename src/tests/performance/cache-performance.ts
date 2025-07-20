import Redis from 'ioredis';
import { performance } from 'perf_hooks';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface CacheMetrics {
  operation: 'get' | 'set' | 'del' | 'exists' | 'expire' | 'scan';
  executionTime: number;
  keySize: number;
  valueSize: number;
  hit: boolean;
  success: boolean;
  error?: string;
  timestamp: number;
  concurrentOperations: number;
}

export interface CachePerformanceResult {
  metrics: CacheMetrics[];
  aggregatedMetrics: {
    totalOperations: number;
    hitRate: number;
    averageResponseTime: number;
    operationsPerSecond: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    cacheEfficiency: number;
  };
  memoryUsage: {
    used: number;
    peak: number;
    keyCount: number;
    averageKeySize: number;
    averageValueSize: number;
  };
  evictionMetrics: {
    evictedKeys: number;
    evictionRate: number;
    memoryPressure: number;
  };
  testDuration: number;
}

export class CachePerformanceTester extends EventEmitter {
  private redis: Redis;
  private metrics: CacheMetrics[] = [];
  private activeOperations = 0;
  private isRunning = false;
  private testKeyPrefix = 'perf_test:';

  constructor(redisConfig?: any) {
    super();
    this.redis = new Redis(redisConfig || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
  }

  public async runPerformanceTest(options: {
    duration: number; // seconds
    concurrentOperations: number;
    operationMix: {
      get: number;
      set: number;
      del: number;
      exists: number;
    };
    dataSize: 'small' | 'medium' | 'large';
    keyCount: number;
  }): Promise<CachePerformanceResult> {
    
    logger.info('Starting cache performance test...', options);
    this.isRunning = true;
    this.metrics = [];
    const startTime = performance.now();

    try {
      // Setup test data
      await this.setupTestData(options.keyCount, options.dataSize);

      // Run concurrent operations
      const testPromises: Promise<void>[] = [];
      
      for (let i = 0; i < options.concurrentOperations; i++) {
        const testPromise = this.runConcurrentOperations(
          options.duration * 1000,
          options.operationMix,
          options.dataSize,
          options.keyCount
        );
        testPromises.push(testPromise);
      }

      await Promise.all(testPromises);

      const endTime = performance.now();
      const testDuration = (endTime - startTime) / 1000;

      // Get memory usage
      const memoryUsage = await this.getMemoryUsage();
      
      // Get eviction metrics
      const evictionMetrics = await this.getEvictionMetrics();

      // Calculate aggregated metrics
      const aggregatedMetrics = this.calculateAggregatedMetrics(testDuration);

      const result: CachePerformanceResult = {
        metrics: this.metrics,
        aggregatedMetrics,
        memoryUsage,
        evictionMetrics,
        testDuration
      };

      logger.info('Cache performance test completed', {
        duration: testDuration,
        totalOperations: result.aggregatedMetrics.totalOperations,
        hitRate: result.aggregatedMetrics.hitRate
      });

      this.emit('test-completed', result);
      return result;

    } catch (error) {
      logger.error('Cache performance test failed:', error);
      this.emit('test-failed', error);
      throw error;
    } finally {
      this.isRunning = false;
      await this.cleanupTestData();
    }
  }

  private async setupTestData(keyCount: number, dataSize: 'small' | 'medium' | 'large'): Promise<void> {
    logger.info(`Setting up cache test data with ${keyCount} keys...`);

    const dataSizes = {
      small: 100,    // 100 bytes
      medium: 1024,  // 1KB
      large: 10240   // 10KB
    };

    const valueSize = dataSizes[dataSize];
    const batchSize = 1000;
    const batches = Math.ceil(keyCount / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const pipeline = this.redis.pipeline();
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, keyCount);

      for (let i = startIdx; i < endIdx; i++) {
        const key = `${this.testKeyPrefix}key_${i}`;
        const value = this.generateTestData(valueSize, i);
        pipeline.set(key, value);
        
        // Set expiration for some keys to test eviction
        if (i % 10 === 0) {
          pipeline.expire(key, 3600); // 1 hour
        }
      }

      await pipeline.exec();
    }

    logger.info(`Cache test data setup completed with ${keyCount} keys`);
  }

  private generateTestData(size: number, seed: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = `test_data_${seed}_`;
    
    while (result.length < size) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result.substring(0, size);
  }

  private async runConcurrentOperations(
    duration: number,
    operationMix: { get: number; set: number; del: number; exists: number },
    dataSize: 'small' | 'medium' | 'large',
    keyCount: number
  ): Promise<void> {
    const endTime = Date.now() + duration;
    const operations = this.buildOperationArray(operationMix);

    while (Date.now() < endTime && this.isRunning) {
      const operation = operations[Math.floor(Math.random() * operations.length)];
      
      try {
        await this.executeOperation(operation, dataSize, keyCount);
      } catch (error) {
        // Error already logged in executeOperation
      }

      // Small delay to avoid overwhelming Redis
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    }
  }

  private buildOperationArray(operationMix: { get: number; set: number; del: number; exists: number }): string[] {
    const operations: string[] = [];
    
    // Build weighted array based on operation mix percentages
    Object.entries(operationMix).forEach(([operation, percentage]) => {
      for (let i = 0; i < percentage; i++) {
        operations.push(operation);
      }
    });

    return operations;
  }

  private async executeOperation(
    operation: string,
    dataSize: 'small' | 'medium' | 'large',
    keyCount: number
  ): Promise<void> {
    const startTime = performance.now();
    this.activeOperations++;

    try {
      let result: any;
      let hit = false;
      let keySize = 0;
      let valueSize = 0;

      const randomKeyId = Math.floor(Math.random() * keyCount);
      const key = `${this.testKeyPrefix}key_${randomKeyId}`;
      keySize = Buffer.byteLength(key, 'utf8');

      switch (operation) {
        case 'get':
          result = await this.redis.get(key);
          hit = result !== null;
          valueSize = result ? Buffer.byteLength(result, 'utf8') : 0;
          break;

        case 'set':
          const dataSizes = { small: 100, medium: 1024, large: 10240 };
          const value = this.generateTestData(dataSizes[dataSize], randomKeyId);
          valueSize = Buffer.byteLength(value, 'utf8');
          result = await this.redis.set(key, value);
          hit = false; // Set operations don't have hits
          break;

        case 'del':
          result = await this.redis.del(key);
          hit = result === 1;
          break;

        case 'exists':
          result = await this.redis.exists(key);
          hit = result === 1;
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const endTime = performance.now();
      
      const metrics: CacheMetrics = {
        operation: operation as any,
        executionTime: endTime - startTime,
        keySize,
        valueSize,
        hit,
        success: true,
        timestamp: Date.now(),
        concurrentOperations: this.activeOperations
      };

      this.metrics.push(metrics);
      this.emit('operation-completed', metrics);

    } catch (error) {
      const endTime = performance.now();

      const metrics: CacheMetrics = {
        operation: operation as any,
        executionTime: endTime - startTime,
        keySize: 0,
        valueSize: 0,
        hit: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
        concurrentOperations: this.activeOperations
      };

      this.metrics.push(metrics);
      this.emit('operation-failed', metrics);

    } finally {
      this.activeOperations--;
    }
  }

  private async getMemoryUsage(): Promise<{
    used: number;
    peak: number;
    keyCount: number;
    averageKeySize: number;
    averageValueSize: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      // Parse memory info
      const memoryUsed = this.parseInfoValue(info, 'used_memory');
      const memoryPeak = this.parseInfoValue(info, 'used_memory_peak');
      
      // Calculate average sizes from our metrics
      const setOperations = this.metrics.filter(m => m.operation === 'set' && m.success);
      const averageKeySize = setOperations.length > 0 ? 
        setOperations.reduce((sum, m) => sum + m.keySize, 0) / setOperations.length : 0;
      const averageValueSize = setOperations.length > 0 ?
        setOperations.reduce((sum, m) => sum + m.valueSize, 0) / setOperations.length : 0;

      return {
        used: memoryUsed,
        peak: memoryPeak,
        keyCount,
        averageKeySize,
        averageValueSize
      };
    } catch (error) {
      logger.error('Failed to get memory usage:', error);
      return {
        used: 0,
        peak: 0,
        keyCount: 0,
        averageKeySize: 0,
        averageValueSize: 0
      };
    }
  }

  private async getEvictionMetrics(): Promise<{
    evictedKeys: number;
    evictionRate: number;
    memoryPressure: number;
  }> {
    try {
      const info = await this.redis.info('stats');
      const evictedKeys = this.parseInfoValue(info, 'evicted_keys');
      
      // Calculate eviction rate (evictions per operation)
      const evictionRate = this.metrics.length > 0 ? evictedKeys / this.metrics.length : 0;
      
      // Memory pressure approximation
      const memoryInfo = await this.redis.info('memory');
      const usedMemory = this.parseInfoValue(memoryInfo, 'used_memory');
      const maxMemory = this.parseInfoValue(memoryInfo, 'maxmemory');
      const memoryPressure = maxMemory > 0 ? (usedMemory / maxMemory) * 100 : 0;

      return {
        evictedKeys,
        evictionRate,
        memoryPressure
      };
    } catch (error) {
      logger.error('Failed to get eviction metrics:', error);
      return {
        evictedKeys: 0,
        evictionRate: 0,
        memoryPressure: 0
      };
    }
  }

  private parseInfoValue(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1], 10) : 0;
  }

  private calculateAggregatedMetrics(testDuration: number) {
    const successfulOps = this.metrics.filter(m => m.success);
    const getOperations = successfulOps.filter(m => m.operation === 'get');
    const responseTimes = successfulOps.map(m => m.executionTime);
    
    responseTimes.sort((a, b) => a - b);

    const hitRate = getOperations.length > 0 ? 
      (getOperations.filter(op => op.hit).length / getOperations.length) * 100 : 0;

    const totalDataTransferred = successfulOps.reduce((sum, m) => sum + m.keySize + m.valueSize, 0);
    const cacheEfficiency = totalDataTransferred / this.metrics.length; // bytes per operation

    return {
      totalOperations: this.metrics.length,
      hitRate,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0,
      operationsPerSecond: this.metrics.length / testDuration,
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      errorRate: ((this.metrics.length - successfulOps.length) / this.metrics.length) * 100 || 0,
      cacheEfficiency
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  private async cleanupTestData(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.testKeyPrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      logger.info(`Cleaned up ${keys.length} test keys`);
    } catch (error) {
      logger.error('Failed to cleanup test data:', error);
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.emit('test-stopped');
  }

  public async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

// Cache consistency test under load
export async function testCacheConsistency(redis: Redis, options: {
  duration: number;
  concurrentWriters: number;
  concurrentReaders: number;
}): Promise<{
  consistencyErrors: number;
  totalOperations: number;
  consistencyRate: number;
}> {
  const testKey = 'consistency_test_key';
  const expectedValue = 'consistent_value';
  let totalOperations = 0;
  let consistencyErrors = 0;
  let isRunning = true;

  // Set initial value
  await redis.set(testKey, expectedValue);

  const writerPromises: Promise<void>[] = [];
  const readerPromises: Promise<void>[] = [];

  // Start writers
  for (let i = 0; i < options.concurrentWriters; i++) {
    writerPromises.push(
      (async () => {
        const endTime = Date.now() + options.duration * 1000;
        while (Date.now() < endTime && isRunning) {
          await redis.set(testKey, expectedValue);
          totalOperations++;
          await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        }
      })()
    );
  }

  // Start readers
  for (let i = 0; i < options.concurrentReaders; i++) {
    readerPromises.push(
      (async () => {
        const endTime = Date.now() + options.duration * 1000;
        while (Date.now() < endTime && isRunning) {
          const value = await redis.get(testKey);
          totalOperations++;
          if (value !== expectedValue && value !== null) {
            consistencyErrors++;
          }
          await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
        }
      })()
    );
  }

  await Promise.all([...writerPromises, ...readerPromises]);
  isRunning = false;

  // Cleanup
  await redis.del(testKey);

  const consistencyRate = totalOperations > 0 ? 
    ((totalOperations - consistencyErrors) / totalOperations) * 100 : 100;

  return {
    consistencyErrors,
    totalOperations,
    consistencyRate
  };
}
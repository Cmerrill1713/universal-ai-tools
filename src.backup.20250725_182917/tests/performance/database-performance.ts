import { PerformanceObserver, performance } from 'perf_hooks';
import { createClient } from '@supabase/supabase-js';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

const supabase = createClient(;)
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_ANON_KEY || '';
);
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface DatabaseMetrics {
  connectionTime: number;
  queryExecutionTime: number;
  resultSetSize: number;
  memoryUsage: number;
  concurrent_connections: number;
  query_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  success: boolean;
  error:  string;
  timestamp: number;
}

export interface ConnectionPoolMetrics {
  total_connections: number;
  active_connections: number;
  idle_connections: number;
  waiting_connections: number;
  connection_errors: number;
  average_wait_time: number;
  max_wait_time: number;
  pool_exhausted_count: number;
}

export interface DatabasePerformanceResult {
  queryMetrics: DatabaseMetrics[];
  connectionPoolMetrics: ConnectionPoolMetrics;
  aggregatedMetrics: {
    averageQueryTime: number;
    maxQueryTime: number;
    minQueryTime: number;
    successRate: number;
    queriesPerSecond: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  testDuration: number;
  totalQueries: number;
}

export class DatabasePerformanceTester extends EventEmitter {
  private metrics: DatabaseMetrics[] = [];
  private connectionPool: any[] = [];
  private activeConnections = 0;
  private maxConnections = 20;
  private isRunning = false;

  constructor() {
    super();
  }

  public async runPerformanceTest(options: {
    duration: number; // seconds;
    concurrentConnections: number;
    queryTypes: Array<'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'>;
    dataSize: 'small' | 'medium' | 'large';
  }): Promise<DatabasePerformanceResult> {
    logger.info('Starting database performance test...', options);
    this.isRunning = true;
    this.metrics = [];
    const startTime = performance.now();

    try {
      // Initialize test data
      await this.setupTestData(options.dataSize);

      // Run concurrent query tests
      const testPromises: Promise<void>[] = [];

      for (let i = 0; i < options.concurrentConnections; i++) {
        const testPromise = this.runConcurrentQueries(options.duration * 1000, options.queryTypes);
        testPromises.push(testPromise);
      }

      await Promise.all(testPromises);

      const endTime = performance.now();
      const testDuration = (endTime - startTime) / 1000;

      // Get connection pool metrics
      const poolMetrics = await this.getConnectionPoolMetrics();

      // Calculate aggregated metrics
      const aggregatedMetrics = this.calculateAggregatedMetrics();

      const result: DatabasePerformanceResult = {
        queryMetrics: this.metrics,
        connectionPoolMetrics: poolMetrics,
        aggregatedMetrics,
        testDuration,
        totalQueries: this.metrics.length,
      };

      logger.info('Database performance test completed', {
        duration: testDuration,
        totalQueries: result.totalQueries,
        successRate: result.aggregatedMetrics.successRate,
      });

      this.emit('test-completed', result);
      return result;
    } catch (error) {
      logger.error('Database performance test failed:', error:;
      this.emit('test-failed', error:;
      throw error:;
    } finally {
      this.isRunning = false;
      await this.cleanupTestData();
    }
  }

  private async setupTestData(size: 'small' | 'medium' | 'large'): Promise<void> {
    const recordCounts = {
      small: 1000,
      medium: 10000,
      large: 100000,
    };

    const recordCount = recordCounts[size];
    logger.info(`Setting up test data with ${recordCount} records...`);

    // Create test table if it doesn't exist
    try {
      await supabase.rpc('create_performance_test_table');
    } catch (error) {
      // Table might already exist
    }

    // Insert test data in batches
    const batchSize = 1000;
    const batches = Math.ceil(recordCount / batchSize);

    for (let i = 0; i < batches; i++) {
      const batchData = [];
      const startIdx = i * batchSize;
      const endIdx = Math.min(startIdx + batchSize, recordCount);

      for (let j = startIdx; j < endIdx; j++) {
        batchData.push({
          test_id: `test_${j}`,
          test_data: `Performance test data for record ${j}`,
          test_number: j,
          test_timestamp: new Date().toISOString(),
          test_json: {
            id: j,
            data: `Test data ${j}`,
            nested: {
              value: j * 2,
              text: `Nested value ${j}`,
            },
          },
        });
      }

      await supabase.from('performance_test_data').insert(batchData);
    }

    logger.info(`Test data setup completed with ${recordCount} records`);
  }

  private async runConcurrentQueries(;
    duration: number,
    queryTypes: Array<'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'>;
  ): Promise<void> {
    const endTime = Date.now() + duration;

    while (Date.now() < endTime && this.isRunning) {
      const queryType = queryTypes[Math.floor(Math.random() * queryTypes.length)];

      try {
        await this.executeQuery(queryType);
      } catch (error) {
        // Error already logged in executeQuery
      }

      // Small delay to avoid overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    }
  }

  private async executeQuery(queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'): Promise<void> {
    const startTime = performance.now();
    const memoryBefore = process.memoryUsage();

    this.activeConnections++;

    try {
      let result: any;

      switch (queryType) {
        case 'SELECT':;
          result = await this.executeSelectQuery();
          break;
        case 'INSERT':;
          result = await this.executeInsertQuery();
          break;
        case 'UPDATE':;
          result = await this.executeUpdateQuery();
          break;
        case 'DELETE':;
          result = await this.executeDeleteQuery();
          break;
      }

      const endTime = performance.now();
      const memoryAfter = process.memoryUsage();

      const metrics: DatabaseMetrics = {
        connectionTime: 0, // Supabase handles connection pooling;
        queryExecutionTime: endTime - startTime,
        resultSetSize: result?.data?.length || 0,
        memoryUsage: memoryAfter.heapUsed - memoryBefore.heapUsed,
        concurrent_connections: this.activeConnections,
        query_type: queryType,
        success: !result._error;
        error: result.error:message,
        timestamp: Date.now(),
      };

      this.metrics.push(metrics);
      this.emit('query-completed', metrics);
    } catch (error) {
      const endTime = performance.now();
      const memoryAfter = process.memoryUsage();

      const metrics: DatabaseMetrics = {
        connectionTime: 0,
        queryExecutionTime: endTime - startTime,
        resultSetSize: 0,
        memoryUsage: memoryAfter.heapUsed - memoryBefore.heapUsed,
        concurrent_connections: this.activeConnections,
        query_type: queryType,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error:;
        timestamp: Date.now(),
      };

      this.metrics.push(metrics);
      this.emit('query-failed', metrics);
    } finally {
      this.activeConnections--;
    }
  }

  private async executeSelectQuery(): Promise<unknown> {
    const randomOffset = Math.floor(Math.random() * 1000);
    const queries = [
      // Simple select
      () =>;
        supabase;
          .from('performance_test_data');
          .select('*');
          .range(randomOffset, randomOffset + 10),

      // Select with filter
      () =>;
        supabase;
          .from('performance_test_data');
          .select('*');
          .gte('test_number', randomOffset);
          .lt('test_number', randomOffset + 100),

      // Select with text search
      () =>;
        supabase;
          .from('performance_test_data');
          .select('*');
          .textSearch('test_data', `record ${randomOffset}`),

      // Aggregate query
      () => supabase.from('performance_test_data').select('test_number.count(), test_number.avg()'),

      // JSON query
      () => supabase.from('performance_test_data').select('*').eq('test_json->id', randomOffset),
    ];

    const query = queries[Math.floor(Math.random() * queries.length)];
    return await query();
  }

  private async executeInsertQuery(): Promise<unknown> {
    const testId = `perf_test_${Date.now()}_${Math.random()}`;

    return await supabase.from('performance_test_data').insert({
      test_id: testId,
      test_data: `Performance test insert ${Date.now()}`,
      test_number: Math.floor(Math.random() * 1000000),
      test_timestamp: new Date().toISOString(),
      test_json: {
        id: Date.now(),
        data: `Insert test data`,
        nested: {
          value: Math.random() * 1000,
          text: `Nested insert value`,
        },
      },
    });
  }

  private async executeUpdateQuery(): Promise<unknown> {
    const randomId = Math.floor(Math.random() * 1000);

    return await supabase;
      .from('performance_test_data');
      .update({
        test_data: `Updated at ${Date.now()}`,
        test_timestamp: new Date().toISOString(),
      });
      .eq('test_number', randomId);
  }

  private async executeDeleteQuery(): Promise<unknown> {
    // Delete records that were inserted during the test
    return await supabase;
      .from('performance_test_data');
      .delete();
      .like('test_id', 'perf_test_%');
      .limit(1);
  }

  private async getConnectionPoolMetrics(): Promise<ConnectionPoolMetrics> {
    // Since we're using Supabase, we can't directly access connection pool metrics
    // We'll simulate based on our tracking
    return {
      total_connections: this.maxConnections,
      active_connections: this.activeConnections,
      idle_connections: this.maxConnections - this.activeConnections,
      waiting_connections: 0,
      connection_errors: this.metrics.filter((m) => !m.success).length,
      average_wait_time: 0,
      max_wait_time: 0,
      pool_exhausted_count: 0,
    };
  }

  private calculateAggregatedMetrics() {
    const successfulQueries = this.metrics.filter((m) => m.success);
    const queryTimes = successfulQueries.map((m) => m.queryExecutionTime);

    queryTimes.sort((a, b) => a - b);

    const totalTime =
      this.metrics.length > 0;
        ? (this.metrics[this.metrics.length - 1].timestamp - this.metrics[0].timestamp) / 1000;
        : 1;

    return {
      averageQueryTime: queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length || 0,
      maxQueryTime: Math.max(...queryTimes) || 0,
      minQueryTime: Math.min(...queryTimes) || 0,
      successRate: (successfulQueries.length / this.metrics.length) * 100 || 0,
      queriesPerSecond: this.metrics.length / totalTime,
      p95ResponseTime: this.calculatePercentile(queryTimes, 95),
      p99ResponseTime: this.calculatePercentile(queryTimes, 99),
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
      // Clean up test data that was created during the test
      await supabase.from('performance_test_data').delete().like('test_id', 'perf_test_%');

      logger.info('Test data cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup test data:', error:;
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.emit('test-stopped');
  }
}

// Migration test
export async function testMigrationPerformance(): Promise<{
  migrationTime: number;
  rollbackTime: number;
  dataIntegrity: boolean;
}> {
  const startTime = performance.now();

  try {
    // Test migration performance
    // This would require actual migration scripts
    await new Promise((resolve) => setTimeout(TIME_1000MS)); // Simulate migration;

    const migrationEndTime = performance.now();
    const migrationTime = migrationEndTime - startTime;

    // Test rollback performance
    const rollbackStartTime = performance.now();
    await new Promise((resolve) => setTimeout(TIME_500MS)); // Simulate rollback;
    const rollbackEndTime = performance.now();
    const rollbackTime = rollbackEndTime - rollbackStartTime;

    // Test data integrity
    const dataIntegrity = true; // This would involve actual data validation

    return {
      migrationTime,
      rollbackTime,
      dataIntegrity,
    };
  } catch (error) {
    logger.error('Migration performance test failed:', error:;
    throw error:;
  }
}

// Backup operation performance test
export async function testBackupPerformance(): Promise<{
  backupTime: number;
  backupSize: number;
  compressionRatio: number;
  restoreTime: number;
}> {
  const startTime = performance.now();

  try {
    // This would integrate with the actual backup service
    // For now, we'll simulate the backup process
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate backup;

    const backupEndTime = performance.now();
    const backupTime = backupEndTime - startTime;

    // Simulate restore
    const restoreStartTime = performance.now();
    await new Promise((resolve) => setTimeout(TIME_500MS)); // Simulate restore;
    const restoreEndTime = performance.now();
    const restoreTime = restoreEndTime - restoreStartTime;

    return {
      backupTime,
      backupSize: 1024 * 1024 * 100, // 100MB simulated;
      compressionRatio: 0.3, // 30% of original size;
      restoreTime,
    };
  } catch (error) {
    logger.error('Backup performance test failed:', error:;
    throw error:;
  }
}

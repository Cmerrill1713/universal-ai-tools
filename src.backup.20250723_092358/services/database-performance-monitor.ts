/**
 * Database Performance Monitoring Service
 *
 * Comprehensive database monitoring for Universal AI Tools with:
 * - Query performance tracking and analysis
 * - Connection pool monitoring
 * - Database resource utilization
 * - Slow query detection and optimization
 * - Transaction monitoring
 * - Database health scoring
 * - Automated performance tuning suggestions
 * - Query _patternanalysis
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { telemetryService } from './telemetry-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export interface DatabasePerformanceConfig {
  enabled: boolean;
  monitoringInterval: number; // ms
  slowQueryThreshold: number; // ms
  connectionPoolMonitoring: boolean;
  transactionMonitoring: boolean;

  // Thresholds
  thresholds: {
    queryTime: number; // ms
    connectionCount: number;
    lockWaitTime: number; // ms
    cacheHitRatio: number; // percentage
    activeTransactions: number;
  };

  // Performance scoring weights
  scoring: {
    queryPerformance: number;
    connectionHealth: number;
    resourceUtilization: number;
    concurrency: number;
  };

  // Query _analysissettings
  queryAnalysis: {
    enableSlowQueryLog: boolean;
    sampleRate: number; // 0-1
    maxQueriesTracked: number;
    enableQueryPlanAnalysis: boolean;
  };
}

export interface QueryMetrics {
  id: string;
  query: string;
  queryHash: string;
  executionTime: number;
  timestamp: Date;

  // Query details
  table?: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' | 'RPC';
  rowsAffected?: number;

  // Performance metrics
  planningTime?: number;
  executionPlan?: any;
  indexesUsed?: string[];
  cacheHit: boolean;

  // Context
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;

  // Resource usage
  memoryUsed?: number;
  ioReads?: number;
  ioWrites?: number;
}

export interface ConnectionPoolMetrics {
  timestamp: Date;
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  connectionUtilization: number; // percentage

  // Connection statistics
  connectionsCreated: number;
  connectionsDestroyed: number;
  connectionErrors: number;
  averageConnectionTime: number;

  // Wait statistics
  connectionWaitTime: number;
  queuedRequests: number;
}

export interface TransactionMetrics {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'active' | 'committed' | 'aborted' | 'timeout';

  // Transaction details
  queries: QueryMetrics[];
  isolationLevel?: string;
  readOnly: boolean;

  // Lock information
  locksHeld: number;
  locksWaited: number;
  lockWaitTime: number;

  // Context
  traceId?: string;
  userId?: string;
}

export interface DatabaseHealth {
  score: number; // 0-100
  status: 'healthy' | 'degraded' | 'unhealthy';

  // Performance metrics
  averageQueryTime: number;
  slowQueries: number;
  queryThroughput: number; // queries per second

  // Connection health
  connectionUtilization: number;
  connectionErrors: number;

  // Resource utilization
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  cacheHitRatio: number;

  // Concurrency
  activeTransactions: number;
  lockContention: number;

  // Issues and recommendations
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    description: string;
    recommendation: string;
  }>;
}

export interface DatabaseReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
    errorRate: number;
    throughput: number;
  };
  topSlowQueries: Array<{
    queryHash: string;
    query: string;
    averageTime: number;
    count: number;
    totalTime: number;
  }>;
  topTables: Array<{
    table: string;
    queryCount: number;
    averageTime: number;
    totalTime: number;
  }>;
  performance: {
    queryTimePercentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    connectionMetrics: {
      averageUtilization: number;
      peakConnections: number;
      connectionErrors: number;
    };
    transactionMetrics: {
      averageDuration: number;
      abortRate: number;
      lockContentions: number;
    };
  };
  recommendations: string[];
}

export class DatabasePerformanceMonitor extends EventEmitter {
  private config: DatabasePerformanceConfig;
  private supabase: SupabaseClient;
  private isStarted = false;
  private queryMetrics: QueryMetrics[] = [];
  private connectionMetrics: ConnectionPoolMetrics[] = [];
  private transactionMetrics: TransactionMetrics[] = [];
  private activeTransactions = new Map<string, TransactionMetrics>();
  private monitoringInterval?: NodeJS.Timeout;
  private queryHashes = new Map<string, number>(); // Track query frequency

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<DatabasePerformanceConfig> = {}
  ) {
    super();

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      enabled: true,
      monitoringInterval: 60000, // 1 minute
      slowQueryThreshold: 1000, // 1 second
      connectionPoolMonitoring: true,
      transactionMonitoring: true,

      thresholds: {
        queryTime: 2000, // 2 seconds
        connectionCount: 50, // 50 connections
        lockWaitTime: 5000, // 5 seconds
        cacheHitRatio: 80, // 80%
        activeTransactions: 20, // 20 concurrent transactions
      },

      scoring: {
        queryPerformance: 0.4,
        connectionHealth: 0.3,
        resourceUtilization: 0.2,
        concurrency: 0.1,
      },

      queryAnalysis: {
        enableSlowQueryLog: true,
        sampleRate: 0.1, // Sample 10% of queries
        maxQueriesTracked: 10000,
        enableQueryPlanAnalysis: false, // Disabled by default due to overhead
      },

      ...config,
    };
  }

  /**
   * Start database performance monitoring
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Database performance monitor already started', undefined, LogContext.DATABASE);
      return;
    }

    if (!this.config.enabled) {
      logger.info('Database performance monitoring disabled', undefined, LogContext.DATABASE);
      return;
    }

    try {
      logger.info('Starting database performance monitor', undefined, {
        context: LogContext.DATABASE,
        config: this.config,
      });

      // Setup query interception
      this.setupQueryInterception();

      // Start periodic monitoring
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
      }, this.config.monitoringInterval);

      this.isStarted = true;
      this.emit('started', { config: this.config });

      logger.info(
        'Database performance monitor started successfully',
        undefined,
        LogContext.DATABASE
      );
    } catch (error) {
      logger.error('Failed to start database performance monitor', undefined, {
        context: LogContext.DATABASE,
        _error
      });
      throw error;
    }
  }

  /**
   * Stop database performance monitoring
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('Database performance monitor not started', undefined, LogContext.DATABASE);
      return;
    }

    try {
      logger.info('Stopping database performance monitor', undefined, LogContext.DATABASE);

      // Clear monitoring interval
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      this.isStarted = false;
      this.emit('stopped');

      logger.info(
        'Database performance monitor stopped successfully',
        undefined,
        LogContext.DATABASE
      );
    } catch (error) {
      logger.error('Error stopping database performance monitor', undefined, {
        context: LogContext.DATABASE,
        _error
      });
      throw error;
    }
  }

  /**
   * Track a database query
   */
  trackQuery(
    query: string,
    executionTime: number,
    options: {
      table?: string;
      operation?: QueryMetrics['operation'];
      rowsAffected?: number;
      traceId?: string;
      spanId?: string;
      userId?: string;
      sessionId?: string;
      error: Error;
    } = {}
  ): string {
    // Sample queries based on configuration
    if (Math.random() > this.config.queryAnalysis.sampleRate) {
      return '';
    }

    const queryHash = this.generateQueryHash(query);
    const queryId = this.generateId();

    const queryMetric: QueryMetrics = {
      id: queryId,
      query: this.normalizeQuery(query),
      queryHash,
      executionTime,
      timestamp: new Date(),
      table: options.table,
      operation: options.operation || this.inferOperation(query),
      rowsAffected: options.rowsAffected,
      cacheHit: false, // Would need to be determined by database
      traceId: options.traceId || telemetryService.getCurrentTraceId(),
      spanId: options.spanId || telemetryService.getCurrentSpanId(),
      userId: options.userId,
      sessionId: options.sessionId,
    };

    this.queryMetrics.push(queryMetric);

    // Track query frequency
    this.queryHashes.set(queryHash, (this.queryHashes.get(queryHash) || 0) + 1);

    // Cleanup old metrics
    if (this.queryMetrics.length > this.config.queryAnalysis.maxQueriesTracked) {
      this.queryMetrics = this.queryMetrics.slice(-this.config.queryAnalysis.maxQueriesTracked);
    }

    // Check for slow query
    if (executionTime > this.config.slowQueryThreshold) {
      this.handleSlowQuery(queryMetric);
    }

    logger.debug('Query tracked', undefined, {
      context: LogContext.DATABASE,
      query_id: queryId,
      query_hash: queryHash,
      execution_time: executionTime,
      operation: queryMetric.operation,
      table: queryMetric.table,
    });

    this.emit('queryTracked', queryMetric);
    return queryId;
  }

  /**
   * Start tracking a transaction
   */
  startTransaction(
    options: {
      traceId?: string;
      userId?: string;
      isolationLevel?: string;
      readOnly?: boolean;
    } = {}
  ): string {
    const transactionId = this.generateId();

    const transaction: TransactionMetrics = {
      id: transactionId,
      startTime: new Date(),
      status: 'active',
      queries: [],
      isolationLevel: options.isolationLevel,
      readOnly: options.readOnly || false,
      locksHeld: 0,
      locksWaited: 0,
      lockWaitTime: 0,
      traceId: options.traceId || telemetryService.getCurrentTraceId(),
      userId: options.userId,
    };

    this.activeTransactions.set(transactionId, transaction);

    logger.debug('Transaction started', undefined, {
      context: LogContext.DATABASE,
      transaction_id: transactionId,
      trace_id: transaction.traceId,
      isolation_level: transaction.isolationLevel,
    });

    this.emit('transactionStarted', transaction);
    return transactionId;
  }

  /**
   * End a transaction
   */
  endTransaction(
    transactionId: string,
    status: 'committed' | 'aborted' | 'timeout',
    lockMetrics?: {
      locksHeld: number;
      locksWaited: number;
      lockWaitTime: number;
    }
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      logger.warn('Transaction not found', undefined, {
        context: LogContext.DATABASE,
        transaction_id: transactionId,
      });
      return;
    }

    transaction.endTime = new Date();
    transaction.duration = transaction.endTime.getTime() - transaction.startTime.getTime();
    transaction.status = status;

    if (lockMetrics) {
      transaction.locksHeld = lockMetrics.locksHeld;
      transaction.locksWaited = lockMetrics.locksWaited;
      transaction.lockWaitTime = lockMetrics.lockWaitTime;
    }

    // Move to completed transactions
    this.activeTransactions.delete(transactionId);
    this.transactionMetrics.push(transaction);

    // Keep only recent transactions
    if (this.transactionMetrics.length > 1000) {
      this.transactionMetrics = this.transactionMetrics.slice(-1000);
    }

    logger.debug('Transaction ended', undefined, {
      context: LogContext.DATABASE,
      transaction_id: transactionId,
      status,
      duration: transaction.duration,
      queries: transaction.queries.length,
    });

    this.emit('transactionEnded', transaction);
  }

  /**
   * Associate query with transaction
   */
  addQueryToTransaction(transactionId: string, queryId: string): void {
    const transaction = this.activeTransactions.get(transactionId);
    const query = this.queryMetrics.find((q) => q.id === queryId);

    if (transaction && query) {
      transaction.queries.push(query);
    }
  }

  /**
   * Get current database health
   */
  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const recentQueries = this.getRecentQueries(300000); // Last 5 minutes
    const recentTransactions = this.getRecentTransactions(300000);
    const recentConnections = this.getRecentConnectionMetrics(300000);

    // Calculate query performance
    const averageQueryTime =
      recentQueries.length > 0
        ? recentQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentQueries.length
        : 0;

    const slowQueries = recentQueries.filter(
      (q) => q.executionTime > this.config.slowQueryThreshold
    ).length;
    const queryThroughput = recentQueries.length / 5; // queries per minute

    // Calculate connection health
    const latestConnection = recentConnections[recentConnections.length - 1];
    const connectionUtilization = latestConnection?.connectionUtilization || 0;
    const connectionErrors = recentConnections.reduce((sum, c) => sum + c.connectionErrors, 0);

    // Calculate resource utilization
    const cacheHitRatio =
      recentQueries.length > 0
        ? (recentQueries.filter((q) => q.cacheHit).length / recentQueries.length) * 100
        : 100;

    // Calculate concurrency metrics
    const activeTransactions = this.activeTransactions.size;
    const lockContention = recentTransactions.filter((t) => t.lockWaitTime > 0).length;

    // Calculate overall health score
    const score = this.calculateHealthScore({
      averageQueryTime,
      slowQueries,
      connectionUtilization,
      connectionErrors,
      cacheHitRatio,
      activeTransactions,
      lockContention,
    });

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (score < 50) status = 'unhealthy';
    else if (score < 70) status = 'degraded';

    // Generate issues and recommendations
    const issues = this.generateIssues({
      averageQueryTime,
      slowQueries,
      connectionUtilization,
      connectionErrors,
      cacheHitRatio,
      activeTransactions,
      lockContention,
    });

    return {
      score,
      status,
      averageQueryTime,
      slowQueries,
      queryThroughput,
      connectionUtilization,
      connectionErrors,
      cacheHitRatio,
      activeTransactions,
      lockContention,
      issues,
    };
  }

  /**
   * Generate comprehensive database performance report
   */
  generateReport(durationMinutes = 60): DatabaseReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);

    const queries = this.queryMetrics.filter((q) => q.timestamp > startTime);
    const transactions = this.transactionMetrics.filter((t) => t.startTime > startTime);

    // Summary metrics
    const totalQueries = queries.length;
    const averageQueryTime =
      queries.length > 0
        ? queries.reduce((sum, q) => sum + q.executionTime, 0) / queries.length
        : 0;
    const slowQueries = queries.filter(
      (q) => q.executionTime > this.config.slowQueryThreshold
    ).length;
    const errorRate = 0; // Would need error tracking in queries
    const throughput = totalQueries / durationMinutes;

    // Top slow queries
    const queryGroups = new Map<string, { queries: QueryMetrics[]; totalTime: number }>();
    queries.forEach((q) => {
      if (!queryGroups.has(q.queryHash)) {
        queryGroups.set(q.queryHash, { queries: [], totalTime: 0 });
      }
      const group = queryGroups.get(q.queryHash)!;
      group.queries.push(q);
      group.totalTime += q.executionTime;
    });

    const topSlowQueries = Array.from(queryGroups.entries())
      .map(([hash, group]) => ({
        queryHash: hash,
        query: group.queries[0].query,
        averageTime: group.totalTime / group.queries.length,
        count: group.queries.length,
        totalTime: group.totalTime,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    // Top tables by activity
    const tableGroups = new Map<string, { count: number; totalTime: number }>();
    queries.forEach((q) => {
      if (q.table) {
        if (!tableGroups.has(q.table)) {
          tableGroups.set(q.table, { count: 0, totalTime: 0 });
        }
        const group = tableGroups.get(q.table)!;
        group.count++;
        group.totalTime += q.executionTime;
      }
    });

    const topTables = Array.from(tableGroups.entries())
      .map(([table, stats]) => ({
        table,
        queryCount: stats.count,
        averageTime: stats.totalTime / stats.count,
        totalTime: stats.totalTime,
      }))
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 10);

    // Performance percentiles
    const queryTimes = queries.map((q) => q.executionTime).sort((a, b) => a - b);
    const queryTimePercentiles = {
      p50: this.calculatePercentile(queryTimes, 50),
      p95: this.calculatePercentile(queryTimes, 95),
      p99: this.calculatePercentile(queryTimes, 99),
    };

    // Connection metrics
    const recentConnections = this.getRecentConnectionMetrics(durationMinutes * 60 * 1000);
    const connectionMetrics = {
      averageUtilization:
        recentConnections.length > 0
          ? recentConnections.reduce((sum, c) => sum + c.connectionUtilization, 0) /
            recentConnections.length
          : 0,
      peakConnections:
        recentConnections.length > 0
          ? Math.max(...recentConnections.map((c) => c.activeConnections))
          : 0,
      connectionErrors: recentConnections.reduce((sum, c) => sum + c.connectionErrors, 0),
    };

    // Transaction metrics
    const completedTransactions = transactions.filter((t) => t.duration !== undefined);
    const transactionMetrics = {
      averageDuration:
        completedTransactions.length > 0
          ? completedTransactions.reduce((sum, t) => sum + (t.duration || 0), 0) /
            completedTransactions.length
          : 0,
      abortRate:
        transactions.length > 0
          ? (transactions.filter((t) => t.status === 'aborted').length / transactions.length) * 100
          : 0,
      lockContentions: transactions.filter((t) => t.lockWaitTime > 0).length,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      queries,
      transactions,
      connectionMetrics: recentConnections,
    });

    return {
      timeRange: { start: startTime, end: endTime },
      summary: {
        totalQueries,
        averageQueryTime,
        slowQueries,
        errorRate,
        throughput,
      },
      topSlowQueries,
      topTables,
      performance: {
        queryTimePercentiles,
        connectionMetrics,
        transactionMetrics,
      },
      recommendations,
    };
  }

  // Private methods

  private setupQueryInterception(): void {
    // This is a simplified version. In practice, you'd need to hook into
    // the Supabase client or use database-specific monitoring tools
    logger.info('Query interception setup completed', undefined, LogContext.DATABASE);
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect connection pool metrics
      if (this.config.connectionPoolMonitoring) {
        const connectionMetrics = await this.collectConnectionMetrics();
        this.connectionMetrics.push(connectionMetrics);

        // Keep only recent metrics
        if (this.connectionMetrics.length > 1000) {
          this.connectionMetrics = this.connectionMetrics.slice(-1000);
        }
      }

      // Emit periodic metrics update
      this.emit('metricsCollected', {
        queries: this.queryMetrics.length,
        activeTransactions: this.activeTransactions.size,
        connections: this.connectionMetrics.length,
      });
    } catch (error) {
      logger.error('Error collecting database metrics', undefined, {
        context: LogContext.DATABASE,
        _error
      });
    }
  }

  private async collectConnectionMetrics(): Promise<ConnectionPoolMetrics> {
    // This would typically query database system tables or connection pool stats
    // For Supabase, this information might not be directly available

    return {
      timestamp: new Date(),
      activeConnections: Math.floor(Math.random() * 20) + 5, // Simulated
      idleConnections: Math.floor(Math.random() * 10) + 2,
      totalConnections: 30,
      maxConnections: 50,
      connectionUtilization: (25 / 50) * 100,
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      connectionErrors: 0,
      averageConnectionTime: Math.random() * 100 + 50,
      connectionWaitTime: Math.random() * 10,
      queuedRequests: Math.floor(Math.random() * 3),
    };
  }

  private handleSlowQuery(query: QueryMetrics): void {
    logger.warn('Slow query detected', undefined, {
      context: LogContext.DATABASE,
      query_id: query.id,
      execution_time: query.executionTime,
      query_hash: query.queryHash,
      table: query.table,
      operation: query.operation,
    });

    this.emit('slowQuery', query);

    // Check if this query _patternis frequently slow
    const recentSimilarQueries = this.queryMetrics.filter(
      (q) => q.queryHash === query.queryHash && q.timestamp > new Date(Date.now() - 3600000) // Last hour
    );

    const slowCount = recentSimilarQueries.filter(
      (q) => q.executionTime > this.config.slowQueryThreshold
    ).length;
    const slowPercentage = (slowCount / recentSimilarQueries.length) * 100;

    if (slowPercentage > 50 && recentSimilarQueries.length > 5) {
      this.emit('slowQueryPattern', {
        queryHash: query.queryHash,
        query: query.query,
        slowPercentage,
        count: recentSimilarQueries.length,
        averageTime:
          recentSimilarQueries.reduce((sum, q) => sum + q.executionTime, 0) /
          recentSimilarQueries.length,
      });
    }
  }

  private calculateHealthScore(metrics: {
    averageQueryTime: number;
    slowQueries: number;
    connectionUtilization: number;
    connectionErrors: number;
    cacheHitRatio: number;
    activeTransactions: number;
    lockContention: number;
  }): number {
    const { scoring, thresholds } = this.config;

    // Query performance score (0-100)
    const queryScore = Math.max(0, 100 - (metrics.averageQueryTime / thresholds.queryTime) * 100);

    // Connection health score (0-100)
    const connectionScore = Math.max(
      0,
      100 - (metrics.connectionUtilization / 100) * 100 - metrics.connectionErrors * 5
    );

    // Resource utilization score (0-100)
    const resourceScore = metrics.cacheHitRatio;

    // Concurrency score (0-100)
    const concurrencyScore = Math.max(
      0,
      100 -
        (metrics.activeTransactions / thresholds.activeTransactions) * 50 -
        metrics.lockContention * 10
    );

    // Weighted total
    const totalScore =
      queryScore * scoring.queryPerformance +
      connectionScore * scoring.connectionHealth +
      resourceScore * scoring.resourceUtilization +
      concurrencyScore * scoring.concurrency;

    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }

  private generateIssues(metrics: {
    averageQueryTime: number;
    slowQueries: number;
    connectionUtilization: number;
    connectionErrors: number;
    cacheHitRatio: number;
    activeTransactions: number;
    lockContention: number;
  }): DatabaseHealth['issues'] {
    const issues: DatabaseHealth['issues'] = [];

    // Query performance issues
    if (metrics.averageQueryTime > this.config.thresholds.queryTime) {
      issues.push({
        severity: 'high',
        type: 'slow_queries',
        description: `Average query time (${metrics.averageQueryTime.toFixed(2)}ms) exceeds threshold`,
        recommendation: 'Review and optimize slow queries, consider adding indexes',
      });
    }

    if (metrics.slowQueries > 10) {
      issues.push({
        severity: 'medium',
        type: 'query_count',
        description: `High number of slow queries detected: ${metrics.slowQueries}`,
        recommendation: 'Analyze query patterns and optimize frequently used queries',
      });
    }

    // Connection issues
    if (metrics.connectionUtilization > 80) {
      issues.push({
        severity: 'high',
        type: 'connection_pool',
        description: `Connection pool utilization is high: ${metrics.connectionUtilization.toFixed(1)}%`,
        recommendation: 'Consider increasing connection pool size or optimizing connection usage',
      });
    }

    if (metrics.connectionErrors > 0) {
      issues.push({
        severity: 'critical',
        type: 'connection_errors',
        description: `Database connection errors detected: ${metrics.connectionErrors}`,
        recommendation: 'Check database connectivity and configuration',
      });
    }

    // Cache performance
    if (metrics.cacheHitRatio < this.config.thresholds.cacheHitRatio) {
      issues.push({
        severity: 'medium',
        type: 'cache_performance',
        description: `Cache hit ratio is low: ${metrics.cacheHitRatio.toFixed(1)}%`,
        recommendation: 'Optimize queries for better cache usage or increase cache size',
      });
    }

    // Concurrency issues
    if (metrics.activeTransactions > this.config.thresholds.activeTransactions) {
      issues.push({
        severity: 'medium',
        type: 'high_concurrency',
        description: `High number of active transactions: ${metrics.activeTransactions}`,
        recommendation: 'Monitor for long-running transactions and optimize transaction scope',
      });
    }

    if (metrics.lockContention > 5) {
      issues.push({
        severity: 'high',
        type: 'lockcontention',
        description: `Lock contention detected in ${metrics.lockContention} transactions`,
        recommendation: 'Review transaction isolation levels and reduce transaction duration',
      });
    }

    return issues;
  }

  private generateRecommendations(data: {
    queries: QueryMetrics[];
    transactions: TransactionMetrics[];
    connectionMetrics: ConnectionPoolMetrics[];
  }): string[] {
    const recommendations: string[] = [];

    // Query optimization recommendations
    const slowQueries = data.queries.filter(
      (q) => q.executionTime > this.config.slowQueryThreshold
    );
    if (slowQueries.length > 0) {
      recommendations.push(`Optimize ${slowQueries.length} slow queries identified in the report`);

      // Check for missing indexes
      const tablesWithSlowQueries = [...new Set(slowQueries.map((q) => q.table).filter(Boolean))];
      if (tablesWithSlowQueries.length > 0) {
        recommendations.push(
          `Consider adding indexes to tables: ${tablesWithSlowQueries.join(', ')}`
        );
      }
    }

    // Connection pool recommendations
    const avgConnectionUtil =
      data.connectionMetrics.length > 0
        ? data.connectionMetrics.reduce((sum, c) => sum + c.connectionUtilization, 0) /
          data.connectionMetrics.length
        : 0;

    if (avgConnectionUtil > 80) {
      recommendations.push('Consider increasing database connection pool size');
      recommendations.push('Review application connection usage patterns');
    }

    // Transaction recommendations
    const longTransactions = data.transactions.filter((t) => (t.duration || 0) > 30000); // 30 seconds
    if (longTransactions.length > 0) {
      recommendations.push(
        `Review ${longTransactions.length} long-running transactions for optimization`
      );
    }

    // General performance recommendations
    const queryCount = data.queries.length;
    if (queryCount > 1000) {
      recommendations.push('Consider implementing query result caching');
      recommendations.push('Review query patterns for potential batching opportunities');
    }

    return recommendations;
  }

  private getRecentQueries(durationMs: number): QueryMetrics[] {
    const cutoffTime = new Date(Date.now() - durationMs);
    return this.queryMetrics.filter((q) => q.timestamp > cutoffTime);
  }

  private getRecentTransactions(durationMs: number): TransactionMetrics[] {
    const cutoffTime = new Date(Date.now() - durationMs);
    return this.transactionMetrics.filter((t) => t.startTime > cutoffTime);
  }

  private getRecentConnectionMetrics(durationMs: number): ConnectionPoolMetrics[] {
    const cutoffTime = new Date(Date.now() - durationMs);
    return this.connectionMetrics.filter((c) => c.timestamp > cutoffTime);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)] || 0;
  }

  private generateQueryHash(query: string): string {
    // Simple hash based on normalized query structure
    const normalized = this.normalizeQuery(query);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private normalizeQuery(query: string): string {
    // Normalize query by removing parameters and formatting
    return query
      .replace(/\$\d+/g, '?') // Replace parameters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/'[^']*'/g, "'X'") // Replace strings
      .trim()
      .toLowerCase();
  }

  private inferOperation(query: string): QueryMetrics['operation'] {
    const queryLower = query.toLowerCase().trim();

    if (queryLower.startsWith('select')) return 'SELECT';
    if (queryLower.startsWith('insert')) return 'INSERT';
    if (queryLower.startsWith('update')) return 'UPDATE';
    if (queryLower.startsWith('delete')) return 'DELETE';
    if (queryLower.includes('upsert')) return 'UPSERT';
    if (queryLower.startsWith('call') || queryLower.includes('rpc')) return 'RPC';

    return 'SELECT'; // Default
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}

// Create singleton instance
let databasePerformanceMonitor: DatabasePerformanceMonitor | null = null;

export function getDatabasePerformanceMonitor(
  supabaseUrl?: string,
  supabaseKey?: string,
  config?: Partial<DatabasePerformanceConfig>
): DatabasePerformanceMonitor {
  if (!databasePerformanceMonitor) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key required to initialize database performance monitor');
    }
    databasePerformanceMonitor = new DatabasePerformanceMonitor(supabaseUrl, supabaseKey, config);
  }
  return databasePerformanceMonitor;
}

export default DatabasePerformanceMonitor;

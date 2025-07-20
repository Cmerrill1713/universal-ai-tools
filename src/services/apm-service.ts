/**
 * Application Performance Monitoring (APM) Service
 * 
 * Comprehensive APM service for Universal AI Tools with:
 * - Real-time performance monitoring
 * - Application insights and analytics
 * - Transaction tracing
 * - Error rate monitoring  
 * - Resource utilization tracking
 * - Sweet Athena performance metrics
 * - Automatic anomaly detection
 * - Performance alerting
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { telemetryService } from './telemetry-service';
import { performanceMonitor } from '../utils/performance-monitor';
import { logger, LogContext } from '../utils/enhanced-logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export interface APMConfig {
  enabled: boolean;
  samplingRate: number;
  maxTransactions: number;
  maxSpans: number;
  flushInterval: number; // ms
  enableRealUserMonitoring: boolean;
  enableSyntheticMonitoring: boolean;
  enableResourceMonitoring: boolean;
  enableMemoryLeakDetection: boolean;
  enablePerformanceBaseline: boolean;
  alertThresholds: {
    responseTime: number; // ms
    errorRate: number; // percentage
    memoryUsage: number; // MB
    cpuUsage: number; // percentage
  };
}

export interface Transaction {
  id: string;
  name: string;
  type: 'request' | 'task' | 'background' | 'athena';
  startTime: number;
  endTime?: number;
  duration?: number;
  result: 'success' | 'error' | 'timeout' | 'cancelled';
  spans: Span[];
  tags: Record<string, any>;
  user?: {
    id: string;
    sessionId: string;
  };
  context: {
    traceId?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    userAgent?: string;
    ip?: string;
  };
  metrics: {
    memoryUsed: number;
    cpuTime: number;
    dbQueries: number;
    apiCalls: number;
  };
}

export interface Span {
  id: string;
  transactionId: string;
  name: string;
  type: 'db' | 'http' | 'ai' | 'cache' | 'custom';
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  stackTrace?: string[];
}

export interface PerformanceMetric {
  timestamp: Date;
  transactionType: string;
  name: string;
  value: number;
  unit: string;
  tags: Record<string, any>;
}

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  transactionId?: string;
  spanId?: string;
  message: string;
  type: string;
  stackTrace: string;
  handled: boolean;
  tags: Record<string, any>;
  context: Record<string, any>;
  fingerprint: string;
}

export interface APMReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  overview: {
    totalTransactions: number;
    totalErrors: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number; // transactions per minute
  };
  topTransactions: Array<{
    name: string;
    count: number;
    averageTime: number;
    errorRate: number;
  }>;
  topErrors: Array<{
    fingerprint: string;
    message: string;
    count: number;
    lastSeen: Date;
  }>;
  performance: {
    responseTimePercentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    memoryUsage: {
      average: number;
      peak: number;
    };
    cpuUsage: {
      average: number;
      peak: number;
    };
  };
  athenaMetrics?: {
    totalInteractions: number;
    averageResponseTime: number;
    satisfactionScore: number;
    topMoods: Array<{
      mood: string;
      count: number;
      averageTime: number;
    }>;
  };
}

export class APMService extends EventEmitter {
  private config: APMConfig;
  private supabase: SupabaseClient;
  private isStarted = false;
  private transactions = new Map<string, Transaction>();
  private spans = new Map<string, Span>();
  private errors: ErrorEvent[] = [];
  private metrics: PerformanceMetric[] = [];
  private performanceObserver?: PerformanceObserver;
  private flushInterval?: NodeJS.Timeout;
  private memoryBaseline?: NodeJS.MemoryUsage;
  private lastGCTime = Date.now();
  private transactionCount = 0;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<APMConfig> = {}
  ) {
    super();
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      enabled: true,
      samplingRate: 1.0,
      maxTransactions: 1000,
      maxSpans: 10000,
      flushInterval: 30000, // 30 seconds
      enableRealUserMonitoring: true,
      enableSyntheticMonitoring: false,
      enableResourceMonitoring: true,
      enableMemoryLeakDetection: true,
      enablePerformanceBaseline: true,
      alertThresholds: {
        responseTime: 2000, // 2 seconds
        errorRate: 5, // 5%
        memoryUsage: 1024, // 1GB
        cpuUsage: 80 // 80%
      },
      ...config
    };

    this.setupErrorHandling();
  }

  /**
   * Start APM monitoring
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('APM service already started', LogContext.PERFORMANCE);
      return;
    }

    if (!this.config.enabled) {
      logger.info('APM service disabled', LogContext.PERFORMANCE);
      return;
    }

    try {
      logger.info('Starting APM service', LogContext.PERFORMANCE, { config: this.config });

      // Initialize baseline metrics
      if (this.config.enablePerformanceBaseline) {
        this.memoryBaseline = process.memoryUsage();
      }

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      // Setup resource monitoring
      if (this.config.enableResourceMonitoring) {
        this.setupResourceMonitoring();
      }

      // Setup memory leak detection
      if (this.config.enableMemoryLeakDetection) {
        this.setupMemoryLeakDetection();
      }

      // Start flush interval
      this.flushInterval = setInterval(() => {
        this.flushMetrics();
      }, this.config.flushInterval);

      this.isStarted = true;
      this.emit('started', { config: this.config });
      
      logger.info('APM service started successfully', LogContext.PERFORMANCE);

    } catch (error) {
      logger.error('Failed to start APM service', LogContext.PERFORMANCE, { error });
      throw error;
    }
  }

  /**
   * Stop APM monitoring
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('APM service not started', LogContext.PERFORMANCE);
      return;
    }

    try {
      logger.info('Stopping APM service', LogContext.PERFORMANCE);

      // Clear intervals
      if (this.flushInterval) {
        clearInterval(this.flushInterval);
        this.flushInterval = undefined;
      }

      // Disconnect performance observer
      if (this.performanceObserver) {
        this.performanceObserver.disconnect();
        this.performanceObserver = undefined;
      }

      // Final flush
      await this.flushMetrics();

      this.isStarted = false;
      this.emit('stopped');
      
      logger.info('APM service stopped successfully', LogContext.PERFORMANCE);

    } catch (error) {
      logger.error('Error stopping APM service', LogContext.PERFORMANCE, { error });
      throw error;
    }
  }

  /**
   * Start a new transaction
   */
  startTransaction(
    name: string,
    type: Transaction['type'] = 'request',
    context: Partial<Transaction['context']> = {}
  ): string {
    const transactionId = this.generateId();
    const startTime = performance.now();

    const transaction: Transaction = {
      id: transactionId,
      name,
      type,
      startTime,
      result: 'success',
      spans: [],
      tags: {},
      context: {
        traceId: telemetryService.getCurrentTraceId(),
        ...context
      },
      metrics: {
        memoryUsed: process.memoryUsage().heapUsed,
        cpuTime: process.cpuUsage().user + process.cpuUsage().system,
        dbQueries: 0,
        apiCalls: 0
      }
    };

    this.transactions.set(transactionId, transaction);
    this.transactionCount++;

    // Cleanup old transactions if we exceed limit
    if (this.transactions.size > this.config.maxTransactions) {
      this.cleanupOldTransactions();
    }

    logger.debug('Started transaction', LogContext.PERFORMANCE, {
      transaction_id: transactionId,
      name,
      type,
      trace_id: transaction.context.traceId
    });

    this.emit('transactionStarted', transaction);
    return transactionId;
  }

  /**
   * End a transaction
   */
  endTransaction(
    transactionId: string,
    result: Transaction['result'] = 'success',
    tags: Record<string, any> = {}
  ): void {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      logger.warn('Transaction not found', LogContext.PERFORMANCE, { transaction_id: transactionId });
      return;
    }

    const endTime = performance.now();
    transaction.endTime = endTime;
    transaction.duration = endTime - transaction.startTime;
    transaction.result = result;
    transaction.tags = { ...transaction.tags, ...tags };

    // Update final metrics
    const finalMemory = process.memoryUsage();
    const finalCpu = process.cpuUsage();
    transaction.metrics = {
      ...transaction.metrics,
      memoryUsed: finalMemory.heapUsed - transaction.metrics.memoryUsed,
      cpuTime: (finalCpu.user + finalCpu.system) - transaction.metrics.cpuTime
    };

    logger.debug('Ended transaction', LogContext.PERFORMANCE, {
      transaction_id: transactionId,
      duration_ms: transaction.duration,
      result,
      memory_used: transaction.metrics.memoryUsed,
      cpu_time: transaction.metrics.cpuTime
    });

    // Check for performance alerts
    this.checkPerformanceAlerts(transaction);

    this.emit('transactionEnded', transaction);

    // Record performance metric
    this.recordMetric('transaction_duration', transaction.duration, 'ms', {
      transaction_name: transaction.name,
      transaction_type: transaction.type,
      result: transaction.result
    });
  }

  /**
   * Start a span within a transaction
   */
  startSpan(
    transactionId: string,
    name: string,
    type: Span['type'] = 'custom',
    tags: Record<string, any> = {}
  ): string {
    const spanId = this.generateId();
    const startTime = performance.now();

    const span: Span = {
      id: spanId,
      transactionId,
      name,
      type,
      startTime,
      tags
    };

    this.spans.set(spanId, span);

    // Add to transaction
    const transaction = this.transactions.get(transactionId);
    if (transaction) {
      transaction.spans.push(span);
    }

    // Cleanup old spans if we exceed limit
    if (this.spans.size > this.config.maxSpans) {
      this.cleanupOldSpans();
    }

    logger.debug('Started span', LogContext.PERFORMANCE, {
      span_id: spanId,
      transaction_id: transactionId,
      name,
      type
    });

    this.emit('spanStarted', span);
    return spanId;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, tags: Record<string, any> = {}): void {
    const span = this.spans.get(spanId);
    if (!span) {
      logger.warn('Span not found', LogContext.PERFORMANCE, { span_id: spanId });
      return;
    }

    const endTime = performance.now();
    span.endTime = endTime;
    span.duration = endTime - span.startTime;
    span.tags = { ...span.tags, ...tags };

    // Update transaction metrics based on span type
    const transaction = this.transactions.get(span.transactionId);
    if (transaction) {
      switch (span.type) {
        case 'db':
          transaction.metrics.dbQueries++;
          break;
        case 'http':
          transaction.metrics.apiCalls++;
          break;
      }
    }

    logger.debug('Ended span', LogContext.PERFORMANCE, {
      span_id: spanId,
      transaction_id: span.transactionId,
      duration_ms: span.duration,
      type: span.type
    });

    this.emit('spanEnded', span);

    // Record span metric
    this.recordMetric('span_duration', span.duration, 'ms', {
      span_name: span.name,
      span_type: span.type,
      transaction_id: span.transactionId
    });
  }

  /**
   * Record an error
   */
  recordError(
    error: Error,
    context: Record<string, any> = {},
    transactionId?: string,
    spanId?: string
  ): string {
    const errorId = this.generateId();
    const fingerprint = this.generateErrorFingerprint(error);

    const errorEvent: ErrorEvent = {
      id: errorId,
      timestamp: new Date(),
      transactionId,
      spanId,
      message: error.message,
      type: error.name,
      stackTrace: error.stack || '',
      handled: true,
      tags: {},
      context,
      fingerprint
    };

    this.errors.push(errorEvent);

    // Update transaction result if associated
    if (transactionId) {
      const transaction = this.transactions.get(transactionId);
      if (transaction) {
        transaction.result = 'error';
      }
    }

    // Keep only recent errors (last 1000)
    if (this.errors.length > 1000) {
      this.errors = this.errors.slice(-1000);
    }

    logger.error('APM error recorded', LogContext.PERFORMANCE, {
      error_id: errorId,
      transaction_id: transactionId,
      span_id: spanId,
      fingerprint,
      message: error.message
    });

    this.emit('errorRecorded', errorEvent);

    // Record error metric
    this.recordMetric('error_count', 1, 'count', {
      error_type: error.name,
      fingerprint,
      transaction_id: transactionId
    });

    return errorId;
  }

  /**
   * Record Sweet Athena interaction
   */
  recordAthenaInteraction(
    interactionType: string,
    personalityMood: string,
    responseTime: number,
    satisfactionScore?: number,
    sessionId?: string
  ): void {
    const transactionId = this.startTransaction(
      `athena.${interactionType}`,
      'athena',
      { url: `/athena/${interactionType}` }
    );

    // Add Athena-specific tags
    const transaction = this.transactions.get(transactionId);
    if (transaction) {
      transaction.tags = {
        'athena.interaction_type': interactionType,
        'athena.personality_mood': personalityMood,
        'athena.session_id': sessionId || 'unknown',
        'athena.satisfaction_score': satisfactionScore
      };

      if (sessionId) {
        transaction.user = {
          id: 'athena_user',
          sessionId
        };
      }
    }

    // Simulate transaction completion
    setTimeout(() => {
      this.endTransaction(transactionId, 'success', {
        'athena.response_time': responseTime,
        'athena.satisfaction_score': satisfactionScore
      });
    }, responseTime);

    // Record specific Athena metrics
    this.recordMetric('athena_interaction_duration', responseTime, 'ms', {
      interaction_type: interactionType,
      personality_mood: personalityMood,
      session_id: sessionId || 'unknown'
    });

    if (satisfactionScore !== undefined) {
      this.recordMetric('athena_satisfaction_score', satisfactionScore, 'score', {
        interaction_type: interactionType,
        personality_mood: personalityMood,
        session_id: sessionId || 'unknown'
      });
    }
  }

  /**
   * Generate comprehensive APM report
   */
  generateReport(durationMinutes = 60): APMReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);
    
    const recentTransactions = Array.from(this.transactions.values())
      .filter(t => t.endTime && new Date(t.startTime) > startTime);
    
    const recentErrors = this.errors.filter(e => e.timestamp > startTime);
    const recentMetrics = this.metrics.filter(m => m.timestamp > startTime);

    // Calculate overview metrics
    const totalTransactions = recentTransactions.length;
    const totalErrors = recentErrors.length;
    const completedTransactions = recentTransactions.filter(t => t.duration !== undefined);
    const averageResponseTime = completedTransactions.length > 0
      ? completedTransactions.reduce((sum, t) => sum + (t.duration || 0), 0) / completedTransactions.length
      : 0;
    const errorRate = totalTransactions > 0 ? (totalErrors / totalTransactions) * 100 : 0;
    const throughput = totalTransactions / durationMinutes;

    // Calculate top transactions
    const transactionGroups = new Map<string, Transaction[]>();
    recentTransactions.forEach(t => {
      const key = `${t.type}:${t.name}`;
      if (!transactionGroups.has(key)) {
        transactionGroups.set(key, []);
      }
      transactionGroups.get(key)!.push(t);
    });

    const topTransactions = Array.from(transactionGroups.entries())
      .map(([name, transactions]) => {
        const completed = transactions.filter(t => t.duration !== undefined);
        const errors = transactions.filter(t => t.result === 'error').length;
        return {
          name,
          count: transactions.length,
          averageTime: completed.length > 0
            ? completed.reduce((sum, t) => sum + (t.duration || 0), 0) / completed.length
            : 0,
          errorRate: transactions.length > 0 ? (errors / transactions.length) * 100 : 0
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate top errors
    const errorGroups = new Map<string, ErrorEvent[]>();
    recentErrors.forEach(e => {
      if (!errorGroups.has(e.fingerprint)) {
        errorGroups.set(e.fingerprint, []);
      }
      errorGroups.get(e.fingerprint)!.push(e);
    });

    const topErrors = Array.from(errorGroups.entries())
      .map(([fingerprint, errors]) => ({
        fingerprint,
        message: errors[0].message,
        count: errors.length,
        lastSeen: new Date(Math.max(...errors.map(e => e.timestamp.getTime())))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate response time percentiles
    const durations = completedTransactions
      .map(t => t.duration!)
      .sort((a, b) => a - b);
    
    const responseTimePercentiles = {
      p50: this.calculatePercentile(durations, 50),
      p95: this.calculatePercentile(durations, 95),
      p99: this.calculatePercentile(durations, 99)
    };

    // Calculate resource usage
    const memoryMetrics = recentMetrics.filter(m => m.name === 'memory_usage');
    const cpuMetrics = recentMetrics.filter(m => m.name === 'cpu_usage');

    const performance = {
      responseTimePercentiles,
      memoryUsage: {
        average: memoryMetrics.length > 0
          ? memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length
          : 0,
        peak: memoryMetrics.length > 0
          ? Math.max(...memoryMetrics.map(m => m.value))
          : 0
      },
      cpuUsage: {
        average: cpuMetrics.length > 0
          ? cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length
          : 0,
        peak: cpuMetrics.length > 0
          ? Math.max(...cpuMetrics.map(m => m.value))
          : 0
      }
    };

    // Calculate Athena metrics
    const athenaTransactions = recentTransactions.filter(t => t.type === 'athena');
    const athenaMetrics = athenaTransactions.length > 0 ? {
      totalInteractions: athenaTransactions.length,
      averageResponseTime: athenaTransactions.reduce((sum, t) => sum + (t.duration || 0), 0) / athenaTransactions.length,
      satisfactionScore: this.calculateAverageSatisfactionScore(athenaTransactions),
      topMoods: this.calculateTopMoods(athenaTransactions)
    } : undefined;

    return {
      timeRange: { start: startTime, end: endTime },
      overview: {
        totalTransactions,
        totalErrors,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        throughput: Math.round(throughput * 100) / 100
      },
      topTransactions,
      topErrors,
      performance,
      athenaMetrics
    };
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): {
    activeTransactions: number;
    activeSpans: number;
    errorCount: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  } {
    return {
      activeTransactions: Array.from(this.transactions.values()).filter(t => !t.endTime).length,
      activeSpans: Array.from(this.spans.values()).filter(s => !s.endTime).length,
      errorCount: this.errors.length,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  // Private methods

  private setupErrorHandling(): void {
    // Global error handling
    process.on('uncaughtException', (error) => {
      this.recordError(error, { source: 'uncaughtException' });
    });

    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.recordError(error, { source: 'unhandledRejection' });
    });
  }

  private setupPerformanceMonitoring(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        this.recordMetric('performance_entry', entry.duration, 'ms', {
          entry_type: entry.entryType,
          name: entry.name
        });
      });
    });

    this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
  }

  private setupResourceMonitoring(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      this.recordMetric('memory_usage', memUsage.heapUsed / 1024 / 1024, 'MB', {
        type: 'heap_used'
      });
      this.recordMetric('memory_usage', memUsage.rss / 1024 / 1024, 'MB', {
        type: 'rss'
      });
      this.recordMetric('cpu_usage', (cpuUsage.user + cpuUsage.system) / 1000, 'ms', {
        type: 'total'
      });

    }, 15000); // Every 15 seconds
  }

  private setupMemoryLeakDetection(): void {
    setInterval(() => {
      if (!this.memoryBaseline) return;

      const currentMemory = process.memoryUsage();
      const heapGrowth = currentMemory.heapUsed - this.memoryBaseline.heapUsed;
      
      // Check for significant memory growth
      if (heapGrowth > 50 * 1024 * 1024) { // 50MB
        logger.warn('Potential memory leak detected', LogContext.PERFORMANCE, {
          heap_growth_mb: Math.round(heapGrowth / 1024 / 1024),
          current_heap_mb: Math.round(currentMemory.heapUsed / 1024 / 1024),
          baseline_heap_mb: Math.round(this.memoryBaseline.heapUsed / 1024 / 1024)
        });

        this.emit('memoryLeakDetected', {
          heapGrowth,
          currentMemory,
          baseline: this.memoryBaseline
        });
      }

      // Update baseline periodically
      if (Date.now() - this.lastGCTime > 300000) { // 5 minutes
        if (global.gc) {
          global.gc();
          this.memoryBaseline = process.memoryUsage();
          this.lastGCTime = Date.now();
        }
      }

    }, 60000); // Every minute
  }

  private recordMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, any> = {}
  ): void {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      transactionType: 'system',
      name,
      value,
      unit,
      tags
    };

    this.metrics.push(metric);

    // Keep only recent metrics (last 10000)
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }

    this.emit('metricRecorded', metric);
  }

  private checkPerformanceAlerts(transaction: Transaction): void {
    const { alertThresholds } = this.config;

    // Check response time
    if (transaction.duration && transaction.duration > alertThresholds.responseTime) {
      this.emit('performanceAlert', {
        type: 'high_response_time',
        transaction,
        threshold: alertThresholds.responseTime,
        value: transaction.duration
      });
    }

    // Check memory usage
    const memoryMB = transaction.metrics.memoryUsed / 1024 / 1024;
    if (memoryMB > alertThresholds.memoryUsage) {
      this.emit('performanceAlert', {
        type: 'high_memory_usage',
        transaction,
        threshold: alertThresholds.memoryUsage,
        value: memoryMB
      });
    }
  }

  private async flushMetrics(): Promise<void> {
    try {
      // Persist recent transactions to database
      const recentTransactions = Array.from(this.transactions.values())
        .filter(t => t.endTime)
        .slice(-100); // Last 100 completed transactions

      if (recentTransactions.length > 0) {
        await this.supabase.from('apm_transactions').upsert(
          recentTransactions.map(t => ({
            id: t.id,
            name: t.name,
            type: t.type,
            start_time: new Date(t.startTime),
            end_time: t.endTime ? new Date(t.endTime) : null,
            duration: t.duration,
            result: t.result,
            tags: t.tags,
            context: t.context,
            metrics: t.metrics
          }))
        );
      }

      // Persist recent errors
      const recentErrors = this.errors.slice(-50); // Last 50 errors
      if (recentErrors.length > 0) {
        await this.supabase.from('apm_errors').upsert(
          recentErrors.map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            transaction_id: e.transactionId,
            span_id: e.spanId,
            message: e.message,
            type: e.type,
            stack_trace: e.stackTrace,
            handled: e.handled,
            tags: e.tags,
            context: e.context,
            fingerprint: e.fingerprint
          }))
        );
      }

      logger.debug('APM metrics flushed', LogContext.PERFORMANCE, {
        transactions: recentTransactions.length,
        errors: recentErrors.length
      });

    } catch (error) {
      logger.error('Failed to flush APM metrics', LogContext.PERFORMANCE, { error });
    }
  }

  private cleanupOldTransactions(): void {
    const transactions = Array.from(this.transactions.entries());
    const cutoff = performance.now() - 300000; // 5 minutes ago
    
    const toDelete = transactions
      .filter(([_, t]) => t.startTime < cutoff && t.endTime)
      .slice(0, Math.floor(this.config.maxTransactions * 0.1)); // Delete 10%
    
    toDelete.forEach(([id, _]) => this.transactions.delete(id));
  }

  private cleanupOldSpans(): void {
    const spans = Array.from(this.spans.entries());
    const cutoff = performance.now() - 300000; // 5 minutes ago
    
    const toDelete = spans
      .filter(([_, s]) => s.startTime < cutoff && s.endTime)
      .slice(0, Math.floor(this.config.maxSpans * 0.1)); // Delete 10%
    
    toDelete.forEach(([id, _]) => this.spans.delete(id));
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private generateErrorFingerprint(error: Error): string {
    // Create a fingerprint based on error type and stack trace
    const stack = error.stack || '';
    const lines = stack.split('\n').slice(0, 3); // First 3 lines
    return Buffer.from(`${error.name}:${lines.join('')}`).toString('base64').substring(0, 16);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)] || 0;
  }

  private calculateAverageSatisfactionScore(transactions: Transaction[]): number {
    const scores = transactions
      .map(t => t.tags['athena.satisfaction_score'])
      .filter(score => typeof score === 'number');
    
    return scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
  }

  private calculateTopMoods(transactions: Transaction[]): Array<{
    mood: string;
    count: number;
    averageTime: number;
  }> {
    const moodGroups = new Map<string, Transaction[]>();
    
    transactions.forEach(t => {
      const mood = t.tags['athena.personality_mood'];
      if (mood) {
        if (!moodGroups.has(mood)) {
          moodGroups.set(mood, []);
        }
        moodGroups.get(mood)!.push(t);
      }
    });

    return Array.from(moodGroups.entries())
      .map(([mood, moods]) => ({
        mood,
        count: moods.length,
        averageTime: moods.reduce((sum, t) => sum + (t.duration || 0), 0) / moods.length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

// Create singleton instance
let apmService: APMService | null = null;

export function getAPMService(
  supabaseUrl?: string,
  supabaseKey?: string,
  config?: Partial<APMConfig>
): APMService {
  if (!apmService) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key required to initialize APM service');
    }
    apmService = new APMService(supabaseUrl, supabaseKey, config);
  }
  return apmService;
}

export default APMService;
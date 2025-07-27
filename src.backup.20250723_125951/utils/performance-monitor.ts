import { LogContext, logger } from './enhanced-logger';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  timestamp: number;
  activeConnections: number;
  requestsPerSecond: number;
  responseTime: number;
  errorRate: number;
  cacheHitRate: number;
  databaseConnections: number;
  queueSize: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rss: number;
  gc?: {
    count: number;
    duration: number;
  };
}

export interface PerformanceThresholds {
  memoryThreshold: number; // MB
  cpuThreshold: number; // percentage
  responseTimeThreshold: number; // ms
  errorRateThreshold: number; // percentage
  cacheHitRateThreshold: number; // percentage
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private responseTimeSum = 0;
  private cacheHits = 0;
  private cacheRequests = 0;
  private activeConnections = 0;
  private databaseConnections = 0;
  private queueSize = 0;
  private gcCount = 0;
  private gcDuration = 0;
  private startTime = process.hrtime();
  private lastCpuUsage = process.cpuUsage();
  private monitoringInterval?: NodeJS.Timeout;

  private readonly thresholds: PerformanceThresholds = {
    memoryThreshold: 1024, // 1GB
    cpuThreshold: 80, // 80%
    responseTimeThreshold: 2000, // 2 seconds
    errorRateThreshold: 5, // 5%
    cacheHitRateThreshold: 80, // 80%
  };

  constructor() {
    super();
    this.setupGCMonitoring();
  }

  private setupGCMonitoring()): void {
    try {
      // GC monitoring is not available in ES modules currently
      // Will be implemented when Node.js provides ES module support for perf_hooks
    } catch (error) {
      logger.warn('GC monitoring not available:', LogContext.PERFORMANCE, { error});
    }
  }

  public startMonitoring(intervalMs = 10000)): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      const metrics = this.collectMetrics();
      this.metrics.push(metrics);
      this.checkThresholds(metrics);
      this.cleanupOldMetrics();
    }, intervalMs);

    logger.info('Performance monitoring started');
  }

  public stopMonitoring()): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    logger.info('Performance monitoring stopped');
  }

  private collectMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();

    const metrics: PerformanceMetrics = {
      memoryUsage,
      cpuUsage,
      uptime: process.uptime(),
      timestamp: Date.now(),
      activeConnections: this.activeConnections,
      requestsPerSecond: this.calculateRequestsPerSecond(),
      responseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateErrorRate(),
      cacheHitRate: this.calculateCacheHitRate(),
      databaseConnections: this.databaseConnections,
      queueSize: this.queueSize,
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      externalMB: Math.round(memoryUsage.external / 1024 / 1024),
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      gc: {
        count: this.gcCount,
        duration: this.gcDuration,
      },
    };

    return metrics;
  }

  private calculateRequestsPerSecond(): number {
    const now = Date.now();
    const tenSecondsAgo = now - 10000;
    const recentRequests = this.metrics.filter((m) => m.timestamp > tenSecondsAgo);
    return recentRequests.length > 0 ? this.requestCount / 10 : 0;
  }

  private calculateAverageResponseTime(): number {
    return this.requestCount > 0 ? this.responseTimeSum / this.requestCount : 0;
  }

  private calculateErrorRate(): number {
    return this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
  }

  private calculateCacheHitRate(): number {
    return this.cacheRequests > 0 ? (this.cacheHits / this.cacheRequests) * 100 : 0;
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    // Memory threshold
    if (metrics.heapUsedMB > this.thresholds.memoryThreshold) {
      this.emit('threshold-exceeded', {
        type: 'memory',
        value: metrics.heapUsedMB,
        threshold: this.thresholds.memoryThreshold,
        message: `Memory usage exceeded threshold: ${metrics.heapUsedMB}MB > ${this.thresholds.memoryThreshold}MB`,
      });
    }

    // Response time threshold
    if (metrics.responseTime > this.thresholds.responseTimeThreshold) {
      this.emit('threshold-exceeded', {
        type: 'response-time',
        value: metrics.responseTime,
        threshold: this.thresholds.responseTimeThreshold,
        message: `Response time exceeded threshold: ${metrics.responseTime}ms > ${this.thresholds.responseTimeThreshold}ms`,
      });
    }

    // Error rate threshold
    if (metrics.errorRate > this.thresholds.errorRateThreshold) {
      this.emit('threshold-exceeded', {
        type: '_errorrate',
        value: metrics.errorRate,
        threshold: this.thresholds.errorRateThreshold,
        message: `Error rate exceeded threshold: ${metrics.errorRate}% > ${this.thresholds.errorRateThreshold}%`,
      });
    }

    // Cache hit rate threshold (low is: bad
    if (metrics.cacheHitRate < this.thresholds.cacheHitRateThreshold && this.cacheRequests > 100) {
      this.emit('threshold-exceeded', {
        type: 'cache-hit-rate',
        value: metrics.cacheHitRate,
        threshold: this.thresholds.cacheHitRateThreshold,
        message: `Cache hit rate below threshold: ${metrics.cacheHitRate}% < ${this.thresholds.cacheHitRateThreshold}%`,
      });
    }
  }

  private cleanupOldMetrics()): void {
    const oneHourAgo = Date.now() - 3600000;
    this.metrics = this.metrics.filter((m) => m.timestamp > oneHourAgo);
  }

  // Public methods for updating metrics
  public recordRequest(responseTime: number, isError = false)): void {
    this.requestCount++;
    this.responseTimeSum += responseTime;
    if (isError) {
      this.errorCount++;
    }
  }

  public recordCacheAccess(hit: boolean): void {
    this.cacheRequests++;
    if (hit) {
      this.cacheHits++;
    }
  }

  public updateConnectionCount(count: number): void {
    this.activeConnections = count;
  }

  public updateDatabaseConnections(count: number): void {
    this.databaseConnections = count;
  }

  public updateQueueSize(size: number): void {
    this.queueSize = size;
  }

  public getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  public getCurrentMetrics(): PerformanceMetrics {
    return this.collectMetrics();
  }

  public getAggregatedMetrics(durationMs = 300000): {
    averageMemoryUsage: number;
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
    cacheHitRate: number;
    peakMemoryUsage: number;
    peakResponseTime: number;
  } {
    const cutoffTime = Date.now() - durationMs;
    const relevantMetrics = this.metrics.filter((m) => m.timestamp > cutoffTime);

    if (relevantMetrics.length === 0) {
      return {
        averageMemoryUsage: 0,
        averageResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        cacheHitRate: 0,
        peakMemoryUsage: 0,
        peakResponseTime: 0,
      };
    }

    const totalMemory = relevantMetrics.reduce((sum, m) => sum + m.heapUsedMB, 0);
    const totalResponseTime = relevantMetrics.reduce((sum, m) => sum + m.responseTime, 0);
    const peakMemory = Math.max(...relevantMetrics.map((m) => m.heapUsedMB));
    const peakResponseTime = Math.max(...relevantMetrics.map((m) => m.responseTime));

    return {
      averageMemoryUsage: totalMemory / relevantMetrics.length,
      averageResponseTime: totalResponseTime / relevantMetrics.length,
      totalRequests: this.requestCount,
      errorRate: this.calculateErrorRate(),
      cacheHitRate: this.calculateCacheHitRate(),
      peakMemoryUsage: peakMemory,
      peakResponseTime,
    };
  }

  public forceGarbageCollection()): void {
    try {
      if (global.gc) {
        global.gc();
        logger.info('Garbage collection forced');
      } else {
        logger.warn('Garbage collection not available (run with --expose-gc)');
      }
    } catch (error) {
      logger.error('Error forcing garbage collection:', { error});
    }
  }

  public generateReport(): string {
    const current = this.getCurrentMetrics();
    const aggregated = this.getAggregatedMetrics();

    return `;
=== Performance Report ===
Current Memory Usage: ${current.heapUsedMB}MB / ${current.heapTotalMB}MB
Current Response Time: ${current.responseTime}ms
Current Error Rate: ${current.errorRate}%
Current Cache Hit Rate: ${current.cacheHitRate}%
Active Connections: ${current.activeConnections}
Database Connections: ${current.databaseConnections}
Queue Size: ${current.queueSize}
Uptime: ${Math.round(current.uptime / 3600)}h ${Math.round((current.uptime % 3600) / 60)}m

=== 5-Minute Averages ===
Average Memory Usage: ${aggregated.averageMemoryUsage.toFixed(2)}MB
Average Response Time: ${aggregated.averageResponseTime.toFixed(2)}ms
Peak Memory Usage: ${aggregated.peakMemoryUsage}MB
Peak Response Time: ${aggregated.peakResponseTime}ms
Total Requests: ${aggregated.totalRequests}
Error Rate: ${aggregated.errorRate.toFixed(2)}%
Cache Hit Rate: ${aggregated.cacheHitRate.toFixed(2)}%

=== Garbage Collection ===
GC Count: ${current.gc?.count || 0}
Total GC Duration: ${current.gc?.duration || 0}ms
`;
  }
}

export const performanceMonitor = new PerformanceMonitor();

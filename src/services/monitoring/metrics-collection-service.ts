/**
 * Metrics Collection Service
 * Comprehensive metrics gathering for system monitoring
 */

import EventEmitter from 'events';
import os from 'os';
import { performance } from 'perf_hooks';

import { log, LogContext } from '@/utils/logger';

export interface RequestMetrics {
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userId?: string;
  userAgent?: string;
  ip?: string;
  contentLength?: number;
  errorMessage?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number[];
    cores: number;
    model: string;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
    process: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      external: number;
    };
  };
  disk?: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  network?: {
    bytesReceived: number;
    bytesSent: number;
  };
}

export interface BusinessMetrics {
  timestamp: Date;
  agentUsage: {
    totalRequests: number;
    activeAgents: number;
    successRate: number;
    avgResponseTime: number;
  };
  userActivity: {
    activeUsers: number;
    totalSessions: number;
    avgSessionDuration: number;
  };
  apiCalls: {
    total: number;
    byProvider: Record<string, number>;
    errorRate: number;
  };
}

export interface CustomMetric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export class MetricsCollectionService extends EventEmitter {
  private requestMetrics: RequestMetrics[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private businessMetrics: BusinessMetrics[] = [];
  private customMetrics: CustomMetric[] = [];
  
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly COLLECTION_INTERVAL = 5000; // 5 seconds
  
  private intervalId: NodeJS.Timer | null = null;
  private isCollecting = false;

  private requestCounters = new Map<string, number>();
  private responseTimeHistogram = new Map<string, number[]>();

  constructor() {
    super();
    this.startCollection();
  }

  /**
   * Record HTTP request metrics
   */
  recordRequest(metrics: RequestMetrics): void {
    this.requestMetrics.push(metrics);
    
    // Maintain sliding window
    if (this.requestMetrics.length > this.MAX_METRICS_HISTORY) {
      this.requestMetrics.shift();
    }

    // Update counters
    const key = `${metrics.method}:${metrics.path}`;
    this.requestCounters.set(key, (this.requestCounters.get(key) || 0) + 1);

    // Update response time histogram
    if (!this.responseTimeHistogram.has(key)) {
      this.responseTimeHistogram.set(key, []);
    }
    const times = this.responseTimeHistogram.get(key)!;
    times.push(metrics.responseTime);
    
    // Keep only last 100 response times per endpoint
    if (times.length > 100) {
      times.shift();
    }

    this.emit('request', metrics);
    
    // Log high response times
    if (metrics.responseTime > 5000) {
      log.warn('Slow request detected', LogContext.MONITORING, {
        path: metrics.path,
        responseTime: metrics.responseTime,
        statusCode: metrics.statusCode
      });
    }
  }

  /**
   * Record custom application metrics
   */
  recordCustomMetric(metric: CustomMetric): void {
    this.customMetrics.push(metric);
    
    if (this.customMetrics.length > this.MAX_METRICS_HISTORY) {
      this.customMetrics.shift();
    }

    this.emit('customMetric', metric);
  }

  /**
   * Create and record a counter metric
   */
  incrementCounter(name: string, value = 1, labels?: Record<string, string>): void {
    this.recordCustomMetric({
      name,
      value,
      labels,
      timestamp: new Date(),
      type: 'counter'
    });
  }

  /**
   * Create and record a gauge metric
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordCustomMetric({
      name,
      value,
      labels,
      timestamp: new Date(),
      type: 'gauge'
    });
  }

  /**
   * Record histogram metric
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordCustomMetric({
      name,
      value,
      labels,
      timestamp: new Date(),
      type: 'histogram'
    });
  }

  /**
   * Start automatic system metrics collection
   */
  private startCollection(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.intervalId = setInterval(() => {
      this.collectSystemMetrics();
      this.collectBusinessMetrics();
    }, this.COLLECTION_INTERVAL);

    log.info('Started metrics collection', LogContext.MONITORING);
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId as NodeJS.Timeout);
      this.intervalId = null;
    }
    this.isCollecting = false;
    log.info('Stopped metrics collection', LogContext.MONITORING);
  }

  /**
   * Collect system resource metrics
   */
  private collectSystemMetrics(): void {
    try {
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const systemMetric: SystemMetrics = {
        timestamp: new Date(),
        cpu: {
          usage: os.loadavg(),
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'Unknown',
          loadAverage: os.loadavg()
        },
        memory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          percentage: (usedMem / totalMem) * 100,
          process: {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            rss: memUsage.rss,
            external: memUsage.external
          }
        }
      };

      this.systemMetrics.push(systemMetric);
      
      if (this.systemMetrics.length > this.MAX_METRICS_HISTORY) {
        this.systemMetrics.shift();
      }

      this.emit('systemMetrics', systemMetric);

      // Check for concerning metrics
      if (systemMetric.memory.percentage > 90) {
        log.warn('High memory usage detected', LogContext.MONITORING, {
          percentage: systemMetric.memory.percentage.toFixed(2),
          usedMB: (usedMem / 1024 / 1024).toFixed(2)
        });
      }

      if (systemMetric.cpu.loadAverage[0] && systemMetric.cpu.loadAverage[0] > systemMetric.cpu.cores * 2) {
        log.warn('High CPU load detected', LogContext.MONITORING, {
          loadAverage: systemMetric.cpu.loadAverage[0],
          cores: systemMetric.cpu.cores
        });
      }

    } catch (error) {
      log.error('Failed to collect system metrics', LogContext.MONITORING, { error });
    }
  }

  /**
   * Collect business-specific metrics
   */
  private collectBusinessMetrics(): void {
    try {
      // Calculate recent request metrics
      const recentRequests = this.getRecentRequests(60000); // Last minute
      const totalRequests = recentRequests.length;
      const successfulRequests = recentRequests.filter(r => r.statusCode < 400).length;
      const avgResponseTime = totalRequests > 0 
        ? recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / totalRequests 
        : 0;

      const businessMetric: BusinessMetrics = {
        timestamp: new Date(),
        agentUsage: {
          totalRequests,
          activeAgents: this.getActiveAgentCount(),
          successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
          avgResponseTime
        },
        userActivity: {
          activeUsers: this.getActiveUserCount(),
          totalSessions: this.getTotalSessionCount(),
          avgSessionDuration: this.getAverageSessionDuration()
        },
        apiCalls: {
          total: totalRequests,
          byProvider: this.getApiCallsByProvider(),
          errorRate: totalRequests > 0 ? ((totalRequests - successfulRequests) / totalRequests) * 100 : 0
        }
      };

      this.businessMetrics.push(businessMetric);
      
      if (this.businessMetrics.length > this.MAX_METRICS_HISTORY) {
        this.businessMetrics.shift();
      }

      this.emit('businessMetrics', businessMetric);

    } catch (error) {
      log.error('Failed to collect business metrics', LogContext.MONITORING, { error });
    }
  }

  /**
   * Get recent request metrics within time window
   */
  private getRecentRequests(timeWindowMs: number): RequestMetrics[] {
    const cutoff = new Date(Date.now() - timeWindowMs);
    return this.requestMetrics.filter(r => r.timestamp >= cutoff);
  }

  /**
   * Get count of active agents (simplified estimation)
   */
  private getActiveAgentCount(): number {
    const recentRequests = this.getRecentRequests(300000); // Last 5 minutes
    const agentPaths = recentRequests
      .filter(r => r.path.includes('/agent') || r.path.includes('/chat'))
      .map(r => r.userId)
      .filter(Boolean);
    
    return new Set(agentPaths).size;
  }

  /**
   * Get count of active users
   */
  private getActiveUserCount(): number {
    const recentRequests = this.getRecentRequests(300000); // Last 5 minutes
    const userIds = recentRequests
      .map(r => r.userId)
      .filter(Boolean);
    
    return new Set(userIds).size;
  }

  /**
   * Get total session count (simplified)
   */
  private getTotalSessionCount(): number {
    return this.getActiveUserCount(); // Simplified for now
  }

  /**
   * Get average session duration (simplified)
   */
  private getAverageSessionDuration(): number {
    return 1800; // 30 minutes default
  }

  /**
   * Get API calls by provider
   */
  private getApiCallsByProvider(): Record<string, number> {
    const recentRequests = this.getRecentRequests(60000);
    const providers: Record<string, number> = {};

    recentRequests.forEach(request => {
      if (request.path.includes('/ollama')) {
        providers.ollama = (providers.ollama || 0) + 1;
      } else if (request.path.includes('/lfm2')) {
        providers.lfm2 = (providers.lfm2 || 0) + 1;
      } else if (request.path.includes('/claude')) {
        providers.claude = (providers.claude || 0) + 1;
      } else {
        providers.other = (providers.other || 0) + 1;
      }
    });

    return providers;
  }

  /**
   * Get request metrics for a specific endpoint
   */
  getEndpointMetrics(method: string, path: string): {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    p95ResponseTime: number;
  } {
    const key = `${method}:${path}`;
    const requestCount = this.requestCounters.get(key) || 0;
    const responseTimes = this.responseTimeHistogram.get(key) || [];
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    // Calculate 95th percentile
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p95ResponseTime = sortedTimes[p95Index] || 0;

    // Calculate error rate from recent requests
    const recentRequests = this.requestMetrics
      .filter(r => r.method === method && r.path === path && r.timestamp >= new Date(Date.now() - 3600000)); // Last hour
    
    const errors = recentRequests.filter(r => r.statusCode >= 400).length;
    const errorRate = recentRequests.length > 0 ? (errors / recentRequests.length) * 100 : 0;

    return {
      totalRequests: requestCount,
      avgResponseTime,
      errorRate,
      p95ResponseTime
    };
  }

  /**
   * Get recent system metrics
   */
  getRecentSystemMetrics(count = 10): SystemMetrics[] {
    return this.systemMetrics.slice(-count);
  }

  /**
   * Get recent business metrics
   */
  getRecentBusinessMetrics(count = 10): BusinessMetrics[] {
    return this.businessMetrics.slice(-count);
  }

  /**
   * Get recent custom metrics
   */
  getRecentCustomMetrics(count = 50): CustomMetric[] {
    return this.customMetrics.slice(-count);
  }

  /**
   * Get all metrics summary
   */
  getMetricsSummary(): {
    system: SystemMetrics | null;
    business: BusinessMetrics | null;
    requests: {
      total: number;
      recent: number;
      avgResponseTime: number;
      errorRate: number;
    };
    custom: {
      total: number;
      recent: number;
    };
  } {
    const recentRequests = this.getRecentRequests(60000);
    const errors = recentRequests.filter(r => r.statusCode >= 400).length;
    const avgResponseTime = recentRequests.length > 0 
      ? recentRequests.reduce((sum, r) => sum + r.responseTime, 0) / recentRequests.length 
      : 0;

    return {
      system: this.systemMetrics[this.systemMetrics.length - 1] || null,
      business: this.businessMetrics[this.businessMetrics.length - 1] || null,
      requests: {
        total: this.requestMetrics.length,
        recent: recentRequests.length,
        avgResponseTime,
        errorRate: recentRequests.length > 0 ? (errors / recentRequests.length) * 100 : 0
      },
      custom: {
        total: this.customMetrics.length,
        recent: this.getRecentCustomMetrics(10).length
      }
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];
    const now = Date.now();

    // System metrics
    const latestSystem = this.systemMetrics[this.systemMetrics.length - 1];
    if (latestSystem) {
      lines.push(`# HELP system_memory_usage_bytes Memory usage in bytes`);
      lines.push(`# TYPE system_memory_usage_bytes gauge`);
      lines.push(`system_memory_usage_bytes{type="used"} ${latestSystem.memory.used} ${now}`);
      lines.push(`system_memory_usage_bytes{type="free"} ${latestSystem.memory.free} ${now}`);
      lines.push(`system_memory_usage_bytes{type="total"} ${latestSystem.memory.total} ${now}`);

      lines.push(`# HELP system_cpu_load_average CPU load average`);
      lines.push(`# TYPE system_cpu_load_average gauge`);
      lines.push(`system_cpu_load_average{period="1m"} ${latestSystem.cpu.loadAverage[0]} ${now}`);
      lines.push(`system_cpu_load_average{period="5m"} ${latestSystem.cpu.loadAverage[1]} ${now}`);
      lines.push(`system_cpu_load_average{period="15m"} ${latestSystem.cpu.loadAverage[2]} ${now}`);
    }

    // Request metrics
    lines.push(`# HELP http_requests_total Total HTTP requests`);
    lines.push(`# TYPE http_requests_total counter`);
    
    for (const [endpoint, count] of this.requestCounters.entries()) {
      const [method, path] = endpoint.split(':');
      lines.push(`http_requests_total{method="${method}",path="${path}"} ${count} ${now}`);
    }

    // Custom metrics
    for (const metric of this.customMetrics.slice(-50)) {
      const labels = metric.labels 
        ? Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',')
        : '';
      
      lines.push(`# HELP ${metric.name} Custom metric`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      lines.push(`${metric.name}{${labels}} ${metric.value} ${metric.timestamp.getTime()}`);
    }

    return lines.join('\n');
  }

  /**
   * Clear all metrics history
   */
  clearHistory(): void {
    this.requestMetrics.length = 0;
    this.systemMetrics.length = 0;
    this.businessMetrics.length = 0;
    this.customMetrics.length = 0;
    this.requestCounters.clear();
    this.responseTimeHistogram.clear();
    
    log.info('Cleared metrics history', LogContext.MONITORING);
  }
}

// Singleton instance
export const metricsCollectionService = new MetricsCollectionService();
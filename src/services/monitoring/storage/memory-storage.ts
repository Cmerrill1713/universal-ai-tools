/**
 * In-Memory Monitoring Storage Backend
 * High-performance storage for development and lightweight deployments
 */

import { Logger } from '../../../utils/logger';
import type { Alert, HealthCheck, Metric, MonitoringStorage, TraceSpan } from '../types';

export class MemoryMonitoringStorage implements MonitoringStorage {
  private readonly logger: Logger;

  // In-memory data structures
  private metrics: Map<string, Metric[]> = new Map();
  private healthChecks: Map<string, HealthCheck[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private traces: Map<string, TraceSpan[]> = new Map();

  // Configuration
  private maxMetricsPerName: number;
  private maxHealthChecksPerService: number;
  private maxAlerts: number;
  private maxTraces: number;
  private maxTotalMetrics: number;

  constructor(config?: any) {
    this.logger = new Logger('MemoryMonitoringStorage');

    // Configurable limits to prevent memory bloat
    this.maxTotalMetrics =
      config?.maxMetrics || parseInt(process.env.MEMORY_STORAGE_MAX_TOTAL_METRICS || '1000', 10);
    this.maxMetricsPerName =
      config?.maxMetricsPerName || parseInt(process.env.MEMORY_STORAGE_MAX_METRICS || '10000', 10);
    this.maxHealthChecksPerService =
      config?.maxHealthChecks ||
      parseInt(process.env.MEMORY_STORAGE_MAX_HEALTH_CHECKS || '1000', 10);
    this.maxAlerts =
      config?.maxAlerts || parseInt(process.env.MEMORY_STORAGE_MAX_ALERTS || '5000', 10);
    this.maxTraces =
      config?.maxTraces || parseInt(process.env.MEMORY_STORAGE_MAX_TRACES || '1000', 10);
  }

  async initialize(config?: any): Promise<void> {
    // Update configuration if provided
    if (config) {
      if (config.maxMetrics) this.maxTotalMetrics = config.maxMetrics;
      if (config.maxMetricsPerName) this.maxMetricsPerName = config.maxMetricsPerName;
      if (config.maxHealthChecks) this.maxHealthChecksPerService = config.maxHealthChecks;
      if (config.maxAlerts) this.maxAlerts = config.maxAlerts;
      if (config.maxTraces) this.maxTraces = config.maxTraces;
    }

    this.logger.info('Memory monitoring storage initialized');
  }

  // Metrics Storage
  async storeMetric(metric: Metric): Promise<void> {
    // Check total metrics limit first
    const totalMetrics = this.getTotalMetricsCount();
    if (totalMetrics >= this.maxTotalMetrics) {
      // Remove oldest metrics from any name to make room
      this.evictOldestMetrics();
    }

    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricArray = this.metrics.get(metric.name)!;
    metricArray.push(metric);

    // Enforce per-name size limits
    if (metricArray.length > this.maxMetricsPerName) {
      // Remove oldest metrics (FIFO)
      metricArray.splice(0, metricArray.length - this.maxMetricsPerName);
    }

    this.logger.debug(`Stored metric ${metric.name} in memory`);
  }

  private getTotalMetricsCount(): number {
    let total = 0;
    for (const metricArray of this.metrics.values()) {
      total += metricArray.length;
    }
    return total;
  }

  private evictOldestMetrics(): void {
    // Find the oldest metric across all names and remove it
    let oldestMetric: Metric | null = null;
    let oldestName: string | null = null;
    let oldestIndex = -1;

    for (const [name, metricArray] of this.metrics) {
      if (metricArray.length > 0) {
        const firstMetric = metricArray[0];
        if (!oldestMetric || firstMetric.timestamp < oldestMetric.timestamp) {
          oldestMetric = firstMetric;
          oldestName = name;
          oldestIndex = 0;
        }
      }
    }

    if (oldestName && oldestIndex >= 0) {
      const metricArray = this.metrics.get(oldestName)!;
      metricArray.splice(oldestIndex, 1);

      // Clean up empty arrays
      if (metricArray.length === 0) {
        this.metrics.delete(oldestName);
      }
    }
  }

  async storeMetrics(metrics: Metric[]): Promise<void> {
    for (const metric of metrics) {
      await this.storeMetric(metric);
    }

    this.logger.debug(`Stored ${metrics.length} metrics in memory`);
  }

  async queryMetrics(query: any): Promise<Metric[]> {
    let allMetrics: Metric[] = [];

    if (query.name) {
      // Query specific metric name
      const metricArray = this.metrics.get(query.name) || [];
      allMetrics = [...metricArray];
    } else {
      // Query all metrics
      for (const metricArray of this.metrics.values()) {
        allMetrics.push(...metricArray);
      }
    }

    // Apply time range filter
    if (query.timeRange) {
      allMetrics = allMetrics.filter(
        metric =>
          metric.timestamp >= new Date(query.timeRange.start) &&
          metric.timestamp <= new Date(query.timeRange.end)
      );
    }

    // Apply label filters
    if (query.labels) {
      allMetrics = allMetrics.filter(metric => {
        if (!metric.labels) return false;
        return Object.entries(query.labels).every(([key, value]) => metric.labels![key] === value);
      });
    }

    // Sort by timestamp
    allMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply limit
    if (query.limit) {
      allMetrics = allMetrics.slice(0, query.limit);
    }

    return allMetrics;
  }

  async getMetrics(name: string, timeRange: { start: Date; end: Date }): Promise<Metric[]> {
    return this.queryMetrics({
      name,
      timeRange,
    });
  }

  // Health Check Storage
  async storeHealthCheck(check: HealthCheck): Promise<void> {
    if (!this.healthChecks.has(check.service)) {
      this.healthChecks.set(check.service, []);
    }

    const checkArray = this.healthChecks.get(check.service)!;
    checkArray.push(check);

    // Enforce size limits
    if (checkArray.length > this.maxHealthChecksPerService) {
      checkArray.splice(0, checkArray.length - this.maxHealthChecksPerService);
    }

    this.logger.debug(`Stored health check for ${check.service}`);
  }

  async getHealthChecks(service?: string): Promise<HealthCheck[]> {
    if (service) {
      const checks = this.healthChecks.get(service) || [];
      return [...checks].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    // Return latest health check for each service
    const latestChecks: HealthCheck[] = [];
    for (const [serviceName, checks] of this.healthChecks) {
      if (checks.length > 0) {
        latestChecks.push(checks[checks.length - 1]);
      }
    }

    return latestChecks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Alert Storage
  async storeAlert(alert: Alert): Promise<void> {
    this.alerts.set(alert.id, alert);

    // Enforce size limits
    if (this.alerts.size > this.maxAlerts) {
      // Remove oldest resolved alerts first
      const sortedAlerts = Array.from(this.alerts.values()).sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );

      for (const alert of sortedAlerts) {
        if (alert.status === 'resolved' && this.alerts.size > this.maxAlerts) {
          this.alerts.delete(alert.id);
        }
      }
    }

    this.logger.debug(`Stored alert ${alert.id}`);
  }

  async getAlerts(status?: 'firing' | 'resolved'): Promise<Alert[]> {
    const alerts = Array.from(this.alerts.values());

    const filtered = status ? alerts.filter(alert => alert.status === status) : alerts;

    return filtered.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<void> {
    const existingAlert = this.alerts.get(alertId);
    if (!existingAlert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const updatedAlert = { ...existingAlert, ...updates };
    this.alerts.set(alertId, updatedAlert);

    this.logger.debug(`Updated alert ${alertId}`);
  }

  // Trace Storage
  async storeTrace(span: TraceSpan): Promise<void> {
    if (!this.traces.has(span.traceId)) {
      this.traces.set(span.traceId, []);
    }

    const spanArray = this.traces.get(span.traceId)!;
    spanArray.push(span);

    // Enforce global trace limit
    if (this.traces.size > this.maxTraces) {
      // Remove oldest trace
      const oldestTraceId = Array.from(this.traces.keys())[0];
      this.traces.delete(oldestTraceId);
    }

    this.logger.debug(`Stored trace span ${span.spanId} for trace ${span.traceId}`);
  }

  async getTraces(traceId?: string): Promise<TraceSpan[]> {
    if (traceId) {
      return this.traces.get(traceId) || [];
    }

    // Return all spans from all traces
    const allSpans: TraceSpan[] = [];
    for (const spans of this.traces.values()) {
      allSpans.push(...spans);
    }

    return allSpans.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  // Cleanup
  async cleanup(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    let cleanedCount = 0;

    // Clean old metrics
    for (const [name, metricArray] of this.metrics) {
      const initialLength = metricArray.length;
      const filtered = metricArray.filter(metric => metric.timestamp > cutoffTime);

      if (filtered.length !== initialLength) {
        this.metrics.set(name, filtered);
        cleanedCount += initialLength - filtered.length;
      }
    }

    // Clean old health checks
    for (const [service, checkArray] of this.healthChecks) {
      const initialLength = checkArray.length;
      const filtered = checkArray.filter(check => check.timestamp > cutoffTime);

      if (filtered.length !== initialLength) {
        this.healthChecks.set(service, filtered);
        cleanedCount += initialLength - filtered.length;
      }
    }

    // Clean old resolved alerts
    const alertsToDelete: string[] = [];
    for (const [id, alert] of this.alerts) {
      if (alert.status === 'resolved' && alert.endTime && alert.endTime < cutoffTime) {
        alertsToDelete.push(id);
      }
    }

    for (const id of alertsToDelete) {
      this.alerts.delete(id);
      cleanedCount++;
    }

    // Clean old traces
    const tracesToDelete: string[] = [];
    for (const [traceId, spans] of this.traces) {
      const oldestSpan = spans.reduce((oldest, span) =>
        span.startTime < oldest.startTime ? span : oldest
      );

      if (oldestSpan.startTime < cutoffTime) {
        tracesToDelete.push(traceId);
      }
    }

    for (const traceId of tracesToDelete) {
      const spans = this.traces.get(traceId) || [];
      this.traces.delete(traceId);
      cleanedCount += spans.length;
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old records from memory storage`);
    }
  }

  // Storage statistics for monitoring
  getStorageStats() {
    const metricCounts = Array.from(this.metrics.values()).reduce(
      (total, array) => total + array.length,
      0
    );

    const healthCheckCounts = Array.from(this.healthChecks.values()).reduce(
      (total, array) => total + array.length,
      0
    );

    const traceCounts = Array.from(this.traces.values()).reduce(
      (total, array) => total + array.length,
      0
    );

    return {
      metrics: {
        uniqueNames: this.metrics.size,
        totalRecords: metricCounts,
        maxPerName: this.maxMetricsPerName,
      },
      healthChecks: {
        uniqueServices: this.healthChecks.size,
        totalRecords: healthCheckCounts,
        maxPerService: this.maxHealthChecksPerService,
      },
      alerts: {
        total: this.alerts.size,
        firing: Array.from(this.alerts.values()).filter(a => a.status === 'firing').length,
        resolved: Array.from(this.alerts.values()).filter(a => a.status === 'resolved').length,
        maxTotal: this.maxAlerts,
      },
      traces: {
        uniqueTraces: this.traces.size,
        totalSpans: traceCounts,
        maxTraces: this.maxTraces,
      },
    };
  }
}

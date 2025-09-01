import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';
import { redisService } from './redis-service-rust';
import { supabase } from '../config/supabase';
import * as os from 'os';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  unit?: string;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  service: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    fields?: Record<string, any>;
  }>;
  status: 'ok' | 'error' | 'cancelled';
  errorMessage?: string;
}

export interface Alert {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'silenced';
  condition: AlertCondition;
  channels: AlertChannel[];
  metadata: Record<string, any>;
  triggeredAt?: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  occurrenceCount: number;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  duration: number; // seconds
  aggregation?: 'avg' | 'sum' | 'max' | 'min' | 'count';
  tags?: Record<string, string>;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'discord';
  config: Record<string, any>;
  enabled: boolean;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  throughput: number;
  dependencies: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
  }>;
  metrics: Record<string, number>;
  incidents: Array<{
    id: string;
    severity: string;
    description: string;
    startTime: Date;
    endTime?: Date;
  }>;
}

export interface PerformanceProfile {
  service: string;
  endpoint: string;
  method: string;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  trends: {
    latencyTrend: 'improving' | 'stable' | 'degrading';
    throughputTrend: 'increasing' | 'stable' | 'decreasing';
    errorTrend: 'improving' | 'stable' | 'worsening';
  };
  anomalies: Array<{
    type: 'latency_spike' | 'error_surge' | 'throughput_drop';
    severity: 'low' | 'medium' | 'high';
    detected: Date;
    description: string;
  }>;
}

export class AdvancedMonitoringService extends EventEmitter {
  private metrics = new Map<string, MetricPoint[]>();
  private activeTraces = new Map<string, TraceSpan>();
  private completedTraces = new Map<string, TraceSpan>();
  private activeAlerts = new Map<string, Alert>();
  private serviceHealthMap = new Map<string, ServiceHealth>();
  private performanceProfiles = new Map<string, PerformanceProfile>();
  private metricBuffers = new Map<string, MetricPoint[]>();
  private isInitialized = false;

  // Configuration
  private config = {
    metricsRetentionDays: 30,
    tracesRetentionDays: 7,
    healthCheckInterval: 30000, // 30 seconds
    metricsFlushInterval: 10000, // 10 seconds
    anomalyDetectionEnabled: true,
    alertEvaluationInterval: 60000, // 1 minute
    maxMetricsPerFlush: 1000,
    enableDistributedTracing: true,
    sampleRate: 0.1 // 10% sampling for traces
  };

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load existing alerts and configurations
      await this.loadAlertsFromDatabase();
      await this.loadServiceHealthState();

      // Start monitoring loops
      this.startHealthChecks();
      this.startMetricsCollection();
      this.startAlertEvaluation();
      this.startAnomalyDetection();

      // Set up cleanup jobs
      this.startCleanupJobs();

      this.isInitialized = true;
      Logger.info('Advanced Monitoring Service initialized');
      
      this.emit('serviceInitialized', {
        timestamp: new Date(),
        config: this.config
      });

    } catch (error) {
      Logger.error('Failed to initialize Advanced Monitoring Service:', error);
      throw error;
    }
  }

  /**
   * Record a metric point
   */
  recordMetric(
    name: string,
    value: number,
    options: {
      type?: 'counter' | 'gauge' | 'histogram' | 'timer';
      tags?: Record<string, string>;
      unit?: string;
      timestamp?: Date;
    } = {}
  ): void {
    const metric: MetricPoint = {
      name,
      value,
      timestamp: options.timestamp || new Date(),
      tags: options.tags || {},
      type: options.type || 'gauge',
      unit: options.unit
    };

    // Add to buffer for batch processing
    if (!this.metricBuffers.has(name)) {
      this.metricBuffers.set(name, []);
    }
    this.metricBuffers.get(name)!.push(metric);

    // Add to in-memory storage for immediate queries
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only recent metrics in memory
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    this.metrics.set(name, metricHistory.filter(m => m.timestamp > cutoff));

    this.emit('metricRecorded', { metric });
  }

  /**
   * Start a new trace span
   */
  startSpan(
    operationName: string,
    options: {
      service?: string;
      parentSpanId?: string;
      traceId?: string;
      tags?: Record<string, any>;
    } = {}
  ): string {
    const spanId = uuidv4();
    const traceId = options.traceId || uuidv4();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      operationName,
      service: options.service || 'unknown',
      startTime: new Date(),
      tags: options.tags || {},
      logs: [],
      status: 'ok'
    };

    this.activeTraces.set(spanId, span);

    this.emit('spanStarted', { span });

    return spanId;
  }

  /**
   * Finish a trace span
   */
  finishSpan(
    spanId: string,
    options: {
      status?: 'ok' | 'error' | 'cancelled';
      errorMessage?: string;
      tags?: Record<string, any>;
    } = {}
  ): void {
    const span = this.activeTraces.get(spanId);
    if (!span) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = options.status || 'ok';
    span.errorMessage = options.errorMessage;

    if (options.tags) {
      span.tags = { ...span.tags, ...options.tags };
    }

    // Move from active to completed
    this.activeTraces.delete(spanId);
    this.completedTraces.set(spanId, span);

    // Store in database if sampling allows
    if (Math.random() < this.config.sampleRate) {
      this.storeTrace(span);
    }

    this.emit('spanFinished', { span });

    // Clean up old completed traces
    if (this.completedTraces.size > 10000) {
      const oldestSpans = Array.from(this.completedTraces.entries())
        .sort(([,a], [,b]) => a.startTime.getTime() - b.startTime.getTime())
        .slice(0, 1000);
      
      oldestSpans.forEach(([id]) => this.completedTraces.delete(id));
    }
  }

  /**
   * Add log to a trace span
   */
  addSpanLog(
    spanId: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    fields?: Record<string, any>
  ): void {
    const span = this.activeTraces.get(spanId);
    if (!span) return;

    span.logs.push({
      timestamp: new Date(),
      level,
      message,
      fields
    });
  }

  /**
   * Create or update an alert
   */
  async createAlert(
    name: string,
    description: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    condition: AlertCondition,
    channels: AlertChannel[]
  ): Promise<string> {
    const alertId = uuidv4();

    const alert: Alert = {
      id: alertId,
      name,
      description,
      severity,
      status: 'active',
      condition,
      channels: channels.filter(c => c.enabled),
      metadata: {},
      occurrenceCount: 0
    };

    this.activeAlerts.set(alertId, alert);

    // Save to database
    await this.saveAlertToDatabase(alert);

    // Cache in Redis
    await redisService.set(`alert:${alertId}`, alert, 86400);

    Logger.info(`Created alert: ${name}`, { alertId, severity });

    this.emit('alertCreated', { alert });

    return alertId;
  }

  /**
   * Get service health status
   */
  async getServiceHealth(serviceName?: string): Promise<ServiceHealth[]> {
    if (serviceName) {
      const health = this.serviceHealthMap.get(serviceName);
      return health ? [health] : [];
    }

    return Array.from(this.serviceHealthMap.values());
  }

  /**
   * Get performance profile for an endpoint
   */
  async getPerformanceProfile(
    service: string,
    endpoint?: string
  ): Promise<PerformanceProfile[]> {
    const key = endpoint ? `${service}:${endpoint}` : service;
    
    if (endpoint) {
      const profile = this.performanceProfiles.get(key);
      return profile ? [profile] : [];
    }

    // Return all profiles for service
    return Array.from(this.performanceProfiles.entries())
      .filter(([k]) => k.startsWith(`${service}:`))
      .map(([, profile]) => profile);
  }

  /**
   * Query metrics with aggregation
   */
  async queryMetrics(
    metricName: string,
    options: {
      startTime?: Date;
      endTime?: Date;
      tags?: Record<string, string>;
      aggregation?: 'avg' | 'sum' | 'max' | 'min' | 'count';
      interval?: number; // seconds
    } = {}
  ): Promise<Array<{
    timestamp: Date;
    value: number;
    tags: Record<string, string>;
  }>> {
    const metrics = this.metrics.get(metricName) || [];
    
    let filtered = metrics;

    // Apply time filtering
    if (options.startTime) {
      filtered = filtered.filter(m => m.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      filtered = filtered.filter(m => m.timestamp <= options.endTime!);
    }

    // Apply tag filtering
    if (options.tags) {
      filtered = filtered.filter(m => {
        return Object.entries(options.tags!).every(([key, value]) => 
          m.tags[key] === value
        );
      });
    }

    // Apply aggregation if interval is specified
    if (options.interval) {
      return this.aggregateMetrics(filtered, options.interval, options.aggregation);
    }

    return filtered.map(m => ({
      timestamp: m.timestamp,
      value: m.value,
      tags: m.tags
    }));
  }

  /**
   * Get distributed trace by ID
   */
  async getTrace(traceId: string): Promise<TraceSpan[]> {
    // Get from active traces
    const activeSpans = Array.from(this.activeTraces.values())
      .filter(span => span.traceId === traceId);

    // Get from completed traces
    const completedSpans = Array.from(this.completedTraces.values())
      .filter(span => span.traceId === traceId);

    // Combine and sort by start time
    const allSpans = [...activeSpans, ...completedSpans]
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return allSpans;
  }

  /**
   * Search traces by criteria
   */
  async searchTraces(criteria: {
    service?: string;
    operationName?: string;
    tags?: Record<string, any>;
    minDuration?: number;
    maxDuration?: number;
    hasErrors?: boolean;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<TraceSpan[]> {
    let traces = Array.from(this.completedTraces.values());

    // Apply filters
    if (criteria.service) {
      traces = traces.filter(t => t.service === criteria.service);
    }
    if (criteria.operationName) {
      traces = traces.filter(t => t.operationName.includes(criteria.operationName!));
    }
    if (criteria.tags) {
      traces = traces.filter(t => {
        return Object.entries(criteria.tags!).every(([key, value]) =>
          t.tags[key] === value
        );
      });
    }
    if (criteria.minDuration !== undefined) {
      traces = traces.filter(t => t.duration && t.duration >= criteria.minDuration!);
    }
    if (criteria.maxDuration !== undefined) {
      traces = traces.filter(t => t.duration && t.duration <= criteria.maxDuration!);
    }
    if (criteria.hasErrors === true) {
      traces = traces.filter(t => t.status === 'error');
    }
    if (criteria.startTime) {
      traces = traces.filter(t => t.startTime >= criteria.startTime!);
    }
    if (criteria.endTime) {
      traces = traces.filter(t => t.startTime <= criteria.endTime!);
    }

    // Sort by start time (newest first)
    traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Apply limit
    if (criteria.limit) {
      traces = traces.slice(0, criteria.limit);
    }

    return traces;
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(severity?: string): Promise<Alert[]> {
    let alerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.status === 'active');

    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999);
    });
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    await this.updateAlertInDatabase(alert);

    Logger.info(`Alert acknowledged: ${alert.name}`, { alertId, acknowledgedBy });

    this.emit('alertAcknowledged', { alert, acknowledgedBy });
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy?: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    if (resolvedBy) {
      alert.metadata.resolvedBy = resolvedBy;
    }

    await this.updateAlertInDatabase(alert);

    Logger.info(`Alert resolved: ${alert.name}`, { alertId, resolvedBy });

    this.emit('alertResolved', { alert, resolvedBy });
  }

  /**
   * Get system overview with key metrics
   */
  async getSystemOverview(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
    alerts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    performance: {
      averageResponseTime: number;
      throughput: number;
      errorRate: number;
    };
    resources: {
      cpuUsage: number;
      memoryUsage: number;
      diskUsage: number;
    };
    uptime: number;
  }> {
    const services = Array.from(this.serviceHealthMap.values());
    const alerts = Array.from(this.activeAlerts.values()).filter(a => a.status === 'active');

    // Calculate service status counts
    const servicesCounts = {
      total: services.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length
    };

    // Calculate alert counts by severity
    const alertCounts = {
      critical: alerts.filter(a => a.severity === 'critical').length,
      high: alerts.filter(a => a.severity === 'high').length,
      medium: alerts.filter(a => a.severity === 'medium').length,
      low: alerts.filter(a => a.severity === 'low').length
    };

    // Calculate overall system status
    let systemStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (alertCounts.critical > 0 || servicesCounts.unhealthy > 0) {
      systemStatus = 'unhealthy';
    } else if (alertCounts.high > 0 || servicesCounts.degraded > 0) {
      systemStatus = 'degraded';
    }

    // Calculate performance metrics
    const performance = {
      averageResponseTime: services.length > 0 
        ? services.reduce((sum, s) => sum + s.responseTime, 0) / services.length 
        : 0,
      throughput: services.reduce((sum, s) => sum + s.throughput, 0),
      errorRate: services.length > 0
        ? services.reduce((sum, s) => sum + s.errorRate, 0) / services.length
        : 0
    };

    // Get system resources
    const resources = await this.getSystemResources();

    return {
      status: systemStatus,
      services: servicesCounts,
      alerts: alertCounts,
      performance,
      resources,
      uptime: process.uptime() * 1000
    };
  }

  private async getSystemResources(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  }> {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      cpuUsage: os.loadavg()[0] / os.cpus().length * 100,
      memoryUsage: (totalMem - freeMem) / totalMem * 100,
      diskUsage: 0 // Would need to implement disk usage calculation
    };
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        Logger.error('Health check error:', error);
      }
    }, this.config.healthCheckInterval);
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
        await this.flushMetricsToStorage();
      } catch (error) {
        Logger.error('Metrics collection error:', error);
      }
    }, this.config.metricsFlushInterval);
  }

  private startAlertEvaluation(): void {
    setInterval(async () => {
      try {
        await this.evaluateAlerts();
      } catch (error) {
        Logger.error('Alert evaluation error:', error);
      }
    }, this.config.alertEvaluationInterval);
  }

  private startAnomalyDetection(): void {
    if (!this.config.anomalyDetectionEnabled) return;

    setInterval(async () => {
      try {
        await this.detectAnomalies();
      } catch (error) {
        Logger.error('Anomaly detection error:', error);
      }
    }, 60000); // Every minute
  }

  private startCleanupJobs(): void {
    // Clean up old metrics and traces daily
    setInterval(async () => {
      try {
        await this.cleanupOldData();
      } catch (error) {
        Logger.error('Cleanup job error:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily
  }

  private async performHealthChecks(): Promise<void> {
    // Check system health
    const systemHealth: ServiceHealth = {
      service: 'system',
      status: 'healthy',
      lastCheck: new Date(),
      responseTime: 0,
      errorRate: 0,
      throughput: 0,
      dependencies: [],
      metrics: await this.getSystemResources(),
      incidents: []
    };

    this.serviceHealthMap.set('system', systemHealth);

    // Emit health check event
    this.emit('healthCheck', { services: Array.from(this.serviceHealthMap.values()) });
  }

  private async collectSystemMetrics(): Promise<void> {
    const resources = await this.getSystemResources();
    const timestamp = new Date();

    // Record system metrics
    this.recordMetric('system.cpu.usage', resources.cpuUsage, { 
      type: 'gauge', 
      unit: 'percent',
      timestamp 
    });

    this.recordMetric('system.memory.usage', resources.memoryUsage, { 
      type: 'gauge', 
      unit: 'percent',
      timestamp 
    });

    this.recordMetric('system.disk.usage', resources.diskUsage, { 
      type: 'gauge', 
      unit: 'percent',
      timestamp 
    });

    // Record active traces and spans
    this.recordMetric('tracing.active_spans', this.activeTraces.size, {
      type: 'gauge',
      timestamp
    });

    this.recordMetric('tracing.completed_spans', this.completedTraces.size, {
      type: 'gauge', 
      timestamp
    });

    // Record alert metrics
    const activeAlerts = Array.from(this.activeAlerts.values()).filter(a => a.status === 'active');
    this.recordMetric('alerts.active', activeAlerts.length, {
      type: 'gauge',
      timestamp
    });

    activeAlerts.forEach(alert => {
      this.recordMetric('alerts.by_severity', 1, {
        type: 'counter',
        tags: { severity: alert.severity },
        timestamp
      });
    });
  }

  private async flushMetricsToStorage(): Promise<void> {
    const batchedMetrics: MetricPoint[] = [];

    // Collect metrics from buffers
    for (const [name, metrics] of this.metricBuffers.entries()) {
      batchedMetrics.push(...metrics.splice(0, this.config.maxMetricsPerFlush));
    }

    if (batchedMetrics.length === 0) return;

    try {
      // Store in database
      await this.storeMetricsBatch(batchedMetrics);

      // Store in Redis for real-time queries
      await redisService.set('metrics:latest', batchedMetrics, 300);

      this.emit('metricsFlushed', { count: batchedMetrics.length });

    } catch (error) {
      Logger.error('Failed to flush metrics to storage:', error);
    }
  }

  private async evaluateAlerts(): Promise<void> {
    for (const alert of this.activeAlerts.values()) {
      if (alert.status !== 'active') continue;

      try {
        const isTriggered = await this.evaluateAlertCondition(alert);
        
        if (isTriggered && !alert.triggeredAt) {
          // Alert just triggered
          alert.triggeredAt = new Date();
          alert.occurrenceCount++;
          
          await this.sendAlertNotifications(alert);
          
          this.emit('alertTriggered', { alert });
          
        } else if (!isTriggered && alert.triggeredAt) {
          // Alert condition resolved
          alert.resolvedAt = new Date();
          alert.status = 'resolved';
          
          this.emit('alertResolved', { alert });
        }

        await this.updateAlertInDatabase(alert);

      } catch (error) {
        Logger.error(`Failed to evaluate alert: ${alert.name}`, error);
      }
    }
  }

  private async evaluateAlertCondition(alert: Alert): Promise<boolean> {
    const { condition } = alert;
    
    // Get recent metrics for evaluation
    const metrics = await this.queryMetrics(condition.metric, {
      startTime: new Date(Date.now() - condition.duration * 1000),
      tags: condition.tags
    });

    if (metrics.length === 0) return false;

    // Apply aggregation
    let value: number;
    switch (condition.aggregation) {
      case 'avg':
        value = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        break;
      case 'sum':
        value = metrics.reduce((sum, m) => sum + m.value, 0);
        break;
      case 'max':
        value = Math.max(...metrics.map(m => m.value));
        break;
      case 'min':
        value = Math.min(...metrics.map(m => m.value));
        break;
      case 'count':
        value = metrics.length;
        break;
      default:
        value = metrics[metrics.length - 1]?.value || 0;
    }

    // Evaluate condition
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return Math.abs(value - condition.threshold) < 0.0001;
      case '!=':
        return Math.abs(value - condition.threshold) >= 0.0001;
      default:
        return false;
    }
  }

  private async sendAlertNotifications(alert: Alert): Promise<void> {
    for (const channel of alert.channels) {
      if (!channel.enabled) continue;

      try {
        await this.sendNotification(channel, alert);
      } catch (error) {
        Logger.error(`Failed to send alert notification via ${channel.type}:`, error);
      }
    }
  }

  private async sendNotification(channel: AlertChannel, alert: Alert): Promise<void> {
    const message = this.formatAlertMessage(alert);

    switch (channel.type) {
      case 'webhook':
        // Send webhook notification
        break;
      case 'slack':
        // Send Slack notification
        break;
      case 'email':
        // Send email notification
        break;
      // Add other notification types
    }
  }

  private formatAlertMessage(alert: Alert): string {
    return `🚨 **${alert.severity.toUpperCase()} Alert: ${alert.name}**

**Description:** ${alert.description}
**Triggered:** ${alert.triggeredAt?.toISOString()}
**Condition:** ${alert.condition.metric} ${alert.condition.operator} ${alert.condition.threshold}
**Occurrences:** ${alert.occurrenceCount}

Please investigate and acknowledge this alert.`;
  }

  private async detectAnomalies(): Promise<void> {
    // Implement anomaly detection algorithms
    // This would analyze metrics patterns and detect unusual behavior
  }

  private async cleanupOldData(): Promise<void> {
    const metricsOlderThan = new Date(Date.now() - this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);
    const tracesOlderThan = new Date(Date.now() - this.config.tracesRetentionDays * 24 * 60 * 60 * 1000);

    // Clean up old metrics
    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp > metricsOlderThan);
      this.metrics.set(name, filtered);
    }

    // Clean up old traces
    for (const [spanId, span] of this.completedTraces.entries()) {
      if (span.startTime < tracesOlderThan) {
        this.completedTraces.delete(spanId);
      }
    }

    Logger.info('Completed data cleanup', {
      metricsRetainedDays: this.config.metricsRetentionDays,
      tracesRetainedDays: this.config.tracesRetentionDays
    });
  }

  private aggregateMetrics(
    metrics: MetricPoint[], 
    intervalSeconds: number, 
    aggregation?: string
  ): Array<{ timestamp: Date; value: number; tags: Record<string, string> }> {
    // Implementation for metric aggregation
    return [];
  }

  private async storeTrace(span: TraceSpan): Promise<void> {
    // Store trace in database
  }

  private async storeMetricsBatch(metrics: MetricPoint[]): Promise<void> {
    // Store metrics batch in database
  }

  private async loadAlertsFromDatabase(): Promise<void> {
    // Load alerts from database
  }

  private async loadServiceHealthState(): Promise<void> {
    // Load service health state from database/cache
  }

  private async saveAlertToDatabase(alert: Alert): Promise<void> {
    // Save alert to database
  }

  private async updateAlertInDatabase(alert: Alert): Promise<void> {
    // Update alert in database
  }

  async shutdown(): Promise<void> {
    // Final metrics flush
    await this.flushMetricsToStorage();

    // Clear all maps
    this.metrics.clear();
    this.activeTraces.clear();
    this.completedTraces.clear();
    this.activeAlerts.clear();
    this.serviceHealthMap.clear();
    this.performanceProfiles.clear();
    this.metricBuffers.clear();

    Logger.info('Advanced Monitoring Service shut down');
  }
}

export const advancedMonitoringService = new AdvancedMonitoringService();
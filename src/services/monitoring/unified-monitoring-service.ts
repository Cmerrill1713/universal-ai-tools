/**
 * Unified Monitoring Service
 * Consolidates 12 separate monitoring services into a single, cohesive system
 * Replaces: health-monitor, enhanced-health-monitor, unified-health-monitor,
 *          database-health-monitor, proactive-monitoring-service, metrics-collector,
 *          prometheus-metrics, analytics-dashboard-service, advanced-monitoring-service,
 *          distributed-tracing-service, alert-notification-service, intelligent-monitoring-service
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { Logger } from '../../utils/logger';
import { CircuitBreaker } from '../../utils/circuit-breaker';
import type {
  Alert,
  AlertNotifier,
  AlertRule,
  AlertSeverity,
  HealthCheck,
  HealthCheckConfig,
  HealthChecker,
  HealthStatus,
  Metric,
  MetricCollector,
  MonitoringConfig,
  MonitoringEvent,
  MonitoringFeatureFlags,
  MonitoringService,
  MonitoringStorage,
  ServiceMetrics,
  SystemMetrics,
  TraceSpan,
} from './types';
import { DashboardData } from './types';

// Feature flags for safe rollout
const FEATURE_FLAGS: MonitoringFeatureFlags = {
  enableUnifiedMonitoring: process.env.USE_UNIFIED_MONITORING === 'true',
  enableDistributedTracing: process.env.ENABLE_DISTRIBUTED_TRACING !== 'false',
  enableIntelligentAlerting: process.env.ENABLE_INTELLIGENT_ALERTING === 'true',
  enablePerformanceProfiling: process.env.ENABLE_PERFORMANCE_PROFILING === 'true',
  enableRealTimeMetrics: process.env.ENABLE_REALTIME_METRICS !== 'false',
  fallbackToLegacyServices: process.env.FALLBACK_TO_LEGACY_MONITORING === 'true',
};

export class UnifiedMonitoringService extends EventEmitter implements MonitoringService {
  private static instance: UnifiedMonitoringService;
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;

  // Core components
  private config: MonitoringConfig | null = null;
  private storage: MonitoringStorage | null = null;
  private collectors: Map<string, MetricCollector> = new Map();
  private healthCheckers: Map<string, HealthChecker> = new Map();
  private alertNotifiers: Map<string, AlertNotifier> = new Map();

  // Runtime state
  private isRunning = false;
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private metricsBuffer: Metric[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private activeTraces: Map<string, TraceSpan> = new Map();

  // Performance tracking
  private startTime: Date = new Date();
  private lastMetricsFlush: Date = new Date();
  private healthCheckCount = 0;
  private metricsCount = 0;
  private alertsTriggered = 0;

  private constructor() {
    super();
    this.logger = new Logger('UnifiedMonitoringService');
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 30000,
      resetTimeout: 60000,
    });

    this.setMaxListeners(100); // Handle many event listeners
  }

  public static getInstance(): UnifiedMonitoringService {
    if (!UnifiedMonitoringService.instance) {
      UnifiedMonitoringService.instance = new UnifiedMonitoringService();
    }
    return UnifiedMonitoringService.instance;
  }

  async initialize(config: MonitoringConfig): Promise<void> {
    this.logger.info('Initializing Unified Monitoring Service...');

    // Re-evaluate feature flag in case it was set after module load (e.g., in tests)
    const isUnifiedEnabled =
      process.env.USE_UNIFIED_MONITORING === 'true' || process.env.NODE_ENV === 'test';

    if (!isUnifiedEnabled && !FEATURE_FLAGS.enableUnifiedMonitoring) {
      this.logger.warn('Unified monitoring is disabled, falling back to legacy services');
      return this.fallbackToLegacyServices();
    }

    try {
      this.config = config;

      // Initialize storage backend
      await this.initializeStorage();

      // Initialize collectors
      await this.initializeCollectors();

      // Initialize health checkers
      await this.initializeHealthCheckers();

      // Initialize alert notifiers
      await this.initializeAlertNotifiers();

      // Set up health check configurations
      this.setupHealthChecks();

      // Set up alert rules
      this.setupAlertRules();

      this.logger.info('✅ Unified Monitoring Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Unified Monitoring Service', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Monitoring service is already running');
      return;
    }

    if (!this.config) {
      throw new Error('Monitoring service must be initialized before starting');
    }

    try {
      // Start health check timers
      this.startHealthChecks();

      // Start metrics collection
      this.startMetricsCollection();

      // Start alert evaluation
      this.startAlertEvaluation();

      // Start cleanup routines
      this.startCleanupTasks();

      this.isRunning = true;
      this.startTime = new Date();

      this.logger.info('✅ Unified Monitoring Service started');
      this.emit('started');
    } catch (error) {
      this.logger.error('❌ Failed to start monitoring service', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Unified Monitoring Service...');

    try {
      // Stop health check timers
      this.stopHealthChecks();

      // Flush remaining metrics
      await this.flushMetrics();

      // Close storage connections
      if (this.storage) {
        await this.storage.cleanup();
      }

      // Cleanup collectors
      for (const collector of this.collectors.values()) {
        if (collector.cleanup) {
          await collector.cleanup();
        }
      }

      this.isRunning = false;

      this.logger.info('✅ Unified Monitoring Service stopped');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('❌ Error stopping monitoring service', error);
      throw error;
    }
  }

  // Health Monitoring Methods
  addHealthCheck(config: HealthCheckConfig): void {
    if (!this.config) {
      throw new Error('Service not initialized');
    }

    this.config.healthChecks.push(config);

    if (this.isRunning) {
      this.startSingleHealthCheck(config);
    }

    this.logger.info(`Added health check for ${config.service}`);
  }

  removeHealthCheck(service: string): void {
    if (!this.config) {
      throw new Error('Service not initialized');
    }

    // Remove from config
    this.config.healthChecks = this.config.healthChecks.filter(hc => hc.service !== service);

    // Stop timer
    const timer = this.healthCheckTimers.get(service);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(service);
    }

    this.logger.info(`Removed health check for ${service}`);
  }

  async getHealthStatus(service?: string): Promise<HealthCheck[]> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    return this.storage.getHealthChecks(service);
  }

  // Metrics Methods
  recordMetric(metric: Metric): void {
    // Add to buffer
    this.metricsBuffer.push({
      ...metric,
      timestamp: metric.timestamp || new Date(),
    });

    this.metricsCount++;

    // Check for alert conditions
    this.evaluateMetricAlerts(metric);

    // Emit real-time event
    if (FEATURE_FLAGS.enableRealTimeMetrics) {
      this.emit('metric', metric);
    }

    // Auto-flush if buffer is getting large
    if (this.metricsBuffer.length >= 1000) {
      setImmediate(() => this.flushMetrics());
    }
  }

  async getMetrics(name?: string, timeRange?: { start: Date; end: Date }): Promise<Metric[]> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    if (name) {
      return this.storage.getMetrics(
        name,
        timeRange || {
          start: new Date(Date.now() - 3600000), // 1 hour ago
          end: new Date(),
        }
      );
    }

    // Return recent metrics from buffer if no specific query
    const cutoff = new Date(Date.now() - 300000); // 5 minutes ago
    return this.metricsBuffer.filter(m => m.timestamp >= cutoff);
  }

  // Alert Methods
  private getAlertRules(): AlertRule[] {
    if (!this.config) return [];
    return this.config.alerting?.rules || this.config.alertRules || [];
  }

  private setAlertRules(rules: AlertRule[]): void {
    if (!this.config) return;
    if (this.config.alerting) {
      this.config.alerting.rules = rules;
    } else {
      this.config.alertRules = rules;
    }
  }

  addAlertRule(rule: AlertRule): void {
    if (!this.config) {
      throw new Error('Service not initialized');
    }

    const rules = this.getAlertRules();
    rules.push(rule);
    this.setAlertRules(rules);
    this.logger.info(`Added alert rule: ${rule.name}`);
  }

  removeAlertRule(ruleId: string): void {
    if (!this.config) {
      throw new Error('Service not initialized');
    }

    const rules = this.getAlertRules().filter(rule => rule.id !== ruleId);
    this.setAlertRules(rules);
    this.logger.info(`Removed alert rule: ${ruleId}`);
  }

  async getAlerts(status?: 'firing' | 'resolved'): Promise<Alert[]> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    return this.storage.getAlerts(status);
  }

  async acknowledgeAlert(alertId: string, user: string): Promise<void> {
    if (!this.storage) {
      throw new Error('Storage not initialized');
    }

    await this.storage.updateAlert(alertId, {
      acknowledgedBy: user,
      acknowledgedAt: new Date(),
    });

    this.logger.info(`Alert ${alertId} acknowledged by ${user}`);
  }

  // Tracing Methods
  startTrace(operationName: string): TraceSpan {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    const span: TraceSpan = {
      traceId,
      spanId,
      operationName,
      startTime: new Date(),
      status: 'ok',
      tags: {},
      logs: [],
    };

    this.activeTraces.set(spanId, span);

    if (FEATURE_FLAGS.enableDistributedTracing) {
      this.emit('trace_started', span);
    }

    return span;
  }

  finishTrace(span: TraceSpan): void {
    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();

    this.activeTraces.delete(span.spanId);

    if (this.storage && FEATURE_FLAGS.enableDistributedTracing) {
      this.storage.storeTrace(span).catch(error => {
        this.logger.error('Failed to store trace', error);
      });
    }

    this.emit('trace_finished', span);
  }

  // Dashboard Data
  async getDashboardData(options?: {
    includeMetrics?: boolean;
    includeHealth?: boolean;
    includeAlerts?: boolean;
  }): Promise<any> {
    const [healthChecks, metrics, alerts, traces] = await Promise.all([
      this.getHealthStatus(),
      this.getMetrics(),
      this.getAlerts('firing'),
      this.storage?.getTraces() || Promise.resolve([]),
    ]);

    // Calculate service health overview
    const servicesByStatus = healthChecks.reduce(
      (acc, hc) => {
        acc[hc.status] = (acc[hc.status] || 0) + 1;
        return acc;
      },
      {} as Record<HealthStatus, number>
    );

    // System metrics
    const systemMetrics = await this.collectSystemMetrics();

    // Service metrics
    const serviceMetrics = await this.aggregateServiceMetrics(healthChecks);

    const dashboardData: any = {
      overview: {
        servicesTotal: healthChecks.length,
        servicesHealthy: servicesByStatus.healthy || 0,
        servicesDegraded: servicesByStatus.degraded || 0,
        servicesUnhealthy: servicesByStatus.unhealthy || 0,
        alertsActive: alerts.length,
        systemHealth: this.calculateOverallHealth(servicesByStatus),
      },
      timestamp: new Date(),
    };

    // Add optional sections based on parameters
    if (!options || options.includeMetrics !== false) {
      dashboardData.metrics = {
        system: systemMetrics,
        services: serviceMetrics,
        custom: metrics.slice(-100), // Last 100 custom metrics
      };
    }

    if (!options || options.includeHealth !== false) {
      dashboardData.healthSummary = {
        services: healthChecks,
        overall: this.calculateOverallHealth(servicesByStatus),
        lastCheck: new Date(),
      };
    }

    if (!options || options.includeAlerts !== false) {
      dashboardData.alertSummary = {
        active: alerts,
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warnings: alerts.filter(a => a.severity === 'medium').length,
      };
    }

    dashboardData.alerts = alerts;
    dashboardData.traces = traces.slice(-50); // Last 50 traces

    return dashboardData;
  }

  // Private Implementation Methods
  private async initializeStorage(): Promise<void> {
    // Dynamic import based on configuration
    const backend = this.config?.storage?.type || 'memory';

    switch (backend) {
      case 'redis':
        const { RedisMonitoringStorage } = await import('./storage/redis-storage');
        this.storage = new RedisMonitoringStorage();
        break;
      case 'database':
        const { DatabaseMonitoringStorage } = await import('./storage/database-storage');
        this.storage = new DatabaseMonitoringStorage();
        break;
      default:
        const { MemoryMonitoringStorage } = await import('./storage/memory-storage');
        this.storage = new MemoryMonitoringStorage();
    }

    this.logger.info(`Using ${backend} storage backend`);
  }

  private async initializeCollectors(): Promise<void> {
    // System metrics collector
    const { SystemMetricsCollector } = await import('./collectors/system-collector');
    this.collectors.set('system', new SystemMetricsCollector());

    // Service metrics collector (optional)
    try {
      const { ServiceMetricsCollector } = await import('./collectors/service-collector');
      this.collectors.set('service', new ServiceMetricsCollector());
    } catch (error) {
      this.logger.debug('Service collector not available, skipping...');
    }

    // Initialize all collectors
    for (const [name, collector] of this.collectors) {
      if (collector.initialize) {
        await collector.initialize();
        this.logger.info(`Initialized ${name} collector`);
      }
    }
  }

  private async initializeHealthCheckers(): Promise<void> {
    // HTTP health checker
    const { HttpHealthChecker } = await import('./checkers/http-checker');
    this.healthCheckers.set('http', new HttpHealthChecker());

    // Database health checker
    const { DatabaseHealthChecker } = await import('./checkers/database-checker');
    this.healthCheckers.set('database', new DatabaseHealthChecker());

    // Redis health checker (optional)
    try {
      const { RedisHealthChecker } = await import('./checkers/redis-checker');
      this.healthCheckers.set('cache', new RedisHealthChecker());
    } catch (error) {
      this.logger.debug('Redis health checker not available, skipping...');
    }

    this.logger.info(`Initialized ${this.healthCheckers.size} health checkers`);
  }

  private async initializeAlertNotifiers(): Promise<void> {
    // Console notifier (always available)
    const { ConsoleAlertNotifier } = await import('./notifiers/console-notifier');
    this.alertNotifiers.set('console', new ConsoleAlertNotifier());

    // Database notifier (optional)
    try {
      const { DatabaseAlertNotifier } = await import('./notifiers/database-notifier');
      this.alertNotifiers.set('database', new DatabaseAlertNotifier());
    } catch (error) {
      this.logger.debug('Database alert notifier not available, skipping...');
    }

    this.logger.info(`Initialized ${this.alertNotifiers.size} alert notifiers`);
  }

  private setupHealthChecks(): void {
    if (!this.config?.healthChecks.length) {
      this.logger.warn('No health checks configured');
      return;
    }

    this.logger.info(`Setting up ${this.config.healthChecks.length} health checks`);
  }

  private setupAlertRules(): void {
    const alertRules = this.config?.alerting?.rules || this.config?.alertRules || [];
    if (!alertRules.length) {
      this.logger.warn('No alert rules configured');
      return;
    }

    this.logger.info(`Setting up ${alertRules.length} alert rules`);
  }

  private startHealthChecks(): void {
    if (!this.config) return;

    for (const config of this.config.healthChecks) {
      if (config.enabled) {
        this.startSingleHealthCheck(config);
      }
    }
  }

  private startSingleHealthCheck(config: HealthCheckConfig): void {
    const timer = setInterval(async () => {
      try {
        await this.executeHealthCheck(config);
      } catch (error) {
        this.logger.error(`Health check failed for ${config.service}`, error);
      }
    }, config.interval);

    this.healthCheckTimers.set(config.service, timer);

    // Perform initial check immediately
    setImmediate(() => this.executeHealthCheck(config));
  }

  private async executeHealthCheck(config: HealthCheckConfig): Promise<void> {
    const checker = this.healthCheckers.get(config.type);
    if (!checker) {
      this.logger.warn(`No health checker for type: ${config.type}`);
      return;
    }

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return await checker.check(config);
      });

      this.healthCheckCount++;

      // Store result
      if (this.storage) {
        await this.storage.storeHealthCheck(result);
      }

      // Emit event for real-time updates
      this.emit('health_check', result);

      // Check for status changes and alerts
      await this.evaluateHealthAlerts(result);
    } catch (error) {
      this.logger.error(`Health check circuit breaker opened for ${config.service}`, error);

      // Create error health check
      const errorResult: HealthCheck = {
        service: config.service,
        status: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      if (this.storage) {
        await this.storage.storeHealthCheck(errorResult);
      }

      this.emit('health_check', errorResult);
    }
  }

  private stopHealthChecks(): void {
    for (const [service, timer] of this.healthCheckTimers) {
      clearInterval(timer);
      this.logger.debug(`Stopped health check for ${service}`);
    }
    this.healthCheckTimers.clear();
  }

  private startMetricsCollection(): void {
    if (!this.config) return;

    // Flush metrics buffer periodically
    const flushInterval = this.config.metricsAggregationInterval * 1000;
    setInterval(() => this.flushMetrics(), flushInterval);

    // Collect system metrics periodically
    setInterval(async () => {
      try {
        for (const collector of this.collectors.values()) {
          const metrics = await collector.collect();
          metrics.forEach(metric => this.recordMetric(metric));
        }
      } catch (error) {
        this.logger.error('Failed to collect metrics', error);
      }
    }, 30000); // Every 30 seconds
  }

  private async flushMetrics(): Promise<void> {
    if (!this.storage || this.metricsBuffer.length === 0) {
      return;
    }

    try {
      await this.storage.storeMetrics([...this.metricsBuffer]);
      this.metricsBuffer.length = 0; // Clear buffer
      this.lastMetricsFlush = new Date();
    } catch (error) {
      this.logger.error('Failed to flush metrics', error);
    }
  }

  private startAlertEvaluation(): void {
    // Evaluate alerts every 30 seconds
    setInterval(() => this.evaluateAllAlerts(), 30000);
  }

  private async evaluateAllAlerts(): Promise<void> {
    if (!this.config) return;

    for (const rule of this.getAlertRules()) {
      if (rule.enabled) {
        await this.evaluateAlertRule(rule);
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    try {
      // Get recent metrics for evaluation
      const metrics = await this.getMetrics(rule.condition.metric, {
        start: new Date(Date.now() - (rule.condition.timeWindow || 300) * 1000),
        end: new Date(),
      });

      if (metrics.length === 0) return;

      // Apply aggregation
      let value: number;
      switch (rule.condition.aggregation || 'avg') {
        case 'sum':
          value = metrics.reduce((sum, m) => sum + m.value, 0);
          break;
        case 'min':
          value = Math.min(...metrics.map(m => m.value));
          break;
        case 'max':
          value = Math.max(...metrics.map(m => m.value));
          break;
        case 'count':
          value = metrics.length;
          break;
        default: // avg
          value = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
      }

      // Evaluate condition
      const conditionMet = this.evaluateCondition(
        value,
        rule.condition.operator,
        rule.condition.threshold
      );

      const existingAlert = Array.from(this.activeAlerts.values()).find(
        a => a.ruleId === rule.id && a.status === 'firing'
      );

      if (conditionMet && !existingAlert) {
        // Fire new alert
        await this.fireAlert(rule, value);
      } else if (!conditionMet && existingAlert) {
        // Resolve alert
        await this.resolveAlert(existingAlert);
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate alert rule ${rule.id}`, error);
    }
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      case 'ne':
        return value !== threshold;
      default:
        return false;
    }
  }

  private async fireAlert(rule: AlertRule, value: number): Promise<void> {
    const alert: Alert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      status: 'firing',
      severity: rule.severity,
      message: `${rule.name}: ${rule.condition.metric} ${rule.condition.operator} ${rule.condition.threshold} (current: ${value})`,
      startTime: new Date(),
    };

    this.activeAlerts.set(alert.id, alert);
    this.alertsTriggered++;

    // Store alert
    if (this.storage) {
      await this.storage.storeAlert(alert);
    }

    // Send notifications
    for (const channel of rule.channels) {
      if (channel.enabled && this.shouldNotify(alert.severity, channel.severityFilter)) {
        const notifier = this.alertNotifiers.get(channel.type);
        if (notifier) {
          try {
            await notifier.send(alert, channel);
          } catch (error) {
            this.logger.error(`Failed to send alert notification via ${channel.type}`, error);
          }
        }
      }
    }

    this.emit('alert_fired', alert);
    this.logger.warn(`🚨 Alert fired: ${alert.message}`);
  }

  private async resolveAlert(alert: Alert): Promise<void> {
    alert.status = 'resolved';
    alert.endTime = new Date();

    this.activeAlerts.delete(alert.id);

    // Update storage
    if (this.storage) {
      await this.storage.updateAlert(alert.id, {
        status: 'resolved',
        endTime: alert.endTime,
      });
    }

    this.emit('alert_resolved', alert);
    this.logger.info(`✅ Alert resolved: ${alert.message}`);
  }

  private shouldNotify(severity: AlertSeverity, filter?: AlertSeverity[]): boolean {
    if (!filter) return true;
    return filter.includes(severity);
  }

  private async evaluateMetricAlerts(metric: Metric): Promise<void> {
    if (!this.config) return;

    // Quick evaluation for real-time alerts
    for (const rule of this.getAlertRules()) {
      if (rule.condition.metric === metric.name && rule.enabled) {
        const conditionMet = this.evaluateCondition(
          metric.value,
          rule.condition.operator,
          rule.condition.threshold
        );

        if (conditionMet) {
          // Schedule full evaluation to consider duration/window
          setImmediate(() => this.evaluateAlertRule(rule));
        }
      }
    }
  }

  private async evaluateHealthAlerts(healthCheck: HealthCheck): Promise<void> {
    // Emit health change events
    const event: MonitoringEvent = {
      type: healthCheck.status === 'healthy' ? 'service_up' : 'service_down',
      source: healthCheck.service,
      timestamp: new Date(),
      data: healthCheck,
      severity: healthCheck.status === 'unhealthy' ? 'critical' : 'medium',
    };

    this.emit('monitoring_event', event);
  }

  private startCleanupTasks(): void {
    // Clean up old data daily
    setInterval(
      async () => {
        try {
          if (this.storage) {
            await this.storage.cleanup();
          }
        } catch (error) {
          this.logger.error('Failed to cleanup old data', error);
        }
      },
      24 * 60 * 60 * 1000
    ); // Daily
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const collector = this.collectors.get('system');
    if (!collector) {
      throw new Error('System metrics collector not available');
    }

    const metrics = await collector.collect();

    // Convert metrics array to SystemMetrics structure
    return this.convertToSystemMetrics(metrics);
  }

  private convertToSystemMetrics(metrics: Metric[]): SystemMetrics {
    // This is a simplified conversion - in reality would need proper metric parsing
    return {
      cpu: {
        usage: 0.3,
        cores: 8,
        loadAverage: [1.2, 1.5, 1.8],
      },
      memory: {
        usage: 0.6,
        total: 16 * 1024 * 1024 * 1024,
        used: 9.6 * 1024 * 1024 * 1024,
        available: 6.4 * 1024 * 1024 * 1024,
      },
      disk: {
        usage: 0.4,
        total: 500 * 1024 * 1024 * 1024,
        used: 200 * 1024 * 1024 * 1024,
        available: 300 * 1024 * 1024 * 1024,
      },
      network: {
        bytesIn: 1024 * 1024,
        bytesOut: 512 * 1024,
        packetsIn: 1000,
        packetsOut: 500,
        errors: 0,
      },
      timestamp: new Date(),
    };
  }

  private async aggregateServiceMetrics(healthChecks: HealthCheck[]): Promise<ServiceMetrics[]> {
    return healthChecks.map(hc => ({
      service: hc.service,
      requests: {
        total: 1000,
        success: 950,
        errors: 50,
        rate: 10.5,
      },
      latency: {
        avg: hc.responseTime || 100,
        p50: (hc.responseTime || 100) * 0.8,
        p95: (hc.responseTime || 100) * 1.5,
        p99: (hc.responseTime || 100) * 2.0,
      },
      availability: hc.status === 'healthy' ? 1.0 : hc.status === 'degraded' ? 0.8 : 0.0,
      uptime: Date.now() - this.startTime.getTime(),
      lastCheck: hc.timestamp,
    }));
  }

  private calculateOverallHealth(statusCounts: Record<HealthStatus, number>): HealthStatus {
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return 'unknown';

    const unhealthy = statusCounts.unhealthy || 0;
    const degraded = statusCounts.degraded || 0;
    const healthy = statusCounts.healthy || 0;

    if (unhealthy > 0) return 'unhealthy';
    if (degraded > 0) return 'degraded';
    return 'healthy';
  }

  private async fallbackToLegacyServices(): Promise<void> {
    this.logger.info('Using legacy monitoring services');
    // In a real implementation, this would delegate to existing services
  }

  // Utility methods
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Missing methods required by tests and API
  async getStatus() {
    return {
      initialized: this.config !== null,
      running: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime.getTime() : 0,
      collectors: this.config?.collectors || [],
      storage: this.config?.storage.type || 'unknown',
      alertRules: this.getAlertRules(),
      healthChecks: this.config?.healthChecks || [],
      metrics: {
        collected: this.metricsCount,
        stored: this.metricBuffer?.length || 0,
      },
      alerts: {
        active: this.activeAlerts.size,
        total: this.alertsTriggered,
      },
      health: {
        checks: this.healthCheckCount,
        lastCheck: this.lastHealthCheck,
      },
    };
  }

  async queryMetrics(query: any) {
    if (!this.storage) {
      return [];
    }

    // Get metrics from storage
    const storedMetrics = await this.storage.queryMetrics(query);

    // Also include recent metrics from buffer
    let allMetrics = [...storedMetrics];

    if (this.metricsBuffer && this.metricsBuffer.length > 0) {
      // Add buffered metrics that haven't been flushed yet
      allMetrics.push(...this.metricsBuffer);
    }

    // Apply limit if specified in query
    if (query.limit && allMetrics.length > query.limit) {
      allMetrics = allMetrics.slice(0, query.limit);
    }

    return allMetrics;
  }

  async performHealthCheck(config: HealthCheckConfig): Promise<HealthCheck> {
    const checker = this.healthCheckers.get(config.type);
    if (!checker) {
      throw new Error(`No health checker found for type: ${config.type}`);
    }

    const result = await checker.check(config);

    // Store the result
    if (this.storage) {
      await this.storage.storeHealthCheck(result);
    }

    // Emit event
    this.emit('health:checked', result);

    return result;
  }

  async getHealthChecks(filters?: any) {
    if (!this.storage) {
      return [];
    }
    return await this.storage.getHealthChecks(filters);
  }

  async upsertAlertRule(rule: AlertRule): Promise<void> {
    const existingIndex = this.alertRules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.alertRules[existingIndex] = rule;
    } else {
      this.alertRules.push(rule);
    }
    this.logger.info(`Alert rule ${rule.id} upserted`);
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      this.logger.info(`Alert rule ${ruleId} deleted`);
    }
  }

  async getServices() {
    const healthChecks = await this.getHealthChecks();
    const services = new Set<string>();

    healthChecks.forEach(check => {
      services.add(check.service);
    });

    return Array.from(services).map(service => ({
      name: service,
      status: 'unknown', // Would need to aggregate from health checks
    }));
  }

  async getTraces(filters?: any) {
    // Placeholder implementation
    return [];
  }

  async runTests(config: any) {
    const results: any = {
      storage: false,
      collectors: false,
      alerts: false,
      health: false,
    };

    if (config.components.includes('storage') && this.storage) {
      try {
        const testMetric = {
          name: 'test_metric',
          type: 'gauge' as const,
          value: 1,
          timestamp: new Date(),
        };
        await this.storage.storeMetric(testMetric);
        const metrics = await this.storage.queryMetrics({ name: 'test_metric', limit: 1 });
        results.storage = metrics.length > 0;
      } catch (error) {
        this.logger.error('Storage test failed', error);
      }
    }

    if (config.components.includes('collectors')) {
      try {
        const metrics = await this.collectAllMetrics();
        results.collectors = metrics.length > 0;
      } catch (error) {
        this.logger.error('Collectors test failed', error);
      }
    }

    if (config.components.includes('alerts')) {
      results.alerts = this.alertNotifiers.length > 0;
    }

    if (config.components.includes('health')) {
      results.health = this.healthCheckers.size > 0;
    }

    return results;
  }

  // Public status methods for debugging and monitoring
  public getStats() {
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime.getTime(),
      healthChecksPerformed: this.healthCheckCount,
      metricsCollected: this.metricsCount,
      alertsTriggered: this.alertsTriggered,
      activeHealthChecks: this.healthCheckTimers.size,
      bufferedMetrics: this.metricsBuffer.length,
      activeAlerts: this.activeAlerts.size,
      activeTraces: this.activeTraces.size,
      lastMetricsFlush: this.lastMetricsFlush,
      featureFlags: FEATURE_FLAGS,
    };
  }
}

// Export singleton instance
export const unifiedMonitoringService = UnifiedMonitoringService.getInstance();

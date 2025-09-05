/**
 * Unified Monitoring System Types and Interfaces
 * Consolidates types from 12 separate monitoring services
 */

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
export type ServiceType = 'api' | 'database' | 'cache' | 'queue' | 'external' | 'ml' | 'storage';

/**
 * Core metric data structure
 */
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
  unit?: string;
  help?: string;
}

/**
 * Health check result
 */
export interface HealthCheck {
  service: string;
  status: HealthStatus;
  responseTime?: number;
  timestamp: Date;
  details?: Record<string, any>;
  error?: string;
  version?: string;
  dependencies?: string[];
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  service: string;
  type: ServiceType;
  endpoint?: string;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  enabled: boolean;
  customCheck?: (config: HealthCheckConfig) => Promise<HealthCheck>;
  dependencies?: string[];
  tags?: string[];
}

/**
 * Alert configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: AlertCondition;
  enabled: boolean;
  channels: AlertChannel[];
  cooldown?: number; // minutes
  tags?: string[];
}

/**
 * Alert condition evaluation
 */
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  threshold: number;
  duration?: number; // seconds (condition must persist)
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  timeWindow?: number; // seconds to look back
}

/**
 * Alert notification channels
 */
export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'console' | 'database';
  config: Record<string, any>;
  enabled: boolean;
  severityFilter?: AlertSeverity[];
}

/**
 * Active alert
 */
export interface Alert {
  id: string;
  ruleId: string;
  status: 'firing' | 'resolved';
  severity: AlertSeverity;
  message: string;
  startTime: Date;
  endTime?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * System resource metrics
 */
export interface SystemMetrics {
  cpu: {
    usage: number; // 0-1 percentage
    cores: number;
    loadAverage: number[];
  };
  memory: {
    usage: number; // 0-1 percentage
    total: number; // bytes
    used: number; // bytes
    available: number; // bytes
  };
  disk: {
    usage: number; // 0-1 percentage
    total: number; // bytes
    used: number; // bytes
    available: number; // bytes
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    errors: number;
  };
  timestamp: Date;
}

/**
 * Service performance metrics
 */
export interface ServiceMetrics {
  service: string;
  requests: {
    total: number;
    success: number;
    errors: number;
    rate: number; // requests per second
  };
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  availability: number; // 0-1 percentage
  uptime: number; // seconds
  lastCheck: Date;
}

/**
 * Trace span for distributed tracing
 */
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  tags?: Record<string, any>;
  logs?: Array<{
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    fields?: Record<string, any>;
  }>;
  status: 'ok' | 'error' | 'timeout';
  error?: string;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  // Health monitoring
  healthChecks: HealthCheckConfig[];
  healthCheckInterval: number; // global default interval

  // Metrics collection
  metricsRetention: number; // days
  metricsAggregationInterval: number; // seconds

  // Alerting
  alertRules: AlertRule[];
  alertRetention: number; // days

  // Tracing
  tracingEnabled: boolean;
  tracingSampleRate: number; // 0-1

  // Storage
  storageBackends: {
    primary: 'memory' | 'redis' | 'database';
    fallback?: 'memory' | 'redis' | 'database';
  };

  // Export formats
  enablePrometheus: boolean;
  enableOpenTelemetry: boolean;
}

/**
 * Monitoring event for real-time updates
 */
export interface MonitoringEvent {
  type:
    | 'health_change'
    | 'metric_threshold'
    | 'alert_fired'
    | 'alert_resolved'
    | 'service_down'
    | 'service_up';
  source: string;
  timestamp: Date;
  data: any;
  severity?: AlertSeverity;
}

/**
 * Dashboard data structure
 */
export interface DashboardData {
  overview: {
    servicesTotal: number;
    servicesHealthy: number;
    servicesDegraded: number;
    servicesUnhealthy: number;
    alertsActive: number;
    systemHealth: HealthStatus;
  };
  metrics: {
    system: SystemMetrics;
    services: ServiceMetrics[];
    custom: Metric[];
  };
  alerts: Alert[];
  traces: TraceSpan[];
  timestamp: Date;
}

/**
 * Monitoring collector interface
 */
export interface MetricCollector {
  name: string;
  collect(): Promise<Metric[]>;
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}

/**
 * Health checker interface
 */
export interface HealthChecker {
  name: string;
  check(config: HealthCheckConfig): Promise<HealthCheck>;
  supports(type: ServiceType): boolean;
}

/**
 * Alert notifier interface
 */
export interface AlertNotifier {
  type: string;
  send(alert: Alert, channel: AlertChannel): Promise<boolean>;
  test(channel: AlertChannel): Promise<boolean>;
}

/**
 * Storage backend interface
 */
export interface MonitoringStorage {
  // Metrics
  storeMetrics(metrics: Metric[]): Promise<void>;
  getMetrics(name: string, timeRange: { start: Date; end: Date }): Promise<Metric[]>;

  // Health checks
  storeHealthCheck(check: HealthCheck): Promise<void>;
  getHealthChecks(service?: string): Promise<HealthCheck[]>;

  // Alerts
  storeAlert(alert: Alert): Promise<void>;
  getAlerts(status?: 'firing' | 'resolved'): Promise<Alert[]>;
  updateAlert(alertId: string, updates: Partial<Alert>): Promise<void>;

  // Traces
  storeTrace(span: TraceSpan): Promise<void>;
  getTraces(traceId?: string): Promise<TraceSpan[]>;

  // Cleanup
  cleanup(): Promise<void>;
}

/**
 * Monitoring service interface
 */
export interface MonitoringService {
  // Core lifecycle
  initialize(config: MonitoringConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  // Health monitoring
  addHealthCheck(config: HealthCheckConfig): void;
  removeHealthCheck(service: string): void;
  getHealthStatus(service?: string): Promise<HealthCheck[]>;

  // Metrics
  recordMetric(metric: Metric): void;
  getMetrics(name?: string, timeRange?: { start: Date; end: Date }): Promise<Metric[]>;

  // Alerting
  addAlertRule(rule: AlertRule): void;
  removeAlertRule(ruleId: string): void;
  getAlerts(status?: 'firing' | 'resolved'): Promise<Alert[]>;
  acknowledgeAlert(alertId: string, user: string): Promise<void>;

  // Tracing
  startTrace(operationName: string): TraceSpan;
  finishTrace(span: TraceSpan): void;

  // Dashboard data
  getDashboardData(): Promise<DashboardData>;

  // Events
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

/**
 * Monitoring middleware for Express
 */
export interface MonitoringMiddleware {
  (req: any, res: any, next: () => void): void;
}

/**
 * Performance profiler interface
 */
export interface PerformanceProfiler {
  startProfile(name: string): void;
  endProfile(name: string): number; // duration in milliseconds
  getProfiles(): Record<string, number>;
}

/**
 * Feature flags for monitoring
 */
export interface MonitoringFeatureFlags {
  enableUnifiedMonitoring: boolean;
  enableDistributedTracing: boolean;
  enableIntelligentAlerting: boolean;
  enablePerformanceProfiling: boolean;
  enableRealTimeMetrics: boolean;
  fallbackToLegacyServices: boolean;
}

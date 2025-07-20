/**
 * Port Health Monitor Service
 * 
 * Comprehensive real-time health monitoring service for ports and services
 * Integrates with SmartPortManager and provides WebSocket-based real-time updates
 * 
 * Features:
 * - Real-time port health monitoring
 * - Service connectivity validation
 * - Performance metrics collection
 * - Alert management and notifications
 * - Historical health data tracking
 * - WebSocket integration for live updates
 * - Automated health check scheduling
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import type { SmartPortManager} from '../utils/smart-port-manager';
import { PortStatus, ServiceConfig } from '../utils/smart-port-manager';
import { logger } from '../utils/logger';

// Health metric interfaces
export interface HealthMetric {
  service: string;
  port: number;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime: number;
  uptime: number;
  lastCheck: Date;
  errorCount: number;
  metadata: Record<string, any>;
}

export interface HealthAlert {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'error';
  service: string;
  port: number;
  message: string;
  details: Record<string, any>;
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface AlertRule {
  id: string;
  service: string;
  condition: 'down' | 'slow_response' | 'high_error_rate' | 'degraded';
  threshold?: number;
  duration?: number; // in seconds
  enabled: boolean;
}

export interface HealthReport {
  timestamp: Date;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  healthScore: number; // 0-100
  services: HealthMetric[];
  alerts: HealthAlert[];
  uptime: {
    total: number;
    services: Record<string, number>;
  };
  performance: {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
  };
}

export interface MonitoringConfig {
  interval: number; // monitoring interval in ms
  healthCheckTimeout: number;
  retryAttempts: number;
  alertCooldown: number; // min time between same alerts
  enableWebSocket: boolean;
  persistMetrics: boolean;
  maxHistoryAge: number; // days
}

interface ServiceHealthHistory {
  service: string;
  metrics: HealthMetric[];
  downtime: Array<{ start: Date; end?: Date; reason: string }>;
  lastHealthy: Date;
  consecutiveFailures: number;
}

export class PortHealthMonitor extends EventEmitter {
  private portManager: SmartPortManager;
  private supabase: SupabaseClient;
  private config: MonitoringConfig;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private healthHistory: Map<string, ServiceHealthHistory> = new Map();
  private activeAlerts: Map<string, HealthAlert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private webSocketClients: Set<WebSocket> = new Set();
  private metricsCache: Map<string, HealthMetric> = new Map();
  private performanceStats = {
    totalChecks: 0,
    totalErrors: 0,
    totalResponseTime: 0,
    startTime: new Date()
  };

  constructor(
    portManager: SmartPortManager,
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<MonitoringConfig> = {}
  ) {
    super();
    this.portManager = portManager;
    this.supabase = createClient(supabaseUrl, supabaseKey);
    
    this.config = {
      interval: 30000, // 30 seconds
      healthCheckTimeout: 5000, // 5 seconds
      retryAttempts: 3,
      alertCooldown: 300000, // 5 minutes
      enableWebSocket: true,
      persistMetrics: true,
      maxHistoryAge: 30, // 30 days
      ...config
    };

    this.initializeDefaults();
    this.setupEventListeners();
  }

  /**
   * Initialize default alert rules and service history
   */
  private initializeDefaults(): void {
    // Default alert rules
    const defaultRules: AlertRule[] = [
      {
        id: 'service-down',
        service: '*',
        condition: 'down',
        duration: 60, // 1 minute
        enabled: true
      },
      {
        id: 'slow-response',
        service: '*',
        condition: 'slow_response',
        threshold: 5000, // 5 seconds
        duration: 120, // 2 minutes
        enabled: true
      },
      {
        id: 'high-error-rate',
        service: '*',
        condition: 'high_error_rate',
        threshold: 0.1, // 10% error rate
        duration: 180, // 3 minutes
        enabled: true
      }
    ];

    defaultRules.forEach(rule => this.alertRules.set(rule.id, rule));
    logger.info('🏥 Port Health Monitor initialized with default rules');
  }

  /**
   * Setup event listeners for port manager events
   */
  private setupEventListeners(): void {
    this.portManager.on('portStatusChanged', (event) => {
      this.handlePortStatusChange(event);
    });

    this.portManager.on('portConflictResolved', (event) => {
      this.handlePortConflictResolved(event);
    });
  }

  /**
   * Start continuous health monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Port health monitoring is already running');
      return;
    }

    try {
      this.isMonitoring = true;
      this.performanceStats.startTime = new Date();
      
      // Initial health check
      await this.performFullHealthCheck();
      
      // Schedule regular health checks
      this.scheduleHealthChecks();
      
      // Start port manager monitoring
      this.portManager.monitorPortChanges(this.config.interval);
      
      logger.info(`🚀 Port health monitoring started (interval: ${this.config.interval}ms)`);
      this.emit('monitoringStarted', { config: this.config });
      
      if (this.config.enableWebSocket) {
        this.broadcastHealthStatus();
      }
    } catch (error) {
      this.isMonitoring = false;
      logger.error('Failed to start health monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring with cleanup
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      logger.warn('Port health monitoring is not running');
      return;
    }

    try {
      this.isMonitoring = false;
      
      // Clear monitoring interval
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }
      
      // Stop port manager monitoring
      this.portManager.stopMonitoring();
      
      // Close WebSocket connections
      this.webSocketClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      this.webSocketClients.clear();
      
      logger.info('🛑 Port health monitoring stopped');
      this.emit('monitoringStopped');
    } catch (error) {
      logger.error('Error stopping health monitoring:', error);
      throw error;
    }
  }

  /**
   * Schedule automated health checks
   */
  private scheduleHealthChecks(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performFullHealthCheck();
        await this.evaluateAlertRules();
        await this.cleanupOldData();
        
        if (this.config.enableWebSocket) {
          this.broadcastHealthStatus();
        }
      } catch (error) {
        logger.error('Error in scheduled health check:', error);
        this.performanceStats.totalErrors++;
      }
    }, this.config.interval);
  }

  /**
   * Perform comprehensive health check on all services
   */
  private async performFullHealthCheck(): Promise<Map<string, HealthMetric>> {
    const healthResults = new Map<string, HealthMetric>();
    const services = await this.portManager.discoverServices();
    
    const healthCheckPromises = Array.from(services.entries()).map(async ([serviceName, portStatus]) => {
      try {
        const metric = await this.monitorServiceHealth(serviceName);
        healthResults.set(serviceName, metric);
        this.metricsCache.set(serviceName, metric);
        this.updateServiceHistory(serviceName, metric);
      } catch (error) {
        logger.error(`Health check failed for ${serviceName}:`, error);
        const errorMetric: HealthMetric = {
          service: serviceName,
          port: portStatus.port,
          status: 'unhealthy',
          responseTime: -1,
          uptime: 0,
          lastCheck: new Date(),
          errorCount: this.getServiceErrorCount(serviceName) + 1,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
        healthResults.set(serviceName, errorMetric);
        this.updateServiceHistory(serviceName, errorMetric);
      }
    });

    await Promise.all(healthCheckPromises);
    
    // Update performance stats
    this.performanceStats.totalChecks += healthResults.size;
    
    this.emit('healthCheckCompleted', { 
      timestamp: new Date(), 
      results: Array.from(healthResults.values()) 
    });
    
    return healthResults;
  }

  /**
   * Monitor specific service health
   */
  async monitorServiceHealth(service: string): Promise<HealthMetric> {
    const startTime = Date.now();
    
    try {
      const serviceStatus = await this.portManager.getServiceStatus(service);
      const responseTime = Date.now() - startTime;
      
      // Determine health status based on various factors
      let status: HealthMetric['status'] = 'unknown';
      
      if (serviceStatus.healthStatus === 'healthy') {
        status = responseTime > 3000 ? 'degraded' : 'healthy';
      } else if (serviceStatus.healthStatus === 'unhealthy') {
        status = 'unhealthy';
      } else {
        status = 'unknown';
      }
      
      // Calculate uptime from history
      const history = this.healthHistory.get(service);
      const uptime = this.calculateUptime(service);
      
      const metric: HealthMetric = {
        service,
        port: serviceStatus.port,
        status,
        responseTime,
        uptime,
        lastCheck: new Date(),
        errorCount: status === 'unhealthy' ? (history?.consecutiveFailures || 0) + 1 : 0,
        metadata: {
          available: serviceStatus.available,
          pid: serviceStatus.pid,
          healthCheckPath: this.getServiceHealthCheckPath(service),
          timestamp: new Date().toISOString()
        }
      };
      
      // Update performance stats
      this.performanceStats.totalResponseTime += responseTime;
      
      this.emit('serviceHealthChecked', metric);
      return metric;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.performanceStats.totalErrors++;
      
      throw new Error(`Health check failed for ${service}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get overall system health status
   */
  getOverallHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; score: number; details: any } {
    const metrics = Array.from(this.metricsCache.values());
    
    if (metrics.length === 0) {
      return { status: 'unknown' as any, score: 0, details: { reason: 'No metrics available' } };
    }
    
    const healthyCount = metrics.filter(m => m.status === 'healthy').length;
    const degradedCount = metrics.filter(m => m.status === 'degraded').length;
    const unhealthyCount = metrics.filter(m => m.status === 'unhealthy').length;
    
    const healthScore = this.calculateHealthScore();
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }
    
    return {
      status: overallStatus,
      score: healthScore,
      details: {
        totalServices: metrics.length,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
        activeAlerts: this.activeAlerts.size
      }
    };
  }

  /**
   * Get health status for a specific service
   */
  getServiceHealth(service: string): HealthMetric | null {
    return this.metricsCache.get(service) || null;
  }

  /**
   * Get historical health data for a service
   */
  getHealthHistory(service: string, duration = 24): Array<HealthMetric> {
    const history = this.healthHistory.get(service);
    if (!history) return [];
    
    const cutoffTime = new Date(Date.now() - duration * 60 * 60 * 1000); // hours to ms
    return history.metrics.filter(metric => metric.lastCheck > cutoffTime);
  }

  /**
   * Calculate aggregate health score (0-100)
   */
  calculateHealthScore(): number {
    const metrics = Array.from(this.metricsCache.values());
    
    if (metrics.length === 0) return 0;
    
    let totalScore = 0;
    
    metrics.forEach(metric => {
      let serviceScore = 0;
      
      switch (metric.status) {
        case 'healthy':
          serviceScore = 100;
          // Reduce score for slow response times
          if (metric.responseTime > 1000) serviceScore -= 10;
          if (metric.responseTime > 3000) serviceScore -= 20;
          break;
        case 'degraded':
          serviceScore = 60;
          break;
        case 'unhealthy':
          serviceScore = 0;
          break;
        case 'unknown':
          serviceScore = 30;
          break;
      }
      
      // Factor in uptime
      serviceScore *= (metric.uptime / 100);
      
      totalScore += serviceScore;
    });
    
    return Math.round(totalScore / metrics.length);
  }

  /**
   * Configure alert rules
   */
  configureAlerts(rules: AlertRule[]): void {
    this.alertRules.clear();
    rules.forEach(rule => this.alertRules.set(rule.id, rule));
    
    logger.info(`Configured ${rules.length} alert rules`);
    this.emit('alertRulesUpdated', rules);
  }

  /**
   * Send alert notification
   */
  async sendAlert(type: HealthAlert['type'], service: string, details: Record<string, any>): Promise<string> {
    const alertId = `${service}-${type}-${Date.now()}`;
    const serviceMetric = this.metricsCache.get(service);
    
    const alert: HealthAlert = {
      id: alertId,
      type,
      service,
      port: serviceMetric?.port || 0,
      message: this.generateAlertMessage(type, service, details),
      details,
      createdAt: new Date(),
      resolved: false
    };
    
    this.activeAlerts.set(alertId, alert);
    
    // Persist alert if configured
    if (this.config.persistMetrics) {
      try {
        await this.supabase.from('port_health_alerts').insert({
          alert_id: alertId,
          alert_type: type,
          service_name: service,
          port: alert.port,
          message: alert.message,
          details: alert.details,
          created_at: alert.createdAt.toISOString()
        });
      } catch (error) {
        logger.error('Failed to persist alert:', error);
      }
    }
    
    logger.warn(`🚨 Alert [${type.toUpperCase()}]: ${alert.message}`);
    this.emit('alertCreated', alert);
    
    // Broadcast to WebSocket clients
    if (this.config.enableWebSocket) {
      this.broadcastAlert(alert);
    }
    
    return alertId;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }
    
    alert.resolved = true;
    alert.resolvedAt = new Date();
    
    // Update in database if persisted
    if (this.config.persistMetrics) {
      try {
        await this.supabase
          .from('port_health_alerts')
          .update({
            resolved: true,
            resolved_at: alert.resolvedAt.toISOString()
          })
          .eq('alert_id', alertId);
      } catch (error) {
        logger.error('Failed to update alert resolution:', error);
      }
    }
    
    logger.info(`✅ Alert resolved: ${alert.message}`);
    this.emit('alertResolved', alert);
    
    // Broadcast to WebSocket clients
    if (this.config.enableWebSocket) {
      this.broadcastAlert(alert);
    }
  }

  /**
   * Collect port performance metrics
   */
  async collectPortMetrics(): Promise<Record<string, any>> {
    const services = await this.portManager.discoverServices();
    const metrics: Record<string, any> = {};
    
    for (const [serviceName, portStatus] of services) {
      const serviceMetric = this.metricsCache.get(serviceName);
      
      metrics[serviceName] = {
        port: portStatus.port,
        available: portStatus.available,
        pid: portStatus.pid,
        lastChecked: portStatus.lastChecked,
        healthStatus: serviceMetric?.status || 'unknown',
        responseTime: serviceMetric?.responseTime || -1,
        uptime: serviceMetric?.uptime || 0,
        errorCount: serviceMetric?.errorCount || 0
      };
    }
    
    return metrics;
  }

  /**
   * Track response times for services
   */
  trackResponseTimes(): Record<string, { current: number; average: number; max: number; min: number }> {
    const responseTimes: Record<string, any> = {};
    
    this.healthHistory.forEach((history, service) => {
      const recentMetrics = history.metrics.slice(-20); // Last 20 checks
      if (recentMetrics.length === 0) return;
      
      const times = recentMetrics.map(m => m.responseTime).filter(t => t > 0);
      if (times.length === 0) return;
      
      responseTimes[service] = {
        current: recentMetrics[recentMetrics.length - 1].responseTime,
        average: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        max: Math.max(...times),
        min: Math.min(...times)
      };
    });
    
    return responseTimes;
  }

  /**
   * Record service downtime
   */
  recordDowntime(service: string, reason: string): void {
    let history = this.healthHistory.get(service);
    if (!history) {
      history = {
        service,
        metrics: [],
        downtime: [],
        lastHealthy: new Date(),
        consecutiveFailures: 0
      };
      this.healthHistory.set(service, history);
    }
    
    // Check if there's an ongoing downtime
    const lastDowntime = history.downtime[history.downtime.length - 1];
    if (!lastDowntime || lastDowntime.end) {
      // Start new downtime period
      history.downtime.push({
        start: new Date(),
        reason
      });
    }
    
    history.consecutiveFailures++;
  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport(): Promise<HealthReport> {
    const overallHealth = this.getOverallHealth();
    const metrics = Array.from(this.metricsCache.values());
    const activeAlerts = this.getActiveAlerts();
    
    // Calculate uptime for each service
    const serviceUptimes: Record<string, number> = {};
    this.healthHistory.forEach((history, service) => {
      serviceUptimes[service] = this.calculateUptime(service);
    });
    
    // Calculate performance metrics
    const avgResponseTime = this.performanceStats.totalChecks > 0 
      ? Math.round(this.performanceStats.totalResponseTime / this.performanceStats.totalChecks)
      : 0;
    
    const errorRate = this.performanceStats.totalChecks > 0
      ? this.performanceStats.totalErrors / this.performanceStats.totalChecks
      : 0;
    
    const report: HealthReport = {
      timestamp: new Date(),
      overallHealth: overallHealth.status,
      healthScore: overallHealth.score,
      services: metrics,
      alerts: activeAlerts,
      uptime: {
        total: this.calculateSystemUptime(),
        services: serviceUptimes
      },
      performance: {
        averageResponseTime: avgResponseTime,
        totalRequests: this.performanceStats.totalChecks,
        errorRate: Math.round(errorRate * 10000) / 100 // percentage with 2 decimals
      }
    };
    
    // Persist report if configured
    if (this.config.persistMetrics) {
      try {
        await this.supabase.from('port_health_reports').insert({
          timestamp: report.timestamp.toISOString(),
          overall_health: report.overallHealth,
          health_score: report.healthScore,
          services_count: report.services.length,
          active_alerts_count: report.alerts.length,
          system_uptime: report.uptime.total,
          avg_response_time: report.performance.averageResponseTime,
          error_rate: report.performance.errorRate,
          report_data: report
        });
      } catch (error) {
        logger.error('Failed to persist health report:', error);
      }
    }
    
    return report;
  }

  /**
   * Broadcast health status via WebSocket
   */
  broadcastHealthStatus(): void {
    if (!this.config.enableWebSocket || this.webSocketClients.size === 0) {
      return;
    }
    
    const status = {
      type: 'health_status',
      timestamp: new Date().toISOString(),
      overall: this.getOverallHealth(),
      services: Array.from(this.metricsCache.values()),
      alerts: this.getActiveAlerts()
    };
    
    this.webSocketClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(status));
        } catch (error) {
          logger.error('Failed to send WebSocket message:', error);
          this.webSocketClients.delete(ws);
        }
      } else {
        this.webSocketClients.delete(ws);
      }
    });
  }

  /**
   * Subscribe client to health updates
   */
  subscribeToHealthUpdates(ws: WebSocket): void {
    this.webSocketClients.add(ws);
    
    // Send current status immediately
    if (ws.readyState === WebSocket.OPEN) {
      const currentStatus = {
        type: 'health_status',
        timestamp: new Date().toISOString(),
        overall: this.getOverallHealth(),
        services: Array.from(this.metricsCache.values()),
        alerts: this.getActiveAlerts()
      };
      
      ws.send(JSON.stringify(currentStatus));
    }
    
    ws.on('close', () => {
      this.webSocketClients.delete(ws);
    });
    
    logger.info(`WebSocket client subscribed to health updates (total: ${this.webSocketClients.size})`);
  }

  /**
   * Emit health events for real-time updates
   */
  emitHealthEvents(): void {
    // This method can be called to trigger immediate health events
    this.emit('healthEventsRequested', {
      timestamp: new Date(),
      activeClients: this.webSocketClients.size,
      monitoring: this.isMonitoring
    });
    
    if (this.config.enableWebSocket) {
      this.broadcastHealthStatus();
    }
  }

  // Private helper methods

  private async handlePortStatusChange(event: any): Promise<void> {
    const { service, port, previousStatus, newStatus } = event;
    
    // Update metrics for the affected service
    try {
      const metric = await this.monitorServiceHealth(service);
      this.metricsCache.set(service, metric);
      
      // Check if this status change warrants an alert
      if (newStatus === 'unhealthy' && previousStatus === 'healthy') {
        await this.sendAlert('error', service, {
          port,
          previousStatus,
          newStatus,
          timestamp: new Date().toISOString()
        });
      } else if (newStatus === 'healthy' && previousStatus === 'unhealthy') {
        // Auto-resolve related alerts
        const relatedAlerts = Array.from(this.activeAlerts.values())
          .filter(alert => alert.service === service && !alert.resolved);
        
        for (const alert of relatedAlerts) {
          await this.resolveAlert(alert.id);
        }
        
        await this.sendAlert('info', service, {
          port,
          previousStatus,
          newStatus,
          message: 'Service recovered',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error(`Error handling port status change for ${service}:`, error);
    }
  }

  private handlePortConflictResolved(event: any): void {
    const { service, original, resolved } = event;
    
    logger.info(`Port conflict resolved for ${service}: ${original} -> ${resolved}`);
    this.emit('portConflictHandled', event);
  }

  private updateServiceHistory(service: string, metric: HealthMetric): void {
    let history = this.healthHistory.get(service);
    if (!history) {
      history = {
        service,
        metrics: [],
        downtime: [],
        lastHealthy: new Date(),
        consecutiveFailures: 0
      };
      this.healthHistory.set(service, history);
    }
    
    // Add metric to history
    history.metrics.push(metric);
    
    // Limit history size (keep last 1000 entries)
    if (history.metrics.length > 1000) {
      history.metrics = history.metrics.slice(-1000);
    }
    
    // Update status tracking
    if (metric.status === 'healthy') {
      history.lastHealthy = metric.lastCheck;
      history.consecutiveFailures = 0;
      
      // End any ongoing downtime
      const lastDowntime = history.downtime[history.downtime.length - 1];
      if (lastDowntime && !lastDowntime.end) {
        lastDowntime.end = metric.lastCheck;
      }
    } else if (metric.status === 'unhealthy') {
      history.consecutiveFailures++;
      this.recordDowntime(service, `Health check failed: ${metric.metadata.error || 'Unknown error'}`);
    }
  }

  private async evaluateAlertRules(): Promise<void> {
    const metrics = Array.from(this.metricsCache.values());
    
    for (const metric of metrics) {
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) continue;
        if (rule.service !== '*' && rule.service !== metric.service) continue;
        
        // Check if alert should be triggered
        const shouldAlert = await this.evaluateAlertCondition(rule, metric);
        
        if (shouldAlert) {
          // Check cooldown period
          const recentAlerts = Array.from(this.activeAlerts.values())
            .filter(alert => 
              alert.service === metric.service && 
              alert.type === this.getAlertTypeForCondition(rule.condition) &&
              (Date.now() - alert.createdAt.getTime()) < this.config.alertCooldown
            );
          
          if (recentAlerts.length === 0) {
            await this.sendAlert(
              this.getAlertTypeForCondition(rule.condition),
              metric.service,
              {
                rule: rule.id,
                condition: rule.condition,
                threshold: rule.threshold,
                currentValue: this.getCurrentValueForCondition(rule.condition, metric),
                metric
              }
            );
          }
        }
      }
    }
  }

  private async evaluateAlertCondition(rule: AlertRule, metric: HealthMetric): Promise<boolean> {
    switch (rule.condition) {
      case 'down':
        return metric.status === 'unhealthy';
      
      case 'slow_response':
        return rule.threshold !== undefined && metric.responseTime > rule.threshold;
      
      case 'high_error_rate':
        const history = this.healthHistory.get(metric.service);
        if (!history || !rule.threshold) return false;
        
        const recentMetrics = history.metrics.slice(-10); // Last 10 checks
        const errorRate = recentMetrics.filter(m => m.status === 'unhealthy').length / recentMetrics.length;
        return errorRate > rule.threshold;
      
      case 'degraded':
        return metric.status === 'degraded';
      
      default:
        return false;
    }
  }

  private getAlertTypeForCondition(condition: AlertRule['condition']): HealthAlert['type'] {
    switch (condition) {
      case 'down': return 'critical';
      case 'slow_response': return 'warning';
      case 'high_error_rate': return 'error';
      case 'degraded': return 'warning';
      default: return 'info';
    }
  }

  private getCurrentValueForCondition(condition: AlertRule['condition'], metric: HealthMetric): any {
    switch (condition) {
      case 'down': return metric.status;
      case 'slow_response': return metric.responseTime;
      case 'high_error_rate': return metric.errorCount;
      case 'degraded': return metric.status;
      default: return null;
    }
  }

  private generateAlertMessage(type: HealthAlert['type'], service: string, details: Record<string, any>): string {
    switch (type) {
      case 'critical':
        return `Service ${service} is down (port ${details.port || 'unknown'})`;
      case 'error':
        return `Service ${service} has connectivity issues: ${details.error || 'Unknown error'}`;
      case 'warning':
        return `Service ${service} performance degraded: ${details.reason || 'Slow response time'}`;
      case 'info':
        return `Service ${service} status update: ${details.message || 'Service recovered'}`;
      default:
        return `Service ${service} alert: ${details.message || 'Unknown issue'}`;
    }
  }

  private broadcastAlert(alert: HealthAlert): void {
    const message = {
      type: 'health_alert',
      timestamp: new Date().toISOString(),
      alert
    };
    
    this.webSocketClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
        } catch (error) {
          logger.error('Failed to broadcast alert:', error);
          this.webSocketClients.delete(ws);
        }
      }
    });
  }

  private calculateUptime(service: string): number {
    const history = this.healthHistory.get(service);
    if (!history || history.metrics.length === 0) return 0;
    
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMetrics = history.metrics.filter(m => m.lastCheck > last24Hours);
    
    if (recentMetrics.length === 0) return 0;
    
    const healthyChecks = recentMetrics.filter(m => m.status === 'healthy').length;
    return Math.round((healthyChecks / recentMetrics.length) * 100);
  }

  private calculateSystemUptime(): number {
    const uptimeMs = Date.now() - this.performanceStats.startTime.getTime();
    return Math.round(uptimeMs / 1000); // seconds
  }

  private getServiceErrorCount(service: string): number {
    const history = this.healthHistory.get(service);
    return history?.consecutiveFailures || 0;
  }

  private getServiceHealthCheckPath(service: string): string | undefined {
    // This would typically be configured per service
    const commonPaths: Record<string, string> = {
      'universal-ai-tools': '/health',
      'ollama': '/api/tags',
      'lm-studio': '/v1/models',
      'supabase': '/rest/v1/',
      'frontend': '/'
    };
    
    return commonPaths[service];
  }

  private async cleanupOldData(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.config.maxHistoryAge * 24 * 60 * 60 * 1000);
    
    // Clean up in-memory history
    this.healthHistory.forEach((history, service) => {
      history.metrics = history.metrics.filter(m => m.lastCheck > cutoffDate);
      history.downtime = history.downtime.filter(d => d.start > cutoffDate);
    });
    
    // Clean up resolved alerts older than 7 days
    const alertCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const alertsToRemove: string[] = [];
    
    this.activeAlerts.forEach((alert, id) => {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < alertCutoff) {
        alertsToRemove.push(id);
      }
    });
    
    alertsToRemove.forEach(id => this.activeAlerts.delete(id));
    
    // Clean up database if persistence is enabled
    if (this.config.persistMetrics) {
      try {
        await this.supabase
          .from('port_health_alerts')
          .delete()
          .lt('created_at', cutoffDate.toISOString())
          .eq('resolved', true);
        
        await this.supabase
          .from('port_health_reports')
          .delete()
          .lt('timestamp', cutoffDate.toISOString());
      } catch (error) {
        logger.error('Failed to cleanup old database records:', error);
      }
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): Record<string, any> {
    return {
      isMonitoring: this.isMonitoring,
      startTime: this.performanceStats.startTime,
      totalChecks: this.performanceStats.totalChecks,
      totalErrors: this.performanceStats.totalErrors,
      errorRate: this.performanceStats.totalChecks > 0 
        ? Math.round((this.performanceStats.totalErrors / this.performanceStats.totalChecks) * 100) 
        : 0,
      averageResponseTime: this.performanceStats.totalChecks > 0
        ? Math.round(this.performanceStats.totalResponseTime / this.performanceStats.totalChecks)
        : 0,
      activeServices: this.metricsCache.size,
      activeAlerts: this.activeAlerts.size,
      webSocketClients: this.webSocketClients.size,
      config: this.config
    };
  }
}

// Export utility function for easy instantiation
export function createPortHealthMonitor(
  portManager: SmartPortManager,
  supabaseUrl: string,
  supabaseKey: string,
  config?: Partial<MonitoringConfig>
): PortHealthMonitor {
  return new PortHealthMonitor(portManager, supabaseUrl, supabaseKey, config);
}
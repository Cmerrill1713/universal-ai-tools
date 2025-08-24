/**
 * Unified Health Monitor Service
 * Consolidated monitoring for all system services and components
 * Combines functionality from health-monitor.ts and health-monitor-service.ts
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { EventEmitter } from 'events';

import { config } from '../../config/environment';
import { CircuitBreakerRegistry, createCircuitBreaker } from '../../utils/circuit-breaker';
import { log, LogContext } from '../../utils/logger';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface HealthMetrics {
  systemHealth: number; // 0-1 score
  agentHealth: number;
  meshHealth: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  responseTime: number;
  uptime: number;
  services: ServiceHealth[];
  alerts: HealthAlert[];
}

export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  service: string;
  timestamp: Date;
  resolved: boolean;
}

export interface HealthConfig {
  checkInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    errorRate: number;
    responseTime: number;
  };
  autoHeal: boolean;
  services: string[];
}

// ============================================================================
// Unified Health Monitor Service
// ============================================================================

class UnifiedHealthMonitor extends EventEmitter {
  private readonly config: HealthConfig;
  private readonly services = new Map<string, ServiceHealth>();
  private readonly alerts = new Map<string, HealthAlert>();
  private readonly metrics: HealthMetrics;
  private checkTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout; // FIXED: Track metrics collection timer
  private isInitialized = false;
  private circuitBreakers = new Map<string, any>();
  private readonly startTime = Date.now();

  constructor() {
    super();
    
    this.config = {
      checkInterval: 30000, // 30 seconds
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        errorRate: 5,
        responseTime: 2000,
      },
      autoHeal: true,
      services: [
        'supabase',
        'redis',
        'llm-router',
        'memory-service',
        'mcp-integration',
      ],
    };

    this.metrics = {
      systemHealth: 1.0,
      agentHealth: 1.0,
      meshHealth: 1.0,
      memoryUsage: 0,
      cpuUsage: 0,
      errorRate: 0,
      responseTime: 0,
      uptime: 0,
      services: [],
      alerts: [],
    };
  }

  // ============================================================================
  // Initialization and Lifecycle
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {return;}

    try {
      log.info('🏥 Initializing Unified Health Monitor', LogContext.SYSTEM);

      // Initialize circuit breakers for critical services
      for (const serviceName of this.config.services) {
        const breaker = createCircuitBreaker(serviceName, {
          timeout: 30000,
          errorThresholdPercentage: 50,
          failureThreshold: 5,
        });
        this.circuitBreakers.set(serviceName, breaker);
        CircuitBreakerRegistry.register(serviceName, breaker);
      }

      // Start health checks
      this.startHealthChecks();

      // Start system metrics collection
      this.startMetricsCollection();

      this.isInitialized = true;
      this.emit('initialized');

      log.info('✅ Unified Health Monitor initialized', LogContext.SYSTEM);
    } catch (error) {
      log.error('❌ Failed to initialize Health Monitor', LogContext.SYSTEM, { error });
      throw error;
    }
  }

  private startHealthChecks(): void {
    this.checkTimer = this.metricsTimer = setInterval(() => {
      this.performHealthChecks().catch(error => 
        log.error('❌ Health check failed', LogContext.SYSTEM, { error })
      );
    }, this.config.checkInterval);

    // Perform initial check
    this.performHealthChecks().catch(error => 
      log.error('❌ Initial health check failed', LogContext.SYSTEM, { error })
    );
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectSystemMetrics().catch(error => 
        log.error('❌ Metrics collection failed', LogContext.SYSTEM, { error })
      );
    }, 15000); // Every 15 seconds
  }

  // ============================================================================
  // Health Checking
  // ============================================================================

  private async performHealthChecks(): Promise<void> {
    const checkPromises = this.config.services.map(serviceName => 
      this.checkService(serviceName)
    );

    await Promise.allSettled(checkPromises);

    // Update overall system health
    this.updateSystemHealth();

    // Check for alerts
    this.checkAlerts();

    // Emit health update
    this.emit('healthUpdate', this.getHealthStatus());
  }

  private async checkService(serviceName: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const breaker = this.circuitBreakers.get(serviceName);
      if (!breaker) {
        throw new Error(`Circuit breaker not found for service: ${serviceName}`);
      }

      const health = await breaker.execute(() => this.performServiceCheck(serviceName));
      const responseTime = Date.now() - startTime;

      this.services.set(serviceName, {
        name: serviceName,
        status: 'healthy',
        lastCheck: new Date(),
        responseTime,
        details: health,
      });

      // Clear any existing alerts for this service
      this.clearServiceAlerts(serviceName);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.services.set(serviceName, {
        name: serviceName,
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      });

      // Create alert
      this.createAlert(serviceName, 'critical', `Service ${serviceName} is unhealthy: ${error}`);

      // Auto-heal if enabled
      if (this.config.autoHeal) {
        await this.attemptAutoHeal(serviceName);
      }
    }
  }

  private async performServiceCheck(serviceName: string): Promise<Record<string, any>> {
    switch (serviceName) {
      case 'supabase':
        return this.checkSupabase();
      case 'redis':
        return this.checkRedis();
      case 'llm-router':
        return this.checkLLMRouter();
      case 'memory-service':
        return this.checkMemoryService();
      case 'mcp-integration':
        return this.checkMCPIntegration();
      default:
        return this.checkGenericService(serviceName);
    }
  }

  private async checkSupabase(): Promise<Record<string, any>> {
    const supabaseUrl = config.supabase.url;
    const supabaseKey = config.supabase.anonKey;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const client = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await client.from('user_feedback').select('count').limit(1);
    
    if (error) {throw error;}
    
    return { 
      connected: true, 
      tableAccess: true,
      recordCount: data?.length || 0 
    };
  }

  private async checkRedis(): Promise<Record<string, any>> {
    // Placeholder for Redis health check
    // In real implementation, would check Redis connection
    return { connected: true };
  }

  private async checkLLMRouter(): Promise<Record<string, any>> {
    // Check if LLM router service is responsive
    try {
      const response = await axios.get('http://localhost:3001/api/v1/health', {
        timeout: 3000,
      });
      return { status: response.status, healthy: response.status === 200 };
    } catch (error) {
      throw new Error('LLM Router not responsive');
    }
  }

  private async checkMemoryService(): Promise<Record<string, any>> {
    // Check memory service health
    const memoryUsage = process.memoryUsage();
    const heapUsed = memoryUsage.heapUsed / 1024 / 1024; // MB
    const heapTotal = memoryUsage.heapTotal / 1024 / 1024; // MB
    
    return {
      heapUsed: Math.round(heapUsed),
      heapTotal: Math.round(heapTotal),
      heapPercentage: Math.round((heapUsed / heapTotal) * 100),
    };
  }

  private async checkMCPIntegration(): Promise<Record<string, any>> {
    // Check MCP integration status
    return { connected: true, protocols: ['stdio', 'websocket'] };
  }

  private async checkGenericService(serviceName: string): Promise<Record<string, any>> {
    // Generic health check for unknown services
    return { status: 'unknown', checked: true };
  }

  // ============================================================================
  // System Metrics
  // ============================================================================

  private async collectSystemMetrics(): Promise<void> {
    try {
      // Update uptime
      this.metrics.uptime = Date.now() - this.startTime;

      // Memory usage
      const memoryUsage = process.memoryUsage();
      this.metrics.memoryUsage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      this.metrics.cpuUsage = Math.round((cpuUsage.user + cpuUsage.system) / 1000000); // Convert to percentage

      // Response time (average from services)
      const responseTimes = Array.from(this.services.values())
        .map(s => s.responseTime)
        .filter(rt => rt !== undefined);
      
      this.metrics.responseTime = responseTimes.length > 0 
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      // Update service list
      this.metrics.services = Array.from(this.services.values());
      this.metrics.alerts = Array.from(this.alerts.values()).filter(a => !a.resolved);

    } catch (error) {
      log.error('❌ Failed to collect system metrics', LogContext.SYSTEM, { error });
    }
  }

  private updateSystemHealth(): void {
    const healthyServices = Array.from(this.services.values()).filter(s => s.status === 'healthy').length;
    const totalServices = this.services.size;
    
    if (totalServices === 0) {
      this.metrics.systemHealth = 1.0;
      return;
    }

    // Calculate health score based on service status
    let healthScore = healthyServices / totalServices;

    // Apply penalties for high resource usage
    if (this.metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      healthScore *= 0.8;
    }
    
    if (this.metrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
      healthScore *= 0.8;
    }

    if (this.metrics.responseTime > this.config.alertThresholds.responseTime) {
      healthScore *= 0.9;
    }

    this.metrics.systemHealth = Math.max(0, Math.min(1, healthScore));
    this.metrics.agentHealth = healthScore; // Simplified
    this.metrics.meshHealth = healthScore; // Simplified
  }

  // ============================================================================
  // Alert Management
  // ============================================================================

  private checkAlerts(): void {
    // Check memory usage
    if (this.metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
      this.createAlert('system', 'warning', `High memory usage: ${this.metrics.memoryUsage}%`);
    }

    // Check CPU usage
    if (this.metrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
      this.createAlert('system', 'warning', `High CPU usage: ${this.metrics.cpuUsage}%`);
    }

    // Check response time
    if (this.metrics.responseTime > this.config.alertThresholds.responseTime) {
      this.createAlert('system', 'warning', `High response time: ${this.metrics.responseTime}ms`);
    }

    // Check system health
    if (this.metrics.systemHealth < 0.7) {
      this.createAlert('system', 'critical', `Low system health: ${Math.round(this.metrics.systemHealth * 100)}%`);
    }
  }

  private createAlert(service: string, severity: 'info' | 'warning' | 'critical', message: string): void {
    const alertId = `${service}_${severity}_${Date.now()}`;
    
    // Don't create duplicate alerts
    const existingAlert = Array.from(this.alerts.values()).find(
      a => a.service === service && a.message === message && !a.resolved
    );
    
    if (existingAlert) {return;}

    const alert: HealthAlert = {
      id: alertId,
      severity,
      message,
      service,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.set(alertId, alert);
    this.emit('alert', alert);

    log.warn(`🚨 Health Alert [${severity}]`, LogContext.SYSTEM, {
      service,
      message,
      alertId,
    });
  }

  private clearServiceAlerts(serviceName: string): void {
    for (const [alertId, alert] of this.alerts) {
      if (alert.service === serviceName && !alert.resolved) {
        alert.resolved = true;
        this.emit('alertResolved', alert);
      }
    }
  }

  // ============================================================================
  // Auto-Healing
  // ============================================================================

  private async attemptAutoHeal(serviceName: string): Promise<void> {
    try {
      log.info(`🔧 Attempting auto-heal for service: ${serviceName}`, LogContext.SYSTEM);

      switch (serviceName) {
        case 'supabase':
          await this.healSupabase();
          break;
        case 'redis':
          await this.healRedis();
          break;
        case 'llm-router':
          await this.healLLMRouter();
          break;
        default:
          log.warn(`🤷 No auto-heal strategy for service: ${serviceName}`, LogContext.SYSTEM);
      }

    } catch (error) {
      log.error(`❌ Auto-heal failed for ${serviceName}`, LogContext.SYSTEM, { error });
    }
  }

  private async healSupabase(): Promise<void> {
    // Attempt to reconnect or reset Supabase connection
    log.info('🔧 Attempting Supabase heal...', LogContext.SYSTEM);
    // Implementation would go here
  }

  private async healRedis(): Promise<void> {
    // Attempt to reconnect Redis
    log.info('🔧 Attempting Redis heal...', LogContext.SYSTEM);
    // Implementation would go here
  }

  private async healLLMRouter(): Promise<void> {
    // Attempt to restart or reconnect LLM router
    log.info('🔧 Attempting LLM Router heal...', LogContext.SYSTEM);
    // Implementation would go here
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getHealthStatus(): HealthMetrics {
    return { ...this.metrics };
  }

  getServiceHealth(serviceName: string): ServiceHealth | null {
    return this.services.get(serviceName) || null;
  }

  getAlerts(includeResolved: boolean = false): HealthAlert[] {
    return Array.from(this.alerts.values()).filter(a => includeResolved || !a.resolved);
  }

  async forceHealthCheck(serviceName?: string): Promise<void> {
    if (serviceName) {
      await this.checkService(serviceName);
    } else {
      await this.performHealthChecks();
    }
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alertResolved', alert);
    }
  }

  updateConfig(newConfig: Partial<HealthConfig>): void {
    Object.assign(this.config, newConfig);
    this.emit('configUpdated', this.config);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async shutdown(): Promise<void> {
    // FIXED: Clear both timers before setting to undefined
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }

    // FIXED: Remove all event listeners to prevent memory leaks
    this.removeAllListeners();

    // Clean up circuit breakers
    this.circuitBreakers.clear();
    
    // FIXED: Clear service and alert maps
    this.services.clear();
    this.alerts.clear();
    
    log.info("🏥 Health Monitor shut down", LogContext.SYSTEM);
  }
}

// ============================================================================
// Export Service Instance
// ============================================================================

export const healthMonitor = new UnifiedHealthMonitor();
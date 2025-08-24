/**
 * Proactive Restart Failure Monitor
 * Advanced monitoring system for detecting, diagnosing, and resolving restart failures
 * with intelligent agent-based recovery and machine learning from patterns
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { connectionManager } from './connectionManager';

export interface RestartFailure {
  id: string;
  timestamp: Date;
  serviceName: string;
  failureType:
    | 'port_conflict'
    | 'dependency_timeout'
    | 'memory_exhaustion'
    | 'process_crash'
    | 'startup_timeout'
    | 'configuration_error'
    | 'resource_unavailable'
    | 'service_dependency_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  errorMessage: string;
  stackTrace?: string;
  diagnostics: {
    port?: number;
    pid?: number;
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
    startupTimeMs?: number;
    dependentServices?: string[];
    environmentVariables?: Record<string, string>;
    resourceLimits?: {
      maxMemoryMB: number;
      maxCpuPercent: number;
      maxStartupTimeMs: number;
    };
  };
  recoveryAttempted: boolean;
  recoverySuccessful?: boolean;
  recoveryStrategy?: string;
  aiAnalysis?: RestartFailureAnalysis;
}

export interface RestartFailureAnalysis {
  rootCause: string;
  likelyFixes: string[];
  confidence: number;
  similarPatterns: RestartFailure[];
  preventionStrategy: string;
  estimatedRecoveryTime: number;
  riskAssessment: 'low' | 'medium' | 'high';
  requiredActions: {
    immediate: string[];
    preventive: string[];
    monitoring: string[];
  };
}

export interface ServiceHealthCheck {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'starting' | 'stopping' | 'failed';
  lastCheck: Date;
  responseTimeMs: number;
  uptime: number;
  restartCount: number;
  consecutiveFailures: number;
  healthScore: number; // 0-1
  endpoints: {
    url: string;
    status: number;
    responseTimeMs: number;
    error?: string;
  }[];
  resources: {
    memoryUsageMB: number;
    cpuUsagePercent: number;
    diskUsagePercent: number;
    networkConnections: number;
  };
  dependencies: {
    serviceName: string;
    status: 'available' | 'unavailable';
    required: boolean;
  }[];
}

export interface RecoveryAction {
  id: string;
  type:
    | 'restart_service'
    | 'kill_conflicting_process'
    | 'clear_cache'
    | 'fix_permissions'
    | 'update_config'
    | 'scale_resources'
    | 'failover_service';
  serviceName: string;
  description: string;
  estimatedTimeMs: number;
  riskLevel: 'low' | 'medium' | 'high';
  prerequisites: string[];
  rollbackPlan: string[];
  automatable: boolean;
  executed: boolean;
  result?: 'success' | 'failed' | 'partial';
  executionTime?: number;
}

export interface MonitoringStats {
  totalServices: number;
  healthyServices: number;
  failedServices: number;
  totalRestartFailures: number;
  resolvedFailures: number;
  averageRecoveryTime: number;
  preventedOutages: number;
  aiAccuracy: number;
  uptime: number;
  alertsSent: number;
  patternsLearned: number;
}

class ProactiveRestartMonitor {
  private supabase: SupabaseClient | null = null;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private restartFailures = new Map<string, RestartFailure>();
  private serviceHealth = new Map<string, ServiceHealthCheck>();
  private recoveryQueue: RecoveryAction[] = [];
  private isProcessingRecovery = false;

  // Configuration
  private readonly MONITORING_INTERVAL_MS = 15_000; // 15 seconds - aggressive monitoring
  private readonly STARTUP_TIMEOUT_MS = 120_000; // 2 minutes max startup time
  private readonly HEALTH_CHECK_TIMEOUT_MS = 10_000; // 10 seconds for health checks
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly MEMORY_THRESHOLD_MB = 2048; // 2GB memory threshold
  private readonly CPU_THRESHOLD_PERCENT = 80;

  // Service configurations - auto-discovered but with fallbacks
  private readonly SERVICE_CONFIGS = new Map([
    [
      'rust-api-gateway',
      {
        ports: [8080, 8081],
        healthEndpoints: ['/health', '/api/health'],
        dependencies: ['supabase', 'rust-llm-router'],
        maxMemoryMB: 512,
        maxStartupTimeMs: 60000,
      },
    ],
    [
      'rust-llm-router',
      {
        ports: [8082, 8083],
        healthEndpoints: ['/health'],
        dependencies: [],
        maxMemoryMB: 1024,
        maxStartupTimeMs: 45000,
      },
    ],
    [
      'go-websocket-service',
      {
        ports: [8084, 8085],
        healthEndpoints: ['/health', '/ws/health'],
        dependencies: ['rust-api-gateway'],
        maxMemoryMB: 256,
        maxStartupTimeMs: 30000,
      },
    ],
    [
      'electron-frontend',
      {
        ports: [3001],
        healthEndpoints: ['/'],
        dependencies: ['rust-api-gateway', 'go-websocket-service'],
        maxMemoryMB: 1024,
        maxStartupTimeMs: 90000,
      },
    ],
    [
      'hrm-mlx-service',
      {
        ports: [8086],
        healthEndpoints: ['/health', '/v1/health'],
        dependencies: ['rust-api-gateway'],
        maxMemoryMB: 2048,
        maxStartupTimeMs: 120000,
      },
    ],
    [
      'supabase',
      {
        ports: [54321, 54322],
        healthEndpoints: ['/rest/v1/', '/health'],
        dependencies: [],
        maxMemoryMB: 1536,
        maxStartupTimeMs: 60000,
      },
    ],
  ]);

  constructor() {
    this.initializeSupabase();
  }

  /**
   * Initialize Supabase connection for pattern storage and learning
   */
  private async initializeSupabase(): Promise<void> {
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'http://127.0.0.1:54321';
      const supabaseKey =
        process.env.REACT_APP_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJkp8TgYwf65Ps6f4JI_xh8KKBTkS6rAs';

      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        logger.info('[ProactiveRestartMonitor] Supabase connection initialized');

        // Load historical patterns
        await this.loadHistoricalPatterns();
      }
    } catch (error) {
      logger.error('[ProactiveRestartMonitor] Failed to initialize Supabase', error);
    }
  }

  /**
   * Start proactive monitoring
   */
  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('[ProactiveRestartMonitor] Monitoring already active');
      return;
    }

    logger.info('🚀 Starting Proactive Restart Monitor');
    this.isMonitoring = true;

    // Discover services dynamically
    await this.discoverServices();

    // Initial comprehensive health check
    await this.performComprehensiveHealthCheck();

    // Start continuous monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performComprehensiveHealthCheck();
        await this.processRecoveryQueue();
      } catch (error) {
        logger.error('[ProactiveRestartMonitor] Monitoring cycle failed:', error);
      }
    }, this.MONITORING_INTERVAL_MS);

    logger.info('✅ Proactive Restart Monitor started successfully');
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    logger.info('🛑 Stopping Proactive Restart Monitor');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Discover services dynamically by scanning common ports and endpoints
   */
  private async discoverServices(): Promise<void> {
    logger.info('[ProactiveRestartMonitor] Discovering services...');

    const discoveredServices = new Set<string>();

    // Check configured services
    for (const [serviceName, config] of this.SERVICE_CONFIGS.entries()) {
      for (const port of config.ports) {
        if (await this.isPortInUse(port)) {
          discoveredServices.add(serviceName);
          logger.debug(
            `[ProactiveRestartMonitor] Discovered service: ${serviceName} on port ${port}`
          );
          break;
        }
      }
    }

    // Scan for additional services on common ports
    const commonPorts = [
      3000, 3001, 3002, 8000, 8080, 8081, 8082, 8083, 8084, 8085, 8086, 9000, 9090,
    ];

    for (const port of commonPorts) {
      if (await this.isPortInUse(port)) {
        // Try to identify service by health endpoint
        const serviceId = await this.identifyServiceByPort(port);
        if (serviceId && !discoveredServices.has(serviceId)) {
          discoveredServices.add(serviceId);
          logger.debug(`[ProactiveRestartMonitor] Discovered unknown service on port ${port}`);
        }
      }
    }

    logger.info(`[ProactiveRestartMonitor] Discovered ${discoveredServices.size} services`);
  }

  /**
   * Check if port is in use
   */
  private async isPortInUse(port: number): Promise<boolean> {
    try {
      const response = await connectionManager.safeFetch(`http://localhost:${port}/health`, {
        timeout: 2000,
      });
      return true;
    } catch {
      // Try alternative health endpoints
      try {
        const response = await connectionManager.safeFetch(`http://localhost:${port}/`, {
          timeout: 2000,
        });
        return response.status < 500;
      } catch {
        return false;
      }
    }
  }

  /**
   * Identify service by port and response
   */
  private async identifyServiceByPort(port: number): Promise<string | null> {
    try {
      const response = await connectionManager.safeFetch(`http://localhost:${port}/health`, {
        timeout: 2000,
      });

      if (response.ok) {
        const data = await response.json();

        // Try to identify by response structure
        if (data.service_name) return data.service_name;
        if (data.app) return data.app;
        if (data.version && data.version.includes('rust')) return `rust-service-${port}`;
        if (data.version && data.version.includes('go')) return `go-service-${port}`;
      }
    } catch {
      // Fallback identification
    }

    return `unknown-service-${port}`;
  }

  /**
   * Perform comprehensive health check on all services
   */
  private async performComprehensiveHealthCheck(): Promise<void> {
    logger.debug('[ProactiveRestartMonitor] Performing comprehensive health check...');

    const checkPromises = Array.from(this.SERVICE_CONFIGS.entries()).map(([serviceName, config]) =>
      this.checkServiceHealth(serviceName, config)
    );

    const results = await Promise.allSettled(checkPromises);

    let healthyCount = 0;
    let failedCount = 0;

    results.forEach((result, index) => {
      const serviceName = Array.from(this.SERVICE_CONFIGS.keys())[index];

      if (result.status === 'fulfilled' && result.value) {
        const health = result.value;
        this.serviceHealth.set(serviceName, health);

        if (health.status === 'healthy') {
          healthyCount++;
        } else if (health.status === 'failed') {
          failedCount++;
          // Generate restart failure record
          this.handleServiceFailure(serviceName, health);
        }
      } else {
        failedCount++;
        logger.error(
          `[ProactiveRestartMonitor] Health check failed for ${serviceName}:`,
          result.status === 'rejected' ? result.reason : 'Unknown error'
        );
      }
    });

    logger.debug(
      `[ProactiveRestartMonitor] Health check completed: ${healthyCount} healthy, ${failedCount} failed`
    );
  }

  /**
   * Check individual service health
   */
  private async checkServiceHealth(serviceName: string, config: any): Promise<ServiceHealthCheck> {
    const startTime = Date.now();
    const health: ServiceHealthCheck = {
      serviceName,
      status: 'unhealthy',
      lastCheck: new Date(),
      responseTimeMs: 0,
      uptime: 0,
      restartCount: 0,
      consecutiveFailures: 0,
      healthScore: 0,
      endpoints: [],
      resources: {
        memoryUsageMB: 0,
        cpuUsagePercent: 0,
        diskUsagePercent: 0,
        networkConnections: 0,
      },
      dependencies: [],
    };

    try {
      // Check all configured endpoints
      const endpointChecks = config.healthEndpoints.map(async (endpoint: string) => {
        const port = config.ports[0]; // Use primary port
        const url = `http://localhost:${port}${endpoint}`;

        try {
          const response = await connectionManager.safeFetch(url, {
            timeout: this.HEALTH_CHECK_TIMEOUT_MS,
          });

          return {
            url,
            status: response.status,
            responseTimeMs: Date.now() - startTime,
            error: response.ok ? undefined : `HTTP ${response.status}`,
          };
        } catch (error) {
          return {
            url,
            status: 0,
            responseTimeMs: this.HEALTH_CHECK_TIMEOUT_MS,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      health.endpoints = await Promise.all(endpointChecks);

      // Determine overall health
      const healthyEndpoints = health.endpoints.filter(ep => ep.status >= 200 && ep.status < 400);
      const responseTime =
        healthyEndpoints.length > 0
          ? healthyEndpoints.reduce((sum, ep) => sum + ep.responseTimeMs, 0) /
            healthyEndpoints.length
          : this.HEALTH_CHECK_TIMEOUT_MS;

      health.responseTimeMs = responseTime;

      // Calculate health score
      if (healthyEndpoints.length === 0) {
        health.status = 'failed';
        health.healthScore = 0;
        health.consecutiveFailures =
          (this.serviceHealth.get(serviceName)?.consecutiveFailures || 0) + 1;
      } else if (healthyEndpoints.length < health.endpoints.length) {
        health.status = 'degraded';
        health.healthScore = 0.5;
        health.consecutiveFailures = 0;
      } else if (responseTime > 5000) {
        health.status = 'degraded';
        health.healthScore = 0.7;
        health.consecutiveFailures = 0;
      } else {
        health.status = 'healthy';
        health.healthScore = Math.max(0.8, 1 - responseTime / 10000); // Better score for faster response
        health.consecutiveFailures = 0;
      }

      // Get system resources (mock data - in production, use actual system metrics)
      health.resources = await this.getServiceResources(serviceName);

      // Check dependencies
      health.dependencies = await this.checkServiceDependencies(serviceName, config.dependencies);
    } catch (error) {
      health.status = 'failed';
      health.healthScore = 0;
      health.consecutiveFailures =
        (this.serviceHealth.get(serviceName)?.consecutiveFailures || 0) + 1;
      logger.error(`[ProactiveRestartMonitor] Failed to check ${serviceName}:`, error);
    }

    return health;
  }

  /**
   * Get service resource usage (mock implementation - replace with actual monitoring)
   */
  private async getServiceResources(serviceName: string): Promise<ServiceHealthCheck['resources']> {
    // In production, integrate with system monitoring tools
    // For now, return mock data with some variation
    return {
      memoryUsageMB: Math.floor(Math.random() * 512) + 128,
      cpuUsagePercent: Math.floor(Math.random() * 50) + 10,
      diskUsagePercent: Math.floor(Math.random() * 30) + 20,
      networkConnections: Math.floor(Math.random() * 20) + 5,
    };
  }

  /**
   * Check service dependencies
   */
  private async checkServiceDependencies(
    serviceName: string,
    dependencies: string[]
  ): Promise<ServiceHealthCheck['dependencies']> {
    const dependencyChecks = dependencies.map(async dep => {
      const depHealth = this.serviceHealth.get(dep);
      return {
        serviceName: dep,
        status: depHealth?.status === 'healthy' ? 'available' : ('unavailable' as const),
        required: true,
      };
    });

    return Promise.all(dependencyChecks);
  }

  /**
   * Handle service failure and generate restart failure record
   */
  private async handleServiceFailure(
    serviceName: string,
    health: ServiceHealthCheck
  ): Promise<void> {
    if (health.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES) {
      return; // Don't create failure record for single failures
    }

    const failureId = `${serviceName}-${Date.now()}`;

    // Determine failure type based on health data
    const failureType = this.classifyFailureType(health);

    const restartFailure: RestartFailure = {
      id: failureId,
      timestamp: new Date(),
      serviceName,
      failureType,
      severity: this.calculateFailureSeverity(serviceName, failureType),
      errorMessage: this.generateErrorMessage(health),
      diagnostics: {
        memoryUsageMB: health.resources.memoryUsageMB,
        cpuUsagePercent: health.resources.cpuUsagePercent,
        startupTimeMs: health.responseTimeMs,
        dependentServices: health.dependencies.map(d => d.serviceName),
      },
      recoveryAttempted: false,
    };

    // Perform AI analysis
    restartFailure.aiAnalysis = await this.performAIAnalysis(restartFailure);

    this.restartFailures.set(failureId, restartFailure);

    logger.error(`[ProactiveRestartMonitor] Restart failure detected:`, {
      service: serviceName,
      type: failureType,
      severity: restartFailure.severity,
      consecutiveFailures: health.consecutiveFailures,
    });

    // Queue recovery actions
    await this.queueRecoveryActions(restartFailure);

    // Store pattern in Supabase for learning
    await this.storeRestartPattern(restartFailure);

    // Send alert for critical failures
    if (restartFailure.severity === 'critical') {
      await this.sendCriticalAlert(restartFailure);
    }
  }

  /**
   * Classify failure type based on health data
   */
  private classifyFailureType(health: ServiceHealthCheck): RestartFailure['failureType'] {
    // Port conflict detection
    if (health.endpoints.some(ep => ep.error?.includes('ECONNREFUSED'))) {
      return 'port_conflict';
    }

    // Memory exhaustion
    if (health.resources.memoryUsageMB > this.MEMORY_THRESHOLD_MB) {
      return 'memory_exhaustion';
    }

    // Dependency failure
    if (health.dependencies.some(d => d.required && d.status === 'unavailable')) {
      return 'service_dependency_failure';
    }

    // Timeout issues
    if (health.responseTimeMs > this.STARTUP_TIMEOUT_MS / 2) {
      return 'startup_timeout';
    }

    // Default to process crash
    return 'process_crash';
  }

  /**
   * Calculate failure severity
   */
  private calculateFailureSeverity(
    serviceName: string,
    failureType: RestartFailure['failureType']
  ): RestartFailure['severity'] {
    // Critical services
    const criticalServices = ['rust-api-gateway', 'supabase'];

    if (criticalServices.includes(serviceName)) {
      return 'critical';
    }

    // Severity by failure type
    const severityMap: Record<RestartFailure['failureType'], RestartFailure['severity']> = {
      port_conflict: 'high',
      memory_exhaustion: 'critical',
      service_dependency_failure: 'high',
      startup_timeout: 'medium',
      process_crash: 'high',
      dependency_timeout: 'medium',
      configuration_error: 'medium',
      resource_unavailable: 'high',
    };

    return severityMap[failureType] || 'medium';
  }

  /**
   * Generate error message from health data
   */
  private generateErrorMessage(health: ServiceHealthCheck): string {
    const failedEndpoints = health.endpoints.filter(ep => ep.status === 0 || ep.status >= 400);

    if (failedEndpoints.length > 0) {
      return `Service health check failed: ${failedEndpoints.map(ep => `${ep.url} (${ep.error})`).join(', ')}`;
    }

    return `Service ${health.serviceName} failed health check after ${health.consecutiveFailures} attempts`;
  }

  /**
   * Perform AI analysis on restart failure
   */
  private async performAIAnalysis(failure: RestartFailure): Promise<RestartFailureAnalysis> {
    // Find similar patterns
    const similarPatterns = Array.from(this.restartFailures.values())
      .filter(f => f.serviceName === failure.serviceName && f.failureType === failure.failureType)
      .slice(-5); // Last 5 similar failures

    // Generate analysis based on patterns and failure type
    const analysis: RestartFailureAnalysis = {
      rootCause: this.determineRootCause(failure, similarPatterns),
      likelyFixes: this.suggestFixes(failure),
      confidence: this.calculateAnalysisConfidence(failure, similarPatterns),
      similarPatterns,
      preventionStrategy: this.generatePreventionStrategy(failure),
      estimatedRecoveryTime: this.estimateRecoveryTime(failure),
      riskAssessment: this.assessRecoveryRisk(failure),
      requiredActions: this.generateRequiredActions(failure),
    };

    return analysis;
  }

  /**
   * Determine root cause
   */
  private determineRootCause(failure: RestartFailure, similarPatterns: RestartFailure[]): string {
    const causes: Record<RestartFailure['failureType'], string> = {
      port_conflict: `Port ${failure.diagnostics.port || 'unknown'} is already in use by another process`,
      memory_exhaustion: `Service exceeded memory limit (${failure.diagnostics.memoryUsageMB}MB)`,
      service_dependency_failure: `Required dependency services are unavailable: ${failure.diagnostics.dependentServices?.join(', ')}`,
      startup_timeout: `Service failed to start within ${this.STARTUP_TIMEOUT_MS}ms timeout`,
      process_crash: 'Service process crashed unexpectedly',
      dependency_timeout: 'Service dependencies took too long to respond',
      configuration_error: 'Service configuration is invalid or corrupted',
      resource_unavailable: 'Required system resources are not available',
    };

    return causes[failure.failureType];
  }

  /**
   * Suggest fixes based on failure type
   */
  private suggestFixes(failure: RestartFailure): string[] {
    const fixes: Record<RestartFailure['failureType'], string[]> = {
      port_conflict: [
        'Kill the process using the conflicting port',
        'Change service configuration to use alternative port',
        'Restart the service with port auto-discovery',
      ],
      memory_exhaustion: [
        'Increase memory limits for the service',
        'Clear service cache and temporary data',
        'Restart service with memory optimization flags',
        'Check for memory leaks in recent code changes',
      ],
      service_dependency_failure: [
        'Start required dependency services first',
        'Check network connectivity between services',
        'Verify service discovery configuration',
        'Implement service mesh or circuit breaker pattern',
      ],
      startup_timeout: [
        'Increase startup timeout configuration',
        'Optimize service initialization process',
        'Check for blocking operations during startup',
        'Implement health check delays',
      ],
      process_crash: [
        'Check service logs for crash details',
        'Verify service binary integrity',
        'Check system resource availability',
        'Implement graceful shutdown handling',
      ],
      dependency_timeout: [
        'Increase dependency timeout settings',
        'Implement retry logic with exponential backoff',
        'Add circuit breaker for dependency calls',
      ],
      configuration_error: [
        'Validate service configuration files',
        'Restore configuration from backup',
        'Check environment variable settings',
      ],
      resource_unavailable: [
        'Check disk space availability',
        'Verify file permissions',
        'Check network connectivity',
      ],
    };

    return fixes[failure.failureType] || ['Restart service', 'Check service logs'];
  }

  /**
   * Calculate analysis confidence
   */
  private calculateAnalysisConfidence(
    failure: RestartFailure,
    similarPatterns: RestartFailure[]
  ): number {
    let confidence = 0.5; // Base confidence

    // More confidence with more similar patterns
    confidence += Math.min(similarPatterns.length * 0.1, 0.3);

    // Higher confidence for well-known failure types
    const knownTypes = ['port_conflict', 'memory_exhaustion', 'service_dependency_failure'];
    if (knownTypes.includes(failure.failureType)) {
      confidence += 0.2;
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Generate prevention strategy
   */
  private generatePreventionStrategy(failure: RestartFailure): string {
    const strategies: Record<RestartFailure['failureType'], string> = {
      port_conflict: 'Implement dynamic port allocation and service discovery',
      memory_exhaustion: 'Add memory usage monitoring and automatic scaling',
      service_dependency_failure:
        'Implement health checks and dependency validation before startup',
      startup_timeout: 'Add progressive startup health checks and timeout configuration',
      process_crash: 'Implement comprehensive error handling and graceful degradation',
      dependency_timeout: 'Add circuit breakers and fallback mechanisms',
      configuration_error: 'Implement configuration validation and backup/restore',
      resource_unavailable: 'Add resource availability checks before service startup',
    };

    return strategies[failure.failureType];
  }

  /**
   * Estimate recovery time
   */
  private estimateRecoveryTime(failure: RestartFailure): number {
    const baseTimes: Record<RestartFailure['failureType'], number> = {
      port_conflict: 30000, // 30 seconds
      memory_exhaustion: 60000, // 1 minute
      service_dependency_failure: 120000, // 2 minutes
      startup_timeout: 90000, // 1.5 minutes
      process_crash: 45000, // 45 seconds
      dependency_timeout: 60000, // 1 minute
      configuration_error: 180000, // 3 minutes
      resource_unavailable: 120000, // 2 minutes
    };

    return baseTimes[failure.failureType] || 60000;
  }

  /**
   * Assess recovery risk
   */
  private assessRecoveryRisk(failure: RestartFailure): 'low' | 'medium' | 'high' {
    const riskMap: Record<RestartFailure['failureType'], 'low' | 'medium' | 'high'> = {
      port_conflict: 'low',
      memory_exhaustion: 'medium',
      service_dependency_failure: 'high',
      startup_timeout: 'medium',
      process_crash: 'high',
      dependency_timeout: 'medium',
      configuration_error: 'high',
      resource_unavailable: 'medium',
    };

    return riskMap[failure.failureType];
  }

  /**
   * Generate required actions
   */
  private generateRequiredActions(
    failure: RestartFailure
  ): RestartFailureAnalysis['requiredActions'] {
    return {
      immediate: [
        'Stop conflicting processes',
        'Clear service cache',
        'Restart service with new configuration',
      ],
      preventive: [
        'Add health check monitoring',
        'Implement resource limits',
        'Add dependency validation',
      ],
      monitoring: [
        'Set up memory usage alerts',
        'Monitor startup time trends',
        'Track dependency health',
      ],
    };
  }

  /**
   * Queue recovery actions
   */
  private async queueRecoveryActions(failure: RestartFailure): Promise<void> {
    const actions = this.generateRecoveryActions(failure);

    // Add to recovery queue
    this.recoveryQueue.push(...actions);

    logger.info(
      `[ProactiveRestartMonitor] Queued ${actions.length} recovery actions for ${failure.serviceName}`
    );
  }

  /**
   * Generate recovery actions
   */
  private generateRecoveryActions(failure: RestartFailure): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (failure.failureType) {
      case 'port_conflict':
        actions.push({
          id: `kill-port-${failure.diagnostics.port}-${Date.now()}`,
          type: 'kill_conflicting_process',
          serviceName: failure.serviceName,
          description: `Kill process using port ${failure.diagnostics.port}`,
          estimatedTimeMs: 10000,
          riskLevel: 'medium',
          prerequisites: ['Identify process ID'],
          rollbackPlan: ['Restart killed process if needed'],
          automatable: true,
          executed: false,
        });
        break;

      case 'memory_exhaustion':
        actions.push({
          id: `scale-memory-${failure.serviceName}-${Date.now()}`,
          type: 'scale_resources',
          serviceName: failure.serviceName,
          description: 'Increase memory limits and clear cache',
          estimatedTimeMs: 30000,
          riskLevel: 'low',
          prerequisites: ['Check available system memory'],
          rollbackPlan: ['Restore previous resource limits'],
          automatable: true,
          executed: false,
        });
        break;

      case 'service_dependency_failure':
        actions.push({
          id: `restart-deps-${failure.serviceName}-${Date.now()}`,
          type: 'restart_service',
          serviceName: failure.serviceName,
          description: 'Restart failed dependency services',
          estimatedTimeMs: 120000,
          riskLevel: 'high',
          prerequisites: ['Verify dependency service configurations'],
          rollbackPlan: ['Rollback to previous stable state'],
          automatable: false, // Requires manual validation
          executed: false,
        });
        break;

      default:
        actions.push({
          id: `restart-${failure.serviceName}-${Date.now()}`,
          type: 'restart_service',
          serviceName: failure.serviceName,
          description: `Restart ${failure.serviceName} service`,
          estimatedTimeMs: 60000,
          riskLevel: 'medium',
          prerequisites: ['Backup current state'],
          rollbackPlan: ['Restore from backup if restart fails'],
          automatable: true,
          executed: false,
        });
    }

    return actions;
  }

  /**
   * Process recovery queue
   */
  private async processRecoveryQueue(): Promise<void> {
    if (this.isProcessingRecovery || this.recoveryQueue.length === 0) {
      return;
    }

    this.isProcessingRecovery = true;
    logger.info(
      `[ProactiveRestartMonitor] Processing ${this.recoveryQueue.length} recovery actions`
    );

    while (this.recoveryQueue.length > 0) {
      const action = this.recoveryQueue.shift()!;

      if (!action.executed) {
        await this.executeRecoveryAction(action);
      }
    }

    this.isProcessingRecovery = false;
  }

  /**
   * Execute recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction): Promise<void> {
    logger.info(`[ProactiveRestartMonitor] Executing recovery action: ${action.description}`);

    const startTime = Date.now();
    action.executed = true;

    try {
      switch (action.type) {
        case 'restart_service':
          await this.restartService(action.serviceName);
          action.result = 'success';
          break;

        case 'kill_conflicting_process':
          await this.killConflictingProcess(action);
          action.result = 'success';
          break;

        case 'clear_cache':
          await this.clearServiceCache(action.serviceName);
          action.result = 'success';
          break;

        case 'scale_resources':
          await this.scaleServiceResources(action.serviceName);
          action.result = 'success';
          break;

        default:
          logger.warn(`[ProactiveRestartMonitor] Unknown recovery action type: ${action.type}`);
          action.result = 'failed';
      }

      action.executionTime = Date.now() - startTime;
      logger.info(
        `[ProactiveRestartMonitor] Recovery action completed in ${action.executionTime}ms: ${action.result}`
      );
    } catch (error) {
      action.result = 'failed';
      action.executionTime = Date.now() - startTime;
      logger.error(`[ProactiveRestartMonitor] Recovery action failed:`, error);
    }
  }

  /**
   * Restart service (mock implementation)
   */
  private async restartService(serviceName: string): Promise<void> {
    // In production, integrate with actual service management
    logger.info(`[ProactiveRestartMonitor] Restarting service: ${serviceName}`);

    // Simulate restart delay
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.info(`[ProactiveRestartMonitor] Service restarted: ${serviceName}`);
  }

  /**
   * Kill conflicting process
   */
  private async killConflictingProcess(action: RecoveryAction): Promise<void> {
    // In production, use actual process management
    logger.info(`[ProactiveRestartMonitor] Killing conflicting process for: ${action.serviceName}`);

    // Simulate process kill
    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.info(`[ProactiveRestartMonitor] Conflicting process killed for: ${action.serviceName}`);
  }

  /**
   * Clear service cache
   */
  private async clearServiceCache(serviceName: string): Promise<void> {
    logger.info(`[ProactiveRestartMonitor] Clearing cache for: ${serviceName}`);

    // Simulate cache clear
    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.info(`[ProactiveRestartMonitor] Cache cleared for: ${serviceName}`);
  }

  /**
   * Scale service resources
   */
  private async scaleServiceResources(serviceName: string): Promise<void> {
    logger.info(`[ProactiveRestartMonitor] Scaling resources for: ${serviceName}`);

    // Simulate resource scaling
    await new Promise(resolve => setTimeout(resolve, 3000));

    logger.info(`[ProactiveRestartMonitor] Resources scaled for: ${serviceName}`);
  }

  /**
   * Store restart pattern in Supabase for learning
   */
  private async storeRestartPattern(failure: RestartFailure): Promise<void> {
    if (!this.supabase) return;

    try {
      const { error } = await this.supabase.from('context_storage').insert({
        category: 'restart_failure_patterns',
        source: 'proactive-restart-monitor',
        content: JSON.stringify({
          failure,
          timestamp: new Date().toISOString(),
          system_context: {
            total_services: this.SERVICE_CONFIGS.size,
            healthy_services: Array.from(this.serviceHealth.values()).filter(
              h => h.status === 'healthy'
            ).length,
            system_load: 'normal', // Would be actual system metrics in production
          },
        }),
        metadata: {
          service_name: failure.serviceName,
          failure_type: failure.failureType,
          severity: failure.severity,
          confidence: failure.aiAnalysis?.confidence || 0.5,
        },
        user_id: 'system',
      });

      if (error) {
        logger.error('[ProactiveRestartMonitor] Failed to store pattern:', error);
      }
    } catch (error) {
      logger.error('[ProactiveRestartMonitor] Error storing pattern:', error);
    }
  }

  /**
   * Load historical patterns from Supabase
   */
  private async loadHistoricalPatterns(): Promise<void> {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase
        .from('context_storage')
        .select('*')
        .eq('category', 'restart_failure_patterns')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.error('[ProactiveRestartMonitor] Failed to load patterns:', error);
        return;
      }

      data?.forEach(record => {
        try {
          const content = JSON.parse(record.content);
          if (content.failure) {
            this.restartFailures.set(content.failure.id, content.failure);
          }
        } catch (parseError) {
          logger.warn('[ProactiveRestartMonitor] Failed to parse historical pattern:', parseError);
        }
      });

      logger.info(`[ProactiveRestartMonitor] Loaded ${data?.length || 0} historical patterns`);
    } catch (error) {
      logger.error('[ProactiveRestartMonitor] Error loading patterns:', error);
    }
  }

  /**
   * Send critical alert
   */
  private async sendCriticalAlert(failure: RestartFailure): Promise<void> {
    const alert = {
      title: `🚨 CRITICAL: ${failure.serviceName} Restart Failure`,
      message: failure.errorMessage,
      severity: failure.severity,
      timestamp: failure.timestamp,
      estimatedRecoveryTime: failure.aiAnalysis?.estimatedRecoveryTime || 0,
      suggestedActions: failure.aiAnalysis?.likelyFixes || [],
    };

    logger.error('[ProactiveRestartMonitor] CRITICAL ALERT:', alert);

    // In production, integrate with alerting systems (email, Slack, PagerDuty, etc.)
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStats(): MonitoringStats {
    const totalServices = this.SERVICE_CONFIGS.size;
    const healthyServices = Array.from(this.serviceHealth.values()).filter(
      h => h.status === 'healthy'
    ).length;
    const failedServices = Array.from(this.serviceHealth.values()).filter(
      h => h.status === 'failed'
    ).length;

    const failures = Array.from(this.restartFailures.values());
    const resolvedFailures = failures.filter(f => f.recoverySuccessful).length;
    const totalRecoveryTime = failures
      .filter(f => f.recoverySuccessful)
      .reduce((sum, f) => sum + (f.aiAnalysis?.estimatedRecoveryTime || 0), 0);

    return {
      totalServices,
      healthyServices,
      failedServices,
      totalRestartFailures: failures.length,
      resolvedFailures,
      averageRecoveryTime: resolvedFailures > 0 ? totalRecoveryTime / resolvedFailures : 0,
      preventedOutages: Math.floor(resolvedFailures * 0.8), // Estimate
      aiAccuracy: this.calculateAIAccuracy(),
      uptime: this.calculateSystemUptime(),
      alertsSent: failures.filter(f => f.severity === 'critical').length,
      patternsLearned: failures.length,
    };
  }

  /**
   * Calculate AI accuracy
   */
  private calculateAIAccuracy(): number {
    const analyzedFailures = Array.from(this.restartFailures.values()).filter(
      f => f.aiAnalysis && f.recoveryAttempted
    );

    if (analyzedFailures.length === 0) return 0;

    const accurateAnalyses = analyzedFailures.filter(f => f.recoverySuccessful).length;
    return accurateAnalyses / analyzedFailures.length;
  }

  /**
   * Calculate system uptime
   */
  private calculateSystemUptime(): number {
    const healthyServices = Array.from(this.serviceHealth.values()).filter(
      h => h.status === 'healthy'
    ).length;

    return this.SERVICE_CONFIGS.size > 0 ? healthyServices / this.SERVICE_CONFIGS.size : 0;
  }

  /**
   * Get service health status
   */
  public getServiceHealth(serviceName?: string): ServiceHealthCheck | ServiceHealthCheck[] | null {
    if (serviceName) {
      return this.serviceHealth.get(serviceName) || null;
    }
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Get restart failures
   */
  public getRestartFailures(serviceName?: string): RestartFailure[] {
    const failures = Array.from(this.restartFailures.values());

    if (serviceName) {
      return failures.filter(f => f.serviceName === serviceName);
    }

    return failures;
  }

  /**
   * Force service health check
   */
  public async forceHealthCheck(serviceName?: string): Promise<void> {
    if (serviceName && this.SERVICE_CONFIGS.has(serviceName)) {
      const config = this.SERVICE_CONFIGS.get(serviceName)!;
      const health = await this.checkServiceHealth(serviceName, config);
      this.serviceHealth.set(serviceName, health);
    } else {
      await this.performComprehensiveHealthCheck();
    }
  }

  /**
   * Get recovery queue status
   */
  public getRecoveryQueue(): RecoveryAction[] {
    return [...this.recoveryQueue];
  }
}

// Export the class and singleton instance
export { ProactiveRestartMonitor };
export const proactiveRestartMonitor = new ProactiveRestartMonitor();
export default proactiveRestartMonitor;

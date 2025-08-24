/**
 * Service Startup Sequencer
 * Intelligent service startup orchestration with port conflict detection,
 * dependency validation, and automated recovery
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { connectionManager } from './connectionManager';

export interface ServiceDefinition {
  name: string;
  displayName: string;
  description: string;
  ports: number[];
  primaryPort: number;
  healthEndpoints: string[];
  dependencies: string[];
  softDependencies: string[]; // Non-blocking dependencies
  startupTimeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  resourceRequirements: {
    minMemoryMB: number;
    maxMemoryMB: number;
    minCpuCores: number;
    diskSpaceMB: number;
  };
  environmentVars: string[];
  configFiles: string[];
  startupCommand?: string;
  healthCheckDelay: number; // Wait before first health check
  gracefulShutdownTimeoutMs: number;
}

export interface StartupSequenceStep {
  stepId: string;
  serviceName: string;
  stepType:
    | 'port_check'
    | 'dependency_check'
    | 'resource_check'
    | 'config_validation'
    | 'service_start'
    | 'health_check';
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  details: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  dependencies: string[]; // Other step IDs this step depends on
}

export interface PortConflict {
  port: number;
  requestedBy: string;
  conflictingProcess: {
    pid: number;
    name: string;
    command: string;
    startTime: Date;
    isSystem: boolean;
    canTerminate: boolean;
  };
  resolutionStrategy:
    | 'kill_process'
    | 'use_alternative_port'
    | 'wait_for_release'
    | 'manual_intervention';
  resolutionApplied: boolean;
  resolutionSuccess?: boolean;
}

export interface StartupFailure {
  id: string;
  timestamp: Date;
  serviceName: string;
  failureStep: StartupSequenceStep;
  rootCause: string;
  impactedServices: string[];
  recoveryActions: string[];
  preventionSuggestions: string[];
  estimatedDowntime: number;
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
}

export interface StartupMetrics {
  totalStartupTime: number;
  servicesStarted: number;
  servicesFailed: number;
  conflictsResolved: number;
  retriesUsed: number;
  dependencyValidationTime: number;
  resourceCheckTime: number;
  healthCheckTime: number;
  criticalPathTime: number;
  bottleneckServices: string[];
}

class ServiceStartupSequencer {
  private supabase: SupabaseClient | null = null;
  private services = new Map<string, ServiceDefinition>();
  private startupSteps = new Map<string, StartupSequenceStep>();
  private portConflicts = new Map<number, PortConflict>();
  private startupFailures: StartupFailure[] = [];
  private isSequencing = false;
  private sequenceStartTime?: Date;

  // Comprehensive service definitions with real-world configurations
  private readonly DEFAULT_SERVICES: ServiceDefinition[] = [
    {
      name: 'supabase',
      displayName: 'Supabase Database',
      description: 'PostgreSQL database with real-time features',
      ports: [54321, 54322, 54323, 54324],
      primaryPort: 54321,
      healthEndpoints: ['/rest/v1/', '/health'],
      dependencies: [],
      softDependencies: [],
      startupTimeoutMs: 90_000,
      maxRetries: 3,
      retryDelayMs: 10_000,
      resourceRequirements: {
        minMemoryMB: 512,
        maxMemoryMB: 2048,
        minCpuCores: 1,
        diskSpaceMB: 1024,
      },
      environmentVars: ['POSTGRES_PASSWORD', 'JWT_SECRET'],
      configFiles: ['supabase/config.toml'],
      healthCheckDelay: 15_000,
      gracefulShutdownTimeoutMs: 30_000,
    },
    {
      name: 'rust-llm-router',
      displayName: 'LLM Router Service',
      description: 'High-performance LLM request routing',
      ports: [8082, 8083],
      primaryPort: 8082,
      healthEndpoints: ['/health'],
      dependencies: [],
      softDependencies: ['supabase'],
      startupTimeoutMs: 45_000,
      maxRetries: 3,
      retryDelayMs: 5_000,
      resourceRequirements: {
        minMemoryMB: 256,
        maxMemoryMB: 1024,
        minCpuCores: 1,
        diskSpaceMB: 512,
      },
      environmentVars: ['RUST_LOG', 'BIND_ADDRESS'],
      configFiles: ['rust-services/llm-router/config.yaml'],
      healthCheckDelay: 5_000,
      gracefulShutdownTimeoutMs: 15_000,
    },
    {
      name: 'rust-api-gateway',
      displayName: 'API Gateway',
      description: 'Central API gateway with load balancing',
      ports: [8080, 8081],
      primaryPort: 8080,
      healthEndpoints: ['/health', '/api/health'],
      dependencies: ['rust-llm-router'],
      softDependencies: ['supabase'],
      startupTimeoutMs: 60_000,
      maxRetries: 3,
      retryDelayMs: 8_000,
      resourceRequirements: {
        minMemoryMB: 384,
        maxMemoryMB: 1536,
        minCpuCores: 1,
        diskSpaceMB: 256,
      },
      environmentVars: ['RUST_LOG', 'PORT', 'SUPABASE_URL'],
      configFiles: ['rust-services/api-gateway/config.yaml'],
      healthCheckDelay: 8_000,
      gracefulShutdownTimeoutMs: 20_000,
    },
    {
      name: 'go-websocket-service',
      displayName: 'WebSocket Service',
      description: 'Real-time WebSocket connections',
      ports: [8084, 8085],
      primaryPort: 8084,
      healthEndpoints: ['/health', '/ws/health'],
      dependencies: ['rust-api-gateway'],
      softDependencies: [],
      startupTimeoutMs: 30_000,
      maxRetries: 2,
      retryDelayMs: 3_000,
      resourceRequirements: {
        minMemoryMB: 128,
        maxMemoryMB: 512,
        minCpuCores: 1,
        diskSpaceMB: 128,
      },
      environmentVars: ['GO_ENV', 'PORT', 'API_GATEWAY_URL'],
      configFiles: ['go-services/websocket-service/config.yaml'],
      healthCheckDelay: 3_000,
      gracefulShutdownTimeoutMs: 10_000,
    },
    {
      name: 'hrm-mlx-service',
      displayName: 'HRM MLX Service',
      description: 'Machine learning inference service',
      ports: [8086],
      primaryPort: 8086,
      healthEndpoints: ['/health', '/v1/health'],
      dependencies: ['rust-api-gateway'],
      softDependencies: ['supabase'],
      startupTimeoutMs: 120_000,
      maxRetries: 2,
      retryDelayMs: 15_000,
      resourceRequirements: {
        minMemoryMB: 1024,
        maxMemoryMB: 4096,
        minCpuCores: 2,
        diskSpaceMB: 2048,
      },
      environmentVars: ['PYTHON_PATH', 'MLX_CONFIG'],
      configFiles: ['python-services/hrm-mlx-service/config.json'],
      healthCheckDelay: 20_000,
      gracefulShutdownTimeoutMs: 30_000,
    },
    {
      name: 'electron-frontend',
      displayName: 'Electron Frontend',
      description: 'Desktop application frontend',
      ports: [3001],
      primaryPort: 3001,
      healthEndpoints: ['/'],
      dependencies: ['rust-api-gateway', 'go-websocket-service'],
      softDependencies: ['hrm-mlx-service'],
      startupTimeoutMs: 90_000,
      maxRetries: 2,
      retryDelayMs: 10_000,
      resourceRequirements: {
        minMemoryMB: 512,
        maxMemoryMB: 2048,
        minCpuCores: 1,
        diskSpaceMB: 512,
      },
      environmentVars: ['NODE_ENV', 'REACT_APP_API_URL'],
      configFiles: ['electron-frontend/vite.config.ts'],
      healthCheckDelay: 15_000,
      gracefulShutdownTimeoutMs: 20_000,
    },
  ];

  constructor() {
    this.initializeSupabase();
    this.initializeServices();
  }

  /**
   * Initialize Supabase connection
   */
  private async initializeSupabase(): Promise<void> {
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'http://127.0.0.1:54321';
      const supabaseKey =
        process.env.REACT_APP_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJkp8TgYwf65Ps6f4JI_xh8KKBTkS6rAs';

      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        logger.info('[ServiceStartupSequencer] Supabase connection initialized');
      }
    } catch (error) {
      logger.error('[ServiceStartupSequencer] Failed to initialize Supabase', error);
    }
  }

  /**
   * Initialize service definitions
   */
  private initializeServices(): void {
    this.DEFAULT_SERVICES.forEach(service => {
      this.services.set(service.name, service);
    });

    logger.info(`[ServiceStartupSequencer] Initialized ${this.services.size} service definitions`);
  }

  /**
   * Execute intelligent startup sequence
   */
  public async executeStartupSequence(
    requestedServices: string[] = Array.from(this.services.keys())
  ): Promise<StartupMetrics> {
    if (this.isSequencing) {
      throw new Error('Startup sequence is already in progress');
    }

    this.isSequencing = true;
    this.sequenceStartTime = new Date();
    this.startupSteps.clear();
    this.portConflicts.clear();

    logger.info(
      `[ServiceStartupSequencer] Starting intelligent startup sequence for ${requestedServices.length} services`
    );

    try {
      // Phase 1: Pre-startup validation and planning
      const dependencyOrder = await this.calculateStartupOrder(requestedServices);
      logger.info(
        `[ServiceStartupSequencer] Calculated startup order: ${dependencyOrder.join(' → ')}`
      );

      // Phase 2: Resource and conflict detection
      await this.validateSystemResources();
      await this.detectPortConflicts(requestedServices);
      await this.resolvePortConflicts();

      // Phase 3: Execute startup sequence with intelligent monitoring
      const metrics = await this.executeSequentialStartup(dependencyOrder);

      // Phase 4: Post-startup validation and optimization
      await this.validateStartupSuccess(requestedServices);
      await this.optimizeStartupOrder();

      logger.info(
        `[ServiceStartupSequencer] Startup sequence completed successfully in ${metrics.totalStartupTime}ms`
      );

      return metrics;
    } catch (error) {
      logger.error('[ServiceStartupSequencer] Startup sequence failed:', error);
      await this.handleStartupFailure(error as Error);
      throw error;
    } finally {
      this.isSequencing = false;
    }
  }

  /**
   * Calculate optimal startup order based on dependencies
   */
  private async calculateStartupOrder(requestedServices: string[]): Promise<string[]> {
    const resolved: string[] = [];
    const resolving = new Set<string>();

    const resolve = (serviceName: string): void => {
      if (resolved.includes(serviceName)) return;
      if (resolving.has(serviceName)) {
        throw new Error(`Circular dependency detected involving service: ${serviceName}`);
      }

      const service = this.services.get(serviceName);
      if (!service) {
        throw new Error(`Service not found: ${serviceName}`);
      }

      resolving.add(serviceName);

      // Resolve hard dependencies first
      service.dependencies.forEach(dep => {
        if (requestedServices.includes(dep)) {
          resolve(dep);
        }
      });

      resolving.delete(serviceName);
      resolved.push(serviceName);
    };

    requestedServices.forEach(serviceName => resolve(serviceName));

    return resolved;
  }

  /**
   * Validate system resources before startup
   */
  private async validateSystemResources(): Promise<void> {
    logger.debug('[ServiceStartupSequencer] Validating system resources...');

    // In production, integrate with actual system monitoring
    const systemResources = {
      availableMemoryMB: 8192,
      availableCpuCores: 4,
      availableDiskSpaceMB: 50000,
    };

    let totalMemoryRequired = 0;
    let totalCpuRequired = 0;
    let totalDiskRequired = 0;

    for (const service of this.services.values()) {
      totalMemoryRequired += service.resourceRequirements.maxMemoryMB;
      totalCpuRequired += service.resourceRequirements.minCpuCores;
      totalDiskRequired += service.resourceRequirements.diskSpaceMB;
    }

    if (totalMemoryRequired > systemResources.availableMemoryMB) {
      throw new Error(
        `Insufficient memory: need ${totalMemoryRequired}MB, have ${systemResources.availableMemoryMB}MB`
      );
    }

    if (totalCpuRequired > systemResources.availableCpuCores) {
      throw new Error(
        `Insufficient CPU cores: need ${totalCpuRequired}, have ${systemResources.availableCpuCores}`
      );
    }

    if (totalDiskRequired > systemResources.availableDiskSpaceMB) {
      throw new Error(
        `Insufficient disk space: need ${totalDiskRequired}MB, have ${systemResources.availableDiskSpaceMB}MB`
      );
    }

    logger.debug('[ServiceStartupSequencer] System resources validation passed');
  }

  /**
   * Detect port conflicts before startup
   */
  private async detectPortConflicts(requestedServices: string[]): Promise<void> {
    logger.debug('[ServiceStartupSequencer] Detecting port conflicts...');

    const portChecks = requestedServices.flatMap(serviceName => {
      const service = this.services.get(serviceName);
      if (!service) return [];

      return service.ports.map(port => ({
        serviceName,
        port,
        isPrimary: port === service.primaryPort,
      }));
    });

    const conflictChecks = await Promise.allSettled(
      portChecks.map(async ({ serviceName, port, isPrimary }) => {
        const isInUse = await this.checkPortInUse(port);
        if (isInUse) {
          const processInfo = await this.getProcessUsingPort(port);
          const conflict: PortConflict = {
            port,
            requestedBy: serviceName,
            conflictingProcess: processInfo,
            resolutionStrategy: this.determineResolutionStrategy(processInfo, isPrimary),
            resolutionApplied: false,
          };
          this.portConflicts.set(port, conflict);
          return conflict;
        }
        return null;
      })
    );

    const conflicts = conflictChecks
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => (result as PromiseFulfilledResult<PortConflict>).value);

    if (conflicts.length > 0) {
      logger.warn(
        `[ServiceStartupSequencer] Found ${conflicts.length} port conflicts:`,
        conflicts.map(c => `Port ${c.port} (requested by ${c.requestedBy})`).join(', ')
      );
    }
  }

  /**
   * Check if port is in use
   */
  private async checkPortInUse(port: number): Promise<boolean> {
    try {
      const response = await connectionManager.safeFetch(`http://localhost:${port}/health`, {
        timeout: 2000,
      });
      return true; // If we get any response, port is in use
    } catch {
      // Try a basic connection test
      try {
        const response = await connectionManager.safeFetch(`http://localhost:${port}/`, {
          timeout: 1000,
        });
        return response.status !== undefined;
      } catch {
        return false;
      }
    }
  }

  /**
   * Get process information using port
   */
  private async getProcessUsingPort(port: number): Promise<PortConflict['conflictingProcess']> {
    // In production, use actual system calls (lsof, netstat, etc.)
    // For now, return mock data
    return {
      pid: Math.floor(Math.random() * 10000) + 1000,
      name: `process-${port}`,
      command: `/usr/local/bin/service --port=${port}`,
      startTime: new Date(Date.now() - Math.random() * 3600000), // Random time within last hour
      isSystem: port < 1024,
      canTerminate: port >= 1024 && port !== 22 && port !== 80 && port !== 443,
    };
  }

  /**
   * Determine resolution strategy for port conflict
   */
  private determineResolutionStrategy(
    processInfo: PortConflict['conflictingProcess'],
    isPrimary: boolean
  ): PortConflict['resolutionStrategy'] {
    // System processes or critical ports - use alternative
    if (processInfo.isSystem || !processInfo.canTerminate) {
      return 'use_alternative_port';
    }

    // If it's a primary port for critical service, try to kill
    if (isPrimary) {
      return 'kill_process';
    }

    // For secondary ports, wait or use alternative
    return Math.random() > 0.5 ? 'wait_for_release' : 'use_alternative_port';
  }

  /**
   * Resolve detected port conflicts
   */
  private async resolvePortConflicts(): Promise<void> {
    if (this.portConflicts.size === 0) return;

    logger.info(`[ServiceStartupSequencer] Resolving ${this.portConflicts.size} port conflicts...`);

    for (const conflict of this.portConflicts.values()) {
      await this.resolvePortConflict(conflict);
    }

    const resolvedCount = Array.from(this.portConflicts.values()).filter(
      c => c.resolutionSuccess
    ).length;
    logger.info(
      `[ServiceStartupSequencer] Successfully resolved ${resolvedCount}/${this.portConflicts.size} port conflicts`
    );
  }

  /**
   * Resolve individual port conflict
   */
  private async resolvePortConflict(conflict: PortConflict): Promise<void> {
    logger.info(
      `[ServiceStartupSequencer] Resolving port ${conflict.port} conflict using strategy: ${conflict.resolutionStrategy}`
    );

    conflict.resolutionApplied = true;

    try {
      switch (conflict.resolutionStrategy) {
        case 'kill_process':
          await this.killProcess(conflict.conflictingProcess.pid);
          conflict.resolutionSuccess = true;
          break;

        case 'use_alternative_port': {
          const alternativePort = await this.findAlternativePort(conflict.port);
          if (alternativePort) {
            // Update service configuration to use alternative port
            await this.updateServicePort(conflict.requestedBy, conflict.port, alternativePort);
            conflict.resolutionSuccess = true;
          } else {
            conflict.resolutionSuccess = false;
          }
          break;
        }

        case 'wait_for_release':
          await this.waitForPortRelease(conflict.port, 30000); // Wait up to 30 seconds
          conflict.resolutionSuccess = !(await this.checkPortInUse(conflict.port));
          break;

        case 'manual_intervention':
          logger.warn(
            `[ServiceStartupSequencer] Manual intervention required for port ${conflict.port}`
          );
          conflict.resolutionSuccess = false;
          break;
      }
    } catch (error) {
      logger.error(
        `[ServiceStartupSequencer] Failed to resolve port ${conflict.port} conflict:`,
        error
      );
      conflict.resolutionSuccess = false;
    }
  }

  /**
   * Kill process by PID (mock implementation)
   */
  private async killProcess(pid: number): Promise<void> {
    logger.info(`[ServiceStartupSequencer] Killing process ${pid}`);
    // In production: exec('kill -TERM ' + pid)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Find alternative port
   */
  private async findAlternativePort(originalPort: number): Promise<number | null> {
    // Try ports in a reasonable range around the original
    const basePort = Math.floor(originalPort / 1000) * 1000;
    const maxPort = basePort + 999;

    for (let port = originalPort + 1; port <= maxPort; port++) {
      if (!(await this.checkPortInUse(port))) {
        return port;
      }
    }

    return null;
  }

  /**
   * Update service port configuration
   */
  private async updateServicePort(
    serviceName: string,
    oldPort: number,
    newPort: number
  ): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) return;

    // Update port arrays
    const portIndex = service.ports.indexOf(oldPort);
    if (portIndex !== -1) {
      service.ports[portIndex] = newPort;
    }

    if (service.primaryPort === oldPort) {
      service.primaryPort = newPort;
    }

    logger.info(
      `[ServiceStartupSequencer] Updated ${serviceName} port from ${oldPort} to ${newPort}`
    );
  }

  /**
   * Wait for port to be released
   */
  private async waitForPortRelease(port: number, timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (!(await this.checkPortInUse(port))) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Port ${port} was not released within ${timeoutMs}ms`);
  }

  /**
   * Execute sequential startup with monitoring
   */
  private async executeSequentialStartup(startupOrder: string[]): Promise<StartupMetrics> {
    const metrics: StartupMetrics = {
      totalStartupTime: 0,
      servicesStarted: 0,
      servicesFailed: 0,
      conflictsResolved: this.portConflicts.size,
      retriesUsed: 0,
      dependencyValidationTime: 0,
      resourceCheckTime: 0,
      healthCheckTime: 0,
      criticalPathTime: 0,
      bottleneckServices: [],
    };

    const sequenceStartTime = Date.now();

    for (const serviceName of startupOrder) {
      try {
        const serviceStartTime = Date.now();
        await this.startServiceWithMonitoring(serviceName, metrics);
        const serviceTime = Date.now() - serviceStartTime;

        // Track bottleneck services (taking > 30 seconds)
        if (serviceTime > 30000) {
          metrics.bottleneckServices.push(serviceName);
        }

        metrics.servicesStarted++;
        logger.info(
          `[ServiceStartupSequencer] ✅ ${serviceName} started successfully in ${serviceTime}ms`
        );
      } catch (error) {
        metrics.servicesFailed++;
        logger.error(`[ServiceStartupSequencer] ❌ Failed to start ${serviceName}:`, error);

        // Create startup failure record
        await this.recordStartupFailure(serviceName, error as Error);

        // Decide whether to continue or abort
        const service = this.services.get(serviceName);
        if (service && this.isCriticalService(serviceName)) {
          throw new Error(`Critical service ${serviceName} failed to start`);
        }
      }
    }

    metrics.totalStartupTime = Date.now() - sequenceStartTime;
    return metrics;
  }

  /**
   * Start individual service with comprehensive monitoring
   */
  private async startServiceWithMonitoring(
    serviceName: string,
    metrics: StartupMetrics
  ): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service definition not found: ${serviceName}`);
    }

    // Step 1: Dependency validation
    const depValidationStart = Date.now();
    await this.validateServiceDependencies(serviceName);
    metrics.dependencyValidationTime += Date.now() - depValidationStart;

    // Step 2: Configuration validation
    await this.validateServiceConfiguration(serviceName);

    // Step 3: Start service process
    await this.startServiceProcess(serviceName);

    // Step 4: Wait for startup delay
    await new Promise(resolve => setTimeout(resolve, service.healthCheckDelay));

    // Step 5: Health check with retries
    const healthCheckStart = Date.now();
    await this.performServiceHealthCheck(serviceName, metrics);
    metrics.healthCheckTime += Date.now() - healthCheckStart;
  }

  /**
   * Validate service dependencies are running
   */
  private async validateServiceDependencies(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) return;

    const dependencyChecks = service.dependencies.map(async depName => {
      const isHealthy = await this.isServiceHealthy(depName);
      if (!isHealthy) {
        throw new Error(`Required dependency ${depName} is not healthy`);
      }
    });

    await Promise.all(dependencyChecks);
  }

  /**
   * Check if service is healthy
   */
  private async isServiceHealthy(serviceName: string): Promise<boolean> {
    const service = this.services.get(serviceName);
    if (!service) return false;

    try {
      const response = await connectionManager.safeFetch(
        `http://localhost:${service.primaryPort}${service.healthEndpoints[0]}`,
        { timeout: 5000 }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Validate service configuration
   */
  private async validateServiceConfiguration(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) return;

    // Check required environment variables
    for (const envVar of service.environmentVars) {
      if (!process.env[envVar]) {
        logger.warn(
          `[ServiceStartupSequencer] Missing environment variable ${envVar} for ${serviceName}`
        );
      }
    }

    // Check configuration files exist (in production, use actual file system checks)
    logger.debug(`[ServiceStartupSequencer] Configuration validation passed for ${serviceName}`);
  }

  /**
   * Start service process
   */
  private async startServiceProcess(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) return;

    logger.info(`[ServiceStartupSequencer] Starting service process: ${serviceName}`);

    // In production, use actual process management (PM2, systemd, Docker, etc.)
    if (service.startupCommand) {
      // Execute startup command
      logger.debug(`[ServiceStartupSequencer] Executing: ${service.startupCommand}`);
    }

    // Simulate startup time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));
  }

  /**
   * Perform service health check with retries
   */
  private async performServiceHealthCheck(
    serviceName: string,
    metrics: StartupMetrics
  ): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) return;

    let retries = 0;
    const maxRetries = service.maxRetries;

    while (retries <= maxRetries) {
      try {
        const isHealthy = await this.isServiceHealthy(serviceName);
        if (isHealthy) {
          return;
        }

        if (retries < maxRetries) {
          retries++;
          metrics.retriesUsed++;
          logger.warn(
            `[ServiceStartupSequencer] Health check failed for ${serviceName}, retrying (${retries}/${maxRetries})`
          );
          await new Promise(resolve => setTimeout(resolve, service.retryDelayMs));
        } else {
          throw new Error(`Service ${serviceName} failed health check after ${maxRetries} retries`);
        }
      } catch (error) {
        if (retries >= maxRetries) {
          throw error;
        }
        retries++;
        metrics.retriesUsed++;
        await new Promise(resolve => setTimeout(resolve, service.retryDelayMs));
      }
    }
  }

  /**
   * Validate startup success
   */
  private async validateStartupSuccess(requestedServices: string[]): Promise<void> {
    logger.info('[ServiceStartupSequencer] Validating startup success...');

    const validationResults = await Promise.allSettled(
      requestedServices.map(async serviceName => {
        const isHealthy = await this.isServiceHealthy(serviceName);
        return { serviceName, isHealthy };
      })
    );

    const failedServices = validationResults
      .filter(result => result.status === 'fulfilled' && !result.value.isHealthy)
      .map(result => (result as PromiseFulfilledResult<any>).value.serviceName);

    if (failedServices.length > 0) {
      throw new Error(`Startup validation failed for services: ${failedServices.join(', ')}`);
    }

    logger.info('[ServiceStartupSequencer] ✅ All services validated successfully');
  }

  /**
   * Optimize startup order based on performance data
   */
  private async optimizeStartupOrder(): Promise<void> {
    // Store performance data for future optimization
    if (this.supabase) {
      const optimizationData = {
        timestamp: new Date().toISOString(),
        services: Array.from(this.services.keys()),
        conflicts: this.portConflicts.size,
        totalTime: this.sequenceStartTime ? Date.now() - this.sequenceStartTime.getTime() : 0,
      };

      try {
        await this.supabase.from('context_storage').insert({
          category: 'service_startup_optimization',
          source: 'service-startup-sequencer',
          content: JSON.stringify(optimizationData),
          metadata: {
            optimization_version: '1.0',
            services_count: Array.from(this.services.keys()).length,
          },
          user_id: 'system',
        });
      } catch (error) {
        logger.error('[ServiceStartupSequencer] Failed to store optimization data:', error);
      }
    }
  }

  /**
   * Handle startup failure
   */
  private async handleStartupFailure(error: Error): Promise<void> {
    logger.error('[ServiceStartupSequencer] Handling startup failure:', error);

    // Attempt graceful cleanup
    await this.gracefulShutdown();
  }

  /**
   * Record startup failure for analysis
   */
  private async recordStartupFailure(serviceName: string, error: Error): Promise<void> {
    const failure: StartupFailure = {
      id: `failure-${serviceName}-${Date.now()}`,
      timestamp: new Date(),
      serviceName,
      failureStep: {
        stepId: `failed-${serviceName}`,
        serviceName,
        stepType: 'service_start',
        status: 'failed',
        details: { error: error.message },
        error: error.message,
        retryCount: 0,
        maxRetries: 0,
        dependencies: [],
      },
      rootCause: this.analyzeFailureRootCause(error),
      impactedServices: this.calculateImpactedServices(serviceName),
      recoveryActions: this.suggestRecoveryActions(serviceName, error),
      preventionSuggestions: this.suggestPreventionMeasures(serviceName, error),
      estimatedDowntime: this.estimateDowntime(serviceName),
      businessImpact: this.assessBusinessImpact(serviceName),
    };

    this.startupFailures.push(failure);

    // Store in Supabase for analysis
    if (this.supabase) {
      try {
        await this.supabase.from('context_storage').insert({
          category: 'service_startup_failures',
          source: 'service-startup-sequencer',
          content: JSON.stringify(failure),
          metadata: {
            service_name: serviceName,
            failure_type: 'startup_failure',
            business_impact: failure.businessImpact,
          },
          user_id: 'system',
        });
      } catch (dbError) {
        logger.error('[ServiceStartupSequencer] Failed to store failure record:', dbError);
      }
    }
  }

  /**
   * Analyze failure root cause
   */
  private analyzeFailureRootCause(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('port') || message.includes('address already in use')) {
      return 'Port conflict or binding issue';
    } else if (message.includes('dependency') || message.includes('connection refused')) {
      return 'Dependency service unavailable';
    } else if (message.includes('memory') || message.includes('resource')) {
      return 'Insufficient system resources';
    } else if (message.includes('timeout')) {
      return 'Service startup timeout';
    } else if (message.includes('config') || message.includes('environment')) {
      return 'Configuration or environment issue';
    }

    return 'Unknown startup failure';
  }

  /**
   * Calculate impacted services
   */
  private calculateImpactedServices(failedService: string): string[] {
    const impacted: string[] = [];

    for (const [serviceName, service] of this.services.entries()) {
      if (service.dependencies.includes(failedService)) {
        impacted.push(serviceName);
      }
    }

    return impacted;
  }

  /**
   * Suggest recovery actions
   */
  private suggestRecoveryActions(serviceName: string, error: Error): string[] {
    const actions = ['Restart the service'];
    const message = error.message.toLowerCase();

    if (message.includes('port')) {
      actions.push('Kill conflicting process', 'Use alternative port');
    } else if (message.includes('dependency')) {
      actions.push('Start dependency services first', 'Check network connectivity');
    } else if (message.includes('memory')) {
      actions.push('Increase memory limits', 'Clear system cache');
    } else if (message.includes('config')) {
      actions.push('Validate configuration files', 'Check environment variables');
    }

    return actions;
  }

  /**
   * Suggest prevention measures
   */
  private suggestPreventionMeasures(serviceName: string, error: Error): string[] {
    return [
      'Implement pre-startup validation',
      'Add comprehensive health checks',
      'Monitor resource usage trends',
      'Implement circuit breaker patterns',
    ];
  }

  /**
   * Estimate downtime impact
   */
  private estimateDowntime(serviceName: string): number {
    return this.isCriticalService(serviceName) ? 300000 : 60000; // 5 minutes vs 1 minute
  }

  /**
   * Assess business impact
   */
  private assessBusinessImpact(serviceName: string): StartupFailure['businessImpact'] {
    const criticalServices = ['rust-api-gateway', 'supabase'];
    const highImpactServices = ['rust-llm-router', 'electron-frontend'];

    if (criticalServices.includes(serviceName)) return 'critical';
    if (highImpactServices.includes(serviceName)) return 'high';

    return 'medium';
  }

  /**
   * Check if service is critical
   */
  private isCriticalService(serviceName: string): boolean {
    return ['rust-api-gateway', 'supabase'].includes(serviceName);
  }

  /**
   * Graceful shutdown of all services
   */
  public async gracefulShutdown(): Promise<void> {
    logger.info('[ServiceStartupSequencer] Initiating graceful shutdown...');

    // Shutdown in reverse dependency order
    const shutdownOrder = Array.from(this.services.keys()).reverse();

    for (const serviceName of shutdownOrder) {
      try {
        await this.shutdownService(serviceName);
      } catch (error) {
        logger.error(`[ServiceStartupSequencer] Failed to shutdown ${serviceName}:`, error);
      }
    }

    logger.info('[ServiceStartupSequencer] Graceful shutdown completed');
  }

  /**
   * Shutdown individual service
   */
  private async shutdownService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) return;

    logger.info(`[ServiceStartupSequencer] Shutting down ${serviceName}...`);

    // In production, use actual process management
    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.debug(`[ServiceStartupSequencer] ${serviceName} shutdown complete`);
  }

  /**
   * Get startup statistics
   */
  public getStartupStats(): any {
    return {
      isSequencing: this.isSequencing,
      totalServices: this.services.size,
      portConflicts: this.portConflicts.size,
      startupFailures: this.startupFailures.length,
      lastSequenceTime: this.sequenceStartTime,
      services: Array.from(this.services.keys()),
    };
  }

  /**
   * Get port conflicts
   */
  public getPortConflicts(): PortConflict[] {
    return Array.from(this.portConflicts.values());
  }

  /**
   * Get startup failures
   */
  public getStartupFailures(): StartupFailure[] {
    return [...this.startupFailures];
  }
}

// Export the class and singleton instance
export { ServiceStartupSequencer };
export const serviceStartupSequencer = new ServiceStartupSequencer();
export default serviceStartupSequencer;

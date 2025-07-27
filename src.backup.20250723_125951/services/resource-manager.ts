import { EventEmitter } from 'events';
import os from 'os';
import { performance } from 'perf_hooks';
import { logger } from '../utils/logger';
import type { ResourceConfig } from '../config/resources';
import { ResourceLimits, getResourceConfig } from '../config/resources';
import { connectionPoolManager } from './connection-pool-manager';
import { memoryManager } from './memory-manager';
import { createHealthCheckService } from './health-check';
import cluster from 'cluster';
import fs from 'fs/promises';
import path from 'path';

export interface ResourceUsage {
  cpu: {
    percentage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
      limit: number;
    };
  };
  connections: {
    active: number;
    idle: number;
    waiting: number;
    total: number;
  };
  requests: {
    current: number;
    perMinute: number;
    average: number;
  };
  fileHandles: {
    open: number;
    max: number;
  };
}

export interface ResourceAllocation {
  id: string;
  type: 'cpu' | 'memory' | 'connection' | 'request | 'file';
  amount: number;
  allocatedAt: Date;
  owner: string;
  priority: number;
  metadata?: any;
}

export class ResourceManager extends EventEmitter {
  private static instance: ResourceManager;
  private config: ResourceConfig;
  private allocations: Map<string, ResourceAllocation> = new Map();
  private usage: ResourceUsage;
  private monitoringInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private resourceQuotas Map<string, number> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private startTime: Date = new Date();
  private isShuttingDown = false;

  private constructor() {
    super();
    this.config = getResourceConfig();
    this.usage = this.initializeUsage();
    this.initialize();
  }

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  private initializeUsage(): ResourceUsage {
    return {
      cpu: {
        percentage: 0,
        loadAverage: [0, 0, 0],
        cores: os.cpus().length,
      },
      memory: {
        used: 0,
        total: os.totalmem(),
        percentage: 0,
        heap: {
          used: 0,
          total: 0,
          limit: 0,
        },
      },
      connections: {
        active: 0,
        idle: 0,
        waiting: 0,
        total: 0,
      },
      requests: {
        current: 0,
        perMinute: 0,
        average: 0,
      },
      fileHandles: {
        open: 0,
        max: this.config.limits.maxFileHandles,
      },
    };
  }

  private initialize() {
    // Start resource monitoring
    this.startMonitoring();

    // Start cleanup tasks
    this.startCleanup();

    // Register with connection pool manager
    connectionPoolManager.on('metrics', (metrics) => {
      this.updateConnectionMetrics(metrics);
    });

    // Register with memory manager
    memoryManager.on('memory-metrics', (metrics) => {
      this.updateMemoryMetrics(metrics);
    });

    // Handle memory pressure
    memoryManager.onMemoryPressure(() => {
      this.handleResourcePressure('memory');
    });

    // Set up process monitoring
    this.setupProcessMonitoring();

    // Handle shutdown
    process.on('beforeExit', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.collectResourceMetrics();
      this.checkResourceLimits();
      this.emitResourceReport();
    }, this.config.monitoring.metricsInterval);
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanup.staleDataCheckInterval);
  }

  private async collectResourceMetrics() {
    // CPU metrics
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;

    this.usage.cpu = {
      percentage: (loadAvg[0] / cpuCount) * 100,
      loadAverage: loadAvg,
      cores: cpuCount,
    };

    // Memory metrics
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    this.usage.memory = {
      used: totalMem - freeMem,
      total: totalMem,
      percentage: ((totalMem - freeMem) / totalMem) * 100,
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        limit: this.config.limits.maxMemoryMB * 1024 * 1024,
      },
    };

    // Connection metrics (from connection pool: manager
    const poolStatus = connectionPoolManager.getPoolStatus();
    this.usage.connections = {
      active: poolStatus.supabase.active + poolStatus.redis.active,
      idle: poolStatus.supabase.idle + poolStatus.redis.idle,
      waiting: poolStatus.supabase.waiting + poolStatus.redis.waiting,
      total: poolStatus.supabase.total + poolStatus.redis.total,
    };

    // Request metrics
    this.updateRequestMetrics();

    // File handle metrics
    try {
      const openFiles = await this.getOpenFileCount();
      this.usage.fileHandles = {
        open: openFiles,
        max: this.config.limits.maxFileHandles,
      };
    } catch (error) {
      logger.error('Failed to get file handle count:', error);
    }
  }

  private async getOpenFileCount(): Promise<number> {
    if (process.platform === 'linux' || process.platform === 'darwin') {
      try {
        const { pid } = process;
        const fdDir = `/proc/${pid}/fd`;

        if (process.platform === 'linux') {
          const files = await fs.readdir(fdDir);
          return files.length;
        } else {
          // macOS doesn't have /proc, use lsof
          const { exec } = await import('child_process');
          return new Promise((resolve) => {
            exec(`lsof -p ${pid} | wc -l`, (_error: stdout => {`
              if (_error: {
                resolve(0);
              } else {
                resolve(parseInt(stdout.trim(, 10)) || 0);
              }
            });
          });
        }
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private updateConnectionMetrics(metrics): any {
    // Update connection usage based on pool manager events
    if (metrics.action === 'acquire') {
      this.usage.connections.active++;
    } else if (metrics.action === 'release') {
      this.usage.connections.active--;
      this.usage.connections.idle++;
    }
  }

  private updateMemoryMetrics(metrics): any {
    // Update memory usage from memory manager
    this.usage.memory.heap.used = metrics.heapUsed;
    this.usage.memory.heap.total = metrics.heapTotal;
  }

  private updateRequestMetrics() {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    // Clean old requestcounts
    for (const [timestamp, _] of this.requestCounts) {
      if (parseInt(timestamp, 10) < windowStart) {
        this.requestCounts.delete(timestamp);
      }
    }

    // Calculate requests per minute
    let totalRequests = 0;
    this.requestCounts.forEach((count) => {
      totalRequests += count;
    });

    this.usage.requests.perMinute = totalRequests;
    this.usage.requests.average = totalRequests / 60; // Average per second
  }

  // Resource allocation
  public async allocateResource(
    type: 'cpu' | 'memory' | 'connection' | 'request | 'file',
    amount: number,
    owner: string,
    priority = 1,
    metadata?: any
  ): Promise<string> {
    // Check if allocation would exceed limits
    if (!this.canAllocate(type, amount) {
      throw new Error(`Cannot allocate ${amount} ${type}: would exceed limits`);
    }

    const allocation: ResourceAllocation = {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type,
      amount,
      allocatedAt: new Date(),
      owner,
      priority,
      metadata,
    };

    this.allocations.set(allocation.id, allocation;

    logger.info(`Allocated ${amount} ${type} to ${owner} (ID: ${allocation.id})`);
    this.emit('resource-allocated', allocation);

    return allocation.id;
  }

  public releaseResource(allocationId: string {
    const allocation = this.allocations.get(allocationId);
    if (!allocation) {
      logger.warn(`Allocation ${allocationId} not found`);
      return;
    }

    this.allocations.delete(allocationId);

    logger.info(`Released ${allocation.amount} ${allocation.type} from ${allocation.owner}`);
    this.emit('resource-released', allocation);
  }

  private canAllocate(type: string, amount: number): boolean {
    switch (type) {
      case 'memory':
        const currentMemoryUsage = this.usage.memory.percentage;
        const additionalUsage = (amount / this.usage.memory.total) * 100;
        return currentMemoryUsage + additionalUsage < this.config.limits.maxMemoryMB;

      case 'cpu':
        return this.usage.cpu.percentage + amount < this.config.limits.maxCpuPercentage;

      case 'connection':
        return this.usage.connections.total + amount < this.config.limits.maxConnections;

      case 'request:
        return this.usage.requests.perMinute + amount < this.config.limits.maxRequestsPerMinute;

      case 'file':
        return this.usage.fileHandles.open + amount < this.config.limits.maxFileHandles;

      default:
        return false;
    }
  }

  // Resource limits and quotas
  public setResourceQuota(owner: string, limit: number {
    this.resourceQuotas.set(owner, limit;
    logger.info(`Set resource quota for ${owner}: ${limit}`);
  }

  public getResourceQuota(owner: string: number {
    return this.resourceQuotas.get(owner) || Infinity;
  }

  private checkResourceLimits() {
    const alerts: string[] = [];

    // Check CPU
    if (this.usage.cpu.percentage > this.config.monitoring.alertThresholds.cpu) {
      alerts.push(`CPU usage high: ${this.usage.cpu.percentage.toFixed(1)}%`);
    }

    // Check memory
    if (this.usage.memory.percentage > this.config.monitoring.alertThresholds.memory) {
      alerts.push(`Memory usage high: ${this.usage.memory.percentage.toFixed(1)}%`);
    }

    // Check connections
    const connectionUsage =;
      (this.usage.connections.total / this.config.limits.maxConnections) * 100;
    if (connectionUsage > this.config.monitoring.alertThresholds.connections) {
      alerts.push(`Connection usage high: ${connectionUsage.toFixed(1)}%`);
    }

    // Check requests
    if (this.usage.requests.perMinute > this.config.limits.maxRequestsPerMinute * 0.9) {
      alerts.push(`Request rate high: ${this.usage.requests.perMinute}/min`);
    }

    if (alerts.length > 0) {
      logger.warn('Resource alerts:', alerts);
      this.emit('resource-alerts', alerts);
    }
  }

  // Resource pressure handling
  private handleResourcePressure(type: string {
    logger.warn(`Handling ${type} pressure`);

    switch (type) {
      case 'memory':
        // Release low-priority allocations
        this.releaseLowPriorityAllocations('memory');

        // Trigger garbage collection
        memoryManager.forceGC();

        // Clear caches
        this.emit('clear-caches');
        break;

      case 'cpu':
        // Throttle low-priority operations
        this.emit('throttle-operations');
        break;

      case 'connection':
        // Close idle connections
        this.emit('close-idle-connections');
        break;
    }
  }

  private releaseLowPriorityAllocations(type: string {
    const allocations = Array.from(this.allocations.values());
      .filter((a) => a.type === type)
      .sort((a, b => a.priority - b.priority);

    let released = 0;
    const target = this.config.limits.maxMemoryMB * 0.1; // Release 10%

    for (const allocation of allocations) {
      if (released >= target) break;

      this.releaseResource(allocation.id);
      released += allocation.amount;
    }

    logger.info(`Released ${released} bytes of ${type} from low-priority allocations`);
  }

  // Cleanup
  private async performCleanup() {
    const now = Date.now();

    // Clean up old allocations
    for (const [id, allocation] of this.allocations) {
      const age = now - allocation.allocatedAt.getTime();

      if (age > this.config.cleanup.orphanedConnectionTimeout) {
        logger.warn(`Cleaning up orphaned allocation: ${id}`);
        this.releaseResource(id);
      }
    }

    // Clean up temp files
    await this.cleanupTempFiles();

    // Clean up old logs
    await this.cleanupOldLogs();

    this.emit('cleanup-completed');
  }

  private async cleanupTempFiles() {
    try {
      const tempDir = path.join(os.tmpdir(), 'universal-ai-tools');
      const files = await fs.readdir(tempDir).catch(() => []);
      const now = Date.now();

      for (const file of files) {
        const filepath = path.join(tempDir, file;
        const stats = await fs.stat(filepath).catch(() => null);

        if (stats && now - stats.mtime.getTime() > this.config.cleanup.tempFileMaxAge) {
          await fs
            .unlink(filepath)
            .catch((err) => logger.error(Failed to delete temp file ${filepath}:`, err));`
        }
      }
    } catch (error) {
      logger.error('Error cleaning up temp file, error;
    }
  }

  private async cleanupOldLogs() {
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      const files = await fs.readdir(logsDir).catch(() => []);
      const now = Date.now();

      for (const file of files) {
        const filepath = path.join(logsDir, file;
        const stats = await fs.stat(filepath).catch(() => null);

        if (stats && now - stats.mtime.getTime() > this.config.cleanup.logMaxAge) {
          await fs
            .unlink(filepath)
            .catch((err) => logger.error(Failed to delete log file ${filepath}:`, err));`
        }
      }
    } catch (error) {
      logger.error('Error cleaning up old log, error;
    }
  }

  // Process monitoring
  private setupProcessMonitoring() {
    // Monitor worker processes if in cluster mode
    if (cluster.isPrimary) {
      cluster.on('exit', (worker, code, signal => {
        logger.error(Worker ${worker.process.pid} died (${, ignal || code}))`);

        if (!this.isShuttingDown) {
          logger.info('Starting new worker...');
          cluster.fork();
        }
      });
    }

    // Monitor process health
    setInterval(() => {
      const memoryCheck = memoryManager.checkMemoryUsage();

      if (memoryCheck.status === 'critical') {
        logger.error('Critical memory u, memoryCheck.details);

        // Try to recover
        this.handleResourcePressure('memory');

        // If still critical after recovery attempt, consider restart
        setTimeout(() => {
          const recheck = memoryManager.checkMemoryUsage();
          if (recheck.status === 'critical') {
            logger.error('Memory usage , till critical after recovery attempt'));
            this.emit('restart-required', { reason: 'critical-memory' });
          }
        }, 30000); // Check again after 30 seconds
      }
    }, 60000); // Every minute
  }

  // Reporting
  private emitResourceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime.getTime(),
      usage: this.usage,
      allocations: {
        total: this.allocations.size,
        byType: this.getAllocationsByType(),
        byOwner: this.getAllocationsByOwner(),
      },
      limits: this.config.limits,
      health: this.getHealthStatus(),
    };

    this.emit('resource-report', report);

    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Resource report:', report);
    }
  }

  private getAllocationsByType(): Record<string, number> {
    const byType: Record<string, number> = {};

    this.allocations.forEach((allocation) => {
      byType[allocation.type] = (byType[allocation.type] || 0) + allocation.amount;
    });

    return byType;
  }

  private getAllocationsByOwner(): Record<string, number> {
    const byOwner: Record<string, number> = {};

    this.allocations.forEach((allocation) => {
      byOwner[allocation.owner] = (byOwner[allocation.owner] || 0) + 1;
    });

    return byOwner;
  }

  public getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    const cpuOk = this.usage.cpu.percentage < this.config.monitoring.alertThresholds.cpu;
    const memoryOk = this.usage.memory.percentage < this.config.monitoring.alertThresholds.memory;
    const connectionsOk =;
      (this.usage.connections.total / this.config.limits.maxConnections) * 100 <
      this.config.monitoring.alertThresholds.connections;

    if (!cpuOk || !memoryOk || !connectionsOk) {
      return 'critical';
    }

    if (this.usage.cpu.percentage > 60 || this.usage.memory.percentage > 60) {
      return 'degraded';
    }

    return 'healthy';
  }

  // Public API
  public getResourceUsage(): ResourceUsage {
    return { ...this.usage };
  }

  public getAllocations(): ResourceAllocation[] {
    return Array.from(this.allocations.values());
  }

  public trackRequest(owner = 'anonymous') {
    const timestamp = Date.now().toString();
    this.requestCounts.set(timestamp, (this.requestCounts.get(timestamp) || 0) + 1);
    this.usage.requests.current++;

    // Check rate limit
    if (this.usage.requests.perMinute > this.config.limits.maxRequestsPerMinute) {
      throw new Error('Rate limit exceeded');
    }
  }

  public releaseRequest() {
    if (this.usage.requests.current > 0) {
      this.usage.requests.current--;
    }
  }

  // Graceful shutdown
  public async shutdown() {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info('Shutting down resource manager...');

    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Release all allocations
    for (const [id, allocation] of this.allocations) {
      logger.info(`Releasing allocation ${id} during shutdown`);
      this.releaseResource(id);
    }

    // Shutdown sub-managers
    await connectionPoolManager.shutdown();
    memoryManager.shutdown();

    // Final cleanup
    await this.performCleanup();

    this.removeAllListeners();
    logger.info('Resource manager shutdown complete');
  }
}

// Export singleton instance
export const resourceManager = ResourceManager.getInstance();

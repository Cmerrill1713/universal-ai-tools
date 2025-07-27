import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedisClientType } from 'redis';
import os from 'os';
import { logger } from '../utils/logger';
import { circuitBreaker } from './circuit-breaker';
// Conditionally import kokoro-tts-service to handle missing dependencies
let kokoroTTS: any;
try {
  const kokoroModule = require('./kokoro-tts-service');
  kokoroTTS = kokoroModule.kokoroTTS;
} catch (_error) {
  // Kokoro TTS not available
}

// Conditionally import ollama-assistant to handle missing dependencies
let getOllamaAssistant: any;
try {
  const ollamaModule = require('./ollama-assistant');
  getOllamaAssistant = ollamaModule.getOllamaAssistant;
} catch (_error) {
  // Ollama assistant not available
}
import axios from 'axios';
import type { DatabaseMigrationService } from './database-migration';
import { redisHealthCheck } from './redis-health-check';

export interface HealthStatus {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: any;
  lastCheck?: Date;
}

export interface ServiceHealth {
  database: HealthStatus;
  redis: HealthStatus;
  ollama: HealthStatus;
  kokoro: HealthStatus;
  storage: HealthStatus;
  memory: HealthStatus;
  cpu: HealthStatus;
  disk: HealthStatus;
  migrations: HealthStatus;
  circuitBreakers: HealthStatus;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: ServiceHealth;
  metrics: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
    requestsPerMinute?: number;
    averageResponseTime?: number;
  };
  dependencies: {
    name: string;
    version: string;
    healthy: boolean;
  }[];
  // Enhanced monitoring features
  healthScore: number; // 0-100
  trends: {
    status: 'improving' | 'stable' | 'degrading';
    score: number; // Change in health score over time
  };
  alerts: Array<{
    level: 'info' | 'warning' | '_error | 'critical';
    message: string;
    service?: string;
    timestamp: string;
  }>;
  suggestions: string[];
  telemetry?: {
    traceId?: string;
    spanId?: string;
    activeSpans: number;
    tracingEnabled: boolean;
  };
}

export interface HealthHistory {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  responseTime: number;
  services: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
}

export class HealthCheckService {
  private startTime: Date;
  private healthChecks: Map<string, () => Promise<HealthStatus>> = new Map();
  private healthHistory: HealthHistory[] = [];
  private lastHealthScore = 100;
  private requestMetrics: {
    totalRequests: number;
    requestsInLastMinute: number[];
    responseTimes: number[];
    lastMinuteStart: number;
  } = {
    totalRequests: 0,
    requestsInLastMinute: [],
    responseTimes: [],
    lastMinuteStart: Date.now(),
  };

  constructor(
    private supabase: SupabaseClient,
    private redis?: RedisClientType,
    private migrationService?: DatabaseMigrationService
  ) {
    this.startTime = new Date();
    this.registerHealthChecks();
    this.startMetricsCleanup();
  }

  private registerHealthChecks() {
    // Database health check
    this.healthChecks.set('database', async () => {
      try {
        // First try a simple query that should always work
        const { data, _error} = await this.supabase.rpc('health_check_db', {});

        if (_error {
          // Fallback to a simple table query if the RPC doesn't exist
          const { data: fallbackData, _error fallbackError } = await this.supabase
            .from('ai_memories')
            .select('id')
            .limit(1);

          if (fallbackError) {
            throw fallbackError;
          }
        }

        return {
          healthy: true,
          status: 'healthy',
          message: 'Database connection successful',
        };
      } catch (_error any) {
        // Try one more simple query
        try {
          await this.supabase.auth.getSession();
          return {
            healthy: true,
            status: 'healthy',
            message: 'Database connection via auth successful',
          };
        } catch (authError: any) {
          return {
            healthy: false,
            status: 'unhealthy',
            message: 'Database connection failed',
            details: `${_errormessage} (Auth fallback also failed: ${authError.message})`,
          };
        }
      }
    });

    // Redis health check
    this.healthChecks.set('redis', async () => {
      try {
        // Use the comprehensive Redis health check service
        const redisHealth = await redisHealthCheck.performHealthCheck();

        return {
          healthy: redisHealth.status !== 'unhealthy',
          status: redisHealth.status,
          message:
            redisHealth.status === 'healthy'
              ? 'Redis is operating normally'
              : redisHealth.status === 'degraded'
                ? 'Redis is experiencing issues'
                : 'Redis is unavailable',
          details: {
            connected: redisHealth.connected,
            latency: redisHealth.latency,
            memoryUsage: redisHealth.memoryUsage,
            connectedClients: redisHealth.connectedClients,
            uptime: redisHealth.uptime,
            fallbackCacheActive: redisHealth.fallbackCacheActive,
            errors: redisHealth.details.errors,
            warnings: redisHealth.details.warnings,
          },
        };
      } catch (_error any) {
        return {
          healthy: false,
          status: 'unhealthy',
          message: 'Redis health check failed',
          details: _errormessage,
        };
      }
    });

    // Ollama health check
    this.healthChecks.set('ollama', async () => {
      if (!getOllamaAssistant) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Ollama assistant not available',
          details: 'Module not loaded',
        };
      }

      try {
        const ollamaAssistant = getOllamaAssistant(this.supabase);

        if (!ollamaAssistant || typeof ollamaAssistant.checkAvailability !== 'function') {
          return {
            healthy: false,
            status: 'degraded',
            message: 'Ollama assistant invalid',
            details: 'Assistant instance or method not available',
          };
        }

        const isAvailable = await ollamaAssistant.checkAvailability();
        return {
          healthy: isAvailable,
          status: isAvailable ? 'healthy' : 'degraded',
          message: isAvailable ? 'Ollama service available' : 'Ollama service unavailable',
        };
      } catch (_error any) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Ollama check failed',
          details: _errormessage,
        };
      }
    });

    // Kokoro TTS health check
    this.healthChecks.set('kokoro', async () => {
      if (!kokoroTTS) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Kokoro TTS not available',
          details: 'Module not loaded',
        };
      }

      try {
        if (typeof kokoroTTS.initialize === 'function') {
          await kokoroTTS.initialize();
          return {
            healthy: true,
            status: 'healthy',
            message: 'Kokoro TTS initialized',
          };
        } else {
          return {
            healthy: false,
            status: 'degraded',
            message: 'Kokoro TTS initialization method not available',
          };
        }
      } catch (_error any) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Kokoro TTS unavailable',
          details: _errormessage,
        };
      }
    });

    // Storage health check
    this.healthChecks.set('storage', async () => {
      try {
        const { data, _error} = await this.supabase.storage
          .from('voice-outputs')
          .list('', { limit: 1 });

        if (_error throw _error;

        return {
          healthy: true,
          status: 'healthy',
          message: 'Storage buckets accessible',
        };
      } catch (_error any) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Storage access failed',
          details: _errormessage,
        };
      }
    });

    // Memory health check
    this.healthChecks.set('memory', () => {
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const percentUsed = (memUsage.heapUsed / totalMem) * 100;

      return Promise.resolve({
        healthy: percentUsed < 80,
        status: percentUsed < 80 ? 'healthy' : percentUsed < 90 ? 'degraded' : 'unhealthy',
        message: `Memory usage: ${percentUsed.toFixed(1)}%`,
        details: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
        },
      });
    });

    // CPU health check
    this.healthChecks.set('cpu', () => {
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const normalizedLoad = loadAvg[0] / cpuCount;

      return Promise.resolve({
        healthy: normalizedLoad < 0.8,
        status: normalizedLoad < 0.8 ? 'healthy' : normalizedLoad < 0.9 ? 'degraded' : 'unhealthy',
        message: `CPU load: ${(normalizedLoad * 100).toFixed(1)}%`,
        details: {
          loadAverage: loadAvg,
          cpuCount,
        },
      });
    });

    // Disk health check
    this.healthChecks.set('disk', async () => {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Use different commands based on platform
        const isWindows = process.platform === 'win32';
        const command = isWindows ? 'wmic logicaldisk get size,freespace,caption' : 'df -k /';

        const { stdout } = await execAsync(command);

        if (isWindows) {
          // Parse Windows WMIC output
          const lines = stdout
            .trim()
            .split('\n')
            .filter((line) => line.trim());
          if (lines.length < 2) {
            throw new Error('No disk information available');
          }

          // Parse the first data line (usually C: drive)
          const dataLine = lines[1].trim().split(/\s+/);
          const freeSpace = parseInt(dataLine[1], 10) || 0;
          const totalSpace = parseInt(dataLine[2], 10) || 1;
          const usedSpace = totalSpace - freeSpace;
          const percentUsed = Math.round((usedSpace / totalSpace) * 100);

          return {
            healthy: percentUsed < 80,
            status: percentUsed < 80 ? 'healthy' : percentUsed < 90 ? 'degraded' : 'unhealthy',
            message: `Disk usage: ${percentUsed}%`,
            details: {
              used: usedSpace,
              available: freeSpace,
              total: totalSpace,
              percentUsed,
            },
          };
        } else {
          // Parse Unix/Linux df output
          const lines = stdout.trim().split('\n');
          if (lines.length < 2) {
            throw new Error('No disk information available');
          }

          const stats = lines[1].split(/\s+/);
          const percentUsed = parseInt(stats[4]?.replace('%', '', 10)) || 0;

          return {
            healthy: percentUsed < 80,
            status: percentUsed < 80 ? 'healthy' : percentUsed < 90 ? 'degraded' : 'unhealthy',
            message: `Disk usage: ${percentUsed}%`,
            details: {
              used: parseInt(stats[2], 10) * 1024,
              available: parseInt(stats[3], 10) * 1024,
              total: (parseInt(stats[1], 10) || 0) * 1024,
              percentUsed,
            },
          };
        }
      } catch (_error any) {
        return {
          healthy: true,
          status: 'healthy',
          message: 'Disk check not available on this platform',
          details: { _error _errormessage, platform: process.platform },
        };
      }
    });

    // Migrations health check
    this.healthChecks.set('migrations', async () => {
      if (!this.migrationService) {
        return {
          healthy: true,
          status: 'healthy',
          message: 'Migrations not configured',
        };
      }

      try {
        const status = await this.migrationService.getStatus();
        const hasPending = status.pending.length > 0;
        const hasConflicts = status.conflicts.length > 0;

        return {
          healthy: !hasConflicts,
          status: hasConflicts ? 'unhealthy' : hasPending ? 'degraded' : 'healthy',
          message: hasConflicts
            ? `Migration conflicts: ${status.conflicts.length}`
            : hasPending
              ? `Pending migrations: ${status.pending.length}`
              : 'All migrations applied',
          details: {
            applied: status.applied.length,
            pending: status.pending.length,
            conflicts: status.conflicts.length,
          },
        };
      } catch (_error any) {
        return {
          healthy: false,
          status: 'unhealthy',
          message: 'Migration check failed',
          details: _errormessage,
        };
      }
    });

    // Circuit breakers health check
    this.healthChecks.set('circuitBreakers', () => {
      const cbHealth = circuitBreaker.healthCheck();

      return Promise.resolve({
        healthy: cbHealth.healthy,
        status: cbHealth.healthy ? 'healthy' : 'degraded',
        message:
          cbHealth.openCircuits.length > 0
            ? `Open circuits: ${cbHealth.openCircuits.join(', ')}`
            : 'All circuits closed',
        details: {
          metrics: cbHealth.metrics,
          openCircuits: cbHealth.openCircuits,
        },
      });
    });
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const services: Partial<ServiceHealth> = {};

    // Run all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, check]) => {
      try {
        services[name as keyof ServiceHealth] = await check();
      } catch (_error) {
        services[name as keyof ServiceHealth] = {
          healthy: false,
          status: 'unhealthy',
          message: `Health check failed: ${_error`,
        };
      }
    });

    await Promise.all(checkPromises);

    // Calculate overall status
    const statuses = Object.values(services).map((s) => s?.status || 'unhealthy');
    const overallStatus = statuses.includes('unhealthy')
      ? 'unhealthy'
      : statuses.includes('degraded')
        ? 'degraded'
        : 'healthy';

    // Calculate health score
    const healthScore = this.calculateHealthScore(services as ServiceHealth);

    // Calculate trends
    const trends = this.calculateTrends(healthScore);

    // Generate alerts and suggestions
    const alerts = this.generateAlerts(services as ServiceHealth);
    const suggestions = this.generateSuggestions(services as ServiceHealth, healthScore);

    // Get system metrics
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();

    // Get telemetry information
    const telemetry = this.getTelemetryInfo();

    // Record health history
    const responseTime = Date.now() - startTime;
    this.recordHealthHistory(overallStatus, healthScore, responseTime, services as ServiceHealth);

    const result: HealthCheckResult = {
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date().toISOString(),
      services: services as ServiceHealth,
      metrics: {
        cpu: {
          usage: (loadAvg[0] / os.cpus().length) * 100,
          loadAverage: loadAvg,
        },
        memory: {
          used: totalMem - freeMem,
          total: totalMem,
          percentage: ((totalMem - freeMem) / totalMem) * 100,
        },
        disk: {
          used: 0, // Populated by disk health check
          total: 0,
          percentage: 0,
        },
        requestsPerMinute: this.calculateRequestsPerMinute(),
        averageResponseTime: this.calculateAverageResponseTime(),
      },
      dependencies: this.checkDependencies(),
      healthScore,
      trends,
      alerts,
      suggestions,
      telemetry,
    };

    return result;
  }

  private calculateHealthScore(services: ServiceHealth): number {
    const weights = {
      database: 30, // Critical
      redis: 10, // Important but not critical
      ollama: 20, // AI services are important
      kokoro: 10, // Voice features
      storage: 15, // File storage
      memory: 5, // System resources
      cpu: 5, // System resources
      disk: 3, // System resources
      migrations: 2, // Less critical for runtime
      circuitBreakers: 0, // Already factored into other services
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [serviceName, serviceHealth] of Object.entries(services)) {
      const weight = weights[serviceName as keyof typeof weights] || 1;
      totalWeight += weight;

      let serviceScore = 0;
      switch (serviceHealth.status) {
        case 'healthy':
          serviceScore = 100;
          break;
        case 'degraded':
          serviceScore = 60;
          break;
        case 'unhealthy':
          serviceScore = 0;
          break;
        default:
          serviceScore = 0;
      }

      totalScore += serviceScore * weight;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  private calculateTrends(currentScore: number): {
    status: 'improving' | 'stable' | 'degrading';
    score: number;
  } {
    const scoreDifference = currentScore - this.lastHealthScore;
    this.lastHealthScore = currentScore;

    let status: 'improving' | 'stable' | 'degrading' = 'stable';
    if (scoreDifference > 5) status = 'improving';
    else if (scoreDifference < -5) status = 'degrading';

    return { status, score: scoreDifference };
  }

  private generateAlerts(services: ServiceHealth): Array<{
    level: 'info' | 'warning' | '_error | 'critical';
    message: string;
    service?: string;
    timestamp: string;
  }> {
    const alerts: Array<{
      level: 'info' | 'warning' | '_error | 'critical';
      message: string;
      service?: string;
      timestamp: string;
    }> = [];
    const timestamp = new Date().toISOString();

    for (const [serviceName, serviceHealth] of Object.entries(services)) {
      if (serviceHealth.status === 'unhealthy') {
        alerts.push({
          level: serviceName === 'database' ? 'critical' : '_error,
          message: serviceHealth.message || `Service ${serviceName} is unhealthy`,
          service: serviceName,
          timestamp,
        });
      } else if (serviceHealth.status === 'degraded') {
        alerts.push({
          level: 'warning',
          message: serviceHealth.message || `Service ${serviceName} is degraded`,
          service: serviceName,
          timestamp,
        });
      }
    }

    // Check system resource alerts
    const memUsage = process.memoryUsage();
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (memPercentage > 90) {
      alerts.push({
        level: 'critical',
        message: `Memory usage critically high: ${memPercentage.toFixed(1)}%`,
        service: 'memory',
        timestamp,
      });
    } else if (memPercentage > 80) {
      alerts.push({
        level: 'warning',
        message: `Memory usage high: ${memPercentage.toFixed(1)}%`,
        service: 'memory',
        timestamp,
      });
    }

    return alerts;
  }

  private generateSuggestions(services: ServiceHealth, healthScore: number): string[] {
    const suggestions: string[] = [];

    // Service-specific suggestions
    for (const [serviceName, serviceHealth] of Object.entries(services)) {
      if (serviceHealth.status === 'unhealthy') {
        switch (serviceName) {
          case 'database':
            suggestions.push('Check database connection and credentials');
            suggestions.push('Verify database server is running');
            break;
          case 'redis':
            suggestions.push('Check Redis server status');
            suggestions.push('Verify Redis connection configuration');
            break;
          case 'ollama':
            suggestions.push('Start Ollama service');
            suggestions.push('Check Ollama configuration and model availability');
            break;
          case 'memory':
            suggestions.push('Consider increasing memory allocation');
            suggestions.push('Check for memory leaks');
            suggestions.push('Enable garbage collection optimization');
            break;
          case 'cpu':
            suggestions.push('Reduce CPU load by scaling services');
            suggestions.push('Check for infinite loops or CPU-intensive operations');
            break;
        }
      }
    }

    // Overall health suggestions
    if (healthScore < 50) {
      suggestions.push('System health is critically low - immediate attention required');
      suggestions.push('Consider scaling up resources or restarting services');
    } else if (healthScore < 70) {
      suggestions.push('System health is degraded - investigate failing services');
      suggestions.push('Monitor resource usage and optimize as needed');
    }

    // Remove duplicates
    return [...new Set(suggestions)];
  }

  private getTelemetryInfo(): {
    traceId?: string;
    spanId?: string;
    activeSpans: number;
    tracingEnabled: boolean;
  } {
    try {
      // Try to get telemetry service information
      const { telemetryService } = require('./telemetry-service');
      if (telemetryService) {
        const currentTrace = telemetryService.getCurrentTraceContext();
        const metrics = telemetryService.getServiceMetrics();

        return {
          traceId: currentTrace?.traceId,
          spanId: currentTrace?.spanId,
          activeSpans: metrics?.activeSpans || 0,
          tracingEnabled: true,
        };
      }
    } catch (_error) {
      // Telemetry service not available or not initialized
    }

    return {
      activeSpans: 0,
      tracingEnabled: false,
    };
  }

  private recordHealthHistory(
    status: 'healthy' | 'degraded' | 'unhealthy',
    score: number,
    responseTime: number,
    services: ServiceHealth
  ): void {
    const serviceStatuses: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};
    for (const [name, service] of Object.entries(services)) {
      serviceStatuses[name] = service.status;
    }

    this.healthHistory.push({
      timestamp: new Date(),
      status,
      score,
      responseTime,
      services: serviceStatuses,
    });

    // Keep only last 1000 entries
    if (this.healthHistory.length > 1000) {
      this.healthHistory = this.healthHistory.slice(-1000);
    }
  }

  /**
   * Get health history for analysis
   */
  getHealthHistory(limit = 100): HealthHistory[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get health trends over time
   */
  getHealthTrends(durationMinutes = 60): {
    averageScore: number;
    trend: 'improving' | 'stable' | 'degrading';
    uptimePercentage: number;
    incidents: number;
  } {
    const cutoffTime = new Date(Date.now() - durationMinutes * 60 * 1000);
    const recentHistory = this.healthHistory.filter((h) => h.timestamp > cutoffTime);

    if (recentHistory.length === 0) {
      return {
        averageScore: this.lastHealthScore,
        trend: 'stable',
        uptimePercentage: 100,
        incidents: 0,
      };
    }

    const averageScore = recentHistory.reduce((sum, h) => sum + h.score, 0) / recentHistory.length;
    const healthyCount = recentHistory.filter((h) => h.status === 'healthy').length;
    const uptimePercentage = (healthyCount / recentHistory.length) * 100;
    const incidents = recentHistory.filter((h) => h.status === 'unhealthy').length;

    // Simple trend calculation
    const firstHalf = recentHistory.slice(0, Math.floor(recentHistory.length / 2));
    const secondHalf = recentHistory.slice(Math.floor(recentHistory.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, h) => sum + h.score, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, h) => sum + h.score, 0) / secondHalf.length;

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    const difference = secondHalfAvg - firstHalfAvg;
    if (difference > 5) trend = 'improving';
    else if (difference < -5) trend = 'degrading';

    return {
      averageScore: Math.round(averageScore),
      trend,
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      incidents,
    };
  }

  private checkDependencies(): { name: string; version: string; healthy: boolean }[] {
    const deps = [];

    // Check critical dependencies
    try {
      const packageJson = require('../../package.json');
      const criticalDeps = ['@supabase/supabase-js', 'express', 'zod', 'winston'];

      for (const dep of criticalDeps) {
        let healthy = true;
        let version = packageJson.dependencies[dep] || 'unknown';

        // Try to require the dependency to check if it's actually available
        try {
          require(dep);
        } catch (requireError) {
          healthy = false;
          version = 'missing';
        }

        deps.push({
          name: dep,
          version,
          healthy,
        });
      }
    } catch (_error) {
      logger.error'Failed to check dependencies:', _error;

      // Add fallback dependency info if package.json can't be read
      const fallbackDeps = ['@supabase/supabase-js', 'express', 'zod', 'winston'];
      for (const dep of fallbackDeps) {
        deps.push({
          name: dep,
          version: 'unknown',
          healthy: false,
        });
      }
    }

    return deps;
  }

  async runReadinessCheck(): Promise<boolean> {
    // Readiness check - is the service ready to accept traffic?
    const criticalServices = ['database'];

    for (const service of criticalServices) {
      const check = this.healthChecks.get(service);
      if (check) {
        const result = await check();
        if (!result.healthy) {
          return false;
        }
      }
    }

    return true;
  }

  async runLivenessCheck(): Promise<boolean> {
    // Liveness check - is the service alive and not deadlocked?
    try {
      // Simple check that we can allocate memory and respond
      const testData = Buffer.alloc(1024);
      return testData.length === 1024;
    } catch {
      return false;
    }
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  async getDetailedReport(): Promise<string> {
    const health = await this.checkHealth();

    let report = `
Universal AI Tools Health Report
================================
Status: ${health.status.toUpperCase()}
Version: ${health.version}
Uptime: ${Math.floor(health.uptime / 1000)}s
Timestamp: ${health.timestamp}

Services:
`;

    for (const [name, status] of Object.entries(health.services)) {
      report += `  ${name}: ${status.status} - ${status.message}\n`;
      if (status.details) {
        report += `    Details: ${JSON.stringify(status.details)}\n`;
      }
    }

    report += `
System Metrics:
  CPU: ${health.metrics.cpu.usage.toFixed(1)}% (Load: ${health.metrics.cpu.loadAverage.join(', ')})
  Memory: ${health.metrics.memory.percentage.toFixed(1)}% (${(health.metrics.memory.used / 1024 / 1024 / 1024).toFixed(2)}GB / ${(health.metrics.memory.total / 1024 / 1024 / 1024).toFixed(2)}GB)
  
Dependencies:
`;

    for (const dep of health.dependencies) {
      report += `  ${dep.name}@${dep.version}: ${dep.healthy ? 'OK' : 'FAILED'}\n`;
    }

    return report;
  }

  /**
   * Track a _requestand its response time
   */
  trackRequest(responseTimeMs: number): void {
    const now = Date.now();

    // Clean up old data if needed
    this.cleanupOldMetrics(now);

    // Track total requests
    this.requestMetrics.totalRequests++;

    // Track requests in current minute
    this.requestMetrics.requestsInLastMinute.push(now);

    // Track response times (keep last 1000)
    this.requestMetrics.responseTimes.push(responseTimeMs);
    if (this.requestMetrics.responseTimes.length > 1000) {
      this.requestMetrics.responseTimes.shift();
    }
  }

  /**
   * Calculate requests per minute
   */
  private calculateRequestsPerMinute(): number {
    const now = Date.now();
    this.cleanupOldMetrics(now);
    return this.requestMetrics.requestsInLastMinute.length;
  }

  /**
   * Calculate average response time from recent requests
   */
  private calculateAverageResponseTime(): number {
    if (this.requestMetrics.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.requestMetrics.responseTimes.length);
  }

  /**
   * Clean up metrics older than 1 minute
   */
  private cleanupOldMetrics(now: number): void {
    const oneMinuteAgo = now - 60000; // 60 seconds

    // Remove requests older than 1 minute
    this.requestMetrics.requestsInLastMinute = this.requestMetrics.requestsInLastMinute.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startMetricsCleanup(): void {
    // Clean up every 30 seconds
    setInterval(() => {
      this.cleanupOldMetrics(Date.now());
    }, 30000);
  }

  /**
   * Get current _requestmetrics
   */
  getRequestMetrics(): {
    totalRequests: number;
    requestsPerMinute: number;
    averageResponseTime: number;
  } {
    return {
      totalRequests: this.requestMetrics.totalRequests,
      requestsPerMinute: this.calculateRequestsPerMinute(),
      averageResponseTime: this.calculateAverageResponseTime(),
    };
  }

  /**
   * Reset _requestmetrics
   */
  resetMetrics(): void {
    this.requestMetrics = {
      totalRequests: 0,
      requestsInLastMinute: [],
      responseTimes: [],
      lastMinuteStart: Date.now(),
    };
  }
}

// Export a factory function to create the health check service
export function createHealthCheckService(
  supabase: SupabaseClient,
  redis?: RedisClientType,
  migrationService?: DatabaseMigrationService
): HealthCheckService {
  return new HealthCheckService(supabase, redis, migrationService);
}

/**
 * Middleware to track _requestmetrics
 */
export function createRequestTrackingMiddleware(healthService: HealthCheckService) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Track when response finishes
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      healthService.trackRequest(responseTime);
    });

    next();
  };
}

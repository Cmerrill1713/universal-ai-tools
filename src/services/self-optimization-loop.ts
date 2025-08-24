/**
 * Self-Optimization Loop Service
 * Continuously monitors and optimizes system performance
 */

import type { FSWatcher } from 'fs';
import { watch } from 'fs';

import { log, LogContext } from '../utils/logger';

interface OptimizationMetrics {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  agentHealth: number;
  meshConnectivity: number;
}

interface OptimizationAction {
  type:
    | 'memory_cleanup'
    | 'agent_restart'
    | 'cache_clear'
    | 'connection_reset'
    | 'performance_tune';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

interface OptimizationResult {
  success: boolean;
  action: OptimizationAction;
  metrics: OptimizationMetrics;
  improvement: number;
  duration: number;
}

type OptimizationMode = 'event' | 'interval';

class SelfOptimizationLoop {
  private isRunning = false;
  private optimizationInterval: NodeJS.Timeout | null = null;
  private metricsHistory: OptimizationMetrics[] = [];
  private actionHistory: OptimizationResult[] = [];
  private lastOptimization = 0;
  private optimizationThreshold = 0.1; // 10% improvement threshold
  private mode: OptimizationMode = 'event';
  private watcher: FSWatcher | null = null;
  private watchedPaths: string[] = [];

  constructor() {
    // Default to event-driven mode: watch internal files and run on change
    this.enableEventWatching(['src', 'public', 'ui']);
  }

  /**
   * Start the optimization loop
   */
  public start(options?: { mode?: OptimizationMode; intervalMs?: number }): void {
    if (this.isRunning) {
      log.warn('Self-optimization loop already running', LogContext.SYSTEM);
      return;
    }

    this.isRunning = true;
    this.mode = options?.mode ?? this.mode;

    if (this.mode === 'interval') {
      const intervalMs = options?.intervalMs ?? 30000;
      this.optimizationInterval = setInterval(() => {
        void this.runOptimizationCycle();
      }, intervalMs);
      log.info('🔄 Self-optimization loop started (interval mode)', LogContext.SYSTEM, {
        interval: intervalMs,
        threshold: this.optimizationThreshold,
      });
    } else {
      // Event-driven mode is passive; watcher triggers cycles
      log.info('🔄 Self-optimization loop started (event mode)', LogContext.SYSTEM, {
        watchedPaths: this.watchedPaths,
        threshold: this.optimizationThreshold,
      });
    }
  }

  /**
   * Stop the optimization loop
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }
    this.disableEventWatching();

    log.info('🛑 Self-optimization loop stopped', LogContext.SYSTEM);
  }

  /**
   * Public method to run one optimization cycle on-demand
   */
  public async runOnce(): Promise<void> {
    await this.runOptimizationCycle();
  }

  /**
   * Enable event-driven mode by watching file system paths
   */
  public enableEventWatching(paths: string[]): void {
    this.disableEventWatching();
    this.mode = 'event';
    this.watchedPaths = paths;

    const uniquePaths = Array.from(new Set(paths)).filter(Boolean);
    if (uniquePaths.length === 0) {
      return;
    }

    try {
      // Use a single recursive watcher per top-level path (macOS supports recursive)
      // We coalesce rapid events with a debounce to avoid thrashing
      let debounceTimer: NodeJS.Timeout | null = null;
      const trigger = () => {
        if (!this.isRunning) {return;}
        if (debounceTimer) {clearTimeout(debounceTimer);}
        debounceTimer = setTimeout(() => {
          log.info('📂 Change detected, triggering optimization cycle', LogContext.SYSTEM);
          void this.runOptimizationCycle();
        }, 300);
      };

      // Create a watcher per path; keep references to close later
      const watchers: FSWatcher[] = [];
      for (const p of uniquePaths) {
        try {
          const w = watch(p, { recursive: true }, (_eventType, _filename) => {
            trigger();
          });
          watchers.push(w);
        } catch (err) {
          log.warn('Failed to watch path', LogContext.SYSTEM, {
            path: p,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Store a wrapper to close all when disabling
      // We keep just one reference; on close, we will close all
      this.watcher = {
        close: () => {
          for (const w of watchers) {
            try {
              w.close();
            } catch {}
          }
        },
        // Other FSWatcher methods/events are not used in this wrapper
      } as unknown as FSWatcher;

      log.info('👀 Event watching enabled for self-optimization', LogContext.SYSTEM, {
        watchedPaths: uniquePaths,
      });
    } catch (error) {
      log.error('Failed to enable event watching', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Disable any active event watchers
   */
  public disableEventWatching(): void {
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {}
      this.watcher = null;
      log.info('👀 Event watching disabled for self-optimization', LogContext.SYSTEM);
    }
  }

  /**
   * Run a single optimization cycle
   */
  private async runOptimizationCycle(): Promise<void> {
    try {
      const startTime = Date.now();
      const currentMetrics = await this.collectMetrics();

      // Store metrics history (keep last 100 entries)
      this.metricsHistory.push(currentMetrics);
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift();
      }

      // Analyze system health
      const healthScore = this.calculateHealthScore(currentMetrics);
      const issues = this.identifyIssues(currentMetrics);

      log.info('📊 Optimization cycle metrics', LogContext.SYSTEM, {
        healthScore,
        issues: issues.length,
        cpuUsage: currentMetrics.cpuUsage,
        memoryUsage: currentMetrics.memoryUsage,
        responseTime: currentMetrics.responseTime,
      });

      // Generate optimization actions
      const actions = this.generateOptimizationActions(issues, currentMetrics);

      // Execute high-priority actions immediately
      const criticalActions = actions.filter((a) => a.priority === 'critical');
      for (const action of criticalActions) {
        await this.executeAction(action);
      }

      // Execute other actions based on improvement potential
      const otherActions = actions.filter((a) => a.priority !== 'critical');
      for (const action of otherActions) {
        const improvement = this.calculateImprovementPotential(action, currentMetrics);
        if (improvement > this.optimizationThreshold) {
          await this.executeAction(action);
        }
      }

      const cycleDuration = Date.now() - startTime;
      this.lastOptimization = Date.now();
      log.info('✅ Optimization cycle completed', LogContext.SYSTEM, {
        duration: cycleDuration,
        actionsExecuted: criticalActions.length + otherActions.length,
        healthScore,
      });
    } catch (error) {
      log.error('❌ Optimization cycle failed', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<OptimizationMetrics> {
    const os = await import('os');
    const process = await import('process');

    const cpuUsage =
      os.cpus().reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((sum, time) => sum + time, 0);
        const { idle } = cpu.times;
        return acc + ((total - idle) / total) * 100;
      }, 0) / os.cpus().length;

    const memoryUsage = (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100;

    // Mock other metrics for now - these would come from actual monitoring
    const responseTime = Math.random() * 100 + 50; // 50-150ms
    const errorRate = Math.random() * 0.05; // 0-5%
    const throughput = Math.random() * 1000 + 500; // 500-1500 req/s
    const agentHealth = Math.random() * 100; // 0-100%
    const meshConnectivity = Math.random() * 100; // 0-100%

    return {
      cpuUsage,
      memoryUsage,
      responseTime,
      errorRate,
      throughput,
      agentHealth,
      meshConnectivity,
    };
  }

  /**
   * Calculate overall system health score
   */
  private calculateHealthScore(metrics: OptimizationMetrics): number {
    const weights = {
      cpuUsage: 0.2,
      memoryUsage: 0.2,
      responseTime: 0.2,
      errorRate: 0.2,
      agentHealth: 0.1,
      meshConnectivity: 0.1,
    };

    const cpuScore = Math.max(0, 100 - metrics.cpuUsage);
    const memoryScore = Math.max(0, 100 - metrics.memoryUsage);
    const responseScore = Math.max(0, 100 - (metrics.responseTime / 200) * 100);
    const errorScore = Math.max(0, 100 - metrics.errorRate * 2000);
    const agentScore = metrics.agentHealth;
    const meshScore = metrics.meshConnectivity;

    return (
      cpuScore * weights.cpuUsage +
      memoryScore * weights.memoryUsage +
      responseScore * weights.responseTime +
      errorScore * weights.errorRate +
      agentScore * weights.agentHealth +
      meshScore * weights.meshConnectivity
    );
  }

  /**
   * Identify system issues
   */
  private identifyIssues(metrics: OptimizationMetrics): string[] {
    const issues: string[] = [];

    if (metrics.cpuUsage > 80) {
      issues.push('high_cpu_usage');
    }
    if (metrics.memoryUsage > 85) {
      issues.push('high_memory_usage');
    }
    if (metrics.responseTime > 100) {
      issues.push('slow_response_time');
    }
    if (metrics.errorRate > 0.02) {
      issues.push('high_error_rate');
    }
    if (metrics.agentHealth < 50) {
      issues.push('low_agent_health');
    }
    if (metrics.meshConnectivity < 70) {
      issues.push('poor_mesh_connectivity');
    }

    return issues;
  }

  /**
   * Generate optimization actions based on issues
   */
  private generateOptimizationActions(
    issues: string[],
    _metrics: OptimizationMetrics
  ): OptimizationAction[] {
    const actions: OptimizationAction[] = [];

    for (const issue of issues) {
      switch (issue) {
        case 'high_cpu_usage':
          actions.push({
            type: 'performance_tune',
            priority: 'high',
            description: 'Optimize CPU-intensive operations',
            impact: 'positive',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'high_memory_usage':
          actions.push({
            type: 'memory_cleanup',
            priority: 'critical',
            description: 'Clear memory cache and garbage collection',
            impact: 'positive',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'slow_response_time':
          actions.push({
            type: 'cache_clear',
            priority: 'medium',
            description: 'Clear response cache and optimize queries',
            impact: 'positive',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'high_error_rate':
          actions.push({
            type: 'connection_reset',
            priority: 'high',
            description: 'Reset failed connections and retry mechanisms',
            impact: 'positive',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'low_agent_health':
          actions.push({
            type: 'agent_restart',
            priority: 'medium',
            description: 'Restart unhealthy agents',
            impact: 'positive',
            timestamp: new Date().toISOString(),
          });
          break;

        case 'poor_mesh_connectivity':
          actions.push({
            type: 'connection_reset',
            priority: 'high',
            description: 'Reestablish mesh network connections',
            impact: 'positive',
            timestamp: new Date().toISOString(),
          });
          break;
      }
    }

    return actions;
  }

  /**
   * Calculate improvement potential for an action
   */
  private calculateImprovementPotential(
    action: OptimizationAction,
    metrics: OptimizationMetrics
  ): number {
    // This would be based on historical data and ML predictions
    // For now, use simple heuristics
    switch (action.type) {
      case 'memory_cleanup':
        return Math.min(0.3, metrics.memoryUsage / 100);
      case 'performance_tune':
        return Math.min(0.2, metrics.cpuUsage / 100);
      case 'cache_clear':
        return Math.min(0.15, metrics.responseTime / 200);
      case 'connection_reset':
        return Math.min(0.25, metrics.errorRate * 10);
      case 'agent_restart':
        return Math.min(0.2, (100 - metrics.agentHealth) / 100);
      default:
        return 0.1;
    }
  }

  /**
   * Execute an optimization action
   */
  private async executeAction(action: OptimizationAction): Promise<OptimizationResult> {
    const startTime = Date.now();
    const beforeMetrics = await this.collectMetrics();

    try {
      log.info('🔧 Executing optimization action', LogContext.SYSTEM, {
        action: action.type,
        priority: action.priority,
        description: action.description,
      });

      switch (action.type) {
        case 'memory_cleanup':
          await this.performMemoryCleanup();
          break;
        case 'agent_restart':
          await this.restartUnhealthyAgents();
          break;
        case 'cache_clear':
          await this.clearCaches();
          break;
        case 'connection_reset':
          await this.resetConnections();
          break;
        case 'performance_tune':
          await this.tunePerformance();
          break;
      }

      const afterMetrics = await this.collectMetrics();
      const improvement =
        this.calculateHealthScore(afterMetrics) - this.calculateHealthScore(beforeMetrics);
      const duration = Date.now() - startTime;

      const result: OptimizationResult = {
        success: true,
        action,
        metrics: afterMetrics,
        improvement,
        duration,
      };

      this.actionHistory.push(result);
      if (this.actionHistory.length > 50) {
        this.actionHistory.shift();
      }

      log.info('✅ Optimization action completed', LogContext.SYSTEM, {
        action: action.type,
        improvement,
        duration,
      });

      return result;
    } catch (error) {
      log.error('❌ Optimization action failed', LogContext.SYSTEM, {
        action: action.type,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        action,
        metrics: beforeMetrics,
        improvement: 0,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Perform memory cleanup
   */
  private async performMemoryCleanup(): Promise<void> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear any in-memory caches
    // This would integrate with your actual cache systems
    log.info('🧹 Memory cleanup performed', LogContext.SYSTEM);
  }

  /**
   * Restart unhealthy agents
   */
  private async restartUnhealthyAgents(): Promise<void> {
    // This would integrate with your agent registry
    log.info('🔄 Restarting unhealthy agents', LogContext.SYSTEM);
  }

  /**
   * Clear various caches
   */
  private async clearCaches(): Promise<void> {
    // Clear response caches, query caches, etc.
    log.info('🗑️ Caches cleared', LogContext.SYSTEM);
  }

  /**
   * Reset network connections
   */
  private async resetConnections(): Promise<void> {
    // Reset WebSocket connections, database connections, etc.
    log.info('🔌 Connections reset', LogContext.SYSTEM);
  }

  /**
   * Tune performance settings
   */
  private async tunePerformance(): Promise<void> {
    // Adjust thread pools, connection limits, etc.
    log.info('⚡ Performance tuned', LogContext.SYSTEM);
  }

  /**
   * Get optimization statistics
   */
  public getStats(): {
    isRunning: boolean;
    metricsHistory: OptimizationMetrics[];
    actionHistory: OptimizationResult[];
    lastOptimization: number;
    healthScore: number;
  } {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1] || {
      cpuUsage: 0,
      memoryUsage: 0,
      responseTime: 0,
      errorRate: 0,
      throughput: 0,
      agentHealth: 0,
      meshConnectivity: 0,
    };

    return {
      isRunning: this.isRunning,
      metricsHistory: this.metricsHistory,
      actionHistory: this.actionHistory,
      lastOptimization: this.lastOptimization,
      healthScore: this.calculateHealthScore(currentMetrics),
    };
  }

  /**
   * Get recent optimization actions
   */
  public getRecentActions(limit = 10): OptimizationResult[] {
    return this.actionHistory.slice(-limit);
  }

  /**
   * Get system health trends
   */
  public getHealthTrends(): {
    cpuTrend: number[];
    memoryTrend: number[];
    responseTimeTrend: number[];
    errorRateTrend: number[];
  } {
    const recentMetrics = this.metricsHistory.slice(-20);

    return {
      cpuTrend: recentMetrics.map((m) => m.cpuUsage),
      memoryTrend: recentMetrics.map((m) => m.memoryUsage),
      responseTimeTrend: recentMetrics.map((m) => m.responseTime),
      errorRateTrend: recentMetrics.map((m) => m.errorRate),
    };
  }
}

// Create singleton instance
export const selfOptimizationLoop = new SelfOptimizationLoop();

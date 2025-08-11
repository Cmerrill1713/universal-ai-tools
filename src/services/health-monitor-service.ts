/**
 * Health Monitor Service - Self-healing system monitoring
 * Monitors system health and automatically recovers from failures
 */

import { EventEmitter } from 'events';

import type AgentRegistry from '@/agents/agent-registry';
import { log,LogContext } from '@/utils/logger';

import { a2aMesh } from './a2a-communication-mesh';

export interface HealthMetrics {
  systemHealth: number; // 0-1 score
  agentHealth: number;
  meshHealth: number;
  memoryUsage: number;
  cpuUsage: number;
  errorRate: number;
  responseTime: number;
  timestamp: Date;
}

export interface HealthIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  autoFixable: boolean;
  timestamp: Date;
}

export class HealthMonitorService extends EventEmitter {
  private agentRegistry: AgentRegistry | null = null;
  private healthHistory: HealthMetrics[] = [];
  private activeIssues: Map<string, HealthIssue> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healingInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {
    super();
    this.startMonitoring();
  }

  public setAgentRegistry(agentRegistry: AgentRegistry): void {
    this.agentRegistry = agentRegistry;
  }

  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    // Health check every 2 minutes (increased from 30 seconds)
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck();
    }, 120000);

    // Self-healing check every 5 minutes (increased from 60 seconds)
    this.healingInterval = setInterval(() => {
      this.performSelfHealing();
    }, 300000);

    log.info('🏥 Health monitoring started', LogContext.SYSTEM);
  }

  private async performHealthCheck(): Promise<HealthMetrics> {
    try {
      const metrics: HealthMetrics = {
        systemHealth: 0,
        agentHealth: 0,
        meshHealth: 0,
        memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        errorRate: this.calculateErrorRate(),
        responseTime: await this.measureResponseTime(),
        timestamp: new Date(),
      };

      // Calculate agent health
      if (this.agentRegistry) {
        const meshStatus = this.agentRegistry.getMeshStatus();
        metrics.agentHealth = (meshStatus as any).meshHealth || 0;
        metrics.meshHealth = (meshStatus as any).meshHealth || 0;
      }

      // Calculate overall system health
      metrics.systemHealth = this.calculateSystemHealth(metrics);

      // Store in history (keep last 100 entries)
      this.healthHistory.push(metrics);
      if (this.healthHistory.length > 100) {
        this.healthHistory = this.healthHistory.slice(-100);
      }

      // Check for issues
      this.detectIssues(metrics);

      // Emit health update
      this.emit('health_update', metrics);

      return metrics;
    } catch (error) {
      log.error('❌ Health check failed', LogContext.SYSTEM, { error });
      throw error;
    }
  }

  private calculateSystemHealth(metrics: HealthMetrics): number {
    const weights = {
      agentHealth: 0.3,
      meshHealth: 0.2,
      memoryUsage: 0.2,
      cpuUsage: 0.1,
      errorRate: 0.1,
      responseTime: 0.1,
    };

    let health = 0;

    health += metrics.agentHealth * weights.agentHealth;
    health += metrics.meshHealth * weights.meshHealth;
    health += (1 - Math.min(metrics.memoryUsage, 1)) * weights.memoryUsage;
    health += (1 - Math.min(metrics.cpuUsage / 100, 1)) * weights.cpuUsage;
    health += (1 - Math.min(metrics.errorRate, 1)) * weights.errorRate;
    health += (1 - Math.min(metrics.responseTime / 5000, 1)) * weights.responseTime; // 5s max

    return Math.max(0, Math.min(1, health));
  }

  private calculateErrorRate(): number {
    // Calculate error rate from recent history
    const recentMetrics = this.healthHistory.slice(-10);
    if (recentMetrics.length === 0) return 0;

    const totalErrors = recentMetrics.reduce((sum, m) => sum + (m.errorRate || 0), 0);
    return totalErrors / recentMetrics.length;
  }

  private async measureResponseTime(): Promise<number> {
    const start = Date.now();
    try {
      // Simple internal ping
      await new Promise((resolve) => setTimeout(resolve, 1));
      return Date.now() - start;
    } catch {
      return 5000; // Max response time on error
    }
  }

  private detectIssues(metrics: HealthMetrics): void {
    const issues: HealthIssue[] = [];

    // High memory usage - increased threshold from 0.8 to 0.85
    if (metrics.memoryUsage > 0.85) {
      issues.push({
        id: 'high_memory_usage',
        severity: metrics.memoryUsage > 0.95 ? 'critical' : 'high', // Increased from 0.9 to 0.95
        component: 'system',
        description: `High memory usage: ${Math.round(metrics.memoryUsage * 100)}%`,
        autoFixable: true,
        timestamp: new Date(),
      });
    }

    // Low agent health
    if (metrics.agentHealth < 0.5) {
      issues.push({
        id: 'low_agent_health',
        severity: metrics.agentHealth < 0.2 ? 'critical' : 'high',
        component: 'agents',
        description: `Low agent health: ${Math.round(metrics.agentHealth * 100)}%`,
        autoFixable: true,
        timestamp: new Date(),
      });
    }

    // Mesh connectivity issues
    if (metrics.meshHealth < 0.3) {
      issues.push({
        id: 'mesh_connectivity',
        severity: 'high',
        component: 'mesh',
        description: `Poor mesh connectivity: ${Math.round(metrics.meshHealth * 100)}%`,
        autoFixable: true,
        timestamp: new Date(),
      });
    }

    // High error rate
    if (metrics.errorRate > 0.1) {
      issues.push({
        id: 'high_error_rate',
        severity: metrics.errorRate > 0.3 ? 'critical' : 'medium',
        component: 'system',
        description: `High error rate: ${Math.round(metrics.errorRate * 100)}%`,
        autoFixable: false,
        timestamp: new Date(),
      });
    }

    // Update active issues
    for (const issue of issues) {
      if (!this.activeIssues.has(issue.id)) {
        this.activeIssues.set(issue.id, issue);
        this.emit('issue_detected', issue);
        log.warn(`🚨 Health issue detected: ${issue.description}`, LogContext.SYSTEM, {
          severity: issue.severity,
          component: issue.component,
        });
      }
    }

    // Remove resolved issues
    for (const [issueId, issue] of this.activeIssues) {
      if (!issues.find((i) => i.id === issueId)) {
        this.activeIssues.delete(issueId);
        this.emit('issue_resolved', issue);
        log.info(`✅ Health issue resolved: ${issue.description}`, LogContext.SYSTEM);
      }
    }
  }

  private async performSelfHealing(): Promise<void> {
    if (this.activeIssues.size === 0) return;

    log.info('🔧 Performing self-healing actions', LogContext.SYSTEM, {
      issues: this.activeIssues.size,
    });

    for (const [issueId, issue] of this.activeIssues) {
      if (!issue.autoFixable) continue;

      try {
        await this.healIssue(issue);
        log.info(`✅ Auto-healed issue: ${issue.description}`, LogContext.SYSTEM);
      } catch (error) {
        log.error(`❌ Failed to auto-heal issue: ${issue.description}`, LogContext.SYSTEM, {
          error,
        });
      }
    }
  }

  private async healIssue(issue: HealthIssue): Promise<void> {
    switch (issue.id) {
      case 'high_memory_usage':
        await this.healMemoryUsage();
        break;

      case 'low_agent_health':
        await this.healAgentHealth();
        break;

      case 'mesh_connectivity':
        await this.healMeshConnectivity();
        break;

      default:
        log.warn(`No healing strategy for issue: ${issue.id}`, LogContext.SYSTEM);
    }
  }

  private async healMemoryUsage(): Promise<void> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Unload idle agents
    if (this.agentRegistry) {
      await this.agentRegistry.unloadIdleAgents(15); // 15 minutes
    }

    // Clear old health history
    if (this.healthHistory.length > 50) {
      this.healthHistory = this.healthHistory.slice(-50);
    }

    // Best-effort nudge to LFM2 bridge to restart if exists
    try {
      const { lfm2Bridge } = await import('@/services/lfm2-bridge');
      // If memory has been high across two latest measurements, restart LFM2
      const latest = this.healthHistory.slice(-2);
      if (latest.length === 2 && latest.every((m) => m.memoryUsage > 0.85)) {
        await (lfm2Bridge as any).restart?.();
        log.info('🔄 Requested LFM2 restart due to sustained high memory', LogContext.AI);
      }
    } catch {
      // ignore in dev
    }
  }

  private async healAgentHealth(): Promise<void> {
    if (!this.agentRegistry) return;

    try {
      // Try to restart core agents
      const coreAgents = this.agentRegistry.getCoreAgents();

      for (const agentName of coreAgents) {
        try {
          const agent = await this.agentRegistry.getAgent(agentName);
          if (agent) {
            log.info(`🔄 Restarting agent: ${agentName}`, LogContext.AGENT);
            await agent.initialize();
          }
        } catch (error) {
          log.error(`Failed to restart agent: ${agentName}`, LogContext.AGENT, { error });
        }
      }
    } catch (error) {
      log.error('Failed to heal agent health', LogContext.SYSTEM, { error });
    }
  }

  private async healMeshConnectivity(): Promise<void> {
    try {
      // Get all agent connections and try to reconnect offline ones
      const connections = a2aMesh.getAgentConnections();
      const offlineAgents = connections.filter((conn) => conn.status === 'offline');

      for (const conn of offlineAgents) {
        try {
          // Re-register agent in mesh
          a2aMesh.registerAgent(conn.agentName, conn.capabilities, conn.trustLevel);
          log.info(`🔗 Reconnected agent to mesh: ${conn.agentName}`, LogContext.AGENT);
        } catch (error) {
          log.error(`Failed to reconnect agent: ${conn.agentName}`, LogContext.AGENT, { error });
        }
      }
    } catch (error) {
      log.error('Failed to heal mesh connectivity', LogContext.SYSTEM, { error });
    }
  }

  // Public API methods

  public getCurrentHealth(): HealthMetrics | null {
    return this.healthHistory.length > 0
      ? this.healthHistory[this.healthHistory.length - 1] || null
      : null;
  }

  public getHealthHistory(limit = 10): HealthMetrics[] {
    return this.healthHistory.slice(-limit);
  }

  public getActiveIssues(): HealthIssue[] {
    return Array.from(this.activeIssues.values());
  }

  public async forceHealthCheck(): Promise<HealthMetrics> {
    return await this.performHealthCheck();
  }

  public async forceSelfHealing(): Promise<void> {
    await this.performSelfHealing();
  }

  public getHealthSummary(): {
    overallHealth: number;
    issueCount: number;
    criticalIssues: number;
    uptimeHours: number;
  } {
    const currentHealth = this.getCurrentHealth();
    const criticalIssues = Array.from(this.activeIssues.values()).filter(
      (issue) => issue.severity === 'critical'
    ).length;

    return {
      overallHealth: currentHealth?.systemHealth || 0,
      issueCount: this.activeIssues.size,
      criticalIssues,
      uptimeHours: process.uptime() / 3600,
    };
  }

  public async shutdown(): Promise<void> {
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.healingInterval) {
      clearInterval(this.healingInterval);
      this.healingInterval = null;
    }

    this.removeAllListeners();
    log.info('🏥 Health monitoring stopped', LogContext.SYSTEM);
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitorService();
export default healthMonitor;

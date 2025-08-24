/**
 * Agent Health Monitor Service
 * Provides continuous monitoring and load balancing for Rust Agent Registry
 * Part of Phase 2: Agent Registry Coordination
 */

import { Logger } from '../utils/logger';
import { rustAgentRegistryClient, RustAgentRegistryClient } from './rustAgentRegistryClient';
import type { AgentDefinition, AgentStatusInfo, AgentMetrics } from './rustAgentRegistryClient';

export interface HealthAlert {
  alertId: string;
  agentId: string;
  agentName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  alertType: 'health_degraded' | 'performance_issue' | 'connection_lost' | 'resource_exhausted';
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  metrics: {
    healthScore: number;
    responseTimeMs: number;
    errorRate: number;
    cpuUsage?: number;
    memoryUsage?: number;
  };
}

export interface LoadBalancingDecision {
  recommendedAgent: AgentDefinition;
  alternativeAgents: AgentDefinition[];
  strategy: 'health_score' | 'least_connections' | 'fastest_response' | 'weighted_round_robin';
  confidence: number;
  reasoning: string[];
  performanceProjection: {
    expectedResponseTimeMs: number;
    successProbability: number;
    resourceUtilization: number;
  };
}

export interface MonitoringStats {
  totalAgents: number;
  healthyAgents: number;
  degradedAgents: number;
  criticalAgents: number;
  averageHealthScore: number;
  averageResponseTime: number;
  totalAlerts: number;
  activeAlerts: number;
  monitoringUptime: number;
  lastHealthCheck: Date;
}

class AgentHealthMonitorService {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private activeAlerts = new Map<string, HealthAlert>();
  private monitoringStartTime = new Date();
  private healthCheckHistory = new Map<string, AgentMetrics[]>();
  private readonly MONITORING_INTERVAL_MS = 30_000; // 30 seconds
  private readonly HEALTH_HISTORY_LIMIT = 100; // Keep last 100 health checks per agent
  private readonly HEALTH_THRESHOLDS = {
    critical: 0.3,
    high: 0.5,
    medium: 0.7,
    healthy: 0.8,
  };

  /**
   * Start continuous health monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      Logger.warn('Agent health monitoring is already active');
      return;
    }

    Logger.info('🏥 Starting Agent Health Monitor Service');
    this.isMonitoring = true;
    this.monitoringStartTime = new Date();

    // Initial health check
    await this.performHealthCheck();

    // Set up continuous monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        Logger.error('Health check cycle failed:', error);
      }
    }, this.MONITORING_INTERVAL_MS);

    Logger.info('✅ Agent Health Monitor started successfully');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    Logger.info('🛑 Stopping Agent Health Monitor Service');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    Logger.info('✅ Agent Health Monitor stopped');
  }

  /**
   * Perform comprehensive health check on all agents
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    Logger.debug('🔍 Starting health check cycle...');

    try {
      // Get all registered agents
      const agents = await rustAgentRegistryClient.listAgents();
      const healthChecks = await Promise.allSettled(
        agents.map(agent => this.checkAgentHealth(agent))
      );

      let healthyCount = 0;
      let alertsGenerated = 0;

      healthChecks.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.isHealthy) {
            healthyCount++;
          } else {
            alertsGenerated++;
          }
        } else {
          Logger.warn(`Health check failed for agent ${agents[index].name}:`, result.reason);
        }
      });

      const duration = Date.now() - startTime;
      Logger.debug(`✅ Health check cycle completed in ${duration}ms`, {
        totalAgents: agents.length,
        healthyAgents: healthyCount,
        alertsGenerated,
        duration,
      });
    } catch (error) {
      Logger.error('Health check cycle failed:', error);
    }
  }

  /**
   * Check health of individual agent and generate alerts if needed
   */
  private async checkAgentHealth(
    agent: AgentDefinition
  ): Promise<{ isHealthy: boolean; metrics?: AgentMetrics }> {
    try {
      const [status, metrics] = await Promise.all([
        rustAgentRegistryClient.getAgentStatus(agent.id),
        rustAgentRegistryClient.getAgentPerformanceMetrics(agent.id),
      ]);

      // Store health history
      this.storeHealthHistory(agent.id, metrics);

      // Analyze health and generate alerts
      const isHealthy = await this.analyzeAgentHealth(agent, status, metrics);

      return { isHealthy, metrics };
    } catch (error) {
      // Agent is unreachable or has issues
      await this.generateAlert(agent.id, agent.name, {
        severity: 'critical',
        alertType: 'connection_lost',
        message: `Agent is unreachable: ${error instanceof Error ? error.message : String(error)}`,
        healthScore: 0,
        responseTimeMs: 0,
        errorRate: 1.0,
      });

      return { isHealthy: false };
    }
  }

  /**
   * Store health metrics history for trend analysis
   */
  private storeHealthHistory(agentId: string, metrics: AgentMetrics): void {
    if (!this.healthCheckHistory.has(agentId)) {
      this.healthCheckHistory.set(agentId, []);
    }

    const history = this.healthCheckHistory.get(agentId)!;
    history.push(metrics);

    // Keep only recent history
    if (history.length > this.HEALTH_HISTORY_LIMIT) {
      history.shift();
    }
  }

  /**
   * Analyze agent health and generate alerts if thresholds are breached
   */
  private async analyzeAgentHealth(
    agent: AgentDefinition,
    status: AgentStatusInfo,
    metrics: AgentMetrics
  ): Promise<boolean> {
    const healthScore = metrics.health_score;
    let alertGenerated = false;

    // Check critical health threshold
    if (healthScore <= this.HEALTH_THRESHOLDS.critical) {
      await this.generateAlert(agent.id, agent.name, {
        severity: 'critical',
        alertType: 'health_degraded',
        message: `Agent health critically low: ${Math.round(healthScore * 100)}%`,
        healthScore,
        responseTimeMs: metrics.avg_response_time_ms,
        errorRate: metrics.error_rate,
      });
      alertGenerated = true;
    }
    // Check high severity threshold
    else if (healthScore <= this.HEALTH_THRESHOLDS.high) {
      await this.generateAlert(agent.id, agent.name, {
        severity: 'high',
        alertType: 'health_degraded',
        message: `Agent health significantly degraded: ${Math.round(healthScore * 100)}%`,
        healthScore,
        responseTimeMs: metrics.avg_response_time_ms,
        errorRate: metrics.error_rate,
      });
      alertGenerated = true;
    }
    // Check performance issues
    else if (metrics.avg_response_time_ms > 5000) {
      await this.generateAlert(agent.id, agent.name, {
        severity: 'medium',
        alertType: 'performance_issue',
        message: `Agent response time degraded: ${Math.round(metrics.avg_response_time_ms)}ms`,
        healthScore,
        responseTimeMs: metrics.avg_response_time_ms,
        errorRate: metrics.error_rate,
      });
      alertGenerated = true;
    }
    // Resolve existing alerts if agent is healthy
    else if (healthScore >= this.HEALTH_THRESHOLDS.healthy) {
      await this.resolveAgentAlerts(agent.id);
    }

    return !alertGenerated && healthScore >= this.HEALTH_THRESHOLDS.healthy;
  }

  /**
   * Generate health alert for agent
   */
  private async generateAlert(
    agentId: string,
    agentName: string,
    alertData: {
      severity: 'low' | 'medium' | 'high' | 'critical';
      alertType: 'health_degraded' | 'performance_issue' | 'connection_lost' | 'resource_exhausted';
      message: string;
      healthScore: number;
      responseTimeMs: number;
      errorRate: number;
      cpuUsage?: number;
      memoryUsage?: number;
    }
  ): Promise<void> {
    const alertId = `${agentId}-${alertData.alertType}-${Date.now()}`;

    // Check if similar alert already exists
    const existingAlert = Array.from(this.activeAlerts.values()).find(
      alert =>
        alert.agentId === agentId && alert.alertType === alertData.alertType && !alert.resolvedAt
    );

    if (existingAlert) {
      // Update existing alert timestamp
      existingAlert.triggeredAt = new Date();
      existingAlert.metrics = {
        healthScore: alertData.healthScore,
        responseTimeMs: alertData.responseTimeMs,
        errorRate: alertData.errorRate,
        cpuUsage: alertData.cpuUsage,
        memoryUsage: alertData.memoryUsage,
      };
      return;
    }

    const alert: HealthAlert = {
      alertId,
      agentId,
      agentName,
      severity: alertData.severity,
      alertType: alertData.alertType,
      message: alertData.message,
      triggeredAt: new Date(),
      metrics: {
        healthScore: alertData.healthScore,
        responseTimeMs: alertData.responseTimeMs,
        errorRate: alertData.errorRate,
        cpuUsage: alertData.cpuUsage,
        memoryUsage: alertData.memoryUsage,
      },
    };

    this.activeAlerts.set(alertId, alert);

    Logger.warn(`🚨 Agent Health Alert [${alertData.severity.toUpperCase()}]:`, {
      alertId,
      agentName,
      alertType: alertData.alertType,
      message: alertData.message,
      healthScore: Math.round(alertData.healthScore * 100),
      responseTimeMs: alertData.responseTimeMs,
      errorRate: Math.round(alertData.errorRate * 100),
    });
  }

  /**
   * Resolve all alerts for an agent
   */
  private async resolveAgentAlerts(agentId: string): Promise<void> {
    const resolvedCount = Array.from(this.activeAlerts.entries())
      .filter(([, alert]) => alert.agentId === agentId && !alert.resolvedAt)
      .map(([alertId, alert]) => {
        alert.resolvedAt = new Date();
        Logger.info(`✅ Agent Health Alert resolved:`, {
          alertId,
          agentName: alert.agentName,
          alertType: alert.alertType,
          duration: alert.resolvedAt.getTime() - alert.triggeredAt.getTime(),
        });
        return alertId;
      }).length;

    if (resolvedCount > 0) {
      Logger.info(`✅ Resolved ${resolvedCount} alerts for agent ${agentId}`);
    }
  }

  /**
   * Get intelligent load balancing recommendation
   */
  async getLoadBalancingRecommendation(
    requiredCapabilities: string[],
    performanceRequirements?: {
      max_response_time_ms?: number;
      min_health_score?: number;
      min_success_rate?: number;
    }
  ): Promise<LoadBalancingDecision | null> {
    try {
      const discovery = await rustAgentRegistryClient.discoverOptimalAgents(
        requiredCapabilities as any[],
        performanceRequirements
      );

      if (discovery.agents.length === 0) {
        return null;
      }

      // Apply intelligent load balancing
      const optimalAgent = this.applyIntelligentLoadBalancing(discovery.agents);
      const alternativeAgents = discovery.agents
        .filter(agent => agent.id !== optimalAgent.id)
        .slice(0, 3);

      // Calculate performance projection
      const agentMetrics = await rustAgentRegistryClient.getAgentPerformanceMetrics(
        optimalAgent.id
      );
      const performanceProjection = {
        expectedResponseTimeMs: agentMetrics.avg_response_time_ms,
        successProbability: 1.0 - agentMetrics.error_rate,
        resourceUtilization: agentMetrics.cpu_usage_percent + agentMetrics.memory_usage_mb / 1024,
      };

      return {
        recommendedAgent: optimalAgent,
        alternativeAgents,
        strategy: discovery.strategy_used as any,
        confidence: discovery.confidence,
        reasoning: discovery.reasoning,
        performanceProjection,
      };
    } catch (error) {
      Logger.error('Load balancing recommendation failed:', error);
      return null;
    }
  }

  /**
   * Apply intelligent load balancing with health awareness
   */
  private applyIntelligentLoadBalancing(agents: AgentDefinition[]): AgentDefinition {
    // Enhanced load balancing considering health history and current performance
    return agents.reduce((best, current) => {
      const bestHistory = this.healthCheckHistory.get(best.id) || [];
      const currentHistory = this.healthCheckHistory.get(current.id) || [];

      // Calculate trend scores (higher is better)
      const bestTrend = this.calculateHealthTrend(bestHistory);
      const currentTrend = this.calculateHealthTrend(currentHistory);

      // Prefer agents with better trends
      return currentTrend > bestTrend ? current : best;
    });
  }

  /**
   * Calculate health trend from history (positive = improving, negative = degrading)
   */
  private calculateHealthTrend(history: AgentMetrics[]): number {
    if (history.length < 2) return 0;

    const recent = history.slice(-5); // Last 5 checks
    const older = history.slice(-10, -5); // Previous 5 checks

    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, m) => sum + m.health_score, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.health_score, 0) / older.length;

    return recentAvg - olderAvg;
  }

  /**
   * Get comprehensive monitoring statistics
   */
  async getMonitoringStats(): Promise<MonitoringStats> {
    const agents = await rustAgentRegistryClient.listAgents();
    const healthChecks = await Promise.allSettled(
      agents.map(agent => rustAgentRegistryClient.getAgentPerformanceMetrics(agent.id))
    );

    let healthyAgents = 0;
    let degradedAgents = 0;
    let criticalAgents = 0;
    let totalHealthScore = 0;
    let totalResponseTime = 0;
    let validMetrics = 0;

    healthChecks.forEach(result => {
      if (result.status === 'fulfilled') {
        const metrics = result.value;
        validMetrics++;
        totalHealthScore += metrics.health_score;
        totalResponseTime += metrics.avg_response_time_ms;

        if (metrics.health_score >= this.HEALTH_THRESHOLDS.healthy) {
          healthyAgents++;
        } else if (metrics.health_score <= this.HEALTH_THRESHOLDS.critical) {
          criticalAgents++;
        } else {
          degradedAgents++;
        }
      }
    });

    const activeAlerts = Array.from(this.activeAlerts.values()).filter(alert => !alert.resolvedAt);
    const monitoringUptime = Date.now() - this.monitoringStartTime.getTime();

    return {
      totalAgents: agents.length,
      healthyAgents,
      degradedAgents,
      criticalAgents,
      averageHealthScore: validMetrics > 0 ? totalHealthScore / validMetrics : 0,
      averageResponseTime: validMetrics > 0 ? totalResponseTime / validMetrics : 0,
      totalAlerts: this.activeAlerts.size,
      activeAlerts: activeAlerts.length,
      monitoringUptime,
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolvedAt);
  }

  /**
   * Get agent health history
   */
  getAgentHealthHistory(agentId: string): AgentMetrics[] {
    return this.healthCheckHistory.get(agentId) || [];
  }

  /**
   * Force health check on specific agent
   */
  async forceHealthCheck(agentId: string): Promise<{ isHealthy: boolean; metrics?: AgentMetrics }> {
    const agents = await rustAgentRegistryClient.listAgents();
    const agent = agents.find(a => a.id === agentId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return this.checkAgentHealth(agent);
  }

  /**
   * Get monitoring status
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

// Export singleton instance
export const agentHealthMonitor = new AgentHealthMonitorService();
export default agentHealthMonitor;

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
  private isRegisteringAgents = false;

  constructor() {
    super();
    // Don't start background services in test mode
    if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_BACKGROUND_SERVICES !== 'true') {
      this.startMonitoring();
      // Initialize core agents in mesh immediately after first health check
      this.scheduleInitialAgentRegistration();
    }
  }

  public setAgentRegistry(agentRegistry: AgentRegistry): void {
    this.agentRegistry = agentRegistry;
    // Immediately try to initialize agents when registry is available
    this.forceAgentRegistration();
  }

  private scheduleInitialAgentRegistration(): void {
    // Wait 5 seconds after startup to ensure all services are initialized
    setTimeout(() => {
      this.forceAgentRegistration();
    }, 5000);
  }

  public async forceAgentRegistration(): Promise<void> {
    if (!this.agentRegistry) {
      log.debug('Agent registry not available for mesh registration', LogContext.AGENT);
      return;
    }

    // Skip during test environment teardown
    if (process.env.NODE_ENV === 'test' && (global as any).testTeardownInProgress) {
      log.debug('Skipping agent registration during test teardown', LogContext.AGENT);
      return;
    }

    // Prevent concurrent registration attempts
    if (this.isRegisteringAgents) {
      log.debug('Agent registration already in progress, skipping', LogContext.AGENT);
      return;
    }

    this.isRegisteringAgents = true;

    try {
      log.info('🚀 Force registering core agents in mesh...', LogContext.AGENT);
      
      // Pre-define all core agents that should be in the mesh
      const coreAgentDefinitions = [
        { name: 'r1_reasoning', capabilities: ['r1_reasoning_cycles', 'multi_step_thinking', 'dynamic_retrieval'], trustLevel: 0.9 },
        { name: 'multi_tier_router', capabilities: ['tier_routing', 'complexity_analysis', 'performance_optimization'], trustLevel: 0.9 },
        { name: 'graphrag_reasoning', capabilities: ['knowledge_graph_construction', 'graph_based_reasoning', 'entity_relationship_extraction'], trustLevel: 0.9 },
        { name: 'performance_optimization', capabilities: ['latency_optimization', 'throughput_optimization', 'bottleneck_analysis'], trustLevel: 0.8 },
        { name: 'codebase_optimizer', capabilities: ['codebase_analysis', 'code_optimization', 'performance_analysis'], trustLevel: 0.8 },
        { name: 'planner', capabilities: ['planning', 'task_decomposition', 'strategy'], trustLevel: 0.9 },
        { name: 'synthesizer', capabilities: ['synthesis', 'consensus', 'analysis'], trustLevel: 0.8 },
        { name: 'retriever', capabilities: ['information_retrieval', 'context_gathering', 'search'], trustLevel: 0.8 }
      ];

      const {a2aMesh} = await import('@/services/a2a-communication-mesh');
      
      if (!a2aMesh) {
        throw new Error('A2A communication mesh import failed - a2aMesh is undefined');
      }
      
      if (typeof a2aMesh.getAgentConnections !== 'function') {
        throw new Error('A2A communication mesh missing getAgentConnections method');
      }
      
      if (typeof a2aMesh.registerAgent !== 'function') {
        throw new Error('A2A communication mesh missing registerAgent method');
      }
      
      const existingConnections = a2aMesh.getAgentConnections();
      const registeredAgentNames = existingConnections.map(conn => conn.agentName);

      let registeredCount = 0;
      for (const agentDef of coreAgentDefinitions) {
        if (!registeredAgentNames.includes(agentDef.name)) {
          try {
            a2aMesh.registerAgent(agentDef.name, agentDef.capabilities, agentDef.trustLevel);
            registeredCount++;
            log.info(`✅ Registered core agent in mesh: ${agentDef.name}`, LogContext.AGENT, {
              capabilities: agentDef.capabilities.length,
              trustLevel: agentDef.trustLevel
            });
          } catch (error) {
            const agentErrorDetails = {
              agentName: agentDef.name,
              capabilities: agentDef.capabilities,
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            };
            log.warn(`⚠️ Failed to register core agent ${agentDef.name} in mesh`, LogContext.AGENT, { 
              error: agentErrorDetails 
            });
          }
        } else {
          log.debug(`Core agent already registered: ${agentDef.name}`, LogContext.AGENT);
        }
      }

      if (registeredCount > 0) {
        log.info(`🎉 Successfully registered ${registeredCount} core agents in mesh`, LogContext.AGENT);
        // Force a health check to update mesh health metrics
        setTimeout(() => this.performHealthCheck(), 1000);
      } else {
        log.info('All core agents already registered in mesh', LogContext.AGENT);
      }

    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : typeof error,
        code: (error as any)?.code,
        errno: (error as any)?.errno,
        path: (error as any)?.path
      };
      
      log.error('❌ Failed to force register agents in mesh', LogContext.AGENT, { 
        error: errorDetails,
        errorType: typeof error,
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : []
      });
      
      // Also try to identify specific failure causes
      if (error instanceof Error) {
        if (error.message.includes('Cannot find module') || error.message.includes('MODULE_NOT_FOUND')) {
          log.error('❌ Module import error during agent registration', LogContext.AGENT, {
            suggestion: 'Check if all required modules are properly built and accessible'
          });
        } else if (error.message.includes('registerAgent')) {
          log.error('❌ A2A mesh registration method error', LogContext.AGENT, {
            suggestion: 'Check if a2aMesh.registerAgent method is working correctly'
          });
        }
      }
    } finally {
      this.isRegisteringAgents = false;
    }
  }

  private startMonitoring(): void {
    if (this.isMonitoring) {return;}

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

      // Calculate agent and mesh health
      if (this.agentRegistry) {
        // Initialize core agents in mesh if not already done
        await this.initializeCoreAgents();

        const meshStatus = this.agentRegistry.getMeshStatus() as {
          totalAgents: number;
          onlineAgents: number;
          activeCollaborations: number;
          messagesInQueue: number;
          meshHealth: number;
        };

        // Calculate agent health based on loaded agents vs available agents
        const coreAgents = this.agentRegistry.getCoreAgents();
        const loadedAgents = await this.countLoadedAgents();
        
        // Agent health is the percentage of core agents that are loaded and functioning
        metrics.agentHealth = coreAgents.length > 0 ? loadedAgents / coreAgents.length : 0.5; // Default to 50% if no core agents
        
        // Mesh health comes directly from the mesh status
        metrics.meshHealth = meshStatus?.meshHealth || 0;
        
        // Ensure values are between 0 and 1
        metrics.agentHealth = Math.max(0, Math.min(1, metrics.agentHealth));
        metrics.meshHealth = Math.max(0, Math.min(1, metrics.meshHealth));
      } else {
        // Default values when agent registry is not available
        metrics.agentHealth = 0.2; // 20% health as system is partially functional
        metrics.meshHealth = 0.1; // 10% mesh health as no agents are connected
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
    if (recentMetrics.length === 0) {return 0;}

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

  private async initializeCoreAgents(): Promise<void> {
    // Use the centralized force registration method
    await this.forceAgentRegistration();
  }

  private async countLoadedAgents(): Promise<number> {
    if (!this.agentRegistry) {return 0;}

    try {
      const coreAgents = this.agentRegistry.getCoreAgents();
      let loadedCount = 0;

      for (const agentName of coreAgents) {
        try {
          // Check if agent can be loaded/accessed
          const agent = await this.agentRegistry.getAgent(agentName);
          if (agent) {
            loadedCount++;
          }
        } catch (error) {
          // Agent failed to load, don't count it
          log.debug(`Agent ${agentName} not loaded`, LogContext.AGENT);
        }
      }

      return loadedCount;
    } catch (error) {
      log.error('❌ Failed to count loaded agents', LogContext.SYSTEM, { error });
      return 0;
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
    if (this.activeIssues.size === 0) {return;}

    log.info('🔧 Performing self-healing actions', LogContext.SYSTEM, {
      issues: this.activeIssues.size,
    });

    for (const [issueId, issue] of this.activeIssues) {
      if (!issue.autoFixable) {continue;}

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
    // Use intelligent memory manager instead of manual GC
    try {
      const { intelligentMemoryManager } = await import('./intelligent-memory-manager');
      await intelligentMemoryManager.forceOptimization();
      log.info('🔧 Intelligent memory optimization completed', LogContext.SYSTEM);
    } catch (error) {
      log.warn('⚠️ Intelligent memory manager not available, using fallback', LogContext.SYSTEM);
      
      // Fallback to basic cleanup only
      // Unload idle agents
      if (this.agentRegistry) {
        await this.agentRegistry.unloadIdleAgents(15); // 15 minutes
      }

      // Clear old health history
      if (this.healthHistory.length > 50) {
        this.healthHistory = this.healthHistory.slice(-50);
      }
    }

    // Best-effort nudge to LFM2 services to restart if exists
    try {
      // Try new process manager first
      const { lfm2ProcessManager } = await import('@/services/lfm2-process-manager');
      const latest = this.healthHistory.slice(-2);
      
      if (latest.length === 2 && latest.every((m) => m.memoryUsage > 0.85)) {
        if (lfm2ProcessManager.isRunning()) {
          log.info('🔄 Restarting LFM2 process manager due to sustained high memory', LogContext.AI);
          await lfm2ProcessManager.restart();
        }
      }
    } catch {
      // Fallback to old bridge service
      try {
        const { lfm2Bridge } = await import('@/services/lfm2-bridge');
        const latest = this.healthHistory.slice(-2);
        if (latest.length === 2 && latest.every((m) => m.memoryUsage > 0.85)) {
          await (lfm2Bridge as any).restart?.();
          log.info('🔄 Requested LFM2 bridge restart due to sustained high memory', LogContext.AI);
        }
      } catch {
        // ignore in dev
      }
    }
  }

  private async healAgentHealth(): Promise<void> {
    if (!this.agentRegistry) {return;}

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

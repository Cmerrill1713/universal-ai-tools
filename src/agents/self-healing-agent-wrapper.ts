/**
 * Self-Healing Agent Wrapper
 * Wraps agents with automatic failure recovery and optimization
 */

import { EventEmitter } from 'events';

import { healthMonitor } from '@/services/health-monitor-service';
import { log,LogContext } from '@/utils/logger';

import type { BaseAgent } from './base-agent';
import type { EnhancedBaseAgent } from './enhanced-base-agent';

export interface AgentFailure {
  agentName: string;
  error: Error;
  timestamp: Date;
  context?: unknown;
  retryCount: number;
}

export interface RecoveryStrategy {
  name: string;
  canRecover: (failure: AgentFailure) => boolean;
  recover: (agent: BaseAgent | EnhancedBaseAgent, failure: AgentFailure) => Promise<void>;
  priority: number;
}

export class SelfHealingAgentWrapper extends EventEmitter {
  private wrappedAgent: BaseAgent | EnhancedBaseAgent;
  private failures: AgentFailure[] = [];
  private recoveryStrategies: RecoveryStrategy[] = [];
  private maxRetries = 3;
  private recoveryTimeout = 30000; // 30 seconds
  private isRecovering = false;

  constructor(agent: BaseAgent | EnhancedBaseAgent) {
    super();
    this.wrappedAgent = agent;
    this.setupRecoveryStrategies();
    this.setupAgentMonitoring();
  }

  private setupRecoveryStrategies(): void {
    // Strategy 1: Simple restart
    this.recoveryStrategies.push({
      name: 'restart',
      priority: 1,
      canRecover: (failure) => failure.retryCount < this.maxRetries,
      recover: async (agent, failure) => {
        log.info(`🔄 Restarting agent: ${failure.agentName}`, LogContext.AGENT);
        await agent.initialize();
      },
    });

    // Strategy 2: Memory cleanup
    this.recoveryStrategies.push({
      name: 'memory_cleanup',
      priority: 2,
      canRecover: (failure) =>
        failure.error.message.includes('memory') ||
        failure.error.message.includes('heap') ||
        failure.retryCount < 2,
      recover: async (agent, failure) => {
        log.info(`🧹 Cleaning up memory for agent: ${failure.agentName}`, LogContext.AGENT);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Clear agent memory if method exists
        if ('clearMemory' in agent && typeof agent.clearMemory === 'function') {
          await (agent as any).clearMemory();
        }

        await agent.initialize();
      },
    });

    // Strategy 3: Configuration reset
    this.recoveryStrategies.push({
      name: 'config_reset',
      priority: 3,
      canRecover: (failure) =>
        failure.error.message.includes('config') ||
        failure.error.message.includes('invalid') ||
        failure.retryCount < 2,
      recover: async (agent, failure) => {
        log.info(`⚙️ Resetting configuration for agent: ${failure.agentName}`, LogContext.AGENT);

        // Reset to default configuration if method exists
        if ('resetConfig' in agent && typeof agent.resetConfig === 'function') {
          await (agent as any).resetConfig();
        }

        await agent.initialize();
      },
    });

    // Strategy 4: Graceful degradation
    this.recoveryStrategies.push({
      name: 'graceful_degradation',
      priority: 4,
      canRecover: () => true, // Always can try graceful degradation
      recover: async (agent, failure) => {
        log.info(
          `📉 Applying graceful degradation for agent: ${failure.agentName}`,
          LogContext.AGENT
        );

        // Reduce agent capabilities if method exists
        if ('degradeGracefully' in agent && typeof agent.degradeGracefully === 'function') {
          await (agent as any).degradeGracefully();
        }

        await agent.initialize();
      },
    });
  }

  private setupAgentMonitoring(): void {
    // Monitor agent execution for failures
    const originalExecute = this.wrappedAgent.execute.bind(this.wrappedAgent);

    this.wrappedAgent.execute = async (context: any) => {
      try {
        const startTime = Date.now();
        const result = await originalExecute(context);
        const executionTime = Date.now() - startTime;

        // Report successful execution
        this.emit('execution_success', {
          agentName: (this.wrappedAgent as any).name || 'unknown',
          executionTime,
          context,
        });

        return result;
      } catch (error) {
        const failure: AgentFailure = {
          agentName: (this.wrappedAgent as any).name || 'unknown',
          error: error as Error,
          timestamp: new Date(),
          context,
          retryCount: this.getFailureCount(error as Error),
        };

        this.failures.push(failure);
        this.emit('execution_failure', failure);

        // Attempt recovery
        const recovered = await this.attemptRecovery(failure);

        if (recovered) {
          // Retry execution after recovery
          return await this.wrappedAgent.execute(context);
        } else {
          // Recovery failed, propagate error
          throw error;
        }
      }
    };
  }

  private getFailureCount(error: Error): number {
    // Count recent failures with similar error messages
    const recentFailures = this.failures.filter(
      (f) =>
        Date.now() - f.timestamp.getTime() < 300000 && // Last 5 minutes
        f.error.message === error.message
    );

    return recentFailures.length;
  }

  private async attemptRecovery(failure: AgentFailure): Promise<boolean> {
    if (this.isRecovering) {
      log.warn(`Recovery already in progress for ${failure.agentName}`, LogContext.AGENT);
      return false;
    }

    this.isRecovering = true;

    try {
      log.info(`🚑 Attempting recovery for agent: ${failure.agentName}`, LogContext.AGENT, {
        error: failure.error.message,
        retryCount: failure.retryCount,
      });

      // Sort strategies by priority
      const sortedStrategies = this.recoveryStrategies
        .filter((strategy) => strategy.canRecover(failure))
        .sort((a, b) => a.priority - b.priority);

      for (const strategy of sortedStrategies) {
        try {
          log.info(`Trying recovery strategy: ${strategy.name}`, LogContext.AGENT);

          const recoveryPromise = strategy.recover(this.wrappedAgent, failure);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Recovery timeout')), this.recoveryTimeout)
          );

          await Promise.race([recoveryPromise, timeoutPromise]);

          log.info(`✅ Recovery successful using strategy: ${strategy.name}`, LogContext.AGENT);

          this.emit('recovery_success', {
            agentName: failure.agentName,
            strategy: strategy.name,
            failure,
          });

          return true;
        } catch (recoveryError) {
          log.warn(`Recovery strategy ${strategy.name} failed:`, LogContext.AGENT, {
            error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          });

          continue; // Try next strategy
        }
      }

      log.error(
        `❌ All recovery strategies failed for agent: ${failure.agentName}`,
        LogContext.AGENT
      );

      this.emit('recovery_failed', {
        agentName: failure.agentName,
        failure,
        strategiesAttempted: sortedStrategies.map((s) => s.name),
      });

      return false;
    } finally {
      this.isRecovering = false;
    }
  }

  // Proxy all other agent methods
  public get name(): string {
    return (this.wrappedAgent as any).name || 'wrapped-agent';
  }

  public async initialize(): Promise<void> {
    return await this.wrappedAgent.initialize();
  }

  public async shutdown(): Promise<void> {
    this.removeAllListeners();
    return await this.wrappedAgent.shutdown();
  }

  // Health monitoring integration
  public getHealthMetrics(): {
    totalFailures: number;
    recentFailures: number;
    recoveryRate: number;
    isHealthy: boolean;
  } {
    const now = Date.now();
    const recentFailures = this.failures.filter((f) => now - f.timestamp.getTime() < 300000); // Last 5 minutes
    const totalFailures = this.failures.length;
    const recoveryRate =
      totalFailures > 0 ? (totalFailures - recentFailures.length) / totalFailures : 1;

    return {
      totalFailures,
      recentFailures: recentFailures.length,
      recoveryRate,
      isHealthy: recentFailures.length < 3 && recoveryRate > 0.7,
    };
  }

  public getFailureHistory(): AgentFailure[] {
    return [...this.failures];
  }

  public clearFailureHistory(): void {
    this.failures = [];
  }

  // Add custom recovery strategy
  public addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
  }

  // Configuration
  public setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  public setRecoveryTimeout(timeout: number): void {
    this.recoveryTimeout = timeout;
  }
}

// Factory function to wrap agents with self-healing
export function wrapAgentWithSelfHealing(
  agent: BaseAgent | EnhancedBaseAgent
): SelfHealingAgentWrapper {
  const wrapper = new SelfHealingAgentWrapper(agent);

  // Connect to health monitor
  wrapper.on('execution_failure', (failure) => {
    log.warn(`Agent failure detected: ${failure.agentName}`, LogContext.AGENT, {
      error: failure.error.message,
      retryCount: failure.retryCount,
    });
  });

  wrapper.on('recovery_success', (event) => {
    log.info(`Agent recovery successful: ${event.agentName}`, LogContext.AGENT, {
      strategy: event.strategy,
    });
  });

  wrapper.on('recovery_failed', (event) => {
    log.error(`Agent recovery failed: ${event.agentName}`, LogContext.AGENT, {
      strategiesAttempted: event.strategiesAttempted,
    });

    // Report to health monitor
    healthMonitor.emit('agent_recovery_failed', event);
  });

  return wrapper;
}

export default SelfHealingAgentWrapper;

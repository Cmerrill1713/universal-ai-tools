import { EventEmitter } from 'events';
import { healthMonitor } from '@/services/health-monitor-service';
import { log, LogContext } from '@/utils/logger';
export class SelfHealingAgentWrapper extends EventEmitter {
    wrappedAgent;
    failures = [];
    recoveryStrategies = [];
    maxRetries = 3;
    recoveryTimeout = 30000;
    isRecovering = false;
    constructor(agent) {
        super();
        this.wrappedAgent = agent;
        this.setupRecoveryStrategies();
        this.setupAgentMonitoring();
    }
    setupRecoveryStrategies() {
        this.recoveryStrategies.push({
            name: 'restart',
            priority: 1,
            canRecover: (failure) => failure.retryCount < this.maxRetries,
            recover: async (agent, failure) => {
                log.info(`🔄 Restarting agent: ${failure.agentName}`, LogContext.AGENT);
                await agent.initialize();
            },
        });
        this.recoveryStrategies.push({
            name: 'memory_cleanup',
            priority: 2,
            canRecover: (failure) => failure.error.message.includes('memory') ||
                failure.error.message.includes('heap') ||
                failure.retryCount < 2,
            recover: async (agent, failure) => {
                log.info(`🧹 Cleaning up memory for agent: ${failure.agentName}`, LogContext.AGENT);
                if (global.gc) {
                    global.gc();
                }
                if ('clearMemory' in agent && typeof agent.clearMemory === 'function') {
                    await agent.clearMemory();
                }
                await agent.initialize();
            },
        });
        this.recoveryStrategies.push({
            name: 'config_reset',
            priority: 3,
            canRecover: (failure) => failure.error.message.includes('config') ||
                failure.error.message.includes('invalid') ||
                failure.retryCount < 2,
            recover: async (agent, failure) => {
                log.info(`⚙️ Resetting configuration for agent: ${failure.agentName}`, LogContext.AGENT);
                if ('resetConfig' in agent && typeof agent.resetConfig === 'function') {
                    await agent.resetConfig();
                }
                await agent.initialize();
            },
        });
        this.recoveryStrategies.push({
            name: 'graceful_degradation',
            priority: 4,
            canRecover: () => true,
            recover: async (agent, failure) => {
                log.info(`📉 Applying graceful degradation for agent: ${failure.agentName}`, LogContext.AGENT);
                if ('degradeGracefully' in agent && typeof agent.degradeGracefully === 'function') {
                    await agent.degradeGracefully();
                }
                await agent.initialize();
            },
        });
    }
    setupAgentMonitoring() {
        const originalExecute = this.wrappedAgent.execute.bind(this.wrappedAgent);
        this.wrappedAgent.execute = async (context) => {
            try {
                const startTime = Date.now();
                const result = await originalExecute(context);
                const executionTime = Date.now() - startTime;
                this.emit('execution_success', {
                    agentName: this.wrappedAgent.name || 'unknown',
                    executionTime,
                    context,
                });
                return result;
            }
            catch (error) {
                const failure = {
                    agentName: this.wrappedAgent.name || 'unknown',
                    error: error,
                    timestamp: new Date(),
                    context,
                    retryCount: this.getFailureCount(error),
                };
                this.failures.push(failure);
                this.emit('execution_failure', failure);
                const recovered = await this.attemptRecovery(failure);
                if (recovered) {
                    return await this.wrappedAgent.execute(context);
                }
                else {
                    throw error;
                }
            }
        };
    }
    getFailureCount(error) {
        const recentFailures = this.failures.filter((f) => Date.now() - f.timestamp.getTime() < 300000 &&
            f.error.message === error.message);
        return recentFailures.length;
    }
    async attemptRecovery(failure) {
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
            const sortedStrategies = this.recoveryStrategies
                .filter((strategy) => strategy.canRecover(failure))
                .sort((a, b) => a.priority - b.priority);
            for (const strategy of sortedStrategies) {
                try {
                    log.info(`Trying recovery strategy: ${strategy.name}`, LogContext.AGENT);
                    const recoveryPromise = strategy.recover(this.wrappedAgent, failure);
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Recovery timeout')), this.recoveryTimeout));
                    await Promise.race([recoveryPromise, timeoutPromise]);
                    log.info(`✅ Recovery successful using strategy: ${strategy.name}`, LogContext.AGENT);
                    this.emit('recovery_success', {
                        agentName: failure.agentName,
                        strategy: strategy.name,
                        failure,
                    });
                    return true;
                }
                catch (recoveryError) {
                    log.warn(`Recovery strategy ${strategy.name} failed:`, LogContext.AGENT, {
                        error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
                    });
                    continue;
                }
            }
            log.error(`❌ All recovery strategies failed for agent: ${failure.agentName}`, LogContext.AGENT);
            this.emit('recovery_failed', {
                agentName: failure.agentName,
                failure,
                strategiesAttempted: sortedStrategies.map((s) => s.name),
            });
            return false;
        }
        finally {
            this.isRecovering = false;
        }
    }
    get name() {
        return this.wrappedAgent.name || 'wrapped-agent';
    }
    async initialize() {
        return await this.wrappedAgent.initialize();
    }
    async shutdown() {
        this.removeAllListeners();
        return await this.wrappedAgent.shutdown();
    }
    getHealthMetrics() {
        const now = Date.now();
        const recentFailures = this.failures.filter((f) => now - f.timestamp.getTime() < 300000);
        const totalFailures = this.failures.length;
        const recoveryRate = totalFailures > 0 ? (totalFailures - recentFailures.length) / totalFailures : 1;
        return {
            totalFailures,
            recentFailures: recentFailures.length,
            recoveryRate,
            isHealthy: recentFailures.length < 3 && recoveryRate > 0.7,
        };
    }
    getFailureHistory() {
        return [...this.failures];
    }
    clearFailureHistory() {
        this.failures = [];
    }
    addRecoveryStrategy(strategy) {
        this.recoveryStrategies.push(strategy);
        this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
    }
    setMaxRetries(maxRetries) {
        this.maxRetries = maxRetries;
    }
    setRecoveryTimeout(timeout) {
        this.recoveryTimeout = timeout;
    }
}
export function wrapAgentWithSelfHealing(agent) {
    const wrapper = new SelfHealingAgentWrapper(agent);
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
        healthMonitor.emit('agent_recovery_failed', event);
    });
    return wrapper;
}
export default SelfHealingAgentWrapper;
//# sourceMappingURL=self-healing-agent-wrapper.js.map
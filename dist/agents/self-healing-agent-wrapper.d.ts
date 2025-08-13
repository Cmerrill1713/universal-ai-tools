import { EventEmitter } from 'events';
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
export declare class SelfHealingAgentWrapper extends EventEmitter {
    private wrappedAgent;
    private failures;
    private recoveryStrategies;
    private maxRetries;
    private recoveryTimeout;
    private isRecovering;
    constructor(agent: BaseAgent | EnhancedBaseAgent);
    private setupRecoveryStrategies;
    private setupAgentMonitoring;
    private getFailureCount;
    private attemptRecovery;
    get name(): string;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    getHealthMetrics(): {
        totalFailures: number;
        recentFailures: number;
        recoveryRate: number;
        isHealthy: boolean;
    };
    getFailureHistory(): AgentFailure[];
    clearFailureHistory(): void;
    addRecoveryStrategy(strategy: RecoveryStrategy): void;
    setMaxRetries(maxRetries: number): void;
    setRecoveryTimeout(timeout: number): void;
}
export declare function wrapAgentWithSelfHealing(agent: BaseAgent | EnhancedBaseAgent): SelfHealingAgentWrapper;
export default SelfHealingAgentWrapper;
//# sourceMappingURL=self-healing-agent-wrapper.d.ts.map
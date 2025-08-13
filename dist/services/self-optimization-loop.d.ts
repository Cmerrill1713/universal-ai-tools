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
    type: 'memory_cleanup' | 'agent_restart' | 'cache_clear' | 'connection_reset' | 'performance_tune';
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
declare class SelfOptimizationLoop {
    private isRunning;
    private optimizationInterval;
    private metricsHistory;
    private actionHistory;
    private lastOptimization;
    private optimizationThreshold;
    private mode;
    private watcher;
    private watchedPaths;
    constructor();
    start(options?: {
        mode?: OptimizationMode;
        intervalMs?: number;
    }): void;
    stop(): void;
    runOnce(): Promise<void>;
    enableEventWatching(paths: string[]): void;
    disableEventWatching(): void;
    private runOptimizationCycle;
    private collectMetrics;
    private calculateHealthScore;
    private identifyIssues;
    private generateOptimizationActions;
    private calculateImprovementPotential;
    private executeAction;
    private performMemoryCleanup;
    private restartUnhealthyAgents;
    private clearCaches;
    private resetConnections;
    private tunePerformance;
    getStats(): {
        isRunning: boolean;
        metricsHistory: OptimizationMetrics[];
        actionHistory: OptimizationResult[];
        lastOptimization: number;
        healthScore: number;
    };
    getRecentActions(limit?: number): OptimizationResult[];
    getHealthTrends(): {
        cpuTrend: number[];
        memoryTrend: number[];
        responseTimeTrend: number[];
        errorRateTrend: number[];
    };
}
export declare const selfOptimizationLoop: SelfOptimizationLoop;
export {};
//# sourceMappingURL=self-optimization-loop.d.ts.map
import { EventEmitter } from 'events';
export interface AutoPilotConfig {
    enabled: boolean;
    autoLearnThreshold: number;
    batchSize: number;
    learningInterval: number;
    performanceThreshold: number;
    fallbackAfterFailures: number;
    autoOptimizeParameters: boolean;
    monitoringEnabled: boolean;
}
export interface AutoPilotMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    averageConfidence: number;
    learningCycles: number;
    parameterOptimizations: number;
}
export interface AutoPilotTask {
    id: string;
    userRequest: string;
    context: Record<string, any>;
    priority: number;
    timestamp: number;
    retries: number;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    type?: string;
}
export declare class ABMCTSAutoPilot extends EventEmitter {
    private config;
    private orchestrator;
    private isRunning;
    private taskQueue;
    private processingTasks;
    private metrics;
    private learningTimer;
    private recentResults;
    constructor(config?: Partial<AutoPilotConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    submitTask(userRequest: string, context?: Record<string, any>, priority?: number): Promise<string>;
    private processLoop;
    private processBatch;
    private processTask;
    private generateAutoFeedback;
    private performLearningCycle;
    private analyzePerformance;
    private optimizeParameters;
    private handleFailedTask;
    private executeFallback;
    private getBatch;
    private startMonitoring;
    private updateMetrics;
    private calculateDistribution;
    private calculateTrends;
    private waitForTaskCompletion;
    private sleep;
    getMetrics(): AutoPilotMetrics;
    getQueueStatus(): unknown;
    isActive(): boolean;
}
export declare const abMCTSAutoPilot: ABMCTSAutoPilot;
export default abMCTSAutoPilot;
//# sourceMappingURL=ab-mcts-auto-pilot.d.ts.map
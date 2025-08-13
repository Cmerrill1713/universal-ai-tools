import { EventEmitter } from 'events';
import type { ABMCTSFeedback } from '../types/ab-mcts';
export interface FeedbackMetrics {
    totalFeedbacks: number;
    averageReward: number;
    successRate: number;
    averageExecutionTime: number;
    errorRate: number;
    userSatisfaction: number;
}
export interface FeedbackAggregation {
    agentName: string;
    taskType: string;
    count: number;
    metrics: FeedbackMetrics;
    trend: 'improving' | 'stable' | 'declining';
}
export interface FeedbackCollectorConfig {
    batchSize: number;
    flushInterval: number;
    retentionPeriod: number;
    enableRealTimeProcessing: boolean;
    enableAggregation: boolean;
    qualityThreshold: number;
}
export declare class FeedbackCollectorService extends EventEmitter {
    private config;
    private feedbackQueue;
    private feedbackHistory;
    private aggregations;
    private flushTimer?;
    private isProcessing;
    constructor(config?: Partial<FeedbackCollectorConfig>);
    collectFeedback(feedback: ABMCTSFeedback): Promise<void>;
    private setupHealthMonitorIntegration;
    private processBatch;
    private processSingleFeedback;
    private updateAggregations;
    private detectAnomalies;
    private startFlushTimer;
    private cleanOldFeedback;
    getMetrics(): Promise<{
        queueSize: number;
        totalProcessed: number;
        aggregations: FeedbackAggregation[];
        recentFeedbacks: ABMCTSFeedback[];
    }>;
    getAggregatedMetrics(agentName: string, taskType: string): Promise<FeedbackAggregation | null>;
    getRecentFeedback(limit?: number, minTimestamp?: number): Promise<ABMCTSFeedback[]>;
    generateReport(): Promise<{
        summary: {
            totalFeedbacks: number;
            averageQuality: number;
            topPerformers: string[];
            needsImprovement: string[];
        };
        byAgent: Record<string, FeedbackMetrics>;
        byTaskType: Record<string, FeedbackMetrics>;
        recommendations: string[];
    }>;
    private extractAgentName;
    private calculateAverageReward;
    private calculateTrend;
    private generateRecommendations;
    private getHealthMetrics;
    private createSystemHealthFeedback;
    shutdown(): void;
}
export declare const feedbackCollector: FeedbackCollectorService;
export default feedbackCollector;
//# sourceMappingURL=feedback-collector.d.ts.map
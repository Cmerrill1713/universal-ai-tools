import { TaskType } from '@/types';
import type { TaskParameters } from './intelligent-parameter-service';
export interface ParameterExecution {
    id: string;
    taskType: TaskType;
    userInput: string;
    parameters: TaskParameters;
    model: string;
    provider: string;
    userId?: string;
    requestId: string;
    timestamp: Date;
    executionTime: number;
    tokenUsage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    responseLength: number;
    responseQuality?: number;
    userSatisfaction?: number;
    success: boolean;
    errorType?: string;
    retryCount: number;
    complexity: 'simple' | 'medium' | 'complex';
    domain?: string;
    endpoint: string;
}
export interface ParameterEffectiveness {
    taskType: TaskType;
    parameterSet: string;
    parameters: Partial<TaskParameters>;
    totalExecutions: number;
    successRate: number;
    avgExecutionTime: number;
    avgTokenUsage: number;
    avgResponseQuality: number;
    avgUserSatisfaction: number;
    qualityTrend: number;
    speedTrend: number;
    costEfficiencyTrend: number;
    lastUpdated: Date;
    confidenceScore: number;
}
export interface OptimizationInsight {
    taskType: TaskType;
    insight: string;
    recommendation: string;
    impact: 'high' | 'medium' | 'low';
    confidence: number;
    supportingData: {
        sampleSize: number;
        improvementPercent: number;
        currentMetric: number;
        optimizedMetric: number;
    };
}
export declare class ParameterAnalyticsService {
    private supabase;
    private executionBuffer;
    private bufferSize;
    private flushInterval;
    private effectivenessCache;
    private cacheExpiryTime;
    constructor();
    private initializeSupabase;
    recordExecution(execution: Omit<ParameterExecution, 'id' | 'timestamp'>): Promise<void>;
    getParameterEffectiveness(taskType: TaskType, timeRange?: {
        start: Date;
        end: Date;
    }): Promise<ParameterEffectiveness[]>;
    getOptimizationInsights(taskType?: TaskType): Promise<OptimizationInsight[]>;
    getDashboardMetrics(): Promise<{
        totalExecutions: number;
        successRate: number;
        avgResponseTime: number;
        topPerformingTasks: Array<{
            taskType: TaskType;
            score: number;
        }>;
        recentInsights: OptimizationInsight[];
        parameterTrends: Array<{
            taskType: TaskType;
            trend: 'improving' | 'declining' | 'stable';
        }>;
    }>;
    getRecentPerformance(minutes: number): Promise<any[]>;
    recordUserFeedback(executionId: string, satisfaction: number, qualityRating: number, feedback?: string): Promise<void>;
    getParameterRecommendations(taskType: TaskType, context: {
        complexity?: 'simple' | 'medium' | 'complex';
        domain?: string;
        model?: string;
    }): Promise<{
        recommended: Partial<TaskParameters>;
        confidence: number;
        reasoning: string;
        alternativeOptions: Array<{
            parameters: Partial<TaskParameters>;
            expectedPerformance: number;
            tradeoffs: string;
        }>;
    }>;
    private flushExecutionBuffer;
    private updateEffectivenessCache;
    private aggregateEffectiveness;
    private generateInsights;
    private calculatePerformanceScore;
    private calculateTrend;
    private getNestedValue;
    private generateExecutionId;
    private hashParameters;
    private startPeriodicFlush;
    private getEmptyDashboard;
    private calculateTopPerformingTasks;
    private calculateParameterTrends;
    private getTokenRangeForComplexity;
    private getDefaultRecommendations;
    private generateRecommendationReasoning;
    private generateTradeoffAnalysis;
    private generateParameterRecommendation;
}
export declare const parameterAnalyticsService: ParameterAnalyticsService;
export default parameterAnalyticsService;
//# sourceMappingURL=parameter-analytics-service.d.ts.map
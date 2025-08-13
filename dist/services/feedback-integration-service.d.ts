import { TaskType } from '@/types';
import type { TaskParameters } from './intelligent-parameter-service';
export interface UserFeedback {
    id: string;
    userId?: string;
    sessionId: string;
    executionId: string;
    taskType: TaskType;
    parameters: TaskParameters;
    qualityRating: number;
    speedRating: number;
    accuracyRating: number;
    usefulnessRating: number;
    overallSatisfaction: number;
    textualFeedback?: string;
    improvesSuggestions?: string[];
    preferredParameters?: Partial<TaskParameters>;
    userIntent: string;
    responseLength: number;
    expectedOutcome: string;
    metExpectations: boolean;
    timestamp: Date;
    responseTime: number;
    modelUsed: string;
    endpoint: string;
    userAgent?: string;
    wouldUseAgain: boolean;
    recommendToOthers: number;
    flaggedAsIncorrect: boolean;
    reportedIssues: string[];
}
export interface FeedbackAggregation {
    taskType: TaskType;
    parameterSet: string;
    totalFeedbacks: number;
    avgQualityRating: number;
    avgSpeedRating: number;
    avgAccuracyRating: number;
    avgUsefulnessRating: number;
    avgOverallSatisfaction: number;
    avgNPS: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    commonIssues: Array<{
        issue: string;
        frequency: number;
    }>;
    improvementSuggestions: Array<{
        suggestion: string;
        votes: number;
    }>;
    correlationWithSpeed: number;
    correlationWithAccuracy: number;
    feedbackReliability: number;
    sampleSize: number;
    lastUpdated: Date;
}
export interface FeedbackInsight {
    type: 'parameter_adjustment' | 'feature_request' | 'bug_report' | 'improvement_opportunity';
    priority: 'critical' | 'high' | 'medium' | 'low';
    taskType?: TaskType;
    insight: string;
    recommendation: string;
    impact: string;
    confidence: number;
    supportingFeedbacks: string[];
    affectedUsers: number;
    estimatedImprovement: number;
    actionItems: Array<{
        action: string;
        owner: string;
        estimatedEffort: 'low' | 'medium' | 'high';
        timeline: string;
    }>;
    metrics: {
        feedbackVolume: number;
        severityScore: number;
        urgencyScore: number;
    };
}
export interface LearningSignal {
    source: 'user_feedback' | 'performance_metrics' | 'error_analysis' | 'usage_patterns';
    signal: string;
    strength: number;
    taskType: TaskType;
    parameterAffected: string;
    recommendedAction: 'increase' | 'decrease' | 'maintain' | 'experiment';
    evidence: unknown[];
}
export declare class FeedbackIntegrationService {
    private supabase;
    private feedbackBuffer;
    private bufferSize;
    private flushInterval;
    private aggregationCache;
    private learningSignals;
    constructor();
    private initializeSupabase;
    collectFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): Promise<string>;
    getFeedbackAggregation(taskType: TaskType): Promise<FeedbackAggregation | null>;
    generateFeedbackInsights(): Promise<FeedbackInsight[]>;
    getLearningSignals(taskType?: TaskType): LearningSignal[];
    applyFeedbackLearning(): Promise<{
        appliedInsights: number;
        parameterAdjustments: number;
        learningSignalsProcessed: number;
        autonomousActionsQueued: number;
    }>;
    getFeedbackDashboard(): Promise<{
        totalFeedbacks: number;
        averageSatisfaction: number;
        feedbackTrends: Array<{
            date: string;
            satisfaction: number;
            volume: number;
        }>;
        topIssues: Array<{
            issue: string;
            frequency: number;
        }>;
        improvementSuggestions: Array<{
            suggestion: string;
            votes: number;
        }>;
        learningSignalsActive: number;
        recentInsights: FeedbackInsight[];
    }>;
    private extractLearningSignals;
    private triggerImmediateLearning;
    private flushFeedbackBuffer;
    private calculateFeedbackAggregation;
    private calculateAverage;
    private calculateOverallSentiment;
    private extractCommonIssues;
    private extractImprovementSuggestions;
    private extractTopIssues;
    private calculateCorrelation;
    private calculateFeedbackTrends;
    private groupFeedbackByIssues;
    private createInsightFromIssue;
    private analyzeParameterPerformanceCorrelations;
    private applyParameterLearning;
    private processLearningSignal;
    private generateFeedbackId;
    private queueAutonomousAction;
    private queueLearningSignalAction;
    private generateImprovementInsights;
    private mapPriorityToRisk;
    private estimateExecutionDuration;
    private startPeriodicProcessing;
}
export declare const feedbackIntegrationService: FeedbackIntegrationService;
export default feedbackIntegrationService;
//# sourceMappingURL=feedback-integration-service.d.ts.map
import { EventEmitter } from 'events';
interface UserFeedback {
    id?: string;
    userId: string;
    sessionId: string;
    timestamp: Date;
    feedbackType: 'rating' | 'suggestion' | 'bug_report' | 'feature_request' | 'general';
    category: 'model_performance' | 'user_interface' | 'speed' | 'accuracy' | 'usability' | 'other';
    rating?: number;
    title?: string;
    description: string;
    context?: FeedbackContext;
    sentiment?: 'positive' | 'negative' | 'neutral';
    priority?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'dismissed';
    tags?: string[];
    modelId?: string;
    providerId?: string;
    responseTime?: number;
    attachments?: FeedbackAttachment[];
}
interface FeedbackContext {
    modelUsed?: string;
    taskType?: string;
    promptLength?: number;
    responseLength?: number;
    responseTime?: number;
    userAgent?: string;
    platform?: string;
    previousInteractions?: number;
    sessionDuration?: number;
    errorOccurred?: boolean;
    featureUsed?: string;
}
interface FeedbackAttachment {
    type: 'screenshot' | 'log' | 'file';
    filename: string;
    content: string;
    size: number;
    mimeType?: string;
}
interface FeedbackAnalytics {
    totalFeedback: number;
    averageRating: number;
    sentimentDistribution: Record<string, number>;
    categoryBreakdown: Record<string, number>;
    priorityDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
    trendData: FeedbackTrend[];
    topIssues: FeedbackIssue[];
    improvementSuggestions: ImprovementSuggestion[];
}
interface FeedbackTrend {
    period: string;
    totalFeedback: number;
    averageRating: number;
    sentiment: Record<string, number>;
}
interface FeedbackIssue {
    description: string;
    frequency: number;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedUsers: number;
    suggestedActions: string[];
}
interface ImprovementSuggestion {
    type: 'performance' | 'feature' | 'ui' | 'documentation';
    description: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    priority: number;
    relatedFeedback: string[];
}
interface FeedbackCollectionConfig {
    enableSentimentAnalysis: boolean;
    enableAutomaticCategorization: boolean;
    enablePriorityAssignment: boolean;
    enableImprovementSuggestions: boolean;
    maxAttachmentSize: number;
    feedbackRetentionDays: number;
    analyticsAggregationInterval: number;
}
declare class FeedbackCollectionService extends EventEmitter {
    private readonly config;
    private readonly feedbackBuffer;
    private readonly analytics;
    private isInitialized;
    private readonly BUFFER_SIZE;
    private readonly BATCH_PROCESSING_INTERVAL;
    private processingTimer?;
    constructor();
    initialize(): Promise<void>;
    private startBatchProcessing;
    private startAnalyticsAggregation;
    collectFeedback(feedback: UserFeedback): Promise<string>;
    private processFeedbackImmediate;
    private analyzeSentiment;
    private categorizeFeedback;
    private assignPriority;
    private validateAttachments;
    private isValidBase64;
    getFeedbackAnalytics(userId?: string, timeRange?: {
        start: Date;
        end: Date;
    }): Promise<FeedbackAnalytics>;
    private calculateAnalytics;
    private generateTrendData;
    private identifyTopIssues;
    private extractIssueKey;
    private calculateIssueSeverity;
    private generateActionSuggestions;
    private initializeFeedbackTables;
    private storeFeedback;
    private generateFeedbackId;
    private getDefaultAnalytics;
    private loadAnalytics;
    private aggregateAnalytics;
    private processBatchedFeedback;
    private updateAnalytics;
    private triggerCriticalAlert;
    private generateImprovementSuggestions;
    private generateImprovementSuggestionsFromData;
    submitFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): Promise<string>;
    getFeedbackHistory(userId: string, limit?: number): Promise<UserFeedback[]>;
    updateFeedbackStatus(feedbackId: string, status: 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'dismissed'): Promise<void>;
    getTopIssues(limit?: number): Promise<FeedbackIssue[]>;
    getImprovementSuggestions(limit?: number): Promise<ImprovementSuggestion[]>;
    shutdown(): Promise<void>;
}
export declare const feedbackCollectionService: FeedbackCollectionService;
export type { FeedbackAnalytics, FeedbackAttachment, FeedbackCollectionConfig, FeedbackContext, FeedbackIssue, FeedbackTrend, ImprovementSuggestion, UserFeedback, };
//# sourceMappingURL=feedback-collection-service.d.ts.map
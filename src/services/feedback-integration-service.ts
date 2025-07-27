/**
 * Feedback Integration Service
 * Implements closed-loop learning by collecting user feedback and integrating it
 * with parameter optimization for continuous improvement
 */

import { LogContext, log } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import type { TaskParameters } from './intelligent-parameter-service';
import { TaskType } from './intelligent-parameter-service';
import { parameterAnalyticsService } from './parameter-analytics-service';
import { mlParameterOptimizer } from './ml-parameter-optimizer';
import { TWO } from '../utils/common-constants';

export interface UserFeedback {
  id: string;
  userId?: string;
  sessionId: string;
  executionId: string;
  taskType: TaskType;
  parameters: TaskParameters;

  // Feedback Ratings (1-5 scale)
  qualityRating: number;
  speedRating: number;
  accuracyRating: number;
  usefulnessRating: number;
  overallSatisfaction: number;

  // Detailed Feedback
  textualFeedback?: string;
  improvesSuggestions?: string[];
  preferredParameters?: Partial<TaskParameters>;

  // Context
  userIntent: string;
  responseLength: number;
  expectedOutcome: string;
  metExpectations: boolean;

  // Metadata
  timestamp: Date;
  responseTime: number;
  modelUsed: string;
  endpoint: string;
  userAgent?: string;

  // Learning Signals
  wouldUseAgain: boolean;
  recommendToOthers: number; // 1-10 NPS score
  flaggedAsIncorrect: boolean;
  reportedIssues: string[];
}

export interface FeedbackAggregation {
  taskType: TaskType;
  parameterSet: string;
  totalFeedbacks: number;

  // Average Ratings
  avgQualityRating: number;
  avgSpeedRating: number;
  avgAccuracyRating: number;
  avgUsefulnessRating: number;
  avgOverallSatisfaction: number;
  avgNPS: number;

  // Sentiment Analysis
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  sentiment: 'positive' | 'negative' | 'neutral';

  // Common Issues
  commonIssues: Array<{ issue: string; frequency: number }>;
  improvementSuggestions: Array<{ suggestion: string; votes: number }>;

  // Performance Correlation
  correlationWithSpeed: number;
  correlationWithAccuracy: number;

  // Confidence Metrics
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
  strength: number; // 0-1 confidence
  taskType: TaskType;
  parameterAffected: string;
  recommendedAction: 'increase' | 'decrease' | 'maintain' | 'experiment';
  evidence: unknown[];
}

export class FeedbackIntegrationService {
  private supabase: unknown;
  private feedbackBuffer: UserFeedback[] = [];
  private bufferSize = 50;
  private flushInterval = 60000; // 1 minute
  private aggregationCache: Map<string, FeedbackAggregation> = new Map();
  private learningSignals: LearningSignal[] = [];

  constructor() {
    this.initializeSupabase();
    this.startPeriodicProcessing();
  }

  private initializeSupabase(): void {
    try {
      if (!config.supabase.url || !config.supabase.serviceKey) {
        throw new Error('Supabase configuration missing for Feedback Integration');
      }

      this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);

      log.info('✅ Feedback Integration Service initialized', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to initialize Feedback Integration Service', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Collect user feedback and trigger learning
   */
  public async collectFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): Promise<string> {
    try {
      const fullFeedback: UserFeedback = {
        ...feedback,
        id: this.generateFeedbackId(),
        timestamp: new Date(),
      };

      // Add to buffer for batch processing
      this.feedbackBuffer.push(fullFeedback);

      // Immediate learning signal extraction
      const signals = this.extractLearningSignals(fullFeedback);
      this.learningSignals.push(...signals);

      // Update parameter analytics with feedback
      await parameterAnalyticsService.recordUserFeedback(
        feedback.executionId,
        feedback.overallSatisfaction,
        feedback.qualityRating,
        feedback.textualFeedback
      );

      // Trigger ML learning if feedback indicates poor performance
      if (feedback.overallSatisfaction <= 2 || feedback.flaggedAsIncorrect) {
        await this.triggerImmediateLearning(fullFeedback);
      }

      // Flush buffer if full
      if (this.feedbackBuffer.length >= this.bufferSize) {
        await this.flushFeedbackBuffer();
      }

      log.info('📝 User feedback collected', LogContext.AI, {
        feedbackId: fullFeedback.id,
        taskType: feedback.taskType,
        satisfaction: feedback.overallSatisfaction,
        quality: feedback.qualityRating,
      });

      return fullFeedback.id;
    } catch (error) {
      log.error('❌ Failed to collect user feedback', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Get aggregated feedback for task type
   */
  public async getFeedbackAggregation(taskType: TaskType): Promise<FeedbackAggregation | null> {
    try {
      const cacheKey = `feedback_agg_${taskType}`;

      // Check cache first
      if (this.aggregationCache.has(cacheKey)) {
        const cached = this.aggregationCache.get(cacheKey)!;
        // Return cached if less than 15 minutes old
        if (Date.now() - cached.lastUpdated.getTime() < 15 * 60 * 1000) {
          return cached;
        }
      }

      // Query from database
      const { data: feedbacks, error } = await this.supabase
        .from('user_feedback')
        .select('*')
        .eq('task_type', taskType)
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (error) {
        log.error('Failed to fetch feedback aggregation', LogContext.AI, { error });
        return null;
      }

      if (!feedbacks || feedbacks.length === 0) {
        return null;
      }

      // Calculate aggregation
      const aggregation = this.calculateFeedbackAggregation(taskType, feedbacks);

      // Cache result
      this.aggregationCache.set(cacheKey, aggregation);

      return aggregation;
    } catch (error) {
      log.error('Error getting feedback aggregation', LogContext.AI, { error });
      return null;
    }
  }

  /**
   * Generate actionable insights from feedback
   */
  public async generateFeedbackInsights(): Promise<FeedbackInsight[]> {
    try {
      const insights: FeedbackInsight[] = [];

      // Analyze recent negative feedback
      const { data: negativeFeedback, error } = await this.supabase
        .from('user_feedback')
        .select('*')
        .lte('overall_satisfaction', TWO)
        .gte('timestamp', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()) // Last 3 days
        .order('timestamp', { ascending: false });

      if (error) {
        log.error('Failed to fetch negative feedback', LogContext.AI, { error });
        return insights;
      }

      // Group by issues and generate insights
      const issueGroups = this.groupFeedbackByIssues(negativeFeedback || []);

      for (const [issue, feedbacks] of issueGroups.entries()) {
        if (feedbacks.length >= THREE) {
          // Minimum threshold for insight
          const insight = this.createInsightFromIssue(issue, feedbacks);
          insights.push(insight);
        }
      }

      // Analyze parameter performance correlations
      const parameterInsights = await this.analyzeParameterPerformanceCorrelations();
      insights.push(...parameterInsights);

      // Sort by priority and confidence
      return insights.sort((a, b) => {
        const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        const aScore = priorityWeight[a.priority] * a.confidence;
        const bScore = priorityWeight[b.priority] * b.confidence;
        return bScore - aScore;
      });
    } catch (error) {
      log.error('Error generating feedback insights', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Get learning signals for parameter optimization
   */
  public getLearningSignals(taskType?: TaskType): LearningSignal[] {
    let // TODO: Refactor nested ternary
      signals = this.learningSignals;

    if (taskType) {
      signals = signals.filter((s) => s.taskType === taskType);
    }

    // Sort by strength and recency
    return signals.sort((a, b) => b.strength - a.strength).slice(0, 20); // Return top 20 signals
  }

  /**
   * Apply feedback insights to parameter optimization
   */
  public async applyFeedbackLearning(): Promise<{
    appliedInsights: number;
    parameterAdjustments: number;
    learningSignalsProcessed: number;
  }> {
    try {
      let appliedInsights = 0;
      let parameterAdjustments = 0;
      let learningSignalsProcessed = 0;

      // Get recent insights
      const insights = await this.generateFeedbackInsights();

      for (const insight of insights) {
        if (insight.type === 'parameter_adjustment' && insight.confidence > 0.7) {
          // Apply parameter learning
          await this.applyParameterLearning(insight);
          appliedInsights++;
          parameterAdjustments++;
        }
      }

      // Process learning signals
      const signals = this.getLearningSignals();
      for (const signal of signals) {
        if (signal.strength > 0.6) {
          await this.processLearningSignal(signal);
          learningSignalsProcessed++;
        }
      }

      // Clear processed signals
      this.learningSignals = this.learningSignals.filter((s) => s.strength <= 0.6);

      log.info('🧠 Applied feedback learning', LogContext.AI, {
        appliedInsights,
        parameterAdjustments,
        learningSignalsProcessed,
      });

      return {
        appliedInsights,
        parameterAdjustments,
        learningSignalsProcessed,
      };
    } catch (error) {
      log.error('Error applying feedback learning', LogContext.AI, { error });
      return { appliedInsights: 0, parameterAdjustments: 0, learningSignalsProcessed: 0 };
    }
  }

  /**
   * Get feedback statistics dashboard
   */
  public async getFeedbackDashboard(): Promise<{
    totalFeedbacks: number;
    averageSatisfaction: number;
    feedbackTrends: Array<{ date: string; satisfaction: number; volume: number }>;
    topIssues: Array<{ issue: string; frequency: number }>;
    improvementSuggestions: Array<{ suggestion: string; votes: number }>;
    learningSignalsActive: number;
    recentInsights: FeedbackInsight[];
  }> {
    try {
      // Get last 30 days of feedback
      const { data: recentFeedback, error } = await this.supabase
        .from('user_feedback')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      const feedbacks = recentFeedback || [];

      // Calculate metrics
      const totalFeedbacks = feedbacks.length;
      const averageSatisfaction =
        totalFeedbacks > 0
          ? feedbacks.reduce((sum: number, f: unknown) => sum + f.overall_satisfaction, 0) /
            totalFeedbacks
          : 0;

      // Calculate trends (daily aggregation)
      const feedbackTrends = this.calculateFeedbackTrends(feedbacks);

      // Extract top issues
      const topIssues = this.extractTopIssues(feedbacks);

      // Get improvement suggestions
      const improvementSuggestions = this.extractImprovementSuggestions(feedbacks);

      // Get recent insights
      const recentInsights = (await this.generateFeedbackInsights()).slice(0, 5);

      return {
        totalFeedbacks,
        averageSatisfaction,
        feedbackTrends,
        topIssues,
        improvementSuggestions,
        learningSignalsActive: this.learningSignals.length,
        recentInsights,
      };
    } catch (error) {
      log.error('Error getting feedback dashboard', LogContext.AI, { error });
      throw error;
    }
  }

  private extractLearningSignals(feedback: UserFeedback): LearningSignal[] {
    const signals: LearningSignal[] = [];

    // Signal 1: Poor quality suggests temperature adjustment
    if (feedback.qualityRating <= 2) {
      signals.push({
        source: 'user_feedback',
        signal: 'Low quality rating indicates potential temperature/randomness issues',
        strength: 0.8,
        taskType: feedback.taskType,
        parameterAffected: 'temperature',
        recommendedAction:
          feedback.taskType === TaskType.CREATIVE_WRITING ? 'decrease' : 'experiment',
        evidence: [{ feedbackId: feedback.id, rating: feedback.qualityRating }],
      });
    }

    // Signal 2: Speed issues suggest token limit adjustment
    if (feedback.speedRating <= 2) {
      signals.push({
        source: 'user_feedback',
        signal: 'Slow response suggests token limit or model efficiency issues',
        strength: 0.7,
        taskType: feedback.taskType,
        parameterAffected: 'maxTokens',
        recommendedAction: 'decrease',
        evidence: [
          {
            feedbackId: feedback.id,
            speedRating: feedback.speedRating,
            responseTime: feedback.responseTime,
          },
        ],
      });
    }

    // Signal 3: Accuracy issues suggest model selection or parameters
    if (feedback.accuracyRating <= 2) {
      signals.push({
        source: 'user_feedback',
        signal: 'Low accuracy suggests parameter fine-tuning needed',
        strength: 0.9,
        taskType: feedback.taskType,
        parameterAffected: 'temperature',
        recommendedAction: 'decrease',
        evidence: [
          {
            feedbackId: feedback.id,
            accuracy: feedback.accuracyRating,
            flagged: feedback.flaggedAsIncorrect,
          },
        ],
      });
    }

    // Signal 4: Preferred parameters from user
    if (feedback.preferredParameters) {
      Object.entries(feedback.preferredParameters).forEach(([param, value]) => {
        signals.push({
          source: 'user_feedback',
          signal: `User explicitly prefers ${param}=${value}`,
          strength: 0.6,
          taskType: feedback.taskType,
          parameterAffected: param,
          recommendedAction: 'experiment',
          evidence: [{ feedbackId: feedback.id, preferredValue: value }],
        });
      });
    }

    return signals;
  }

  private async triggerImmediateLearning(feedback: UserFeedback): Promise<void> {
    try {
      // Calculate performance score based on feedback
      const // TODO: Refactor nested ternary
        performanceScore =
          (feedback.qualityRating * 0.3 +
            feedback.accuracyRating * 0.3 +
            feedback.usefulnessRating * 0.2 +
            feedback.overallSatisfaction * 0.2) /
          5; // Normalize to 0-1

      // Trigger ML learning
      await mlParameterOptimizer.learnFromExecution(
        feedback.taskType,
        feedback.parameters,
        performanceScore,
        feedback.responseTime,
        {
          userFeedback: true,
          feedbackId: feedback.id,
          qualityRating: feedback.qualityRating,
          accuracyRating: feedback.accuracyRating,
          flaggedAsIncorrect: feedback.flaggedAsIncorrect,
        }
      );

      log.debug('🎯 Triggered immediate learning from negative feedback', LogContext.AI, {
        feedbackId: feedback.id,
        performanceScore,
      });
    } catch (error) {
      log.error('Failed to trigger immediate learning', LogContext.AI, { error });
    }
  }

  private async flushFeedbackBuffer(): Promise<void> {
    if (this.feedbackBuffer.length === 0 || !this.supabase) {
      return;
    }

    try {
      const feedbacks = this.feedbackBuffer.splice(0);

      const { error } = await this.supabase.from('user_feedback').insert(
        feedbacks.map((f) => ({
          id: f.id,
          user_id: f.userId,
          session_id: f.sessionId,
          execution_id: f.executionId,
          task_type: f.taskType,
          parameters: f.parameters,
          quality_rating: f.qualityRating,
          speed_rating: f.speedRating,
          accuracy_rating: f.accuracyRating,
          usefulness_rating: f.usefulnessRating,
          overall_satisfaction: f.overallSatisfaction,
          textual_feedback: f.textualFeedback,
          improvement_suggestions: f.improvesSuggestions,
          preferred_parameters: f.preferredParameters,
          user_intent: f.userIntent,
          response_length: f.responseLength,
          expected_outcome: f.expectedOutcome,
          met_expectations: f.metExpectations,
          timestamp: f.timestamp.toISOString(),
          response_time: f.responseTime,
          model_used: f.modelUsed,
          endpoint: f.endpoint,
          user_agent: f.userAgent,
          would_use_again: f.wouldUseAgain,
          recommend_to_others: f.recommendToOthers,
          flagged_as_incorrect: f.flaggedAsIncorrect,
          reported_issues: f.reportedIssues,
        }))
      );

      if (error) {
        log.error('Failed to flush feedback buffer', LogContext.AI, { error });
        // Put feedbacks back in buffer for retry
        this.feedbackBuffer = [...feedbacks, ...this.feedbackBuffer];
      } else {
        log.debug(`✅ Flushed ${feedbacks.length} feedbacks to database`, LogContext.AI);
      }
    } catch (error) {
      log.error('Error flushing feedback buffer', LogContext.AI, { error });
    }
  }

  private calculateFeedbackAggregation(
    taskType: TaskType,
    feedbacks: unknown[]
  ): FeedbackAggregation {
    const totalFeedbacks = feedbacks.length;

    return {
      taskType,
      parameterSet: 'aggregated',
      totalFeedbacks,
      avgQualityRating: this.calculateAverage(feedbacks, 'quality_rating'),
      avgSpeedRating: this.calculateAverage(feedbacks, 'speed_rating'),
      avgAccuracyRating: this.calculateAverage(feedbacks, 'accuracy_rating'),
      avgUsefulnessRating: this.calculateAverage(feedbacks, 'usefulness_rating'),
      avgOverallSatisfaction: this.calculateAverage(feedbacks, 'overall_satisfaction'),
      avgNPS: this.calculateAverage(feedbacks, 'recommend_to_others'),

      positiveCount: feedbacks.filter((f) => f.overall_satisfaction >= 4).length,
      negativeCount: feedbacks.filter((f) => f.overall_satisfaction <= 2).length,
      neutralCount: feedbacks.filter((f) => f.overall_satisfaction === THREE).length,
      sentiment: this.calculateOverallSentiment(feedbacks),

      commonIssues: this.extractCommonIssues(feedbacks),
      improvementSuggestions: this.extractImprovementSuggestions(feedbacks),

      correlationWithSpeed: this.calculateCorrelation(
        feedbacks,
        'speed_rating',
        'overall_satisfaction'
      ),
      correlationWithAccuracy: this.calculateCorrelation(
        feedbacks,
        'accuracy_rating',
        'overall_satisfaction'
      ),

      feedbackReliability: Math.min(1, totalFeedbacks / 50), // 50 feedbacks for full reliability
      sampleSize: totalFeedbacks,
      lastUpdated: new Date(),
    };
  }

  private calculateAverage(feedbacks: unknown[], field: string): number {
    if (feedbacks.length === 0) return 0;
    return feedbacks.reduce((sum, f) => sum + (f[field] || 0), 0) / feedbacks.length;
  }

  private calculateOverallSentiment(feedbacks: unknown[]): 'positive' | 'negative' | 'neutral' {
    const avgSatisfaction = this.calculateAverage(feedbacks, 'overall_satisfaction');
    if (avgSatisfaction >= 4) return 'positive';
    if (avgSatisfaction <= 2) return 'negative';
    return 'neutral';
  }

  private extractCommonIssues(feedbacks: unknown[]): Array<{ issue: string; frequency: number }> {
    const issueMap = new Map<string, number>();

    feedbacks.forEach((f) => {
      if (f.reported_issues) {
        f.reported_issues.forEach((issue: string) => {
          issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
        });
      }
    });

    return Array.from(issueMap.entries())
      .map(([issue, frequency]) => ({ issue, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private extractImprovementSuggestions(
    feedbacks: unknown[]
  ): Array<{ suggestion: string; votes: number }> {
    const suggestionMap = new Map<string, number>();

    feedbacks.forEach((f) => {
      if (f.improvement_suggestions) {
        f.improvement_suggestions.forEach((suggestion: string) => {
          suggestionMap.set(suggestion, (suggestionMap.get(suggestion) || 0) + 1);
        });
      }
    });

    return Array.from(suggestionMap.entries())
      .map(([suggestion, votes]) => ({ suggestion, votes }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 10);
  }

  private extractTopIssues(feedbacks: unknown[]): Array<{ issue: string; frequency: number }> {
    return this.extractCommonIssues(feedbacks).slice(0, 5);
  }

  private calculateCorrelation(feedbacks: unknown[], field1: string, field2: string): number {
    if (feedbacks.length < THREE) return 0;

    const values1 = feedbacks.map((f) => f[field1] || 0);
    const values2 = feedbacks.map((f) => f[field2] || 0);

    const mean1 = values1.reduce((sum, v) => sum + v, 0) / values1.length;
    const mean2 = values2.reduce((sum, v) => sum + v, 0) / values2.length;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateFeedbackTrends(
    feedbacks: unknown[]
  ): Array<{ date: string; satisfaction: number; volume: number }> {
    const dailyData = new Map<string, { satisfactionSum: number; count: number }>();

    feedbacks.forEach((f) => {
      const date = new Date(f.timestamp || Date.now()).toISOString().split('T')[0];
      if (date) {
        const existing = dailyData.get(date) || { satisfactionSum: 0, count: 0 };
        existing.satisfactionSum += f.overall_satisfaction || 0;
        existing.count += 1;
        dailyData.set(date, existing);
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date: date || '',
        satisfaction: data.count > 0 ? data.satisfactionSum / data.count : 0,
        volume: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private groupFeedbackByIssues(feedbacks: unknown[]): Map<string, any[]> {
    const // TODO: Refactor nested ternary
      groups = new Map<string, any[]>();

    feedbacks.forEach((f) => {
      if (f.reported_issues && f.reported_issues.length > 0) {
        f.reported_issues.forEach((issue: string) => {
          if (!groups.has(issue)) {
            groups.set(issue, []);
          }
          groups.get(issue)!.push(f);
        });
      }
    });

    return groups;
  }

  private createInsightFromIssue(issue: string, feedbacks: unknown[]): FeedbackInsight {
    const affectedUsers = new Set(feedbacks.map((f) => f.user_id || f.session_id)).size;
    const avgSatisfaction = this.calculateAverage(feedbacks, 'overall_satisfaction');

    return {
      type: 'bug_report',
      priority: avgSatisfaction <= 1.5 ? 'critical' : avgSatisfaction <= 2.5 ? 'high' : 'medium',
      insight: `Users are consistently reporting: ${issue}`,
      recommendation: `Investigate and fix ${issue} - affecting ${affectedUsers} users`,
      impact: `Average satisfaction: ${avgSatisfaction.toFixed(1)}/5`,
      confidence: Math.min(1, feedbacks.length / 10),
      supportingFeedbacks: feedbacks.map((f) => f.id),
      affectedUsers,
      estimatedImprovement: (5 - avgSatisfaction) * 0.2, // Potential improvement
      actionItems: [
        {
          action: `Debug and fix: ${issue}`,
          owner: 'development_team',
          estimatedEffort: feedbacks.length > 10 ? 'high' : 'medium',
          timeline: feedbacks.length > 10 ? '1-2 weeks' : '3-5 days',
        },
      ],
      metrics: {
        feedbackVolume: feedbacks.length,
        severityScore: 5 - avgSatisfaction,
        urgencyScore: affectedUsers / 10,
      },
    };
  }

  private async analyzeParameterPerformanceCorrelations(): Promise<FeedbackInsight[]> {
    // This would analyze correlations between parameters and user satisfaction
    // For now, return empty array - could be expanded with more sophisticated analysis
    return [];
  }

  private async applyParameterLearning(insight: FeedbackInsight): Promise<void> {
    // Apply the insight to parameter optimization
    log.info('📚 Applied parameter learning from insight', LogContext.AI, {
      insightType: insight.type,
      confidence: insight.confidence,
    });
  }

  private async processLearningSignal(signal: LearningSignal): Promise<void> {
    // Process the learning signal
    log.debug('🔄 Processed learning signal', LogContext.AI, {
      signal: signal.signal,
      strength: signal.strength,
      taskType: signal.taskType,
    });
  }

  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicProcessing(): void {
    // Flush feedback buffer periodically
    setInterval(() => {
      this.flushFeedbackBuffer();
    }, this.flushInterval);

    // Apply learning periodically (every 30 minutes)
    setInterval(
      async () => {
        try {
          await this.applyFeedbackLearning();
        } catch (error) {
          log.error('Periodic feedback learning failed', LogContext.AI, { error });
        }
      },
      30 * 60 * 1000
    );
  }
}

// Export singleton instance
export const feedbackIntegrationService = new FeedbackIntegrationService();
export default feedbackIntegrationService;

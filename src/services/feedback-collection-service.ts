/**
 * Feedback Collection Service
 * Comprehensive system for collecting, analyzing, and acting on user feedback
 * Features: Multiple feedback types, sentiment analysis, automated improvement suggestions
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '../utils/logger';
import { getSupabaseClient } from './supabase-client';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface UserFeedback {
  id?: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
  feedbackType: 'rating' | 'suggestion' | 'bug_report' | 'feature_request' | 'general';
  category: 'model_performance' | 'user_interface' | 'speed' | 'accuracy' | 'usability' | 'other';
  rating?: number; // 1-5 scale
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
  content: string; // Base64 encoded
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

// ============================================================================
// Feedback Collection Service
// ============================================================================

class FeedbackCollectionService extends EventEmitter {
  private readonly config: FeedbackCollectionConfig;
  private readonly feedbackBuffer = new Map<string, UserFeedback[]>();
  private readonly analytics = new Map<string, FeedbackAnalytics>();
  private isInitialized = false;
  private readonly BUFFER_SIZE = 50;
  private readonly BATCH_PROCESSING_INTERVAL = 60000; // 1 minute
  private processingTimer?: NodeJS.Timeout;

  constructor() {
    super();
    
    this.config = {
      enableSentimentAnalysis: true,
      enableAutomaticCategorization: true,
      enablePriorityAssignment: true,
      enableImprovementSuggestions: true,
      maxAttachmentSize: 10 * 1024 * 1024, // 10MB
      feedbackRetentionDays: 365,
      analyticsAggregationInterval: 3600000, // 1 hour
    };

    this.startBatchProcessing();
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('📝 Initializing Feedback Collection Service', LogContext.AI);
      
      // Initialize database tables if needed
      await this.initializeFeedbackTables();
      
      // Load existing analytics
      await this.loadAnalytics();
      
      // Start analytics aggregation
      this.startAnalyticsAggregation();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      log.info('✅ Feedback Collection Service initialized', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to initialize Feedback Collection Service', LogContext.AI, { error });
      throw error;
    }
  }

  private startBatchProcessing(): void {
    this.processingTimer = setInterval(() => {
      this.processBatchedFeedback().catch(error => 
        log.error('❌ Feedback batch processing failed', LogContext.AI, { error })
      );
    }, this.BATCH_PROCESSING_INTERVAL);
  }

  private startAnalyticsAggregation(): void {
    setInterval(() => {
      this.aggregateAnalytics().catch(error => 
        log.error('❌ Analytics aggregation failed', LogContext.AI, { error })
      );
    }, this.config.analyticsAggregationInterval);
  }

  // ============================================================================
  // Feedback Collection
  // ============================================================================

  async collectFeedback(feedback: UserFeedback): Promise<string> {
    try {
      // Generate ID if not provided
      if (!feedback.id) {
        feedback.id = this.generateFeedbackId();
      }

      // Set timestamp
      feedback.timestamp = new Date();

      // Analyze feedback if enabled
      if (this.config.enableSentimentAnalysis) {
        feedback.sentiment = await this.analyzeSentiment(feedback.description);
      }

      if (this.config.enableAutomaticCategorization && !feedback.category) {
        const category = await this.categorizeFeedback(feedback.description, feedback.context);
        if (category && ['accuracy', 'speed', 'model_performance', 'user_interface', 'usability', 'other'].includes(category)) {
          feedback.category = category as 'accuracy' | 'speed' | 'model_performance' | 'user_interface' | 'usability' | 'other';
        }
      }

      if (this.config.enablePriorityAssignment && !feedback.priority) {
        feedback.priority = await this.assignPriority(feedback);
      }

      // Validate attachments
      if (feedback.attachments) {
        feedback.attachments = await this.validateAttachments(feedback.attachments);
      }

      // Add to buffer for batch processing
      if (!this.feedbackBuffer.has(feedback.userId)) {
        this.feedbackBuffer.set(feedback.userId, []);
      }

      const userBuffer = this.feedbackBuffer.get(feedback.userId)!;
      userBuffer.push(feedback);

      // Keep buffer size manageable
      if (userBuffer.length > this.BUFFER_SIZE) {
        userBuffer.splice(0, userBuffer.length - this.BUFFER_SIZE);
      }

      // Process high-priority feedback immediately
      if (feedback.priority === 'critical' || feedback.feedbackType === 'bug_report') {
        await this.processFeedbackImmediate(feedback);
      }

      this.emit('feedbackCollected', feedback);

      log.info('📝 Feedback collected', LogContext.AI, {
        userId: feedback.userId,
        type: feedback.feedbackType,
        category: feedback.category,
        priority: feedback.priority,
        sentiment: feedback.sentiment,
      });

      return feedback.id;

    } catch (error) {
      log.error('❌ Failed to collect feedback', LogContext.AI, { error, userId: feedback.userId });
      throw error;
    }
  }

  private async processFeedbackImmediate(feedback: UserFeedback): Promise<void> {
    try {
      // Store in database
      await this.storeFeedback(feedback);

      // Trigger alerts for critical issues
      if (feedback.priority === 'critical') {
        await this.triggerCriticalAlert(feedback);
      }

      // Update analytics
      await this.updateAnalytics(feedback);

      // Generate improvement suggestions if enabled
      if (this.config.enableImprovementSuggestions) {
        await this.generateImprovementSuggestions(feedback);
      }

    } catch (error) {
      log.error('❌ Failed to process immediate feedback', LogContext.AI, { error, feedbackId: feedback.id });
    }
  }

  // ============================================================================
  // Feedback Analysis
  // ============================================================================

  private async analyzeSentiment(text: string): Promise<'positive' | 'negative' | 'neutral'> {
    try {
      // Simple keyword-based sentiment analysis
      // In production, this would use a proper NLP service
      
      const positiveKeywords = [
        'good', 'great', 'excellent', 'awesome', 'love', 'like', 'perfect',
        'amazing', 'wonderful', 'fantastic', 'helpful', 'useful', 'fast',
        'easy', 'smooth', 'efficient', 'accurate', 'impressed', 'satisfied'
      ];

      const negativeKeywords = [
        'bad', 'terrible', 'awful', 'hate', 'dislike', 'broken', 'slow',
        'difficult', 'confusing', 'error', 'bug', 'problem', 'issue',
        'frustrated', 'annoying', 'useless', 'inaccurate', 'disappointed'
      ];

      const lowerText = text.toLowerCase();
      
      let positiveScore = 0;
      let negativeScore = 0;

      for (const keyword of positiveKeywords) {
        const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
        positiveScore += matches;
      }

      for (const keyword of negativeKeywords) {
        const matches = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
        negativeScore += matches;
      }

      if (positiveScore > negativeScore) {
        return 'positive';
      } else if (negativeScore > positiveScore) {
        return 'negative';
      } else {
        return 'neutral';
      }

    } catch (error) {
      log.error('❌ Sentiment analysis failed', LogContext.AI, { error });
      return 'neutral';
    }
  }

  private async categorizeFeedback(
    description: string, 
    context?: FeedbackContext
  ): Promise<string> {
    try {
      const lowerText = description.toLowerCase();
      
      // Model performance indicators
      if (lowerText.includes('model') || lowerText.includes('response') || 
          lowerText.includes('accuracy') || lowerText.includes('quality') ||
          context?.modelUsed) {
        return 'model_performance';
      }

      // UI/UX indicators
      if (lowerText.includes('interface') || lowerText.includes('ui') || 
          lowerText.includes('design') || lowerText.includes('layout') ||
          lowerText.includes('button') || lowerText.includes('menu')) {
        return 'user_interface';
      }

      // Speed indicators
      if (lowerText.includes('slow') || lowerText.includes('fast') || 
          lowerText.includes('speed') || lowerText.includes('performance') ||
          lowerText.includes('time') || context?.responseTime) {
        return 'speed';
      }

      // Accuracy indicators
      if (lowerText.includes('wrong') || lowerText.includes('correct') || 
          lowerText.includes('accurate') || lowerText.includes('mistake') ||
          lowerText.includes('error') || lowerText.includes('incorrect')) {
        return 'accuracy';
      }

      // Usability indicators
      if (lowerText.includes('easy') || lowerText.includes('difficult') || 
          lowerText.includes('hard') || lowerText.includes('confusing') ||
          lowerText.includes('simple') || lowerText.includes('complex')) {
        return 'usability';
      }

      return 'other';

    } catch (error) {
      log.error('❌ Feedback categorization failed', LogContext.AI, { error });
      return 'other';
    }
  }

  private async assignPriority(feedback: UserFeedback): Promise<'low' | 'medium' | 'high' | 'critical'> {
    try {
      let priorityScore = 0;

      // Bug reports get higher priority
      if (feedback.feedbackType === 'bug_report') {
        priorityScore += 3;
      }

      // Negative sentiment increases priority
      if (feedback.sentiment === 'negative') {
        priorityScore += 2;
      }

      // Low ratings increase priority
      if (feedback.rating && feedback.rating <= 2) {
        priorityScore += 2;
      }

      // Critical keywords
      const criticalKeywords = ['crash', 'broken', 'not working', 'critical', 'urgent', 'security'];
      const lowerText = feedback.description.toLowerCase();
      
      for (const keyword of criticalKeywords) {
        if (lowerText.includes(keyword)) {
          priorityScore += 3;
          break;
        }
      }

      // Error context increases priority
      if (feedback.context?.errorOccurred) {
        priorityScore += 2;
      }

      // Assign priority based on score
      if (priorityScore >= 6) {
        return 'critical';
      } else if (priorityScore >= 4) {
        return 'high';
      } else if (priorityScore >= 2) {
        return 'medium';
      } else {
        return 'low';
      }

    } catch (error) {
      log.error('❌ Priority assignment failed', LogContext.AI, { error });
      return 'medium';
    }
  }

  private async validateAttachments(attachments: FeedbackAttachment[]): Promise<FeedbackAttachment[]> {
    const validAttachments: FeedbackAttachment[] = [];

    for (const attachment of attachments) {
      try {
        // Check file size
        if (attachment.size > this.config.maxAttachmentSize) {
          log.warn('⚠️ Attachment too large, skipping', LogContext.AI, {
            filename: attachment.filename,
            size: attachment.size,
            maxSize: this.config.maxAttachmentSize,
          });
          continue;
        }

        // Validate MIME type for screenshots
        if (attachment.type === 'screenshot') {
          const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
          if (attachment.mimeType && !validImageTypes.includes(attachment.mimeType)) {
            log.warn('⚠️ Invalid image type for screenshot', LogContext.AI, {
              filename: attachment.filename,
              mimeType: attachment.mimeType,
            });
            continue;
          }
        }

        // Validate content is base64
        if (!this.isValidBase64(attachment.content)) {
          log.warn('⚠️ Invalid base64 content', LogContext.AI, {
            filename: attachment.filename,
          });
          continue;
        }

        validAttachments.push(attachment);

      } catch (error) {
        log.error('❌ Attachment validation failed', LogContext.AI, {
          error,
          filename: attachment.filename,
        });
      }
    }

    return validAttachments;
  }

  private isValidBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // Analytics and Insights
  // ============================================================================

  async getFeedbackAnalytics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<FeedbackAnalytics> {
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available for analytics', LogContext.AI);
        return this.getDefaultAnalytics();
      }

      let query = supabaseClient
        .from('user_feedback')
        .select('*');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (timeRange) {
        query = query
          .gte('timestamp', timeRange.start.toISOString())
          .lte('timestamp', timeRange.end.toISOString());
      }

      const { data: feedbackData } = await query;

      if (!feedbackData || feedbackData.length === 0) {
        return this.getDefaultAnalytics();
      }

      return this.calculateAnalytics(feedbackData);

    } catch (error) {
      log.error('❌ Failed to get feedback analytics', LogContext.AI, { error });
      return this.getDefaultAnalytics();
    }
  }

  private calculateAnalytics(feedbackData: any[]): FeedbackAnalytics {
    const totalFeedback = feedbackData.length;
    
    // Calculate average rating
    const ratingsData = feedbackData.filter(f => f.rating);
    const averageRating = ratingsData.length > 0 
      ? ratingsData.reduce((sum, f) => sum + f.rating, 0) / ratingsData.length 
      : 0;

    // Sentiment distribution
    const sentimentDistribution = feedbackData.reduce((acc, f) => {
      const sentiment = f.sentiment || 'neutral';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Category breakdown
    const categoryBreakdown = feedbackData.reduce((acc, f) => {
      const category = f.category || 'other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Priority distribution
    const priorityDistribution = feedbackData.reduce((acc, f) => {
      const priority = f.priority || 'medium';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Status distribution
    const statusDistribution = feedbackData.reduce((acc, f) => {
      const status = f.status || 'new';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Generate trends (simplified)
    const trendData = this.generateTrendData(feedbackData);

    // Identify top issues
    const topIssues = this.identifyTopIssues(feedbackData);

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestionsFromData(feedbackData);

    return {
      totalFeedback,
      averageRating,
      sentimentDistribution,
      categoryBreakdown,
      priorityDistribution,
      statusDistribution,
      trendData,
      topIssues,
      improvementSuggestions,
    };
  }

  private generateTrendData(feedbackData: any[]): FeedbackTrend[] {
    // Group feedback by day for the last 7 days
    const trends: FeedbackTrend[] = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0] ?? date.toISOString().substring(0, 10);
      
      const dayFeedback = feedbackData.filter(f => 
        f.timestamp.startsWith(dateStr)
      );
      
      const dayRatings = dayFeedback.filter(f => f.rating);
      const averageRating = dayRatings.length > 0 
        ? dayRatings.reduce((sum, f) => sum + f.rating, 0) / dayRatings.length 
        : 0;
      
      const sentiment = dayFeedback.reduce((acc, f) => {
        const s = f.sentiment || 'neutral';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      trends.push({
        period: dateStr,
        totalFeedback: dayFeedback.length,
        averageRating,
        sentiment,
      });
    }
    
    return trends;
  }

  private identifyTopIssues(feedbackData: any[]): FeedbackIssue[] {
    // Group negative feedback by similar descriptions
    const negativeFeedback = feedbackData.filter(f => 
      f.sentiment === 'negative' || f.rating <= 2
    );

    const issueGroups = new Map<string, any[]>();
    
    for (const feedback of negativeFeedback) {
      const key = this.extractIssueKey(feedback.description);
      if (!issueGroups.has(key)) {
        issueGroups.set(key, []);
      }
      issueGroups.get(key)!.push(feedback);
    }

    const topIssues: FeedbackIssue[] = [];
    
    for (const [issueKey, issueFeedback] of issueGroups) {
      if (issueFeedback.length >= 2) { // Only include issues with multiple reports
        const severity = this.calculateIssueSeverity(issueFeedback);
        const affectedUsers = new Set(issueFeedback.map(f => f.user_id)).size;
        
        topIssues.push({
          description: issueKey,
          frequency: issueFeedback.length,
          category: issueFeedback[0].category || 'other',
          severity,
          affectedUsers,
          suggestedActions: this.generateActionSuggestions(issueKey, severity),
        });
      }
    }

    return topIssues.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  }

  private extractIssueKey(description: string): string {
    // Simplified issue extraction - group by similar keywords
    const keywords = description.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3)
      .join(' ');
    
    return keywords || description.slice(0, 50);
  }

  private calculateIssueSeverity(issueFeedback: any[]): 'low' | 'medium' | 'high' | 'critical' {
    const avgPriorityScore = issueFeedback.reduce((sum, f) => {
      const priorityScores = { low: 1, medium: 2, high: 3, critical: 4 };
      return sum + (priorityScores[f.priority as keyof typeof priorityScores] || 2);
    }, 0) / issueFeedback.length;

    if (avgPriorityScore >= 3.5) return 'critical';
    if (avgPriorityScore >= 2.5) return 'high';
    if (avgPriorityScore >= 1.5) return 'medium';
    return 'low';
  }

  private generateActionSuggestions(issueKey: string, severity: string): string[] {
    const suggestions: string[] = [];
    
    if (issueKey.includes('slow') || issueKey.includes('speed')) {
      suggestions.push('Investigate performance bottlenecks');
      suggestions.push('Consider implementing caching');
      suggestions.push('Optimize database queries');
    }
    
    if (issueKey.includes('error') || issueKey.includes('bug')) {
      suggestions.push('Review error logs');
      suggestions.push('Add better error handling');
      suggestions.push('Implement automated testing');
    }
    
    if (issueKey.includes('confusing') || issueKey.includes('difficult')) {
      suggestions.push('Improve user interface design');
      suggestions.push('Add helpful tooltips');
      suggestions.push('Create better documentation');
    }
    
    if (severity === 'critical') {
      suggestions.unshift('Immediate attention required');
    }
    
    return suggestions.length > 0 ? suggestions : ['Review and investigate further'];
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  private async initializeFeedbackTables(): Promise<void> {
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available for table initialization', LogContext.AI);
        return;
      }

      // Tables will be created via migrations
      log.info('📊 Feedback tables initialized', LogContext.AI);
      
    } catch (error) {
      log.error('❌ Failed to initialize feedback tables', LogContext.AI, { error });
    }
  }

  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available, feedback not persisted', LogContext.AI);
        return;
      }

      const { error } = await supabaseClient
        .from('user_feedback')
        .insert({
          id: feedback.id,
          user_id: feedback.userId,
          session_id: feedback.sessionId,
          feedback_type: feedback.feedbackType,
          category: feedback.category,
          rating: feedback.rating,
          title: feedback.title,
          description: feedback.description,
          context: feedback.context,
          sentiment: feedback.sentiment,
          priority: feedback.priority,
          status: feedback.status || 'new',
          tags: feedback.tags,
          model_id: feedback.modelId,
          provider_id: feedback.providerId,
          response_time: feedback.responseTime,
          attachments: feedback.attachments,
          timestamp: feedback.timestamp.toISOString(),
        });

      if (error) throw error;

    } catch (error) {
      log.error('❌ Failed to store feedback', LogContext.AI, { error, feedbackId: feedback.id });
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultAnalytics(): FeedbackAnalytics {
    return {
      totalFeedback: 0,
      averageRating: 0,
      sentimentDistribution: {},
      categoryBreakdown: {},
      priorityDistribution: {},
      statusDistribution: {},
      trendData: [],
      topIssues: [],
      improvementSuggestions: [],
    };
  }

  private async loadAnalytics(): Promise<void> {
    // Load recent analytics from cache or database
    log.info('📊 Analytics loaded', LogContext.AI);
  }

  private async aggregateAnalytics(): Promise<void> {
    // Aggregate analytics periodically
    log.debug('📊 Analytics aggregated', LogContext.AI);
  }

  private async processBatchedFeedback(): Promise<void> {
    if (this.feedbackBuffer.size === 0) return;

    try {
      const batches = Array.from(this.feedbackBuffer.entries());
      
      for (const [userId, feedbackList] of batches) {
        if (feedbackList.length === 0) continue;
        
        for (const feedback of feedbackList) {
          await this.storeFeedback(feedback);
          await this.updateAnalytics(feedback);
        }
        
        this.feedbackBuffer.set(userId, []);
      }
      
    } catch (error) {
      log.error('❌ Batch feedback processing failed', LogContext.AI, { error });
    }
  }

  private async updateAnalytics(feedback: UserFeedback): Promise<void> {
    // Update real-time analytics
    this.emit('analyticsUpdated', feedback);
  }

  private async triggerCriticalAlert(feedback: UserFeedback): Promise<void> {
    this.emit('criticalFeedback', feedback);
    log.warn('🚨 Critical feedback received', LogContext.AI, {
      feedbackId: feedback.id,
      userId: feedback.userId,
      description: feedback.description.slice(0, 100),
    });
  }

  private async generateImprovementSuggestions(feedback: UserFeedback): Promise<void> {
    // Generate improvement suggestions based on feedback
    this.emit('improvementSuggestion', feedback);
  }

  private generateImprovementSuggestionsFromData(feedbackData: any[]): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];
    
    // Performance improvement suggestions
    const performanceIssues = feedbackData.filter(f => 
      f.category === 'speed' && f.sentiment === 'negative'
    );
    
    if (performanceIssues.length > 2) {
      suggestions.push({
        type: 'performance',
        description: 'Optimize system performance based on user feedback about slow response times',
        impact: 'high',
        effort: 'medium',
        priority: 8,
        relatedFeedback: performanceIssues.map(f => f.id),
      });
    }
    
    // UI improvement suggestions
    const uiIssues = feedbackData.filter(f => 
      f.category === 'user_interface' && f.sentiment === 'negative'
    );
    
    if (uiIssues.length > 1) {
      suggestions.push({
        type: 'ui',
        description: 'Improve user interface design based on usability feedback',
        impact: 'medium',
        effort: 'low',
        priority: 6,
        relatedFeedback: uiIssues.map(f => f.id),
      });
    }
    
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  async submitFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): Promise<string> {
    return this.collectFeedback(feedback as UserFeedback);
  }

  async getFeedbackHistory(
    userId: string,
    limit: number = 50
  ): Promise<UserFeedback[]> {
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        return [];
      }

      const { data } = await supabaseClient
        .from('user_feedback')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      return data || [];

    } catch (error) {
      log.error('❌ Failed to get feedback history', LogContext.AI, { error, userId });
      return [];
    }
  }

  async updateFeedbackStatus(
    feedbackId: string,
    status: 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'dismissed'
  ): Promise<void> {
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available for status update', LogContext.AI);
        return;
      }

      const { error } = await supabaseClient
        .from('user_feedback')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', feedbackId);

      if (error) throw error;

      this.emit('feedbackStatusUpdated', { feedbackId, status });

    } catch (error) {
      log.error('❌ Failed to update feedback status', LogContext.AI, { error, feedbackId });
      throw error;
    }
  }

  async getTopIssues(limit: number = 10): Promise<FeedbackIssue[]> {
    const analytics = await this.getFeedbackAnalytics();
    return analytics.topIssues.slice(0, limit);
  }

  async getImprovementSuggestions(limit: number = 5): Promise<ImprovementSuggestion[]> {
    const analytics = await this.getFeedbackAnalytics();
    return analytics.improvementSuggestions.slice(0, limit);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async shutdown(): Promise<void> {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }

    // Process remaining feedback
    await this.processBatchedFeedback();

    log.info('📝 Feedback Collection Service shut down', LogContext.AI);
  }
}

// ============================================================================
// Export Service Instance
// ============================================================================

export const feedbackCollectionService = new FeedbackCollectionService();

export type {
  FeedbackAnalytics,
  FeedbackAttachment,
  FeedbackCollectionConfig,
  FeedbackContext,
  FeedbackIssue,
  FeedbackTrend,
  ImprovementSuggestion,
  UserFeedback,
};
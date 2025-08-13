import { EventEmitter } from 'events';
import { log, LogContext } from '../utils/logger';
import { getSupabaseClient } from './supabase-client';
class FeedbackCollectionService extends EventEmitter {
    config;
    feedbackBuffer = new Map();
    analytics = new Map();
    isInitialized = false;
    BUFFER_SIZE = 50;
    BATCH_PROCESSING_INTERVAL = 60000;
    processingTimer;
    constructor() {
        super();
        this.config = {
            enableSentimentAnalysis: true,
            enableAutomaticCategorization: true,
            enablePriorityAssignment: true,
            enableImprovementSuggestions: true,
            maxAttachmentSize: 10 * 1024 * 1024,
            feedbackRetentionDays: 365,
            analyticsAggregationInterval: 3600000,
        };
        this.startBatchProcessing();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            log.info('📝 Initializing Feedback Collection Service', LogContext.AI);
            await this.initializeFeedbackTables();
            await this.loadAnalytics();
            this.startAnalyticsAggregation();
            this.isInitialized = true;
            this.emit('initialized');
            log.info('✅ Feedback Collection Service initialized', LogContext.AI);
        }
        catch (error) {
            log.error('❌ Failed to initialize Feedback Collection Service', LogContext.AI, { error });
            throw error;
        }
    }
    startBatchProcessing() {
        this.processingTimer = setInterval(() => {
            this.processBatchedFeedback().catch(error => log.error('❌ Feedback batch processing failed', LogContext.AI, { error }));
        }, this.BATCH_PROCESSING_INTERVAL);
    }
    startAnalyticsAggregation() {
        setInterval(() => {
            this.aggregateAnalytics().catch(error => log.error('❌ Analytics aggregation failed', LogContext.AI, { error }));
        }, this.config.analyticsAggregationInterval);
    }
    async collectFeedback(feedback) {
        try {
            if (!feedback.id) {
                feedback.id = this.generateFeedbackId();
            }
            feedback.timestamp = new Date();
            if (this.config.enableSentimentAnalysis) {
                feedback.sentiment = await this.analyzeSentiment(feedback.description);
            }
            if (this.config.enableAutomaticCategorization && !feedback.category) {
                const category = await this.categorizeFeedback(feedback.description, feedback.context);
                if (category && ['accuracy', 'speed', 'model_performance', 'user_interface', 'usability', 'other'].includes(category)) {
                    feedback.category = category;
                }
            }
            if (this.config.enablePriorityAssignment && !feedback.priority) {
                feedback.priority = await this.assignPriority(feedback);
            }
            if (feedback.attachments) {
                feedback.attachments = await this.validateAttachments(feedback.attachments);
            }
            if (!this.feedbackBuffer.has(feedback.userId)) {
                this.feedbackBuffer.set(feedback.userId, []);
            }
            const userBuffer = this.feedbackBuffer.get(feedback.userId);
            userBuffer.push(feedback);
            if (userBuffer.length > this.BUFFER_SIZE) {
                userBuffer.splice(0, userBuffer.length - this.BUFFER_SIZE);
            }
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
        }
        catch (error) {
            log.error('❌ Failed to collect feedback', LogContext.AI, { error, userId: feedback.userId });
            throw error;
        }
    }
    async processFeedbackImmediate(feedback) {
        try {
            await this.storeFeedback(feedback);
            if (feedback.priority === 'critical') {
                await this.triggerCriticalAlert(feedback);
            }
            await this.updateAnalytics(feedback);
            if (this.config.enableImprovementSuggestions) {
                await this.generateImprovementSuggestions(feedback);
            }
        }
        catch (error) {
            log.error('❌ Failed to process immediate feedback', LogContext.AI, { error, feedbackId: feedback.id });
        }
    }
    async analyzeSentiment(text) {
        try {
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
            }
            else if (negativeScore > positiveScore) {
                return 'negative';
            }
            else {
                return 'neutral';
            }
        }
        catch (error) {
            log.error('❌ Sentiment analysis failed', LogContext.AI, { error });
            return 'neutral';
        }
    }
    async categorizeFeedback(description, context) {
        try {
            const lowerText = description.toLowerCase();
            if (lowerText.includes('model') || lowerText.includes('response') ||
                lowerText.includes('accuracy') || lowerText.includes('quality') ||
                context?.modelUsed) {
                return 'model_performance';
            }
            if (lowerText.includes('interface') || lowerText.includes('ui') ||
                lowerText.includes('design') || lowerText.includes('layout') ||
                lowerText.includes('button') || lowerText.includes('menu')) {
                return 'user_interface';
            }
            if (lowerText.includes('slow') || lowerText.includes('fast') ||
                lowerText.includes('speed') || lowerText.includes('performance') ||
                lowerText.includes('time') || context?.responseTime) {
                return 'speed';
            }
            if (lowerText.includes('wrong') || lowerText.includes('correct') ||
                lowerText.includes('accurate') || lowerText.includes('mistake') ||
                lowerText.includes('error') || lowerText.includes('incorrect')) {
                return 'accuracy';
            }
            if (lowerText.includes('easy') || lowerText.includes('difficult') ||
                lowerText.includes('hard') || lowerText.includes('confusing') ||
                lowerText.includes('simple') || lowerText.includes('complex')) {
                return 'usability';
            }
            return 'other';
        }
        catch (error) {
            log.error('❌ Feedback categorization failed', LogContext.AI, { error });
            return 'other';
        }
    }
    async assignPriority(feedback) {
        try {
            let priorityScore = 0;
            if (feedback.feedbackType === 'bug_report') {
                priorityScore += 3;
            }
            if (feedback.sentiment === 'negative') {
                priorityScore += 2;
            }
            if (feedback.rating && feedback.rating <= 2) {
                priorityScore += 2;
            }
            const criticalKeywords = ['crash', 'broken', 'not working', 'critical', 'urgent', 'security'];
            const lowerText = feedback.description.toLowerCase();
            for (const keyword of criticalKeywords) {
                if (lowerText.includes(keyword)) {
                    priorityScore += 3;
                    break;
                }
            }
            if (feedback.context?.errorOccurred) {
                priorityScore += 2;
            }
            if (priorityScore >= 6) {
                return 'critical';
            }
            else if (priorityScore >= 4) {
                return 'high';
            }
            else if (priorityScore >= 2) {
                return 'medium';
            }
            else {
                return 'low';
            }
        }
        catch (error) {
            log.error('❌ Priority assignment failed', LogContext.AI, { error });
            return 'medium';
        }
    }
    async validateAttachments(attachments) {
        const validAttachments = [];
        for (const attachment of attachments) {
            try {
                if (attachment.size > this.config.maxAttachmentSize) {
                    log.warn('⚠️ Attachment too large, skipping', LogContext.AI, {
                        filename: attachment.filename,
                        size: attachment.size,
                        maxSize: this.config.maxAttachmentSize,
                    });
                    continue;
                }
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
                if (!this.isValidBase64(attachment.content)) {
                    log.warn('⚠️ Invalid base64 content', LogContext.AI, {
                        filename: attachment.filename,
                    });
                    continue;
                }
                validAttachments.push(attachment);
            }
            catch (error) {
                log.error('❌ Attachment validation failed', LogContext.AI, {
                    error,
                    filename: attachment.filename,
                });
            }
        }
        return validAttachments;
    }
    isValidBase64(str) {
        try {
            return btoa(atob(str)) === str;
        }
        catch (error) {
            return false;
        }
    }
    async getFeedbackAnalytics(userId, timeRange) {
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
        }
        catch (error) {
            log.error('❌ Failed to get feedback analytics', LogContext.AI, { error });
            return this.getDefaultAnalytics();
        }
    }
    calculateAnalytics(feedbackData) {
        const totalFeedback = feedbackData.length;
        const ratingsData = feedbackData.filter(f => f.rating);
        const averageRating = ratingsData.length > 0
            ? ratingsData.reduce((sum, f) => sum + f.rating, 0) / ratingsData.length
            : 0;
        const sentimentDistribution = feedbackData.reduce((acc, f) => {
            const sentiment = f.sentiment || 'neutral';
            acc[sentiment] = (acc[sentiment] || 0) + 1;
            return acc;
        }, {});
        const categoryBreakdown = feedbackData.reduce((acc, f) => {
            const category = f.category || 'other';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
        const priorityDistribution = feedbackData.reduce((acc, f) => {
            const priority = f.priority || 'medium';
            acc[priority] = (acc[priority] || 0) + 1;
            return acc;
        }, {});
        const statusDistribution = feedbackData.reduce((acc, f) => {
            const status = f.status || 'new';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        const trendData = this.generateTrendData(feedbackData);
        const topIssues = this.identifyTopIssues(feedbackData);
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
    generateTrendData(feedbackData) {
        const trends = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0] ?? date.toISOString().substring(0, 10);
            const dayFeedback = feedbackData.filter(f => f.timestamp.startsWith(dateStr));
            const dayRatings = dayFeedback.filter(f => f.rating);
            const averageRating = dayRatings.length > 0
                ? dayRatings.reduce((sum, f) => sum + f.rating, 0) / dayRatings.length
                : 0;
            const sentiment = dayFeedback.reduce((acc, f) => {
                const s = f.sentiment || 'neutral';
                acc[s] = (acc[s] || 0) + 1;
                return acc;
            }, {});
            trends.push({
                period: dateStr,
                totalFeedback: dayFeedback.length,
                averageRating,
                sentiment,
            });
        }
        return trends;
    }
    identifyTopIssues(feedbackData) {
        const negativeFeedback = feedbackData.filter(f => f.sentiment === 'negative' || f.rating <= 2);
        const issueGroups = new Map();
        for (const feedback of negativeFeedback) {
            const key = this.extractIssueKey(feedback.description);
            if (!issueGroups.has(key)) {
                issueGroups.set(key, []);
            }
            issueGroups.get(key).push(feedback);
        }
        const topIssues = [];
        for (const [issueKey, issueFeedback] of issueGroups) {
            if (issueFeedback.length >= 2) {
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
    extractIssueKey(description) {
        const keywords = description.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 3)
            .join(' ');
        return keywords || description.slice(0, 50);
    }
    calculateIssueSeverity(issueFeedback) {
        const avgPriorityScore = issueFeedback.reduce((sum, f) => {
            const priorityScores = { low: 1, medium: 2, high: 3, critical: 4 };
            return sum + (priorityScores[f.priority] || 2);
        }, 0) / issueFeedback.length;
        if (avgPriorityScore >= 3.5)
            return 'critical';
        if (avgPriorityScore >= 2.5)
            return 'high';
        if (avgPriorityScore >= 1.5)
            return 'medium';
        return 'low';
    }
    generateActionSuggestions(issueKey, severity) {
        const suggestions = [];
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
    async initializeFeedbackTables() {
        try {
            const supabaseClient = getSupabaseClient();
            if (!supabaseClient) {
                log.warn('⚠️ Supabase client not available for table initialization', LogContext.AI);
                return;
            }
            log.info('📊 Feedback tables initialized', LogContext.AI);
        }
        catch (error) {
            log.error('❌ Failed to initialize feedback tables', LogContext.AI, { error });
        }
    }
    async storeFeedback(feedback) {
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
            if (error)
                throw error;
        }
        catch (error) {
            log.error('❌ Failed to store feedback', LogContext.AI, { error, feedbackId: feedback.id });
            throw error;
        }
    }
    generateFeedbackId() {
        return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getDefaultAnalytics() {
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
    async loadAnalytics() {
        log.info('📊 Analytics loaded', LogContext.AI);
    }
    async aggregateAnalytics() {
        log.debug('📊 Analytics aggregated', LogContext.AI);
    }
    async processBatchedFeedback() {
        if (this.feedbackBuffer.size === 0)
            return;
        try {
            const batches = Array.from(this.feedbackBuffer.entries());
            for (const [userId, feedbackList] of batches) {
                if (feedbackList.length === 0)
                    continue;
                for (const feedback of feedbackList) {
                    await this.storeFeedback(feedback);
                    await this.updateAnalytics(feedback);
                }
                this.feedbackBuffer.set(userId, []);
            }
        }
        catch (error) {
            log.error('❌ Batch feedback processing failed', LogContext.AI, { error });
        }
    }
    async updateAnalytics(feedback) {
        this.emit('analyticsUpdated', feedback);
    }
    async triggerCriticalAlert(feedback) {
        this.emit('criticalFeedback', feedback);
        log.warn('🚨 Critical feedback received', LogContext.AI, {
            feedbackId: feedback.id,
            userId: feedback.userId,
            description: feedback.description.slice(0, 100),
        });
    }
    async generateImprovementSuggestions(feedback) {
        this.emit('improvementSuggestion', feedback);
    }
    generateImprovementSuggestionsFromData(feedbackData) {
        const suggestions = [];
        const performanceIssues = feedbackData.filter(f => f.category === 'speed' && f.sentiment === 'negative');
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
        const uiIssues = feedbackData.filter(f => f.category === 'user_interface' && f.sentiment === 'negative');
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
    async submitFeedback(feedback) {
        return this.collectFeedback(feedback);
    }
    async getFeedbackHistory(userId, limit = 50) {
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
        }
        catch (error) {
            log.error('❌ Failed to get feedback history', LogContext.AI, { error, userId });
            return [];
        }
    }
    async updateFeedbackStatus(feedbackId, status) {
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
            if (error)
                throw error;
            this.emit('feedbackStatusUpdated', { feedbackId, status });
        }
        catch (error) {
            log.error('❌ Failed to update feedback status', LogContext.AI, { error, feedbackId });
            throw error;
        }
    }
    async getTopIssues(limit = 10) {
        const analytics = await this.getFeedbackAnalytics();
        return analytics.topIssues.slice(0, limit);
    }
    async getImprovementSuggestions(limit = 5) {
        const analytics = await this.getFeedbackAnalytics();
        return analytics.improvementSuggestions.slice(0, limit);
    }
    async shutdown() {
        if (this.processingTimer) {
            clearInterval(this.processingTimer);
        }
        await this.processBatchedFeedback();
        log.info('📝 Feedback Collection Service shut down', LogContext.AI);
    }
}
export const feedbackCollectionService = new FeedbackCollectionService();
//# sourceMappingURL=feedback-collection-service.js.map
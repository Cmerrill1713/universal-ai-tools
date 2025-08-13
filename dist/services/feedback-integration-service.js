import { createClient } from '@supabase/supabase-js';
import { TaskType } from '@/types';
import { config } from '../config/environment';
import { THREE, TWO } from '../utils/constants';
import { log, LogContext } from '../utils/logger';
import { autonomousActionLoopService } from './autonomous-action-loop-service';
import { mlParameterOptimizer } from './ml-parameter-optimizer';
import { parameterAnalyticsService } from './parameter-analytics-service';
export class FeedbackIntegrationService {
    supabase;
    feedbackBuffer = [];
    bufferSize = 50;
    flushInterval = 60000;
    aggregationCache = new Map();
    learningSignals = [];
    constructor() {
        this.initializeSupabase();
        this.startPeriodicProcessing();
    }
    initializeSupabase() {
        try {
            if (!config.supabase.url || !config.supabase.serviceKey) {
                throw new Error('Supabase configuration missing for Feedback Integration');
            }
            this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
            log.info('✅ Feedback Integration Service initialized', LogContext.AI);
        }
        catch (error) {
            log.error('❌ Failed to initialize Feedback Integration Service', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async collectFeedback(feedback) {
        try {
            const fullFeedback = {
                ...feedback,
                id: this.generateFeedbackId(),
                timestamp: new Date(),
            };
            this.feedbackBuffer.push(fullFeedback);
            const signals = this.extractLearningSignals(fullFeedback);
            this.learningSignals.push(...signals);
            await parameterAnalyticsService.recordUserFeedback(feedback.executionId, feedback.overallSatisfaction, feedback.qualityRating, feedback.textualFeedback);
            if (feedback.overallSatisfaction <= 2 || feedback.flaggedAsIncorrect) {
                await this.triggerImmediateLearning(fullFeedback);
            }
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
        }
        catch (error) {
            log.error('❌ Failed to collect user feedback', LogContext.AI, { error });
            throw error;
        }
    }
    async getFeedbackAggregation(taskType) {
        try {
            const cacheKey = `feedback_agg_${taskType}`;
            if (this.aggregationCache.has(cacheKey)) {
                const cached = this.aggregationCache.get(cacheKey);
                if (Date.now() - cached.lastUpdated.getTime() < 15 * 60 * 1000) {
                    return cached;
                }
            }
            const { data: feedbacks, error } = await this.supabase
                .from('user_feedback')
                .select('*')
                .eq('task_type', taskType)
                .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
            if (error) {
                log.error('Failed to fetch feedback aggregation', LogContext.AI, { error });
                return null;
            }
            if (!feedbacks || feedbacks.length === 0) {
                return null;
            }
            const aggregation = this.calculateFeedbackAggregation(taskType, feedbacks);
            this.aggregationCache.set(cacheKey, aggregation);
            return aggregation;
        }
        catch (error) {
            log.error('Error getting feedback aggregation', LogContext.AI, { error });
            return null;
        }
    }
    async generateFeedbackInsights() {
        try {
            const insights = [];
            const { data: negativeFeedback, error } = await this.supabase
                .from('user_feedback')
                .select('*')
                .lte('overall_satisfaction', TWO)
                .gte('timestamp', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
                .order('timestamp', { ascending: false });
            if (error) {
                log.error('Failed to fetch negative feedback', LogContext.AI, { error });
                return insights;
            }
            const issueGroups = this.groupFeedbackByIssues(negativeFeedback || []);
            for (const [issue, feedbacks] of issueGroups.entries()) {
                if (feedbacks.length >= THREE) {
                    const insight = this.createInsightFromIssue(issue, feedbacks);
                    insights.push(insight);
                }
            }
            const parameterInsights = await this.analyzeParameterPerformanceCorrelations();
            insights.push(...parameterInsights);
            const improvementInsights = await this.generateImprovementInsights();
            insights.push(...improvementInsights);
            return insights.sort((a, b) => {
                const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
                const aScore = priorityWeight[a.priority] * a.confidence;
                const bScore = priorityWeight[b.priority] * b.confidence;
                return bScore - aScore;
            });
        }
        catch (error) {
            log.error('Error generating feedback insights', LogContext.AI, { error });
            return [];
        }
    }
    getLearningSignals(taskType) {
        let signals = this.learningSignals;
        if (taskType) {
            signals = signals.filter((s) => s.taskType === taskType);
        }
        return signals.sort((a, b) => b.strength - a.strength).slice(0, 20);
    }
    async applyFeedbackLearning() {
        try {
            let appliedInsights = 0;
            let parameterAdjustments = 0;
            let learningSignalsProcessed = 0;
            let autonomousActionsQueued = 0;
            const insights = await this.generateFeedbackInsights();
            for (const insight of insights) {
                if (insight.type === 'parameter_adjustment' && insight.confidence > 0.7) {
                    await this.queueAutonomousAction(insight);
                    autonomousActionsQueued++;
                    await this.applyParameterLearning(insight);
                    appliedInsights++;
                    parameterAdjustments++;
                }
            }
            const signals = this.getLearningSignals();
            for (const signal of signals) {
                if (signal.strength > 0.6) {
                    await this.queueLearningSignalAction(signal);
                    autonomousActionsQueued++;
                    await this.processLearningSignal(signal);
                    learningSignalsProcessed++;
                }
            }
            this.learningSignals = this.learningSignals.filter((s) => s.strength <= 0.6);
            log.info('🧠 Applied feedback learning with autonomous actions', LogContext.AI, {
                appliedInsights,
                parameterAdjustments,
                learningSignalsProcessed,
                autonomousActionsQueued,
            });
            return {
                appliedInsights,
                parameterAdjustments,
                learningSignalsProcessed,
                autonomousActionsQueued,
            };
        }
        catch (error) {
            log.error('Error applying feedback learning', LogContext.AI, { error });
            return {
                appliedInsights: 0,
                parameterAdjustments: 0,
                learningSignalsProcessed: 0,
                autonomousActionsQueued: 0,
            };
        }
    }
    async getFeedbackDashboard() {
        try {
            const { data: recentFeedback, error } = await this.supabase
                .from('user_feedback')
                .select('*')
                .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                .order('timestamp', { ascending: false });
            if (error) {
                throw error;
            }
            const feedbacks = recentFeedback || [];
            const totalFeedbacks = feedbacks.length;
            const averageSatisfaction = totalFeedbacks > 0
                ? feedbacks.reduce((sum, f) => sum + f.overall_satisfaction, 0) /
                    totalFeedbacks
                : 0;
            const feedbackTrends = this.calculateFeedbackTrends(feedbacks);
            const topIssues = this.extractTopIssues(feedbacks);
            const improvementSuggestions = this.extractImprovementSuggestions(feedbacks);
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
        }
        catch (error) {
            log.error('Error getting feedback dashboard', LogContext.AI, { error });
            throw error;
        }
    }
    extractLearningSignals(feedback) {
        const signals = [];
        if (feedback.qualityRating <= 2) {
            signals.push({
                source: 'user_feedback',
                signal: 'Low quality rating indicates potential temperature/randomness issues',
                strength: 0.8,
                taskType: feedback.taskType,
                parameterAffected: 'temperature',
                recommendedAction: feedback.taskType === TaskType.CREATIVE_WRITING ? 'decrease' : 'experiment',
                evidence: [{ feedbackId: feedback.id, rating: feedback.qualityRating }],
            });
        }
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
    async triggerImmediateLearning(feedback) {
        try {
            const performanceScore = (feedback.qualityRating * 0.3 +
                feedback.accuracyRating * 0.3 +
                feedback.usefulnessRating * 0.2 +
                feedback.overallSatisfaction * 0.2) /
                5;
            await mlParameterOptimizer.learnFromExecution(feedback.taskType, feedback.parameters, performanceScore, feedback.responseTime, {
                userFeedback: true,
                feedbackId: feedback.id,
                qualityRating: feedback.qualityRating,
                accuracyRating: feedback.accuracyRating,
                flaggedAsIncorrect: feedback.flaggedAsIncorrect,
            });
            log.debug('🎯 Triggered immediate learning from negative feedback', LogContext.AI, {
                feedbackId: feedback.id,
                performanceScore,
            });
        }
        catch (error) {
            log.error('Failed to trigger immediate learning', LogContext.AI, { error });
        }
    }
    async flushFeedbackBuffer() {
        if (this.feedbackBuffer.length === 0 || !this.supabase) {
            return;
        }
        try {
            const feedbacks = this.feedbackBuffer.splice(0);
            const { error } = await this.supabase.from('user_feedback').insert(feedbacks.map((f) => ({
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
            })));
            if (error) {
                log.error('Failed to flush feedback buffer', LogContext.AI, { error });
                this.feedbackBuffer = [...feedbacks, ...this.feedbackBuffer];
            }
            else {
                log.debug(`✅ Flushed ${feedbacks.length} feedbacks to database`, LogContext.AI);
            }
        }
        catch (error) {
            log.error('Error flushing feedback buffer', LogContext.AI, { error });
        }
    }
    calculateFeedbackAggregation(taskType, feedbacks) {
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
            correlationWithSpeed: this.calculateCorrelation(feedbacks, 'speed_rating', 'overall_satisfaction'),
            correlationWithAccuracy: this.calculateCorrelation(feedbacks, 'accuracy_rating', 'overall_satisfaction'),
            feedbackReliability: Math.min(1, totalFeedbacks / 50),
            sampleSize: totalFeedbacks,
            lastUpdated: new Date(),
        };
    }
    calculateAverage(feedbacks, field) {
        if (feedbacks.length === 0)
            return 0;
        return feedbacks.reduce((sum, f) => sum + (f[field] || 0), 0) / feedbacks.length;
    }
    calculateOverallSentiment(feedbacks) {
        const avgSatisfaction = this.calculateAverage(feedbacks, 'overall_satisfaction');
        if (avgSatisfaction >= 4)
            return 'positive';
        if (avgSatisfaction <= 2)
            return 'negative';
        return 'neutral';
    }
    extractCommonIssues(feedbacks) {
        const issueMap = new Map();
        feedbacks.forEach((f) => {
            if (f.reported_issues) {
                f.reported_issues.forEach((issue) => {
                    issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
                });
            }
        });
        return Array.from(issueMap.entries())
            .map(([issue, frequency]) => ({ issue, frequency }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);
    }
    extractImprovementSuggestions(feedbacks) {
        const suggestionMap = new Map();
        feedbacks.forEach((f) => {
            if (f.improvement_suggestions) {
                f.improvement_suggestions.forEach((suggestion) => {
                    suggestionMap.set(suggestion, (suggestionMap.get(suggestion) || 0) + 1);
                });
            }
        });
        return Array.from(suggestionMap.entries())
            .map(([suggestion, votes]) => ({ suggestion, votes }))
            .sort((a, b) => b.votes - a.votes)
            .slice(0, 10);
    }
    extractTopIssues(feedbacks) {
        return this.extractCommonIssues(feedbacks).slice(0, 5);
    }
    calculateCorrelation(feedbacks, field1, field2) {
        if (feedbacks.length < THREE)
            return 0;
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
    calculateFeedbackTrends(feedbacks) {
        const dailyData = new Map();
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
    groupFeedbackByIssues(feedbacks) {
        const groups = new Map();
        feedbacks.forEach((f) => {
            if (f.reported_issues && f.reported_issues.length > 0) {
                f.reported_issues.forEach((issue) => {
                    if (!groups.has(issue)) {
                        groups.set(issue, []);
                    }
                    groups.get(issue).push(f);
                });
            }
        });
        return groups;
    }
    createInsightFromIssue(issue, feedbacks) {
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
            estimatedImprovement: (5 - avgSatisfaction) * 0.2,
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
    async analyzeParameterPerformanceCorrelations() {
        return [];
    }
    async applyParameterLearning(insight) {
        log.info('📚 Applied parameter learning from insight', LogContext.AI, {
            insightType: insight.type,
            confidence: insight.confidence,
        });
    }
    async processLearningSignal(signal) {
        log.debug('🔄 Processed learning signal', LogContext.AI, {
            signal: signal.signal,
            strength: signal.strength,
            taskType: signal.taskType,
        });
    }
    generateFeedbackId() {
        return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async queueAutonomousAction(insight) {
        try {
            const autonomousAction = {
                id: `feedback_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'parameter_adjustment',
                priority: insight.priority,
                target: {
                    service: insight.taskType ? `intelligent_parameter_service` : 'system',
                    component: insight.taskType || 'configuration',
                    property: insight.recommendation.toLowerCase().replace(/\s+/g, '_'),
                },
                change: {
                    from: null,
                    to: insight.recommendation,
                    rationale: insight.insight,
                },
                assessment: {
                    riskLevel: this.mapPriorityToRisk(insight.priority),
                    confidenceScore: insight.confidence,
                    expectedImpact: insight.estimatedImprovement,
                    implementationComplexity: 'simple',
                    reversibilityScore: 0.9,
                },
                evidence: {
                    sources: ['feedback_integration_service'],
                    supportingData: [insight],
                    historicalPerformance: {
                        feedbackVolume: insight.metrics.feedbackVolume,
                        severityScore: insight.metrics.severityScore,
                        urgencyScore: insight.metrics.urgencyScore,
                    },
                    userImpact: {
                        affectedUsers: insight.affectedUsers,
                        potentialBenefit: `${insight.estimatedImprovement}% improvement in user satisfaction`,
                    },
                },
                execution: {
                    method: 'immediate',
                    rollbackTriggers: [
                        {
                            metric: 'error_rate',
                            threshold: 0.05,
                            operator: 'gt',
                        },
                    ],
                    monitoringPeriod: 300000,
                    successCriteria: [
                        {
                            metric: 'user_satisfaction',
                            improvementTarget: 0.1,
                        },
                    ],
                },
                createdAt: new Date(),
                status: 'pending',
            };
            await autonomousActionLoopService.queueAction(autonomousAction);
            log.info('🎯 Queued autonomous action from feedback insight', LogContext.AI, {
                actionId: autonomousAction.id,
                insightType: insight.type,
                confidence: insight.confidence,
                priority: insight.priority,
            });
        }
        catch (error) {
            log.error('Failed to queue autonomous action from insight', LogContext.AI, {
                error,
                insight,
            });
        }
    }
    async queueLearningSignalAction(signal) {
        try {
            const autonomousAction = {
                id: `signal_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'parameter_adjustment',
                priority: (signal.strength > 0.8 ? 'high' : signal.strength > 0.7 ? 'medium' : 'low'),
                target: {
                    service: 'intelligent_parameter_service',
                    component: signal.taskType,
                    property: signal.parameterAffected,
                },
                change: {
                    from: null,
                    to: signal.recommendedAction,
                    rationale: signal.signal,
                },
                assessment: {
                    riskLevel: (signal.strength > 0.8 ? 'medium' : 'low'),
                    confidenceScore: signal.strength,
                    expectedImpact: signal.strength * 0.1,
                    implementationComplexity: 'simple',
                    reversibilityScore: 0.9,
                },
                evidence: {
                    sources: ['learning_signal'],
                    supportingData: [signal],
                    historicalPerformance: {
                        signal: signal.signal,
                        strength: signal.strength,
                        taskType: signal.taskType,
                    },
                    userImpact: {
                        affectedUsers: 1,
                        potentialBenefit: `Expected ${signal.recommendedAction} of ${signal.parameterAffected} for ${signal.taskType}`,
                    },
                },
                execution: {
                    method: 'immediate',
                    rollbackTriggers: [
                        {
                            metric: 'error_rate',
                            threshold: 0.05,
                            operator: 'gt',
                        },
                    ],
                    monitoringPeriod: 300000,
                    successCriteria: [
                        {
                            metric: 'performance',
                            improvementTarget: 0.05,
                        },
                    ],
                },
                createdAt: new Date(),
                status: 'pending',
            };
            await autonomousActionLoopService.queueAction(autonomousAction);
            log.info('📡 Queued autonomous action from learning signal', LogContext.AI, {
                actionId: autonomousAction.id,
                signal: signal.signal,
                strength: signal.strength,
                taskType: signal.taskType,
            });
        }
        catch (error) {
            log.error('Failed to queue autonomous action from learning signal', LogContext.AI, {
                error,
                signal,
            });
        }
    }
    async generateImprovementInsights() {
        try {
            const insights = [];
            const { data: highPerformingFeedback, error } = await this.supabase
                .from('user_feedback')
                .select('*')
                .gte('overall_satisfaction', 4)
                .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('overall_satisfaction', { ascending: false })
                .limit(50);
            if (error || !highPerformingFeedback || highPerformingFeedback.length < 5) {
                return insights;
            }
            const taskTypeGroups = new Map();
            highPerformingFeedback.forEach((feedback) => {
                const taskType = feedback.task_type;
                if (!taskTypeGroups.has(taskType)) {
                    taskTypeGroups.set(taskType, []);
                }
                taskTypeGroups.get(taskType).push(feedback);
            });
            for (const [taskType, feedbacks] of taskTypeGroups.entries()) {
                if (feedbacks.length >= 3) {
                    const avgSatisfaction = feedbacks.reduce((sum, f) => sum + f.overall_satisfaction, 0) / feedbacks.length;
                    if (avgSatisfaction >= 4.5) {
                        insights.push({
                            type: 'improvement_opportunity',
                            priority: 'medium',
                            insight: `Task type ${taskType} shows exceptional performance with ${avgSatisfaction.toFixed(1)}/5 satisfaction`,
                            recommendation: `Apply successful patterns from ${taskType} to similar task types`,
                            impact: `Could improve satisfaction across ${taskTypeGroups.size - 1} other task types`,
                            confidence: Math.min(feedbacks.length / 10, 0.9),
                            supportingFeedbacks: feedbacks.map((f) => f.id),
                            affectedUsers: new Set(feedbacks.map((f) => f.user_id || f.session_id)).size,
                            estimatedImprovement: (avgSatisfaction - 3.5) * 0.2,
                            actionItems: [
                                {
                                    action: `Analyze high-performing parameters for ${taskType}`,
                                    owner: 'autonomous_system',
                                    estimatedEffort: 'low',
                                    timeline: '1-2 days',
                                },
                            ],
                            metrics: {
                                feedbackVolume: feedbacks.length,
                                severityScore: 5 - avgSatisfaction,
                                urgencyScore: feedbacks.length / 10,
                            },
                        });
                    }
                }
            }
            return insights;
        }
        catch (error) {
            log.error('Error generating improvement insights', LogContext.AI, { error });
            return [];
        }
    }
    mapPriorityToRisk(priority) {
        const riskMapping = {
            low: 'low',
            medium: 'low',
            high: 'medium',
            critical: 'high',
        };
        return riskMapping[priority];
    }
    estimateExecutionDuration(insight) {
        const effortMapping = {
            low: '5-15 minutes',
            medium: '15-45 minutes',
            high: '45-120 minutes',
        };
        const effort = insight.actionItems[0]?.estimatedEffort || 'medium';
        return effortMapping[effort] || '15-45 minutes';
    }
    startPeriodicProcessing() {
        setInterval(() => {
            this.flushFeedbackBuffer().catch((error) => {
                log.error('Periodic feedback flush failed', LogContext.AI, { error });
            });
        }, this.flushInterval);
        setInterval(async () => {
            try {
                const results = await this.applyFeedbackLearning();
                if (results.autonomousActionsQueued > 0) {
                    log.info('🤖 Queued autonomous actions from feedback learning', LogContext.AI, {
                        actionsQueued: results.autonomousActionsQueued,
                        totalLearningResults: results,
                    });
                }
            }
            catch (error) {
                log.error('Periodic feedback learning failed', LogContext.AI, { error });
            }
        }, 15 * 60 * 1000);
    }
}
export const feedbackIntegrationService = new FeedbackIntegrationService();
export default feedbackIntegrationService;
//# sourceMappingURL=feedback-integration-service.js.map
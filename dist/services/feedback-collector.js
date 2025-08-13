import { EventEmitter } from 'events';
import { bayesianModelRegistry } from '../utils/bayesian-model';
import { THREE } from '../utils/constants';
import { log, LogContext } from '../utils/logger';
import { createPersistentCache } from '../utils/persistent-cache';
import { abMCTSService } from './ab-mcts-service';
export class FeedbackCollectorService extends EventEmitter {
    config;
    feedbackQueue = [];
    feedbackHistory = createPersistentCache('feedback_history', 24 * 3600);
    aggregations = createPersistentCache('feedback_agg', 12 * 3600);
    flushTimer;
    isProcessing = false;
    constructor(config = {}) {
        super();
        this.config = {
            batchSize: 50,
            flushInterval: 5000,
            retentionPeriod: 24 * 60 * 60 * 1000,
            enableRealTimeProcessing: true,
            enableAggregation: true,
            qualityThreshold: 0.3,
            ...config,
        };
        this.startFlushTimer();
        this.setupHealthMonitorIntegration();
    }
    async collectFeedback(feedback) {
        log.debug('📊 Collecting feedback', LogContext.AI, {
            nodeId: feedback.nodeId,
            reward: feedback.reward.value,
            userRating: feedback.userRating,
        });
        this.feedbackQueue.push(feedback);
        const key = `${feedback.context.taskType}:${feedback.context.sessionId}`;
        const existingHistory = await this.feedbackHistory.get(key);
        if (!existingHistory) {
            await this.feedbackHistory.set(key, [feedback]);
        }
        else {
            existingHistory.push(feedback);
            await this.feedbackHistory.set(key, existingHistory);
        }
        if (this.config.enableRealTimeProcessing) {
            this.emit('feedback', feedback);
        }
        if (this.feedbackQueue.length >= this.config.batchSize) {
            await this.processBatch();
        }
        if (this.config.enableAggregation) {
            await this.updateAggregations(feedback);
        }
    }
    setupHealthMonitorIntegration() {
        setInterval(async () => {
            const healthStatus = await this.getHealthMetrics();
            if (healthStatus) {
                const systemFeedback = this.createSystemHealthFeedback(healthStatus);
                if (systemFeedback) {
                    await this.collectFeedback(systemFeedback);
                }
            }
        }, 30000);
    }
    async processBatch() {
        if (this.isProcessing || this.feedbackQueue.length === 0) {
            return;
        }
        this.isProcessing = true;
        const batch = this.feedbackQueue.splice(0, this.config.batchSize);
        log.info('🔄 Processing feedback batch', LogContext.AI, {
            batchSize: batch.length,
            remainingQueue: this.feedbackQueue.length,
        });
        try {
            for (const feedback of batch) {
                await this.processSingleFeedback(feedback);
            }
            await Promise.all(batch.map((feedback) => abMCTSService.processFeedback(feedback)));
            this.emit('batchProcessed', {
                size: batch.length,
                averageReward: this.calculateAverageReward(batch),
                timestamp: Date.now(),
            });
        }
        catch (error) {
            log.error('❌ Failed to process feedback batch', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
                batchSize: batch.length,
            });
            this.feedbackQueue.unshift(...batch);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processSingleFeedback(feedback) {
        if (feedback.reward.value < this.config.qualityThreshold && !feedback.errorOccurred) {
            log.warn('⚠️ Low quality feedback detected', LogContext.AI, {
                nodeId: feedback.nodeId,
                reward: feedback.reward.value,
                threshold: this.config.qualityThreshold,
            });
        }
        const agentName = this.extractAgentName(feedback);
        if (agentName) {
            const observation = {
                timestamp: feedback.timestamp,
                success: feedback.reward.value > 0.5,
                executionTime: feedback.reward.metadata.executionTime,
                resourceUsage: feedback.reward.metadata.tokensUsed + feedback.reward.metadata.memoryUsed,
                reward: feedback.reward.value,
                context: feedback.context,
            };
            const model = bayesianModelRegistry.getModel(agentName, feedback.context.taskType);
            model.update(observation);
        }
        this.detectAnomalies(feedback);
    }
    async updateAggregations(feedback) {
        const agentName = this.extractAgentName(feedback);
        if (!agentName)
            return;
        const key = `${agentName}:${feedback.context.taskType}`;
        let agg = await this.aggregations.get(key);
        if (!agg) {
            agg = {
                agentName,
                taskType: feedback.context.taskType,
                count: 0,
                metrics: {
                    totalFeedbacks: 0,
                    averageReward: 0,
                    successRate: 0,
                    averageExecutionTime: 0,
                    errorRate: 0,
                    userSatisfaction: 0,
                },
                trend: 'stable',
            };
        }
        agg.count++;
        const alpha = 0.1;
        agg.metrics.totalFeedbacks++;
        agg.metrics.averageReward =
            alpha * feedback.reward.value + (1 - alpha) * agg.metrics.averageReward;
        agg.metrics.successRate =
            alpha * (feedback.reward.value > 0.5 ? 1 : 0) + (1 - alpha) * agg.metrics.successRate;
        agg.metrics.averageExecutionTime =
            alpha * feedback.reward.metadata.executionTime +
                (1 - alpha) * agg.metrics.averageExecutionTime;
        agg.metrics.errorRate =
            alpha * (feedback.errorOccurred ? 1 : 0) + (1 - alpha) * agg.metrics.errorRate;
        agg.metrics.userSatisfaction = feedback.userRating
            ? alpha * (feedback.userRating / 5) + (1 - alpha) * agg.metrics.userSatisfaction
            : agg.metrics.userSatisfaction;
        agg.trend = await this.calculateTrend(key);
        await this.aggregations.set(key, agg);
    }
    detectAnomalies(feedback) {
        const anomalies = [];
        if (feedback.reward.metadata.executionTime > 30000) {
            anomalies.push('Extremely high execution time');
        }
        if (feedback.errorOccurred && feedback.reward.value === 0) {
            anomalies.push('Complete failure detected');
        }
        if (feedback.reward.metadata.tokensUsed > 5000) {
            anomalies.push('High token usage');
        }
        if (feedback.userRating && feedback.userRating <= 2) {
            anomalies.push('Low user satisfaction');
        }
        if (anomalies.length > 0) {
            log.warn('🚨 Anomalies detected in feedback', LogContext.AI, {
                nodeId: feedback.nodeId,
                anomalies,
                reward: feedback.reward.value,
            });
            this.emit('anomaly', {
                feedback,
                anomalies,
                timestamp: Date.now(),
            });
        }
    }
    startFlushTimer() {
        this.flushTimer = setInterval(async () => {
            if (this.feedbackQueue.length > 0) {
                await this.processBatch();
            }
            await this.cleanOldFeedback();
        }, this.config.flushInterval);
    }
    async cleanOldFeedback() {
        try {
            const cutoff = Date.now() - this.config.retentionPeriod;
            const keys = await this.feedbackHistory.keys('*');
            for (const key of keys) {
                const feedbacks = await this.feedbackHistory.get(key);
                if (!feedbacks)
                    continue;
                const filtered = feedbacks.filter((f) => f.timestamp > cutoff);
                if (filtered.length === 0) {
                    await this.feedbackHistory.delete(key);
                }
                else if (filtered.length < feedbacks.length) {
                    await this.feedbackHistory.set(key, filtered);
                }
            }
        }
        catch (error) {
            log.error('Failed to clean old feedback', LogContext.AI, { error });
        }
    }
    async getMetrics() {
        try {
            const aggregations = [];
            const aggregationKeys = await this.aggregations.keys('*');
            for (const key of aggregationKeys) {
                const agg = await this.aggregations.get(key);
                if (agg) {
                    aggregations.push(agg);
                }
            }
            const recentFeedbacks = await this.getRecentFeedback(20);
            return {
                queueSize: this.feedbackQueue.length,
                totalProcessed: aggregations.reduce((sum, agg) => sum + agg.count, 0),
                aggregations,
                recentFeedbacks,
            };
        }
        catch (error) {
            log.error('Failed to get metrics', LogContext.AI, { error });
            return {
                queueSize: this.feedbackQueue.length,
                totalProcessed: 0,
                aggregations: [],
                recentFeedbacks: [],
            };
        }
    }
    async getAggregatedMetrics(agentName, taskType) {
        try {
            return await this.aggregations.get(`${agentName}:${taskType}`);
        }
        catch (error) {
            log.error('Failed to get aggregated metrics', LogContext.AI, { error, agentName, taskType });
            return null;
        }
    }
    async getRecentFeedback(limit = 50, minTimestamp) {
        try {
            const allFeedbacks = [];
            const historyKeys = await this.feedbackHistory.keys('*');
            for (const key of historyKeys) {
                const feedbacks = await this.feedbackHistory.get(key);
                if (feedbacks) {
                    allFeedbacks.push(...feedbacks);
                }
            }
            const filtered = minTimestamp
                ? allFeedbacks.filter(f => f.timestamp > minTimestamp)
                : allFeedbacks;
            return filtered
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
        }
        catch (error) {
            log.error('Failed to get recent feedback', LogContext.AI, { error });
            return [];
        }
    }
    async generateReport() {
        const allFeedbacks = [];
        const totalFeedbacks = allFeedbacks.length;
        const averageQuality = totalFeedbacks > 0
            ? allFeedbacks.reduce((sum, f) => sum + f.reward.value, 0) / totalFeedbacks
            : 0;
        const byAgent = {};
        const byTaskType = {};
        const aggregationKeys = await this.aggregations.keys('*');
        for (const aggKey of aggregationKeys) {
            const agg = await this.aggregations.get(aggKey);
            if (!agg)
                continue;
            if (!byAgent[agg.agentName]) {
                byAgent[agg.agentName] = { ...agg.metrics };
            }
            if (!byTaskType[agg.taskType]) {
                byTaskType[agg.taskType] = {
                    totalFeedbacks: 0,
                    averageReward: 0,
                    successRate: 0,
                    averageExecutionTime: 0,
                    errorRate: 0,
                    userSatisfaction: 0,
                };
            }
            const taskMetrics = byTaskType[agg.taskType];
            if (taskMetrics) {
                taskMetrics.totalFeedbacks += agg.metrics.totalFeedbacks;
                taskMetrics.averageReward += agg.metrics.averageReward * agg.count;
                taskMetrics.successRate += agg.metrics.successRate * agg.count;
                taskMetrics.averageExecutionTime += agg.metrics.averageExecutionTime * agg.count;
                taskMetrics.errorRate += agg.metrics.errorRate * agg.count;
                taskMetrics.userSatisfaction += agg.metrics.userSatisfaction * agg.count;
            }
        }
        for (const [taskType, metrics] of Object.entries(byTaskType)) {
            let totalCount = 0;
            for (const aggKey of aggregationKeys) {
                const agg = await this.aggregations.get(aggKey);
                if (agg && agg.taskType === taskType) {
                    totalCount += agg.count;
                }
            }
            if (totalCount > 0) {
                metrics.averageReward /= totalCount;
                metrics.successRate /= totalCount;
                metrics.averageExecutionTime /= totalCount;
                metrics.errorRate /= totalCount;
                metrics.userSatisfaction /= totalCount;
            }
        }
        const agentScores = Object.entries(byAgent)
            .map(([name, metrics]) => ({
            name,
            score: metrics.averageReward * 0.5 + metrics.successRate * 0.3 + metrics.userSatisfaction * 0.2,
        }))
            .sort((a, b) => b.score - a.score);
        const topPerformers = agentScores.slice(0, THREE).map((a) => a.name);
        const needsImprovement = agentScores.slice(-3).map((a) => a.name);
        const recommendations = this.generateRecommendations(byAgent, byTaskType);
        return {
            summary: {
                totalFeedbacks,
                averageQuality,
                topPerformers,
                needsImprovement,
            },
            byAgent,
            byTaskType,
            recommendations,
        };
    }
    extractAgentName(feedback) {
        return feedback.context.taskType.split(':')[0] || null;
    }
    calculateAverageReward(feedbacks) {
        if (feedbacks.length === 0)
            return 0;
        return feedbacks.reduce((sum, f) => sum + f.reward.value, 0) / feedbacks.length;
    }
    async calculateTrend(key) {
        const feedbacks = await this.feedbackHistory.get(key);
        if (!feedbacks || feedbacks.length < 10)
            return 'stable';
        const recent = feedbacks.slice(-5);
        const older = feedbacks.slice(-10, -5);
        const recentAvg = this.calculateAverageReward(recent);
        const olderAvg = this.calculateAverageReward(older);
        if (recentAvg > olderAvg + 0.1)
            return 'improving';
        if (recentAvg < olderAvg - 0.1)
            return 'declining';
        return 'stable';
    }
    generateRecommendations(byAgent, byTaskType) {
        const recommendations = [];
        for (const [agent, metrics] of Object.entries(byAgent)) {
            if (metrics.errorRate > 0.2) {
                recommendations.push(`${agent} has high error rate (${(metrics.errorRate * 100).toFixed(1)}%) - investigate failures`);
            }
            if (metrics.averageExecutionTime > 10000) {
                recommendations.push(`${agent} is slow (avg ${(metrics.averageExecutionTime / 1000).toFixed(1)}s) - consider optimization`);
            }
            if (metrics.userSatisfaction < 0.6 && metrics.totalFeedbacks > 10) {
                recommendations.push(`${agent} has low user satisfaction - review quality`);
            }
        }
        for (const [taskType, metrics] of Object.entries(byTaskType)) {
            if (metrics.successRate < 0.7) {
                recommendations.push(`${taskType} tasks have low success rate - consider using different agents`);
            }
        }
        return recommendations;
    }
    async getHealthMetrics() {
        return {
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            responseTime: Math.random() * 1000,
        };
    }
    createSystemHealthFeedback(healthStatus) {
        if ((healthStatus?.cpu ?? 0) > 80 ||
            (healthStatus?.memory ?? 0) > 80 ||
            (healthStatus?.responseTime ?? 0) > 5000) {
            return {
                nodeId: `system-health-${Date.now()}`,
                reward: {
                    value: 0.3,
                    components: {
                        quality: 0.5,
                        speed: (healthStatus?.responseTime ?? 0) < 5000 ? 0.7 : 0.2,
                        cost: 1 - (healthStatus?.cpu ?? 0) / 100,
                    },
                    metadata: {
                        executionTime: healthStatus?.responseTime ?? 0,
                        tokensUsed: 0,
                        memoryUsed: healthStatus?.memory ?? 0,
                        errors: 0,
                    },
                },
                errorOccurred: false,
                timestamp: Date.now(),
                context: {
                    taskType: 'system-health',
                    sessionId: 'system',
                },
            };
        }
        return null;
    }
    shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        this.processBatch().then(() => {
            log.info('✅ Feedback collector shutdown complete', LogContext.AI);
        });
    }
}
export const feedbackCollector = new FeedbackCollectorService();
export default feedbackCollector;
//# sourceMappingURL=feedback-collector.js.map
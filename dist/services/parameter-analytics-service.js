import { createClient } from '@supabase/supabase-js';
import { TaskType } from '@/types';
import { config } from '../config/environment';
import { THREE, TWO } from '../utils/constants';
import { log, LogContext } from '../utils/logger';
export class ParameterAnalyticsService {
    supabase;
    executionBuffer = [];
    bufferSize = 100;
    flushInterval = 30000;
    effectivenessCache = new Map();
    cacheExpiryTime = 300000;
    constructor() {
        this.initializeSupabase();
        this.startPeriodicFlush();
    }
    initializeSupabase() {
        try {
            if (!config.supabase.url || !config.supabase.serviceKey) {
                throw new Error('Supabase configuration missing');
            }
            this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
            log.info('✅ Parameter Analytics Service initialized with Supabase', LogContext.AI);
        }
        catch (error) {
            log.error('❌ Failed to initialize Parameter Analytics Service', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async recordExecution(execution) {
        const fullExecution = {
            ...execution,
            id: this.generateExecutionId(),
            timestamp: new Date(),
        };
        this.executionBuffer.push(fullExecution);
        if (this.executionBuffer.length >= this.bufferSize) {
            await this.flushExecutionBuffer();
        }
        this.updateEffectivenessCache(fullExecution);
        log.debug('📊 Parameter execution recorded', LogContext.AI, {
            taskType: execution.taskType,
            success: execution.success,
            executionTime: execution.executionTime,
        });
    }
    async getParameterEffectiveness(taskType, timeRange) {
        try {
            if (!this.supabase) {
                log.error('Supabase client not initialized', LogContext.AI);
                return [];
            }
            let query = this.supabase
                .from('parameter_executions')
                .select('*')
                .eq('task_type', taskType);
            if (timeRange) {
                query = query
                    .gte('timestamp', timeRange.start.toISOString())
                    .lte('timestamp', timeRange.end.toISOString());
            }
            const { data: executions, error } = await query;
            if (error) {
                log.error('Failed to fetch parameter executions', LogContext.AI, { error });
                return [];
            }
            return this.aggregateEffectiveness(executions || []);
        }
        catch (error) {
            log.error('Error getting parameter effectiveness', LogContext.AI, { error });
            return [];
        }
    }
    async getOptimizationInsights(taskType) {
        try {
            const insights = [];
            const taskTypes = taskType ? [taskType] : Object.values(TaskType);
            for (const type of taskTypes) {
                const effectiveness = await this.getParameterEffectiveness(type);
                const insight = this.generateInsights(type, effectiveness);
                if (insight) {
                    insights.push(insight);
                }
            }
            return insights.sort((a, b) => b.confidence - a.confidence);
        }
        catch (error) {
            log.error('Error generating optimization insights', LogContext.AI, { error });
            return [];
        }
    }
    async getDashboardMetrics() {
        try {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const { data: executions, error } = await this.supabase
                .from('parameter_executions')
                .select('*')
                .gte('timestamp', yesterday.toISOString());
            if (error) {
                log.error('Failed to fetch dashboard metrics', LogContext.AI, { error });
                return this.getEmptyDashboard();
            }
            const totalExecutions = executions?.length || 0;
            const successfulExecutions = executions?.filter((e) => e.success).length || 0;
            const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;
            const avgResponseTime = totalExecutions > 0
                ? executions.reduce((sum, e) => sum + e.execution_time, 0) / totalExecutions
                : 0;
            const topPerformingTasks = this.calculateTopPerformingTasks(executions || []);
            const recentInsights = await this.getOptimizationInsights();
            const parameterTrends = this.calculateParameterTrends(executions || []);
            return {
                totalExecutions,
                successRate,
                avgResponseTime,
                topPerformingTasks,
                recentInsights: recentInsights.slice(0, 5),
                parameterTrends,
            };
        }
        catch (error) {
            log.error('Error getting dashboard metrics', LogContext.AI, { error });
            return this.getEmptyDashboard();
        }
    }
    async getRecentPerformance(minutes) {
        try {
            const since = new Date(Date.now() - minutes * 60000);
            const { data: executions, error } = await this.supabase
                .from('parameter_executions')
                .select('*')
                .gte('timestamp', since.toISOString())
                .order('timestamp', { ascending: false });
            if (error) {
                log.error('Failed to fetch recent performance data', LogContext.AI, { error });
                return [];
            }
            return (executions || []).map((e) => ({
                timestamp: new Date(e.timestamp).getTime(),
                executionTime: e.execution_time,
                success: e.success,
                agent: e.task_type,
                confidence: e.response_quality || 0.8,
            }));
        }
        catch (error) {
            log.error('Error getting recent performance', LogContext.AI, { error });
            return [];
        }
    }
    async recordUserFeedback(executionId, satisfaction, qualityRating, feedback) {
        try {
            const { error } = await this.supabase
                .from('parameter_executions')
                .update({
                user_satisfaction: satisfaction,
                response_quality: qualityRating,
                user_feedback: feedback,
                updated_at: new Date().toISOString(),
            })
                .eq('id', executionId);
            if (error) {
                log.error('Failed to record user feedback', LogContext.AI, { error });
                return;
            }
            log.info('✅ User feedback recorded for parameter optimization', LogContext.AI, {
                executionId,
                satisfaction,
                qualityRating,
            });
        }
        catch (error) {
            log.error('Error recording user feedback', LogContext.AI, { error });
        }
    }
    async getParameterRecommendations(taskType, context) {
        try {
            const effectiveness = await this.getParameterEffectiveness(taskType);
            const relevantData = effectiveness.filter((e) => {
                if (context.complexity && e.parameters.maxTokens) {
                    const tokenRange = this.getTokenRangeForComplexity(context.complexity);
                    if (e.parameters.maxTokens < tokenRange.min || e.parameters.maxTokens > tokenRange.max) {
                        return false;
                    }
                }
                return true;
            });
            if (relevantData.length === 0) {
                return this.getDefaultRecommendations(taskType);
            }
            const bestPerforming = relevantData.reduce((best, current) => {
                const bestScore = this.calculatePerformanceScore(best);
                const currentScore = this.calculatePerformanceScore(current);
                return currentScore > bestScore ? current : best;
            });
            const alternatives = relevantData
                .filter((e) => e !== bestPerforming)
                .sort((a, b) => this.calculatePerformanceScore(b) - this.calculatePerformanceScore(a))
                .slice(0, THREE)
                .map((e) => ({
                parameters: e.parameters,
                expectedPerformance: this.calculatePerformanceScore(e),
                tradeoffs: this.generateTradeoffAnalysis(bestPerforming, e),
            }));
            return {
                recommended: bestPerforming.parameters,
                confidence: bestPerforming.confidenceScore,
                reasoning: this.generateRecommendationReasoning(bestPerforming),
                alternativeOptions: alternatives,
            };
        }
        catch (error) {
            log.error('Error getting parameter recommendations', LogContext.AI, { error });
            return this.getDefaultRecommendations(taskType);
        }
    }
    async flushExecutionBuffer() {
        if (this.executionBuffer.length === 0 || !this.supabase) {
            return;
        }
        try {
            const executions = this.executionBuffer.splice(0);
            const { error } = await this.supabase.from('parameter_executions').insert(executions.map((e) => ({
                id: e.id,
                task_type: e.taskType,
                user_input: e.userInput,
                parameters: e.parameters,
                model: e.model,
                provider: e.provider,
                user_id: e.userId,
                request_id: e.requestId,
                timestamp: e.timestamp.toISOString(),
                execution_time: e.executionTime,
                token_usage: e.tokenUsage,
                response_length: e.responseLength,
                response_quality: e.responseQuality,
                user_satisfaction: e.userSatisfaction,
                success: e.success,
                error_type: e.errorType,
                retry_count: e.retryCount,
                complexity: e.complexity,
                domain: e.domain,
                endpoint: e.endpoint,
            })));
            if (error) {
                log.error('Failed to flush execution buffer', LogContext.AI, { error });
                this.executionBuffer = [...executions, ...this.executionBuffer];
            }
            else {
                log.debug(`✅ Flushed ${executions.length} parameter executions to database`, LogContext.AI);
            }
        }
        catch (error) {
            log.error('Error flushing execution buffer', LogContext.AI, { error });
        }
    }
    updateEffectivenessCache(execution) {
        const cacheKey = `${execution.taskType}_${this.hashParameters(execution.parameters)}`;
        const existing = this.effectivenessCache.get(cacheKey);
        if (existing) {
            existing.totalExecutions++;
            existing.successRate =
                (existing.successRate * (existing.totalExecutions - 1) + (execution.success ? 1 : 0)) /
                    existing.totalExecutions;
            existing.avgExecutionTime =
                (existing.avgExecutionTime * (existing.totalExecutions - 1) + execution.executionTime) /
                    existing.totalExecutions;
            existing.lastUpdated = new Date();
        }
        else {
            this.effectivenessCache.set(cacheKey, {
                taskType: execution.taskType,
                parameterSet: cacheKey,
                parameters: execution.parameters,
                totalExecutions: 1,
                successRate: execution.success ? 1 : 0,
                avgExecutionTime: execution.executionTime,
                avgTokenUsage: execution.tokenUsage.totalTokens,
                avgResponseQuality: execution.responseQuality || 0,
                avgUserSatisfaction: execution.userSatisfaction || 0,
                qualityTrend: 0,
                speedTrend: 0,
                costEfficiencyTrend: 0,
                lastUpdated: new Date(),
                confidenceScore: 0.1,
            });
        }
    }
    aggregateEffectiveness(executions) {
        const grouped = new Map();
        executions.forEach((exec) => {
            const key = `${exec.task_type}_${this.hashParameters(exec.parameters)}`;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(exec);
        });
        return Array.from(grouped.entries()).map(([key, execs]) => {
            const totalExecutions = execs.length;
            const successfulExecutions = execs.filter((e) => e.success).length;
            return {
                taskType: execs[0].task_type,
                parameterSet: key,
                parameters: execs[0].parameters,
                totalExecutions,
                successRate: successfulExecutions / totalExecutions,
                avgExecutionTime: execs.reduce((sum, e) => sum + e.execution_time, 0) / totalExecutions,
                avgTokenUsage: execs.reduce((sum, e) => sum + (e.token_usage?.total_tokens || 0), 0) / totalExecutions,
                avgResponseQuality: execs.reduce((sum, e) => sum + (e.response_quality || 0), 0) / totalExecutions,
                avgUserSatisfaction: execs.reduce((sum, e) => sum + (e.user_satisfaction || 0), 0) / totalExecutions,
                qualityTrend: this.calculateTrend(execs, 'response_quality'),
                speedTrend: this.calculateTrend(execs, 'execution_time', true),
                costEfficiencyTrend: this.calculateTrend(execs, 'token_usage.total_tokens', true),
                lastUpdated: new Date(Math.max(...execs.map((e) => new Date(e.timestamp).getTime()))),
                confidenceScore: Math.min(0.95, totalExecutions / 100),
            };
        });
    }
    generateInsights(taskType, effectiveness) {
        if (effectiveness.length < TWO)
            return null;
        const bestPerforming = effectiveness.reduce((best, current) => this.calculatePerformanceScore(current) > this.calculatePerformanceScore(best)
            ? current
            : best);
        const worstPerforming = effectiveness.reduce((worst, current) => this.calculatePerformanceScore(current) < this.calculatePerformanceScore(worst)
            ? current
            : worst);
        const improvementPercent = ((this.calculatePerformanceScore(bestPerforming) -
            this.calculatePerformanceScore(worstPerforming)) /
            this.calculatePerformanceScore(worstPerforming)) *
            100;
        if (improvementPercent < 10)
            return null;
        return {
            taskType,
            insight: `Using optimized parameters for ${taskType} can improve performance by ${improvementPercent.toFixed(1)}%`,
            recommendation: this.generateParameterRecommendation(bestPerforming.parameters),
            impact: improvementPercent > 50 ? 'high' : improvementPercent > 25 ? 'medium' : 'low',
            confidence: bestPerforming.confidenceScore,
            supportingData: {
                sampleSize: bestPerforming.totalExecutions,
                improvementPercent,
                currentMetric: this.calculatePerformanceScore(worstPerforming),
                optimizedMetric: this.calculatePerformanceScore(bestPerforming),
            },
        };
    }
    calculatePerformanceScore(effectiveness) {
        return (effectiveness.successRate * 0.4 +
            (1 - effectiveness.avgExecutionTime / 10000) * 0.2 +
            effectiveness.avgResponseQuality * 0.2 +
            (effectiveness.avgUserSatisfaction / 5) * 0.2);
    }
    calculateTrend(executions, field, inverted = false) {
        if (executions.length < 5)
            return 0;
        const sorted = executions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const half = Math.floor(sorted.length / TWO);
        const firstHalf = sorted.slice(0, half);
        const secondHalf = sorted.slice(-half);
        const firstAvg = firstHalf.reduce((sum, e) => sum + this.getNestedValue(e, field), 0) /
            firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, e) => sum + this.getNestedValue(e, field), 0) /
            secondHalf.length;
        const trend = (secondAvg - firstAvg) / firstAvg;
        return inverted ? -trend : trend;
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj) || 0;
    }
    generateExecutionId() {
        return `param_exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    hashParameters(params) {
        return Buffer.from(JSON.stringify(params)).toString('base64').substr(0, 16);
    }
    startPeriodicFlush() {
        setInterval(() => {
            this.flushExecutionBuffer();
        }, this.flushInterval);
    }
    getEmptyDashboard() {
        return {
            totalExecutions: 0,
            successRate: 0,
            avgResponseTime: 0,
            topPerformingTasks: [],
            recentInsights: [],
            parameterTrends: [],
        };
    }
    calculateTopPerformingTasks(executions) {
        const taskGroups = executions.reduce((groups, exec) => {
            if (!groups[exec.task_type]) {
                groups[exec.task_type] = [];
            }
            groups[exec.task_type].push(exec);
            return groups;
        }, {});
        return Object.entries(taskGroups)
            .map(([taskType, execs]) => ({
            taskType: taskType,
            score: execs.filter((e) => e.success).length / execs.length,
        }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }
    calculateParameterTrends(executions) {
        const taskGroups = executions.reduce((groups, exec) => {
            if (!groups[exec.task_type]) {
                groups[exec.task_type] = [];
            }
            groups[exec.task_type].push(exec);
            return groups;
        }, {});
        return Object.entries(taskGroups).map(([taskType, execs]) => {
            const trend = this.calculateTrend(execs, 'response_quality');
            return {
                taskType: taskType,
                trend: trend > 0.1 ? 'improving' : trend < -0.1 ? 'declining' : 'stable',
            };
        });
    }
    getTokenRangeForComplexity(complexity) {
        switch (complexity) {
            case 'simple':
                return { min: 50, max: 500 };
            case 'medium':
                return { min: 200, max: 1500 };
            case 'complex':
                return { min: 800, max: 4000 };
            default:
                return { min: 0, max: 10000 };
        }
    }
    getDefaultRecommendations(taskType) {
        return {
            recommended: { temperature: 0.5, maxTokens: 1024 },
            confidence: 0.1,
            reasoning: 'No historical data available, using default parameters',
            alternativeOptions: [],
        };
    }
    generateRecommendationReasoning(effectiveness) {
        return `Based on ${effectiveness.totalExecutions} executions with ${(effectiveness.successRate * 100).toFixed(1)}% success rate`;
    }
    generateTradeoffAnalysis(best, alternative) {
        const speedDiff = (((alternative.avgExecutionTime - best.avgExecutionTime) / best.avgExecutionTime) *
            100).toFixed(1);
        const qualityDiff = (((alternative.avgResponseQuality - best.avgResponseQuality) / best.avgResponseQuality) *
            100).toFixed(1);
        return `${speedDiff}% ${parseFloat(speedDiff) > 0 ? 'slower' : 'faster'}, ${qualityDiff}% ${parseFloat(qualityDiff) > 0 ? 'higher' : 'lower'} quality`;
    }
    generateParameterRecommendation(params) {
        const recommendations = [];
        if (params.temperature)
            recommendations.push(`temperature: ${params.temperature}`);
        if (params.maxTokens)
            recommendations.push(`maxTokens: ${params.maxTokens}`);
        if (params.topP)
            recommendations.push(`topP: ${params.topP}`);
        return `Recommended parameters: ${recommendations.join(', ')}`;
    }
}
export const parameterAnalyticsService = new ParameterAnalyticsService();
export default parameterAnalyticsService;
//# sourceMappingURL=parameter-analytics-service.js.map
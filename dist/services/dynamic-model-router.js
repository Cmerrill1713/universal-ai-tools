import { log, LogContext } from '@/utils/logger';
import { modelDiscoveryService } from './model-discovery-service';
export class DynamicModelRouter {
    performanceHistory = new Map();
    modelPerformance = new Map();
    routingWeights = new Map();
    maxHistoryPerModel = 100;
    learningRate = 0.1;
    constructor() {
        this.loadPerformanceHistory();
        this.startPerformanceAnalysis();
    }
    async route(taskType, prompt, options) {
        const requirements = {
            type: taskType,
            needs: options?.requiredCapabilities || this.inferCapabilities(taskType, prompt),
            priority: options?.priority || 'balanced',
            complexity: this.estimateComplexity(prompt),
            maxLatencyMs: options?.maxLatencyMs,
            minQuality: options?.minQuality,
        };
        const models = modelDiscoveryService.getModels();
        if (models.length === 0) {
            throw new Error('No models available');
        }
        const scores = models.map(model => ({
            model,
            score: this.scoreModel(model, requirements, prompt),
            estimatedLatency: this.estimateLatency(model, prompt.length),
        }));
        scores.sort((a, b) => b.score - a.score);
        const primaryScore = scores[0];
        if (!primaryScore) {
            throw new Error('No suitable models found for routing');
        }
        const primary = primaryScore.model;
        const fallbacks = this.selectFallbacks(scores.slice(1), primary, requirements);
        const decision = {
            primary,
            fallbacks,
            reasoning: this.explainDecision(primary, requirements, primaryScore.score),
            estimatedLatency: primaryScore.estimatedLatency,
            confidence: this.calculateConfidence(scores),
        };
        log.info('🎯 Routing decision made', LogContext.AI, {
            taskType,
            primary: `${primary.provider}:${primary.name}`,
            fallbackCount: fallbacks.length,
            confidence: decision.confidence,
            estimatedLatency: decision.estimatedLatency,
        });
        return decision;
    }
    scoreModel(model, requirements, prompt) {
        let score = 0;
        const baseScore = modelDiscoveryService['scoreModel'](model, requirements);
        score += baseScore;
        const perfKey = `${model.provider}:${model.id}`;
        const performance = this.modelPerformance.get(perfKey);
        if (performance) {
            score += performance.successRate * 20;
            if (requirements.priority === 'speed') {
                const latencyScore = Math.max(0, 100 - (performance.avgLatency / 100));
                score += latencyScore * 0.3;
            }
            if (requirements.priority === 'quality' && performance.avgQuality) {
                score += performance.avgQuality * 30;
            }
            score += Math.min(20, performance.avgTokensPerSecond / 10);
        }
        const weightKey = `${requirements.type}:${model.id}`;
        const learnedWeight = this.routingWeights.get(weightKey) || 1.0;
        score *= learnedWeight;
        const estimatedTokens = prompt.length / 4;
        if (estimatedTokens > 2000 && model.tier < 3) {
            score *= 0.7;
        }
        const providerStatus = modelDiscoveryService.getProviderStatus();
        if (providerStatus.get(model.provider)) {
            score += 5;
        }
        return score;
    }
    selectFallbacks(candidates, primary, requirements) {
        const fallbacks = [];
        const usedProviders = new Set([primary.provider]);
        const usedTiers = new Set([primary.tier]);
        for (const candidate of candidates) {
            if (fallbacks.length >= 2)
                break;
            const differentProvider = !usedProviders.has(candidate.model.provider);
            const differentTier = !usedTiers.has(candidate.model.tier);
            const hasCapabilities = requirements.needs.every(need => candidate.model.capabilities.includes(need));
            if (hasCapabilities && (differentProvider || differentTier)) {
                fallbacks.push(candidate.model);
                usedProviders.add(candidate.model.provider);
                usedTiers.add(candidate.model.tier);
            }
        }
        if (fallbacks.length < 2) {
            for (const candidate of candidates) {
                if (fallbacks.length >= 2)
                    break;
                if (!fallbacks.includes(candidate.model)) {
                    const hasCapabilities = requirements.needs.every(need => candidate.model.capabilities.includes(need));
                    if (hasCapabilities) {
                        fallbacks.push(candidate.model);
                    }
                }
            }
        }
        return fallbacks;
    }
    async trackPerformance(model, taskType, metrics) {
        const perfMetric = {
            modelId: model.id,
            provider: model.provider,
            taskType,
            latencyMs: metrics.latencyMs,
            tokensPerSecond: (metrics.tokensGenerated / metrics.latencyMs) * 1000,
            success: metrics.success,
            quality: metrics.quality,
            timestamp: Date.now(),
        };
        const key = `${model.provider}:${model.id}`;
        const history = this.performanceHistory.get(key) || [];
        history.push(perfMetric);
        if (history.length > this.maxHistoryPerModel) {
            history.shift();
        }
        this.performanceHistory.set(key, history);
        this.updateModelPerformance(key, history);
        this.updateRoutingWeights(model, taskType, metrics);
        await this.savePerformanceHistory();
    }
    updateModelPerformance(key, history) {
        if (history.length === 0)
            return;
        const recent = history.slice(-20);
        const avgLatency = recent.reduce((sum, m) => sum + m.latencyMs, 0) / recent.length;
        const avgTokensPerSecond = recent.reduce((sum, m) => sum + m.tokensPerSecond, 0) / recent.length;
        const successRate = recent.filter(m => m.success).length / recent.length;
        const qualityMetrics = recent.filter(m => m.quality !== undefined);
        const avgQuality = qualityMetrics.length > 0
            ? qualityMetrics.reduce((sum, m) => sum + m.quality, 0) / qualityMetrics.length
            : undefined;
        this.modelPerformance.set(key, {
            avgLatency,
            avgTokensPerSecond,
            successRate,
            avgQuality,
            sampleCount: history.length,
        });
    }
    updateRoutingWeights(model, taskType, metrics) {
        const key = `${taskType}:${model.id}`;
        const currentWeight = this.routingWeights.get(key) || 1.0;
        let adjustment = 0;
        if (metrics.success) {
            adjustment = 0.1;
            if (metrics.quality !== undefined) {
                adjustment *= metrics.quality;
            }
        }
        else {
            adjustment = -0.2;
        }
        const newWeight = currentWeight + (adjustment * this.learningRate);
        this.routingWeights.set(key, Math.max(0.1, Math.min(2.0, newWeight)));
    }
    inferCapabilities(taskType, prompt) {
        const capabilities = ['general'];
        if (taskType.includes('code') || taskType.includes('programming')) {
            capabilities.push('code_generation', 'debugging');
        }
        if (taskType.includes('chat') || taskType.includes('conversation')) {
            capabilities.push('conversation', 'instruction_following');
        }
        if (taskType.includes('analysis') || taskType.includes('reasoning')) {
            capabilities.push('reasoning', 'analysis');
        }
        if (taskType.includes('creative') || taskType.includes('writing')) {
            capabilities.push('creative_writing');
        }
        const promptLower = prompt.toLowerCase();
        if (promptLower.includes('debug') || promptLower.includes('error') || promptLower.includes('fix')) {
            capabilities.push('debugging');
        }
        if (promptLower.includes('explain') || promptLower.includes('why') || promptLower.includes('how')) {
            capabilities.push('reasoning');
        }
        if (promptLower.includes('write') || promptLower.includes('create') || promptLower.includes('generate')) {
            capabilities.push('creative_writing');
        }
        if (promptLower.includes('code') || promptLower.includes('function') || promptLower.includes('class')) {
            capabilities.push('code_generation');
        }
        return [...new Set(capabilities)];
    }
    estimateComplexity(prompt) {
        let complexity = 0.3;
        const words = prompt.split(/\s+/).length;
        if (words > 100)
            complexity += 0.2;
        if (words > 300)
            complexity += 0.2;
        const complexIndicators = [
            'analyze', 'explain', 'compare', 'evaluate', 'design',
            'implement', 'optimize', 'debug', 'refactor', 'architect'
        ];
        const promptLower = prompt.toLowerCase();
        for (const indicator of complexIndicators) {
            if (promptLower.includes(indicator)) {
                complexity += 0.1;
            }
        }
        if (prompt.includes('```') || prompt.includes('function') || prompt.includes('class')) {
            complexity += 0.2;
        }
        return Math.min(1.0, complexity);
    }
    estimateLatency(model, promptLength) {
        let baseLatency = 0;
        switch (model.tier) {
            case 1:
                baseLatency = 100;
                break;
            case 2:
                baseLatency = 300;
                break;
            case 3:
                baseLatency = 1000;
                break;
            case 4:
                baseLatency = 3000;
                break;
        }
        const perfKey = `${model.provider}:${model.id}`;
        const performance = this.modelPerformance.get(perfKey);
        if (performance) {
            baseLatency = performance.avgLatency;
        }
        const tokens = promptLength / 4;
        const scaleFactor = 1 + (tokens / 1000) * 0.5;
        return Math.round(baseLatency * scaleFactor);
    }
    explainDecision(model, requirements, score) {
        const reasons = [];
        reasons.push(`Selected ${model.name} (${model.provider})`);
        reasons.push(`Tier ${model.tier} model with ${model.estimatedSpeed} speed`);
        if (requirements.priority === 'speed') {
            reasons.push('Optimized for fast response time');
        }
        else if (requirements.priority === 'quality') {
            reasons.push('Optimized for response quality');
        }
        const performance = this.modelPerformance.get(`${model.provider}:${model.id}`);
        if (performance) {
            reasons.push(`Historical: ${Math.round(performance.avgLatency)}ms avg, ${Math.round(performance.successRate * 100)}% success`);
        }
        reasons.push(`Capabilities: ${model.capabilities.slice(0, 3).join(', ')}`);
        reasons.push(`Score: ${Math.round(score)}`);
        return reasons.join('. ');
    }
    calculateConfidence(scores) {
        if (scores.length === 0)
            return 0;
        if (scores.length === 1)
            return 0.5;
        const topScore = scores[0]?.score ?? 0;
        const secondScore = scores[1]?.score ?? 0;
        const separation = (topScore - secondScore) / topScore;
        return Math.min(0.95, 0.5 + separation);
    }
    async loadPerformanceHistory() {
        try {
            log.info('Performance history initialized', LogContext.AI);
        }
        catch (error) {
            log.warn('Failed to load performance history', LogContext.AI, { error });
        }
    }
    async savePerformanceHistory() {
        try {
        }
        catch (error) {
            log.warn('Failed to save performance history', LogContext.AI, { error });
        }
    }
    startPerformanceAnalysis() {
        setInterval(() => {
            this.analyzePerformanceTrends();
        }, 60000);
    }
    analyzePerformanceTrends() {
        for (const [key, performance] of this.modelPerformance.entries()) {
            if (performance.sampleCount < 5)
                continue;
            if (performance.successRate < 0.5) {
                log.warn('Model performing poorly', LogContext.AI, {
                    model: key,
                    successRate: performance.successRate,
                    samples: performance.sampleCount,
                });
            }
            if (performance.avgLatency > 5000) {
                log.warn('Model responding slowly', LogContext.AI, {
                    model: key,
                    avgLatency: performance.avgLatency,
                    samples: performance.sampleCount,
                });
            }
        }
    }
    getPerformanceReport() {
        return Object.fromEntries(this.modelPerformance);
    }
    getRoutingWeights() {
        return Object.fromEntries(this.routingWeights);
    }
    resetModelPerformance(modelId, provider) {
        const key = `${provider}:${modelId}`;
        this.performanceHistory.delete(key);
        this.modelPerformance.delete(key);
        for (const [weightKey] of this.routingWeights) {
            if (weightKey.includes(modelId)) {
                this.routingWeights.delete(weightKey);
            }
        }
    }
}
export const dynamicModelRouter = new DynamicModelRouter();
//# sourceMappingURL=dynamic-model-router.js.map
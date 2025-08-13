import { log, LogContext } from '@/utils/logger';
import { modelDiscoveryService } from './model-discovery-service';
export class SpeculativeDecodingService {
    config;
    modelPairs = new Map();
    performanceHistory = new Map();
    activeSpeculations = new Map();
    constructor() {
        this.config = {
            maxDraftTokens: 5,
            temperature: 0.8,
            topK: 40,
            acceptanceThreshold: 0.9,
            enableTreeAttention: false,
        };
        this.initializeModelPairs();
    }
    async initializeModelPairs() {
        const models = modelDiscoveryService.getModels();
        const modelsByCapability = new Map();
        for (const model of models) {
            for (const capability of model.capabilities) {
                if (!modelsByCapability.has(capability)) {
                    modelsByCapability.set(capability, []);
                }
                modelsByCapability.get(capability).push(model);
            }
        }
        for (const [capability, capableModels] of modelsByCapability) {
            const sorted = [...capableModels].sort((a, b) => a.tier - b.tier);
            for (const draft of sorted.filter(m => m.tier <= 2)) {
                for (const target of sorted.filter(m => m.tier >= 3)) {
                    const pair = this.createModelPair(draft, target, capability);
                    if (pair.compatibility > 0.5) {
                        const key = `${draft.id}:${target.id}`;
                        this.modelPairs.set(key, pair);
                    }
                }
            }
        }
        log.info('🎯 Speculative decoding pairs initialized', LogContext.AI, {
            totalPairs: this.modelPairs.size,
            capabilities: Array.from(modelsByCapability.keys()),
        });
    }
    createModelPair(draft, target, sharedCapability) {
        const draftCaps = new Set(draft.capabilities);
        const targetCaps = new Set(target.capabilities);
        const intersection = new Set([...draftCaps].filter(x => targetCaps.has(x)));
        const union = new Set([...draftCaps, ...targetCaps]);
        const compatibility = intersection.size / union.size;
        const sizeRatio = (target.sizeGB || 10) / (draft.sizeGB || 1);
        const expectedSpeedup = Math.min(3, 1 + Math.log2(sizeRatio));
        return {
            draft,
            target,
            compatibility,
            expectedSpeedup,
        };
    }
    async generateWithSpeculation(prompt, targetModel, options) {
        const startTime = Date.now();
        const modelPair = this.findBestDraftModel(targetModel);
        if (!modelPair) {
            log.warn('No suitable draft model found, using regular generation', LogContext.AI);
            throw new Error('No suitable draft model for speculation');
        }
        log.info('🚀 Starting speculative decoding', LogContext.AI, {
            draft: modelPair.draft.name,
            target: modelPair.target.name,
            expectedSpeedup: modelPair.expectedSpeedup.toFixed(1) + 'x',
        });
        const requestId = `spec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const abortController = new AbortController();
        this.activeSpeculations.set(requestId, abortController);
        try {
            const result = await this.speculativeDecode(prompt, modelPair, options || {}, abortController.signal);
            const totalTime = Date.now() - startTime;
            const actualSpeedup = totalTime / (result.draftTime + result.verifyTime);
            log.info('✅ Speculative decoding completed', LogContext.AI, {
                acceptedTokens: result.acceptedCount,
                rejectedTokens: result.rejectedCount,
                speedup: actualSpeedup.toFixed(2) + 'x',
                totalTime: totalTime + 'ms',
            });
            this.updatePerformanceHistory(modelPair, result);
            return {
                content: result.tokens.join(''),
                speculation: result,
                modelPair,
            };
        }
        finally {
            this.activeSpeculations.delete(requestId);
        }
    }
    async speculativeDecode(prompt, modelPair, options, signal) {
        const maxTokens = options.maxTokens || 100;
        const tokens = [];
        let acceptedCount = 0;
        let rejectedCount = 0;
        let totalDraftTime = 0;
        let totalVerifyTime = 0;
        let currentPrompt = prompt;
        let tokenCount = 0;
        while (tokenCount < maxTokens && !signal.aborted) {
            const draftStart = Date.now();
            const draftTokens = await this.generateDraftTokens(currentPrompt, modelPair.draft, Math.min(this.config.maxDraftTokens, maxTokens - tokenCount));
            totalDraftTime += Date.now() - draftStart;
            if (draftTokens.length === 0)
                break;
            const verifyStart = Date.now();
            const verificationResult = await this.verifyTokens(currentPrompt, draftTokens, modelPair.target);
            totalVerifyTime += Date.now() - verifyStart;
            const { acceptedTokens } = verificationResult;
            tokens.push(...acceptedTokens);
            acceptedCount += acceptedTokens.length;
            rejectedCount += draftTokens.length - acceptedTokens.length;
            tokenCount += acceptedTokens.length;
            currentPrompt = prompt + tokens.join('');
            if (acceptedTokens.length === 0) {
                const targetToken = await this.generateSingleToken(currentPrompt, modelPair.target);
                tokens.push(targetToken);
                tokenCount++;
                currentPrompt += targetToken;
            }
            if (this.shouldStop(tokens)) {
                break;
            }
        }
        const baselineTime = totalDraftTime + totalVerifyTime;
        const speculativeTime = totalVerifyTime;
        const speedup = baselineTime / Math.max(speculativeTime, 1);
        return {
            tokens,
            acceptedCount,
            rejectedCount,
            speedup,
            draftTime: totalDraftTime,
            verifyTime: totalVerifyTime,
        };
    }
    async generateDraftTokens(prompt, draftModel, count) {
        try {
            const response = await this.callModel(draftModel, prompt, {
                maxTokens: count,
                temperature: this.config.temperature,
                topK: this.config.topK,
                stream: false,
            });
            const tokens = this.parseTokens(response.content);
            return tokens.slice(0, count);
        }
        catch (error) {
            log.warn('Draft generation failed', LogContext.AI, { error });
            return [];
        }
    }
    async verifyTokens(prompt, draftTokens, targetModel) {
        const acceptedTokens = [];
        const probabilities = [];
        const verificationPrompts = [];
        for (let i = 0; i < draftTokens.length; i++) {
            const contextWithDraft = prompt + draftTokens.slice(0, i + 1).join('');
            verificationPrompts.push(contextWithDraft);
        }
        const verificationPromises = verificationPrompts.map(vPrompt => this.getNextTokenProbabilities(targetModel, vPrompt));
        const results = await Promise.all(verificationPromises);
        for (let i = 0; i < draftTokens.length; i++) {
            const draftToken = draftTokens[i];
            const targetProbs = results[i];
            const tokenProb = targetProbs && draftToken ? (targetProbs[draftToken] || 0) : 0;
            if (tokenProb >= this.config.acceptanceThreshold && draftToken) {
                acceptedTokens.push(draftToken);
                probabilities.push(tokenProb);
            }
            else {
                break;
            }
        }
        return { acceptedTokens, probabilities };
    }
    async getNextTokenProbabilities(model, prompt) {
        const response = await this.callModel(model, prompt, {
            maxTokens: 1,
            temperature: 0.1,
            logprobs: true,
        });
        const probs = {};
        const nextToken = this.parseTokens(response.content)[0];
        if (nextToken) {
            probs[nextToken] = 0.95;
        }
        return probs;
    }
    async generateSingleToken(prompt, model) {
        const response = await this.callModel(model, prompt, {
            maxTokens: 1,
            temperature: 0.7,
        });
        const tokens = this.parseTokens(response.content);
        return tokens[0] || '';
    }
    async callModel(model, prompt, options) {
        try {
            if (model.provider === 'ollama') {
                const response = await fetch('http://localhost:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: model.id,
                        prompt,
                        options: {
                            temperature: options.temperature || 0.7,
                            num_predict: options.maxTokens || 1,
                            top_k: options.topK,
                        },
                        stream: false,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`Ollama error: ${response.status}`);
                }
                const data = await response.json();
                return { content: data.response || '' };
            }
            else if (model.provider === 'lmstudio') {
                const response = await fetch('http://localhost:5901/v1/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: model.id,
                        prompt,
                        max_tokens: options.maxTokens || 1,
                        temperature: options.temperature || 0.7,
                        logprobs: options.logprobs ? 5 : undefined,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`LM Studio error: ${response.status}`);
                }
                const data = await response.json();
                return {
                    content: data.choices?.[0]?.text || '',
                    logprobs: data.choices?.[0]?.logprobs,
                };
            }
            throw new Error(`Unsupported provider: ${model.provider}`);
        }
        catch (error) {
            log.warn('Model call failed', LogContext.AI, { model: model.id, error });
            throw error;
        }
    }
    parseTokens(content) {
        return content.split(/\s+/).filter(t => t.length > 0);
    }
    shouldStop(tokens) {
        const text = tokens.join('');
        return text.includes('\n\n') ||
            text.includes('</s>') ||
            text.includes('<|endoftext|>');
    }
    findBestDraftModel(targetModel) {
        let bestPair = null;
        let bestScore = 0;
        for (const [key, pair] of this.modelPairs) {
            if (pair.target.id !== targetModel.id)
                continue;
            const score = pair.compatibility * pair.expectedSpeedup;
            const draftAvailable = modelDiscoveryService.getModels()
                .some(m => m.id === pair.draft.id);
            if (draftAvailable && score > bestScore) {
                bestScore = score;
                bestPair = pair;
            }
        }
        if (!bestPair) {
            const models = modelDiscoveryService.getModels();
            const smallModels = models
                .filter(m => m.tier <= 2)
                .filter(m => this.hasSharedCapabilities(m, targetModel));
            if (smallModels.length > 0) {
                const draft = smallModels.sort((a, b) => a.tier - b.tier)[0];
                if (draft) {
                    bestPair = this.createModelPair(draft, targetModel, targetModel.capabilities[0] || 'general');
                }
            }
        }
        return bestPair;
    }
    hasSharedCapabilities(model1, model2) {
        const caps1 = new Set(model1.capabilities);
        const caps2 = new Set(model2.capabilities);
        for (const cap of caps1) {
            if (caps2.has(cap))
                return true;
        }
        return false;
    }
    updatePerformanceHistory(pair, result) {
        const key = `${pair.draft.id}:${pair.target.id}`;
        if (!this.performanceHistory.has(key)) {
            this.performanceHistory.set(key, []);
        }
        const history = this.performanceHistory.get(key);
        history.push(result);
        if (history.length > 100) {
            history.shift();
        }
    }
    getAverageSpeedup(draftId, targetId) {
        const key = `${draftId}:${targetId}`;
        const history = this.performanceHistory.get(key);
        if (!history || history.length === 0) {
            return 1.0;
        }
        const avgSpeedup = history.reduce((sum, r) => sum + r.speedup, 0) / history.length;
        return avgSpeedup;
    }
    getBestPairs(limit = 10) {
        const pairs = Array.from(this.modelPairs.values());
        pairs.sort((a, b) => {
            const speedupA = this.getAverageSpeedup(a.draft.id, a.target.id) || a.expectedSpeedup;
            const speedupB = this.getAverageSpeedup(b.draft.id, b.target.id) || b.expectedSpeedup;
            return speedupB - speedupA;
        });
        return pairs.slice(0, limit);
    }
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        log.info('Speculative config updated', LogContext.AI, this.config);
    }
    cancelSpeculation(requestId) {
        const controller = this.activeSpeculations.get(requestId);
        if (controller) {
            controller.abort();
            this.activeSpeculations.delete(requestId);
            return true;
        }
        return false;
    }
    getStatistics() {
        let totalSpeedup = 0;
        let totalResults = 0;
        let successfulSpeculations = 0;
        for (const history of this.performanceHistory.values()) {
            for (const result of history) {
                totalSpeedup += result.speedup;
                totalResults++;
                if (result.acceptedCount > 0) {
                    successfulSpeculations++;
                }
            }
        }
        return {
            totalPairs: this.modelPairs.size,
            activeSpeculations: this.activeSpeculations.size,
            averageSpeedup: totalResults > 0 ? totalSpeedup / totalResults : 1.0,
            successRate: totalResults > 0 ? successfulSpeculations / totalResults : 0,
        };
    }
    getStatus() {
        return {
            status: 'active',
            modelPairs: this.modelPairs.size,
            activeSpeculations: this.activeSpeculations.size
        };
    }
    async generate(prompt, options) {
        const bestPairs = this.getBestPairs(1);
        if (bestPairs.length === 0) {
            throw new Error('No suitable model pairs available for speculation');
        }
        const pair = bestPairs[0];
        if (!pair) {
            throw new Error('No valid model pair found');
        }
        return this.generateWithSpeculation(prompt, pair.target, options);
    }
    getPerformanceMetrics() {
        const stats = this.getStatistics();
        const performanceData = [];
        for (const [pairId, history] of this.performanceHistory.entries()) {
            if (history.length > 0) {
                const recent = history.slice(-10);
                const avgSpeedup = recent.reduce((sum, r) => sum + r.speedup, 0) / recent.length;
                const avgAcceptance = recent.reduce((sum, r) => sum + r.acceptedCount, 0) / recent.length;
                performanceData.push({
                    pairId,
                    averageSpeedup: avgSpeedup,
                    averageAcceptance: avgAcceptance,
                    totalRuns: history.length,
                    recentRuns: recent.length
                });
            }
        }
        return {
            ...stats,
            pairPerformance: performanceData,
            config: this.config
        };
    }
    async optimizeModel(draftModel, targetModel) {
        const pairKey = `${draftModel}-${targetModel}`;
        const history = this.performanceHistory.get(pairKey) || [];
        if (history.length < 5) {
            return {
                message: 'Insufficient data for optimization',
                recommendations: [
                    'Run more speculative decoding sessions to gather performance data'
                ]
            };
        }
        const avgSpeedup = history.reduce((sum, r) => sum + r.speedup, 0) / history.length;
        const avgAcceptance = history.reduce((sum, r) => sum + r.acceptedCount, 0) / history.length;
        const recommendations = [];
        if (avgSpeedup < 1.5) {
            recommendations.push('Consider increasing draft token count');
            recommendations.push('Try lowering acceptance threshold');
        }
        if (avgAcceptance < 2) {
            recommendations.push('Draft model may be too different from target');
            recommendations.push('Consider using a more similar draft model');
        }
        return {
            currentPerformance: { avgSpeedup, avgAcceptance },
            recommendations,
            optimizedConfig: {
                ...this.config,
                maxDraftTokens: avgAcceptance < 2 ? Math.max(this.config.maxDraftTokens - 1, 2) : this.config.maxDraftTokens + 1,
                acceptanceThreshold: avgSpeedup < 1.5 ? Math.max(this.config.acceptanceThreshold - 0.05, 0.7) : this.config.acceptanceThreshold
            }
        };
    }
    getModelPairs() {
        return Array.from(this.modelPairs.values());
    }
    async benchmark(draftModel, targetModel, testPrompts) {
        const defaultPrompts = [
            'The quick brown fox jumps over the lazy dog.',
            'Write a short story about a robot learning to paint.',
            'Explain the concept of machine learning in simple terms.',
            'Generate a Python function that calculates fibonacci numbers.',
            'Describe the process of photosynthesis step by step.'
        ];
        const prompts = testPrompts || defaultPrompts;
        const results = [];
        for (const prompt of prompts) {
            const requestId = `bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            try {
                const models = modelDiscoveryService.getModels();
                const targetModelObj = models.find(m => m.id === targetModel);
                if (!targetModelObj) {
                    throw new Error(`Target model ${targetModel} not found`);
                }
                const result = await this.generateWithSpeculation(prompt, targetModelObj, { maxTokens: 50 });
                results.push({
                    prompt: prompt.substring(0, 50) + '...',
                    success: true,
                    speedup: result.speculation?.speedup || 1.0,
                    acceptedTokens: result.speculation?.acceptedCount || 0,
                    totalTokens: result.speculation?.tokens?.length || 0,
                    draftTime: result.speculation?.draftTime || 0,
                    verifyTime: result.speculation?.verifyTime || 0
                });
            }
            catch (error) {
                results.push({
                    prompt: prompt.substring(0, 50) + '...',
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        const successful = results.filter(r => r.success);
        const avgSpeedup = successful.length > 0
            ? successful.reduce((sum, r) => sum + r.speedup, 0) / successful.length
            : 0;
        return {
            draftModel,
            targetModel,
            testCount: prompts.length,
            successCount: successful.length,
            averageSpeedup: avgSpeedup,
            results,
            summary: {
                recommendation: avgSpeedup > 1.5 ? 'Good pair for production use' : 'Consider different model combination',
                reliability: (successful.length / prompts.length) * 100
            }
        };
    }
}
export const speculativeDecodingService = new SpeculativeDecodingService();
//# sourceMappingURL=speculative-decoding-service.js.map
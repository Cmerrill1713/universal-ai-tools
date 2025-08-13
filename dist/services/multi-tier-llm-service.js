import { THREE } from '@/utils/constants';
import { log, LogContext } from '@/utils/logger';
import { lfm2Bridge } from './lfm2-bridge';
import { ollamaService } from './ollama-service';
export class MultiTierLLMService {
    modelTiers = new Map();
    modelPerformance = new Map();
    constructor() {
        this.initializeModelTiers();
        this.startPerformanceMonitoring();
    }
    initializeModelTiers() {
        this.modelTiers.set(1, {
            tier: 1,
            models: ['lfm2-1.2b'],
            capabilities: ['routing', 'coordination', 'classification', 'simple_qa'],
            maxTokens: 256,
            avgResponseTime: 100,
            useCase: 'Instant decisions, routing, simple questions',
        });
        this.populateAvailableModels().catch(error => console.warn('Failed to populate available models:', error));
        log.info('🏗️ Multi-tier LLM architecture initialized', LogContext.AI, {
            tiers: Array.from(this.modelTiers.keys()),
            totalModels: Array.from(this.modelTiers.values()).reduce((sum, tier) => sum + tier.models.length, 0),
        });
    }
    async populateAvailableModels() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            const data = await response.json();
            const availableModels = data.models?.map((m) => m.name) || [];
            const fastModels = availableModels.filter((name) => name.includes('tiny') || name.includes('1b') || name.includes('2b') ||
                name.includes('small') || name.includes('mini'));
            const mediumModels = availableModels.filter((name) => name.includes('7b') || name.includes('8b') || name.includes('13b') ||
                (name.includes('3b') && !fastModels.includes(name)));
            const largeModels = availableModels.filter((name) => name.includes('20b') || name.includes('24b') || name.includes('70b') ||
                name.includes('large') || name.includes('xl'));
            const uncategorized = availableModels.filter((name) => !fastModels.includes(name) && !mediumModels.includes(name) && !largeModels.includes(name));
            if (fastModels.length > 0 || uncategorized.length > 0) {
                this.modelTiers.set(2, {
                    tier: 2,
                    models: fastModels.length > 0 ? fastModels : uncategorized.slice(0, 1),
                    capabilities: ['conversation', 'basic_analysis', 'summarization', 'simple_code'],
                    maxTokens: 1024,
                    avgResponseTime: 500,
                    useCase: 'General conversation, basic tasks, quick analysis',
                });
            }
            if (mediumModels.length > 0 || (uncategorized.length > 1)) {
                this.modelTiers.set(3, {
                    tier: 3,
                    models: mediumModels.length > 0 ? mediumModels : uncategorized.slice(1),
                    capabilities: ['advanced_reasoning', 'code_generation', 'complex_analysis', 'research'],
                    maxTokens: 4096,
                    avgResponseTime: 2500,
                    useCase: 'Complex reasoning, code generation, detailed analysis',
                });
            }
            if (largeModels.length > 0) {
                this.modelTiers.set(4, {
                    tier: 4,
                    models: largeModels,
                    capabilities: ['expert_analysis', 'complex_code', 'research', 'creative_writing'],
                    maxTokens: 8192,
                    avgResponseTime: 8000,
                    useCase: 'Expert-level tasks, complex code, research, creative work',
                });
            }
            log.info('🔍 Auto-discovered models', LogContext.AI, {
                available: availableModels.length,
                fast: fastModels.length,
                medium: mediumModels.length,
                large: largeModels.length,
                uncategorized: uncategorized.length
            });
        }
        catch (error) {
            log.warn('⚠️ Could not auto-discover models, using fallback configuration', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error)
            });
            this.modelTiers.set(2, {
                tier: 2,
                models: ['local-model-fast'],
                capabilities: ['conversation', 'basic_analysis'],
                maxTokens: 1024,
                avgResponseTime: 500,
                useCase: 'Fast general purpose',
            });
            this.modelTiers.set(3, {
                tier: 3,
                models: ['local-model-medium'],
                capabilities: ['advanced_reasoning', 'code_generation'],
                maxTokens: 4096,
                avgResponseTime: 2500,
                useCase: 'Advanced reasoning',
            });
        }
    }
    async classifyAndPlan(userRequest, context = {}) {
        const startTime = Date.now();
        const classification = await this.classifyTask(userRequest, context);
        const plan = await this.createExecutionPlan(classification, userRequest);
        const classificationTime = Date.now() - startTime;
        log.info('🎯 Task classified and planned', LogContext.AI, {
            complexity: classification.complexity,
            domain: classification.domain,
            tier: plan.tier,
            primaryModel: plan.primaryModel,
            classificationTime: `${classificationTime}ms`,
        });
        return { classification, plan };
    }
    async execute(userRequest, context = {}) {
        const startTime = Date.now();
        const { classification, plan } = await this.classifyAndPlan(userRequest, context);
        let response = '';
        let modelUsed = plan.primaryModel;
        let tokensUsed = 0;
        let fallbackUsed = false;
        try {
            if (plan.tier === 1) {
                const lfm2Response = await lfm2Bridge.quickResponse(userRequest, 'simple_qa');
                response = lfm2Response.content;
                modelUsed = 'lfm2-1.2b';
                tokensUsed = lfm2Response.tokens;
            }
            else {
                const ollamaResponse = await ollamaService.generateResponse([{ role: 'user', content: userRequest }], plan.primaryModel, {
                    temperature: this.getOptimalTemperature(classification.domain),
                    max_tokens: this.modelTiers.get(plan.tier)?.maxTokens || 2048,
                });
                response = ollamaResponse.message.content;
                modelUsed = plan.primaryModel;
                tokensUsed = ollamaResponse.eval_count || 0;
            }
            this.updateModelPerformance(modelUsed, Date.now() - startTime, true, tokensUsed);
        }
        catch (error) {
            log.warn(`⚠️ Primary model ${plan.primaryModel} failed, trying fallback`, LogContext.AI);
            for (const fallbackModel of plan.fallbackModels) {
                try {
                    const fallbackResponse = await ollamaService.generateResponse([{ role: 'user', content: userRequest }], fallbackModel);
                    response = fallbackResponse.message.content;
                    modelUsed = fallbackModel;
                    tokensUsed = fallbackResponse.eval_count || 0;
                    fallbackUsed = true;
                    break;
                }
                catch (fallbackError) {
                    log.warn(`⚠️ Fallback model ${fallbackModel} also failed`, LogContext.AI);
                    continue;
                }
            }
            if (!response) {
                throw new Error(`All models failed for request: ${userRequest.substring(0, 50)}...`);
            }
        }
        const executionTime = Date.now() - startTime;
        return {
            response,
            metadata: {
                modelUsed,
                tier: plan.tier,
                executionTime,
                tokensUsed,
                classification,
                fallbackUsed,
            },
        };
    }
    async executeParallel(requests) {
        log.info('🚀 Starting parallel execution', LogContext.AI, { requests: requests.length });
        const sortedRequests = requests
            .map((req, index) => ({ ...req, index }))
            .sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        const results = await this.executeWithConcurrencyControl(sortedRequests);
        return results.sort((a, b) => a.index - b.index);
    }
    async adaptiveExecute(userRequest, context = {}) {
        const systemLoad = await this.getCurrentSystemLoad();
        const _availableModels = await this.getAvailableModels();
        const { classification, plan } = await this.classifyAndPlan(userRequest, context);
        if (systemLoad > 0.8) {
            plan.tier = Math.max(1, plan.tier - 1);
            plan.primaryModel = this.modelTiers.get(plan.tier)?.models[0] || plan.primaryModel;
        }
        return this.execute(userRequest, context);
    }
    async classifyTask(userRequest, context) {
        const classificationPrompt = `Classify this task quickly:

REQUEST: "${userRequest}"
CONTEXT: ${JSON.stringify(context)}

Respond with JSON:
{
  "complexity": "simple|medium|complex|expert",
  "domain": "general|code|reasoning|creative|multimodal", 
  "urgency": "low|medium|high|critical",
  "estimatedTokens": number,
  "requiresAccuracy": boolean,
  "requiresSpeed": boolean
}`;
        try {
            const response = await lfm2Bridge.quickResponse(classificationPrompt, 'classification');
            const parsed = JSON.parse(response.content);
            return {
                complexity: parsed.complexity || 'medium',
                domain: parsed.domain || 'general',
                urgency: parsed.urgency || 'medium',
                estimatedTokens: parsed.estimatedTokens || 150,
                requiresAccuracy: parsed.requiresAccuracy !== false,
                requiresSpeed: parsed.requiresSpeed !== false,
            };
        }
        catch (error) {
            return this.heuristicClassification(userRequest);
        }
    }
    async createExecutionPlan(classification, userRequest) {
        let optimalTier = 2;
        if (classification.complexity === 'simple' && classification.requiresSpeed) {
            optimalTier = 1;
        }
        else if (classification.complexity === 'medium') {
            optimalTier = 2;
        }
        else if (classification.complexity === 'complex') {
            optimalTier = THREE;
        }
        else if (classification.complexity === 'expert') {
            optimalTier = 4;
        }
        if (classification.domain === 'code' && classification.complexity !== 'simple') {
            optimalTier = Math.max(optimalTier, THREE);
        }
        const tierConfig = this.modelTiers.get(optimalTier);
        const primaryModel = this.selectBestModelFromTier(optimalTier);
        const fallbackModels = this.getFallbackModels(optimalTier);
        return {
            primaryModel,
            fallbackModels,
            tier: optimalTier,
            estimatedTime: tierConfig.avgResponseTime,
            confidence: 0.85,
            reasoning: `Tier ${optimalTier} selected for ${classification.complexity} ${classification.domain} task`,
        };
    }
    selectBestModelFromTier(tier) {
        const tierConfig = this.modelTiers.get(tier);
        let bestModel = tierConfig.models[0] || 'llama3.2:3b';
        let bestScore = 0;
        for (const model of tierConfig.models) {
            const perf = this.modelPerformance.get(model);
            if (perf) {
                const recencyWeight = Math.max(0.1, 1 - (Date.now() - perf.lastUsed) / (1000 * 60 * 60));
                const score = (perf.successRate * 0.7 + (1 / perf.avgResponseTime) * 0.3) * recencyWeight;
                if (score > bestScore) {
                    bestScore = score;
                    bestModel = model;
                }
            }
        }
        return bestModel;
    }
    getFallbackModels(tier) {
        const fallbacks = [];
        const currentTier = this.modelTiers.get(tier);
        fallbacks.push(...currentTier.models.slice(1));
        if (tier > 1) {
            const lowerTier = this.modelTiers.get(tier - 1);
            fallbacks.push(...lowerTier.models);
        }
        return fallbacks;
    }
    heuristicClassification(userRequest) {
        const { length } = userRequest;
        const codeKeywords = ['code', 'function', 'class', 'import', 'def', 'const', 'let', 'var'];
        const complexKeywords = ['analyze', 'research', 'explain in detail', 'comprehensive'];
        let complexity = 'medium';
        let domain = 'general';
        if (length < 50)
            complexity = 'simple';
        else if (length > 200 || complexKeywords.some((k) => userRequest.toLowerCase().includes(k))) {
            complexity = 'complex';
        }
        if (codeKeywords.some((k) => userRequest.toLowerCase().includes(k)))
            domain = 'code';
        return {
            complexity,
            domain,
            urgency: 'medium',
            estimatedTokens: Math.min(Math.max(length / 4, 50), 500),
            requiresAccuracy: true,
            requiresSpeed: complexity === 'simple',
        };
    }
    getOptimalTemperature(domain) {
        const temperatureMap = {
            code: 0.2,
            reasoning: 0.3,
            general: 0.7,
            creative: 0.9,
            multimodal: 0.5,
        };
        return temperatureMap[domain] || 0.7;
    }
    async executeWithConcurrencyControl(requests) {
        const maxConcurrency = 4;
        const results = [];
        for (let i = 0; i < requests.length; i += maxConcurrency) {
            const batch = requests.slice(i, i + maxConcurrency);
            const batchResults = await Promise.allSettled(batch.map(async (req) => {
                try {
                    const result = await this.execute(req.request, req.context || {});
                    return {
                        request: req.request,
                        response: result.response,
                        metadata: result.metadata,
                        index: req.index,
                    };
                }
                catch (error) {
                    return {
                        request: req.request,
                        response: `Error: ${error}`,
                        metadata: { error: true },
                        index: req.index,
                    };
                }
            }));
            results.push(...batchResults.map((r) => (r.status === 'fulfilled' ? r.value : r.reason)));
        }
        return results;
    }
    updateModelPerformance(model, responseTime, success, tokens) {
        const existing = this.modelPerformance.get(model) || {
            avgResponseTime: responseTime,
            successRate: success ? 1 : 0,
            tokenThroughput: tokens / (responseTime / 1000),
            lastUsed: Date.now(),
        };
        const alpha = 0.2;
        existing.avgResponseTime = alpha * responseTime + (1 - alpha) * existing.avgResponseTime;
        existing.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * existing.successRate;
        existing.tokenThroughput =
            alpha * (tokens / (responseTime / 1000)) + (1 - alpha) * existing.tokenThroughput;
        existing.lastUsed = Date.now();
        this.modelPerformance.set(model, existing);
    }
    async getCurrentSystemLoad() {
        return Math.random() * 0.5;
    }
    async getAvailableModels() {
        try {
            const models = await ollamaService.getAvailableModels();
            return models;
        }
        catch (error) {
            return ['llama3.2:3b'];
        }
    }
    startPerformanceMonitoring() {
        setInterval(() => {
            log.info('📊 Model performance update', LogContext.AI, {
                modelsTracked: this.modelPerformance.size,
                avgPerformance: this.getAveragePerformance(),
            });
        }, 5 * 60 * 1000);
    }
    getAveragePerformance() {
        const performances = Array.from(this.modelPerformance.values());
        if (performances.length === 0)
            return {};
        const avg = performances.reduce((acc, perf) => ({
            responseTime: acc.responseTime + perf.avgResponseTime,
            successRate: acc.successRate + perf.successRate,
            throughput: acc.throughput + perf.tokenThroughput,
        }), { responseTime: 0, successRate: 0, throughput: 0 });
        return {
            avgResponseTime: avg.responseTime / performances.length,
            avgSuccessRate: avg.successRate / performances.length,
            avgThroughput: avg.throughput / performances.length,
        };
    }
    getSystemStatus() {
        return {
            tiers: Array.from(this.modelTiers.entries()).map(([tier, config]) => ({
                tier,
                models: config.models,
                avgResponseTime: config.avgResponseTime,
            })),
            performance: this.getAveragePerformance(),
            totalModels: Array.from(this.modelTiers.values()).reduce((sum, tier) => sum + tier.models.length, 0),
        };
    }
}
export const multiTierLLM = new MultiTierLLMService();
export default multiTierLLM;
//# sourceMappingURL=multi-tier-llm-service.js.map
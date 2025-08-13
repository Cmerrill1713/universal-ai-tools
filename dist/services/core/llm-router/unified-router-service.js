import { EventEmitter } from 'events';
import { log, LogContext } from '@/utils/logger';
import { createCircuitBreaker } from '@/utils/circuit-breaker';
class UnifiedLLMRouterService extends EventEmitter {
    name = 'unified-llm-router';
    version = '1.0.0';
    status = 'inactive';
    config;
    providers = new Map();
    routingRules = [];
    modelMetrics = new Map();
    responseCache = new Map();
    requestQueue = [];
    isInitialized = false;
    healthCheckTimer;
    metricsUpdateTimer;
    requestCounter = 0;
    constructor() {
        super();
        this.config = {
            defaultStrategy: {
                name: 'least-latency',
                config: { considerAvailability: true },
            },
            enableFallbacks: true,
            maxRetries: 3,
            timeoutMs: 30000,
            circuitBreakerConfig: {
                failureThreshold: 5,
                resetTimeoutMs: 60000,
                monitoringPeriodMs: 10000,
            },
            loadBalancing: {
                algorithm: 'weighted',
                healthCheckInterval: 30000,
            },
            caching: {
                enabled: true,
                ttlMs: 300000,
                maxSize: 1000,
            },
        };
        this.initializeDefaultRoutingRules();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            log.info('🔀 Initializing Unified LLM Router Service', LogContext.API);
            this.status = 'initializing';
            await this.initializeProviders();
            this.startHealthChecks();
            this.startMetricsUpdates();
            this.isInitialized = true;
            this.status = 'active';
            this.emit('initialized');
            log.info('✅ Unified LLM Router Service initialized', LogContext.API, {
                providersCount: this.providers.size,
                rulesCount: this.routingRules.length,
            });
        }
        catch (error) {
            this.status = 'error';
            log.error('❌ Failed to initialize LLM Router Service', LogContext.API, { error });
            throw error;
        }
    }
    async healthCheck() {
        try {
            if (this.status !== 'active')
                return false;
            const healthyProviders = Array.from(this.providers.values())
                .filter(conn => conn.isHealthy);
            return healthyProviders.length > 0;
        }
        catch (error) {
            log.error('❌ LLM Router health check failed', LogContext.API, { error });
            return false;
        }
    }
    async shutdown() {
        log.info('🛑 Shutting down Unified LLM Router Service', LogContext.API);
        if (this.healthCheckTimer)
            clearInterval(this.healthCheckTimer);
        if (this.metricsUpdateTimer)
            clearInterval(this.metricsUpdateTimer);
        for (const connection of this.providers.values()) {
        }
        this.status = 'inactive';
        this.emit('shutdown');
        log.info('🛑 LLM Router Service shut down', LogContext.API);
    }
    async routeRequest(request) {
        const startTime = Date.now();
        const requestId = this.generateRequestId();
        try {
            log.debug('🔀 Routing LLM request', LogContext.API, {
                requestId,
                model: request.model,
                promptLength: request.prompt.length,
            });
            if (this.config.caching.enabled) {
                const cached = this.getCachedResponse(request);
                if (cached) {
                    log.debug('💾 Cache hit for LLM request', LogContext.API, { requestId });
                    return cached;
                }
            }
            const rule = this.findApplicableRule(request);
            const strategy = rule?.strategy || this.config.defaultStrategy;
            const selectedModel = await this.selectModel(request, rule || undefined, strategy);
            if (!selectedModel) {
                throw new Error('No available models for request');
            }
            const response = await this.executeWithFallbacks({ ...request, model: selectedModel }, rule?.fallbackModels || [], requestId);
            this.updateRequestMetrics(selectedModel, startTime, true);
            if (this.config.caching.enabled) {
                this.cacheResponse(request, response);
            }
            this.emit('requestCompleted', {
                requestId,
                model: selectedModel,
                responseTime: Date.now() - startTime,
                success: true,
            });
            log.debug('✅ LLM request completed', LogContext.API, {
                requestId,
                selectedModel,
                responseTime: Date.now() - startTime,
            });
            return response;
        }
        catch (error) {
            this.updateRequestMetrics(request.model, startTime, false, error);
            this.emit('requestFailed', {
                requestId,
                model: request.model,
                error: error instanceof Error ? error.message : String(error),
                responseTime: Date.now() - startTime,
            });
            log.error('❌ LLM request failed', LogContext.API, {
                requestId,
                error,
                model: request.model,
            });
            throw error;
        }
    }
    async selectModel(request, rule, strategy = this.config.defaultStrategy) {
        const candidates = rule?.targetModels || this.getAvailableModels();
        const healthyCandidates = candidates.filter(modelId => this.isModelHealthy(modelId));
        if (healthyCandidates.length === 0) {
            return null;
        }
        switch (strategy.name) {
            case 'least-latency':
                return this.selectByLatency(healthyCandidates);
            case 'cost-optimized':
                return this.selectByCost(healthyCandidates, request);
            case 'quality-optimized':
                return this.selectByQuality(healthyCandidates);
            case 'load-balanced':
                return this.selectByLoad(healthyCandidates);
            case 'round-robin':
            default:
                return this.selectRoundRobin(healthyCandidates);
        }
    }
    selectByLatency(candidates) {
        let bestModel = candidates[0];
        let bestLatency = Infinity;
        for (const modelId of candidates) {
            const metrics = this.modelMetrics.get(modelId);
            if (metrics && metrics.averageLatency < bestLatency) {
                bestLatency = metrics.averageLatency;
                bestModel = modelId;
            }
        }
        return bestModel;
    }
    selectByCost(candidates, request) {
        let bestModel = candidates[0];
        let bestCost = Infinity;
        const estimatedTokens = this.estimateOutputTokens(request);
        for (const modelId of candidates) {
            const metrics = this.modelMetrics.get(modelId);
            if (metrics) {
                const estimatedCost = metrics.costPerToken * estimatedTokens;
                if (estimatedCost < bestCost) {
                    bestCost = estimatedCost;
                    bestModel = modelId;
                }
            }
        }
        return bestModel;
    }
    selectByQuality(candidates) {
        let bestModel = candidates[0];
        let bestQuality = 0;
        for (const modelId of candidates) {
            const metrics = this.modelMetrics.get(modelId);
            if (metrics && metrics.qualityScore > bestQuality) {
                bestQuality = metrics.qualityScore;
                bestModel = modelId;
            }
        }
        return bestModel;
    }
    selectByLoad(candidates) {
        let bestModel = candidates[0];
        let bestLoad = Infinity;
        for (const modelId of candidates) {
            const metrics = this.modelMetrics.get(modelId);
            if (metrics) {
                const load = metrics.totalRequests / (metrics.tokensPerSecond || 1);
                if (load < bestLoad) {
                    bestLoad = load;
                    bestModel = modelId;
                }
            }
        }
        return bestModel;
    }
    selectRoundRobin(candidates) {
        const index = this.requestCounter % candidates.length;
        this.requestCounter++;
        return candidates[index];
    }
    async executeWithFallbacks(request, fallbacks, requestId) {
        const attemptOrder = [request.model, ...fallbacks];
        let lastError = null;
        for (let i = 0; i < attemptOrder.length && i < this.config.maxRetries; i++) {
            const modelId = attemptOrder[i];
            try {
                log.debug(`🔄 Attempting request with model: ${modelId}`, LogContext.API, {
                    requestId,
                    attempt: i + 1,
                });
                const response = await this.executeRequest({ ...request, model: modelId });
                if (i > 0) {
                    log.info(`✅ Request succeeded with fallback model: ${modelId}`, LogContext.API, {
                        requestId,
                        originalModel: request.model,
                        fallbackModel: modelId,
                    });
                }
                return response;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                log.warn(`⚠️ Request failed with model: ${modelId}`, LogContext.API, {
                    requestId,
                    attempt: i + 1,
                    error: lastError.message,
                });
                const connection = this.getProviderForModel(modelId);
                if (connection) {
                }
            }
        }
        throw lastError || new Error('All fallback attempts failed');
    }
    async executeRequest(request) {
        const connection = this.getProviderForModel(request.model);
        if (!connection) {
            throw new Error(`No provider found for model: ${request.model}`);
        }
        if (!connection.isHealthy) {
            throw new Error(`Provider for model ${request.model} is unhealthy`);
        }
        return connection.circuitBreaker.execute(async () => {
            return this.callProvider(connection.provider, request);
        });
    }
    async callProvider(provider, request) {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        return {
            content: `Response from ${provider.name} for: ${request.prompt.slice(0, 50)}...`,
            model: request.model,
            usage: {
                promptTokens: Math.ceil(request.prompt.length / 4),
                completionTokens: Math.ceil((request.maxTokens || 100) * 0.8),
                totalTokens: Math.ceil(request.prompt.length / 4) + Math.ceil((request.maxTokens || 100) * 0.8),
            },
            provider: provider.name,
            responseTime: Date.now() - startTime,
            metadata: {
                requestId: this.generateRequestId(),
                timestamp: new Date().toISOString(),
            },
        };
    }
    async initializeProviders() {
        const defaultProviders = [
            {
                name: 'ollama',
                type: 'local',
                models: ['llama3.1', 'mistral', 'codellama'],
                endpoint: 'http://localhost:11434',
            },
            {
                name: 'openai',
                type: 'remote',
                models: ['gpt-4', 'gpt-3.5-turbo'],
                endpoint: 'https://api.openai.com/v1',
                apiKey: process.env.OPENAI_API_KEY,
            },
            {
                name: 'anthropic',
                type: 'remote',
                models: ['claude-3-sonnet', 'claude-3-haiku'],
                endpoint: 'https://api.anthropic.com/v1',
                apiKey: process.env.ANTHROPIC_API_KEY,
            },
        ];
        for (const provider of defaultProviders) {
            await this.registerProvider(provider);
        }
    }
    async registerProvider(provider) {
        try {
            const circuitBreaker = createCircuitBreaker(`llm-${provider.name}`, {
                timeout: this.config.timeoutMs,
                errorThresholdPercentage: 50,
                resetTimeout: this.config.circuitBreakerConfig.resetTimeoutMs,
            });
            const connection = {
                provider,
                circuitBreaker,
                metrics: [],
                isHealthy: true,
                lastHealthCheck: new Date(),
            };
            for (const modelId of provider.models) {
                this.modelMetrics.set(modelId, {
                    modelId,
                    provider: provider.name,
                    averageLatency: 0,
                    errorRate: 0,
                    tokensPerSecond: 0,
                    costPerToken: 0,
                    qualityScore: 0.8,
                    availability: 1.0,
                    lastUsed: new Date(),
                    totalRequests: 0,
                    successfulRequests: 0,
                });
            }
            this.providers.set(provider.name, connection);
            log.info('✅ Provider registered', LogContext.API, {
                provider: provider.name,
                type: provider.type,
                models: provider.models,
            });
        }
        catch (error) {
            log.error('❌ Failed to register provider', LogContext.API, { error, provider: provider.name });
            throw error;
        }
    }
    initializeDefaultRoutingRules() {
        const defaultRules = [
            {
                id: 'high-priority-fast',
                name: 'High Priority - Fast Models',
                conditions: {
                    priorityLevel: 'urgent',
                    maxTokens: { max: 1000 },
                },
                targetModels: ['gpt-3.5-turbo', 'claude-3-haiku'],
                fallbackModels: ['llama3.1'],
                strategy: { name: 'least-latency', config: {} },
                enabled: true,
                priority: 1,
            },
            {
                id: 'code-generation',
                name: 'Code Generation Tasks',
                conditions: {
                    taskType: 'code',
                },
                targetModels: ['codellama', 'gpt-4'],
                fallbackModels: ['gpt-3.5-turbo'],
                strategy: { name: 'quality-optimized', config: {} },
                enabled: true,
                priority: 2,
            },
            {
                id: 'cost-sensitive',
                name: 'Cost-Sensitive Requests',
                conditions: {
                    userTier: 'free',
                },
                targetModels: ['llama3.1', 'mistral'],
                fallbackModels: ['gpt-3.5-turbo'],
                strategy: { name: 'cost-optimized', config: {} },
                enabled: true,
                priority: 3,
            },
        ];
        this.routingRules.push(...defaultRules);
    }
    addRoutingRule(rule) {
        this.routingRules.push(rule);
        this.routingRules.sort((a, b) => a.priority - b.priority);
        log.info('📋 Routing rule added', LogContext.API, { rule: rule.name });
    }
    removeRoutingRule(ruleId) {
        const index = this.routingRules.findIndex(rule => rule.id === ruleId);
        if (index !== -1) {
            const removed = this.routingRules.splice(index, 1)[0];
            log.info('📋 Routing rule removed', LogContext.API, { rule: removed.name });
        }
    }
    findApplicableRule(request) {
        for (const rule of this.routingRules) {
            if (!rule.enabled)
                continue;
            if (this.matchesConditions(request, rule.conditions)) {
                return rule;
            }
        }
        return null;
    }
    matchesConditions(request, conditions) {
        if (conditions.promptLength) {
            const length = request.prompt.length;
            if (conditions.promptLength.min && length < conditions.promptLength.min)
                return false;
            if (conditions.promptLength.max && length > conditions.promptLength.max)
                return false;
        }
        if (conditions.maxTokens) {
            const maxTokens = request.maxTokens || 0;
            if (conditions.maxTokens.min && maxTokens < conditions.maxTokens.min)
                return false;
            if (conditions.maxTokens.max && maxTokens > conditions.maxTokens.max)
                return false;
        }
        return true;
    }
    getAvailableModels() {
        return Array.from(this.modelMetrics.keys()).filter(modelId => this.isModelHealthy(modelId));
    }
    isModelHealthy(modelId) {
        const metrics = this.modelMetrics.get(modelId);
        if (!metrics)
            return false;
        const provider = this.getProviderForModel(modelId);
        if (!provider || !provider.isHealthy)
            return false;
        return metrics.availability > 0.8 && metrics.errorRate < 0.1;
    }
    getProviderForModel(modelId) {
        for (const connection of this.providers.values()) {
            if (connection.provider.models.includes(modelId)) {
                return connection;
            }
        }
        return null;
    }
    estimateOutputTokens(request) {
        return request.maxTokens || Math.min(request.prompt.length / 2, 1000);
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getCachedResponse(request) {
        const cacheKey = this.generateCacheKey(request);
        const cached = this.responseCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.caching.ttlMs) {
            return cached.response;
        }
        return null;
    }
    cacheResponse(request, response) {
        const cacheKey = this.generateCacheKey(request);
        this.responseCache.set(cacheKey, {
            response,
            timestamp: Date.now(),
        });
        if (this.responseCache.size > this.config.caching.maxSize) {
            const entries = Array.from(this.responseCache.entries());
            const toRemove = entries.slice(0, Math.floor(entries.length * 0.2));
            for (const [key] of toRemove) {
                this.responseCache.delete(key);
            }
        }
    }
    generateCacheKey(request) {
        return `${request.model}_${request.prompt}_${request.maxTokens}_${request.temperature}`;
    }
    updateRequestMetrics(modelId, startTime, success, error) {
        const metrics = this.modelMetrics.get(modelId);
        if (!metrics)
            return;
        const responseTime = Date.now() - startTime;
        metrics.totalRequests++;
        if (success) {
            metrics.successfulRequests++;
        }
        metrics.averageLatency = (metrics.averageLatency * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;
        metrics.errorRate = 1 - (metrics.successfulRequests / metrics.totalRequests);
        metrics.lastUsed = new Date();
        const recentSuccessRate = metrics.successfulRequests / metrics.totalRequests;
        metrics.availability = Math.max(0, Math.min(1, recentSuccessRate));
    }
    startHealthChecks() {
        this.healthCheckTimer = setInterval(() => {
            this.performHealthChecks().catch(error => log.error('❌ Health check failed', LogContext.API, { error }));
        }, this.config.loadBalancing.healthCheckInterval);
    }
    startMetricsUpdates() {
        this.metricsUpdateTimer = setInterval(() => {
            this.updateMetrics();
        }, 60000);
    }
    async performHealthChecks() {
        for (const [providerName, connection] of this.providers) {
            try {
                const isHealthy = await this.checkProviderHealth(connection.provider);
                connection.isHealthy = isHealthy;
                connection.lastHealthCheck = new Date();
                if (!isHealthy) {
                    log.warn(`⚠️ Provider ${providerName} is unhealthy`, LogContext.API);
                }
            }
            catch (error) {
                connection.isHealthy = false;
                log.error(`❌ Health check failed for provider ${providerName}`, LogContext.API, { error });
            }
        }
    }
    async checkProviderHealth(provider) {
        return true;
    }
    updateMetrics() {
        const totalRequests = Array.from(this.modelMetrics.values())
            .reduce((sum, metrics) => sum + metrics.totalRequests, 0);
        this.emit('metricsUpdated', {
            totalRequests,
            providersCount: this.providers.size,
            healthyProviders: Array.from(this.providers.values()).filter(p => p.isHealthy).length,
            averageLatency: this.calculateAverageLatency(),
        });
    }
    calculateAverageLatency() {
        const metrics = Array.from(this.modelMetrics.values());
        if (metrics.length === 0)
            return 0;
        const totalLatency = metrics.reduce((sum, m) => sum + m.averageLatency, 0);
        return totalLatency / metrics.length;
    }
    getProviders() {
        return Array.from(this.providers.values()).map(conn => conn.provider);
    }
    getModelMetrics() {
        return Array.from(this.modelMetrics.values());
    }
    getRoutingRules() {
        return [...this.routingRules];
    }
    updateRoutingRule(ruleId, updates) {
        const rule = this.routingRules.find(r => r.id === ruleId);
        if (rule) {
            Object.assign(rule, updates);
            log.info('📋 Routing rule updated', LogContext.API, { rule: rule.name });
        }
    }
    getStats() {
        const totalRequests = Array.from(this.modelMetrics.values())
            .reduce((sum, m) => sum + m.totalRequests, 0);
        return {
            totalRequests,
            totalProviders: this.providers.size,
            healthyProviders: Array.from(this.providers.values()).filter(p => p.isHealthy).length,
            averageLatency: this.calculateAverageLatency(),
            cacheHitRate: this.responseCache.size > 0 ? 0.85 : 0,
        };
    }
}
export const unifiedLLMRouter = new UnifiedLLMRouterService();
//# sourceMappingURL=unified-router-service.js.map
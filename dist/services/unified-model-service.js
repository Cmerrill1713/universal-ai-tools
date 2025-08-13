import { CircuitBreaker } from '@/utils/circuit-breaker';
import { log, LogContext } from '@/utils/logger';
import { dynamicModelRouter } from './dynamic-model-router';
import { modelDiscoveryService } from './model-discovery-service';
export class UnifiedModelService {
    providerClients = new Map();
    circuitBreakers = new Map();
    activeRequests = new Map();
    constructor() {
        this.initializeProviders();
        this.startHealthChecks();
    }
    async initializeProviders() {
        this.providerClients.set('ollama', {
            baseUrl: 'http://localhost:11434',
            type: 'ollama'
        });
        const lmStudioPorts = [5901, 1234, 8080];
        for (const port of lmStudioPorts) {
            try {
                const response = await fetch(`http://localhost:${port}/v1/models`);
                if (response.ok) {
                    this.providerClients.set('lmstudio', {
                        baseUrl: `http://localhost:${port}`,
                        type: 'openai-compatible'
                    });
                    log.info(`✅ LM Studio detected on port ${port}`, LogContext.AI);
                    break;
                }
            }
            catch {
            }
        }
        for (const [provider] of this.providerClients) {
            this.circuitBreakers.set(provider, new CircuitBreaker(provider, {
                failureThreshold: 3,
                successThreshold: 2,
                timeout: 30000,
                rollingWindow: 60000
            }));
        }
    }
    async generate(request) {
        const startTime = Date.now();
        const requestId = this.generateRequestId();
        try {
            const routing = await dynamicModelRouter.route(request.taskType || 'general', request.prompt, {
                priority: request.priority,
                maxLatencyMs: request.maxLatencyMs,
                requiredCapabilities: request.requiredCapabilities,
            });
            log.info('🚀 Starting generation', LogContext.AI, {
                requestId,
                primary: `${routing.primary.provider}:${routing.primary.name}`,
                fallbacks: routing.fallbacks.length,
                estimatedLatency: routing.estimatedLatency,
            });
            let response = null;
            let lastError = null;
            try {
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Model timeout')), request.maxLatencyMs || 30000));
                response = await Promise.race([
                    this.callModel(routing.primary, request, requestId),
                    timeoutPromise
                ]);
                await dynamicModelRouter.trackPerformance(routing.primary, request.taskType || 'general', {
                    latencyMs: response.metrics.latencyMs,
                    tokensGenerated: response.metrics.tokensGenerated,
                    success: true,
                    quality: this.estimateQuality(response.content, request.prompt),
                });
                return response;
            }
            catch (error) {
                lastError = error;
                log.warn('Primary model failed, trying fallbacks', LogContext.AI, {
                    requestId,
                    model: routing.primary.name,
                    error: lastError.message,
                });
                await dynamicModelRouter.trackPerformance(routing.primary, request.taskType || 'general', {
                    latencyMs: Date.now() - startTime,
                    tokensGenerated: 0,
                    success: false,
                });
            }
            for (const fallbackModel of routing.fallbacks) {
                try {
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fallback model timeout')), request.maxLatencyMs || 30000));
                    response = await Promise.race([
                        this.callModel(fallbackModel, request, requestId),
                        timeoutPromise
                    ]);
                    await dynamicModelRouter.trackPerformance(fallbackModel, request.taskType || 'general', {
                        latencyMs: response.metrics.latencyMs,
                        tokensGenerated: response.metrics.tokensGenerated,
                        success: true,
                        quality: this.estimateQuality(response.content, request.prompt),
                    });
                    log.info('✅ Fallback model succeeded', LogContext.AI, {
                        requestId,
                        model: fallbackModel.name,
                        attemptNumber: routing.fallbacks.indexOf(fallbackModel) + 2,
                    });
                    return response;
                }
                catch (error) {
                    lastError = error;
                    log.warn('Fallback model failed', LogContext.AI, {
                        requestId,
                        model: fallbackModel.name,
                        error: lastError.message,
                    });
                    await dynamicModelRouter.trackPerformance(fallbackModel, request.taskType || 'general', {
                        latencyMs: Date.now() - startTime,
                        tokensGenerated: 0,
                        success: false,
                    });
                }
            }
            throw new Error(`All models failed. Last error: ${lastError?.message}`);
        }
        catch (error) {
            log.error('Generation failed', LogContext.AI, {
                requestId,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime,
            });
            throw error;
        }
        finally {
            this.activeRequests.delete(requestId);
        }
    }
    async callModel(model, request, requestId) {
        const startTime = Date.now();
        const abortController = new AbortController();
        this.activeRequests.set(requestId, abortController);
        const provider = this.providerClients.get(model.provider);
        if (!provider) {
            throw new Error(`Provider ${model.provider} not initialized`);
        }
        const breaker = this.circuitBreakers.get(model.provider);
        if (!breaker) {
            throw new Error(`Circuit breaker not found for ${model.provider}`);
        }
        try {
            let response;
            if (model.provider === 'ollama') {
                response = await this.callOllama(model, request, provider, abortController.signal);
            }
            else if (model.provider === 'lmstudio') {
                response = await this.callLMStudio(model, request, provider, abortController.signal);
            }
            else if (model.provider === 'mlx') {
                response = await this.callMLX(model, request, abortController.signal);
            }
            else {
                throw new Error(`Unsupported provider: ${model.provider}`);
            }
            const latencyMs = Date.now() - startTime;
            const tokensGenerated = this.countTokens(response.content);
            const tokensPerSecond = (tokensGenerated / latencyMs) * 1000;
            return {
                content: response.content,
                model: {
                    id: model.id,
                    provider: model.provider,
                    tier: model.tier,
                },
                metrics: {
                    latencyMs,
                    tokensGenerated,
                    tokensPerSecond,
                },
                routing: {
                    decision: `Used ${model.provider}:${model.name}`,
                    confidence: response.confidence || 0.8,
                    fallbacksAvailable: modelDiscoveryService.getModels().length - 1,
                },
            };
        }
        catch (error) {
            breaker.recordFailure();
            throw error;
        }
    }
    async callOllama(model, request, provider, signal) {
        const messages = [];
        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });
        const response = await fetch(`${provider.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model.id,
                messages,
                stream: false,
                options: {
                    temperature: request.temperature || this.getOptimalTemperature(model),
                    num_predict: request.maxTokens || this.getOptimalMaxTokens(model),
                    num_ctx: this.getOptimalContextSize(model),
                    num_thread: this.getOptimalThreads(model),
                },
            }),
            signal,
        });
        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: data.message?.content || '',
            confidence: 0.85,
        };
    }
    async callLMStudio(model, request, provider, signal) {
        const messages = [];
        if (request.systemPrompt) {
            messages.push({ role: 'system', content: request.systemPrompt });
        }
        messages.push({ role: 'user', content: request.prompt });
        const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model.id,
                messages,
                temperature: request.temperature || this.getOptimalTemperature(model),
                max_tokens: request.maxTokens || this.getOptimalMaxTokens(model),
                stream: false,
            }),
            signal,
        });
        if (!response.ok) {
            throw new Error(`LM Studio error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || '',
            confidence: 0.9,
        };
    }
    async callMLX(model, request, signal) {
        const { mlxProviderService } = await import('./mlx-provider-service.js');
        let fullPrompt = request.prompt;
        if (request.systemPrompt) {
            fullPrompt = `${request.systemPrompt}\n\nUser: ${request.prompt}\nAssistant:`;
        }
        try {
            const content = await mlxProviderService.generate(model.id, fullPrompt, {
                maxTokens: request.maxTokens || this.getOptimalMaxTokens(model),
                temperature: request.temperature || this.getOptimalTemperature(model),
                topK: 40,
                topP: 0.9,
            });
            return {
                content: content.trim(),
                confidence: 0.95,
            };
        }
        catch (error) {
            throw new Error(`MLX error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getOptimalTemperature(model) {
        switch (model.tier) {
            case 1: return 0.3;
            case 2: return 0.5;
            case 3: return 0.7;
            case 4: return 0.8;
            default: return 0.7;
        }
    }
    getOptimalMaxTokens(model) {
        switch (model.tier) {
            case 1: return 512;
            case 2: return 1024;
            case 3: return 2048;
            case 4: return 4096;
            default: return 1024;
        }
    }
    getOptimalContextSize(model) {
        switch (model.tier) {
            case 1: return 2048;
            case 2: return 4096;
            case 3: return 8192;
            case 4: return 16384;
            default: return 4096;
        }
    }
    getOptimalThreads(model) {
        switch (model.tier) {
            case 1: return 4;
            case 2: return 6;
            case 3: return 8;
            case 4: return 12;
            default: return 8;
        }
    }
    countTokens(text) {
        return Math.ceil(text.length / 4);
    }
    estimateQuality(response, prompt) {
        let quality = 0.5;
        const responseLength = response.length;
        const promptLength = prompt.length;
        if (responseLength > promptLength * 0.5 && responseLength < promptLength * 10) {
            quality += 0.2;
        }
        if (response.length > 50 && !response.includes('I cannot') && !response.includes('I don\'t')) {
            quality += 0.2;
        }
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
        if (sentences.length > 1) {
            quality += 0.1;
        }
        return Math.min(1.0, quality);
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    cancelRequest(requestId) {
        const controller = this.activeRequests.get(requestId);
        if (controller) {
            controller.abort();
            this.activeRequests.delete(requestId);
            return true;
        }
        return false;
    }
    startHealthChecks() {
        setInterval(async () => {
            await this.checkProviderHealth();
        }, 30000);
    }
    async checkProviderHealth() {
        for (const [provider, client] of this.providerClients) {
            try {
                if (provider === 'ollama') {
                    const response = await fetch(`${client.baseUrl}/api/tags`);
                    if (!response.ok) {
                        log.warn(`Provider ${provider} health check failed`, LogContext.AI);
                    }
                }
                else if (provider === 'lmstudio') {
                    const response = await fetch(`${client.baseUrl}/v1/models`);
                    if (!response.ok) {
                        log.warn(`Provider ${provider} health check failed`, LogContext.AI);
                    }
                }
            }
            catch (error) {
                log.warn(`Provider ${provider} is unreachable`, LogContext.AI, { error });
            }
        }
    }
    getProviderStats() {
        const stats = {};
        for (const [provider, breaker] of this.circuitBreakers) {
            stats[provider] = {
                state: breaker.getState(),
                failures: breaker.getFailureCount(),
                lastFailure: breaker.getLastFailureTime(),
            };
        }
        return stats;
    }
    getAvailableModels() {
        const models = modelDiscoveryService.getModels();
        const summary = {};
        for (const model of models) {
            const key = `${model.provider}_tier${model.tier}`;
            summary[key] = (summary[key] || 0) + 1;
        }
        return summary;
    }
}
export const unifiedModelService = new UnifiedModelService();
//# sourceMappingURL=unified-model-service.js.map
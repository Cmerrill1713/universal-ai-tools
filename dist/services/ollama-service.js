import { CircuitBreakerRegistry, createCircuitBreaker } from '@/utils/circuit-breaker';
import { isAllowedHost, normalizeHttpUrl } from '@/utils/url-security';
import { config } from '../config/environment.js';
import { log, LogContext } from '../utils/logger.js';
const fetchApi = globalThis.fetch?.bind(globalThis);
export class OllamaService {
    baseUrl;
    defaultModel = 'tinyllama:latest';
    isAvailable = false;
    breaker = createCircuitBreaker('ollama', {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 15000,
        volumeThreshold: 5,
        errorThresholdPercentage: 50,
        rollingWindow: 30000,
    });
    constructor() {
        const base = config.llm.ollamaUrl || 'http://localhost:11434';
        try {
            const normalized = normalizeHttpUrl(base);
            if (!normalized)
                throw new Error('Unsupported protocol');
            if (!isAllowedHost(normalized, 'ALLOWED_LLM_HOSTS')) {
                throw new Error('Host not allowed');
            }
            this.baseUrl = normalized;
        }
        catch (e) {
            log.error('Invalid OLLAMA_URL, falling back to localhost:11434', LogContext.AI, {
                error: e instanceof Error ? e.message : String(e),
            });
            this.baseUrl = 'http://localhost:11434';
        }
        this.checkAvailability();
        CircuitBreakerRegistry.register('ollama', this.breaker);
    }
    async checkAvailability() {
        try {
            const response = await fetchApi(`${this.baseUrl}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                this.isAvailable = true;
                log.info('✅ Ollama service is available', LogContext.AI, {
                    models: data.models?.length || 0,
                    baseUrl: this.baseUrl,
                });
                const models = data.models || [];
                log.info(`Available Ollama models:`, LogContext.AI, {
                    models: models.map((m) => m.name)
                });
                const preferred = models.find((m) => m.name === 'tinyllama:latest') ||
                    models.find((m) => m.name === 'llama3.2:1b') ||
                    models.find((m) => m.name === 'llama3.2:3b') ||
                    models.find((m) => m.name === 'phi3:mini') ||
                    models.find((m) => m.name.includes('mistral')) ||
                    models.find((m) => m.name.includes('qwen')) ||
                    models.find((m) => !m.name.includes('embed') && !m.name.includes('vision')) ||
                    models[0];
                if (preferred?.name) {
                    this.defaultModel = preferred.name;
                    log.info(`Selected model for chat: ${this.defaultModel}`, LogContext.AI);
                }
            }
            else {
                throw new Error(`HTTP ${response.status}`);
            }
        }
        catch (error) {
            this.isAvailable = false;
            log.error('❌ Ollama service unavailable', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
                baseUrl: this.baseUrl,
            });
        }
    }
    async generateResponse(messages, model, options) {
        if (!this.isAvailable) {
            await this.checkAvailability();
            if (!this.isAvailable) {
                log.warn('Ollama marked unavailable; attempting request anyway', LogContext.AI);
            }
        }
        const requestBody = {
            model: model || this.defaultModel,
            messages,
            stream: options?.stream || false,
            options: {
                temperature: options?.temperature ?? 0.3,
                num_predict: options?.max_tokens ?? 256,
                top_k: 10,
                top_p: 0.7,
                repeat_penalty: 1.1,
                num_ctx: 2048,
                num_thread: 8,
                keep_alive: '5m',
            },
        };
        try {
            const startTime = Date.now();
            const response = await this.breaker.execute(async () => fetchApi(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            }));
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            const duration = Date.now() - startTime;
            log.info('✅ Ollama response generated', LogContext.AI, {
                model: data.model,
                duration: `${duration}ms`,
                inputTokens: data.prompt_eval_count || 0,
                outputTokens: data.eval_count || 0,
                totalDuration: data.total_duration
                    ? `${Math.round(data.total_duration / 1000000)}ms`
                    : undefined,
            });
            return data;
        }
        catch (error) {
            log.error('❌ Ollama generation failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
                model: model || this.defaultModel,
            });
            throw error;
        }
    }
    async generateSimpleResponse(params) {
        if (!this.isAvailable) {
            throw new Error('Ollama service is not available');
        }
        const requestBody = {
            model: params.model,
            prompt: params.prompt,
            stream: false,
            options: {
                temperature: params.options?.temperature ?? 0.1,
                num_predict: params.options?.num_predict ?? 128,
                top_k: 20,
                top_p: 0.9,
                repeat_penalty: 1.0,
                keep_alive: '5m',
            },
            ...(params.options?.format && { format: params.options.format }),
        };
        try {
            const startTime = Date.now();
            const response = await this.breaker.execute(async () => fetchApi(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            }));
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            const duration = Date.now() - startTime;
            log.info('✅ Ollama response generated', LogContext.AI, {
                model: data.model,
                duration: `${duration}ms`,
                outputTokens: data.eval_count || 0,
                totalDuration: data.total_duration
                    ? `${Math.round(data.total_duration / 1000000)}ms`
                    : undefined,
            });
            return data;
        }
        catch (error) {
            log.error('❌ Ollama generation failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
                model: params.model,
            });
            throw error;
        }
    }
    async generateStreamResponse(messages, model, onChunk) {
        if (!this.isAvailable) {
            throw new Error('Ollama service is not available');
        }
        const requestBody = {
            model: model || this.defaultModel,
            messages,
            stream: true,
        };
        try {
            const response = await this.breaker.execute(async () => fetchApi(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            }));
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body reader available');
            }
            let fullResponse = '';
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter((line) => line.trim());
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.message?.content) {
                            fullResponse += parsed.message.content;
                            onChunk?.(parsed);
                        }
                        if (parsed.done) {
                            return fullResponse;
                        }
                    }
                    catch (parseError) {
                    }
                }
            }
            return fullResponse;
        }
        catch (error) {
            log.error('❌ Ollama streaming failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async getAvailableModels() {
        try {
            const response = await this.breaker.execute(async () => fetchApi(`${this.baseUrl}/api/tags`));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return data.models?.map((model) => model.name) || [];
        }
        catch (error) {
            log.error('❌ Failed to fetch Ollama models', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    isServiceAvailable() {
        return this.isAvailable;
    }
    getDefaultModel() {
        return this.defaultModel;
    }
    async pullModel(modelName) {
        try {
            log.info(`🔄 Pulling Ollama model: ${modelName}`, LogContext.AI);
            const response = await this.breaker.execute(async () => fetchApi(`${this.baseUrl}/api/pull`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName }),
            }));
            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.status}`);
            }
            log.info(`✅ Model pulled successfully: ${modelName}`, LogContext.AI);
        }
        catch (error) {
            log.error(`❌ Failed to pull model: ${modelName}`, LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}
export const ollamaService = new OllamaService();
export default ollamaService;
//# sourceMappingURL=ollama-service.js.map
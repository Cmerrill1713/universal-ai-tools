import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
import { mcpIntegrationService } from './mcp-integration-service';
export var LLMProvider;
(function (LLMProvider) {
    LLMProvider["OPENAI"] = "openai";
    LLMProvider["ANTHROPIC"] = "anthropic";
    LLMProvider["OLLAMA"] = "ollama";
    LLMProvider["INTERNAL"] = "internal";
})(LLMProvider || (LLMProvider = {}));
export class LLMRouterService {
    modelConfigs = new Map();
    providerClients = new Map();
    constructor() {
        this.initializeAsync();
    }
    async initializeAsync() {
        await this.initializeModelConfigs();
        await this.initializeProviders();
    }
    async initializeModelConfigs() {
        const configs = await this.generateDynamicConfigs();
        configs.forEach((config) => {
            this.modelConfigs.set(config.internalName, config);
        });
        log.info('✅ LLM model configurations initialized', LogContext.AI, {
            totalModels: configs.length,
            providers: Array.from(new Set(configs.map((c) => c.provider))),
        });
    }
    async generateDynamicConfigs() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            const data = await response.json();
            const availableModels = data.models?.map((m) => m.name) || [];
            if (availableModels.length === 0) {
                log.warn('⚠️ No models found in Ollama, using fallback configuration', LogContext.AI);
                return this.getFallbackConfigs();
            }
            const fastModels = availableModels.filter((name) => name.includes('tiny') || name.includes('1b') || name.includes('2b') ||
                name.includes('small') || name.includes('mini'));
            const largeModels = availableModels.filter((name) => name.includes('20b') || name.includes('24b') || name.includes('70b') ||
                name.includes('large') || name.includes('xl'));
            const primaryModel = largeModels[0] || availableModels[0];
            const secondaryModel = fastModels[0] || availableModels[availableModels.length - 1] || primaryModel;
            return [
                {
                    internalName: 'planner-pro',
                    provider: LLMProvider.OLLAMA,
                    externalModel: primaryModel,
                    capabilities: ['planning', 'strategy', 'analysis'],
                    maxTokens: 4000,
                    temperature: 0.3,
                    priority: 1,
                },
                {
                    internalName: 'planner-fast',
                    provider: LLMProvider.OLLAMA,
                    externalModel: secondaryModel,
                    capabilities: ['planning', 'quick_analysis'],
                    maxTokens: 2000,
                    temperature: 0.4,
                    priority: 2,
                },
                {
                    internalName: 'code-expert',
                    provider: LLMProvider.OLLAMA,
                    externalModel: primaryModel,
                    capabilities: ['code_generation', 'debugging', 'refactoring'],
                    maxTokens: 6000,
                    temperature: 0.2,
                    priority: 1,
                },
                {
                    internalName: 'code-assistant',
                    provider: LLMProvider.OLLAMA,
                    externalModel: secondaryModel,
                    capabilities: ['code_analysis', 'documentation'],
                    maxTokens: 4000,
                    temperature: 0.3,
                    priority: 2,
                },
                {
                    internalName: 'retriever-smart',
                    provider: LLMProvider.OLLAMA,
                    externalModel: primaryModel,
                    capabilities: ['information_retrieval', 'summarization'],
                    maxTokens: 3000,
                    temperature: 0.2,
                    priority: 1,
                },
                {
                    internalName: 'retriever-fast',
                    provider: LLMProvider.OLLAMA,
                    externalModel: secondaryModel,
                    capabilities: ['quick_search', 'basic_analysis'],
                    maxTokens: 1500,
                    temperature: 0.3,
                    priority: 2,
                },
                {
                    internalName: 'assistant-personal',
                    provider: LLMProvider.OLLAMA,
                    externalModel: primaryModel,
                    capabilities: ['conversation', 'task_management', 'empathy'],
                    maxTokens: 3000,
                    temperature: 0.7,
                    priority: 1,
                },
                {
                    internalName: 'assistant-casual',
                    provider: LLMProvider.OLLAMA,
                    externalModel: secondaryModel,
                    capabilities: ['casual_chat', 'quick_help'],
                    maxTokens: 2000,
                    temperature: 0.8,
                    priority: 2,
                },
                {
                    internalName: 'synthesizer-deep',
                    provider: LLMProvider.OLLAMA,
                    externalModel: primaryModel,
                    capabilities: ['synthesis', 'deep_analysis', 'consensus'],
                    maxTokens: 8000,
                    temperature: 0.4,
                    priority: 1,
                },
                {
                    internalName: 'synthesizer-quick',
                    provider: LLMProvider.OLLAMA,
                    externalModel: secondaryModel,
                    capabilities: ['quick_synthesis', 'summary'],
                    maxTokens: 3000,
                    temperature: 0.5,
                    priority: 2,
                },
                {
                    internalName: 'local-general',
                    provider: LLMProvider.OLLAMA,
                    externalModel: secondaryModel,
                    capabilities: ['general_purpose', 'offline'],
                    maxTokens: 1024,
                    temperature: 0.5,
                    priority: 3,
                },
            ];
        }
        catch (error) {
            log.warn('⚠️ Could not fetch available models, using fallback', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error)
            });
            return this.getFallbackConfigs();
        }
    }
    getFallbackConfigs() {
        return [
            {
                internalName: 'local-general',
                provider: LLMProvider.OLLAMA,
                externalModel: 'fallback-model',
                capabilities: ['general_purpose'],
                maxTokens: 1024,
                temperature: 0.5,
                priority: 1,
            }
        ];
    }
    async initializeProviders() {
        if (true) {
            log.info('🌐 Remote LLM providers disabled by configuration', LogContext.AI, {
                offlineMode: true,
            });
        }
        else {
            log.info('🌐 Offline mode or remote LLMs disabled - skipping OpenAI/Anthropic init', LogContext.AI, {
                offlineMode: config.offlineMode,
                disableRemoteLLM: config.disableRemoteLLM,
            });
        }
        try {
            const response = await fetch(`${config.llm.ollamaUrl}/api/tags`);
            if (response.ok) {
                this.providerClients.set(LLMProvider.OLLAMA, { baseUrl: config.llm.ollamaUrl });
                log.info('✅ Ollama client initialized', LogContext.AI);
            }
        }
        catch (error) {
            log.warn('⚠️ Ollama not available, using cloud providers only', LogContext.AI);
        }
    }
    async generateResponse(internalModel, messages, options) {
        const startTime = Date.now();
        const shouldIncludeContext = options?.includeContext !== false;
        let enhancedMessages = messages;
        if (shouldIncludeContext) {
            enhancedMessages = await this.enhanceMessagesWithMCPContext(messages, {
                contextTypes: options?.contextTypes || ['project_overview', 'code_patterns'],
                userId: options?.userId,
                requestId: options?.requestId,
            });
        }
        let modelConfig = this.modelConfigs.get(internalModel);
        if (!modelConfig && options?.capabilities) {
            modelConfig = this.findBestModelForCapabilities(options.capabilities);
        }
        if (!modelConfig) {
            modelConfig =
                this.modelConfigs.get('local-general') || Array.from(this.modelConfigs.values())[0];
        }
        if (!modelConfig) {
            throw new Error(`No model configuration available for: ${internalModel}`);
        }
        try {
            const response = await this.routeToProvider(modelConfig, enhancedMessages, options);
            const duration = Date.now() - startTime;
            log.info('✅ LLM response generated', LogContext.AI, {
                internalModel,
                provider: modelConfig.provider,
                externalModel: modelConfig.externalModel,
                duration: `${duration}ms`,
                tokens: response.usage?.total_tokens || 0,
            });
            return {
                ...response,
                metadata: {
                    ...response.metadata,
                    duration_ms: duration,
                },
            };
        }
        catch (error) {
            if (modelConfig.priority < 3) {
                log.warn(`⚠️ Primary provider failed, trying fallback`, LogContext.AI, {
                    internalModel,
                    error: error instanceof Error ? error.message : String(error),
                });
                const fallbackConfig = this.findFallbackModel(modelConfig.capabilities);
                if (fallbackConfig) {
                    return this.routeToProvider(fallbackConfig, messages, options);
                }
            }
            throw error;
        }
    }
    async routeToProvider(modelConfig, messages, options) {
        let client = this.providerClients.get(modelConfig.provider);
        let actualConfig = modelConfig;
        const remoteProviderRequested = actualConfig.provider === LLMProvider.OPENAI ||
            actualConfig.provider === LLMProvider.ANTHROPIC;
        if ((config.offlineMode || config.disableRemoteLLM) && remoteProviderRequested) {
            if (this.providerClients.has(LLMProvider.OLLAMA)) {
                log.info('🌐 Remote LLM disabled - rerouting to Ollama', LogContext.AI, {
                    requestedProvider: actualConfig.provider,
                    internalModel: actualConfig.internalName,
                });
                client = this.providerClients.get(LLMProvider.OLLAMA);
                actualConfig = {
                    ...actualConfig,
                    provider: LLMProvider.OLLAMA,
                    externalModel: 'llama3.2:3b',
                };
            }
            else {
                throw new Error('Remote LLMs disabled and no local provider available');
            }
        }
        if (this.providerClients.has(LLMProvider.OLLAMA)) {
            client = this.providerClients.get(LLMProvider.OLLAMA);
            actualConfig = {
                ...modelConfig,
                provider: LLMProvider.OLLAMA,
                externalModel: 'llama3.2:3b',
            };
            log.debug('Forcing Ollama provider (local-first)', LogContext.AI, {
                internalModel: modelConfig.internalName,
                externalModel: actualConfig.externalModel,
            });
        }
        if (!client && this.providerClients.has(LLMProvider.OLLAMA)) {
            log.warn(`⚠️ Provider ${modelConfig.provider} not available, falling back to Ollama`, LogContext.AI);
            client = this.providerClients.get(LLMProvider.OLLAMA);
            actualConfig = {
                ...modelConfig,
                provider: LLMProvider.OLLAMA,
                externalModel: 'llama3.2:3b',
            };
        }
        if (!client) {
            throw new Error(`Provider ${modelConfig.provider} not available and no fallback found`);
        }
        const temperature = options?.temperature ?? actualConfig.temperature;
        const maxTokens = options?.maxTokens ?? actualConfig.maxTokens;
        switch (actualConfig.provider) {
            case LLMProvider.OPENAI:
                throw new Error('OpenAI provider disabled');
            case LLMProvider.ANTHROPIC:
                return this.callAnthropic(client, actualConfig.externalModel, messages, temperature, maxTokens);
            case LLMProvider.OLLAMA:
                return this.callOllama(client, actualConfig.externalModel, messages, temperature, maxTokens);
            default:
                throw new Error(`Unsupported provider: ${actualConfig.provider}`);
        }
    }
    async callOpenAI(client, model, messages, temperature, maxTokens) {
        const openaiClient = client;
        const completion = await openaiClient.chat.completions.create({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
        });
        return {
            content: completion.choices[0]?.message?.content || '',
            model,
            provider: LLMProvider.OPENAI,
            usage: {
                prompt_tokens: completion.usage?.prompt_tokens || 0,
                completion_tokens: completion.usage?.completion_tokens || 0,
                total_tokens: completion.usage?.total_tokens || 0,
            },
        };
    }
    async callAnthropic(client, model, messages, temperature, maxTokens) {
        const anthropicClient = client;
        const systemMessage = messages.find((m) => m.role === 'system');
        const conversationMessages = messages.filter((m) => m.role !== 'system');
        const message = await anthropicClient.messages.create({
            model,
            max_tokens: maxTokens,
            temperature,
            system: systemMessage?.content,
            messages: conversationMessages,
        });
        return {
            content: message.content[0]?.text || '',
            model,
            provider: LLMProvider.ANTHROPIC,
            usage: {
                prompt_tokens: message.usage?.input_tokens || 0,
                completion_tokens: message.usage?.output_tokens || 0,
                total_tokens: (message.usage?.input_tokens || 0) +
                    (message.usage?.output_tokens || 0),
            },
        };
    }
    async callOllama(client, model, messages, temperature, maxTokens) {
        const ollamaClient = client;
        const response = await fetch(`${ollamaClient.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                options: {
                    temperature,
                    num_predict: maxTokens,
                },
            }),
        });
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }
        const data = await response.json();
        return {
            content: data.message?.content || '',
            model,
            provider: LLMProvider.OLLAMA,
            usage: {
                prompt_tokens: data.prompt_eval_count || 0,
                completion_tokens: data.eval_count || 0,
                total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
            },
        };
    }
    findBestModelForCapabilities(capabilities) {
        const models = Array.from(this.modelConfigs.values())
            .filter((model) => capabilities.some((cap) => model.capabilities.includes(cap)))
            .sort((a, b) => a.priority - b.priority);
        return models[0];
    }
    findFallbackModel(capabilities) {
        const fallbackModels = Array.from(this.modelConfigs.values())
            .filter((model) => model.priority > 1 && capabilities.some((cap) => model.capabilities.includes(cap)))
            .sort((a, b) => a.priority - b.priority);
        return fallbackModels[0];
    }
    getAvailableModels() {
        return Array.from(this.modelConfigs.keys());
    }
    getModelCapabilities(internalModel) {
        return this.modelConfigs.get(internalModel)?.capabilities || [];
    }
    getProviderStatus() {
        return {
            [LLMProvider.OPENAI]: this.providerClients.has(LLMProvider.OPENAI),
            [LLMProvider.ANTHROPIC]: this.providerClients.has(LLMProvider.ANTHROPIC),
            [LLMProvider.OLLAMA]: this.providerClients.has(LLMProvider.OLLAMA),
            [LLMProvider.INTERNAL]: true,
        };
    }
    async enhanceMessagesWithMCPContext(messages, options = {}) {
        try {
            const userInput = this.extractUserInputFromMessages(messages);
            if (!userInput)
                return messages;
            const contextPromises = [];
            const { contextTypes = ['project_overview', 'code_patterns'], maxContextTokens = 3000 } = options;
            for (const contextType of contextTypes) {
                if (contextType === 'project_overview') {
                    contextPromises.push(mcpIntegrationService.sendMessage('search_context', {
                        query: userInput,
                        category: 'project_overview',
                        limit: 3,
                    }));
                }
                else if (contextType === 'code_patterns') {
                    contextPromises.push(mcpIntegrationService.sendMessage('search_context', {
                        query: userInput,
                        category: 'code_patterns',
                        limit: 5,
                    }));
                }
                else if (contextType === 'error_analysis') {
                    contextPromises.push(mcpIntegrationService.sendMessage('search_context', {
                        query: userInput,
                        category: 'error_analysis',
                        limit: 3,
                    }));
                }
                else if (contextType === 'conversation_history') {
                    contextPromises.push(mcpIntegrationService.sendMessage('get_recent_context', {
                        category: 'conversation',
                        limit: 5,
                    }));
                }
            }
            const contextResults = await Promise.all(contextPromises);
            const relevantContext = [];
            for (const result of contextResults) {
                if (result && typeof result === 'object' && 'results' in result) {
                    const { results } = result;
                    if (Array.isArray(results)) {
                        relevantContext.push(...results);
                    }
                }
            }
            if (relevantContext.length === 0) {
                return messages;
            }
            const contextTokens = this.estimateContextTokens(relevantContext);
            const filteredContext = contextTokens > maxContextTokens
                ? this.filterContextByRelevance(relevantContext, maxContextTokens)
                : relevantContext;
            const contextSummary = this.formatContextForInjection(filteredContext);
            const enhancedMessages = JSON.parse(JSON.stringify(messages));
            const systemMessage = enhancedMessages.find((msg) => msg.role === 'system');
            if (systemMessage) {
                systemMessage.content = `${systemMessage.content}\n\n## Relevant Project Context:\n${contextSummary}`;
            }
            else {
                enhancedMessages.unshift({
                    role: 'system',
                    content: `## Relevant Project Context:\n${contextSummary}`,
                });
            }
            log.debug('✅ Enhanced messages with MCP context', LogContext.MCP, {
                contextItems: filteredContext.length,
                contextTokens: this.estimateContextTokens(filteredContext),
                requestId: options.requestId,
            });
            return enhancedMessages;
        }
        catch (error) {
            log.warn('⚠️ Failed to enhance messages with MCP context, using original messages', LogContext.MCP, {
                error: error instanceof Error ? error.message : String(error),
                requestId: options.requestId,
            });
            return messages;
        }
    }
    extractUserInputFromMessages(messages) {
        const userMessages = messages.filter((msg) => msg.role === 'user');
        if (userMessages.length === 0)
            return '';
        return userMessages[userMessages.length - 1]?.content || '';
    }
    estimateContextTokens(context) {
        let totalTokens = 0;
        for (const item of context) {
            const content = item.content || '';
            totalTokens += Math.ceil(content.length / 4);
        }
        return totalTokens;
    }
    filterContextByRelevance(context, maxTokens) {
        const sortedContext = context.sort((a, b) => {
            const scoreA = a.relevanceScore || a.score || 0;
            const scoreB = b.relevanceScore || b.score || 0;
            return scoreB - scoreA;
        });
        const filtered = [];
        let currentTokens = 0;
        for (const item of sortedContext) {
            const itemTokens = Math.ceil((item.content || '').length / 4);
            if (currentTokens + itemTokens <= maxTokens) {
                filtered.push(item);
                currentTokens += itemTokens;
            }
            else {
                break;
            }
        }
        return filtered;
    }
    formatContextForInjection(context) {
        const formatted = context
            .map((item) => {
            const source = item.source || item.category || 'unknown';
            const content = item.content || '';
            return `**[${source}]**: ${content}`;
        })
            .join('\n\n');
        return formatted.length > 2000 ? `${formatted.slice(0, 2000)}...` : formatted;
    }
}
export const llmRouter = new LLMRouterService();
export default llmRouter;
//# sourceMappingURL=llm-router-service.js.map
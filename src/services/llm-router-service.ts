/**
 * LLM Router Service - Universal Model Routing
 * Routes internal model names to external LLM providers (OpenAI, Anthropic, Ollama)
 * Provides unified interface for all agent communication
 */

import { config } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';
import { secretsManager } from './secrets-manager';
import { mcpIntegrationService } from './mcp-integration-service';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata?: {
    duration_ms: number;
    confidence?: number;
    reasoning?: string;
  };
}

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
  INTERNAL = 'internal',
}

export interface ModelConfig {
  internalName: string;
  provider: LLMProvider;
  externalModel: string;
  capabilities: string[];
  maxTokens: number;
  temperature: number;
  priority: number;
}

export class LLMRouterService {
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private providerClients: Map<LLMProvider, any> = new Map();

  constructor() {
    this.initializeModelConfigs();
    this.initializeProviders();
  }

  private initializeModelConfigs(): void {
    // Internal model mappings to external providers
    const configs: ModelConfig[] = [
      // Planning and Strategy Models
      {
        internalName: 'planner-pro',
        provider: LLMProvider.ANTHROPIC,
        externalModel: 'claude-3-sonnet-20240229',
        capabilities: ['planning', 'strategy', 'analysis'],
        maxTokens: 4000,
        temperature: 0.3,
        priority: 1,
      },
      {
        internalName: 'planner-fast',
        provider: LLMProvider.OPENAI,
        externalModel: 'gpt-4o-mini',
        capabilities: ['planning', 'quick_analysis'],
        maxTokens: 2000,
        temperature: 0.4,
        priority: 2,
      },

      // Code and Technical Models
      {
        internalName: 'code-expert',
        provider: LLMProvider.ANTHROPIC,
        externalModel: 'claude-3-sonnet-20240229',
        capabilities: ['code_generation', 'debugging', 'refactoring'],
        maxTokens: 6000,
        temperature: 0.2,
        priority: 1,
      },
      {
        internalName: 'code-assistant',
        provider: LLMProvider.OPENAI,
        externalModel: 'gpt-4o',
        capabilities: ['code_analysis', 'documentation'],
        maxTokens: 4000,
        temperature: 0.3,
        priority: 2,
      },

      // Retrieval and Information Models
      {
        internalName: 'retriever-smart',
        provider: LLMProvider.ANTHROPIC,
        externalModel: 'claude-3-haiku-20240307',
        capabilities: ['information_retrieval', 'summarization'],
        maxTokens: 3000,
        temperature: 0.2,
        priority: 1,
      },
      {
        internalName: 'retriever-fast',
        provider: LLMProvider.OPENAI,
        externalModel: 'gpt-4o-mini',
        capabilities: ['quick_search', 'basic_analysis'],
        maxTokens: 1500,
        temperature: 0.3,
        priority: 2,
      },

      // Personal Assistant Models
      {
        internalName: 'assistant-personal',
        provider: LLMProvider.ANTHROPIC,
        externalModel: 'claude-3-sonnet-20240229',
        capabilities: ['conversation', 'task_management', 'empathy'],
        maxTokens: 3000,
        temperature: 0.7,
        priority: 1,
      },
      {
        internalName: 'assistant-casual',
        provider: LLMProvider.OPENAI,
        externalModel: 'gpt-4o',
        capabilities: ['casual_chat', 'quick_help'],
        maxTokens: 2000,
        temperature: 0.8,
        priority: 2,
      },

      // Synthesis and Analysis Models
      {
        internalName: 'synthesizer-deep',
        provider: LLMProvider.ANTHROPIC,
        externalModel: 'claude-3-opus-20240229',
        capabilities: ['synthesis', 'deep_analysis', 'consensus'],
        maxTokens: 8000,
        temperature: 0.4,
        priority: 1,
      },
      {
        internalName: 'synthesizer-quick',
        provider: LLMProvider.OPENAI,
        externalModel: 'gpt-4o',
        capabilities: ['quick_synthesis', 'summary'],
        maxTokens: 3000,
        temperature: 0.5,
        priority: 2,
      },

      // Local/Ollama Models (fallback)
      {
        internalName: 'local-general',
        provider: LLMProvider.OLLAMA,
        externalModel: 'llama3.2:3b',
        capabilities: ['general_purpose', 'offline'],
        maxTokens: 2000,
        temperature: 0.6,
        priority: 3,
      },
    ];

    configs.forEach((config) => {
      this.modelConfigs.set(config.internalName, config);
    });

    log.info('✅ LLM model configurations initialized', LogContext.AI, {
      totalModels: configs.length,
      providers: Array.from(new Set(configs.map((c) => c.provider))),
    });
  }

  private async initializeProviders(): Promise<void> {
    // Initialize OpenAI client - try Supabase Vault first, then env
    const openaiKey = await secretsManager.getApiKeyWithFallback('openai', 'OPENAI_API_KEY');
    if (openaiKey) {
      try {
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({
          apiKey: openaiKey,
        });
        this.providerClients.set(LLMProvider.OPENAI, openai);
        log.info('✅ OpenAI client initialized', LogContext.AI);
      } catch (error) {
        log.error('❌ Failed to initialize OpenAI client', LogContext.AI, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      log.warn('⚠️ OpenAI API key not found in Vault or environment', LogContext.AI);
    }

    // Initialize Anthropic client - try Supabase Vault first, then env
    const anthropicKey = await secretsManager.getApiKeyWithFallback(
      'anthropic',
      'ANTHROPIC_API_KEY'
    );
    if (anthropicKey) {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({
          apiKey: anthropicKey,
        });
        this.providerClients.set(LLMProvider.ANTHROPIC, anthropic);
        log.info('✅ Anthropic client initialized', LogContext.AI);
      } catch (error) {
        log.error('❌ Failed to initialize Anthropic client', LogContext.AI, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      log.warn('⚠️ Anthropic API key not found in Vault or environment', LogContext.AI);
    }

    // Initialize Ollama client
    try {
      const response = await fetch(`${config.llm.ollamaUrl}/api/tags`);
      if (response.ok) {
        this.providerClients.set(LLMProvider.OLLAMA, { baseUrl: config.llm.ollamaUrl });
        log.info('✅ Ollama client initialized', LogContext.AI);
      }
    } catch (error) {
      log.warn('⚠️ Ollama not available, using cloud providers only', LogContext.AI);
    }
  }

  public async generateResponse(
    internalModel: string,
    messages: LLMMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      capabilities?: string[];
      includeContext?: boolean;
      contextTypes?: string[];
      userId?: string;
      requestId?: string;
    }
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    // Enhance messages with MCP context if requested (default: true)
    const shouldIncludeContext = options?.includeContext !== false;
    let enhancedMessages = messages;

    if (shouldIncludeContext) {
      enhancedMessages = await this.enhanceMessagesWithMCPContext(messages, {
        contextTypes: options?.contextTypes || ['project_overview', 'code_patterns'],
        userId: options?.userId,
        requestId: options?.requestId,
      });
    }

    // Get model config or find best match
    let modelConfig = this.modelConfigs.get(internalModel);

    if (!modelConfig && options?.capabilities) {
      // Find best model based on capabilities
      modelConfig = this.findBestModelForCapabilities(options.capabilities);
    }

    if (!modelConfig) {
      // Default fallback
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
    } catch (error) {
      // Try fallback provider if available
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

  private async routeToProvider(
    modelConfig: ModelConfig,
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    let client = this.providerClients.get(modelConfig.provider);
    let actualConfig = modelConfig;

    // If the primary provider is not available, try Ollama as fallback
    if (!client && this.providerClients.has(LLMProvider.OLLAMA)) {
      log.warn(
        `⚠️ Provider ${modelConfig.provider} not available, falling back to Ollama`,
        LogContext.AI
      );
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
        return this.callOpenAI(
          client,
          actualConfig.externalModel,
          messages,
          temperature,
          maxTokens
        );

      case LLMProvider.ANTHROPIC:
        return this.callAnthropic(
          client,
          actualConfig.externalModel,
          messages,
          temperature,
          maxTokens
        );

      case LLMProvider.OLLAMA:
        return this.callOllama(
          client,
          actualConfig.externalModel,
          messages,
          temperature,
          maxTokens
        );

      default:
        throw new Error(`Unsupported provider: ${actualConfig.provider}`);
    }
  }

  private async callOpenAI(
    client: unknown,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const openaiClient = client as any;
    const completion = await openaiClient.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: (completion as any).choices[0]?.message?.content || '',
      model,
      provider: LLMProvider.OPENAI,
      usage: {
        prompt_tokens: (completion as any).usage?.prompt_tokens || 0,
        completion_tokens: (completion as any).usage?.completion_tokens || 0,
        total_tokens: (completion as any).usage?.total_tokens || 0,
      },
    };
  }

  private async callAnthropic(
    client: unknown,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const anthropicClient = client as any;
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
      content: (message as any).content[0]?.text || '',
      model,
      provider: LLMProvider.ANTHROPIC,
      usage: {
        prompt_tokens: (message as any).usage?.input_tokens || 0,
        completion_tokens: (message as any).usage?.output_tokens || 0,
        total_tokens: ((message as any).usage?.input_tokens || 0) + ((message as any).usage?.output_tokens || 0),
      },
    };
  }

  private async callOllama(
    client: unknown,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const ollamaClient = client as any;
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

  private findBestModelForCapabilities(capabilities: string[]): ModelConfig | undefined {
    const models = Array.from(this.modelConfigs.values())
      .filter((model) => capabilities.some((cap) => model.capabilities.includes(cap)))
      .sort((a, b) => a.priority - b.priority);

    return models[0];
  }

  private findFallbackModel(capabilities: string[]): ModelConfig | undefined {
    const fallbackModels = Array.from(this.modelConfigs.values())
      .filter(
        (model) =>
          model.priority > 1 && capabilities.some((cap) => model.capabilities.includes(cap))
      )
      .sort((a, b) => a.priority - b.priority);

    return fallbackModels[0];
  }

  public getAvailableModels(): string[] {
    return Array.from(this.modelConfigs.keys());
  }

  public getModelCapabilities(internalModel: string): string[] {
    return this.modelConfigs.get(internalModel)?.capabilities || [];
  }

  public getProviderStatus(): Record<LLMProvider, boolean> {
    return {
      [LLMProvider.OPENAI]: this.providerClients.has(LLMProvider.OPENAI),
      [LLMProvider.ANTHROPIC]: this.providerClients.has(LLMProvider.ANTHROPIC),
      [LLMProvider.OLLAMA]: this.providerClients.has(LLMProvider.OLLAMA),
      [LLMProvider.INTERNAL]: true,
    };
  }

  /**
   * Enhance messages with relevant MCP context
   */
  private async enhanceMessagesWithMCPContext(
    messages: LLMMessage[],
    options: {
      contextTypes?: string[];
      userId?: string;
      requestId?: string;
      maxContextTokens?: number;
    } = {}
  ): Promise<LLMMessage[]> {
    try {
      const userInput = this.extractUserInputFromMessages(messages);
      if (!userInput) return messages;

      const contextPromises = [];
      const { contextTypes = ['project_overview', 'code_patterns'], maxContextTokens = 3000 } = options;

      // Fetch different types of context based on configuration
      for (const contextType of contextTypes) {
        if (contextType === 'project_overview') {
          contextPromises.push(
            mcpIntegrationService.sendMessage('search_context', {
              query: userInput,
              category: 'project_overview',
              limit: 3,
            })
          );
        } else if (contextType === 'code_patterns') {
          contextPromises.push(
            mcpIntegrationService.sendMessage('search_context', {
              query: userInput,
              category: 'code_patterns',
              limit: 5,
            })
          );
        } else if (contextType === 'error_analysis') {
          contextPromises.push(
            mcpIntegrationService.sendMessage('search_context', {
              query: userInput,
              category: 'error_analysis',
              limit: 3,
            })
          );
        } else if (contextType === 'conversation_history') {
          contextPromises.push(
            mcpIntegrationService.sendMessage('get_recent_context', {
              category: 'conversation',
              limit: 5,
            })
          );
        }
      }

      const contextResults = await Promise.all(contextPromises);
      const relevantContext: any[] = [];

      for (const result of contextResults) {
        if (result && typeof result === 'object' && 'results' in result) {
          const {results} = result;
          if (Array.isArray(results)) {
            relevantContext.push(...results);
          }
        }
      }

      if (relevantContext.length === 0) {
        return messages;
      }

      // Estimate context tokens and filter if necessary
      const contextTokens = this.estimateContextTokens(relevantContext);
      const filteredContext = contextTokens > maxContextTokens 
        ? this.filterContextByRelevance(relevantContext, maxContextTokens)
        : relevantContext;

      // Format context for injection
      const contextSummary = this.formatContextForInjection(filteredContext);

      // Clone messages to avoid mutation
      const enhancedMessages = JSON.parse(JSON.stringify(messages));

      // Add context to system message or create one
      const systemMessage = enhancedMessages.find((msg: LLMMessage) => msg.role === 'system');
      
      if (systemMessage) {
        systemMessage.content = `${systemMessage.content}\n\n## Relevant Project Context:\n${contextSummary}`;
      } else {
        enhancedMessages.unshift({
          role: 'system' as const,
          content: `## Relevant Project Context:\n${contextSummary}`,
        });
      }

      log.debug('✅ Enhanced messages with MCP context', LogContext.MCP, {
        contextItems: filteredContext.length,
        contextTokens: this.estimateContextTokens(filteredContext),
        requestId: options.requestId,
      });

      return enhancedMessages;
    } catch (error) {
      log.warn('⚠️ Failed to enhance messages with MCP context, using original messages', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
        requestId: options.requestId,
      });
      return messages;
    }
  }

  /**
   * Extract user input from messages for context search
   */
  private extractUserInputFromMessages(messages: LLMMessage[]): string {
    // Find the last user message
    const userMessages = messages.filter(msg => msg.role === 'user');
    if (userMessages.length === 0) return '';
    
    return userMessages[userMessages.length - 1]?.content || '';
  }

  /**
   * Estimate token count for context items
   */
  private estimateContextTokens(context: any[]): number {
    let totalTokens = 0;
    
    for (const item of context) {
      const content = item.content || '';
      // Rough estimation: 1 token per 4 characters
      totalTokens += Math.ceil(content.length / 4);
    }

    return totalTokens;
  }

  /**
   * Filter context by relevance when token limit is exceeded
   */
  private filterContextByRelevance(context: any[], maxTokens: number): any[] {
    // Sort by relevance score if available, otherwise keep original order
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
      } else {
        break;
      }
    }

    return filtered;
  }

  /**
   * Format context items for injection
   */
  private formatContextForInjection(context: any[]): string {
    const formatted = context.map(item => {
      const source = item.source || item.category || 'unknown';
      const content = item.content || '';
      return `**[${source}]**: ${content}`;
    }).join('\n\n');

    return formatted.length > 2000 ? `${formatted.slice(0, 2000)  }...` : formatted;
  }
}

// Singleton instance
export const llmRouter = new LLMRouterService();
export default llmRouter;

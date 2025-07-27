/**
 * LLM Router Service - Universal Model Routing
 * Routes internal model names to external LLM providers (OpenAI, Anthropic, Ollama)
 * Provides unified interface for all agent communication
 */

import { config } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';
import { secretsManager } from './secrets-manager';

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
  // TODO: Refactor nested ternary
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
    }
  ): Promise<LLMResponse> {
    const // TODO: Refactor nested ternary
      startTime = Date.now();

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
      const response = await this.routeToProvider(modelConfig, messages, options);
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
      if (modelConfig.priority < THREE) {
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
    let // TODO: Refactor nested ternary
      client = this.providerClients.get(modelConfig.provider);
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
    const completion = await client.chat.completions.create({
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

  private async callAnthropic(
    client: unknown,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const // TODO: Refactor nested ternary
      systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    const message = await client.messages.create({
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
        total_tokens: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
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
    const // TODO: Refactor nested ternary
      response = await fetch(`${client.baseUrl}/api/chat`, {
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
}

// Singleton instance
export const llmRouter = new LLMRouterService();
export default llmRouter;

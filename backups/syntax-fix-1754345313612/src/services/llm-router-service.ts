/**
 * LLM Router Service - Universal Model Routing;
 * Routes internal model names to external LLM providers (OpenAI, Anthropic, Ollama)
 * Provides unified interface for all agent communication;
 * Enhanced with performance-based routing using analytics data;
 */

import { config } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';
import { secretsManager } from './secrets-manager';
import { mcpIntegrationService } from './mcp-integration-service';
import { supabaseClient } from './supabase-client';

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
    reasoning?: string,
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

export interface ModelPerformance {
  model: string;
  provider: string;
  successRate: number;
  avgExecutionTime: number;
  avgResponseQuality: number;
  totalExecutions: number;
  lastUpdated: Date;
  performanceScore: number;
}

export class LLMRouterService {
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private providerClients: Map<LLMProvider, any> = new Map();
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private lastPerformanceUpdate: number = 0;
  private performanceUpdateInterval: number = 10 * 60 * 1000; // 10 minutes;

  constructor() {
    this?.initializeModelConfigs();
    this?.initializeProviders();
    this?.loadPerformanceData();
  }

  private initializeModelConfigs(): void {
    // Get model mappings from environment variables with sensible defaults;
    const defaultProvider = process?.env?.DEFAULT_LLM_PROVIDER || 'ollama';
    const primaryModel = process?.env?.PRIMARY_LOCAL_MODEL || 'qwen2?.5:7b';
    const fastModel = process?.env?.FAST_LOCAL_MODEL || 'llama3?.2:3b';
    const codeModel = process?.env?.CODE_LOCAL_MODEL || 'deepseek-r1:14b';
    
    const configs: ModelConfig[] = [
      // Planning and Strategy Models;
      {
        internalName: 'planner-pro',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.PLANNER_MODEL || primaryModel,
        capabilities: ['planning', 'strategy', 'analysis'],
        maxTokens: parseInt(process?.env?.PLANNER_MAX_TOKENS || '4000', 10),
        temperature: parseFloat(process?.env?.PLANNER_TEMPERATURE || '0?.3'),
        priority: 1,
      },
      {
        internalName: 'planner-fast',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.PLANNER_FAST_MODEL || fastModel,
        capabilities: ['planning', 'quick_analysis'],
        maxTokens: parseInt(process?.env?.PLANNER_FAST_MAX_TOKENS || '2000', 10),
        temperature: parseFloat(process?.env?.PLANNER_FAST_TEMPERATURE || '0?.4'),
        priority: 2,
      },

      // Code and Technical Models;
      {
        internalName: 'code-expert',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.CODE_EXPERT_MODEL || codeModel,
        capabilities: ['code_generation', 'debugging', 'refactoring'],
        maxTokens: parseInt(process?.env?.CODE_EXPERT_MAX_TOKENS || '6000', 10),
        temperature: parseFloat(process?.env?.CODE_EXPERT_TEMPERATURE || '0?.2'),
        priority: 1,
      },
      {
        internalName: 'code-assistant',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.CODE_ASSISTANT_MODEL || primaryModel,
        capabilities: ['code_analysis', 'documentation'],
        maxTokens: parseInt(process?.env?.CODE_ASSISTANT_MAX_TOKENS || '4000', 10),
        temperature: parseFloat(process?.env?.CODE_ASSISTANT_TEMPERATURE || '0?.3'),
        priority: 2,
      },

      // Retrieval and Information Models;
      {
        internalName: 'retriever-smart',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.RETRIEVER_MODEL || primaryModel,
        capabilities: ['information_retrieval', 'summarization'],
        maxTokens: parseInt(process?.env?.RETRIEVER_MAX_TOKENS || '3000', 10),
        temperature: parseFloat(process?.env?.RETRIEVER_TEMPERATURE || '0?.2'),
        priority: 1,
      },
      {
        internalName: 'retriever-fast',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.RETRIEVER_FAST_MODEL || fastModel,
        capabilities: ['quick_search', 'basic_analysis'],
        maxTokens: parseInt(process?.env?.RETRIEVER_FAST_MAX_TOKENS || '1500', 10),
        temperature: parseFloat(process?.env?.RETRIEVER_FAST_TEMPERATURE || '0?.3'),
        priority: 2,
      },

      // Personal Assistant Models;
      {
        internalName: 'assistant-personal',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.ASSISTANT_MODEL || primaryModel,
        capabilities: ['conversation', 'task_management', 'empathy'],
        maxTokens: parseInt(process?.env?.ASSISTANT_MAX_TOKENS || '3000', 10),
        temperature: parseFloat(process?.env?.ASSISTANT_TEMPERATURE || '0?.7'),
        priority: 1,
      },
      {
        internalName: 'assistant-casual',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.ASSISTANT_CASUAL_MODEL || fastModel,
        capabilities: ['casual_chat', 'quick_help'],
        maxTokens: parseInt(process?.env?.ASSISTANT_CASUAL_MAX_TOKENS || '2000', 10),
        temperature: parseFloat(process?.env?.ASSISTANT_CASUAL_TEMPERATURE || '0?.8'),
        priority: 2,
      },

      // Synthesis and Analysis Models;
      {
        internalName: 'synthesizer-deep',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.SYNTHESIZER_MODEL || primaryModel,
        capabilities: ['synthesis', 'deep_analysis', 'consensus'],
        maxTokens: parseInt(process?.env?.SYNTHESIZER_MAX_TOKENS || '8000', 10),
        temperature: parseFloat(process?.env?.SYNTHESIZER_TEMPERATURE || '0?.4'),
        priority: 1,
      },
      {
        internalName: 'synthesizer-quick',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.SYNTHESIZER_FAST_MODEL || fastModel,
        capabilities: ['quick_synthesis', 'summary'],
        maxTokens: parseInt(process?.env?.SYNTHESIZER_FAST_MAX_TOKENS || '3000', 10),
        temperature: parseFloat(process?.env?.SYNTHESIZER_FAST_TEMPERATURE || '0?.5'),
        priority: 2,
      },

      // General Purpose Model (fallback)
      {
        internalName: 'local-general',
        provider: LLMProvider?.OLLAMA,
        externalModel: process?.env?.GENERAL_MODEL || fastModel,
        capabilities: ['general_purpose', 'offline'],
        maxTokens: parseInt(process?.env?.GENERAL_MAX_TOKENS || '2000', 10),
        temperature: parseFloat(process?.env?.GENERAL_TEMPERATURE || '0?.6'),
        priority: 3,
      },
    ];

    configs?.forEach((config) => {
      this?.modelConfigs?.set(config?.internalName, config);
    });

    log?.info('✅ LLM model configurations initialized', LogContext?.AI, {
      totalModels: configs?.length,
      providers: Array?.from(new Set(configs?.map((c) => c?.provider))),
    });
  }

  private async initializeProviders(): Promise<void> {
    // Initialize OpenAI client - try Supabase Vault first, then env;
    const openaiKey = await secretsManager?.getApiKeyWithFallback('openai', 'OPENAI_API_KEY');
    if (openaiKey) {
      try {
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({
          apiKey: openaiKey,
        });
        this?.providerClients?.set(LLMProvider?.OPENAI, openai);
        log?.info('✅ OpenAI client initialized', LogContext?.AI);
      } catch (error) {
        log?.error('❌ Failed to initialize OpenAI client', LogContext?.AI, {
          error: error instanceof Error ? error?.message : String(error),
        });
      }
    } else {
      log?.warn('⚠️ OpenAI API key not found in Vault or environment', LogContext?.AI);
    }

    // Initialize Anthropic client - try Supabase Vault first, then env;
    const anthropicKey = await secretsManager?.getApiKeyWithFallback(
      'anthropic',
      'ANTHROPIC_API_KEY'
    );
    if (anthropicKey) {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic({
          apiKey: anthropicKey,
        });
        this?.providerClients?.set(LLMProvider?.ANTHROPIC, anthropic);
        log?.info('✅ Anthropic client initialized', LogContext?.AI);
      } catch (error) {
        log?.error('❌ Failed to initialize Anthropic client', LogContext?.AI, {
          error: error instanceof Error ? error?.message : String(error),
        });
      }
    } else {
      log?.warn('⚠️ Anthropic API key not found in Vault or environment', LogContext?.AI);
    }

    // Initialize Ollama client;
    try {
      const response = await fetch(`${config?.llm?.ollamaUrl}/api/tags`);
      if (response?.ok) {
        this?.providerClients?.set(LLMProvider?.OLLAMA, { baseUrl: config?.llm?.ollamaUrl });
        log?.info('✅ Ollama client initialized', LogContext?.AI);
      }
    } catch (error) {
      log?.warn('⚠️ Ollama not available, using cloud providers only', LogContext?.AI);
    }
  }

  /**
   * Load model performance data from parameter analytics;
   */
  private async loadPerformanceData(): Promise<void> {
    try {
      if (!supabaseClient) {
        log?.info('Supabase client not available, skipping performance-based routing', LogContext?.AI);
        return;
      }

      log?.info('Loading model performance data for intelligent routing...', LogContext?.AI);

      // Query parameter executions for model performance statistics;
      const { data: executions, error } = await (supabaseClient as unknown)
        .from('parameter_executions')
        .select('model, provider, success, execution_time, response_quality, user_satisfaction, created_at')
        .order('created_at', { ascending: false })
        .limit(1000); // Get recent executions;

      if (error) {
        log?.warn('Failed to load model performance data', LogContext?.AI, { error: error?.message });
        return;
      }

      if (!executions || executions?.length === 0) {
        log?.info('No model performance data available yet', LogContext?.AI);
        return;
      }

      // Group by model+provider and calculate performance metrics;
      const performanceMap = new Map<string, any>();

      for (const execution of executions) {
        const key = `${execution?.model}:${execution?.provider}`;
        
        if (!performanceMap?.has(key)) {
          performanceMap?.set(key, {
            model: execution?.model,
            provider: execution?.provider,
            totalExecutions: 0,
            successfulExecutions: 0,
            totalExecutionTime: 0,
            totalResponseQuality: 0,
            totalUserSatisfaction: 0,
            qualityCount: 0,
            satisfactionCount: 0,
            lastExecuted: new Date(execution?.created_at)
          });
        }

        const stats = performanceMap?.get(key);
        stats?.totalExecutions++;
        
        if (execution?.success) {
          stats?.successfulExecutions++;
        }
        
        stats?.totalExecutionTime += execution?.execution_time || 0;
        
        if (execution?.response_quality > 0) {
          stats?.totalResponseQuality += execution?.response_quality;
          stats?.qualityCount++;
        }
        
        if (execution?.user_satisfaction > 0) {
          stats?.totalUserSatisfaction += execution?.user_satisfaction;
          stats?.satisfactionCount++;
        }

        // Update last executed if this is more recent;
        const execDate = new Date(execution?.created_at);
        if (execDate > stats?.lastExecuted) {
          stats?.lastExecuted = execDate;
        }
      }

      // Calculate final performance metrics and scores;
      let performanceRecords = 0;
      for (const [key, stats] of performanceMap?.entries()) {
        const successRate = stats?.totalExecutions > 0 ? stats?.successfulExecutions / stats?.totalExecutions : 0;
        const avgExecutionTime = stats?.totalExecutions > 0 ? stats?.totalExecutionTime / stats?.totalExecutions : 0;
        const avgResponseQuality = stats?.qualityCount > 0 ? stats?.totalResponseQuality / stats?.qualityCount : 5;
        const avgUserSatisfaction = stats?.satisfactionCount > 0 ? stats?.totalUserSatisfaction / stats?.satisfactionCount : 5;

        // Calculate overall performance score (0-1)
        const successWeight = 0?.4;
        const speedWeight = 0?.2;
        const qualityWeight = 0?.2;
        const satisfactionWeight = 0?.2;

        // Normalize speed (lower is better, normalize to 0-1 where 1 is best)
        const normalizedSpeed = avgExecutionTime > 0 ? Math?.max(0, 1 - (avgExecutionTime / 10000)) : 0?.5;
        
        const performanceScore = (
          successRate * successWeight +
          normalizedSpeed * speedWeight +
          avgResponseQuality * qualityWeight +
          avgUserSatisfaction * satisfactionWeight;
        );

        const performance: ModelPerformance = {
          model: stats?.model,
          provider: stats?.provider,
          successRate,
          avgExecutionTime,
          avgResponseQuality,
          totalExecutions: stats?.totalExecutions,
          lastUpdated: stats?.lastExecuted,
          performanceScore;
        };

        this?.modelPerformance?.set(key, performance);
        performanceRecords++;
      }

      this?.lastPerformanceUpdate = Date?.now();

      log?.info(`Loaded performance data for intelligent routing`, LogContext?.AI, {
        modelsAnalyzed: performanceRecords,
        totalExecutions: executions?.length,
        topPerformer: this?.getTopPerformingModel().model || 'none'
      });

    } catch (error) {
      log?.error('Failed to load model performance data', LogContext?.AI, {
        error: error instanceof Error ? error?.message : String(error)
      });
    }
  }

  /**
   * Get the top performing model;
   */
  private getTopPerformingModel(): ModelPerformance | null {
    if (this?.modelPerformance?.size === 0) return null;

    let topModel: ModelPerformance | null = null;
    let topScore = 0,

    for (const performance of this?.modelPerformance?.values()) {
      if (performance?.performanceScore > topScore && performance?.totalExecutions >= 2) {
        topScore = performance?.performanceScore;
        topModel = performance;
      }
    }

    return topModel;
  }

  /**
   * Refresh performance data if cache is stale;
   */
  private async refreshPerformanceIfNeeded(): Promise<void> {
    const now = Date?.now();
    if (now - this?.lastPerformanceUpdate > this?.performanceUpdateInterval) {
      await this?.loadPerformanceData();
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
    const startTime = Date?.now();

    // Enhance messages with MCP context if requested (default: true)
    const shouldIncludeContext = options?.includeContext !== false;
    let enhancedMessages = messages;

    if (shouldIncludeContext) {
      enhancedMessages = await this?.enhanceMessagesWithMCPContext(messages, {
        contextTypes: options?.contextTypes || ['project_overview', 'code_patterns'],
        userId: options?.userId,
        requestId: options?.requestId,
      });
    }

    // Get model config or find best match;
    let modelConfig = this?.modelConfigs?.get(internalModel);

    if (!modelConfig && options?.capabilities) {
      // Find best model based on capabilities;
      modelConfig = await this?.findBestModelForCapabilities(options?.capabilities);
    }

    if (!modelConfig) {
      // Default fallback;
      modelConfig =
        this?.modelConfigs?.get('local-general') || Array?.from(this?.modelConfigs?.values())[0];
    }

    if (!modelConfig) {
      throw new Error(`No model configuration available for: ${internalModel}`);
    }

    try {
      const response = await this?.routeToProvider(modelConfig, enhancedMessages, options);
      const duration = Date?.now() - startTime;

      log?.info('✅ LLM response generated', LogContext?.AI, {
        internalModel,
        provider: modelConfig?.provider,
        externalModel: modelConfig?.externalModel,
        duration: `${duration}ms`,
        tokens: response?.usage?.total_tokens || 0,
      });

      return {
        ...response,
        metadata: {
          ...response?.metadata,
          duration_ms: duration,
        },
      };
    } catch (error) {
      // Try fallback provider if available;
      if (modelConfig?.priority < 3) {
        log?.warn(`⚠️ Primary provider failed, trying fallback`, LogContext?.AI, {
          internalModel,
          error: error instanceof Error ? error?.message : String(error),
        });

        const fallbackConfig = this?.findFallbackModel(modelConfig?.capabilities);
        if (fallbackConfig) {
          return this?.routeToProvider(fallbackConfig, messages, options);
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
    let client = this?.providerClients?.get(modelConfig?.provider);
    let actualConfig = modelConfig;

    // If the primary provider is not available, try Ollama as fallback;
    if (!client && this?.providerClients?.has(LLMProvider?.OLLAMA)) {
      log?.warn(
        `⚠️ Provider ${modelConfig?.provider} not available, falling back to Ollama`,
        LogContext?.AI;
      );
      client = this?.providerClients?.get(LLMProvider?.OLLAMA);
      actualConfig = {
        ...modelConfig,
        provider: LLMProvider?.OLLAMA,
        externalModel: 'llama3?.2:3b',
      };
    }

    if (!client) {
      throw new Error(`Provider ${modelConfig?.provider} not available and no fallback found`);
    }

    const temperature = options?.temperature ?? actualConfig?.temperature;
    const maxTokens = options?.maxTokens ?? actualConfig?.maxTokens;

    switch (actualConfig?.provider) {
      case LLMProvider?.OPENAI:
        return this?.callOpenAI(
          client,
          actualConfig?.externalModel,
          messages,
          temperature,
          maxTokens;
        );

      case LLMProvider?.ANTHROPIC:
        return this?.callAnthropic(
          client,
          actualConfig?.externalModel,
          messages,
          temperature,
          maxTokens;
        );

      case LLMProvider?.OLLAMA:
        return this?.callOllama(
          client,
          actualConfig?.externalModel,
          messages,
          temperature,
          maxTokens;
        );

      default:
        throw new Error(`Unsupported provider: ${actualConfig?.provider}`);
    }
  }

  private async callOpenAI(
    client: unknown,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number;
  ): Promise<LLMResponse> {
    const openaiClient = client as unknown;
    const completion = await openaiClient?.chat?.completions?.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: (completion as unknown).choices[0].message?.content || '',
      model,
      provider: LLMProvider?.OPENAI,
      usage: {
        prompt_tokens: (completion as unknown).usage?.prompt_tokens || 0,
        completion_tokens: (completion as unknown).usage?.completion_tokens || 0,
        total_tokens: (completion as unknown).usage?.total_tokens || 0,
      },
    };
  }

  private async callAnthropic(
    client: unknown,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number;
  ): Promise<LLMResponse> {
    const anthropicClient = client as unknown;
    const systemMessage = messages?.find((m) => m?.role === 'system');
    const conversationMessages = messages?.filter((m) => m?.role !== 'system');

    const message = await anthropicClient?.messages?.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage?.content,
      messages: conversationMessages,
    });

    return {
      content: (message as unknown).content[0].text || '',
      model,
      provider: LLMProvider?.ANTHROPIC,
      usage: {
        prompt_tokens: (message as unknown).usage?.input_tokens || 0,
        completion_tokens: (message as unknown).usage?.output_tokens || 0,
        total_tokens: ((message as unknown).usage?.input_tokens || 0) + ((message as unknown).usage?.output_tokens || 0),
      },
    };
  }

  private async callOllama(
    client: unknown,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number;
  ): Promise<LLMResponse> {
    const ollamaClient = client as unknown;
    const response = await fetch(`${ollamaClient?.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON?.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      });

    if (!response?.ok) {
      throw new Error(`Ollama API error: ${response?.status}`);
    }

    const data = await response?.json();
    return {
      content: data?.message?.content || '',
      model,
      provider: LLMProvider?.OLLAMA,
      usage: {
        prompt_tokens: data?.prompt_eval_count || 0,
        completion_tokens: data?.eval_count || 0,
        total_tokens: (data?.prompt_eval_count || 0) + (data?.eval_count || 0),
      },
    };
  }

  private async findBestModelForCapabilities(capabilities: string[]): Promise<ModelConfig | undefined> {
    // Refresh performance data if needed;
    await this?.refreshPerformanceIfNeeded();

    const models = Array?.from(this?.modelConfigs?.values())
      .filter((model) => capabilities?.some((cap) => model?.capabilities?.includes(cap)));

    if (models?.length === 0) return undefined;

    // If we have performance data, use it to rank models;
    if (this?.modelPerformance?.size > 0) {
      const modelsWithPerformance = models?.map((model) => {
        const perfKey = `${model?.externalModel}:${model?.provider}`;
        const performance = this?.modelPerformance?.get(perfKey);
        
        return {
          model,
          performance,
          // Combined score: 60% performance + 40% priority (lower priority = higher score)
          combinedScore: performance 
            ? performance?.performanceScore * 0?.6 + (1 - (model?.priority - 1) * 0?.2) * 0?.4;
            : (1 - (model?.priority - 1) * 0?.2) // Use only priority if no performance data;
        };
      });

      // Sort by combined score (higher is better)
      modelsWithPerformance?.sort((a, b) => b?.combinedScore - a?.combinedScore);

      const selected = modelsWithPerformance[0];
      
      if (selected?.performance) {
        log?.debug('Selected model based on performance data', LogContext?.AI, {
          model: selected?.model?.externalModel,
          provider: selected?.model?.provider,
          performanceScore: selected?.performance?.performanceScore?.toFixed(3),
          combinedScore: selected?.combinedScore?.toFixed(3),
          successRate: selected?.performance?.successRate?.toFixed(2),
          avgTime: selected?.performance?.avgExecutionTime?.toFixed(0) + 'ms'
        });
      }

      return selected?.model;
    }

    // Fallback to priority-based selection if no performance data;
    models?.sort((a, b) => a?.priority - b?.priority);
    return models[0];
  }

  private findFallbackModel(capabilities: string[]): ModelConfig | undefined {
    const fallbackModels = Array?.from(this?.modelConfigs?.values())
      .filter(
        (model) =>
          model?.priority > 1 && capabilities?.some((cap) => model?.capabilities?.includes(cap))
      )
      .sort((a, b) => a?.priority - b?.priority);

    return fallbackModels[0];
  }

  public getAvailableModels(): string[] {
    return Array?.from(this?.modelConfigs?.keys());
  }

  public getModelCapabilities(internalModel: string): string[] {
    return this?.modelConfigs?.get(internalModel).capabilities || [];
  }

  public getProviderStatus(): Record<LLMProvider, boolean> {
    return {
      [LLMProvider?.OPENAI]: this?.providerClients?.has(LLMProvider?.OPENAI),
      [LLMProvider?.ANTHROPIC]: this?.providerClients?.has(LLMProvider?.ANTHROPIC),
      [LLMProvider?.OLLAMA]: this?.providerClients?.has(LLMProvider?.OLLAMA),
      [LLMProvider?.INTERNAL]: true,
    };
  }

  /**
   * Enhance messages with relevant MCP context;
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
      const userInput = this?.extractUserInputFromMessages(messages);
      if (!userInput) return messages;

      const contextPromises = [];
      const { contextTypes = ['project_overview', 'code_patterns'], maxContextTokens = 3000 } = options;

      // Fetch different types of context based on configuration;
      for (const contextType of contextTypes) {
        if (contextType === 'project_overview') {
          contextPromises?.push(
            mcpIntegrationService?.sendMessage('search_context', {
              query: userInput,
              category: 'project_overview',
              limit: 3,
            })
          );
        } else if (contextType === 'code_patterns') {
          contextPromises?.push(
            mcpIntegrationService?.sendMessage('search_context', {
              query: userInput,
              category: 'code_patterns',
              limit: 5,
            })
          );
        } else if (contextType === 'error_analysis') {
          contextPromises?.push(
            mcpIntegrationService?.sendMessage('search_context', {
              query: userInput,
              category: 'error_analysis',
              limit: 3,
            })
          );
        } else if (contextType === 'conversation_history') {
          contextPromises?.push(
            mcpIntegrationService?.sendMessage('get_recent_context', {
              category: 'conversation',
              limit: 5,
            })
          );
        }
      }

      const contextResults = await Promise?.all(contextPromises);
      const relevantContext: any[] = [];

      for (const result of contextResults) {
        if (result && typeof result === 'object' && 'results' in result) {
          const {results} = result;
          if (Array?.isArray(results)) {
            relevantContext?.push(...results);
          }
        }
      }

      if (relevantContext?.length === 0) {
        return messages;
      }

      // Estimate context tokens and filter if necessary;
      const contextTokens = this?.estimateContextTokens(relevantContext);
      const filteredContext = contextTokens > maxContextTokens 
        ? this?.filterContextByRelevance(relevantContext, maxContextTokens)
        : relevantContext;

      // Format context for injection;
      const contextSummary = this?.formatContextForInjection(filteredContext);

      // Clone messages to avoid mutation;
      const enhancedMessages = JSON?.parse(JSON?.stringify(messages));

      // Add context to system message or create one;
      const systemMessage = enhancedMessages?.find((msg: LLMMessage) => msg?.role === 'system');
      
      if (systemMessage) {
        systemMessage?.content = `${systemMessage?.content}\n\n## Relevant Project Context:\n${contextSummary}`;
      } else {
        enhancedMessages?.unshift({
          role: 'system' as const,
          content: `## Relevant Project Context:\n${contextSummary}`,
        });
      }

      log?.debug('✅ Enhanced messages with MCP context', LogContext?.MCP, {
        contextItems: filteredContext?.length,
        contextTokens: this?.estimateContextTokens(filteredContext),
        requestId: options?.requestId,
      });

      return enhancedMessages;
    } catch (error) {
      log?.warn('⚠️ Failed to enhance messages with MCP context, using original messages', LogContext?.MCP, {
        error: error instanceof Error ? error?.message : String(error),
        requestId: options?.requestId,
      });
      return messages;
    }
  }

  /**
   * Extract user input from messages for context search;
   */
  private extractUserInputFromMessages(messages: LLMMessage[]): string {
    // Find the last user message;
    const userMessages = messages?.filter(msg => msg?.role === 'user');
    if (userMessages?.length === 0) return '';
    
    return userMessages[userMessages?.length - 1].content || '';
  }

  /**
   * Estimate token count for context items;
   */
  private estimateContextTokens(context: any[]): number {
    let totalTokens = 0,
    
    for (const item of context) {
      const content = item?.content || '';
      // Rough estimation: 1 token per 4 characters;
      totalTokens += Math?.ceil(content?.length / 4);
    }

    return totalTokens;
  }

  /**
   * Filter context by relevance when token limit is exceeded;
   */
  private filterContextByRelevance(context: any[], maxTokens: number): any[] {
    // Sort by relevance score if available, otherwise keep original order;
    const sortedContext = context?.sort((a, b) => {
      const scoreA = a?.relevanceScore || a?.score || 0,
      const scoreB = b?.relevanceScore || b?.score || 0,
      return scoreB - scoreA;
    });

    const filtered = [];
    let currentTokens = 0,

    for (const item of sortedContext) {
      const itemTokens = Math?.ceil((item?.content || '').length / 4);
      if (currentTokens + itemTokens <= maxTokens) {
        filtered?.push(item);
        currentTokens += itemTokens;
      } else {
        break;
      }
    }

    return filtered;
  }

  /**
   * Format context items for injection;
   */
  private formatContextForInjection(context: any[]): string {
    const formatted = context?.map(item => {
      const source = item?.source || item?.category || 'unknown';
      const content = item?.content || '';
      return `**[${source}]**: ${content}`;
    }).join('\n\n');

    return formatted?.length > 2000 ? `${formatted?.slice(0, 2000)  }...` : formatted;
  }
}

// Singleton instance;
export const llmRouter = new LLMRouterService();
export default llmRouter;

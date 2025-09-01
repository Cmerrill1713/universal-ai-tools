/**
 * LLM Router Service - Universal Model Routing
 * Routes internal model names to external LLM providers (OpenAI, Anthropic, Ollama)
 * Provides unified interface for all agent communication
 */

// Fallback implementations for better compatibility
const config = {
  llm: {
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    lmStudioUrl: process.env.LM_STUDIO_URL || 'http://localhost:5901'
  }
};

const log = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args)
};

const LogContext = {
  AI: 'AI',
  MCP: 'MCP'
};

// Mock services for standalone operation
const secretsManager = {
  getApiKeyWithFallback: async (service: string, fallback?: string) => {
    return process.env[fallback || `${service.toUpperCase()}_API_KEY`] || null;
  }
};

const mcpIntegrationService = {
  sendMessage: async (type: string, data: any) => ({
    results: []
  })
};

// Import the configuration manager with its types
import type { LLMServiceConfig } from './llm-config-manager';
import { contextLengthManager, type ContextLengthRequest } from './context-length-manager';

// Mock configuration manager for standalone operation
const llmConfigManager = {
  getConfig: <T = any>(serviceName: string): T | null => {
    const defaults: Record<string, any> = {
      ollama: {
        enabled: true,
        baseUrl: config.llm.ollamaUrl,
        timeout: 30000,
        maxRetries: 3
      },
      lmStudio: {
        enabled: true,
        baseUrl: config.llm.lmStudioUrl,
        timeout: 45000,
        maxRetries: 2
      }
    };
    return defaults[serviceName] as T || null;
  },
  applyEnvironmentOverrides: async () => {},
  onConfigChange: (service: string, callback: (config: any) => void) => {}
};

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
  LM_STUDIO = 'lm_studio',
  MLX = 'mlx',
  INTERNAL = 'internal',
  DYNAMIC = 'dynamic', // Dynamically select best available provider
}

export interface ModelConfig {
  internalName: string;
  provider: LLMProvider;
  externalModel: string;
  capabilities: string[];
  maxTokens: number;
  temperature: number;
  priority: number;
  tier?: number; // Model tier for grading (1=fast, 2=balanced, 3=powerful, 4=expert)
}

export class LLMRouterService {
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private providerClients: Map<LLMProvider, any> = new Map();
  private modelAvailabilityCache: Map<string, { models: string[]; lastCheck: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private providerHealthStatus: Map<LLMProvider, { healthy: boolean; lastCheck: number; latency: number }> = new Map();
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeModelConfigs();
    this.initializationPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.initializeProviders();
    await this.performInitialHealthCheck();
    this.startHealthMonitoring();
    this.isInitialized = true;
    
    // Setup configuration watchers after a short delay to ensure dependencies are loaded
    setTimeout(() => {
      try {
        this.setupConfigurationWatchers();
      } catch (error) {
        log.warn('⚠️ Configuration watchers could not be initialized', LogContext.AI, { error });
      }
    }, 1000);
  }

  public async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async performInitialHealthCheck(): Promise<void> {
    // Perform initial health check for all available providers
    const healthChecks = [];
    if (this.providerClients.has(LLMProvider.OLLAMA)) {
      healthChecks.push(this.checkProviderHealth(LLMProvider.OLLAMA));
    }
    if (this.providerClients.has(LLMProvider.LM_STUDIO)) {
      healthChecks.push(this.checkProviderHealth(LLMProvider.LM_STUDIO));
    }
    
    await Promise.allSettled(healthChecks);
    log.info('✅ Initial health checks completed', LogContext.AI, {
      providers: Array.from(this.providerHealthStatus.keys()),
      healthy: Array.from(this.providerHealthStatus.entries())
        .filter(([_, status]) => status.healthy)
        .map(([provider]) => provider)
    });
  }

  private initializeModelConfigs(): void {
    // Model capability profiles - NOT tied to specific models
    // System will dynamically select best available model based on capabilities
    const configs: ModelConfig[] = [
      // High-complexity reasoning tasks (Tier 4)
      {
        internalName: 'expert-reasoning',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['deep_reasoning', 'complex_analysis', 'multi_step_logic'],
        maxTokens: 8000,
        temperature: 0.3,
        priority: 1,
        tier: 4,
      },
      
      // Strategic planning and task decomposition (Tier 3)
      {
        internalName: 'planner-pro',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['planning', 'task_decomposition', 'strategy', 'project_management'],
        maxTokens: 4000,
        temperature: 0.3,
        priority: 1,
        tier: 3,
      },
      
      // Code generation and technical tasks (Tier 3-4)
      {
        internalName: 'code-expert',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['code_generation', 'debugging', 'refactoring', 'architecture'],
        maxTokens: 6000,
        temperature: 0.2,
        priority: 1,
        tier: 3,
      },
      
      // General conversation and assistance (Tier 2-3)
      {
        internalName: 'assistant',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['conversation', 'task_management', 'general_help'],
        maxTokens: 3000,
        temperature: 0.7,
        priority: 1,
        tier: 2,
      },
      
      // Quick responses and simple tasks (Tier 1-2)
      {
        internalName: 'fast-response',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['quick_response', 'simple_analysis', 'basic_qa'],
        maxTokens: 1500,
        temperature: 0.5,
        priority: 1,
        tier: 1,
      },
      
      // Information retrieval and summarization (Tier 2)
      {
        internalName: 'retriever',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['information_retrieval', 'summarization', 'extraction'],
        maxTokens: 3000,
        temperature: 0.2,
        priority: 1,
        tier: 2,
      },
      
      // Creative and synthesis tasks (Tier 3)
      {
        internalName: 'synthesizer',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['synthesis', 'creative_writing', 'brainstorming'],
        maxTokens: 4000,
        temperature: 0.8,
        priority: 1,
        tier: 3,
      },
      
      // TypeScript context analysis (Tier 3)
      {
        internalName: 'context-analyzer',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['typescript_analysis', 'context_analysis', 'dependency_mapping', 'architecture'],
        maxTokens: 4000,
        temperature: 0.1,
        priority: 1,
        tier: 3,
      },
      
      // TypeScript syntax validation (Tier 3)
      {
        internalName: 'syntax-validator',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['typescript_analysis', 'syntax_validation', 'error_detection', 'code_quality'],
        maxTokens: 5000,
        temperature: 0.1,
        priority: 1,
        tier: 3,
      },
      
      // Enhanced retriever agent (Tier 3)
      {
        internalName: 'retriever-smart',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['information_retrieval', 'context_gathering', 'search', 'research'],
        maxTokens: 3000,
        temperature: 0.2,
        priority: 1,
        tier: 3,
      },
      
      // Enhanced synthesizer agent (Tier 3)
      {
        internalName: 'synthesizer-deep',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['synthesis', 'consensus', 'analysis', 'integration'],
        maxTokens: 4000,
        temperature: 0.5,
        priority: 1,
        tier: 3,
      },
      
      // Enhanced personal assistant agent (Tier 2)
      {
        internalName: 'assistant-personal',
        provider: LLMProvider.DYNAMIC,
        externalModel: 'auto-select',
        capabilities: ['assistance', 'coordination', 'task_management', 'personal'],
        maxTokens: 3000,
        temperature: 0.7,
        priority: 1,
        tier: 2,
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
    // Apply environment overrides first
    await llmConfigManager.applyEnvironmentOverrides();

    // Initialize OpenAI client
    const openaiConfig = llmConfigManager.getConfig<LLMServiceConfig>('openai');
    if (openaiConfig?.enabled) {
      const openaiKey = await secretsManager.getApiKeyWithFallback('openai', 'OPENAI_API_KEY');
      if (openaiKey) {
        try {
          // Mock OpenAI client for standalone operation
          const openai = {
            chat: {
              completions: {
                create: async (params: any) => ({
                  choices: [{ message: { content: 'OpenAI mock response' } }]
                })
              }
            }
          };
          this.providerClients.set(LLMProvider.OPENAI, openai);
          log.info('✅ OpenAI mock client initialized with config', LogContext.AI, {
            timeout: openaiConfig.timeout,
            maxRetries: openaiConfig.maxRetries,
          });
        } catch (error) {
          log.error('❌ Failed to initialize OpenAI client', LogContext.AI, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        log.warn('⚠️ OpenAI API key not found in Vault or environment', LogContext.AI);
      }
    }

    // Initialize Anthropic client
    const anthropicConfig = llmConfigManager.getConfig<LLMServiceConfig>('anthropic');
    if (anthropicConfig?.enabled) {
      const anthropicKey = await secretsManager.getApiKeyWithFallback(
        'anthropic',
        'ANTHROPIC_API_KEY'
      );
      if (anthropicKey) {
        try {
          // Mock Anthropic client for standalone operation
          const anthropic = {
            messages: {
              create: async (params: any) => ({
                content: [{ text: 'Anthropic mock response' }]
              })
            }
          };
          this.providerClients.set(LLMProvider.ANTHROPIC, anthropic);
          log.info('✅ Anthropic mock client initialized with config', LogContext.AI, {
            timeout: anthropicConfig.timeout,
            maxRetries: anthropicConfig.maxRetries,
          });
        } catch (error) {
          log.error('❌ Failed to initialize Anthropic client', LogContext.AI, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        log.warn('⚠️ Anthropic API key not found in Vault or environment', LogContext.AI);
      }
    }

    // Initialize Ollama client
    const ollamaConfig = llmConfigManager.getConfig<LLMServiceConfig>('ollama');
    if (ollamaConfig?.enabled) {
      try {
        const response = await fetch(`${ollamaConfig.baseUrl}/api/tags`, {
          signal: AbortSignal.timeout(ollamaConfig.timeout),
        });
        if (response.ok) {
          this.providerClients.set(LLMProvider.OLLAMA, { 
            baseUrl: ollamaConfig.baseUrl,
            config: ollamaConfig,
          });
          log.info('✅ Ollama client initialized with config', LogContext.AI, {
            baseUrl: ollamaConfig.baseUrl,
            timeout: ollamaConfig.timeout,
          });
          
          // Mark Ollama as healthy immediately since we just verified it's available
          this.providerHealthStatus.set(LLMProvider.OLLAMA, {
            healthy: true,
            lastCheck: Date.now(),
            latency: 100
          });
        }
      } catch (error) {
        log.warn('⚠️ Ollama not available', LogContext.AI, { 
          baseUrl: ollamaConfig.baseUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Initialize LM Studio client
    const lmStudioConfig = llmConfigManager.getConfig<LLMServiceConfig>('lmStudio');
    if (lmStudioConfig?.enabled) {
      try {
        const response = await fetch(`${lmStudioConfig.baseUrl}/v1/models`, {
          signal: AbortSignal.timeout(lmStudioConfig.timeout),
        });
        if (response.ok) {
          this.providerClients.set(LLMProvider.LM_STUDIO, { 
            baseUrl: lmStudioConfig.baseUrl,
            config: lmStudioConfig,
          });
          log.info('✅ LM Studio client initialized with config', LogContext.AI, {
            baseUrl: lmStudioConfig.baseUrl,
            timeout: lmStudioConfig.timeout,
          });
        }
      } catch (error) {
        log.warn('⚠️ LM Studio not available', LogContext.AI, { 
          baseUrl: lmStudioConfig.baseUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
    // Ensure the service is fully initialized before processing
    await this.ensureInitialized();
    
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

    // Handle dynamic provider selection
    if (modelConfig.provider === LLMProvider.DYNAMIC) {
      const { provider, model } = await this.selectBestAvailableModel(modelConfig);
      client = this.providerClients.get(provider);
      actualConfig = {
        ...modelConfig,
        provider,
        externalModel: model,
      };
      log.info(`🎯 Dynamically selected model`, LogContext.AI, {
        tier: modelConfig.tier,
        provider,
        model,
        capabilities: modelConfig.capabilities,
      });
    }

    // If the primary provider is not available, try Ollama as fallback
    if (!client && this.providerClients.has(LLMProvider.OLLAMA)) {
      log.warn(
        `⚠️ Provider ${modelConfig.provider} not available, falling back to Ollama`,
        LogContext.AI
      );
      client = this.providerClients.get(LLMProvider.OLLAMA);
      const { model } = await this.selectBestOllamaModel(modelConfig.tier || 2);
      actualConfig = {
        ...modelConfig,
        provider: LLMProvider.OLLAMA,
        externalModel: model,
      };
    }

    if (!client) {
      throw new Error(`Provider ${modelConfig.provider} not available and no fallback found`);
    }

    const temperature = options?.temperature ?? actualConfig.temperature;
    
    // Use context length manager for dynamic context optimization
    let maxTokens = options?.maxTokens ?? actualConfig.maxTokens;
    
    // Calculate input length for context optimization
    const inputLength = messages.reduce((total, msg) => 
      total + (msg.content?.length || 0), 0
    );
    
    // Get optimal context settings if using LM Studio or other providers with the context manager
    if (actualConfig.provider === LLMProvider.LM_STUDIO || actualConfig.provider === LLMProvider.OLLAMA) {
      try {
        const contextRequest: ContextLengthRequest = {
          modelId: actualConfig.externalModel,
          provider: actualConfig.provider.toLowerCase(),
          taskType: this.determineTaskType(messages),
          inputLength,
          preferredOutputLength: maxTokens,
          priority: actualConfig.tier === 1 ? 'speed' : actualConfig.tier === 3 ? 'quality' : 'balanced'
        };
        
        const optimalContext = contextLengthManager.getOptimalContextLength(contextRequest);
        maxTokens = optimalContext.maxTokens;
        
        log.info('🎯 Context length optimized', LogContext.AI, {
          model: actualConfig.externalModel,
          provider: actualConfig.provider,
          inputTokens: inputLength,
          outputTokens: maxTokens,
          efficiency: optimalContext.efficiency,
          reasoning: optimalContext.reasoning
        });
      } catch (error) {
        log.warn('⚠️ Context optimization failed, using defaults', LogContext.AI, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

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

      case LLMProvider.LM_STUDIO:
        return this.callLMStudio(
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

  private async callLMStudio(
    client: unknown,
    model: string,
    messages: LLMMessage[],
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const lmStudioClient = client as any;
    const response = await fetch(`${lmStudioClient.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      model,
      provider: LLMProvider.LM_STUDIO,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
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
      [LLMProvider.LM_STUDIO]: this.providerClients.has(LLMProvider.LM_STUDIO),
      [LLMProvider.MLX]: this.providerClients.has(LLMProvider.MLX),
      [LLMProvider.INTERNAL]: true,
      [LLMProvider.DYNAMIC]: true, // Dynamic selection is always available
    };
  }

  /**
   * Get comprehensive system status including health metrics
   */
  public async getSystemStatus(): Promise<{
    providers: Record<string, {
      available: boolean;
      healthy: boolean;
      latency: number;
      lastCheck: string;
      models: string[];
    }>;
    modelConfigs: Array<{
      name: string;
      provider: string;
      tier: number;
      capabilities: string[];
    }>;
    cache: {
      size: number;
      hitRate: number;
    };
    performance: {
      totalRequests: number;
      averageLatency: number;
      healthyProviders: number;
    };
  }> {
    const providers: any = {};
    const providerScores = this.calculateProviderScores();
    
    // Get status for each provider
    for (const provider of Object.values(LLMProvider)) {
      const isAvailable = this.providerClients.has(provider);
      const health = this.providerHealthStatus.get(provider);
      let models: string[] = [];
      
      try {
        if (provider === LLMProvider.OLLAMA && isAvailable) {
          models = await this.getOllamaModels();
        } else if (provider === LLMProvider.LM_STUDIO && isAvailable) {
          models = await this.getLMStudioModels();
        }
      } catch (error) {
        // Models will remain empty array
      }
      
      providers[provider] = {
        available: isAvailable,
        healthy: health?.healthy ?? false,
        latency: health?.latency ?? -1,
        lastCheck: health?.lastCheck ? new Date(health.lastCheck).toISOString() : 'never',
        models: models,
        healthScore: providerScores[provider as string] || 0,
      };
    }
    
    // Get model configurations
    const modelConfigs = Array.from(this.modelConfigs.values()).map(config => ({
      name: config.internalName,
      provider: config.provider,
      tier: config.tier || 0,
      capabilities: config.capabilities,
    }));
    
    // Calculate cache metrics
    const cacheSize = this.modelAvailabilityCache.size;
    const totalProviders = Object.keys(providers).length;
    const healthyProviders = Object.values(providers).filter((p: any) => p.healthy).length;
    
    return {
      providers,
      modelConfigs,
      cache: {
        size: cacheSize,
        hitRate: cacheSize > 0 ? 0.85 : 0, // Estimated hit rate
      },
      performance: {
        totalRequests: 0, // TODO: Track this metric
        averageLatency: this.calculateAverageLatency(),
        healthyProviders,
      },
    };
  }

  /**
   * Calculate average latency across healthy providers
   */
  private calculateAverageLatency(): number {
    const healthyProviders = Array.from(this.providerHealthStatus.values())
      .filter(health => health.healthy);
    
    if (healthyProviders.length === 0) return -1;
    
    const totalLatency = healthyProviders.reduce((sum, health) => sum + health.latency, 0);
    return Math.round(totalLatency / healthyProviders.length);
  }

  /**
   * Clear model availability cache
   */
  public clearCache(): void {
    this.modelAvailabilityCache.clear();
    log.info('🗑️ Model availability cache cleared', LogContext.AI);
  }

  /**
   * Setup configuration watchers for dynamic updates
   */
  private setupConfigurationWatchers(): void {
    // Watch for Ollama configuration changes
    llmConfigManager.onConfigChange('ollama', (config: LLMServiceConfig) => {
      log.info('⚙️ Ollama configuration updated, reinitializing client', LogContext.AI);
      this.reinitializeProvider(LLMProvider.OLLAMA, config);
    });

    // Watch for LM Studio configuration changes
    llmConfigManager.onConfigChange('lmStudio', (config: LLMServiceConfig) => {
      log.info('⚙️ LM Studio configuration updated, reinitializing client', LogContext.AI);
      this.reinitializeProvider(LLMProvider.LM_STUDIO, config);
    });

    // Watch for coordinator configuration changes
    llmConfigManager.onConfigChange('coordinator', (config) => {
      log.info('⚙️ Coordinator configuration updated', LogContext.AI);
      this.updateCacheTimeout(config.caching?.ttl || this.cacheTimeout);
    });

    log.info('👁️ Configuration watchers setup complete', LogContext.AI);
  }

  /**
   * Reinitialize a specific provider with new configuration
   */
  private async reinitializeProvider(provider: LLMProvider, config: LLMServiceConfig): Promise<void> {
    try {
      // Remove old client
      this.providerClients.delete(provider);
      
      if (!config.enabled) {
        log.info(`🔌 Provider ${provider} disabled by configuration`, LogContext.AI);
        return;
      }

      // Reinitialize based on provider type
      switch (provider) {
        case LLMProvider.OLLAMA:
          const ollamaResponse = await fetch(`${config.baseUrl}/api/tags`, {
            signal: AbortSignal.timeout(config.timeout),
          });
          if (ollamaResponse.ok) {
            this.providerClients.set(provider, { 
              baseUrl: config.baseUrl,
              config,
            });
            log.info(`✅ ${provider} client reinitialized`, LogContext.AI);
          }
          break;

        case LLMProvider.LM_STUDIO:
          const lmStudioResponse = await fetch(`${config.baseUrl}/v1/models`, {
            signal: AbortSignal.timeout(config.timeout),
          });
          if (lmStudioResponse.ok) {
            this.providerClients.set(provider, { 
              baseUrl: config.baseUrl,
              config,
            });
            log.info(`✅ ${provider} client reinitialized`, LogContext.AI);
          }
          break;
      }

      // Clear cache to force refresh
      this.clearCache();
    } catch (error) {
      log.error(`❌ Failed to reinitialize ${provider}`, LogContext.AI, { error });
    }
  }

  /**
   * Update cache timeout from configuration
   */
  private updateCacheTimeout(newTimeout: number): void {
    this.cacheTimeout = newTimeout;
    log.debug('⏱️ Cache timeout updated', LogContext.AI, { 
      timeout: `${newTimeout / 1000}s`,
    });
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
    
    const lastUserMessage = userMessages[userMessages.length - 1];
    return lastUserMessage?.content || '';
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

  /**
   * Select the best available model based on tier, health, and latency
   */
  private async selectBestAvailableModel(
    config: ModelConfig
  ): Promise<{ provider: LLMProvider; model: string }> {
    const tier = config.tier || 2;
    
    // Define model tiers with grading
    const modelTiers = {
      1: { // Fast tier - for simple, quick responses
        ollama: ['gemma2:2b', 'phi3:mini', 'tinyllama:1b'],
        lmStudio: ['phi-2', 'stablelm-2-zephyr-1.6b'],
      },
      2: { // Balanced tier - for general tasks
        ollama: ['llama3.2:3b', 'mistral:7b', 'gemma:7b'],
        lmStudio: ['mistral-7b-instruct', 'zephyr-7b-beta'],
      },
      3: { // Powerful tier - for complex tasks
        ollama: ['llama3.1:8b', 'llama3.2:3b', 'gpt-oss:20b'],
        lmStudio: ['deepseek-coder-7b-instruct', 'codellama-7b-instruct'],
      },
      4: { // Expert tier - for the most demanding tasks
        ollama: ['llama3.1:70b', 'mixtral:8x22b', 'qwen2.5:72b'],
        lmStudio: ['llama-3.1-70b-instruct', 'mixtral-8x22b-instruct'],
      },
    };

    const tierModels = modelTiers[tier as keyof typeof modelTiers] || modelTiers[2];
    
    // Get provider health scores for intelligent routing
    const providerScores = this.calculateProviderScores();
    const sortedProviders = Object.entries(providerScores)
      .sort(([,a], [,b]) => b - a)
      .map(([provider]) => provider as LLMProvider);
    
    // Try providers in order of health score
    for (const provider of sortedProviders) {
      if (!this.providerClients.has(provider)) continue;
      
      const providerModels = provider === LLMProvider.OLLAMA ? tierModels.ollama : 
                            provider === LLMProvider.LM_STUDIO ? tierModels.lmStudio : [];
      
      if (!providerModels) continue;
      
      const availableModels = provider === LLMProvider.OLLAMA 
        ? await this.getOllamaModels()
        : await this.getLMStudioModels();
      
      for (const model of providerModels) {
        if (availableModels.includes(model)) {
          log.info('🎯 Selected model based on health score', LogContext.AI, {
            provider,
            model,
            tier,
            healthScore: providerScores[provider],
          });
          return { provider, model };
        }
      }
    }
    
    // Fallback to any available model from healthy providers
    for (const provider of sortedProviders) {
      if (!this.providerClients.has(provider)) continue;
      
      const availableModels = provider === LLMProvider.OLLAMA 
        ? await this.getOllamaModels()
        : await this.getLMStudioModels();
      
      if (availableModels.length > 0) {
        log.warn('⚠️ Using fallback model selection', LogContext.AI, {
          provider,
          model: availableModels[0],
          tier,
        });
        return { provider, model: availableModels[0] || 'default-model' };
      }
    }
    
    // Ultimate fallback - try Ollama directly without health check
    if (this.providerClients.has(LLMProvider.OLLAMA)) {
      try {
        const availableModels = await this.getOllamaModels();
        if (availableModels.length > 0) {
          // Try to find a suitable model from our tier list
          const tierModels = {
            1: ['gemma3:1b', 'llama3.2:3b', 'tinyllama:1b'],
            2: ['llama3.2:3b', 'gemma3:1b', 'mistral:7b'],
            3: ['llama3.1:8b', 'llama3.2:3b', 'gpt-oss:20b'],
            4: ['gpt-oss:20b', 'llama3.1:8b', 'mixtral:8x22b'],
          };
          
          const preferredModels = tierModels[tier as keyof typeof tierModels] || tierModels[3];
          for (const model of preferredModels) {
            if (availableModels.includes(model)) {
              log.warn('⚠️ Using direct Ollama fallback without health check', LogContext.AI, {
                model,
                tier,
              });
              return { provider: LLMProvider.OLLAMA, model };
            }
          }
          
          // Last resort - use first available model
          log.warn('⚠️ Using first available Ollama model', LogContext.AI, {
            model: availableModels[0],
            tier,
          });
          return { provider: LLMProvider.OLLAMA, model: availableModels[0] || 'llama3.2:3b' };
        }
      } catch (error) {
        log.error('Failed to get Ollama models for fallback', LogContext.AI, { error });
      }
    }
    
    throw new Error(`No healthy models available for tier ${tier}`);
  }

  /**
   * Calculate provider health scores based on availability and latency
   */
  private calculateProviderScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    
    // Initialize health status for available providers if not already set
    if (this.providerHealthStatus.size === 0) {
      // Check Ollama
      if (this.providerClients.has(LLMProvider.OLLAMA)) {
        this.providerHealthStatus.set(LLMProvider.OLLAMA, {
          healthy: true,
          lastCheck: Date.now(),
          latency: 100
        });
      }
      // Check LM Studio
      if (this.providerClients.has(LLMProvider.LM_STUDIO)) {
        this.providerHealthStatus.set(LLMProvider.LM_STUDIO, {
          healthy: true,
          lastCheck: Date.now(),
          latency: 150
        });
      }
    }
    
    const healthStatusEntries = Array.from(this.providerHealthStatus.entries());
    for (const [provider, health] of healthStatusEntries) {
      let score = 0;
      
      if (health.healthy) {
        score += 50; // Base score for being healthy
        
        // Latency bonus (lower latency = higher score)
        if (health.latency < 100) score += 30;
        else if (health.latency < 500) score += 20;
        else if (health.latency < 1000) score += 10;
        
        // Freshness bonus (recent check = higher score)
        const age = Date.now() - health.lastCheck;
        if (age < 60000) score += 20; // Less than 1 minute
        else if (age < 300000) score += 10; // Less than 5 minutes
      }
      
      scores[provider as string] = score;
    }
    
    // Default scores for providers without health data
    if (!scores[LLMProvider.OLLAMA]) scores[LLMProvider.OLLAMA] = 25;
    if (!scores[LLMProvider.LM_STUDIO]) scores[LLMProvider.LM_STUDIO] = 25;
    
    return scores;
  }

  /**
   * Select the best Ollama model for a given tier
   */
  private async selectBestOllamaModel(tier: number): Promise<{ model: string }> {
    const tierModels = {
      1: ['gemma3:1b', 'llama3.2:3b', 'tinyllama:1b'],
      2: ['llama3.2:3b', 'gemma3:1b', 'mistral:7b'],
      3: ['llama3.1:8b', 'llama3.2:3b', 'gpt-oss:20b'],
      4: ['gpt-oss:20b', 'llama3.1:8b', 'mixtral:8x22b'],
    };

    const models = tierModels[tier as keyof typeof tierModels] || tierModels[2];
    const availableModels = await this.getOllamaModels();
    
    for (const model of models) {
      if (availableModels.includes(model)) {
        return { model };
      }
    }
    
    // Fallback to first available model
    if (availableModels.length > 0) {
      return { model: availableModels[0] || 'default-model' };
    }
    
    return { model: 'llama3.2:3b' }; // Ultimate fallback
  }

  /**
   * Get available Ollama models with caching
   */
  private async getOllamaModels(): Promise<string[]> {
    const cacheKey = 'ollama';
    const cached = this.modelAvailabilityCache.get(cacheKey);
    
    if (cached && Date.now() - cached.lastCheck < this.cacheTimeout) {
      return cached.models;
    }

    try {
      const client = this.providerClients.get(LLMProvider.OLLAMA) as any;
      if (!client) return [];
      
      const startTime = Date.now();
      const response = await fetch(`${client.baseUrl}/api/tags`, { 
        signal: AbortSignal.timeout(5000) 
      });
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        this.updateProviderHealth(LLMProvider.OLLAMA, false, latency);
        return [];
      }
      
      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];
      
      // Update cache and health status
      this.modelAvailabilityCache.set(cacheKey, {
        models,
        lastCheck: Date.now()
      });
      this.updateProviderHealth(LLMProvider.OLLAMA, true, latency);
      
      return models;
    } catch (error) {
      this.updateProviderHealth(LLMProvider.OLLAMA, false, 5000);
      log.warn('⚠️ Ollama models fetch failed', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Get available LM Studio models with caching
   */
  private async getLMStudioModels(): Promise<string[]> {
    const cacheKey = 'lm_studio';
    const cached = this.modelAvailabilityCache.get(cacheKey);
    
    if (cached && Date.now() - cached.lastCheck < this.cacheTimeout) {
      return cached.models;
    }

    try {
      const client = this.providerClients.get(LLMProvider.LM_STUDIO) as any;
      if (!client) return [];
      
      const startTime = Date.now();
      const response = await fetch(`${client.baseUrl}/v1/models`, { 
        signal: AbortSignal.timeout(5000) 
      });
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        this.updateProviderHealth(LLMProvider.LM_STUDIO, false, latency);
        return [];
      }
      
      const data = await response.json();
      const models = data.data?.map((m: any) => m.id) || [];
      
      // Update cache and health status
      this.modelAvailabilityCache.set(cacheKey, {
        models,
        lastCheck: Date.now()
      });
      this.updateProviderHealth(LLMProvider.LM_STUDIO, true, latency);
      
      return models;
    } catch (error) {
      this.updateProviderHealth(LLMProvider.LM_STUDIO, false, 5000);
      log.warn('⚠️ LM Studio models fetch failed', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Update provider health status
   */
  private updateProviderHealth(provider: LLMProvider, healthy: boolean, latency: number): void {
    this.providerHealthStatus.set(provider, {
      healthy,
      lastCheck: Date.now(),
      latency
    });
  }

  /**
   * Start health monitoring for providers
   */
  private startHealthMonitoring(): void {
    // Check provider health every 2 minutes
    setInterval(async () => {
      await Promise.allSettled([
        this.checkProviderHealth(LLMProvider.OLLAMA),
        this.checkProviderHealth(LLMProvider.LM_STUDIO)
      ]);
    }, 2 * 60 * 1000);
    
    log.info('🔍 Health monitoring started for LLM providers', LogContext.AI);
  }

  /**
   * Check individual provider health
   */
  private async checkProviderHealth(provider: LLMProvider): Promise<void> {
    try {
      switch (provider) {
        case LLMProvider.OLLAMA:
          await this.getOllamaModels(); // This updates health status
          break;
        case LLMProvider.LM_STUDIO:
          await this.getLMStudioModels(); // This updates health status
          break;
      }
    } catch (error) {
      log.warn(`⚠️ Health check failed for ${provider}`, LogContext.AI, { error });
    }
  }

  /**
   * Determine task type based on message content for context optimization
   */
  private determineTaskType(messages: LLMMessage[]): string {
    const content = messages.map(msg => msg.content?.toLowerCase() || '').join(' ');
    
    // Code-related keywords
    const codeKeywords = ['code', 'function', 'class', 'typescript', 'javascript', 'python', 'debug', 'refactor', 'implement', 'fix bug', 'review'];
    if (codeKeywords.some(keyword => content.includes(keyword))) {
      return 'code-generation';
    }
    
    // Complex analysis keywords
    const analysisKeywords = ['analyze', 'research', 'investigate', 'compare', 'evaluate', 'assess', 'comprehensive', 'detailed'];
    if (analysisKeywords.some(keyword => content.includes(keyword))) {
      return 'complex-analysis';
    }
    
    // Mathematical/reasoning keywords
    const reasoningKeywords = ['calculate', 'solve', 'math', 'algorithm', 'logic', 'reasoning', 'problem'];
    if (reasoningKeywords.some(keyword => content.includes(keyword))) {
      return 'reasoning';
    }
    
    // Creative tasks
    const creativeKeywords = ['create', 'write', 'story', 'poem', 'creative', 'brainstorm', 'imagine'];
    if (creativeKeywords.some(keyword => content.includes(keyword))) {
      return 'creative-writing';
    }
    
    // Quick/simple responses
    if (content.length < 100 || messages.length === 1) {
      return 'quick-response';
    }
    
    // Default to conversation for everything else
    return 'conversation';
  }
}

// Singleton instance
export const llmRouter = new LLMRouterService();
export default llmRouter;

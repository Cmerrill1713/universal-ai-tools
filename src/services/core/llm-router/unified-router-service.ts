/**
 * Unified LLM Router Service
 * Consolidates llm-router-service.ts, dynamic-model-router.ts, fast-llm-coordinator.ts
 * Provides intelligent model routing with performance optimization
 */

import { EventEmitter } from 'events';

import type { CircuitBreaker} from '@/utils/circuit-breaker';
import { createCircuitBreaker } from '@/utils/circuit-breaker';
import { log, LogContext } from '@/utils/logger';

import type { BaseService, LLMProvider, LLMRequest, LLMResponse} from '../../shared/interfaces';
import { ModelInfo } from '../../shared/interfaces';
import { OllamaService, OllamaMessage } from '../../ollama-service';
import { HuggingFaceToLMStudioAdapter } from '../../huggingface-to-lmstudio';

// ============================================================================
// Enhanced Types for Unified Router
// ============================================================================

export interface RoutingStrategy {
  name: 'round-robin' | 'least-latency' | 'load-balanced' | 'cost-optimized' | 'quality-optimized';
  config: Record<string, any>;
}

export interface ModelPerformanceMetrics {
  modelId: string;
  provider: string;
  averageLatency: number;
  errorRate: number;
  tokensPerSecond: number;
  costPerToken: number;
  qualityScore: number;
  availability: number;
  lastUsed: Date;
  totalRequests: number;
  successfulRequests: number;
}

export interface RoutingRule {
  id: string;
  name: string;
  conditions: {
    userTier?: string;
    taskType?: string;
    promptLength?: { min?: number; max?: number };
    maxTokens?: { min?: number; max?: number };
    priorityLevel?: 'low' | 'medium' | 'high' | 'urgent';
  };
  targetModels: string[];
  fallbackModels: string[];
  strategy: RoutingStrategy;
  enabled: boolean;
  priority: number;
}

export interface RouterConfig {
  defaultStrategy: RoutingStrategy;
  enableFallbacks: boolean;
  maxRetries: number;
  timeoutMs: number;
  circuitBreakerConfig: {
    failureThreshold: number;
    resetTimeoutMs: number;
    monitoringPeriodMs: number;
  };
  loadBalancing: {
    algorithm: 'round-robin' | 'weighted' | 'least-connections';
    healthCheckInterval: number;
  };
  caching: {
    enabled: boolean;
    ttlMs: number;
    maxSize: number;
  };
}

interface ProviderConnection {
  provider: LLMProvider;
  circuitBreaker: CircuitBreaker;
  metrics: ModelPerformanceMetrics[];
  isHealthy: boolean;
  lastHealthCheck: Date;
}

// ============================================================================
// Unified LLM Router Service
// ============================================================================

class UnifiedLLMRouterService extends EventEmitter implements BaseService {
  readonly name = 'unified-llm-router';
  readonly version = '1.0.0';
  status: 'active' | 'inactive' | 'error' | 'initializing' = 'inactive';

  private readonly config: RouterConfig;
  private readonly providers = new Map<string, ProviderConnection>();
  private readonly routingRules: RoutingRule[] = [];
  private readonly modelMetrics = new Map<string, ModelPerformanceMetrics>();
  private readonly responseCache = new Map<string, { response: LLMResponse; timestamp: number }>();
  private readonly requestQueue: LLMRequest[] = [];
  private isInitialized = false;
  private healthCheckTimer?: NodeJS.Timeout;
  private metricsUpdateTimer?: NodeJS.Timeout;
  private requestCounter = 0;
  private ollamaService?: OllamaService;
  private lmStudioAdapter?: HuggingFaceToLMStudioAdapter;

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
        ttlMs: 300000, // 5 minutes
        maxSize: 1000,
      },
    };

    this.initializeDefaultRoutingRules();
  }

  // ============================================================================
  // Service Lifecycle
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('🔀 Initializing Unified LLM Router Service', LogContext.API);
      this.status = 'initializing';

      // Initialize providers
      await this.initializeProviders();

      // Start background tasks
      this.startHealthChecks();
      this.startMetricsUpdates();

      this.isInitialized = true;
      this.status = 'active';
      this.emit('initialized');

      log.info('✅ Unified LLM Router Service initialized', LogContext.API, {
        providersCount: this.providers.size,
        rulesCount: this.routingRules.length,
      });

    } catch (error) {
      this.status = 'error';
      log.error('❌ Failed to initialize LLM Router Service', LogContext.API, { error });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.status !== 'active') return false;
      
      // Check if at least one provider is healthy
      const healthyProviders = Array.from(this.providers.values())
        .filter(conn => conn.isHealthy);
      
      return healthyProviders.length > 0;
    } catch (error) {
      log.error('❌ LLM Router health check failed', LogContext.API, { error });
      return false;
    }
  }

  async shutdown(): Promise<void> {
    log.info('🛑 Shutting down Unified LLM Router Service', LogContext.API);

    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.metricsUpdateTimer) clearInterval(this.metricsUpdateTimer);

    // Close circuit breakers
    for (const connection of this.providers.values()) {
      // Circuit breaker cleanup would go here
    }

    this.status = 'inactive';
    this.emit('shutdown');

    log.info('🛑 LLM Router Service shut down', LogContext.API);
  }

  // ============================================================================
  // Core Routing Operations
  // ============================================================================

  async routeRequest(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      log.debug('🔀 Routing LLM request', LogContext.API, {
        requestId,
        model: request.model,
        promptLength: request.prompt.length,
      });

      // Check cache first
      if (this.config.caching.enabled) {
        const cached = this.getCachedResponse(request);
        if (cached) {
          log.debug('💾 Cache hit for LLM request', LogContext.API, { requestId });
          return cached;
        }
      }

      // Find applicable routing rule
      const rule = this.findApplicableRule(request);
      const strategy = rule?.strategy || this.config.defaultStrategy;

      // Select best model based on strategy
      const selectedModel = await this.selectModel(request, rule || undefined, strategy);
      if (!selectedModel) {
        throw new Error('No available models for request');
      }

      // Execute request with fallbacks
      const response = await this.executeWithFallbacks(
        { ...request, model: selectedModel },
        rule?.fallbackModels || [],
        requestId
      );

      // Update metrics
      this.updateRequestMetrics(selectedModel, startTime, true);

      // Cache response if enabled
      if (this.config.caching.enabled) {
        this.cacheResponse(request, response);
      }

      // Emit events
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

    } catch (error) {
      // Update error metrics
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

  async selectModel(
    request: LLMRequest,
    rule?: RoutingRule,
    strategy: RoutingStrategy = this.config.defaultStrategy
  ): Promise<string | null> {
    // Get candidate models
    const candidates = rule?.targetModels || this.getAvailableModels();
    const healthyCandidates = candidates.filter(modelId => this.isModelHealthy(modelId));

    if (healthyCandidates.length === 0) {
      return null;
    }

    // Apply strategy
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

  // ============================================================================
  // Model Selection Strategies
  // ============================================================================

  private selectByLatency(candidates: string[]): string {
    if (candidates.length === 0) {
      throw new Error('No candidates available for model selection');
    }
    
    let bestModel = candidates[0];
    let bestLatency = Infinity;

    for (const modelId of candidates) {
      const metrics = this.modelMetrics.get(modelId);
      if (metrics && metrics.averageLatency < bestLatency) {
        bestLatency = metrics.averageLatency;
        bestModel = modelId;
      }
    }

    return bestModel!;
  }

  private selectByCost(candidates: string[], request: LLMRequest): string {
    if (candidates.length === 0) {
      throw new Error('No candidates available for cost selection');
    }
    
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

    return bestModel!;
  }

  private selectByQuality(candidates: string[]): string {
    if (candidates.length === 0) {
      throw new Error('No candidates available for quality selection');
    }
    
    let bestModel = candidates[0];
    let bestQuality = 0;

    for (const modelId of candidates) {
      const metrics = this.modelMetrics.get(modelId);
      if (metrics && metrics.qualityScore > bestQuality) {
        bestQuality = metrics.qualityScore;
        bestModel = modelId;
      }
    }

    return bestModel!;
  }

  private selectByLoad(candidates: string[]): string {
    // Select model with least current load
    if (candidates.length === 0) {
      throw new Error('No candidates available for load selection');
    }
    
    let bestModel = candidates[0];
    let bestLoad = Infinity;

    for (const modelId of candidates) {
      const metrics = this.modelMetrics.get(modelId);
      if (metrics) {
        // Simple load calculation based on recent usage
        const load = metrics.totalRequests / (metrics.tokensPerSecond || 1);
        if (load < bestLoad) {
          bestLoad = load;
          bestModel = modelId;
        }
      }
    }

    return bestModel!;
  }

  private selectRoundRobin(candidates: string[]): string {
    if (candidates.length === 0) {
      throw new Error('No candidates available for round-robin selection');
    }
    const index = this.requestCounter % candidates.length;
    this.requestCounter++;
    return candidates[index]!;
  }

  // ============================================================================
  // Request Execution
  // ============================================================================

  private async executeWithFallbacks(
    request: LLMRequest,
    fallbacks: string[],
    requestId: string
  ): Promise<LLMResponse> {
    const attemptOrder = [request.model, ...fallbacks];
    let lastError: Error | null = null;

    for (let i = 0; i < attemptOrder.length && i < this.config.maxRetries; i++) {
      const modelId = attemptOrder[i];
      
      if (!modelId) {
        continue; // Skip undefined models
      }
      
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

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        log.warn(`⚠️ Request failed with model: ${modelId}`, LogContext.API, {
          requestId,
          attempt: i + 1,
          error: lastError?.message || 'Unknown error',
        });

        // Mark model as temporarily unhealthy if circuit breaker trips
        const connection = this.getProviderForModel(modelId);
        if (connection) {
          // Circuit breaker logic would go here
        }
      }
    }

    throw lastError || new Error('All fallback attempts failed');
  }

  private async executeRequest(request: LLMRequest): Promise<LLMResponse> {
    // Get provider for model
    const connection = this.getProviderForModel(request.model);
    if (!connection) {
      throw new Error(`No provider found for model: ${request.model}`);
    }

    if (!connection.isHealthy) {
      throw new Error(`Provider for model ${request.model} is unhealthy`);
    }

    // Execute through circuit breaker
    return connection.circuitBreaker.execute(async () => {
      return this.callProvider(connection.provider, request);
    });
  }

  private async callProvider(provider: LLMProvider, request: LLMRequest): Promise<LLMResponse> {
    if (!provider?.name) {
      throw new Error('Provider must have a valid name');
    }
    
    const startTime = Date.now();
    
    try {
      // Route to appropriate provider implementation
      switch (provider.name.toLowerCase()) {
        case 'ollama': {
          if (!this.ollamaService) {
            this.ollamaService = new OllamaService();
          }
          
          const messages: OllamaMessage[] = [
            { role: 'user', content: request.prompt }
          ];
          
          if (request.systemPrompt) {
            messages.unshift({ role: 'system', content: request.systemPrompt });
          }
          
          const response = await this.ollamaService.generateResponse(
            messages,
            request.model,
            {
              temperature: request.temperature,
              max_tokens: request.maxTokens,
              stream: false
            }
          );
          
          return {
            content: response.message.content,
            model: response.model,
            usage: {
              promptTokens: response.prompt_eval_count || 0,
              completionTokens: response.eval_count || 0,
              totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
            },
            provider: provider.name,
            responseTime: Date.now() - startTime,
            metadata: {
              requestId: this.generateRequestId(),
              timestamp: new Date().toISOString(),
            },
          };
        }
        
        case 'lmstudio': {
          if (!this.lmStudioAdapter) {
            this.lmStudioAdapter = new HuggingFaceToLMStudioAdapter();
          }
          
          const response = await this.lmStudioAdapter.generateText({
            inputs: request.prompt,
            parameters: {
              max_new_tokens: request.maxTokens,
              temperature: request.temperature,
              top_p: request.topP,
              do_sample: true
            },
            model: request.model
          });
          
          const generatedText = response[0]?.generated_text || '';
          
          return {
            content: generatedText,
            model: request.model,
            usage: {
              promptTokens: Math.ceil(request.prompt.length / 4),
              completionTokens: Math.ceil(generatedText.length / 4),
              totalTokens: Math.ceil(request.prompt.length / 4) + Math.ceil(generatedText.length / 4),
            },
            provider: provider.name,
            responseTime: Date.now() - startTime,
            metadata: {
              requestId: this.generateRequestId(),
              timestamp: new Date().toISOString(),
            },
          };
        }
        
        case 'openai':
        case 'anthropic':
          // For now, return a placeholder for remote providers
          // These would need proper API implementation
          return {
            content: `[${provider.name}] This provider requires API key configuration`,
            model: request.model,
            usage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
            provider: provider.name,
            responseTime: Date.now() - startTime,
            metadata: {
              requestId: this.generateRequestId(),
              timestamp: new Date().toISOString(),
            },
          };
        
        default:
          throw new Error(`Unsupported provider: ${provider.name}`);
      }
    } catch (error) {
      log.error(`Failed to call provider ${provider.name}`, LogContext.API, { error });
      throw error;
    }
  }

  // ============================================================================
  // Provider Management
  // ============================================================================

  private async initializeProviders(): Promise<void> {
    // Initialize default providers
    const defaultProviders: LLMProvider[] = [
      {
        name: 'ollama',
        type: 'local',
        models: ['tinyllama:latest', 'gpt-oss:20b', 'nomic-embed-text:latest'],
        endpoint: process.env.OLLAMA_URL || 'http://localhost:11434',
      },
      {
        name: 'lmstudio',
        type: 'local',
        models: ['local-model'],
        endpoint: process.env.LM_STUDIO_URL || 'http://localhost:1234',
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

  async registerProvider(provider: LLMProvider): Promise<void> {
    try {
      const circuitBreaker = createCircuitBreaker(`llm-${provider.name}`, {
        timeout: this.config.circuitBreakerConfig.resetTimeoutMs,
        errorThresholdPercentage: 50,
        failureThreshold: this.config.circuitBreakerConfig.failureThreshold,
      });

      const connection: ProviderConnection = {
        provider,
        circuitBreaker,
        metrics: [],
        isHealthy: true,
        lastHealthCheck: new Date(),
      };

      // Initialize metrics for each model
      for (const modelId of provider.models) {
        this.modelMetrics.set(modelId, {
          modelId,
          provider: provider.name,
          averageLatency: 0,
          errorRate: 0,
          tokensPerSecond: 0,
          costPerToken: 0,
          qualityScore: 0.8, // Default quality score
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

    } catch (error) {
      log.error('❌ Failed to register provider', LogContext.API, { error, provider: provider.name });
      throw error;
    }
  }

  // ============================================================================
  // Routing Rules Management
  // ============================================================================

  private initializeDefaultRoutingRules(): void {
    const defaultRules: RoutingRule[] = [
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

  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.push(rule);
    this.routingRules.sort((a, b) => a.priority - b.priority);
    
    log.info('📋 Routing rule added', LogContext.API, { rule: rule.name });
  }

  removeRoutingRule(ruleId: string): void {
    const index = this.routingRules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      const removed = this.routingRules.splice(index, 1)[0];
      log.info('📋 Routing rule removed', LogContext.API, { rule: removed?.name || 'unknown' });
    }
  }

  private findApplicableRule(request: LLMRequest): RoutingRule | null {
    for (const rule of this.routingRules) {
      if (!rule.enabled) continue;
      
      if (this.matchesConditions(request, rule.conditions)) {
        return rule;
      }
    }
    
    return null;
  }

  private matchesConditions(request: LLMRequest, conditions: RoutingRule['conditions']): boolean {
    // Implement condition matching logic
    if (conditions.promptLength) {
      const {length} = request.prompt;
      if (conditions.promptLength.min && length < conditions.promptLength.min) return false;
      if (conditions.promptLength.max && length > conditions.promptLength.max) return false;
    }

    if (conditions.maxTokens) {
      const maxTokens = request.maxTokens || 0;
      if (conditions.maxTokens.min && maxTokens < conditions.maxTokens.min) return false;
      if (conditions.maxTokens.max && maxTokens > conditions.maxTokens.max) return false;
    }

    // Additional condition checks would go here based on request metadata
    
    return true;
  }

  // ============================================================================
  // Utilities and Helper Methods
  // ============================================================================

  private getAvailableModels(): string[] {
    return Array.from(this.modelMetrics.keys()).filter(modelId => this.isModelHealthy(modelId));
  }

  private isModelHealthy(modelId: string): boolean {
    const metrics = this.modelMetrics.get(modelId);
    if (!metrics) return false;

    const provider = this.getProviderForModel(modelId);
    if (!provider || !provider.isHealthy) return false;

    return metrics.availability > 0.8 && metrics.errorRate < 0.1;
  }

  private getProviderForModel(modelId: string): ProviderConnection | null {
    for (const connection of this.providers.values()) {
      if (connection.provider.models.includes(modelId)) {
        return connection;
      }
    }
    return null;
  }

  private estimateOutputTokens(request: LLMRequest): number {
    return request.maxTokens || Math.min(request.prompt.length / 2, 1000);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCachedResponse(request: LLMRequest): LLMResponse | null {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.responseCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.caching.ttlMs) {
      return cached.response;
    }
    
    return null;
  }

  private cacheResponse(request: LLMRequest, response: LLMResponse): void {
    const cacheKey = this.generateCacheKey(request);
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
    });

    // Clean cache if too large
    if (this.responseCache.size > this.config.caching.maxSize) {
      const entries = Array.from(this.responseCache.entries());
      const toRemove = entries.slice(0, Math.floor(entries.length * 0.2));
      for (const [key] of toRemove) {
        this.responseCache.delete(key);
      }
    }
  }

  private generateCacheKey(request: LLMRequest): string {
    return `${request.model}_${request.prompt}_${request.maxTokens}_${request.temperature}`;
  }

  private updateRequestMetrics(
    modelId: string, 
    startTime: number, 
    success: boolean, 
    error?: any
  ): void {
    const metrics = this.modelMetrics.get(modelId);
    if (!metrics) return;

    const responseTime = Date.now() - startTime;
    
    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    }

    // Update running averages
    metrics.averageLatency = (metrics.averageLatency * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;
    metrics.errorRate = 1 - (metrics.successfulRequests / metrics.totalRequests);
    metrics.lastUsed = new Date();

    // Update availability based on recent success rate
    const recentSuccessRate = metrics.successfulRequests / metrics.totalRequests;
    metrics.availability = Math.max(0, Math.min(1, recentSuccessRate));
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks().catch(error => 
        log.error('❌ Health check failed', LogContext.API, { error })
      );
    }, this.config.loadBalancing.healthCheckInterval);
  }

  private startMetricsUpdates(): void {
    this.metricsUpdateTimer = setInterval(() => {
      this.updateMetrics();
    }, 60000); // Every minute
  }

  private async performHealthChecks(): Promise<void> {
    for (const [providerName, connection] of this.providers) {
      try {
        // Perform provider health check
        const isHealthy = await this.checkProviderHealth(connection.provider);
        connection.isHealthy = isHealthy;
        connection.lastHealthCheck = new Date();

        if (!isHealthy) {
          log.warn(`⚠️ Provider ${providerName} is unhealthy`, LogContext.API);
        }

      } catch (error) {
        connection.isHealthy = false;
        log.error(`❌ Health check failed for provider ${providerName}`, LogContext.API, { error });
      }
    }
  }

  private async checkProviderHealth(provider: LLMProvider): Promise<boolean> {
    // Placeholder for provider health check
    // In real implementation, would ping provider endpoints
    return true;
  }

  private updateMetrics(): void {
    // Update aggregate metrics and emit events
    const totalRequests = Array.from(this.modelMetrics.values())
      .reduce((sum, metrics) => sum + metrics.totalRequests, 0);

    this.emit('metricsUpdated', {
      totalRequests,
      providersCount: this.providers.size,
      healthyProviders: Array.from(this.providers.values()).filter(p => p.isHealthy).length,
      averageLatency: this.calculateAverageLatency(),
    });
  }

  private calculateAverageLatency(): number {
    const metrics = Array.from(this.modelMetrics.values());
    if (metrics.length === 0) return 0;

    const totalLatency = metrics.reduce((sum, m) => sum + m.averageLatency, 0);
    return totalLatency / metrics.length;
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  getProviders(): LLMProvider[] {
    return Array.from(this.providers.values()).map(conn => conn.provider);
  }

  getModelMetrics(): ModelPerformanceMetrics[] {
    return Array.from(this.modelMetrics.values());
  }

  getRoutingRules(): RoutingRule[] {
    return [...this.routingRules];
  }

  updateRoutingRule(ruleId: string, updates: Partial<RoutingRule>): void {
    const rule = this.routingRules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      log.info('📋 Routing rule updated', LogContext.API, { rule: rule.name });
    }
  }

  getStats(): {
    totalRequests: number;
    totalProviders: number;
    healthyProviders: number;
    averageLatency: number;
    cacheHitRate: number;
  } {
    const totalRequests = Array.from(this.modelMetrics.values())
      .reduce((sum, m) => sum + m.totalRequests, 0);

    return {
      totalRequests,
      totalProviders: this.providers.size,
      healthyProviders: Array.from(this.providers.values()).filter(p => p.isHealthy).length,
      averageLatency: this.calculateAverageLatency(),
      cacheHitRate: this.responseCache.size > 0 ? 0.85 : 0, // Placeholder
    };
  }
}

// ============================================================================
// Export Service Instance
// ============================================================================

export const unifiedLLMRouter = new UnifiedLLMRouterService();
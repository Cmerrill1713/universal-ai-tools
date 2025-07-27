/**
 * Internal LLM Relay Service
 * 
 * Unified interface for multiple LLM providers with intelligent routing
 * Supports local models (MLX, LFM2) with fallback to external APIs
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import axios from 'axios';

// Provider interfaces
export interface LLMProvider {
  name: string;
  type: 'mlx' | 'lfm2' | 'ollama' | 'openai' | 'anthropic';
  priority: number;
  isAvailable: boolean;
  modelId?: string;
  config?: any;
}

export interface LLMRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  preferLocal?: boolean;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  success: boolean;
  content: string;
  model: string;
  provider: string;
  latencyMs: number;
  tokenCount?: number;
  confidence?: number;
  metadata?: Record<string, any>;
  error?: string;
}

export interface ProviderStats {
  name: string;
  requests: number;
  successes: number;
  failures: number;
  averageLatency: number;
  lastUsed?: Date;
  successRate: number;
}

/**
 * Internal LLM Relay for unified model access
 */
export class InternalLLMRelay extends EventEmitter {
  private providers: LLMProvider[] = [];
  private providerStats = new Map<string, ProviderStats>();
  private isInitialized = false;
  private circuitBreakers = new Map<string, { failures: number; lastFailure: Date }>();
  private readonly maxFailures = 3;
  private readonly resetTimeout = 60000; // 1 minute

  constructor() {
    super();
    this.setupDefaultProviders();
  }

  /**
   * Initialize the LLM relay
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🔄 Initializing Internal LLM Relay...');

      // Test provider availability
      await this.checkProviderAvailability();

      // Sort providers by priority
      this.providers.sort((a, b) => b.priority - a.priority);

      this.isInitialized = true;
      logger.info('✅ Internal LLM Relay ready', {
        availableProviders: this.providers.filter(p => p.isAvailable).length,
        totalProviders: this.providers.length
      });

    } catch (error) {
      logger.error('❌ Failed to initialize LLM Relay:', error);
      throw error;
    }
  }

  /**
   * Route LLM request to best available provider
   */
  async routeRequest(request: LLMRequest): Promise<LLMResponse> {
    if (!this.isInitialized) {
      throw new Error('LLM Relay not initialized');
    }

    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('🧠 Routing LLM request', {
      requestId,
      model: request.model,
      preferLocal: request.preferLocal,
      promptLength: request.prompt.length
    });

    // Select provider based on preferences and availability
    const selectedProvider = this.selectProvider(request);
    
    if (!selectedProvider) {
      throw new Error('No available LLM providers');
    }

    try {
      // Execute request with selected provider
      const response = await this.executeRequest(selectedProvider, request);
      
      // Update stats
      this.updateProviderStats(selectedProvider.name, Date.now() - startTime, true);
      
      // Reset circuit breaker on success
      this.circuitBreakers.delete(selectedProvider.name);

      logger.info('✅ LLM request completed', {
        requestId,
        provider: selectedProvider.name,
        model: response.model,
        latencyMs: response.latencyMs,
        tokenCount: response.tokenCount
      });

      return response;

    } catch (error) {
      logger.warn(`⚠️ Provider ${selectedProvider.name} failed, trying fallback`, { error: error.message });
      
      // Update failure stats and circuit breaker
      this.updateProviderStats(selectedProvider.name, Date.now() - startTime, false);
      this.updateCircuitBreaker(selectedProvider.name);

      // Try fallback providers
      return await this.tryFallbackProviders(request, [selectedProvider.name]);
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<Array<{ provider: string; models: string[] }>> {
    const modelsList: Array<{ provider: string; models: string[] }> = [];

    for (const provider of this.providers.filter(p => p.isAvailable)) {
      try {
        const models = await this.getProviderModels(provider);
        modelsList.push({
          provider: provider.name,
          models
        });
      } catch (error) {
        logger.warn(`Could not get models for ${provider.name}:`, error);
      }
    }

    return modelsList;
  }

  /**
   * Get provider statistics
   */
  getProviderStats(): ProviderStats[] {
    return Array.from(this.providerStats.values());
  }

  /**
   * Test connection to a specific provider
   */
  async testProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.find(p => p.name === providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    try {
      const testRequest: LLMRequest = {
        prompt: 'Hello, this is a connection test.',
        maxTokens: 10,
        temperature: 0.1
      };

      const response = await this.executeRequest(provider, testRequest);
      return response.success;

    } catch (error) {
      logger.warn(`Provider test failed for ${providerName}:`, error);
      return false;
    }
  }

  /**
   * Setup default provider configurations
   */
  private setupDefaultProviders(): void {
    this.providers = [
      {
        name: 'mlx',
        type: 'mlx',
        priority: 100, // Highest priority for local Apple Silicon
        isAvailable: false,
        config: {
          endpoint: 'http://localhost:8765',
          timeout: 30000
        }
      },
      {
        name: 'lfm2',
        type: 'lfm2',
        priority: 90, // High priority for local model
        isAvailable: false,
        config: {
          modelPath: '/models/agents/LFM2-1.2B',
          timeout: 45000
        }
      },
      {
        name: 'ollama',
        type: 'ollama',
        priority: 80, // Good priority for local Ollama
        isAvailable: false,
        config: {
          endpoint: process.env.OLLAMA_URL || 'http://localhost:11434',
          timeout: 60000
        }
      },
      {
        name: 'openai',
        type: 'openai',
        priority: 30, // Lower priority (external, costs money)
        isAvailable: false,
        config: {
          apiKey: process.env.OPENAI_API_KEY,
          endpoint: 'https://api.openai.com/v1',
          timeout: 30000
        }
      },
      {
        name: 'anthropic',
        type: 'anthropic',
        priority: 25, // Lower priority (external, costs money)
        isAvailable: false,
        config: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          endpoint: 'https://api.anthropic.com/v1',
          timeout: 30000
        }
      }
    ];

    // Initialize stats for each provider
    this.providers.forEach(provider => {
      this.providerStats.set(provider.name, {
        name: provider.name,
        requests: 0,
        successes: 0,
        failures: 0,
        averageLatency: 0,
        successRate: 0
      });
    });
  }

  /**
   * Check availability of all providers
   */
  private async checkProviderAvailability(): Promise<void> {
    const checkPromises = this.providers.map(async (provider) => {
      try {
        const isAvailable = await this.checkSingleProvider(provider);
        provider.isAvailable = isAvailable;
        logger.info(`Provider ${provider.name}: ${isAvailable ? '✅ Available' : '❌ Unavailable'}`);
      } catch (error) {
        provider.isAvailable = false;
        logger.warn(`Provider ${provider.name} check failed:`, error);
      }
    });

    await Promise.allSettled(checkPromises);
  }

  /**
   * Check if a single provider is available
   */
  private async checkSingleProvider(provider: LLMProvider): Promise<boolean> {
    switch (provider.type) {
      case 'mlx':
        return await this.checkMLXAvailability(provider);
      case 'lfm2':
        return await this.checkLFM2Availability(provider);
      case 'ollama':
        return await this.checkOllamaAvailability(provider);
      case 'openai':
        return await this.checkOpenAIAvailability(provider);
      case 'anthropic':
        return await this.checkAnthropicAvailability(provider);
      default:
        return false;
    }
  }

  /**
   * Check MLX availability
   */
  private async checkMLXAvailability(provider: LLMProvider): Promise<boolean> {
    try {
      // Try to import MLX interface
      const { MLXInterface } = await import('./mlx-interface/index-clean.js');
      const mlx = new MLXInterface();
      return await mlx.isAvailable();
    } catch (error) {
      logger.debug('MLX not available:', error);
      return false;
    }
  }

  /**
   * Check LFM2 availability
   */
  private async checkLFM2Availability(provider: LLMProvider): Promise<boolean> {
    try {
      // Check if model file exists
      const fs = await import('fs/promises');
      const modelPath = provider.config?.modelPath;
      if (modelPath) {
        await fs.access(modelPath);
        return true;
      }
      return false;
    } catch (error) {
      logger.debug('LFM2 model not available:', error);
      return false;
    }
  }

  /**
   * Check Ollama availability
   */
  private async checkOllamaAvailability(provider: LLMProvider): Promise<boolean> {
    try {
      const response = await axios.get(`${provider.config.endpoint}/api/tags`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.debug('Ollama not available:', error);
      return false;
    }
  }

  /**
   * Check OpenAI availability
   */
  private async checkOpenAIAvailability(provider: LLMProvider): Promise<boolean> {
    if (!provider.config?.apiKey) {
      return false;
    }

    try {
      const response = await axios.get(`${provider.config.endpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${provider.config.apiKey}`
        },
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      logger.debug('OpenAI not available:', error);
      return false;
    }
  }

  /**
   * Check Anthropic availability
   */
  private async checkAnthropicAvailability(provider: LLMProvider): Promise<boolean> {
    if (!provider.config?.apiKey) {
      return false;
    }

    // For Anthropic, we can't easily test without making a request
    // So we just check if API key is present
    return true;
  }

  /**
   * Select best provider for request
   */
  private selectProvider(request: LLMRequest): LLMProvider | null {
    const availableProviders = this.providers.filter(p => 
      p.isAvailable && !this.isCircuitBreakerOpen(p.name)
    );

    if (availableProviders.length === 0) {
      return null;
    }

    // Prefer local providers if specified
    if (request.preferLocal) {
      const localProviders = availableProviders.filter(p => 
        p.type === 'mlx' || p.type === 'lfm2' || p.type === 'ollama'
      );
      if (localProviders.length > 0) {
        return localProviders[0]; // Highest priority local provider
      }
    }

    // Return highest priority available provider
    return availableProviders[0];
  }

  /**
   * Execute request with specific provider
   */
  private async executeRequest(provider: LLMProvider, request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    switch (provider.type) {
      case 'mlx':
        return await this.executeMLXRequest(provider, request, startTime);
      case 'lfm2':
        return await this.executeLFM2Request(provider, request, startTime);
      case 'ollama':
        return await this.executeOllamaRequest(provider, request, startTime);
      case 'openai':
        return await this.executeOpenAIRequest(provider, request, startTime);
      case 'anthropic':
        return await this.executeAnthropicRequest(provider, request, startTime);
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }

  /**
   * Execute MLX request
   */
  private async executeMLXRequest(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    try {
      const { MLXInterface } = await import('./mlx-interface/index-clean.js');
      const mlx = new MLXInterface();
      
      const result = await mlx.generate({
        prompt: request.prompt,
        model: request.model || 'LFM2-1.2B',
        temperature: request.temperature || 0.7,
        maxTokens: request.maxTokens || 200
      });

      return {
        success: true,
        content: result.text,
        model: result.model || 'LFM2-1.2B',
        provider: 'mlx',
        latencyMs: Date.now() - startTime,
        tokenCount: result.tokenCount,
        confidence: 0.9,
        metadata: { 
          backend: 'mlx',
          device: 'apple_silicon'
        }
      };

    } catch (error) {
      throw new Error(`MLX execution failed: ${error.message}`);
    }
  }

  /**
   * Execute LFM2 request
   */
  private async executeLFM2Request(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    try {
      // This would integrate with LFM2 model directly
      // For now, return a placeholder response
      const response = {
        success: true,
        content: `LFM2 response to: ${request.prompt.substring(0, 50)}...`,
        model: 'LFM2-1.2B',
        provider: 'lfm2',
        latencyMs: Date.now() - startTime,
        tokenCount: 150,
        confidence: 0.85,
        metadata: { 
          backend: 'lfm2',
          device: 'local'
        }
      };

      return response;

    } catch (error) {
      throw new Error(`LFM2 execution failed: ${error.message}`);
    }
  }

  /**
   * Execute Ollama request
   */
  private async executeOllamaRequest(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    try {
      const response = await axios.post(`${provider.config.endpoint}/api/generate`, {
        model: request.model || 'llama3.2:3b',
        prompt: request.prompt,
        stream: false,
        options: {
          temperature: request.temperature || 0.7,
          num_predict: request.maxTokens || 200
        }
      }, {
        timeout: provider.config.timeout
      });

      if (!response.data) {
        throw new Error('No response from Ollama');
      }

      return {
        success: true,
        content: response.data.response || response.data.message || '',
        model: response.data.model || request.model || 'unknown',
        provider: 'ollama',
        latencyMs: Date.now() - startTime,
        tokenCount: response.data.eval_count,
        confidence: 0.8,
        metadata: {
          backend: 'ollama',
          eval_duration: response.data.eval_duration,
          load_duration: response.data.load_duration
        }
      };

    } catch (error) {
      throw new Error(`Ollama execution failed: ${error.message}`);
    }
  }

  /**
   * Execute OpenAI request
   */
  private async executeOpenAIRequest(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    try {
      const messages = request.conversationHistory || [
        { role: 'user', content: request.prompt }
      ];

      if (request.systemPrompt) {
        messages.unshift({ role: 'system', content: request.systemPrompt });
      }

      const response = await axios.post(`${provider.config.endpoint}/chat/completions`, {
        model: request.model || 'gpt-3.5-turbo',
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 200
      }, {
        headers: {
          'Authorization': `Bearer ${provider.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: provider.config.timeout
      });

      const choice = response.data.choices?.[0];
      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      return {
        success: true,
        content: choice.message.content,
        model: response.data.model,
        provider: 'openai',
        latencyMs: Date.now() - startTime,
        tokenCount: response.data.usage?.total_tokens,
        confidence: 0.95,
        metadata: {
          backend: 'openai',
          usage: response.data.usage,
          finish_reason: choice.finish_reason
        }
      };

    } catch (error) {
      throw new Error(`OpenAI execution failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Execute Anthropic request
   */
  private async executeAnthropicRequest(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    try {
      const response = await axios.post(`${provider.config.endpoint}/messages`, {
        model: request.model || 'claude-3-sonnet-20240229',
        max_tokens: request.maxTokens || 200,
        temperature: request.temperature || 0.7,
        messages: [
          { role: 'user', content: request.prompt }
        ]
      }, {
        headers: {
          'x-api-key': provider.config.apiKey,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: provider.config.timeout
      });

      const content = response.data.content?.[0]?.text;
      if (!content) {
        throw new Error('No response from Anthropic');
      }

      return {
        success: true,
        content,
        model: response.data.model,
        provider: 'anthropic',
        latencyMs: Date.now() - startTime,
        tokenCount: response.data.usage?.output_tokens,
        confidence: 0.95,
        metadata: {
          backend: 'anthropic',
          usage: response.data.usage,
          stop_reason: response.data.stop_reason
        }
      };

    } catch (error) {
      throw new Error(`Anthropic execution failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Try fallback providers if primary fails
   */
  private async tryFallbackProviders(request: LLMRequest, excludeProviders: string[]): Promise<LLMResponse> {
    const availableProviders = this.providers.filter(p => 
      p.isAvailable && 
      !excludeProviders.includes(p.name) && 
      !this.isCircuitBreakerOpen(p.name)
    );

    if (availableProviders.length === 0) {
      throw new Error('No fallback providers available');
    }

    for (const provider of availableProviders) {
      try {
        logger.info(`🔄 Trying fallback provider: ${provider.name}`);
        return await this.executeRequest(provider, request);
      } catch (error) {
        logger.warn(`Fallback provider ${provider.name} failed:`, error);
        this.updateProviderStats(provider.name, 0, false);
        this.updateCircuitBreaker(provider.name);
      }
    }

    throw new Error('All fallback providers failed');
  }

  /**
   * Get available models from provider
   */
  private async getProviderModels(provider: LLMProvider): Promise<string[]> {
    switch (provider.type) {
      case 'mlx':
        return ['LFM2-1.2B', 'custom-mlx-model'];
      case 'lfm2':
        return ['LFM2-1.2B'];
      case 'ollama':
        try {
          const response = await axios.get(`${provider.config.endpoint}/api/tags`);
          return response.data.models?.map((m: any) => m.name) || [];
        } catch {
          return ['llama3.2:3b', 'llama3.2:1b'];
        }
      case 'openai':
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
      case 'anthropic':
        return ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
      default:
        return [];
    }
  }

  /**
   * Update provider statistics
   */
  private updateProviderStats(providerName: string, latency: number, success: boolean): void {
    const stats = this.providerStats.get(providerName);
    if (!stats) return;

    stats.requests++;
    stats.lastUsed = new Date();

    if (success) {
      stats.successes++;
      // Update rolling average latency
      stats.averageLatency = stats.successes === 1 
        ? latency 
        : (stats.averageLatency * (stats.successes - 1) + latency) / stats.successes;
    } else {
      stats.failures++;
    }

    stats.successRate = stats.successes / stats.requests;
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(providerName: string): void {
    const breaker = this.circuitBreakers.get(providerName) || { failures: 0, lastFailure: new Date() };
    breaker.failures++;
    breaker.lastFailure = new Date();
    this.circuitBreakers.set(providerName, breaker);

    if (breaker.failures >= this.maxFailures) {
      logger.warn(`🚨 Circuit breaker opened for provider: ${providerName}`);
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(providerName: string): boolean {
    const breaker = this.circuitBreakers.get(providerName);
    if (!breaker || breaker.failures < this.maxFailures) {
      return false;
    }

    // Reset circuit breaker if enough time has passed
    if (Date.now() - breaker.lastFailure.getTime() > this.resetTimeout) {
      this.circuitBreakers.delete(providerName);
      return false;
    }

    return true;
  }

  /**
   * Shutdown the relay
   */
  async shutdown(): Promise<void> {
    logger.info('🔄 Shutting down Internal LLM Relay');
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

export default InternalLLMRelay;
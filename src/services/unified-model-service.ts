/**
 * Unified Model Service
 * Single interface for all model providers with dynamic routing
 * No hardcoded models - everything is discovered and routed dynamically
 */

import { CircuitBreaker } from '@/utils/circuit-breaker';
import { log, LogContext } from '@/utils/logger';

import { 
  dynamicModelRouter, 
  RoutingDecision 
} from './dynamic-model-router';
import type { 
  DiscoveredModel} from './model-discovery-service';
import {
  modelDiscoveryService, 
  TaskRequirements 
} from './model-discovery-service';

export interface UnifiedRequest {
  prompt: string;
  systemPrompt?: string;
  taskType?: string;
  priority?: 'speed' | 'quality' | 'balanced';
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  requiredCapabilities?: string[];
  maxLatencyMs?: number;
}

export interface UnifiedResponse {
  content: string;
  model: {
    id: string;
    provider: string;
    tier: number;
  };
  metrics: {
    latencyMs: number;
    tokensGenerated: number;
    tokensPerSecond: number;
  };
  routing: {
    decision: string;
    confidence: number;
    fallbacksAvailable: number;
  };
}

export class UnifiedModelService {
  private providerClients: Map<string, any> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private activeRequests: Map<string, AbortController> = new Map();

  constructor() {
    this.initializeProviders();
    this.startHealthChecks();
  }

  /**
   * Initialize provider clients
   */
  private async initializeProviders() {
    // These will be populated dynamically based on discovered providers
    this.providerClients.set('ollama', {
      baseUrl: 'http://localhost:11434',
      type: 'ollama'
    });

    // Check for LM Studio on multiple ports
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
      } catch {
        // Try next port
      }
    }

    // Initialize circuit breakers for each provider
    for (const [provider] of this.providerClients) {
      this.circuitBreakers.set(provider, new CircuitBreaker(provider, {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 30000,
        rollingWindow: 60000
      }));
    }
  }

  /**
   * Main generation method - routes to best available model
   */
  public async generate(request: UnifiedRequest): Promise<UnifiedResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Get routing decision
      const routing = await dynamicModelRouter.route(
        request.taskType || 'general',
        request.prompt,
        {
          priority: request.priority,
          maxLatencyMs: request.maxLatencyMs,
          requiredCapabilities: request.requiredCapabilities,
        }
      );

      log.info('🚀 Starting generation', LogContext.AI, {
        requestId,
        primary: `${routing.primary.provider}:${routing.primary.name}`,
        fallbacks: routing.fallbacks.length,
        estimatedLatency: routing.estimatedLatency,
      });

      // Try primary model
      let response: UnifiedResponse | null = null;
      let lastError: Error | null = null;

      try {
        // Add timeout protection
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Model timeout')), request.maxLatencyMs || 30000)
        );
        
        response = await Promise.race([
          this.callModel(routing.primary, request, requestId),
          timeoutPromise
        ]);
        
        // Track successful performance
        await dynamicModelRouter.trackPerformance(routing.primary, request.taskType || 'general', {
          latencyMs: response.metrics.latencyMs,
          tokensGenerated: response.metrics.tokensGenerated,
          success: true,
          quality: this.estimateQuality(response.content, request.prompt),
        });
        
        return response;
      } catch (error) {
        lastError = error as Error;
        log.warn('Primary model failed, trying fallbacks', LogContext.AI, {
          requestId,
          model: routing.primary.name,
          error: lastError.message,
        });

        // Track failure
        await dynamicModelRouter.trackPerformance(routing.primary, request.taskType || 'general', {
          latencyMs: Date.now() - startTime,
          tokensGenerated: 0,
          success: false,
        });
      }

      // Try fallback models
      for (const fallbackModel of routing.fallbacks) {
        try {
          // Add timeout protection for fallbacks too
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Fallback model timeout')), request.maxLatencyMs || 30000)
          );
          
          response = await Promise.race([
            this.callModel(fallbackModel, request, requestId),
            timeoutPromise
          ]);
          
          // Track successful fallback
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
        } catch (error) {
          lastError = error as Error;
          log.warn('Fallback model failed', LogContext.AI, {
            requestId,
            model: fallbackModel.name,
            error: lastError.message,
          });

          // Track fallback failure
          await dynamicModelRouter.trackPerformance(fallbackModel, request.taskType || 'general', {
            latencyMs: Date.now() - startTime,
            tokensGenerated: 0,
            success: false,
          });
        }
      }

      // All models failed
      throw new Error(`All models failed. Last error: ${lastError?.message}`);

    } catch (error) {
      log.error('Generation failed', LogContext.AI, {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Call a specific model
   */
  private async callModel(
    model: DiscoveredModel,
    request: UnifiedRequest,
    requestId: string
  ): Promise<UnifiedResponse> {
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
      // Route based on provider type
      let response: any;
      
      if (model.provider === 'ollama') {
        response = await this.callOllama(model, request, provider, abortController.signal);
      } else if (model.provider === 'lmstudio') {
        response = await this.callLMStudio(model, request, provider, abortController.signal);
      } else if (model.provider === 'mlx') {
        response = await this.callMLX(model, request, abortController.signal);
      } else {
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
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  }

  /**
   * Call Ollama API
   */
  private async callOllama(
    model: DiscoveredModel,
    request: UnifiedRequest,
    provider: any,
    signal: AbortSignal
  ): Promise<{ content: string; confidence: number }> {
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

  /**
   * Call LM Studio API (OpenAI compatible)
   */
  private async callLMStudio(
    model: DiscoveredModel,
    request: UnifiedRequest,
    provider: any,
    signal: AbortSignal
  ): Promise<{ content: string; confidence: number }> {
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
      confidence: 0.9, // LM Studio models often have good quality
    };
  }

  /**
   * Call MLX fine-tuned model
   */
  private async callMLX(
    model: DiscoveredModel,
    request: UnifiedRequest,
    signal: AbortSignal
  ): Promise<{ content: string; confidence: number }> {
    const { mlxProviderService } = await import('./mlx-provider-service.js');
    
    // Build full prompt (MLX models work better with complete prompts)
    let fullPrompt = request.prompt;
    if (request.systemPrompt) {
      fullPrompt = `${request.systemPrompt}\n\nUser: ${request.prompt}\nAssistant:`;
    }

    try {
      const content = await mlxProviderService.generate(
        model.id,
        fullPrompt,
        {
          maxTokens: request.maxTokens || this.getOptimalMaxTokens(model),
          temperature: request.temperature || this.getOptimalTemperature(model),
          topK: 40,
          topP: 0.9,
        }
      );

      return {
        content: content.trim(),
        confidence: 0.95, // Fine-tuned models are typically high quality
      };
    } catch (error) {
      throw new Error(`MLX error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get optimal temperature for model
   */
  private getOptimalTemperature(model: DiscoveredModel): number {
    // Lower temperature for smaller models (more focused)
    // Higher temperature for larger models (more creative)
    switch (model.tier) {
      case 1: return 0.3;
      case 2: return 0.5;
      case 3: return 0.7;
      case 4: return 0.8;
      default: return 0.7;
    }
  }

  /**
   * Get optimal max tokens for model
   */
  private getOptimalMaxTokens(model: DiscoveredModel): number {
    // Scale by tier
    switch (model.tier) {
      case 1: return 512;
      case 2: return 1024;
      case 3: return 2048;
      case 4: return 4096;
      default: return 1024;
    }
  }

  /**
   * Get optimal context size for model
   */
  private getOptimalContextSize(model: DiscoveredModel): number {
    // Smaller context for faster models
    switch (model.tier) {
      case 1: return 2048;
      case 2: return 4096;
      case 3: return 8192;
      case 4: return 16384;
      default: return 4096;
    }
  }

  /**
   * Get optimal thread count for model
   */
  private getOptimalThreads(model: DiscoveredModel): number {
    // More threads for larger models
    switch (model.tier) {
      case 1: return 4;
      case 2: return 6;
      case 3: return 8;
      case 4: return 12;
      default: return 8;
    }
  }

  /**
   * Count tokens (rough estimate)
   */
  private countTokens(text: string): number {
    // Rough estimate: 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate response quality
   */
  private estimateQuality(response: string, prompt: string): number {
    let quality = 0.5; // Base quality

    // Length appropriateness
    const responseLength = response.length;
    const promptLength = prompt.length;
    
    if (responseLength > promptLength * 0.5 && responseLength < promptLength * 10) {
      quality += 0.2;
    }

    // Contains actual content (not just filler)
    if (response.length > 50 && !response.includes('I cannot') && !response.includes('I don\'t')) {
      quality += 0.2;
    }

    // Coherence check (has punctuation, proper sentences)
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 1) {
      quality += 0.1;
    }

    return Math.min(1.0, quality);
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cancel an active request
   */
  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Start health checks for providers
   */
  private startHealthChecks(): void {
    setInterval(async () => {
      await this.checkProviderHealth();
    }, 30000); // Every 30 seconds
  }

  /**
   * Check health of all providers
   */
  private async checkProviderHealth(): Promise<void> {
    for (const [provider, client] of this.providerClients) {
      try {
        if (provider === 'ollama') {
          const response = await fetch(`${client.baseUrl}/api/tags`);
          if (!response.ok) {
            log.warn(`Provider ${provider} health check failed`, LogContext.AI);
          }
        } else if (provider === 'lmstudio') {
          const response = await fetch(`${client.baseUrl}/v1/models`);
          if (!response.ok) {
            log.warn(`Provider ${provider} health check failed`, LogContext.AI);
          }
        }
      } catch (error) {
        log.warn(`Provider ${provider} is unreachable`, LogContext.AI, { error });
      }
    }
  }

  /**
   * Get provider statistics
   */
  public getProviderStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [provider, breaker] of this.circuitBreakers) {
      stats[provider] = {
        state: breaker.getState(),
        failures: breaker.getFailureCount(),
        lastFailure: breaker.getLastFailureTime(),
      };
    }
    
    return stats;
  }

  /**
   * Get available models summary
   */
  public getAvailableModels(): Record<string, number> {
    const models = modelDiscoveryService.getModels();
    const summary: Record<string, number> = {};
    
    for (const model of models) {
      const key = `${model.provider}_tier${model.tier}`;
      summary[key] = (summary[key] || 0) + 1;
    }
    
    return summary;
  }
}

// Singleton instance
export const unifiedModelService = new UnifiedModelService();
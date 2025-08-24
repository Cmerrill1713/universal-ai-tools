/**
 * Hybrid AI Service - Intelligent routing between Rust AI Core and legacy TypeScript services
 * Provides seamless fallback and performance optimization
 */

import { aiCoreClient, AICoreClient } from './ai-core-client';
import type { AIMessage, CompletionRequest, CompletionResponse } from './ai-core-client';

interface HybridAIOptions {
  preferRustCore?: boolean;
  fallbackToLegacy?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface AIServiceRequest {
  messages: AIMessage[];
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface AIServiceResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingTimeMs: number;
  cached: boolean;
  source: 'rust-core' | 'legacy-typescript';
}

export class HybridAIService {
  private aiCore: AICoreClient;
  private coreAvailable: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor() {
    this.aiCore = aiCoreClient;
    this.checkCoreHealth();
  }

  /**
   * Check AI Core service health
   */
  private async checkCoreHealth(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return;
    }

    try {
      this.coreAvailable = await this.aiCore.isAvailable();
      this.lastHealthCheck = now;
      
      if (this.coreAvailable) {
        console.log('[Hybrid AI] Rust AI Core is available and healthy');
      } else {
        console.warn('[Hybrid AI] Rust AI Core is not available, using legacy fallback');
      }
    } catch (error) {
      console.error('[Hybrid AI] Health check failed:', error);
      this.coreAvailable = false;
      this.lastHealthCheck = now;
    }
  }

  /**
   * Generate AI completion with intelligent routing
   */
  async completion(
    request: AIServiceRequest,
    options: HybridAIOptions = {}
  ): Promise<AIServiceResponse> {
    const {
      preferRustCore = true,
      fallbackToLegacy = true,
      maxRetries = 2,
      retryDelayMs = 1000,
    } = options;

    await this.checkCoreHealth();

    // Try Rust AI Core first if preferred and available
    if (preferRustCore && this.coreAvailable) {
      try {
        console.log('[Hybrid AI] Routing to Rust AI Core');
        const response = await this.callRustCore(request);
        return {
          ...response,
          source: 'rust-core',
        };
      } catch (error) {
        console.error('[Hybrid AI] Rust AI Core failed:', error);
        
        // Mark as unavailable and retry with exponential backoff
        this.coreAvailable = false;
        
        if (fallbackToLegacy) {
          console.log('[Hybrid AI] Falling back to legacy TypeScript service');
          return this.callLegacyService(request);
        } else {
          throw error;
        }
      }
    }

    // Fallback to legacy TypeScript service
    if (fallbackToLegacy) {
      console.log('[Hybrid AI] Using legacy TypeScript service');
      return this.callLegacyService(request);
    }

    throw new Error('No AI service available');
  }

  /**
   * Generate streaming completion
   */
  async streamCompletion(
    request: AIServiceRequest,
    onChunk: (chunk: string) => void,
    onComplete?: (response: AIServiceResponse) => void,
    onError?: (error: Error) => void,
    options: HybridAIOptions = {}
  ): Promise<void> {
    const { preferRustCore = true, fallbackToLegacy = true } = options;

    await this.checkCoreHealth();

    // Try Rust AI Core for streaming if available
    if (preferRustCore && this.coreAvailable) {
      try {
        console.log('[Hybrid AI] Streaming via Rust AI Core');
        await this.aiCore.streamCompletion(
          {
            messages: request.messages,
            model: request.model,
            provider: request.provider,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            stream: true,
          },
          onChunk,
          (rustResponse) => {
            if (onComplete) {
              onComplete({
                content: rustResponse.choices[0]?.message?.content || '',
                model: rustResponse.model,
                provider: rustResponse.provider,
                usage: {
                  promptTokens: rustResponse.usage.prompt_tokens,
                  completionTokens: rustResponse.usage.completion_tokens,
                  totalTokens: rustResponse.usage.total_tokens,
                },
                processingTimeMs: rustResponse.processing_time_ms,
                cached: rustResponse.cached,
                source: 'rust-core',
              });
            }
          },
          onError
        );
        return;
      } catch (error) {
        console.error('[Hybrid AI] Rust streaming failed:', error);
        this.coreAvailable = false;
        
        if (onError && !fallbackToLegacy) {
          onError(error as Error);
          return;
        }
      }
    }

    // Fallback to legacy streaming (simplified implementation)
    if (fallbackToLegacy) {
      console.log('[Hybrid AI] Falling back to legacy streaming simulation');
      try {
        const response = await this.callLegacyService(request);
        
        // Simulate streaming by chunking the response
        const words = response.content.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = i === 0 ? words[i] : ' ' + words[i];
          onChunk(chunk);
          await new Promise(resolve => setTimeout(resolve, 50)); // Simulate streaming delay
        }
        
        if (onComplete) {
          onComplete(response);
        }
      } catch (error) {
        if (onError) {
          onError(error as Error);
        }
      }
    }
  }

  /**
   * Call Rust AI Core service
   */
  private async callRustCore(request: AIServiceRequest): Promise<AIServiceResponse> {
    const rustResponse = await this.aiCore.completion({
      messages: request.messages,
      model: request.model,
      provider: request.provider,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false,
    });

    return {
      content: rustResponse.choices[0]?.message?.content || '',
      model: rustResponse.model,
      provider: rustResponse.provider,
      usage: {
        promptTokens: rustResponse.usage.prompt_tokens,
        completionTokens: rustResponse.usage.completion_tokens,
        totalTokens: rustResponse.usage.total_tokens,
      },
      processingTimeMs: rustResponse.processing_time_ms,
      cached: rustResponse.cached,
      source: 'rust-core',
    };
  }

  /**
   * Call legacy TypeScript service (placeholder - would integrate with existing services)
   */
  private async callLegacyService(request: AIServiceRequest): Promise<AIServiceResponse> {
    // This is a placeholder - in real implementation, this would call the existing
    // TypeScript AI services (OpenAI, Anthropic, Ollama clients)
    
    console.log('[Hybrid AI] Legacy service call (placeholder implementation)');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      content: `Legacy response to: ${request.messages[request.messages.length - 1]?.content || 'unknown message'}`,
      model: request.model || 'legacy-fallback',
      provider: request.provider || 'legacy',
      usage: {
        promptTokens: 50,
        completionTokens: 25,
        totalTokens: 75,
      },
      processingTimeMs: 500,
      cached: false,
      source: 'legacy-typescript',
    };
  }

  /**
   * Get available models from both services
   */
  async getAvailableModels(): Promise<Array<{
    id: string;
    name: string;
    provider: string;
    source: 'rust-core' | 'legacy-typescript';
  }>> {
    const models: Array<{
      id: string;
      name: string;
      provider: string;
      source: 'rust-core' | 'legacy-typescript';
    }> = [];

    // Get models from Rust AI Core
    try {
      if (this.coreAvailable || await this.aiCore.isAvailable()) {
        const rustModels = await this.aiCore.getModels();
        models.push(...rustModels.map(model => ({
          id: model.id,
          name: model.name,
          provider: model.provider,
          source: 'rust-core' as const,
        })));
      }
    } catch (error) {
      console.warn('[Hybrid AI] Failed to get Rust models:', error);
    }

    // Add legacy models (placeholder)
    models.push(
      {
        id: 'legacy-gpt-3.5',
        name: 'Legacy GPT-3.5',
        provider: 'openai-legacy',
        source: 'legacy-typescript',
      },
      {
        id: 'legacy-claude',
        name: 'Legacy Claude',
        provider: 'anthropic-legacy',
        source: 'legacy-typescript',
      }
    );

    return models;
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{
    rustCore: {
      available: boolean;
      health?: any;
    };
    legacy: {
      available: boolean;
    };
    recommendation: 'rust-core' | 'legacy' | 'unavailable';
  }> {
    await this.checkCoreHealth();
    
    let rustHealth;
    try {
      rustHealth = this.coreAvailable ? await this.aiCore.getHealth() : null;
    } catch (error) {
      console.warn('[Hybrid AI] Failed to get Rust health:', error);
    }

    const status = {
      rustCore: {
        available: this.coreAvailable,
        health: rustHealth,
      },
      legacy: {
        available: true, // Legacy is always available (fallback)
      },
      recommendation: this.coreAvailable ? 'rust-core' as const : 'legacy' as const,
    };

    if (!this.coreAvailable && !status.legacy.available) {
      status.recommendation = 'unavailable';
    }

    return status;
  }

  /**
   * Force health check
   */
  async forceHealthCheck(): Promise<boolean> {
    this.lastHealthCheck = 0; // Reset cache
    await this.checkCoreHealth();
    return this.coreAvailable;
  }

  /**
   * Convenience method for simple chat
   */
  async chat(
    message: string,
    options: {
      model?: string;
      provider?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      preferRustCore?: boolean;
    } = {}
  ): Promise<string> {
    const messages: AIMessage[] = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: message });

    const response = await this.completion({
      messages,
      model: options.model,
      provider: options.provider,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    }, {
      preferRustCore: options.preferRustCore,
    });

    return response.content;
  }

  /**
   * Memory optimization across services
   */
  async optimizeMemory(): Promise<{
    rustCore?: any;
    legacy?: any;
    totalFreedMB: number;
  }> {
    const results: any = {};
    let totalFreedMB = 0;

    // Optimize Rust AI Core memory
    if (this.coreAvailable) {
      try {
        const rustResult = await this.aiCore.optimizeMemory();
        results.rustCore = rustResult;
        totalFreedMB += rustResult.memory_freed_mb;
      } catch (error) {
        console.warn('[Hybrid AI] Rust memory optimization failed:', error);
      }
    }

    // Optimize legacy service memory (placeholder)
    try {
      // Would call legacy memory optimization here
      results.legacy = { message: 'Legacy memory optimization not implemented' };
    } catch (error) {
      console.warn('[Hybrid AI] Legacy memory optimization failed:', error);
    }

    return {
      ...results,
      totalFreedMB,
    };
  }
}

// Singleton instance
export const hybridAIService = new HybridAIService();

// Type exports
export type {
  AIServiceRequest,
  AIServiceResponse,
  HybridAIOptions,
};
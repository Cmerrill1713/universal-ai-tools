/**
 * Universal LLM Service - Internal Model Routing
 * Routes internal model requests to external LLM providers
 * Replaces mock agents with actual AI capabilities
 */

import { CircuitBreakerRegistry, createCircuitBreaker } from '@/utils/circuit-breaker';
import { isAllowedHost, normalizeHttpUrl } from '@/utils/url-security';

import { config } from '../config/environment.js';
import { ModelConfig } from '../config/models.js';
import { log, LogContext } from '../utils/logger.js';
const fetchApi = (globalThis as any).fetch?.bind(globalThis) as typeof globalThis.fetch;

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaStreamResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaService {
  private baseUrl: string;
  private defaultModel: string = 'tinyllama:latest'; // Use fast local model
  private isAvailable = false;
  private breaker = createCircuitBreaker('ollama', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,
    volumeThreshold: 5,
    errorThresholdPercentage: 50,
    rollingWindow: 30000,
  });

  constructor() {
    // Normalize and validate base URL
    const base = config.llm.ollamaUrl || 'http://localhost:11434';
    try {
      const normalized = normalizeHttpUrl(base);
      if (!normalized) throw new Error('Unsupported protocol');
      if (!isAllowedHost(normalized, 'ALLOWED_LLM_HOSTS')) {
        throw new Error('Host not allowed');
      }
      this.baseUrl = normalized;
    } catch (e) {
      log.error('Invalid OLLAMA_URL, falling back to localhost:11434', LogContext.AI, {
        error: e instanceof Error ? e.message : String(e),
      });
      this.baseUrl = 'http://localhost:11434';
    }
    this.checkAvailability();
    CircuitBreakerRegistry.register('ollama', this.breaker);
  }

  private async checkAvailability(): Promise<void> {
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

        // Check if default model is available - prefer fast models
        const models = data.models || [];
        log.info(`Available Ollama models:`, LogContext.AI, { 
          models: models.map((m: any) => m.name) 
        });
        
        const preferred =
          models.find((m: any) => m.name === 'tinyllama:latest') ||  // Ultra fast 1.1B
          models.find((m: any) => m.name === 'llama3.2:1b') ||  // Fastest
          models.find((m: any) => m.name === 'llama3.2:3b') ||  // Fast
          models.find((m: any) => m.name === 'phi3:mini') ||  // Very fast
          models.find((m: any) => m.name.includes('mistral')) ||  // Good balance
          models.find((m: any) => m.name.includes('qwen')) ||  // Good for code
          models.find((m: any) => !m.name.includes('embed') && !m.name.includes('vision')) ||
          models[0];
        if (preferred?.name) {
          this.defaultModel = preferred.name;
          log.info(`Selected model for chat: ${this.defaultModel}`, LogContext.AI);
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.isAvailable = false;
      log.error('❌ Ollama service unavailable', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        baseUrl: this.baseUrl,
      });
    }
  }

  public async generateResponse(
    messages: OllamaMessage[],
    model?: string,
    options?: {
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    }
  ): Promise<OllamaResponse> {
    if (!this.isAvailable) {
      await this.checkAvailability();
      if (!this.isAvailable) {
        // Attempt a best-effort call anyway; Ollama may be starting but responsive
        log.warn('Ollama marked unavailable; attempting request anyway', LogContext.AI);
      }
    }

    const requestBody = {
      model: model || this.defaultModel,
      messages,
      stream: options?.stream || false,
      options: {
        // Optimized for speed with reasonable quality
        temperature: options?.temperature ?? 0.3,
        num_predict: options?.max_tokens ?? 256,  // Reasonable default
        top_k: 10,  // Reduced for speed
        top_p: 0.7,  // More focused generation
        repeat_penalty: 1.1,
        num_ctx: 2048,  // Smaller context for speed
        num_thread: 8,  // Use multiple threads
        keep_alive: '5m',
      },
    };

    try {
      const startTime = Date.now();
      const response = await this.breaker.execute(async () =>
        fetchApi(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
      );

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();
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
    } catch (error) {
      log.error('❌ Ollama generation failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        model: model || this.defaultModel,
      });
      throw error;
    }
  }

  /**
   * Generate response using the /api/generate endpoint for simple prompts
   * Useful for compatibility with existing code that expects this interface
   */
  public async generateSimpleResponse(params: {
    model: string;
    prompt: string;
    options?: {
      temperature?: number;
      num_predict?: number;
      format?: string;
    };
  }): Promise<{
    response: string;
    model: string;
    eval_count?: number;
    eval_duration?: number;
    total_duration?: number;
  }> {
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
      const response = await this.breaker.execute(async () =>
        fetchApi(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
      );

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
    } catch (error) {
      log.error('❌ Ollama generation failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        model: params.model,
      });
      throw error;
    }
  }

  public async generateStreamResponse(
    messages: OllamaMessage[],
    model?: string,
    onChunk?: (chunk: OllamaStreamResponse) => void
  ): Promise<string> {
    if (!this.isAvailable) {
      throw new Error('Ollama service is not available');
    }

    const requestBody = {
      model: model || this.defaultModel,
      messages,
      stream: true,
    };

    try {
      const response = await this.breaker.execute(async () =>
        fetchApi(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
      );

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
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const parsed: OllamaStreamResponse = JSON.parse(line);
            if (parsed.message?.content) {
              fullResponse += parsed.message.content;
              onChunk?.(parsed);
            }
            if (parsed.done) {
              return fullResponse;
            }
          } catch (parseError) {
            // Ignore malformed JSON chunks
          }
        }
      }

      return fullResponse;
    } catch (error) {
      log.error('❌ Ollama streaming failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.breaker.execute(async () => fetchApi(`${this.baseUrl}/api/tags`));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      log.error('❌ Failed to fetch Ollama models', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  public isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  public getDefaultModel(): string {
    return this.defaultModel;
  }

  public async pullModel(modelName: string): Promise<void> {
    try {
      log.info(`🔄 Pulling Ollama model: ${modelName}`, LogContext.AI);

      const response = await this.breaker.execute(async () =>
        fetchApi(`${this.baseUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelName }),
        })
      );

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }

      log.info(`✅ Model pulled successfully: ${modelName}`, LogContext.AI);
    } catch (error) {
      log.error(`❌ Failed to pull model: ${modelName}`, LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
export const ollamaService = new OllamaService();
export default ollamaService;

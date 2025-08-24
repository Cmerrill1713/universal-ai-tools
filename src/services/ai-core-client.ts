/**
 * AI Core Client - TypeScript client for Rust AI Core service
 * Provides seamless integration between TypeScript backend and Rust AI processing
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventSource } from 'eventsource';

interface AIMessage {
  role: string;
  content: string;
}

interface CompletionRequest {
  model?: string;
  messages: AIMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  provider?: string;
}

interface CompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: AIMessage;
    index: number;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  provider: string;
  processing_time_ms: number;
  cached: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  context_length: number;
  pricing: {
    input_cost_per_1k: number;
    output_cost_per_1k: number;
  };
  capabilities: string[];
  status: string;
}

interface HealthResponse {
  status: string;
  version: string;
  uptime_seconds: number;
  models_loaded: number;
  providers_active: number;
  memory_usage_mb: number;
}

interface MemoryOptimizationResult {
  memory_freed_mb: number;
  duration_ms: number;
  operations_performed: string[];
  memory_before_mb: number;
  memory_after_mb: number;
  optimization_level: string;
}

export class AICoreClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8003') {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 300000, // 5 minutes for long AI requests
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[AI Core] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[AI Core] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[AI Core] Response ${response.status} in ${response.headers['x-response-time'] || 'unknown'}ms`);
        return response;
      },
      (error) => {
        console.error('[AI Core] Response error:', error.response?.status, error.response?.data);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<HealthResponse> {
    try {
      const response: AxiosResponse<HealthResponse> = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('[AI Core] Health check failed:', error);
      throw new Error(`AI Core health check failed: ${error}`);
    }
  }

  /**
   * Generate AI completion
   */
  async completion(request: CompletionRequest): Promise<CompletionResponse> {
    try {
      const response: AxiosResponse<CompletionResponse> = await this.client.post(
        '/v1/chat/completions',
        {
          ...request,
          stream: false, // Force non-streaming for this method
        }
      );
      return response.data;
    } catch (error) {
      console.error('[AI Core] Completion failed:', error);
      throw new Error(`AI completion failed: ${error}`);
    }
  }

  /**
   * Generate streaming AI completion
   */
  async streamCompletion(
    request: CompletionRequest,
    onChunk: (chunk: string) => void,
    onComplete?: (response: CompletionResponse) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const eventSource = new EventSource(`${this.baseUrl}/v1/chat/completions/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          stream: true,
        }),
      });

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.delta) {
            onChunk(data.delta);
          }
          if (data.finish_reason && onComplete) {
            onComplete(data);
          }
        } catch (parseError) {
          console.error('[AI Core] Failed to parse streaming response:', parseError);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[AI Core] Streaming error:', error);
        eventSource.close();
        if (onError) {
          onError(new Error('Streaming connection failed'));
        }
      };
    } catch (error) {
      console.error('[AI Core] Stream setup failed:', error);
      if (onError) {
        onError(new Error(`Stream setup failed: ${error}`));
      }
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<ModelInfo[]> {
    try {
      const response: AxiosResponse<ModelInfo[]> = await this.client.get('/v1/models');
      return response.data;
    } catch (error) {
      console.error('[AI Core] Failed to get models:', error);
      throw new Error(`Failed to get models: ${error}`);
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(modelId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v1/models/${modelId}/metrics`);
      return response.data;
    } catch (error) {
      console.error(`[AI Core] Failed to get metrics for model ${modelId}:`, error);
      throw new Error(`Failed to get model metrics: ${error}`);
    }
  }

  /**
   * Trigger memory optimization
   */
  async optimizeMemory(): Promise<MemoryOptimizationResult> {
    try {
      const response: AxiosResponse<MemoryOptimizationResult> = await this.client.post('/memory/optimize');
      return response.data;
    } catch (error) {
      console.error('[AI Core] Memory optimization failed:', error);
      throw new Error(`Memory optimization failed: ${error}`);
    }
  }

  /**
   * Get Prometheus metrics
   */
  async getMetrics(): Promise<string> {
    try {
      const response = await this.client.get('/metrics', {
        headers: { 'Accept': 'text/plain' },
      });
      return response.data;
    } catch (error) {
      console.error('[AI Core] Failed to get metrics:', error);
      throw new Error(`Failed to get metrics: ${error}`);
    }
  }

  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getHealth();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for service to be ready
   */
  async waitForReady(maxAttempts: number = 30, delayMs: number = 1000): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (await this.isAvailable()) {
          console.log(`[AI Core] Service ready after ${attempt} attempts`);
          return true;
        }
      } catch (error) {
        console.log(`[AI Core] Attempt ${attempt}/${maxAttempts} failed, retrying...`);
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.error(`[AI Core] Service not ready after ${maxAttempts} attempts`);
    return false;
  }

  /**
   * Create a simplified chat completion (convenience method)
   */
  async chat(
    message: string,
    options: {
      model?: string;
      provider?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    const messages: AIMessage[] = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: message });

    const response = await this.completion({
      model: options.model || 'gpt-3.5-turbo',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      provider: options.provider,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Create a streaming chat completion (convenience method)
   */
  async streamChat(
    message: string,
    onChunk: (chunk: string) => void,
    options: {
      model?: string;
      provider?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<void> {
    const messages: AIMessage[] = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: message });

    await this.streamCompletion({
      model: options.model || 'gpt-3.5-turbo',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
      provider: options.provider,
    }, onChunk);
  }
}

// Singleton instance for easy access
export const aiCoreClient = new AICoreClient();

// Health check helper
export async function ensureAICoreAvailable(): Promise<boolean> {
  const available = await aiCoreClient.isAvailable();
  if (!available) {
    console.warn('[AI Core] Service not available, falling back to legacy processing');
  }
  return available;
}

// Type exports for consumers
export type {
  AIMessage,
  CompletionRequest,
  CompletionResponse,
  ModelInfo,
  HealthResponse,
  MemoryOptimizationResult,
};
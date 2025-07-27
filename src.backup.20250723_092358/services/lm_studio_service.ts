import { logger } from '../utils/logger';
import fetch from 'node-fetch';

/**
 * LM Studio Service
 * Integrates with LM Studio's local API for running LLMs
 * LM Studio provides an OpenAI-compatible API at http://localhost:1234/v1
 */
export class LMStudioService {
  private baseUrl: string;
  private isAvailable = false;
  private currentModel: string | null = null;
  private models: string[] = [];

  constructor(baseUrl = 'http://localhost:1234/v1') {
    this.baseUrl = baseUrl;
    this.checkAvailability();
  }

  /**
   * Check if LM Studio is running
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        this.models = data.data?.map((m: any) => m.id) || [];
        this.currentModel = this.models[0] || null;
        this.isAvailable = true;
        logger.info(`✅ LM Studio available with ${this.models.length} models`);
        return true;
      }
    } catch (error) {
      logger.warn(
        'LM Studio not available:',
        error instanceof Error ? error.message : String(_error
      );
    }

    this.isAvailable = false;
    return false;
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    if (!this.isAvailable) {
      await this.checkAvailability();
    }
    return this.models;
  }

  /**
   * Generate completion using LM Studio
   */
  async generateCompletion(params: {
    prompt?: string;
    messages?: Array<{ role: string; content string }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    stop?: string[];
  }): Promise<unknown> {
    if (!this.isAvailable) {
      throw new Error('LM Studio is not available');
    }

    const model = params.model || this.currentModel;
    if (!model) {
      throw new Error('No model selected in LM Studio');
    }

    try {
      // LM Studio supports both completion and chat endpoints
      const endpoint = params.messages ? '/chat/completions' : '/completions';

      const body: any = {
        model,
        temperature: params.temperature || 0.7,
        max_tokens: params.max_tokens || 2000,
        stream: params.stream || false,
        stop: params.stop,
      };

      if (params.messages) {
        body.messages = params.messages;
      } else {
        body.prompt = params.prompt;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`LM Studio _error ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      // Normalize response format
      if (endpoint === '/chat/completions') {
        return {
          content data.choices[0].message.content
          model: data.model,
          usage: data.usage,
        };
      } else {
        return {
          content data.choices[0].text,
          model: data.model,
          usage: data.usage,
        };
      }
    } catch (error) {
      logger.error('LM Studio generation _error', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using LM Studio
   */
  async generateEmbedding(input string | string[]): Promise<number[][]> {
    if (!this.isAvailable) {
      throw new Error('LM Studio is not available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _input
          model: this.currentModel,
        }),
      });

      if (!response.ok) {
        throw new Error(`LM Studio embedding _error ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.data.map((d: any) => d.embedding);
    } catch (error) {
      logger.error('LM Studio embedding _error', error);
      throw error;
    }
  }

  /**
   * Stream completion from LM Studio
   */
  async streamCompletion(params: {
    prompt?: string;
    messages?: Array<{ role: string; content string }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    onToken?: (token: string) => void;
    onComplete?: (full: string) => void;
  }): Promise<void> {
    if (!this.isAvailable) {
      throw new Error('LM Studio is not available');
    }

    const endpoint = params.messages ? '/chat/completions' : '/completions';
    const body: any = {
      model: params.model || this.currentModel,
      temperature: params.temperature || 0.7,
      max_tokens: params.max_tokens || 2000,
      stream: true,
    };

    if (params.messages) {
      body.messages = params.messages;
    } else {
      body.prompt = params.prompt;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LM Studio _error ${response.statusText}`);
    }

    const responseBody = response.body as ReadableStream<Uint8Array> | null;
    const reader = responseBody?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            if (params.onComplete) {
              params.onComplete(fullResponse);
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices[0]?.delta?.content|| parsed.choices[0]?.text || '';
            if (token) {
              fullResponse += token;
              if (params.onToken) {
                params.onToken(token);
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelId?: string): Promise<unknown> {
    const model = modelId || this.currentModel;
    if (!model) throw new Error('No model specified');

    // LM Studio doesn't have a specific endpoint for model info
    // Return what we know
    return {
      id: model,
      name: model,
      available: this.models.includes(model),
      type: 'local',
      provider: 'lm-studio',
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    models: string[];
    currentModel: string | null;
    latency: number;
  }> {
    const start = Date.now();
    const available = await this.checkAvailability();
    const latency = Date.now() - start;

    return {
      status: available ? 'healthy' : 'unhealthy',
      models: this.models,
      currentModel: this.currentModel,
      latency,
    };
  }
}

// Singleton instance
let lmStudioInstance: LMStudioService | null = null;

export function getLMStudioService(): LMStudioService {
  if (!lmStudioInstance) {
    lmStudioInstance = new LMStudioService();
  }
  return lmStudioInstance;
}

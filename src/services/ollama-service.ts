/**
 * Universal LLM Service - Internal Model Routing
 * Routes internal model requests to external LLM providers
 * Replaces mock agents with actual AI capabilities
 */

import { config } from '@/config/environment';
import { LogContext, log } from '@/utils/logger';
import { ModelConfig } from '@/config/models';

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
  private defaultModel:   string = ModelConfig.text.small;
  private isAvailable = false;

  constructor() {
    this.baseUrl = config.llm.ollamaUrl || 'http://localhost:11434';
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
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

        // Check if default model is available
        const models = data.models || [];
        const hasDefaultModel = models.some((m: any) => m.name.includes('llama3.2'));
        if (!hasDefaultModel && models.length > 0) {
          // Find a suitable chat model (not embedding models)
          const chatModel = models.find((m: any) => 
            !m.name.includes('embed') && 
            !m.name.includes('minilm') &&
            (m.name.includes('llama') || m.name.includes('gemma') || m.name.includes('qwen'))
          );
          if (chatModel) {
            this.defaultModel = chatModel.name;
            log.info(`Using available chat model: ${this.defaultModel}`, LogContext.AI);
          }
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
      throw new Error('Ollama service is not available');
    }

    const       requestBody = {
        model: model || this.defaultModel,
        messages,
        stream: options?.stream || false,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.max_tokens || 500,
        },
      };

    try {
      const         startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

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
        temperature: params.options?.temperature || 0.7,
        num_predict: params.options?.num_predict || 500,
      },
      ...(params.options?.format && { format: params.options.format }),
    };

    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

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

  public async generateEmbedding(
    text: string,
    options: {
      model?: string;
      options?: Record<string, any>;
    } = {}
  ): Promise<{ embedding: number[] }> {
    if (!this.isAvailable) {
      throw new Error('Ollama service is not available');
    }

    const model = options.model || 'nomic-embed-text';
    const requestBody = {
      model,
      prompt: text,
      ...options.options
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama embeddings API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return { embedding: data.embedding };
    } catch (error) {
      log.error('❌ Ollama embedding generation failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
        model,
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

    const       requestBody = {
        model: model || this.defaultModel,
        messages,
        stream: true,
      };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

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
      const         response = await fetch(`${this.baseUrl}/api/tags`);
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

  public async listModels(): Promise<Array<{ name: string; size: number; modified_at: string }>> {
    if (!this.isAvailable) {
      throw new Error('Ollama service is not available');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      log.error('❌ Failed to list Ollama models', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async pullModel(modelName: string): Promise<void> {
    try {
      log.info(`🔄 Pulling Ollama model: ${modelName}`, LogContext.AI);

      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });

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

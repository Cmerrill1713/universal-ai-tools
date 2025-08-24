/**
 * Ollama Local LLM Service
 * Provides offline AI capabilities using Ollama
 * Memory-efficient implementation for local-only operation
 */

import { logger } from '../utils/logger';

interface OllamaConfig {
  baseUrl: string;
  model: string;
  embeddingModel: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GenerateOptions {
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface OllamaResponse {
  message: {
    content: string;
  };
  model: string;
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
}

class OllamaService {
  private config: OllamaConfig;
  private isAvailable: boolean = false;

  constructor() {
    this.config = {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
      embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
      maxTokens: 2048,
      temperature: 0.7,
      timeout: 30000
    };

    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      this.isAvailable = response.ok;
      
      if (this.isAvailable) {
        logger.info('✅ Ollama service connected', { 
          context: 'ollama',
          baseUrl: this.config.baseUrl 
        });
      }
    } catch (error: any) {
      this.isAvailable = false;
      logger.warn('⚠️ Ollama service not available', { 
        context: 'ollama',
        error: error.message 
      });
    }
  }

  async generate(options: GenerateOptions): Promise<string> {
    if (!this.isAvailable) {
      throw new Error('Ollama service not available');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages: options.messages,
          stream: false,
          options: {
            temperature: options.temperature || this.config.temperature,
            num_predict: options.max_tokens || this.config.maxTokens
          }
        })
      });

      const data = await response.json();
      return data.message?.content || '';
    } catch (error: any) {
      logger.error('Ollama generation failed', { 
        context: 'ollama',
        error: error.message 
      });
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isAvailable) {
      throw new Error('Ollama service not available');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.embeddingModel,
          prompt: text
        })
      });

      const data = await response.json();
      return data.embedding || [];
    } catch (error: any) {
      logger.error('Ollama embedding generation failed', { 
        context: 'ollama',
        error: error.message 
      });
      throw error;
    }
  }

  async getHealth() {
    return {
      status: this.isAvailable ? 'healthy' : 'unhealthy',
      available: this.isAvailable,
      model: this.config.model
    };
  }

  /**
   * Generate response using chat completion
   * @deprecated Use generate() instead
   */
  async generateResponse(messages: ChatMessage[], temperature?: number, maxTokens?: number): Promise<OllamaResponse> {
    if (!this.isAvailable) {
      throw new Error('Ollama service not available');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: false,
          options: {
            temperature: temperature || this.config.temperature,
            num_predict: maxTokens || this.config.maxTokens
          }
        })
      });

      const data = await response.json();
      return {
        message: {
          content: data.message?.content || ''
        },
        model: data.model || this.config.model,
        response: data.message?.content || '',
        prompt_eval_count: data.prompt_eval_count,
        eval_count: data.eval_count
      };
    } catch (error: any) {
      logger.error('Ollama generation failed', { 
        context: 'ollama',
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Generate simple response with single message
   * @deprecated Use generate() instead
   */
  async generateSimpleResponse(prompt: string): Promise<OllamaResponse> {
    if (!this.isAvailable) {
      throw new Error('Ollama service not available');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false,
          options: {
            temperature: this.config.temperature,
            num_predict: this.config.maxTokens
          }
        })
      });

      const data = await response.json();
      return {
        message: {
          content: data.response || ''
        },
        model: data.model || this.config.model,
        response: data.response || '',
        prompt_eval_count: data.prompt_eval_count,
        eval_count: data.eval_count
      };
    } catch (error: any) {
      logger.error('Ollama simple generation failed', { 
        context: 'ollama',
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get list of available models
   */
  async getAvailableModels(): Promise<string[]> {
    if (!this.isAvailable) {
      return [];
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error: any) {
      logger.warn('Failed to get available models', { 
        context: 'ollama',
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Check if service is available
   */
  async isServiceAvailable(): Promise<boolean> {
    await this.checkAvailability();
    return this.isAvailable;
  }

  /**
   * Get default model name
   */
  getDefaultModel(): string {
    return this.config.model;
  }
}

export const ollamaService = new OllamaService();
export type { ChatMessage, GenerateOptions, OllamaResponse };
export { OllamaService };

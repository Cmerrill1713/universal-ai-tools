/**
 * HuggingFace to LM Studio Adapter
 * Routes HuggingFace-style requests to LM Studio's OpenAI-compatible API
 */

import { LogContext, log } from '../utils/logger';
import { ModelConfig } from '../config/models';

interface LMStudioRequest {
  model: string;
  messages?: Array<{ role: string; content: string }>;
  prompt?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface LMStudioResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: { role: string; content: string };
    text?: string;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class HuggingFaceToLMStudioAdapter {
  private baseUrl: string;

  constructor() {
    this.baseUrl = ModelConfig.lmStudio.url;
  }

  /**
   * Text generation - maps to LM Studio chat completions
   */
  async generateText(request: {
    inputs: string;
    parameters?: {
      max_new_tokens?: number;
      temperature?: number;
      top_p?: number;
      do_sample?: boolean;
    };
    model?: string;
  }): Promise<any> {
    const lmStudioRequest: // TODO: Refactor nested ternary
    LMStudioRequest = {
      model: request.model || ModelConfig.lmStudio.models.textGeneration,
      messages: [{ role: 'user', content: request.inputs }],
      temperature: request.parameters?.temperature || 0.7,
      max_tokens: request.parameters?.max_new_tokens || 500,
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lmStudioRequest),
      });

      if (!response.ok) {
        throw new Error(`LM Studio error: ${response.statusText}`);
      }

      const data: LMStudioResponse = await response.json();

      // Convert to HuggingFace format
      return [
        {
          generated_text: data.choices[0]?.message?.content || data.choices[0]?.text || '',
        },
      ];
    } catch (error) {
      log.error('LM Studio text generation failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Embeddings - maps to LM Studio embeddings endpoint
   */
  async generateEmbeddings(request: { inputs: string | string[]; model?: string }): Promise<any> {
    const input = Array.isArray(request.inputs) ? request.inputs : [request.inputs];

    try {
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model || ModelConfig.lmStudio.models.embedding,
          input,
        }),
      });

      if (!response.ok) {
        throw new Error(`LM Studio error: ${response.statusText}`);
      }

      const data = await response.json();

      // Convert to HuggingFace format
      return data.data.map((item: unknown) => item.embedding);
    } catch (error) {
      log.error('LM Studio embedding generation failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Summarization - uses chat completion with specific prompt
   */
  async summarizeText(request: {
    inputs: string;
    parameters?: {
      max_length?: number;
      min_length?: number;
      temperature?: number;
    };
    model?: string;
  }): Promise<any> {
    const // TODO: Refactor nested ternary
      prompt = `Please summarize the following text concisely:\n\n${request.inputs}\n\nSummary:`;

    const lmStudioRequest: LMStudioRequest = {
      model: request.model || ModelConfig.lmStudio.models.summarization,
      messages: [{ role: 'user', content: prompt }],
      temperature: request.parameters?.temperature || 0.5,
      max_tokens: request.parameters?.max_length || 200,
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lmStudioRequest),
      });

      if (!response.ok) {
        throw new Error(`LM Studio error: ${response.statusText}`);
      }

      const data: LMStudioResponse = await response.json();

      // Convert to HuggingFace format
      return [
        {
          summary_text: data.choices[0]?.message?.content || '',
        },
      ];
    } catch (error) {
      log.error('LM Studio summarization failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Sentiment analysis - uses chat completion with specific prompt
   */
  async analyzeSentiment(text: string, model?: string): Promise<any> {
    const // TODO: Refactor nested ternary
      prompt = `Analyze the sentiment of the following text and respond with only one word: POSITIVE, NEGATIVE, or NEUTRAL.\n\nText: "${text}"\n\nSentiment:`;

    const lmStudioRequest: LMStudioRequest = {
      model: model || ModelConfig.lmStudio.models.sentiment,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lmStudioRequest),
      });

      if (!response.ok) {
        throw new Error(`LM Studio error: ${response.statusText}`);
      }

      const data: LMStudioResponse = await response.json();
      const sentiment = (data.choices[0]?.message?.content || '').trim().toUpperCase();

      // Convert to HuggingFace format with scores
      const scores = {
        POSITIVE: sentiment === 'POSITIVE' ? 0.9 : 0.05,
        NEGATIVE: sentiment === 'NEGATIVE' ? 0.9 : 0.05,
        NEUTRAL: sentiment === 'NEUTRAL' ? 0.9 : 0.05,
      };

      return [
        {
          label: sentiment,
          score: scores[sentiment as keyof typeof scores] || 0.33,
        },
      ];
    } catch (error) {
      log.error('LM Studio sentiment analysis failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Question answering - uses chat completion with context
   */
  async answerQuestion(request: {
    question: string;
    context: string;
    model?: string;
  }): Promise<any> {
    const // TODO: Refactor nested ternary
      prompt = `Based on the following context, answer the question.\n\nContext: ${request.context}\n\nQuestion: ${request.question}\n\nAnswer:`;

    const lmStudioRequest: LMStudioRequest = {
      model: request.model || ModelConfig.lmStudio.models.textGeneration,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    };

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lmStudioRequest),
      });

      if (!response.ok) {
        throw new Error(`LM Studio error: ${response.statusText}`);
      }

      const data: LMStudioResponse = await response.json();

      // Convert to HuggingFace format
      return {
        answer: data.choices[0]?.message?.content || '',
        score: 0.85, // Confidence score
        start: 0,
        end: request.context.length,
      };
    } catch (error) {
      log.error('LM Studio question answering failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Check if LM Studio is available
   */
  async healthCheck(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`LM Studio not available: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        status: 'healthy',
        models: data.data?.map((m: unknown) => m.id) || [],
        baseUrl: this.baseUrl,
        adapter: 'huggingface-to-lmstudio',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        baseUrl: this.baseUrl,
        adapter: 'huggingface-to-lmstudio',
      };
    }
  }

  /**
   * Get metrics (mock implementation)
   */
  getMetrics() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 100,
      modelsUsed: new Set(['lm-studio']),
      lastRequestTime: Date.now(),
    };
  }

  /**
   * List available models from LM Studio
   */
  async listModels(): Promise<string[]> {
    try {
      const // TODO: Refactor nested ternary
        response = await fetch(`${this.baseUrl}/v1/models`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data?.map((m: unknown) => m.id) || [];
    } catch (error) {
      log.error('Failed to list LM Studio models', LogContext.AI, { error });
      return [];
    }
  }
}

// Export singleton instance that replaces HuggingFace service
export const huggingFaceService = ModelConfig.lmStudio.enabled
  ? new HuggingFaceToLMStudioAdapter()
  : null;

log.info(
  huggingFaceService
    ? '✅ HuggingFace requests will be routed to LM Studio'
    : '⚠️ LM Studio disabled, HuggingFace functionality unavailable',
  LogContext.AI
);

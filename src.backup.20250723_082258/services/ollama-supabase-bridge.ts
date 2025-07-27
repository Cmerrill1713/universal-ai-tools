/* eslint-disable no-undef */
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

interface OllamaRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  system?: string;
}

interface OllamaResponse {
  response: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamChunk {
  _content string;
  done: boolean;
}

export class OllamaSupabaseBridge {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseAnonKey || ''
    );
  }

  /**
   * Send a prompt to Ollama via Supabase Edge Function
   */
  async generate(_request OllamaRequest): Promise<OllamaResponse> {
    try {
      const { data, _error} = await this.supabase.functions.invoke('ollama-assistant', {
        body: {
          prompt: _requestprompt,
          model: _requestmodel || 'llama3.2:3b',
          temperature: _requesttemperature || 0.7,
          max_tokens: _requestmax_tokens || 1000,
          stream: false,
          system: _requestsystem || 'You are a helpful AI assistant.',
        },
      });

      if (_error {
        throw new Error(`Supabase function _error ${_errormessage}`);
      }

      return data as OllamaResponse;
    } catch (_error) {
      console._error'Error calling Ollama via Supabase:', _error;
      throw _error;
    }
  }

  /**
   * Stream a response from Ollama via Supabase Edge Function
   */
  async *generateStream(_request OllamaRequest): AsyncGenerator<string> {
    try {
      const response = await fetch(`${config.database.supabaseUrl}/functions/v1/ollama-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.database.supabaseAnonKey}`,
          apikey: config.database.supabaseAnonKey || '',
        },
        body: JSON.stringify({
          prompt: _requestprompt,
          model: _requestmodel || 'llama3.2:3b',
          temperature: _requesttemperature || 0.7,
          max_tokens: _requestmax_tokens || 1000,
          stream: true,
          system: _requestsystem || 'You are a helpful AI assistant.',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP _error status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Process all complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamChunk;
              if (!data.done && data._content {
                yield data._content
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }

        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];
      }
    } catch (_error) {
      console._error'Error streaming from Ollama via Supabase:', _error;
      throw _error;
    }
  }

  /**
   * Get available models from Ollama
   */
  async listModels(): Promise<string[]> {
    // For now, return a static list of commonly used models
    // In a real implementation, you might want to create another Edge Function
    // that queries the Ollama API for available models
    return [
      'llama3.2:3b',
      'llama3.2:1b',
      'mistral:7b',
      'gemma:2b',
      'phi:2.7b-chat-v2-q4_0',
      'qwen:0.5b',
    ];
  }

  /**
   * Health check for the Ollama service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generate({
        prompt: 'Hello',
        max_tokens: 10,
      });
      return !!response.response;
    } catch (_error) {
      console._error'Ollama health check failed:', _error;
      return false;
    }
  }
}

// Export a singleton instance
export const ollamaSupabase = new OllamaSupabaseBridge();

/**
 * Ollama Integration Service
 * Real Ollama integration for LLM calls and model management
 */

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    stop?: string[];
    num_predict?: number;
    num_ctx?: number;
    seed?: number;
  };
  context?: number[];
  raw?: boolean;
  keep_alive?: string | number;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
    eval_duration?: number;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    images?: string[];
  }>;
  stream?: boolean;
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    stop?: string[];
    num_predict?: number;
    num_ctx?: number;
    seed?: number;
  };
  keep_alive?: string | number;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    images?: string[];
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_penalty?: number;
    stop?: string[];
    num_predict?: number;
    num_ctx?: number;
    seed?: number;
  };
  keep_alive?: string | number;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

class OllamaIntegrationService {
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;
  private isConnected: boolean = false;

  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_DEFAULT_MODEL || 'llama3.2:3b';
    this.timeout = parseInt(process.env.OLLAMA_TIMEOUT || '30000');
  }

  /**
   * Initialize Ollama service and check connection
   */
  async initialize(): Promise<void> {
    try {
      console.log('🦙 Initializing Ollama integration...');

      // Test connection to Ollama
      await this.checkConnection();

      // Ensure default model is available
      await this.ensureDefaultModel();

      this.isConnected = true;
      console.log('✅ Ollama integration initialized successfully');

    } catch (error) {
      console.error('❌ Ollama initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check connection to Ollama service
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout)
      });

      if (response.ok) {
        console.log('✅ Ollama service is running');
        return true;
      } else {
        throw new Error(`Ollama service returned ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Cannot connect to Ollama service:', error);
      throw new Error(`Ollama service not available at ${this.baseUrl}`);
    }
  }

  /**
   * Ensure default model is available
   */
  async ensureDefaultModel(): Promise<void> {
    try {
      const models = await this.listModels();
      const defaultModelExists = models.some(model => model.name === this.defaultModel);

      if (!defaultModelExists) {
        console.log(`📥 Pulling default model: ${this.defaultModel}`);
        await this.pullModel(this.defaultModel);
      } else {
        console.log(`✅ Default model ${this.defaultModel} is available`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not ensure default model: ${error}`);
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      console.log(`📥 Pulling model: ${modelName}`);
      
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName }),
        signal: AbortSignal.timeout(this.timeout * 2) // Longer timeout for pulling
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }

      console.log(`✅ Model ${modelName} pulled successfully`);
    } catch (error) {
      console.error(`Error pulling model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Generate text using Ollama
   */
  async generateText(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          prompt: request.prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            num_predict: 2000,
            num_ctx: 4000,
            ...request.options
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Generate request failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating text:', error);
      throw error;
    }
  }

  /**
   * Chat with Ollama model
   */
  async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          messages: request.messages,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            repeat_penalty: 1.1,
            num_predict: 2000,
            num_ctx: 4000,
            ...request.options
          }
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error chatting:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using Ollama
   */
  async generateEmbeddings(request: OllamaEmbeddingRequest): Promise<OllamaEmbeddingResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model || this.defaultModel,
          prompt: request.prompt,
          options: request.options || {}
        }),
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Embeddings request failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Analyze text for sentiment, intent, and complexity
   */
  async analyzeText(text: string, analysisType: 'sentiment' | 'intent' | 'complexity' | 'all' = 'all'): Promise<any> {
    try {
      const systemPrompts = {
        sentiment: "Analyze the sentiment of the following text. Respond with a JSON object containing 'sentiment' (positive/negative/neutral), 'confidence' (0-1), and 'reasoning'.",
        intent: "Analyze the intent of the following text. Respond with a JSON object containing 'intent' (the main purpose), 'confidence' (0-1), 'entities' (key entities mentioned), and 'reasoning'.",
        complexity: "Analyze the complexity of the following text. Respond with a JSON object containing 'complexity' (low/medium/high), 'confidence' (0-1), 'factors' (what makes it complex), and 'reasoning'.",
        all: "Analyze the following text comprehensively. Respond with a JSON object containing 'sentiment', 'intent', 'complexity', 'confidence' (0-1), 'key_entities', 'main_topics', and 'reasoning'."
      };

      const messages = [
        {
          role: 'system' as const,
          content: systemPrompts[analysisType]
        },
        {
          role: 'user' as const,
          content: text
        }
      ];

      const chatResponse = await this.chat({
        model: this.defaultModel,
        messages,
        options: {
          temperature: 0.3, // Lower temperature for more consistent analysis
          num_predict: 500
        }
      });

      try {
        return JSON.parse(chatResponse.message.content);
      } catch (parseError) {
        // If JSON parsing fails, return the raw content
        return {
          raw_analysis: chatResponse.message.content,
          confidence: 0.5,
          error: 'Could not parse structured response'
        };
      }
    } catch (error) {
      console.error('Error analyzing text:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0
      };
    }
  }

  /**
   * Generate context-aware responses for chat
   */
  async generateChatResponse(
    message: string, 
    context: any[] = [], 
    sessionId: string,
    userId: string
  ): Promise<any> {
    try {
      const systemPrompt = `You are Athena, the central intelligence of Universal AI Tools. You are helpful, intelligent, and context-aware. You can help with:
- Chat and conversation
- Governance and democratic decision-making
- Technical assistance and problem-solving
- Creative tasks and brainstorming
- Analysis and insights

Current session: ${sessionId}
User: ${userId}

Respond naturally and helpfully.`;

      const messages = [
        {
          role: 'system' as const,
          content: systemPrompt
        },
        ...context.map(ctx => ({
          role: 'assistant' as const,
          content: ctx.content || ctx.message || ''
        })),
        {
          role: 'user' as const,
          content: message
        }
      ];

      const chatResponse = await this.chat({
        model: this.defaultModel,
        messages,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 1000
        }
      });

      return {
        success: true,
        response: chatResponse.message.content,
        model: chatResponse.model,
        processingTime: chatResponse.total_duration || 0,
        tokensGenerated: chatResponse.eval_count || 0,
        confidence: 0.8 // Default confidence for chat responses
      };
    } catch (error) {
      console.error('Error generating chat response:', error);
      return {
        success: false,
        response: 'I apologize, but I encountered an error processing your request.',
        error: error instanceof Error ? error.message : 'Unknown error',
        confidence: 0
      };
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    try {
      const models = await this.listModels();
      return {
        connected: this.isConnected,
        baseUrl: this.baseUrl,
        defaultModel: this.defaultModel,
        availableModels: models.length,
        models: models.map(m => ({
          name: m.name,
          size: m.size,
          modified: m.modified_at
        }))
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test the service with a simple request
   */
  async testService(): Promise<boolean> {
    try {
      const response = await this.generateText({
        model: this.defaultModel,
        prompt: 'Hello, this is a test. Please respond with "Test successful".',
        options: {
          num_predict: 10
        }
      });

      return response.done && response.response.includes('Test successful');
    } catch (error) {
      console.error('Ollama service test failed:', error);
      return false;
    }
  }

  /**
   * Shutdown Ollama integration service
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Ollama integration service shutdown');
  }
}

export { 
  OllamaIntegrationService, 
  OllamaModel, 
  OllamaGenerateRequest, 
  OllamaGenerateResponse,
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaEmbeddingRequest,
  OllamaEmbeddingResponse
};
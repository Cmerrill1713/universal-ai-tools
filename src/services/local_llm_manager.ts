import { OllamaService } from './ollama_service';
import { LMStudioService } from './lm_studio_service';
import { logger } from '../utils/logger';

/**
 * Local LLM Manager
 * Manages both Ollama and LM Studio for local LLM inference
 * Automatically selects the best available local option
 */
export class LocalLLMManager {
  private ollama: OllamaService;
  private lmStudio: LMStudioService;
  private preferredService: 'ollama' | 'lm-studio' | null = null;

  constructor() {
    this.ollama = new OllamaService();
    this.lmStudio = new LMStudioService();
    this.initialize();
  }

  private async initialize() {
    // Check which services are available
    const [ollamaHealth, lmStudioHealth] = await Promise.all([
      this.ollama.healthCheck().catch(() => ({ status: 'unhealthy' })),
      this.lmStudio.healthCheck().catch(() => ({ status: 'unhealthy' }))
    ]);

    logger.info('🖥️ Local LLM Status:');
    logger.info(`  - Ollama: ${ollamaHealth.status}`);
    logger.info(`  - LM Studio: ${lmStudioHealth.status}`);

    // Set preferred service based on availability
    if (lmStudioHealth.status === 'healthy') {
      this.preferredService = 'lm-studio';
      logger.info('  ✓ Using LM Studio as primary local LLM');
    } else if (ollamaHealth.status === 'healthy') {
      this.preferredService = 'ollama';
      logger.info('  ✓ Using Ollama as primary local LLM');
    } else {
      logger.warn('  ⚠️ No local LLM services available');
    }
  }

  /**
   * Get available local models from all services
   */
  async getAvailableModels(): Promise<Array<{
    id: string;
    name: string;
    service: 'ollama' | 'lm-studio';
    size?: string;
    quantization?: string;
  }>> {
    const models: any[] = [];

    // Get Ollama models
    try {
      const ollamaModels = await this.ollama.listModels();
      models.push(...ollamaModels.map(m => ({
        id: `ollama:${m.name}`,
        name: m.name,
        service: 'ollama' as const,
        size: m.size,
        quantization: m.details?.quantization_level
      })));
    } catch (error) {
      logger.debug('Could not fetch Ollama models:', error instanceof Error ? error.message : String(error));
    }

    // Get LM Studio models
    try {
      const lmStudioModels = await this.lmStudio.getModels();
      models.push(...lmStudioModels.map(m => ({
        id: `lm-studio:${m}`,
        name: m,
        service: 'lm-studio' as const
      })));
    } catch (error) {
      logger.debug('Could not fetch LM Studio models:', error instanceof Error ? error.message : String(error));
    }

    return models;
  }

  /**
   * Generate completion using the best available local service
   */
  async generate(params: {
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    service?: 'ollama' | 'lm-studio';
    fallback?: boolean;
  }): Promise<{
    content: string;
    model: string;
    service: 'ollama' | 'lm-studio';
    usage?: any;
  }> {
    // Determine which service to use
    let service = params.service || this.preferredService;
    
    if (!service) {
      throw new Error('No local LLM service available');
    }

    // Extract model name if service prefix is included
    let modelName = params.model;
    if (modelName?.includes(':')) {
      const [servicePrefix, name] = modelName.split(':');
      if (servicePrefix === 'ollama' || servicePrefix === 'lm-studio') {
        service = servicePrefix as 'ollama' | 'lm-studio';
        modelName = name;
      }
    }

    try {
      if (service === 'lm-studio') {
        const result = await this.lmStudio.generateCompletion({
          ...params,
          model: modelName
        });
        return {
          ...result,
          service: 'lm-studio'
        };
      } else {
        const result = await this.ollama.generate({
          model: modelName || 'llama2',
          prompt: params.prompt,
          messages: params.messages,
          options: {
            temperature: params.temperature,
            num_predict: params.max_tokens
          }
        });
        return {
          content: result.response,
          model: result.model,
          service: 'ollama',
          usage: {
            prompt_tokens: result.prompt_eval_count,
            completion_tokens: result.eval_count,
            total_tokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
          }
        };
      }
    } catch (error) {
      logger.error(`${service} generation failed:`, error);

      // Try fallback if enabled
      if (params.fallback && !params.service) {
        const fallbackService = service === 'ollama' ? 'lm-studio' : 'ollama';
        logger.info(`Attempting fallback to ${fallbackService}`);
        
        return this.generate({
          ...params,
          service: fallbackService,
          fallback: false // Prevent infinite recursion
        });
      }

      throw error;
    }
  }

  /**
   * Stream completion from local LLM
   */
  async stream(params: {
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    service?: 'ollama' | 'lm-studio';
    onToken?: (token: string) => void;
    onComplete?: (full: string) => void;
  }): Promise<void> {
    const service = params.service || this.preferredService;
    
    if (!service) {
      throw new Error('No local LLM service available');
    }

    if (service === 'lm-studio') {
      await this.lmStudio.streamCompletion(params);
    } else {
      // Implement Ollama streaming
      let fullResponse = '';
      await this.ollama.generate({
        model: params.model || 'llama2',
        prompt: params.prompt,
        messages: params.messages,
        stream: true,
        options: {
          temperature: params.temperature,
          num_predict: params.max_tokens
        }
      }, (chunk) => {
        if (params.onToken) {
          params.onToken(chunk.response);
        }
        fullResponse += chunk.response;
        
        if (chunk.done && params.onComplete) {
          params.onComplete(fullResponse);
        }
      });
    }
  }

  /**
   * Generate embeddings using local models
   */
  async generateEmbedding(input: string | string[], service?: 'ollama' | 'lm-studio'): Promise<number[][]> {
    const selectedService = service || this.preferredService;
    
    if (!selectedService) {
      throw new Error('No local LLM service available');
    }

    if (selectedService === 'lm-studio') {
      return this.lmStudio.generateEmbedding(input);
    } else {
      // Ollama embedding support
      const model = 'nomic-embed-text'; // Or another embedding model
      const inputs = Array.isArray(input) ? input : [input];
      
      const embeddings = await Promise.all(
        inputs.map(async (text) => {
          const result = await this.ollama.embeddings({
            model,
            prompt: text
          });
          return result.embedding;
        })
      );
      
      return embeddings;
    }
  }

  /**
   * Check health of all local services
   */
  async checkHealth(): Promise<{
    ollama: any;
    lmStudio: any;
    preferred: string | null;
    recommendations: string[];
  }> {
    const [ollamaHealth, lmStudioHealth] = await Promise.all([
      this.ollama.healthCheck().catch(err => ({
        status: 'error',
        error: err.message
      })),
      this.lmStudio.healthCheck().catch(err => ({
        status: 'error',
        error: err.message
      }))
    ]);

    const recommendations: string[] = [];

    if (ollamaHealth.status !== 'healthy' && lmStudioHealth.status !== 'healthy') {
      recommendations.push('No local LLM services running. Start Ollama or LM Studio.');
    } else if (ollamaHealth.status === 'healthy' && lmStudioHealth.status === 'healthy') {
      recommendations.push('Both services running. Consider stopping one to save resources.');
    }

    if (lmStudioHealth.status === 'healthy' && 'models' in lmStudioHealth && lmStudioHealth.models.length === 0) {
      recommendations.push('LM Studio running but no models loaded. Load a model in LM Studio.');
    }

    return {
      ollama: ollamaHealth,
      lmStudio: lmStudioHealth,
      preferred: this.preferredService,
      recommendations
    };
  }

  /**
   * Get service-specific features
   */
  getServiceCapabilities(): {
    ollama: string[];
    lmStudio: string[];
  } {
    return {
      ollama: [
        'Multiple model formats (GGUF, GGML)',
        'Built-in model library',
        'Model customization via Modelfile',
        'Automatic model management',
        'CLI integration'
      ],
      lmStudio: [
        'User-friendly GUI',
        'OpenAI-compatible API',
        'Easy model discovery and download',
        'Hardware acceleration settings',
        'Chat interface for testing'
      ]
    };
  }
}

// Export singleton
export const localLLMManager = new LocalLLMManager();
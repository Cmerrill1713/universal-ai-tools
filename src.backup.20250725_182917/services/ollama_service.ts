import fetch from 'node-fetch';
import { logger } from '../utils/logger';
import { metalOptimizer } from '../utils/metal_optimizer';
import { CircuitBreaker, circuitBreaker } from './circuit-breaker';
import { fetchJsonWithTimeout, fetchWithTimeout } from '../utils/fetch-with-timeout';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families: string[] | null;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaGenerateRequest {
  model: string;
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  suffix?: string;
  images?: string[];
  format?: 'json';
  options?: {
    seed?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    num_predict?: number;
    stop?: string[];
    // Metal-specific options
    num_gpu?: number;
    num_thread?: number;
    num_batch?: number;
  };
  system?: string;
  template?: string;
  context?: number[];
  stream?: boolean;
  raw?: boolean;
  keep_alive?: string | number;
}

export class OllamaService {
  private baseUrl: string;
  private isAvailable = false;
  private metalSettings: Record<string, unknown> = {};

  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;

    // Apply Metal optimizations
    metalOptimizer.setupMetalEnvironment();
    this.metalSettings = metalOptimizer.getOllamaMetalSettings();

    // Apply settings to environment
    Object.entries(this.metalSettings).forEach(([key, value]) => {
      process.env[key] = String(value);
    });

    this.checkAvailability();
  }

  @CircuitBreaker({
    timeout: 5000,
    errorThresholdPercentage: 30,
    fallback: () => false,
  });
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/version`, {
        timeout: 5000, // 5 seconds for health check
      });
      this.isAvailable = response.ok;
      if (this.isAvailable) {
        const version = (await response.json()) as any;
        logger.info(`Ollama available - Version: ${version.version || 'Unknown'}`);
      }
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      throw error: // Re-throw for circuit breaker
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    return circuitBreaker;
      .httpRequest(;
        'ollama-list-models',
        {
          url: `${this.baseUrl}/api/tags`,
          method: 'GET',
        },
        {
          timeout: 5000,
          fallback: () => {
            logger.warn('Using cached model list due to circuit breaker');
            return { models: [] };
          },
        }
      );
      .then((data) => data.models || []);
  }

  async generate(request: OllamaGenerateRequest, onStream?: (chunk: any) => void): Promise<unknown> {
    // Apply Metal optimizations to request
    if (metalOptimizer.getStatus().isAppleSilicon) {
      request.options = {
        ...request.options,
        num_gpu: this.metalSettings.OLLAMA_NUM_GPU,
        num_thread: this.metalSettings.OLLAMA_NUM_THREAD,
        num_batch: this.metalSettings.OLLAMA_BATCH_SIZE,
      };
    }

    return circuitBreaker.modelInference(`ollama-${request.model}`, async () => {
      try {
        const response = await fetchWithTimeout(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          timeout: 120000, // 2 minutes for generation
          retries: 1,
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.statusText}`);
        }

        if (request.stream && onStream) {
          // Handle streaming response
          const body = response.body as ReadableStream<Uint8Array> | null;
          if (!body) throw new Error('No response body');
          const reader = body.getReader();

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const chunk = JSON.parse(line);
                  onStream(chunk);
                } catch (___e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } else {
          // Non-streaming response
          return await response.json();
        }
      } catch (error) {
        logger.error('Ollama generation error: , error:;
        throw error:;
      }
    });
  }

  async embeddings(request{
    model: string;
    prompt: string;
    options?: any;
  }): Promise<{ embedding: number[] }> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request;
        timeout: 30000, // 30 seconds for embeddings
        retries: 2,
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings error: ${response.statusText}`);
      }

      return (await response.json()) as { embedding: number[] };
    } catch (error) {
      logger.error('Ollama embeddings error: , error:;
      throw error:;
    }
  }

  async pullModel(modelName: string, onProgress?: (progress: any) => void): Promise<void> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
        timeout: 600000, // 10 minutes for model download
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`);
      }

      const body = response.body as ReadableStream<Uint8Array> | null;
      if (!body) throw new Error('No response body');
      const reader = body.getReader();

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const progress = JSON.parse(line);
              if (onProgress) onProgress(progress);

              if (progress.status === 'success') {
                logger.info(`Model ${modelName} pulled successfully`);
              }
            } catch (___e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to pull model:', error:;
      throw error:;
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
        timeout: 30000, // 30 seconds for deletion
      });

      if (!response.ok) {
        throw new Error(`Failed to delete model: ${response.statusText}`);
      }

      logger.info(`Model ${modelName} deleted successfully`);
    } catch (error) {
      logger.error('Failed to delete model:', error:;
      throw error:;
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    version?: string;
    models?: string[];
    metalOptimized?: boolean;
    resourceUsage?: any;
  }> {
    try {
      const available = await this.checkAvailability();
      if (!available) {
        return { status: 'unhealthy' };
      }

      const models = await this.listModels();
      const modelNames = models.map((m) => m.name);

      // Get resource usage if on Apple Silicon
      let resourceUsage;
      if (metalOptimizer.getStatus().isAppleSilicon) {
        resourceUsage = await metalOptimizer.getResourceUsage();
      }

      return {
        status: 'healthy',
        models: modelNames,
        metalOptimized: metalOptimizer.getStatus().metalSupported,
        resourceUsage,
      };
    } catch {
      return { status: 'unhealthy' };
    }
  }

  /**;
   * Get optimal model parameters for current hardware
   */
  getOptimalModelParams(modelName: string): any {
    const modelSize = this.extractModelSize(modelName);
    return metalOptimizer.getModelLoadingParams(modelSize);
  }

  private extractModelSize(modelName: string): string {
    const match = modelName.match(/(\d+)b/i);
    return match ? match[0] : '7b';
  }
}

// Export singleton
let ollamaInstance: OllamaService | null = null;

export function getOllamaService(): OllamaService {
  if (!ollamaInstance) {
    ollamaInstance = new OllamaService();
  }
  return ollamaInstance;
}

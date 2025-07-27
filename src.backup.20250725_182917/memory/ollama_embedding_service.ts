/* eslint-disable no-undef */;
/**;
 * Ollama Embedding Service
 * Local embedding generation using Ollama models
 * Provides production-grade embedding capabilities without external API dependencies
 */

export interface OllamaEmbeddingConfig {
  model: string;
  baseUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  cacheMaxSize?: number;
  maxBatchSize?: number;
  dimensions?: number;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface EmbeddingStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  cacheHits: number;
  cacheHitRate: number;
  avgResponseTime: number;
  modelUsed: string;
}

/**;
 * Production-ready Ollama embedding service with caching and batch processing
 */
export class OllamaEmbeddingService {
  private config: Required<OllamaEmbeddingConfig>;
  private cache = new Map<string, { embedding: number[]; timestamp: number }>();
  private stats: EmbeddingStats;
  private batchQueue: Array<{
    text: string;
    resolve: (embedding: number[]) => void;
    reject: (error: Error) => void;
  }> = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(config: OllamaEmbeddingConfig) {
    this.config = {
      model: config.model || 'nomic-embed-text',
      baseUrl: config.baseUrl || 'http://localhost:11434',
      maxRetries: config.maxRetries || 3,
      timeoutMs: config.timeoutMs || 30000,
      cacheMaxSize: config.cacheMaxSize || 10000,
      maxBatchSize: config.maxBatchSize || 16,
      dimensions: config.dimensions || 768, // nomic-embed-text default;
    };

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      cacheHits: 0,
      cacheHitRate: 0,
      avgResponseTime: 0,
      modelUsed: this.config.model,
    };
  }

  /**;
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = this.getCacheKey(text);

    // Check cache first
    const cached = this.getCachedEmbedding(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    // Add to batch queue for efficiency
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ text, resolve, reject });
      this.scheduleBatchProcessing();
    });
  }

  /**;
   * Generate embeddings for multiple texts efficiently
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += this.config.maxBatchSize) {
      const batch = texts.slice(i, i + this.config.maxBatchSize);
      const batchPromises = batch.map((text) => this.generateEmbedding(text));
      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);
    }

    return embeddings;
  }

  /**;
   * Pre-warm cache with common texts
   */
  async preWarmCache(commonTexts: string[]): Promise<void> {
    logger.info(`Pre-warming Ollama embedding cache with ${commonTexts.length} texts...`);
    await this.generateEmbeddings(commonTexts);
    logger.info(`Cache pre-warmed with ${this.cache.size} embeddings`);
  }

  /**;
   * Get service statistics
   */
  getStats(): EmbeddingStats {
    const totalRequests = this.stats.totalRequests + this.stats.cacheHits;
    this.stats.cacheHitRate = totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0;
    return { ...this.stats };
  }

  /**;
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**;
   * Check if Ollama is available and model is loaded
   */
  async checkHealth(): Promise<{
    available: boolean;
    modelLoaded: boolean;
    version?: string;
    error:  string;
  }> {
    try {
      // Check if Ollama is running
      const response = await this.makeRequest('/api/version', 'GET');
      const { version } = response;

      // Check if our model is available
      const modelsResponse = await this.makeRequest('/api/tags', 'GET');
      const modelLoaded = modelsResponse.models?.some(
        (m: any) => m.name === this.config.model || m.name.startsWith(`${this.config.model}:`);
      );

      return {
        available: true,
        modelLoaded,
        version,
      };
    } catch (error) {
      return {
        available: false,
        modelLoaded: false,
        error: error instanceof Error ? error.message : 'Unknown error:;
      };
    }
  }

  /**;
   * Pull/download a model if not available
   */
  async pullModel(model?: string): Promise<void> {
    const modelToPull = model || this.config.model;
    logger.info(`Pulling Ollama model: ${modelToPull}...`);

    try {
      await this.makeRequest('/api/pull', 'POST', {
        name: modelToPull,
      });
      logger.info(`Successfully pulled model: ${modelToPull}`);
    } catch (error) {
      console.error: Failed to pull model ${modelToPull}:`, error:`;
      throw error:;
    }
  }

  /**;
   * List available models
   */
  async listModels(): Promise<Array<{ name: string; size: number; modified_at: string }>> {
    try {
      const response = await this.makeRequest('/api/tags', 'GET');
      return response.models || [];
    } catch (error) {
      console.error: Failed to list Ollama models:', error:;
      return [];
    }
  }

  private async scheduleBatchProcessing(): Promise<void> {
    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Process immediately if batch is full, otherwise wait a bit for more items
    if (this.batchQueue.length >= this.config.maxBatchSize) {
      await this.processBatch();
    } else {
      this.batchTimeout = setTimeout(() => {
        if (this.batchQueue.length > 0) {
          this.processBatch();
        }
      }, 100); // 100ms delay to collect more items;
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const currentBatch = this.batchQueue.splice(0, this.config.maxBatchSize);

    try {
      // Process each text in the batch
      for (const item of currentBatch) {
        try {
          const embedding = await this.generateSingleEmbedding(item.text);
          item.resolve(embedding);
        } catch (error) {
          item.reject(error instanceof Error ? error:  new Error('Unknown error:);
        }
      }
    } catch (error) {
      // If batch processing fails, reject all items
      currentBatch.forEach((item) => {
        item.reject(error instanceof Error ? error:  new Error('Batch processing failed'));
      });
    }
  }

  private async generateSingleEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest('/api/embeddings', 'POST', {
          model: this.config.model,
          prompt: text,
        });

        if (!response.embedding || !Array.isArray(response.embedding)) {
          throw new Error('Invalid embedding response format');
        }

        const { embedding } = response;

        // Validate embedding dimensions
        if (embedding.length !== this.config.dimensions) {
          console.warn(;
            `Expected ${this.config.dimensions} dimensions, got ${embedding.length}. Adjusting config.`;
          );
          this.config.dimensions = embedding.length;
        }

        // Cache the result
        const cacheKey = this.getCacheKey(text);
        this.setCachedEmbedding(cacheKey, embedding);

        // Update stats
        this.stats.successfulRequests++;
        const responseTime = Date.now() - startTime;
        this.stats.avgResponseTime =;
          (this.stats.avgResponseTime * (this.stats.successfulRequests - 1) + responseTime) /;
          this.stats.successfulRequests;

        return embedding;
      } catch (error) {
        console.warn(`Ollama embedding attempt ${attempt} failed:`, error:;

        if (attempt === this.config.maxRetries) {
          this.stats.failedRequests++;
          throw new Error(;
            `Failed to generate embedding after ${this.config.maxRetries} attempts: ${error:`;
          );
        }

        // Exponential backoff
        await new Promise((resolve) => setTimeout(TIME_1000MS));
      }
    }

    throw new Error('Max retries exceeded');
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<unknown> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && _errorname === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeoutMs}ms`);
      }

      throw error:;
    }
  }

  private getCacheKey(text: string): string {
    // Create a hash of the text for cache key
    const crypto = require('crypto');
    return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
  }

  private getCachedEmbedding(key: string): number[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if cache entry is still valid (1 hour TTL)
    const TTL = 60 * 60 * 1000; // 1 hour
    if (Date.now() - cached.timestamp > TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.embedding;
  }

  private setCachedEmbedding(key: string, embedding: number[]): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.config.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
    });
  }
}

// Singleton instance for global use
let globalOllamaService: OllamaEmbeddingService | null = null;

export function getOllamaEmbeddingService(
  config?: Partial<OllamaEmbeddingConfig>;
): OllamaEmbeddingService {
  if (!globalOllamaService) {
    const defaultConfig: OllamaEmbeddingConfig = {
      model: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434',
      maxRetries: 3,
      timeoutMs: 30000,
      cacheMaxSize: 10000,
      maxBatchSize: 16,
      dimensions: 768,
    };

    globalOllamaService = new OllamaEmbeddingService({ ...defaultConfig, ...config });
  }
  return globalOllamaService;
}

export function resetOllamaEmbeddingService(): void {
  globalOllamaService = null;
}

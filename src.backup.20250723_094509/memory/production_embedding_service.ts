/* eslint-disable no-undef */
/**
 * Production Embedding Service
 * High-performance embedding generation with caching, batching, and retry logic
 * Supports OpenAI text-embedding-3-large for optimal semantic search quality
 */

import OpenAI from 'openai';
import * as crypto from 'crypto';

interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
  model: string;
}

interface BatchRequest {
  text: string;
  resolve: (embedding: number[]) => void;
  reject: (_error Error) => void;
}

export interface EmbeddingConfig {
  apiKey?: string;
  model?: 'text-embedding-3-large' | 'text-embedding-3-small' | 'text-embedding-ada-002';
  dimensions?: number;
  maxBatchSize?: number;
  batchTimeoutMs?: number;
  cacheMaxSize?: number;
  cacheTTLHours?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export class ProductionEmbeddingService {
  private openai: OpenAI;
  private config: Required<EmbeddingConfig>;
  private cache = new Map<string, EmbeddingCacheEntry>();
  private batchQueue: BatchRequest[] = [];
  private batchTimer?: NodeJS.Timeout;
  private requestCount = 0;
  private cacheHits = 0;

  constructor(config: EmbeddingConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      model: config.model || 'text-embedding-3-large',
      dimensions: config.dimensions || 1536,
      maxBatchSize: config.maxBatchSize || 32,
      batchTimeoutMs: config.batchTimeoutMs || 100,
      cacheMaxSize: config.cacheMaxSize || 10000,
      cacheTTLHours: config.cacheTTLHours || 24,
      retryAttempts: config.retryAttempts || 3,
      retryDelayMs: config.retryDelayMs || 1000,
    };

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required for production embedding service');
    }

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
    });

    // Start cache cleanup timer
    setInterval(() => this.cleanupCache(), 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    const cacheKey = this.getCacheKey(text);

    // Check cache first
    const cached = this.getCachedEmbedding(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.requestCount++;

    // Add to batch queue for efficient processing
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ text, resolve, reject });
      this.scheduleBatchProcessing();
    });
  }

  /**
   * Generate embeddings for multiple texts efficiently
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache for all texts
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const cacheKey = this.getCacheKey(text);
      const cached = this.getCachedEmbedding(cacheKey);

      if (cached) {
        results[i] = cached;
        this.cacheHits++;
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(i);
      }
    }

    // Process uncached texts in batches
    if (uncachedTexts.length > 0) {
      const embeddings = await this.batchGenerateEmbeddings(uncachedTexts);

      // Insert results back into correct positions
      for (let i = 0; i < uncachedIndices.length; i++) {
        const index = uncachedIndices[i];
        results[index] = embeddings[i];
      }
    }

    return results;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      cacheHits: this.cacheHits,
      cacheHitRate: this.requestCount > 0 ? this.cacheHits / this.requestCount : 0,
      cacheSize: this.cache.size,
      batchQueueSize: this.batchQueue.length,
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.requestCount = 0;
  }

  /**
   * Precompute embeddings for common terms
   */
  async preWarmCache(commonTexts: string[]): Promise<void> {
    console.log(`Pre-warming embedding cache with ${commonTexts.length} texts...`);
    await this.generateEmbeddings(commonTexts);
    console.log(`Cache pre-warming complete. Cache size: ${this.cache.size}`);
  }

  private getCacheKey(text: string): string {
    const normalized = text.trim().toLowerCase();
    return crypto
      .createHash('md5')
      .update(`${this.config.model}:${this.config.dimensions}:${normalized}`)
      .digest('hex');
  }

  private getCachedEmbedding(cacheKey: string): number[] | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    // Check if cache entry is still valid
    const ageHours = (Date.now() - entry.timestamp) / (1000 * 60 * 60);
    if (ageHours > this.config.cacheTTLHours) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.embedding;
  }

  private setCachedEmbedding(text: string, embedding: number[]): void {
    const cacheKey = this.getCacheKey(text);

    // Evict old entries if cache is full
    if (this.cache.size >= this.config.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, {
      embedding,
      timestamp: Date.now(),
      model: this.config.model,
    });
  }

  private scheduleBatchProcessing(): void {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.config.batchTimeoutMs);

    // Process immediately if batch is full
    if (this.batchQueue.length >= this.config.maxBatchSize) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
      this.processBatch();
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.config.maxBatchSize);
    this.batchTimer = undefined;

    try {
      const texts = batch.map((req) => req.text);
      const embeddings = await this.batchGenerateEmbeddings(texts);

      // Resolve all requests
      for (let i = 0; i < batch.length; i++) {
        batch[i].resolve(embeddings[i]);
      }
    } catch (error) {
      // Reject all requests in the batch
      for (const requestof batch) {
        requestreject(error as Error);
      }
    }

    // Process remaining queue
    if (this.batchQueue.length > 0) {
      this.scheduleBatchProcessing();
    }
  }

  private async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.config.model,
          input texts,
          dimensions: this.config.dimensions,
        });

        const embeddings = response.data.map((item) => item.embedding);

        // Cache all embeddings
        for (let i = 0; i < texts.length; i++) {
          this.setCachedEmbedding(texts[i], embeddings[i]);
        }

        return embeddings;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof Error) {
          if (
            error.message.includes('rate limit') ||
            error.message.includes('quota') ||
            error.message.includes('invalid_api_key')
          ) {
            // Wait longer for rate limits
            if (error.message.includes('rate limit')) {
              await this.sleep(this.config.retryDelayMs * (attempt + 1) * 2);
            } else {
              throw error // Don't retry quota/auth errors
            }
          }
        }

        if (attempt < this.config.retryAttempts - 1) {
          await this.sleep(this.config.retryDelayMs * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('Failed to generate embeddings after retries');
  }

  private cleanupCache(): void {
    const cutoffTime = Date.now() - this.config.cacheTTLHours * 60 * 60 * 1000;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < cutoffTime) {
        this.cache.delete(key);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance for global use
let globalEmbeddingService: ProductionEmbeddingService | null = null;

export function getEmbeddingService(config?: EmbeddingConfig): ProductionEmbeddingService {
  if (!globalEmbeddingService) {
    globalEmbeddingService = new ProductionEmbeddingService(config);
  }
  return globalEmbeddingService;
}

export function resetEmbeddingService(): void {
  globalEmbeddingService = null;
}

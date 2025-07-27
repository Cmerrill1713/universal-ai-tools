/* eslint-disable no-undef */;
/**;
 * Production Embedding Service;
 * High-performance embedding generation with caching, batching, and retry logic;
 * Supports OpenAI text-embedding-3-large for optimal semantic search quality;
 */;

import OpenAI from 'openai';
import * as crypto from 'crypto';
interface EmbeddingCacheEntry {;
  embedding: number[];
  timestamp: number;
  model: string;
;
};

interface BatchRequest {;
  text: string;
  resolve: (embedding: number[]) => void;
  reject: (error instanceof Error ? errormessage : String(error) Error) => void;
;
};

export interface EmbeddingConfig {;
  apiKey?: string;
  model?: 'text-embedding-3-large' | 'text-embedding-3-small' | 'text-embedding-ada-002';
  dimensions?: number;
  maxBatchSize?: number;
  batchTimeoutMs?: number;
  cacheMaxSize?: number;
  cacheTTLHours?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
;
};

export class ProductionEmbeddingService {;
  private openai: OpenAI;
  private config: Required<EmbeddingConfig>;
  private cache = new Map<string, EmbeddingCacheEntry>();
  private batchQueue: BatchRequest[] = [];
  private batchTimer?: NodeJSTimeout;
  private requestCount = 0;
  private cacheHits = 0;
  constructor(config: EmbeddingConfig = {}) {;
    thisconfig = {;
      apiKey: configapiKey || processenvOPENAI_API_KEY || '';
      model: configmodel || 'text-embedding-3-large';
      dimensions: configdimensions || 1536;
      maxBatchSize: configmaxBatchSize || 32;
      batchTimeoutMs: configbatchTimeoutMs || 100;
      cacheMaxSize: configcacheMaxSize || 10000;
      cacheTTLHours: configcacheTTLHours || 24;
      retryAttempts: configretryAttempts || 3;
      retryDelayMs: configretryDelayMs || 1000;
    ;
};
    if (!thisconfigapiKey) {;
      throw new Error('OpenAI API key is required for production embedding service');
    };

    thisopenai = new OpenAI({;
      apiKey: thisconfigapiKey;
    });
    // Start cache cleanup timer;
    setInterval(() => thiscleanupCache(), 60 * 60 * 1000); // Cleanup every hour;
  };

  /**;
   * Generate embedding for a single text;
   */;
  async generateEmbedding(text: string): Promise<number[]> {;
    if (!text || texttrim()length === 0) {;
      throw new Error('Text cannot be empty');
    };

    const cacheKey = thisgetCacheKey(text);
    // Check cache first;
    const cached = thisgetCachedEmbedding(cacheKey);
    if (cached) {;
      thiscacheHits++;
      return cached;
    };

    thisrequestCount++;
    // Add to batch queue for efficient processing;
    return new Promise((resolve, reject) => {;
      thisbatchQueuepush({ text, resolve, reject });
      thisscheduleBatchProcessing();
    });
  };

  /**;
   * Generate embeddings for multiple texts efficiently;
   */;
  async generateEmbeddings(texts: string[]): Promise<number[][]> {;
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    // Check cache for all texts;
    for (let i = 0; i < textslength; i++) {;
      const text = texts[i];
      const cacheKey = thisgetCacheKey(text);
      const cached = thisgetCachedEmbedding(cacheKey);
      if (cached) {;
        results[i] = cached;
        thiscacheHits++;
      } else {;
        uncachedTextspush(text);
        uncachedIndicespush(i);
      };
    };

    // Process uncached texts in batches;
    if (uncachedTextslength > 0) {;
      const embeddings = await thisbatchGenerateEmbeddings(uncachedTexts);
      // Insert results back into correct positions;
      for (let i = 0; i < uncachedIndiceslength; i++) {;
        const index = uncachedIndices[i];
        results[index] = embeddings[i];
      };
    };

    return results;
  };

  /**;
   * Get cache statistics;
   */;
  getStats() {;
    return {;
      totalRequests: thisrequestCount;
      cacheHits: thiscacheHits;
      cacheHitRate: thisrequestCount > 0 ? thiscacheHits / thisrequestCount : 0;
      cacheSize: thiscachesize;
      batchQueueSize: thisbatchQueuelength;
    ;
};
  };

  /**;
   * Clear all caches;
   */;
  clearCache(): void {;
    thiscacheclear();
    thiscacheHits = 0;
    thisrequestCount = 0;
  ;
};

  /**;
   * Precompute embeddings for common terms;
   */;
  async preWarmCache(commonTexts: string[]): Promise<void> {;
    loggerinfo(`Pre-warming embedding cache with ${commonTextslength} texts...`);
    await thisgenerateEmbeddings(commonTexts);
    loggerinfo(`Cache pre-warming complete. Cache size: ${thiscachesize}`);
  };

  private getCacheKey(text: string): string {;
    const normalized = texttrim()toLowerCase();
    return crypto;
      createHash('md5');
      update(`${thisconfigmodel}:${thisconfigdimensions}:${normalized}`);
      digest('hex');
  };

  private getCachedEmbedding(cacheKey: string): number[] | null {;
    const entry = thiscacheget(cacheKey);
    if (!entry) return null;
    // Check if cache entry is still valid;
    const ageHours = (Datenow() - entrytimestamp) / (1000 * 60 * 60);
    if (ageHours > thisconfigcacheTTLHours) {;
      thiscachedelete(cacheKey);
      return null;
    };

    return entryembedding;
  };

  private setCachedEmbedding(text: string, embedding: number[]): void {;
    const cacheKey = thisgetCacheKey(text);
    // Evict old entries if cache is full;
    if (thiscachesize >= thisconfigcacheMaxSize) {;
      const oldestKey = thiscachekeys()next()value;
      if (oldestKey) {;
        thiscachedelete(oldestKey);
      };
    };

    thiscacheset(cacheKey, {;
      embedding;
      timestamp: Datenow();
      model: thisconfigmodel;
    });
  };

  private scheduleBatchProcessing(): void {;
    if (thisbatchTimer) return;
    thisbatchTimer = setTimeout(() => {;
      thisprocessBatch();
    }, thisconfigbatchTimeoutMs);
    // Process immediately if batch is full;
    if (thisbatchQueuelength >= thisconfigmaxBatchSize) {;
      clearTimeout(thisbatchTimer);
      thisbatchTimer = undefined;
      thisprocessBatch();
    };
  };

  private async processBatch(): Promise<void> {;
    if (thisbatchQueuelength === 0) return;
    const batch = thisbatchQueuesplice(0, thisconfigmaxBatchSize);
    thisbatchTimer = undefined;
    try {;
      const texts = batchmap((req) => reqtext);
      const embeddings = await thisbatchGenerateEmbeddings(texts);
      // Resolve all requests;
      for (let i = 0; i < batchlength; i++) {;
        batch[i]resolve(embeddings[i]);
      };
    } catch (error) {;
      // Reject all requests in the batch;
      for (const requestof batch) {;
        requestreject(erroras Error);
      };
    };

    // Process remaining queue;
    if (thisbatchQueuelength > 0) {;
      thisscheduleBatchProcessing();
    };
  };

  private async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < thisconfigretryAttempts, attempt++) {;
      try {;
        const response = await thisopenaiembeddingscreate({;
          model: thisconfigmodel;
          inputtexts;
          dimensions: thisconfigdimensions;
        });
        const embeddings = responsedatamap((item) => itemembedding);
        // Cache all embeddings;
        for (let i = 0; i < textslength; i++) {;
          thissetCachedEmbedding(texts[i], embeddings[i]);
        };

        return embeddings;
      } catch (error) {;
        lastError = erroras Error;
        // Don't retry on certain errors;
        if (error instanceof Error) {;
          if (;
            errormessageincludes('rate limit') || errormessageincludes('quota') || errormessageincludes('invalid_api_key');
          ) {;
            // Wait longer for rate limits;
            if (errormessageincludes('rate limit')) {;
              await thissleep(thisconfigretryDelayMs * (attempt + 1) * 2);
            } else {;
              throw error instanceof Error ? errormessage : String(error) // Don't retry quota/auth errors;
            };
          };
        };

        if (attempt < thisconfigretryAttempts - 1) {;
          await thissleep(thisconfigretryDelayMs * (attempt + 1));
        };
      };
    };

    throw lastError || new Error('Failed to generate embeddings after retries');
  };

  private cleanupCache(): void {;
    const cutoffTime = Datenow() - thisconfigcacheTTLHours * 60 * 60 * 1000;
    for (const [key, entry] of thiscacheentries()) {;
      if (entrytimestamp < cutoffTime) {;
        thiscachedelete(key);
      };
    };
  };

  private sleep(ms: number): Promise<void> {;
    return new Promise((resolve) => setTimeout(resolve, ms));
  };
};

// Singleton instance for global use;
let globalEmbeddingService: ProductionEmbeddingService | null = null;
export function getEmbeddingService(config?: EmbeddingConfig): ProductionEmbeddingService {;
  if (!globalEmbeddingService) {;
    globalEmbeddingService = new ProductionEmbeddingService(config);
  };
  return globalEmbeddingService;
};

export function resetEmbeddingService(): void {;
  globalEmbeddingService = null;
};

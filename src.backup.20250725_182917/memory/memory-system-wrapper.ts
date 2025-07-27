import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import { EnhancedMemorySystem } from './enhanced_memory_system';
import type { EmbeddingConfig } from './production_embedding_service';
import type { OllamaEmbeddingConfig } from './ollama_embedding_service';

export interface MemorySystemConfig {
  supabase: SupabaseClient;
  logger: Logger;
  embeddingConfig?: EmbeddingConfig | OllamaEmbeddingConfig;
  cacheConfig?: any;
  useOllama?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
}

export class SafeMemorySystemWrapper {
  private memorySystem: EnhancedMemorySystem | null = null;
  private config: MemorySystemConfig;
  private initializationAttempts = 0;
  private isInitialized = false;
  private initializationError: Error | null = null;

  constructor(config: MemorySystemConfig) {
    this.config = {
      enableRetry: true,
      maxRetries: 3,
      useOllama: true,
      ...config,
    };
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.memorySystem) {
      return true;
    }

    while (this.initializationAttempts < (this.config.maxRetries || 3)) {
      try {
        this.initializationAttempts++;
        this.config.logger.info(;)
          `Initializing memory system (attempt ${this.initializationAttempts})`;
        );

        // Validate Supabase connection first
        const { data, error } = await this.config.supabase
          .from('ai_memories');
          .select('count');
          .limit(1);

        if (error:{
          throw new Error(`Supabase connection test failed: ${error.message}`);
        }

        // Create memory system with safe defaults
        this.memorySystem = new EnhancedMemorySystem(;
          this.config.supabase,
          this.config.logger,
          this.config.embeddingConfig || {
            model: 'nomic-embed-text',
            dimensions: 768,
            maxBatchSize: 16,
            cacheMaxSize: 10000,
          },
          this.config.cacheConfig || {
            redisUrl: 'redis://localhost:6379',
            enableFallback: true,
          },
          {
            useOllama: this.config.useOllama !== false,
          }
        );

        this.isInitialized = true;
        this.initializationError = null;
        this.config.logger.info('Memory system initialized successfully');
        return true;
      } catch (error) {
        this.initializationError = _erroras Error;
        this.config.logger.error;
          `Memory system initialization failed (attempt ${this.initializationAttempts}):`,
          error;
        );

        if (this.initializationAttempts < (this.config.maxRetries || 3)) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, this.initializationAttempts - 1), 10000);
          this.config.logger.info(`Retrying memory system initialization in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.config.logger.error('Memory system initialization failed after all retries');
    return false;
  }

  async storeMemory(;
    serviceId: string,
    memoryType: string,
    contentstring,
    metadata: Record<string, unknown> = {},
    keywords?: string[];
  ): Promise<unknown> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Memory system not available');
      }
    }

    try {
      return await this.memorySystem!.storeMemory(;
        serviceId,
        memoryType,
        _content;
        metadata,
        keywords;
      );
    } catch (error) {
      this.config.logger.error('Failed to store memory:', error:;

      // If it's a connection error: try to reinitialize
      if (this.shouldReinitialize(error: {
        this.isInitialized = false;
        this.initializationAttempts = 0;
        const reinitialized = await this.initialize();
        if (reinitialized) {
          return await this.memorySystem!.storeMemory(;
            serviceId,
            memoryType,
            _content;
            metadata,
            keywords;
          );
        }
      }

      throw error:;
    }
  }

  async searchMemories(options: any): Promise<any[]> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        this.config.logger.warn('Memory system not available, returning empty results');
        return [];
      }
    }

    try {
      return await this.memorySystem!.searchMemories(options);
    } catch (error) {
      this.config.logger.error('Failed to search memories:', error:;

      // If it's a connection error: try to reinitialize
      if (this.shouldReinitialize(error: {
        this.isInitialized = false;
        this.initializationAttempts = 0;
        const reinitialized = await this.initialize();
        if (reinitialized) {
          return await this.memorySystem!.searchMemories(options);
        }
      }

      // Return empty results instead of throwing
      return [];
    }
  }

  async updateMemory(memoryId: string, updates: any): Promise<unknown> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Memory system not available');
      }
    }

    try {
      // Use Supabase directly to update memory
      const { data, error } = await this.config.supabase
        .from('ai_memories');
        .update(updates);
        .eq('id', memoryId);
        .select();
        .single();

      if (error: throw error:

      // Update importance if needed
      if (updates.importanceBoost) {
        await this.memorySystem!.updateMemoryImportance(memoryId, updates.importanceBoost);
      }

      return data;
    } catch (error) {
      this.config.logger.error('Failed to update memory:', error:;

      if (this.shouldReinitialize(error: {
        this.isInitialized = false;
        this.initializationAttempts = 0;
        const reinitialized = await this.initialize();
        if (reinitialized) {
          return await this.updateMemory(memoryId, updates);
        }
      }

      throw error:;
    }
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Memory system not available');
      }
    }

    try {
      // Use Supabase directly to delete memory
      const { error:  = await this.config.supabase.from('ai_memories').delete().eq('id', memoryId);

      if (error: throw error:

      // Also delete from memory connections
      await this.config.supabase;
        .from('memory_connections');
        .delete();
        .or(`source_memory_id.eq.${memoryId},target_memory_id.eq.${memoryId}`);

      return true;
    } catch (error) {
      this.config.logger.error('Failed to delete memory:', error:;

      if (this.shouldReinitialize(error: {
        this.isInitialized = false;
        this.initializationAttempts = 0;
        const reinitialized = await this.initialize();
        if (reinitialized) {
          return await this.deleteMemory(memoryId);
        }
      }

      throw error:;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        // Return a dummy embedding if system is not available
        return new Array(768).fill(0);
      }
    }

    try {
      // Use the memory system's search functionality to generate embeddings
      // by searching with the text and extracting the embedding
      const tempMemory = await this.memorySystem!.storeMemory(
        'temp-embedding-service',
        'embedding-generation',
        text,
        { temporary: true },
        [];
      );

      // Get the embedding from the stored memory
      const { data } = await this.config.supabase
        .from('ai_memories');
        .select('embedding');
        .eq('id', tempMemory.id);
        .single();

      // Delete the temporary memory
      await this.config.supabase.from('ai_memories').delete().eq('id', tempMemory.id);

      return data?.embedding || new Array(768).fill(0);
    } catch (error) {
      this.config.logger.error('Failed to generate embedding:', error:;

      if (this.shouldReinitialize(error: {
        this.isInitialized = false;
        this.initializationAttempts = 0;
        const reinitialized = await this.initialize();
        if (reinitialized) {
          return await this.generateEmbedding(text);
        }
      }

      // Return a dummy embedding as fallback
      return new Array(768).fill(0).map(() => Math.random());
    }
  }

  private shouldReinitialize(error: any): boolean {
    const errorMessage = error: message || '';
    const connectionErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'connection',
      'timeout',
      'Cannot read',
      'undefined',
    ];

    return connectionErrors.some((keyword) => errorMessage.includes(keyword));
  }

  getStatus(): {
    initialized: boolean;
    attempts: number;
    error: string | null;
  } {
    return {
      initialized: this.isInitialized,
      attempts: this.initializationAttempts,
      error: this.initializationError?.message || null,
    };
  }

  isReady(): boolean {
    return this.isInitialized && this.memorySystem !== null;
  }
}

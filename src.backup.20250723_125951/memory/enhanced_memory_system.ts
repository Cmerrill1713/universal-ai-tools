/**
 * Enhanced Memory System with Vector Search
 * Integrates Supabase pgvector for semantic memory capabilities
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { EmbeddingConfig } from './production_embedding_service';
import { ProductionEmbeddingService } from './production_embedding_service';
import type { OllamaEmbeddingConfig } from './ollama_embedding_service';
import { OllamaEmbeddingService, getOllamaEmbeddingService } from './ollama_embedding_service';
import type { MemoryCacheSystem } from './memory_cache_system';
import { getCacheSystem } from './memory_cache_system';
import type { ContextualMemoryEnricher } from './contextual_memory_enricher';
import { getMemoryEnricher } from './contextual_memory_enricher';
import type { MultiStageSearchOptions, SearchMetrics } from './multi_stage_search';
import { MultiStageSearchSystem } from './multi_stage_search';
import type {
  AccessPatternLearner,
  LearningInsights,
  UtilityScore,
} from './access_pattern_learner';
import { getAccessPatternLearner } from './access_pattern_learner';

export interface MemorySearchOptions {
  query?: string;
  embedding?: number[];
  similarityThreshold?: number;
  maxResults?: number;
  category?: string;
  agentFilter?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  // Multi-stage search options
  enableMultiStage?: boolean;
  searchStrategy?: 'balanced' | 'precision' | 'recall' | 'speed';
  clusterSearchThreshold?: number;
  maxClustersToSearch?: number;
  enableFallbackSearch?: boolean;
  // Access_patternlearning options
  enableUtilityRanking?: boolean;
  recordAccess?: boolean;
  sessionContext?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

export interface Memory {
  id: string;
  serviceId: string;
  memoryType: string;
  content string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  importanceScore: number;
  accessCount: number;
  lastAccessed?: Date;
  keywords?: string[];
  relatedEntities?: any[];
}

export interface MemoryConnection {
  sourceMemoryId: string;
  targetMemoryId: string;
  connectionType: string;
  strength: number;
  metadata?: Record<string, unknown>;
}

export class EnhancedMemorySystem {
  private supabase: SupabaseClient;
  private logger: Logger;
  private embeddingService: ProductionEmbeddingService | OllamaEmbeddingService;
  private cacheSystem: MemoryCacheSystem;
  private contextualEnricher: ContextualMemoryEnricher;
  private multiStageSearch: MultiStageSearchSystem;
  private accessLearner: AccessPatternLearner;
  private embeddingModel = 'nomic-embed-text';
  private embeddingDimension = 768;
  private useOllama = true;

  constructor(
    supabase: SupabaseClient,
    logger: Logger,
    embeddingConfig?: EmbeddingConfig | OllamaEmbeddingConfig,
    cacheConfig?: any,
    options?: { useOllama?: boolean }
  ) {
    this.supabase = supabase;
    this.logger = logger;
    this.useOllama = options?.useOllama ?? true;

    if (this.useOllama) {
      // Use Ollama by default
      const ollamaConfig = embeddingConfig as OllamaEmbeddingConfig;
      const model = ollamaConfig?.model || 'nomic-embed-text';
      // Set dimensions based on model
      const dimensions = ollamaConfig?.dimensions || (model === 'nomic-embed-text' ? 768 : 768);

      this.embeddingService = getOllamaEmbeddingService({
        dimensions,
        maxBatchSize: 16,
        cacheMaxSize: 10000,
        ...ollamaConfig,
        model,
      });
      this.embeddingModel = model;
      this.embeddingDimension = dimensions;
    } else {
      // Fallback to OpenAI
      const openaiConfig = embeddingConfig as EmbeddingConfig;
      const model = openaiConfig?.model || 'text-embedding-3-large';
      // Set dimensions based on model
      const dimensions =;
        openaiConfig?.dimensions ||
        (model === 'text-embedding-3-large'
          ? 1536
          : model === 'text-embedding-3-small'
            ? 1536
            : 1536); // Default to 1536 for OpenAI

      this.embeddingService = new ProductionEmbeddingService({
        dimensions,
        maxBatchSize: 32,
        cacheMaxSize: 10000,
        ...openaiConfig,
        model,
      });
      this.embeddingModel = model;
      this.embeddingDimension = dimensions;
    }

    this.cacheSystem = getCacheSystem(cacheConfig);
    this.contextualEnricher = getMemoryEnricher();
    this.multiStageSearch = new MultiStageSearchSystem(supabase, logger;
    this.accessLearner = getAccessPatternLearner(supabase, logger;
  }

  /**
   * Store a memory with contextual enrichment and embedding generation
   */
  async storeMemory(
    serviceId: string,
    memoryType: string,
    content string,
    metadata: Record<string, unknown> = {},
    keywords?: string[]
  ): Promise<Memory> {
    try {
      // Perform contextual enrichment
      const enrichmentResult = this.contextualEnricher.enrichMemory(
        content
        serviceId,
        memoryType,
        metadata
      );

      this.logger.debug(
        `Contextual enrichment extracted ${enrichmentResult.enrichment.entities.length} entities and ${enrichmentResult.enrichment.concepts.length} concepts``
      );

      // Generate embedding for the contextually enriched content
      const embedding = await this.generateEmbedding(enrichmentResult.contextualContent);

      // Determine importance score based on enrichment data
      const enrichedImportanceScore = this.calculateEnrichedImportance(
        enrichmentResult.enrichment,
        metadata.importance || 0.5
      );

      // Store memory with embedding and enriched metadata
      const { data, error} = await this.supabase
        .from('ai_memories')
        .insert({
          service_id: serviceId,
          memory_type: memoryType,
          content
          metadata: enrichmentResult.enhancedMetadata,
          embedding,
          embedding_model: this.embeddingModel,
          keywords: keywords || this.extractKeywordsFromEnrichment(enrichmentResult.enrichment),
          related_entities: enrichmentResult.enrichment.entities,
          importance_score: enrichedImportanceScore,
          memory_category: this.categorizeMemoryFromEnrichment(
            enrichmentResult.enrichment,
            memoryType
          ),
        })
        .select()
        .single();

      if (_error throw error;

      this.logger.info(
        `Stored enriched memory with ${enrichmentResult.enrichment.entities.length} entities for ${serviceId}``
      );

      // Format memory for caching
      const formattedMemory = this.formatMemory(data);

      // Cache the memory in appropriate tier (importance-based)
      this.cacheSystem.storeMemory(formattedMemory);

      // Cache both original and contextual embeddings
      this.cacheSystem.cacheEmbedding(content: embedding;
      this.cacheSystem.cacheEmbedding(enrichmentResult.contextualContent, embedding;

      // Invalidate search cache since new memory was added
      this.cacheSystem.invalidateSearchCache();

      // Automatically create connections to similar memories
      await this.createSimilarityConnections(data.id, embedding;

      return formattedMemory;
    } catch (error) {
      this.logger.error('Failed to , error);
      throw error;
    }
  }

  /**
   * Search memories using vector similarity with caching
   */
  async searchMemories(options: MemorySearchOptions: Promise<Memory[]> {
    try {
      // Use multi-stage search if enabled
      if (options.enableMultiStage) {
        const result = await this.multiStageSearchMemories(options);
        return result.results;
      }

      let embedding: number[];

      // Generate embedding from query if not provided
      if (options.query && !options.embedding) {
        // Check cache for embedding first
        const cachedEmbedding = this.cacheSystem.getCachedEmbedding(options.query);
        if (cachedEmbedding) {
          embedding = cachedEmbedding;
        } else {
          embedding = await this.generateEmbedding(options.query);
          this.cacheSystem.cacheEmbedding(options.query, embedding;
        }
      } else if (options.embedding) {
        embedding = options.embedding;
      } else {
        throw new Error('Either query or embedding must be provided');
      }

      // Create cache key for search results
      const searchCacheKey = {
        queryHash: this.hashQuery(options.query || JSON.stringify(embedding)),
        similarityThreshold: options.similarityThreshold || 0.7,
        maxResults: options.maxResults || 20,
        agentFilter: options.agentFilter,
        category: options.category,
      };

      // Check search result cache
      const cachedResults = this.cacheSystem.getCachedSearchResults(searchCacheKey);
      if (cachedResults) {
        this.logger.debug('Search results served from cache');

        // Still track access for the top result
        if (cachedResults.length > 0) {
          await this.trackMemoryAccess(
            cachedResults[0].id,
            options.agentFilter || 'unknown',
            embedding,
            0.8 // Approximate similarity for cached results
          );
        }

        return cachedResults;
      }

      // Call the vector search function
      const { data, error} = await this.supabase.rpc('search_similar_memories', {
        query_embedding: embedding,
        similarity_threshold: options.similarityThreshold || 0.7,
        max_results: options.maxResults || 20,
        category_filter: options.category || null,
        agent_filter: options.agentFilter || null,
      });

      if (_error throw error;

      const formattedResults = data.map((memory: any => this.formatMemory(memory));

      // Cache the search results
      this.cacheSystem.cacheSearchResults(searchCacheKey, formattedResults;

      // Cache individual memories that were returned
      formattedResults.forEach((memory: Memory => {
        this.cacheSystem.storeMemory(memory);
      });

      // Apply utility-based re-ranking if enabled
      if (options.enableUtilityRanking && formattedResults.length > 0) {
        const reRankedResults = await this.accessLearner.reRankResults(
          formattedResults.map((memory: Memory) => ({
            ...memory,
            similarityScore: data.find((d: any => d.memory_id === memory.id)?.similarity || 0,
          })),
          options.agentFilter || 'unknown',
          {
            queryEmbedding: embedding,
            sessionContext: options.sessionContext,
            urgency: options.urgency,
          }
        );

        // Sort by new ranking and return
        const finalResults = reRankedResults;
          .sort((a, b => a.newRank - b.newRank)
          .map((result) => {
            const { originalRank, newRank, utilityScore, finalScore, ...memory } = result as any;
            return memory as Memory;
          });

        // Track access patterns for top result
        if (options.recordAccess !== false) {
          await this.recordMemoryAccess(
            finalResults[0].id,
            options.agentFilter || 'unknown',
            'search',
            {
              queryEmbedding: embedding,
              similarityScore: reRankedResults[0].utilityScore.finalScore,
              sessionContext: options.sessionContext,
              urgency: options.urgency,
            }
          );
        }

        return finalResults;
      }

      // Track access patterns for standard search
      if (formattedResults.length > 0 && options.recordAccess !== false) {
        await this.recordMemoryAccess(
          formattedResults[0].id,
          options.agentFilter || 'unknown',
          'search',
          {
            queryEmbedding: embedding,
            similarityScore: data[0].similarity,
            sessionContext: options.sessionContext,
            urgency: options.urgency,
          }
        );
      }

      return formattedResults;
    } catch (error) {
      this.logger.error('Failed to search memorie, error;
      throw error;
    }
  }

  /**
   * Advanced multi-stage search with hierarchical clustering
   */
  async multiStageSearchMemories(options: MemorySearchOptions: Promise<{
    results: Memory[];
    metrics: SearchMetrics;
  }> {
    try {
      let embedding: number[];

      // Generate embedding from query if not provided
      if (options.query && !options.embedding) {
        const cachedEmbedding = this.cacheSystem.getCachedEmbedding(options.query);
        if (cachedEmbedding) {
          embedding = cachedEmbedding;
        } else {
          embedding = await this.generateEmbedding(options.query);
          this.cacheSystem.cacheEmbedding(options.query, embedding;
        }
      } else if (options.embedding) {
        embedding = options.embedding;
      } else {
        throw new Error('Either query or embedding must be provided');
      }

      // Convert options to multi-stage format
      const multiStageOptions: MultiStageSearchOptions = {
        embedding,
        similarityThreshold: options.similarityThreshold,
        maxResults: options.maxResults,
        agentFilter: options.agentFilter,
        category: options.category,
        clusterSearchThreshold: options.clusterSearchThreshold,
        maxClustersToSearch: options.maxClustersToSearch,
        enableFallbackSearch: options.enableFallbackSearch,
        searchStrategy: options.searchStrategy,
      };

      // Perform multi-stage search
      const { results: searchResults, metrics } = await this.multiStageSearch.search(
        embedding,
        multiStageOptions
      );

      // Convert to Memory format
      const formattedResults: Memory[] = searchResults.map((result) => ({
        id: result.id,
        serviceId: result.serviceId,
        memoryType: result.memoryType,
        content result.content
        metadata: result.metadata,
        importanceScore: result.importanceScore,
        accessCount: result.accessCount,
        keywords: [],
        relatedEntities: [],
      }));

      // Cache the results
      const searchCacheKey = {
        queryHash: this.hashQuery(options.query || JSON.stringify(embedding)),
        similarityThreshold: options.similarityThreshold || 0.7,
        maxResults: options.maxResults || 20,
        agentFilter: options.agentFilter,
        category: options.category,
      };
      this.cacheSystem.cacheSearchResults(searchCacheKey, formattedResults;

      // Track access patterns for top result
      if (formattedResults.length > 0) {
        await this.trackMemoryAccess(
          formattedResults[0].id,
          options.agentFilter || 'unknown',
          embedding,
          searchResults[0].similarity
        );
      }

      this.logger.info(
        `Multi-stage search completed: ${metrics.clustersEvaluated} clusters, ${metrics.memoriesEvaluated} memories in ${metrics.totalSearchTime}ms``
      );

      return {
        results: formattedResults,
        metrics,
      };
    } catch (error) {
      this.logger.error('Failed to perform multi-stage , error);
      throw error;
    }
  }

  /**
   * Find memories across multiple agents
   */
  async crossAgentSearch(
    query: string,
    agentList: string[],
    options: Partial<MemorySearchOptions> = {}
  ): Promise<Record<string, Memory[]>> {
    try {
      const embedding = await this.generateEmbedding(query);

      const { data, error} = await this.supabase.rpc('cross_agent_memory_search', {
        query_embedding: embedding,
        agent_list: agentList,
        similarity_threshold: options.similarityThreshold || 0.6,
        max_per_agent: options.maxResults || 5,
      });

      if (_error throw error;

      // Group results by agent
      const groupedResults: Record<string, Memory[]> = {};

      data.forEach((result: any => {
        if (!groupedResults[result.service_id]) {
          groupedResults[result.service_id] = [];
        }
        groupedResults[result.service_id].push(this.formatMemory(result));
      });

      return groupedResults;
    } catch (error) {
      this.logger.error('Failed to perform cross-agent , error);
      throw error;
    }
  }

  /**
   * Find connected memories (graph: traversal
   */
  async findConnectedMemories(
    memoryId: string,
    connectionTypes?: string[],
    maxDepth = 3
  ): Promise<Memory[]> {
    try {
      const { data, error} = await this.supabase.rpc('find_connected_memories', {
        start_memory_id: memoryId,
        connection_types: connectionTypes || null,
        max_depth: maxDepth,
        min_strength: 0.3,
      });

      if (_error throw error;

      return data.map((memory: any => this.formatMemory(memory));
    } catch (error) {
      this.logger.error('Failed to find connected memorie, error;
      throw error;
    }
  }

  /**
   * Get memory recommendations for a user
   */
  async getMemoryRecommendations(
    userId: string,
    agentName: string,
    currentContext?: string
  ): Promise<Memory[]> {
    try {
      let contextEmbedding = null;

      if (currentContext) {
        contextEmbedding = await this.generateEmbedding(currentContext);
      }

      const { data, error} = await this.supabase.rpc('recommend_related_memories', {
        user_id: userId,
        agent_name: agentName,
        current_context: contextEmbedding,
        limit_results: 10,
      });

      if (_error throw error;

      return data.map((memory: any => this.formatMemory(memory));
    } catch (error) {
      this.logger.error('Failed to get memory recommendation, error;
      throw error;
    }
  }

  /**
   * Update memory importance based on access
   */
  async updateMemoryImportance(memoryId: string, boost = 0.1))): Promise<void> {
    try {
      // Get current values first
      const { data: currentMemory, } = await this.supabase
        .from('ai_memories')
        .select('importance_score, access_count')
        .eq('id', memoryId)
        .single();

      if (currentMemory) {
        const newImportance = Math.min(currentMemory.importance_score + boost, 1.0);
        const newAccessCount = currentMemory.access_count + 1;

        const { error} = await this.supabase
          .from('ai_memories')
          .update({
            importance_score: newImportance,
            access_count: newAccessCount,
            last_accessed: new Date().toISOString(),
          })
          .eq('id', memoryId);

        if (_error throw error;
      }
    } catch (error) {
      this.logger.error('Failed to update memory importance:', error);
      throw error;
    }
  }

  /**
   * Create a connection between memories
   */
  async createMemoryConnection(
    sourceId: string,
    targetId: string,
    connectionType: string,
    strength = 0.5,
    metadata: Record<string, unknown> = {}
  ))): Promise<void> {
    try {
      const { error} = await this.supabase.from('memory_connections').upsert({
        source_memory_id: sourceId,
        target_memory_id: targetId,
        connection_type: connectionType,
        strength,
        metadata,
      });

      if (_error throw error;

      this.logger.info(`Created ${connectionType} connection between memories`);
    } catch (error) {
      this.logger.error('Failed to create memory connection:', error);
      throw error;
    }
  }

  /**
   * Generate embedding using configured service (Ollama or: OpenAI
   */
  private async generateEmbedding(text: string: Promise<number[]> {
    try {
      return await this.embeddingService.generateEmbedding(text);
    } catch (error) {
      this.logger.error
        `Failed to generate embedding using ${this.useOllama ? 'Ollama' : 'OpenAI'}:`,
        error
      );

      // If using Ollama and it fails, check if it's available
      if (this.useOllama && this.embeddingService instanceof OllamaEmbeddingService) {
        const health = await this.embeddingService.checkHealth();
        if (!health.available) {
          this.logger.warn(
            'Ollama is not available. Make sure Ollama is running at http://localhost:11434'
          );
        } else if (!health.modelLoaded) {
          this.logger.warn(
            `Model ${this.embeddingModel} is not loaded. Try running: ollama pull ${this.embeddingModel}``
          );
        }
      }

      // Fallback to mock embedding if service fails
      this.logger.warn('Falling back to mock embedding');
      return new Array(this.embeddingDimension).fill(0).map(() => Math.random());
    }
  }

  /**
   * Generate multiple embeddings efficiently
   */
  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      return await this.embeddingService.generateEmbeddings(texts);
    } catch (error) {
      this.logger.error('Failed to generate batch embedding, error;
      // Fallback to individual generation
      const embeddings: number[][] = [];
      for (const text of texts) {
        embeddings.push(await this.generateEmbedding(text));
      }
      return embeddings;
    }
  }

  /**
   * Get embedding service statistics
   */
  getEmbeddingStats() {
    return this.embeddingService.getStats();
  }

  /**
   * Pre-warm embedding cache with common terms
   */
  async preWarmEmbeddingCache(commonTexts: string[]))): Promise<void> {
    await this.embeddingService.preWarmCache(commonTexts);
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      embedding: this.embeddingService.getStats(),
      memory: this.cacheSystem.getCacheStats(),
    };
  }

  /**
   * Optimize cache performance
   */
  optimizeCaches(): {
    memory: { promoted: number; demoted: number, };
    overview: any;
  } {
    const memoryOptimization = this.cacheSystem.optimizeCacheTiers();
    const hotEntries = this.cacheSystem.getHotEntries();

    return {
      memory: memoryOptimization,
      overview: {
        hotMemories: hotEntries.hotMemories.length,
        hotSearches: hotEntries.hotSearches.length,
        hotEmbeddings: hotEntries.hotEmbeddings.length,
      },
    };
  }

  /**
   * Clear all caches
   */
  clearCaches()): void {
    this.embeddingService.clearCache();
    this.cacheSystem.clearAllCaches();
  }

  /**
   * Pre-warm memory cache with frequently accessed memories
   */
  async preWarmMemoryCache(limit = 100))): Promise<void> {
    try {
      const { data: frequentMemories, error} = await this.supabase
        .from('ai_memories')
        .select('*')
        .order('access_count', { ascending: false, })
        .order('importance_score', { ascending: false, })
        .limit(limit);

      if (_error throw error;

      if (frequentMemories) {
        const formattedMemories = frequentMemories.map(this.formatMemory);
        this.cacheSystem.preWarmCache(formattedMemories);
        this.logger.info(
          `Pre-warmed cache with ${formattedMemories.length} frequently accessed memories``
        );
      }
    } catch (error) {
      this.logger.error('Failed to pre-warm memory cache:', error);
    }
  }

  /**
   * Hash query for cache key generation
   */
  private hashQuery(query: string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(query.trim().toLowerCase()).digest('hex');
  }

  /**
   * Calculate enriched importance score based on contextual analysis
   */
  private calculateEnrichedImportance(enrichment: any, baseImportance: number: number {
    let adjustedImportance = baseImportance;

    // Boost importance based on urgency
    if (enrichment.intent.urgency === 'critical') {
      adjustedImportance += 0.3;
    } else if (enrichment.intent.urgency === 'high') {
      adjustedImportance += 0.2;
    } else if (enrichment.intent.urgency === 'low') {
      adjustedImportance -= 0.1;
    }

    // Boost importance for action items
    if (enrichment.intent.category === 'action' || enrichment.intent.category === 'request) {
      adjustedImportance += 0.15;
    }

    // Boost importance for entities (people, organizations, etc.)
    const importantEntityTypes = ['person', 'organization', 'email', 'phone'];
    const hasImportantEntities = enrichment.entities.some((e: any =>;
      importantEntityTypes.includes(e.type)
    );
    if (hasImportantEntities) {
      adjustedImportance += 0.1;
    }

    // Boost importance for technical content
    if (
      enrichment.complexity.technicalLevel === 'expert' ||
      enrichment.complexity.technicalLevel === 'advanced'
    ) {
      adjustedImportance += 0.1;
    }

    // Boost importance for concepts with high relevance
    const highRelevanceConcepts = enrichment.concepts.filter((c: any => c.relevance > 0.8);
    adjustedImportance += highRelevanceConcepts.length * 0.05;

    return Math.min(1.0, Math.max(0.0, adjustedImportance));
  }

  /**
   * Extract keywords from enrichment data
   */
  private extractKeywordsFromEnrichment(enrichment: any: string[] {
    const keywords: string[] = [];

    // Add intent and category as keywords
    keywords.push(enrichment.intent.intent, enrichment.intent.category);

    // Add entity values as keywords
    enrichment.entities.forEach((entity: any => {
      if (entity.type !== 'other' && entity.value.length <= 50) {
        keywords.push(entity.value.toLowerCase());
      }
    });

    // Add top concepts as keywords
    enrichment.concepts
      .filter((concept: any => concept.relevance > 0.5)
      .slice(0, 10)
      .forEach((concept: any => {
        keywords.push(...concept.keywords);
      });

    // Add temporal keywords if present
    if (enrichment.temporal.hasTimeReference) {
      keywords.push(enrichment.temporal.temporalType);
      if (enrichment.temporal.urgency) {
        keywords.push(enrichment.temporal.urgency);
      }
    }

    // Remove duplicates and filter out very short keywords
    return [...new Set(keywords)].filter((keyword) => keyword && keyword.length >= 3).slice(0, 20); // Limit to top 20 keywords
  }

  /**
   * Categorize memory based on enrichment data
   */
  private categorizeMemoryFromEnrichment(enrichment: any, memoryType: string {
    // Check intent-based categorization first
    if (enrichment.intent.category === 'action' || enrichment.intent.category === 'request) {
      return 'task';
    }

    if (enrichment.intent.category === 'question') {
      return 'inquiry';
    }

    // Check concept-based categorization
    const actionConcepts = enrichment.concepts.filter((c: any => c.category === 'action');
    const technicalConcepts = enrichment.concepts.filter((c: any => c.category === 'technical');
    const temporalConcepts = enrichment.concepts.filter((c: any => c.category === 'temporal');

    if (actionConcepts.length > 0) {
      return 'task';
    }

    if (technicalConcepts.length > 0) {
      return 'technical';
    }

    if (temporalConcepts.length > 0 || enrichment.temporal.hasTimeReference) {
      return 'scheduled';
    }

    // Check entity-based categorization
    const hasPersonEntities = enrichment.entities.some((e: any => e.type === 'person');
    const hasOrgEntities = enrichment.entities.some((e: any => e.type === 'organization');

    if (hasPersonEntities || hasOrgEntities) {
      return 'social';
    }

    // Fallback to memory type or general
    if (memoryType === 'consolidated') return 'consolidated';

    return 'general';
  }

  /**
   * Contextual search that enriches queries before searching
   */
  async contextualSearch(
    query: string,
    options: MemorySearchOptions = {}
  ): Promise<{
    results: Memory[];
    queryEnrichment: any;
    searchStrategy: string;
  }> {
    try {
      // Enrich the query for better context understanding
      const queryEnrichment = this.contextualEnricher.enrichMemory(
        query,
        options.agentFilter || 'system',
        'search_query'
      );

      this.logger.debug(
        `Query enrichment found ${queryEnrichment.enrichment.entities.length} entities and ${queryEnrichment.enrichment.concepts.length} concepts``
      );

      // Use contextual contentfor embedding generation
      const enrichedOptions = {
        ...options,
        query: queryEnrichment.contextualContent,
      };

      // Perform the search with enriched query
      const results = await this.searchMemories(enrichedOptions);

      // Determine search strategy based on enrichment
      let searchStrategy = 'standard';
      if (queryEnrichment.enrichment.intent.urgency === 'critical') {
        searchStrategy = 'priority';
      } else if (queryEnrichment.enrichment.entities.length > 2) {
        searchStrategy = 'entity-focused';
      } else if (queryEnrichment.enrichment.temporal.hasTimeReference) {
        searchStrategy = 'temporal-aware';
      }

      return {
        results,
        queryEnrichment: queryEnrichment.enrichment,
        searchStrategy,
      };
    } catch (error) {
      this.logger.error('Failed to perform contextual , error);
      throw error;
    }
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string[] {
    // Simple keyword extraction - in production, use NLP
    const words = content;
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 4);

    const wordFreq: Record<string, number> = {};
    words.forEach((word) => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq);
      .sort((a, b => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Extract entities from content
   */
  private extractEntities(content: string: any[] {
    // Simple entity extraction - in production, use NER
    const entities: any[] = [];

    // Extract emails
    const emails = contentmatch(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    if (emails) {
      entities.push(...emails.map((email) => ({ type: 'email', value: email, })));
    }

    // Extract URLs
    const urls = contentmatch(
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
    );
    if (urls) {
      entities.push(...urls.map((url) => ({ type: 'url', value: url, })));
    }

    return entities;
  }

  /**
   * Categorize memory based on type and content
   */
  private categorizeMemory(memoryType: string, content: string {
    // Simple categorization logic
    if (memoryType === 'consolidated') return 'consolidated';
    if (contenttoLowerCase().includes('task') || contenttoLowerCase().includes('todo'))
      return 'task';
    if (contenttoLowerCase().includes('meeting') || contenttoLowerCase().includes('appointment'))
      return 'calendar';
    if (contenttoLowerCase().includes('code') || contenttoLowerCase().includes('function'))
      return 'technical';
    return 'general';
  }

  /**
   * Create automatic connections to similar memories
   */
  private async createSimilarityConnections(memoryId: string, embedding: number[]))): Promise<void> {
    try {
      // Find top 3 similar memories
      const { data } = await this.supabase.rpc('search_similar_memories', {
        query_embedding: embedding,
        similarity_threshold: 0.8,
        max_results: 4, // Include self, so we get 3 others
      });

      if (data) {
        for (const similar of data) {
          if (similar.memory_id !== memoryId) {
            await this.createMemoryConnection(
              memoryId,
              similar.memory_id,
              'semantic_similarity',
              similar.similarity
            );
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to create similarity connections:', error);
    }
  }

  /**
   * Record memory access_patternusing the access learner
   */
  async recordMemoryAccess(
    memoryId: string,
    agentName: string,
    accessType: 'search' | 'direct' | 'related' | 'contextual',
    options: {
      queryEmbedding?: number[];
      similarityScore?: number;
      responseUseful?: boolean;
      interactionDuration?: number;
      sessionContext?: string;
      urgency?: 'low' | 'medium' | 'high' | 'critical';
    } = {}
  ))): Promise<void> {
    try {
      await this.accessLearner.recordAccess(memoryId, agentName, accessType, {
        queryEmbedding: options.queryEmbedding,
        similarityScore: options.similarityScore,
        responseUseful: options.responseUseful,
        interactionDuration: options.interactionDuration,
        contextualFactors: {
          timeOfDay: new Date().getHours(),
          sessionLength: 0, // Could be tracked from session start
          taskType: options.sessionContext,
          urgency: options.urgency,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to record memory access:', error);
    }
  }

  /**
   * Record user feedback for a memory interaction
   */
  async recordUserFeedback(
    memoryId: string,
    agentName: string,
    feedback: {
      relevance: number; // 1-5 scale
      helpfulness: number; // 1-5 scale
      accuracy: number; // 1-5 scale
    },
    followUpQueries?: string[]
  ))): Promise<void> {
    try {
      await this.accessLearner.recordUserFeedback(memoryId, agentName, feedback, followUpQueries;
      this.logger.info(
        `Recorded user feedback for memory ${memoryId}: relevance=${feedback.relevance}``
      );
    } catch (error) {
      this.logger.error('Failed to record u, error;
    }
  }

  /**
   * Track memory access patterns (legacy method for compatibility)
   */
  private async trackMemoryAccess(
    memoryId: string,
    agentName: string,
    queryEmbedding: number[],
    similarityScore: number
  ))): Promise<void> {
    await this.recordMemoryAccess(memoryId, agentName, 'search', {
      queryEmbedding,
      similarityScore,
      responseUseful: true,
    });
  }

  /**
   * Format raw database memory to Memory interface
   */
  private formatMemory(data: any: Memory {
    return {
      id: data.id || data.memory_id,
      serviceId: data.service_id,
      memoryType: data.memory_type,
      content, data.content
      metadata: data.metadata || {},
      embedding: data.embedding,
      importanceScore: data.importance_score || data.adjusted_score || 0.5,
      accessCount: data.access_count || 0,
      lastAccessed: data.last_accessed ? new Date(data.last_accessed) : undefined,
      keywords: data.keywords || [],
      relatedEntities: data.related_entities || [],
    };
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(agentName?: string): Promise<unknown> {
    try {
      const query = this.supabase;
        .from('ai_memories')
        .select('service_id, memory_type, importance_score, access_count', { count: 'exact' });

      if (agentName) {
        query.eq('service_id', agentName);
      }

      const { data, count, error} = await query;

      if (_error throw error;

      return {
        totalMemories: count,
        byType: this.groupBy(data, 'memory_type'),
        byAgent: this.groupBy(data, 'service_id'),
        avgImportance: data.reduce((sum, m) => sum + m.importance_score, 0) / data.length,
        totalAccesses: data.reduce((sum, m) => sum + m.access_count, 0),
      };
    } catch (error) {
      this.logger.error('Failed to get memory stat, error;
      throw error;
    }
  }

  private groupBy(array: any[], key: string: Record<string, number> {
    return array.reduce((result, item => {
      result[item[key]] = (result[item[key]] || 0) + 1;
      return result;
    }, {});
  }

  /**
   * Get cluster statistics and health metrics
   */
  async getClusterStatistics()): Promise<unknown> {
    try {
      return await this.multiStageSearch.getClusterStatistics();
    } catch (error) {
      this.logger.error('Failed to get cluster statistic, error;
      throw error;
    }
  }

  /**
   * Refresh semantic clusters for improved search performance
   */
  async refreshSemanticClusters(): Promise<{
    clustersCreated: number;
    memoriesProcessed: number;
    processingTime: number;
  }> {
    try {
      const result = await this.multiStageSearch.refreshSemanticClusters();

      // Clear relevant caches after cluster refresh
      this.cacheSystem.invalidateSearchCache();
      this.multiStageSearch.clearCache();

      this.logger.info(
        `Semantic clusters refreshed: ${result.clustersCreated} clusters created, ${result.memoriesProcessed} memories processed``
      );

      return result;
    } catch (error) {
      this.logger.error('Failed to refresh semantic cluster, error;
      throw error;
    }
  }

  /**
   * Analyze search performance and get optimization recommendations
   */
  analyzeSearchPerformance(searchMetrics: SearchMetrics[]): {
    recommendations: string[];
    averagePerformance: any;
  } {
    return this.multiStageSearch.analyzeSearchPerformance(searchMetrics);
  }

  /**
   * Get comprehensive system statistics including clustering
   */
  async getSystemStatistics(): Promise<{
    memory: any;
    cluster: any;
    cache: any;
    embedding: any;
  }> {
    try {
      const [memoryStats, clusterStats, cacheStats, embeddingStats] = await Promise.all([;
        this.getMemoryStats(),
        this.getClusterStatistics(),
        Promise.resolve(this.getCacheStats()),
        Promise.resolve(this.getEmbeddingStats()),
      ]);

      return {
        memory: memoryStats,
        cluster: clusterStats,
        cache: cacheStats,
        embedding: embeddingStats,
      };
    } catch (error) {
      this.logger.error('Failed to get system statistic, error;
      throw error;
    }
  }

  /**
   * Clear all caches including multi-stage search cache
   */
  clearAllCaches()): void {
    this.clearCaches();
    this.multiStageSearch.clearCache();
  }

  /**
   * Check Ollama health and model availability
   */
  async checkEmbeddingServiceHealth(): Promise<{
    service: string;
    available: boolean;
    modelLoaded?: boolean;
    version?: string;
    error: string;
    recommendations?: string[];
  }> {
    if (this.useOllama && this.embeddingService instanceof OllamaEmbeddingService) {
      const health = await this.embeddingService.checkHealth();
      const recommendations: string[] = [];

      if (!health.available) {
        recommendations.push('Start Ollama: brew install ollama && ollama serve');
        recommendations.push('Or download from: https://ollama.ai');
      } else if (!health.modelLoaded) {
        recommendations.push(`Pull the embedding model: ollama pull ${this.embeddingModel}`);
        recommendations.push(
          'Alternative models: ollama pull all-minilm, ollama pull mxbai-embed-large'
        );
      }

      return {
        service: 'Ollama',
        available: health.available,
        modelLoaded: health.modelLoaded,
        version: health.version,
        _error health._error
        recommendations: recommendations.length > 0 ? recommendations : undefined,
      };
    } else {
      return {
        service: 'OpenAI',
        available: !!process.env.OPENAI_API_KEY,
        _error process.env.OPENAI_API_KEY
          ? undefined
          : 'OPENAI_API_KEY environment variable not set',
        recommendations: process.env.OPENAI_API_KEY
          ? undefined
          : ['Set OPENAI_API_KEY environment variable', 'Or switch to Ollama for local embeddings'],
      };
    }
  }

  /**
   * Download/pull an embedding model (Ollama: only
   */
  async pullEmbeddingModel(model?: string)): Promise<void> {
    if (this.useOllama && this.embeddingService instanceof OllamaEmbeddingService) {
      await this.embeddingService.pullModel(model);
      this.logger.info(`Successfully pulled model: ${model || this.embeddingModel}`);
    } else {
      throw new Error('Model pulling is only available when using Ollama');
    }
  }

  /**
   * List available embedding models (Ollama: only
   */
  async listAvailableModels(): Promise<Array<{ name: string; size: number; modified_at: string, }>> {
    if (this.useOllama && this.embeddingService instanceof OllamaEmbeddingService) {
      return await this.embeddingService.listModels();
    } else {
      throw new Error('Model listing is only available when using Ollama');
    }
  }

  /**
   * Switch between Ollama and OpenAI embedding services
   */
  switchEmbeddingService(
    useOllama: boolean,
    config?: EmbeddingConfig | OllamaEmbeddingConfig
  )): void {
    this.useOllama = useOllama;

    if (useOllama) {
      const ollamaConfig = config as OllamaEmbeddingConfig;
      const model = ollamaConfig?.model || 'nomic-embed-text';
      const dimensions = ollamaConfig?.dimensions || (model === 'nomic-embed-text' ? 768 : 768);

      this.embeddingService = getOllamaEmbeddingService({
        dimensions,
        maxBatchSize: 16,
        cacheMaxSize: 10000,
        ...ollamaConfig,
        model,
      });
      this.embeddingModel = model;
      this.embeddingDimension = dimensions;
      this.logger.info(`Switched to Ollama embedding service (${model}, ${dimensions} dimensions)`);
    } else {
      const openaiConfig = config as EmbeddingConfig;
      const model = openaiConfig?.model || 'text-embedding-3-large';
      const dimensions =;
        openaiConfig?.dimensions ||
        (model === 'text-embedding-3-large'
          ? 1536
          : model === 'text-embedding-3-small'
            ? 1536
            : 1536);

      this.embeddingService = new ProductionEmbeddingService({
        dimensions,
        maxBatchSize: 32,
        cacheMaxSize: 10000,
        ...openaiConfig,
        model,
      });
      this.embeddingModel = model;
      this.embeddingDimension = dimensions;
      this.logger.info(`Switched to OpenAI embedding service (${model}, ${dimensions} dimensions)`);
    }

    // Clear caches when switching services due to different dimensions
    this.clearAllCaches();
  }

  /**
   * Get embedding service information
   */
  getEmbeddingServiceInfo(): {
    service: string;
    model: string;
    dimensions: number;
    useOllama: boolean;
  } {
    return {
      service: this.useOllama ? 'Ollama' : 'OpenAI',
      model: this.embeddingModel,
      dimensions: this.embeddingDimension,
      useOllama: this.useOllama,
    };
  }

  /**
   * Get learning insights for an agent
   */
  async getLearningInsights(agentName: string: Promise<LearningInsights> {
    try {
      return await this.accessLearner.getLearningInsights(agentName);
    } catch (error) {
      this.logger.error('Failed to get learning insight, error;
      throw error;
    }
  }

  /**
   * Calculate utility score for a memory
   */
  async calculateMemoryUtilityScore(
    memoryId: string,
    agentName: string,
    baseScore: number,
    contextualFactors?: {
      currentTime?: Date;
      queryEmbedding?: number[];
      sessionContext?: string;
      urgency?: string;
    }
  ): Promise<UtilityScore> {
    try {
      return await this.accessLearner.calculateUtilityScore(
        memoryId,
        agentName,
        baseScore,
        contextualFactors
      );
    } catch (error) {
      this.logger.error('Failed to calculate utility , error);
      throw error;
    }
  }

  /**
   * Get current adaptive weights for learning
   */
  getAdaptiveWeights(): {
    recencyWeight: number;
    frequencyWeight: number;
    similarityWeight: number;
    importanceWeight: number;
    userFeedbackWeight: number;
  } {
    return this.accessLearner.getAdaptiveWeights();
  }

  /**
   * Perform intelligent search with all enhancements enabled
   */
  async intelligentSearch(
    query: string,
    agentName: string,
    options: Partial<MemorySearchOptions> = {}
  ): Promise<{
    results: Memory[];
    queryEnrichment?: any;
    searchStrategy?: string;
    metrics?: SearchMetrics;
    utilityRankingApplied: boolean;
  }> {
    try {
      // Enable all advanced features by default
      const searchOptions: MemorySearchOptions = {
        query,
        agentFilter: agentName,
        enableMultiStage: true,
        enableUtilityRanking: true,
        recordAccess: true,
        searchStrategy: 'balanced',
        maxResults: 10,
        similarityThreshold: 0.6,
        ...options,
      };

      // Use contextual search if available
      if (this.contextualEnricher) {
        const contextualResult = await this.contextualSearch(query, searchOptions;
        return {
          results: contextualResult.results,
          queryEnrichment: contextualResult.queryEnrichment,
          searchStrategy: contextualResult.searchStrategy,
          utilityRankingApplied: !!searchOptions.enableUtilityRanking,
        };
      } else {
        // Fallback to multi-stage search
        if (searchOptions.enableMultiStage) {
          const multiStageResult = await this.multiStageSearchMemories(searchOptions);
          return {
            results: multiStageResult.results,
            metrics: multiStageResult.metrics,
            utilityRankingApplied: !!searchOptions.enableUtilityRanking,
          };
        } else {
          // Standard search
          const results = await this.searchMemories(searchOptions);
          return {
            results,
            utilityRankingApplied: !!searchOptions.enableUtilityRanking,
          };
        }
      }
    } catch (error) {
      this.logger.error('Failed to perform intelligent , error);
      throw error;
    }
  }

  /**
   * Clear all learning data and caches
   */
  clearAllLearningData()): void {
    this.clearAllCaches();
    this.accessLearner.clearCache();
  }
}

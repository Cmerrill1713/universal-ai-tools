/**
 * Vector Similarity Search Service for Graph-RAG
 * 
 * Implements efficient semantic search capabilities for the knowledge graph
 * using vector embeddings and similarity computation.
 */

import { log, LogContext } from '../../utils/logger';
import { generateEmbedding } from '../embeddings';
import type { Community } from './community-detector';
import type { Hyperedge } from './hypergraph-constructor';
import type { GraphEntity, GraphPath } from './knowledge-graph-service';
import type { MetalVectorAccelerator} from './metal-vector-accelerator';
import {metalVectorAccelerator } from './metal-vector-accelerator';

export interface SimilaritySearchResult {
  item: GraphEntity | Community | Hyperedge;
  similarity: number;
  type: 'entity' | 'community' | 'hyperedge';
  metadata?: Record<string, any>;
}

export interface SearchIndex {
  entities: Map<string, { embedding: number[]; entity: GraphEntity }>;
  communities: Map<string, { embedding: number[]; community: Community }>;
  hyperedges: Map<string, { embedding: number[]; hyperedge: Hyperedge }>;
  
  // OPTIMIZATION: Add optimized indexing structures
  entityVectors: Float32Array[];
  entityIds: string[];
  communityVectors: Float32Array[];
  communityIds: string[];
  hyperedgeVectors: Float32Array[];
  hyperedgeIds: string[];
  
  // OPTIMIZATION: Add spatial indexing (LSH)
  lshTables: Map<number, Map<string, string[]>>;
  
  lastUpdated: Date;
}

export interface SimilaritySearchOptions {
  threshold?: number;
  maxResults?: number;
  searchTypes?: ('entity' | 'community' | 'hyperedge')[];
  weightings?: {
    entity?: number;
    community?: number;
    hyperedge?: number;
  };
  includeMetadata?: boolean;
}

export class VectorSimilarityService {
  private searchIndex: SearchIndex;
  private embeddingCache: Map<string, number[]> = new Map();
  private metalAccelerator: MetalVectorAccelerator | null = null;
  private useMetalAcceleration: boolean = false;
  
  // SECURITY: Memory management constants
  private readonly MAX_CACHE_SIZE = 10000; // Limit cache to 10k entries
  private readonly MAX_EMBEDDING_DIMENSION = 2048; // Reasonable upper bound
  private readonly MAX_INDEX_SIZE = 50000; // Limit total indexed items
  private readonly CACHE_CLEANUP_THRESHOLD = 0.8; // Cleanup when 80% full
  
  // PERFORMANCE: Metal acceleration thresholds
  private readonly METAL_BATCH_THRESHOLD = 100; // Use Metal for batches > 100
  private readonly METAL_SIMILARITY_THRESHOLD = 1000; // Use Metal for similarity search > 1000 candidates
  
  constructor() {
    this.searchIndex = {
      entities: new Map(),
      communities: new Map(),
      hyperedges: new Map(),
      
      // OPTIMIZATION: Initialize optimized data structures
      entityVectors: [],
      entityIds: [],
      communityVectors: [],
      communityIds: [],
      hyperedgeVectors: [],
      hyperedgeIds: [],
      lshTables: new Map(),
      
      lastUpdated: new Date()
    };
    
    // SECURITY: Set up periodic cache cleanup
    this.setupCacheCleanup();
    
    // PERFORMANCE: Initialize Metal acceleration
    this.initializeMetalAcceleration();
  }

  /**
   * PERFORMANCE: Initialize Metal acceleration
   */
  private async initializeMetalAcceleration(): Promise<void> {
    try {
      this.metalAccelerator = metalVectorAccelerator;
      
      // Wait a bit for Metal to initialize
      setTimeout(async () => {
        if (this.metalAccelerator?.isMetalAvailable()) {
          this.useMetalAcceleration = true;
          
          const deviceInfo = this.metalAccelerator.getDeviceInformation();
          log.info('Metal acceleration enabled for vector similarity', LogContext.AI, {
            device: deviceInfo?.name || 'Apple Silicon GPU',
            batchThreshold: this.METAL_BATCH_THRESHOLD,
            similarityThreshold: this.METAL_SIMILARITY_THRESHOLD
          });
        } else {
          log.info('Metal acceleration not available, using optimized CPU implementation', LogContext.AI);
        }
      }, 100);
    } catch (error) {
      log.warn('Failed to initialize Metal acceleration, falling back to CPU', LogContext.AI, { error });
      this.useMetalAcceleration = false;
    }
  }

  /**
   * SECURITY: Validate embedding vector
   */
  private validateEmbedding(embedding: number[]): void {
    if (!Array.isArray(embedding)) {
      throw new Error('Embedding must be an array');
    }
    
    if (embedding.length === 0 || embedding.length > this.MAX_EMBEDDING_DIMENSION) {
      throw new Error(`Embedding dimension must be between 1 and ${this.MAX_EMBEDDING_DIMENSION}`);
    }
    
    // Check for invalid values
    if (embedding.some(val => !Number.isFinite(val))) {
      throw new Error('Embedding contains invalid values');
    }
  }

  /**
   * SECURITY: Check cache size and cleanup if needed
   */
  private manageCacheMemory(): void {
    if (this.embeddingCache.size >= this.MAX_CACHE_SIZE * this.CACHE_CLEANUP_THRESHOLD) {
      this.cleanupCache();
    }
  }

  /**
   * SECURITY: Cleanup old cache entries using LRU strategy
   */
  private cleanupCache(): void {
    const targetSize = Math.floor(this.MAX_CACHE_SIZE * 0.6); // Remove 40% of entries
    const entries = Array.from(this.embeddingCache.entries());
    
    // Keep most recently accessed entries (simple LRU approximation)
    entries.sort(() => Math.random() - 0.5); // Random eviction for simplicity
    
    for (let i = targetSize; i < entries.length; i++) {
      const entry = entries[i]; if (entry) { this.embeddingCache.delete(entry[0]); }
    }
    
    log.info('Cache cleanup completed', LogContext.AI, {
      previousSize: entries.length,
      newSize: this.embeddingCache.size,
      targetSize
    });
  }

  /**
   * SECURITY: Setup periodic cache cleanup
   */
  private setupCacheCleanup(): void {
    // Cleanup every 30 minutes
    setInterval(() => {
      if (this.embeddingCache.size > this.MAX_CACHE_SIZE * 0.5) {
        this.cleanupCache();
      }
    }, 30 * 60 * 1000);
  }

  /**
   * SECURITY: Validate search index size limits
   */
  private validateIndexSize(): void {
    const totalItems = this.searchIndex.entities.size + 
                      this.searchIndex.communities.size + 
                      this.searchIndex.hyperedges.size;
    
    if (totalItems >= this.MAX_INDEX_SIZE) {
      throw new Error(`Index size limit reached: ${totalItems}/${this.MAX_INDEX_SIZE}`);
    }
  }

  /**
   * OPTIMIZATION: High-performance similarity search using vectorized operations and LSH
   */
  async searchSimilar(
    query: string,
    options: SimilaritySearchOptions = {}
  ): Promise<SimilaritySearchResult[]> {
    const threshold = options.threshold ?? 0.5;
    const maxResults = options.maxResults ?? 10;
    const searchTypes = options.searchTypes ?? ['entity', 'community', 'hyperedge'];
    const weightings = options.weightings ?? { entity: 1.0, community: 0.8, hyperedge: 0.9 };
    const includeMetadata = options.includeMetadata !== false;

    // Get query embedding and convert to Float32Array for performance
    const queryEmbedding = new Float32Array(await this.getEmbedding(query));
    const results: SimilaritySearchResult[] = [];

    // OPTIMIZATION: Use LSH for approximate nearest neighbor search when index is large
    const useLSH = this.shouldUseLSH();

    if (useLSH) {
      // Fast LSH-based search
      const lshCandidates = this.getLSHCandidates(queryEmbedding, searchTypes);
      return this.evaluateLSHCandidates(
        queryEmbedding, 
        lshCandidates, 
        threshold, 
        maxResults, 
        weightings, 
        includeMetadata
      );
    }

    // OPTIMIZATION: Vectorized similarity computation with Metal acceleration
    const searchPromises: Promise<SimilaritySearchResult[]>[] = [];

    if (searchTypes.includes('entity') && this.searchIndex.entityVectors.length > 0) {
      searchPromises.push(
        this.vectorizedSimilaritySearch(
          queryEmbedding,
          this.searchIndex.entityVectors,
          this.searchIndex.entityIds,
          'entity',
          threshold,
          weightings.entity ?? 1.0,
          includeMetadata
        )
      );
    }

    if (searchTypes.includes('community') && this.searchIndex.communityVectors.length > 0) {
      searchPromises.push(
        this.vectorizedSimilaritySearch(
          queryEmbedding,
          this.searchIndex.communityVectors,
          this.searchIndex.communityIds,
          'community',
          threshold,
          weightings.community ?? 1.0,
          includeMetadata
        )
      );
    }

    if (searchTypes.includes('hyperedge') && this.searchIndex.hyperedgeVectors.length > 0) {
      searchPromises.push(
        this.vectorizedSimilaritySearch(
          queryEmbedding,
          this.searchIndex.hyperedgeVectors,
          this.searchIndex.hyperedgeIds,
          'hyperedge',
          threshold,
          weightings.hyperedge ?? 1.0,
          includeMetadata
        )
      );
    }

    // Execute all searches in parallel (Metal can handle concurrent operations)
    const searchResults = await Promise.all(searchPromises);
    searchResults.forEach(result => results.push(...result));

    // OPTIMIZATION: Use partial sort for better performance
    return this.partialSort(results, maxResults);
  }

  /**
   * Find similar entities to a given entity
   */
  async findSimilarEntities(
    targetEntity: GraphEntity,
    options: SimilaritySearchOptions = {}
  ): Promise<SimilaritySearchResult[]> {
    const threshold = options.threshold ?? 0.7;
    const maxResults = options.maxResults ?? 5;

    // Get target embedding
    const targetEmbedding = await this.getEntityEmbedding(targetEntity);
    const results: SimilaritySearchResult[] = [];

    // Convert Map to Array for proper iteration
    const entitiesArray = Array.from(this.searchIndex.entities.entries());
    
    for (const [id, item] of entitiesArray) {
      // Skip the target entity itself
      if (item.entity.id === targetEntity.id) continue;

      const similarity = this.cosineSimilarity(targetEmbedding, item.embedding);
      
      if (similarity >= threshold) {
        results.push({
          item: item.entity,
          similarity,
          type: 'entity',
          metadata: {
            id,
            targetEntityId: targetEntity.id,
            searchType: 'similar_entities'
          }
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }

  /**
   * Expand search using semantic neighborhoods
   */
  async expandSearch(
    initialResults: SimilaritySearchResult[],
    expansionFactor = 2,
    threshold = 0.6
  ): Promise<SimilaritySearchResult[]> {
    const expandedResults = [...initialResults];
    const processedIds = new Set(initialResults.map(r => this.getItemId(r.item)));

    for (const result of initialResults) {
      const itemEmbedding = await this.getItemEmbedding(result.item, result.type);
      
      // Find similar items
      const similarItems = await this.findSimilarToEmbedding(
        itemEmbedding,
        result.type,
        threshold,
        expansionFactor
      );

      for (const similar of similarItems) {
        const itemId = this.getItemId(similar.item);
        if (!processedIds.has(itemId)) {
          expandedResults.push({
            ...similar,
            similarity: similar.similarity * 0.8, // Reduced weight for expanded results
            metadata: {
              ...similar.metadata,
              expandedFrom: this.getItemId(result.item),
              isExpanded: true
            }
          });
          processedIds.add(itemId);
        }
      }
    }

    return expandedResults.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Perform hybrid search combining semantic and structural features
   */
  async hybridSearch(
    query: string,
    structuralContext: {
      relatedEntities?: string[];
      pathContext?: GraphPath[];
      communityContext?: Community[];
    } = {},
    options: SimilaritySearchOptions = {}
  ): Promise<SimilaritySearchResult[]> {
    const semanticResults = await this.searchSimilar(query, options);
    
    // Boost results that have structural connections
    const hybridResults = await Promise.all(
      semanticResults.map(async (result) => {
        let structuralBoost = 0;

        // Boost based on related entities
        if (structuralContext.relatedEntities && result.type === 'entity') {
          const entity = result.item as GraphEntity;
          const entityId = entity.id;
          
          if (structuralContext.relatedEntities.includes(entityId)) {
            structuralBoost += 0.2;
          }
        }

        // Boost based on path context
        if (structuralContext.pathContext) {
          for (const path of structuralContext.pathContext) {
            const pathEntityIds = path.nodes.map(n => n.id);
            
            if (result.type === 'entity') {
              const entity = result.item as GraphEntity;
              if (pathEntityIds.includes(entity.id)) {
                structuralBoost += 0.1;
              }
            }
          }
        }

        // Boost based on community context
        if (structuralContext.communityContext && result.type === 'entity') {
          const entity = result.item as GraphEntity;
          
          for (const community of structuralContext.communityContext) {
            if (community.nodeIds.includes(entity.id)) {
              structuralBoost += 0.15;
            }
          }
        }

        return {
          ...result,
          similarity: Math.min(1, result.similarity + structuralBoost),
          metadata: {
            ...result.metadata,
            structuralBoost,
            searchType: 'hybrid'
          }
        };
      })
    );

    return hybridResults.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * OPTIMIZATION: Batch index entities with vectorized storage and LSH
   */
  async indexEntities(entities: GraphEntity[]): Promise<void> {
    // SECURITY: Validate input
    if (!Array.isArray(entities)) {
      throw new Error('Entities must be an array');
    }

    // SECURITY: Limit batch size
    const limitedEntities = entities.slice(0, 1000);
    
    log.info('Indexing entities for similarity search', LogContext.AI, {
      requestedCount: entities.length,
      actualCount: limitedEntities.length
    });

    // OPTIMIZATION: Batch process embeddings
    const embeddingPromises = limitedEntities.map(async (entity) => {
      try {
        this.validateIndexSize();
        const embedding = await this.getEntityEmbedding(entity);
        return { entity, embedding };
      } catch (error) {
        log.warn('Failed to process entity', LogContext.AI, {
          entityId: entity.id,
          error
        });
        return null;
      }
    });

    const embeddingResults = await Promise.all(embeddingPromises);
    const validResults = embeddingResults.filter((result): result is { entity: GraphEntity; embedding: number[] } => result !== null);

    // OPTIMIZATION: Build optimized data structures
    const newVectors: Float32Array[] = [];
    const newIds: string[] = [];

    for (const result of validResults) {
      // Store in original Map for backwards compatibility
      this.searchIndex.entities.set(result.entity.id, {
        embedding: result.embedding,
        entity: result.entity
      });

      // OPTIMIZATION: Store in optimized arrays for vectorized operations
      newVectors.push(new Float32Array(result.embedding));
      newIds.push(result.entity.id);
    }

    // Update optimized storage
    this.searchIndex.entityVectors = newVectors;
    this.searchIndex.entityIds = newIds;

    // OPTIMIZATION: Build LSH index if needed
    if (newVectors.length > 1000) {
      this.buildLSHIndex('entity', newVectors, newIds);
    }

    this.searchIndex.lastUpdated = new Date();
    log.info('Optimized entity indexing completed', LogContext.AI, {
      indexed: this.searchIndex.entities.size,
      vectorized: newVectors.length,
      useLSH: newVectors.length > 1000
    });
  }

  /**
   * Index communities for similarity search
   */
  async indexCommunities(communities: Community[]): Promise<void> {
    log.info('Indexing communities for similarity search', LogContext.AI, {
      count: communities.length
    });

    for (const community of communities) {
      try {
        const embedding = community.centroid ?? await this.getCommunityEmbedding(community);
        this.searchIndex.communities.set(community.id, {
          embedding,
          community
        });
      } catch (error) {
        log.warn('Failed to index community', LogContext.AI, {
          communityId: community.id,
          error
        });
      }
    }

    this.searchIndex.lastUpdated = new Date();
  }

  /**
   * Index hyperedges for similarity search
   */
  async indexHyperedges(hyperedges: Hyperedge[]): Promise<void> {
    log.info('Indexing hyperedges for similarity search', LogContext.AI, {
      count: hyperedges.length
    });

    for (const hyperedge of hyperedges) {
      try {
        const embedding = hyperedge.embedding ?? await this.getHyperedgeEmbedding(hyperedge);
        this.searchIndex.hyperedges.set(hyperedge.id, {
          embedding,
          hyperedge
        });
      } catch (error) {
        log.warn('Failed to index hyperedge', LogContext.AI, {
          hyperedgeId: hyperedge.id,
          error
        });
      }
    }

    this.searchIndex.lastUpdated = new Date();
  }

  /**
   * Batch update index with multiple item types
   */
  async updateIndex(data: {
    entities?: GraphEntity[];
    communities?: Community[];
    hyperedges?: Hyperedge[];
  }): Promise<void> {
    const promises: Promise<void>[] = [];

    if (data.entities) {
      promises.push(this.indexEntities(data.entities));
    }

    if (data.communities) {
      promises.push(this.indexCommunities(data.communities));
    }

    if (data.hyperedges) {
      promises.push(this.indexHyperedges(data.hyperedges));
    }

    await Promise.all(promises);
  }

  /**
   * Private helper methods
   */
  private async getEmbedding(text: string): Promise<number[]> {
    // SECURITY: Validate input
    if (!text || typeof text !== 'string') {
      throw new Error('Text must be a non-empty string');
    }
    
    // SECURITY: Limit text length
    const sanitizedText = text.substring(0, 8000); // Limit to 8k chars
    const cacheKey = `text:${sanitizedText}`;
    
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // SECURITY: Check cache memory before adding
    this.manageCacheMemory();

    try {
      const embedding = await generateEmbedding(sanitizedText); if (!embedding) { throw new Error("Failed to generate embedding: null result"); }
      
      // SECURITY: Validate embedding before caching
      this.validateEmbedding(embedding);
      
      this.embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      log.error('Failed to generate embedding', LogContext.AI, {
        textLength: sanitizedText.length,
        error
      });
      throw error;
    }
  }

  private async getEntityEmbedding(entity: GraphEntity): Promise<number[]> {
    const cacheKey = `entity:${entity.id}`;
    
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Fix: Use properties.description instead of entity.description
    const description = entity.properties?.description ?? '';
    const text = `${entity.name} ${entity.type} ${description}`.trim();
    const embedding = await this.getEmbedding(text);
    this.embeddingCache.set(cacheKey, embedding);
    
    return embedding;
  }

  private async getCommunityEmbedding(community: Community): Promise<number[]> {
    const cacheKey = `community:${community.id}`;
    
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const text = `${community.label} ${community.summary}`;
    const embedding = await this.getEmbedding(text);
    this.embeddingCache.set(cacheKey, embedding);
    
    return embedding;
  }

  private async getHyperedgeEmbedding(hyperedge: Hyperedge): Promise<number[]> {
    const cacheKey = `hyperedge:${hyperedge.id}`;
    
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const text = `${hyperedge.type} ${hyperedge.context}`;
    const embedding = await this.getEmbedding(text);
    this.embeddingCache.set(cacheKey, embedding);
    
    return embedding;
  }

  private async getItemEmbedding(
    item: GraphEntity | Community | Hyperedge,
    type: 'entity' | 'community' | 'hyperedge'
  ): Promise<number[]> {
    switch (type) {
      case 'entity':
        return this.getEntityEmbedding(item as GraphEntity);
      case 'community':
        return this.getCommunityEmbedding(item as Community);
      case 'hyperedge':
        return this.getHyperedgeEmbedding(item as Hyperedge);
      default:
        throw new Error(`Unknown item type: ${type}`);
    }
  }

  private getItemId(item: GraphEntity | Community | Hyperedge): string {
    return item.id;
  }

  private async findSimilarToEmbedding(
    targetEmbedding: number[],
    type: 'entity' | 'community' | 'hyperedge',
    threshold: number,
    maxResults: number
  ): Promise<SimilaritySearchResult[]> {
    const results: SimilaritySearchResult[] = [];
    let searchMap: Map<string, any>;

    switch (type) {
      case 'entity':
        searchMap = this.searchIndex.entities;
        break;
      case 'community':
        searchMap = this.searchIndex.communities;
        break;
      case 'hyperedge':
        searchMap = this.searchIndex.hyperedges;
        break;
      default:
        return [];
    }

    // Convert Map to Array for proper iteration
    const searchArray = Array.from(searchMap.entries());
    
    for (const [id, item] of searchArray) {
      const similarity = this.cosineSimilarity(targetEmbedding, item.embedding);
      
      if (similarity >= threshold) {
        results.push({
          item: type === 'entity' ? item.entity : type === 'community' ? item.community : item.hyperedge,
          similarity,
          type,
          metadata: { id }
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i]; const bVal = b[i]; if (aVal !== undefined && bVal !== undefined) { dotProduct += aVal * bVal; }
      const aVal2 = a[i]; if (aVal2 !== undefined) { normA += aVal2 * aVal2; }
      const bVal2 = b[i]; if (bVal2 !== undefined) { normB += bVal2 * bVal2; }
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Get search index statistics
   */
  getIndexStatistics() {
    return {
      entities: this.searchIndex.entities.size,
      communities: this.searchIndex.communities.size,
      hyperedges: this.searchIndex.hyperedges.size,
      lastUpdated: this.searchIndex.lastUpdated,
      cacheSize: this.embeddingCache.size
    };
  }

  /**
   * Clear the search index
   */
  clearIndex(): void {
    this.searchIndex.entities.clear();
    this.searchIndex.communities.clear();
    this.searchIndex.hyperedges.clear();
    
    // OPTIMIZATION: Clear optimized structures
    this.searchIndex.entityVectors = [];
    this.searchIndex.entityIds = [];
    this.searchIndex.communityVectors = [];
    this.searchIndex.communityIds = [];
    this.searchIndex.hyperedgeVectors = [];
    this.searchIndex.hyperedgeIds = [];
    this.searchIndex.lshTables.clear();
    
    this.embeddingCache.clear();
    this.searchIndex.lastUpdated = new Date();
  }

  /**
   * OPTIMIZATION: Vectorized similarity search for improved performance
   */
  private async vectorizedSimilaritySearch(
    queryEmbedding: Float32Array,
    vectors: Float32Array[],
    ids: string[],
    type: 'entity' | 'community' | 'hyperedge',
    threshold: number,
    weight: number,
    includeMetadata: boolean
  ): Promise<SimilaritySearchResult[]> {
    const results: SimilaritySearchResult[] = [];
    
    // PERFORMANCE: Use Metal acceleration for large vector sets
    if (this.useMetalAcceleration && this.metalAccelerator && vectors.length >= this.METAL_SIMILARITY_THRESHOLD) {
      try {
        const metalResults = await this.metalAccelerator.batchSimilaritySearch(
          queryEmbedding,
          vectors,
          threshold / weight // Adjust threshold for pre-weighting
        );
        
        // Convert Metal results to SimilaritySearchResult format
        for (const metalResult of metalResults) {
          if (metalResult.index < ids.length) {
            let item: any;
            
            switch (type) {
              case 'entity':
                const entityIndex = ids[metalResult.index]; if (entityIndex) { item = this.searchIndex.entities.get(entityIndex)?.entity; }
                break;
              case 'community':
                const communityIndex = ids[metalResult.index]; if (communityIndex) { item = this.searchIndex.communities.get(communityIndex)?.community; }
                break;
              case 'hyperedge':
                const hyperedgeIndex = ids[metalResult.index]; if (hyperedgeIndex) { item = this.searchIndex.hyperedges.get(hyperedgeIndex)?.hyperedge; }
                break;
            }
            
            if (item) {
              const weightedSimilarity = metalResult.similarity * weight;
              results.push({
                item,
                similarity: weightedSimilarity,
                type,
                metadata: includeMetadata ? {
                  id: ids[metalResult.index],
                  searchType: type,
                  originalSimilarity: metalResult.similarity,
                  accelerated: 'metal'
                } : undefined
              });
            }
          }
        }
        
        log.debug('Metal-accelerated similarity search completed', LogContext.AI, {
          type,
          candidates: vectors.length,
          results: results.length,
          threshold,
          performance: this.metalAccelerator.getPerformanceMetrics()
        });
        
        return results;
      } catch (error) {
        log.warn('Metal acceleration failed, falling back to CPU', LogContext.AI, { error, type });
        // Fall through to CPU implementation
      }
    }
    
    // OPTIMIZATION: CPU-based batch similarity computation with SIMD-friendly operations
    for (let i = 0; i < vectors.length; i++) {
      const vector = vectors[i]; if (!vector) continue; const similarity = this.fastCosineSimilarity(queryEmbedding, vector) * weight;
      
      if (similarity >= threshold) {
        let item: any;
        
        switch (type) {
          case 'entity':
            const id = ids[i]; if (id) { item = this.searchIndex.entities.get(id)?.entity; }
            break;
          case 'community':
            const communityId = ids[i]; if (communityId) { item = this.searchIndex.communities.get(communityId)?.community; }
            break;
          case 'hyperedge':
            const hyperedgeId = ids[i]; if (hyperedgeId) { item = this.searchIndex.hyperedges.get(hyperedgeId)?.hyperedge; }
            break;
        }
        
        if (item) {
          results.push({
            item,
            similarity,
            type,
            metadata: includeMetadata ? {
              id: ids[i],
              searchType: type,
              originalSimilarity: similarity / weight,
              accelerated: 'cpu'
            } : undefined
          });
        }
      }
    }
    
    return results;
  }

  /**
   * OPTIMIZATION: Fast cosine similarity using Float32Array
   */
  private fastCosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    // OPTIMIZATION: Unrolled loop for better performance
    const len = a.length;
    let i = 0;
    
    // Process 4 elements at a time for better cache utilization
    for (; i < len - 3; i += 4) {
      const a0 = a[i] ?? 0, a1 = a[i + 1] ?? 0, a2 = a[i + 2] ?? 0, a3 = a[i + 3] ?? 0;
      const b0 = b[i] ?? 0, b1 = b[i + 1] ?? 0, b2 = b[i + 2] ?? 0, b3 = b[i + 3] ?? 0;
      
      dotProduct += a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;
      normA += a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
      normB += b0 * b0 + b1 * b1 + b2 * b2 + b3 * b3;
    }
    
    // Process remaining elements
    for (; i < len; i++) {
      const aVal = a[i]; const bVal = b[i]; if (aVal !== undefined && bVal !== undefined) { dotProduct += aVal * bVal; }
      const aVal2 = a[i]; if (aVal2 !== undefined) { normA += aVal2 * aVal2; }
      const bVal2 = b[i]; if (bVal2 !== undefined) { normB += bVal2 * bVal2; }
    }
    
    const denominator = Math.sqrt(normA * normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * OPTIMIZATION: Partial sort for top-k results
   */
  private partialSort(results: SimilaritySearchResult[], k: number): SimilaritySearchResult[] {
    if (results.length <= k) {
      return results.sort((a, b) => b.similarity - a.similarity);
    }
    
    // Use quickselect for better performance on large result sets
    const partition = (arr: SimilaritySearchResult[], low: number, high: number): number => {
      const pivotItem = arr[high]; if (!pivotItem) return low; const pivot = pivotItem.similarity;
      let i = low - 1;
      
      for (let j = low; j < high; j++) {
        const currentItem = arr[j]; if (currentItem && currentItem.similarity >= pivot) {
          i++;
          const itemI = arr[i]; const itemJ = arr[j]; if (itemI && itemJ) { arr[i] = itemJ; arr[j] = itemI; }
        }
      }
      
      const itemNext = arr[i + 1]; const itemHigh = arr[high]; if (itemNext && itemHigh) { arr[i + 1] = itemHigh; arr[high] = itemNext; }
      return i + 1;
    };
    
    const quickSelect = (arr: SimilaritySearchResult[], low: number, high: number, k: number): void => {
      if (low < high) {
        const pi = partition(arr, low, high);
        
        if (pi === k) return;
        else if (pi > k) quickSelect(arr, low, pi - 1, k);
        else quickSelect(arr, pi + 1, high, k);
      }
    };
    
    quickSelect(results, 0, results.length - 1, k);
    return results.slice(0, k).sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * OPTIMIZATION: LSH-based approximate nearest neighbor search
   */
  private shouldUseLSH(): boolean {
    const totalVectors = this.searchIndex.entityVectors.length + 
                        this.searchIndex.communityVectors.length + 
                        this.searchIndex.hyperedgeVectors.length;
    return totalVectors > 5000; // Use LSH for large indexes
  }

  private buildLSHIndex(
    type: 'entity' | 'community' | 'hyperedge',
    vectors: Float32Array[],
    ids: string[]
  ): void {
    const numTables = 5; // Number of hash tables
    const hashSize = 10; // Number of hash functions per table
    
    for (let table = 0; table < numTables; table++) {
      if (!this.searchIndex.lshTables.has(table)) {
        this.searchIndex.lshTables.set(table, new Map());
      }
      
      const hashTable = this.searchIndex.lshTables.get(table);
      if (!hashTable) continue;
      
      for (let i = 0; i < vectors.length; i++) {
        const vector = vectors[i]; if (!vector) continue; const hash = this.computeLSHHash(vector, table, hashSize);
        const bucket = hashTable.get(hash) ?? [];
        bucket.push(`${type}:${ids[i]}`);
        hashTable.set(hash, bucket);
      }
    }
  }

  private computeLSHHash(vector: Float32Array, table: number, hashSize: number): string {
    // Simple random projection LSH
    let hash = '';
    const seed = table * 1000; // Different seed per table
    
    for (let i = 0; i < hashSize; i++) {
      let projection = 0;
      for (let j = 0; j < vector.length; j++) {
        // Pseudo-random projection vector
        const random = Math.sin(seed + i * vector.length + j) * 10000;
        const vectorVal = vector[j]; if (vectorVal !== undefined) { projection += vectorVal * (random - Math.floor(random)); }
      }
      hash += projection > 0 ? '1' : '0';
    }
    
    return hash;
  }

  private getLSHCandidates(
    queryEmbedding: Float32Array,
    searchTypes: string[]
  ): Set<string> {
    const candidates = new Set<string>();
    
    // Convert Map to Array for proper iteration
    const lshTablesArray = Array.from(this.searchIndex.lshTables.entries());
    
    for (const [table, hashTable] of lshTablesArray) {
      const queryHash = this.computeLSHHash(queryEmbedding, table, 10);
      const bucket = hashTable.get(queryHash) ?? [];
      
      for (const candidate of bucket) {
        const parts = candidate.split(":"); const type = parts[0];
        if (type && searchTypes.includes(type)) {
          candidates.add(candidate);
        }
      }
    }
    
    return candidates;
  }

  private evaluateLSHCandidates(
    queryEmbedding: Float32Array,
    candidates: Set<string>,
    threshold: number,
    maxResults: number,
    weightings: any,
    includeMetadata: boolean
  ): SimilaritySearchResult[] {
    const results: SimilaritySearchResult[] = [];
    
    // Convert Set to Array for proper iteration
    const candidatesArray = Array.from(candidates);
    
    for (const candidate of candidatesArray) {
      const parts2 = candidate.split(":"); const type = parts2[0]; const id = parts2[1];
      let item: any;
      let embedding: Float32Array | undefined;
      let weight = 1.0;
      
      switch (type) {
        case 'entity':
          const entityData = id ? this.searchIndex.entities.get(id) : undefined;
          if (entityData) {
            item = entityData.entity;
            embedding = new Float32Array(entityData.embedding);
            weight = weightings.entity ?? 1.0;
          }
          break;
        case 'community':
          const communityData = id ? this.searchIndex.communities.get(id) : undefined;
          if (communityData) {
            item = communityData.community;
            embedding = new Float32Array(communityData.embedding);
            weight = weightings.community ?? 1.0;
          }
          break;
        case 'hyperedge':
          const hyperedgeData = id ? this.searchIndex.hyperedges.get(id) : undefined;
          if (hyperedgeData) {
            item = hyperedgeData.hyperedge;
            embedding = new Float32Array(hyperedgeData.embedding);
            weight = weightings.hyperedge ?? 1.0;
          }
          break;
      }
      
      if (item && embedding) {
        const similarity = this.fastCosineSimilarity(queryEmbedding, embedding) * weight;
        
        if (similarity >= threshold) {
          results.push({
            item,
            similarity,
            type: type as 'entity' | 'community' | 'hyperedge',
            metadata: includeMetadata ? {
              id,
              searchType: 'lsh',
              originalSimilarity: similarity / weight
            } : undefined
          });
        }
      }
    }
    
    return this.partialSort(results, maxResults);
  }
}

// Export singleton instance
export const vectorSimilarityService = new VectorSimilarityService();

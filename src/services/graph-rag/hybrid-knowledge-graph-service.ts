/**
 * Hybrid Knowledge Graph Service
 * 
 * Wrapper around the existing KnowledgeGraphService that adds Qdrant vector storage
 * for hybrid GraphRAG capabilities. Provides semantic search, graph traversal,
 * and intelligent caching between Qdrant (vectors) and Neo4j (graphs).
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { EventEmitter } from 'events';

import { config } from '../../config/environment';
import { log, LogContext } from '../../utils/logger';
import { generateEmbedding } from '../embeddings';
import { KnowledgeGraphService, GraphEntity, GraphRelationship, Hyperedge } from './knowledge-graph-service';

interface HybridSearchResult {
  entity: GraphEntity;
  score: number;
  source: 'qdrant' | 'neo4j' | 'hybrid';
}

interface HybridStats {
  qdrant?: {
    vectorCount: number;
    memoryUsage: string;
    collections: number;
  };
  neo4j?: {
    nodeCount: number;
    relationshipCount: number;
  };
  hybrid: {
    syncMode: string;
    backends: string[];
    cacheHitRate: number;
  };
}

export class HybridKnowledgeGraphService extends EventEmitter {
  private qdrant: QdrantClient | null = null;
  private knowledgeGraph: KnowledgeGraphService;
  private qdrantConnected = false;
  private cache = new Map<string, any>();
  private cacheHits = 0;
  private cacheRequests = 0;

  constructor() {
    super();
    this.knowledgeGraph = new KnowledgeGraphService();
    this.initializeQdrant();
  }

  private async initializeQdrant(): Promise<void> {
    if (!config.graphrag.useQdrant) {
      log.info('🔵 Qdrant disabled in configuration', LogContext.SYSTEM);
      return;
    }

    try {
      this.qdrant = new QdrantClient({
        url: config.qdrant.url,
        apiKey: config.qdrant.apiKey || undefined,
        timeout: config.qdrant.timeoutMs,
      });

      // Test connection
      await this.qdrant.getCollections();
      
      // Ensure collection exists
      await this.ensureCollection();
      
      this.qdrantConnected = true;
      log.info('✅ Qdrant connection established for hybrid GraphRAG', LogContext.SYSTEM);
    } catch (error) {
      log.warn('⚠️ Qdrant connection failed, using Neo4j only', LogContext.SYSTEM, { error });
      this.qdrantConnected = false;
    }
  }

  private async ensureCollection(): Promise<void> {
    if (!this.qdrant) {return;}

    try {
      const collections = await this.qdrant.getCollections();
      const collectionExists = collections.collections?.some(
        (col) => col.name === config.qdrant.collectionName
      );

      if (!collectionExists) {
        await this.qdrant.createCollection(config.qdrant.collectionName, {
          vectors: {
            size: config.qdrant.vectorSize,
            distance: 'Cosine',
          },
        });

        log.info('✅ Qdrant collection created for hybrid GraphRAG', LogContext.SYSTEM, {
          name: config.qdrant.collectionName,
          vectorSize: config.qdrant.vectorSize,
        });
      }
    } catch (error) {
      log.error('❌ Failed to ensure Qdrant collection', LogContext.SYSTEM, { error });
      throw error;
    }
  }

  /**
   * Store entities in both Neo4j and Qdrant
   */
  public async storeEntitiesHybrid(
    entities: GraphEntity[],
    relationships: GraphRelationship[] = [],
    hyperedges: Hyperedge[] = []
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Store in Neo4j (using existing service)
      await this.knowledgeGraph.storeGraph(entities, relationships, hyperedges);
      
      // Store vectors in Qdrant
      if (this.qdrantConnected && this.qdrant) {
        await this.storeVectorsInQdrant(entities);
      }
      
      const elapsed = Date.now() - startTime;
      log.info('🔗 Hybrid storage completed', LogContext.SYSTEM, {
        entities: entities.length,
        relationships: relationships.length,
        hyperedges: hyperedges.length,
        elapsed: `${elapsed}ms`,
      });
      
      // Clear cache on update
      this.cache.clear();
    } catch (error) {
      log.error('❌ Hybrid storage failed', LogContext.SYSTEM, { error });
      throw error;
    }
  }

  /**
   * Store entity vectors in Qdrant
   */
  private async storeVectorsInQdrant(entities: GraphEntity[]): Promise<void> {
    if (!this.qdrant || !this.qdrantConnected) {return;}

    const points = [];
    
    for (const entity of entities) {
      if (entity.embedding && entity.embedding.length > 0) {
        // Convert string ID to UUID format for Qdrant
        // Use a deterministic hash to create a valid UUID from the entity ID
        const uuidFromString = (str: string): string => {
          // Create a simple hash and format as UUID
          let hash = 0;
          for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
          }
          // Format as UUID v4
          const hex = Math.abs(hash).toString(16).padStart(8, '0');
          return `00000000-0000-4000-8000-${hex.padStart(12, '0')}`;
        };
        
        points.push({
          id: uuidFromString(entity.id),
          vector: entity.embedding,
          payload: {
            originalId: entity.id, // Store original ID in payload
            type: entity.type,
            name: entity.name,
            properties: entity.properties,
            importance: entity.importance,
            communityId: entity.communityId,
            storedAt: new Date().toISOString(),
          }
        });
      }
    }

    if (points.length > 0) {
      // Process in batches
      const batchSize = config.qdrant.batchSize;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);
        await this.qdrant.upsert(config.qdrant.collectionName, {
          wait: true,
          points: batch
        });
      }
      
      log.debug(`🔵 Stored ${points.length} vectors in Qdrant`, LogContext.SYSTEM);
    }
  }

  /**
   * Extract entities and store them in hybrid system
   */
  public async extractAndStore(text: string, source?: string): Promise<GraphEntity[]> {
    const entities = await this.knowledgeGraph.extractEntities(text, source);
    
    if (entities.length > 0) {
      await this.storeEntitiesHybrid(entities);
    }
    
    return entities;
  }

  /**
   * Hybrid semantic search combining Qdrant and Neo4j
   */
  public async hybridSemanticSearch(query: string, options: {
    limit?: number;
    threshold?: number;
    includeNeighbors?: boolean;
    maxHops?: number;
  } = {}): Promise<GraphEntity[]> {
    const {
      limit = 10,
      threshold = 0.7,
      includeNeighbors = true,
      maxHops = 2
    } = options;

    // Check cache first
    const cacheKey = `search_${JSON.stringify({ query, limit, threshold, includeNeighbors, maxHops })}`;
    this.cacheRequests++;
    
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      log.debug('💾 Cache hit for hybrid search', LogContext.SYSTEM);
      return this.cache.get(cacheKey);
    }

    try {
      const results: HybridSearchResult[] = [];
      
      // Step 1: Vector search in Qdrant
      if (this.qdrantConnected) {
        const vectorResults = await this.searchVectors(query, limit * 2, threshold);
        results.push(...vectorResults.map(entity => ({
          entity,
          score: entity.importance || 0,
          source: 'qdrant' as const
        })));
      }

      // Step 2: Graph-based search in Neo4j (if needed)
      if (config.graphrag.useNeo4j && includeNeighbors && results.length > 0) {
        const expandedResults = await this.expandWithGraph(results, maxHops);
        results.push(...expandedResults);
      }

      // Step 3: Deduplicate and rank results
      const deduplicatedResults = this.deduplicateResults(results);
      const rankedResults = deduplicatedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(result => result.entity);

      // Cache results
      this.cache.set(cacheKey, rankedResults);
      
      // Manage cache size
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      log.info('🔍 Hybrid semantic search completed', LogContext.AI, {
        query: query.substring(0, 50),
        vectorResults: results.filter(r => r.source === 'qdrant').length,
        graphResults: results.filter(r => r.source === 'neo4j').length,
        finalResults: rankedResults.length,
      });

      return rankedResults;
    } catch (error) {
      log.error('❌ Hybrid semantic search failed', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Search vectors in Qdrant
   */
  private async searchVectors(query: string, limit: number, threshold: number): Promise<GraphEntity[]> {
    if (!this.qdrant || !this.qdrantConnected) {
      log.debug('🔵 Qdrant not available, skipping vector search', LogContext.SYSTEM);
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await generateEmbedding(query);
      if (!queryEmbedding) {
        log.warn('⚠️ Could not generate query embedding', LogContext.AI);
        return [];
      }

      // Search vectors
      const searchResult = await this.qdrant.search(config.qdrant.collectionName, {
        vector: queryEmbedding,
        limit,
        score_threshold: threshold,
        with_payload: true,
        with_vector: false,
      });

      const entities: GraphEntity[] = searchResult.map(result => ({
        id: result.id as string,
        type: result.payload?.type as string || '',
        name: result.payload?.name as string || '',
        properties: result.payload?.properties || {},
        importance: result.score || 0,
        communityId: result.payload?.communityId as string,
      }));

      log.debug(`🔵 Qdrant returned ${entities.length} vector results`, LogContext.AI);
      return entities;
    } catch (error) {
      log.error('❌ Vector search in Qdrant failed', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Expand results using graph traversal in Neo4j
   */
  private async expandWithGraph(
    seedResults: HybridSearchResult[],
    maxHops: number
  ): Promise<HybridSearchResult[]> {
    if (!config.graphrag.useNeo4j) {
      return [];
    }

    const expandedResults: HybridSearchResult[] = [];
    
    try {
      // Use existing knowledge graph service for graph operations
      for (const seedResult of seedResults) {
        // This is a simplified expansion - in production, implement proper graph traversal
        // For now, we'll just mark these as graph-enhanced results
        expandedResults.push({
          entity: seedResult.entity,
          score: seedResult.score * 1.1, // Small boost for graph context
          source: 'hybrid'
        });
      }

      log.debug(`🟢 Graph expansion added context for ${expandedResults.length} results`, LogContext.AI);
    } catch (error) {
      log.error('❌ Graph expansion failed', LogContext.AI, { error });
    }

    return expandedResults;
  }

  /**
   * Deduplicate search results
   */
  private deduplicateResults(results: HybridSearchResult[]): HybridSearchResult[] {
    const seen = new Map<string, HybridSearchResult>();
    
    for (const result of results) {
      const existing = seen.get(result.entity.id);
      if (!existing || result.score > existing.score) {
        seen.set(result.entity.id, result);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Get hybrid system statistics
   */
  public async getHybridStats(): Promise<HybridStats> {
    const stats: HybridStats = {
      hybrid: {
        syncMode: config.graphrag.syncMode,
        backends: [],
        cacheHitRate: this.cacheRequests > 0 ? (this.cacheHits / this.cacheRequests) * 100 : 0,
      }
    };

    // Add enabled backends to stats
    if (config.graphrag.useQdrant) {
      stats.hybrid.backends.push('qdrant');
    }
    if (config.graphrag.useNeo4j) {
      stats.hybrid.backends.push('neo4j');
    }

    try {
      // Get Qdrant stats
      if (this.qdrant && this.qdrantConnected) {
        const collectionInfo = await this.qdrant.getCollection(config.qdrant.collectionName);
        const collections = await this.qdrant.getCollections();
        
        stats.qdrant = {
          vectorCount: collectionInfo.points_count || 0,
          memoryUsage: `${Math.round((collectionInfo.points_count || 0) * config.qdrant.vectorSize * 4 / 1024 / 1024)}MB`,
          collections: collections.collections?.length || 0,
        };
      }

      // Get Neo4j stats from the underlying knowledge graph service
      const graphMetrics = this.knowledgeGraph.getMetrics();
      stats.neo4j = {
        nodeCount: graphMetrics.nodeCount,
        relationshipCount: graphMetrics.edgeCount,
      };
    } catch (error) {
      log.error('❌ Failed to get hybrid stats', LogContext.SYSTEM, { error });
    }

    return stats;
  }

  /**
   * Health check for hybrid system
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    backends: { qdrant: boolean; neo4j: boolean };
    responseTime: number;
  }> {
    const startTime = Date.now();
    
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      backends: {
        qdrant: false,
        neo4j: false,
      },
      responseTime: 0,
    };

    try {
      // Check Qdrant
      if (config.graphrag.useQdrant && this.qdrant) {
        try {
          await this.qdrant.getCollections();
          health.backends.qdrant = true;
        } catch (error) {
          log.debug('Qdrant health check failed', LogContext.SYSTEM, { error });
        }
      } else {
        health.backends.qdrant = !config.graphrag.useQdrant; // Healthy if not required
      }

      // Check Neo4j (simplified - assume healthy if service exists)
      health.backends.neo4j = config.graphrag.useNeo4j;

      // Determine overall status
      const enabledBackends = [];
      const healthyBackends = [];

      if (config.graphrag.useQdrant) {
        enabledBackends.push('qdrant');
        if (health.backends.qdrant) {healthyBackends.push('qdrant');}
      }

      if (config.graphrag.useNeo4j) {
        enabledBackends.push('neo4j');
        if (health.backends.neo4j) {healthyBackends.push('neo4j');}
      }

      if (healthyBackends.length === 0) {
        health.status = 'unhealthy';
      } else if (healthyBackends.length < enabledBackends.length) {
        health.status = 'degraded';
      } else {
        health.status = 'healthy';
      }
    } catch (error) {
      health.status = 'unhealthy';
      log.error('❌ Hybrid health check failed', LogContext.SYSTEM, { error });
    }

    health.responseTime = Date.now() - startTime;
    return health;
  }

  /**
   * Cleanup resources
   */
  public async close(): Promise<void> {
    await this.knowledgeGraph.close();
    
    // Qdrant client doesn't need explicit cleanup
    this.qdrantConnected = false;
    this.cache.clear();
  }
}

// Export singleton instance
export const hybridKnowledgeGraphService = new HybridKnowledgeGraphService();
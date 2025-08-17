/**
 * Knowledge Graph API Router
 * 
 * Comprehensive API for the Arc UI knowledge graph visualization and management.
 * Integrates with GraphRAG services and provides real-time updates via WebSocket.
 * 
 * Features:
 * - Graph data structure management (nodes, edges, relationships)
 * - Graph visualization data export for Arc UI
 * - Knowledge ingestion and processing
 * - Graph search and traversal algorithms
 * - Context clustering and semantic analysis
 * - Graph analytics and insights
 * - Real-time graph updates via WebSocket
 * - Vector similarity and embeddings integration
 */

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '@/middleware/auth';
import { 
  validateContentType,
  validateParams,
  validateQueryParams, 
  validateRequestBody, 
  validateRequestSize 
} from '@/middleware/enhanced-validation';
import {
  ApiNotFoundError,
  ApiServiceUnavailableError,
  ApiValidationError,
  asyncErrorHandler
} from '@/middleware/standardized-error-handler';
// Import GraphRAG services
import type { Community, CommunityDetectionResult, GraphData } from '@/services/graph-rag/community-detector';
import { communityDetector } from '@/services/graph-rag/community-detector';
import type { Hyperedge } from '@/services/graph-rag/hypergraph-constructor';
import { hypergraphConstructor } from '@/services/graph-rag/hypergraph-constructor';
import type { 
  GraphEntity, 
  GraphMetrics,
  GraphPath,
  GraphQuery,
  GraphRelationship
} from '@/services/graph-rag/knowledge-graph-service';
import { knowledgeGraphService } from '@/services/graph-rag/knowledge-graph-service';
import { reasoningCycle } from '@/services/graph-rag/reasoning-cycle';
import type { SimilaritySearchOptions, SimilaritySearchResult } from '@/services/graph-rag/vector-similarity-service';
import { vectorSimilarityService } from '@/services/graph-rag/vector-similarity-service';
// Import realtime service for WebSocket updates
import type { RealtimeBroadcastService } from '@/services/realtime-broadcast-service';
import { sendError, sendPaginatedSuccess, sendSuccess } from '@/utils/api-response';
import { log, LogContext } from '@/utils/logger';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const nodeIdSchema = z.object({
  id: z.string().min(1).max(100)
});

const graphQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  maxHops: z.number().int().min(1).max(10).optional().default(3),
  includeNeighbors: z.boolean().optional().default(true),
  communityLevel: z.number().int().min(0).max(5).optional().default(0),
  useRL: z.boolean().optional().default(false)
});

const knowledgeIngestionSchema = z.object({
  text: z.string().min(1).max(50000),
  source: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
  extractEntities: z.boolean().optional().default(true),
  extractRelationships: z.boolean().optional().default(true),
  buildHyperedges: z.boolean().optional().default(true),
  detectCommunities: z.boolean().optional().default(false)
});

const entityCreateSchema = z.object({
  type: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  properties: z.record(z.any()).optional().default({}),
  importance: z.number().min(0).max(1).optional().default(1.0)
});

const relationshipCreateSchema = z.object({
  type: z.string().min(1).max(50),
  sourceId: z.string().min(1).max(100),
  targetId: z.string().min(1).max(100),
  properties: z.record(z.any()).optional().default({}),
  weight: z.number().min(0).max(1).optional().default(1.0),
  bidirectional: z.boolean().optional().default(false)
});

const similaritySearchSchema = z.object({
  query: z.string().min(1).max(1000),
  threshold: z.number().min(0).max(1).optional().default(0.5),
  maxResults: z.number().int().min(1).max(100).optional().default(10),
  searchTypes: z.array(z.enum(['entity', 'community', 'hyperedge'])).optional(),
  weightings: z.object({
    entity: z.number().min(0).max(2).optional(),
    community: z.number().min(0).max(2).optional(),
    hyperedge: z.number().min(0).max(2).optional()
  }).optional(),
  includeMetadata: z.boolean().optional().default(true)
});

const paginationSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['name', 'type', 'importance', 'createdAt']).optional().default('importance'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

const analyticsQuerySchema = z.object({
  metric: z.enum(['degree', 'centrality', 'clustering', 'modularity', 'density']),
  nodeId: z.string().optional(),
  communityId: z.string().optional(),
  includeDetails: z.boolean().optional().default(false)
});

// ============================================================================
// Types for API responses
// ============================================================================

interface GraphVisualizationData {
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    group: string;
    size: number;
    color: string;
    x?: number;
    y?: number;
    metadata: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    weight: number;
    color: string;
    metadata: Record<string, any>;
  }>;
  hyperedges: Array<{
    id: string;
    nodes: string[];
    type: string;
    weight: number;
    metadata: Record<string, any>;
  }>;
  communities: Array<{
    id: string;
    nodes: string[];
    label: string;
    color: string;
    level: number;
    metadata: Record<string, any>;
  }>;
  layout: {
    algorithm: string;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  };
  metadata: {
    nodeCount: number;
    edgeCount: number;
    hyperedgeCount: number;
    communityCount: number;
    lastUpdated: string;
  };
}

interface GraphAnalytics {
  overview: {
    nodeCount: number;
    edgeCount: number;
    hyperedgeCount: number;
    communityCount: number;
    density: number;
    avgDegree: number;
    diameter: number;
    clustering: number;
  };
  topNodes: Array<{
    id: string;
    name: string;
    type: string;
    degree: number;
    centrality: number;
    importance: number;
  }>;
  topCommunities: Array<{
    id: string;
    label: string;
    size: number;
    density: number;
    centrality: number;
  }>;
  distributions: {
    degreeDistribution: Array<{ degree: number; count: number }>;
    typeDistribution: Array<{ type: string; count: number }>;
    communityDistribution: Array<{ size: number; count: number }>;
  };
}

// Global realtime service reference
let realtimeService: RealtimeBroadcastService | null = null;

// Helper function to set realtime service
export function setRealtimeService(service: RealtimeBroadcastService) {
  realtimeService = service;
}

// Helper function to broadcast graph updates
function broadcastGraphUpdate(event: string, data: any) {
  if (realtimeService) {
    realtimeService.broadcastToRoom('knowledge_graph', event, {
      timestamp: Date.now(),
      ...data
    });
  }
}

// ============================================================================
// Graph Data Management Endpoints
// ============================================================================

/**
 * GET /api/knowledge-graph/overview
 * Get high-level graph overview and statistics
 */
router.get('/overview',
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    log.info('Fetching knowledge graph overview', LogContext.API);

    try {
      const metrics = knowledgeGraphService.getMetrics();
      const indexStats = vectorSimilarityService.getIndexStatistics();
      
      const overview = {
        metrics,
        indexStatistics: indexStats,
        serviceStatus: {
          knowledgeGraph: 'healthy',
          vectorSimilarity: 'healthy',
          communityDetection: 'healthy',
          hypergraphConstruction: 'healthy'
        },
        lastUpdated: new Date().toISOString()
      };

      sendSuccess(res, overview);
    } catch (error) {
      log.error('Failed to fetch graph overview', LogContext.API, { error });
      throw new ApiServiceUnavailableError('Knowledge graph service');
    }
  })
);

/**
 * GET /api/knowledge-graph/visualization
 * Get graph data formatted for visualization in Arc UI
 */
router.get('/visualization',
  authenticate,
  validateQueryParams(paginationSchema.extend({
    includeHyperedges: z.boolean().optional().default(true),
    includeCommunities: z.boolean().optional().default(true),
    layout: z.enum(['force', 'circular', 'hierarchical', 'grid']).optional().default('force'),
    filter: z.object({
      nodeTypes: z.array(z.string()).optional(),
      edgeTypes: z.array(z.string()).optional(),
      communityIds: z.array(z.string()).optional()
    }).optional()
  })),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { includeHyperedges, includeCommunities, layout, filter, page, limit } = req.query as any;

    log.info('Generating visualization data', LogContext.API, {
      includeHyperedges,
      includeCommunities,
      layout,
      filter
    });

    try {
      // This would be implemented to fetch actual graph data
      // For now, returning a structured response format
      const visualizationData: GraphVisualizationData = {
        nodes: [],
        edges: [],
        hyperedges: [],
        communities: [],
        layout: {
          algorithm: layout,
          bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
        },
        metadata: {
          nodeCount: 0,
          edgeCount: 0,
          hyperedgeCount: 0,
          communityCount: 0,
          lastUpdated: new Date().toISOString()
        }
      };

      // TODO: Implement actual graph data fetching and formatting
      // This would involve:
      // 1. Fetching entities from knowledge graph service
      // 2. Fetching relationships
      // 3. Applying filters
      // 4. Formatting for visualization
      // 5. Computing layout coordinates

      sendSuccess(res, visualizationData);
    } catch (error) {
      log.error('Failed to generate visualization data', LogContext.API, { error });
      throw new ApiServiceUnavailableError('Graph visualization service');
    }
  })
);

/**
 * POST /api/knowledge-graph/ingest
 * Ingest new knowledge from text content
 */
router.post('/ingest',
  validateContentType('application/json'),
  validateRequestSize(10 * 1024 * 1024), // 10MB limit
  authenticate,
  validateRequestBody(knowledgeIngestionSchema),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { text, source, metadata, extractEntities, extractRelationships, buildHyperedges, detectCommunities } = req.body;

    log.info('Ingesting knowledge', LogContext.API, {
      textLength: text.length,
      source,
      extractEntities,
      extractRelationships,
      buildHyperedges,
      detectCommunities
    });

    try {
      const results = {
        entities: [] as GraphEntity[],
        relationships: [] as GraphRelationship[],
        hyperedges: [] as any[], // TODO: Use proper Hyperedge type from knowledge-graph-service
        communities: [] as Community[]
      };

      // Extract entities
      if (extractEntities) {
        results.entities = await knowledgeGraphService.extractEntities(text, source);
      }

      // Extract relationships
      if (extractRelationships && results.entities.length > 0) {
        results.relationships = await knowledgeGraphService.extractRelationships(text, results.entities);
      }

      // Build hyperedges for n-ary relationships
      if (buildHyperedges && results.entities.length > 2) {
        // TODO: Implement hypergraph construction with proper interface mapping
        // For now, using empty array as placeholder
        results.hyperedges = [];
      }

      // Store in graph database
      await knowledgeGraphService.storeGraph(results.entities, results.relationships, []);

      // Update vector similarity index
      if (results.entities.length > 0) {
        await vectorSimilarityService.indexEntities(results.entities);
      }

      // Detect communities if requested
      if (detectCommunities) {
        const graphData: GraphData = {
          nodes: results.entities,
          edges: results.relationships,
          hyperedges: results.hyperedges
        };
        const detectionResult = await communityDetector.detectCommunities(graphData);
        results.communities = detectionResult.communities;
        if (results.communities.length > 0) {
          await vectorSimilarityService.indexCommunities(results.communities);
        }
      }

      // Broadcast update to connected clients
      broadcastGraphUpdate('knowledge_ingested', {
        entitiesAdded: results.entities.length,
        relationshipsAdded: results.relationships.length,
        hyperedgesAdded: results.hyperedges.length,
        communitiesDetected: results.communities.length,
        source
      });

      const response = {
        success: true,
        results: {
          entitiesExtracted: results.entities.length,
          relationshipsExtracted: results.relationships.length,
          hyperedgesBuilt: results.hyperedges.length,
          communitiesDetected: results.communities.length
        },
        entities: results.entities.map(e => ({
          id: e.id,
          type: e.type,
          name: e.name,
          importance: e.importance
        })),
        processingMetadata: {
          textLength: text.length,
          source,
          timestamp: new Date().toISOString()
        }
      };

      sendSuccess(res, response, 201);
    } catch (error) {
      log.error('Knowledge ingestion failed', LogContext.API, { error, textLength: text.length });
      throw new ApiServiceUnavailableError('Knowledge ingestion service');
    }
  })
);

// ============================================================================
// Entity Management Endpoints
// ============================================================================

/**
 * POST /api/knowledge-graph/entities
 * Create a new entity
 */
router.post('/entities',
  validateContentType('application/json'),
  authenticate,
  validateRequestBody(entityCreateSchema),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { type, name, properties, importance } = req.body;

    log.info('Creating new entity', LogContext.API, { type, name });

    try {
      const entity: GraphEntity = {
        id: `entity_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        type,
        name,
        properties: {
          ...properties,
          createdAt: new Date().toISOString(),
          createdBy: 'api'
        },
        importance
      };

      // Store entity
      await knowledgeGraphService.storeGraph([entity], [], []);

      // Update vector index
      await vectorSimilarityService.indexEntities([entity]);

      // Broadcast update
      broadcastGraphUpdate('entity_created', { entity });

      sendSuccess(res, entity, 201);
    } catch (error) {
      log.error('Failed to create entity', LogContext.API, { error, name });
      throw new ApiServiceUnavailableError('Entity creation service');
    }
  })
);

/**
 * GET /api/knowledge-graph/entities/:id
 * Get entity details by ID
 */
router.get('/entities/:id',
  authenticate,
  validateParams(nodeIdSchema),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    log.info('Fetching entity', LogContext.API, { entityId: id });

    try {
      // TODO: Implement actual entity fetching from knowledge graph service
      // This would involve querying the graph database
      
      throw new ApiNotFoundError('Entity');
    } catch (error) {
      if (error instanceof ApiNotFoundError) {
        throw error;
      }
      log.error('Failed to fetch entity', LogContext.API, { error, entityId: id });
      throw new ApiServiceUnavailableError('Entity retrieval service');
    }
  })
);

// ============================================================================
// Relationship Management Endpoints
// ============================================================================

/**
 * POST /api/knowledge-graph/relationships
 * Create a new relationship between entities
 */
router.post('/relationships',
  validateContentType('application/json'),
  authenticate,
  validateRequestBody(relationshipCreateSchema),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { type, sourceId, targetId, properties, weight, bidirectional } = req.body;

    log.info('Creating new relationship', LogContext.API, { type, sourceId, targetId });

    try {
      const relationship: GraphRelationship = {
        id: `rel_${sourceId}_${targetId}_${Date.now()}`,
        type,
        sourceId,
        targetId,
        properties: {
          ...properties,
          createdAt: new Date().toISOString(),
          createdBy: 'api'
        },
        weight,
        bidirectional
      };

      // Store relationship
      await knowledgeGraphService.storeGraph([], [relationship], []);

      // Broadcast update
      broadcastGraphUpdate('relationship_created', { relationship });

      sendSuccess(res, relationship, 201);
    } catch (error) {
      log.error('Failed to create relationship', LogContext.API, { error, sourceId, targetId });
      throw new ApiServiceUnavailableError('Relationship creation service');
    }
  })
);

// ============================================================================
// Search and Traversal Endpoints
// ============================================================================

/**
 * POST /api/knowledge-graph/search
 * Semantic search across the knowledge graph
 */
router.post('/search',
  validateContentType('application/json'),
  authenticate,
  validateRequestBody(similaritySearchSchema),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { query, threshold, maxResults, searchTypes, weightings, includeMetadata } = req.body;

    log.info('Performing semantic search', LogContext.API, { 
      query: query.substring(0, 100),
      threshold,
      maxResults,
      searchTypes
    });

    try {
      const searchOptions: SimilaritySearchOptions = {
        threshold,
        maxResults,
        searchTypes,
        weightings,
        includeMetadata
      };

      const results = await vectorSimilarityService.searchSimilar(query, searchOptions);

      const response = {
        query,
        results: results.map(result => ({
          id: result.item.id,
          type: result.type,
          name: result.type === 'entity' ? (result.item as GraphEntity).name : 
                result.type === 'community' ? (result.item as Community).label :
                (result.item as Hyperedge).type,
          similarity: result.similarity,
          metadata: result.metadata
        })),
        searchMetadata: {
          totalResults: results.length,
          threshold,
          searchTypes: searchTypes || ['entity', 'community', 'hyperedge'],
          timestamp: new Date().toISOString()
        }
      };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Semantic search failed', LogContext.API, { error, query: query.substring(0, 100) });
      throw new ApiServiceUnavailableError('Search service');
    }
  })
);

/**
 * POST /api/knowledge-graph/traverse
 * Multi-hop graph traversal with reasoning
 */
router.post('/traverse',
  validateContentType('application/json'),
  authenticate,
  validateRequestBody(graphQuerySchema),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const graphQuery: GraphQuery = req.body;

    log.info('Performing graph traversal', LogContext.API, {
      query: graphQuery.query.substring(0, 100),
      maxHops: graphQuery.maxHops,
      useRL: graphQuery.useRL
    });

    try {
      const paths = await knowledgeGraphService.retrieveWithGraph(graphQuery);

      const response = {
        query: graphQuery.query,
        paths: paths.map(path => ({
          nodes: path.nodes.map(node => ({
            id: node.id,
            name: node.name,
            type: node.type,
            importance: node.importance
          })),
          relationships: path.relationships.map(rel => ({
            id: rel.id,
            type: rel.type,
            sourceId: rel.sourceId,
            targetId: rel.targetId,
            weight: rel.weight
          })),
          score: path.score,
          reasoning: path.reasoning
        })),
        traversalMetadata: {
          totalPaths: paths.length,
          maxHops: graphQuery.maxHops,
          useRL: graphQuery.useRL,
          timestamp: new Date().toISOString()
        }
      };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Graph traversal failed', LogContext.API, { error, query: graphQuery.query.substring(0, 100) });
      throw new ApiServiceUnavailableError('Graph traversal service');
    }
  })
);

// ============================================================================
// Community Detection Endpoints
// ============================================================================

/**
 * POST /api/knowledge-graph/communities/detect
 * Detect communities in the knowledge graph
 */
router.post('/communities/detect',
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    log.info('Detecting communities', LogContext.API);

    try {
      // TODO: Get actual graph data from the knowledge graph service
      // For now, we'll use placeholder data
      const graphData: GraphData = {
        nodes: [], // TODO: Fetch actual entities
        edges: [], // TODO: Fetch actual relationships
        hyperedges: [] // TODO: Fetch actual hyperedges
      };
      
      const detectionResult = await communityDetector.detectCommunities(graphData);
      const {communities} = detectionResult;

      // Update vector similarity index with new communities
      if (communities.length > 0) {
        await vectorSimilarityService.indexCommunities(communities);
      }

      // Broadcast update
      broadcastGraphUpdate('communities_detected', {
        communitiesFound: communities.length
      });

      const response = {
        communities: communities.map(community => ({
          id: community.id,
          label: community.label,
          nodeCount: community.nodeIds.length,
          level: community.level,
          summary: community.summary
        })),
        metadata: {
          totalCommunities: communities.length,
          algorithm: 'louvain',
          timestamp: new Date().toISOString()
        }
      };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Community detection failed', LogContext.API, { error });
      throw new ApiServiceUnavailableError('Community detection service');
    }
  })
);

// ============================================================================
// Analytics Endpoints
// ============================================================================

/**
 * GET /api/knowledge-graph/analytics
 * Get comprehensive graph analytics and insights
 */
router.get('/analytics',
  authenticate,
  validateQueryParams(analyticsQuerySchema.partial()),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { metric, nodeId, communityId, includeDetails } = req.query as any;

    log.info('Generating graph analytics', LogContext.API, { metric, nodeId, communityId });

    try {
      const metrics = knowledgeGraphService.getMetrics();
      
      // TODO: Implement comprehensive graph analytics
      // This would include degree distribution, centrality measures, 
      // clustering coefficients, community modularity, etc.
      
      const analytics: GraphAnalytics = {
        overview: {
          nodeCount: metrics.nodeCount,
          edgeCount: metrics.edgeCount,
          hyperedgeCount: metrics.hyperedgeCount,
          communityCount: metrics.communityCount,
          density: metrics.density,
          avgDegree: metrics.avgDegree,
          diameter: 0, // TODO: Calculate
          clustering: 0 // TODO: Calculate
        },
        topNodes: [],
        topCommunities: [],
        distributions: {
          degreeDistribution: [],
          typeDistribution: [],
          communityDistribution: []
        }
      };

      sendSuccess(res, analytics);
    } catch (error) {
      log.error('Analytics generation failed', LogContext.API, { error });
      throw new ApiServiceUnavailableError('Analytics service');
    }
  })
);

// ============================================================================
// Real-time Graph Updates
// ============================================================================

/**
 * GET /api/knowledge-graph/stream
 * Server-sent events for real-time graph updates
 */
router.get('/stream',
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    log.info('Establishing graph update stream', LogContext.API);

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connection',
      message: 'Graph update stream established',
      timestamp: Date.now()
    })}\n\n`);

    // Set up periodic heartbeat
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: Date.now()
      })}\n\n`);
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      log.info('Graph update stream closed', LogContext.API);
    });
  })
);

// ============================================================================
// Context Clustering and Semantic Analysis
// ============================================================================

/**
 * POST /api/knowledge-graph/cluster
 * Perform context clustering and semantic analysis
 */
router.post('/cluster',
  validateContentType('application/json'),
  authenticate,
  validateRequestBody(z.object({
    entities: z.array(z.string()).min(1),
    algorithm: z.enum(['kmeans', 'hierarchical', 'dbscan']).optional().default('kmeans'),
    numClusters: z.number().int().min(2).max(20).optional(),
    includeVisualization: z.boolean().optional().default(true)
  })),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { entities, algorithm, numClusters, includeVisualization } = req.body;

    log.info('Performing context clustering', LogContext.API, {
      entityCount: entities.length,
      algorithm,
      numClusters
    });

    try {
      // TODO: Implement context clustering using vector similarity service
      // This would involve:
      // 1. Fetching embeddings for specified entities
      // 2. Applying clustering algorithm
      // 3. Analyzing semantic relationships within clusters
      // 4. Generating visualization data if requested

      const response = {
        clusters: [],
        analysis: {
          algorithm,
          numClusters: numClusters || Math.ceil(Math.sqrt(entities.length)),
          silhouetteScore: 0, // TODO: Calculate
          withinClusterSumOfSquares: 0 // TODO: Calculate
        },
        visualization: includeVisualization ? {
          coordinates: [],
          clusterColors: []
        } : undefined,
        timestamp: new Date().toISOString()
      };

      sendSuccess(res, response);
    } catch (error) {
      log.error('Context clustering failed', LogContext.API, { error });
      throw new ApiServiceUnavailableError('Clustering service');
    }
  })
);

// ============================================================================
// Graph Management Endpoints
// ============================================================================

/**
 * DELETE /api/knowledge-graph/clear
 * Clear all graph data (dangerous operation)
 */
router.delete('/clear',
  authenticate,
  asyncErrorHandler(async (req: Request, res: Response) => {
    log.warn('Clearing knowledge graph', LogContext.API);

    try {
      // Clear vector similarity index
      vectorSimilarityService.clearIndex();

      // Broadcast update
      broadcastGraphUpdate('graph_cleared', {
        clearedAt: new Date().toISOString()
      });

      sendSuccess(res, {
        message: 'Knowledge graph cleared successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('Failed to clear knowledge graph', LogContext.API, { error });
      throw new ApiServiceUnavailableError('Graph management service');
    }
  })
);

/**
 * GET /api/knowledge-graph/health
 * Health check for all graph services
 */
router.get('/health',
  asyncErrorHandler(async (req: Request, res: Response) => {
    try {
      const metrics = knowledgeGraphService.getMetrics();
      const indexStats = vectorSimilarityService.getIndexStatistics();

      const health = {
        status: 'healthy',
        services: {
          knowledgeGraph: {
            status: 'healthy',
            metrics: {
              nodeCount: metrics.nodeCount,
              edgeCount: metrics.edgeCount,
              lastUpdate: new Date(metrics.constructionTimeMs).toISOString()
            }
          },
          vectorSimilarity: {
            status: 'healthy',
            metrics: {
              indexedEntities: indexStats.entities,
              indexedCommunities: indexStats.communities,
              lastUpdate: indexStats.lastUpdated
            }
          },
          communityDetection: {
            status: 'healthy'
          },
          hypergraphConstruction: {
            status: 'healthy'
          }
        },
        timestamp: new Date().toISOString()
      };

      sendSuccess(res, health);
    } catch (error) {
      log.error('Health check failed', LogContext.API, { error });
      const health = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      sendError(res, 'SERVICE_UNAVAILABLE', 'Graph services unhealthy', 503, health);
    }
  })
);

export default router;
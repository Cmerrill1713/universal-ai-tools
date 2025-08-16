/**
 * GraphRAG Router
 * 
 * API endpoints for GraphRAG functionality including entity extraction,
 * knowledge graph construction, and graph-based retrieval.
 */

import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { contextStorageService } from '../services/context-storage-service';
import { 
  type EntityExtractionOptions,
  entityExtractor,
} from '../services/graph-rag/entity-extractor';
import { 
  type GraphMetrics,
  type GraphQuery,
  knowledgeGraphService,
} from '../services/graph-rag/knowledge-graph-service';
import { log, LogContext } from '../utils/logger';

const router = Router();

// Apply authentication middleware
router.use(authenticate);

// Validation schemas
const BuildGraphSchema = z.object({
  texts: z.array(z.string()).optional(),
  contextIds: z.array(z.string()).optional(),
  source: z.string().optional(),
  includeEmbeddings: z.boolean().default(true),
  detectCommunities: z.boolean().default(false),
  useExistingContext: z.boolean().default(true),
});

const QueryGraphSchema = z.object({
  query: z.string().min(1),
  maxHops: z.number().min(1).max(10).default(3),
  includeNeighbors: z.boolean().default(true),
  communityLevel: z.number().min(0).max(5).optional(),
  useRL: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(10),
});

const ExtractEntitiesSchema = z.object({
  text: z.string().min(1),
  model: z.string().optional(),
  includeEmbeddings: z.boolean().default(false),
  contextWindow: z.number().optional(),
});

/**
 * Build or update knowledge graph
 */
router.post(
  '/build',
  validateRequest(BuildGraphSchema),
  async (req, res) => {
    try {
      const {
        texts = [],
        contextIds = [],
        source,
        includeEmbeddings,
        detectCommunities,
        useExistingContext,
      } = req.body;

      log.info('🏗️ Building knowledge graph', LogContext.API, {
        textsCount: texts.length,
        contextIds: contextIds.length,
        source,
      });

      const allTexts: string[] = [...texts];
      
      // Fetch texts from existing context if requested
      if (useExistingContext && contextIds.length > 0) {
        const contexts = await contextStorageService.getContextsByIds(contextIds);
        allTexts.push(...contexts.map(c => c.content));
      }
      
      // Fetch recent contexts if no specific texts provided
      if (allTexts.length === 0 && useExistingContext) {
        const recentContexts = await contextStorageService.getRecentContexts(
          req.user?.id || 'system',
          50
        );
        allTexts.push(...recentContexts.map(c => c.content));
      }

      if (allTexts.length === 0) {
        return res.status(400).json({
          error: 'No texts provided for graph construction',
        });
      }

      // Extract entities from all texts
      const allEntities = [];
      const allRelationships = [];
      const allHyperedges = [];
      
      for (const text of allTexts) {
        // Extract entities
        const extractedEntities = await entityExtractor.extractWithLLM(text, {
          includeEmbeddings,
        });
        
        const graphEntities = extractedEntities.map(e => 
          entityExtractor.toGraphEntity(e, source)
        );
        
        // Extract relationships
        const relationships = await knowledgeGraphService.extractRelationships(
          text,
          graphEntities
        );
        
        // Build hyperedges
        const hyperedges = await knowledgeGraphService.buildHyperedges(
          graphEntities,
          text
        );
        
        allEntities.push(...graphEntities);
        allRelationships.push(...relationships);
        allHyperedges.push(...hyperedges);
      }

      // Deduplicate entities
      const uniqueEntities = Array.from(
        new Map(allEntities.map(e => [e.id, e])).values()
      );

      // Store in graph database
      await knowledgeGraphService.storeGraph(
        uniqueEntities,
        allRelationships,
        allHyperedges
      );

      // Detect communities if requested
      let communities: any[] = [];
      if (detectCommunities) {
        communities = await knowledgeGraphService.detectCommunities();
      }

      // Get metrics
      const metrics = knowledgeGraphService.getMetrics();

      return res.json({
        success: true,
        metrics: {
          ...metrics,
          entitiesAdded: uniqueEntities.length,
          relationshipsAdded: allRelationships.length,
          hyperedgesAdded: allHyperedges.length,
          communitiesDetected: communities.length,
        },
        entities: uniqueEntities.slice(0, 10), // Return sample
        communities: communities.slice(0, 5), // Return sample
      });
    } catch (error) {
      log.error('❌ Graph construction failed', LogContext.API, { error });
      return res.status(500).json({
        error: 'Failed to build knowledge graph',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Query knowledge graph
 */
router.post(
  '/query',
  validateRequest(QueryGraphSchema),
  async (req, res) => {
    try {
      const query: GraphQuery = req.body;
      
      log.info('🔍 Querying knowledge graph', LogContext.API, { query });

      // Perform graph-based retrieval
      const paths = await knowledgeGraphService.retrieveWithGraph(query);

      // Limit results
      const limitedPaths = paths.slice(0, (req.body as any).limit || 10);

      // Format response
      const response = {
        query: query.query,
        paths: limitedPaths.map(path => ({
          nodes: path.nodes.map(n => ({
            id: n.id,
            name: n.name,
            type: n.type,
            importance: n.importance,
          })),
          relationships: path.relationships,
          score: path.score,
          reasoning: path.reasoning,
        })),
        totalPaths: paths.length,
        rlOptimized: query.useRL,
      };

      return res.json(response);
    } catch (error) {
      log.error('❌ Graph query failed', LogContext.API, { error });
      return res.status(500).json({
        error: 'Failed to query knowledge graph',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Extract entities from text
 */
router.post(
  '/extract-entities',
  validateRequest(ExtractEntitiesSchema),
  async (req, res) => {
    try {
      const { text, model, includeEmbeddings, contextWindow } = req.body;
      
      log.info('📋 Extracting entities', LogContext.API, {
        textLength: text.length,
        model,
      });

      const options: EntityExtractionOptions = {
        model,
        includeEmbeddings,
        contextWindow,
      };

      // Extract entities
      const entities = await entityExtractor.extractWithLLM(text, options);
      
      // Deduplicate
      const uniqueEntities = entityExtractor.deduplicateEntities(entities);

      return res.json({
        entities: uniqueEntities,
        count: uniqueEntities.length,
        extractionMethod: 'llm',
      });
    } catch (error) {
      log.error('❌ Entity extraction failed', LogContext.API, { error });
      return res.status(500).json({
        error: 'Failed to extract entities',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Get graph metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = knowledgeGraphService.getMetrics();
    
    res.json({
      metrics,
      status: metrics.nodeCount > 0 ? 'active' : 'empty',
      costEstimate: {
        perThousandTokens: metrics.costPerToken * 1000,
        totalCost: (metrics.nodeCount * metrics.costPerToken * 100), // Rough estimate
      },
    });
  } catch (error) {
    log.error('❌ Failed to get metrics', LogContext.API, { error });
    res.status(500).json({
      error: 'Failed to retrieve graph metrics',
    });
  }
});

/**
 * Visualize graph (returns Cytoscape-compatible format)
 */
router.get('/visualize', async (req, res) => {
  try {
    // This would fetch graph data and format it for visualization
    // For now, return a sample structure
    
    const visualization = {
      nodes: [],
      edges: [],
      layout: 'cose', // Compound Spring Embedder layout
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#666',
            'label': 'data(label)',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
          },
        },
      ],
    };
    
    res.json(visualization);
  } catch (error) {
    log.error('❌ Visualization failed', LogContext.API, { error });
    res.status(500).json({
      error: 'Failed to generate visualization',
    });
  }
});

/**
 * Health check for GraphRAG service
 */
router.get('/health', async (req, res) => {
  try {
    const metrics = knowledgeGraphService.getMetrics();
    const isHealthy = metrics.nodeCount >= 0; // Basic health check
    
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      graphrag: {
        enabled: true,
        nodeCount: metrics.nodeCount,
        edgeCount: metrics.edgeCount,
        neo4j: 'checking', // Would check actual Neo4j connection
        ollama: 'checking', // Would check Ollama availability
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;